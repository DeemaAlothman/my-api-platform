import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable text body parsing for ZKTeco PUSH protocol (accepts text/plain, octet-stream, no Content-Type, form-urlencoded)
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.use(require('express').text({
    type: (req: any) => {
      const ct = (req.headers['content-type'] || '').toLowerCase().split(';')[0].trim();
      return ct.startsWith('text/') || ct === 'application/octet-stream' || ct === '' || ct === 'application/x-www-form-urlencoded';
    },
    limit: '1mb',
  }));

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

  const config = new DocumentBuilder()
    .setTitle('ZKTeco Service')
    .setDescription('Biometric Devices & Fingerprints API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));

  const port = process.env.PORT || 4007;
  await app.listen(port);
  console.log(`ZKTeco Service is running on port ${port}`);
}
bootstrap();
