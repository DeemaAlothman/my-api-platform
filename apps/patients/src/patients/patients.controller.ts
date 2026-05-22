import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards, UploadedFile, UseInterceptors, Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PatientsService } from './patients.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { ListPatientsQueryDto } from './dto/list-patients.query.dto';
import { CreateConsentDto } from './dto/create-consent.dto';
import { JwtAuthGuard } from '@shared/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '@shared/guards/permissions.guard';
import { RequirePermissions } from '@shared/decorators/permission.decorator';
import { PERMISSIONS } from '@shared/constants/permissions.constants';
import { CurrentUser } from '@shared/auth/decorators/current-user.decorator';

@Controller('patients')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PatientsController {
  constructor(private readonly service: PatientsService) {}

  // ── Patients ──────────────────────────────────────────────────────

  @Get('check-duplicate')
  @RequirePermissions(PERMISSIONS.CLINIC_PATIENTS.VIEW)
  checkDuplicate(@Query('idNumber') idNumber: string) {
    return this.service.checkDuplicate(idNumber);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.CLINIC_PATIENTS.VIEW)
  findAll(@Query() query: ListPatientsQueryDto) {
    return this.service.findAll(query);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.CLINIC_PATIENTS.CREATE)
  create(@Body() dto: CreatePatientDto, @CurrentUser() user: any) {
    return this.service.create(dto, user.sub);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.CLINIC_PATIENTS.VIEW)
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Put(':id')
  @RequirePermissions(PERMISSIONS.CLINIC_PATIENTS.EDIT)
  update(@Param('id') id: string, @Body() dto: Partial<CreatePatientDto>) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.CLINIC_PATIENTS.DELETE)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  // ── Documents ─────────────────────────────────────────────────────

  @Post(':id/documents')
  @RequirePermissions(PERMISSIONS.CLINIC_PATIENTS.UPLOAD_DOCUMENTS)
  @UseInterceptors(FileInterceptor('file'))
  uploadDocument(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('type') type: string,
    @CurrentUser() user: any,
  ) {
    return this.service.addDocument(id, file, type, user.sub);
  }

  @Get(':id/documents')
  @RequirePermissions(PERMISSIONS.CLINIC_PATIENTS.VIEW_DOCUMENTS)
  getDocuments(@Param('id') id: string) {
    return this.service.getDocuments(id);
  }

  @Delete(':id/documents/:docId')
  @RequirePermissions(PERMISSIONS.CLINIC_PATIENTS.UPLOAD_DOCUMENTS)
  deleteDocument(@Param('id') id: string, @Param('docId') docId: string) {
    return this.service.deleteDocument(id, docId);
  }

  // ── Consents ──────────────────────────────────────────────────────

  @Post(':id/consents')
  @RequirePermissions(PERMISSIONS.CLINIC_PATIENTS.VIEW_CONSENTS)
  addConsent(
    @Param('id') id: string,
    @Body() dto: CreateConsentDto,
    @CurrentUser() user: any,
    @Req() req: any,
  ) {
    const ip = req.ip || req.headers['x-forwarded-for'] || '';
    return this.service.addConsent(id, dto, user.sub, ip);
  }

  @Get(':id/consents')
  @RequirePermissions(PERMISSIONS.CLINIC_PATIENTS.VIEW_CONSENTS)
  getConsents(@Param('id') id: string) {
    return this.service.getConsents(id);
  }

  // ── Notes ─────────────────────────────────────────────────────────

  @Post(':id/notes')
  @RequirePermissions(PERMISSIONS.CLINIC_PATIENTS.VIEW)
  addNote(
    @Param('id') id: string,
    @Body('body') body: string,
    @CurrentUser() user: any,
  ) {
    return this.service.addNote(id, body, user.sub);
  }

  @Get(':id/notes')
  @RequirePermissions(PERMISSIONS.CLINIC_PATIENTS.VIEW)
  getNotes(@Param('id') id: string) {
    return this.service.getNotes(id);
  }
}
