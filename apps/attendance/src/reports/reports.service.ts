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

    return {
      date: query.date,
      totalRecords: filteredRecords.length,
      statusSummary,
      records: filteredRecords.map((r: any) => ({
        ...r,
        employee: employeeMap.get(r.employeeId) || null,
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

    // Group by employee
    const byEmployee: Record<string, any> = {};
    filteredRecords.forEach((r: any) => {
      if (!byEmployee[r.employeeId]) {
        byEmployee[r.employeeId] = {
          employee: employeeMap.get(r.employeeId) || null,
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
          records: [],
        };
      }

      const emp = byEmployee[r.employeeId];
      emp.totalDays++;
      emp.totalWorkedMinutes += r.workedMinutes || 0;
      emp.totalOvertimeMinutes += r.overtimeMinutes || 0;
      emp.totalLateMinutes += r.lateMinutes || 0;
      emp.totalEarlyLeaveMinutes += r.earlyLeaveMinutes || 0;

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
