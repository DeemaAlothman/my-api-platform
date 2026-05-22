import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards, Req,
} from '@nestjs/common';
import { CasesService } from './cases.service';
import {
  CreatePhysioCaseDto, UpdatePhysioCaseDto, UpdatePhysioStatusDto, ListPhysioCasesQueryDto,
  PainMapDto, MedicalHistoryDto, SurgeryDto, TreatmentGoalsDto,
  PosturalAssessmentDto, TreatmentPlanDto, SupervisorReviewDto, PlanSignDto,
  PhysioSessionDto, UpdateSessionDto,
} from './dto/physio-case.dto';
import { JwtAuthGuard } from '@shared/auth';
import { PermissionsGuard } from '@shared/guards/permissions.guard';
import { Permission } from '@shared/decorators/permission.decorator';
import { PERMISSIONS } from '@shared/constants/permissions.constants';
import { User } from '@shared/auth/decorators/current-user.decorator';

@Controller('physio/cases')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CasesController {
  constructor(private readonly service: CasesService) {}

  // ── Cases ─────────────────────────────────────────────────────────────────

  @Post()
  @Permission(PERMISSIONS.CLINIC_PHYSIO.CASE_CREATE)
  create(@Body() dto: CreatePhysioCaseDto, @User() user: any) {
    return this.service.create(dto, user.userId);
  }

  @Get()
  @Permission(PERMISSIONS.CLINIC_PHYSIO.CASE_VIEW)
  findAll(@Query() query: ListPhysioCasesQueryDto) {
    return this.service.findAll(query);
  }

  @Get('by-patient/:patientId')
  @Permission(PERMISSIONS.CLINIC_PHYSIO.CASE_VIEW)
  findByPatient(@Param('patientId') patientId: string) {
    return this.service.findByPatient(patientId);
  }

  @Get(':id')
  @Permission(PERMISSIONS.CLINIC_PHYSIO.CASE_VIEW)
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Put(':id')
  @Permission(PERMISSIONS.CLINIC_PHYSIO.CASE_CREATE)
  update(@Param('id') id: string, @Body() dto: UpdatePhysioCaseDto) {
    return this.service.update(id, dto);
  }

  @Put(':id/status')
  @Permission(PERMISSIONS.CLINIC_PHYSIO.CASE_CREATE)
  updateStatus(@Param('id') id: string, @Body() dto: UpdatePhysioStatusDto) {
    return this.service.updateStatus(id, dto);
  }

  // ── Pain Map ──────────────────────────────────────────────────────────────

  @Post(':id/pain-map')
  @Permission(PERMISSIONS.CLINIC_PHYSIO.ASSESSMENT_CREATE)
  upsertPainMap(@Param('id') id: string, @Body() dto: PainMapDto) {
    return this.service.upsertPainMap(id, dto);
  }

  @Put(':id/pain-map')
  @Permission(PERMISSIONS.CLINIC_PHYSIO.ASSESSMENT_CREATE)
  updatePainMap(@Param('id') id: string, @Body() dto: PainMapDto) {
    return this.service.upsertPainMap(id, dto);
  }

  // ── Medical History ───────────────────────────────────────────────────────

  @Post(':id/medical-history')
  @Permission(PERMISSIONS.CLINIC_PHYSIO.ASSESSMENT_CREATE)
  upsertMedicalHistory(@Param('id') id: string, @Body() dto: MedicalHistoryDto) {
    return this.service.upsertMedicalHistory(id, dto);
  }

  @Post(':id/medical-history/surgeries')
  @Permission(PERMISSIONS.CLINIC_PHYSIO.ASSESSMENT_CREATE)
  addSurgery(@Param('id') id: string, @Body() dto: SurgeryDto) {
    return this.service.addSurgery(id, dto);
  }

  // ── Treatment Goals ───────────────────────────────────────────────────────

  @Post(':id/goals')
  @Permission(PERMISSIONS.CLINIC_PHYSIO.ASSESSMENT_CREATE)
  upsertGoals(@Param('id') id: string, @Body() dto: TreatmentGoalsDto) {
    return this.service.upsertTreatmentGoals(id, dto);
  }

  // ── Postural Assessment ───────────────────────────────────────────────────

  @Post(':id/postural-assessment')
  @Permission(PERMISSIONS.CLINIC_PHYSIO.ASSESSMENT_CREATE)
  upsertPostural(@Param('id') id: string, @Body() dto: PosturalAssessmentDto) {
    return this.service.upsertPosturalAssessment(id, dto);
  }

  // ── Treatment Plan ────────────────────────────────────────────────────────

  @Post(':id/treatment-plan')
  @Permission(PERMISSIONS.CLINIC_PHYSIO.ASSESSMENT_CREATE)
  upsertPlan(@Param('id') id: string, @Body() dto: TreatmentPlanDto) {
    return this.service.upsertTreatmentPlan(id, dto);
  }

  @Put(':id/treatment-plan')
  @Permission(PERMISSIONS.CLINIC_PHYSIO.ASSESSMENT_CREATE)
  updatePlan(@Param('id') id: string, @Body() dto: TreatmentPlanDto) {
    return this.service.upsertTreatmentPlan(id, dto);
  }

  @Put(':id/treatment-plan/supervisor-review')
  @Permission(PERMISSIONS.CLINIC_PHYSIO.ASSESSMENT_CREATE)
  supervisorReview(@Param('id') id: string, @Body() dto: SupervisorReviewDto, @User() user: any) {
    return this.service.supervisorReview(id, dto, user.userId);
  }

  @Post(':id/treatment-plan/doctor-sign')
  @Permission(PERMISSIONS.CLINIC_PHYSIO.PLAN_SIGN)
  planSign(@Param('id') id: string, @Body() dto: PlanSignDto, @User() user: any) {
    return this.service.planSign(id, dto, user.userId);
  }

  // ── Sessions ──────────────────────────────────────────────────────────────

  @Post(':id/sessions')
  @Permission(PERMISSIONS.CLINIC_PHYSIO.SESSIONS_CREATE)
  addSession(@Param('id') id: string, @Body() dto: PhysioSessionDto) {
    return this.service.addSession(id, dto);
  }

  @Get(':id/sessions')
  @Permission(PERMISSIONS.CLINIC_PHYSIO.CASE_VIEW)
  getSessions(@Param('id') id: string) {
    return this.service.getSessions(id);
  }

  @Put(':id/sessions/:sessionId')
  @Permission(PERMISSIONS.CLINIC_PHYSIO.SESSIONS_CREATE)
  updateSession(@Param('id') id: string, @Param('sessionId') sessionId: string, @Body() dto: UpdateSessionDto) {
    return this.service.updateSession(id, sessionId, dto);
  }

  @Delete(':id/sessions/:sessionId')
  @Permission(PERMISSIONS.CLINIC_PHYSIO.SESSIONS_CREATE)
  deleteSession(@Param('id') id: string, @Param('sessionId') sessionId: string) {
    return this.service.deleteSession(id, sessionId);
  }

  // ── Timeline ──────────────────────────────────────────────────────────────

  @Get(':id/timeline')
  @Permission(PERMISSIONS.CLINIC_PHYSIO.CASE_VIEW)
  getTimeline(@Param('id') id: string) {
    return this.service.getTimeline(id);
  }
}
