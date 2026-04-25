import { Controller, Get, Param, Query, Res, UseGuards, UseInterceptors } from '@nestjs/common';
import type { Response } from 'express';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permission } from '../common/decorators/permission.decorator';
import { EmployeeInterceptor } from '../common/interceptors/employee.interceptor';
import { sendCsv } from '../common/utils/csv.util';

@Controller('attendance-reports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UseInterceptors(EmployeeInterceptor)
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  /**
   * GET /attendance-reports/daily
   * التقرير اليومي - سجلات حضور يوم محدد
   */
  @Get('daily')
  @Permission('attendance.reports.read')
  dailyReport(
    @Query('date') date: string,
    @Query('departmentId') departmentId?: string,
    @Query('employeeId') employeeId?: string,
  ) {
    const reportDate = date || new Date().toISOString().split('T')[0];
    return this.service.dailyReport({ date: reportDate, departmentId, employeeId });
  }

  /**
   * GET /attendance-reports/monthly
   * التقرير الشهري - ملخص حضور الموظفين لشهر كامل
   */
  @Get('monthly')
  @Permission('attendance.reports.read')
  monthlyReport(
    @Query('year') year: string,
    @Query('month') month: string,
    @Query('employeeId') employeeId?: string,
    @Query('departmentId') departmentId?: string,
  ) {
    const now = new Date();
    return this.service.monthlyReport({
      year: year ? parseInt(year) : now.getFullYear(),
      month: month ? parseInt(month) : now.getMonth() + 1,
      employeeId,
      departmentId,
    });
  }

  /**
   * GET /attendance-reports/summary
   * تقرير ملخص لفترة - إحصائيات مجمعة
   */
  @Get('summary')
  @Permission('attendance.reports.read')
  summaryReport(
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Query('employeeId') employeeId?: string,
    @Query('departmentId') departmentId?: string,
  ) {
    const now = new Date();
    const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const defaultTo = now.toISOString().split('T')[0];
    return this.service.summaryReport({
      dateFrom: dateFrom || defaultFrom,
      dateTo: dateTo || defaultTo,
      employeeId,
      departmentId,
    });
  }

  /**
   * GET /attendance-reports/breaks
   * تقرير الاستراحات - إجمالي دقائق الاستراحة
   */
  @Get('breaks')
  @Permission('attendance.reports.read')
  breaksReport(
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Query('employeeId') employeeId?: string,
    @Query('departmentId') departmentId?: string,
  ) {
    const now = new Date();
    const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const defaultTo = now.toISOString().split('T')[0];
    return this.service.breaksReport({
      dateFrom: dateFrom || defaultFrom,
      dateTo: dateTo || defaultTo,
      employeeId,
      departmentId,
    });
  }

  /**
   * GET /attendance-reports/lateness
   * تقرير التأخيرات
   */
  @Get('lateness')
  @Permission('attendance.reports.read')
  latenessReport(
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Query('employeeId') employeeId?: string,
    @Query('departmentId') departmentId?: string,
    @Query('minLateMinutes') minLateMinutes?: string,
  ) {
    const now = new Date();
    const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const defaultTo = now.toISOString().split('T')[0];
    return this.service.latenessReport({
      dateFrom: dateFrom || defaultFrom,
      dateTo: dateTo || defaultTo,
      employeeId,
      departmentId,
      minLateMinutes: minLateMinutes ? parseInt(minLateMinutes) : 1,
    });
  }

  /**
   * GET /attendance-reports/absences
   * تقرير الغياب
   */
  @Get('absences')
  @Permission('attendance.reports.read')
  absencesReport(
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Query('employeeId') employeeId?: string,
    @Query('departmentId') departmentId?: string,
    @Query('justified') justified?: string,
  ) {
    const now = new Date();
    const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const defaultTo = now.toISOString().split('T')[0];
    const justifiedFilter = justified === 'true' ? true : justified === 'false' ? false : undefined;
    return this.service.absencesReport({
      dateFrom: dateFrom || defaultFrom,
      dateTo: dateTo || defaultTo,
      employeeId,
      departmentId,
      justified: justifiedFilter,
    });
  }

  /**
   * GET /attendance-reports/temp-exits
   * تقرير الخروجات المؤقتة
   */
  @Get('temp-exits')
  @Permission('attendance.reports.read')
  tempExitsReport(
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Query('employeeId') employeeId?: string,
    @Query('departmentId') departmentId?: string,
  ) {
    const now = new Date();
    const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const defaultTo = now.toISOString().split('T')[0];
    return this.service.tempExitsReport({
      dateFrom: dateFrom || defaultFrom,
      dateTo: dateTo || defaultTo,
      employeeId,
      departmentId,
    });
  }

  /**
   * GET /attendance-reports/monthly-payroll
   * ملخص شهري للرواتب
   */
  @Get('monthly-payroll')
  @Permission('attendance.reports.read')
  monthlyPayrollReport(
    @Query('year') year: string,
    @Query('month') month: string,
    @Query('departmentId') departmentId?: string,
  ) {
    const now = new Date();
    return this.service.monthlyPayrollReport({
      year: year ? parseInt(year) : now.getFullYear(),
      month: month ? parseInt(month) : now.getMonth() + 1,
      departmentId,
    });
  }

  /**
   * GET /attendance-reports/employee-card/:employeeId
   * بطاقة حضور الموظف
   */
  @Get('employee-card/:employeeId')
  @Permission('attendance.reports.read')
  employeeCardReport(
    @Param('employeeId') employeeId: string,
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    const now = new Date();
    return this.service.employeeCardReport(employeeId, {
      year: year ? parseInt(year) : now.getFullYear(),
      month: month ? parseInt(month) : now.getMonth() + 1,
    });
  }

  /**
   * GET /attendance-reports/payroll-summary
   * ملخص الرواتب الشهرية مع تفصيل الخصومات والبدلات
   */
  @Get('payroll-summary')
  @Permission('attendance.reports.read')
  payrollSummary(
    @Query('year') year: string,
    @Query('month') month: string,
    @Query('departmentId') departmentId?: string,
  ) {
    const now = new Date();
    return this.service.payrollSummaryReport({
      year: year ? parseInt(year) : now.getFullYear(),
      month: month ? parseInt(month) : now.getMonth() + 1,
      departmentId,
    });
  }

  /**
   * GET /attendance-reports/deduction-breakdown
   * تفصيل الخصومات لكل موظف (تأخير + غياب + استراحة)
   */
  @Get('deduction-breakdown')
  @Permission('attendance.reports.read')
  deductionBreakdown(
    @Query('year') year: string,
    @Query('month') month: string,
    @Query('departmentId') departmentId?: string,
    @Query('employeeId') employeeId?: string,
  ) {
    const now = new Date();
    return this.service.deductionBreakdownReport({
      year: year ? parseInt(year) : now.getFullYear(),
      month: month ? parseInt(month) : now.getMonth() + 1,
      departmentId,
      employeeId,
    });
  }

  /**
   * GET /attendance-reports/department-attendance
   * ملخص حضور الموظفين مجمعاً بالقسم
   */
  @Get('department-attendance')
  @Permission('attendance.reports.read')
  departmentAttendance(
    @Query('year') year: string,
    @Query('month') month: string,
    @Query('departmentId') departmentId: string,
  ) {
    const now = new Date();
    return this.service.departmentAttendanceReport({
      year: year ? parseInt(year) : now.getFullYear(),
      month: month ? parseInt(month) : now.getMonth() + 1,
      departmentId,
    });
  }

  /**
   * GET /attendance-reports/lateness-accumulated
   * التأخر التراكمي الشهري مقارنةً بسماحية الـ 2 ساعة
   */
  @Get('lateness-accumulated')
  @Permission('attendance.reports.read')
  latenessAccumulated(
    @Query('year') year: string,
    @Query('month') month: string,
    @Query('departmentId') departmentId?: string,
  ) {
    const now = new Date();
    return this.service.latenessAccumulatedReport({
      year: year ? parseInt(year) : now.getFullYear(),
      month: month ? parseInt(month) : now.getMonth() + 1,
      departmentId,
    });
  }

  /**
   * GET /attendance-reports/top-absences
   * الموظفون الأكثر غياباً وتأخراً
   */
  @Get('top-absences')
  @Permission('attendance.reports.read')
  async topAbsences(
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Query('limit') limit?: string,
    @Query('format') format?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const now = new Date();
    const data = await this.service.topAbsences(
      year ? parseInt(year) : now.getFullYear(),
      month ? parseInt(month) : undefined,
      limit ? parseInt(limit) : 10,
    );
    if (format === 'csv') {
      sendCsv(
        res!,
        'attendance-top-absences',
        ['رقم الموظف', 'الاسم', 'أيام الغياب', 'مرات التأخر', 'إجمالي دقائق التأخر'],
        data.items.map((r: any) => [
          r.employee?.employeeNumber ?? r.employee?.id ?? '',
          r.employee ? `${r.employee.firstNameAr} ${r.employee.lastNameAr}` : '',
          r.absenceCount,
          r.lateCount,
          r.totalLateMinutes,
        ]),
      );
      return;
    }
    return data;
  }

  /**
   * GET /attendance-reports/overtime
   * الأوفرتايم المتراكم لكل موظف
   */
  @Get('overtime')
  @Permission('attendance.reports.read')
  async overtime(
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Query('format') format?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const now = new Date();
    const data = await this.service.overtime(
      year ? parseInt(year) : now.getFullYear(),
      month ? parseInt(month) : undefined,
    );
    if (format === 'csv') {
      sendCsv(
        res!,
        'attendance-overtime',
        ['رقم الموظف', 'الاسم', 'أيام الأوفرتايم', 'إجمالي الساعات'],
        data.items.map((r: any) => [
          r.employee?.employeeNumber ?? r.employee?.id ?? '',
          r.employee ? `${r.employee.firstNameAr} ${r.employee.lastNameAr}` : '',
          r.overtimeDays,
          r.totalOvertimeHours,
        ]),
      );
      return;
    }
    return data;
  }
}
