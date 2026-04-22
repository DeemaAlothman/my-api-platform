import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { DailyClosureService } from './daily-closure.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permission } from '../common/decorators/permission.decorator';

@Controller('attendance-admin')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DailyClosureController {
  constructor(private readonly dailyClosureService: DailyClosureService) {}

  /**
   * تشغيل يدوي للاختبار — لا تنتظر منتصف الليل
   * Body: { "date": "2026-04-22" } أو فارغ ليأخذ اليوم الحالي
   */
  @Post('daily-closure/trigger')
  @Permission('attendance.records.admin')
  trigger(@Body() body: { date?: string }) {
    const dateStr = body?.date ?? new Date().toISOString().split('T')[0];
    return this.dailyClosureService.processDayForAllEmployees(dateStr);
  }
}
