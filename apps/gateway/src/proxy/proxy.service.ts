import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Request, Response } from 'express';
import { firstValueFrom } from 'rxjs';

interface ServiceConfig {
  url: string;
  prefix: string;
}

@Injectable()
export class ProxyService {
  private services: Map<string, ServiceConfig> = new Map();

  constructor(private readonly http: HttpService) {
    // Service URLs من environment variables
    this.services.set('auth', {
      url: process.env.AUTH_SERVICE_URL || 'http://localhost:4001',
      prefix: '/auth',
    });

    this.services.set('users', {
      url: process.env.USERS_SERVICE_URL || 'http://localhost:4002',
      prefix: '/users',
    });

    this.services.set('leave', {
      url: process.env.LEAVE_SERVICE_URL || 'http://localhost:4003',
      prefix: '/leave',
    });
  }

  async forward(req: Request, res: Response, serviceName: string) {
    const service = this.services.get(serviceName);

    if (!service) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SERVICE_NOT_FOUND',
          message: `Service ${serviceName} not found`,
          details: [],
        },
      });
    }

    try {
      // بناء الـ URL الكامل
      // إزالة /api/v1 من البداية وإزالة query string
      let targetPath = req.originalUrl.replace(/^\/api\/v1/, '').split('?')[0];
      const targetUrl = `${service.url}/api/v1${targetPath}`;

      // نسخ الـ headers (بدون host)
      const headers = { ...req.headers };
      delete headers.host;
      delete headers['content-length'];

      // إرسال الطلب للخدمة
      const response = await firstValueFrom(
        this.http.request({
          method: req.method,
          url: targetUrl,
          headers,
          data: req.body,
          params: req.query, // query params تُرسل هنا
          validateStatus: () => true, // نقبل كل status codes
        }),
      );

      // إرجاع الـ response
      res.status(response.status);

      // نسخ الـ headers من الـ response
      Object.keys(response.headers).forEach((key) => {
        res.setHeader(key, response.headers[key]);
      });

      return res.json(response.data);
    } catch (error) {
      console.error(`Error forwarding to ${serviceName}:`, error.message);

      return res.status(503).json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: `Service ${serviceName} is unavailable`,
          details: [{ error: error.message }],
        },
      });
    }
  }
}
