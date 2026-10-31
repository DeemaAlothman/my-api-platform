import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateSourceDto, UpdateSourceDto,
  CreateVisitDto, UpdateVisitDto,
  CreateSpecialtyDto,
  ListSourcesQueryDto,
} from './dto/source.dto';

// تواريخ الجمعية تصل كنص (مثل 2026-10-06) — تُحوَّل لـ Date فقط إذا أُرسلت
const ASSOCIATION_DATE_FIELDS = ['contractDate', 'activationDate', 'contractEndDate'] as const;
function toAssociationDates(dto: CreateSourceDto | UpdateSourceDto) {
  const out: Record<string, Date> = {};
  for (const f of ASSOCIATION_DATE_FIELDS) {
    if (typeof dto[f] === 'string') out[f] = new Date(dto[f] as string);
  }
  return out;
}

@Injectable()
export class SourcesService {
  constructor(private prisma: PrismaService) {}

  // ── Sources ───────────────────────────────────────────────────────

  // ── Specialties ───────────────────────────────────────────────────

  async getSpecialties() {
    return this.prisma.referralSpecialty.findMany({ orderBy: { name: 'asc' } });
  }

  async addSpecialty(dto: CreateSpecialtyDto) {
    const name = dto.name.trim();
    const existing = await this.prisma.referralSpecialty.findUnique({ where: { name } });
    if (existing) throw new ConflictException('التخصص موجود مسبقاً');
    return this.prisma.referralSpecialty.create({ data: { name, isCustom: true } });
  }

  // ── Sources ───────────────────────────────────────────────────────

  async create(dto: CreateSourceDto, userId: string) {
    const duplicate = await this.prisma.referralSource.findFirst({
      where: {
        deletedAt: null,
        name: { equals: dto.name.trim(), mode: 'insensitive' },
      },
      select: { id: true },
    });
    if (duplicate) throw new ConflictException('يوجد مصدر إحالة بنفس الاسم مسبقاً');

    // الجمعية بدون مدينة تبقى null — المدينة الافتراضية "حلب" لباقي الأنواع فقط
    const defaultCity = dto.type === 'ASSOCIATION' ? null : 'حلب';
    return this.prisma.referralSource.create({
      data: { ...dto, ...toAssociationDates(dto), city: dto.city ?? defaultCity, createdBy: userId },
    });
  }

  // إجمالي المرضى لكل نوع مصدر (طبيب/مشفى/جمعية/أخرى) — عبر كل المصادر غير المحذوفة من هداك
  // النوع، بغض النظر عن أي فلتر صفحة حالي، لحتى تصير نسبة كل مصدر مقارنة بكامل نوعه
  private async getTypeTotals(): Promise<Map<string, number>> {
    const rows = await this.prisma.$queryRaw<Array<{ type: string; count: bigint }>>`
      SELECT rs.type, COUNT(p.id)::int AS count
      FROM referrals.referral_sources rs
      LEFT JOIN clinic_patients.patients p
        ON p."referralSourceId" = rs.id AND p."deletedAt" IS NULL
      WHERE rs."deletedAt" IS NULL
      GROUP BY rs.type
    `;
    return new Map(rows.map((r) => [r.type, Number(r.count)]));
  }

  private densityPercent(count: number, typeTotal: number): number {
    if (typeTotal <= 0) return 0;
    return Math.round((count / typeTotal) * 1000) / 10;
  }

