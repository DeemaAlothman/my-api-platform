import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { DoctorDecisionsService } from './doctor-decisions.service';
import { UpsertDoctorDecisionDto } from './dto/doctor-decision.dto';
import { JwtAuthGuard, User } from '@shared/auth';
import { PermissionsGuard, Permission, PERMISSIONS } from '@shared';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('podiatry/receptions/:receptionId/doctor-decision')
export class DoctorDecisionsController {
  constructor(private readonly service: DoctorDecisionsService) {}

  @Permission(PERMISSIONS.CLINIC_PODIATRY.SESSION_CREATE)
  @Post()
  upsert(
    @Param('receptionId') receptionId: string,
    @Body() dto: UpsertDoctorDecisionDto,
    @User() user: any,
  ) {
    return this.service.upsert(receptionId, dto, user.userId);
  }

  @Permission(PERMISSIONS.CLINIC_PODIATRY.RECEPTION_VIEW)
  @Get()
  findOne(@Param('receptionId') receptionId: string) {
    return this.service.findOne(receptionId);
  }

  @Permission(PERMISSIONS.CLINIC_PODIATRY.RECEPTION_VIEW)
  @Post('notify')
  notifyDoctor(@Param('receptionId') receptionId: string) {
    return this.service.notifyDoctor(receptionId);
  }
}
