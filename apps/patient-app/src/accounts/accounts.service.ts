import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { ErpClientService } from '../integrations/erp-client.service';
import { CreateAccountDto, UpdateAccountDto } from './dto/account.dto';

@Injectable()
export class AccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly erp: ErpClientService,
  ) {}

  // إنشاء حساب تطبيق من الداشبورد — يتطلب erpPatientId موجود فعلياً في خدمة patients (بند 3 بالتوصيف)
  async create(dto: CreateAccountDto, createdByUserId: string) {
    const exists = await this.erp.patientExists(dto.erpPatientId);
    if (!exists) throw new BadRequestException({ code: 'PATIENT_NOT_FOUND', message: 'المريض غير موجود في النظام' });

    const existingAccount = await this.prisma.patientAccount.findFirst({
      where: { erpPatientId: dto.erpPatientId, deletedAt: null },
    });
    if (existingAccount) {
      throw new ConflictException({ code: 'PATIENT_ACCOUNT_EXISTS', message: 'يوجد حساب تطبيق مسبقاً لهذا المريض' });
    }

    const usernameTaken = await this.prisma.patientAccount.findFirst({ where: { username: dto.username } });
    if (usernameTaken) throw new ConflictException({ code: 'USERNAME_TAKEN', message: 'اسم المستخدم مستخدم مسبقاً' });

    const passwordHash = await bcrypt.hash(dto.password, 10);
    return this.prisma.patientAccount.create({
      data: {
        erpPatientId: dto.erpPatientId,
        username: dto.username,
        passwordHash,
        createdSource: 'DASHBOARD',
        createdByUserId,
        status: 'ACTIVE',
      },
    });
  }

  async findOne(id: string) {
    const account = await this.prisma.patientAccount.findFirst({ where: { id, deletedAt: null } });
    if (!account) throw new NotFoundException('الحساب غير موجود');
    return account;
  }

  async findByErpPatientId(erpPatientId: string) {
    const account = await this.prisma.patientAccount.findFirst({ where: { erpPatientId, deletedAt: null } });
    if (!account) throw new NotFoundException('لا يوجد حساب تطبيق لهذا المريض');
    return account;
  }

  async update(id: string, dto: UpdateAccountDto) {
    await this.findOne(id);
    const data: any = {};
    if (dto.status) data.status = dto.status;
    if (dto.password) data.passwordHash = await bcrypt.hash(dto.password, 10);
    return this.prisma.patientAccount.update({ where: { id }, data });
  }
}
