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
      // إجمالي الحالات المسلّمة (كل الفترات)
      this.count(
        `SELECT COUNT(*)::int AS count FROM clinic_prosthetics.prosthetics_cases
         WHERE "deletedAt" IS NULL AND status::text = 'DELIVERED'`,
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
    ]);

    const avg = avgRows?.[0]?.avg;

    return {
      clinic: {
        newPatientsThisMonth,
        newPatientsPreviousMonth,
        openProstheticsCasesByStatus: openByStatus
          ? openByStatus.map((r) => ({ status: r.status, count: Number(r.count) }))
          : null,
        prostheticsDeliveredThisMonth,
        prostheticsDeliveredTotal,
        avgDaysIntakeToDelivery: avg == null ? null : Math.round(Number(avg)),
        waitingListCount,
        appointmentsThisMonth,
        appointmentsNoShowThisMonth,
      },
    };
  }
}
