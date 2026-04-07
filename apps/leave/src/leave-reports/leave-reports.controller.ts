import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import type { Response } from 'express';
import { LeaveReportsService } from './leave-reports.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permission } from '../common/decorators/permission.decorator';
import { sendCsv } from '../common/utils/csv.util';

@ApiTags('Leave Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('reports/leave')
export class LeaveReportsController {
  constructor(private readonly service: LeaveReportsService) {}

  @Get('balances')
  @Permission('leave_balances:read_all')
  @ApiOperation({ summary: 'رصيد الإجازات لكل الموظفين' })
  @ApiQuery({ name: 'year', required: false })
  @ApiQuery({ name: 'format', required: false, enum: ['json', 'csv'] })
  async balances(
    @Query('year') year?: string,
    @Query('format') format?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const data = await this.service.balances(year ? parseInt(year) : new Date().getFullYear());
    if (format === 'csv') {
      sendCsv(
        res!,
        'leave-balances',
        ['معرف الموظف', 'نوع الإجازة', 'إجمالي الأيام', 'المستخدم', 'المتبقي', 'السنة'],
        data.details.map((r) => [r.employeeId, r.leaveTypeName, r.totalDays, r.usedDays, r.remainingDays, r.year]),
      );
      return;
    }
    return data;
  }

  @Get('distribution')
  @Permission('leave_requests:read_all')
  @ApiOperation({ summary: 'توزيع الإجازات المأخوذة حسب النوع والشهر' })
  @ApiQuery({ name: 'year', required: false })
  @ApiQuery({ name: 'format', required: false, enum: ['json', 'csv'] })
  async distribution(
    @Query('year') year?: string,
    @Query('format') format?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const data = await this.service.distribution(year ? parseInt(year) : new Date().getFullYear());
    if (format === 'csv') {
      sendCsv(
        res!,
        'leave-distribution',
        ['نوع الإجازة', 'عدد الطلبات', 'إجمالي الأيام'],
        data.byType.map((r) => [r.leaveTypeName, r.requestCount, r.totalDays]),
      );
      return;
    }
    return data;
  }

  @Get('summary')
  @Permission('leave_requests:read_all')
  @ApiOperation({ summary: 'ملخص طلبات الإجازة (معلقة، موافق عليها، مرفوضة)' })
  @ApiQuery({ name: 'year', required: false })
  @ApiQuery({ name: 'format', required: false, enum: ['json', 'csv'] })
  async summary(
    @Query('year') year?: string,
    @Query('format') format?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const data = await this.service.summary(year ? parseInt(year) : new Date().getFullYear());
    if (format === 'csv') {
      sendCsv(
        res!,
        'leave-summary',
        ['الحالة', 'عدد الطلبات', 'إجمالي الأيام'],
        data.byStatus.map((r) => [r.status, r.count, r.totalDays]),
      );
      return;
    }
    return data;
  }
}
