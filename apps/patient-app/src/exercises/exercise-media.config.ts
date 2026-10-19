import { memoryStorage } from 'multer';
import { BadRequestException } from '@nestjs/common';
import { extname } from 'path';

// FILE_STORAGE_ROOT يبقى فقط لخدمة الملفات القديمة المرفوعة قبل الانتقال لـBackblaze B2
// (توافق للخلف — انظر ExercisesService.getMediaFilePath). أي رفع جديد يروح مباشرة لـB2
// عبر StorageService بدون أي كتابة على قرص السيرفر (multer memoryStorage).
export const FILE_STORAGE_ROOT = process.env.FILE_STORAGE_ROOT || '/app/uploads';
const VIDEO_MIME = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo'];
const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB (يكفي فيديو تمرين قصير)
// صيغ الصور المسموحة بالامتداد — يُستخدم فقط لما نوع الملف (mimetype) يصل فاضي أو
// application/octet-stream (بيصير مع بعض متصفحات الموبايل عند الرفع من الكاميرا/المعرض)
const ALLOWED_IMAGE_EXT = /\.(jpe?g|png|heic|heif|webp|gif|bmp|tiff?|avif)$/i;

export const exerciseMediaMulterOptions = {
  storage: memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req: any, file: any, cb: any) => {
    const mimetype = file.mimetype || '';
    const isImageMime = mimetype.startsWith('image/');
    const isVideoMime = VIDEO_MIME.includes(mimetype);
    const mimeUnknown = !mimetype || mimetype === 'application/octet-stream';
    const ext = extname(file.originalname).toLowerCase();
    const allowedByExt = mimeUnknown && ALLOWED_IMAGE_EXT.test(ext);

    if (!isImageMime && !isVideoMime && !allowedByExt) {
      return cb(new BadRequestException('نوع الملف غير مدعوم — يُسمح فقط بصور (بكل صيغها) أو فيديو (mp4/mov/webm/avi)'), false);
    }
    cb(null, true);
  },
};
