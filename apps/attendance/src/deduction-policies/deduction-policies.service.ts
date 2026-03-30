import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDeductionPolicyDto } from './dto/create-deduction-policy.dto';
import { UpdateDeductionPolicyDto } from './dto/update-deduction-policy.dto';

@Injectable()
export class DeductionPoliciesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateDeductionPolicyDto) {
    // إذا كانت السياسة الجديدة افتراضية → نلغي الافتراضية من الباقي
    if (dto.isDefault) {
      await this.prisma.deductionPolicy.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }
    return this.prisma.deductionPolicy.create({ data: dto });
  }

  async findAll(activeOnly = true) {
    return this.prisma.deductionPolicy.findMany({
      where: activeOnly ? { isActive: true } : {},
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async findOne(id: string) {
    const policy = await this.prisma.deductionPolicy.findUnique({ where: { id } });
    if (!policy) throw new NotFoundException('سياسة الحسم غير موجودة');
    return policy;
  }

  async findDefault() {
    const policy = await this.prisma.deductionPolicy.findFirst({
      where: { isDefault: true, isActive: true },
    });
    return policy;
  }

  async update(id: string, dto: UpdateDeductionPolicyDto) {
    await this.findOne(id);
    if (dto.isDefault) {
      await this.prisma.deductionPolicy.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }
    return this.prisma.deductionPolicy.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const policy = await this.findOne(id);
    // تحقق أنها مش مستخدمة في كشوفات
    const usedInPayroll = await this.prisma.monthlyPayroll.count({ where: { policyId: id } });
    if (usedInPayroll > 0) {
      throw new ConflictException('لا يمكن حذف السياسة لأنها مرتبطة بكشوفات رواتب');
    }
    return this.prisma.deductionPolicy.delete({ where: { id } });
  }
}
