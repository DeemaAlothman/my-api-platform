import { Module } from '@nestjs/common';
import { EmployeeGoalsController } from './employee-goals.controller';
import { EmployeeGoalsService } from './employee-goals.service';

@Module({
  imports: [],
  controllers: [EmployeeGoalsController],
  providers: [EmployeeGoalsService],
  exports: [EmployeeGoalsService],
})
export class EmployeeGoalsModule {}
