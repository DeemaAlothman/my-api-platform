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

    // إخفاء الاستدعاءات الداخلية بين الخدمات (مسارات /internal) — ضجيج تقني وليست عمليات بشر
    conditions.push(`(path IS NULL OR path NOT ILIKE '%/internal%')`);

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
      SELECT id::text, "userId", username, action, resource, "resourceId", method, path, ip, metadata, "createdAt"
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
        metadata: any;
        createdAt: Date;
      }>>,
    ]);

    // جلب الأسماء العربية الكاملة للمستخدمين دفعة واحدة
    const userIds = [...new Set(rows.map((r) => r.userId).filter(Boolean))] as string[];
    const nameMap = await this.getFullNamesAr(userIds);

    // حلّ أسماء أنواع الإجازات (leaveTypeId → الاسم العربي) لكل الصفحة دفعة واحدة
    const leaveTypeIds = [...new Set(
      rows.map((r) => (r.metadata && typeof r.metadata === 'object') ? r.metadata.leaveTypeId : null).filter(Boolean),
    )] as string[];
    const leaveTypeMap = await this.getLeaveTypeNames(leaveTypeIds).catch(() => ({} as Record<string, string>));

    return {
      data: rows.map((r) => ({
        ...r,
        fullNameAr: nameMap[r.userId ?? ''] ?? null,
        description: this.buildDescription(r, nameMap[r.userId ?? '']) + this.detailsSuffix(r.metadata, leaveTypeMap),
      })),
      total: parseInt((countRows as any)[0]?.total ?? '0'),
      page,
      limit,
    };
  }

  // أسماء أنواع الإجازات العربية (عبر السكيمات) — فشل الاستعلام لا يكسر العرض
  private async getLeaveTypeNames(ids: string[]): Promise<Record<string, string>> {
    if (!ids.length) return {};
    const rows = await this.prisma.$queryRawUnsafe(
      `SELECT id::text AS id, "nameAr" FROM leaves.leave_types WHERE id::text = ANY($1::text[])`,
      ids,
    ) as Array<{ id: string; nameAr: string }>;
    const map: Record<string, string> = {};
    for (const r of rows) map[r.id] = r.nameAr;
    return map;
  }

  // يضيف تفاصيل العملية (من metadata) لنهاية الوصف بصيغة عربية مقروءة
  private detailsSuffix(metadata: any, leaveTypeMap: Record<string, string> = {}): string {
    if (!metadata || typeof metadata !== 'object') return '';

    const FIELD_AR: Record<string, string> = {
      leaveTypeId: 'نوع الإجازة', type: 'نوع الطلب', startDate: 'من', endDate: 'إلى',
      startTime: 'من', endTime: 'إلى', date: 'التاريخ', reason: 'السبب', isHalfDay: 'نصف يوم',
      workLocation: 'الموقع', assetType: 'نوع الأصل', assetNumber: 'رقم الأصل', brandModel: 'الماركة والموديل',
      faultDescription: 'وصف العطل', priority: 'الأولوية', repairOption: 'نوع الإصلاح', situationDescription: 'توصيف الحالة',
      basicSalary: 'الراتب', salaryCurrency: 'العملة', notes: 'ملاحظات', amount: 'المبلغ', effectiveDate: 'تاريخ النفاذ',
      name: 'الاسم', title: 'العنوان',
    };
    const REQ_TYPE_AR: Record<string, string> = {
      RESIGNATION: 'استقالة', TRANSFER: 'نقل', REWARD: 'مكافأة', PENALTY_PROPOSAL: 'عقوبة',
      OVERTIME_EMPLOYEE: 'عمل إضافي (موظف)', OVERTIME_MANAGER: 'عمل إضافي (مدير)', BUSINESS_MISSION: 'مهمة عمل',
      DELEGATION: 'تفويض', HIRING_REQUEST: 'طلب توظيف', COMPLAINT: 'شكوى', WORK_ACCIDENT: 'حادث عمل',
      REMOTE_WORK: 'عمل عن بُعد', MAINTENANCE: 'صيانة', OTHER: 'أخرى',
    };
    const VAL_AR: Record<string, string> = {
      SHAHBA: 'شركة شهباء', CENTER: 'مركز', NEW_ALEPPO: 'شركة حلب الجديدة',
      URGENT: 'عاجل', MEDIUM: 'متوسط', NORMAL: 'عادي',
      INTERNAL: 'إصلاح داخلي', INTERNAL_PARTS: 'داخلي + قطع خارجية', EXTERNAL_WORKSHOP: 'ورشة خارجية',
    };

    const parts: string[] = [];
    for (const [k, v] of Object.entries(metadata)) {
      if (v === null || v === undefined || v === '' || typeof v === 'object') continue;
      let val: any = v;
      if (k === 'leaveTypeId') val = leaveTypeMap[String(v)] ?? v;
      else if (k === 'type') val = REQ_TYPE_AR[String(v)] ?? v;
      else if (typeof v === 'boolean') val = v ? 'نعم' : 'لا';
      else if (typeof v === 'string' && VAL_AR[v]) val = VAL_AR[v];
      parts.push(`${FIELD_AR[k] ?? k}: ${val}`);
      if (parts.length >= 8) break;
    }
    return parts.length ? ` — التفاصيل: ${parts.join('، ')}` : '';
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
    // الاسم: الاسم الكامل ← username العمود ← username من تفاصيل الطلب (لتسجيل الدخول) ← وإلا "النظام"
    const metaUsername = (row as any)?.metadata?.username;
    const name = fullNameAr || row.username || metaUsername || null;
    const prefix = name ? `المستخدم ${name}` : 'النظام';
    const path = row.path ?? '';
    const method = (row.method ?? '').toUpperCase();

    // === حالات خاصة حسب الـ path ===
    if (path.includes('/auth/login'))          return `${prefix} قام بتسجيل الدخول إلى النظام`;
    if (path.includes('/auth/logout'))         return `${prefix} قام بتسجيل الخروج من النظام`;
    if (path.includes('/auth/refresh'))        return `${prefix} قام بتجديد جلسة الدخول`;

    const rid = row.resourceId ? ` (${row.resourceId.substring(0, 8)}...)` : '';

    if (path.includes('/mail/') && path.includes('/reply-all')) return `${prefix} قام بالرد على الكل في رسالة داخلية${rid}`;
    if (path.includes('/mail/') && path.includes('/reply'))     return `${prefix} قام بالرد على رسالة داخلية${rid}`;
    if (path.includes('/mail/') && path.includes('/forward'))   return `${prefix} قام بإعادة توجيه رسالة داخلية${rid}`;
    if (path.includes('/mail/') && path.includes('/edit'))      return `${prefix} قام بتعديل رسالة داخلية مرسلة${rid}`;
    if (path.includes('/mail/attachments/'))                    return `${prefix} قام برفع مرفق في رسالة داخلية${rid}`;
    if (path.includes('/mail/send'))                            return `${prefix} قام بإرسال رسالة داخلية جديدة`;
    if (path.includes('/mail/draft'))                           return `${prefix} قام بحفظ مسودة رسالة داخلية`;
    if (path.includes('/mail/') && method === 'DELETE')         return `${prefix} قام بحذف رسالة داخلية${rid}`;

    if (path.includes('/leave-requests/') && path.includes('/approve'))  return `${prefix} قام بالموافقة على طلب إجازة${rid}`;
    if (path.includes('/leave-requests/') && path.includes('/reject'))   return `${prefix} قام برفض طلب إجازة${rid}`;
    if (path.includes('/leave-requests/') && path.includes('/cancel'))   return `${prefix} قام بإلغاء طلب إجازة${rid}`;
    if (path.includes('/leave-balances/') && path.includes('/adjust'))   return `${prefix} قام بتعديل رصيد إجازة موظف${rid}`;
    if (path.includes('/leave-balances/') && path.includes('/carry'))    return `${prefix} قام بترحيل رصيد الإجازات`;

    if (path.includes('/attendance') && path.includes('/recompute'))  return `${prefix} قام بإعادة احتساب سجلات الحضور`;
    if (path.includes('/attendance') && path.includes('/check-in'))   return `${prefix} قام بتسجيل حضور موظف${rid}`;
    if (path.includes('/attendance') && path.includes('/check-out'))  return `${prefix} قام بتسجيل انصراف موظف${rid}`;

    if (path.includes('/requests/') && path.includes('/submit'))   return `${prefix} قام بتقديم طلب${rid}`;
    if (path.includes('/requests/') && path.includes('/approve'))  return `${prefix} قام بالموافقة على طلب${rid}`;
    if (path.includes('/requests/') && path.includes('/reject'))   return `${prefix} قام برفض طلب${rid}`;
    if (path.includes('/requests/') && path.includes('/cancel'))   return `${prefix} قام بإلغاء طلب${rid}`;

    if (path.includes('/evaluation') && path.includes('/submit'))   return `${prefix} قام بتقديم تقييم${rid}`;
    if (path.includes('/evaluation') && path.includes('/approve'))  return `${prefix} قام بالموافقة على تقييم${rid}`;

    if (path.includes('/employees/') && path.includes('/activate'))      return `${prefix} قام بتفعيل حساب موظف${rid}`;
    if (path.includes('/employees/') && path.includes('/deactivate'))    return `${prefix} قام بإيقاف حساب موظف${rid}`;
    if (path.includes('/employees/') && path.includes('/link-user'))     return `${prefix} قام بربط مستخدم بموظف${rid}`;
    if (path.includes('/employees/') && path.includes('/manager-notes')) return `${prefix} قام بتحديث ملاحظات المدير على موظف${rid}`;

    if (path.includes('/roles/') && path.includes('/assign'))  return `${prefix} قام بتعيين دور لمستخدم${rid}`;
    if (path.includes('/users/') && path.includes('/assign'))  return `${prefix} قام بتعيين صلاحيات لمستخدم${rid}`;

    if (path.includes('/holidays') && method === 'POST')   return `${prefix} قام بإضافة إجازة رسمية جديدة`;
    if (path.includes('/holidays') && method === 'PATCH')  return `${prefix} قام بتعديل إجازة رسمية${rid}`;
    if (path.includes('/holidays') && method === 'DELETE') return `${prefix} قام بحذف إجازة رسمية${rid}`;

    if (path.includes('/departments') && method === 'POST')   return `${prefix} قام بإضافة قسم جديد`;
    if (path.includes('/departments') && method === 'PATCH')  return `${prefix} قام بتعديل بيانات قسم${rid}`;
    if (path.includes('/departments') && method === 'DELETE') return `${prefix} قام بحذف قسم${rid}`;

    if (path.includes('/users') && method === 'POST')   return `${prefix} قام بإنشاء مستخدم جديد`;
    if (path.includes('/users') && method === 'PATCH')  return `${prefix} قام بتعديل بيانات مستخدم${rid}`;
    if (path.includes('/users') && method === 'DELETE') return `${prefix} قام بحذف مستخدم${rid}`;

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
