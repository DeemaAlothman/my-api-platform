import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaService } from './prisma/prisma.service';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { JwtStrategy } from './common/strategies/jwt.strategy';
import { MailModule } from './mail/mail.module';
import { AttachmentsModule } from './attachments/attachments.module';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET!,
      signOptions: { expiresIn: '15m' },
    }),
    MailModule,
    AttachmentsModule,
  ],
  providers: [PrismaService, JwtStrategy, { provide: APP_INTERCEPTOR, useClass: AuditInterceptor }],
})
export class AppModule {}
