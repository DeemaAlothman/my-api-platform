import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { EvaluationReportsService } from './evaluation-reports.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permissions } from '../common/decorators/permissions.decorator';

@ApiTags('Evaluation Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('reports/evaluation')
export class EvaluationReportsController {
  constructor(private readonly service: EvaluationReportsService) {}

  @Get('grade-distribution')
  @Permissions('evaluation:forms:view-all')
  @ApiOperation({ summary: 'توزيع درجات التقييم النهائية' })
  @ApiQuery({ name: 'periodId', required: false })
  gradeDistribution(@Query('periodId') periodId?: string) {
    return this.service.gradeDistribution(periodId);
  }

  @Get('department-comparison')
  @Permissions('evaluation:forms:view-all')
  @ApiOperation({ summary: 'مقارنة متوسط أداء الأقسام' })
  @ApiQuery({ name: 'periodId', required: false })
  departmentComparison(@Query('periodId') periodId?: string) {
    return this.service.departmentComparison(periodId);
  }

  @Get('recommendations')
  @Permissions('evaluation:forms:view-all')
  @ApiOperation({ summary: 'الموظفون الحاصلون على توصيات HR' })
  @ApiQuery({ name: 'periodId', required: false })
  recommendations(@Query('periodId') periodId?: string) {
    return this.service.recommendations(periodId);
  }
}
