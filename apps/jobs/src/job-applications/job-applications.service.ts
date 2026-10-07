import { Injectable, HttpException, HttpStatus, Logger, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../infrastructure/mail.service';

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
        ).then((r) => r.data?.data ?? null).catch(() => null), // طلب محذوف من الموقع → يُتجاهل
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

      if (data?.data) {
        data.data.interviewEvaluation = interviewEvaluation;
        data.data.isTalent = (await this.getTalentIds([id])).has(id);
      }

      return data;
    } catch (error) {
      this.handleError(error, 'فشل في جلب الطلب');
    }
  }

  /**
   * تحديث حالة طلب
   */
  async update(id: string, data: { status: string; reviewNotes?: string; rejectionNote?: string; rating?: number }) {
    if (data.status === 'HIRED') {
      throw new BadRequestException({
        code: 'HIRED_REQUIRES_CEO_APPROVAL',
        message: 'لا يمكن تغيير الحالة إلى "تم التوظيف" مباشرة — يجب المرور بموافقة المدير التنفيذي عبر /ceo-approve',
        details: [],
      });
    }

    try {
      const response = await firstValueFrom(
        this.http.put(`${this.baseUrl}/job-applications/${id}`, data, {
          headers: this.getHeaders(),
        }),
      );

      // إرسال إيميل رفض تلقائي
      if (data.status === 'REJECTED') {
        const app = response.data?.data ?? response.data;
        if (app?.email) {
          const nameParts = (app.fullName || '').split(' ');
          await this.mail.sendRejectionEmail(
            { firstNameAr: nameParts[0] || app.fullName, lastNameAr: nameParts.slice(1).join(' ') || '', email: app.email },
            app.specialization || 'الوظيفة',
          );
        }
      }

      return response.data;
    } catch (error) {
      this.handleError(error, 'فشل في تحديث الطلب');
    }
  }

  /**
   * موافقة المدير التنفيذي — ينقل الحالة إلى HIRED
   */
  async ceoApprove(id: string) {
    try {
      const response = await firstValueFrom(
        this.http.put(`${this.baseUrl}/job-applications/${id}`, { status: 'HIRED' }, {
          headers: this.getHeaders(),
        }),
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'فشل في تنفيذ موافقة المدير التنفيذي');
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
