import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateLeaveTypeDto {
  code: string;
  nameAr: string;
  nameEn?: string;
  defaultDays: number;
  isPaid?: boolean;
  requiresApproval?: boolean;
  requiresAttachment?: boolean;
  maxDaysPerRequest?: number;
  minDaysNotice?: number;
  allowHalfDay?: boolean;
  color?: string;
  isActive?: boolean;
}

export interface UpdateLeaveTypeDto {
  code?: string;
  nameAr?: string;
  nameEn?: string;
  defaultDays?: number;
  isPaid?: boolean;
  requiresApproval?: boolean;
  requiresAttachment?: boolean;
  maxDaysPerRequest?: number;
  minDaysNotice?: number;
  allowHalfDay?: boolean;
  color?: string;
  isActive?: boolean;
}

@Injectable()
export class LeaveTypesService {
  constructor(private prisma: PrismaService) {}

  // إنشاء نوع إجازة جديد
  async create(createDto: CreateLeaveTypeDto) {
    // التحقق من عدم تكرار الكود
    const existing = await this.prisma.leaveType.findUnique({
      where: { code: createDto.code },
    });

    if (existing) {
      throw new BadRequestException('Leave type code already exists');
    }

    const leaveType = await this.prisma.leaveType.create({
      data: createDto,
    });

    return leaveType;
  }

  // تحديث نوع إجازة
  async update(id: string, updateDto: UpdateLeaveTypeDto) {
    const leaveType = await this.prisma.leaveType.findUnique({
      where: { id },
    });

    if (!leaveType) {
      throw new NotFoundException('Leave type not found');
    }

    // إذا تم تغيير الكود، التحقق من عدم التكرار
    if (updateDto.code && updateDto.code !== leaveType.code) {
      const existing = await this.prisma.leaveType.findUnique({
        where: { code: updateDto.code },
      });

      if (existing) {
        throw new BadRequestException('Leave type code already exists');
      }
    }

    const updated = await this.prisma.leaveType.update({
      where: { id },
      data: updateDto,
    });

    return updated;
  }

  // الحصول على جميع أنواع الإجازات
  async findAll(includeInactive = false) {
    const where = includeInactive ? {} : { isActive: true };

    return this.prisma.leaveType.findMany({
      where,
      orderBy: { nameAr: 'asc' },
    });
  }

  // الحصول على نوع إجازة واحد
  async findOne(id: string) {
    const leaveType = await this.prisma.leaveType.findUnique({
      where: { id },
    });

    if (!leaveType) {
      throw new NotFoundException('Leave type not found');
    }

    return leaveType;
  }

  // الحصول على نوع إجازة بالكود
  async findByCode(code: string) {
    const leaveType = await this.prisma.leaveType.findUnique({
      where: { code },
    });

    if (!leaveType) {
      throw new NotFoundException('Leave type not found');
    }

    return leaveType;
  }

  // تفعيل/تعطيل نوع إجازة
  async toggleActive(id: string) {
    const leaveType = await this.prisma.leaveType.findUnique({
      where: { id },
    });

    if (!leaveType) {
      throw new NotFoundException('Leave type not found');
    }

    const updated = await this.prisma.leaveType.update({
      where: { id },
      data: { isActive: !leaveType.isActive },
    });

    return updated;
  }

  // حذف نوع إجازة
  async remove(id: string) {
    const leaveType = await this.prisma.leaveType.findUnique({
      where: { id },
    });

    if (!leaveType) {
      throw new NotFoundException('Leave type not found');
    }

    // التحقق من عدم وجود طلبات مرتبطة
    const requestsCount = await this.prisma.leaveRequest.count({
      where: { leaveTypeId: id },
    });

    if (requestsCount > 0) {
      throw new BadRequestException(
        'Cannot delete leave type with existing requests. Consider deactivating it instead.',
      );
    }

    await this.prisma.leaveType.delete({
      where: { id },
    });

    return { message: 'Leave type deleted successfully' };
  }
}
