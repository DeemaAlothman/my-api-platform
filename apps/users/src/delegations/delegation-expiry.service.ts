import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

// إشعار "انتهى التفويض" (type: DELEGATION_ENDED) — للبديل وللمفوِّض الأصلي، لما تفويض نشط
// يتجاوز تاريخ نهايته طبيعياً. مرة واحدة فقط لكل تفويض (محروس بـ endNotifiedAt).
// الإلغاء المبكر بسبب إلغاء الإجازة نفسها بينبعت فوراً من خدمة leave وقت الإلغاء، لا من هون.
@Injectable()
export class DelegationExpiryService {
  private readonly logger = new Logger(DelegationExpiryService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('*/15 * * * *', { timeZone: 'Asia/Riyadh' })
  async notifyExpiredDelegations() {
    const rows = await this.prisma.$queryRawUnsafe<Array<{
      id: string; delegatorId: string; delegateId: string; toDate: Date;
    }>>(
      `SELECT id, "delegatorId", "delegateId", "toDate"
       FROM users.delegations
       WHERE status = 'ACTIVE' AND "toDate" < NOW() AND "endNotifiedAt" IS NULL`,
    ).catch(() => [] as Array<{ id: string; delegatorId: string; delegateId: string; toDate: Date }>);

    if (rows.length === 0) return;

    for (const row of rows) {
      await this.notifyBoth(row.delegatorId, row.delegateId, row.toDate);
      await this.prisma.$executeRawUnsafe(
        `UPDATE users.delegations SET "endNotifiedAt" = NOW() WHERE id = $1`,
        row.id,
      ).catch(() => {});
    }
    this.logger.log(`Delegation-ended notifications sent for ${rows.length} delegation(s)`);
  }

  private async notifyBoth(delegatorId: string, delegateId: string, toDate: Date) {
    try {
      const rows = await this.prisma.$queryRawUnsafe<Array<{
        id: string; userId: string | null; firstNameAr: string; lastNameAr: string;
      }>>(
        `SELECT id, "userId", "firstNameAr", "lastNameAr" FROM users.employees WHERE id = ANY($1::text[]) AND "deletedAt" IS NULL`,
        [delegatorId, delegateId],
      );
      const map = new Map(rows.map(r => [r.id, r]));
      const delegator = map.get(delegatorId);
      const delegate = map.get(delegateId);
      if (!delegator || !delegate) return;

      if (delegate.userId) {
        await this.insertNotif(
          delegate.userId,
          'انتهى التفويض',
          `انتهى تفويضك نيابة عن ${delegator.firstNameAr} ${delegator.lastNameAr}`,
          { type: 'DELEGATION_ENDED', delegatorEmployeeId: delegatorId },
        );
      }
      if (delegator.userId) {
        await this.insertNotif(
          delegator.userId,
          'انتهى التفويض',
          `انتهى تفويضك لـ${delegate.firstNameAr} ${delegate.lastNameAr}`,
          { type: 'DELEGATION_ENDED', delegateEmployeeId: delegateId },
        );
      }
    } catch (err) {
      this.logger.error(`notifyBoth failed: ${(err as any)?.message}`);
    }
  }

  private async insertNotif(userId: string, titleAr: string, messageAr: string, data: object) {
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO users.notifications (id, "userId", type, "titleAr", "titleEn", "messageAr", "messageEn", data, "createdAt")
       VALUES (gen_random_uuid()::text, $1, 'GENERAL'::"users"."NotificationType", $2, $2, $3, $3, $4::jsonb, NOW())`,
      userId, titleAr, messageAr, JSON.stringify(data),
    ).catch(() => {});
  }
}
