import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

/**
 * يجعل الموظف غير نشط عند وصول تاريخ الانفكاك (تاريخ الاستقالة الفعلي) لاستقالة موافَق عليها
 * بتاريخ مستقبلي. يعمل يومياً ويغيّر employmentStatus فقط، ولا يلمس أي موظف آخر:
 * - لازم يكون عنده طلب استقالة APPROVED، ووافقوا عليه قبل تاريخ الانفكاك (أي بتاريخ مستقبلي).
 * - ولم يُعدَّل سجله بعد تاريخ الانفكاك (حماية من إعادة تنشيط يدوية/إعادة توظيف).
 */
@Injectable()
export class ResignationSeparationService {
  private readonly logger = new Logger(ResignationSeparationService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('5 0 * * *', { timeZone: 'Asia/Riyadh' })
  async deactivateSeparatedEmployees() {
    try {
      const rows = await this.prisma.$queryRawUnsafe<Array<{ id: string; employeeNumber: string }>>(`
        UPDATE users.employees e
        SET "employmentStatus" = 'INACTIVE', "updatedAt" = NOW()
        WHERE e."deletedAt" IS NULL
          AND e."employmentStatus" = 'ACTIVE'
          AND e."separationDate" IS NOT NULL
          AND e."separationDate"::date <= (NOW() AT TIME ZONE 'Asia/Riyadh')::date
          AND e."updatedAt" < (e."separationDate"::date + INTERVAL '1 day')
          AND EXISTS (
            SELECT 1 FROM requests.requests r
            WHERE r."employeeId" = e.id
              AND r.type::text = 'RESIGNATION'
              AND r.status::text = 'APPROVED'
              AND (r."updatedAt" AT TIME ZONE 'Asia/Riyadh')::date < e."separationDate"::date
          )
        RETURNING e.id, e."employeeNumber"
      `);
      if (rows.length) {
        this.logger.log(`Deactivated ${rows.length} employee(s) on separation date: ${rows.map((r) => r.employeeNumber).join(', ')}`);
      }
    } catch (e: any) {
      this.logger.error(`Resignation separation job failed: ${e?.message ?? e}`);
    }
  }
}
