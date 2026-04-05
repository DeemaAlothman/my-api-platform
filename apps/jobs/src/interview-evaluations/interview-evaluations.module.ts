import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { InterviewEvaluationsController } from './interview-evaluations.controller';
import { InterviewEvaluationsService } from './interview-evaluations.service';

@Module({
  imports: [HttpModule],
  controllers: [InterviewEvaluationsController],
  providers: [InterviewEvaluationsService],
})
export class InterviewEvaluationsModule {}
