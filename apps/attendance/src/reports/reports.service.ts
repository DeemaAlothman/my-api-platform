import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  private async getEmployeeNames(employeeIds: string[]) {
    if (employeeIds.length === 0) return new Map<string, any>();

    const employees = (await this.prisma.$queryRawUnsafe(
      `SELECT id, "employeeNumber", "firstNameAr", "lastNameAr", "firstNameEn", "lastNameEn",
              "departmentId"
       FROM users.employees
       WHERE id::text = ANY($1::text[]) AND "deletedAt" IS NULL`,
      employeeIds,
    )) as Array<{
      id: string;
      employeeNumber: string;
      firstNameAr: string;
      lastNameAr: string;
      firstNameEn: string | null;
      lastNameEn: string | null;
      departmentId: string | null;
    }>;

    return new Map(employees.map(e => [e.id, e]));
  }

  /**
   * تقرير يومي - Daily Report
   * جميع سجلات الحضور ليوم محدد
   */
  async dailyReport(query: {
    date: string;
    departmentId?: string;
    employeeId?: string;
  }) {
    const date = new Date(query.date);
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const records = await this.prisma.attendanceRecord.findMany({
      where: {
        date: startOfDay,
        ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      },
      include: { breaks: true },
      orderBy: { clockInTime: 'asc' },
    });

    const employeeIds = [...new Set(records.map((r: any) => r.employeeId))] as string[];
    let employeeMap = await this.getEmployeeNames(employeeIds);

    // Filter by departmentId if provided
    let filteredRecords: any[] = records;
    if (query.departmentId) {
      filteredRecords = records.filter((r: any) => {
        const emp = employeeMap.get(r.employeeId);
        return emp?.departmentId === query.departmentId;
      });
    }

    const statusSummary: Record<string, number> = {};
    filteredRecords.forEach((r: any) => {
      statusSummary[r.status] = (statusSummary[r.status] || 0) + 1;
    });

    const totalBreakMinutes = filteredRecords.reduce((s: number, r: any) => s + (r.totalBreakMinutes || 0), 0);

    return {
      date: query.date,
      totalRecords: filteredRecords.length,
      statusSummary,
      summary: { totalBreakMinutes },
      records: filteredRecords.map((r: any) => ({
        ...r,
        employee: employeeMap.get(r.employeeId) || null,
        breaks: r.breaks || [],
      })),
    };
  }

  /**
   * تقرير شهري - Monthly Report
   * ملخص حضور الموظفين لشهر كامل
   */
  async monthlyReport(query: {
    year: number;
    month: number;
    employeeId?: string;
    departmentId?: string;
  }) {
    const { year, month } = query;
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    const records = await this.prisma.attendanceRecord.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
        ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      },
      orderBy: [{ employeeId: 'asc' }, { date: 'asc' }],
    });

    const employeeIds = [...new Set(records.map((r: any) => r.employeeId))] as string[];
    const employeeMap = await this.getEmployeeNames(employeeIds);

    // Filter by department
    let filteredRecords: any[] = records;
    if (query.departmentId) {
      filteredRecords = records.filter((r: any) => {
        const emp = employeeMap.get(r.employeeId);
        return emp?.departmentId === query.departmentId;
      });
    }

    // جلب إعدادات الموظفين لحساب breakOverLimit
    const configs = await this.prisma.employeeAttendanceConfig.findMany({
      where: { employeeId: { in: employeeIds } },
    });
    const configMap = new Map(configs.map((c: any) => [c.employeeId, c]));

    // Group by employee
    const byEmployee: Record<string, any> = {};
    filteredRecords.forEach((r: any) => {
      const config = configMap.get(r.employeeId) as any;
      const allowedBreakMinutes = config?.allowedBreakMinutes ?? 60;

      if (!byEmployee[r.employeeId]) {
        byEmployee[r.employeeId] = {
          employee: employeeMap.get(r.employeeId) || null,
          salaryLinked: r.salaryLinked ?? config?.salaryLinked ?? true,
          totalDays: 0,
          presentDays: 0,
          absentDays: 0,
          lateDays: 0,
          earlyLeaveDays: 0,
          weekendDays: 0,
          onLeaveDays: 0,
          totalWorkedMinutes: 0,
          totalOvertimeMinutes: 0,
          totalLateMinutes: 0,
          totalEarlyLeaveMinutes: 0,
          totalBreakMinutes: 0,
          breakOverLimitMinutes: 0,
          netWorkedMinutes: 0,
          records: [],
        };
      }

      const emp = byEmployee[r.employeeId];
      emp.totalDays++;
      emp.totalWorkedMinutes += r.workedMinutes || 0;
      emp.totalOvertimeMinutes += r.overtimeMinutes || 0;
      emp.totalLateMinutes += r.lateMinutes || 0;
      emp.totalEarlyLeaveMinutes += r.earlyLeaveMinutes || 0;
      emp.totalBreakMinutes += r.totalBreakMinutes || 0;
      emp.breakOverLimitMinutes += Math.max(0, (r.totalBreakMinutes || 0) - allowedBreakMinutes);
      emp.netWorkedMinutes += r.netWorkedMinutes || r.workedMinutes || 0;

      switch (r.status) {
        case 'PRESENT': emp.presentDays++; break;
        case 'ABSENT': emp.absentDays++; break;
        case 'LATE': emp.lateDays++; emp.presentDays++; break;
        case 'EARLY_LEAVE': emp.earlyLeaveDays++; emp.presentDays++; break;
        case 'WEEKEND': emp.weekendDays++; break;
        case 'ON_LEAVE': emp.onLeaveDays++; break;
        default: emp.presentDays++; break;
      }

      emp.records.push(r);
    });

    return {
      year,
      month,
      totalEmployees: Object.keys(byEmployee).length,
      employees: Object.values(byEmployee).map((e: any) => ({
        ...e,
        totalWorkedHours: +(e.totalWorkedMinutes / 60).toFixed(2),
        totalOvertimeHours: +(e.totalOvertimeMinutes / 60).toFixed(2),
      })),
    };
  }

  /**
   * تقرير ملخص لفترة - Summary Report
   * إحصائيات مجمعة لموظف أو مجموعة خلال فترة
   */
  async summaryReport(query: {
    employeeId?: string;
    departmentId?: string;
    dateFrom: string;
    dateTo: string;
  }) {
    const where: any = {
      date: {
        gte: new Date(query.dateFrom),
        lte: new Date(query.dateTo),
      },
    };
    if (query.employeeId) where.employeeId = query.employeeId;

    const records = await this.prisma.attendanceRecord.findMany({
      where,
      orderBy: { date: 'asc' },
    });

    const employeeIds = [...new Set(records.map((r: any) => r.employeeId))] as string[];
    const employeeMap = await this.getEmployeeNames(employeeIds);

    let filteredRecords: any[] = records;
    if (query.departmentId) {
      filteredRecords = records.filter((r: any) => {
        const emp = employeeMap.get(r.employeeId);
        return emp?.departmentId === query.departmentId;
      });
    }

    // Overall totals
    const totals = {
      totalRecords: filteredRecords.length,
      presentDays: 0,
      absentDays: 0,
      lateDays: 0,
      earlyLeaveDays: 0,
      weekendDays: 0,
      onLeaveDays: 0,
      totalWorkedMinutes: 0,
      totalOvertimeMinutes: 0,
      totalLateMinutes: 0,
      totalEarlyLeaveMinutes: 0,
    };

    filteredRecords.forEach((r: any) => {
      totals.totalWorkedMinutes += r.workedMinutes || 0;
      totals.totalOvertimeMinutes += r.overtimeMinutes || 0;
      totals.totalLateMinutes += r.lateMinutes || 0;
      totals.totalEarlyLeaveMinutes += r.earlyLeaveMinutes || 0;

      switch (r.status) {
        case 'PRESENT': totals.presentDays++; break;
        case 'ABSENT': totals.absentDays++; break;
        case 'LATE': totals.lateDays++; totals.presentDays++; break;
        case 'EARLY_LEAVE': totals.earlyLeaveDays++; totals.presentDays++; break;
        case 'WEEKEND': totals.weekendDays++; break;
        case 'ON_LEAVE': totals.onLeaveDays++; break;
        default: totals.presentDays++; break;
      }
    });

    return {
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      totalEmployees: employeeIds.length,
      totals: {
        ...totals,
        totalWorkedHours: +(totals.totalWorkedMinutes / 60).toFixed(2),
        totalOvertimeHours: +(totals.totalOvertimeMinutes / 60).toFixed(2),
      },
    };
  }

  /**
   * تقرير التأخيرات - Lateness Report
   */
  async latenessReport(query: {
    dateFrom: string;
    dateTo: string;
    employeeId?: string;
    departmentId?: string;
    minLateMinutes?: number;
  }) {
    const minLate = query.minLateMinutes ?? 1;

    const records = await this.prisma.attendanceRecord.findMany({
      where: {
        date: { gte: new Date(query.dateFrom), lte: new Date(query.dateTo) },
        status: { in: ['LATE'] },
        lateMinutes: { gte: minLate },
        ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      },
      orderBy: [{ employeeId: 'asc' }, { date: 'asc' }],
    });

    const employeeIds = [...new Set(records.map((r: any) => r.employeeId))] as string[];
    const employeeMap = await this.getEmployeeNames(employeeIds);

    let filtered: any[] = records;
    if (query.departmentId) {
      filtered = records.filter((r: any) => employeeMap.get(r.employeeId)?.departmentId === query.departmentId);
    }

    const byEmployee: Record<string, any> = {};
    filtered.forEach((r: any) => {
      if (!byEmployee[r.employeeId]) {
        byEmployee[r.employeeId] = {
          employee: employeeMap.get(r.employeeId) || null,
          lateCount: 0,
          totalLateMinutes: 0,
          details: [],
        };
      }
      const emp = byEmployee[r.employeeId];
      emp.lateCount++;
      emp.totalLateMinutes += r.lateMinutes || 0;
      emp.details.push({
        date: r.date,
        lateMinutes: r.lateMinutes,
        clockIn: r.clockInTime ? new Date(r.clockInTime).toTimeString().slice(0, 5) : null,
      });
    });

    const employees = Object.values(byEmployee).map((e: any) => ({
      ...e,
      avgLateMinutes: e.lateCount > 0 ? +(e.totalLateMinutes / e.lateCount).toFixed(1) : 0,
    }));

    return {
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      totalLateInstances: filtered.length,
      totalLateMinutes: filtered.reduce((s: number, r: any) => s + (r.lateMinutes || 0), 0),
      employees,
    };
  }

  /**
   * تقرير الغياب - Absences Report
   */
  async absencesReport(query: {
    dateFrom: string;
    dateTo: string;
    employeeId?: string;
    departmentId?: string;
    justified?: boolean;
  }) {
    const records = await this.prisma.attendanceRecord.findMany({
      where: {
        date: { gte: new Date(query.dateFrom), lte: new Date(query.dateTo) },
        status: 'ABSENT',
        ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      },
      orderBy: [{ employeeId: 'asc' }, { date: 'asc' }],
    });

    const employeeIds = [...new Set(records.map((r: any) => r.employeeId))] as string[];
    const employeeMap = await this.getEmployeeNames(employeeIds);

    let filtered: any[] = records;
    if (query.departmentId) {
      filtered = records.filter((r: any) => employeeMap.get(r.employeeId)?.departmentId === query.departmentId);
    }

    // جلب التبريرات الموافق عليها للسجلات
    const recordIds = filtered.map((r: any) => r.id).filter(Boolean);
    let justifications: any[] = [];
    if (recordIds.length > 0) {
      justifications = await this.prisma.attendanceJustification.findMany({
        where: {
          attendanceRecordId: { in: recordIds },
          status: { in: ['HR_APPROVED', 'MANAGER_APPROVED'] },
        },
      });
    }
    const justifiedRecordIds = new Set(justifications.map((j: any) => j.attendanceRecordId));
    const justificationByRecord = new Map(justifications.map((j: any) => [j.attendanceRecordId, j]));

    // فلتر justified إذا محدد
    if (query.justified === true) {
      filtered = filtered.filter((r: any) => justifiedRecordIds.has(r.id));
    } else if (query.justified === false) {
      filtered = filtered.filter((r: any) => !justifiedRecordIds.has(r.id));
    }

    const byEmployee: Record<string, any> = {};
    filtered.forEach((r: any) => {
      if (!byEmployee[r.employeeId]) {
        byEmployee[r.employeeId] = {
          employee: employeeMap.get(r.employeeId) || null,
          totalAbsences: 0,
          justifiedAbsences: 0,
          unjustifiedAbsences: 0,
          details: [],
        };
      }
      const emp = byEmployee[r.employeeId];
      const isJustified = justifiedRecordIds.has(r.id);
      const justif = justificationByRecord.get(r.id);
      emp.totalAbsences++;
      if (isJustified) emp.justifiedAbsences++; else emp.unjustifiedAbsences++;
      emp.details.push({
        date: r.date,
        justified: isJustified,
        justificationType: justif?.justificationType || null,
        status: justif?.status || null,
      });
    });

    const totalAbsences = filtered.length;
    const justifiedCount = filtered.filter((r: any) => justifiedRecordIds.has(r.id)).length;

    return {
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      totalAbsences,
      justifiedCount,
      unjustifiedCount: totalAbsences - justifiedCount,
      employees: Object.values(byEmployee),
    };
  }

  /**
   * تقرير الخروجات المؤقتة - Temp Exits Report
   */
  async tempExitsReport(query: {
    dateFrom: string;
    dateTo: string;
    employeeId?: string;
    departmentId?: string;
  }) {
    const records = await this.prisma.attendanceRecord.findMany({
      where: {
        date: { gte: new Date(query.dateFrom), lte: new Date(query.dateTo) },
        totalBreakMinutes: { gt: 0 },
        ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      },
      include: { breaks: true },
      orderBy: [{ employeeId: 'asc' }, { date: 'asc' }],
    });

    const employeeIds = [...new Set(records.map((r: any) => r.employeeId))] as string[];
    const employeeMap = await this.getEmployeeNames(employeeIds);

    let filtered: any[] = records;
    if (query.departmentId) {
      filtered = records.filter((r: any) => employeeMap.get(r.employeeId)?.departmentId === query.departmentId);
    }

    // جلب إعدادات الموظفين
    const configs = await this.prisma.employeeAttendanceConfig.findMany({
      where: { employeeId: { in: employeeIds } },
    });
    const configMap = new Map(configs.map((c: any) => [c.employeeId, c]));

    const byEmployee: Record<string, any> = {};
    filtered.forEach((r: any) => {
      const config = configMap.get(r.employeeId) as any;
      const allowedBreakMinutes = config?.allowedBreakMinutes ?? 60;

      if (!byEmployee[r.employeeId]) {
        byEmployee[r.employeeId] = {
          employee: employeeMap.get(r.employeeId) || null,
          allowedBreakMinutes,
          totalExits: 0,
          totalExitMinutes: 0,
          overLimitMinutes: 0,
          details: [],
        };
      }
      const emp = byEmployee[r.employeeId];
      const dayBreakMinutes = r.totalBreakMinutes || 0;
      const dayOver = Math.max(0, dayBreakMinutes - allowedBreakMinutes);

      emp.totalExits += r.breaks?.length || 0;
      emp.totalExitMinutes += dayBreakMinutes;
      emp.overLimitMinutes += dayOver;
      emp.details.push({
        date: r.date,
        breaks: (r.breaks || []).map((b: any) => ({
          out: b.breakOut ? new Date(b.breakOut).toTimeString().slice(0, 5) : null,
          in: b.breakIn ? new Date(b.breakIn).toTimeString().slice(0, 5) : null,
          minutes: b.durationMinutes,
        })),
        totalMinutes: dayBreakMinutes,
        allowedMinutes: allowedBreakMinutes,
        overLimitMinutes: dayOver,
      });
    });

    const totalExitMinutes = filtered.reduce((s: number, r: any) => s + (r.totalBreakMinutes || 0), 0);
    const totalOverLimit = Object.values(byEmployee).reduce((s: number, e: any) => s + e.overLimitMinutes, 0);

    return {
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      totalExits: filtered.reduce((s: number, r: any) => s + (r.breaks?.length || 0), 0),
      totalExitMinutes,
      authorizedMinutes: totalExitMinutes - totalOverLimit,
      unauthorizedMinutes: totalOverLimit,
      employees: Object.values(byEmployee),
    };
  }

  /**
   * ملخص شهري للرواتب - Monthly Payroll Report
   */
  async monthlyPayrollReport(query: {
    year: number;
    month: number;
    departmentId?: string;
  }) {
    const { year, month } = query;
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    const records = await this.prisma.attendanceRecord.findMany({
      where: { date: { gte: startDate, lte: endDate } },
      include: { breaks: true },
      orderBy: [{ employeeId: 'asc' }, { date: 'asc' }],
    });

    const employeeIds = [...new Set(records.map((r: any) => r.employeeId))] as string[];
    const employeeMap = await this.getEmployeeNames(employeeIds);

    let filteredEmployeeIds = employeeIds;
    if (query.departmentId) {
      filteredEmployeeIds = employeeIds.filter(id => employeeMap.get(id)?.departmentId === query.departmentId);
    }

    const configs = await this.prisma.employeeAttendanceConfig.findMany({
      where: { employeeId: { in: filteredEmployeeIds } },
    });
    const configMap = new Map(configs.map((c: any) => [c.employeeId, c]));

    const byEmployee: Record<string, any> = {};
    records
      .filter((r: any) => filteredEmployeeIds.includes(r.employeeId))
      .forEach((r: any) => {
        const config = configMap.get(r.employeeId) as any;
        const salaryLinked = r.salaryLinked ?? config?.salaryLinked ?? true;
        const allowedBreakMinutes = config?.allowedBreakMinutes ?? 60;

        if (!byEmployee[r.employeeId]) {
          byEmployee[r.employeeId] = {
            employee: employeeMap.get(r.employeeId) || null,
            salaryLinked,
            workingDays: 0,
            presentDays: 0,
            absentDays: 0,
            absentDaysUnjustified: 0,
            lateDays: 0,
            totalLateMinutes: 0,
            earlyLeaveDays: 0,
            totalEarlyLeaveMinutes: 0,
            totalBreakOverLimitMinutes: 0,
            totalOvertimeMinutes: 0,
            totalWorkedMinutes: 0,
            netWorkedMinutes: 0,
          };
        }
        const emp = byEmployee[r.employeeId];
        if (!['WEEKEND', 'ON_LEAVE'].includes(r.status)) emp.workingDays++;
        if (['PRESENT', 'LATE', 'EARLY_LEAVE'].includes(r.status)) emp.presentDays++;
        if (r.status === 'ABSENT') { emp.absentDays++; emp.absentDaysUnjustified++; }
        if (r.status === 'LATE') { emp.lateDays++; emp.totalLateMinutes += r.lateMinutes || 0; }
        if (r.status === 'EARLY_LEAVE') { emp.earlyLeaveDays++; emp.totalEarlyLeaveMinutes += r.earlyLeaveMinutes || 0; }
        emp.totalOvertimeMinutes += r.overtimeMinutes || 0;
        emp.totalWorkedMinutes += r.workedMinutes || 0;
        emp.netWorkedMinutes += r.netWorkedMinutes || r.workedMinutes || 0;

        const dayBreakMinutes = r.totalBreakMinutes || 0;
        emp.totalBreakOverLimitMinutes += Math.max(0, dayBreakMinutes - allowedBreakMinutes);
      });

    return {
      year,
      month,
      employees: Object.values(byEmployee).map((e: any) => ({
        ...e,
        deductions: e.salaryLinked ? {
          lateMinutes: e.totalLateMinutes,
          earlyLeaveMinutes: e.totalEarlyLeaveMinutes,
          breakOverLimitMinutes: e.totalBreakOverLimitMinutes,
          absentDays: e.absentDaysUnjustified,
          totalDeductionMinutes: e.totalLateMinutes + e.totalEarlyLeaveMinutes + e.totalBreakOverLimitMinutes,
        } : null,
      })),
    };
  }

  /**
   * بطاقة حضور الموظف - Employee Card Report
   */
  async employeeCardReport(employeeId: string, query: { year: number; month: number }) {
    const { year, month } = query;
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    const records = await this.prisma.attendanceRecord.findMany({
      where: { employeeId, date: { gte: startDate, lte: endDate } },
      include: { breaks: true },
      orderBy: { date: 'asc' },
    });

    const empList = await this.getEmployeeNames([employeeId]);
    const employee = empList.get(employeeId) || null;

    const config = await this.prisma.employeeAttendanceConfig.findUnique({ where: { employeeId } }) as any;

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const recordMap = new Map<string, any>(records.map((r: any) => [new Date(r.date).toISOString().slice(0, 10), r]));

    const daysInMonth = new Date(year, month, 0).getDate();
    const days: any[] = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const r = recordMap.get(dateStr);
      const dayOfWeek = new Date(dateStr).getDay();

      if (r) {
        days.push({
          date: dateStr,
          dayName: dayNames[dayOfWeek],
          status: r.status,
          clockIn: r.clockInTime ? new Date(r.clockInTime).toTimeString().slice(0, 5) : null,
          clockOut: r.clockOutTime ? new Date(r.clockOutTime).toTimeString().slice(0, 5) : null,
          lateMinutes: r.lateMinutes || 0,
          earlyLeaveMinutes: r.earlyLeaveMinutes || 0,
          workedMinutes: r.workedMinutes,
          overtimeMinutes: r.overtimeMinutes,
          breaks: (r.breaks || []).map((b: any) => ({
            out: b.breakOut ? new Date(b.breakOut).toTimeString().slice(0, 5) : null,
            in: b.breakIn ? new Date(b.breakIn).toTimeString().slice(0, 5) : null,
            minutes: b.durationMinutes,
          })),
          totalBreakMinutes: r.totalBreakMinutes || 0,
          netWorkedMinutes: r.netWorkedMinutes,
          source: r.source,
        });
      } else {
        days.push({ date: dateStr, dayName: dayNames[dayOfWeek], status: null, clockIn: null, clockOut: null });
      }
    }

    const presentRecords = records.filter((r: any) => ['PRESENT', 'LATE', 'EARLY_LEAVE'].includes(r.status));
    const summary = {
      workingDays: records.filter((r: any) => !['WEEKEND', 'ON_LEAVE'].includes(r.status)).length,
      presentDays: presentRecords.length,
      absentDays: records.filter((r: any) => r.status === 'ABSENT').length,
      lateDays: records.filter((r: any) => r.status === 'LATE').length,
      totalLateMinutes: records.reduce((s: number, r: any) => s + (r.lateMinutes || 0), 0),
      totalWorkedMinutes: records.reduce((s: number, r: any) => s + (r.workedMinutes || 0), 0),
      totalWorkedHours: +(records.reduce((s: number, r: any) => s + (r.workedMinutes || 0), 0) / 60).toFixed(2),
      totalOvertimeMinutes: records.reduce((s: number, r: any) => s + (r.overtimeMinutes || 0), 0),
      totalBreakMinutes: records.reduce((s: number, r: any) => s + (r.totalBreakMinutes || 0), 0),
    };

    return {
      employee,
      salaryLinked: config?.salaryLinked ?? true,
      allowedBreakMinutes: config?.allowedBreakMinutes ?? 60,
      year,
      month,
      summary,
      days,
    };
  }

  /**
   * تقرير الاستراحات - Breaks Report
   * إجمالي دقائق الاستراحة لكل موظف
   */
  async breaksReport(query: {
    employeeId?: string;
    departmentId?: string;
    dateFrom: string;
    dateTo: string;
  }) {
    const where: any = {
      date: {
        gte: new Date(query.dateFrom),
        lte: new Date(query.dateTo),
      },
      breakMinutes: { not: null },
    };
    if (query.employeeId) where.employeeId = query.employeeId;

    const records = await this.prisma.attendanceRecord.findMany({
      where,
      orderBy: [{ employeeId: 'asc' }, { date: 'asc' }],
    });

    const employeeIds = [...new Set(records.map((r: any) => r.employeeId))] as string[];
    const employeeMap = await this.getEmployeeNames(employeeIds);

    let filteredRecords: any[] = records;
    if (query.departmentId) {
      filteredRecords = records.filter((r: any) => {
        const emp = employeeMap.get(r.employeeId);
        return emp?.departmentId === query.departmentId;
      });
    }

    // Group by employee
    const byEmployee: Record<string, any> = {};
    filteredRecords.forEach((r: any) => {
      if (!byEmployee[r.employeeId]) {
        byEmployee[r.employeeId] = {
          employee: employeeMap.get(r.employeeId) || null,
          totalDays: 0,
          totalBreakMinutes: 0,
          records: [],
        };
      }
      byEmployee[r.employeeId].totalDays++;
      byEmployee[r.employeeId].totalBreakMinutes += r.breakMinutes || 0;
      byEmployee[r.employeeId].records.push({
        id: r.id,
        date: r.date,
        breakMinutes: r.breakMinutes,
        workedMinutes: r.workedMinutes,
      });
    });

    const totalBreakMinutes = filteredRecords.reduce((sum: number, r: any) => sum + (r.breakMinutes || 0), 0);

    return {
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      totalRecords: filteredRecords.length,
      totalBreakMinutes,
      totalBreakHours: +(totalBreakMinutes / 60).toFixed(2),
      employees: Object.values(byEmployee).map((e: any) => ({
        ...e,
        avgBreakMinutesPerDay: e.totalDays > 0 ? +(e.totalBreakMinutes / e.totalDays).toFixed(1) : 0,
      })),
    };
  }
}
