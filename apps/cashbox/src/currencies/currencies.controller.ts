import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { CurrenciesService } from './currencies.service';
import { CreateCurrencyDto } from './dto/currency.dto';
import { JwtAuthGuard } from '@shared/auth';
import { PermissionsGuard } from '@shared';
import { Permission } from '@shared';
import { PERMISSIONS } from '@shared/constants/permissions.constants';

@Controller('cashbox/currencies')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CurrenciesController {
  constructor(private readonly service: CurrenciesService) {}

  @Get()
  @Permission(PERMISSIONS.CASHBOX.BOXES_READ)
  list() {
    return this.service.listCurrencies();
  }

  @Post()
  @Permission(PERMISSIONS.CASHBOX.BOXES_MANAGE)
  create(@Body() dto: CreateCurrencyDto) {
    return this.service.createCurrency(dto.code, dto.name);
  }
}