  async findAll(query: ListSourcesQueryDto) {
    const page  = Math.max(1, query.page  || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip  = (page - 1) * limit;

    const where: any = { deletedAt: null };
    if (query.type)   where.type = query.type;
    if (query.search) {
      where.OR = [
        { name:      { contains: query.search, mode: 'insensitive' } },
        { specialty: { contains: query.search, mode: 'insensitive' } },
        { city:      { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [items, total, typeTotals] = await Promise.all([
      this.prisma.referralSource.findMany({
        where,
        include: { _count: { select: { visits: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.referralSource.count({ where }),
      this.getTypeTotals(),
    ]);

    // كثافة الحالات = عدد المرضى المنسوبين لكل مصدر فعلياً (محسوبة، مختلفة عن patientDensityRating
    // اليدوي الموجود أصلاً بالسجل — هاد رقم حقيقي من جدول المرضى، مش تقييم شخصي من 1-5).
    // densityPercent = نسبة هالمصدر من إجمالي مرضى نوعه (طبيب مقابل باقي الأطباء، إلخ)
    const ids = items.map((s) => s.id);
    const countsMap = new Map<string, number>();
    if (ids.length) {
      const counts = await this.prisma.$queryRawUnsafe<Array<{ referralSourceId: string; count: bigint }>>(
        `SELECT "referralSourceId", COUNT(*) as count
         FROM clinic_patients.patients
         WHERE "referralSourceId" = ANY($1::text[]) AND "deletedAt" IS NULL
         GROUP BY "referralSourceId"`,
        ids,
      );
      for (const c of counts) countsMap.set(c.referralSourceId, Number(c.count));
    }

    return {
      items: items.map((s) => {
        const count = countsMap.get(s.id) ?? 0;
        return { ...s, patientCount: count, densityPercent: this.densityPercent(count, typeTotals.get(s.type) ?? 0) };
      }),
      page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async findOne(id: string) {
    const source = await this.prisma.referralSource.findFirst({
      where: { id, deletedAt: null },
      include: {
        visits: { orderBy: { visitDate: 'desc' } },
        _count: { select: { visits: true } },
      },
    });
    if (!source) throw new NotFoundException('مصدر الإحالة غير موجود');

    const [countRows, realRows, typeTotals] = await Promise.all([
      this.prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count FROM clinic_patients.patients
        WHERE "referralSourceId" = ${id} AND "deletedAt" IS NULL
      `,
      // نفس شرط "المبيعات"/المرضى الفعليين المستخدم بـgetPatientCount وgetPatients(realOnly) بالضبط
      this.prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(DISTINCT p.id) as count
        FROM clinic_patients.patients p
        WHERE p."referralSourceId" = ${id}
          AND p."deletedAt" IS NULL
          AND (
            EXISTS (
              SELECT 1 FROM clinic_physio.physio_cases pc
              WHERE pc."patientId" = p.id AND pc."deletedAt" IS NULL AND pc."caseType" = 'PHYSIO'
            )
            OR EXISTS (
              SELECT 1 FROM clinic_prosthetics.prosthetics_cases prc
              WHERE prc."patientId" = p.id AND prc."deletedAt" IS NULL
            )
            OR EXISTS (
              SELECT 1 FROM clinic_podiatry.podiatry_receptions por
              WHERE por."patientId" = p.id
            )
          )
      `,
      this.getTypeTotals(),
    ]);
    const patientCount = Number(countRows[0]?.count ?? 0);
    const realPatientCount = Number(realRows[0]?.count ?? 0);

    return {
      ...source,
      patientCount,
      realPatientCount,
      sales: realPatientCount,
      densityPercent: this.densityPercent(patientCount, typeTotals.get(source.type) ?? 0),
    };
  }

  async update(id: string, dto: UpdateSourceDto) {
    await this.findOne(id);
    return this.prisma.referralSource.update({
      where: { id },
      data: { ...dto, ...toAssociationDates(dto) },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.referralSource.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { message: 'تم حذف مصدر الإحالة' };
  }

  // ── Stats ─────────────────────────────────────────────────────────

  async getPatientCount(sourceId: string) {
    await this.findOne(sourceId);

    const [totalRows, realRows] = await Promise.all([
      this.prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count
        FROM clinic_patients.patients
        WHERE "referralSourceId" = ${sourceId}
          AND "deletedAt" IS NULL
      `,
      this.prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(DISTINCT p.id) as count
        FROM clinic_patients.patients p
        WHERE p."referralSourceId" = ${sourceId}
          AND p."deletedAt" IS NULL
          AND (
            EXISTS (
              SELECT 1 FROM clinic_physio.physio_cases pc
              WHERE pc."patientId" = p.id
                AND pc."deletedAt" IS NULL
                AND pc."caseType" = 'PHYSIO'
            )
            OR EXISTS (
              SELECT 1 FROM clinic_prosthetics.prosthetics_cases prc
              WHERE prc."patientId" = p.id
                AND prc."deletedAt" IS NULL
            )
            OR EXISTS (
              SELECT 1 FROM clinic_podiatry.podiatry_receptions por
              WHERE por."patientId" = p.id
            )
          )
      `,
    ]);

    return {
      sourceId,
      patientCount:     Number(totalRows[0].count),
      realPatientCount: Number(realRows[0].count),
      // "المبيعات" — اسم بديل لنفس realPatientCount، أضفناه بدل استبداله حتى ما ينكسر أي استدعاء قديم
      sales: Number(realRows[0].count),
    };
  }

  // المرضى المنسوبين لهاد المصدر — قائمة فعلية، مش عدّاد بس (مختلفة عن getPatientCount)
  // realOnly=true: يقتصر على "المبيعات" الفعلية فقط (نفس شرط realPatientCount بالأعلى بالضبط) —
  // هاد يلي بيُستخدم لما تكبسي على رقم "المبيعات" لتشوفي أسماءهم بالتحديد
  // dateFrom/dateTo: فلترة على نفس referredAt (createdAt)، كل واحد يشتغل لحاله، واليومين داخلين
  // بالنتيجة (dateTo لآخر اليوم) — تشتغل مع realOnly والـpagination سوا، total بعد كل الفلاتر
  async getPatients(
    sourceId: string, page = 1, limit = 20, realOnly = false,
    dateFrom?: string, dateTo?: string,
  ) {
    await this.findOne(sourceId);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const safePage = Math.max(1, page);
    const skip = (safePage - 1) * safeLimit;

    // ⚠️ لازم alias "p" صريح على الجدول الخارجي — بدونه، الـid جوا كل EXISTS كان عم ينحل على
    // id الجدول الداخلي نفسه (physio_cases.id مثلاً) بدل patients.id، فالشرط ما كان يتحقق أبداً
    // وrealOnly=true كان يرجع صفر دايماً مهما كانت البيانات. نفس الشرط بالضبط المستخدم بباقي
    // الأماكن (findOne, getPatientCount, getStats) — هلأ موحَّد بكل مكان.
    const realCondition = realOnly ? `
      AND (
        EXISTS (SELECT 1 FROM clinic_physio.physio_cases pc WHERE pc."patientId" = p.id AND pc."deletedAt" IS NULL AND pc."caseType" = 'PHYSIO')
        OR EXISTS (SELECT 1 FROM clinic_prosthetics.prosthetics_cases prc WHERE prc."patientId" = p.id AND prc."deletedAt" IS NULL)
        OR EXISTS (SELECT 1 FROM clinic_podiatry.podiatry_receptions por WHERE por."patientId" = p.id)
      )
    ` : '';

    const dateFromStart = dateFrom ? new Date(`${dateFrom}T00:00:00.000Z`) : null;
    const dateToEnd = dateTo ? new Date(`${dateTo}T23:59:59.999Z`) : null;

    const [items, totalRows] = await Promise.all([
      this.prisma.$queryRawUnsafe<Array<{
        id: string; patientNumber: string; firstName: string; lastName: string;
        phone: string; createdAt: Date;
      }>>(
        `SELECT p.id, p."patientNumber", p."firstName", p."lastName", p.phone, p."createdAt"
         FROM clinic_patients.patients p
         WHERE p."referralSourceId" = $1 AND p."deletedAt" IS NULL ${realCondition}
           AND ($4::timestamp IS NULL OR p."createdAt" >= $4)
           AND ($5::timestamp IS NULL OR p."createdAt" <= $5)
         ORDER BY p."createdAt" DESC
         LIMIT $2 OFFSET $3`,
        sourceId, safeLimit, skip, dateFromStart, dateToEnd,
      ),
      this.prisma.$queryRawUnsafe<{ count: bigint }[]>(
        `SELECT COUNT(*) as count FROM clinic_patients.patients p
         WHERE p."referralSourceId" = $1 AND p."deletedAt" IS NULL ${realCondition}
           AND ($2::timestamp IS NULL OR p."createdAt" >= $2)
           AND ($3::timestamp IS NULL OR p."createdAt" <= $3)`,
        sourceId, dateFromStart, dateToEnd,
      ),
    ]);

    const total = Number(totalRows[0]?.count ?? 0);
    return {
      items: items.map((p) => ({
        id: p.id,
        patientNumber: p.patientNumber,
        name: `${p.firstName} ${p.lastName}`,
        phone: p.phone,
        referredAt: p.createdAt,
      })),
      page: safePage, limit: safeLimit, total, totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    };
  }

  async getStats() {
    const [byType, topSources, totalCounts, realCounts, totalVisitsRow] = await Promise.all([
      this.prisma.referralSource.groupBy({
        by: ['type'],
        where: { deletedAt: null },
        _count: { id: true },
      }),
      this.prisma.referralSource.findMany({
        where: { deletedAt: null },
        include: { _count: { select: { visits: true } } },
        orderBy: { visits: { _count: 'desc' } },
        take: 10,
      }),
      // إجمالي المرضى لكل مصدر
      this.prisma.$queryRaw<{ referralSourceId: string; count: bigint }[]>`
        SELECT "referralSourceId", COUNT(*) as count
        FROM clinic_patients.patients
        WHERE "referralSourceId" IS NOT NULL
          AND "deletedAt" IS NULL
        GROUP BY "referralSourceId"
      `,
      // المرضى الفعليين (دخلوا خدمة حقيقية)
      this.prisma.$queryRaw<{ referralSourceId: string; count: bigint }[]>`
        SELECT p."referralSourceId", COUNT(DISTINCT p.id) as count
        FROM clinic_patients.patients p
        WHERE p."referralSourceId" IS NOT NULL
          AND p."deletedAt" IS NULL
          AND (
            EXISTS (
              SELECT 1 FROM clinic_physio.physio_cases pc
              WHERE pc."patientId" = p.id
                AND pc."deletedAt" IS NULL
                AND pc."caseType" = 'PHYSIO'
            )
            OR EXISTS (
              SELECT 1 FROM clinic_prosthetics.prosthetics_cases prc
              WHERE prc."patientId" = p.id
                AND prc."deletedAt" IS NULL
            )
            OR EXISTS (
              SELECT 1 FROM clinic_podiatry.podiatry_receptions por
              WHERE por."patientId" = p.id
            )
          )
        GROUP BY p."referralSourceId"
      `,
      this.prisma.referralVisit.count(),
    ]);

    const totalMap = new Map(totalCounts.map(r => [r.referralSourceId, Number(r.count)]));
    const realMap  = new Map(realCounts.map(r  => [r.referralSourceId, Number(r.count)]));

    const topSourcesWithCounts = topSources.map(s => ({
      ...s,
      patientCount:     totalMap.get(s.id) ?? 0,
      realPatientCount: realMap.get(s.id)  ?? 0,
      sales:            realMap.get(s.id)  ?? 0, // اسم بديل لـrealPatientCount — "المبيعات"
    }));

    // ── إضافات: ملخص عام + ترتيب لكل نوع + زيارات الفريق هذا الشهر + اتجاه شهري ──────────
    // كل هاي الحقول إضافية جنب يلي فوق، ما بتلغي ولا توحدة منهم
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const allSources = await this.prisma.referralSource.findMany({
      where: { deletedAt: null },
      select: { id: true, type: true, name: true, doctorRating: true, clinicRating: true },
    });
    const sourceIds = allSources.map((s) => s.id);

    const [monthCounts, visitCountsAll, visitCountsThisMonth] = await Promise.all([
      sourceIds.length
        ? this.prisma.$queryRawUnsafe<Array<{ referralSourceId: string; count: bigint }>>(
            `SELECT "referralSourceId", COUNT(*) as count
             FROM clinic_patients.patients
             WHERE "referralSourceId" = ANY($1::text[]) AND "deletedAt" IS NULL
               AND "createdAt" >= $2 AND "createdAt" < $3
             GROUP BY "referralSourceId"`,
            sourceIds, thisMonthStart, nextMonthStart,
          )
        : Promise.resolve([] as Array<{ referralSourceId: string; count: bigint }>),
      this.prisma.referralVisit.groupBy({ by: ['sourceId'], _count: { id: true } }),
      this.prisma.referralVisit.groupBy({
        by: ['sourceId'],
        where: { visitDate: { gte: thisMonthStart, lt: nextMonthStart } },
        _count: { id: true },
      }),
    ]);

    const monthMap = new Map(monthCounts.map((r) => [r.referralSourceId, Number(r.count)]));
    const visitMap = new Map(visitCountsAll.map((r) => [r.sourceId, r._count.id]));
    const teamVisitsThisMonth = visitCountsThisMonth.reduce((sum, r) => sum + r._count.id, 0);

    // إجمالي مرضى كل نوع، لحساب نسبة الكثافة لكل مصدر ضمن نوعه فقط
    const typeTotals = new Map<string, number>();
    for (const s of allSources) {
      typeTotals.set(s.type, (typeTotals.get(s.type) ?? 0) + (totalMap.get(s.id) ?? 0));
    }

    const enriched = allSources.map((s) => {
      const patientCount = totalMap.get(s.id) ?? 0;
      const typeTotal = typeTotals.get(s.type) ?? 0;
      return {
        id: s.id,
        name: s.name,
        type: s.type,
        rating: s.doctorRating ?? s.clinicRating ?? null,
        patientCount,
        densityPercent: this.densityPercent(patientCount, typeTotal),
        referralsThisMonth: monthMap.get(s.id) ?? 0,
        visitCount: visitMap.get(s.id) ?? 0,
      };
    });

    const byTypeList = (type: string) => enriched.filter((e) => e.type === type);
    const topByDensity = (type: string) =>
      byTypeList(type).slice().sort((a, b) => b.densityPercent - a.densityPercent)[0] ?? null;
    const top10ThisMonth = (type: string) =>
      byTypeList(type).slice().sort((a, b) => b.referralsThisMonth - a.referralsThisMonth).slice(0, 10);

    const withRating = enriched.filter((e) => e.rating != null);
    const topRating = withRating.length
      ? withRating.slice().sort((a, b) => (b.rating as number) - (a.rating as number))[0]
      : null;
    const topCases = enriched.length ? enriched.slice().sort((a, b) => b.patientCount - a.patientCount)[0] : null;
    const topVisits = enriched.length ? enriched.slice().sort((a, b) => b.visitCount - a.visitCount)[0] : null;

    // اتجاه آخر 6 أشهر (إحالات + زيارات)، بدون فجوات — الشهر يلي ما فيه شي بيرجع صفر
    const monthKeys: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    const sixMonthsAgoStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const [referralsTrendRaw, visitsTrendRaw] = await Promise.all([
      this.prisma.$queryRaw<Array<{ month: string; count: bigint }>>`
        SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') as month, COUNT(*)::int as count
        FROM clinic_patients.patients
        WHERE "referralSourceId" IS NOT NULL AND "deletedAt" IS NULL AND "createdAt" >= ${sixMonthsAgoStart}
        GROUP BY month
      `,
      this.prisma.$queryRaw<Array<{ month: string; count: bigint }>>`
        SELECT to_char(date_trunc('month', "visitDate"), 'YYYY-MM') as month, COUNT(*)::int as count
        FROM referrals.referral_visits
        WHERE "visitDate" >= ${sixMonthsAgoStart}
        GROUP BY month
      `,
    ]);
    const referralsTrendMap = new Map(referralsTrendRaw.map((r) => [r.month, Number(r.count)]));
    const visitsTrendMap = new Map(visitsTrendRaw.map((r) => [r.month, Number(r.count)]));
    const monthlyTrend = monthKeys.map((m) => ({
      month: m,
      referrals: referralsTrendMap.get(m) ?? 0,
      visits: visitsTrendMap.get(m) ?? 0,
    }));

    return {
      byType, topSources: topSourcesWithCounts, totalVisits: totalVisitsRow,
      summary: {
        topRating: topRating ? { id: topRating.id, name: topRating.name, type: topRating.type, rating: topRating.rating } : null,
        topCases: topCases ? { id: topCases.id, name: topCases.name, type: topCases.type, patientCount: topCases.patientCount } : null,
        topVisits: topVisits ? { id: topVisits.id, name: topVisits.name, type: topVisits.type, visitCount: topVisits.visitCount } : null,
      },
      byTypeRanking: {
        DOCTOR: { topByDensity: topByDensity('DOCTOR'), top10ThisMonth: top10ThisMonth('DOCTOR') },
        HOSPITAL: { topByDensity: topByDensity('HOSPITAL'), top10ThisMonth: top10ThisMonth('HOSPITAL') },
        ASSOCIATION: { topByDensity: topByDensity('ASSOCIATION'), top10ThisMonth: top10ThisMonth('ASSOCIATION') },
        OTHER: { topByDensity: topByDensity('OTHER'), top10ThisMonth: top10ThisMonth('OTHER') },
      },
      teamVisitsThisMonth,
      monthlyTrend,
    };
  }

  // ── Visits ────────────────────────────────────────────────────────

  async addVisit(sourceId: string, dto: CreateVisitDto, userId: string) {
    await this.findOne(sourceId);
    return this.prisma.referralVisit.create({
      data: {
        sourceId,
        visitType:     dto.visitType as any,
        visitDate:     new Date(dto.visitDate),
        topics:        dto.topics,
        nextVisitDate: dto.nextVisitDate ? new Date(dto.nextVisitDate) : null,
        visitedBy:     userId,
        notes:         dto.notes,
      },
    });
  }

  async getVisits(sourceId: string) {
    await this.findOne(sourceId);
    const visits = await this.prisma.referralVisit.findMany({
      where: { sourceId },
      orderBy: { visitDate: 'desc' },
    });

    const userIds = [...new Set(visits.map(v => v.visitedBy).filter(Boolean))];
    let userMap: Record<string, string> = {};

    if (userIds.length > 0) {
      const placeholders = userIds.map((_, i) => `$${i + 1}`).join(',');
      const rows = (await this.prisma.$queryRawUnsafe(
        `SELECT id, "fullName" FROM users.users WHERE id IN (${placeholders})`,
        ...userIds,
      )) as Array<{ id: string; fullName: string | null }>;
      userMap = Object.fromEntries(rows.map(r => [r.id, r.fullName ?? '']));
    }

    return visits.map(v => ({
      ...v,
      visitedByName: v.visitedBy ? (userMap[v.visitedBy] ?? null) : null,
    }));
  }

  async updateVisit(sourceId: string, visitId: string, dto: UpdateVisitDto) {
    const visit = await this.prisma.referralVisit.findFirst({ where: { id: visitId, sourceId } });
    if (!visit) throw new NotFoundException('الزيارة غير موجودة');
    return this.prisma.referralVisit.update({
      where: { id: visitId },
      data: {
        ...dto,
        ...(dto.visitDate     ? { visitDate:     new Date(dto.visitDate)     } : {}),
        ...(dto.nextVisitDate ? { nextVisitDate: new Date(dto.nextVisitDate) } : {}),
      },
    });
  }

  async deleteVisit(sourceId: string, visitId: string) {
    const visit = await this.prisma.referralVisit.findFirst({ where: { id: visitId, sourceId } });
    if (!visit) throw new NotFoundException('الزيارة غير موجودة');
    await this.prisma.referralVisit.delete({ where: { id: visitId } });
    return { message: 'تم حذف الزيارة' };
  }
}
