import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [HttpModule],
  controllers: [EmployeesController],
  providers: [EmployeesService, PrismaService],
  exports: [EmployeesService],
})
export class EmployeesModule {}
