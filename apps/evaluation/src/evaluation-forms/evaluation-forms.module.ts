import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { EvaluationFormsController } from './evaluation-forms.controller';
import { EvaluationFormsService } from './evaluation-forms.service';

@Module({
  imports: [JwtModule, ConfigModule],
  controllers: [EvaluationFormsController],
  providers: [EvaluationFormsService],
  exports: [EvaluationFormsService],
})
export class EvaluationFormsModule {}
