import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Res,
  UploadedFile, UseInterceptors, NotFoundException,
} from '@nestjs/common';
import type { Response } from 'express';
import { existsSync, createReadStream } from 'fs';
import { FileInterceptor } from '@nestjs/platform-express';
import { PotentialClientsService } from './potential-clients.service';
import { potentialClientAttachmentMulterOptions } from './potential-client-files.config';
import {
  CreatePotentialClientDto, UpdatePotentialClientDto, ListPotentialClientsQueryDto,
  ExportPotentialClientsQueryDto,
} from './dto/potential-client.dto';
import { JwtAuthGuard } from '@shared/auth';
import { PermissionsGuard } from '@shared/guards/permissions.guard';
import { Permission } from '@shared/decorators/permission.decorator';
import { PERMISSIONS } from '@shared/constants/permissions.constants';
import { User } from '@shared/auth/decorators/current-user.decorator';

@Controller('appointments/potential-clients')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PotentialClientsController {
  constructor(private readonly service: PotentialClientsService) {}

  @Post()
  @Permission(PERMISSIONS.CLINIC_POTENTIAL_CLIENTS.CREATE)
  create(@Body() dto: CreatePotentialClientDto, @User() user: any) {
    return this.service.create(dto, user.userId);
  }

  @Get()
  @Permission(PERMISSIONS.CLINIC_POTENTIAL_CLIENTS.VIEW)
  findAll(@Query() query: ListPotentialClientsQueryDto) {
    return this.service.findAll(query);
  }

  // قبل :id حتى ما ينفهم services / export-xlsx كمعرّف
  @Get('services')
  @Permission(PERMISSIONS.CLINIC_POTENTIAL_CLIENTS.VIEW)
  findServices() {
    return this.service.findServices();
  }

  @Get('export-xlsx')
  @Permission(PERMISSIONS.CLINIC_POTENTIAL_CLIENTS.VIEW)
  exportXlsx(@Query() query: ExportPotentialClientsQueryDto, @Res() res: Response) {
    return this.service.exportXlsx(query, res);
  }

  @Get(':id')
  @Permission(PERMISSIONS.CLINIC_POTENTIAL_CLIENTS.VIEW)
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Put(':id')
  @Permission(PERMISSIONS.CLINIC_POTENTIAL_CLIENTS.EDIT)
  update(@Param('id') id: string, @Body() dto: UpdatePotentialClientDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Permission(PERMISSIONS.CLINIC_POTENTIAL_CLIENTS.DELETE)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  // ── Attachments ────────────────────────────────────────────────────

  @Post(':id/attachments')
  @Permission(PERMISSIONS.CLINIC_POTENTIAL_CLIENTS.UPLOAD_ATTACHMENTS)
  @UseInterceptors(FileInterceptor('file', potentialClientAttachmentMulterOptions))
  uploadAttachment(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @User() user: any,
  ) {
    return this.service.addAttachment(id, file, user.userId);
  }

  @Get(':id/attachments')
  @Permission(PERMISSIONS.CLINIC_POTENTIAL_CLIENTS.VIEW_ATTACHMENTS)
  getAttachments(@Param('id') id: string) {
    return this.service.getAttachments(id);
  }

  @Get(':id/attachments/:attachmentId/download')
  @Permission(PERMISSIONS.CLINIC_POTENTIAL_CLIENTS.VIEW_ATTACHMENTS)
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
  @Permission(PERMISSIONS.CLINIC_POTENTIAL_CLIENTS.UPLOAD_ATTACHMENTS)
  deleteAttachment(@Param('id') id: string, @Param('attachmentId') attachmentId: string) {
    return this.service.deleteAttachment(id, attachmentId);
  }
}
