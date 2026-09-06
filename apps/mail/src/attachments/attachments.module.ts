import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AttachmentsController } from './attachments.controller';
import { MailFileController } from './mail-file.controller';
import { AttachmentsService } from './attachments.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [
    JwtModule.register({ secret: process.env.JWT_ACCESS_SECRET! }),
  ],
  controllers: [AttachmentsController, MailFileController],
  providers: [AttachmentsService, PrismaService],
})
export class AttachmentsModule {}
