import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { GeneratePayrollDto } from './dto/generate-payroll.dto';
import { sendExcel } from '../common/utils/excel.util';

@Injectable()
export class PayrollService {
  constructor(private prisma: PrismaService) {}

  // ==================== Generate ====================

  async generate(dto: GeneratePayrollDto) {
    const { year, month, departmentId, policyId } = dto;

    // جيب كل الموظفين (بما فيهم غير الفاعلين — لإظهار سطر صفر للمستقيلين)
    const empSql = departmentId
      ? `SELECT e.id, e."employeeNumber", e."departmentId", e."employmentStatus", e."dailyWage"
         FROM users.employees e
         WHERE e."deletedAt" IS NULL AND e."departmentId" = $1`
      : `SELECT e.id, e."employeeNumber", e."departmentId", e."employmentStatus", e."dailyWage"
         FROM users.employees e
         WHERE e."deletedAt" IS NULL`;
    const employees = (await this.prisma.$queryRawUnsafe(empSql, ...(departmentId ? [departmentId] : []))) as Array<{
      id: string; employeeNumber: string; departmentId: string;
      employmentStatus: string; dailyWage: string | null;
    }>;

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
    const endDate = new Date(year, month, 0);

    let generated = 0;
    let skipped = 0;
    let errors = 0;
    const results: any[] = [];

    for (const emp of employees) {
      try {
        const existing = await this.prisma.monthlyPayroll.findUnique({
          where: { employeeId_year_month: { employeeId: emp.id, year, month } },
          select: { id: true, status: true },
        });

        if (existing?.status === 'CONFIRMED') {
          results.push({ employeeId: emp.id, status: 'skipped', message: 'Payroll already confirmed', payrollId: existing.id });
          skipped++;
          continue;
        }

        const result = await this.generateForEmployee(
          emp.id, year, month, startDate, endDate, policy,
          emp.employmentStatus, emp.dailyWage,
        );
        results.push({ employeeId: emp.id, status: 'ok', payrollId: result.id });
        generated++;
      } catch (err) {
        errors++;
        results.push({ employeeId: emp.id, status: 'error', message: (err as any).message });
      }
    }

    return { year, month, generated, skipped, errors, results };
  }

