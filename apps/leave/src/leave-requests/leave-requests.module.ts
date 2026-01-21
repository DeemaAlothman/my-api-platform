import { Module } from '@nestjs/common';
import { LeaveRequestsController } from './leave-requests.controller';
import { LeaveRequestsService } from './leave-requests.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [LeaveRequestsController],
  providers: [LeaveRequestsService, PrismaService],
  exports: [LeaveRequestsService],
})
export class LeaveRequestsModule {}
