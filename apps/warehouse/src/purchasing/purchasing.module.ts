import { Module } from '@nestjs/common';
import { PurchasingController } from './purchasing.controller';
import { PurchasingService } from './purchasing.service';
import { PrismaService } from '../prisma/prisma.service';
import { CurrenciesModule } from '../currencies/currencies.module';

@Module({
  imports: [CurrenciesModule],
  controllers: [PurchasingController],
  providers: [PurchasingService, PrismaService],
})
export class PurchasingModule {}
