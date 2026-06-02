import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClockSyncMonitorService implements OnModuleInit {
  private readonly logger = new Logger(ClockSyncMonitorService.name);

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.scheduleClockSyncCheck();
    this.scheduleDeviceHealthCheck();
  }

  /** Phase 7.1: فحص انجراف ساعة الجهاز يومياً الساعة 6:00 ص دمشق (03:00 UTC) */
  private scheduleClockSyncCheck() {
    const now = new Date();
    const next = new Date(now);
    next.setUTCHours(3, 0, 0, 0);
    if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
    const delayMs = next.getTime() - now.getTime();
    this.logger.log(`Clock sync check scheduled in ${Math.round(delayMs / 60000)} min (at ${next.toISOString()})`);

    setTimeout(async () => {
      try { await this.monitorClockSync(); } catch (err) {
        this.logger.error(`Clock sync check failed: ${(err as any)?.message}`);
      }
      this.scheduleClockSyncCheck();
    }, delayMs);
  }

  /** Phase 7.2: فحص حالة الأجهزة كل 30 دقيقة */
  private scheduleDeviceHealthCheck() {
    const INTERVAL_MS = 30 * 60 * 1000;
    setTimeout(async () => {
      try { await this.deviceHealthCheck(); } catch (err) {
        this.logger.error(`Device health check failed: ${(err as any)?.message}`);
      }
      setInterval(async () => {
        try { await this.deviceHealthCheck(); } catch (err) {
          this.logger.error(`Device health check failed: ${(err as any)?.message}`);
        }
      }, INTERVAL_MS);
    }, 60 * 1000); // تأخير دقيقة عند البدء
  }

  private async monitorClockSync(): Promise<void> {
    try {
      const devices = (await this.prisma.$queryRawUnsafe(
        `SELECT id, "serialNumber", "ipAddress"
         FROM biometric.biometric_devices
         WHERE "isActive" = true`,
      )) as Array<{ id: string; serialNumber: string; ipAddress: string }>;

      for (const device of devices) {
        const lastStamp = (await this.prisma.$queryRawUnsafe(
          `SELECT timestamp, "createdAt" FROM biometric.raw_attendance_logs
           WHERE "deviceId" = $1
           ORDER BY "createdAt" DESC LIMIT 1`,

          device.id,
        )) as Array<{ timestamp: Date; createdAt: Date }>;

        if (!lastStamp[0]) continue;

        const driftMs = Math.abs(
          lastStamp[0].timestamp.getTime() - lastStamp[0].createdAt.getTime(),
        );
        const driftMin = Math.round(driftMs / 60000);

        if (driftMin > 1) {
          this.logger.warn(`[CLOCK_DRIFT] Device ${device.serialNumber} drift=${driftMin}min`);
          await this.alertHR(
            `انجراف ساعة جهاز البصمة`,
            `Clock Drift Detected`,
            `ساعة جهاز البصمة ${device.serialNumber} (${device.ipAddress}) منحرفة بمقدار ${driftMin} دقيقة`,
            `Device ${device.serialNumber} (${device.ipAddress}) clock is drifted by ${driftMin} minutes`,
          );
        }
      }
    } catch (err) {
      this.logger.error(`monitorClockSync: ${(err as any)?.message}`);
    }
  }

  private async deviceHealthCheck(): Promise<void> {
    try {
      const devices = (await this.prisma.$queryRawUnsafe(
        `SELECT id, "serialNumber", "ipAddress", "lastSyncAt"
         FROM biometric.biometric_devices
         WHERE "isActive" = true`,
      )) as Array<{ id: string; serialNumber: string; ipAddress: string; lastSyncAt: Date | null }>;

      const now = Date.now();
      for (const device of devices) {
        if (!device.lastSyncAt) continue;
        const hoursSinceSync = (now - device.lastSyncAt.getTime()) / 3600000;

        if (hoursSinceSync > 6) {
          this.logger.error(`[DEVICE_OFFLINE] Device ${device.serialNumber} offline ${Math.round(hoursSinceSync)}h`);
          await this.alertHR(
            'جهاز بصمة غير متصل — حرج',
            'Device Offline — Critical',
            `جهاز البصمة ${device.serialNumber} (${device.ipAddress}) لم يتزامن منذ ${Math.round(hoursSinceSync)} ساعة`,
            `Device ${device.serialNumber} (${device.ipAddress}) has not synced for ${Math.round(hoursSinceSync)} hours`,
          );
        } else if (hoursSinceSync > 2) {
          this.logger.warn(`[DEVICE_DELAYED] Device ${device.serialNumber} delayed ${Math.round(hoursSinceSync)}h`);
          await this.alertHR(
            'جهاز بصمة متأخر في المزامنة',
            'Device Sync Delayed',
            `جهاز البصمة ${device.serialNumber} (${device.ipAddress}) لم يتزامن منذ ${Math.round(hoursSinceSync)} ساعة`,
            `Device ${device.serialNumber} (${device.ipAddress}) has not synced for ${Math.round(hoursSinceSync)} hours`,
          );
        }
      }
    } catch (err) {
      this.logger.error(`deviceHealthCheck: ${(err as any)?.message}`);
    }
  }

  private async alertHR(titleAr: string, titleEn: string, messageAr: string, messageEn: string): Promise<void> {
    try {
      const hrUsers = (await this.prisma.$queryRawUnsafe(
        `SELECT DISTINCT u.id
         FROM users.users u
         INNER JOIN users.user_roles ur ON ur."userId" = u.id
         INNER JOIN users.roles r ON r.id = ur."roleId"
         WHERE r.name IN ('HR', 'HR_Specialist', 'super_admin', 'IT')
           AND r."deletedAt" IS NULL AND u."deletedAt" IS NULL`,
      )) as Array<{ id: string }>;

      for (const hr of hrUsers) {
        await this.prisma.$queryRawUnsafe(
          `INSERT INTO users.notifications
             (id, "userId", type, "titleAr", "titleEn", "messageAr", "messageEn", "isRead", "createdAt")
           VALUES
             (gen_random_uuid(), $1, 'GENERAL', $2, $3, $4, $5, false, NOW())`,
          hr.id, titleAr, titleEn, messageAr, messageEn,
        );
      }
    } catch {
      // إشعار فاشل لا يوقف العملية
    }
  }
}
