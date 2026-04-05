import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { HttpModule } from '@nestjs/axios';
import { JobApplicationsModule } from './job-applications/job-applications.module';
import { JwtStrategy } from './common/strategies/jwt.strategy';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET!,
      signOptions: { expiresIn: '15m' },
    }),
    HttpModule,
    JobApplicationsModule,
  ],
  providers: [JwtStrategy, { provide: APP_INTERCEPTOR, useClass: AuditInterceptor }],
})
export class AppModule {}
