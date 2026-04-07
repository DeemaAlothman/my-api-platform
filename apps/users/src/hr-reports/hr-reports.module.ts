import { Module } from '@nestjs/common';
import { HrReportsController } from './hr-reports.controller';
import { HrReportsService } from './hr-reports.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [HrReportsController],
  providers: [HrReportsService, PrismaService],
})
export class HrReportsModule {}
