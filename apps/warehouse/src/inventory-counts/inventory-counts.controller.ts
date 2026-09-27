import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { InventoryCountsService } from './inventory-counts.service';
import { StartInventoryCountDto, RecordCountsDto } from './dto/inventory-count.dto';
import { JwtAuthGuard } from '@shared/auth';
import { PermissionsGuard } from '@shared';
import { Permission } from '@shared';
import { User } from '@shared/auth/decorators/current-user.decorator';
import { PERMISSIONS } from '@shared/constants/permissions.constants';

@Controller('warehouse/inventory-counts')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class InventoryCountsController {
  constructor(private readonly service: InventoryCountsService) {}

  @Get()
  @Permission(PERMISSIONS.WAREHOUSE.COUNTS_READ)
  list(@Query('warehouseId') warehouseId?: string, @Query('status') status?: string) {
    return this.service.list({ warehouseId, status });
  }

  @Get(':id')
  @Permission(PERMISSIONS.WAREHOUSE.COUNTS_READ)
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Permission(PERMISSIONS.WAREHOUSE.COUNTS_CREATE)
  start(@Body() dto: StartInventoryCountDto, @User() user: any) {
    return this.service.start(dto, user.userId);
  }

  @Post(':id/record')
  @Permission(PERMISSIONS.WAREHOUSE.COUNTS_CREATE)
  record(@Param('id') id: string, @Body() dto: RecordCountsDto) {
    return this.service.recordCounts(id, dto);
  }

  @Post(':id/complete')
  @Permission(PERMISSIONS.WAREHOUSE.COUNTS_APPROVE)
  complete(@Param('id') id: string, @User() user: any) {
    return this.service.complete(id, user.userId);
  }

  @Post(':id/cancel')
  @Permission(PERMISSIONS.WAREHOUSE.COUNTS_APPROVE)
  cancel(@Param('id') id: string) {
    return this.service.cancel(id);
  }
}
