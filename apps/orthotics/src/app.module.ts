import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from './prisma/prisma.service';
import { ReceptionsModule } from './receptions/receptions.module';
import { JwtStrategy, PRISMA_FOR_JWT } from '@shared/auth';
// سجل التدقيق: كانت المقومات الخدمة الوحيدة بلا سجل، فلم يكن ممكناً معرفة
// من أنشأ استقبالاً أو عدّله أو حذفه — ولا حتى أن عملية جرت أصلاً.
import { AuditInterceptor } from './common/interceptors/audit.interceptor';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET!,
      signOptions: { expiresIn: '15m' },
    }),
    ReceptionsModule,
  ],
  providers: [
    PrismaService,
    JwtStrategy,
    { provide: PRISMA_FOR_JWT, useExisting: PrismaService },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
