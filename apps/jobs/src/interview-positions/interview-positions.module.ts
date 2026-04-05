import { Module } from '@nestjs/common';
import { InterviewPositionsController } from './interview-positions.controller';
import { InterviewPositionsService } from './interview-positions.service';

@Module({
  controllers: [InterviewPositionsController],
  providers: [InterviewPositionsService],
  exports: [InterviewPositionsService],
})
export class InterviewPositionsModule {}
