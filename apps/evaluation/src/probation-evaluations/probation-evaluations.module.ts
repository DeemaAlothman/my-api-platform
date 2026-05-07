import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ProbationEvaluationsController } from './probation-evaluations.controller';
import { ProbationEvaluationsService } from './probation-evaluations.service';

@Module({
  imports: [HttpModule],
  controllers: [ProbationEvaluationsController],
  providers: [ProbationEvaluationsService],
})
export class ProbationEvaluationsModule {}
