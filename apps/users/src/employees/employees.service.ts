import { Injectable, NotFoundException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { ListEmployeesQueryDto } from './dto/list-employees.query.dto';
import { LinkUserDto } from './dto/link-user.dto';
import { TransferEmployeeDto, ChangeSalaryDto } from './dto/employee-history.dto';

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
              description: true,
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

    const employeeIds = items.map(e => e.id);
    const configs = employeeIds.length
      ? await this.prisma.$queryRawUnsafe<Array<{ employeeId: string; salaryLinked: boolean; allowedBreakMinutes: number }>>(
          `SELECT "employeeId"::text, "salaryLinked", "allowedBreakMinutes"
           FROM attendance.employee_attendance_configs
           WHERE "employeeId"::text IN (${employeeIds.map((_, i) => `$${i + 1}`).join(', ')})`,
          ...employeeIds,
        )
      : [];
    const configMap = new Map(configs.map(c => [c.employeeId, c]));

    const itemsWithConfig = items.map(e => ({
      ...e,
      attendanceConfig: configMap.get(e.id) ?? null,
    }));

    return {
      items: includeManagerNotes ? itemsWithConfig : itemsWithConfig.map(e => this.stripManagerNotes(e)),
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
        department: {
          include: {
            parent: {
              select: { id: true, nameAr: true, nameEn: true },
            },
          },
        },
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

  async findBasic(id: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        firstNameAr: true,
        lastNameAr: true,
        firstNameEn: true,
        lastNameEn: true,
        email: true,
        employeeNumber: true,
        employmentStatus: true,
        hireDate: true,
        phone: true,
        mobile: true,
        profilePhoto: true,
        department: {
          select: {
            id: true,
            nameAr: true,
            nameEn: true,
            parent: {
              select: { id: true, nameAr: true, nameEn: true },
            },
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

  async findBasicByIds(ids: string[]) {
    if (!ids.length) return [];
    return this.prisma.employee.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: { id: true, firstNameAr: true, lastNameAr: true, firstNameEn: true, lastNameEn: true },
    });
  }

  async findByUserIdInternal(userId: string) {
    return this.prisma.employee.findFirst({
      where: { userId, deletedAt: null },
      select: {
        firstNameAr: true,
        lastNameAr: true,
        firstNameEn: true,
        lastNameEn: true,
        jobTitle: { select: { nameAr: true, nameEn: true } },
      },
    });
  }

  async resolveEmployeeIds(employeeIds: string[]): Promise<{ employeeId: string; userId: string }[]> {
    if (!employeeIds.length) return [];

    // First pass: treat as employee IDs
    const byEmpId = await this.prisma.employee.findMany({
      where: { id: { in: employeeIds }, deletedAt: null, employmentStatus: 'ACTIVE', userId: { not: null } },
      select: { id: true, userId: true },
    });

    const resolved = new Set(byEmpId.map(e => e.id));
    const remaining = employeeIds.filter(id => !resolved.has(id));

    // Second pass: treat remaining as userIds (frontend may send senderId directly)
    let byUserId: Array<{ id: string; userId: string | null }> = [];
    if (remaining.length > 0) {
      byUserId = await this.prisma.employee.findMany({
        where: { userId: { in: remaining }, deletedAt: null, employmentStatus: 'ACTIVE' },
        select: { id: true, userId: true },
      });
    }

    return [
      ...byEmpId.filter(e => e.userId).map(e => ({ employeeId: e.id, userId: e.userId! })),
      ...byUserId.filter(e => e.userId).map(e => ({ employeeId: e.id, userId: e.userId! })),
    ];
  }

  async findManyByUserIds(userIds: string[]): Promise<Array<{
    userId: string; employeeId: string;
    firstNameAr: string; lastNameAr: string;
    firstNameEn: string | null; lastNameEn: string | null;
  }>> {
    if (!userIds.length) return [];
    const employees = await this.prisma.employee.findMany({
      where: { userId: { in: userIds }, deletedAt: null },
      select: { id: true, userId: true, firstNameAr: true, lastNameAr: true, firstNameEn: true, lastNameEn: true },
    });
    return employees
      .filter(e => e.userId)
      .map(e => ({
        userId: e.userId!,
        employeeId: e.id,
        firstNameAr: e.firstNameAr,
        lastNameAr: e.lastNameAr,
        firstNameEn: e.firstNameEn,
        lastNameEn: e.lastNameEn,
      }));
  }

  async getSubordinateIds(managerId: string): Promise<string[]> {
    const subordinates = await this.prisma.employee.findMany({
      where: { managerId, deletedAt: null },
      select: { id: true },
    });
    return subordinates.map(s => s.id);
  }

  async findAllBasic() {
    return this.prisma.employee.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        userId: true,
        firstNameAr: true,
        lastNameAr: true,
        firstNameEn: true,
        lastNameEn: true,
        email: true,
        employeeNumber: true,
        employmentStatus: true,
        hireDate: true,
        phone: true,
        mobile: true,
        profilePhoto: true,
        department: {
          select: {
            id: true,
            nameAr: true,
            nameEn: true,
            parent: {
              select: { id: true, nameAr: true, nameEn: true },
            },
          },
        },
      },
      orderBy: { firstNameAr: 'asc' },
    });
  }

  async findByCompany(company: string) {
    return this.prisma.employee.findMany({
      where: { deletedAt: null, company },
      select: {
        id: true,
        firstNameAr: true,
        lastNameAr: true,
        firstNameEn: true,
        lastNameEn: true,
        email: true,
        employeeNumber: true,
        employmentStatus: true,
        profilePhoto: true,
        company: true,
        department: {
          select: {
            id: true,
            nameAr: true,
            nameEn: true,
          },
        },
        jobTitle: {
          select: { id: true, nameAr: true, nameEn: true },
        },
      },
      orderBy: { firstNameAr: 'asc' },
    });
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
        jobGrade: true,
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

  // ── Employee dossier / history ──────────────────────────────────────────

  // نقل/تغيير وظيفي: يعدّل الحقول المُرسَلة فقط داخل transaction ويسجّل حدث TRANSFER
  // بالقيم القديمة→الجديدة (مع أسماء القسم/المنصب/المدير وقت التغيير).
  async transfer(id: string, dto: TransferEmployeeDto, performedBy?: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, deletedAt: null },
    });
    if (!employee) {
      throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Employee not found', details: [{ id }] });
    }

    const data: any = {};
    const from: any = {};
    const to: any = {};

    if (dto.departmentId && dto.departmentId !== employee.departmentId) {
      const dept = await this.prisma.department.findFirst({ where: { id: dto.departmentId, deletedAt: null } });
      if (!dept) {
        throw new BadRequestException({ code: 'RESOURCE_NOT_FOUND', message: 'Department not found', details: [{ field: 'departmentId', value: dto.departmentId }] });
      }
      const old = await this.prisma.department.findUnique({ where: { id: employee.departmentId } });
      from.department = { id: employee.departmentId, nameAr: old?.nameAr ?? null };
      to.department = { id: dept.id, nameAr: dept.nameAr };
      data.departmentId = dept.id;
    }

    if (dto.jobTitleId !== undefined && dto.jobTitleId !== employee.jobTitleId) {
      const jt = dto.jobTitleId ? await this.prisma.jobTitle.findUnique({ where: { id: dto.jobTitleId } }) : null;
      if (dto.jobTitleId && !jt) {
        throw new BadRequestException({ code: 'RESOURCE_NOT_FOUND', message: 'Job title not found', details: [{ field: 'jobTitleId', value: dto.jobTitleId }] });
      }
      const old = employee.jobTitleId ? await this.prisma.jobTitle.findUnique({ where: { id: employee.jobTitleId } }) : null;
      from.jobTitle = employee.jobTitleId ? { id: employee.jobTitleId, nameAr: old?.nameAr ?? null } : null;
      to.jobTitle = jt ? { id: jt.id, nameAr: jt.nameAr } : null;
      data.jobTitleId = dto.jobTitleId || null;
    }

    if (dto.jobGradeId !== undefined && dto.jobGradeId !== employee.jobGradeId) {
      const jg = dto.jobGradeId ? await this.prisma.jobGrade.findUnique({ where: { id: dto.jobGradeId } }) : null;
      if (dto.jobGradeId && !jg) {
        throw new BadRequestException({ code: 'RESOURCE_NOT_FOUND', message: 'Job grade not found', details: [{ field: 'jobGradeId', value: dto.jobGradeId }] });
      }
      const old = employee.jobGradeId ? await this.prisma.jobGrade.findUnique({ where: { id: employee.jobGradeId } }) : null;
      from.jobGrade = employee.jobGradeId ? { id: employee.jobGradeId, nameAr: old?.nameAr ?? null } : null;
      to.jobGrade = jg ? { id: jg.id, nameAr: jg.nameAr } : null;
      data.jobGradeId = dto.jobGradeId || null;
    }

    if (dto.managerId !== undefined && dto.managerId !== employee.managerId) {
      if (dto.managerId === id) {
        throw new BadRequestException({ code: 'INVALID_MANAGER', message: 'Employee cannot be their own manager', details: [] });
      }
      const mgr = dto.managerId ? await this.prisma.employee.findFirst({ where: { id: dto.managerId, deletedAt: null } }) : null;
      if (dto.managerId && !mgr) {
        throw new BadRequestException({ code: 'RESOURCE_NOT_FOUND', message: 'Manager not found', details: [{ field: 'managerId', value: dto.managerId }] });
      }
      const old = employee.managerId ? await this.prisma.employee.findUnique({ where: { id: employee.managerId } }) : null;
      from.manager = employee.managerId ? { id: employee.managerId, name: old ? `${old.firstNameAr} ${old.lastNameAr}` : null } : null;
      to.manager = mgr ? { id: mgr.id, name: `${mgr.firstNameAr} ${mgr.lastNameAr}` } : null;
      data.managerId = dto.managerId || null;
    }

    if (dto.basicSalary !== undefined && Number(dto.basicSalary) !== Number(employee.basicSalary ?? 0)) {
      // يفحص الراتب فقط إذا تغيّرت الدرجة الوظيفية في نفس الطلب — مثل إضافة موظف جديد
      if (data.jobGradeId) await this.validateSalaryRange(data.jobGradeId, Number(dto.basicSalary));
      from.salary = { basicSalary: employee.basicSalary, currency: employee.salaryCurrency };
      to.salary = { basicSalary: dto.basicSalary, currency: dto.salaryCurrency ?? employee.salaryCurrency };
      data.basicSalary = dto.basicSalary;
      if (dto.salaryCurrency) data.salaryCurrency = dto.salaryCurrency;
    }

    if (dto.allowances !== undefined) {
      data.allowances = { deleteMany: {}, create: dto.allowances.map(({ type, amount }) => ({ type, amount })) };
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException({ code: 'NO_CHANGES', message: 'لم يتم تقديم أي تغيير', details: [] });
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.employee.update({ where: { id }, data });
      await tx.employeeHistoryEvent.create({
        data: {
          employeeId: id,
          eventType: 'TRANSFER',
          fromValue: from,
          toValue: to,
          note: dto.note ?? null,
          effectiveDate: new Date(dto.effectiveDate),
          performedBy: performedBy ?? null,
        },
      });
      return updated;
    });
  }

  // تغيير راتب مستقل (أو ترقية) — يعدّل الراتب ويسجّل حدثاً بالإضبارة.
  async changeSalary(id: string, dto: ChangeSalaryDto, performedBy?: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, deletedAt: null },
      include: { allowances: true },
    });
    if (!employee) {
      throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Employee not found', details: [{ id }] });
    }
    if (employee.jobGradeId) {
      await this.validateSalaryRange(employee.jobGradeId, Number(dto.basicSalary));
    }

    const from: any = {
      salary: { basicSalary: employee.basicSalary, currency: employee.salaryCurrency },
      allowances: employee.allowances.map(a => ({ type: a.type, amount: Number(a.amount) })),
    };
    const to: any = {
      salary: { basicSalary: dto.basicSalary, currency: dto.salaryCurrency ?? employee.salaryCurrency },
      allowances: dto.allowances?.map(a => ({ type: a.type, amount: a.amount })) ?? from.allowances,
    };

    const data: any = {
      basicSalary: dto.basicSalary,
      ...(dto.salaryCurrency ? { salaryCurrency: dto.salaryCurrency } : {}),
      ...(dto.allowances !== undefined ? {
        allowances: { deleteMany: {}, create: dto.allowances.map(({ type, amount }) => ({ type, amount })) },
      } : {}),
    };

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.employee.update({ where: { id }, data, include: { allowances: true } });
      await tx.employeeHistoryEvent.create({
        data: {
          employeeId: id,
          eventType: dto.eventType ?? 'SALARY_CHANGE',
          fromValue: from,
          toValue: to,
          note: dto.note ?? null,
          effectiveDate: new Date(dto.effectiveDate),
          performedBy: performedBy ?? null,
        },
      });
      return updated;
    });
  }

  // إضبارة الموظف: تايملاين موحّد (أحداث وظيفية + مكافآت/عقوبات + سلف) مرتّب زمنياً تنازلياً.
  async getDossier(id: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, employeeNumber: true, firstNameAr: true, lastNameAr: true, firstNameEn: true, lastNameEn: true },
    });
    if (!employee) {
      throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Employee not found', details: [{ id }] });
    }

    const [events, rewardsPenalties, advances] = await Promise.all([
      this.prisma.employeeHistoryEvent.findMany({ where: { employeeId: id }, orderBy: { effectiveDate: 'desc' } }),
      this.prisma.employeeRewardPenalty.findMany({ where: { employeeId: id }, orderBy: { effectiveDate: 'desc' } }),
      this.prisma.salaryAdvance.findMany({ where: { employeeId: id, deletedAt: null }, orderBy: { createdAt: 'desc' } }),
    ]);

    // طلبات الموظف (إجازات + طلبات عامة) — قراءة عبر السكيمات؛ فشل أيٍّ منها لا يكسر الإضبارة
    let leaveRequests: any[] = [];
    try {
      leaveRequests = await this.prisma.$queryRawUnsafe(
        `SELECT lr.id, lr.status::text AS status, lr."startDate", lr."endDate",
                lr."totalDays", lr.reason, lr."createdAt", lt."nameAr" AS "leaveTypeName"
         FROM leaves.leave_requests lr
         LEFT JOIN leaves.leave_types lt ON lt.id = lr."leaveTypeId"
         WHERE lr."employeeId" = $1 AND lr.status::text <> 'DRAFT'
         ORDER BY lr."createdAt" DESC`,
        id,
      );
    } catch { /* leaves schema unavailable — تجاهل */ }

    let generalRequests: any[] = [];
    try {
      generalRequests = await this.prisma.$queryRawUnsafe(
        `SELECT id, "requestNumber", type::text AS type, status::text AS status, reason, "createdAt"
         FROM requests.requests
         WHERE "employeeId" = $1 AND "deletedAt" IS NULL AND status::text <> 'DRAFT'
         ORDER BY "createdAt" DESC`,
        id,
      );
    } catch { /* requests schema unavailable — تجاهل */ }

    const timeline: any[] = [
      ...events.map((e) => ({
        category: 'HISTORY',
        type: e.eventType,
        date: e.effectiveDate,
        fromValue: e.fromValue,
        toValue: e.toValue,
        note: e.note,
        performedBy: e.performedBy,
        id: e.id,
        createdAt: e.createdAt,
      })),
      ...rewardsPenalties.map((r) => ({
        category: r.kind === 'REWARD' ? 'REWARD' : 'PENALTY',
        type: r.kind,
        date: r.effectiveDate,
        amount: r.amount,
        penaltyDays: r.penaltyDays,
        reason: r.reason,
        note: r.recommendation,
        status: r.status,
        performedBy: r.issuedBy,
        id: r.id,
        createdAt: r.createdAt,
      })),
      ...advances.map((a) => ({
        category: 'SALARY_ADVANCE',
        type: 'SALARY_ADVANCE',
        date: a.createdAt,
        amount: a.totalAmount,
        remainingBalance: a.remainingBalance,
        status: a.status,
        reason: a.reason,
        note: a.notes,
        id: a.id,
        createdAt: a.createdAt,
      })),
      ...leaveRequests.map((r) => ({
        category: 'LEAVE_REQUEST',
        type: 'LEAVE_REQUEST',
        date: r.createdAt,
        status: r.status,
        leaveTypeName: r.leaveTypeName,
        startDate: r.startDate,
        endDate: r.endDate,
        totalDays: r.totalDays,
        reason: r.reason,
        id: r.id,
        createdAt: r.createdAt,
      })),
      ...generalRequests.map((r) => ({
        category: 'REQUEST',
        type: r.type,
        date: r.createdAt,
        status: r.status,
        requestNumber: r.requestNumber,
        reason: r.reason,
        id: r.id,
        createdAt: r.createdAt,
      })),
    ].sort((x, y) => new Date(y.date as any).getTime() - new Date(x.date as any).getTime());

    return { employee, timeline };
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

    const inactiveStatuses = ['INACTIVE', 'TERMINATED', 'SUSPENDED'];
    const separationDateUpdate = dto.employmentStatus
      ? inactiveStatuses.includes(dto.employmentStatus)
        ? new Date()
        : dto.employmentStatus === 'ACTIVE' ? null : undefined
      : undefined;

    const updated = await this.prisma.employee.update({
      where: { id },
      data: {
        ...employeeData,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        hireDate: dto.hireDate ? new Date(dto.hireDate) : undefined,
        contractEndDate: contractEndDateUpdate,
        separationDate: separationDateUpdate,
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

    // إشعار HR إذا صار المدير المباشر غير نشط وعنده موظفين مرتبطين فيه
    if (dto.employmentStatus && inactiveStatuses.includes(dto.employmentStatus)) {
      setImmediate(() => {
        this.notifyHrIfManagerInactive(id, `${updated.firstNameAr} ${updated.lastNameAr}`).catch(() => {});
      });
    }

    return updated;
  }

  private async notifyHrIfManagerInactive(managerId: string, managerName: string) {
    const subordinates = await this.prisma.employee.findMany({
      where: { managerId, deletedAt: null, employmentStatus: 'ACTIVE' },
      select: { firstNameAr: true, lastNameAr: true },
    });
    if (subordinates.length === 0) return;

    const hrUsers = await this.prisma.$queryRaw<Array<{ userId: string }>>`
      SELECT DISTINCT u.id as "userId"
      FROM users.users u
      INNER JOIN users.user_roles ur ON u.id = ur."userId"
      INNER JOIN users.roles r ON ur."roleId" = r.id
      WHERE r.name IN ('HR', 'HR_Specialist', 'super_admin')
        AND u."deletedAt" IS NULL
    `;
    if (hrUsers.length === 0) return;

    const MAIL_URL = process.env.MAIL_SERVICE_URL || 'http://localhost:4009';
    const TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';
    const subordinateNames = subordinates.map(s => `${s.firstNameAr} ${s.lastNameAr}`).join('، ');

    for (const hr of hrUsers) {
      await fetch(`${MAIL_URL}/api/v1/mail/internal/system-send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-token': TOKEN },
        body: JSON.stringify({
          recipientUserId: hr.userId,
          subject: `تنبيه: مدير مباشر غير نشط — ${managerName}`,
          body: `تم تغيير حالة الموظف "${managerName}" إلى غير نشط.\n\nالموظفون المرتبطون به كمدير مباشر (${subordinates.length}):\n${subordinateNames}\n\nيرجى تحديث المدير المباشر لهؤلاء الموظفين.`,
        }),
      }).catch(() => {});
    }
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

  async getSignature(id: string) {
    const emp = await this.prisma.employee.findFirst({
      where: { id, deletedAt: null },
      select: { signatureUrl: true },
    });
    if (!emp) throw new NotFoundException('Employee not found');
    return { hasSignature: !!emp.signatureUrl, signatureUrl: emp.signatureUrl ?? null };
  }

  async updateSignature(id: string, signatureUrl: string) {
    const emp = await this.prisma.employee.findFirst({ where: { id, deletedAt: null } });
    if (!emp) throw new NotFoundException('Employee not found');
    await this.prisma.employee.update({ where: { id }, data: { signatureUrl } });
    return { signatureUrl };
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
        END AS "daysRemaining",
        EXISTS (
          SELECT 1 FROM evaluation."ProbationEvaluation" pe WHERE pe."employeeId" = e.id
        ) AS "hasEvaluation"
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

  async getRewardsPenalties(employeeId: string, query: { kind?: string; year?: number; page?: number; limit?: number }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = { employeeId };
    if (query.kind) where.kind = query.kind;
    if (query.year) {
      const start = new Date(`${query.year}-01-01T00:00:00.000Z`);
      const end = new Date(`${query.year + 1}-01-01T00:00:00.000Z`);
      where.effectiveDate = { gte: start, lt: end };
    }

    const [items, total] = await Promise.all([
      this.prisma.employeeRewardPenalty.findMany({
        where,
        orderBy: { effectiveDate: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.employeeRewardPenalty.count({ where }),
    ]);

    return { data: { items, total, page, limit } };
  }

  async exportAllEmployees() {
    const employees = await this.prisma.employee.findMany({
      where: { deletedAt: null },
      orderBy: [{ department: { nameAr: 'asc' } }, { employeeNumber: 'asc' }],
      include: {
        department: { select: { nameAr: true, nameEn: true } },
        jobTitle:   { select: { nameAr: true } },
        jobGrade:   { select: { nameAr: true } },
        manager:    { select: { firstNameAr: true, lastNameAr: true, employeeNumber: true } },
        user:       { select: { username: true } },
        allowances: true,
      },
    });

    const fmt = (d: Date | string | null | undefined) =>
      d ? new Date(d).toLocaleDateString('ar-SY') : '';

    const mainRows = employees.map(e => [
      e.employeeNumber,
      `${e.firstNameAr} ${e.lastNameAr}`,
      e.firstNameEn ? `${e.firstNameEn ?? ''} ${e.lastNameEn ?? ''}`.trim() : '',
      e.department?.nameAr ?? '',
      e.jobTitle?.nameAr ?? '',
      e.jobGrade?.nameAr ?? '',
      e.manager ? `${e.manager.firstNameAr} ${e.manager.lastNameAr}` : '',
      e.manager?.employeeNumber ?? '',
      fmt(e.hireDate),
      e.contractType ?? '',
      fmt(e.contractEndDate),
      e.employmentStatus ?? '',
      e.workType ?? '',
      e.probationPeriod ?? '',
      e.basicSalary !== null && e.basicSalary !== undefined ? Number(e.basicSalary) : '',
      e.salaryCurrency ?? '',
      e.gender ?? '',
      fmt(e.dateOfBirth),
      e.nationality ?? '',
      e.maritalStatus ?? '',
      e.nationalId ?? '',
      e.email ?? '',
      e.phone ?? '',
      e.mobile ?? '',
      e.company ?? '',
      e.probationResult ?? '',
      fmt(e.probationCompletedAt),
      (e as any).user?.username ?? '',
    ]);

    const allowanceRows: (string | number)[][] = [];
    for (const e of employees) {
      for (const a of e.allowances) {
        allowanceRows.push([
          e.employeeNumber,
          `${e.firstNameAr} ${e.lastNameAr}`,
          e.department?.nameAr ?? '',
          a.type,
          Number(a.amount),
        ]);
      }
    }

    return { mainRows, allowanceRows };
  }

  async buildExportFullData(id: string) {
    const employee = await this.findOne(id);

    const token = process.env.INTERNAL_SERVICE_TOKEN ?? '';
    const attendanceUrl = process.env.ATTENDANCE_SERVICE_URL || 'http://attendance:4004';
    const leaveUrl = process.env.LEAVE_SERVICE_URL || 'http://leave:4003';
    const evaluationUrl = process.env.EVALUATION_SERVICE_URL || 'http://evaluation:4005';

    const headers = { 'x-internal-token': token };

    const [attendanceSummary, leaveRequests, leaveBalances, evaluations, payrolls, alerts] = await Promise.allSettled([
      this.http.axiosRef.get(`${attendanceUrl}/api/v1/reports/employee-summary?employeeId=${id}`, { headers }).then(r => r.data).catch(() => []),
      this.http.axiosRef.get(`${leaveUrl}/api/v1/leave-requests?employeeId=${id}&limit=200`, { headers }).then(r => r.data?.data?.items ?? r.data ?? []).catch(() => []),
      this.http.axiosRef.get(`${leaveUrl}/api/v1/leave-balances?employeeId=${id}`, { headers }).then(r => r.data?.data ?? r.data ?? []).catch(() => []),
      this.http.axiosRef.get(`${evaluationUrl}/api/v1/probation-evaluations?employeeId=${id}`, { headers }).then(r => r.data?.data ?? r.data ?? []).catch(() => []),
      this.http.axiosRef.get(`${attendanceUrl}/api/v1/payroll?employeeId=${id}&limit=12`, { headers }).then(r => r.data?.data?.items ?? r.data ?? []).catch(() => []),
      this.http.axiosRef.get(`${attendanceUrl}/api/v1/attendance-alerts?employeeId=${id}&limit=200`, { headers }).then(r => r.data?.data?.items ?? r.data ?? []).catch(() => []),
    ]);

    return {
      employee,
      attendanceSummary: attendanceSummary.status === 'fulfilled' ? attendanceSummary.value : [],
      leaveRequests: leaveRequests.status === 'fulfilled' ? leaveRequests.value : [],
      leaveBalances: leaveBalances.status === 'fulfilled' ? leaveBalances.value : [],
      evaluations: evaluations.status === 'fulfilled' ? evaluations.value : [],
      payrolls: payrolls.status === 'fulfilled' ? payrolls.value : [],
      alerts: alerts.status === 'fulfilled' ? alerts.value : [],
    };
  }
}
