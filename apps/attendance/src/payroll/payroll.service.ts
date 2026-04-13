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
         AND e."employmentStatus" = 'ACTIVE'
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
        results.push({ employeeId: emp.id, status: 'error', message: (err as any).message });
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

    // احسب أيام العمل من الجدول الزمني مع مصفوفة أيام الأسبوع
    const { count: workingDays, workDaysArray } = await this.getWorkingDaysInfo(employeeId, startDate, endDate);

    // جلب الإجازات المعتمدة من leaves schema (لاستثنائها من الغياب)
    const approvedLeaves = await this.prisma.$queryRawUnsafe(
      `SELECT "startDate"::date as "startDate", "endDate"::date as "endDate"
       FROM leaves.leave_requests
       WHERE "employeeId" = $1 AND status = 'APPROVED'
         AND "startDate" <= $2 AND "endDate" >= $3`,
      employeeId, endDate, startDate,
    ) as Array<{ startDate: Date; endDate: Date }>;

    const approvedLeaveDates = new Set<string>();
    for (const leave of approvedLeaves) {
      const d = new Date(leave.startDate);
      const end = new Date(leave.endDate);
      while (d <= end) {
        if (d >= startDate && d <= endDate)
          approvedLeaveDates.add(d.toISOString().split('T')[0]);
        d.setDate(d.getDate() + 1);
      }
    }

    // جلب العطل الرسمية من leaves schema
    const holidays = await this.prisma.$queryRawUnsafe(
      `SELECT date::date as date FROM leaves.holidays WHERE date >= $1 AND date <= $2`,
      startDate, endDate,
    ) as Array<{ date: Date }>;
    const holidayDates = new Set(holidays.map(h => new Date(h.date).toISOString().split('T')[0]));

    // إحصاء الأيام من السجلات
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

    const recordedDates = new Set(records.map(r => r.date.toISOString().split('T')[0]));

    // جلب التبريرات المقبولة دفعة واحدة
    const absentRecordIds = records.filter(r => r.status === 'ABSENT').map(r => r.id);
    const justifiedIds = new Set<string>();
    if (absentRecordIds.length > 0) {
      const justifications = await this.prisma.attendanceJustification.findMany({
        where: { attendanceRecordId: { in: absentRecordIds }, status: { in: ['HR_APPROVED', 'MANAGER_APPROVED'] } },
        select: { attendanceRecordId: true },
      });
      justifications.forEach(j => justifiedIds.add(j.attendanceRecordId));
    }

    for (const r of records) {
      if (r.status === 'ABSENT') {
        absentDays++;
        if (!justifiedIds.has(r.id)) absentUnjustified++;
        continue;
      }
      if (['WEEKEND', 'HOLIDAY', 'ON_LEAVE'].includes(r.status)) continue;

      presentDays++;
      totalWorkedMinutes += r.workedMinutes || 0;
      netWorkedMinutes += r.netWorkedMinutes || r.workedMinutes || 0;
      overtimeMinutes += r.overtimeMinutes || 0;

      if (r.lateMinutes > 0) { lateDays++; totalLateMinutes += r.lateMinutes; }
      if (r.earlyLeaveMinutes > 0) { earlyLeaveDays++; totalEarlyLeaveMinutes += r.earlyLeaveMinutes; }

      const totalBreak = r.totalBreakMinutes || 0;
      if (totalBreak > allowedBreakMinutes) breakOverLimitMinutes += totalBreak - allowedBreakMinutes;
    }

    // أيام العمل بدون سجل حضور → غياب (ما لم تكن إجازة معتمدة أو عطلة)
    const current = new Date(startDate);
    while (current <= endDate) {
      const dateStr = current.toISOString().split('T')[0];
      if (workDaysArray.includes(current.getDay()) && !recordedDates.has(dateStr)) {
        if (!approvedLeaveDates.has(dateStr) && !holidayDates.has(dateStr)) {
          absentDays++;
          absentUnjustified++;
        }
      }
      current.setDate(current.getDate() + 1);
    }

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

    // === الحسابات المالية ===
    const empFinancial = await this.prisma.$queryRaw<Array<{
      basicSalary: string | null;
      salaryCurrency: string | null;
    }>>`
      SELECT "basicSalary", "salaryCurrency"
      FROM users.employees
      WHERE id = ${employeeId} AND "deletedAt" IS NULL
    `;

    const basicSalary = empFinancial[0]?.basicSalary ? parseFloat(empFinancial[0].basicSalary) : 0;
    const currency = empFinancial[0]?.salaryCurrency || 'SYP';

    const allowancesRaw = await this.prisma.$queryRaw<Array<{ type: string; amount: string }>>`
      SELECT type, amount FROM users.employee_allowances
      WHERE "employeeId" = ${employeeId}
    `;

    const allowancesBreakdownMap: Record<string, number> = {};
    let allowancesTotal = 0;
    for (const a of allowancesRaw) {
      allowancesBreakdownMap[a.type] = parseFloat(a.amount);
      allowancesTotal += parseFloat(a.amount);
    }

    const dailyWorkMinutes = 480; // 8 ساعات افتراضي
    const dailyRate = workingDays > 0 ? basicSalary / workingDays : 0;
    const minuteRate = dailyRate > 0 ? dailyRate / dailyWorkMinutes : 0;
    const overtimeRateMultiplier = 1.5;

    const deductionAmount = parseFloat((totalDeductionMinutes * minuteRate).toFixed(2));
    const absenceDeductionAmount = parseFloat((absenceDeductionDaysCalc * dailyRate).toFixed(2));
    const repeatLatePenaltyAmount = parseFloat((repeatLatePenaltyDaysCalc * dailyRate).toFixed(2));
    const overtimePay = parseFloat((overtimeMinutes * minuteRate * overtimeRateMultiplier).toFixed(2));
    const grossSalary = parseFloat((basicSalary + allowancesTotal + overtimePay).toFixed(2));
    const netSalary = parseFloat(Math.max(0, grossSalary - deductionAmount - absenceDeductionAmount - repeatLatePenaltyAmount).toFixed(2));

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
      // الحقول المالية
      basicSalary,
      allowancesTotal,
      allowancesBreakdown: JSON.stringify(allowancesBreakdownMap),
      overtimePay,
      deductionAmount,
      absenceDeductionAmount,
      grossSalary,
      netSalary,
      currency,
      dailyRate: parseFloat(dailyRate.toFixed(2)),
      minuteRate: parseFloat(minuteRate.toFixed(4)),
      overtimeRateMultiplier,
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

  private async getWorkingDaysInfo(employeeId: string, startDate: Date, endDate: Date): Promise<{ count: number; workDaysArray: number[] }> {
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
      try { workDaysArray = JSON.parse(schedule.schedule.workDays); } catch {}
    }

    let count = 0;
    const current = new Date(startDate);
    while (current <= endDate) {
      if (workDaysArray.includes(current.getDay())) count++;
      current.setDate(current.getDate() + 1);
    }
    return { count, workDaysArray };
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

  // ==================== Payslip ====================

  async getPayslip(employeeId: string, year: number, month: number) {
    const payroll = await this.prisma.monthlyPayroll.findUnique({
      where: { employeeId_year_month: { employeeId, year, month } },
      include: { policy: { select: { nameAr: true, nameEn: true } } },
    });
    if (!payroll) throw new NotFoundException('كشف الراتب غير موجود');

    // جلب بيانات الموظف
    const empData = await this.prisma.$queryRaw<Array<{
      employeeNumber: string;
      firstNameAr: string;
      lastNameAr: string;
      jobTitle: string | null;
      departmentName: string | null;
      hireDate: Date | null;
    }>>`
      SELECT e."employeeNumber", e."firstNameAr", e."lastNameAr", jt."nameAr" as "jobTitle",
             d."nameAr" as "departmentName", e."hireDate"
      FROM users.employees e
      LEFT JOIN users.job_titles jt ON e."jobTitleId" = jt.id
      LEFT JOIN users.departments d ON e."departmentId" = d.id
      WHERE e.id = ${employeeId}
    `;

    const emp = empData[0] as { employeeNumber: string; firstNameAr: string; lastNameAr: string; jobTitle: string | null; departmentName: string | null; hireDate: Date | null } | undefined;
    const allowancesBreakdown = payroll.allowancesBreakdown
      ? JSON.parse(payroll.allowancesBreakdown)
      : {};

    const monthNames = ['يناير','فبراير','مارس','أبريل','مايو','يونيو',
                        'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

    return {
      payrollId: payroll.id,
      period: { year, month, monthName: monthNames[month - 1] },
      employee: {
        id: employeeId,
        employeeNumber: emp?.employeeNumber,
        fullName: emp ? `${emp.firstNameAr} ${emp.lastNameAr}` : undefined,
        jobTitle: emp?.jobTitle,
        department: emp?.departmentName,
        hireDate: emp?.hireDate,
      },
      attendance: {
        workingDays: payroll.workingDays,
        presentDays: payroll.presentDays,
        absentDays: payroll.absentDays,
        absentUnjustified: payroll.absentUnjustified,
        lateDays: payroll.lateDays,
        totalLateMinutes: payroll.totalLateMinutes,
        overtimeMinutes: payroll.overtimeMinutes,
      },
      salary: {
        currency: payroll.currency || 'SYP',
        basicSalary: payroll.basicSalary ? Number(payroll.basicSalary) : 0,
        allowances: {
          total: payroll.allowancesTotal ? Number(payroll.allowancesTotal) : 0,
          breakdown: allowancesBreakdown,
        },
        overtimePay: payroll.overtimePay ? Number(payroll.overtimePay) : 0,
        grossSalary: payroll.grossSalary ? Number(payroll.grossSalary) : 0,
        deductions: {
          attendanceDeduction: payroll.deductionAmount ? Number(payroll.deductionAmount) : 0,
          absenceDeduction: payroll.absenceDeductionAmount ? Number(payroll.absenceDeductionAmount) : 0,
          totalDeduction: (payroll.deductionAmount ? Number(payroll.deductionAmount) : 0)
                        + (payroll.absenceDeductionAmount ? Number(payroll.absenceDeductionAmount) : 0),
        },
        netSalary: payroll.netSalary ? Number(payroll.netSalary) : 0,
      },
      status: payroll.status,
      policy: payroll.policy,
      generatedAt: payroll.generatedAt,
      confirmedBy: payroll.confirmedBy,
      confirmedAt: payroll.confirmedAt,
    };
  }

  // ==================== Export ====================

  async exportMonth(year: number, month: number) {
    const payrolls = await this.prisma.monthlyPayroll.findMany({
      where: { year, month, status: 'CONFIRMED' },
    });

    const summary = payrolls.map(p => ({
      employeeId: p.employeeId,
      year: p.year,
      month: p.month,
      currency: p.currency,
      basicSalary: p.basicSalary ? Number(p.basicSalary) : 0,
      allowancesTotal: p.allowancesTotal ? Number(p.allowancesTotal) : 0,
      overtimePay: p.overtimePay ? Number(p.overtimePay) : 0,
      grossSalary: p.grossSalary ? Number(p.grossSalary) : 0,
      totalDeductions: (p.deductionAmount ? Number(p.deductionAmount) : 0)
                     + (p.absenceDeductionAmount ? Number(p.absenceDeductionAmount) : 0),
      netSalary: p.netSalary ? Number(p.netSalary) : 0,
    }));

    const totalNet = summary.reduce((sum, p) => sum + p.netSalary, 0);

    // تحديث الحالة إلى EXPORTED
    await this.prisma.monthlyPayroll.updateMany({
      where: { year, month, status: 'CONFIRMED' },
      data: { status: 'EXPORTED' },
    });

    return {
      year,
      month,
      exportedCount: payrolls.length,
      totalNetSalary: parseFloat(totalNet.toFixed(2)),
      payrolls: summary,
    };
  }
}
