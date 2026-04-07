import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { HrReportsService } from './hr-reports.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permission } from '../common/decorators/permission.decorator';

@ApiTags('HR Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('reports/hr')
export class HrReportsController {
  constructor(private readonly service: HrReportsService) {}

  @Get('employees-summary')
  @Permission('employees:read')
  @ApiOperation({ summary: 'توزيع الموظفين حسب القسم والجنس والجنسية ونوع العقد' })
  employeesSummary() {
    return this.service.employeesSummary();
  }

  @Get('turnover')
  @Permission('employees:read')
  @ApiOperation({ summary: 'الدوران الوظيفي — معدل التعيين والإنهاء شهرياً' })
  @ApiQuery({ name: 'year', required: false, example: new Date().getFullYear() })
  turnover(@Query('year') year?: string) {
    return this.service.turnover(year ? parseInt(year) : new Date().getFullYear());
  }

  @Get('salaries')
  @Permission('employees:read')
  @ApiOperation({ summary: 'تقرير الرواتب حسب القسم' })
  salaries() {
    return this.service.salaries();
  }

  @Get('expiry-dates')
  @Permission('employees:read')
  @ApiOperation({ summary: 'العقود القريبة من الانتهاء' })
  @ApiQuery({ name: 'daysAhead', required: false, example: 90 })
  expiryDates(@Query('daysAhead') daysAhead?: string) {
    return this.service.expiryDates(daysAhead ? parseInt(daysAhead) : 90);
  }
}
