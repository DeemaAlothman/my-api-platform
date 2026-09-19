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

  // حساب استخدام الإجازة الساعية للشهر الحالي من الطلبات اليدوية الحقيقية فقط — يستثني حوادث
  // التأخير/الخروج المبكر التلقائية (EARLY_LEAVE_AUTO/TARDINESS_AUTO) لأنها ليست طلب إجازة حقيقي
  // من الموظف. مؤكَّد بحالة حقيقية: usedHours المخزّن بجدول leave_balances تراكمي على كامل السنة
  // ويشمل خطأً هالحوادث التلقائية (موظفة عندها 4 ساعات إجازة يدوية حقيقية هالشهر، وكان معروض
  // "مستخدم 6.0" بسبب 2 ساعة إضافية من حوادث تلقائية معتمدة). الرصيد الفعلي شهري (٢ ساعة/شهر)
  // وليس سنوي، فلازم يُحسب لحظياً من طلبات الشهر الحالي بدل قراءة usedHours السنوي المخزّن مباشرة
  private async getHourlyMonthlyUsage(employeeId: string, leaveTypeId: string): Promise<{ usedHours: number; maxHoursPerMonth: number }> {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

    const usedRows = await this.prisma.$queryRawUnsafe(
      `SELECT COALESCE(SUM("durationHours"), 0) as "usedHours"
       FROM leaves.leave_requests
       WHERE "employeeId" = $1 AND "leaveTypeId" = $2
         AND "isHourlyLeave" = true AND status = 'APPROVED'
         AND (source IS NULL OR source = 'EMPLOYEE_REQUEST')
         AND "startDate" >= $3 AND "startDate" < $4
         AND "deletedAt" IS NULL`,
      employeeId, leaveTypeId, monthStart, nextMonthStart,
    ) as Array<{ usedHours: number }>;

    const typeRows = await this.prisma.$queryRawUnsafe(
      `SELECT "maxHoursPerMonth" FROM leaves.leave_types WHERE id = $1`,
      leaveTypeId,
    ) as Array<{ maxHoursPerMonth: number | null }>;

    return {
      usedHours: Number(usedRows[0]?.usedHours ?? 0),
      maxHoursPerMonth: Number(typeRows[0]?.maxHoursPerMonth ?? 2),
    };
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

    const result = [];
    for (const balance of balances as any[]) {
      if (balance.leaveType?.code === 'HOURLY') {
        const { usedHours, maxHoursPerMonth } = await this.getHourlyMonthlyUsage(employeeId, balance.leaveTypeId);
        const remainingHours = Math.max(0, maxHoursPerMonth - usedHours);
        result.push({
          ...balance,
          employee: employeeMap.get(balance.employeeId) || null,
          usedHours,
          usedDays: usedHours,
          remainingHours,
          remainingDays: remainingHours,
        });
      } else {
        result.push({
          ...balance,
          employee: employeeMap.get(balance.employeeId) || null,
        });
      }
    }
    return result;
  }

  // ملخص الإجازة السنوية لموظف معين بسنة محددة: المستحق مقابل المأخوذ
  async getAnnualSummary(employeeId: string, year?: number) {
    const currentYear = year || new Date().getFullYear();

    const annualType = await this.prisma.leaveType.findUnique({ where: { code: 'ANNUAL' } });
    if (!annualType) throw new NotFoundException('نوع الإجازة السنوية غير معرَّف بالنظام');

    const balance = await this.prisma.leaveBalance.findUnique({
      where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId: annualType.id, year: currentYear } },
    });

    const employeeMap = await this.getEmployeeNames([employeeId]);
    const entitled = balance ? balance.totalDays : 0;
    const used = balance ? balance.usedDays : 0;

    return {
      employeeId,
      employee: employeeMap.get(employeeId) || null,
      year: currentYear,
      entitled,
      used,
      remaining: entitled - used - (balance?.pendingDays ?? 0),
    };
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

    // جلب تاريخ التعيين للحساب التناسبي للإجازة السنوية
    const empRows = await this.prisma.$queryRawUnsafe<Array<{ hireDate: Date | null }>>(
      `SELECT "hireDate" FROM users.employees WHERE id = $1 AND "deletedAt" IS NULL LIMIT 1`,
      employeeId,
    );
    const hireDate: Date | null = empRows[0]?.hireDate ?? null;
    const hireYear = hireDate ? new Date(hireDate).getFullYear() : null;

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
        let totalDays = leaveType.defaultDays;

        // حساب تناسبي (Pro-rata) للإجازة السنوية في سنة التعيين الأولى
        if (leaveType.code === 'ANNUAL' && hireDate && hireYear === currentYear) {
          const hireMonth = new Date(hireDate).getMonth(); // 0=يناير
          const remainingMonths = 12 - hireMonth;
          const proRata = 14 * (remainingMonths / 12);
          // تقريب لأقرب ربع يوم
          totalDays = Math.round(proRata * 4) / 4;
        }

        const balance = await this.prisma.leaveBalance.create({
          data: {
            employeeId,
            leaveTypeId: leaveType.id,
            year: currentYear,
            totalDays,
            remainingDays: totalDays,
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

  async getHourlyMonthly(employeeId: string, year?: number, month?: number) {
    const currentYear = year || new Date().getFullYear();
    const currentMonth = month || new Date().getMonth() + 1;

    const leaveType = (await this.prisma.$queryRawUnsafe(
      `SELECT id, "maxHoursPerMonth" FROM leaves.leave_types
       WHERE code = 'HOURLY' AND "isActive" = true LIMIT 1`,
    )) as Array<{ id: string; maxHoursPerMonth: number }>;

    if (!leaveType[0]) {
      throw new NotFoundException('HOURLY leave type not configured');
    }

    const { id: leaveTypeId, maxHoursPerMonth } = leaveType[0];
    const monthStart = new Date(`${currentYear}-${String(currentMonth).padStart(2, '0')}-01T00:00:00Z`);
    const nextMonth = new Date(monthStart);
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);

    // كل طلبات HOURLY_PAID في الشهر المحدد
    const requests = (await this.prisma.$queryRawUnsafe(
      `SELECT id, "durationHours", status, source, "startDate"
       FROM leaves.leave_requests
       WHERE "employeeId" = $1
         AND "leaveTypeId" = $2
         AND "isHourlyLeave" = true
         AND "startDate" >= $3
         AND "startDate" < $4
         AND "deletedAt" IS NULL
       ORDER BY "startDate" ASC`,
      employeeId, leaveTypeId, monthStart, nextMonth,
    )) as Array<{ id: string; durationHours: number; status: string; source: string; startDate: Date }>;

    const approved = requests.filter(r => r.status === 'APPROVED');
    const byRequests = approved.filter(r => !r.source || r.source === 'EMPLOYEE_REQUEST');
    const byTardiness = approved.filter(r => r.source === 'TARDINESS_AUTO');

    const usedByRequestsHours = byRequests.reduce((s, r) => s + (r.durationHours || 0), 0);
    const usedByTardinessHours = byTardiness.reduce((s, r) => s + (r.durationHours || 0), 0);
    const totalUsedHours = usedByRequestsHours + usedByTardinessHours;
    const remainingHours = Math.max(0, (maxHoursPerMonth || 2) - totalUsedHours);

    return {
      employeeId,
      year: currentYear,
      month: currentMonth,
      leaveTypeId,
      totalHours: maxHoursPerMonth || 2,
      usedByRequestsHours: Math.round(usedByRequestsHours * 100) / 100,
      usedByTardinessHours: Math.round(usedByTardinessHours * 100) / 100,
      totalUsedHours: Math.round(totalUsedHours * 100) / 100,
      remainingHours: Math.round(remainingHours * 100) / 100,
      usedByRequestsMinutes: Math.round(usedByRequestsHours * 60),
      usedByTardinessMinutes: Math.round(usedByTardinessHours * 60),
      totalUsedMinutes: Math.round(totalUsedHours * 60),
      remainingMinutes: Math.round(remainingHours * 60),
    };
  }
}
