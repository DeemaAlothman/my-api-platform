import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Set global prefix
  app.setGlobalPrefix('api/v1');

  // Enable validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.PORT || 4005;
  await app.listen(port);

  console.log(`Evaluation Service is running on: http://localhost:${port}`);
  console.log(`API available at: http://localhost:${port}/api/v1`);
}

bootstrap();
