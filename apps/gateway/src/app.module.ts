import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { ProxyModule } from './proxy/proxy.module';

@Module({
  imports: [ProxyModule],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
