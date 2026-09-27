import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { TransfersService } from './transfers.service';
import { CreateTransferDto, ReceiveTransferDto } from './dto/transfer.dto';
import { JwtAuthGuard } from '@shared/auth';
import { PermissionsGuard } from '@shared';
import { Permission } from '@shared';
import { User } from '@shared/auth/decorators/current-user.decorator';
import { PERMISSIONS } from '@shared/constants/permissions.constants';

@Controller('warehouse/transfers')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TransfersController {
  constructor(private readonly service: TransfersService) {}

  @Get()
  @Permission(PERMISSIONS.WAREHOUSE.TRANSFERS_READ)
  list(
    @Query('status') status?: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.list({
      status, warehouseId,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id')
  @Permission(PERMISSIONS.WAREHOUSE.TRANSFERS_READ)
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Permission(PERMISSIONS.WAREHOUSE.TRANSFERS_CREATE)
  create(@Body() dto: CreateTransferDto, @User() user: any) {
    return this.service.create(dto, user.userId);
  }

  @Post(':id/receive')
  @Permission(PERMISSIONS.WAREHOUSE.TRANSFERS_RECEIVE)
  receive(@Param('id') id: string, @Body() dto: ReceiveTransferDto, @User() user: any) {
    return this.service.receive(id, dto, user.userId);
  }
}
