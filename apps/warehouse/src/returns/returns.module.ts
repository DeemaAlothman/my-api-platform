import { Module } from '@nestjs/common';
import { ReturnsController } from './returns.controller';
import { ReturnsService } from './returns.service';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryCountsModule } from '../inventory-counts/inventory-counts.module';

@Module({
  imports: [InventoryCountsModule],
  controllers: [ReturnsController],
  providers: [ReturnsService, PrismaService],
})
export class ReturnsModule {}
