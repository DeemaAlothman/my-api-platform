import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) { }

  private accessSecret = process.env.JWT_ACCESS_SECRET || 'dev_access_secret_change_me';
  private refreshSecret = process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret_change_me';

  private accessTtlSeconds = parseInt(process.env.ACCESS_TOKEN_TTL_SECONDS || '900', 10);
  private refreshTtlDays = parseInt(process.env.REFRESH_TOKEN_TTL_DAYS || '30', 10);

  async login(username: string, password: string) {
    const rows = await this.prisma.$queryRaw<any[]>`
      SELECT id, username, email, "fullName", password
      FROM users.users
      WHERE username = ${username}
        AND "deletedAt" IS NULL
    `;
    const user = rows[0] ?? null;

    if (!user) {
      throw new UnauthorizedException({
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'Invalid username or password',
        details: [],
      });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
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
      console.error('Error loading roles from database:', error);
      // Keep default values
    }

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

    // TODO: جيب الـ permissions الحقيقية من الـ DB
    const permissions = ['users:read', 'users:create', 'users:update', 'users:delete'];

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

    // تحقق بسيط من صحة الـ access token
    try {
      jwt.verify(token, this.accessSecret);
    } catch {
      throw new UnauthorizedException({
        code: 'AUTH_TOKEN_INVALID',
        message: 'Missing or invalid token',
        details: [],
      });
    }

    // بالمستقبل رح نعمل logout بناءً على refresh token أو session id.
    return { loggedOut: true };
  }

  private signAccessToken(userId: string, username: string, permissions?: string[]) {
    return jwt.sign(
      {
        sub: userId,
        username,
        permissions: permissions || []
      },
      this.accessSecret,
      { expiresIn: this.accessTtlSeconds },
    );
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
