import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ReceptionsService } from './receptions.service';
import { CreateReceptionDto } from './dto/create-reception.dto';
import { UpdateReceptionDto } from './dto/update-reception.dto';
import { AssignPractitionersDto } from './dto/assign-practitioners.dto';
import { JwtAuthGuard, User } from '@shared/auth';
import { PermissionsGuard, Permission, PERMISSIONS, InternalAuthGuard } from '@shared';

// نقطة داخلية (خدمة-لخدمة): تحويل حالة معاينة طبيب (من خدمة physio) إلى استقبال طب أقدام جديد
@Controller('podiatry/receptions/internal')
export class ReceptionsInternalController {
  constructor(private readonly service: ReceptionsService) {}

  @Post('from-exam')
  @UseGuards(InternalAuthGuard)
  createFromExam(@Body() body: { patientId: string; podiatristId?: string; createdBy?: string }) {
    return this.service.createFromExam(body.patientId, body.podiatristId, body.createdBy);
  }
}

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
  @Get('my-patients')
  async findMyPatients(@User() user: any) {
    const practitionerId = await this.service.resolveEmployeeIdByUserId(user.userId);
    if (!practitionerId) return [];
    return this.service.findMyPatients(practitionerId);
  }

  @Permission(PERMISSIONS.CLINIC_PODIATRY.RECEPTION_VIEW)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Permission(PERMISSIONS.CLINIC_PODIATRY.RECEPTION_EDIT)
  @Patch(':id/practitioners')
  assignPractitioners(@Param('id') id: string, @Body() dto: AssignPractitionersDto) {
    return this.service.assignPractitioners(id, dto);
  }

  @Permission(PERMISSIONS.CLINIC_PODIATRY.NOTIFY_INCOMPLETE_FORM)
  @Post(':id/notify-incomplete-form')
  notifyIncompleteForm(@Param('id') id: string) {
    return this.service.notifyIncompleteForm(id);
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

}
