import { Module } from '@nestjs/common';
import { TransfersController } from './transfers.controller';
import { TransfersService } from './transfers.service';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryCountsModule } from '../inventory-counts/inventory-counts.module';

@Module({
  imports: [InventoryCountsModule],
  controllers: [TransfersController],
  providers: [TransfersService, PrismaService],
})
export class TransfersModule {}
