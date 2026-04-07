import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Request, Response } from 'express';
import { firstValueFrom } from 'rxjs';

interface ServiceConfig {
  url: string;
  prefix: string;
  noApiPrefix?: boolean; // true = لا يوجد /api/v1 في هذه الخدمة
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

    this.services.set('attendance', {
      url: process.env.ATTENDANCE_SERVICE_URL || 'http://localhost:4004',
      prefix: '/attendance',
    });

    this.services.set('evaluation', {
      url: process.env.EVALUATION_SERVICE_URL || 'http://localhost:4005',
      prefix: '/evaluation',
    });

    this.services.set('requests', {
      url: process.env.REQUESTS_SERVICE_URL || 'http://localhost:4006',
      prefix: '/requests',
    });

    this.services.set('zkteco', {
      url: process.env.ZKTECO_SERVICE_URL || 'http://localhost:4007',
      prefix: '/zkteco',
      noApiPrefix: true, // ZKTeco service has no global /api/v1 prefix
    });

    this.services.set('jobs', {
      url: process.env.JOBS_SERVICE_URL || 'http://localhost:4008',
      prefix: '/jobs',
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
      const targetUrl = service.noApiPrefix
        ? `${service.url}${targetPath}`
        : `${service.url}/api/v1${targetPath}`;

      // نسخ الـ headers (بدون host)
      const headers = { ...req.headers };
      delete headers.host;
      delete headers['content-length'];

      // multipart/form-data: pipe raw stream directly (axios can't reconstruct it)
      const reqContentType = req.headers['content-type'] || '';
      if (reqContentType.includes('multipart/form-data')) {
        return new Promise<void>((resolve, reject) => {
          const urlObj = new URL(targetUrl);
          const queryString = new URLSearchParams(req.query as any).toString();
          const path = urlObj.pathname + (queryString ? '?' + queryString : '');

          const nodeHttp = require('http');
          const proxyReq = nodeHttp.request(
            {
              hostname: urlObj.hostname,
              port: parseInt(urlObj.port) || 80,
              path,
              method: req.method,
              headers: { ...headers, 'content-type': req.headers['content-type'] },
            },
            (proxyRes: any) => {
              res.status(proxyRes.statusCode);
              Object.keys(proxyRes.headers).forEach((key) => {
                if (key !== 'transfer-encoding') {
                  res.setHeader(key, proxyRes.headers[key]);
                }
              });
              let body = '';
              proxyRes.on('data', (chunk: any) => (body += chunk));
              proxyRes.on('end', () => {
                try {
                  res.json(JSON.parse(body));
                } catch {
                  res.send(body);
                }
                resolve();
              });
            },
          );
          proxyReq.on('error', (err: any) => {
            console.error(`Multipart proxy error for ${serviceName}:`, err.message);
            res.status(503).json({
              success: false,
              error: { code: 'SERVICE_UNAVAILABLE', message: err.message, details: [] },
            });
            resolve();
          });
          req.pipe(proxyReq);
        });
      }

      // إرسال الطلب للخدمة
      const response = await firstValueFrom(
        this.http.request({
          method: req.method,
          url: targetUrl,
          headers,
          data: req.body,
          params: req.query, // query params تُرسل هنا
          validateStatus: () => true, // نقبل كل status codes
          responseType: 'text', // نقرأ كـ text ثم نحاول parse
        }),
      );

      // إرجاع الـ response
      res.status(response.status);

      // نسخ الـ headers من الـ response
      Object.keys(response.headers).forEach((key) => {
        if (key !== 'transfer-encoding') {
          res.setHeader(key, response.headers[key]);
        }
      });

      // إذا كان الـ response text/plain (مثل iclock) نرجعه مباشرة
      const contentType = response.headers['content-type'] || '';
      if (contentType.includes('text/plain') || typeof response.data === 'string') {
        try {
          const parsed = JSON.parse(response.data);
          return res.json(parsed);
        } catch {
          return res.send(response.data);
        }
      }
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
