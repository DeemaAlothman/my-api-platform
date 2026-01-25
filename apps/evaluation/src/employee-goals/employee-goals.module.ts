import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { EmployeeGoalsController } from './employee-goals.controller';
import { EmployeeGoalsService } from './employee-goals.service';

@Module({
  imports: [JwtModule, ConfigModule],
  controllers: [EmployeeGoalsController],
  providers: [EmployeeGoalsService],
  exports: [EmployeeGoalsService],
})
export class EmployeeGoalsModule {}
