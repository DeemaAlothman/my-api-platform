import { Module } from '@nestjs/common';
import { AttendanceRecordsController } from './attendance-records.controller';
import { DeviceAttendanceController } from './device-attendance.controller';
import { AttendanceRecordsService } from './attendance-records.service';
import { PrismaService } from '../prisma/prisma.service';
import { WorkSchedulesModule } from '../work-schedules/work-schedules.module';
import { AttendanceAlertsModule } from '../attendance-alerts/attendance-alerts.module';
import { UnifiedComputationService } from '../common/services/unified-computation.service';

@Module({
  imports: [WorkSchedulesModule, AttendanceAlertsModule],
  controllers: [AttendanceRecordsController, DeviceAttendanceController],
  providers: [AttendanceRecordsService, PrismaService, UnifiedComputationService],
  exports: [AttendanceRecordsService],
})
export class AttendanceRecordsModule {}
