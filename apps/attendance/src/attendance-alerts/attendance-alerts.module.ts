import { Module } from '@nestjs/common';
import { AttendanceAlertsController } from './attendance-alerts.controller';
import { AttendanceAlertsService } from './attendance-alerts.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [AttendanceAlertsController],
  providers: [AttendanceAlertsService, PrismaService],
  exports: [AttendanceAlertsService],
})
export class AttendanceAlertsModule {}
