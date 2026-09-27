import { Module } from '@nestjs/common';
import { InventoryCountsController } from './inventory-counts.controller';
import { InventoryCountsService } from './inventory-counts.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [InventoryCountsController],
  providers: [InventoryCountsService, PrismaService],
  exports: [InventoryCountsService],
})
export class InventoryCountsModule {}
