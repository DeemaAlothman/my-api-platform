import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExerciseDto, UpdateExerciseDto, ListExercisesQueryDto } from './dto/exercise.dto';
import { join } from 'path';
import { FILE_STORAGE_ROOT } from './exercise-media.config';

@Injectable()
export class ExercisesService {
  constructor(private readonly prisma: PrismaService) {}

  private include() {
    return {
      bodyRegion: true,
      targetRegion: true,
      subTargetRegion: true,
      goals: { include: { goal: true } },
    } as const;
  }

  async findAll(query: ListExercisesQueryDto) {
    const where: any = { deletedAt: null };
    if (query.bodyRegionId) where.bodyRegionId = query.bodyRegionId;
    if (query.targetRegionId) where.targetRegionId = query.targetRegionId;
    if (query.subTargetRegionId) where.subTargetRegionId = query.subTargetRegionId;
    if (query.goalId) where.goals = { some: { goalId: query.goalId } };
    if (query.search) {
      where.OR = [
        { nameAr: { contains: query.search, mode: 'insensitive' } },
        { nameEn: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.exercise.findMany({ where, include: this.include(), orderBy: { nameAr: 'asc' } });
  }

  async findOne(id: string) {
    const exercise = await this.prisma.exercise.findFirst({ where: { id, deletedAt: null }, include: this.include() });
    if (!exercise) throw new NotFoundException('التمرين غير موجود');
    return exercise;
  }

  async create(dto: CreateExerciseDto, userId: string) {
    const { goalIds, ...data } = dto;
    return this.prisma.exercise.create({
      data: {
        ...data,
        createdByUserId: userId,
        ...(goalIds?.length ? { goals: { create: goalIds.map((goalId) => ({ goalId })) } } : {}),
      },
      include: this.include(),
    });
  }

  async update(id: string, dto: UpdateExerciseDto, userId: string) {
    await this.findOne(id);
    const { goalIds, ...data } = dto;
    return this.prisma.$transaction(async (tx) => {
      if (goalIds !== undefined) {
        await tx.exerciseGoalLink.deleteMany({ where: { exerciseId: id } });
        if (goalIds.length) {
          await tx.exerciseGoalLink.createMany({ data: goalIds.map((goalId) => ({ exerciseId: id, goalId })) });
        }
      }
      return tx.exercise.update({
        where: { id },
        data: { ...data, updatedByUserId: userId },
        include: this.include(),
      });
    });
  }

  // رفع ملف الوسائط (فيديو/صورة) للتمرين — يُخزَّن على القرص خارج الحاوية (bind mount)، صفر خطر فقدان عند إعادة البناء
  async uploadMedia(id: string, file: Express.Multer.File, userId: string) {
    await this.findOne(id);
    const mediaType = file.mimetype.startsWith('video/') ? 'VIDEO' : 'IMAGE';
    return this.prisma.exercise.update({
      where: { id },
      data: {
        mediaType: mediaType as any,
        mediaUrl: `/api/v1/patient-app/public/exercises/${id}/media`,
        updatedByUserId: userId,
      },
      include: this.include(),
    });
  }

  async getMediaFilePath(id: string): Promise<string> {
    const dir = join(FILE_STORAGE_ROOT, 'exercises', id);
    const { readdirSync } = await import('fs');
    let files: string[] = [];
    try {
      files = readdirSync(dir);
    } catch {
      throw new NotFoundException('لا يوجد ملف وسائط لهذا التمرين');
    }
    if (files.length === 0) throw new NotFoundException('لا يوجد ملف وسائط لهذا التمرين');
    // أحدث ملف (بحال تم استبدال الفيديو سابقاً)
    files.sort();
    return join(dir, files[files.length - 1]);
  }
}
