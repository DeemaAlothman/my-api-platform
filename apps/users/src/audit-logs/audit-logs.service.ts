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

    const isSuperAdmin =
      permissions.includes('audit_logs:read_all') ||
      permissions.includes('*') ||
      permissions.includes('employees:delete'); // admins have this

    let allowedUserIds: string[] | null = null;

    if (!isSuperAdmin) {
      allowedUserIds = await this.getAccessibleUserIds(currentUserId);
    }

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
      conditions.push(`"createdAt" >= $${paramIdx++}::timestamptz`);
      params.push(query.from);
    }
    if (query.to) {
      conditions.push(`"createdAt" <= $${paramIdx++}::timestamptz`);
      params.push(query.to);
    }
    if (query.resource) {
      conditions.push(`resource = $${paramIdx++}`);
      params.push(query.resource);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*)::text AS total FROM public.audit_logs ${where}`;
    const dataSql = `
      SELECT id::text, "userId", username, action, resource, "resourceId", method, path, ip, "createdAt"
      FROM public.audit_logs ${where}
      ORDER BY "createdAt" DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const [countRows, rows] = await Promise.all([
      this.prisma.$queryRawUnsafe(countSql, ...params) as Promise<Array<{ total: string }>>,
      this.prisma.$queryRawUnsafe(dataSql, ...params) as Promise<Array<{
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
      }>>,
    ]);

    return {
      data: rows.map((r) => ({ ...r, description: this.buildDescription(r) })),
      total: parseInt((countRows as any)[0]?.total ?? '0'),
      page,
      limit,
    };
  }

  private buildDescription(row: { username?: string | null; method: string; resource?: string | null; path?: string | null }): string {
    const who = row.username ?? 'مستخدم';

    // حالات خاصة حسب الـ path
    if (row.path?.includes('/auth/login'))   return `${who} سجّل دخوله`;
    if (row.path?.includes('/auth/logout'))  return `${who} سجّل خروجه`;
    if (row.path?.includes('/auth/refresh')) return `${who} جدّد جلسته`;

    const actionMap: Record<string, string> = {
      POST:   'أضاف',
      PUT:    'عدّل',
      PATCH:  'عدّل',
      DELETE: 'حذف',
      GET:    'عرض',
    };

    const resourceMap: Record<string, string> = {
      'employees':              'بيانات موظف',
      'departments':            'قسم',
      'users':                  'مستخدم',
      'roles':                  'دور',
      'leave-requests':         'طلب إجازة',
      'leave-types':            'نوع إجازة',
      'leave-balances':         'رصيد إجازة',
      'holidays':               'إجازة رسمية',
      'attendance':             'سجل حضور',
      'attendance-records':     'سجل حضور',
      'work-schedules':         'جدول عمل',
      'evaluation':             'تقييم',
      'evaluation-forms':       'نموذج تقييم',
      'evaluation-criteria':    'معيار تقييم',
      'evaluation-periods':     'فترة تقييم',
      'job-grades':             'درجة وظيفية',
      'job-titles':             'مسمى وظيفي',
      'job-applications':       'طلب توظيف',
      'requests':               'طلب',
      'custodies':              'عهدة',
      'documents':              'وثيقة',
      'auth':                   'تسجيل دخول',
      'audit-logs':             'سجل النظام',
    };

    const verb   = actionMap[row.method?.toUpperCase()] ?? 'نفّذ عملية في';
    const target = row.resource ? (resourceMap[row.resource] ?? row.resource) : 'النظام';

    return `${who} ${verb} ${target}`;
  }

  private async getAccessibleUserIds(currentUserId: string): Promise<string[]> {
    const sql = `
      WITH RECURSIVE subordinates AS (
        SELECT e.id AS "employeeId", e."userId", 1 AS depth
        FROM users.employees e
        WHERE e."userId" = $1 AND e."deletedAt" IS NULL

        UNION ALL

        SELECT e.id AS "employeeId", e."userId", s.depth + 1
        FROM users.employees e
        INNER JOIN subordinates s ON e."managerId" = s."employeeId"
        WHERE e."deletedAt" IS NULL AND s.depth < 10
      )
      SELECT DISTINCT "userId" FROM subordinates WHERE "userId" IS NOT NULL
    `;

    const rows = (await this.prisma.$queryRawUnsafe(sql, currentUserId)) as Array<{ userId: string }>;
    return rows.map((r) => r.userId);
  }
}
