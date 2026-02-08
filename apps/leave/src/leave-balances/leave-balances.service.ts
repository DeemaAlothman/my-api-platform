import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LeaveBalancesService {
  constructor(private prisma: PrismaService) { }

  private async getEmployeeNames(employeeIds: string[]) {
    if (employeeIds.length === 0) return new Map<string, any>();

    const employees = (await this.prisma.$queryRawUnsafe(
      `SELECT id, "employeeNumber", "firstNameAr", "lastNameAr", "firstNameEn", "lastNameEn"
       FROM users.employees
       WHERE id::text = ANY($1::text[])`,
      employeeIds,
    )) as Array<{ id: string; employeeNumber: string; firstNameAr: string; lastNameAr: string; firstNameEn: string | null; lastNameEn: string | null }>;

    return new Map(employees.map(e => [e.id, {
      employeeNumber: e.employeeNumber,
      firstNameAr: e.firstNameAr,
      lastNameAr: e.lastNameAr,
      firstNameEn: e.firstNameEn,
      lastNameEn: e.lastNameEn,
    }]));
  }

  // الحصول على جميع الأرصدة (للمسؤولين)
  async findAll(year?: number) {
    const currentYear = year || new Date().getFullYear();

    const balances = await this.prisma.leaveBalance.findMany({
      where: {
        year: currentYear,
      },
      include: {
        leaveType: true,
      },
    });

    const employeeIds = [...new Set(balances.map((b: any) => b.employeeId))] as string[];
    const employeeMap = await this.getEmployeeNames(employeeIds);

    return balances.map((balance: any) => ({
      ...balance,
      employee: employeeMap.get(balance.employeeId) || null,
    }));
  }

  // الحصول على رصيد موظف معين
  async findByEmployee(employeeId: string, year?: number) {
    const currentYear = year || new Date().getFullYear();

    const balances = await this.prisma.leaveBalance.findMany({
      where: {
        employeeId,
        year: currentYear,
      },
      include: {
        leaveType: true,
      },
    });

    const employeeMap = await this.getEmployeeNames([employeeId]);

    return balances.map((balance: any) => ({
      ...balance,
      employee: employeeMap.get(balance.employeeId) || null,
    }));
  }

  // الحصول على رصيد محدد
  async findOne(id: string) {
    const balance = await this.prisma.leaveBalance.findUnique({
      where: { id },
      include: {
        leaveType: true,
      },
    });

    if (!balance) {
      throw new NotFoundException('Leave balance not found');
    }

    return balance;
  }

  // إنشاء رصيد جديد لموظف
  async create(employeeId: string, leaveTypeId: string, year: number, totalDays: number) {
    // التحقق من وجود نوع الإجازة
    const leaveType = await this.prisma.leaveType.findUnique({
      where: { id: leaveTypeId },
    });

    if (!leaveType) {
      throw new NotFoundException('Leave type not found');
    }

    // التحقق من عدم وجود رصيد سابق
    const existing = await this.prisma.leaveBalance.findFirst({
      where: { employeeId, leaveTypeId, year },
    });

    if (existing) {
      throw new BadRequestException('Balance already exists for this employee and year');
    }

    const balance = await this.prisma.leaveBalance.create({
      data: {
        employeeId,
        leaveTypeId,
        year,
        totalDays,
        remainingDays: totalDays,
      },
      include: {
        leaveType: true,
      },
    });

    return balance;
  }

  // تعديل رصيد (adjustment)
  async adjust(id: string, adjustmentDays: number, adjustmentReason: string) {
    const balance = await this.prisma.leaveBalance.findUnique({
      where: { id },
    });

    if (!balance) {
      throw new NotFoundException('Leave balance not found');
    }

    const newTotalDays = balance.totalDays + adjustmentDays;
    const newRemainingDays = balance.remainingDays + adjustmentDays;

    const updated = await this.prisma.leaveBalance.update({
      where: { id },
      data: {
        totalDays: newTotalDays,
        remainingDays: newRemainingDays,
        adjustmentDays: balance.adjustmentDays + adjustmentDays,
        adjustmentReason,
      },
      include: {
        leaveType: true,
      },
    });

    return updated;
  }

  // ترحيل الأرصدة من سنة إلى أخرى
  async carryOver(employeeId: string, fromYear: number, toYear: number) {
    const balances = await this.prisma.leaveBalance.findMany({
      where: {
        employeeId,
        year: fromYear,
      },
      include: {
        leaveType: true,
      },
    });

    const newBalances = [];

    for (const balance of balances) {
      // التحقق من عدم وجود رصيد في السنة الجديدة
      const existing = await this.prisma.leaveBalance.findFirst({
        where: {
          employeeId,
          leaveTypeId: balance.leaveTypeId,
          year: toYear,
        },
      });

      if (!existing) {
        const newBalance = await this.prisma.leaveBalance.create({
          data: {
            employeeId,
            leaveTypeId: balance.leaveTypeId,
            year: toYear,
            totalDays: balance.leaveType.defaultDays,
            carriedOverDays: balance.remainingDays,
            remainingDays: balance.leaveType.defaultDays + balance.remainingDays,
          },
          include: {
            leaveType: true,
          },
        });

        newBalances.push(newBalance);
      }
    }

    return newBalances;
  }

  // تهيئة أرصدة موظف جديد
  async initializeForEmployee(employeeId: string, year?: number) {
    const currentYear = year || new Date().getFullYear();

    // جلب جميع أنواع الإجازات النشطة
    const leaveTypes = await this.prisma.leaveType.findMany({
      where: { isActive: true },
    });

    const balances = [];

    for (const leaveType of leaveTypes) {
      // التحقق من عدم وجود رصيد سابق
      const existing = await this.prisma.leaveBalance.findFirst({
        where: {
          employeeId,
          leaveTypeId: leaveType.id,
          year: currentYear,
        },
      });

      if (!existing) {
        const balance = await this.prisma.leaveBalance.create({
          data: {
            employeeId,
            leaveTypeId: leaveType.id,
            year: currentYear,
            totalDays: leaveType.defaultDays,
            remainingDays: leaveType.defaultDays,
          },
          include: {
            leaveType: true,
          },
        });

        balances.push(balance);
      }
    }

    return balances;
  }

  // حذف رصيد
  async remove(id: string) {
    const balance = await this.prisma.leaveBalance.findUnique({
      where: { id },
    });

    if (!balance) {
      throw new NotFoundException('Leave balance not found');
    }

    await this.prisma.leaveBalance.delete({
      where: { id },
    });

    return { message: 'Leave balance deleted successfully' };
  }
}
