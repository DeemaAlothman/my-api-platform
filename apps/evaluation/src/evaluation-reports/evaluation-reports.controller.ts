import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import type { Response } from 'express';
import { EvaluationReportsService } from './evaluation-reports.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { sendCsv } from '../common/utils/csv.util';

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
  @ApiQuery({ name: 'format', required: false, enum: ['json', 'csv'] })
  async gradeDistribution(
    @Query('periodId') periodId?: string,
    @Query('format') format?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const data = await this.service.gradeDistribution(periodId);
    if (format === 'csv') {
      sendCsv(
        res!,
        'evaluation-grade-distribution',
        ['التقييم', 'العدد'],
        data.byRating.map((r) => [r.rating, r.count]),
      );
      return;
    }
    return data;
  }

  @Get('department-comparison')
  @Permissions('evaluation:forms:view-all')
  @ApiOperation({ summary: 'مقارنة متوسط أداء الأقسام' })
  @ApiQuery({ name: 'periodId', required: false })
  @ApiQuery({ name: 'format', required: false, enum: ['json', 'csv'] })
  async departmentComparison(
    @Query('periodId') periodId?: string,
    @Query('format') format?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const data = await this.service.departmentComparison(periodId);
    if (format === 'csv') {
      sendCsv(
        res!,
        'evaluation-department-comparison',
        ['القسم', 'عدد التقييمات', 'متوسط النتيجة', 'متوسط التقييم الذاتي', 'متوسط تقييم المدير'],
        data.departments.map((r) => [
          r.departmentName,
          r.evaluationCount,
          r.avgScore ?? '',
          r.avgSelfScore ?? '',
          r.avgManagerScore ?? '',
        ]),
      );
      return;
    }
    return data;
  }

  @Get('recommendations')
  @Permissions('evaluation:forms:view-all')
  @ApiOperation({ summary: 'الموظفون الحاصلون على توصيات HR' })
  @ApiQuery({ name: 'periodId', required: false })
  @ApiQuery({ name: 'format', required: false, enum: ['json', 'csv'] })
  async recommendations(
    @Query('periodId') periodId?: string,
    @Query('format') format?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const data = await this.service.recommendations(periodId);
    if (format === 'csv') {
      sendCsv(
        res!,
        'evaluation-recommendations',
        ['رقم الموظف', 'الاسم', 'القسم', 'النتيجة النهائية', 'التقييم', 'التوصية'],
        data.items.map((r) => [
          r.employeeNumber,
          `${r.firstNameAr} ${r.lastNameAr}`,
          r.departmentName ?? '',
          r.finalScore ?? '',
          r.finalRating ?? '',
          r.hrRecommendation,
        ]),
      );
      return;
    }
    return data;
  }
}
