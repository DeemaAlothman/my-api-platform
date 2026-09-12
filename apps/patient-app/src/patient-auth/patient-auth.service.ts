import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ErpClientService } from '../integrations/erp-client.service';
import { RegisterPatientDto } from './dto/register.dto';
import { LoginPatientDto } from './dto/login.dto';
import { PATIENT_ACCESS_TTL_SECONDS, PATIENT_REFRESH_TTL_DAYS } from './tokens';

@Injectable()
export class PatientAuthService {
  private readonly accessSecret = process.env.PATIENT_JWT_ACCESS_SECRET!;
  private readonly refreshSecret = process.env.PATIENT_JWT_REFRESH_SECRET!;

  constructor(
    private readonly prisma: PrismaService,
    private readonly erp: ErpClientService,
  ) {}

  private signAccessToken(patientAccountId: string, erpPatientId: string) {
    return jwt.sign({ sub: patientAccountId, erpPatientId }, this.accessSecret, {
      expiresIn: PATIENT_ACCESS_TTL_SECONDS,
    });
  }

  private signRefreshToken(patientAccountId: string) {
    const jti = crypto.randomUUID();
    return jwt.sign({ sub: patientAccountId, jti }, this.refreshSecret, {
      expiresIn: `${PATIENT_REFRESH_TTL_DAYS}d`,
    });
  }

  private async issueTokens(patientAccountId: string, erpPatientId: string) {
    const accessToken = this.signAccessToken(patientAccountId, erpPatientId);
    const refreshToken = this.signRefreshToken(patientAccountId);
    const expiresAt = new Date(Date.now() + PATIENT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
    await this.prisma.patientRefreshToken.create({
      data: { patientAccountId, token: refreshToken, expiresAt },
    });
    return { accessToken, refreshToken, expiresIn: PATIENT_ACCESS_TTL_SECONDS };
  }

  // تسجيل ذاتي من التطبيق — يُرفض إن لم يوجد مريض مطابق في ERP (الافتراض المقترح بالتوصيف)
  async register(dto: RegisterPatientDto) {
    const matches = await this.erp.findPatientsByPhone(dto.phone);
    if (matches.length === 0) {
      throw new BadRequestException({
        code: 'PATIENT_NOT_FOUND_IN_ERP',
        message: 'لم يتم العثور على مريض بهذا رقم الهاتف. يرجى التواصل مع العيادة لإنشاء الحساب.',
      });
    }
    if (matches.length > 1) {
      throw new BadRequestException({
        code: 'PATIENT_AMBIGUOUS_MATCH',
        message: 'يوجد أكثر من مريض بنفس رقم الهاتف. يرجى التواصل مع العيادة لإنشاء الحساب.',
      });
    }
    const erpPatient = matches[0];

    const existingAccount = await this.prisma.patientAccount.findFirst({
      where: { erpPatientId: erpPatient.id, deletedAt: null },
    });
    if (existingAccount) {
      throw new ConflictException({ code: 'PATIENT_ACCOUNT_EXISTS', message: 'يوجد حساب تطبيق مسبقاً لهذا المريض' });
    }

    const usernameTaken = await this.prisma.patientAccount.findFirst({ where: { username: dto.username } });
    if (usernameTaken) {
      throw new ConflictException({ code: 'USERNAME_TAKEN', message: 'اسم المستخدم مستخدم مسبقاً' });
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const account = await this.prisma.patientAccount.create({
      data: {
        erpPatientId: erpPatient.id,
        username: dto.username,
        passwordHash,
        createdSource: 'APP',
        status: 'ACTIVE',
      },
    });

    const tokens = await this.issueTokens(account.id, account.erpPatientId);
    return { account: this.toPublicAccount(account), ...tokens };
  }

  async login(dto: LoginPatientDto) {
    const account = await this.prisma.patientAccount.findFirst({
      where: { username: dto.username, deletedAt: null },
    });
    if (!account) throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'بيانات الدخول غير صحيحة' });

    const ok = await bcrypt.compare(dto.password, account.passwordHash);
    if (!ok) throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'بيانات الدخول غير صحيحة' });

    if (account.status !== 'ACTIVE') {
      throw new UnauthorizedException({ code: 'PATIENT_ACCOUNT_INACTIVE', message: 'الحساب غير نشط' });
    }

    await this.prisma.patientAccount.update({ where: { id: account.id }, data: { lastLoginAt: new Date() } });

    const tokens = await this.issueTokens(account.id, account.erpPatientId);
    return { account: this.toPublicAccount(account), ...tokens };
  }

  async refresh(refreshToken: string) {
    if (!refreshToken) throw new UnauthorizedException({ code: 'AUTH_TOKEN_INVALID', message: 'Invalid refresh token' });

    try {
      jwt.verify(refreshToken, this.refreshSecret);
    } catch {
      throw new UnauthorizedException({ code: 'AUTH_TOKEN_INVALID', message: 'Invalid refresh token' });
    }

    const record = await this.prisma.patientRefreshToken.findUnique({ where: { token: refreshToken } });
    if (!record || record.revokedAt || record.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException({ code: 'AUTH_TOKEN_INVALID', message: 'Invalid refresh token' });
    }

    const account = await this.prisma.patientAccount.findFirst({
      where: { id: record.patientAccountId, deletedAt: null },
    });
    if (!account || account.status !== 'ACTIVE') {
      throw new UnauthorizedException({ code: 'PATIENT_ACCOUNT_INACTIVE', message: 'الحساب غير نشط' });
    }

    // rotate: أبطل القديم وأصدر جديد
    await this.prisma.patientRefreshToken.update({ where: { id: record.id }, data: { revokedAt: new Date() } });

    return this.issueTokens(account.id, account.erpPatientId);
  }

  async logout(refreshToken: string) {
    if (!refreshToken) return { loggedOut: true };
    await this.prisma.patientRefreshToken.updateMany({
      where: { token: refreshToken, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { loggedOut: true };
  }

  private toPublicAccount(account: { id: string; erpPatientId: string; username: string; status: string }) {
    return { id: account.id, erpPatientId: account.erpPatientId, username: account.username, status: account.status };
  }
}
