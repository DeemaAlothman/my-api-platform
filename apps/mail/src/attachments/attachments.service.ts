import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const MAX_MB = parseInt(process.env.MAX_ATTACHMENT_SIZE_MB || '25', 10);
const MAX_BYTES = MAX_MB * 1024 * 1024;
const ALLOWED_MIME = (process.env.ALLOWED_ATTACHMENT_MIME || 'image/jpeg,image/png,application/pdf').split(',');

@Injectable()
export class AttachmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async upload(
    messageId: string,
    file: Express.Multer.File,
  ) {
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

    const fileUrl = `/uploads/${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`;

    const attachment = await (this.prisma as any).mailAttachment.create({
      data: {
        messageId,
        fileUrl,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
      },
    });

    return attachment;
  }
}
