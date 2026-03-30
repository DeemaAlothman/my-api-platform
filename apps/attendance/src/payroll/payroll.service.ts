import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GeneratePayrollDto } from './dto/generate-payroll.dto';

@Injectable()
export class PayrollService {
  constructor(private prisma: PrismaService) {}

  // ==================== Generate ====================

  async generate(dto: GeneratePayrollDto) {
    const { year, month, departmentId, policyId } = dto;

    // جيب كل الموظفين من users schema
    const employees = (await this.prisma.$queryRawUnsafe(
      `SELECT e.id, e."employeeNumber", e."departmentId"
       FROM users.employees e
       WHERE e."deletedAt" IS NULL
       ${departmentId ? `AND e."departmentId" = '${departmentId}'` : ''}`,
    )) as Array<{ id: string; employeeNumber: string; departmentId: string }>;

    // جيب السياسة المحددة أو الافتراضية
    let policy: any = null;
    if (policyId) {
      policy = await this.prisma.deductionPolicy.findUnique({ where: { id: policyId } });
      if (!policy) throw new NotFoundException('سياسة الحسم غير موجودة');
    } else {
      policy = await this.prisma.deductionPolicy.findFirst({
        where: { isDefault: true, isActive: true },
      });
    }

    // نطاق الشهر
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // آخر يوم في الشهر

    let generated = 0;
    let errors = 0;
    const results: any[] = [];

    for (const emp of employees) {
      try {
        const result = await this.generateForEmployee(emp.id, year, month, startDate, endDate, policy);
        results.push({ employeeId: emp.id, status: 'ok', payrollId: result.id });
        generated++;
      } catch (err) {
        errors++;
        results.push({ employeeId: emp.id, status: 'error', message: err.message });
      }
    }

    return { year, month, generated, errors, results };
  }

  private async generateForEmployee(
    employeeId: string,
    year: number,
    month: number,
    startDate: Date,
    endDate: Date,
    policy: any,
  ) {
    // إعدادات الحضور-راتب للموظف
    const config = await this.prisma.employeeAttendanceConfig.findUnique({
      where: { employeeId },
    });
    const salaryLinked = config?.salaryLinked ?? true;
    const allowedBreakMinutes = config?.allowedBreakMinutes ?? 60;

    // جيب كل سجلات الحضور للشهر
    const records = await this.prisma.attendanceRecord.findMany({
      where: {
        employeeId,
        date: { gte: startDate, lte: endDate },
      },
      include: { breaks: true },
    });

    // احسب أيام العمل من الجدول الزمني
    const workingDays = await this.getWorkingDays(employeeId, startDate, endDate);

    // إحصاء الأيام
    let presentDays = 0;
    let absentDays = 0;
    let absentUnjustified = 0;
    let lateDays = 0;
    let totalLateMinutes = 0;
    let earlyLeaveDays = 0;
    let totalEarlyLeaveMinutes = 0;
    let breakOverLimitMinutes = 0;
    let overtimeMinutes = 0;
    let totalWorkedMinutes = 0;
    let netWorkedMinutes = 0;

    for (const r of records) {
      if (r.status === 'ABSENT') {
        absentDays++;
        // تحقق هل في تبرير مقبول
        const justification = await this.prisma.attendanceJustification.findFirst({
          where: { attendanceRecordId: r.id, status: { in: ['HR_APPROVED', 'MANAGER_APPROVED'] } },
        });
        if (!justification) absentUnjustified++;
        continue;
      }

      if (['WEEKEND', 'HOLIDAY', 'ON_LEAVE'].includes(r.status)) continue;

      presentDays++;
      totalWorkedMinutes += r.workedMinutes || 0;
      netWorkedMinutes += r.netWorkedMinutes || r.workedMinutes || 0;
      overtimeMinutes += r.overtimeMinutes || 0;

      if (r.lateMinutes > 0) {
        lateDays++;
        totalLateMinutes += r.lateMinutes;
      }
      if (r.earlyLeaveMinutes > 0) {
        earlyLeaveDays++;
        totalEarlyLeaveMinutes += r.earlyLeaveMinutes;
      }

      // حساب الخروج المؤقت الزائد
      const totalBreak = r.totalBreakMinutes || 0;
      if (totalBreak > allowedBreakMinutes) {
        breakOverLimitMinutes += totalBreak - allowedBreakMinutes;
      }
    }

    // حساب أيام الغياب من أيام العمل - أيام الحضور الفعلية
    const recordedDates = new Set(records.map(r => r.date.toISOString().split('T')[0]));
    // الغياب الفعلي يُحسب من أيام العمل التي ليس فيها سجل حضور
    // هذا تقريبي - الحساب الدقيق يحتاج معرفة أيام الدوام الفعلية
    absentDays = Math.max(0, workingDays - presentDays);
    absentUnjustified = Math.min(absentUnjustified, absentDays);

    // تطبيق سياسة الحسم
    let lateDeductionMinutes = 0;
    let earlyLeaveDeductionMinutes = 0;
    let breakDeductionMinutes = 0;
    let absenceDeductionDaysCalc = 0;
    let repeatLatePenaltyDaysCalc = 0;

    if (salaryLinked && policy) {
      // حسم التأخير
      const effectiveLateMinutes = Math.max(0, totalLateMinutes - (policy.lateToleranceMinutes * lateDays));
      lateDeductionMinutes = this.calcDeduction(
        effectiveLateMinutes,
        policy.lateDeductionType,
        policy.lateDeductionTiers,
      );

      // حسم الخروج المبكر
      earlyLeaveDeductionMinutes = this.calcDeduction(
        totalEarlyLeaveMinutes,
        policy.earlyLeaveDeductionType,
        null,
      );

      // حسم الغياب
      absenceDeductionDaysCalc = absentUnjustified * policy.absenceDeductionDays;

      // حسم الخروج المؤقت الزائد
      if (policy.breakOverLimitDeduction === 'MINUTE_BY_MINUTE') {
        breakDeductionMinutes = breakOverLimitMinutes;
      } else if (policy.breakOverLimitDeduction === 'DOUBLE') {
        breakDeductionMinutes = breakOverLimitMinutes * 2;
      }
      // IGNORE → 0

      // عقوبة التأخيرات المتكررة
      if (policy.repeatLateThreshold && lateDays > policy.repeatLateThreshold) {
        repeatLatePenaltyDaysCalc = policy.repeatLatePenaltyDays || 0;
      }
    }

    const totalDeductionMinutes = lateDeductionMinutes + earlyLeaveDeductionMinutes + breakDeductionMinutes;

    // أنشئ أو حدّث كشف الراتب
    const data = {
      employeeId,
      year,
      month,
      workingDays,
      presentDays,
      absentDays,
      absentUnjustified,
      lateDays,
      totalLateMinutes,
      earlyLeaveDays,
      totalEarlyLeaveMinutes,
      breakOverLimitMinutes,
      overtimeMinutes,
      totalWorkedMinutes,
      netWorkedMinutes,
      lateDeductionMinutes,
      earlyLeaveDeductionMinutes,
      breakDeductionMinutes,
      absenceDeductionDays: absenceDeductionDaysCalc,
      repeatLatePenaltyDays: repeatLatePenaltyDaysCalc,
      totalDeductionMinutes,
      salaryLinked,
      policyId: policy?.id || null,
      status: 'DRAFT',
      generatedAt: new Date(),
    };

    return this.prisma.monthlyPayroll.upsert({
      where: { employeeId_year_month: { employeeId, year, month } },
      create: data,
      update: { ...data, confirmedBy: null, confirmedAt: null },
    });
  }

