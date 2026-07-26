import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { DailyClosureService } from './daily-closure.service';
import { BackfillService } from './backfill.service';
import { JwtAuthGuard } from '@shared/auth';
import { PermissionsGuard } from '@shared';
import { Permission } from '@shared';

@Controller('attendance-admin')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DailyClosureController {
  constructor(
    private readonly dailyClosureService: DailyClosureService,
    private readonly backfillService: BackfillService,
  ) {}

  @Post('daily-closure/trigger')
  @Permission('attendance.records.create')
  trigger(@Body() body: { date?: string }) {
    const dateStr = body?.date ?? new Date().toISOString().split('T')[0];
    return this.dailyClosureService.processDayForAllEmployees(dateStr);
  }

  @Post('backfill/dry-run')
  @Permission('attendance.records.create')
  dryRun(@Body() body: { dateFrom?: string; dateTo?: string; employeeId?: string }) {
    return this.backfillService.dryRun(body);
  }

  @Post('backfill/apply')
  @Permission('attendance.records.create')
  apply(@Body() body: { dateFrom?: string; dateTo?: string; employeeId?: string; batchSize?: number }) {
    return this.backfillService.apply(body);
  }

  // سكريبت تعويضي one-off: معالجة الانصراف المبكر لشهر مضى بآلية الرصيد المشترك الجديدة
  @Post('backfill-early-leave/:year/:month')
  @Permission('attendance.records.create')
  backfillEarlyLeave(@Param('year') year: string, @Param('month') month: string) {
    return this.dailyClosureService.backfillEarlyLeaveOffsets(parseInt(year), parseInt(month));
  }

  // سكريبت تعويضي one-off: معالجة التأخير لشهر مضى بآلية الرصيد المشترك (لا يلمس إلا سجلات
  // التأخير غير المعالجة سابقاً)
  @Post('backfill-tardiness/:year/:month')
  @Permission('attendance.records.create')
  backfillTardiness(@Param('year') year: string, @Param('month') month: string) {
    return this.dailyClosureService.backfillTardinessOffsets(parseInt(year), parseInt(month));
  }

  // تدقيق قراءة فقط — لا يكتب أي شيء بقاعدة البيانات: يقارن "المتوقع" بـ"المخزّن فعلياً" لرصيد
  // التأخير/الانصراف المبكر المشترك لكل موظفي الشهر، ويرجّع فقط الفروقات
  @Get('audit-offsets/:year/:month')
  @Permission('attendance.records.create')
  auditOffsets(@Param('year') year: string, @Param('month') month: string) {
    return this.dailyClosureService.auditOffsets(parseInt(year), parseInt(month));
  }

  // إعادة توليد الإجازات التلقائية المفقودة (TARDINESS_AUTO / EARLY_LEAVE_AUTO) لشهر كامل.
  // آمن: لا يحذف شيئاً، يتحقق من وجود الإجازة قبل إنشائها (يمنع التكرار).
  @Post('regenerate-auto-leaves/:year/:month')
  @Permission('attendance.records.create')
  regenerateAutoLeaves(@Param('year') year: string, @Param('month') month: string) {
    return this.dailyClosureService.regenerateMissingAutoLeaves(parseInt(year), parseInt(month));
  }
}
