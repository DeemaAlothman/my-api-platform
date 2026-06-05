import { Module } from '@nestjs/common';
import { PatientsController, PatientsInternalController } from './patients.controller';
import { PatientsService } from './patients.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [PatientsController, PatientsInternalController],
  providers: [PatientsService, PrismaService],
  exports: [PatientsService],
})
export class PatientsModule {}
