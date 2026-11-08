import { Controller, Get, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { ListProstheticsPricingQueryDto, UpsertItemMarkupDto } from './dto/pricing.dto';
import { JwtAuthGuard } from '@shared/auth';
import { PermissionsGuard } from '@shared';
import { Permission } from '@shared';
import { User } from '@shared/auth/decorators/current-user.decorator';
import { PERMISSIONS } from '@shared/constants/permissions.constants';

@Controller('warehouse/pricing/prosthetics')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PricingController {
  constructor(private readonly service: PricingService) {}

  @Get()
  @Permission(PERMISSIONS.WAREHOUSE.PRICING_PROSTHETICS_VIEW)
  list(@Query() query: ListProstheticsPricingQueryDto) {
    return this.service.listProstheticsPricing(query);
  }

  @Put(':itemId')
  @Permission(PERMISSIONS.WAREHOUSE.PRICING_PROSTHETICS_MANAGE)
  upsertMarkup(@Param('itemId') itemId: string, @Body() dto: UpsertItemMarkupDto, @User() user: any) {
    return this.service.upsertMarkup(itemId, dto, user.userId);
  }
}
