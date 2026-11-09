import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { CashBoxesService } from './cashboxes.service';
import { CreateCashBoxDto, UpdateCashBoxDto } from './dto/cashbox.dto';
import { JwtAuthGuard } from '@shared/auth';
import { PermissionsGuard } from '@shared';
import { Permission } from '@shared';
import { PERMISSIONS } from '@shared/constants/permissions.constants';

@Controller('cashbox/boxes')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CashBoxesController {
  constructor(private readonly service: CashBoxesService) {}

  @Get()
  @Permission(PERMISSIONS.CASHBOX.BOXES_READ)
  list() {
    return this.service.list();
  }

  @Get(':id')
  @Permission(PERMISSIONS.CASHBOX.BOXES_READ)
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Get(':id/balances')
  @Permission(PERMISSIONS.CASHBOX.BOXES_READ)
  getBalances(@Param('id') id: string) {
    return this.service.getBalances(id);
  }

  @Post()
  @Permission(PERMISSIONS.CASHBOX.BOXES_MANAGE)
  create(@Body() dto: CreateCashBoxDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Permission(PERMISSIONS.CASHBOX.BOXES_MANAGE)
  update(@Param('id') id: string, @Body() dto: UpdateCashBoxDto) {
    return this.service.update(id, dto);
  }

  @Post(':id/set-main')
  @Permission(PERMISSIONS.CASHBOX.BOXES_MANAGE)
  setMain(@Param('id') id: string) {
    return this.service.setMain(id);
  }
}
