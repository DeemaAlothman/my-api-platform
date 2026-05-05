import { Injectable, BadRequestException, NotFoundException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ListUsersQueryDto, UserStatus } from './dto/list-users.query.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  health() {
    return { service: 'users', status: 'ok' };
  }

  async list(query: ListUsersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: null,
    };

    // فلترة بالـ role عبر user_roles
    if (query.roleId) {
      const userIdsWithRole = (await this.prisma.$queryRawUnsafe<Array<{ userId: string }>>(
        `SELECT "userId" FROM users.user_roles WHERE "roleId" = $1`,
        query.roleId,
      )).map(r => r.userId);
      where.id = { in: userIdsWithRole };
    }

    if (query.status) {
      where.status = query.status as UserStatus;
    }

    if (query.search) {
      const s = query.search.trim();
      if (s.length > 0) {
        where.OR = [
          { username: { contains: s, mode: 'insensitive' } },
          { email: { contains: s, mode: 'insensitive' } },
          { fullName: { contains: s, mode: 'insensitive' } },
        ];
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          username: true,
          email: true,
          fullName: true,
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
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.user.count({ where }),
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
    const user = await this.prisma.user.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
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
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'User not found',
        details: [{ field: 'id', value: id }],
      });
    }

    return user;
  }

  async create(dto: CreateUserDto) {
    // تحقق من username موجود (نشط أو محذوف سابقاً)
    const existingUsername = await this.prisma.user.findFirst({
      where: { username: dto.username },
    });

    if (existingUsername) {
      if (existingUsername.deletedAt !== null) {
        throw new ConflictException({
          code: 'USER_PREVIOUSLY_DELETED',
          message: 'A user with this username was previously deleted. Please contact the admin to restore the account.',
          details: [{ field: 'username', value: dto.username }],
        });
      }
      throw new ConflictException({
        code: 'RESOURCE_ALREADY_EXISTS',
        message: 'Username already exists',
        details: [{ field: 'username', value: dto.username }],
      });
    }

    // تحقق من email موجود (نشط أو محذوف سابقاً)
    const existingEmail = await this.prisma.user.findFirst({
      where: { email: dto.email },
    });

    if (existingEmail) {
      if (existingEmail.deletedAt !== null) {
        throw new ConflictException({
          code: 'USER_PREVIOUSLY_DELETED',
          message: 'A user with this email was previously deleted. Please contact the admin to restore the account.',
          details: [{ field: 'email', value: dto.email }],
        });
      }
      throw new ConflictException({
        code: 'RESOURCE_ALREADY_EXISTS',
        message: 'Email already exists',
        details: [{ field: 'email', value: dto.email }],
      });
    }

    // hash password
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        email: dto.email,
        password: hashedPassword,
        fullName: dto.fullName,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
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
        createdAt: true,
        updatedAt: true,
      },
    });

    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    // تحقق من المستخدم موجود
    await this.findOne(id);

    // إذا بدّل email، تحقق مو محجوز
    if (dto.email) {
      const existing = await this.prisma.user.findFirst({
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

    const updateData: any = { ...dto };
    if (dto.password) {
      updateData.password = await bcrypt.hash(dto.password, 10);
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
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
        createdAt: true,
        updatedAt: true,
      },
    });

    return user;
  }

  async remove(id: string) {
    // تحقق من المستخدم موجود
    await this.findOne(id);

    // soft delete
    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async changePassword(id: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, password: true },
    });

    if (!user) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'User not found',
        details: [{ field: 'id', value: id }],
      });
    }

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Current password is incorrect',
      });
    }

    if (newPassword.length < 6) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'New password must be at least 6 characters',
      });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id },
      data: { password: hashed },
    });

    return { message: 'Password changed successfully' };
  }

  async assignRoles(id: string, dto: { roleIds: string[] }) {
    // تحقق من المستخدم موجود
    await this.findOne(id);

    // حذف كل الأدوار القديمة
    await this.prisma.userRole.deleteMany({
      where: { userId: id },
    });

    // إضافة الأدوار الجديدة
    if (dto.roleIds && dto.roleIds.length > 0) {
      await this.prisma.userRole.createMany({
        data: dto.roleIds.map((roleId) => ({
          userId: id,
          roleId,
        })),
      });
    }

    // إرجاع المستخدم مع الأدوار
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        status: true,
        roles: {
          include: {
            role: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'User not found',
        details: [{ field: 'id', value: id }],
      });
    }

    return {
      ...user,
      roles: user.roles.map((ur) => ur.role),
    };
  }
}
