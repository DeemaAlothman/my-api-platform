import { Controller, Get, Post, Put, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ReceptionsService } from './receptions.service';
import { CreateReceptionDto } from './dto/create-reception.dto';
import { UpdateReceptionDto } from './dto/update-reception.dto';
import { ComplaintDto, MedicalHistoryDto } from './dto/complaint.dto';
import { JwtAuthGuard, User } from '@shared/auth';
import { PermissionsGuard, Permission, PERMISSIONS } from '@shared';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('podiatry/receptions')
export class ReceptionsController {
  constructor(private readonly service: ReceptionsService) {}

  @Permission(PERMISSIONS.CLINIC_PODIATRY.RECEPTION_CREATE)
  @Post()
  create(@Body() dto: CreateReceptionDto, @User() user: any) {
    return this.service.create(dto, user.userId);
  }

  @Permission(PERMISSIONS.CLINIC_PODIATRY.RECEPTION_VIEW)
  @Get()
  findAll(@Query('patientId') patientId?: string) {
    return this.service.findAll(patientId);
  }

  @Permission(PERMISSIONS.CLINIC_PODIATRY.RECEPTION_VIEW)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Permission(PERMISSIONS.CLINIC_PODIATRY.RECEPTION_EDIT)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateReceptionDto) {
    return this.service.update(id, dto);
  }

  @Permission(PERMISSIONS.CLINIC_PODIATRY.RECEPTION_EDIT)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  // ── الشكوى المرضية ────────────────────────────────────────────────────────

  @Permission(PERMISSIONS.CLINIC_PODIATRY.RECEPTION_EDIT)
  @Post(':id/complaint')
  upsertComplaint(@Param('id') id: string, @Body() dto: ComplaintDto) {
    return this.service.upsertComplaint(id, dto);
  }

  @Permission(PERMISSIONS.CLINIC_PODIATRY.RECEPTION_EDIT)
  @Put(':id/complaint')
  updateComplaint(@Param('id') id: string, @Body() dto: ComplaintDto) {
    return this.service.upsertComplaint(id, dto);
  }

  // ── التاريخ الطبي ─────────────────────────────────────────────────────────

  @Permission(PERMISSIONS.CLINIC_PODIATRY.RECEPTION_EDIT)
  @Post(':id/medical-history')
  upsertMedicalHistory(@Param('id') id: string, @Body() dto: MedicalHistoryDto) {
    return this.service.upsertMedicalHistory(id, dto);
  }

  @Permission(PERMISSIONS.CLINIC_PODIATRY.RECEPTION_EDIT)
  @Put(':id/medical-history')
  updateMedicalHistory(@Param('id') id: string, @Body() dto: MedicalHistoryDto) {
    return this.service.upsertMedicalHistory(id, dto);
  }
}
