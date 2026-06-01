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

    // جلب الأسماء العربية الكاملة للمستخدمين دفعة واحدة
    const userIds = [...new Set(rows.map((r) => r.userId).filter(Boolean))] as string[];
    const nameMap = await this.getFullNamesAr(userIds);

    return {
      data: rows.map((r) => ({
        ...r,
        fullNameAr: nameMap[r.userId ?? ''] ?? null,
        description: this.buildDescription(r, nameMap[r.userId ?? '']),
      })),
      total: parseInt((countRows as any)[0]?.total ?? '0'),
      page,
      limit,
    };
  }

  private async getFullNamesAr(userIds: string[]): Promise<Record<string, string>> {
    if (userIds.length === 0) return {};
    const rows = await this.prisma.$queryRawUnsafe(
      `SELECT "userId", "firstNameAr", "lastNameAr" FROM users.employees WHERE "userId" = ANY($1::text[]) AND "deletedAt" IS NULL`,
      userIds,
    ) as Array<{ userId: string; firstNameAr: string; lastNameAr: string }>;
    const map: Record<string, string> = {};
    for (const r of rows) {
      map[r.userId] = `${r.firstNameAr ?? ''} ${r.lastNameAr ?? ''}`.trim();
    }
    return map;
  }

  private buildDescription(
    row: { username?: string | null; method: string; resource?: string | null; path?: string | null; resourceId?: string | null },
    fullNameAr?: string,
  ): string {
    const name = fullNameAr || row.username || 'مستخدم';
    const prefix = `المستخدم ${name}`;
    const path = row.path ?? '';
    const method = (row.method ?? '').toUpperCase();

    // === حالات خاصة حسب الـ path ===
    if (path.includes('/auth/login'))          return `${prefix} قام بتسجيل الدخول إلى النظام`;
    if (path.includes('/auth/logout'))         return `${prefix} قام بتسجيل الخروج من النظام`;
    if (path.includes('/auth/refresh'))        return `${prefix} قام بتجديد جلسة الدخول`;

    if (path.includes('/mail/') && path.includes('/reply-all')) return `${prefix} قام بالرد على الكل في رسالة داخلية`;
    if (path.includes('/mail/') && path.includes('/reply'))     return `${prefix} قام بالرد على رسالة داخلية`;
    if (path.includes('/mail/') && path.includes('/forward'))   return `${prefix} قام بإعادة توجيه رسالة داخلية`;
    if (path.includes('/mail/') && path.includes('/edit'))      return `${prefix} قام بتعديل رسالة داخلية مرسلة`;
    if (path.includes('/mail/send'))                            return `${prefix} قام بإرسال رسالة داخلية جديدة`;
    if (path.includes('/mail/draft'))                           return `${prefix} قام بحفظ مسودة رسالة داخلية`;

    if (path.includes('/leave-requests/') && path.includes('/approve'))  return `${prefix} قام بالموافقة على طلب إجازة`;
    if (path.includes('/leave-requests/') && path.includes('/reject'))   return `${prefix} قام برفض طلب إجازة`;
    if (path.includes('/leave-requests/') && path.includes('/cancel'))   return `${prefix} قام بإلغاء طلب إجازة`;
    if (path.includes('/leave-balances/') && path.includes('/adjust'))   return `${prefix} قام بتعديل رصيد إجازة موظف`;
    if (path.includes('/leave-balances/') && path.includes('/carry'))    return `${prefix} قام بترحيل رصيد الإجازات`;

    if (path.includes('/attendance') && path.includes('/recompute'))  return `${prefix} قام بإعادة احتساب سجلات الحضور`;
    if (path.includes('/attendance') && path.includes('/check-in'))   return `${prefix} قام بتسجيل حضور موظف`;
    if (path.includes('/attendance') && path.includes('/check-out'))  return `${prefix} قام بتسجيل انصراف موظف`;

    if (path.includes('/requests/') && path.includes('/approve'))  return `${prefix} قام بالموافقة على طلب`;
    if (path.includes('/requests/') && path.includes('/reject'))   return `${prefix} قام برفض طلب`;

    if (path.includes('/evaluation') && path.includes('/submit'))   return `${prefix} قام بتقديم تقييم`;
    if (path.includes('/evaluation') && path.includes('/approve'))  return `${prefix} قام بالموافقة على تقييم`;

    if (path.includes('/employees/') && path.includes('/activate'))   return `${prefix} قام بتفعيل حساب موظف`;
    if (path.includes('/employees/') && path.includes('/deactivate')) return `${prefix} قام بإيقاف حساب موظف`;

    if (path.includes('/roles/') && path.includes('/assign'))  return `${prefix} قام بتعيين دور لمستخدم`;
    if (path.includes('/users/') && path.includes('/assign'))  return `${prefix} قام بتعيين صلاحيات لمستخدم`;

    // === وصف عام حسب الموارد والفعل ===
    const actionMap: Record<string, [string, string, string]> = {
      // [POST-create, PATCH/PUT-edit, DELETE]
      POST:   ['أضاف', 'أضاف', 'أضاف'],
      PUT:    ['عدّل', 'عدّل', 'عدّل'],
      PATCH:  ['عدّل', 'عدّل', 'عدّل'],
      DELETE: ['حذف',  'حذف',  'حذف'],
    };

    // [POST-target, PUT/PATCH-target, DELETE-target]
    const resourceMap: Record<string, [string, string, string]> = {
      'employees':           ['سجلاً جديداً في جدول الموظفين',    'بيانات موظف',           'سجل موظف'],
      'departments':         ['قسماً جديداً',                       'بيانات قسم',             'قسم'],
      'users':               ['مستخدماً جديداً في النظام',          'بيانات مستخدم',          'مستخدم'],
      'roles':               ['دوراً جديداً',                        'بيانات دور',             'دور'],
      'leave-requests':      ['طلب إجازة جديد',                    'طلب إجازة',              'طلب إجازة'],
      'leave-types':         ['نوع إجازة جديد',                     'نوع إجازة',              'نوع إجازة'],
      'leave-balances':      ['رصيد إجازة لموظف',                   'رصيد إجازة موظف',        'رصيد إجازة'],
      'holidays':            ['إجازة رسمية جديدة',                  'بيانات إجازة رسمية',     'إجازة رسمية'],
      'attendance-records':  ['سجل حضور يدوياً',                    'سجل حضور',               'سجل حضور'],
      'work-schedules':      ['جدول دوام جديد',                     'جدول دوام',              'جدول دوام'],
      'evaluation-forms':    ['نموذج تقييم جديد',                   'نموذج تقييم',            'نموذج تقييم'],
      'evaluation-criteria': ['معيار تقييم جديد',                   'معيار تقييم',            'معيار تقييم'],
      'evaluation-periods':  ['فترة تقييم جديدة',                   'فترة تقييم',             'فترة تقييم'],
      'job-grades':          ['درجة وظيفية جديدة',                  'درجة وظيفية',            'درجة وظيفية'],
      'job-titles':          ['مسمى وظيفي جديد',                    'مسمى وظيفي',             'مسمى وظيفي'],
      'job-applications':    ['طلب توظيف جديد',                     'طلب توظيف',              'طلب توظيف'],
      'requests':            ['طلباً جديداً',                        'طلب',                    'طلب'],
      'custodies':           ['عهدة جديدة',                         'بيانات عهدة',            'عهدة'],
      'documents':           ['وثيقة جديدة',                        'وثيقة',                  'وثيقة'],
      'mail':                ['رسالة داخلية جديدة',                  'رسالة داخلية',           'رسالة داخلية'],
    };

    const verbIdx = method === 'POST' ? 0 : method === 'DELETE' ? 2 : 1;
    const verb = actionMap[method]?.[verbIdx] ?? 'نفّذ عملية في';
    const entry = row.resource ? resourceMap[row.resource] : null;
    const target = entry ? entry[verbIdx] : (row.resource ?? 'النظام');

    return `${prefix} ${verb} ${target}`;
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
