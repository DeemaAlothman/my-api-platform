import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Enable CORS
  app.enableCors();

  // Set global prefix
  app.setGlobalPrefix('api/v1');

  app.useGlobalInterceptors(new ResponseInterceptor());

  const config = new DocumentBuilder()
    .setTitle('Attendance Service')
    .setDescription('Attendance Records, Schedules, Alerts & Payroll API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/v1/docs', app, SwaggerModule.createDocument(app, config));

  const port = process.env.PORT || 4004;
  await app.listen(port);
  console.log(`Attendance Service is running on port ${port}`);
}
bootstrap();
