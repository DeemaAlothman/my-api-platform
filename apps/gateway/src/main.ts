import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Base URL from API Guide
  app.setGlobalPrefix('api/v1');

  // Global filters and interceptors
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  // Enable CORS
  app.enableCors({
    origin: true,
    credentials: true,
  });

  const port = process.env.PORT || 8000;
  await app.listen(port);
  console.log(`🚀 Gateway running on port ${port}`);
}
bootstrap();
