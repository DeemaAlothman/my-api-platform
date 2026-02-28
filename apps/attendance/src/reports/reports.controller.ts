import { Controller, Get, Query, UseGuards, UseInterceptors } from '@nestjs/common';
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
}
