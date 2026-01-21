import { Module } from '@nestjs/common';
import { LeaveTypesController } from './leave-types.controller';
import { LeaveTypesService } from './leave-types.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [LeaveTypesController],
  providers: [LeaveTypesService, PrismaService],
  exports: [LeaveTypesService],
})
export class LeaveTypesModule {}
