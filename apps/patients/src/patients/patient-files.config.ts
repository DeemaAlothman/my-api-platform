import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { BadRequestException } from '@nestjs/common';

export const FILE_STORAGE_ROOT = process.env.FILE_STORAGE_ROOT || '/app/uploads';
const VIDEO_MIME = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo'];
const MAX_FILE_SIZE   = 15  * 1024 * 1024; // 15MB — يكفي صورة كاميرا موبايل (عادة 3-8MB)
const MAX_VIDEO_SIZE  = 200 * 1024 * 1024; // 200MB للفيديو
// صيغ الصور المسموحة بالامتداد — يُستخدم فقط لما نوع الملف (mimetype) يصل فاضي أو
// application/octet-stream (بيصير مع بعض متصفحات الموبايل عند الرفع من الكاميرا/المعرض)
const ALLOWED_IMAGE_EXT = /\.(jpe?g|png|heic|heif|webp|gif|bmp|tiff?|avif)$/i;

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
    const maxSize    = isImaging ? MAX_VIDEO_SIZE : MAX_FILE_SIZE;

    const mimetype = file.mimetype || '';
    const isImageMime = mimetype.startsWith('image/');
    const isPdfMime = mimetype === 'application/pdf';
    const isVideoMime = isImaging && VIDEO_MIME.includes(mimetype);
    const mimeUnknown = !mimetype || mimetype === 'application/octet-stream';
    const ext = extname(file.originalname).toLowerCase();
    const allowedByExt = mimeUnknown && (ALLOWED_IMAGE_EXT.test(ext) || ext === '.pdf');

    if (!isImageMime && !isPdfMime && !isVideoMime && !allowedByExt) {
      return cb(new BadRequestException(
        isImaging
          ? 'نوع الملف غير مسموح — يُقبل الصور بكل صيغها أو PDF أو MP4/MOV/WEBM فقط'
          : 'نوع الملف غير مسموح — يُقبل الصور بكل صيغها أو PDF فقط',
      ), false);
    }

    // فحص حجم الفيديو مسبقاً من Content-Length
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    if (contentLength > maxSize) {
      return cb(new BadRequestException(
        isImaging ? 'حجم الملف يتجاوز 200MB' : 'حجم الملف يتجاوز 15MB',
      ), false);
    }

    cb(null, true);
  },
};
