import { Module } from '@nestjs/common';
import { MailController } from './mail.controller';
import { MailInternalController } from './mail-internal.controller';
import { MailService } from './mail.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [MailController, MailInternalController],
  providers: [MailService, PrismaService],
})
export class MailModule {}
