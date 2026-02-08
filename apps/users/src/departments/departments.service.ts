import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { ListDepartmentsQueryDto } from './dto/list-departments.query.dto';

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async getTree() {
    // جلب كل الأقسام مع العلاقات
    const departments = await this.prisma.department.findMany({
      where: { deletedAt: null },
      include: {
        manager: {
          select: {
            id: true,
            employeeNumber: true,
            firstNameAr: true,
            lastNameAr: true,
            firstNameEn: true,
            lastNameEn: true,
          },
        },
        children: {
          where: { deletedAt: null },
          include: {
            manager: {
              select: {
                id: true,
                employeeNumber: true,
                firstNameAr: true,
                lastNameAr: true,
                firstNameEn: true,
                lastNameEn: true,
              },
            },
            children: {
              where: { deletedAt: null },
            },
          },
        },
      },
      orderBy: { code: 'asc' },
    });

    // إرجاع فقط الأقسام الجذرية (بدون parent)
    return departments.filter((d) => !d.parentId);
  }

  async list(query: ListDepartmentsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: null,
    };

    if (query.parentId) {
      where.parentId = query.parentId;
    }

    if (query.search) {
      const s = query.search.trim();
      if (s.length > 0) {
        where.OR = [
          { code: { contains: s, mode: 'insensitive' } },
          { nameAr: { contains: s, mode: 'insensitive' } },
          { nameEn: { contains: s, mode: 'insensitive' } },
          { nameTr: { contains: s, mode: 'insensitive' } },
        ];
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.department.findMany({
        where,
        orderBy: { code: 'asc' },
        skip,
        take: limit,
        include: {
          parent: {
            select: {
              id: true,
              code: true,
              nameAr: true,
              nameEn: true,
            },
          },
          manager: {
            select: {
              id: true,
              employeeNumber: true,
              firstNameAr: true,
              lastNameAr: true,
              firstNameEn: true,
              lastNameEn: true,
            },
          },
          _count: {
            select: {
              children: true,
              employees: true,
            },
          },
        },
      }),
      this.prisma.department.count({ where }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return {
      items,
      page,
      limit,
      total,
      totalPages,
    };
  }

  async findOne(id: string) {
    const department = await this.prisma.department.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        parent: {
          select: {
            id: true,
            code: true,
            nameAr: true,
            nameEn: true,
          },
        },
        manager: {
          select: {
            id: true,
            employeeNumber: true,
            firstNameAr: true,
            lastNameAr: true,
            firstNameEn: true,
            lastNameEn: true,
          },
        },
        children: {
          where: { deletedAt: null },
          select: {
            id: true,
            code: true,
            nameAr: true,
            nameEn: true,
          },
        },
        _count: {
          select: {
            employees: true,
          },
        },
      },
    });

    if (!department) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Department not found',
        details: [{ field: 'id', value: id }],
      });
    }

    return department;
  }

  async create(dto: CreateDepartmentDto) {
    // تحقق من code موجود
    const existingCode = await this.prisma.department.findFirst({
      where: {
        code: dto.code,
        deletedAt: null,
      },
    });

    if (existingCode) {
      throw new ConflictException({
        code: 'RESOURCE_ALREADY_EXISTS',
        message: 'Department code already exists',
        details: [{ field: 'code', value: dto.code }],
      });
    }

    // إذا فيه parentId، تحقق موجود
    if (dto.parentId) {
      const parent = await this.prisma.department.findFirst({
        where: { id: dto.parentId, deletedAt: null },
      });

      if (!parent) {
        throw new BadRequestException({
          code: 'RESOURCE_NOT_FOUND',
          message: 'Parent department not found',
          details: [{ field: 'parentId', value: dto.parentId }],
        });
      }
    }

    // إذا فيه managerId، تحقق موجود
    if (dto.managerId) {
      const manager = await this.prisma.employee.findFirst({
        where: { id: dto.managerId, deletedAt: null },
      });

      if (!manager) {
        throw new BadRequestException({
          code: 'RESOURCE_NOT_FOUND',
          message: 'Manager not found',
          details: [{ field: 'managerId', value: dto.managerId }],
        });
      }
    }

    const department = await this.prisma.department.create({
      data: dto,
      include: {
        parent: {
          select: {
            id: true,
            code: true,
            nameAr: true,
            nameEn: true,
          },
        },
        manager: {
          select: {
            id: true,
            employeeNumber: true,
            firstNameAr: true,
            lastNameAr: true,
            firstNameEn: true,
            lastNameEn: true,
          },
        },
      },
    });

    return department;
  }

  async update(id: string, dto: UpdateDepartmentDto) {
    // تحقق من القسم موجود
    await this.findOne(id);

    // إذا بدّل code، تحقق مو محجوز
    if (dto.code) {
      const existing = await this.prisma.department.findFirst({
        where: {
          code: dto.code,
          deletedAt: null,
          NOT: { id },
        },
      });

      if (existing) {
        throw new ConflictException({
          code: 'RESOURCE_ALREADY_EXISTS',
          message: 'Department code already exists',
          details: [{ field: 'code', value: dto.code }],
        });
      }
    }

    // إذا بدّل parentId، تحقق موجود ومو نفسه
    if (dto.parentId) {
      if (dto.parentId === id) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Department cannot be its own parent',
          details: [{ field: 'parentId' }],
        });
      }

      const parent = await this.prisma.department.findFirst({
        where: { id: dto.parentId, deletedAt: null },
      });

      if (!parent) {
        throw new BadRequestException({
          code: 'RESOURCE_NOT_FOUND',
          message: 'Parent department not found',
          details: [{ field: 'parentId', value: dto.parentId }],
        });
      }
    }

    // إذا بدّل managerId، تحقق موجود
    if (dto.managerId) {
      const manager = await this.prisma.employee.findFirst({
        where: { id: dto.managerId, deletedAt: null },
      });

      if (!manager) {
        throw new BadRequestException({
          code: 'RESOURCE_NOT_FOUND',
          message: 'Manager not found',
          details: [{ field: 'managerId', value: dto.managerId }],
        });
      }
    }

    const department = await this.prisma.department.update({
      where: { id },
      data: dto,
      include: {
        parent: {
          select: {
            id: true,
            code: true,
            nameAr: true,
            nameEn: true,
          },
        },
        manager: {
          select: {
            id: true,
            employeeNumber: true,
            firstNameAr: true,
            lastNameAr: true,
            firstNameEn: true,
            lastNameEn: true,
          },
        },
      },
    });

    return department;
  }

  async remove(id: string) {
    // تحقق من القسم موجود
    const department = await this.findOne(id);

    // تحقق ما عنده أقسام فرعية
    const childrenCount = await this.prisma.department.count({
      where: {
        parentId: id,
        deletedAt: null,
      },
    });

    if (childrenCount > 0) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Cannot delete department with sub-departments',
        details: [{ field: 'children', count: childrenCount }],
      });
    }

    // تحقق ما فيه موظفين
    const employeesCount = await this.prisma.employee.count({
      where: {
        departmentId: id,
        deletedAt: null,
      },
    });

    if (employeesCount > 0) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Cannot delete department with employees',
        details: [{ field: 'employees', count: employeesCount }],
      });
    }

    // soft delete
    await this.prisma.department.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
