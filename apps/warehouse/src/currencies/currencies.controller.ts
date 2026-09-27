import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { CurrenciesService } from './currencies.service';
import { CreateCurrencyDto, SetExchangeRateDto } from './dto/currency.dto';
import { JwtAuthGuard } from '@shared/auth';
import { PermissionsGuard } from '@shared';
import { Permission } from '@shared';
import { User } from '@shared/auth/decorators/current-user.decorator';
import { PERMISSIONS } from '@shared/constants/permissions.constants';

@Controller('warehouse/currencies')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CurrenciesController {
  constructor(private readonly service: CurrenciesService) {}

  @Get()
  @Permission(PERMISSIONS.WAREHOUSE.CURRENCIES_READ)
  list() {
    return this.service.listCurrencies();
  }

  @Post()
  @Permission(PERMISSIONS.WAREHOUSE.CURRENCIES_MANAGE)
  create(@Body() dto: CreateCurrencyDto) {
    return this.service.createCurrency(dto);
  }

  @Post(':id/set-base')
  @Permission(PERMISSIONS.WAREHOUSE.CURRENCIES_MANAGE)
  setBase(@Param('id') id: string) {
    return this.service.setBaseCurrency(id);
  }

  @Get(':id/exchange-rates')
  @Permission(PERMISSIONS.WAREHOUSE.CURRENCIES_READ)
  listRates(@Param('id') id: string) {
    return this.service.listExchangeRates(id);
  }

  @Post(':id/exchange-rates')
  @Permission(PERMISSIONS.WAREHOUSE.CURRENCIES_MANAGE)
  addRate(@Param('id') id: string, @Body() dto: SetExchangeRateDto, @User() user: any) {
    return this.service.addExchangeRate(id, dto, user.userId);
  }
}
