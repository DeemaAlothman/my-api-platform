import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_ACCESS_SECRET!,
    });
  }

  async validate(payload: any) {
    if (!payload.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }

    if (payload.jti) {
      const result = await pool.query(
        'SELECT id FROM users.revoked_tokens WHERE jti = $1 LIMIT 1',
        [payload.jti],
      );
      if (result.rows.length > 0) {
        throw new UnauthorizedException('Token has been revoked');
      }
    }

    return {
      userId: payload.sub,
      username: payload.username,
      permissions: payload.permissions || [],
    };
  }
}
