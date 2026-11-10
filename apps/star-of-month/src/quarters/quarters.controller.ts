import { Controller, Get, Post, Body, Param, ParseIntPipe, UseGuards, Res } from '@nestjs/common';
import type { Response } from 'express';
import { QuartersService } from './quarters.service';
import { QuarterTieBreakDto } from './dto/quarter.dto';
import { JwtAuthGuard } from '@shared/auth';
import { PermissionsGuard } from '@shared';
import { Permission } from '@shared';
import { PERMISSIONS } from '@shared/constants/permissions.constants';

@Controller('star-of-month/quarters')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class QuartersController {
  constructor(private readonly service: QuartersService) {}

  @Get(':year/:quarter')
  @Permission(PERMISSIONS.STAR_OF_MONTH.VIEW)
  getQuarter(@Param('year', ParseIntPipe) year: number, @Param('quarter', ParseIntPipe) quarter: number) {
    return this.service.getQuarter(year, quarter);
  }

  // حساب يدوي — عادةً تلقائي من cron يومي، متاح هون لإعادة المحاولة أو الاختبار
  @Post(':year/:quarter/:company/compute')
  @Permission(PERMISSIONS.STAR_OF_MONTH.NOMINATE)
  compute(
    @Param('year', ParseIntPipe) year: number,
    @Param('quarter', ParseIntPipe) quarter: number,
    @Param('company') company: string,
  ) {
    return this.service.computeQuarter(year, quarter, company);
  }

  @Post(':year/:quarter/tie-break')
  @Permission(PERMISSIONS.STAR_OF_MONTH.NOMINATE)
  tieBreak(
    @Param('year', ParseIntPipe) year: number,
    @Param('quarter', ParseIntPipe) quarter: number,
    @Body() dto: QuarterTieBreakDto,
  ) {
    return this.service.tieBreak(year, quarter, dto.company, dto.employeeId);
  }

  @Get(':year/:quarter/:company/certificate')
  @Permission(PERMISSIONS.STAR_OF_MONTH.VIEW)
  async downloadCertificate(
    @Param('year', ParseIntPipe) year: number,
    @Param('quarter', ParseIntPipe) quarter: number,
    @Param('company') company: string,
    @Res() res: Response,
  ) {
    const buf = await this.service.downloadCertificate(year, quarter, company);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="star-of-quarter-${year}-Q${quarter}-${company}.pdf"`,
      'Content-Length': buf.length,
    });
    res.end(buf);
  }
}
