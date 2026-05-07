import { Module } from '@nestjs/common';
import { EvaluationPeriodsController } from './evaluation-periods.controller';
import { EvaluationPeriodsService } from './evaluation-periods.service';

@Module({
  imports: [],
  controllers: [EvaluationPeriodsController],
  providers: [EvaluationPeriodsService],
  exports: [EvaluationPeriodsService],
})
export class EvaluationPeriodsModule {}
