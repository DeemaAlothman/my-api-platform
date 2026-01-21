import { Module } from '@nestjs/common';
import { LeaveBalancesController } from './leave-balances.controller';
import { LeaveBalancesService } from './leave-balances.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [LeaveBalancesController],
  providers: [LeaveBalancesService, PrismaService],
  exports: [LeaveBalancesService],
})
export class LeaveBalancesModule {}
