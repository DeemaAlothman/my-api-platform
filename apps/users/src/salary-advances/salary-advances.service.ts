import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSalaryAdvanceDto } from './dto/create-salary-advance.dto';
import { UpdateSalaryAdvanceDto } from './dto/update-salary-advance.dto';

@Injectable()
export class SalaryAdvancesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSalaryAdvanceDto, createdBy: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, deletedAt: null },
    });
    if (!employee) throw new NotFoundException('الموظف غير موجود');

    if (dto.installmentAmount > dto.totalAmount) {
      throw new BadRequestException('قسط السلفة لا يمكن أن يكون أكبر من المبلغ الإجمالي');
    }

    return this.prisma.salaryAdvance.create({
      data: {
        employeeId:        dto.employeeId,
        totalAmount:       dto.totalAmount,
        installmentAmount: dto.installmentAmount,
        remainingBalance:  dto.totalAmount,
        totalInstallments: dto.totalInstallments,
        startYear:         dto.startYear,
        startMonth:        dto.startMonth,
        reason:            dto.reason,
        notes:             dto.notes,
        createdBy,
      },
    });
  }

  async findAll(query: { employeeId?: string; status?: string; year?: number }) {
    const where: any = { deletedAt: null };
    if (query.employeeId) where.employeeId = query.employeeId;
    if (query.status)     where.status = query.status;
    if (query.year)       where.startYear = query.year;

    return this.prisma.salaryAdvance.findMany({
      where,
      include: {
        installments: { orderBy: { year: 'asc' } },
        employee: { select: { id: true, firstNameAr: true, lastNameAr: true, employeeNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const advance = await this.prisma.salaryAdvance.findFirst({
      where: { id, deletedAt: null },
      include: {
        installments: { orderBy: { year: 'asc' } },
        employee: { select: { id: true, firstNameAr: true, lastNameAr: true, employeeNumber: true } },
      },
    });
    if (!advance) throw new NotFoundException('السلفة غير موجودة');
    return advance;
  }

  async update(id: string, dto: UpdateSalaryAdvanceDto) {
    const advance = await this.findOne(id);

    if (advance.status !== 'ACTIVE') {
      throw new BadRequestException('لا يمكن تعديل سلفة غير نشطة');
    }
    if (advance.paidInstallments > 0 && dto.installmentAmount !== undefined) {
      throw new BadRequestException('لا يمكن تعديل قسط السلفة بعد بدء الخصم');
    }

    return this.prisma.salaryAdvance.update({
      where: { id },
      data: {
        ...(dto.installmentAmount !== undefined && { installmentAmount: dto.installmentAmount }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });
  }

  async cancel(id: string, reason: string, cancelledBy: string) {
    const advance = await this.findOne(id);

    if (advance.status === 'COMPLETED') {
      throw new BadRequestException('لا يمكن إلغاء سلفة مكتملة');
    }
    if (advance.status === 'CANCELLED') {
      throw new BadRequestException('السلفة ملغاة مسبقاً');
    }

    return this.prisma.salaryAdvance.update({
      where: { id },
      data: { status: 'CANCELLED', cancelReason: reason, cancelledBy, cancelledAt: new Date() },
    });
  }

  async remove(id: string) {
    const advance = await this.findOne(id);

    if (advance.paidInstallments > 0) {
      throw new BadRequestException('لا يمكن حذف سلفة بدأ خصمها — استخدم الإلغاء');
    }

    return this.prisma.salaryAdvance.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
