import { Module } from '@nestjs/common';
import { MaterialRequestsController, MaterialRequestsInternalController } from './material-requests.controller';
import { MaterialRequestsService } from './material-requests.service';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryCountsModule } from '../inventory-counts/inventory-counts.module';

@Module({
  imports: [InventoryCountsModule],
  controllers: [MaterialRequestsController, MaterialRequestsInternalController],
  providers: [MaterialRequestsService, PrismaService],
})
export class MaterialRequestsModule {}
