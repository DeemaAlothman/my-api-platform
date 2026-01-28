import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) { }

  async list() {
    const roles = await this.prisma.role.findMany({
      where: { deletedAt: null },
      include: {
        _count: {
          select: {
            users: true,
            permissions: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return roles;
  }

  async findOne(id: string) {
    const role = await this.prisma.role.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
        _count: {
          select: {
            users: true,
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Role not found',
        details: [{ field: 'id', value: id }],
      });
    }

    // تنسيق البيانات
    const formattedRole = {
      ...role,
      permissions: role.permissions.map((rp) => rp.permission),
    };

    return formattedRole;
  }

  async create(dto: CreateRoleDto) {
    // تحقق من name موجود
    const existingName = await this.prisma.role.findFirst({
      where: {
        name: dto.name,
        deletedAt: null,
      },
    });

    if (existingName) {
      throw new ConflictException({
        code: 'RESOURCE_ALREADY_EXISTS',
        message: 'Role name already exists',
        details: [{ field: 'name', value: dto.name }],
      });
    }

    // إنشاء الدور مع الصلاحيات
    const role = await this.prisma.role.create({
      data: {
        name: dto.name,
        displayNameAr: dto.displayNameAr,
        displayNameEn: dto.displayNameEn,
        description: dto.description,
        permissions: dto.permissionIds
          ? {
            create: dto.permissionIds.map((permissionId) => ({
              permission: {
                connect: { id: permissionId },
              },
            })),
          }
          : undefined,
      },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    // تنسيق البيانات
    const formattedRole = {
      ...role,
      permissions: role.permissions.map((rp) => rp.permission),
    };

    return formattedRole;
  }

  async updatePermissions(id: string, dto: UpdateRolePermissionsDto) {
    // تحقق من الدور موجود
    await this.findOne(id);

    // حذف كل الصلاحيات القديمة
    await this.prisma.rolePermission.deleteMany({
      where: { roleId: id },
    });

    // إضافة الصلاحيات الجديدة
    if (dto.permissionIds.length > 0) {
      await this.prisma.rolePermission.createMany({
        data: dto.permissionIds.map((permissionId) => ({
          roleId: id,
          permissionId,
        })),
      });
    }

    // إرجاع الدور المحدّث
    return this.findOne(id);
  }

  async listPermissions() {
    const permissions = await this.prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { name: 'asc' }],
    });

    return permissions;
  }


  async remove(id: string) {
    // التحقق من وجود الدور
    await this.findOne(id);

    // التحقق من عدم وجود مستخدمين مرتبطين بهذا الدور
    const usersCount = await this.prisma.userRole.count({
      where: { roleId: id },
    });

    if (usersCount > 0) {
      throw new ConflictException({
        code: 'ROLE_IN_USE',
        message: 'Cannot delete role assigned to users',
        details: [{ count: usersCount }],
      });
    }

    // حذف ناعم (Soft Delete)
    await this.prisma.role.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { message: 'Role deleted successfully' };
  }
}
