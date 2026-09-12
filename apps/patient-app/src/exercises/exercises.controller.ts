import { Body, Controller, Get, NotFoundException, Param, Post, Put, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { createReadStream, existsSync } from 'fs';
import { extname } from 'path';
import { JwtAuthGuard } from '@shared/auth';
import { PermissionsGuard } from '@shared/guards/permissions.guard';
import { Permission } from '@shared/decorators/permission.decorator';
import { PERMISSIONS } from '@shared/constants/permissions.constants';
import { User } from '@shared/auth/decorators/current-user.decorator';
import { ExercisesService } from './exercises.service';
import { CreateExerciseDto, UpdateExerciseDto, ListExercisesQueryDto } from './dto/exercise.dto';
import { exerciseMediaMulterOptions } from './exercise-media.config';

const READ_PERMS = [
  PERMISSIONS.CLINIC_PATIENT_APP.EXERCISE_LIBRARY_MANAGE,
  PERMISSIONS.CLINIC_PATIENT_APP.ASSIGNMENT_CREATE,
] as const;

@Controller('patient-app/exercises')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ExercisesController {
  constructor(private readonly service: ExercisesService) {}

  @Get()
  @Permission(...READ_PERMS)
  findAll(@Query() query: ListExercisesQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @Permission(...READ_PERMS)
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Permission(PERMISSIONS.CLINIC_PATIENT_APP.EXERCISE_LIBRARY_MANAGE)
  create(@Body() dto: CreateExerciseDto, @User() user: any) {
    return this.service.create(dto, user.userId);
  }

  @Put(':id')
  @Permission(PERMISSIONS.CLINIC_PATIENT_APP.EXERCISE_LIBRARY_MANAGE)
  update(@Param('id') id: string, @Body() dto: UpdateExerciseDto, @User() user: any) {
    return this.service.update(id, dto, user.userId);
  }

  // رفع فيديو/صورة التمرين — يُخزَّن على قرص السيرفر خارج الحاوية (bind mount)، لا يُفقد أبداً عند إعادة بناء/تشغيل الخدمة
  @Post(':id/media')
  @Permission(PERMISSIONS.CLINIC_PATIENT_APP.EXERCISE_LIBRARY_MANAGE)
  @UseInterceptors(FileInterceptor('file', exerciseMediaMulterOptions))
  uploadMedia(@Param('id') id: string, @UploadedFile() file: Express.Multer.File, @User() user: any) {
    return this.service.uploadMedia(id, file, user.userId);
  }
}

const MIME_BY_EXT: Record<string, string> = {
  '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.avi': 'video/x-msvideo',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
};

// بث ملف الوسائط (فيديو/صورة) — بدون حماية JWT عمداً، لأن التمارين محتوى تعليمي عام
// (مو بيانات مريض حساسة) ولازم يكون قابل للتشغيل مباشرة بمشغل الفيديو بتطبيق الموبايل والداشبورد معاً
@Controller('patient-app/public/exercises')
export class ExerciseMediaController {
  constructor(private readonly service: ExercisesService) {}

  @Get(':id/media')
  async streamMedia(@Param('id') id: string, @Res() res: Response) {
    const filePath = await this.service.getMediaFilePath(id);
    if (!existsSync(filePath)) {
      throw new NotFoundException('الملف غير موجود على الخادم');
    }
    res.set({ 'Content-Type': MIME_BY_EXT[extname(filePath).toLowerCase()] || 'application/octet-stream' });
    createReadStream(filePath).pipe(res);
  }
}
