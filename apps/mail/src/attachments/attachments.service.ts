import { Injectable, BadRequestException, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

const MAX_MB    = parseInt(process.env.MAX_ATTACHMENT_SIZE_MB || '50', 10);
const MAX_BYTES = MAX_MB * 1024 * 1024;
const ALLOWED_MIME = (process.env.ALLOWED_ATTACHMENT_MIME || [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.presentation',
  'text/csv', 'text/plain',
  'application/octet-stream',
].join(',')).split(',');

const OFFICE_EXTENSIONS = /\.(xlsx?|csv|ods|docx?|odt|txt|pdf|pptx?|odp)$/i;
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/app/uploads';

@Injectable()
export class AttachmentsService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {
    if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }

  onModuleInit() {
    setInterval(() => this.cleanupOrphans(), 60 * 60 * 1000);
  }

  async cleanupOrphans(): Promise<number> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const orphans = await (this.prisma as any).mailAttachment.findMany({
      where: { messageId: null, createdAt: { lt: cutoff } },
      select: { id: true, fileUrl: true },
    });
    for (const orphan of orphans) {
      try { fs.unlinkSync(orphan.fileUrl); } catch {}
      await (this.prisma as any).mailAttachment.delete({ where: { id: orphan.id } }).catch(() => {});
    }
    return orphans.length;
  }

  // legacy: memory storage (kept for compatibility)
  async upload(messageId: string, file: Express.Multer.File) {
    if (!file || !file.buffer || file.size === 0) {
      throw new BadRequestException({ code: 'EMPTY_FILE', message: 'File is empty or was not received', details: [] });
    }
    if (file.size > MAX_BYTES) {
      throw new BadRequestException({ code: 'ATTACHMENT_TOO_LARGE', message: `File exceeds maximum size of ${MAX_MB}MB`, details: [] });
    }
    const mimeAllowed = ALLOWED_MIME.includes(file.mimetype);
    const excelByExtension = OFFICE_EXTENSIONS.test(file.originalname);
    if (!mimeAllowed && !excelByExtension) {
      throw new BadRequestException({ code: 'ATTACHMENT_INVALID_TYPE', message: 'File type not allowed', details: [{ allowed: ALLOWED_MIME, received: file.mimetype }] });
    }
    const safeName = `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`;
    const diskPath = path.join(UPLOAD_DIR, safeName);
    fs.writeFileSync(diskPath, file.buffer);
    return (this.prisma as any).mailAttachment.create({
      data: { messageId, fileUrl: diskPath, fileName: file.originalname, fileSize: file.size, mimeType: file.mimetype },
    });
  }

  // رفع مرفق بدون ربطه برسالة — يُربط لاحقاً عند الإرسال عبر attachmentIds
  async uploadOrphan(userId: string, file: Express.Multer.File) {
    if (!file || !file.path) {
      throw new BadRequestException({ code: 'EMPTY_FILE', message: 'File is empty or was not received', details: [] });
    }
    const mimeAllowed = ALLOWED_MIME.includes(file.mimetype);
    const excelByExtension = OFFICE_EXTENSIONS.test(file.originalname);
    if (!mimeAllowed && !excelByExtension) {
      fs.unlinkSync(file.path);
      throw new BadRequestException({ code: 'ATTACHMENT_INVALID_TYPE', message: 'File type not allowed', details: [{ allowed: ALLOWED_MIME, received: file.mimetype }] });
    }
    return (this.prisma as any).mailAttachment.create({
      data: {
        messageId: null,
        uploadedBy: userId,
        fileUrl: file.path,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
      },
    });
  }

  // disk storage: الملف يُكتب مباشرة على القرص بدون تحميله كاملاً بالذاكرة
  async uploadFromDisk(messageId: string, file: Express.Multer.File) {
    if (!file || !file.path) {
      throw new BadRequestException({ code: 'EMPTY_FILE', message: 'File is empty or was not received', details: [] });
    }
    const mimeAllowed = ALLOWED_MIME.includes(file.mimetype);
    const excelByExtension = OFFICE_EXTENSIONS.test(file.originalname);
    if (!mimeAllowed && !excelByExtension) {
      fs.unlinkSync(file.path);
      throw new BadRequestException({ code: 'ATTACHMENT_INVALID_TYPE', message: 'File type not allowed', details: [{ allowed: ALLOWED_MIME, received: file.mimetype }] });
    }
    return (this.prisma as any).mailAttachment.create({
      data: { messageId, fileUrl: file.path, fileName: file.originalname, fileSize: file.size, mimeType: file.mimetype },
    });
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
