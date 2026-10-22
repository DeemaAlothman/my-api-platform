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
import { orthoticsAttachmentMulterOptions } from './orthotics-files.config';
import { JwtAuthGuard, User } from '@shared/auth';
import { PermissionsGuard, Permission, PERMISSIONS } from '@shared';

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
  findAll(@Query('patientId') patientId?: string) {
    return this.service.findAll(patientId);
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
  @Patch(':id/prosthetist-opinion')
  upsertProsthetistOpinion(@Param('id') id: string, @Body() dto: ProsthetistOpinionDto) {
    return this.service.upsertProsthetistOpinion(id, dto);
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

  @Permission(PERMISSIONS.CLINIC_ORTHOTICS.EDIT)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateReceptionDto) {
    return this.service.update(id, dto);
  }

  @Permission(PERMISSIONS.CLINIC_ORTHOTICS.DELETE)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
