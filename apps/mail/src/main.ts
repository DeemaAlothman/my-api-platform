import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // الافتراضي 100kB — وهو أصغر من أن يحمل رسالة فيها صورة مضمّنة واحدة، فكان
  // المحرّر يصطدم بـ413 قبل أن يصل الطلب إلى الكود. الرقم مطابق لحدّ الـgateway.
  app.use(require('express').json({ limit: '25mb' }));
  app.use(require('express').urlencoded({ extended: true, limit: '25mb' }));

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }));
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());
  const config = new DocumentBuilder()
    .setTitle('Mail Service')
    .setDescription('Internal Mail API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/v1/docs', app, SwaggerModule.createDocument(app, config));

  await app.listen(4009);
  app.getHttpServer().setTimeout(parseInt(process.env.UPLOAD_TIMEOUT_MS || '300000', 10));
  console.log('Mail Service is running on port 4009');
}
bootstrap();
