import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@shared/auth';
import { PrismaService } from '../prisma/prisma.service';

// أرقام العيادة لداشبورد المدير التنفيذي — قراءة فقط، تجمع المرضى + الأطراف + المواعيد (نفس قاعدة البيانات)
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardDataController {
  constructor(private readonly prisma: PrismaService) {}

  private async count(sql: string, ...params: any[]): Promise<number | null> {
    const rows = await this.prisma
      .$queryRawUnsafe<Array<{ count: number }>>(sql, ...params)
      .catch(() => null);
    return rows ? Number(rows[0]?.count ?? 0) : null;
  }

  @Get('data')
  async getData(@Query('role') role: string) {
    if (role !== 'CEO') return {};

    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 86_400_000);

    // مرضى جداد هذا الشهر — لازم معرّفاتهم لتوزيعهم حسب القسم تحتهم
    const newPatientsThisMonthIds = await this.prisma.patient.findMany({
      where: { deletedAt: null, createdAt: { gte: thisMonthStart } },
      select: { id: true },
    }).then((rows) => rows.map((r) => r.id));

    const [
      newPatientsThisMonth,
      newPatientsPreviousMonth,
      openByStatus,
      prostheticsDeliveredThisMonth,
      prostheticsDeliveredTotal,
      avgRows,
      waitingListCount,
      appointmentsThisMonth,
      appointmentsNoShowThisMonth,
      podiatryReceptionsTotal,
      podiatryInsolesFittedTotal,
      podiatryInsolesFittedThisMonth,
      podiatryReceptionsThisMonth,
      podiatryNotFittedThisMonth,
      newPatientsThisMonthProsthetics,
      newPatientsThisMonthPhysio,
      newPatientsThisMonthOrthotics,
      newPatientsThisMonthPodiatry,
      newPatientsThisMonthDoctorExamination,
      appointmentsThisMonthByStatusRaw,
      committeeReviewByDecisionRaw,
    ] = await Promise.all([
      this.prisma.patient.count({ where: { deletedAt: null, createdAt: { gte: thisMonthStart } } }),
      this.prisma.patient.count({ where: { deletedAt: null, createdAt: { gte: prevMonthStart, lt: thisMonthStart } } }),
      // الحالات غير المسلّمة وغير الملغاة، مجمّعة حسب المرحلة
      this.prisma.$queryRawUnsafe<Array<{ status: string; count: number }>>(
        `SELECT status::text AS status, COUNT(*)::int AS count
         FROM clinic_prosthetics.prosthetics_cases
         WHERE "deletedAt" IS NULL AND status::text NOT IN ('DELIVERED', 'CANCELLED')
         GROUP BY status ORDER BY count DESC`,
      ).catch(() => null),
      // التسليم = إنشاء نموذج التسليم النهائي (هو يلي بيحوّل الحالة لـDELIVERED)
      this.count(
        `SELECT COUNT(*)::int AS count
         FROM clinic_prosthetics.final_delivery_forms fd
         JOIN clinic_prosthetics.prosthetics_cases c ON c.id = fd."caseId"
         WHERE c."deletedAt" IS NULL AND fd."createdAt" >= $1 AND fd."createdAt" < $2`,
        thisMonthStart, nextMonthStart,
      ),
      // إجمالي الحالات المسلّمة (كل الفترات) — بنفس تعريف الرقم الشهري أعلاه بالضبط:
      // عندها نموذج تسليم نهائي، بغض النظر عن مرحلتها الحالية (حتى لو صارت متابعة لاحقاً).
      // قبل كان يعدّ status='DELIVERED' فقط، فكانت الحالات اللي انتقلت لـFOLLOW_UP تختفي من
      // العدد الكلي بينما تبقى محسوبة بعدد "هذا الشهر" — ما كان يصير الكلي أصغر من الشهري بالغلط
      this.count(
        `SELECT COUNT(*)::int AS count
         FROM clinic_prosthetics.prosthetics_cases c
         JOIN clinic_prosthetics.final_delivery_forms fd ON fd."caseId" = c.id
         WHERE c."deletedAt" IS NULL`,
      ),
      this.prisma.$queryRawUnsafe<Array<{ avg: number | null }>>(
        `SELECT AVG(EXTRACT(EPOCH FROM (fd."createdAt" - c."createdAt")) / 86400)::float AS avg
         FROM clinic_prosthetics.final_delivery_forms fd
         JOIN clinic_prosthetics.prosthetics_cases c ON c.id = fd."caseId"
         WHERE c."deletedAt" IS NULL AND fd."createdAt" >= $1`,
        ninetyDaysAgo,
      ).catch(() => null),
      this.count(
        `SELECT COUNT(*)::int AS count FROM clinic_appointments.waiting_list_entries WHERE status::text = 'WAITING'`,
      ),
      // مواعيد الشهر الحالي ما عدا الملغاة
      this.count(
        `SELECT COUNT(*)::int AS count FROM clinic_appointments.appointments
         WHERE "startTime" >= $1 AND "startTime" < $2 AND status::text <> 'CANCELLED'`,
        thisMonthStart, nextMonthStart,
      ),
      this.count(
        `SELECT COUNT(*)::int AS count FROM clinic_appointments.appointments
         WHERE "startTime" >= $1 AND "startTime" < $2 AND status::text = 'NO_SHOW'`,
        thisMonthStart, nextMonthStart,
      ),
      // طب الأقدام — نعال: الحالة "مركّبة" إذا عندها جلسة واحدة ع الأقل installedAt مش فاضي
      this.count(
        `SELECT COUNT(*)::int AS count FROM clinic_podiatry.podiatry_receptions`,
      ),
      this.count(
        `SELECT COUNT(DISTINCT r.id)::int AS count
         FROM clinic_podiatry.podiatry_receptions r
         JOIN clinic_podiatry.podiatry_sessions s ON s."receptionId" = r.id
         WHERE s."installedAt" IS NOT NULL`,
      ),
      // عدد الحالات (استقبالات) المركَّبة هالشهر — DISTINCT على الاستقبال نفس منطق الإجمالي
      // أعلاه بالضبط. قبل كان يعدّ سطور الجلسات (podiatry_sessions) مباشرة بدون DISTINCT،
      // فلو استقبال واحد عنده أكثر من جلسة تركيب (إعادة تركيب) بنفس الشهر كان يُحسب أكتر من مرة
      this.count(
        `SELECT COUNT(DISTINCT r.id)::int AS count
         FROM clinic_podiatry.podiatry_receptions r
         JOIN clinic_podiatry.podiatry_sessions s ON s."receptionId" = r.id
         WHERE s."installedAt" >= $1 AND s."installedAt" < $2`,
        thisMonthStart, nextMonthStart,
      ),
      // استقبالات طب الأقدام يلي انفتحت هالشهر
      this.count(
        `SELECT COUNT(*)::int AS count FROM clinic_podiatry.podiatry_receptions
         WHERE "createdAt" >= $1 AND "createdAt" < $2`,
        thisMonthStart, nextMonthStart,
      ),
      // من استقبالات هالشهر، يلي لسا ما انركّب فيها ضبان لحد الآن (مش محصور بوقت التركيب)
      this.count(
        `SELECT COUNT(*)::int AS count
         FROM clinic_podiatry.podiatry_receptions r
         WHERE r."createdAt" >= $1 AND r."createdAt" < $2
           AND NOT EXISTS (
             SELECT 1 FROM clinic_podiatry.podiatry_sessions s
             WHERE s."receptionId" = r.id AND s."installedAt" IS NOT NULL
           )`,
        thisMonthStart, nextMonthStart,
      ),
      // توزيع مرضى هذا الشهر حسب القسم — كل عدّاد مستقل (نفس المريض ممكن يظهر بأكثر من قسم)
      newPatientsThisMonthIds.length === 0 ? 0 : this.count(
        `SELECT COUNT(DISTINCT "patientId")::int AS count
         FROM clinic_prosthetics.prosthetics_cases
         WHERE "deletedAt" IS NULL AND "patientId" = ANY($1::text[])`,
        newPatientsThisMonthIds,
      ),
      newPatientsThisMonthIds.length === 0 ? 0 : this.count(
        `SELECT COUNT(DISTINCT "patientId")::int AS count
         FROM clinic_physio.physio_cases
         WHERE "deletedAt" IS NULL AND "patientId" = ANY($1::text[])`,
        newPatientsThisMonthIds,
      ),
      newPatientsThisMonthIds.length === 0 ? 0 : this.count(
        `SELECT COUNT(DISTINCT "patientId")::int AS count
         FROM clinic_orthotics.orthotics_receptions
         WHERE "patientId" = ANY($1::text[])`,
        newPatientsThisMonthIds,
      ),
      newPatientsThisMonthIds.length === 0 ? 0 : this.count(
        `SELECT COUNT(DISTINCT "patientId")::int AS count
         FROM clinic_podiatry.podiatry_receptions
         WHERE "patientId" = ANY($1::text[])`,
        newPatientsThisMonthIds,
      ),
      newPatientsThisMonthIds.length === 0 ? 0 : this.count(
        `SELECT COUNT(DISTINCT "patientId")::int AS count
         FROM clinic_appointments.appointments
         WHERE "appointmentType"::text = 'EXAMINATION' AND "patientId" = ANY($1::text[])`,
        newPatientsThisMonthIds,
      ),
      // توزيع مواعيد هذا الشهر حسب الحالة — خام هون، نجمّعها بالدلاء بالأسفل
      this.prisma.$queryRawUnsafe<Array<{ status: string; count: number }>>(
        `SELECT status::text AS status, COUNT(*)::int AS count
         FROM clinic_appointments.appointments
         WHERE "startTime" >= $1 AND "startTime" < $2
         GROUP BY status`,
        thisMonthStart, nextMonthStart,
      ).catch(() => null),
      // تقسيم حالات "تمت المعاينة" (COMMITTEE_REVIEW) حسب قرار اللجنة — NEEDS_ADJUSTMENT وبدون
      // قرار بعد يُحسبان "pending" (لسا ما تحسم الحالة نهائياً)
      this.prisma.$queryRawUnsafe<Array<{ bucket: string; count: number }>>(
        `SELECT
           CASE
             WHEN cr."finalDecision"::text = 'APPROVED' THEN 'suitable'
             WHEN cr."finalDecision"::text = 'REJECTED' THEN 'notSuitable'
             ELSE 'pending'
           END AS bucket,
           COUNT(*)::int AS count
         FROM clinic_prosthetics.prosthetics_cases c
         LEFT JOIN clinic_prosthetics.committee_reviews cr ON cr."caseId" = c.id
         WHERE c."deletedAt" IS NULL AND c.status::text = 'COMMITTEE_REVIEW'
         GROUP BY bucket`,
      ).catch(() => null),
    ]);

    const avg = avgRows?.[0]?.avg;

    // تجميع حالات المواعيد بالدلاء المطلوبة — upcoming يشمل RESCHEDULED لأنه موعد مؤجَّل
    // لمستقبل لسا ما صار، مش نتيجة نهائية متل الحضور/الغياب/الإلغاء/الاعتذار
    const apptStatusCount = (status: string) =>
      appointmentsThisMonthByStatusRaw?.find((r) => r.status === status)?.count ?? 0;
    const appointmentsThisMonthByStatus = appointmentsThisMonthByStatusRaw ? {
      completed: apptStatusCount('COMPLETED'),
      noShow: apptStatusCount('NO_SHOW'),
      cancelled: apptStatusCount('CANCELLED'),
      apologized: apptStatusCount('APOLOGIZED'),
      upcoming: apptStatusCount('SCHEDULED') + apptStatusCount('CONFIRMED')
        + apptStatusCount('LATE') + apptStatusCount('RESCHEDULED'),
    } : null;

    const committeeBucketCount = (bucket: string) =>
      committeeReviewByDecisionRaw?.find((r) => r.bucket === bucket)?.count ?? 0;
    const committeeReviewByDecision = committeeReviewByDecisionRaw ? {
      suitable: committeeBucketCount('suitable'),
      notSuitable: committeeBucketCount('notSuitable'),
      pending: committeeBucketCount('pending'),
    } : null;

    return {
      clinic: {
        newPatientsThisMonth,
        newPatientsPreviousMonth,
        // توزيع مرضى هذا الشهر حسب القسم — عدّادات مستقلة، ممكن تتقاطع (نفس المريض بأكثر من قسم)
        newPatientsThisMonthByDepartment: {
          prosthetics: newPatientsThisMonthProsthetics,
          physio: newPatientsThisMonthPhysio,
          orthotics: newPatientsThisMonthOrthotics,
          podiatry: newPatientsThisMonthPodiatry,
          doctorExamination: newPatientsThisMonthDoctorExamination,
        },
        openProstheticsCasesByStatus: openByStatus
          ? openByStatus.map((r) => ({ status: r.status, count: Number(r.count) }))
          : null,
        prostheticsDeliveredThisMonth,
        prostheticsDeliveredTotal,
        avgDaysIntakeToDelivery: avg == null ? null : Math.round(Number(avg)),
        waitingListCount,
        appointmentsThisMonth,
        appointmentsNoShowThisMonth,
        appointmentsThisMonthByStatus,
        committeeReviewByDecision,
        podiatryReceptionsTotal,
        podiatryInsolesFittedTotal,
        podiatryNotFittedTotal: (podiatryReceptionsTotal == null || podiatryInsolesFittedTotal == null)
          ? null
          : podiatryReceptionsTotal - podiatryInsolesFittedTotal,
        podiatryInsolesFittedThisMonth,
        podiatryReceptionsThisMonth,
        podiatryNotFittedThisMonth,
      },
    };
  }
}
