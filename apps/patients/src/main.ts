import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import * as path from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // B7: ثق بالـ gateway كـ proxy لالتقاط IP العميل الحقيقي من x-forwarded-for
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // خدمة ملفات المرضى الثابتة (صور ومستندات)
  app.useStaticAssets(path.join('/app', 'uploads'), { prefix: '/uploads' });

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  await app.listen(4010);
  console.log('Patients Service running on port 4010');
}
bootstrap();
