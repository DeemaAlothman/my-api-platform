import { Module } from '@nestjs/common';
import { AppointmentsController, AppointmentsInternalController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { ReminderService } from './reminder.service';
import { PrismaService } from '../prisma/prisma.service';


@Module({
  controllers: [AppointmentsController, AppointmentsInternalController],
  providers: [AppointmentsService, ReminderService, PrismaService],
})
export class AppointmentsModule {}
