import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { BadRequestException } from '@nestjs/common';

// مسار دائم مربوط بـ volume ثابت على السيرفر (/var/data/orthotics_uploads) — نفس نمط patients/potential-clients
export const FILE_STORAGE_ROOT = process.env.FILE_STORAGE_ROOT || '/app/uploads';
const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB — يكفي صورة كاميرا موبايل (عادة 3-8MB)
// صيغ الصور المسموحة بالامتداد — يُستخدم فقط لما نوع الملف (mimetype) يصل فاضي أو
// application/octet-stream (بيصير مع بعض متصفحات الموبايل عند الرفع من الكاميرا/المعرض)
const ALLOWED_IMAGE_EXT = /\.(jpe?g|png|heic|heif|webp|gif|bmp|tiff?|avif)$/i;

export const orthoticsAttachmentMulterOptions = {
  storage: diskStorage({
    destination: (req: any, _file: any, cb: any) => {
      const receptionId = req.params.id;
      const dir = join(FILE_STORAGE_ROOT, 'orthotics-receptions', receptionId, 'attachments');
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
  fileFilter: (req: any, file: any, cb: any) => {
    const mimetype = file.mimetype || '';
    const isImageMime = mimetype.startsWith('image/');
    const isPdfMime = mimetype === 'application/pdf';
    const mimeUnknown = !mimetype || mimetype === 'application/octet-stream';
    const ext = extname(file.originalname).toLowerCase();
    const allowedByExt = mimeUnknown && (ALLOWED_IMAGE_EXT.test(ext) || ext === '.pdf');

    if (!isImageMime && !isPdfMime && !allowedByExt) {
      return cb(new BadRequestException('نوع الملف غير مسموح — يُقبل الصور بكل صيغها أو PDF فقط'), false);
    }
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    if (contentLength > MAX_FILE_SIZE) {
      return cb(new BadRequestException('حجم الملف يتجاوز 15MB'), false);
    }
    cb(null, true);
  },
};
