import { Controller, Get, Param, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permission } from '../common/decorators/permission.decorator';
import { EmployeeInterceptor } from '../common/interceptors/employee.interceptor';

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
   * GET /attendance-reports/top-absences
   * الموظفون الأكثر غياباً وتأخراً
   */
  @Get('top-absences')
  @Permission('attendance.reports.read')
  topAbsences(
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Query('limit') limit?: string,
  ) {
    const now = new Date();
    return this.service.topAbsences(
      year ? parseInt(year) : now.getFullYear(),
      month ? parseInt(month) : undefined,
      limit ? parseInt(limit) : 10,
    );
  }

  /**
   * GET /attendance-reports/overtime
   * الأوفرتايم المتراكم لكل موظف
   */
  @Get('overtime')
  @Permission('attendance.reports.read')
  overtime(
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    const now = new Date();
    return this.service.overtime(
      year ? parseInt(year) : now.getFullYear(),
      month ? parseInt(month) : undefined,
    );
  }
}
