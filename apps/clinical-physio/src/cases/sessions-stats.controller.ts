import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CasesService } from './cases.service';
import { JwtAuthGuard } from '@shared/auth';
import { PermissionsGuard } from '@shared/guards/permissions.guard';
import { Permission } from '@shared/decorators/permission.decorator';
import { PERMISSIONS } from '@shared/constants/permissions.constants';

// مسار مستقل عن physio/cases: الإحصاء عن الجلسات كلها لا عن حالة بعينها، فلو
// وُضع تحت cases لصار :id يبتلع «sessions» ويُقرأ معرّفَ حالة.
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('physio/sessions')
export class SessionsStatsController {
  constructor(private readonly service: CasesService) {}

  @Permission(PERMISSIONS.CLINIC_PHYSIO.CASE_VIEW)
  @Get('stats')
  stats(@Query('dateFrom') dateFrom?: string, @Query('dateTo') dateTo?: string) {
    return this.service.getSessionsStats({ dateFrom, dateTo });
  }
}
