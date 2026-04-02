import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DeviceService } from '../device/device.service';
import { SyncService } from '../sync/sync.service';

interface ParsedAttLog {
  pin: string;
  timestamp: Date;
  rawType: number;
}

@Injectable()
export class IclockService {
  private readonly logger = new Logger(IclockService.name);

  constructor(
    private prisma: PrismaService,
    private deviceService: DeviceService,
    private syncService: SyncService,
  ) {}

  /**
   * معالجة Handshake: الجهاز يسجل نفسه
   */
  async handleHandshake(sn: string): Promise<string> {
    const device = await this.deviceService.findBySerialNumber(sn);

    if (!device) {
      this.logger.warn(`Unknown device SN: ${sn}`);
      // نسمح بالاتصال لكن نسجل تحذير
      return this.buildHandshakeResponse(sn);
    }

    if (!device.isActive) {
      this.logger.warn(`Inactive device SN: ${sn}`);
    }

    await this.deviceService.updateLastSync(device.id);
    this.logger.log(`Handshake from device SN: ${sn}`);

    return this.buildHandshakeResponse(sn);
  }

  private buildHandshakeResponse(sn: string): string {
    return [
      `GET OPTION FROM: ${sn}`,
      `Stamp=0`,
      `OpStamp=0`,
      `PhotoStamp=0`,
      `ErrorDelay=30`,
      `Delay=10`,
      `TransTimes=00:00;14:05`,
      `TransInterval=1`,
      `TransFlag=TransData AttLog`,
      `TimeZone=3`,
      `Realtime=1`,
      `Encrypt=0`,
    ].join('\n');
  }

  /**
   * معالجة سجلات الحضور القادمة من الجهاز
   */
  async handleAttendanceLogs(sn: string, body: string): Promise<string> {
    const device = await this.deviceService.findBySerialNumber(sn);

    if (!device) {
      this.logger.warn(`Attendance log from unknown device SN: ${sn}`);
      return 'OK';
    }

    await this.deviceService.updateLastSync(device.id);

    const logs = this.parseAttLogs(body);
    this.logger.log(`Received ${logs.length} logs from device ${sn}`);

    for (const log of logs) {
      await this.processLog(device.id, sn, log);
    }

    return 'OK';
  }

  /**
   * Parse سجلات الحضور - يدعم صيغتين:
   * 1. Tab-separated: PIN\tTIMESTAMP\tSTATUS\tVERIFY...
   * 2. Key=Value: PIN=1\tTime=2026-03-26 08:02:15\tStatus=0\tVerify=1
   */
  private parseAttLogs(body: string): ParsedAttLog[] {
    const lines = body.trim().split('\n').filter(l => l.trim());
    const results: ParsedAttLog[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        if (trimmed.includes('PIN=')) {
          // Key=Value format
          const parsed = this.parseKeyValueLine(trimmed);
          if (parsed) results.push(parsed);
        } else {
          // Tab-separated format
          const parsed = this.parseTabSeparatedLine(trimmed);
          if (parsed) results.push(parsed);
        }
      } catch (err) {
        this.logger.warn(`Failed to parse log line: ${trimmed} - ${err.message}`);
      }
    }

    return results;
  }

  private parseTabSeparatedLine(line: string): ParsedAttLog | null {
    const parts = line.split('\t');
    if (parts.length < 2) return null;

    const pin = parts[0].trim();
    const timestampStr = parts[1].trim();
    const rawType = parseInt(parts[2] ?? '0', 10) || 0;

    const timestamp = new Date(timestampStr + '+03:00');
    if (isNaN(timestamp.getTime())) return null;

    return { pin, timestamp, rawType };
  }

  private parseKeyValueLine(line: string): ParsedAttLog | null {
    const params: Record<string, string> = {};
    const parts = line.split('\t');
    for (const part of parts) {
      const [key, value] = part.split('=');
      if (key && value !== undefined) {
        params[key.trim()] = value.trim();
      }
    }

    const pin = params['PIN'];
    const timeStr = params['Time'];
    const rawType = parseInt(params['Status'] ?? '0', 10) || 0;

    if (!pin || !timeStr) return null;

    const timestamp = new Date(timeStr + '+03:00');
    if (isNaN(timestamp.getTime())) return null;

    return { pin, timestamp, rawType };
  }

  /**
   * معالجة سجل واحد: حفظ في RawAttendanceLog ثم مزامنة
   */
  private async processLog(deviceId: string, deviceSN: string, log: ParsedAttLog) {
    // ابحث عن الموظف من PIN
    const mapping = await this.prisma.employeeFingerprint.findFirst({
      where: { pin: log.pin, deviceId, isActive: true },
    });

    const employeeId = mapping?.employeeId ?? null;

    // احفظ السجل الخام
    const rawLog = await this.prisma.rawAttendanceLog.create({
      data: {
        deviceId,
        deviceSN,
        pin: log.pin,
        employeeId,
        timestamp: log.timestamp,
        rawType: log.rawType,
        synced: false,
      },
    });

    if (!employeeId) {
      // PIN غير مربوط بموظف
      await this.prisma.rawAttendanceLog.update({
        where: { id: rawLog.id },
        data: { syncError: `PIN ${log.pin} not mapped to any employee` },
      });
      this.logger.warn(`PIN ${log.pin} not found in employee mappings`);
      return;
    }

    // مزامنة مع attendance
    await this.syncService.processNewStamp(rawLog.id, employeeId, deviceSN, log.timestamp);
  }
}
