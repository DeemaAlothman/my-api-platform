import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@shared/auth';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  // بلا JWT — للتأكد من أن الخدمة تستجيب أصلاً (uptime فقط)
  @Get('ping')
  ping() {
    return { status: 'ok', service: 'warehouse' };
  }

  // بـ JWT — للتأكد من سلسلة (gateway → warehouse → auth → قاعدة البيانات) كاملة
  @UseGuards(JwtAuthGuard)
  @Get()
  async check() {
    const rows = await this.prisma.$queryRaw<Array<{ note: string; createdAt: Date }>>`
      SELECT note, "createdAt" FROM warehouse.warehouse_meta ORDER BY id LIMIT 1
    `;
    return { status: 'ok', service: 'warehouse', db: rows[0] ?? null };
  }
}
