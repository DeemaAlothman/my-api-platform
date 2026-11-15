import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappController } from './whatsapp.controller';
import { BaileysClientService } from './baileys-client.service';
import { NotificationWatcherCron } from './notification-watcher.cron';

@Module({
  controllers: [WhatsappController],
  providers: [PrismaService, BaileysClientService, NotificationWatcherCron],
})
export class WhatsappModule {}
