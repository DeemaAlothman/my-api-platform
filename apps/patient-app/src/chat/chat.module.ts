import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ErpClientService } from '../integrations/erp-client.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { ChatStaffController } from './chat-staff.controller';

@Module({
  imports: [NotificationsModule],
  controllers: [ChatController, ChatStaffController],
  providers: [ChatService, PrismaService, ErpClientService],
})
export class ChatModule {}
