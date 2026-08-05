import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { BadRequestException } from '@nestjs/common';

export const FILE_STORAGE_ROOT = process.env.FILE_STORAGE_ROOT || '/app/uploads';
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'application/pdf'];
const IMAGING_MIME = [...ALLOWED_MIME, 'video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo'];
const MAX_FILE_SIZE   = 10  * 1024 * 1024; // 10MB للملفات العادية
const MAX_VIDEO_SIZE  = 200 * 1024 * 1024; // 200MB للفيديو

export const patientDocumentMulterOptions = {
  storage: diskStorage({
    destination: (req: any, _file: any, cb: any) => {
      const patientId = req.params.id;
      const dir = join(FILE_STORAGE_ROOT, 'patients', patientId, 'documents');
      try {
        mkdirSync(dir, { recursive: true });
        cb(null, dir);
      } catch (err) {
        cb(err, dir);
      }
    },
    filename: (_req: any, file: any, cb: any) => {
      cb(null, `${randomUUID()}${extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: MAX_VIDEO_SIZE },
  fileFilter: (req: any, file: any, cb: any) => {
    const isImaging = req.body?.type === 'IMAGING_PROCEDURE';
    const allowed   = isImaging ? IMAGING_MIME : ALLOWED_MIME;
    const maxSize   = isImaging ? MAX_VIDEO_SIZE : MAX_FILE_SIZE;

    if (!allowed.includes(file.mimetype)) {
      return cb(new BadRequestException(
        isImaging
          ? 'نوع الملف غير مسموح — يُقبل JPEG/PNG/PDF/MP4/MOV/WEBM فقط'
          : 'نوع الملف غير مسموح — يُقبل JPEG/PNG/PDF فقط',
      ), false);
    }

    // فحص حجم الفيديو مسبقاً من Content-Length
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    if (contentLength > maxSize) {
      return cb(new BadRequestException(
        isImaging ? 'حجم الملف يتجاوز 200MB' : 'حجم الملف يتجاوز 10MB',
      ), false);
    }

    cb(null, true);
  },
};
