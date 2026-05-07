import { Module } from '@nestjs/common';
import { EvaluationCriteriaController } from './evaluation-criteria.controller';
import { EvaluationCriteriaService } from './evaluation-criteria.service';

@Module({
  imports: [],
  controllers: [EvaluationCriteriaController],
  providers: [EvaluationCriteriaService],
  exports: [EvaluationCriteriaService],
})
export class EvaluationCriteriaModule {}
