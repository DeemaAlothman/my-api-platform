import { Module } from '@nestjs/common';
import { SyncService } from './sync.service';
import { MissingStampsCron } from './missing-stamps.cron';
import { RetryFailedCron } from './retry-failed.cron';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  providers: [SyncService, MissingStampsCron, RetryFailedCron, PrismaService],
  exports: [SyncService],
})
export class SyncModule {}
