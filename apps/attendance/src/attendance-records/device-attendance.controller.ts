import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { AttendanceRecordsService } from './attendance-records.service';
import { DeviceCheckInDto } from './dto/device-check-in.dto';
import { DeviceCheckOutDto } from './dto/device-check-out.dto';
import { DeviceBreakDto } from './dto/device-break.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permission } from '../common/decorators/permission.decorator';

/**
 * Device Attendance Controller - بدون EmployeeInterceptor
 * يُستخدم من ZKTeco Service أو أي نظام خارجي موثوق
 */
@Controller('attendance-records')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DeviceAttendanceController {
  constructor(private readonly service: AttendanceRecordsService) {}

  @Post('device-check-in')
  @Permission('attendance.records.device')
  deviceCheckIn(@Body() dto: DeviceCheckInDto) {
    const date = dto.checkInTime.split('T')[0]; // YYYY-MM-DD من الـ ISO string
    return this.service.checkIn(dto.employeeId, {
      checkInTime: dto.checkInTime,
      date,
      source: 'BIOMETRIC',
      deviceSN: dto.deviceSN,
    } as any);
  }

  @Post('device-check-out')
  @Permission('attendance.records.device')
  deviceCheckOut(@Body() dto: DeviceCheckOutDto) {
    const date = dto.checkOutTime.split('T')[0];
    return this.service.checkOut(dto.employeeId, {
      checkOutTime: dto.checkOutTime,
      date,
    } as any);
  }

  @Post('device-break')
  @Permission('attendance.records.device')
  deviceBreak(@Body() dto: DeviceBreakDto) {
    const date = dto.timestamp.split('T')[0];
    if (dto.type === 'OUT') {
      return this.service.addBreak(dto.employeeId, {
        breakOut: dto.timestamp,
        reason: dto.reason,
        date,
      });
    } else {
      return this.service.closeBreak(dto.employeeId, { breakIn: dto.timestamp, date });
    }
  }

  @Get(':id/breaks')
  @Permission('attendance.records.read')
  getBreaks(@Param('id') id: string) {
    return this.service.getBreaks(id);
  }
}
