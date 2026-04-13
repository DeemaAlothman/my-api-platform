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
import { EmployeeId, UserId } from '../common/decorators/employee.decorator';
import { ListAttendanceRecordsQueryDto } from './dto/list-attendance-records.query.dto';

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
    @Query() query: ListAttendanceRecordsQueryDto,
  ) {
    return this.service.getMyAttendance(employeeId, query);
  }

  @Post()
  @Permission('attendance.records.create')
  create(@Body() dto: CreateAttendanceRecordDto, @UserId() userId: string) {
    return this.service.create(dto, userId);
  }

  @Get()
  @Permission('attendance.records.read')
  findAll(@Query() query: ListAttendanceRecordsQueryDto) {
    return this.service.findAll(query);
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
