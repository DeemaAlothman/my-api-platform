import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '@shared/auth';
import { PermissionsGuard } from '@shared/guards/permissions.guard';
import { Permission } from '@shared/decorators/permission.decorator';
import { PERMISSIONS } from '@shared/constants/permissions.constants';

@Controller('prosthetics/reports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get('donor')
  @Permission(PERMISSIONS.CLINIC_REPORTS.VIEW_DONOR)
  getDonorReport(@Query('from') from?: string, @Query('to') to?: string) {
    return this.service.getDonorReport(from, to);
  }

  @Get('donor/pdf')
  @Permission(PERMISSIONS.CLINIC_REPORTS.VIEW_DONOR)
  async getDonorReportPdf(
    @Query('from') from: string,
    @Query('to') to: string,
    @Res() res: Response,
  ) {
    const buffer = await this.service.getDonorReportPdf(from, to);
    const filename = `donor-report-${new Date().toISOString().slice(0, 10)}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }
}
