import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { PrismaService } from './prisma/prisma.service';
import { WorkSchedulesModule } from './work-schedules/work-schedules.module';
import { AttendanceRecordsModule } from './attendance-records/attendance-records.module';
import { AttendanceAlertsModule } from './attendance-alerts/attendance-alerts.module';
import { EmployeeSchedulesModule } from './employee-schedules/employee-schedules.module';
import { AttendanceJustificationsModule } from './attendance-justifications/attendance-justifications.module';
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
  ],
  providers: [
    PrismaService,
    JwtStrategy,
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}
