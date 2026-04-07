import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { LeaveReportsService } from './leave-reports.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permission } from '../common/decorators/permission.decorator';

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
  balances(@Query('year') year?: string) {
    return this.service.balances(year ? parseInt(year) : new Date().getFullYear());
  }

  @Get('distribution')
  @Permission('leave_requests:read_all')
  @ApiOperation({ summary: 'توزيع الإجازات المأخوذة حسب النوع والشهر' })
  @ApiQuery({ name: 'year', required: false })
  distribution(@Query('year') year?: string) {
    return this.service.distribution(year ? parseInt(year) : new Date().getFullYear());
  }

  @Get('summary')
  @Permission('leave_requests:read_all')
  @ApiOperation({ summary: 'ملخص طلبات الإجازة (معلقة، موافق عليها، مرفوضة)' })
  @ApiQuery({ name: 'year', required: false })
  summary(@Query('year') year?: string) {
    return this.service.summary(year ? parseInt(year) : new Date().getFullYear());
  }
}
