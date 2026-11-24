import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, Res,
  UploadedFile, UseInterceptors, NotFoundException,
} from '@nestjs/common';
import type { Response } from 'express';
import { existsSync, createReadStream } from 'fs';
import { FileInterceptor } from '@nestjs/platform-express';
import { ReceptionsService } from './receptions.service';
import { CreateReceptionDto } from './dto/create-reception.dto';
import { UpdateReceptionDto } from './dto/update-reception.dto';
import { DoctorAssessmentDto } from './dto/doctor-assessment.dto';
import { PhysioAssessmentDto } from './dto/physio-assessment.dto';
import { ProsthetistOpinionDto } from './dto/prosthetist-opinion.dto';
import { AssignPractitionersDto } from './dto/assign-practitioners.dto';
import { SuitabilityDto } from './dto/suitability.dto';
import { OrthoticsFollowUpDto } from './dto/follow-up.dto';
import { CreateMeasurementSheetDto } from './dto/create-measurement-sheet.dto';
import { orthoticsAttachmentMulterOptions } from './orthotics-files.config';
import { JwtAuthGuard, User } from '@shared/auth';
import { PermissionsGuard, Permission, PERMISSIONS, InternalAuthGuard } from '@shared';

// نقطة داخلية (خدمة-لخدمة): تحويل حالة معاينة طبيب (من خدمة physio) إلى استقبال مقومات جديد
@Controller('orthotics/receptions/internal')
export class ReceptionsInternalController {
  constructor(private readonly service: ReceptionsService) {}

