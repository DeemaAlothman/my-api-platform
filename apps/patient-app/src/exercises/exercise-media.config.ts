import { memoryStorage } from 'multer';
import { BadRequestException } from '@nestjs/common';

// FILE_STORAGE_ROOT يبقى فقط لخدمة الملفات القديمة المرفوعة قبل الانتقال لـBackblaze B2
// (توافق للخلف — انظر ExercisesService.getMediaFilePath). أي رفع جديد يروح مباشرة لـB2
// عبر StorageService بدون أي كتابة على قرص السيرفر (multer memoryStorage).
export const FILE_STORAGE_ROOT = process.env.FILE_STORAGE_ROOT || '/app/uploads';
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo'];
const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB (يكفي فيديو تمرين قصير)

export const exerciseMediaMulterOptions = {
  storage: memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req: any, file: any, cb: any) => {
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      return cb(new BadRequestException('نوع الملف غير مدعوم — يُسمح فقط بصور (jpg/png) أو فيديو (mp4/mov/webm/avi)'), false);
    }
    cb(null, true);
  },
};
