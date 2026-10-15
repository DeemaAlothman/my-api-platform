import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ReceptionsService } from './receptions.service';
import { CreateReceptionDto } from './dto/create-reception.dto';
import { UpdateReceptionDto } from './dto/update-reception.dto';
import { DoctorAssessmentDto } from './dto/doctor-assessment.dto';
import { PhysioAssessmentDto } from './dto/physio-assessment.dto';
import { ProsthetistOpinionDto } from './dto/prosthetist-opinion.dto';
import { AssignPractitionersDto } from './dto/assign-practitioners.dto';
import { JwtAuthGuard, User } from '@shared/auth';
import { PermissionsGuard, Permission, PERMISSIONS } from '@shared';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('orthotics/receptions')
export class ReceptionsController {
  constructor(private readonly service: ReceptionsService) {}

  @Permission(PERMISSIONS.CLINIC_ORTHOTICS.CREATE)
  @Post()
  create(@Body() dto: CreateReceptionDto, @User() user: any) {
    return this.service.create(dto, user.userId);
  }

  @Permission(PERMISSIONS.CLINIC_ORTHOTICS.VIEW)
  @Get()
  findAll(@Query('patientId') patientId?: string) {
    return this.service.findAll(patientId);
  }

  // قبل :id حتى ما تنبلع كمعرّف
  @Permission(PERMISSIONS.CLINIC_ORTHOTICS.VIEW)
  @Get('my-patients')
  async findMyPatients(@User() user: any) {
    const practitionerId = await this.service.resolveEmployeeIdByUserId(user.userId);
    if (!practitionerId) return [];
    return this.service.findMyPatients(practitionerId);
  }

  @Permission(PERMISSIONS.CLINIC_ORTHOTICS.VIEW)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Permission(PERMISSIONS.CLINIC_ORTHOTICS.EDIT)
  @Patch(':id/practitioners')
  assignPractitioners(@Param('id') id: string, @Body() dto: AssignPractitionersDto) {
    return this.service.assignPractitioners(id, dto);
  }

  @Permission(PERMISSIONS.CLINIC_ORTHOTICS.DOCTOR_ASSESSMENT_EDIT)
  @Patch(':id/doctor-assessment')
  upsertDoctorAssessment(@Param('id') id: string, @Body() dto: DoctorAssessmentDto, @User() user: any) {
    return this.service.upsertDoctorAssessment(id, dto, user.userId);
  }

  @Permission(PERMISSIONS.CLINIC_ORTHOTICS.PHYSIO_ASSESSMENT_EDIT)
  @Patch(':id/physio-assessment')
  upsertPhysioAssessment(@Param('id') id: string, @Body() dto: PhysioAssessmentDto, @User() user: any) {
    return this.service.upsertPhysioAssessment(id, dto, user.userId);
  }

  @Permission(PERMISSIONS.CLINIC_ORTHOTICS.PROSTHETIST_OPINION_EDIT)
  @Patch(':id/prosthetist-opinion')
  upsertProsthetistOpinion(@Param('id') id: string, @Body() dto: ProsthetistOpinionDto) {
    return this.service.upsertProsthetistOpinion(id, dto);
  }

  @Permission(PERMISSIONS.CLINIC_ORTHOTICS.EDIT)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateReceptionDto) {
    return this.service.update(id, dto);
  }

  @Permission(PERMISSIONS.CLINIC_ORTHOTICS.DELETE)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
