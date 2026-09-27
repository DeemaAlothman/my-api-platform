import { Controller, Get, Post, Put, Body, Param, UseGuards } from '@nestjs/common';
import { WarehousesService } from './warehouses.service';
import { CreateWarehouseDto, UpdateWarehouseDto } from './dto/warehouse.dto';
import { JwtAuthGuard } from '@shared/auth';
import { PermissionsGuard } from '@shared';
import { Permission } from '@shared';
import { PERMISSIONS } from '@shared/constants/permissions.constants';

@Controller('warehouse/warehouses')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WarehousesController {
  constructor(private readonly service: WarehousesService) {}

  @Get()
  @Permission(PERMISSIONS.WAREHOUSE.WAREHOUSES_READ)
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @Permission(PERMISSIONS.WAREHOUSE.WAREHOUSES_READ)
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Permission(PERMISSIONS.WAREHOUSE.WAREHOUSES_CREATE)
  create(@Body() dto: CreateWarehouseDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  @Permission(PERMISSIONS.WAREHOUSE.WAREHOUSES_UPDATE)
  update(@Param('id') id: string, @Body() dto: UpdateWarehouseDto) {
    return this.service.update(id, dto);
  }
}
