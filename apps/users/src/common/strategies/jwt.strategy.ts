import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';

export interface JwtPayload {
  sub: string;
  username: string;
  permissions: string[];
  jti?: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
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

    if (payload.jti) {
      const rows = await this.prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM auth.revoked_tokens WHERE jti = ${payload.jti} LIMIT 1
      `;
      if (rows.length > 0) {
        throw new UnauthorizedException({ code: 'AUTH_TOKEN_REVOKED', message: 'Token has been revoked', details: [] });
      }
    }

    return {
      userId: payload.sub,
      username: payload.username,
      permissions: payload.permissions || [],
    };
  }
}
