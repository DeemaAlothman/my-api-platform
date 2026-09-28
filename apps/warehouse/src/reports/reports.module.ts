import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { PrismaService } from '../prisma/prisma.service';
import { StockModule } from '../stock/stock.module';

@Module({
  imports: [StockModule],
  controllers: [ReportsController],
  providers: [ReportsService, PrismaService],
})
export class ReportsModule {}
