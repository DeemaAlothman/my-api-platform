import {
  Controller, Get, Post, Param,
  UploadedFile, UseGuards, UseInterceptors, Res, StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { AttachmentsService } from './attachments.service';
import { JwtAuthGuard } from '@shared/auth';
import { User } from '@shared/auth';
import { PermissionsGuard } from '@shared';
import { Permission } from '@shared';

const UPLOAD_DIR = process.env.UPLOAD_DIR || '/app/uploads';
const MAX_MB = parseInt(process.env.MAX_ATTACHMENT_SIZE_MB || '50', 10);

@ApiTags('mail-attachments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('mail/attachments')
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  // رفع مرفق يتيم (بدون messageId) — يُربط لاحقاً عند الإرسال عبر attachmentIds
  @Post()
  @Permission('mail:send')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (_req, _file, cb) => {
        fs.mkdirSync(UPLOAD_DIR, { recursive: true });
        cb(null, UPLOAD_DIR);
      },
      filename: (_req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`);
      },
    }),
    limits: { fileSize: MAX_MB * 1024 * 1024 },
  }))
  uploadOrphan(
    @User() user: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.attachmentsService.uploadOrphan(user.userId, file);
  }

  @Post(':messageId')
  @Permission('mail:send')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (_req, _file, cb) => {
        fs.mkdirSync(UPLOAD_DIR, { recursive: true });
        cb(null, UPLOAD_DIR);
      },
      filename: (_req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`);
      },
    }),
    limits: { fileSize: MAX_MB * 1024 * 1024 },
  }))
  upload(
    @Param('messageId') messageId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.attachmentsService.uploadFromDisk(messageId, file);
  }

  @Get(':attachmentId/file')
  @Permission('mail:read_own')
  async download(
    @Param('attachmentId') attachmentId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const attachment = await this.attachmentsService.getFileInfo(attachmentId);
    const buffer = fs.readFileSync(attachment.fileUrl);
    res.set({
      'Content-Type': attachment.mimeType,
      'Content-Disposition': `inline; filename="${encodeURIComponent(attachment.fileName)}"`,
      'Content-Length': String(attachment.fileSize),
    });
    return new StreamableFile(buffer);
  }
}
