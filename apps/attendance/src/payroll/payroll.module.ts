import { Module } from '@nestjs/common';
import { PayrollController } from './payroll.controller';
import { PayrollService } from './payroll.service';
import { PayrollCronService } from './payroll-cron.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [PayrollController],
  providers: [PayrollService, PayrollCronService, PrismaService],
  exports: [PayrollService],
})
export class PayrollModule {}
