import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { EvaluationPeriodsController } from './evaluation-periods.controller';
import { EvaluationPeriodsService } from './evaluation-periods.service';

@Module({
  imports: [JwtModule, ConfigModule],
  controllers: [EvaluationPeriodsController],
  providers: [EvaluationPeriodsService],
  exports: [EvaluationPeriodsService],
})
export class EvaluationPeriodsModule {}
