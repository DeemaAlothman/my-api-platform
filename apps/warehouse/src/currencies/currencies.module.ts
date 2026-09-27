import { Module } from '@nestjs/common';
import { CurrenciesController } from './currencies.controller';
import { CurrenciesService } from './currencies.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [CurrenciesController],
  providers: [CurrenciesService, PrismaService],
  exports: [CurrenciesService],
})
export class CurrenciesModule {}
