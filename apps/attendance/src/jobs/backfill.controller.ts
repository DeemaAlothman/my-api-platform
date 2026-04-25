import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { BackfillService } from './backfill.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permission } from '../common/decorators/permission.decorator';

@Controller('attendance-admin')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BackfillController {
  constructor(private readonly backfillService: BackfillService) {}

  /**
   * Dry-run: يحسب ماذا سيتغير بدون كتابة — آمن تماماً
   * Body: { "dateFrom": "2026-01-01", "dateTo": "2026-04-22", "employeeId": "optional" }
   */
  @Post('backfill/dry-run')
  @Permission('attendance.records.create')
  dryRun(@Body() body: { dateFrom?: string; dateTo?: string; employeeId?: string; useNewBusinessRules?: boolean }) {
    return this.backfillService.dryRun(body);
  }

  /**
   * Apply: يطبق التغييرات على دفعات — شغّله فقط بعد مراجعة dry-run
   * Body: { "dateFrom": "2026-01-01", "dateTo": "2026-04-22", "employeeId": "optional", "batchSize": 50, "useNewBusinessRules": true }
   */
  @Post('backfill/apply')
  @Permission('attendance.records.create')
  apply(@Body() body: { dateFrom?: string; dateTo?: string; employeeId?: string; batchSize?: number; useNewBusinessRules?: boolean }) {
    return this.backfillService.apply(body);
  }
}
