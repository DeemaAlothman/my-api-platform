import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { MaterialRequestsService } from './material-requests.service';
import {
  CreateMaterialRequestDto, ApproveMaterialRequestDto, RejectMaterialRequestDto, IssueMaterialRequestDto,
} from './dto/material-request.dto';
import { JwtAuthGuard } from '@shared/auth';
import { PermissionsGuard } from '@shared';
import { Permission } from '@shared';
import { User } from '@shared/auth/decorators/current-user.decorator';
import { PERMISSIONS } from '@shared/constants/permissions.constants';

@Controller('warehouse/material-requests')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MaterialRequestsController {
  constructor(private readonly service: MaterialRequestsService) {}

  // طلباتي أنا فقط — قبل :id لتفادي التقاطها كمعرّف
  @Get('my')
  @Permission(PERMISSIONS.WAREHOUSE.MATERIAL_REQUESTS_READ_OWN)
  listMine(@User() user: any) {
    return this.service.listMine(user.userId);
  }

  @Get()
  @Permission(PERMISSIONS.WAREHOUSE.MATERIAL_REQUESTS_READ)
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
  @Permission(PERMISSIONS.WAREHOUSE.MATERIAL_REQUESTS_READ, PERMISSIONS.WAREHOUSE.MATERIAL_REQUESTS_READ_OWN)
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Permission(PERMISSIONS.WAREHOUSE.MATERIAL_REQUESTS_CREATE)
  create(@Body() dto: CreateMaterialRequestDto, @User() user: any) {
    return this.service.create(dto, user.userId);
  }

  @Post(':id/approve')
  @Permission(PERMISSIONS.WAREHOUSE.MATERIAL_REQUESTS_APPROVE)
  approve(@Param('id') id: string, @Body() dto: ApproveMaterialRequestDto, @User() user: any) {
    return this.service.approve(id, dto, user.userId);
  }

  @Post(':id/reject')
  @Permission(PERMISSIONS.WAREHOUSE.MATERIAL_REQUESTS_APPROVE)
  reject(@Param('id') id: string, @Body() dto: RejectMaterialRequestDto) {
    return this.service.reject(id, dto);
  }

  @Post(':id/issue')
  @Permission(PERMISSIONS.WAREHOUSE.MATERIAL_REQUESTS_APPROVE)
  issue(@Param('id') id: string, @Body() dto: IssueMaterialRequestDto, @User() user: any) {
    return this.service.issue(id, dto, user.userId);
  }
}
