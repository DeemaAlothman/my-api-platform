import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards, UploadedFile, UseInterceptors, Req, Res, NotFoundException,
} from '@nestjs/common';
import type { Response } from 'express';
import { createReadStream, existsSync } from 'fs';
import { FileInterceptor } from '@nestjs/platform-express';
import { PatientsService } from './patients.service';
import { patientDocumentMulterOptions } from './patient-files.config';
import { CreatePatientDto } from './dto/create-patient.dto';
import { ListPatientsQueryDto } from './dto/list-patients.query.dto';
import { CreateConsentDto } from './dto/create-consent.dto';
import { JwtAuthGuard } from '@shared/auth';
import { PermissionsGuard } from '@shared/guards/permissions.guard';
import { Permission } from '@shared/decorators/permission.decorator';
import { PERMISSIONS } from '@shared/constants/permissions.constants';
import { User } from '@shared/auth/decorators/current-user.decorator';
import { InternalAuthGuard } from '@shared';

// نقطة داخلية (خدمة-لخدمة): تحقق وجود مريض — محمية بـ InternalAuthGuard فقط
@Controller('patients/internal')
export class PatientsInternalController {
  constructor(private readonly service: PatientsService) {}

  @Get(':id/exists')
  @UseGuards(InternalAuthGuard)
  exists(@Param('id') id: string) {
    return this.service.existsInternal(id);
  }

  @Post('find-by-ids')
  @UseGuards(InternalAuthGuard)
  findByIds(@Body() body: { patientIds: string[] }) {
    return this.service.findByIdsInternal(body?.patientIds ?? []);
  }
}

@Controller('patients')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PatientsController {
  constructor(private readonly service: PatientsService) {}

  // ── Patients ──────────────────────────────────────────────────────

  @Get('check-duplicate')
  @Permission(PERMISSIONS.CLINIC_PATIENTS.VIEW)
  checkDuplicate(@Query('idNumber') idNumber: string) {
    return this.service.checkDuplicate(idNumber);
  }

  @Get()
  @Permission(PERMISSIONS.CLINIC_PATIENTS.VIEW)
  findAll(@Query() query: ListPatientsQueryDto) {
    return this.service.findAll(query);
  }

  @Post()
  @Permission(PERMISSIONS.CLINIC_PATIENTS.CREATE)
  create(@Body() dto: CreatePatientDto, @User() user: any) {
    return this.service.create(dto, user.userId);
  }

  @Get(':id')
  @Permission(PERMISSIONS.CLINIC_PATIENTS.VIEW)
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Put(':id')
  @Permission(PERMISSIONS.CLINIC_PATIENTS.EDIT)
  update(@Param('id') id: string, @Body() dto: Partial<CreatePatientDto>) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Permission(PERMISSIONS.CLINIC_PATIENTS.DELETE)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  // ── Documents ─────────────────────────────────────────────────────

  @Post(':id/documents')
  @Permission(PERMISSIONS.CLINIC_PATIENTS.UPLOAD_DOCUMENTS)
  @UseInterceptors(FileInterceptor('file', patientDocumentMulterOptions))
  uploadDocument(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('type') type: string,
    @User() user: any,
  ) {
    return this.service.addDocument(id, file, type, user.userId);
  }

  @Get(':id/documents')
  @Permission(PERMISSIONS.CLINIC_PATIENTS.VIEW_DOCUMENTS)
  getDocuments(@Param('id') id: string) {
    return this.service.getDocuments(id);
  }

  @Get(':id/documents/:docId/download')
  @Permission(PERMISSIONS.CLINIC_PATIENTS.VIEW_DOCUMENTS)
  async downloadDocument(
    @Param('id') id: string,
    @Param('docId') docId: string,
    @Res() res: Response,
  ) {
    const doc = await this.service.getDocumentForDownload(id, docId);
    if (!existsSync(doc.filePath)) {
      throw new NotFoundException('ملف الوثيقة غير موجود على الخادم');
    }
    res.set({
      'Content-Type': doc.mimeType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(doc.fileName)}"`,
    });
    createReadStream(doc.filePath).pipe(res);
  }

  @Delete(':id/documents/:docId')
  @Permission(PERMISSIONS.CLINIC_PATIENTS.UPLOAD_DOCUMENTS)
  deleteDocument(@Param('id') id: string, @Param('docId') docId: string) {
    return this.service.deleteDocument(id, docId);
  }

  // ── Consents ──────────────────────────────────────────────────────

  @Post(':id/consents')
  @Permission(PERMISSIONS.CLINIC_PATIENTS.CREATE_CONSENTS)
  addConsent(
    @Param('id') id: string,
    @Body() dto: CreateConsentDto,
    @User() user: any,
    @Req() req: any,
  ) {
    const ip = req.ip || req.headers['x-forwarded-for'] || '';
    return this.service.addConsent(id, dto, user.userId, ip);
  }

  @Get(':id/consents')
  @Permission(PERMISSIONS.CLINIC_PATIENTS.VIEW_CONSENTS)
  getConsents(@Param('id') id: string) {
    return this.service.getConsents(id);
  }

  // ── Notes ─────────────────────────────────────────────────────────

  @Post(':id/notes')
  @Permission(PERMISSIONS.CLINIC_PATIENTS.CREATE_NOTES)
  addNote(
    @Param('id') id: string,
    @Body('body') body: string,
    @User() user: any,
  ) {
    return this.service.addNote(id, body, user.userId);
  }

  @Get(':id/notes')
  @Permission(PERMISSIONS.CLINIC_PATIENTS.VIEW)
  getNotes(@Param('id') id: string) {
    return this.service.getNotes(id);
  }
}
