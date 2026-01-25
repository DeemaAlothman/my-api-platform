import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { EvaluationPeriodsModule } from './evaluation-periods/evaluation-periods.module';
import { EvaluationCriteriaModule } from './evaluation-criteria/evaluation-criteria.module';
import { EvaluationFormsModule } from './evaluation-forms/evaluation-forms.module';
import { PeerEvaluationsModule } from './peer-evaluations/peer-evaluations.module';
import { EmployeeGoalsModule } from './employee-goals/employee-goals.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    EvaluationPeriodsModule,
    EvaluationCriteriaModule,
    EvaluationFormsModule,
    PeerEvaluationsModule,
    EmployeeGoalsModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}
