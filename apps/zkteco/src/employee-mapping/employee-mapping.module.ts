import { Module } from '@nestjs/common';
import { EmployeeMappingController } from './employee-mapping.controller';
import { EmployeeMappingService } from './employee-mapping.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [EmployeeMappingController],
  providers: [EmployeeMappingService, PrismaService],
  exports: [EmployeeMappingService],
})
export class EmployeeMappingModule {}
