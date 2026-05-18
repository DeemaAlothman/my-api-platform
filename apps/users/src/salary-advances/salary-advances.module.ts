import { Module } from '@nestjs/common';
import { SalaryAdvancesController } from './salary-advances.controller';
import { SalaryAdvancesService } from './salary-advances.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [SalaryAdvancesController],
  providers: [SalaryAdvancesService, PrismaService],
  exports: [SalaryAdvancesService],
})
export class SalaryAdvancesModule {}
