import { Module } from '@nestjs/common';
import { DashboardDataController } from './dashboard-data.controller';
import { SourcesModule } from '../sources/sources.module';

@Module({
  imports: [SourcesModule],
  controllers: [DashboardDataController],
})
export class DashboardModule {}
