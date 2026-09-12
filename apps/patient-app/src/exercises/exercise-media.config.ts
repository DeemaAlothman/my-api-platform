import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { BadRequestException } from '@nestjs/common';

// نفس نمط apps/patients/src/patients/patient-files.config.ts بالضبط — تخزين خارج الحاوية
// (bind mount) عشان الفيديوهات/الصور ما تضيع أبداً عند إعادة بناء/تشغيل الحاوية.
export const FILE_STORAGE_ROOT = process.env.FILE_STORAGE_ROOT || '/app/uploads';
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo'];
const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB (يكفي فيديو تمرين قصير)

export const exerciseMediaMulterOptions = {
  storage: diskStorage({
    destination: (req: any, _file: any, cb: any) => {
      const exerciseId = req.params.id;
      const dir = join(FILE_STORAGE_ROOT, 'exercises', exerciseId);
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
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      return cb(new BadRequestException('نوع الملف غير مدعوم — يُسمح فقط بصور (jpg/png) أو فيديو (mp4/mov/webm/avi)'), false);
    }
    cb(null, true);
  },
};
