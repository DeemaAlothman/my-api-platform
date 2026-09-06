import { Controller, Get, Param, Query, Res, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Response } from 'express';
import * as fs from 'fs';
import { AttachmentsService } from './attachments.service';

@Controller('mail-file')
export class MailFileController {
  constructor(
    private readonly attachmentsService: AttachmentsService,
    private readonly jwt: JwtService,
  ) {}

  @Get(':attachmentId')
  async download(
    @Param('attachmentId') attachmentId: string,
    @Query('t') token: string,
    @Res() res: Response,
  ): Promise<void> {
    if (!token) throw new UnauthorizedException('Missing token');
    try {
      this.jwt.verify(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const attachment = await this.attachmentsService.getFileInfo(attachmentId);

    res.set({
      'Content-Type': attachment.mimeType || 'application/octet-stream',
      'Content-Disposition': `inline; filename="${encodeURIComponent(attachment.fileName)}"`,
      'Content-Length': String(attachment.fileSize),
    });

    fs.createReadStream(attachment.fileUrl).pipe(res);
  }
}
