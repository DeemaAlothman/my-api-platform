import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from './prisma/prisma.service';
import { JwtStrategy, PRISMA_FOR_JWT } from '@shared/auth';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { PatientJwtStrategy } from './patient-auth/strategies/patient-jwt.strategy';
import { PatientAuthModule } from './patient-auth/patient-auth.module';
import { AccountsModule } from './accounts/accounts.module';
import { TaxonomyModule } from './taxonomy/taxonomy.module';
import { ExercisesModule } from './exercises/exercises.module';
import { AssignmentsModule } from './assignments/assignments.module';
import { MeModule } from './me/me.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    PassportModule,
    // JWT الموظفين (@shared) — للجانب الإداري/الداشبورد فقط
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET!,
      signOptions: { expiresIn: '15m' },
    }),
    PatientAuthModule,
    AccountsModule,
    TaxonomyModule,
    ExercisesModule,
    AssignmentsModule,
    MeModule,
    NotificationsModule,
  ],
  providers: [
    PrismaService,
    // استراتيجية موظفي المنصة (JwtAuthGuard + PermissionsGuard على واجهات الداشبورد)
    JwtStrategy,
    { provide: PRISMA_FOR_JWT, useExisting: PrismaService },
    // استراتيجية المريض المنفصلة (PatientJwtAuthGuard على واجهات /me)
    PatientJwtStrategy,
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
