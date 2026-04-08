import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditLogsQuery {
  from?: string;
  to?: string;
  resource?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async getLogs(
    currentUserId: string,
    permissions: string[],
    query: AuditLogsQuery,
  ) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 200);
    const offset = (page - 1) * limit;

    const isSuperAdmin = permissions.includes('audit_logs:read_all') ||
      permissions.includes('*');

    // تحديد الـ userIds المسموح للمستخدم رؤيتها
    let allowedUserIds: string[] | null = null; // null = كل شيء (superadmin)

    if (!isSuperAdmin) {
      allowedUserIds = await this.getAccessibleUserIds(currentUserId);
    }

    // بناء الفلاتر
    const conditions: string[] = [];
    const params: (string | number)[] = [];
    let paramIdx = 1;

    if (allowedUserIds !== null) {
      if (allowedUserIds.length === 0) {
        return { data: [], total: 0, page, limit };
      }
      const placeholders = allowedUserIds.map(() => `$${paramIdx++}`).join(', ');
      conditions.push(`"userId" IN (${placeholders})`);
      params.push(...allowedUserIds);
    }

    if (query.from) {
      conditions.push(`"createdAt" >= $${paramIdx++}`);
      params.push(query.from);
    }
    if (query.to) {
      conditions.push(`"createdAt" <= $${paramIdx++}`);
      params.push(query.to);
    }
    if (query.resource) {
      conditions.push(`resource = $${paramIdx++}`);
      params.push(query.resource);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRows = (await this.prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::text AS total FROM public.audit_logs ${where}`,
      ...params,
    )) as Array<{ total: string }>;

    const rows = (await this.prisma.$queryRawUnsafe(
      `SELECT id, "userId", username, action, resource, "resourceId", method, path, ip, "createdAt"
       FROM public.audit_logs ${where}
       ORDER BY "createdAt" DESC
       LIMIT ${limit} OFFSET ${offset}`,
      ...params,
    )) as Array<{
      id: string;
      userId: string | null;
      username: string | null;
      action: string;
      resource: string | null;
      resourceId: string | null;
      method: string;
      path: string;
      ip: string | null;
      createdAt: Date;
    }>;

    return {
      data: rows,
      total: parseInt(countRows[0]?.total ?? '0'),
      page,
      limit,
    };
  }

  /**
   * يجيب كل الـ userIds اللي يقدر المستخدم الحالي يشوف سجلاتهم:
   * - نفسه
   * - كل موظفيه تحته في الشجرة بشكل recursive
   */
  private async getAccessibleUserIds(currentUserId: string): Promise<string[]> {
    const rows = (await this.prisma.$queryRawUnsafe(
      `WITH RECURSIVE subordinates AS (
         SELECT e.id AS "employeeId", e."userId"
         FROM users.employees e
         WHERE e."userId" = $1 AND e."deletedAt" IS NULL

         UNION ALL

         SELECT e.id AS "employeeId", e."userId"
         FROM users.employees e
         INNER JOIN subordinates s ON e."managerId" = s."employeeId"
         WHERE e."deletedAt" IS NULL
       )
       SELECT "userId" FROM subordinates WHERE "userId" IS NOT NULL`,
      currentUserId,
    )) as Array<{ userId: string }>;

    return rows.map((r) => r.userId);
  }
}
