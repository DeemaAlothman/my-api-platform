import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { PrismaService } from '../prisma/prisma.service';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';

@Module({
  imports: [
    // طلبات كل الموظفين بتوصل عبر الـ gateway بنفس IP الداخلي، فهاد الحد فعلياً مشترك للشركة كلها وليس لكل مستخدم
    ThrottlerModule.forRoot([
      { name: 'short',  ttl: 1000,  limit: 50   },
      { name: 'medium', ttl: 60000, limit: 1000 },
    ]),
    AuthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    PrismaService,
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
