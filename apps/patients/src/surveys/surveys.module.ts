import { Module } from '@nestjs/common';
import { SurveysController } from './surveys.controller';
import { SurveysService } from './surveys.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [SurveysController],
  providers: [SurveysService, PrismaService],
})
export class SurveysModule {}
