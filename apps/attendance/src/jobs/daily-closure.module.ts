import { Module } from '@nestjs/common';
import { DailyClosureService } from './daily-closure.service';
import { DailyClosureController } from './daily-closure.controller';
import { BackfillService } from './backfill.service';
import { BackfillController } from './backfill.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [DailyClosureController, BackfillController],
  providers: [DailyClosureService, BackfillService, PrismaService],
  exports: [DailyClosureService, BackfillService],
})
export class DailyClosureModule {}
