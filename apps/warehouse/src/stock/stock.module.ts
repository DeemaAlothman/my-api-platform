import { Module } from '@nestjs/common';
import { StockController } from './stock.controller';
import { StockService } from './stock.service';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryCountsModule } from '../inventory-counts/inventory-counts.module';

@Module({
  imports: [InventoryCountsModule],
  controllers: [StockController],
  providers: [StockService, PrismaService],
})
export class StockModule {}
