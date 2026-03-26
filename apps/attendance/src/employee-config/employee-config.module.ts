import { Module } from '@nestjs/common';
import { EmployeeConfigController } from './employee-config.controller';
import { EmployeeConfigService } from './employee-config.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [EmployeeConfigController],
  providers: [EmployeeConfigService, PrismaService],
  exports: [EmployeeConfigService],
})
export class EmployeeConfigModule {}
