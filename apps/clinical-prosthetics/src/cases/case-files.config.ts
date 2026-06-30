import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { BadRequestException } from '@nestjs/common';

export const FILE_STORAGE_ROOT = process.env.FILE_STORAGE_ROOT || '/app/uploads';
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'application/pdf'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const caseAttachmentMulterOptions = {
  storage: diskStorage({
    destination: (req: any, _file: any, cb: any) => {
      const caseId = req.params.id;
      const dir = join(FILE_STORAGE_ROOT, 'cases', caseId, 'attachments');
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
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req: any, file: any, cb: any) => {
    if (ALLOWED_MIME.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new BadRequestException('نوع الملف غير مسموح — يُقبل JPEG/PNG/PDF فقط'), false);
    }
  },
};
