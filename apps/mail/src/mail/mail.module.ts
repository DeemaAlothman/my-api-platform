import { Module } from '@nestjs/common';
import { MailController } from './mail.controller';
import { MailService } from './mail.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [MailController],
  providers: [MailService, PrismaService],
})
export class MailModule {}
