import { Module } from '@nestjs/common';
import { DailyClosureService } from './daily-closure.service';
import { DailyClosureController } from './daily-closure.controller';
import { BackfillService } from './backfill.service';
import { PrismaService } from '../prisma/prisma.service';
import { ContinuousWorkService } from '../common/services/continuous-work.service';
import { PunchValidatorService } from '../common/services/punch-validator.service';
import { AttendanceComputationService } from '../common/services/attendance-computation.service';

@Module({
  controllers: [DailyClosureController],
  providers: [
    DailyClosureService,
    BackfillService,
    PrismaService,
    ContinuousWorkService,
    PunchValidatorService,
    AttendanceComputationService,
  ],
  exports: [
    DailyClosureService,
    BackfillService,
    ContinuousWorkService,
    PunchValidatorService,
    AttendanceComputationService,
  ],
})
export class DailyClosureModule {}
