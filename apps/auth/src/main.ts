import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './filters/infrastructure/http-exception.filter';
import { validateEnvironment } from './config/env.validation';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';

async function bootstrap() {
  validateEnvironment();

  const isProduction = process.env.NODE_ENV === 'production';
  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger({
      transports: [
        new winston.transports.Console({
          format: isProduction
            ? winston.format.combine(winston.format.timestamp(), winston.format.json())
            : winston.format.combine(
                winston.format.timestamp(),
                winston.format.colorize(),
                winston.format.printf(({ timestamp, level, message, context }) =>
                  `[${timestamp}] [auth] [${level}] [${context || 'App'}] ${message}`,
                ),
              ),
        }),
      ],
    }),
  });

  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new GlobalExceptionFilter());

  await app.listen(4001);
}
bootstrap();
