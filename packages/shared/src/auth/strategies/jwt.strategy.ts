import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PRISMA_FOR_JWT } from '../tokens';

interface JwtPayload {
  sub: string;
  username: string;
  fullName?: string;
  permissions: string[];
  jti?: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(@Inject(PRISMA_FOR_JWT) private readonly prisma: any) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_ACCESS_SECRET!,
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }

    // يركبان على نفس رحلة الطلب بالتوازي — الفحص الثاني إضافي بس، ما بيزيد زمن استجابة محسوس
    const [isRevoked, permissions] = await Promise.all([
      this.isTokenRevoked(payload.jti),
      this.withDelegatedPermissions(payload.sub, payload.permissions || []),
    ]);

    if (isRevoked) {
      throw new UnauthorizedException({ code: 'AUTH_TOKEN_REVOKED', message: 'Token has been revoked', details: [] });
    }

    return {
      userId: payload.sub,
      username: payload.username,
      fullName: payload.fullName || null,
      permissions,
    };
  }

  private async isTokenRevoked(jti?: string): Promise<boolean> {
    if (!jti) return false;
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM auth.revoked_tokens WHERE jti = ${jti} LIMIT 1
    `;
    return rows.length > 0;
  }

  // تفويض مؤقت للصلاحيات أثناء الإجازة: البديل ياخد صلاحيات المفوِّض الفعّال حالياً
  // (status=ACTIVE وضمن from/to) فوق صلاحياته هو، مش بدالها. فشل هالفحص لأي سبب
  // (الجدول غير موجود بعد، خطأ عابر...) ما بيكسر تسجيل الدخول — بيرجع الصلاحيات الأساسية بس
  private async withDelegatedPermissions(userId: string, basePermissions: string[]): Promise<string[]> {
    try {
      const rows = await this.prisma.$queryRaw<Array<{ delegatorUserId: string | null }>>`
        SELECT du."userId" as "delegatorUserId"
        FROM users.delegations d
        JOIN users.employees de ON de.id = d."delegateId"
        JOIN users.employees du ON du.id = d."delegatorId"
        WHERE de."userId" = ${userId}
          AND d.status = 'ACTIVE'
          AND d."fromDate" <= NOW() AND d."toDate" >= NOW()
          AND de."deletedAt" IS NULL AND du."deletedAt" IS NULL
      `;
      const delegatorUserIds = [...new Set(rows.map(r => r.delegatorUserId).filter(Boolean))] as string[];
      if (delegatorUserIds.length === 0) return basePermissions;

      const permRows = await this.prisma.$queryRaw<Array<{ name: string }>>`
        SELECT DISTINCT p.name
        FROM users.users u
        JOIN users.user_roles ur ON ur."userId" = u.id
        JOIN users.role_permissions rp ON rp."roleId" = ur."roleId"
        JOIN users.permissions p ON p.id = rp."permissionId"
        WHERE u.id = ANY(${delegatorUserIds}::text[])
        UNION
        SELECT p.name FROM users.permissions p
        WHERE EXISTS (
          SELECT 1 FROM users.user_roles ur2
          JOIN users.roles r2 ON r2.id = ur2."roleId"
          WHERE ur2."userId" = ANY(${delegatorUserIds}::text[]) AND r2.name = 'super_admin'
        )
      `;
      return [...new Set([...basePermissions, ...permRows.map(r => r.name)])];
    } catch {
      return basePermissions;
    }
  }
}
