import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { AttendanceRecordsService } from './attendance-records.service';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';
import { CreateAttendanceRecordDto } from './dto/create-attendance-record.dto';
import { UpdateAttendanceRecordDto } from './dto/update-attendance-record.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permission } from '../common/decorators/permission.decorator';
import { EmployeeInterceptor } from '../common/interceptors/employee.interceptor';
import { EmployeeId } from '../common/decorators/employee.decorator';

@Controller('attendance-records')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UseInterceptors(EmployeeInterceptor)
export class AttendanceRecordsController {
  constructor(private readonly service: AttendanceRecordsService) {}

  @Post('check-in')
  @Permission('attendance.records.check-in')
  checkIn(@EmployeeId() employeeId: string, @Body() dto: CheckInDto) {
    return this.service.checkIn(employeeId, dto);
  }

  @Post('check-out')
  @Permission('attendance.records.check-out')
  checkOut(@EmployeeId() employeeId: string, @Body() dto: CheckOutDto) {
    return this.service.checkOut(employeeId, dto);
  }

  @Get('my-attendance')
  @Permission('attendance.records.read-own')
  getMyAttendance(
    @EmployeeId() employeeId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.service.getMyAttendance(employeeId, { dateFrom, dateTo });
  }

  @Post()
  @Permission('attendance.records.create')
  create(@Body() dto: CreateAttendanceRecordDto) {
    return this.service.create(dto);
  }

  @Get()
  @Permission('attendance.records.read')
  findAll(
    @Query('employeeId') employeeId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('status') status?: string,
  ) {
    return this.service.findAll({ employeeId, dateFrom, dateTo, status });
  }

  @Get(':id')
  @Permission('attendance.records.read')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Permission('attendance.records.update')
  update(@Param('id') id: string, @Body() dto: UpdateAttendanceRecordDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Permission('attendance.records.delete')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
