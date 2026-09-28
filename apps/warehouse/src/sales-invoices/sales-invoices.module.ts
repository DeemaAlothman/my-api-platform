import { Module } from '@nestjs/common';
import { SalesInvoicesController } from './sales-invoices.controller';
import { SalesInvoicesService } from './sales-invoices.service';
import { PrismaService } from '../prisma/prisma.service';
import { QuotationsModule } from '../quotations/quotations.module';

@Module({
  imports: [QuotationsModule],
  controllers: [SalesInvoicesController],
  providers: [SalesInvoicesService, PrismaService],
})
export class SalesInvoicesModule {}
