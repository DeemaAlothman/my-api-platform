import { Module } from '@nestjs/common';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { ReminderService } from './reminder.service';
import { PrismaService } from '../prisma/prisma.service';


@Module({
  controllers: [AppointmentsController],
  providers: [AppointmentsService, ReminderService, PrismaService],
})
export class AppointmentsModule {}
