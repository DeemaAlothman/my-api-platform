import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { ListEmployeesQueryDto } from './dto/list-employees.query.dto';
import { LinkUserDto } from './dto/link-user.dto';

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListEmployeesQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: null,
    };

    if (query.status) {
      where.employmentStatus = query.status;
    }

    if (query.departmentId) {
      where.departmentId = query.departmentId;
    }

    if (query.managerId) {
      where.managerId = query.managerId;
    }

    if (query.search) {
      const s = query.search.trim();
      if (s.length > 0) {
        where.OR = [
          { employeeNumber: { contains: s, mode: 'insensitive' } },
          { firstNameAr: { contains: s, mode: 'insensitive' } },
          { lastNameAr: { contains: s, mode: 'insensitive' } },
          { firstNameEn: { contains: s, mode: 'insensitive' } },
          { lastNameEn: { contains: s, mode: 'insensitive' } },
          { email: { contains: s, mode: 'insensitive' } },
        ];
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          department: {
            select: {
              id: true,
              code: true,
              nameAr: true,
              nameEn: true,
            },
          },
          jobTitle: {
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
            },
          },
        },
      }),
      this.prisma.employee.count({ where }),
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
    const employee = await this.prisma.employee.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        department: true,
        jobTitle: true,
        manager: {
          select: {
            id: true,
            employeeNumber: true,
            firstNameAr: true,
            lastNameAr: true,
            email: true,
          },
        },
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            status: true,
          },
        },
      },
    });

    if (!employee) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Employee not found',
        details: [{ field: 'id', value: id }],
      });
    }

    return employee;
  }

  async create(dto: CreateEmployeeDto) {
    // تحقق من email موجود
    const existingEmail = await this.prisma.employee.findFirst({
      where: {
        email: dto.email,
        deletedAt: null,
      },
    });

    if (existingEmail) {
      throw new ConflictException({
        code: 'RESOURCE_ALREADY_EXISTS',
        message: 'Email already exists',
        details: [{ field: 'email', value: dto.email }],
      });
    }

    // تحقق من Department موجود
    const department = await this.prisma.department.findFirst({
      where: { id: dto.departmentId, deletedAt: null },
    });

    if (!department) {
      throw new BadRequestException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Department not found',
        details: [{ field: 'departmentId', value: dto.departmentId }],
      });
    }

    // توليد employeeNumber إذا مو موجود
    let employeeNumber = dto.employeeNumber;
    if (!employeeNumber) {
      const count = await this.prisma.employee.count();
      employeeNumber = `EMP${String(count + 1).padStart(6, '0')}`;
    }

    // تحقق من employeeNumber مو مكرر
    const existingNumber = await this.prisma.employee.findFirst({
      where: {
        employeeNumber,
        deletedAt: null,
      },
    });

    if (existingNumber) {
      throw new ConflictException({
        code: 'RESOURCE_ALREADY_EXISTS',
        message: 'Employee number already exists',
        details: [{ field: 'employeeNumber', value: employeeNumber }],
      });
    }

    const employee = await this.prisma.employee.create({
      data: {
        ...dto,
        employeeNumber,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
        hireDate: new Date(dto.hireDate),
        contractEndDate: dto.contractEndDate ? new Date(dto.contractEndDate) : null,
      },
      include: {
        department: true,
        jobTitle: true,
        manager: {
          select: {
            id: true,
            employeeNumber: true,
            firstNameAr: true,
            lastNameAr: true,
          },
        },
      },
    });

    return employee;
  }

  async update(id: string, dto: UpdateEmployeeDto) {
    // تحقق من الموظف موجود
    await this.findOne(id);

    // إذا بدّل email، تحقق مو محجوز
    if (dto.email) {
      const existing = await this.prisma.employee.findFirst({
        where: {
          email: dto.email,
          deletedAt: null,
          NOT: { id },
        },
      });

      if (existing) {
        throw new ConflictException({
          code: 'RESOURCE_ALREADY_EXISTS',
          message: 'Email already exists',
          details: [{ field: 'email', value: dto.email }],
        });
      }
    }

    // إذا بدّل Department، تحقق موجود
    if (dto.departmentId) {
      const department = await this.prisma.department.findFirst({
        where: { id: dto.departmentId, deletedAt: null },
      });

      if (!department) {
        throw new BadRequestException({
          code: 'RESOURCE_NOT_FOUND',
          message: 'Department not found',
          details: [{ field: 'departmentId', value: dto.departmentId }],
        });
      }
    }

    const employee = await this.prisma.employee.update({
      where: { id },
      data: {
        ...dto,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        contractEndDate: dto.contractEndDate ? new Date(dto.contractEndDate) : undefined,
      },
      include: {
        department: true,
        jobTitle: true,
        manager: {
          select: {
            id: true,
            employeeNumber: true,
            firstNameAr: true,
            lastNameAr: true,
          },
        },
      },
    });

    return employee;
  }

  async remove(id: string) {
    // تحقق من الموظف موجود
    await this.findOne(id);

    // soft delete
    await this.prisma.employee.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async getByDepartment(departmentId: string) {
    // تحقق من Department موجود
    const department = await this.prisma.department.findFirst({
      where: { id: departmentId, deletedAt: null },
    });

    if (!department) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Department not found',
        details: [{ field: 'departmentId', value: departmentId }],
      });
    }

    const employees = await this.prisma.employee.findMany({
      where: {
        departmentId,
        deletedAt: null,
      },
      include: {
        jobTitle: {
          select: {
            id: true,
            code: true,
            nameAr: true,
            nameEn: true,
          },
        },
      },
      orderBy: { employeeNumber: 'asc' },
    });

    return employees;
  }

  async getSubordinates(managerId: string) {
    // تحقق من Manager موجود
    const manager = await this.prisma.employee.findFirst({
      where: { id: managerId, deletedAt: null },
    });

    if (!manager) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Manager not found',
        details: [{ field: 'managerId', value: managerId }],
      });
    }

    const subordinates = await this.prisma.employee.findMany({
      where: {
        managerId,
        deletedAt: null,
      },
      include: {
        department: {
          select: {
            id: true,
            code: true,
            nameAr: true,
            nameEn: true,
          },
        },
        jobTitle: {
          select: {
            id: true,
            code: true,
            nameAr: true,
            nameEn: true,
          },
        },
      },
      orderBy: { employeeNumber: 'asc' },
    });

    return subordinates;
  }

  async linkUser(id: string, dto: LinkUserDto) {
    // تحقق من الموظف موجود
    const employee = await this.findOne(id);

    // تحقق من User موجود
    const user = await this.prisma.user.findFirst({
      where: { id: dto.userId, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'User not found',
        details: [{ field: 'userId', value: dto.userId }],
      });
    }

    // تحقق من User مو مربوط بموظف ثاني
    const existingLink = await this.prisma.employee.findFirst({
      where: {
        userId: dto.userId,
        deletedAt: null,
        NOT: { id },
      },
    });

    if (existingLink) {
      throw new ConflictException({
        code: 'RESOURCE_CONFLICT',
        message: 'User is already linked to another employee',
        details: [{ field: 'userId', employeeId: existingLink.id }],
      });
    }

    const updated = await this.prisma.employee.update({
      where: { id },
      data: { userId: dto.userId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            status: true,
          },
        },
        department: true,
        jobTitle: true,
      },
    });

    return updated;
  }
}
