import { Module } from '@nestjs/common';
import { DashboardDataController } from './dashboard-data.controller';

@Module({
  controllers: [DashboardDataController],
})
export class DashboardDataModule {}
