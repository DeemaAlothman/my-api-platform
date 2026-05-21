import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, UseInterceptors, HttpCode, HttpStatus } from '@nestjs/common';
import { AttendanceRecordsService } from './attendance-records.service';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';
import { CreateAttendanceRecordDto } from './dto/create-attendance-record.dto';
import { UpdateAttendanceRecordDto } from './dto/update-attendance-record.dto';
import { JwtAuthGuard } from '@shared/auth';
import { PermissionsGuard } from '@shared';
import { Permission } from '@shared';
import { EmployeeInterceptor } from '../common/interceptors/employee.interceptor';
import { EmployeeId, UserId } from '@shared/auth';
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
  @Permission('attendance.records.create-manual')
  create(@Body() dto: CreateAttendanceRecordDto, @UserId() userId: string) {
    return this.service.create(dto, userId);
  }

  @Get()
  @Permission('attendance.records.read')
  findAll(@Query() query: ListAttendanceRecordsQueryDto) {
    return this.service.findAll(query);
  }

  // ─── Needs-review list ───────────────────────────────────────────────────

  @Get('needs-review')
  @Permission('attendance.records.read')
  getNeedsReview(@Query() query: { employeeId?: string; dateFrom?: string; dateTo?: string; page?: string; limit?: string }) {
    return this.service.getNeedsReview(query);
  }

  @Get(':id')
  @Permission('attendance.records.read')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Permission('attendance.records.update-manual')
  update(@Param('id') id: string, @Body() dto: UpdateAttendanceRecordDto, @UserId() userId: string) {
    return this.service.update(id, dto, userId);
  }

  @Delete(':id')
  @Permission('attendance.records.delete')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  // ─── Phase 3: Manual stamp correction ────────────────────────────────────

  @Get(':id/raw-stamps')
  @Permission('attendance.records.read')
  getRawStamps(@Param('id') id: string) {
    return this.service.getRawStamps(id);
  }

  @Patch('raw-stamps/:logId/interpretation')
  @Permission('attendance.records.update-manual')
  updateStampInterpretation(
    @Param('logId') logId: string,
    @Body() body: { interpretedAs: string },
    @UserId() userId: string,
  ) {
    return this.service.updateStampInterpretation(logId, body.interpretedAs, userId);
  }

  @Delete('raw-stamps/:logId')
  @Permission('attendance.records.update-manual')
  @HttpCode(HttpStatus.OK)
  deleteStamp(@Param('logId') logId: string, @UserId() userId: string) {
    return this.service.deleteStamp(logId, userId);
  }

  @Post(':id/recompute')
  @Permission('attendance.records.update-manual')
  recomputeRecord(@Param('id') id: string, @UserId() userId: string) {
    return this.service.recomputeRecord(id, userId);
  }

  @Post(':id/approve')
  @Permission('attendance.records.update-manual')
  approveRecord(@Param('id') id: string, @UserId() userId: string) {
    return this.service.approveRecord(id, userId);
  }

  @Post(':id/add-manual-stamp')
  @Permission('attendance.records.update-manual')
  addManualStamp(
    @Param('id') id: string,
    @Body() body: { timestamp: string; interpretedAs: string },
    @UserId() userId: string,
  ) {
    return this.service.addManualStamp(id, body, userId);
  }
}
