import { Module } from '@nestjs/common';
import { LeaveReportsController } from './leave-reports.controller';
import { LeaveReportsService } from './leave-reports.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [LeaveReportsController],
  providers: [LeaveReportsService, PrismaService],
})
export class LeaveReportsModule {}
