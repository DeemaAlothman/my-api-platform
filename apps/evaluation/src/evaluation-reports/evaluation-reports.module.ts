import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { EvaluationReportsController } from './evaluation-reports.controller';
import { EvaluationReportsService } from './evaluation-reports.service';

@Module({
  imports: [JwtModule, ConfigModule],
  controllers: [EvaluationReportsController],
  providers: [EvaluationReportsService],
})
export class EvaluationReportsModule {}
