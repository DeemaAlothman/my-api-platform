import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsController, NotificationsInternalController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PushSenderService } from './push-sender.service';
import { DailyReminderService } from './daily-reminder.service';

@Module({
  controllers: [NotificationsController, NotificationsInternalController],
  providers: [NotificationsService, PushSenderService, DailyReminderService, PrismaService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
