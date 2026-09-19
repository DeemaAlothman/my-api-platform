import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { ErpClientService } from '../integrations/erp-client.service';
import { CreateAccountDto, UpdateAccountDto, ListAccountsQueryDto, AutoCreateAccountDto } from './dto/account.dto';

const AUTO_ACCOUNT_PASSWORD = '00000000';

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

  // إنشاء تلقائي (خدمة-لخدمة) عند تحويل حالة إلى علاج فيزيائي — اسم مستخدم = اسم المريض، كلمة سر ثابتة 00000000
  // إن كان للمريض حساب أصلاً (بأي مصدر)، لا يُنشأ حساب ثانٍ — العملية idempotent بأمان
  async autoCreateFromConversion(dto: AutoCreateAccountDto) {
    const existingAccount = await this.prisma.patientAccount.findFirst({
      where: { erpPatientId: dto.erpPatientId, deletedAt: null },
    });
    if (existingAccount) return existingAccount;

    const baseUsername = `${dto.firstName} ${dto.lastName}`.trim();
    const usernameTaken = await this.prisma.patientAccount.findFirst({ where: { username: baseUsername } });
    // تعارض بالاسم (مريض آخر بنفس الاسم) → نميّز باسم المستخدم عبر إلحاق رقم الملف الفريد
    const username = usernameTaken && dto.patientNumber ? `${baseUsername}-${dto.patientNumber}` : baseUsername;

    const passwordHash = await bcrypt.hash(AUTO_ACCOUNT_PASSWORD, 10);
    return this.prisma.patientAccount.create({
      data: {
        erpPatientId: dto.erpPatientId,
        username,
        passwordHash,
        createdSource: 'AUTO_CONVERSION',
        status: 'ACTIVE',
      },
    });
  }

  // قائمة حسابات المريض مع بحث/فلترة/ترقيم — ويرجع بيانات المريض (اسم/هاتف/رقم) داخل كل عنصر
  // لتفادي طلب منفصل لكل سطر بجدول الداشبورد (كما طلب فريق الفرونت إند)
  async findAll(query: ListAccountsQueryDto) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };
    if (query.status) where.status = query.status;

    if (query.search?.trim()) {
      const matchedPatients = await this.erp.searchPatients(query.search.trim());
      const matchedIds = matchedPatients.map((p) => p.id);
      where.OR = [
        { username: { contains: query.search.trim(), mode: 'insensitive' } },
        ...(matchedIds.length ? [{ erpPatientId: { in: matchedIds } }] : []),
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.patientAccount.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      this.prisma.patientAccount.count({ where }),
    ]);

    const patientsMap = await this.erp.findPatientsByIds(items.map((i) => i.erpPatientId));

    return {
      items: items.map((i) => ({
        id: i.id,
        erpPatientId: i.erpPatientId,
        username: i.username,
        status: i.status,
        createdAt: i.createdAt,
        lastLoginAt: i.lastLoginAt,
        patient: patientsMap[i.erpPatientId]
          ? {
              firstName: patientsMap[i.erpPatientId].firstName,
              lastName: patientsMap[i.erpPatientId].lastName,
              phone: patientsMap[i.erpPatientId].phone,
              patientNumber: patientsMap[i.erpPatientId].patientNumber,
            }
          : null,
      })),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
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
