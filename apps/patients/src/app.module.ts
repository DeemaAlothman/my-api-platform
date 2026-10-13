import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from './prisma/prisma.service';
import { PatientsModule } from './patients/patients.module';
import { CitiesModule } from './cities/cities.module';
import { DashboardDataModule } from './dashboard/dashboard-data.module';
import { SurveysModule } from './surveys/surveys.module';
import { JwtStrategy, PRISMA_FOR_JWT } from '@shared/auth';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET!,
      signOptions: { expiresIn: '15m' },
    }),
    PatientsModule,
    CitiesModule,
    DashboardDataModule,
    SurveysModule,
  ],
  providers: [
    PrismaService,
    JwtStrategy,
    { provide: PRISMA_FOR_JWT, useExisting: PrismaService },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
