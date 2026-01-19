import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  health() {
    return {
      success: true,
      data: { service: 'gateway', status: 'ok' },
      meta: { timestamp: new Date().toISOString() },
    };
  }
}
