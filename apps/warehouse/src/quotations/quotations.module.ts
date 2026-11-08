import { Module } from '@nestjs/common';
import { QuotationsController } from './quotations.controller';
import { QuotationsService } from './quotations.service';
import { PrismaService } from '../prisma/prisma.service';
import { CurrenciesModule } from '../currencies/currencies.module';
import { PricingModule } from '../pricing/pricing.module';

@Module({
  imports: [CurrenciesModule, PricingModule],
  controllers: [QuotationsController],
  providers: [QuotationsService, PrismaService],
  exports: [QuotationsService],
})
export class QuotationsModule {}
