import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Set global prefix
  app.setGlobalPrefix('api/v1');

  // Enable validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      skipMissingProperties: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Evaluation Service')
    .setDescription('Performance Evaluation, Criteria & Periods API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/v1/docs', app as any, SwaggerModule.createDocument(app as any, config));

  const port = process.env.PORT || 4005;
  await app.listen(port);

  console.log(`Evaluation Service is running on: http://localhost:${port}`);
  console.log(`API available at: http://localhost:${port}/api/v1`);
}

bootstrap();
