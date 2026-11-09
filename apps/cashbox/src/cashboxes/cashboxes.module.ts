import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CashBoxesController } from './cashboxes.controller';
import { CashBoxesService } from './cashboxes.service';

@Module({
  controllers: [CashBoxesController],
  providers: [CashBoxesService, PrismaService],
  exports: [CashBoxesService],
})
export class CashBoxesModule {}
