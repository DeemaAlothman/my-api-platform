import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  private accessSecret = process.env.JWT_ACCESS_SECRET || 'dev_access_secret_change_me';
  private refreshSecret = process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret_change_me';

  private accessTtlSeconds = parseInt(process.env.ACCESS_TOKEN_TTL_SECONDS || '900', 10);
  private refreshTtlDays = parseInt(process.env.REFRESH_TOKEN_TTL_DAYS || '30', 10);

  async login(username: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { username } });

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

    // TODO: جيب الـ permissions الحقيقية من Users Service عبر HTTP call
    // مؤقتاً: جميع الصلاحيات لـ admin
    const permissions = user.username === 'admin'
      ? [
          // Users
          'users:read', 'users:create', 'users:update', 'users:delete', 'users:assign_roles',
          // Employees
          'employees:read', 'employees:create', 'employees:update', 'employees:delete',
          // Departments
          'departments:read', 'departments:create', 'departments:update', 'departments:delete',
          // Roles
          'roles:read', 'roles:create', 'roles:update',
          // Leave Types
          'leave_types:read', 'leave_types:create', 'leave_types:update', 'leave_types:delete',
          // Leave Requests
          'leave_requests:read', 'leave_requests:read_all', 'leave_requests:create', 'leave_requests:update',
          'leave_requests:submit', 'leave_requests:delete', 'leave_requests:approve_manager',
          'leave_requests:approve_hr', 'leave_requests:cancel',
          // Leave Balances
          'leave_balances:read', 'leave_balances:read_all', 'leave_balances:create', 'leave_balances:adjust',
          'leave_balances:initialize', 'leave_balances:delete', 'leave_balances:carry_over',
          // Holidays
          'holidays:read', 'holidays:create', 'holidays:update', 'holidays:delete',
          // Attendance - Work Schedules
          'attendance.work-schedules.read', 'attendance.work-schedules.create',
          'attendance.work-schedules.update', 'attendance.work-schedules.delete',
          // Attendance - Records
          'attendance.records.read', 'attendance.records.read-own', 'attendance.records.create',
          'attendance.records.update', 'attendance.records.delete', 'attendance.records.check-in',
          'attendance.records.check-out',
          // Attendance - Alerts
          'attendance.alerts.read', 'attendance.alerts.read-own', 'attendance.alerts.create',
          'attendance.alerts.update', 'attendance.alerts.delete', 'attendance.alerts.resolve',
        ]
      : ['users:read'];

    const accessToken = this.signAccessToken(user.id, user.username, permissions);
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
        roles: user.username === 'admin' ? ['super_admin'] : ['user'],
        permissions,
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
