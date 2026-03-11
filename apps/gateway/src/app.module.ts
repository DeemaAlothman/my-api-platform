import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { HealthController } from './health/health.controller';
import { ProxyModule } from './proxy/proxy.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      { name: 'short',  ttl: 1000,    limit: 10   },
      { name: 'medium', ttl: 60000,   limit: 100  },
      { name: 'long',   ttl: 3600000, limit: 1000 },
    ]),
    ProxyModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
