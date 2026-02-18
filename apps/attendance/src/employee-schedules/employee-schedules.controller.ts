import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { EmployeeSchedulesService } from './employee-schedules.service';
import { CreateEmployeeScheduleDto } from './dto/create-employee-schedule.dto';
import { UpdateEmployeeScheduleDto } from './dto/update-employee-schedule.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permission } from '../common/decorators/permission.decorator';

@Controller('employee-schedules')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EmployeeSchedulesController {
  constructor(private readonly service: EmployeeSchedulesService) {}

  @Post()
  @Permission('attendance.employee-schedules.create')
  create(@Body() dto: CreateEmployeeScheduleDto) {
    return this.service.create(dto);
  }

  @Get()
  @Permission('attendance.employee-schedules.read')
  findAll(
    @Query('employeeId') employeeId?: string,
    @Query('scheduleId') scheduleId?: string,
    @Query('isActive') isActive?: string,
  ) {
    const filters: any = {};
    if (employeeId) filters.employeeId = employeeId;
    if (scheduleId) filters.scheduleId = scheduleId;
    if (isActive !== undefined) filters.isActive = isActive === 'true';
    return this.service.findAll(filters);
  }

  @Get('employee/:employeeId')
  @Permission('attendance.employee-schedules.read')
  findByEmployee(@Param('employeeId') employeeId: string) {
    return this.service.findByEmployee(employeeId);
  }

  @Get(':id')
  @Permission('attendance.employee-schedules.read')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Permission('attendance.employee-schedules.update')
  update(@Param('id') id: string, @Body() dto: UpdateEmployeeScheduleDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Permission('attendance.employee-schedules.delete')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
