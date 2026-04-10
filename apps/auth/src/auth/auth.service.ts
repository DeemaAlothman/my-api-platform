import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly prisma: PrismaService) { }

  private accessSecret = process.env.JWT_ACCESS_SECRET!;
  private refreshSecret = process.env.JWT_REFRESH_SECRET!;

  private accessTtlSeconds = parseInt(process.env.ACCESS_TOKEN_TTL_SECONDS || '900', 10);
  private refreshTtlDays = parseInt(process.env.REFRESH_TOKEN_TTL_DAYS || '30', 10);

  async login(username: string, password: string) {
    this.logger.log(`Login attempt for user: ${username}`);

    const rows = await this.prisma.$queryRaw<any[]>`
      SELECT id, username, email, "fullName", password
      FROM users.users
      WHERE username = ${username}
        AND "deletedAt" IS NULL
    `;
    const user = rows[0] ?? null;

    if (!user) {
      this.logger.warn(`Login failed - user not found: ${username}`);
      throw new UnauthorizedException({
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'Invalid username or password',
        details: [],
      });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      this.logger.warn(`Login failed - wrong password for user: ${username}`);
      throw new UnauthorizedException({
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'Invalid username or password',
        details: [],
      });
    }

    // Load roles and permissions from database with error handling
    let finalRoles: string[] = ['user'];
    let finalPermissions: string[] = ['users:read'];

    try {
      // Check user roles from users schema (search by username, not id)
      const userRoles = await this.prisma.$queryRaw<Array<{ name: string }>>`
        SELECT r.name
        FROM users.users u
        INNER JOIN users.user_roles ur ON u.id = ur."userId"
        INNER JOIN users.roles r ON ur."roleId" = r.id
        WHERE u.username = ${username}
          AND r."deletedAt" IS NULL
      `;

      // If user has super_admin role, give all permissions
      if (userRoles.some(r => r.name === 'super_admin')) {
        finalRoles = ['super_admin'];
        finalPermissions = [
          'users:read', 'users:create', 'users:update', 'users:delete', 'users:assign_roles',
          'employees:read', 'employees:create', 'employees:update', 'employees:delete',
          'departments:read', 'departments:create', 'departments:update', 'departments:delete',
          'roles:read', 'roles:create', 'roles:update', 'roles:delete',
          'leave_types:read', 'leave_types:create', 'leave_types:update', 'leave_types:delete',
          'leave_requests:read', 'leave_requests:read_all', 'leave_requests:create', 'leave_requests:update',
          'leave_requests:submit', 'leave_requests:delete', 'leave_requests:approve_manager',
          'leave_requests:approve_hr', 'leave_requests:cancel',
          'leave_balances:read', 'leave_balances:read_all', 'leave_balances:create', 'leave_balances:adjust',
          'leave_balances:initialize', 'leave_balances:delete', 'leave_balances:carry_over',
          'holidays:read', 'holidays:create', 'holidays:update', 'holidays:delete',
          'attendance.work-schedules.read', 'attendance.work-schedules.create',
          'attendance.work-schedules.update', 'attendance.work-schedules.delete',
          'attendance.employee-schedules.read', 'attendance.employee-schedules.create',
          'attendance.employee-schedules.update', 'attendance.employee-schedules.delete',
          'attendance.records.read', 'attendance.records.read-own', 'attendance.records.create',
          'attendance.records.update', 'attendance.records.delete', 'attendance.records.check-in',
          'attendance.records.check-out',
          'attendance.alerts.read', 'attendance.alerts.read-own', 'attendance.alerts.create',
          'attendance.alerts.update', 'attendance.alerts.delete', 'attendance.alerts.resolve',
          'attendance.justifications.read', 'attendance.justifications.read-own',
          'attendance.justifications.create-own', 'attendance.justifications.manager-review',
          'attendance.justifications.hr-review',
          'evaluation:periods:read', 'evaluation:periods:create', 'evaluation:periods:update',
          'evaluation:periods:delete', 'evaluation:periods:manage',
          'evaluation:criteria:read', 'evaluation:criteria:create', 'evaluation:criteria:update',
          'evaluation:criteria:delete',
          'evaluation:forms:view-own', 'evaluation:forms:view-all', 'evaluation:forms:self-evaluate',
          'evaluation:forms:manager-evaluate', 'evaluation:forms:hr-review', 'evaluation:forms:gm-approval',
          'evaluation:peer:submit', 'evaluation:goals:manage',
          'job-titles:read', 'job-titles:create', 'job-titles:update', 'job-titles:delete',
          'job-grades:read', 'job-grades:create', 'job-grades:update', 'job-grades:delete',
          'requests:read', 'requests:manager-approve', 'requests:manager-reject', 'requests:hr-approve', 'requests:hr-reject',
          'attendance.reports.read',
          'custodies:read', 'custodies:create', 'custodies:update', 'custodies:delete',
          'biometric.devices.read', 'biometric.devices.create', 'biometric.devices.update', 'biometric.devices.delete',
          'biometric.mappings.read', 'biometric.mappings.create', 'biometric.mappings.update', 'biometric.mappings.delete',
          'attendance.records.device',
          'attendance.config.read', 'attendance.config.create', 'attendance.config.update',
          'job-applications:read', 'job-applications:update', 'job-applications:ceo-approve',
          'attendance.policies.read', 'attendance.policies.create', 'attendance.policies.update', 'attendance.policies.delete',
          'attendance.payroll.generate', 'attendance.payroll.read', 'attendance.payroll.confirm', 'attendance.payroll.export',
        ];
      } else if (userRoles.length > 0) {
        // Load permissions from database for other roles
        finalRoles = userRoles.map(r => r.name);

        const userPermissions = await this.prisma.$queryRaw<Array<{ code: string }>>`
          SELECT DISTINCT p.name as code
          FROM users.users u
          INNER JOIN users.user_roles ur ON u.id = ur."userId"
          INNER JOIN users.role_permissions rp ON ur."roleId" = rp."roleId"
          INNER JOIN users.permissions p ON rp."permissionId" = p.id
          WHERE u.username = ${username}
        `;

        finalPermissions = userPermissions.map(p => p.code);
      }
    } catch (error) {
      this.logger.error(`Error loading roles for user ${username}: ${error.message}`);
    }

    this.logger.log(`Login successful for user: ${username} roles=[${finalRoles.join(',')}]`);
    const accessToken = this.signAccessToken(user.id, user.username, finalPermissions);
    const refreshToken = this.signRefreshToken(user.id);

    const expiresAt = new Date(Date.now() + this.refreshTtlDays * 24 * 60 * 60 * 1000);

    // نحفظ refresh token في DB
    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt,
        revoked: false,
      },
    });

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        roles: finalRoles,
        permissions: finalPermissions,
      },
      accessToken,
      refreshToken,
      expiresIn: this.accessTtlSeconds,
    };
  }

  async refresh(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException({
        code: 'AUTH_TOKEN_INVALID',
        message: 'Invalid refresh token',
        details: [],
      });
    }

    // 1) تحقق JWT signature
    let payload: any;
    try {
      payload = jwt.verify(refreshToken, this.refreshSecret);
    } catch {
      throw new UnauthorizedException({
        code: 'AUTH_TOKEN_INVALID',
        message: 'Invalid refresh token',
        details: [],
      });
    }

    // 2) تحقق من DB (موجود + غير revoked + غير منتهي)
    const record = await this.prisma.refreshToken.findUnique({ where: { token: refreshToken } });

    if (!record || record.revoked || record.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException({
        code: 'AUTH_TOKEN_INVALID',
        message: 'Invalid refresh token',
        details: [],
      });
    }

    // 3) rotate: revoke القديم + إصدار جديد
    await this.prisma.refreshToken.update({
      where: { token: refreshToken },
      data: { revoked: true },
    });

    const userId = payload.sub as string;

    // جلب الصلاحيات الحقيقية من DB (نفس منطق login)
    let permissions: string[] = [];
    try {
      const userRoles = await this.prisma.$queryRaw<Array<{ name: string }>>`
        SELECT r.name
        FROM users.users u
        INNER JOIN users.user_roles ur ON u.id = ur."userId"
        INNER JOIN users.roles r ON ur."roleId" = r.id
        WHERE u.id = ${userId}
          AND r."deletedAt" IS NULL
      `;

      if (userRoles.some(r => r.name === 'super_admin')) {
        permissions = this.getSuperAdminPermissions();
      } else if (userRoles.length > 0) {
        const userPermissions = await this.prisma.$queryRaw<Array<{ code: string }>>`
          SELECT DISTINCT p.name as code
          FROM users.users u
          INNER JOIN users.user_roles ur ON u.id = ur."userId"
          INNER JOIN users.role_permissions rp ON ur."roleId" = rp."roleId"
          INNER JOIN users.permissions p ON rp."permissionId" = p.id
          WHERE u.id = ${userId}
        `;
        permissions = userPermissions.map(p => p.code);
      }
    } catch (error) {
      this.logger.error(`Error loading permissions on refresh for userId=${userId}: ${error.message}`);
    }

    this.logger.log(`Token refreshed for userId: ${userId}`);
    const newAccessToken = this.signAccessToken(userId, payload.username, permissions);
    const newRefreshToken = this.signRefreshToken(userId);

    const expiresAt = new Date(Date.now() + this.refreshTtlDays * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        token: newRefreshToken,
        userId,
        expiresAt,
        revoked: false,
      },
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: this.accessTtlSeconds,
    };
  }

  async logout(accessToken: string) {
    const token = (accessToken || '').replace('Bearer ', '').trim();

    if (!token) {
      throw new UnauthorizedException({
        code: 'AUTH_TOKEN_INVALID',
        message: 'Missing or invalid token',
        details: [],
      });
    }

    let payload: any;
    try {
      payload = jwt.verify(token, this.accessSecret);
    } catch {
      throw new UnauthorizedException({
        code: 'AUTH_TOKEN_INVALID',
        message: 'Missing or invalid token',
        details: [],
      });
    }

    // 1) أضف الـ access token للـ blacklist عبر الـ jti
    if (payload.jti) {
      const expiresAt = new Date(payload.exp * 1000);
      await this.prisma.revokedToken.upsert({
        where: { jti: payload.jti },
        update: {},
        create: { jti: payload.jti, expiresAt },
      });
    }

    // 2) أبطل كل refresh tokens للمستخدم
    await this.prisma.refreshToken.updateMany({
      where: { userId: payload.sub, revoked: false },
      data: { revoked: true },
    });

    this.logger.log(`Logout: userId=${payload.sub} — tokens revoked`);
    return { loggedOut: true };
  }

  async isTokenRevoked(jti: string): Promise<boolean> {
    if (!jti) return false;
    const revoked = await this.prisma.revokedToken.findUnique({ where: { jti } });
    return !!revoked;
  }

  private signAccessToken(userId: string, username: string, permissions?: string[]) {
    const jti = crypto.randomUUID();
    return jwt.sign(
      {
        sub: userId,
        username,
        permissions: permissions || [],
        jti,
      },
      this.accessSecret,
      { expiresIn: this.accessTtlSeconds },
    );
  }

  private getSuperAdminPermissions(): string[] {
    return [
      'users:read', 'users:create', 'users:update', 'users:delete', 'users:assign_roles',
      'employees:read', 'employees:create', 'employees:update', 'employees:delete',
      'departments:read', 'departments:create', 'departments:update', 'departments:delete',
      'roles:read', 'roles:create', 'roles:update', 'roles:delete',
      'leave_types:read', 'leave_types:create', 'leave_types:update', 'leave_types:delete',
      'leave_requests:read', 'leave_requests:read_all', 'leave_requests:create', 'leave_requests:update',
      'leave_requests:submit', 'leave_requests:delete', 'leave_requests:approve_manager',
      'leave_requests:approve_hr', 'leave_requests:cancel',
      'leave_balances:read', 'leave_balances:read_all', 'leave_balances:create', 'leave_balances:adjust',
      'leave_balances:initialize', 'leave_balances:delete', 'leave_balances:carry_over',
      'holidays:read', 'holidays:create', 'holidays:update', 'holidays:delete',
      'attendance.work-schedules.read', 'attendance.work-schedules.create',
      'attendance.work-schedules.update', 'attendance.work-schedules.delete',
      'attendance.employee-schedules.read', 'attendance.employee-schedules.create',
      'attendance.employee-schedules.update', 'attendance.employee-schedules.delete',
      'attendance.records.read', 'attendance.records.read-own', 'attendance.records.create',
      'attendance.records.update', 'attendance.records.delete', 'attendance.records.check-in',
      'attendance.records.check-out',
      'attendance.alerts.read', 'attendance.alerts.read-own', 'attendance.alerts.create',
      'attendance.alerts.update', 'attendance.alerts.delete', 'attendance.alerts.resolve',
      'attendance.justifications.read', 'attendance.justifications.read-own',
      'attendance.justifications.create-own', 'attendance.justifications.manager-review',
      'attendance.justifications.hr-review',
      'evaluation:periods:read', 'evaluation:periods:create', 'evaluation:periods:update',
      'evaluation:periods:delete', 'evaluation:periods:manage',
      'evaluation:criteria:read', 'evaluation:criteria:create', 'evaluation:criteria:update',
      'evaluation:criteria:delete',
      'evaluation:forms:view-own', 'evaluation:forms:view-all', 'evaluation:forms:self-evaluate',
      'evaluation:forms:manager-evaluate', 'evaluation:forms:hr-review', 'evaluation:forms:gm-approval',
      'evaluation:peer:submit', 'evaluation:goals:manage',
      'job-titles:read', 'job-titles:create', 'job-titles:update', 'job-titles:delete',
      'job-grades:read', 'job-grades:create', 'job-grades:update', 'job-grades:delete',
      'requests:read', 'requests:manager-approve', 'requests:manager-reject', 'requests:hr-approve', 'requests:hr-reject',
      'attendance.reports.read',
      'custodies:read', 'custodies:create', 'custodies:update', 'custodies:delete',
      'biometric.devices.read', 'biometric.devices.create', 'biometric.devices.update', 'biometric.devices.delete',
      'biometric.mappings.read', 'biometric.mappings.create', 'biometric.mappings.update', 'biometric.mappings.delete',
      'attendance.records.device',
      'attendance.config.read', 'attendance.config.create', 'attendance.config.update',
      'job-applications:read', 'job-applications:update', 'job-applications:ceo-approve',
      'attendance.policies.read', 'attendance.policies.create', 'attendance.policies.update', 'attendance.policies.delete',
      'attendance.payroll.generate', 'attendance.payroll.read', 'attendance.payroll.confirm', 'attendance.payroll.export',
    ];
  }

  private signRefreshToken(userId: string) {
    // نضيف jti عشوائي حتى كل refresh token يكون فريد
    const jti = crypto.randomUUID();
    return jwt.sign(
      { sub: userId, jti },
      this.refreshSecret,
      { expiresIn: `${this.refreshTtlDays}d` },
    );
  }
}
