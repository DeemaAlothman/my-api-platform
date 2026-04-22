import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { DailyClosureService } from './daily-closure.service';
import { BackfillService } from './backfill.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permission } from '../common/decorators/permission.decorator';

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
}
