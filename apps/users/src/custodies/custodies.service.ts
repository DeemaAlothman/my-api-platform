import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustodyDto } from './dto/create-custody.dto';
import { UpdateCustodyDto } from './dto/update-custody.dto';
import { ReturnCustodyDto } from './dto/return-custody.dto';
import { ListCustodiesQueryDto } from './dto/list-custodies.query.dto';
import { CustodyStatus } from './dto/custody.enums';

@Injectable()
export class CustodiesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateCustodyDto, userId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, deletedAt: null },
    });
    if (!employee) {
      throw new NotFoundException('الموظف غير موجود');
    }

    if (dto.serialNumber) {
      const existing = await this.prisma.custody.findUnique({
        where: { serialNumber: dto.serialNumber },
      });
      if (existing && !existing.deletedAt) {
        throw new BadRequestException('الرقم التسلسلي مستخدم مسبقاً');
      }
    }

    return this.prisma.custody.create({
      data: {
        ...dto,
        assignedDate: new Date(dto.assignedDate),
        status: CustodyStatus.WITH_EMPLOYEE,
        createdBy: userId,
      },
      include: {
        employee: {
          select: {
            id: true,
            firstNameAr: true,
            lastNameAr: true,
            employeeNumber: true,
          },
        },
      },
    });
  }

  async findAll(query: ListCustodiesQueryDto) {
    const { page = 1, limit = 10, employeeId, status, category, search } = query;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };

    if (employeeId) where.employeeId = employeeId;
    if (status) where.status = status;
    if (category) where.category = category;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { serialNumber: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.custody.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          employee: {
            select: {
              id: true,
              firstNameAr: true,
              lastNameAr: true,
              employeeNumber: true,
              department: { select: { id: true, nameAr: true } },
            },
          },
        },
      }),
      this.prisma.custody.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const custody = await this.prisma.custody.findFirst({
      where: { id, deletedAt: null },
      include: {
        employee: {
          select: {
            id: true,
            firstNameAr: true,
            lastNameAr: true,
            firstNameEn: true,
            lastNameEn: true,
            employeeNumber: true,
            department: { select: { id: true, nameAr: true, nameEn: true } },
          },
        },
      },
    });
    if (!custody) {
      throw new NotFoundException('العهدة غير موجودة');
    }
    return custody;
  }

  async update(id: string, dto: UpdateCustodyDto) {
    await this.findOne(id);
    return this.prisma.custody.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.assignedDate && { assignedDate: new Date(dto.assignedDate) }),
      },
    });
  }

  async returnCustody(id: string, dto: ReturnCustodyDto) {
    const custody = await this.findOne(id);

    if (custody.status !== CustodyStatus.WITH_EMPLOYEE) {
      throw new BadRequestException('هذه العهدة ليست مع الموظف حالياً');
    }

    if (dto.status === CustodyStatus.WITH_EMPLOYEE) {
      throw new BadRequestException('لا يمكن تغيير الحالة إلى "مع الموظف"');
    }

    return this.prisma.custody.update({
      where: { id },
      data: {
        status: dto.status,
        returnedDate: dto.returnedDate ? new Date(dto.returnedDate) : new Date(),
        notes: dto.notes ?? custody.notes,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.custody.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async findByEmployee(employeeId: string) {
    return this.prisma.custody.findMany({
      where: { employeeId, deletedAt: null },
      orderBy: { assignedDate: 'desc' },
    });
  }

  async hasUnreturnedCustodies(employeeId: string): Promise<boolean> {
    const count = await this.prisma.custody.count({
      where: {
        employeeId,
        status: CustodyStatus.WITH_EMPLOYEE,
        deletedAt: null,
      },
    });
    return count > 0;
  }

  async getEmployeeCustodySummary(employeeId: string) {
    const [total, withEmployee, returned, damaged, lost] = await Promise.all([
      this.prisma.custody.count({ where: { employeeId, deletedAt: null } }),
      this.prisma.custody.count({ where: { employeeId, status: CustodyStatus.WITH_EMPLOYEE, deletedAt: null } }),
      this.prisma.custody.count({ where: { employeeId, status: CustodyStatus.RETURNED, deletedAt: null } }),
      this.prisma.custody.count({ where: { employeeId, status: CustodyStatus.DAMAGED, deletedAt: null } }),
      this.prisma.custody.count({ where: { employeeId, status: CustodyStatus.LOST, deletedAt: null } }),
    ]);
    return { total, withEmployee, returned, damaged, lost };
  }
}
