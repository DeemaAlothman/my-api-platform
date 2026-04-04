import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class JobApplicationsService {
  private readonly logger = new Logger(JobApplicationsService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(private readonly http: HttpService) {
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
  async findAll(query: { status?: string; page?: string; limit?: string }) {
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

      return response.data;
    } catch (error) {
      this.handleError(error, 'فشل في جلب طلبات التوظيف');
    }
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
   * جلب طلب واحد بالـ ID
   */
  async findOne(id: string) {
    try {
      const response = await firstValueFrom(
        this.http.get(`${this.baseUrl}/job-applications/${id}`, {
          headers: this.getHeaders(),
        }),
      );

      return response.data;
    } catch (error) {
      this.handleError(error, 'فشل في جلب الطلب');
    }
  }

  /**
   * تحديث حالة طلب
   */
  async update(id: string, data: { status: string; reviewNotes?: string; rejectionNote?: string; rating?: number }) {
    try {
      const response = await firstValueFrom(
        this.http.put(`${this.baseUrl}/job-applications/${id}`, data, {
          headers: this.getHeaders(),
        }),
      );

      return response.data;
    } catch (error) {
      this.handleError(error, 'فشل في تحديث الطلب');
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