  @Post('from-exam')
  @UseGuards(InternalAuthGuard)
  createFromExam(@Body() body: { patientId: string; specialistId?: string; createdBy?: string }) {
    return this.service.createFromExam(body.patientId, body.specialistId, body.createdBy);
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('orthotics/receptions')
export class ReceptionsController {
  constructor(private readonly service: ReceptionsService) {}

  @Permission(PERMISSIONS.CLINIC_ORTHOTICS.CREATE)
  @Post()
  create(@Body() dto: CreateReceptionDto, @User() user: any) {
    return this.service.create(dto, user.userId);
  }

  @Permission(PERMISSIONS.CLINIC_ORTHOTICS.VIEW)
  @Get()
  findAll(
    @Query('patientId') patientId?: string,
    @Query('isSuitable') isSuitable?: string,
    @Query('status') status?: string,
  ) {
    return this.service.findAll(patientId, isSuitable, status);
  }

  // قبل :id حتى ما تنبلع كمعرّف
  @Permission(PERMISSIONS.CLINIC_ORTHOTICS.VIEW)
  @Get('my-patients')
  async findMyPatients(@User() user: any) {
    const practitionerId = await this.service.resolveEmployeeIdByUserId(user.userId);
    if (!practitionerId) return [];
    return this.service.findMyPatients(practitionerId);
  }

  @Permission(PERMISSIONS.CLINIC_ORTHOTICS.VIEW)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Permission(PERMISSIONS.CLINIC_ORTHOTICS.EDIT)
  @Patch(':id/practitioners')
  assignPractitioners(@Param('id') id: string, @Body() dto: AssignPractitionersDto) {
    return this.service.assignPractitioners(id, dto);
  }

  @Permission(PERMISSIONS.CLINIC_ORTHOTICS.DOCTOR_ASSESSMENT_EDIT)
  @Patch(':id/doctor-assessment')
  upsertDoctorAssessment(@Param('id') id: string, @Body() dto: DoctorAssessmentDto, @User() user: any) {
    return this.service.upsertDoctorAssessment(id, dto, user.userId);
  }

  @Permission(PERMISSIONS.CLINIC_ORTHOTICS.PHYSIO_ASSESSMENT_EDIT)
  @Patch(':id/physio-assessment')
  upsertPhysioAssessment(@Param('id') id: string, @Body() dto: PhysioAssessmentDto, @User() user: any) {
    return this.service.upsertPhysioAssessment(id, dto, user.userId);
  }

  @Permission(PERMISSIONS.CLINIC_ORTHOTICS.PROSTHETIST_OPINION_EDIT)
  // قرار المناسبة — مناسب / غير مناسب مع ملاحظة وعدد المقومات المستهدفة
  @Permission(PERMISSIONS.CLINIC_ORTHOTICS.EDIT)
  @Patch(':id/suitability')
  setSuitability(@Param('id') id: string, @Body() dto: SuitabilityDto, @User() user: any) {
    return this.service.setSuitability(id, dto, user.userId);
  }

  // تم التسليم — يدوي، من «أُخذ القياس» فقط، ونهائي
  @Permission(PERMISSIONS.CLINIC_ORTHOTICS.DELIVER)
  @Patch(':id/deliver')
  deliver(@Param('id') id: string, @User() user: any) {
    return this.service.deliver(id, user.userId);
  }

  // ── جلسات المتابعة ────────────────────────────────────────────────────────

  @Permission(PERMISSIONS.CLINIC_ORTHOTICS.EDIT)
  @Post(':id/follow-ups')
  addFollowUp(@Param('id') id: string, @Body() dto: OrthoticsFollowUpDto, @User() user: any) {
    return this.service.addFollowUp(id, dto, user.userId);
  }

  @Permission(PERMISSIONS.CLINIC_ORTHOTICS.VIEW)
  @Get(':id/follow-ups')
  getFollowUps(@Param('id') id: string) {
    return this.service.getFollowUps(id);
  }

  @Permission(PERMISSIONS.CLINIC_ORTHOTICS.EDIT)
  @Patch(':id/follow-ups/:followUpId')
  updateFollowUp(
    @Param('id') id: string,
    @Param('followUpId') followUpId: string,
    @Body() dto: OrthoticsFollowUpDto,
  ) {
    return this.service.updateFollowUp(id, followUpId, dto);
  }

  @Permission(PERMISSIONS.CLINIC_ORTHOTICS.EDIT)
  @Delete(':id/follow-ups/:followUpId')
  deleteFollowUp(@Param('id') id: string, @Param('followUpId') followUpId: string) {
    return this.service.deleteFollowUp(id, followUpId);
  }

  @Patch(':id/prosthetist-opinion')
  upsertProsthetistOpinion(@Param('id') id: string, @Body() dto: ProsthetistOpinionDto, @User() user: any) {
    return this.service.upsertProsthetistOpinion(id, dto, user.userId);
  }

  // ── Attachments ────────────────────────────────────────────────────

  @Post(':id/attachments')
  @Permission(PERMISSIONS.CLINIC_ORTHOTICS.UPLOAD_ATTACHMENTS)
  @UseInterceptors(FileInterceptor('file', orthoticsAttachmentMulterOptions))
  uploadAttachment(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @User() user: any,
  ) {
    return this.service.addAttachment(id, file, user.userId);
  }

  @Get(':id/attachments')
  @Permission(PERMISSIONS.CLINIC_ORTHOTICS.VIEW_ATTACHMENTS)
  getAttachments(@Param('id') id: string) {
    return this.service.getAttachments(id);
  }

  @Get(':id/attachments/:attachmentId/download')
  @Permission(PERMISSIONS.CLINIC_ORTHOTICS.VIEW_ATTACHMENTS)
  async downloadAttachment(
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @Res() res: Response,
  ) {
    const att = await this.service.getAttachmentForDownload(id, attachmentId);
    if (!existsSync(att.fileUrl)) {
      throw new NotFoundException('الملف غير موجود على الخادم');
    }
    res.set({
      'Content-Type': att.mimeType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(att.fileName)}"`,
    });
    createReadStream(att.fileUrl).pipe(res);
  }

  @Delete(':id/attachments/:attachmentId')
  @Permission(PERMISSIONS.CLINIC_ORTHOTICS.UPLOAD_ATTACHMENTS)
  deleteAttachment(@Param('id') id: string, @Param('attachmentId') attachmentId: string) {
    return this.service.deleteAttachment(id, attachmentId);
  }

  // ── أوراق قياس المقومات ──────────────────────────────────────────────

  @Post(':id/measurements')
  @Permission(PERMISSIONS.CLINIC_ORTHOTICS.MEASUREMENT_CREATE)
  addMeasurementSheet(
    @Param('id') id: string,
    @Body() dto: CreateMeasurementSheetDto,
    @User() user: any,
  ) {
    return this.service.addMeasurementSheet(id, dto, user.userId);
  }

  @Get(':id/measurements')
  @Permission(PERMISSIONS.CLINIC_ORTHOTICS.VIEW)
  getMeasurementSheets(@Param('id') id: string, @Query('sheet') sheet?: string) {
    return this.service.getMeasurementSheets(id, sheet);
  }

  @Permission(PERMISSIONS.CLINIC_ORTHOTICS.EDIT)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateReceptionDto) {
    return this.service.update(id, dto);
  }

  @Permission(PERMISSIONS.CLINIC_ORTHOTICS.DELETE)
  @Delete(':id')
  remove(@Param('id') id: string, @User() user: any) {
    return this.service.remove(id, user.userId);
  }
}
