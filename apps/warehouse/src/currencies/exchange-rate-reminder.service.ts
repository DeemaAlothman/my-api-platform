import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

// تذكير يومي للمدير المالي (صلاحية requests:cfo-approve) لو ما أُدخل سعر صرف اليوم بعد
// لأي عملة غير عملة الأساس. الإدخال يضل يدوياً بقرار صريح — لا يوجد مصدر API مجاني وموثوق
// لسعر السوق الموازي لليرة السورية (الأسعار الرسمية بعيدة جداً عن سعر السوق الفعلي).
@Injectable()
export class ExchangeRateReminderService {
  private readonly logger = new Logger(ExchangeRateReminderService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM, { timeZone: 'Asia/Damascus' })
  async remindIfTodayRateMissing() {
    const nonBaseCurrencies = await this.prisma.currency.findMany({ where: { isBaseCurrency: false } });
    if (nonBaseCurrencies.length === 0) return;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    const missing: string[] = [];
    for (const currency of nonBaseCurrencies) {
      const todayRate = await this.prisma.exchangeRate.findFirst({
        where: { currencyId: currency.id, effectiveFrom: { gte: todayStart, lt: tomorrowStart } },
      });
      if (!todayRate) missing.push(currency.code);
    }
    if (missing.length === 0) return;

    const cfoUsers = await this.prisma.$queryRaw<Array<{ userId: string }>>`
      SELECT DISTINCT u.id as "userId"
      FROM users.users u
      JOIN users.user_roles ur ON ur."userId" = u.id
      JOIN users.role_permissions rp ON rp."roleId" = ur."roleId"
      JOIN users.permissions p ON p.id = rp."permissionId"
      WHERE p.name = 'requests:cfo-approve' AND u.status = 'ACTIVE'
    `.catch(() => [] as Array<{ userId: string }>);
    if (cfoUsers.length === 0) return;

    const msgAr = `لم يتم إدخال سعر الصرف لليوم بعد للعملات: ${missing.join('، ')} — يرجى تسجيله قبل إنشاء فواتير/عروض أسعار بهذه العملات`;
    for (const { userId } of cfoUsers) {
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO users.notifications (id, "userId", type, "titleAr", "titleEn", "messageAr", "messageEn", data, "createdAt")
         VALUES (gen_random_uuid()::text, $1, 'GENERAL'::"users"."NotificationType", $2, $2, $3, $3, $4::jsonb, NOW())`,
        userId,
        'تذكير: سعر الصرف اليومي',
        msgAr,
        JSON.stringify({ type: 'EXCHANGE_RATE_REMINDER', missingCurrencies: missing }),
      ).catch(() => {});
    }
    this.logger.log(`Exchange rate reminder sent for: ${missing.join(', ')}`);
  }
}
