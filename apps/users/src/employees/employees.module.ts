import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { ProbationReminderService } from './probation-reminder.service';
import { ResignationSeparationService } from './resignation-separation.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [HttpModule],
  controllers: [EmployeesController],
  providers: [EmployeesService, ProbationReminderService, ResignationSeparationService, PrismaService],
  exports: [EmployeesService],
})
export class EmployeesModule {}
