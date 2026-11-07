import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type ComputedStatus = 'ACTIVE' | 'UPCOMING' | 'ENDED';

@Injectable()
export class DelegationsService {
  constructor(private readonly prisma: PrismaService) {}

  private computeStatus(dbStatus: string, from: Date, to: Date, now: Date): ComputedStatus {
    if (dbStatus !== 'ACTIVE') return 'ENDED';
    if (now < new Date(from)) return 'UPCOMING';
    if (now > new Date(to)) return 'ENDED';
    return 'ACTIVE';
  }

  // status هون فلتر عرضي محسوب (مش عمود DB مباشر) — قيمة واحدة من 3 ثابتة فقط، لا يوجد أي
  // إدخال مستخدم حر يدخل بالـSQL مباشرة
  async list(statusFilter: ComputedStatus | undefined, page = 1, limit = 20) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;

    let statusCondition = '';
    if (statusFilter === 'ACTIVE') statusCondition = `AND d.status = 'ACTIVE' AND d."fromDate" <= NOW() AND d."toDate" >= NOW()`;
    else if (statusFilter === 'UPCOMING') statusCondition = `AND d.status = 'ACTIVE' AND d."fromDate" > NOW()`;
    else if (statusFilter === 'ENDED') statusCondition = `AND (d.status != 'ACTIVE' OR d."toDate" < NOW())`;

    const [items, countRows] = await Promise.all([
      this.prisma.$queryRawUnsafe<Array<{
        id: string; delegatorId: string; delegateId: string; leaveRequestId: string;
        fromDate: Date; toDate: Date; status: string;
        revokedAt: Date | null; revokedBy: string | null; revokeReason: string | null;
        delegatorFirstName: string; delegatorLastName: string;
        delegateFirstName: string; delegateLastName: string;
        delegatorJobTitle: string | null;
      }>>(
        `SELECT d.id, d."delegatorId", d."delegateId", d."leaveRequestId",
                d."fromDate", d."toDate", d.status, d."revokedAt", d."revokedBy", d."revokeReason",
                dr."firstNameAr" AS "delegatorFirstName", dr."lastNameAr" AS "delegatorLastName",
                de."firstNameAr" AS "delegateFirstName", de."lastNameAr" AS "delegateLastName",
                jt."nameAr" AS "delegatorJobTitle"
         FROM users.delegations d
         JOIN users.employees dr ON dr.id = d."delegatorId"
         JOIN users.employees de ON de.id = d."delegateId"
         LEFT JOIN users.job_titles jt ON jt.id = dr."jobTitleId"
         WHERE 1=1 ${statusCondition}
         ORDER BY d."createdAt" DESC
         LIMIT $1 OFFSET $2`,
        safeLimit, skip,
      ),
      this.prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
        `SELECT COUNT(*) as count FROM users.delegations d WHERE 1=1 ${statusCondition}`,
      ),
    ]);

    const total = Number(countRows[0]?.count ?? 0);
    const now = new Date();
    return {
      items: items.map((r) => ({
        id: r.id,
        delegatorId: r.delegatorId,
        delegatorName: `${r.delegatorFirstName} ${r.delegatorLastName}`.trim(),
        delegatorJobTitle: r.delegatorJobTitle,
        delegateId: r.delegateId,
        delegateName: `${r.delegateFirstName} ${r.delegateLastName}`.trim(),
        leaveRequestId: r.leaveRequestId,
        from: r.fromDate,
        to: r.toDate,
        status: this.computeStatus(r.status, r.fromDate, r.toDate, now),
        revokedAt: r.revokedAt,
        revokedBy: r.revokedBy,
        revokeReason: r.revokeReason,
      })),
      page: safePage, limit: safeLimit, total, totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    };
  }

  async revoke(id: string, performedByUserId: string, reason?: string) {
    const rows = await this.prisma.$queryRawUnsafe<Array<{
      id: string; delegatorId: string; delegateId: string; status: string; toDate: Date;
    }>>(
      `SELECT id, "delegatorId", "delegateId", status, "toDate" FROM users.delegations WHERE id = $1`,
      id,
    );
    const delegation = rows[0];
    if (!delegation) throw new NotFoundException({ code: 'DELEGATION_NOT_FOUND', message: 'التفويض غير موجود' });
    if (delegation.status !== 'ACTIVE' || new Date(delegation.toDate) < new Date()) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'هذا التفويض غير فعّال حالياً (منتهٍ أو ملغى مسبقاً)' });
    }

    await this.prisma.$executeRawUnsafe(
      `UPDATE users.delegations
       SET status = 'REVOKED', "revokedAt" = NOW(), "revokedBy" = $2, "revokeReason" = $3, "endNotifiedAt" = NOW(), "updatedAt" = NOW()
       WHERE id = $1`,
      id, performedByUserId, reason ?? null,
    );

    await this.notifyDelegationEnded(delegation.delegatorId, delegation.delegateId);
    return { success: true };
  }

  private async notifyDelegationEnded(delegatorEmployeeId: string, delegateEmployeeId: string) {
    try {
      const rows = await this.prisma.$queryRawUnsafe<Array<{
        id: string; userId: string | null; firstNameAr: string; lastNameAr: string;
      }>>(
        `SELECT id, "userId", "firstNameAr", "lastNameAr" FROM users.employees WHERE id = ANY($1::text[]) AND "deletedAt" IS NULL`,
        [delegatorEmployeeId, delegateEmployeeId],
      );
      const map = new Map(rows.map((r) => [r.id, r]));
      const delegator = map.get(delegatorEmployeeId);
      const delegate = map.get(delegateEmployeeId);
      if (!delegator || !delegate) return;

      if (delegate.userId) {
        await this.prisma.$executeRawUnsafe(
          `INSERT INTO users.notifications (id, "userId", type, "titleAr", "titleEn", "messageAr", "messageEn", data, "createdAt")
           VALUES (gen_random_uuid()::text, $1, 'GENERAL'::"users"."NotificationType", $2, $2, $3, $3, $4::jsonb, NOW())`,
          delegate.userId, 'انتهى التفويض',
          `انتهى تفويضك نيابة عن ${delegator.firstNameAr} ${delegator.lastNameAr}`,
          JSON.stringify({ type: 'DELEGATION_ENDED', delegatorEmployeeId }),
        );
      }
      if (delegator.userId) {
        await this.prisma.$executeRawUnsafe(
          `INSERT INTO users.notifications (id, "userId", type, "titleAr", "titleEn", "messageAr", "messageEn", data, "createdAt")
           VALUES (gen_random_uuid()::text, $1, 'GENERAL'::"users"."NotificationType", $2, $2, $3, $3, $4::jsonb, NOW())`,
          delegator.userId, 'انتهى التفويض',
          `انتهى تفويضك لـ${delegate.firstNameAr} ${delegate.lastNameAr}`,
          JSON.stringify({ type: 'DELEGATION_ENDED', delegateEmployeeId }),
        );
      }
    } catch {
      // لا يكسر عملية الإلغاء
    }
  }
}
