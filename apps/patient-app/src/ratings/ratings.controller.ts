import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { PatientJwtAuthGuard } from '../patient-auth/guards/patient-jwt-auth.guard';
import { CurrentPatient } from '../patient-auth/decorators/current-patient.decorator';
import { RatingsService } from './ratings.service';
import { CreateRatingDto } from './dto/rating.dto';

@Controller('patient-app/me/sessions')
@UseGuards(PatientJwtAuthGuard)
export class RatingsController {
  constructor(private readonly service: RatingsService) {}

  @Post(':erpSessionId/rating')
  create(
    @Param('erpSessionId') erpSessionId: string,
    @Body() dto: CreateRatingDto,
    @CurrentPatient() patient: { patientAccountId: string; erpPatientId: string },
  ) {
    return this.service.create(patient.erpPatientId, patient.patientAccountId, erpSessionId, dto);
  }
}
