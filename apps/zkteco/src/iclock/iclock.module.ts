import { Module } from '@nestjs/common';
import { IclockController } from './iclock.controller';
import { IclockService } from './iclock.service';
import { PrismaService } from '../prisma/prisma.service';
import { DeviceModule } from '../device/device.module';
import { SyncModule } from '../sync/sync.module';

@Module({
  imports: [DeviceModule, SyncModule],
  controllers: [IclockController],
  providers: [IclockService, PrismaService],
})
export class IclockModule {}
