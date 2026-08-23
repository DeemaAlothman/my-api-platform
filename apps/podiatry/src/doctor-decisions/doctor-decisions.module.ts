import { Module } from '@nestjs/common';
import { DoctorDecisionsService } from './doctor-decisions.service';
import { DoctorDecisionsController } from './doctor-decisions.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [DoctorDecisionsController],
  providers: [DoctorDecisionsService, PrismaService],
})
export class DoctorDecisionsModule {}
