import { Module } from '@nestjs/common';
import { DashboardDataController } from './dashboard-data.controller';

@Module({
  imports: [],
  controllers: [DashboardDataController],
})
export class DashboardDataModule {}
