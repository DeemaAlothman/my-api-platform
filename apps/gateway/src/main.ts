import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import helmet from 'helmet';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';

function createLogger(service: string) {
  const isProduction = process.env.NODE_ENV === 'production';
  return WinstonModule.createLogger({
    transports: [
      new winston.transports.Console({
        format: isProduction
          ? winston.format.combine(winston.format.timestamp(), winston.format.json())
          : winston.format.combine(
              winston.format.timestamp(),
              winston.format.colorize(),
              winston.format.printf(({ timestamp, level, message, context }) =>
                `[${timestamp}] [${service}] [${level}] [${context || 'App'}] ${message}`,
              ),
            ),
      }),
    ],
  });
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false, // نتحكم نحن بالـ body parser
    logger: createLogger('gateway'),
  });

  const expressApp = app.getHttpAdapter().getInstance();

  // JSON body parser يتجاهل أخطاء body الفاضي
  expressApp.use((req: any, res: any, next: any) => {
    require('express').json({ limit: '25mb' })(req, res, (err: any) => {
      if (err) return next(); // تجاهل خطأ JSON الفاضي
      next();
    });
  });

  // URL-encoded body parser
  expressApp.use(require('express').urlencoded({ extended: true, limit: '25mb' }));

  // Enable text/plain body parsing for ZKTeco PUSH protocol
  expressApp.use(require('express').text({ type: 'text/plain', limit: '1mb' }));

  // Base URL from API Guide
 app.setGlobalPrefix('api/v1', {
  exclude: ['iclock/(.*)'],
 });
  // Global filters and interceptors
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  // Helmet security headers
  app.use(helmet({
    frameguard: { action: 'deny' },
    noSniff: true,
    hidePoweredBy: true,
    hsts: process.env.NODE_ENV === 'production'
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,
    contentSecurityPolicy: false,
  }));

  // CORS - only allow configured origins
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
    .split(',')
    .map(o => o.trim());

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Accept-Language', 'Cache-Control', 'Pragma', 'X-Requested-With'],
    maxAge: 86400,
  });

  const port = process.env.PORT || 8000;
  await app.listen(port);
  console.log(`Gateway running on port ${port}`);
}
bootstrap();
