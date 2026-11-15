import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { BaileysClientService } from './baileys-client.service';

interface PendingNotification {
  id: string;
  userId: string;
  titleAr: string | null;
  messageAr: string | null;
}

@Injectable()
export class NotificationWatcherCron {
  private readonly logger = new Logger(NotificationWatcherCron.name);

  // نقطة بداية ثابتة لحظة إقلاع الخدمة — أي إشعار قديم اتسجّل قبلها (كل الأرشيف التاريخي)
  // ما بينبعت إطلاقاً، حتى ما تنطلق دفعة ضخمة من الرسائل فجأة أول ما نربط الرقم (خطر حظر
  // حقيقي). أول مرة نشتغل بعد الربط، بيبلّش الإرسال بس من هالنقطة وطالع
  private readonly startedAt = new Date();

  constructor(
    private readonly prisma: PrismaService,
    private readonly baileys: BaileysClientService,
  ) {}

  // كل 20 ثانية — يفحص أي إشعار جديد بجدول users.notifications (من أي خدمة بالنظام) لسا
  // ما انبعت عبر واتساب، وبيبعته لمين عنده رقم هاتف مسجَّل. قراءة من users.notifications
  // بس (صفر تعديل عليه)، وكتابة بجدول whatsapp.whatsapp_logs الجديد فقط
  @Cron('*/20 * * * * *')
  async pollAndSend() {
    const status = this.baileys.getStatus();
    if (!status.connected) return; // ما في اتصال واتساب فعّال — نحاول بالدورة الجاية

    let pending: PendingNotification[];
    try {
      pending = await this.prisma.$queryRawUnsafe<PendingNotification[]>(
        `SELECT n.id, n."userId", n."titleAr", n."messageAr"
         FROM users.notifications n
         WHERE n."createdAt" >= $1
           AND NOT EXISTS (
             SELECT 1 FROM whatsapp.whatsapp_logs wl WHERE wl."notificationId" = n.id
           )
         ORDER BY n."createdAt" ASC
         LIMIT 50`,
        this.startedAt,
      );
    } catch (err) {
      this.logger.error(`fetch pending notifications failed: ${(err as any)?.message}`);
      return;
    }
    if (!pending.length) return;

    const userIds = [...new Set(pending.map((p) => p.userId))];
    const employees = await this.prisma.$queryRawUnsafe<Array<{ userId: string; phone: string | null }>>(
      `SELECT "userId", phone FROM users.employees WHERE "userId" = ANY($1::text[]) AND "deletedAt" IS NULL`,
      userIds,
    );
    const phoneMap = new Map(employees.map((e) => [e.userId, e.phone]));

    for (const n of pending) {
      const phone = phoneMap.get(n.userId);
      try {
        if (!phone) {
          await this.prisma.whatsAppLog.create({
            data: { notificationId: n.id, userId: n.userId, phone: null, status: 'SKIPPED_NO_PHONE' },
          });
          continue;
        }
        const text = [n.titleAr, n.messageAr].filter(Boolean).join('\n');
        await this.baileys.sendText(phone, text);
        await this.prisma.whatsAppLog.create({
          data: { notificationId: n.id, userId: n.userId, phone, status: 'SENT', sentAt: new Date() },
        });
      } catch (err) {
        await this.prisma.whatsAppLog
          .create({
            data: {
              notificationId: n.id,
              userId: n.userId,
              phone: phone ?? null,
              status: 'FAILED',
              errorMessage: (err as any)?.message ?? 'unknown error',
            },
          })
          .catch(() => {
            /* سباق نادر (دورتين بنفس الوقت) — تجاهل، الصف الفريد موجود أصلاً */
          });
      }
    }
  }
}
