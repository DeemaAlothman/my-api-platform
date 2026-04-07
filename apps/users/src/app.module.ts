import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from './prisma/prisma.service';
import { UsersModule } from './users/users.module';
import { EmployeesModule } from './employees/employees.module';
import { DepartmentsModule } from './departments/departments.module';
import { RolesModule } from './roles/roles.module';
import { JobTitlesModule } from './job-titles/job-titles.module';
import { JobGradesModule } from './job-grades/job-grades.module';
import { CustodiesModule } from './custodies/custodies.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { DocumentsModule } from './documents/documents.module';
import { HrReportsModule } from './hr-reports/hr-reports.module';
import { JwtStrategy } from './common/strategies/jwt.strategy';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET!,
      signOptions: { expiresIn: '15m' },
    }),
    UsersModule,
    EmployeesModule,
    DepartmentsModule,
    RolesModule,
    JobTitlesModule,
    JobGradesModule,
    CustodiesModule,
    NotificationsModule,
    OnboardingModule,
    DocumentsModule,
    HrReportsModule,
  ],
  providers: [PrismaService, JwtStrategy, { provide: APP_INTERCEPTOR, useClass: AuditInterceptor }],
})
export class AppModule {}
