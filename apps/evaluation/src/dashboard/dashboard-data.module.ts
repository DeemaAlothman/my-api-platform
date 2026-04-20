import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { DashboardDataController } from './dashboard-data.controller';

@Module({
  imports: [JwtModule, ConfigModule],
  controllers: [DashboardDataController],
})
export class DashboardDataModule {}
