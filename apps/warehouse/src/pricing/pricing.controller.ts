import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { UpsertProstheticsPricingSettingsDto } from './dto/pricing.dto';
import { JwtAuthGuard } from '@shared/auth';
import { PermissionsGuard } from '@shared';
import { Permission } from '@shared';
import { User } from '@shared/auth/decorators/current-user.decorator';
import { PERMISSIONS } from '@shared/constants/permissions.constants';

// إعداد عام واحد (singleton) — يُطبَّق على كل قطع الأطراف الصناعية (أي صنف عنده partCode)
@Controller('warehouse/pricing/prosthetics/settings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PricingController {
  constructor(private readonly service: PricingService) {}

  @Get()
  @Permission(PERMISSIONS.WAREHOUSE.PRICING_PROSTHETICS_VIEW)
  getSettings() {
    return this.service.getSettings();
  }

  @Put()
  @Permission(PERMISSIONS.WAREHOUSE.PRICING_PROSTHETICS_MANAGE)
  upsertSettings(@Body() dto: UpsertProstheticsPricingSettingsDto, @User() user: any) {
    return this.service.upsertSettings(dto, user.userId);
  }
}
