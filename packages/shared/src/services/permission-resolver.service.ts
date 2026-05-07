import { Inject, Injectable, Logger, Optional } from '@nestjs/common';

/** Injection token — each service provides its PrismaService under this token */
export const PRISMA_FOR_PERMISSIONS = Symbol('PRISMA_FOR_PERMISSIONS');

/** Injection token — provide an ioredis/Redis client (optional) */
export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

const CACHE_TTL_SECONDS = 300; // 5 minutes

@Injectable()
export class PermissionResolver {
  private readonly logger = new Logger(PermissionResolver.name);

  constructor(
    @Inject(PRISMA_FOR_PERMISSIONS) private readonly prisma: any,
    @Optional() @Inject(REDIS_CLIENT) private readonly redis: any | null,
  ) {}

  async getUserPermissions(userId: string): Promise<string[]> {
    const cacheKey = `user:permissions:${userId}`;

    if (this.redis) {
      try {
        const cached = await this.redis.get(cacheKey);
        if (cached) return JSON.parse(cached) as string[];
      } catch (err) {
        this.logger.warn(`Redis get failed for ${cacheKey}: ${err.message}`);
      }
    }

    const permissions = await this.loadFromDb(userId);

    if (this.redis) {
      try {
        await this.redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(permissions));
      } catch (err) {
        this.logger.warn(`Redis setex failed for ${cacheKey}: ${err.message}`);
      }
    }

    return permissions;
  }

  async invalidateUser(userId: string): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.del(`user:permissions:${userId}`);
    } catch (err) {
      this.logger.warn(`Redis del failed for userId=${userId}: ${err.message}`);
    }
  }

  async invalidateRole(roleId: string): Promise<void> {
    if (!this.redis) return;
    try {
      const users = await this.prisma.$queryRaw<Array<{ userId: string }>>`
        SELECT "userId" FROM users.user_roles WHERE "roleId" = ${roleId}
      `;
      await Promise.all(users.map((u: { userId: string }) => this.invalidateUser(u.userId)));
    } catch (err) {
      this.logger.warn(`invalidateRole failed for roleId=${roleId}: ${err.message}`);
    }
  }

  private async loadFromDb(userId: string): Promise<string[]> {
    const result = await this.prisma.$queryRaw<Array<{ name: string }>>`
      SELECT DISTINCT p.name
      FROM users.users u
      JOIN users.user_roles ur ON ur."userId" = u.id
      JOIN users.role_permissions rp ON rp."roleId" = ur."roleId"
      JOIN users.permissions p ON p.id = rp."permissionId"
      JOIN users.roles r ON r.id = ur."roleId"
      WHERE u.id = ${userId}
        AND r."deletedAt" IS NULL
    `;
    return result.map((r: { name: string }) => r.name);
  }
}
