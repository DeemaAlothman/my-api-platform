import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@shared/auth';
import { PermissionsGuard } from '@shared/guards/permissions.guard';
import { Permission } from '@shared/decorators/permission.decorator';
import { PERMISSIONS } from '@shared/constants/permissions.constants';
import { User } from '@shared/auth/decorators/current-user.decorator';
import { AssignmentsService } from './assignments.service';
import { CreateAssignmentDto, UpdateAssignmentDto, CancelAssignmentDto, ReorderAssignmentsDto } from './dto/assignment.dto';

const READ_PERMS = [
  PERMISSIONS.CLINIC_PATIENT_APP.ASSIGNMENT_CREATE,
  PERMISSIONS.CLINIC_PATIENT_APP.EXECUTION_VIEW,
] as const;

@Controller('patient-app')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AssignmentsController {
  constructor(private readonly service: AssignmentsService) {}

  // جلسات المريض الفيزيائية من ERP — لاختيار الجلسة عند إسناد تمرين (بند 6/15 بالتوصيف)
  @Get('patients/:erpPatientId/sessions')
  @Permission(...READ_PERMS)
  listErpSessions(@Param('erpPatientId') erpPatientId: string) {
    return this.service.listErpSessions(erpPatientId);
  }

  @Get('sessions/:erpSessionId/exercises')
  @Permission(...READ_PERMS)
  listBySession(@Param('erpSessionId') erpSessionId: string) {
    return this.service.listBySession(erpSessionId);
  }

  @Post('sessions/:erpSessionId/exercises')
  @Permission(PERMISSIONS.CLINIC_PATIENT_APP.ASSIGNMENT_CREATE)
  create(@Param('erpSessionId') erpSessionId: string, @Body() dto: CreateAssignmentDto, @User() user: any) {
    return this.service.create(erpSessionId, dto, user.userId);
  }

  @Patch('sessions/:erpSessionId/exercises/reorder')
  @Permission(PERMISSIONS.CLINIC_PATIENT_APP.ASSIGNMENT_EDIT)
  reorder(@Param('erpSessionId') erpSessionId: string, @Body() dto: ReorderAssignmentsDto) {
    return this.service.reorder(erpSessionId, dto);
  }

  @Patch('assignments/:id')
  @Permission(PERMISSIONS.CLINIC_PATIENT_APP.ASSIGNMENT_EDIT)
  update(@Param('id') id: string, @Body() dto: UpdateAssignmentDto) {
    return this.service.update(id, dto);
  }

  @Post('assignments/:id/cancel')
  @Permission(PERMISSIONS.CLINIC_PATIENT_APP.ASSIGNMENT_CANCEL)
  cancel(@Param('id') id: string, @Body() dto: CancelAssignmentDto, @User() user: any) {
    return this.service.cancel(id, dto.reason, user.userId);
  }

  @Get('patients/:erpPatientId/executions')
  @Permission(PERMISSIONS.CLINIC_PATIENT_APP.EXECUTION_VIEW)
  listExecutionsByPatient(@Param('erpPatientId') erpPatientId: string) {
    return this.service.listExecutionsByPatient(erpPatientId);
  }
}
