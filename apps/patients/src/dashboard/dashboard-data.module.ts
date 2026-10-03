import { Module } from '@nestjs/common';
import { DashboardDataController } from './dashboard-data.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [DashboardDataController],
  providers: [PrismaService],
})
export class DashboardDataModule {}
