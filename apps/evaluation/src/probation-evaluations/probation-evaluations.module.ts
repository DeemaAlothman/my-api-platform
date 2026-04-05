import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { ProbationEvaluationsController } from './probation-evaluations.controller';
import { ProbationEvaluationsService } from './probation-evaluations.service';

@Module({
  imports: [JwtModule, ConfigModule],
  controllers: [ProbationEvaluationsController],
  providers: [ProbationEvaluationsService],
})
export class ProbationEvaluationsModule {}
