import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { EmployeeConfigService } from './employee-config.service';
import { CreateEmployeeConfigDto } from './dto/create-employee-config.dto';
import { UpdateEmployeeConfigDto } from './dto/update-employee-config.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permission } from '../common/decorators/permission.decorator';

@Controller('employee-attendance-config')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EmployeeConfigController {
  constructor(private readonly service: EmployeeConfigService) {}

  @Post()
  @Permission('attendance.config.create')
  create(@Body() dto: CreateEmployeeConfigDto) {
    return this.service.create(dto);
  }

  @Get()
  @Permission('attendance.config.read')
  findAll() {
    return this.service.findAll();
  }

  @Get(':employeeId')
  @Permission('attendance.config.read')
  findByEmployee(@Param('employeeId') employeeId: string) {
    return this.service.findByEmployee(employeeId);
  }

  @Patch(':employeeId')
  @Permission('attendance.config.update')
  update(@Param('employeeId') employeeId: string, @Body() dto: UpdateEmployeeConfigDto) {
    return this.service.update(employeeId, dto);
  }
}
