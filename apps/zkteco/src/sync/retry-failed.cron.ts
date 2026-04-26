import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { SyncService } from './sync.service';

const RETRY_WINDOW_DAYS = 7;
const BATCH_LIMIT = 50;

@Injectable()
export class RetryFailedCron {
  private readonly logger = new Logger(RetryFailedCron.name);
  private running = false;

  constructor(
    private prisma: PrismaService,
    private syncService: SyncService,
  ) {}

  /**
   * يشتغل كل ساعة — يُعيد محاولة sync للسجلات التي فشلت ولم تُعالَج بعد.
   * الشروط: syncError IS NOT NULL + synced = false + employeeId IS NOT NULL
   * + timestamp خلال آخر RETRY_WINDOW_DAYS أيام.
   */
  @Cron('0 * * * *', { timeZone: 'UTC' })
  async retryFailedStamps() {
    if (this.running) {
      this.logger.warn('[RETRY_SKIP] previous run still in progress, skipping this tick');
      return;
    }
    this.running = true;

    try {
      const since = new Date();
      since.setDate(since.getDate() - RETRY_WINDOW_DAYS);

      const failed = await this.prisma.rawAttendanceLog.findMany({
        where: {
          synced: false,
          syncError: { not: null },
          employeeId: { not: null },
          timestamp: { gte: since },
        },
        orderBy: { timestamp: 'asc' },
        take: BATCH_LIMIT,
        select: { id: true, employeeId: true, deviceSN: true, timestamp: true, syncError: true },
      });

      if (failed.length === 0) {
        this.logger.log('[RETRY_IDLE] no failed stamps to retry');
        return;
      }

      this.logger.log(`[RETRY_START] found ${failed.length} failed stamp(s) — retrying`);

      let successCount = 0;
      let failCount = 0;

      for (const log of failed) {
        // نظّف syncError قبل إعادة المحاولة حتى لا يُعاد التقاطه في نفس الجولة
        await this.prisma.rawAttendanceLog.update({
          where: { id: log.id },
          data: { syncError: null },
        }).catch(() => {});

        try {
          await this.syncService.processNewStamp(
            log.id,
            log.employeeId!,
            log.deviceSN,
            log.timestamp,
          );
          successCount++;
          this.logger.log(
            `[RETRY_OK] logId=${log.id} employeeId=${log.employeeId} ts=${log.timestamp.toISOString()}`,
          );
        } catch (err) {
          failCount++;
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.error(
            `[RETRY_FAIL] logId=${log.id} employeeId=${log.employeeId} — ${msg}`,
          );
        }
      }

      this.logger.log(`[RETRY_DONE] success=${successCount} stillFailed=${failCount} total=${failed.length}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`[RETRY_CRON_ERROR] ${msg}`);
    } finally {
      this.running = false;
    }
  }
}
