import { Module } from '@nestjs/common';
import { PatientsController, PatientsInternalController } from './patients.controller';
import { PatientsService } from './patients.service';
import { SurveysService } from '../surveys/surveys.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [PatientsController, PatientsInternalController],
  providers: [PatientsService, SurveysService, PrismaService],
  exports: [PatientsService],
})
export class PatientsModule {}
