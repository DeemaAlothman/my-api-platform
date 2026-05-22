import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from './prisma/prisma.service';
import { CasesModule } from './cases/cases.module';
import { ReportsModule } from './reports/reports.module';
import { JwtStrategy, PRISMA_FOR_JWT } from '@shared/auth';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET!,
      signOptions: { expiresIn: '15m' },
    }),
    CasesModule,
    ReportsModule,
  ],
  providers: [
    PrismaService,
    JwtStrategy,
    { provide: PRISMA_FOR_JWT, useExisting: PrismaService },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