  private async generateForEmployee(
    employeeId: string,
    year: number,
    month: number,
    startDate: Date,
    endDate: Date,
    policy: any,
    employmentStatus: string,
    dailyWageRaw: string | null,
  ) {
    // B: كشف صفري للموظف غير الفاعل
    if (employmentStatus !== 'ACTIVE') {
      const zeroData: any = {
        employeeId, year, month,
        workingDays: 0, presentDays: 0, absentDays: 0, absentUnjustified: 0,
        lateDays: 0, totalLateMinutes: 0, earlyLeaveDays: 0, totalEarlyLeaveMinutes: 0,
        breakOverLimitMinutes: 0, overtimeMinutes: 0, totalWorkedMinutes: 0, netWorkedMinutes: 0,
        lateDeductionMinutes: 0, earlyLeaveDeductionMinutes: 0, breakDeductionMinutes: 0,
        absenceDeductionDays: 0, repeatLatePenaltyDays: 0, totalDeductionMinutes: 0,
        salaryLinked: false, status: 'DRAFT', generatedAt: new Date(),
        basicSalary: 0, allowancesTotal: 0, allowancesBreakdown: '{}',
        overtimePay: 0, deductionAmount: 0, absenceDeductionAmount: 0,
        bonusAmount: 0, penaltyAmount: 0, grossSalary: 0, netSalary: 0,
        roundedNetSalary: 0, currency: 'USD',
        dailyRate: 0, minuteRate: 0, overtimeRateMultiplier: 1.5,
        deductibleBaseSalary: 0, excludedAllowancesAmount: 0,
        totalLateMinutesGross: 0, totalLateMinutesEffective: 0, totalCompensationMinutes: 0,
        workingDaysInMonth: 0, employeeWorkingDays: 0, proRationFactor: 0,
        paidLeaveDays: 0, unpaidLeaveDays: 0, unpaidLeaveAmount: 0,
        sickLeaveDays: 0, hourlyLeaveMinutes: 0, hourlyLeaveAmount: 0,
        overtimeWorkdayMinutes: 0, overtimeWorkdayPay: 0,
        overtimeHolidayMinutes: 0, overtimeHolidayPay: 0,
        internalMissionDays: 0, internalMissionAmount: 0,
        externalMissionDays: 0, externalMissionAmount: 0,
        commissionAmount: 0, advanceDeduction: 0,
        otherDeductionAmount: 0, otherDeductionNotes: null,
        employmentStatusAtGenTime: employmentStatus,
        notes: 'مستقيل',
      };
      return this.prisma.monthlyPayroll.upsert({
        where: { employeeId_year_month: { employeeId, year, month } },
        create: zeroData,
        update: { employmentStatusAtGenTime: employmentStatus, notes: 'مستقيل' },
      });
    }

    // I: احفظ الخصومات اليدوية من مسودة موجودة
    const existingPayroll = await this.prisma.monthlyPayroll.findUnique({
      where: { employeeId_year_month: { employeeId, year, month } },
      select: { otherDeductionAmount: true, otherDeductionNotes: true, status: true },
    });
    const otherDeductionAmount = existingPayroll?.status === 'DRAFT'
      ? Number(existingPayroll.otherDeductionAmount ?? 0)
      : 0;
    const otherDeductionNotes = existingPayroll?.status === 'DRAFT'
      ? existingPayroll.otherDeductionNotes ?? null
      : null;

    // إعدادات الحضور-راتب
    const config = await this.prisma.employeeAttendanceConfig.findUnique({
      where: { employeeId },
    });
    const salaryLinked = config?.salaryLinked ?? true;
    const allowedBreakMinutes = config?.allowedBreakMinutes ?? 60;

    // سجلات الحضور للشهر
    const records = await this.prisma.attendanceRecord.findMany({
      where: {
        employeeId,
        date: { gte: startDate, lte: endDate },
      },
      include: { breaks: true },
    });

    // أيام العمل من الجدول الزمني
    const { count: workingDays, workDaysArray, dailyWorkMinutes } = await this.getWorkingDaysInfo(employeeId, startDate, endDate);

    // D: جلب الإجازات المعتمدة مع نوعها (يحل محل استعلامَي approvedLeaves و unpaidDailyLeaves القديمَيْن)
    const leavesWithType = await this.prisma.$queryRawUnsafe(`
      SELECT lr."startDate", lr."endDate", lr."totalDays",
             lr."isHourlyLeave", lr."durationHours", lr."deductionInfo",
             lt.code as "typeCode", lt."isPaid", lt."nameAr" as "typeName",
             lt."maxHoursPerMonth",
             COALESCE(lr.source, 'EMPLOYEE_REQUEST') as source
      FROM leaves.leave_requests lr
      JOIN leaves.leave_types lt ON lt.id = lr."leaveTypeId"
      WHERE lr."employeeId" = $1 AND lr.status = 'APPROVED'
        AND lr."deletedAt" IS NULL
        AND lr."startDate" <= $2 AND lr."endDate" >= $3
      ORDER BY lr."startDate" ASC
    `, employeeId, endDate, startDate) as Array<{
      startDate: Date; endDate: Date; totalDays: number;
      isHourlyLeave: boolean; durationHours: number | null;
      deductionInfo: { overLimitHours?: number } | null;
      typeCode: string; isPaid: boolean; typeName: string;
      maxHoursPerMonth: number | null; source: string;
    }>;

    // بناء مجموعة أيام الإجازات (للاستثناء من الغياب) + تصنيف الإجازات
    const approvedLeaveDates = new Set<string>();
    let paidLeaveDays = 0;
    let unpaidLeaveDays = 0;
    let sickLeaveDays = 0;
    // إجازة ساعية مدفوعة بطلب موظف (لا تُحسم)
    let paidHourlyLeaveMinutes = 0;
    // إجازة ساعية غير مدفوعة (تُحسم)
    let unpaidHourlyLeaveMinutes = 0;
    // تعويض تأخير تلقائي من الرصيد (لا تُحسم — مدفوعة)
    let tardinessOffsetMinutesPayroll = 0;
    let totalUnpaidDailyDays = 0;

    // تتبع الساعات المستخدمة لكل نوع إجازة ساعية لحساب الزيادة عن الحد الشهري ديناميكياً
    const hourlyUsedByType = new Map<string, number>();

    for (const leave of leavesWithType) {
      if (!leave.isHourlyLeave) {
        const d = new Date(leave.startDate);
        const end = new Date(leave.endDate);
        while (d <= end) {
          if (d >= startDate && d <= endDate)
            approvedLeaveDates.add(d.toISOString().split('T')[0]);
          d.setDate(d.getDate() + 1);
        }
      }

      if (leave.isHourlyLeave) {
        const minutes = Math.round((leave.durationHours || 0) * 60);
        // حساب الزيادة عن الحد الشهري ديناميكياً (يتجاوز deductionInfo المخزونة إذا كانت null)
        const maxHoursPerMonth = leave.maxHoursPerMonth ?? null;
        let overLimitMinutes = 0;
        if (leave.isPaid && maxHoursPerMonth !== null && maxHoursPerMonth > 0) {
          const usedHours = hourlyUsedByType.get(leave.typeCode) ?? 0;
          const maxMinutes = maxHoursPerMonth * 60;
          const usedMinutes = usedHours * 60;
          if (usedMinutes >= maxMinutes) {
            overLimitMinutes = minutes;
          } else if (usedMinutes + minutes > maxMinutes) {
            overLimitMinutes = (usedMinutes + minutes) - maxMinutes;
          }
          hourlyUsedByType.set(leave.typeCode, usedHours + (leave.durationHours || 0));
        } else if (!leave.isPaid) {
          overLimitMinutes = minutes;
        }
        const freeMinutes = minutes - overLimitMinutes;
        if (leave.source === 'TARDINESS_AUTO' || leave.source === 'EARLY_LEAVE_AUTO') {
          tardinessOffsetMinutesPayroll += minutes;
        } else if (leave.isPaid) {
          paidHourlyLeaveMinutes += freeMinutes;
          unpaidHourlyLeaveMinutes += overLimitMinutes;
        } else {
          unpaidHourlyLeaveMinutes += minutes;
        }
        continue;
      }
      if (leave.typeCode === 'SICK') {
        sickLeaveDays += Number(leave.totalDays);
        continue;
      }
      if (leave.typeCode === 'UNPAID_DAILY') {
        totalUnpaidDailyDays += Number(leave.totalDays);
        continue;
      }
      if (leave.typeCode === 'UNPAID' || !leave.isPaid) {
        unpaidLeaveDays += Number(leave.totalDays);
        continue;
      }
      if (leave.typeName === 'إجازة سنوية') continue; // السنوية لها عمود منفصل
      paidLeaveDays += Number(leave.totalDays);
    }
    // المجموع الإجمالي للإجازة الساعية (للعرض)
    const hourlyLeaveMinutes = paidHourlyLeaveMinutes + unpaidHourlyLeaveMinutes + tardinessOffsetMinutesPayroll;

    // خريطة تغطية الإجازات لكل يوم — تحدد دقائق التأخير/الخروج المبكر المبررة بإجازة معتمدة
    const dateTardinessCoverageMinutes = new Map<string, number>();
    const dateEarlyLeaveCoverageMinutes = new Map<string, number>();
    for (const leave of leavesWithType) {
      if (leave.isHourlyLeave) {
        const dk = new Date(leave.startDate).toISOString().split('T')[0];
        const mins = Math.round((leave.durationHours || 0) * 60);
        dateTardinessCoverageMinutes.set(dk, (dateTardinessCoverageMinutes.get(dk) ?? 0) + mins);
        dateEarlyLeaveCoverageMinutes.set(dk, (dateEarlyLeaveCoverageMinutes.get(dk) ?? 0) + mins);
      } else {
        const d = new Date(leave.startDate);
        const end = new Date(leave.endDate);
        while (d <= end) {
          const dk = d.toISOString().split('T')[0];
          dateTardinessCoverageMinutes.set(dk, Number.POSITIVE_INFINITY);
          dateEarlyLeaveCoverageMinutes.set(dk, Number.POSITIVE_INFINITY);
          d.setDate(d.getDate() + 1);
        }
      }
    }

    // العطل الرسمية
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
    let overtimeWorkdayMinutes = 0; // E: جديد
    let overtimeHolidayMinutes = 0; // E: جديد
    let totalWorkedMinutes = 0;
    let netWorkedMinutes = 0;

    const recordedDates = new Set(records.map(r => r.date.toISOString().split('T')[0]));

    // التبريرات المقبولة للغياب
    const absentRecordIds = records.filter(r => r.status === 'ABSENT').map(r => r.id);
    const justifiedIds = new Set<string>();
    if (absentRecordIds.length > 0) {
      const justifications = await this.prisma.attendanceJustification.findMany({
        where: { attendanceRecordId: { in: absentRecordIds }, status: { in: ['HR_APPROVED', 'MANAGER_APPROVED'] } },
        select: { attendanceRecordId: true },
      });
      justifications.forEach(j => justifiedIds.add(j.attendanceRecordId));
    }

    // التبريرات لسجلات البصمة الوحيدة (دخول بدون خروج بعد يومين)
    const singlePunchRecordIds = records
      .filter(r => {
        if (['ABSENT', 'WEEKEND', 'HOLIDAY', 'ON_LEAVE'].includes(r.status)) return false;
        if (!(r as any).clockInTime || (r as any).clockOutTime) return false;
        return Math.floor((Date.now() - new Date(r.date).getTime()) / 86400000) >= 2;
      })
      .map(r => r.id);
    const singlePunchJustifiedIds = new Set<string>();
    if (singlePunchRecordIds.length > 0) {
      const spJustifications = await this.prisma.attendanceJustification.findMany({
        where: { attendanceRecordId: { in: singlePunchRecordIds }, status: { in: ['HR_APPROVED', 'MANAGER_APPROVED'] } },
        select: { attendanceRecordId: true },
      });
      spJustifications.forEach(j => singlePunchJustifiedIds.add(j.attendanceRecordId));
    }

    // التبريرات المقبولة للتأخير
    const lateRecordIds = records.filter(r => r.lateMinutes > 0).map(r => r.id);
    let justifiedLateMinutes = 0;
    if (lateRecordIds.length > 0) {
      const lateJustifications = await this.prisma.attendanceJustification.findMany({
        where: {
          attendanceRecordId: { in: lateRecordIds },
          status: { in: ['HR_APPROVED', 'MANAGER_APPROVED'] },
        },
        select: { deductionMinutes: true },
      });
      justifiedLateMinutes = lateJustifications.reduce((sum, j) => sum + (j.deductionMinutes ?? 0), 0);
    }

    for (const r of records) {
      if (r.status === 'ABSENT') {
        absentDays++;
        if (!justifiedIds.has(r.id)) absentUnjustified++;
        continue;
      }
      if (['WEEKEND', 'HOLIDAY', 'ON_LEAVE'].includes(r.status)) continue;

      if ((r as any).clockInTime && !(r as any).clockOutTime) {
        const daysSince = Math.floor((Date.now() - new Date(r.date).getTime()) / 86400000);
        if (daysSince < 2) continue;
        if (!singlePunchJustifiedIds.has(r.id)) {
          absentDays++;
          absentUnjustified++;
          continue;
        }
        presentDays++;
        totalWorkedMinutes += dailyWorkMinutes;
        netWorkedMinutes += dailyWorkMinutes;
        if (r.lateMinutes > 0) { lateDays++; totalLateMinutes += r.lateMinutes; }
        continue;
      }

      presentDays++;
      totalWorkedMinutes += r.workedMinutes || 0;
      netWorkedMinutes += r.netWorkedMinutes || r.workedMinutes || 0;
      overtimeMinutes += r.overtimeMinutes || 0;
      // E: إضافي مقسوم
      overtimeWorkdayMinutes += (r as any).overtimeWorkdayMinutes || 0;
      overtimeHolidayMinutes += (r as any).overtimeHolidayMinutes || 0;

      if (r.lateMinutes > 0) { lateDays++; totalLateMinutes += r.lateMinutes; }
      if (r.earlyLeaveMinutes > 0) { earlyLeaveDays++; totalEarlyLeaveMinutes += r.earlyLeaveMinutes; }

      const totalBreak = r.totalBreakMinutes || 0;
      if (totalBreak > allowedBreakMinutes) breakOverLimitMinutes += totalBreak - allowedBreakMinutes;
    }

    // أيام العمل بدون سجل حضور → غياب — يستثني أي يوم لم يأتِ بعد (مثل توليد الكشف قبل انتهاء الشهر)
    const todayStr = new Date().toISOString().split('T')[0];
    const current = new Date(startDate);
    while (current <= endDate) {
      const dateStr = current.toISOString().split('T')[0];
      if (dateStr > todayStr) { current.setDate(current.getDate() + 1); continue; }
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
      const effectiveLateMinutes = Math.max(0, totalLateMinutes - (policy.lateToleranceMinutes * lateDays));
      lateDeductionMinutes = this.calcDeduction(
        effectiveLateMinutes,
        policy.lateDeductionType,
        policy.lateDeductionTiers,
      );

      const effectiveEarlyMinutes = Math.max(0, totalEarlyLeaveMinutes - ((policy.earlyLeaveToleranceMinutes ?? 0) * earlyLeaveDays));
      earlyLeaveDeductionMinutes = this.calcDeduction(
        effectiveEarlyMinutes,
        policy.earlyLeaveDeductionType,
        policy.earlyLeaveDeductionTiers ?? null,
      );

      absenceDeductionDaysCalc = absentUnjustified * policy.absenceDeductionDays;

      // تجاوز الاستراحة لا يُخصم من الراتب
      breakDeductionMinutes = 0;

      if (policy.repeatLateThreshold && lateDays > policy.repeatLateThreshold) {
        repeatLatePenaltyDaysCalc = policy.repeatLatePenaltyDays || 0;
      }
    }

    const totalDeductionMinutes = lateDeductionMinutes + earlyLeaveDeductionMinutes + breakDeductionMinutes;

    // === الحسابات المالية ===
    const empFinancial = await this.prisma.$queryRaw<Array<{
      basicSalary: string | null;
      salaryCurrency: string | null;
      hireDate: Date | null;
      commissions: Array<{ amount: number; description: string }> | null;
    }>>`
      SELECT "basicSalary", "salaryCurrency", "hireDate", "commissions"
      FROM users.employees
      WHERE id = ${employeeId} AND "deletedAt" IS NULL
    `;

    const basicSalary = empFinancial[0]?.basicSalary ? parseFloat(empFinancial[0].basicSalary) : 0;
    const currency = 'USD';
    const hireDate = empFinancial[0]?.hireDate ? new Date(empFinancial[0].hireDate) : null;

    // C: منطق الأجر اليومي
    const dailyWage = dailyWageRaw ? parseFloat(String(dailyWageRaw)) : 0;
    let effectiveBasicSalary = basicSalary;
    let isDailyWageEmployee = false;
    if (dailyWage > 0) {
      effectiveBasicSalary = dailyWage * presentDays;
      isDailyWageEmployee = true;
    }

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

    // استثناء البدلات المحددة في السياسة
    let excludedTypes: string[] = ['FOOD'];
    if (policy?.excludedAllowanceTypes) {
      try {
        const parsed = typeof policy.excludedAllowanceTypes === 'string'
          ? JSON.parse(policy.excludedAllowanceTypes)
          : policy.excludedAllowanceTypes;
        if (Array.isArray(parsed)) excludedTypes = parsed;
      } catch {}
    }
    let excludedAllowancesAmount = 0;
    for (const a of allowancesRaw) {
      if (excludedTypes.includes(a.type)) excludedAllowancesAmount += parseFloat(a.amount);
    }
    const deductibleBase = effectiveBasicSalary + allowancesTotal - excludedAllowancesAmount;

    // Pro-rating للموظف الجديد
    const effectiveStart = hireDate && hireDate > startDate ? hireDate : startDate;
    const employeeWorkingDays = this.countWorkingDaysInRange(effectiveStart, endDate, workDaysArray);
    const proRationFactor = workingDays > 0 ? Math.min(1, employeeWorkingDays / workingDays) : 1.0;
    const proRatedDeductible = deductibleBase * proRationFactor;

    // معدلات الدقيقة واليوم والساعة (القاعدة: Salary / 30 / 8)
    const dailyRate   = proRatedDeductible / 30;
    const hourlyRate  = dailyRate / 8;
    const minuteRate  = hourlyRate / 60;

    // E: حساب الإضافي المقسوم
    const overtimeWorkdayPay = overtimeWorkdayMinutes * minuteRate * 1.5;
    const overtimeHolidayPay = overtimeHolidayMinutes * minuteRate *
      Number(policy?.holidayOvertimeMultiplier ?? 2.0);
    const overtimePay = overtimeWorkdayPay + overtimeHolidayPay;

    // D: مبالغ الإجازات — الإجازة الساعية المدفوعة وتعويض التأخير لا يُحسمان
    const unpaidLeaveAmount = unpaidLeaveDays * dailyRate;
    const hourlyLeaveAmount = unpaidHourlyLeaveMinutes * minuteRate;
    const unpaidDailyDeductionAmount = totalUnpaidDailyDays * dailyRate;

    const totalCompensationMinutes = records.reduce((sum, r) => sum + (r.lateCompensatedMinutes ?? 0), 0);
    const totalLateMinutesEffective = Math.max(0, totalLateMinutes - justifiedLateMinutes);

    // سياسة الحسم المتدرّجة (TIERED) تُطبَّق يومياً — كل يوم تأخير له دقائقه المعلّقة (بعد خصم
    // الرصيد المشترك) الخاصة فيه، وتُصنَّف على حدة ضمن الشرائح. أول lateToleranceMinutes دقيقة
    // (افتراضياً 15) من أي يوم غير معوّضة بالعمل تُخصم دقيقة بدقيقة بالأجر العادي، وليست جزءاً
    // من الشرائح. تنسيق الشريحة الفعلي بقاعدة البيانات: { fromMinute, toMinute, deductionDays }.
    lateDeductionMinutes = 0;
    let lateDeductionDaysFromTiers = 0;

    const lateTolerancePerDay = policy?.lateToleranceMinutes ?? 15;
    let parsedLateTiers: Array<{ fromMinute: number; toMinute: number; deductionDays: number }> = [];
    if (policy?.lateDeductionType === 'TIERED' && policy?.lateDeductionTiers) {
      try { parsedLateTiers = JSON.parse(policy.lateDeductionTiers); } catch { parsedLateTiers = []; }
    }

    for (const r of records) {
      const dayLateMinutes = r.lateMinutes ?? 0;
      if (dayLateMinutes <= 0) continue;
      const dateKey = new Date(r.date).toISOString().split('T')[0];
      const covered = dateTardinessCoverageMinutes.get(dateKey) ?? 0;
      const compensatedForDay = r.lateCompensatedMinutes ?? 0;
      const pendingForDay = Math.max(0, dayLateMinutes - covered - compensatedForDay);
      if (pendingForDay <= 0) continue;
      if (parsedLateTiers.length === 0 || pendingForDay <= lateTolerancePerDay) {
        lateDeductionMinutes += pendingForDay;
        continue;
      }
      const tier = parsedLateTiers.find(t => pendingForDay >= t.fromMinute && pendingForDay <= t.toMinute);
      if (tier) {
        lateDeductionDaysFromTiers += tier.deductionDays;
        continue;
      }
      const lastTier = parsedLateTiers[parsedLateTiers.length - 1];
      if (lastTier && pendingForDay > lastTier.toMinute) {
        lateDeductionDaysFromTiers += lastTier.deductionDays;
      } else {
        lateDeductionMinutes += pendingForDay;
      }
    }
    const deductibleLateMinutes = lateDeductionMinutes;

    const lateDeductionAmount = (lateDeductionMinutes * minuteRate) + (lateDeductionDaysFromTiers * dailyRate);

    // الانصراف المبكر — نفس منطق التأخير: يومي بالشرائح
    const earlyTolerancePerDay = policy?.earlyLeaveToleranceMinutes ?? 0;
    let parsedEarlyTiers: Array<{ fromMinute: number; toMinute: number; deductionDays: number }> = [];
    if (policy?.earlyLeaveDeductionType === 'TIERED' && (policy as any)?.earlyLeaveDeductionTiers) {
      try { parsedEarlyTiers = JSON.parse((policy as any).earlyLeaveDeductionTiers); } catch { parsedEarlyTiers = []; }
    }

    earlyLeaveDeductionMinutes = 0;
    let earlyLeaveDeductionDaysFromTiers = 0;

    for (const r of records) {
      const dayEarlyMinutes = r.earlyLeaveMinutes ?? 0;
      if (dayEarlyMinutes <= 0) continue;
      const dateKey = new Date(r.date).toISOString().split('T')[0];
      const covered = dateEarlyLeaveCoverageMinutes.get(dateKey) ?? 0;
      const pendingForDay = Math.max(0, dayEarlyMinutes - covered);
      if (pendingForDay <= 0) continue;
      if (parsedEarlyTiers.length === 0 || pendingForDay <= earlyTolerancePerDay) {
        earlyLeaveDeductionMinutes += pendingForDay;
        continue;
      }
      const tier = parsedEarlyTiers.find(t => pendingForDay >= t.fromMinute && pendingForDay <= t.toMinute);
      if (tier) {
        earlyLeaveDeductionDaysFromTiers += tier.deductionDays;
        continue;
      }
      const lastEarlyTier = parsedEarlyTiers[parsedEarlyTiers.length - 1];
      if (lastEarlyTier && pendingForDay > lastEarlyTier.toMinute) {
        earlyLeaveDeductionDaysFromTiers += lastEarlyTier.deductionDays;
      } else {
        earlyLeaveDeductionMinutes += pendingForDay;
      }
    }

    const earlyLeaveDeductionAmount = (earlyLeaveDeductionMinutes * minuteRate) + (earlyLeaveDeductionDaysFromTiers * dailyRate);
    const deductionAmount = lateDeductionAmount + earlyLeaveDeductionAmount + (breakDeductionMinutes * minuteRate);
    const absenceDeductionAmount = absenceDeductionDaysCalc * dailyRate;
    const repeatLatePenaltyAmount = repeatLatePenaltyDaysCalc * dailyRate;

    // خصم الإجازة المرضية حسب deductionInfo
    const sickLeaveRequests = await this.prisma.$queryRaw<Array<{ id: string; deductionInfo: any }>>`
      SELECT lr.id, lr."deductionInfo"
      FROM leaves.leave_requests lr
      JOIN leaves.leave_types lt ON lt.id = lr."leaveTypeId"
      WHERE lr."employeeId" = ${employeeId}
        AND lt.code = 'SICK'
        AND lr.status = 'APPROVED'
        AND lr."deductionInfo" IS NOT NULL
        AND lr."startDate" <= ${endDate}
        AND lr."endDate" >= ${startDate}
        AND lr."deletedAt" IS NULL
    `;

    let sickLeaveDeductionAmount = 0;
    const sickLeaveDetails: Array<{ requestId: string; fromDay: number; toDay: number; days: number; percent: number; amount: number }> = [];

    for (const leave of sickLeaveRequests) {
      const segments = leave.deductionInfo as Array<{ fromDay: number; toDay: number; days: number; deductionPercent: number }>;
      if (!segments || !Array.isArray(segments)) continue;
      for (const seg of segments) {
        const segAmount = (basicSalary / 30) * seg.days * (seg.deductionPercent / 100);
        sickLeaveDeductionAmount += segAmount;
        sickLeaveDetails.push({
          requestId: leave.id,
          fromDay: seg.fromDay,
          toDay: seg.toDay,
          days: seg.days,
          percent: seg.deductionPercent,
          amount: parseFloat(segAmount.toFixed(2)),
        });
      }
    }

    // إجمالي خصومات الحضور (التأخير + المرضية + UNPAID_DAILY)
    const totalDeductionAmount = deductionAmount + sickLeaveDeductionAmount + unpaidDailyDeductionAmount;

    // === مكافآت وجزاءات مادية من users.employee_rewards_penalties ===
    // المعنوية (MORAL) مستثناة — لا أثر مالي لها
    let bonusAmount = 0;
    let penaltyAmount = 0;
    const bonusDetailsList: Array<{ requestId: string; amount: number; reason: string }> = [];
    const penaltyDetailsList: Array<{ requestId: string; amount: number; description: string }> = [];

    try {
      const rewardRecords = await this.prisma.$queryRawUnsafe(
        `SELECT id, amount, reason, "requestId"
         FROM users.employee_rewards_penalties
         WHERE "employeeId" = $1
           AND kind = 'REWARD' AND category = 'MATERIAL' AND status = 'ACTIVE'
           AND "effectiveDate" >= $2 AND "effectiveDate" <= $3`,
        employeeId, startDate, endDate,
      ) as Array<{ id: string; amount: string | null; reason: string | null; requestId: string | null }>;

      for (const rec of rewardRecords) {
        const amt = parseFloat(rec.amount ?? '0') || 0;
        if (amt > 0) {
          bonusAmount += amt;
          bonusDetailsList.push({ requestId: rec.requestId ?? rec.id, amount: amt, reason: rec.reason ?? '' });
        }
      }

      const penaltyRecords = await this.prisma.$queryRawUnsafe(
        `SELECT id, "penaltyDays", reason, "requestId"
         FROM users.employee_rewards_penalties
         WHERE "employeeId" = $1
           AND kind = 'PENALTY' AND category = 'MATERIAL' AND status = 'ACTIVE'
           AND "effectiveDate" >= $2 AND "effectiveDate" <= $3`,
        employeeId, startDate, endDate,
      ) as Array<{ id: string; penaltyDays: string | null; reason: string | null; requestId: string | null }>;

      for (const rec of penaltyRecords) {
        const days = parseFloat(String(rec.penaltyDays ?? '0')) || 0;
        if (days > 0) {
          const deductAmt = parseFloat((days * dailyRate).toFixed(2));
          penaltyAmount += deductAmt;
          penaltyDetailsList.push({ requestId: rec.requestId ?? rec.id, amount: deductAmt, description: rec.reason ?? '' });
        }
      }
    } catch (err) {
      console.error(`[payroll] reward/penalty load failed for ${employeeId}:`, (err as any)?.message);
    }

    // F: المهمات
    let internalMissionDays = 0;
    let externalMissionDays = 0;
    const internalRate = Number(policy?.internalMissionDailyRate ?? 0);
    const externalRate = Number(policy?.externalMissionDailyRate ?? 0);

    try {
      const missionRequests = await this.prisma.$queryRawUnsafe(`
        SELECT id, details FROM requests.requests
        WHERE type = 'BUSINESS_MISSION' AND status = 'APPROVED'
          AND "deletedAt" IS NULL
          AND ("employeeId" = $1 OR (details->>'targetEmployeeId') = $1)
          AND (details->>'startDate')::date <= $2
          AND (details->>'endDate')::date >= $3
      `, employeeId, endDate, startDate) as Array<{ id: string; details: any }>;

      for (const m of missionRequests) {
        const days = parseFloat(m.details?.totalDays ?? '0') || 0;
        if (m.details?.missionType === 'INTERNAL') internalMissionDays += days;
        else if (m.details?.missionType === 'EXTERNAL') externalMissionDays += days;
      }
    } catch (err) {
      console.error(`[payroll] missions load failed for ${employeeId}:`, (err as any)?.message);
    }

    const internalMissionAmount = internalMissionDays * internalRate;
    const externalMissionAmount = externalMissionDays * externalRate;

    // G: عمولات المبيعات المعتمدة + العمولات الثابتة على سجل الموظف
    const employeeCommissions = empFinancial[0]?.commissions ?? [];
    const fixedSalesCommission = Array.isArray(employeeCommissions)
      ? employeeCommissions.reduce((sum: number, c: any) => sum + (Number(c?.amount) || 0), 0)
      : 0;
    let commissionAmount = fixedSalesCommission;
    try {
      const commissions = await this.prisma.$queryRawUnsafe(`
        SELECT COALESCE(SUM(amount::numeric), 0) as total
        FROM users.sales_commissions
        WHERE "employeeId" = $1 AND year = $2 AND month = $3
          AND status = 'CONFIRMED' AND "deletedAt" IS NULL
      `, employeeId, year, month) as Array<{ total: string }>;
      commissionAmount += parseFloat(commissions[0]?.total ?? '0') || 0;
    } catch (err) {
      console.error(`[payroll] commissions load failed for ${employeeId}:`, (err as any)?.message);
    }

    // H: السلف — اقرأ الأقساط المستحقة (التطبيق في transaction أدناه)
    let advanceDeduction = 0;
    const installmentsToCreate: Array<{ advanceId: string; amount: number }> = [];

    try {
      const activeAdvances = await this.prisma.$queryRawUnsafe(`
        SELECT id, "installmentAmount", "remainingBalance", "totalInstallments", "paidInstallments"
        FROM users.salary_advances
        WHERE "employeeId" = $1 AND status = 'ACTIVE' AND "deletedAt" IS NULL
          AND ("startYear" < $2 OR ("startYear" = $2 AND "startMonth" <= $3))
          AND "remainingBalance" > 0
      `, employeeId, year, month) as Array<{
        id: string; installmentAmount: string; remainingBalance: string;
        totalInstallments: number; paidInstallments: number;
      }>;

      for (const adv of activeAdvances) {
        const installment = Math.min(
          parseFloat(adv.installmentAmount),
          parseFloat(adv.remainingBalance),
        );
        if (installment > 0) {
          advanceDeduction += installment;
          installmentsToCreate.push({ advanceId: adv.id, amount: installment });
        }
      }
    } catch (err) {
      console.error(`[payroll] advances load failed for ${employeeId}:`, (err as any)?.message);
    }

    // J: حساب الإجمالي والصافي المحدّث
    const grossSalary = (effectiveBasicSalary + allowancesTotal) * proRationFactor
      + overtimePay
      + internalMissionAmount + externalMissionAmount;

    const netSalaryRaw = Math.max(
      0,
      grossSalary + bonusAmount + commissionAmount
        - totalDeductionAmount    // التأخير + المرضية + UNPAID_DAILY
        - absenceDeductionAmount  // الغياب
        - repeatLatePenaltyAmount // عقوبة التكرار
        - unpaidLeaveAmount       // إجازة بدون راتب (UNPAID)
        - hourlyLeaveAmount       // إجازة ساعية
        - advanceDeduction        // قسط السلفة
        - otherDeductionAmount    // خصم يدوي
        - penaltyAmount,          // جزاء
    );
    const netSalary = parseFloat(netSalaryRaw.toFixed(2));
    const roundedNetSalary = Math.round(netSalary);

    // بناء كائن البيانات
    const data: any = {
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
      // مالية
      basicSalary: effectiveBasicSalary,
      dailyWageSnapshot: dailyWage > 0 ? dailyWage : null,
      hourlyRate: parseFloat(hourlyRate.toFixed(6)),
      allowancesTotal,
      allowancesBreakdown: JSON.stringify(allowancesBreakdownMap),
      overtimePay: parseFloat(overtimePay.toFixed(2)),
      overtimeWorkdayMinutes,
      overtimeWorkdayPay: parseFloat(overtimeWorkdayPay.toFixed(2)),
      overtimeHolidayMinutes,
      overtimeHolidayPay: parseFloat(overtimeHolidayPay.toFixed(2)),
      deductionAmount: parseFloat(totalDeductionAmount.toFixed(2)),
      absenceDeductionAmount: parseFloat(absenceDeductionAmount.toFixed(2)),
      bonusAmount: parseFloat(bonusAmount.toFixed(2)),
      penaltyAmount: parseFloat(penaltyAmount.toFixed(2)),
      bonusDetails: bonusDetailsList.length > 0 ? JSON.stringify(bonusDetailsList) : null,
      penaltyDetails: penaltyDetailsList.length > 0 ? JSON.stringify(penaltyDetailsList) : null,
      grossSalary: parseFloat(grossSalary.toFixed(2)),
      netSalary,
      roundedNetSalary,
      currency,
      dailyRate: parseFloat(dailyRate.toFixed(4)),
      minuteRate: parseFloat(minuteRate.toFixed(6)),
      overtimeRateMultiplier: 1.5,
      deductibleBaseSalary: parseFloat(deductibleBase.toFixed(2)),
      excludedAllowancesAmount: parseFloat(excludedAllowancesAmount.toFixed(2)),
      totalLateMinutesGross: totalLateMinutes,
      totalLateMinutesEffective,
      totalCompensationMinutes,
      workingDaysInMonth: workingDays,
      employeeWorkingDays,
      proRationFactor: parseFloat(proRationFactor.toFixed(4)),
      // إجازات مفصّلة
      paidLeaveDays,
      unpaidLeaveDays,
      unpaidLeaveAmount: parseFloat(unpaidLeaveAmount.toFixed(2)),
      sickLeaveDays,
      hourlyLeaveMinutes,
      hourlyLeaveAmount: parseFloat(hourlyLeaveAmount.toFixed(2)),
      // تفاصيل التأخير والإجازة الساعية
      paidHourlyLeaveMinutes,
      unpaidHourlyLeaveMinutes,
      tardinessOffsetMinutes: tardinessOffsetMinutesPayroll,
      tardinessCompensatedMinutes: totalCompensationMinutes,
      tardinessUncompensatedMinutes: Math.max(0, totalLateMinutes - totalCompensationMinutes - justifiedLateMinutes - tardinessOffsetMinutesPayroll),
      tardinessJustifiedMinutes: justifiedLateMinutes,
      tardinessDeductionAmount: parseFloat(lateDeductionAmount.toFixed(2)),
      hourlyBalanceUsedTotal: (paidHourlyLeaveMinutes + tardinessOffsetMinutesPayroll) / 60,
      hourlyBalanceRemaining: 0, // يُحسب لاحقاً إذا لزم
      // مهمات
      internalMissionDays,
      internalMissionAmount: parseFloat(internalMissionAmount.toFixed(2)),
      externalMissionDays,
      externalMissionAmount: parseFloat(externalMissionAmount.toFixed(2)),
      // عمولات وسلف وخصومات أخرى
      commissionAmount: parseFloat(commissionAmount.toFixed(2)),
      advanceDeduction: parseFloat(advanceDeduction.toFixed(2)),
      otherDeductionAmount: parseFloat(otherDeductionAmount.toFixed(2)),
      otherDeductionNotes,
      employmentStatusAtGenTime: employmentStatus,
      notes: isDailyWageEmployee
        ? `أجر يومي = ${dailyWage}$ × ${presentDays} يوم`
        : null,
      deductionBreakdown: {
        tardiness: {
          totalMinutes: totalLateMinutes,
          compensatedByWork: totalCompensationMinutes,
          justified: justifiedLateMinutes,
          coveredByHourlyBalance: tardinessOffsetMinutesPayroll,
          deductibleMinutes: deductibleLateMinutes,
          deductedAsDays: lateDeductionDaysFromTiers,
          deductedAsMinutes: lateDeductionMinutes,
          amount: parseFloat(lateDeductionAmount.toFixed(2)),
        },
        earlyLeave: {
          totalMinutes: totalEarlyLeaveMinutes,
          deductibleMinutes: earlyLeaveDeductionMinutes,
          deductedAsDays: earlyLeaveDeductionDaysFromTiers,
          amount: parseFloat(earlyLeaveDeductionAmount.toFixed(2)),
        },
        breakOverLimit: {
          totalMinutes: breakOverLimitMinutes,
          deductibleMinutes: breakDeductionMinutes,
          amount: parseFloat((breakDeductionMinutes * minuteRate).toFixed(2)),
        },
        absence: {
          days: absenceDeductionDaysCalc,
          amount: parseFloat(absenceDeductionAmount.toFixed(2)),
        },
        hourlyLeave: {
          paidMinutes: paidHourlyLeaveMinutes,
          unpaidMinutes: unpaidHourlyLeaveMinutes,
          tardinessOffsetMinutes: tardinessOffsetMinutesPayroll,
          deductionAmount: parseFloat(hourlyLeaveAmount.toFixed(2)),
        },
        sickLeave: {
          total: parseFloat(sickLeaveDeductionAmount.toFixed(2)),
          details: sickLeaveDetails,
        },
        unpaidDailyLeave: {
          total: parseFloat(unpaidDailyDeductionAmount.toFixed(2)),
          days: parseFloat(totalUnpaidDailyDays.toFixed(1)),
        },
        unpaidLeave: parseFloat(unpaidLeaveAmount.toFixed(2)),
        advance: parseFloat(advanceDeduction.toFixed(2)),
        other: parseFloat(otherDeductionAmount.toFixed(2)),
        totalDeduction: parseFloat((
          totalDeductionAmount + absenceDeductionAmount + repeatLatePenaltyAmount
          + unpaidLeaveAmount + hourlyLeaveAmount + advanceDeduction
          + otherDeductionAmount + penaltyAmount
        ).toFixed(2)),
      },
      // K: appliedPolicySnapshot موسّع
      appliedPolicySnapshot: policy ? {
        policyId: policy.id,
        nameAr: policy.nameAr,
        lateToleranceMinutes: policy.lateToleranceMinutes,
        lateDeductionType: policy.lateDeductionType,
        lateDeductionTiers: policy.lateDeductionTiers,
        earlyLeaveDeductionType: policy.earlyLeaveDeductionType,
        earlyLeaveToleranceMinutes: policy.earlyLeaveToleranceMinutes,
        earlyLeaveDeductionTiers: policy.earlyLeaveDeductionTiers,
        absenceDeductionDays: policy.absenceDeductionDays,
        repeatLateThreshold: policy.repeatLateThreshold,
        repeatLatePenaltyDays: policy.repeatLatePenaltyDays,
        breakOverLimitDeduction: policy.breakOverLimitDeduction,
        monthlyLateToleranceMinutes: policy.monthlyLateToleranceMinutes ?? 120,
        excludedAllowanceTypes: excludedTypes,
        holidayOvertimeMultiplier: policy.holidayOvertimeMultiplier ?? 2.0,
        internalMissionDailyRate: policy.internalMissionDailyRate ?? 0,
        externalMissionDailyRate: policy.externalMissionDailyRate ?? 0,
        effectiveFrom: policy.effectiveFrom ?? null,
      } : null,
    };

    // H: Transaction — نظّف السلف القديمة، upsert الكشف، أنشئ الأقساط الجديدة
    return this.prisma.$transaction(async (tx) => {
      // احذف installments القديمة لنفس الموظف/الشهر (حالة إعادة التوليد)
      const existingInstallments = await tx.$queryRawUnsafe(`
        SELECT id, "advanceId", amount FROM users.salary_advance_installments
        WHERE year = $1 AND month = $2 AND "advanceId" IN (
          SELECT id FROM users.salary_advances WHERE "employeeId" = $3
        )
      `, year, month, employeeId) as Array<{ id: string; advanceId: string; amount: string }>;

      for (const ei of existingInstallments) {
        await tx.$executeRawUnsafe(`
          UPDATE users.salary_advances
          SET "remainingBalance" = "remainingBalance" + $1,
              "paidInstallments" = GREATEST(0, "paidInstallments" - 1),
              status = CASE WHEN status = 'COMPLETED' THEN 'ACTIVE' ELSE status END
          WHERE id = $2
        `, ei.amount, ei.advanceId);
      }
      await tx.$executeRawUnsafe(`
        DELETE FROM users.salary_advance_installments
        WHERE year = $1 AND month = $2 AND "advanceId" IN (
          SELECT id FROM users.salary_advances WHERE "employeeId" = $3
        )
      `, year, month, employeeId);

      // upsert الكشف
      const payroll = await tx.monthlyPayroll.upsert({
        where: { employeeId_year_month: { employeeId, year, month } },
        create: data,
        update: { ...data, confirmedBy: null, confirmedAt: null },
      });

      // أنشئ الأقساط الجديدة وحدّث رصيد السلف
      for (const inst of installmentsToCreate) {
        await tx.$executeRawUnsafe(`
          INSERT INTO users.salary_advance_installments
          ("id", "advanceId", year, month, amount, "payrollId")
          VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
        `, inst.advanceId, year, month, inst.amount, payroll.id);

        await tx.$executeRawUnsafe(`
          UPDATE users.salary_advances
          SET "remainingBalance" = "remainingBalance" - $1,
              "paidInstallments" = "paidInstallments" + 1,
              status = CASE
                WHEN ("remainingBalance" - $1) <= 0.01 THEN 'COMPLETED'
                ELSE status
              END
          WHERE id = $2
        `, inst.amount, inst.advanceId);
      }

      return payroll;
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
        const last = tiers[tiers.length - 1];
        if (last && minutes >= last.from) return last.deductMinutes;
      } catch {}
    }
    return minutes;
  }

