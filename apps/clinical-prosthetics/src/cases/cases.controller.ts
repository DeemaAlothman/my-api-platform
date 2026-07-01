import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards, Req, Res, UploadedFile, UseInterceptors, NotFoundException,
} from '@nestjs/common';
import type { Response } from 'express';
import { createReadStream, existsSync } from 'fs';
import { FileInterceptor } from '@nestjs/platform-express';
import { CasesService } from './cases.service';
import { caseAttachmentMulterOptions } from './case-files.config';
import { PdfService } from './pdf.service';
import { CreateCaseDto, UpdateCaseDto, UpdateStatusDto, ListCasesQueryDto } from './dto/case.dto';
import { UpperLimbAssessmentDto, LowerLimbAssessmentDto, AnkleDisarticulationAssessmentDto, KneeDisarticulationAssessmentDto, TransfemoralAssessmentDto } from './dto/assessment.dto';
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
import { InternalAuthGuard } from '@shared';

// نقطة داخلية (خدمة-لخدمة): حذف حالات الأطراف الصناعية عند حذف مريض — محمية بـ InternalAuthGuard فقط
@Controller('prosthetics/cases/internal')
export class CasesInternalController {
  constructor(private readonly service: CasesService) {}

  @Delete('by-patient/:patientId')
  @UseGuards(InternalAuthGuard)
  deleteByPatient(@Param('patientId') patientId: string) {
    return this.service.deleteByPatientInternal(patientId);
  }
}

@Controller('prosthetics/cases')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CasesController {
  constructor(
    private readonly service: CasesService,
    private readonly pdfService: PdfService,
  ) {}

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

  @Post(':id/assessment-ankle-disarticulation')
  @Permission(PERMISSIONS.CLINIC_PROSTHETICS.ASSESSMENT_CREATE)
  upsertAnkleDisarticulation(@Param('id') id: string, @Body() dto: AnkleDisarticulationAssessmentDto) {
    return this.service.upsertAnkleDisarticulationAssessment(id, dto);
  }

  @Post(':id/assessment-knee-disarticulation')
  @Permission(PERMISSIONS.CLINIC_PROSTHETICS.ASSESSMENT_CREATE)
  upsertKneeDisarticulation(@Param('id') id: string, @Body() dto: KneeDisarticulationAssessmentDto) {
    return this.service.upsertKneeDisarticulationAssessment(id, dto);
  }

  @Post(':id/assessment-transfemoral')
  @Permission(PERMISSIONS.CLINIC_PROSTHETICS.ASSESSMENT_CREATE)
  upsertTransfemoral(@Param('id') id: string, @Body() dto: TransfemoralAssessmentDto) {
    return this.service.upsertTransfemoralAssessment(id, dto);
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

  // إضافة عدة مكونات بنداء واحد — يقبل مصفوفة من نفس حقول addComponent
  @Post(':id/components/bulk')
  @Permission(PERMISSIONS.CLINIC_PROSTHETICS.COMPONENTS_ADD)
  addComponentsBulk(@Param('id') id: string, @Body() dtos: AddComponentDto[], @User() user: any) {
    return this.service.addComponentsBulk(id, dtos, user.userId);
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

  // ── Timeline ──────────────────────────────────────────────────────────────

  @Get(':id/timeline')
  @Permission(PERMISSIONS.CLINIC_PROSTHETICS.CASE_VIEW)
  getTimeline(@Param('id') id: string) {
    return this.service.getTimeline(id);
  }

  // ── Attachments (صور البتر وغيرها — واحدة أو أكثر، كل صورة برفع منفصل) ─────────

  @Post(':id/attachments')
  @Permission(PERMISSIONS.CLINIC_PROSTHETICS.CASE_CREATE)
  @UseInterceptors(FileInterceptor('file', caseAttachmentMulterOptions))
  uploadAttachment(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('caption') caption: string,
    @User() user: any,
  ) {
    return this.service.addAttachment(id, file, caption, user.userId);
  }

  @Get(':id/attachments')
  @Permission(PERMISSIONS.CLINIC_PROSTHETICS.CASE_VIEW)
  getAttachments(@Param('id') id: string) {
    return this.service.getAttachments(id);
  }

  @Get(':id/attachments/:attachmentId/download')
  @Permission(PERMISSIONS.CLINIC_PROSTHETICS.CASE_VIEW)
  async downloadAttachment(
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @Res() res: Response,
  ) {
    const att = await this.service.getAttachmentForDownload(id, attachmentId);
    if (!existsSync(att.filePath)) {
      throw new NotFoundException('الملف غير موجود على الخادم');
    }
    res.set({
      'Content-Type': att.mimeType || 'application/octet-stream',
      'Content-Disposition': `inline; filename="${encodeURIComponent(att.fileName)}"`,
    });
    createReadStream(att.filePath).pipe(res);
  }

  @Delete(':id/attachments/:attachmentId')
  @Permission(PERMISSIONS.CLINIC_PROSTHETICS.CASE_CREATE)
  deleteAttachment(@Param('id') id: string, @Param('attachmentId') attachmentId: string) {
    return this.service.deleteAttachment(id, attachmentId);
  }

  // ── PDF Report ────────────────────────────────────────────────────────────

  @Get(':id/pdf')
  @Permission(PERMISSIONS.CLINIC_PROSTHETICS.CASE_VIEW)
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
