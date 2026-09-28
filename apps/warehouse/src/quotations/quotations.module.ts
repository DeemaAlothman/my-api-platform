import { Module } from '@nestjs/common';
import { QuotationsController } from './quotations.controller';
import { QuotationsService } from './quotations.service';
import { PrismaService } from '../prisma/prisma.service';
import { CurrenciesModule } from '../currencies/currencies.module';

@Module({
  imports: [CurrenciesModule],
  controllers: [QuotationsController],
  providers: [QuotationsService, PrismaService],
  exports: [QuotationsService],
})
export class QuotationsModule {}
