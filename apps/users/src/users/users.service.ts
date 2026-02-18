import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
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

    // roleId موجود بالـ spec، لكن رح نفعّله لما نبني Roles
    if (query.roleId) {
      throw new BadRequestException({
        code: 'ROLES_NOT_IMPLEMENTED',
        message: 'roleId filter is not available yet. Roles endpoints will be implemented next.',
        details: [{ field: 'roleId' }],
      });
    }

    const where: any = {
      deletedAt: null,
    };

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
    // تحقق من username موجود
    const existingUsername = await this.prisma.user.findFirst({
      where: {
        username: dto.username,
        deletedAt: null,
      },
    });

    if (existingUsername) {
      throw new ConflictException({
        code: 'RESOURCE_ALREADY_EXISTS',
        message: 'Username already exists',
        details: [{ field: 'username', value: dto.username }],
      });
    }

    // تحقق من email موجود
    const existingEmail = await this.prisma.user.findFirst({
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

    const user = await this.prisma.user.update({
      where: { id },
      data: dto,
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
