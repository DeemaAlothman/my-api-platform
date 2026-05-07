import { Module } from '@nestjs/common';
import { EvaluationReportsController } from './evaluation-reports.controller';
import { EvaluationReportsService } from './evaluation-reports.service';

@Module({
  imports: [],
  controllers: [EvaluationReportsController],
  providers: [EvaluationReportsService],
})
export class EvaluationReportsModule {}
