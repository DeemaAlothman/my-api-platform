import { Module } from '@nestjs/common';
import { EvaluationFormsController } from './evaluation-forms.controller';
import { EvaluationFormsService } from './evaluation-forms.service';

@Module({
  imports: [],
  controllers: [EvaluationFormsController],
  providers: [EvaluationFormsService],
  exports: [EvaluationFormsService],
})
export class EvaluationFormsModule {}
