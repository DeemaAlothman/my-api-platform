import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from './auth/auth.module';
import { PrismaService } from '../prisma/prisma.service';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { JwtStrategy, PRISMA_FOR_JWT } from '@shared/auth';

@Module({
  imports: [
    // طلبات كل الموظفين بتوصل عبر الـ gateway بنفس IP الداخلي، فهاد الحد فعلياً مشترك للشركة كلها وليس لكل مستخدم
    ThrottlerModule.forRoot([
      { name: 'short',  ttl: 1000,  limit: 50   },
      { name: 'medium', ttl: 60000, limit: 1000 },
    ]),
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET!,
      signOptions: { expiresIn: '15m' },
    }),
    AuthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    PrismaService,
    JwtStrategy,
    { provide: PRISMA_FOR_JWT, useExisting: PrismaService },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
