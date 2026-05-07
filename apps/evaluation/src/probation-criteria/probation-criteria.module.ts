import { Module } from '@nestjs/common';
import { ProbationCriteriaController } from './probation-criteria.controller';
import { ProbationCriteriaService } from './probation-criteria.service';

@Module({
  imports: [],
  controllers: [ProbationCriteriaController],
  providers: [ProbationCriteriaService],
  exports: [ProbationCriteriaService],
})
export class ProbationCriteriaModule {}
