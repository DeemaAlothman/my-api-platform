import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSalesCommissionDto } from './dto/create-sales-commission.dto';
import { UpdateSalesCommissionDto } from './dto/update-sales-commission.dto';

@Injectable()
export class SalesCommissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSalesCommissionDto, createdBy: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, deletedAt: null },
    });
    if (!employee) throw new NotFoundException('الموظف غير موجود');

    return this.prisma.salesCommission.create({
      data: {
        employeeId:     dto.employeeId,
        year:           dto.year,
        month:          dto.month,
        amount:         dto.amount,
        description:    dto.description,
        salesReference: dto.salesReference,
        createdBy,
      },
    });
  }

  async findAll(query: { employeeId?: string; year?: number; month?: number; status?: string }) {
    const where: any = { deletedAt: null };
    if (query.employeeId) where.employeeId = query.employeeId;
    if (query.status)     where.status = query.status;
    if (query.year)       where.year = query.year;
    if (query.month)      where.month = query.month;

    return this.prisma.salesCommission.findMany({
      where,
      include: {
        employee: { select: { id: true, firstNameAr: true, lastNameAr: true, employeeNumber: true } },
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(id: string) {
    const commission = await this.prisma.salesCommission.findFirst({
      where: { id, deletedAt: null },
      include: {
        employee: { select: { id: true, firstNameAr: true, lastNameAr: true, employeeNumber: true } },
      },
    });
    if (!commission) throw new NotFoundException('العمولة غير موجودة');
    return commission;
  }

  async update(id: string, dto: UpdateSalesCommissionDto) {
    const commission = await this.findOne(id);

    if (commission.status !== 'DRAFT') {
      throw new BadRequestException('لا يمكن تعديل عمولة معتمدة');
    }

    return this.prisma.salesCommission.update({
      where: { id },
      data: {
        ...(dto.amount !== undefined && { amount: dto.amount }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.salesReference !== undefined && { salesReference: dto.salesReference }),
      },
    });
  }

  async confirm(id: string, approvedBy: string) {
    const commission = await this.findOne(id);

    if (commission.status !== 'DRAFT') {
      throw new BadRequestException('العمولة معتمدة مسبقاً');
    }

    return this.prisma.salesCommission.update({
      where: { id },
      data: { status: 'CONFIRMED', approvedBy, approvedAt: new Date() },
    });
  }

  async remove(id: string) {
    const commission = await this.findOne(id);

    if (commission.status === 'CONFIRMED') {
      throw new BadRequestException('لا يمكن حذف عمولة معتمدة — اطلب إلغاء الاعتماد أولاً');
    }

    return this.prisma.salesCommission.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
