import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { PatientJwtAuthGuard } from '../patient-auth/guards/patient-jwt-auth.guard';
import { CurrentPatient } from '../patient-auth/decorators/current-patient.decorator';
import { MeService } from './me.service';
import { CompleteExerciseDto, SkipExerciseDto } from './dto/me.dto';

@Controller('patient-app/me')
@UseGuards(PatientJwtAuthGuard)
export class MeController {
  constructor(private readonly service: MeService) {}

  @Get('profile')
  getProfile(@CurrentPatient() patient: CurrentPatient) {
    return this.service.getProfile(patient.patientAccountId, patient.erpPatientId);
  }

  @Get('appointments')
  getAppointments(@CurrentPatient() patient: CurrentPatient) {
    return this.service.getAppointments(patient.erpPatientId);
  }

  @Get('sessions/:erpSessionId/exercises')
  listSessionExercises(@Param('erpSessionId') erpSessionId: string, @CurrentPatient() patient: CurrentPatient) {
    return this.service.listSessionExercises(patient.erpPatientId, erpSessionId, patient.patientAccountId);
  }

  @Get('skip-reasons')
  listSkipReasons() {
    return this.service.listSkipReasons();
  }

  @Post('exercises/:assignmentId/start')
  start(@Param('assignmentId') assignmentId: string, @CurrentPatient() patient: CurrentPatient) {
    return this.service.start(assignmentId, patient.erpPatientId, patient.patientAccountId);
  }

  @Post('exercises/:assignmentId/complete')
  complete(
    @Param('assignmentId') assignmentId: string,
    @Body() dto: CompleteExerciseDto,
    @CurrentPatient() patient: CurrentPatient,
  ) {
    return this.service.complete(assignmentId, patient.erpPatientId, patient.patientAccountId, dto);
  }

  @Post('exercises/:assignmentId/skip')
  skip(
    @Param('assignmentId') assignmentId: string,
    @Body() dto: SkipExerciseDto,
    @CurrentPatient() patient: CurrentPatient,
  ) {
    return this.service.skip(assignmentId, patient.erpPatientId, patient.patientAccountId, dto);
  }

  @Get('progress')
  getProgress(@CurrentPatient() patient: CurrentPatient) {
    return this.service.getProgress(patient.erpPatientId, patient.patientAccountId);
  }
}
