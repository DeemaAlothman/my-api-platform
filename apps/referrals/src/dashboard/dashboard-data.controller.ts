import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@shared/auth';
import { SourcesService } from '../sources/sources.service';

// بوكس "المبيعات" بداشبورد المدير التنفيذي — بدون أي حاجة لصلاحية clinic.referrals.view
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardDataController {
  constructor(private readonly sourcesService: SourcesService) {}

  @Get('data')
  async getData(@Query('role') role: string) {
    if (role !== 'CEO') return {};
    return this.sourcesService.getCeoSalesSummary();
  }
}
