import { Module } from '@nestjs/common';
import { SalesCommissionsController } from './sales-commissions.controller';
import { SalesCommissionsService } from './sales-commissions.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [SalesCommissionsController],
  providers: [SalesCommissionsService, PrismaService],
})
export class SalesCommissionsModule {}
