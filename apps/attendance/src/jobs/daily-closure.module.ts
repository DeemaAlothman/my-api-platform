import { Module } from '@nestjs/common';
import { DailyClosureService } from './daily-closure.service';
import { DailyClosureController } from './daily-closure.controller';
import { BackfillService } from './backfill.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [DailyClosureController],
  providers: [DailyClosureService, BackfillService, PrismaService],
  exports: [DailyClosureService, BackfillService],
})
export class DailyClosureModule {}