  private calcDeduction(minutes: number, type: string, tiersJson: string | null): number {
    if (minutes <= 0) return 0;
    if (type === 'MINUTE_BY_MINUTE') return minutes;
    if (type === 'TIERED' && tiersJson) {
      try {
        const tiers: Array<{ from: number; to: number; deductMinutes: number }> = JSON.parse(tiersJson);
        for (const tier of tiers) {
          if (minutes >= tier.from && minutes < tier.to) {
            return tier.deductMinutes;
          }
        }
        // إذا تجاوز كل الشرائح → آخر شريحة
        const last = tiers[tiers.length - 1];
        if (last && minutes >= last.from) return last.deductMinutes;
      } catch {}
    }
    return minutes; // fallback
  }

  private async getWorkingDays(employeeId: string, startDate: Date, endDate: Date): Promise<number> {
    // جيب الجدول الزمني الفعّال للموظف
    const schedule = await this.prisma.employeeSchedule.findFirst({
      where: {
        employeeId,
        isActive: true,
        effectiveFrom: { lte: endDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: startDate } }],
      },
      include: { schedule: true },
    });

    let workDaysArray: number[] = [0, 1, 2, 3, 4]; // افتراضي: أحد-خميس
    if (schedule?.schedule?.workDays) {
      try {
        workDaysArray = JSON.parse(schedule.schedule.workDays);
      } catch {}
    }

    // احسب عدد أيام العمل في الشهر
    let count = 0;
    const current = new Date(startDate);
    while (current <= endDate) {
      if (workDaysArray.includes(current.getDay())) count++;
      current.setDate(current.getDate() + 1);
    }
    return count;
  }

  // ==================== Read ====================

  async findAll(query: { year?: number; month?: number; departmentId?: string; status?: string }) {
    const where: any = {};
    if (query.year) where.year = query.year;
    if (query.month) where.month = query.month;
    if (query.status) where.status = query.status;

    const payrolls = await this.prisma.monthlyPayroll.findMany({
      where,
      include: { policy: { select: { nameAr: true, nameEn: true } } },
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { employeeId: 'asc' }],
    });

    if (query.departmentId) {
      const empIds = (await this.prisma.$queryRawUnsafe(
        `SELECT id FROM users.employees WHERE "departmentId" = $1 AND "deletedAt" IS NULL`,
        query.departmentId,
      ) as Array<{ id: string }>).map(e => e.id);
      return payrolls.filter(p => empIds.includes(p.employeeId));
    }

    return payrolls;
  }

  async findOne(employeeId: string, year: number, month: number) {
    const payroll = await this.prisma.monthlyPayroll.findUnique({
      where: { employeeId_year_month: { employeeId, year, month } },
      include: { policy: true },
    });
    if (!payroll) throw new NotFoundException('كشف الراتب غير موجود');
    return payroll;
  }

  // ==================== Confirm ====================

  async confirm(id: string, confirmedBy: string) {
    const payroll = await this.prisma.monthlyPayroll.findUnique({ where: { id } });
    if (!payroll) throw new NotFoundException('كشف الراتب غير موجود');
    return this.prisma.monthlyPayroll.update({
      where: { id },
      data: { status: 'CONFIRMED', confirmedBy, confirmedAt: new Date() },
    });
  }

  // ==================== Export ====================

  async exportMonth(year: number, month: number) {
    const payrolls = await this.prisma.monthlyPayroll.findMany({
      where: { year, month, status: 'CONFIRMED' },
    });
    // تحديث الحالة إلى EXPORTED
    await this.prisma.monthlyPayroll.updateMany({
      where: { year, month, status: 'CONFIRMED' },
      data: { status: 'EXPORTED' },
    });
    return { year, month, exportedCount: payrolls.length, payrolls };
  }
}
