import { Module } from '@nestjs/common';
import { DeviceController } from './device.controller';
import { DeviceService } from './device.service';
import { ClockSyncMonitorService } from './clock-sync-monitor.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [DeviceController],
  providers: [DeviceService, ClockSyncMonitorService, PrismaService],
  exports: [DeviceService],
})
export class DeviceModule {}
