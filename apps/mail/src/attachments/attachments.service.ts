import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

const MAX_MB    = parseInt(process.env.MAX_ATTACHMENT_SIZE_MB || '25', 10);
const MAX_BYTES = MAX_MB * 1024 * 1024;
const ALLOWED_MIME = (process.env.ALLOWED_ATTACHMENT_MIME || 'image/jpeg,image/png,application/pdf').split(',');
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/app/uploads';

@Injectable()
export class AttachmentsService {
  constructor(private readonly prisma: PrismaService) {
    if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }

  async upload(messageId: string, file: Express.Multer.File) {
    if (!file || !file.buffer || file.size === 0) {
      throw new BadRequestException({
        code: 'EMPTY_FILE',
        message: 'File is empty or was not received',
        details: [],
      });
    }

    if (file.size > MAX_BYTES) {
      throw new BadRequestException({
        code: 'ATTACHMENT_TOO_LARGE',
        message: `File exceeds maximum size of ${MAX_MB}MB`,
        details: [],
      });
    }

    if (!ALLOWED_MIME.includes(file.mimetype)) {
      throw new BadRequestException({
        code: 'ATTACHMENT_INVALID_TYPE',
        message: 'File type not allowed',
        details: [{ allowed: ALLOWED_MIME, received: file.mimetype }],
      });
    }

    const safeName = `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`;
    const diskPath = path.join(UPLOAD_DIR, safeName);
    fs.writeFileSync(diskPath, file.buffer);

    const attachment = await (this.prisma as any).mailAttachment.create({
      data: {
        messageId,
        fileUrl: diskPath,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
      },
    });

    return attachment;
  }

  async getFileInfo(attachmentId: string) {
    const attachment = await (this.prisma as any).mailAttachment.findUnique({
      where: { id: attachmentId },
    });
    if (!attachment) {
      throw new NotFoundException({ code: 'ATTACHMENT_NOT_FOUND', message: 'Attachment not found', details: [] });
    }
    if (!fs.existsSync(attachment.fileUrl)) {
      throw new NotFoundException({ code: 'FILE_NOT_ON_DISK', message: 'File no longer exists on disk', details: [] });
    }
    return attachment;
  }
}
