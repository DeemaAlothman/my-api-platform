import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards, Req,
} from '@nestjs/common';
import { CasesService } from './cases.service';
import { CreateCaseDto, UpdateCaseDto, UpdateStatusDto, ListCasesQueryDto } from './dto/case.dto';
import { UpperLimbAssessmentDto, LowerLimbAssessmentDto } from './dto/assessment.dto';
import { CommitteeOpinionDto, CommitteeDecideDto, CommitteeSignDto } from './dto/committee.dto';
import {
  AddComponentDto, GaitAnalysisDto, BalanceAssessmentDto,
  TreatmentPlanDto, WorkshopSessionDto, PtSessionDto, MediaSessionDto, ConsumableDto,
} from './dto/treatment.dto';
import {
  FinalEvaluationDto, DirectorSignDto, DeliveryDto,
  PatientSignDto, ManagerSignDto, FollowUpDto, GaitSignDto,
} from './dto/delivery.dto';
import { JwtAuthGuard } from '@shared/auth';
import { PermissionsGuard } from '@shared/guards/permissions.guard';
import { Permission } from '@shared/decorators/permission.decorator';
import { PERMISSIONS } from '@shared/constants/permissions.constants';
import { User } from '@shared/auth/decorators/current-user.decorator';

@Controller('prosthetics/cases')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CasesController {
  constructor(private readonly service: CasesService) {}

  // ── Cases ─────────────────────────────────────────────────────────────────

  @Post()
  @Permission(PERMISSIONS.CLINIC_PROSTHETICS.CASE_CREATE)
  create(@Body() dto: CreateCaseDto, @User() user: any) {
    return this.service.create(dto, user.userId);
  }

  @Get()
  @Permission(PERMISSIONS.CLINIC_PROSTHETICS.CASE_VIEW)
  findAll(@Query() query: ListCasesQueryDto) {
    return this.service.findAll(query);
  }

  @Get('by-patient/:patientId')
  @Permission(PERMISSIONS.CLINIC_PROSTHETICS.CASE_VIEW)
  findByPatient(@Param('patientId') patientId: string) {
    return this.service.findByPatient(patientId);
  }

  @Get(':id')
  @Permission(PERMISSIONS.CLINIC_PROSTHETICS.CASE_VIEW)
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Put(':id')
  @Permission(PERMISSIONS.CLINIC_PROSTHETICS.CASE_CREATE)
  update(@Param('id') id: string, @Body() dto: UpdateCaseDto) {
    return this.service.update(id, dto);
  }

  @Put(':id/status')
  @Permission(PERMISSIONS.CLINIC_PROSTHETICS.CASE_CREATE)
  updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) {
    return this.service.updateStatus(id, dto);
  }

  // ── Assessments ───────────────────────────────────────────────────────────

  @Post(':id/assessment-upper')
  @Permission(PERMISSIONS.CLINIC_PROSTHETICS.ASSESSMENT_CREATE)
  upsertUpperAssessment(@Param('id') id: string, @Body() dto: UpperLimbAssessmentDto) {
    return this.service.upsertUpperAssessment(id, dto);
  }

  @Post(':id/assessment-lower')
  @Permission(PERMISSIONS.CLINIC_PROSTHETICS.ASSESSMENT_CREATE)
  upsertLowerAssessment(@Param('id') id: string, @Body() dto: LowerLimbAssessmentDto) {
    return this.service.upsertLowerAssessment(id, dto);
  }

  // ── Committee ─────────────────────────────────────────────────────────────

  @Post(':id/committee/opinion')
  @Permission(PERMISSIONS.CLINIC_PROSTHETICS.COMMITTEE_OPINION)
  submitOpinion(@Param('id') id: string, @Body() dto: CommitteeOpinionDto, @User() user: any) {
    return this.service.submitCommitteeOpinion(id, dto, user.userId);
  }

  @Put(':id/committee/decide')
  @Permission(PERMISSIONS.CLINIC_PROSTHETICS.COMMITTEE_DECIDE)
  decide(@Param('id') id: string, @Body() dto: CommitteeDecideDto, @User() user: any) {
    return this.service.committeeDecide(id, dto, user.userId);
  }

  @Post(':id/committee/sign')
  @Permission(PERMISSIONS.CLINIC_PROSTHETICS.COMMITTEE_SIGN)
  committeeSign(@Param('id') id: string, @Body() dto: CommitteeSignDto, @User() user: any, @Req() req: any) {
    const ip = req.ip || req.headers['x-forwarded-for'] || '';
    return this.service.committeeSign(id, dto, user.userId, ip);
  }

  @Get(':id/committee/pending')
  @Permission(PERMISSIONS.CLINIC_PROSTHETICS.CASE_VIEW)
  getCommitteePending(@Param('id') id: string) {
    return this.service.getCommitteePending(id);
  }

  // ── Components ────────────────────────────────────────────────────────────

  @Post(':id/components')
  @Permission(PERMISSIONS.CLINIC_PROSTHETICS.COMPONENTS_ADD)
  addComponent(@Param('id') id: string, @Body() dto: AddComponentDto, @User() user: any) {
    return this.service.addComponent(id, dto, user.userId);
  }

  @Get(':id/components')
  @Permission(PERMISSIONS.CLINIC_PROSTHETICS.CASE_VIEW)
  getComponents(@Param('id') id: string) {
    return this.service.getComponents(id);
  }

  @Delete(':id/components/:compId')
  @Permission(PERMISSIONS.CLINIC_PROSTHETICS.COMPONENTS_ADD)
  removeComponent(@Param('id') id: string, @Param('compId') compId: string) {
    return this.service.removeComponent(id, compId);
  }

  // ── Gait Analysis ─────────────────────────────────────────────────────────

  @Post(':id/gait-analysis')
  @Permission(PERMISSIONS.CLINIC_PROSTHETICS.GAIT_CREATE)
  upsertGait(@Param('id') id: string, @Body() dto: GaitAnalysisDto) {
    return this.service.upsertGaitAnalysis(id, dto);
  }

  @Put(':id/gait-analysis')
  @Permission(PERMISSIONS.CLINIC_PROSTHETICS.GAIT_CREATE)
  updateGait(@Param('id') id: string, @Body() dto: GaitAnalysisDto) {
    return this.service.upsertGaitAnalysis(id, dto);
  }

  @Post(':id/gait-analysis/sign')
  @Permission(PERMISSIONS.CLINIC_PROSTHETICS.COMMITTEE_SIGN)
  signGait(@Param('id') id: string, @Body() dto: GaitSignDto, @User() user: any) {
    return this.service.signGaitAnalysis(id, dto, user.userId);
  }

  // ── Balance Assessment ────────────────────────────────────────────────────

  @Post(':id/balance-assessment')
  @Permission(PERMISSIONS.CLINIC_PROSTHETICS.ASSESSMENT_CREATE)
  createBalance(@Param('id') id: string, @Body() dto: BalanceAssessmentDto) {
    return this.service.createBalanceAssessment(id, dto);
  }

  // ── Treatment Plan ────────────────────────────────────────────────────────

  @Post(':id/treatment-plan')
  @Permission(PERMISSIONS.CLINIC_PROSTHETICS.GAIT_CREATE)
  createPlan(@Param('id') id: string, @Body() dto: TreatmentPlanDto) {
    return this.service.createTreatmentPlan(id, dto);
  }

  @Post(':id/sessions/workshop')
  @Permission(PERMISSIONS.CLINIC_PROSTHETICS.GAIT_CREATE)
  addWorkshopSession(@Param('id') id: string, @Body() dto: WorkshopSessionDto) {
    return this.service.addWorkshopSession(id, dto);
  }

  @Post(':id/sessions/pt')
  @Permission(PERMISSIONS.CLINIC_PROSTHETICS.GAIT_CREATE)
  addPtSession(@Param('id') id: string, @Body() dto: PtSessionDto) {
    return this.service.addPtSession(id, dto);
  }

  @Post(':id/sessions/media')
  @Permission(PERMISSIONS.CLINIC_PROSTHETICS.GAIT_CREATE)
  addMediaSession(@Param('id') id: string, @Body() dto: MediaSessionDto) {
    return this.service.addMediaSession(id, dto);
  }

  // ── Consumables ───────────────────────────────────────────────────────────

  @Post(':id/consumables')
  @Permission(PERMISSIONS.CLINIC_PROSTHETICS.COMPONENTS_ADD)
  addConsumable(@Param('id') id: string, @Body() dto: ConsumableDto, @User() user: any) {
    return this.service.addConsumable(id, dto, user.userId);
  }

  // ── Final Evaluation ──────────────────────────────────────────────────────

  @Post(':id/final-evaluation')
  @Permission(PERMISSIONS.CLINIC_PROSTHETICS.DELIVERY_CREATE)
  createFinalEval(@Param('id') id: string, @Body() dto: FinalEvaluationDto) {
    return this.service.createFinalEvaluation(id, dto);
  }

  @Post(':id/final-evaluation/director-sign')
  @Permission(PERMISSIONS.CLINIC_PROSTHETICS.DELIVERY_APPROVE)
  directorSign(@Param('id') id: string, @Body() dto: DirectorSignDto, @User() user: any, @Req() req: any) {
    const ip = req.ip || req.headers['x-forwarded-for'] || '';
    return this.service.directorSign(id, dto, user.userId, ip);
  }

  // ── Delivery ──────────────────────────────────────────────────────────────

  @Post(':id/delivery')
  @Permission(PERMISSIONS.CLINIC_PROSTHETICS.DELIVERY_CREATE)
  createDelivery(@Param('id') id: string, @Body() dto: DeliveryDto) {
    return this.service.createDelivery(id, dto);
  }

  @Post(':id/delivery/patient-sign')
  @Permission(PERMISSIONS.CLINIC_PROSTHETICS.DELIVERY_CREATE)
  patientSign(@Param('id') id: string, @Body() dto: PatientSignDto) {
    return this.service.patientSign(id, dto);
  }

  @Post(':id/delivery/manager-sign')
  @Permission(PERMISSIONS.CLINIC_PROSTHETICS.DELIVERY_APPROVE)
  managerSign(@Param('id') id: string, @Body() dto: ManagerSignDto) {
    return this.service.managerSign(id, dto);
  }

  // ── Follow-ups ────────────────────────────────────────────────────────────

  @Post(':id/follow-ups')
  @Permission(PERMISSIONS.CLINIC_PROSTHETICS.CASE_CREATE)
  addFollowUp(@Param('id') id: string, @Body() dto: FollowUpDto, @User() user: any) {
    return this.service.addFollowUp(id, dto, user.userId);
  }

  @Get(':id/follow-ups')
  @Permission(PERMISSIONS.CLINIC_PROSTHETICS.CASE_VIEW)
  getFollowUps(@Param('id') id: string) {
    return this.service.getFollowUps(id);
  }
}
