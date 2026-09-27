import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ReturnsService } from './returns.service';
import { CreateReturnDto } from './dto/return.dto';
import { JwtAuthGuard } from '@shared/auth';
import { PermissionsGuard } from '@shared';
import { Permission } from '@shared';
import { User } from '@shared/auth/decorators/current-user.decorator';
import { PERMISSIONS } from '@shared/constants/permissions.constants';

@Controller('warehouse/returns')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReturnsController {
  constructor(private readonly service: ReturnsService) {}

  @Get()
  @Permission(PERMISSIONS.WAREHOUSE.RETURNS_READ)
  list(
    @Query('returnType') returnType?: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.list({
      returnType, warehouseId,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id')
  @Permission(PERMISSIONS.WAREHOUSE.RETURNS_READ)
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Permission(PERMISSIONS.WAREHOUSE.RETURNS_CREATE)
  create(@Body() dto: CreateReturnDto, @User() user: any) {
    return this.service.create(dto, user.userId);
  }
}
