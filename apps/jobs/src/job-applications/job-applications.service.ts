import { Injectable, HttpException, HttpStatus, Logger, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../infrastructure/mail.service';

const USERS_URL = process.env.USERS_SERVICE_URL || 'http://users:4002';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

/**
 * تدفّق طلب التوظيف. الانتقالات التي يملكها المدير التنفيذي ليست هنا: هي في
 * ceoApprove و ceoReject، محروستين بصلاحية مستقلة، فلا يستطيع موظف الموارد
 * البشرية تعيين HIRED بنفسه مهما أرسل.
 */
const HR_TRANSITIONS: Record<string, string[]> = {
  PENDING:              ['INTERVIEW_READY', 'REJECTED'],
  INTERVIEW_READY:      ['INTERVIEWED', 'REJECTED'],
  INTERVIEWED:          ['PENDING_CEO_APPROVAL', 'REJECTED'],
  PENDING_CEO_APPROVAL: [],                              // بانتظار المدير التنفيذي وحده
  RETURNED_TO_HR:       ['PENDING_CEO_APPROVAL', 'REJECTED'],
  HIRED:                [],                              // نهائية
  REJECTED:             [],                              // نهائية
  ACCEPTED:             ['PENDING_CEO_APPROVAL', 'REJECTED'], // سجلات قديمة قبل التدفّق الجديد
};

const STATUS_AR: Record<string, string> = {
  PENDING:              'معلّق',
  INTERVIEW_READY:      'مؤهل للمقابلة',
  INTERVIEWED:          'تمت المقابلة',
  PENDING_CEO_APPROVAL: 'بانتظار المدير التنفيذي',
  RETURNED_TO_HR:       'مُعاد للموارد البشرية',
  HIRED:                'تم التوظيف',
  REJECTED:             'مرفوض',
  ACCEPTED:             'مقبول',
};

@Injectable()
export class JobApplicationsService {
  private readonly logger = new Logger(JobApplicationsService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(
    private readonly http: HttpService,
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {
    this.baseUrl = process.env.VITASYR_API_URL || 'https://vitaxirpro.com/api/external';
    this.apiKey = process.env.VITASYR_API_KEY || '';

    if (!this.apiKey) {
      this.logger.warn('VITASYR_API_KEY is not set! External API calls will fail.');
    }
  }

  private getHeaders() {
    return {
      'x-api-key': this.apiKey,
      'Content-Type': 'application/json',
    };
  }

  /**
   * جلب جميع طلبات التوظيف مع فلترة
   */
  async findAll(query: { status?: string; page?: string; limit?: string; isTalent?: string }) {
    if (query.isTalent === 'true') return this.findTalents(query);
    try {
      const params: any = {};
      if (query.status) params.status = query.status;
      if (query.page) params.page = query.page;
      if (query.limit) params.limit = query.limit;

      const response = await firstValueFrom(
        this.http.get(`${this.baseUrl}/job-applications`, {
          headers: this.getHeaders(),
          params,
        }),
      );

      const result = response.data;
      const items: any[] = Array.isArray(result?.data) ? result.data : [];
      const talentIds = await this.getTalentIds(items.map((a) => a?.id).filter(Boolean));
      for (const a of items) a.isTalent = talentIds.has(a.id);
      return result;
    } catch (error) {
      this.handleError(error, 'فشل في جلب طلبات التوظيف');
    }
  }

  // ── قائمة المواهب (علامة محلية بجدول talent_flags) ─────────────────────

  private async getTalentIds(ids: string[]): Promise<Set<string>> {
    if (!ids.length) return new Set();
    // فشل قراءة العلامة لا يوقف عرض الطلبات
    const rows = await this.prisma.talentFlag.findMany({
      where: { jobApplicationId: { in: ids } },
      select: { jobApplicationId: true },
    }).catch(() => [] as { jobApplicationId: string }[]);
    return new Set(rows.map((r) => r.jobApplicationId));
  }

  /** فلتر isTalent=true — يجلب كل طلب من الموقع ويرجّع نفس شكل القائمة { data, pagination } */
  private async findTalents(query: { status?: string; page?: string; limit?: string }) {
    const page  = Math.max(1, Number(query.page)  || 1);
    const limit = Math.max(1, Number(query.limit) || 20);

    const flags = await this.prisma.talentFlag.findMany({ orderBy: { markedAt: 'desc' } });
    const fetched = await Promise.all(
      flags.map((f) =>
        firstValueFrom(
          this.http.get(`${this.baseUrl}/job-applications/${f.jobApplicationId}`, { headers: this.getHeaders() }),
        ).then((r) => this.unwrapApplication(r.data)).catch((e) => {
          // طلب محذوف من الموقع أو خطأ مؤقت → يُتجاهل مع تسجيله
          this.logger.warn(`Talent fetch failed for ${f.jobApplicationId}: ${e?.response?.status ?? e?.message}`);
          return null;
        }),
      ),
    );

    let items = fetched.filter(Boolean);
    if (query.status) items = items.filter((a: any) => a.status === query.status);
    for (const a of items) a.isTalent = true;

    const total = items.length;
    return {
      data: items.slice((page - 1) * limit, page * limit),
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /** الموقع يرجّع الطلب الواحد مباشرة { id, ... } — ونقبل أيضاً الشكل الملفوف { data: { id, ... } } */
  private unwrapApplication(body: any): any | null {
    if (body?.data?.id) return body.data;
    if (body?.id) return body;
    return null;
  }

  async setTalent(id: string, isTalent: boolean, userId?: string) {
    if (isTalent) {
      await this.prisma.talentFlag.upsert({
        where: { jobApplicationId: id },
        create: { jobApplicationId: id, markedBy: userId ?? null },
        update: {},
      });
    } else {
      await this.prisma.talentFlag.deleteMany({ where: { jobApplicationId: id } });
    }
    return { id, isTalent };
  }

  /**
   * إحصائيات الطلبات
   */
  async getStats() {
    try {
      const response = await firstValueFrom(
        this.http.get(`${this.baseUrl}/job-applications/stats`, {
          headers: this.getHeaders(),
        }),
      );

      return response.data;
    } catch (error) {
      this.handleError(error, 'فشل في جلب الإحصائيات');
    }
  }

  /**
   * جلب طلب واحد بالـ ID مع تقييم المقابلة المحلي
   */
  async findOne(id: string) {
    try {
      const response = await firstValueFrom(
        this.http.get(`${this.baseUrl}/job-applications/${id}`, {
          headers: this.getHeaders(),
        }),
      );

      const data = response.data;

      // ربط تقييم المقابلة المحلي إذا وُجد
      const interviewEvaluation = await (this.prisma as any).interviewEvaluation.findUnique({
        where: { jobApplicationId: id },
        select: {
          id: true,
          totalScore: true,
          personalScore: true,
          technicalScore: true,
          computerScore: true,
          decision: true,
          proposedSalary: true,
          evaluatedAt: true,
          isTransferred: true,
        },
      }).catch(() => null);

      const app = this.unwrapApplication(data);
      if (app) {
        app.interviewEvaluation = interviewEvaluation;
        app.isTalent = (await this.getTalentIds([id])).has(id);
      }

      return data;
    } catch (error) {
      this.handleError(error, 'فشل في جلب الطلب');
    }
  }

  // ── التدفّق ────────────────────────────────────────────────────────────────

  // الحالة الحالية تُقرأ من النظام الخارجي قبل كل انتقال: الطلبات ليست مخزَّنة
  // عندنا، فلا سبيل للتحقق من صحّة الانتقال غير سؤاله.
  private async fetchCurrentStatus(id: string): Promise<{ app: any; status: string }> {
    const response = await firstValueFrom(
      this.http.get(`${this.baseUrl}/job-applications/${id}`, { headers: this.getHeaders() }),
    );
    const app = this.unwrapApplication(response.data) ?? response.data?.data ?? response.data;
    return { app, status: app?.status ?? 'PENDING' };
  }

  private assertTransition(from: string, to: string, allowed: string[]) {
    if (from === to) return; // إعادة إرسال نفس الحالة لا تُعدّ انتقالاً
    if (!allowed.includes(to)) {
      throw new BadRequestException({
        code: 'INVALID_APPLICATION_TRANSITION',
        message: `لا يمكن الانتقال من «${STATUS_AR[from] ?? from}» إلى «${STATUS_AR[to] ?? to}»`,
        details: [{ from, to, allowed }],
      });
    }
  }

  // إشعار داخلي — فشله لا يُفشل العملية، فالحالة تغيّرت فعلاً عند الطرف الخارجي
  private notify(userIds: string[], titleAr: string, messageAr: string, data: any) {
    for (const userId of userIds) {
      this.http.post(
        `${USERS_URL}/api/v1/notifications/internal`,
        { userId, type: 'GENERAL', titleAr, titleEn: titleAr, messageAr, messageEn: messageAr, data },
        { headers: { 'x-internal-token': INTERNAL_TOKEN } },
      ).subscribe({ error: () => { /* تجاهل */ } });
    }
  }

  // المدير التنفيذي = من يملك صلاحية الموافقة، لا دوراً باسم محدّد: الأدوار
  // تتغيّر أسماؤها بينما الصلاحية هي ما يحكم فعلياً.
  private async ceoUserIds(): Promise<string[]> {
    try {
      const rows = await (this.prisma as any).$queryRawUnsafe(
        `SELECT DISTINCT ur."userId"
         FROM users.user_roles ur
         JOIN users.role_permissions rp ON rp."roleId" = ur."roleId"
         JOIN users.permissions p ON p.id = rp."permissionId"
         JOIN users.users u ON u.id = ur."userId"
         WHERE p.name = 'job-applications:ceo-approve' AND u."deletedAt" IS NULL`,
      );
      return (rows as any[]).map(r => r.userId);
    } catch (err) {
      this.logger.error(`ceoUserIds failed: ${(err as any)?.message}`);
      return [];
    }
  }

  private async hrUserIds(): Promise<string[]> {
    try {
      const rows = await (this.prisma as any).$queryRawUnsafe(
        `SELECT DISTINCT u.id AS "userId"
         FROM users.users u
         JOIN users.user_roles ur ON ur."userId" = u.id
         JOIN users.roles r ON r.id = ur."roleId"
         WHERE r.name IN ('HR', 'HR_Specialist')
           AND r."deletedAt" IS NULL AND u."deletedAt" IS NULL`,
      );
      return (rows as any[]).map(r => r.userId);
    } catch (err) {
      this.logger.error(`hrUserIds failed: ${(err as any)?.message}`);
      return [];
    }
  }

  private async sendRejectionMail(app: any) {
    if (!app?.email) return;
    const nameParts = (app.fullName || '').split(' ');
    await this.mail.sendRejectionEmail(
      {
        firstNameAr: nameParts[0] || app.fullName,
        lastNameAr: nameParts.slice(1).join(' ') || '',
        email: app.email,
      },
      app.specialization || 'الوظيفة',
    ).catch((err: any) => this.logger.error(`rejection email failed: ${err?.message}`));
  }

  /**
   * خطوات الموارد البشرية. HIRED و RETURNED_TO_HR ليستا منها — لهما مساراهما
   * المحروسان بصلاحية المدير التنفيذي.
   */
  async update(id: string, data: any, user?: any) {
    if (data.status === 'HIRED') {
      throw new BadRequestException({
        code: 'HIRED_REQUIRES_CEO_APPROVAL',
        message: 'لا يمكن تغيير الحالة إلى «تم التوظيف» مباشرة — تتم عبر موافقة المدير التنفيذي',
        details: [],
      });
    }
    if (data.status === 'RETURNED_TO_HR') {
      throw new BadRequestException({
        code: 'RETURN_IS_CEO_ACTION',
        message: 'إعادة الطلب إلى الموارد البشرية إجراء المدير التنفيذي وحده',
        details: [],
      });
    }

    const { status: from } = await this.fetchCurrentStatus(id);
    this.assertTransition(from, data.status, HR_TRANSITIONS[from] ?? []);

    try {
      const response = await firstValueFrom(
        this.http.put(`${this.baseUrl}/job-applications/${id}`, data, {
          headers: this.getHeaders(),
        }),
      );
      const app = response.data?.data ?? response.data;

      if (data.status === 'REJECTED') {
        await this.sendRejectionMail(app);
      }

      if (data.status === 'PENDING_CEO_APPROVAL') {
        const ceos = await this.ceoUserIds();
        const name = app?.fullName ?? 'متقدّم';
        this.notify(
          ceos,
          'طلب توظيف بانتظار موافقتك',
          `الطلب المقدَّم من ${name} بانتظار قرارك` +
            (data.offeredJobTitle ? ` — المسمّى: ${data.offeredJobTitle}` : '') +
            (data.offeredSalary ? `، الراتب: ${data.offeredSalary}` : ''),
          { jobApplicationId: id, status: 'PENDING_CEO_APPROVAL' },
        );
      }

      return response.data;
    } catch (error) {
      this.handleError(error, 'فشل في تحديث الطلب');
    }
  }

  /**
   * موافقة المدير التنفيذي — ينقل الحالة إلى HIRED ويُشعر الموارد البشرية
   */
  async ceoApprove(id: string, user?: any) {
    const { status: from } = await this.fetchCurrentStatus(id);
    if (!['PENDING_CEO_APPROVAL', 'ACCEPTED'].includes(from)) {
      throw new BadRequestException({
        code: 'NOT_AWAITING_CEO',
        message: `الطلب ليس بانتظار المدير التنفيذي — حالته الآن «${STATUS_AR[from] ?? from}»`,
        details: [{ from }],
      });
    }

    try {
      const response = await firstValueFrom(
        this.http.put(`${this.baseUrl}/job-applications/${id}`, { status: 'HIRED' }, {
          headers: this.getHeaders(),
        }),
      );
      const app = response.data?.data ?? response.data;

      this.notify(
        await this.hrUserIds(),
        'تمت الموافقة على التوظيف',
        `وافق المدير التنفيذي على توظيف ${app?.fullName ?? 'المتقدّم'}`,
        { jobApplicationId: id, status: 'HIRED' },
      );

      return response.data;
    } catch (error) {
      this.handleError(error, 'فشل في تنفيذ موافقة المدير التنفيذي');
    }
  }

  /**
   * رفض المدير التنفيذي — **لا يرفض المتقدّم**، بل يعيد الطلب إلى الموارد
   * البشرية لتقرّر: رفضٌ نهائي، أو تعديل الشروط وإعادة الإرسال.
   */
  async ceoReject(id: string, dto: { ceoNote: string }, user?: any) {
    const { status: from } = await this.fetchCurrentStatus(id);
    if (!['PENDING_CEO_APPROVAL', 'ACCEPTED'].includes(from)) {
      throw new BadRequestException({
        code: 'NOT_AWAITING_CEO',
        message: `الطلب ليس بانتظار المدير التنفيذي — حالته الآن «${STATUS_AR[from] ?? from}»`,
        details: [{ from }],
      });
    }

    try {
      const response = await firstValueFrom(
        this.http.put(
          `${this.baseUrl}/job-applications/${id}`,
          { status: 'RETURNED_TO_HR', ceoNote: dto.ceoNote },
          { headers: this.getHeaders() },
        ),
      );
      const app = response.data?.data ?? response.data;

      this.notify(
        await this.hrUserIds(),
        'أعاد المدير التنفيذي طلب توظيف',
        `أعاد المدير التنفيذي طلب ${app?.fullName ?? 'المتقدّم'} — ${dto.ceoNote}`,
        { jobApplicationId: id, status: 'RETURNED_TO_HR' },
      );

      return response.data;
    } catch (error) {
      this.handleError(error, 'فشل في إعادة الطلب إلى الموارد البشرية');
    }
  }

  /**
   * معالجة الأخطاء من VitaSyr API
   */
  private handleError(error: any, defaultMessage: string): never {
    const status = error?.response?.status || HttpStatus.BAD_GATEWAY;
    const message = error?.response?.data?.message || defaultMessage;

    this.logger.error(`VitaSyr API Error: ${status} - ${message}`, error?.stack);

    throw new HttpException(
      {
        code: 'EXTERNAL_API_ERROR',
        message,
        details: [{ source: 'VitaSyr', originalStatus: status }],
      },
      status >= 400 && status < 500 ? status : HttpStatus.BAD_GATEWAY,
    );
  }
}
