import { Controller, Get, Post, Body, Param, UseGuards, Logger } from '@nestjs/common';
import { AttendanceRecordsService } from './attendance-records.service';
import { DeviceCheckInDto } from './dto/device-check-in.dto';
import { DeviceCheckOutDto } from './dto/device-check-out.dto';
import { DeviceBreakDto } from './dto/device-break.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permission } from '../common/decorators/permission.decorator';

const DUPLICATE_WINDOW_MS = 2 * 60 * 1000; // دقيقتان

/**
 * Device Attendance Controller - بدون EmployeeInterceptor
 * يُستخدم من ZKTeco Service أو أي نظام خارجي موثوق
 */
@Controller('attendance-records')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DeviceAttendanceController {
  private readonly logger = new Logger(DeviceAttendanceController.name);

  constructor(private readonly service: AttendanceRecordsService) {}

  @Post('device-check-in')
  @Permission('attendance.records.device')
  async deviceCheckIn(@Body() dto: DeviceCheckInDto) {
    const date = dto.checkInTime.split('T')[0];
    const checkInTime = new Date(dto.checkInTime);
    const prisma = (this.service as any).prisma;

    // تجاهل بصمة مكررة خلال دقيقتين
    const recent = await prisma.attendanceRecord.findFirst({
      where: {
        employeeId: dto.employeeId,
        date: new Date(date),
        clockInTime: { gte: new Date(checkInTime.getTime() - DUPLICATE_WINDOW_MS) },
        clockOutTime: null,
      },
      orderBy: { clockInTime: 'desc' },
      select: { id: true, clockInTime: true },
    });
    if (recent) {
      this.logger.warn(`[DUPLICATE_CHECKIN] employeeId=${dto.employeeId} deviceSN=${dto.deviceSN} — ignored`);
      return { message: 'Duplicate check-in ignored', status: 'ignored', existingRecord: recent };
    }

    // هل في سجل مفتوح مع break مفتوح؟ → إغلاق البريك
    const openRecord = await prisma.attendanceRecord.findFirst({
      where: { employeeId: dto.employeeId, date: new Date(date), clockInTime: { not: null }, clockOutTime: null },
    });
    if (openRecord) {
      const openBreak = await prisma.attendanceBreak.findFirst({
        where: { attendanceRecordId: openRecord.id, breakIn: null },
      });
      if (openBreak) {
        this.logger.log(`[BREAK_IN] employeeId=${dto.employeeId} — closing open break via check-in`);
        return this.service.closeBreak(dto.employeeId, { breakIn: dto.checkInTime, date });
      }
      // سجل مفتوح بدون break → تجاهل (مكرر)
      this.logger.warn(`[DUPLICATE_CHECKIN_OPEN] employeeId=${dto.employeeId} — already checked in`);
      return { message: 'Already checked in', status: 'ignored' };
    }

    // هل في سجل مُغلق اليوم؟ → الموظف رجع من البريك (الجهاز ما يفرّق بين البريك والخروج الحقيقي)
    const closedRecord = await prisma.attendanceRecord.findFirst({
      where: { employeeId: dto.employeeId, date: new Date(date), clockInTime: { not: null }, clockOutTime: { not: null } },
      orderBy: { clockOutTime: 'desc' },
    });
    if (closedRecord) {
      const breakStartTime = closedRecord.clockOutTime;
      const durationMinutes = Math.max(0, Math.round((checkInTime.getTime() - breakStartTime.getTime()) / 60000));

      // أعد فتح السجل
      await prisma.attendanceRecord.update({
        where: { id: closedRecord.id },
        data: { clockOutTime: null, workedMinutes: null, netWorkedMinutes: null, earlyLeaveMinutes: 0, overtimeMinutes: null },
      });

      // سجّل البريك
      await prisma.attendanceBreak.create({
        data: { attendanceRecordId: closedRecord.id, breakOut: breakStartTime, breakIn: checkInTime, durationMinutes },
      });

      this.logger.log(`[BREAK_RETURN] employeeId=${dto.employeeId} breakDuration=${durationMinutes}min`);
      return { message: 'Break return recorded', status: 'break_return', breakDurationMinutes: durationMinutes };
    }

    // دخول عادي
    return this.service.checkIn(dto.employeeId, {
      checkInTime: dto.checkInTime,
      date,
      source: 'BIOMETRIC',
      deviceSN: dto.deviceSN,
    } as any);
  }

  @Post('device-check-out')
  @Permission('attendance.records.device')
  async deviceCheckOut(@Body() dto: DeviceCheckOutDto) {
    const date = dto.checkOutTime.split('T')[0];
    const checkOutTime = new Date(dto.checkOutTime);

    const recent = await (this.service as any).prisma.attendanceRecord.findFirst({
      where: {
        employeeId: dto.employeeId,
        date: new Date(date),
        clockOutTime: { gte: new Date(checkOutTime.getTime() - DUPLICATE_WINDOW_MS) },
      },
      orderBy: { clockOutTime: 'desc' },
      select: { id: true, clockOutTime: true },
    });

    if (recent) {
      this.logger.warn(`[DUPLICATE_CHECKOUT] employeeId=${dto.employeeId} — ignored duplicate within 2min`);
      return { message: 'Duplicate check-out ignored', status: 'ignored', existingRecord: recent };
    }

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
