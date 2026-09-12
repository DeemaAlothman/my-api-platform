import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateBodyRegionDto, UpdateBodyRegionDto,
  CreateTargetRegionDto, UpdateTargetRegionDto,
  CreateSubTargetRegionDto, UpdateSubTargetRegionDto,
  CreateExerciseGoalDto, UpdateExerciseGoalDto,
} from './dto/taxonomy.dto';

@Injectable()
export class TaxonomyService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Body Regions ──────────────────────────────────────────────────────
  listBodyRegions() {
    return this.prisma.bodyRegion.findMany({ orderBy: { sortOrder: 'asc' } });
  }
  createBodyRegion(dto: CreateBodyRegionDto) {
    return this.prisma.bodyRegion.create({ data: dto });
  }
  async updateBodyRegion(id: string, dto: UpdateBodyRegionDto) {
    await this.mustExist('bodyRegion', id);
    return this.prisma.bodyRegion.update({ where: { id }, data: dto });
  }

  // ── Target Regions ────────────────────────────────────────────────────
  listTargetRegions(bodyRegionId?: string) {
    return this.prisma.targetRegion.findMany({
      where: bodyRegionId ? { bodyRegionId } : {},
      orderBy: { sortOrder: 'asc' },
    });
  }
  async createTargetRegion(dto: CreateTargetRegionDto) {
    await this.mustExist('bodyRegion', dto.bodyRegionId);
    return this.prisma.targetRegion.create({ data: dto });
  }
  async updateTargetRegion(id: string, dto: UpdateTargetRegionDto) {
    await this.mustExist('targetRegion', id);
    return this.prisma.targetRegion.update({ where: { id }, data: dto });
  }

  // ── Sub-Target Regions ────────────────────────────────────────────────
  listSubTargetRegions(targetRegionId?: string) {
    return this.prisma.subTargetRegion.findMany({
      where: targetRegionId ? { targetRegionId } : {},
      orderBy: { sortOrder: 'asc' },
    });
  }
  async createSubTargetRegion(dto: CreateSubTargetRegionDto) {
    await this.mustExist('targetRegion', dto.targetRegionId);
    return this.prisma.subTargetRegion.create({ data: dto });
  }
  async updateSubTargetRegion(id: string, dto: UpdateSubTargetRegionDto) {
    await this.mustExist('subTargetRegion', id);
    return this.prisma.subTargetRegion.update({ where: { id }, data: dto });
  }

  // ── Exercise Goals ────────────────────────────────────────────────────
  listGoals() {
    return this.prisma.exerciseGoal.findMany({ orderBy: { nameAr: 'asc' } });
  }
  createGoal(dto: CreateExerciseGoalDto) {
    return this.prisma.exerciseGoal.create({ data: dto });
  }
  async updateGoal(id: string, dto: UpdateExerciseGoalDto) {
    await this.mustExist('exerciseGoal', id);
    return this.prisma.exerciseGoal.update({ where: { id }, data: dto });
  }

  private async mustExist(model: 'bodyRegion' | 'targetRegion' | 'subTargetRegion' | 'exerciseGoal', id: string) {
    const found = await (this.prisma as any)[model].findUnique({ where: { id } });
    if (!found) throw new NotFoundException('العنصر غير موجود');
    return found;
  }
}
