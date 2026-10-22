import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

// إشعار مندوبي المبيعات (مسمى وظيفي VTX-JTL-000024) لتعبئة استبيان رضا العميل —
// 10 أيام بعد تاريخ تركيب النعل، مرة واحدة فقط لكل جلسة (محروس بـ surveyNotifiedAt)
@Injectable()
export class SurveyReminderService {
  private readonly logger = new Logger(SurveyReminderService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM, { timeZone: 'Asia/Damascus' })
  async notifyInstalledSessions() {
    const sessions = await this.prisma.podiatrySession.findMany({
      where: {
        installedAt: { lte: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) },
        surveyNotifiedAt: null,
        archivedAt: null,
      } as any,
      select: { id: true, receptionId: true, patientId: true },
    });
    if (sessions.length === 0) return;

    const reps = await this.prisma.$queryRawUnsafe<Array<{ userId: string }>>(
      `SELECT e."userId" FROM users.employees e
       JOIN users.job_titles jt ON jt.id = e."jobTitleId"
       WHERE jt.code = 'VTX-JTL-000024' AND e."deletedAt" IS NULL AND e."userId" IS NOT NULL`,
    ).catch(() => [] as Array<{ userId: string }>);

    for (const session of sessions) {
      if (reps.length > 0) {
        const patientRows = await this.prisma.$queryRawUnsafe<Array<{ firstName: string; lastName: string }>>(
          `SELECT "firstName", "lastName" FROM clinic_patients.patients WHERE id = $1`,
          session.patientId,
        ).catch(() => [] as Array<{ firstName: string; lastName: string }>);
        const patientName = patientRows[0] ? `${patientRows[0].firstName} ${patientRows[0].lastName}` : 'المريض';
        const msgAr = `يرجى تعبئة استبيان رضا العميل للمريض ${patientName} (قسم طب الأقدام)`;
        const data = JSON.stringify({ patientId: session.patientId, department: 'PODIATRY', caseId: session.receptionId });

        for (const rep of reps) {
          await this.prisma.$queryRawUnsafe(
            `INSERT INTO users.notifications
               (id, "userId", type, "titleAr", "titleEn", "messageAr", "messageEn", "isRead", "data", "createdAt")
             VALUES
               (gen_random_uuid(), $1, 'PATIENT_SURVEY_REQUIRED', 'استبيان رضا مطلوب', 'Patient survey required', $2, $2, false, $3::jsonb, NOW())`,
            rep.userId, msgAr, data,
          ).catch(() => {});
        }
      }

      // تُعلَّم الجلسة كمُشعَرة بغض النظر (حتى لو ما في مندوبي مبيعات حالياً) — ما بترجع تُفحص يومياً من جديد
      await this.prisma.podiatrySession.update({
        where: { id: session.id },
        data: { surveyNotifiedAt: new Date() } as any,
      }).catch(() => {});
    }

    this.logger.log(`Survey reminders sent for ${sessions.length} podiatry session(s)`);
  }
}