  private countWorkingDaysInRange(from: Date, to: Date, workDaysArray: number[]): number {
    let count = 0;
    const current = new Date(from);
    while (current <= to) {
      if (workDaysArray.includes(current.getDay())) count++;
      current.setDate(current.getDate() + 1);
    }
    return count;
  }

  private async getWorkingDaysInfo(employeeId: string, startDate: Date, endDate: Date): Promise<{ count: number; workDaysArray: number[]; dailyWorkMinutes: number }> {
    const schedule = await this.prisma.employeeSchedule.findFirst({
      where: {
        employeeId,
        isActive: true,
        effectiveFrom: { lte: endDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: startDate } }],
      },
      include: { schedule: true },
    });

    let workDaysArray: number[] = [0, 1, 2, 3, 4];
    if (schedule?.schedule?.workDays) {
      try { workDaysArray = JSON.parse(schedule.schedule.workDays); } catch {}
    }

    let dailyWorkMinutes = 480;
    if (schedule?.schedule?.workStartTime && schedule?.schedule?.workEndTime) {
      const [sh, sm] = schedule.schedule.workStartTime.split(':').map(Number);
      const [eh, em] = schedule.schedule.workEndTime.split(':').map(Number);
      const computed = (eh * 60 + em) - (sh * 60 + sm);
      if (computed > 0) dailyWorkMinutes = computed;
    }

    let count = 0;
    const current = new Date(startDate);
    while (current <= endDate) {
      if (workDaysArray.includes(current.getDay())) count++;
      current.setDate(current.getDate() + 1);
    }
    return { count, workDaysArray, dailyWorkMinutes };
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

    const empData = await this.prisma.$queryRaw<Array<{
      employeeNumber: string;
      firstNameAr: string;
      lastNameAr: string;
      firstNameEn: string | null;
      lastNameEn: string | null;
      jobTitle: string | null;
      departmentName: string | null;
      hireDate: Date | null;
    }>>`
      SELECT e."employeeNumber", e."firstNameAr", e."lastNameAr", e."firstNameEn", e."lastNameEn",
             jt."nameAr" as "jobTitle", d."nameAr" as "departmentName", e."hireDate"
      FROM users.employees e
      LEFT JOIN users.job_titles jt ON e."jobTitleId" = jt.id
      LEFT JOIN users.departments d ON e."departmentId" = d.id
      WHERE e.id = ${employeeId}
    `;

    const emp = empData[0] as typeof empData[0] | undefined;
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
        firstNameAr: emp?.firstNameAr,
        lastNameAr: emp?.lastNameAr,
        firstNameEn: emp?.firstNameEn,
        lastNameEn: emp?.lastNameEn,
        fullNameAr: emp ? `${emp.firstNameAr} ${emp.lastNameAr}` : undefined,
        fullNameEn: emp?.firstNameEn ? `${emp.firstNameEn} ${emp.lastNameEn ?? ''}`.trim() : undefined,
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
        overtimeWorkdayMinutes: (payroll as any).overtimeWorkdayMinutes ?? 0,
        overtimeHolidayMinutes: (payroll as any).overtimeHolidayMinutes ?? 0,
      },
      leaves: {
        paidLeaveDays: (payroll as any).paidLeaveDays ?? 0,
        unpaidLeaveDays: (payroll as any).unpaidLeaveDays ?? 0,
        sickLeaveDays: (payroll as any).sickLeaveDays ?? 0,
        hourlyLeaveMinutes: (payroll as any).hourlyLeaveMinutes ?? 0,
      },
      missions: {
        internalMissionDays: (payroll as any).internalMissionDays ?? 0,
        internalMissionAmount: Number((payroll as any).internalMissionAmount ?? 0),
        externalMissionDays: (payroll as any).externalMissionDays ?? 0,
        externalMissionAmount: Number((payroll as any).externalMissionAmount ?? 0),
      },
      salary: {
        currency: payroll.currency || 'USD',
        basicSalary: payroll.basicSalary ? Number(payroll.basicSalary) : 0,
        dailyWageSnapshot: (payroll as any).dailyWageSnapshot ? Number((payroll as any).dailyWageSnapshot) : null,
        hourlyRate: Number((payroll as any).hourlyRate ?? 0),
        allowances: {
          total: payroll.allowancesTotal ? Number(payroll.allowancesTotal) : 0,
          breakdown: allowancesBreakdown,
        },
        overtimePay: payroll.overtimePay ? Number(payroll.overtimePay) : 0,
        overtimeWorkdayPay: Number((payroll as any).overtimeWorkdayPay ?? 0),
        overtimeHolidayPay: Number((payroll as any).overtimeHolidayPay ?? 0),
        commissionAmount: Number((payroll as any).commissionAmount ?? 0),
        grossSalary: payroll.grossSalary ? Number(payroll.grossSalary) : 0,
        bonusAmount: payroll.bonusAmount ? Number(payroll.bonusAmount) : 0,
        bonusDetails: payroll.bonusDetails ? JSON.parse(payroll.bonusDetails) : [],
        penaltyAmount: payroll.penaltyAmount ? Number(payroll.penaltyAmount) : 0,
        penaltyDetails: payroll.penaltyDetails ? JSON.parse(payroll.penaltyDetails) : [],
        deductions: {
          attendanceDeduction: payroll.deductionAmount ? Number(payroll.deductionAmount) : 0,
          absenceDeduction: payroll.absenceDeductionAmount ? Number(payroll.absenceDeductionAmount) : 0,
          unpaidLeaveAmount: Number((payroll as any).unpaidLeaveAmount ?? 0),
          hourlyLeaveAmount: Number((payroll as any).hourlyLeaveAmount ?? 0),
          advanceDeduction: Number((payroll as any).advanceDeduction ?? 0),
          otherDeductionAmount: Number((payroll as any).otherDeductionAmount ?? 0),
          otherDeductionNotes: (payroll as any).otherDeductionNotes ?? null,
          totalDeduction: payroll.deductionBreakdown
            ? (payroll.deductionBreakdown as any).totalDeduction ?? 0
            : (payroll.deductionAmount ? Number(payroll.deductionAmount) : 0)
              + (payroll.absenceDeductionAmount ? Number(payroll.absenceDeductionAmount) : 0),
        },
        netSalary: payroll.netSalary ? Number(payroll.netSalary) : 0,
        roundedNetSalary: (payroll as any).roundedNetSalary ?? Math.round(payroll.netSalary ? Number(payroll.netSalary) : 0),
      },
      status: payroll.status,
      employmentStatusAtGenTime: (payroll as any).employmentStatusAtGenTime ?? null,
      notes: (payroll as any).notes ?? null,
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
      totalDeductions: (p.deductionBreakdown as any)?.totalDeduction
        ?? ((p.deductionAmount ? Number(p.deductionAmount) : 0)
          + (p.absenceDeductionAmount ? Number(p.absenceDeductionAmount) : 0)),
      netSalary: p.netSalary ? Number(p.netSalary) : 0,
      roundedNetSalary: (p as any).roundedNetSalary ?? Math.round(p.netSalary ? Number(p.netSalary) : 0),
    }));

    const totalNet = summary.reduce((sum, p) => sum + p.roundedNetSalary, 0);

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

  // ==================== XLSX Export ====================

  async exportXlsx(year: number, month: number, res: Response) {
    const payrolls = await this.prisma.monthlyPayroll.findMany({
      where: { year, month },
      orderBy: { createdAt: 'asc' },
    });

    const empIds = payrolls.map(p => p.employeeId);
    let employees: any[] = [];
    if (empIds.length > 0) {
      employees = await this.prisma.$queryRawUnsafe(`
        SELECT e.id, e."firstNameAr", e."lastNameAr", e."workType", e."hireDate",
               jt."nameAr" as "jobTitleAr"
        FROM users.employees e
        LEFT JOIN users.job_titles jt ON jt.id = e."jobTitleId"
        WHERE e.id = ANY($1::text[])
      `, empIds) as any[];
    }
    const empMap = new Map(employees.map(e => [e.id, e]));

    // تفصيل الإجازات اليومية حسب نوع الإجازة (يستثني الساعية والتعويضية التلقائية — لها أعمدتها الخاصة)
    const monthStart = new Date(Date.UTC(year, month - 1, 1));
    const monthEnd = new Date(Date.UTC(year, month, 0));
    let leaveTypeRows: Array<{ employeeId: string; typeName: string; isPaid: boolean; days: number }> = [];
    if (empIds.length > 0) {
      leaveTypeRows = await this.prisma.$queryRawUnsafe(`
        SELECT lr."employeeId", lt."nameAr" as "typeName", lt."isPaid", SUM(lr."totalDays")::float as days
        FROM leaves.leave_requests lr
        JOIN leaves.leave_types lt ON lt.id = lr."leaveTypeId"
        WHERE lr."employeeId" = ANY($1::text[])
          AND lr.status = 'APPROVED'
          AND lr."deletedAt" IS NULL
          AND lr."isHourlyLeave" = false
          AND (lr.source IS NULL OR lr.source = 'EMPLOYEE_REQUEST')
          AND lr."startDate" <= $3 AND lr."endDate" >= $2
        GROUP BY lr."employeeId", lt."nameAr", lt."isPaid"
      `, empIds, monthStart, monthEnd) as any[];
    }
    const leaveTypeNames = [...new Set(leaveTypeRows.map(r => r.typeName))].sort();
    const leaveTypeByEmployee = new Map<string, Map<string, number>>();
    for (const row of leaveTypeRows) {
      if (!leaveTypeByEmployee.has(row.employeeId)) leaveTypeByEmployee.set(row.employeeId, new Map());
      leaveTypeByEmployee.get(row.employeeId)!.set(row.typeName, Number(row.days));
    }

    // عدد أيام نصف اليوم (حضور نصف دوام) لكل موظف خلال الشهر
    const halfDayByEmployee = new Map<string, number>();
    if (empIds.length > 0) {
      const halfDayRows = await this.prisma.$queryRawUnsafe(`
        SELECT ar."employeeId", COUNT(*)::int as count
        FROM attendance.attendance_records ar
        WHERE ar."employeeId" = ANY($1::text[])
          AND ar."halfDayPeriod" IS NOT NULL
          AND ar.date >= $2 AND ar.date <= $3
        GROUP BY ar."employeeId"
      `, empIds, monthStart, monthEnd) as Array<{ employeeId: string; count: number }>;
      for (const row of halfDayRows) {
        halfDayByEmployee.set(row.employeeId, Number(row.count));
      }
    }

    const workTypeAr = (wt: string | null): string => {
      switch (wt) {
        case 'FULL_TIME': return 'كامل';
        case 'PART_TIME': return 'جزئي';
        case 'REMOTE': return 'أونلاين';
        default: return '—';
      }
    };

    // جمع أنواع البدلات الموجودة فعلاً في بيانات الشهر — ديناميكي
    const allowanceArNames: Record<string, string> = {
      FOOD: 'بدل طعام',
      PREVIOUS_EXPERIENCE: 'بدل خبرة سابقة',
      ACADEMIC_DEGREE: 'بدل شهادة أكاديمية',
      WORK_NATURE: 'بدل طبيعة عمل',
      RESPONSIBILITY: 'بدل مسؤولية',
      RESIDENCE: 'بدل سكن',
    };
    const allAllowanceKeys = new Set<string>();
    for (const p of payrolls) {
      const ab = p.allowancesBreakdown ? JSON.parse(p.allowancesBreakdown as string) : {};
      for (const k of Object.keys(ab)) { if (Number(ab[k]) > 0) allAllowanceKeys.add(k); }
    }
    const allowanceKeys = [...allAllowanceKeys].sort();

    // الأنواع المدمجة في إجازات بأجر (مدفوعة فقط، ما عدا السنوية والمرضية)
    const paidLeaveTypeNamesSet = new Set(
      leaveTypeRows.filter(r => r.isPaid).map(r => r.typeName),
    );
    const HIDE_FROM_INDIVIDUAL = ['إجازة وفاة'];
    const individualLeaveNames = leaveTypeNames.filter(n =>
      !HIDE_FROM_INDIVIDUAL.includes(n) && paidLeaveTypeNamesSet.has(n),
    );
    const PAID_LEAVE_EXCLUDE = new Set(['إجازة سنوية', 'إجازة مرضية']);

    // بناء أعمدة أنواع الإجازات مع حقن قيمة استقطاع الإجازة المرضية بعد إجازة مرضية مباشرة
    const leaveHeaders: string[] = [];
    let sickLeaveHeaderInserted = false;
    for (const name of individualLeaveNames) {
      leaveHeaders.push(name === 'إجازة سنوية' ? 'إجازة سنوية (إجازة إدارية)' : name);
      if (name === 'إجازة مرضية') {
        leaveHeaders.push('قيمة استقطاع الإجازة المرضية $');
        sickLeaveHeaderInserted = true;
      }
    }
    if (!sickLeaveHeaderInserted) leaveHeaders.push('قيمة استقطاع الإجازة المرضية $');

    const headers = [
      'اسم الموظف', 'تاريخ التعيين', 'المسمى الوظيفي', 'نوع الدوام', 'الراتب الأساسي $',
      ...allowanceKeys.map(k => (allowanceArNames[k] ?? k) + ' $'),
      'الأجر الساعي $', 'إجازات بأجر', ...leaveHeaders, 'إجازات بلا راتب',
      'قيمة الإجازات بلا راتب $', 'إجازة نصف يوم',
      'إجمالي دقائق التأخير', 'إجمالي دقائق الخروج المبكر',
      'الإجازة الساعية التلقائية', 'قيمة الإجازات الساعية $', 'الإجازة الساعية اليدوية', 'قيمة خصم الساعية اليدوية $',
      'أيام الغياب', 'قيمة استقطاع الغياب $',
      'إضافي أيام عادية (س)', 'قيمة إضافي عادي $',
      'إضافي أيام عطل (س)', 'قيمة إضافي عطل $',
      'أيام مهمة داخلية', 'قيمة المهمات الداخلية $',
      'أيام مهمة خارجية', 'قيمة المهمات الخارجية $',
      'مكافآت $', 'عقوبات مادية $',
      'عمولة مبيعات $', 'سلف $', 'خصومات أخرى $', 'إضافات أخرى $',
      'الراتب الصافي $', 'تقريب $', 'ملاحظات',
    ];

    const rows = payrolls.map(p => {
      const emp = empMap.get(p.employeeId);
      const allowances = p.allowancesBreakdown ? JSON.parse(p.allowancesBreakdown as string) : {};
      const bd = p.deductionBreakdown as any;
      const empLeaveTypes = leaveTypeByEmployee.get(p.employeeId);
      const leaveValuesWithSick: number[] = [];
      let sickLeaveValueInserted = false;
      for (const name of individualLeaveNames) {
        leaveValuesWithSick.push(empLeaveTypes?.get(name) ?? 0);
        if (name === 'إجازة مرضية') {
          leaveValuesWithSick.push(Number(bd?.sickLeave?.total ?? 0));
          sickLeaveValueInserted = true;
        }
      }
      if (!sickLeaveValueInserted) leaveValuesWithSick.push(Number(bd?.sickLeave?.total ?? 0));

      // خلية إجازات بأجر: نطرح السنوية من المخزون لأنها تظهر في عمودها المنفصل
      const annualDays = empLeaveTypes?.get('إجازة سنوية') ?? 0;
      const paidDaysTotal = Math.max(0, Number((p as any).paidLeaveDays ?? 0) - annualDays);
      const paidTypeLabels = [...(empLeaveTypes?.entries() ?? [])]
        .filter(([name, days]) => paidLeaveTypeNamesSet.has(name) && !PAID_LEAVE_EXCLUDE.has(name) && days > 0)
        .map(([name]) => name);
      const paidLeaveCell = paidDaysTotal > 0 && paidTypeLabels.length > 0
        ? `${paidDaysTotal} (${paidTypeLabels.join('/')})`
        : paidDaysTotal;

      return [
        `${emp?.firstNameAr ?? ''} ${emp?.lastNameAr ?? ''}`.trim() || '—',
        emp?.hireDate ? new Date(emp.hireDate).toISOString().split('T')[0] : '—',
        emp?.jobTitleAr ?? '—',
        workTypeAr(emp?.workType),
        Number(p.basicSalary ?? 0),
        ...allowanceKeys.map(k => Number(allowances[k] ?? 0)),
        Number((p as any).hourlyRate ?? 0),
        paidLeaveCell,
        ...leaveValuesWithSick,
        Number((p as any).unpaidLeaveDays ?? 0),
        Number((p as any).unpaidLeaveAmount ?? 0),
        halfDayByEmployee.get(p.employeeId) ?? 0,
        Number((p as any).totalLateMinutesEffective ?? 0),
        Number((p as any).totalEarlyLeaveMinutes ?? 0),
        parseFloat(((Number((p as any).tardinessOffsetMinutes ?? 0) + Number((p as any).lateDeductionMinutes ?? 0) + Number((p as any).earlyLeaveDeductionMinutes ?? 0)) / 60).toFixed(2)),
        parseFloat(((Number((p as any).lateDeductionMinutes ?? 0) + Number((p as any).earlyLeaveDeductionMinutes ?? 0)) * Number((p as any).minuteRate ?? 0)).toFixed(2)),
        parseFloat(((Number((p as any).paidHourlyLeaveMinutes ?? 0) + Number((p as any).unpaidHourlyLeaveMinutes ?? 0)) / 60).toFixed(2)),
        parseFloat((Number((p as any).unpaidHourlyLeaveMinutes ?? 0) * Number((p as any).minuteRate ?? 0)).toFixed(2)),
        Number((p as any).absentUnjustified ?? 0),
        Number(bd?.absence?.amount ?? (p as any).absenceDeductionAmount ?? 0),
        parseFloat((Number((p as any).overtimeWorkdayMinutes ?? 0) / 60).toFixed(2)),
        Number((p as any).overtimeWorkdayPay ?? 0),
        parseFloat((Number((p as any).overtimeHolidayMinutes ?? 0) / 60).toFixed(2)),
        Number((p as any).overtimeHolidayPay ?? 0),
        Number((p as any).internalMissionDays ?? 0),
        Number((p as any).internalMissionAmount ?? 0),
        Number((p as any).externalMissionDays ?? 0),
        Number((p as any).externalMissionAmount ?? 0),
        Number(p.bonusAmount ?? 0),
        Number((p as any).penaltyAmount ?? 0),
        Number((p as any).commissionAmount ?? 0),
        Number((p as any).advanceDeduction ?? 0),
        Number((p as any).otherDeductionAmount ?? 0),
        Number((p as any).otherAdditionAmount ?? 0),
        Number(p.netSalary ?? 0),
        Number((p as any).roundedNetSalary ?? Math.round(Number(p.netSalary ?? 0))),
        (p as any).notes ?? '',
      ];
    });

    // صف الإجمالي — يُبنى ديناميكياً بطول الأعمدة لتجنب أخطاء العدّ اليدوي عند إضافة أعمدة جديدة
    const totalNet = payrolls.reduce((s, p) => s + Number((p as any).roundedNetSalary ?? Math.round(Number(p.netSalary ?? 0))), 0);
    const totalRow = new Array(headers.length).fill('');
    totalRow[0] = 'إجمالي كتلة الرواتب';
    totalRow[headers.length - 2] = totalNet; // عمود 'تقريب'
    rows.push(totalRow);

    const monthNames = ['','يناير','فبراير','مارس','أبريل','مايو','يونيو',
                        'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

    await sendExcel(res, `رواتب-${monthNames[month]}-${year}`, headers, rows);
  }

  // ==================== Phase 7 — endpoints إضافية ====================

  async updateOtherDeduction(id: string, amount: number, notes?: string) {
    const payroll = await this.prisma.monthlyPayroll.findUnique({ where: { id } });
    if (!payroll) throw new NotFoundException('الكشف غير موجود');
    if (payroll.status !== 'DRAFT')
      throw new BadRequestException('لا يمكن تعديل كشف معتمد — اطلب إعادة فتحه');

    const newNet = Math.max(0,
      Number(payroll.netSalary) + Number((payroll as any).otherDeductionAmount ?? 0) - amount,
    );

    return this.prisma.monthlyPayroll.update({
      where: { id },
      data: {
        otherDeductionAmount: amount,
        otherDeductionNotes: notes ?? null,
        netSalary: newNet,
        roundedNetSalary: Math.round(newNet),
      } as any,
    });
  }

  async updateNote(id: string, notes: string) {
    const payroll = await this.prisma.monthlyPayroll.findUnique({ where: { id } });
    if (!payroll) throw new NotFoundException('الكشف غير موجود');
    return this.prisma.monthlyPayroll.update({
      where: { id },
      data: { notes } as any,
    });
  }

  async resetMonth(year: number, month: number) {
    const draftPayrolls = await this.prisma.monthlyPayroll.findMany({
      where: { year, month, status: 'DRAFT' },
      select: { id: true, employeeId: true },
    });

    return this.prisma.$transaction(async (tx) => {
      for (const p of draftPayrolls) {
        const installments = await tx.$queryRawUnsafe(`
          SELECT id, "advanceId", amount FROM users.salary_advance_installments
          WHERE year = $1 AND month = $2 AND "payrollId" = $3
        `, year, month, p.id) as Array<{ id: string; advanceId: string; amount: string }>;

        for (const i of installments) {
          await tx.$executeRawUnsafe(`
            UPDATE users.salary_advances
            SET "remainingBalance" = "remainingBalance" + $1,
                "paidInstallments" = GREATEST(0, "paidInstallments" - 1),
                status = CASE WHEN status = 'COMPLETED' THEN 'ACTIVE' ELSE status END
            WHERE id = $2
          `, i.amount, i.advanceId);
        }
        await tx.$executeRawUnsafe(`
          DELETE FROM users.salary_advance_installments WHERE "payrollId" = $1
        `, p.id);
      }

      const deleted = await tx.monthlyPayroll.deleteMany({
        where: { year, month, status: 'DRAFT' },
      });

      return { deletedPayrolls: deleted.count, year, month };
    });
  }
}
