import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import type { Response } from 'express';
import { HrReportsService } from './hr-reports.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permission } from '../common/decorators/permission.decorator';
import { sendExcel } from '../common/utils/excel.util';

@ApiTags('HR Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('reports/hr')
export class HrReportsController {
  constructor(private readonly service: HrReportsService) {}

  @Get('employees-summary')
  @Permission('employees:read')
  @ApiOperation({ summary: 'توزيع الموظفين حسب القسم والجنس والجنسية ونوع العقد' })
  @ApiQuery({ name: 'format', required: false, enum: ['json', 'excel'] })
  async employeesSummary(@Query('format') format?: string, @Res({ passthrough: true }) res?: Response) {
    const data = await this.service.employeesSummary();
    if (format === 'excel') {
      await sendExcel(res!, 'hr-employees-summary', ['القسم', 'عدد الموظفين'],
        data.byDepartment.map((r) => [r.departmentAr, r.count]),
      );
      return;
    }
    return data;
  }

  @Get('turnover')
  @Permission('employees:read')
  @ApiOperation({ summary: 'الدوران الوظيفي — معدل التعيين والإنهاء شهرياً' })
  @ApiQuery({ name: 'year', required: false })
  @ApiQuery({ name: 'format', required: false, enum: ['json', 'excel'] })
  async turnover(
    @Query('year') year?: string,
    @Query('format') format?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const data = await this.service.turnover(year ? parseInt(year) : new Date().getFullYear());
    if (format === 'excel') {
      await sendExcel(res!, `hr-turnover-${data.year}`, ['الشهر', 'موظفون جدد', 'إنهاء خدمة'],
        data.hired.map((h) => {
          const t = data.terminated.find((x) => String(x.month) === String(h.month));
          return [h.month, h.count, t?.count ?? 0];
        }),
      );
      return;
    }
    return data;
  }

  @Get('salaries')
  @Permission('employees:read')
  @ApiOperation({ summary: 'تقرير الرواتب حسب القسم' })
  @ApiQuery({ name: 'format', required: false, enum: ['json', 'excel'] })
  async salaries(@Query('format') format?: string, @Res({ passthrough: true }) res?: Response) {
    const data = await this.service.salaries();
    if (format === 'excel') {
      await sendExcel(
        res!,
        'hr-salaries',
        ['القسم', 'عدد الموظفين', 'إجمالي الرواتب', 'متوسط الراتب', 'أدنى راتب', 'أعلى راتب', 'العملة'],
        data.map((r) => [r.departmentAr, r.employeeCount, r.totalSalary, r.avgSalary, r.minSalary, r.maxSalary, r.currency]),
      );
      return;
    }
    return data;
  }

  @Get('expiry-dates')
  @Permission('employees:read')
  @ApiOperation({ summary: 'العقود القريبة من الانتهاء' })
  @ApiQuery({ name: 'daysAhead', required: false, example: 90 })
  @ApiQuery({ name: 'format', required: false, enum: ['json', 'excel'] })
  async expiryDates(
    @Query('daysAhead') daysAhead?: string,
    @Query('format') format?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const data = await this.service.expiryDates(daysAhead ? parseInt(daysAhead) : 90);
    if (format === 'excel') {
      await sendExcel(
        res!,
        'hr-expiry-dates',
        ['رقم الموظف', 'الاسم', 'القسم', 'نوع العقد', 'تاريخ الانتهاء', 'الأيام المتبقية'],
        data.items.map((r) => [
          r.employeeNumber,
          `${r.firstNameAr} ${r.lastNameAr}`,
          r.departmentAr,
          r.contractType,
          r.contractEndDate,
          r.daysRemaining,
        ]),
      );
      return;
    }
    return data;
  }

  @Get('custodies')
  @Permission('employees:read')
  @ApiOperation({ summary: 'تقرير العهدة' })
  @ApiQuery({ name: 'format', required: false, enum: ['json', 'excel'] })
  @ApiQuery({ name: 'status', required: false, enum: ['ACTIVE', 'RETURNED', 'ALL'] })
  @ApiQuery({ name: 'departmentId', required: false })
  async custodies(
    @Query('format') format?: string,
    @Query('status') status?: string,
    @Query('departmentId') departmentId?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const data = await this.service.custodies(status, departmentId);
    if (format === 'excel') {
      await sendExcel(
        res!,
        'hr-custodies',
        ['رقم الموظف', 'اسم الموظف', 'القسم', 'اسم العهدة', 'الفئة', 'تاريخ الاستلام', 'الحالة', 'تاريخ الإرجاع', 'ملاحظات'],
        data.map((r: any) => [
          r.employeeNumber,
          r.employeeNameAr,
          r.departmentAr,
          r.custodyName,
          r.category ?? '',
          r.handedOverAt ? new Date(r.handedOverAt).toLocaleDateString('ar-SA') : '',
          r.status === 'WITH_EMPLOYEE' ? 'نشط' : 'مُرجع',
          r.returnedAt ? new Date(r.returnedAt).toLocaleDateString('ar-SA') : '',
          r.notes ?? '',
        ]),
      );
      return;
    }
    return data;
  }
}
