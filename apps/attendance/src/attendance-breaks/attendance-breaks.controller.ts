import { Controller, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { AttendanceBreaksService } from './attendance-breaks.service';
import { JwtAuthGuard } from '@shared/auth';
import { PermissionsGuard, Permission } from '@shared';

@Controller('attendance-breaks')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AttendanceBreaksController {
  constructor(private readonly service: AttendanceBreaksService) {}

  @Patch(':breakId/authorize')
  @Permission('attendance.breaks.manage')
  authorize(
    @Param('breakId') breakId: string,
    @Body('reason') reason: string,
  ) {
    return this.service.authorize(breakId, reason);
  }

  @Patch(':breakId/reject')
  @Permission('attendance.breaks.manage')
  reject(
    @Param('breakId') breakId: string,
    @Body('reason') reason?: string,
  ) {
    return this.service.reject(breakId, reason);
  }

  @Patch(':breakId/type')
  @Permission('attendance.breaks.manage')
  updateType(
    @Param('breakId') breakId: string,
    @Body('type') type: string,
  ) {
    return this.service.updateType(breakId, type);
  }

  @Patch(':breakId/reason')
  @Permission('attendance.breaks.manage')
  updateReason(
    @Param('breakId') breakId: string,
    @Body('reason') reason: string,
  ) {
    return this.service.updateReason(breakId, reason);
  }
}
