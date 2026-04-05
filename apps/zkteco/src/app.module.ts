import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { PrismaService } from './prisma/prisma.service';
import { JwtStrategy } from './common/strategies/jwt.strategy';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { DeviceModule } from './device/device.module';
import { EmployeeMappingModule } from './employee-mapping/employee-mapping.module';
import { IclockModule } from './iclock/iclock.module';
import { SyncModule } from './sync/sync.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    DeviceModule,
    EmployeeMappingModule,
    IclockModule,
    SyncModule,
  ],
  providers: [
    PrismaService,
    JwtStrategy,
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
