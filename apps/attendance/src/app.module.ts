import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { PrismaService } from './prisma/prisma.service';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { WorkSchedulesModule } from './work-schedules/work-schedules.module';
import { AttendanceRecordsModule } from './attendance-records/attendance-records.module';
import { AttendanceAlertsModule } from './attendance-alerts/attendance-alerts.module';
import { EmployeeSchedulesModule } from './employee-schedules/employee-schedules.module';
import { AttendanceJustificationsModule } from './attendance-justifications/attendance-justifications.module';
import { ReportsModule } from './reports/reports.module';
import { EmployeeConfigModule } from './employee-config/employee-config.module';
import { DeductionPoliciesModule } from './deduction-policies/deduction-policies.module';
import { PayrollModule } from './payroll/payroll.module';
import { JwtStrategy } from './common/strategies/jwt.strategy';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    WorkSchedulesModule,
    AttendanceRecordsModule,
    AttendanceAlertsModule,
    EmployeeSchedulesModule,
    AttendanceJustificationsModule,
    ReportsModule,
    EmployeeConfigModule,
    DeductionPoliciesModule,
    PayrollModule,
  ],
  providers: [
    PrismaService,
    JwtStrategy,
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
