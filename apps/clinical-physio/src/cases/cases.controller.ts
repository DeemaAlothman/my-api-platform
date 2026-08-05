import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards, Req, Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { CasesService } from './cases.service';
import { PdfService } from './pdf.service';
import {
  CreatePhysioCaseDto, UpdatePhysioCaseDto, UpdatePhysioStatusDto, ListPhysioCasesQueryDto,
  ComplaintDto, EvaluationDto, PainMapDto, MedicalHistoryDto, SurgeryDto, TreatmentGoalsDto,
  PosturalAssessmentDto, TreatmentPlanDto, SupervisorReviewDto, DoctorReviewDto, PlanSignDto,
  PhysioSessionDto, UpdateSessionDto, FinalSummaryDto,
  PhysioFollowUpDto, UpdateFollowUpDto,
} from './dto/physio-case.dto';
import { JwtAuthGuard } from '@shared/auth';
import { PermissionsGuard } from '@shared/guards/permissions.guard';
import { Permission } from '@shared/decorators/permission.decorator';
import { PERMISSIONS } from '@shared/constants/permissions.constants';
import { User } from '@shared/auth/decorators/current-user.decorator';
import { InternalAuthGuard } from '@shared';

// نقطة داخلية (خدمة-لخدمة): حذف حالات العلاج الفيزيائي عند حذف مريض — محمية بـ InternalAuthGuard فقط
@Controller('physio/cases/internal')
export class CasesInternalController {
  constructor(private readonly service: CasesService) {}

  @Delete('by-patient/:patientId')
  @UseGuards(InternalAuthGuard)
  deleteByPatient(@Param('patientId') patientId: string) {
    return this.service.deleteByPatientInternal(patientId);
  }
}

@Controller('physio/cases')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CasesController {
  constructor(
    private readonly service: CasesService,
    private readonly pdfService: PdfService,
  ) {}

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

  // قائمة أنواع الألم المرجعية (النوع + الاسم + اللون) — لخريطة الألم
  @Get('pain-types')
  @Permission(PERMISSIONS.CLINIC_PHYSIO.CASE_VIEW)
  getPainTypes() {
    return this.service.getPainTypes();
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

  // ── الشكوى المرضية (Medical Complaint) ──────────────────────────────────────

  @Post(':id/complaint')
  @Permission(PERMISSIONS.CLINIC_PHYSIO.ASSESSMENT_CREATE)
  upsertComplaint(@Param('id') id: string, @Body() dto: ComplaintDto) {
    return this.service.upsertComplaint(id, dto);
  }

  @Put(':id/complaint')
  @Permission(PERMISSIONS.CLINIC_PHYSIO.ASSESSMENT_CREATE)
  updateComplaint(@Param('id') id: string, @Body() dto: ComplaintDto) {
    return this.service.upsertComplaint(id, dto);
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

  // ── الملاحظات والتقييم (Notes & Evaluation) ──────────────────────────────────

  @Post(':id/evaluation')
  @Permission(PERMISSIONS.CLINIC_PHYSIO.ASSESSMENT_CREATE)
  upsertEvaluation(@Param('id') id: string, @Body() dto: EvaluationDto) {
    return this.service.upsertEvaluation(id, dto);
  }

  @Put(':id/evaluation')
  @Permission(PERMISSIONS.CLINIC_PHYSIO.ASSESSMENT_CREATE)
  updateEvaluation(@Param('id') id: string, @Body() dto: EvaluationDto) {
    return this.service.upsertEvaluation(id, dto);
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
  @Permission(PERMISSIONS.CLINIC_PHYSIO.SUPERVISOR_REVIEW)
  supervisorReview(@Param('id') id: string, @Body() dto: SupervisorReviewDto, @User() user: any) {
    return this.service.supervisorReview(id, dto, user.userId);
  }

  @Put(':id/treatment-plan/doctor-review')
  @Permission(PERMISSIONS.CLINIC_PHYSIO.PLAN_SIGN)
  doctorReview(@Param('id') id: string, @Body() dto: DoctorReviewDto, @User() user: any) {
    return this.service.doctorReview(id, dto, user.userId);
  }

  @Post(':id/treatment-plan/doctor-sign')
  @Permission(PERMISSIONS.CLINIC_PHYSIO.PLAN_SIGN)
  planSign(@Param('id') id: string, @Body() dto: PlanSignDto, @User() user: any, @Req() req: any) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '';
    return this.service.planSign(id, dto, user.userId, ip);
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

  // ── Follow-ups ────────────────────────────────────────────────────────────

  @Post(':id/follow-ups')
  @Permission(PERMISSIONS.CLINIC_PHYSIO.SESSIONS_CREATE)
  addFollowUp(@Param('id') id: string, @Body() dto: PhysioFollowUpDto) {
    return this.service.addFollowUp(id, dto);
  }

  @Get(':id/follow-ups')
  @Permission(PERMISSIONS.CLINIC_PHYSIO.CASE_VIEW)
  getFollowUps(@Param('id') id: string) {
    return this.service.getFollowUps(id);
  }

  @Put(':id/follow-ups/:followUpId')
  @Permission(PERMISSIONS.CLINIC_PHYSIO.SESSIONS_CREATE)
  updateFollowUp(@Param('id') id: string, @Param('followUpId') followUpId: string, @Body() dto: UpdateFollowUpDto) {
    return this.service.updateFollowUp(id, followUpId, dto);
  }

  @Delete(':id/follow-ups/:followUpId')
  @Permission(PERMISSIONS.CLINIC_PHYSIO.SESSIONS_CREATE)
  deleteFollowUp(@Param('id') id: string, @Param('followUpId') followUpId: string) {
    return this.service.deleteFollowUp(id, followUpId);
  }

  // ── الملخص النهائي (Final Summary) ──────────────────────────────────────────

  @Post(':id/final-summary')
  @Permission(PERMISSIONS.CLINIC_PHYSIO.ASSESSMENT_CREATE)
  upsertFinalSummary(@Param('id') id: string, @Body() dto: FinalSummaryDto) {
    return this.service.upsertFinalSummary(id, dto);
  }

  @Put(':id/final-summary')
  @Permission(PERMISSIONS.CLINIC_PHYSIO.ASSESSMENT_CREATE)
  updateFinalSummary(@Param('id') id: string, @Body() dto: FinalSummaryDto) {
    return this.service.upsertFinalSummary(id, dto);
  }

  @Get(':id/final-summary/pdf')
  @Permission(PERMISSIONS.CLINIC_PHYSIO.CASE_VIEW)
  async getFinalSummaryPdf(@Param('id') id: string, @Res() res: Response) {
    const caseData = await this.service.findOne(id);
    const buffer = await this.pdfService.generateFinalSummaryReport(caseData);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="final-summary-${(caseData as any).caseNumber}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  // ── Timeline ──────────────────────────────────────────────────────────────

  @Get(':id/timeline')
  @Permission(PERMISSIONS.CLINIC_PHYSIO.CASE_VIEW)
  getTimeline(@Param('id') id: string) {
    return this.service.getTimeline(id);
  }

  // ── PDF Report ────────────────────────────────────────────────────────────

  @Get(':id/pdf')
  @Permission(PERMISSIONS.CLINIC_PHYSIO.CASE_VIEW)
  async getCasePdf(@Param('id') id: string, @Res() res: Response) {
    const caseData = await this.service.findOne(id);
    const buffer = await this.pdfService.generateCaseReport(caseData);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="case-${(caseData as any).caseNumber}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }
}
