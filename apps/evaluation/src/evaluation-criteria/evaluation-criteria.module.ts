import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { EvaluationCriteriaController } from './evaluation-criteria.controller';
import { EvaluationCriteriaService } from './evaluation-criteria.service';

@Module({
  imports: [JwtModule, ConfigModule],
  controllers: [EvaluationCriteriaController],
  providers: [EvaluationCriteriaService],
  exports: [EvaluationCriteriaService],
})
export class EvaluationCriteriaModule {}
