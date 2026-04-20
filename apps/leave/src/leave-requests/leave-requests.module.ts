import { Module } from '@nestjs/common';
import { LeaveRequestsController } from './leave-requests.controller';
import { LeaveRequestsService } from './leave-requests.service';
import { MedicalLeaveNotifierService } from './medical-leave-notifier.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [LeaveRequestsController],
  providers: [LeaveRequestsService, MedicalLeaveNotifierService, PrismaService],
  exports: [LeaveRequestsService],
})
export class LeaveRequestsModule {}
