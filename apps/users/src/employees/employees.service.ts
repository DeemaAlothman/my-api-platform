import { Injectable, NotFoundException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { ListEmployeesQueryDto } from './dto/list-employees.query.dto';
import { LinkUserDto } from './dto/link-user.dto';

@Injectable()
export class EmployeesService {
  private readonly logger = new Logger(EmployeesService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly http: HttpService,
  ) {}

  async list(query: ListEmployeesQueryDto, includeManagerNotes = false) {
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
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              status: true,
              roles: {
                select: {
                  role: {
                    select: {
                      id: true,
                      name: true,
                      displayNameAr: true,
                      displayNameEn: true,
                    },
                  },
                },
              },
            },
          },
          attachments: true,
          trainingCertificates: true,
          allowances: true,
        },
      }),
      this.prisma.employee.count({ where }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return {
      items: includeManagerNotes ? items : items.map(e => this.stripManagerNotes(e)),
      page,
      limit,
      total,
      totalPages,
    };
  }

  async findOne(id: string, includeManagerNotes = false) {
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
            roles: {
              select: {
                role: {
                  select: {
                    id: true,
                    name: true,
                    displayNameAr: true,
                    displayNameEn: true,
                  },
                },
              },
            },
          },
        },
        attachments: true,
        trainingCertificates: true,
        allowances: true,
      },
    });

    if (!employee) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Employee not found',
        details: [{ field: 'id', value: id }],
      });
    }

    return includeManagerNotes ? employee : this.stripManagerNotes(employee);
  }

  async findByUsername(username: string) {
    // Query using username for cross-schema lookup (auth.User has different ID than users.users)
    const result = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT e.id
      FROM users.employees e
      INNER JOIN users.users u ON e."userId" = u.id
      WHERE u.username = ${username}
        AND e."deletedAt" IS NULL
      LIMIT 1
    `;

    if (!result || result.length === 0) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Employee not found',
        details: [{ field: 'username', value: username }],
      });
    }

    // Now fetch the full employee record with relations
    const employee = await this.prisma.employee.findFirst({
      where: {
        id: result[0].id,
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
            roles: {
              select: {
                role: {
                  select: {
                    id: true,
                    name: true,
                    displayNameAr: true,
                    displayNameEn: true,
                  },
                },
              },
            },
          },
        },
        attachments: true,
        trainingCertificates: true,
        allowances: true,
      },
    });

    return employee;
  }

  async create(dto: CreateEmployeeDto) {
    // تحقق من email موجود (نشط أو محذوف سابقاً)
    const existingEmail = await this.prisma.employee.findFirst({
      where: { email: dto.email },
    });

    if (existingEmail) {
      if (existingEmail.deletedAt !== null) {
        throw new ConflictException({
          code: 'EMPLOYEE_PREVIOUSLY_DELETED',
          message: 'An employee with this email was previously deleted. Please contact the admin to restore the record.',
          details: [{ field: 'email', value: dto.email }],
        });
      }
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
      employeeNumber = `VTX-EMP-${String(count + 1).padStart(6, '0')}`;
    }

    // تحقق من employeeNumber مو مكرر (نشط أو محذوف سابقاً)
    const existingNumber = await this.prisma.employee.findFirst({
      where: { employeeNumber },
    });

    if (existingNumber) {
      if (existingNumber.deletedAt !== null) {
        throw new ConflictException({
          code: 'EMPLOYEE_PREVIOUSLY_DELETED',
          message: 'An employee with this number was previously deleted. Please contact the admin to restore the record.',
          details: [{ field: 'employeeNumber', value: employeeNumber }],
        });
      }
      throw new ConflictException({
        code: 'RESOURCE_ALREADY_EXISTS',
        message: 'Employee number already exists',
        details: [{ field: 'employeeNumber', value: employeeNumber }],
      });
    }

    // التحقق من الراتب ضمن حدود الدرجة الوظيفية
    if (dto.jobGradeId && dto.basicSalary !== undefined) {
      await this.validateSalaryRange(dto.jobGradeId, dto.basicSalary);
    }

    const { attachments, trainingCertificates, allowances, ...employeeData } = dto;

    // B.2: Default contractEndDate = Dec 31 of the hire year
    let contractEndDate: Date | null = dto.contractEndDate ? new Date(dto.contractEndDate) : null;
    if (!contractEndDate) {
      const hireYear = new Date(dto.hireDate).getFullYear();
      contractEndDate = new Date(`${hireYear}-12-31T23:59:59.000Z`);
    }

    const employee = await this.prisma.employee.create({
      data: {
        ...employeeData,
        employeeNumber,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
        hireDate: new Date(dto.hireDate),
        contractEndDate,
        ...(attachments?.length ? { attachments: { create: attachments } } : {}),
        ...(trainingCertificates?.length ? { trainingCertificates: { create: trainingCertificates.map(({ name, attachmentUrl }) => ({ name, attachmentUrl })) } } : {}),
        ...(allowances?.length ? { allowances: { create: allowances.map(({ type, amount }) => ({ type, amount })) } } : {}),
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
        attachments: true,
        trainingCertificates: true,
        allowances: true,
      },
    });

    // تهيئة أرصدة الإجازات تلقائياً
    try {
      const leaveUrl = process.env.LEAVE_SERVICE_URL || 'http://leave:4003';
      await this.http.axiosRef.post(
        `${leaveUrl}/api/v1/internal/leave-balances/initialize`,
        { employeeId: employee.id, year: new Date().getFullYear() },
        { headers: { 'x-internal-token': process.env.INTERNAL_SERVICE_TOKEN } },
      );
    } catch (err) {
      this.logger.error(`Failed to init leave balances for ${employee.id}: ${err?.message}`);
    }

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

    // التحقق من الراتب ضمن حدود الدرجة الوظيفية
    const employee = await this.prisma.employee.findFirst({ where: { id, deletedAt: null } });
    const gradeId = dto.jobGradeId ?? employee?.jobGradeId;
    const salary = dto.basicSalary ?? (employee?.basicSalary ? Number(employee.basicSalary) : undefined);
    if (gradeId && salary !== undefined) {
      await this.validateSalaryRange(gradeId, salary);
    }

    const { attachments, trainingCertificates, allowances, ...employeeData } = dto;

    // B.2: If contractEndDate is explicitly null in the DTO, reset to end of current year
    let contractEndDateUpdate: Date | undefined | null = undefined;
    if ('contractEndDate' in dto) {
      if (dto.contractEndDate === null || dto.contractEndDate === undefined) {
        const year = new Date().getFullYear();
        contractEndDateUpdate = new Date(`${year}-12-31T23:59:59.000Z`);
      } else {
        contractEndDateUpdate = new Date(dto.contractEndDate as string);
      }
    }

    const updated = await this.prisma.employee.update({
      where: { id },
      data: {
        ...employeeData,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        hireDate: dto.hireDate ? new Date(dto.hireDate) : undefined,
        contractEndDate: contractEndDateUpdate,
        ...(attachments !== undefined ? {
          attachments: { deleteMany: {}, create: attachments.map(({ fileUrl, fileName }) => ({ fileUrl, fileName })) },
        } : {}),
        ...(trainingCertificates !== undefined ? {
          trainingCertificates: { deleteMany: {}, create: trainingCertificates.map(({ name, attachmentUrl }) => ({ name, attachmentUrl })) },
        } : {}),
        ...(allowances !== undefined ? {
          allowances: { deleteMany: {}, create: allowances.map(({ type, amount }) => ({ type, amount })) },
        } : {}),
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
        attachments: true,
        trainingCertificates: true,
        allowances: true,
      },
    });

    return updated;
  }

  // B.1: Manager notes — get
  async getManagerNotes(id: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        managerNotes: true,
        managerNotesUpdatedAt: true,
        managerNotesUpdatedBy: true,
      } as any,
    });
    if (!employee) {
      throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Employee not found', details: [{ field: 'id', value: id }] });
    }
    return employee;
  }

  // B.1: Manager notes — update
  async updateManagerNotes(id: string, notes: string, updatedBy: string) {
    await this.findOne(id);
    return this.prisma.employee.update({
      where: { id },
      data: {
        managerNotes: notes,
        managerNotesUpdatedAt: new Date(),
        managerNotesUpdatedBy: updatedBy,
      } as any,
      select: {
        id: true,
        managerNotes: true,
        managerNotesUpdatedAt: true,
        managerNotesUpdatedBy: true,
      } as any,
    });
  }

  // B.1.3: Strip manager notes fields from any employee object
  private stripManagerNotes<T extends Record<string, any>>(obj: T): T {
    if (!obj || typeof obj !== 'object') return obj;
    const copy = { ...obj } as any;
    delete copy.managerNotes;
    delete copy.managerNotesUpdatedAt;
    delete copy.managerNotesUpdatedBy;
    return copy;
  }

  // B.4: HR report — probation ending within N days
  async getProbationEndingReport(days: number) {
    const targetDate = new Date();
    targetDate.setUTCDate(targetDate.getUTCDate() + days);
    const targetStr = targetDate.toISOString().split('T')[0];

    const items = await this.prisma.$queryRawUnsafe(`
      SELECT
        e.id,
        e."employeeNumber",
        CONCAT(e."firstNameAr", ' ', e."lastNameAr") AS "fullNameAr",
        d."nameAr" AS "departmentName",
        e."hireDate",
        e."probationPeriod",
        CASE
          WHEN e."probationPeriod" = 'ONE_MONTH'     THEN (e."hireDate" + INTERVAL '1 month')::date
          WHEN e."probationPeriod" = 'TWO_MONTHS'    THEN (e."hireDate" + INTERVAL '2 months')::date
          WHEN e."probationPeriod" = 'THREE_MONTHS'  THEN (e."hireDate" + INTERVAL '3 months')::date
        END AS "probationEndDate",
        CASE
          WHEN e."probationPeriod" = 'ONE_MONTH'     THEN (e."hireDate" + INTERVAL '1 month')::date - CURRENT_DATE
          WHEN e."probationPeriod" = 'TWO_MONTHS'    THEN (e."hireDate" + INTERVAL '2 months')::date - CURRENT_DATE
          WHEN e."probationPeriod" = 'THREE_MONTHS'  THEN (e."hireDate" + INTERVAL '3 months')::date - CURRENT_DATE
        END AS "daysRemaining"
      FROM users.employees e
      LEFT JOIN users.departments d ON d.id = e."departmentId"
      WHERE e."deletedAt" IS NULL
        AND e."employmentStatus" = 'ACTIVE'
        AND e."probationResult" IS NULL
        AND e."probationPeriod" IN ('ONE_MONTH', 'TWO_MONTHS', 'THREE_MONTHS')
        AND (
          (e."probationPeriod" = 'ONE_MONTH'    AND (e."hireDate" + INTERVAL '1 month')::date    BETWEEN CURRENT_DATE AND $1::date)
          OR (e."probationPeriod" = 'TWO_MONTHS'   AND (e."hireDate" + INTERVAL '2 months')::date   BETWEEN CURRENT_DATE AND $1::date)
          OR (e."probationPeriod" = 'THREE_MONTHS' AND (e."hireDate" + INTERVAL '3 months')::date BETWEEN CURRENT_DATE AND $1::date)
        )
      ORDER BY "daysRemaining" ASC
    `, targetStr) as any[];

    return { items, total: items.length };
  }

  // B.4: HR report — contract ending within N days
  async getContractEndingReport(days: number) {
    const targetDate = new Date();
    targetDate.setUTCDate(targetDate.getUTCDate() + days);
    const targetStr = targetDate.toISOString().split('T')[0];

    const items = await this.prisma.$queryRawUnsafe(`
      SELECT
        e.id,
        e."employeeNumber",
        CONCAT(e."firstNameAr", ' ', e."lastNameAr") AS "fullNameAr",
        d."nameAr" AS "departmentName",
        e."contractType",
        e."contractEndDate",
        (e."contractEndDate"::date - CURRENT_DATE) AS "daysRemaining"
      FROM users.employees e
      LEFT JOIN users.departments d ON d.id = e."departmentId"
      WHERE e."deletedAt" IS NULL
        AND e."employmentStatus" = 'ACTIVE'
        AND e."contractEndDate" IS NOT NULL
        AND e."contractEndDate"::date BETWEEN CURRENT_DATE AND $1::date
      ORDER BY e."contractEndDate" ASC
    `, targetStr) as any[];

    return { items, total: items.length };
  }

  private async validateSalaryRange(jobGradeId: string, salary: number) {
    const grade = await this.prisma.jobGrade.findFirst({ where: { id: jobGradeId } });
    if (!grade) return;
    if (grade.minSalary !== null && salary < Number(grade.minSalary)) {
      throw new BadRequestException({
        code: 'SALARY_OUT_OF_RANGE',
        message: `Salary ${salary} is below the minimum ${grade.minSalary} for job grade "${grade.nameAr}"`,
        details: [{ field: 'basicSalary', min: grade.minSalary, max: grade.maxSalary }],
      });
    }
    if (grade.maxSalary !== null && salary > Number(grade.maxSalary)) {
      throw new BadRequestException({
        code: 'SALARY_OUT_OF_RANGE',
        message: `Salary ${salary} exceeds the maximum ${grade.maxSalary} for job grade "${grade.nameAr}"`,
        details: [{ field: 'basicSalary', min: grade.minSalary, max: grade.maxSalary }],
      });
    }
  }

  async remove(id: string) {
    // تحقق من الموظف موجود
    await this.findOne(id);

    // soft delete — null out userId to free the unique constraint
    await this.prisma.employee.update({
      where: { id },
      data: { deletedAt: new Date(), userId: null },
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

  async getReportingChain(employeeId: string) {
    const chain: any[] = [];
    let currentId: string | null = employeeId;
    const visited = new Set<string>();

    while (currentId) {
      if (visited.has(currentId)) break; // حماية من الدورات
      visited.add(currentId);

      const emp = await this.prisma.employee.findFirst({
        where: { id: currentId, deletedAt: null },
        select: {
          id: true,
          employeeNumber: true,
          firstNameAr: true,
          lastNameAr: true,
          firstNameEn: true,
          lastNameEn: true,
          managerId: true,
          jobTitle: { select: { id: true, nameAr: true, nameEn: true } },
          department: { select: { id: true, nameAr: true, nameEn: true } },
        },
      });

      if (!emp) break;
      chain.push(emp);
      currentId = emp.managerId;
    }

    if (chain.length === 0) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Employee not found',
        details: [{ field: 'id', value: employeeId }],
      });
    }

    return chain;
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
            roles: {
              select: {
                role: {
                  select: {
                    id: true,
                    name: true,
                    displayNameAr: true,
                    displayNameEn: true,
                  },
                },
              },
            },
          },
        },
        department: true,
        jobTitle: true,
      },
    });

    return updated;
  }

  // Internal: called by evaluation-service when probation evaluation is COMPLETED
  async updateProbationResult(data: {
    employeeId: string;
    result: string;
    completedAt: string;
  }) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: data.employeeId, deletedAt: null },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    const updateData: any = {
      probationResult: data.result as any,
      probationCompletedAt: new Date(data.completedAt),
    };

    if (data.result === 'TERMINATE') {
      updateData.employmentStatus = 'TERMINATED';
    } else if (data.result === 'CONFIRM_POSITION') {
      updateData.employmentStatus = 'ACTIVE';
    }

    return this.prisma.employee.update({
      where: { id: data.employeeId },
      data: updateData,
      select: { id: true, employmentStatus: true, probationResult: true, probationCompletedAt: true },
    });
  }

  // Internal: called by jobs-service when interview evaluation is transferred
  async updateInterviewResult(data: {
    jobApplicationId: string;
    totalScore: number;
    decision: string;
    proposedSalary?: number;
  }) {
    // Map score to enum value
    let evalEnum: string;
    if (data.totalScore >= 90) evalEnum = 'EXCELLENT';
    else if (data.totalScore >= 75) evalEnum = 'VERY_GOOD';
    else if (data.totalScore >= 60) evalEnum = 'GOOD';
    else if (data.totalScore >= 50) evalEnum = 'ACCEPTABLE';
    else evalEnum = 'POOR';

    // Find employee by jobApplicationId is not possible directly here
    // (jobApplicationId is external from VitaSyr, not stored in users schema)
    // Just return ok — the caller can store jobApplicationId on their side
    return { ok: true, mapped: evalEnum };
  }

  async resolveRecipients(
    userIds: string[],
    departmentIds: string[],
    excludeInactive: boolean,
  ): Promise<{ resolvedUserIds: string[]; invalidUserIds: string[]; invalidDepartmentIds: string[] }> {
    const resolvedSet = new Set<string>();
    const invalidUserIds: string[] = [];
    const invalidDepartmentIds: string[] = [];

    if (userIds?.length) {
      const where: any = { userId: { in: userIds }, deletedAt: null };
      if (excludeInactive) where.employmentStatus = 'ACTIVE';
      const found = await this.prisma.employee.findMany({ where, select: { userId: true } });
      const foundSet = new Set(found.map((e) => e.userId));
      for (const uid of userIds) {
        if (foundSet.has(uid)) resolvedSet.add(uid);
        else invalidUserIds.push(uid);
      }
    }

    for (const deptId of (departmentIds ?? [])) {
      const dept = await this.prisma.department.findFirst({ where: { id: deptId, deletedAt: null } });
      if (!dept) { invalidDepartmentIds.push(deptId); continue; }
      const where: any = { departmentId: deptId, deletedAt: null, userId: { not: null } };
      if (excludeInactive) where.employmentStatus = 'ACTIVE';
      const emps = await this.prisma.employee.findMany({ where, select: { userId: true } });
      for (const e of emps) { if (e.userId) resolvedSet.add(e.userId); }
    }

    return { resolvedUserIds: Array.from(resolvedSet), invalidUserIds, invalidDepartmentIds };
  }
}
