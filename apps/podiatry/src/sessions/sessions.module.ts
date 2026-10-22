import { Module } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { SessionsController } from './sessions.controller';
import { SurveyReminderService } from './survey-reminder.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [SessionsController],
  providers: [SessionsService, SurveyReminderService, PrismaService],
})
export class SessionsModule {}
