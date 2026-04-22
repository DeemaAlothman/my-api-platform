import { Module } from '@nestjs/common';
import { DailyClosureService } from './daily-closure.service';
import { DailyClosureController } from './daily-closure.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [DailyClosureController],
  providers: [DailyClosureService, PrismaService],
  exports: [DailyClosureService],
})
export class DailyClosureModule {}
