import { Module } from '@nestjs/common';
import { InterviewCriteriaController } from './interview-criteria.controller';
import { InterviewCriteriaService } from './interview-criteria.service';

@Module({
  controllers: [InterviewCriteriaController],
  providers: [InterviewCriteriaService],
  exports: [InterviewCriteriaService],
})
export class InterviewCriteriaModule {}
