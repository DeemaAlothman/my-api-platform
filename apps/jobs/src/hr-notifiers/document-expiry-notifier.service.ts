import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const THRESHOLDS = [30, 14, 7];

@Injectable()
export class DocumentExpiryNotifierService implements OnModuleInit {
  private readonly logger = new Logger(DocumentExpiryNotifierService.name);

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.scheduleDaily();
  }

  private scheduleDaily() {
    const now = new Date();
    const next = new Date(now);
    next.setUTCHours(5, 30, 0, 0); // 8:30am Damascus — offset from other notifiers
    if (next.getTime() <= now.getTime()) {
      next.setUTCDate(next.getUTCDate() + 1);
    }
    setTimeout(async () => {
      try { await this.run(); } catch (err) {
        this.logger.error(`DocumentExpiryNotifier failed: ${(err as any)?.message}`);
      }
      this.scheduleDaily();
    }, next.getTime() - now.getTime());
  }

  async run() {
    for (const days of THRESHOLDS) {
      await this.checkExpiringDocuments(days);
    }
  }

  private async checkExpiringDocuments(daysAhead: number) {
    const targetDate = new Date();
    targetDate.setUTCDate(targetDate.getUTCDate() + daysAhead);
    const targetStr = targetDate.toISOString().split('T')[0];

    const docs = await this.prisma.$queryRawUnsafe(`
      SELECT
        d.id AS "documentId",
        d."employeeId",
        d."titleAr",
        d."expiryDate",
        e."firstNameAr", e."lastNameAr", e."employeeNumber"
      FROM users.employee_documents d
      JOIN users.employees e ON e.id = d."employeeId"
      WHERE d."deletedAt" IS NULL
        AND d.status = 'ACTIVE'
        AND d."expiryDate" IS NOT NULL
        AND d."expiryDate"::date = $1::date
        AND e."deletedAt" IS NULL
        AND e."employmentStatus" = 'ACTIVE'
    `, targetStr) as any[];

    if (docs.length === 0) return;

    const hrUserIds = await this.getHRUserIds();
    if (hrUserIds.length === 0) return;

    for (const doc of docs) {
      for (const hrUserId of hrUserIds) {
        await this.prisma.$queryRawUnsafe(`
          INSERT INTO users.notifications
            (id, "userId", type, "titleAr", "titleEn", "messageAr", "messageEn", data, "isRead", "createdAt")
          VALUES
            (gen_random_uuid(), $1, 'DOCUMENT_EXPIRY'::users."NotificationType",
             'تنبيه انتهاء صلاحية وثيقة', 'Document Expiry Alert',
             $2, $3, $4::jsonb, false, NOW())
        `,
          hrUserId,
          `وثيقة "${doc.titleAr}" للموظف ${doc.firstNameAr} ${doc.lastNameAr} (${doc.employeeNumber}) تنتهي خلال ${daysAhead} يوم`,
          `Document "${doc.titleAr}" for employee ${doc.firstNameAr} ${doc.lastNameAr} expires in ${daysAhead} days`,
          JSON.stringify({ employeeId: doc.employeeId, documentId: doc.documentId }),
        ).catch(() => {});
      }
    }

    this.logger.log(`DocumentExpiryNotifier: ${docs.length} document(s) expiring in ${daysAhead} days`);
  }

  private async getHRUserIds(): Promise<string[]> {
    const rows = await this.prisma.$queryRawUnsafe(`
      SELECT DISTINCT u.id
      FROM users.users u
      INNER JOIN users.user_roles ur ON ur."userId" = u.id
      INNER JOIN users.roles r ON r.id = ur."roleId"
      WHERE r.name IN ('HR', 'HR_Specialist', 'super_admin')
        AND r."deletedAt" IS NULL
        AND u."deletedAt" IS NULL
    `) as Array<{ id: string }>;
    return rows.map(r => r.id);
  }
}
