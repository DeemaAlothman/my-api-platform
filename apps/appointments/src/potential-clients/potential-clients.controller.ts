import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { PotentialClientsService } from './potential-clients.service';
import {
  CreatePotentialClientDto, UpdatePotentialClientDto, ListPotentialClientsQueryDto,
  ExportPotentialClientsQueryDto,
} from './dto/potential-client.dto';
import { JwtAuthGuard } from '@shared/auth';
import { PermissionsGuard } from '@shared/guards/permissions.guard';
import { Permission } from '@shared/decorators/permission.decorator';
import { PERMISSIONS } from '@shared/constants/permissions.constants';
import { User } from '@shared/auth/decorators/current-user.decorator';

@Controller('appointments/potential-clients')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PotentialClientsController {
  constructor(private readonly service: PotentialClientsService) {}

  @Post()
  @Permission(PERMISSIONS.CLINIC_POTENTIAL_CLIENTS.CREATE)
  create(@Body() dto: CreatePotentialClientDto, @User() user: any) {
    return this.service.create(dto, user.userId);
  }

  @Get()
  @Permission(PERMISSIONS.CLINIC_POTENTIAL_CLIENTS.VIEW)
  findAll(@Query() query: ListPotentialClientsQueryDto) {
    return this.service.findAll(query);
  }

  // قبل :id حتى ما ينفهم services / export-xlsx كمعرّف
  @Get('services')
  @Permission(PERMISSIONS.CLINIC_POTENTIAL_CLIENTS.VIEW)
  findServices() {
    return this.service.findServices();
  }

  @Get('export-xlsx')
  @Permission(PERMISSIONS.CLINIC_POTENTIAL_CLIENTS.VIEW)
  exportXlsx(@Query() query: ExportPotentialClientsQueryDto, @Res() res: Response) {
    return this.service.exportXlsx(query, res);
  }

  @Get(':id')
  @Permission(PERMISSIONS.CLINIC_POTENTIAL_CLIENTS.VIEW)
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Put(':id')
  @Permission(PERMISSIONS.CLINIC_POTENTIAL_CLIENTS.EDIT)
  update(@Param('id') id: string, @Body() dto: UpdatePotentialClientDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Permission(PERMISSIONS.CLINIC_POTENTIAL_CLIENTS.DELETE)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
