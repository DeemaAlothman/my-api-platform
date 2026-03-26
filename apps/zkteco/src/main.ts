import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable text/plain body parsing for ZKTeco PUSH protocol
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.use(require('express').text({ type: 'text/plain', limit: '1mb' }));

  // Enable validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false, // نتساهل لأن iclock يبعت حقول غريبة
      transform: true,
    }),
  );

  // Enable CORS
  app.enableCors();

  // NO global prefix - /iclock must be at root
  // JWT-protected routes use their controller paths directly

  const port = process.env.PORT || 4007;
  await app.listen(port);
  console.log(`ZKTeco Service is running on port ${port}`);
}
bootstrap();
