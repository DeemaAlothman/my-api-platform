import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from './prisma/prisma.service';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { LeaveRequestsModule } from './leave-requests/leave-requests.module';
import { LeaveBalancesModule } from './leave-balances/leave-balances.module';
import { LeaveTypesModule } from './leave-types/leave-types.module';
import { HolidaysModule } from './holidays/holidays.module';
import { LeaveReportsModule } from './leave-reports/leave-reports.module';
import { JwtStrategy } from './common/strategies/jwt.strategy';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET!,
      signOptions: { expiresIn: '15m' },
    }),
    LeaveRequestsModule,
    LeaveBalancesModule,
    LeaveTypesModule,
    HolidaysModule,
    LeaveReportsModule,
  ],
  providers: [PrismaService, JwtStrategy, { provide: APP_INTERCEPTOR, useClass: AuditInterceptor }],
})
export class AppModule {}
