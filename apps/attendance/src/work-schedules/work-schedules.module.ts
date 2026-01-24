import { Module } from '@nestjs/common';
import { WorkSchedulesController } from './work-schedules.controller';
import { WorkSchedulesService } from './work-schedules.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [WorkSchedulesController],
  providers: [WorkSchedulesService, PrismaService],
  exports: [WorkSchedulesService],
})
export class WorkSchedulesModule {}
