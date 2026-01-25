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

    // جيب الـ roles و permissions الحقيقية من users schema
    const userWithRoles = await this.prisma.$queryRaw<Array<{
      role_name: string;
      permissions: string[];
    }>>`
      SELECT
        r.name as role_name,
        ARRAY_AGG(DISTINCT p.code) as permissions
      FROM users.users u
      LEFT JOIN users.user_roles ur ON u.id = ur.user_id
      LEFT JOIN users.roles r ON ur.role_id = r.id
      LEFT JOIN users.role_permissions rp ON r.id = rp.role_id
      LEFT JOIN users.permissions p ON rp.permission_id = p.id
      WHERE u.id = ${user.id}::uuid
        AND ur.deleted_at IS NULL
        AND r.deleted_at IS NULL
      GROUP BY r.name
    `;

    const roles = userWithRoles.map(r => r.role_name).filter(Boolean);
    const permissions = [...new Set(userWithRoles.flatMap(r => r.permissions || []))].filter(Boolean);

    // إذا ما في roles أو permissions، نعطي صلاحيات افتراضية
    const finalRoles = roles.length > 0 ? roles : ['user'];
    const finalPermissions = permissions.length > 0 ? permissions : ['users:read'];

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
