import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
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

  // ── الحذف — نهائي، لكن يُرفض إذا كان العنصر مرتبطاً بأي شيء (حتى لا تضيع تمارين أو تصنيفات) ──
  // عدد التمارين يشمل المحذوفة حذفاً ناعماً لأنها ما زالت مرتبطة بالمنطقة في قاعدة البيانات
  async deleteBodyRegion(id: string) {
    await this.mustExist('bodyRegion', id);
    const [targets, exercises] = await Promise.all([
      this.prisma.targetRegion.count({ where: { bodyRegionId: id } }),
      this.prisma.exercise.count({ where: { bodyRegionId: id } }),
    ]);
    this.assertUnlinked({ 'منطقة مستهدفة': targets, 'تمرين': exercises });
    await this.prisma.bodyRegion.delete({ where: { id } });
    return { id, message: 'تم حذف المنطقة الجسدية' };
  }

  async deleteTargetRegion(id: string) {
    await this.mustExist('targetRegion', id);
    const [subs, exercises] = await Promise.all([
      this.prisma.subTargetRegion.count({ where: { targetRegionId: id } }),
      this.prisma.exercise.count({ where: { targetRegionId: id } }),
    ]);
    this.assertUnlinked({ 'منطقة فرعية': subs, 'تمرين': exercises });
    await this.prisma.targetRegion.delete({ where: { id } });
    return { id, message: 'تم حذف المنطقة المستهدفة' };
  }

  async deleteSubTargetRegion(id: string) {
    await this.mustExist('subTargetRegion', id);
    const exercises = await this.prisma.exercise.count({ where: { subTargetRegionId: id } });
    this.assertUnlinked({ 'تمرين': exercises });
    await this.prisma.subTargetRegion.delete({ where: { id } });
    return { id, message: 'تم حذف المنطقة الفرعية' };
  }

  async deleteGoal(id: string) {
    await this.mustExist('exerciseGoal', id);
    const links = await this.prisma.exerciseGoalLink.count({ where: { goalId: id } });
    this.assertUnlinked({ 'تمرين': links });
    await this.prisma.exerciseGoal.delete({ where: { id } });
    return { id, message: 'تم حذف الهدف' };
  }

  private assertUnlinked(counts: Record<string, number>) {
    const linked = Object.entries(counts).filter(([, n]) => n > 0);
    if (!linked.length) return;
    throw new ConflictException({
      code: 'TAXONOMY_IN_USE',
      message: `لا يمكن الحذف: مرتبط بـ ${linked.map(([label, n]) => `${n} ${label}`).join(' و ')}. انقل أو احذف المرتبط أولاً.`,
      details: Object.fromEntries(linked),
    });
  }

  private async mustExist(model: 'bodyRegion' | 'targetRegion' | 'subTargetRegion' | 'exerciseGoal', id: string) {
    const found = await (this.prisma as any)[model].findUnique({ where: { id } });
    if (!found) throw new NotFoundException('العنصر غير موجود');
    return found;
  }
}
