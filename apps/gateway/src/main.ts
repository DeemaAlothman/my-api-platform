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
    logger: createLogger('gateway'),
  });

  // Base URL from API Guide
  app.setGlobalPrefix('api/v1');

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
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Accept-Language'],
    maxAge: 86400,
  });

  const port = process.env.PORT || 8000;
  await app.listen(port);
  console.log(`Gateway running on port ${port}`);
}
bootstrap();
