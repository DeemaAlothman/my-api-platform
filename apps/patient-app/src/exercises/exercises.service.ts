import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExerciseDto, UpdateExerciseDto, ListExercisesQueryDto } from './dto/exercise.dto';

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
}
