import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CountsController } from './counts.controller';
import { CountsService } from './counts.service';
import { CashBoxesModule } from '../cashboxes/cashboxes.module';

@Module({
  imports: [CashBoxesModule],
  controllers: [CountsController],
  providers: [CountsService, PrismaService],
})
export class CountsModule {}
