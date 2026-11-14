import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSurveyDto } from './dto/create-survey.dto';

@Injectable()
export class SurveysService {
  constructor(private readonly prisma: PrismaService) {}

  // يجيب آخر حالة غير محذوفة للمريض بهداك القسم + قائمة المعالجين المسؤولين عنها حالياً.
  // لو ما في حالة أصلاً، بيرجع قائمة فاضية بدون أي خطأ — الاستبيان لازم ينحفظ بكل الأحوال.
  private async resolveCaseAndPractitioners(
    patientId: string,
    department: string,
  ): Promise<{ caseId: string | null; practitionerIds: string[] }> {
    try {
      if (department === 'PROSTHETICS') {
        const rows = await this.prisma.$queryRawUnsafe<Array<{
          id: string; prosthetistIds: string[]; physiotherapistIds: string[]; supervisingDoctorIds: string[];
        }>>(
          `SELECT id, "prosthetistIds", "physiotherapistIds", "supervisingDoctorIds"
           FROM clinic_prosthetics.prosthetics_cases
           WHERE "patientId" = $1 AND "deletedAt" IS NULL
           ORDER BY "createdAt" DESC LIMIT 1`,
          patientId,
        );
        const c = rows[0];
        if (!c) return { caseId: null, practitionerIds: [] };
        const ids = [...new Set([...(c.prosthetistIds ?? []), ...(c.physiotherapistIds ?? []), ...(c.supervisingDoctorIds ?? [])])];
        return { caseId: c.id, practitionerIds: ids };
      }

      if (department === 'PHYSIO') {
        const rows = await this.prisma.$queryRawUnsafe<Array<{ id: string; physiotherapistIds: string[] }>>(
          `SELECT id, "physiotherapistIds"
           FROM clinic_physio.physio_cases
           WHERE "patientId" = $1 AND "deletedAt" IS NULL
           ORDER BY "createdAt" DESC LIMIT 1`,
          patientId,
        );
        const c = rows[0];
        if (!c) return { caseId: null, practitionerIds: [] };
        return { caseId: c.id, practitionerIds: [...new Set(c.physiotherapistIds ?? [])] };
      }

      if (department === 'PODIATRY') {
        const rows = await this.prisma.$queryRawUnsafe<Array<{ id: string; practitionerIds: string[] }>>(
          `SELECT id, "practitionerIds"
           FROM clinic_podiatry.podiatry_receptions
           WHERE "patientId" = $1
           ORDER BY "createdAt" DESC LIMIT 1`,
          patientId,
        );
        const c = rows[0];
        if (!c) return { caseId: null, practitionerIds: [] };
        return { caseId: c.id, practitionerIds: [...new Set(c.practitionerIds ?? [])] };
      }

      return { caseId: null, practitionerIds: [] };
    } catch {
      // فشل الاستعلام العابر للخدمة لا يوقف حفظ الاستبيان — يُحفظ بدون ربط بدل ما يفشل كامل
      return { caseId: null, practitionerIds: [] };
    }
  }

  async create(dto: CreateSurveyDto, userId: string) {
    const patient = await this.prisma.patient.findFirst({ where: { id: dto.patientId } });
    if (!patient) throw new NotFoundException({ code: 'PATIENT_NOT_FOUND', message: 'المريض غير موجود' });

    if (dto.podiatryServiceType === 'ANALYSIS_AND_FITTING' && dto.noFittingReason !== undefined) {
      throw new BadRequestException({ code: 'INVALID_FIELD', message: 'noFittingReason لا يُرسل مع ANALYSIS_AND_FITTING' });
    }
    if (dto.podiatryServiceType === 'ANALYSIS_ONLY' && dto.insoleComfortRating !== undefined) {
      throw new BadRequestException({ code: 'INVALID_FIELD', message: 'insoleComfortRating لا يُرسل مع ANALYSIS_ONLY' });
    }

    const { caseId, practitionerIds } = await this.resolveCaseAndPractitioners(dto.patientId, dto.department);

    return this.prisma.patientSurvey.create({
      data: {
        patientId: dto.patientId,
        department: dto.department as any,
        caseId,
        practitionerIds,
        customerName: dto.customerName,
        gender: dto.gender as any,
        ageGroup: dto.ageGroup as any,
        staffExplanationRating: dto.staffExplanationRating,
        specialistCareRating: dto.specialistCareRating,
        waitingAreaRating: dto.waitingAreaRating,
        waitingDurationRating: dto.waitingDurationRating,
        overallCompanyRating: dto.overallCompanyRating,
        measurementAccuracyRating: dto.measurementAccuracyRating,
        movementEaseRating: dto.movementEaseRating,
        complaintStage: dto.complaintStage as any,
        podiatryServiceType: dto.podiatryServiceType as any,
        medicalRecommendationRating: dto.medicalRecommendationRating,
        noFittingReason: dto.noFittingReason as any,
        noFittingReasonOther: dto.noFittingReasonOther,
        insoleComfortRating: dto.insoleComfortRating,
        exerciseQualityRating: dto.exerciseQualityRating,
        mobilityImprovementRating: dto.mobilityImprovementRating,
        additionalNotes: dto.additionalNotes,
        createdByUserId: userId,
      },
    });
  }

  async findOne(id: string) {
    const survey = await this.prisma.patientSurvey.findFirst({ where: { id } });
    if (!survey) throw new NotFoundException({ code: 'SURVEY_NOT_FOUND', message: 'الاستبيان غير موجود' });
    return survey;
  }

  async findAll(query: { patientId?: string; department?: string; page?: number; limit?: number }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const where: any = {};
    if (query.patientId) where.patientId = query.patientId;
    if (query.department) where.department = query.department;

    const [items, total] = await Promise.all([
      this.prisma.patientSurvey.findMany({
        where, skip: (page - 1) * limit, take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.patientSurvey.count({ where }),
    ]);
    return { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  // مرضى بحاجة متابعة لطلب تقييم: الأطراف الصناعية (تم التسليم من 7 أيام أو أكتر) +
  // فيتافوت (فُحص وحُدِّد الضبان بس لسا ما انركّب، من 7 أيام أو أكتر) — وما تقيّموا بعد
  async getPendingFollowUps() {
    const prostheticsRows = await this.prisma.$queryRawUnsafe<Array<{ caseId: string; patientId: string; deliveredAt: Date }>>(
      `WITH last_delivered AS (
         SELECT DISTINCT ON (csh."caseId") csh."caseId", csh."changedAt" AS "deliveredAt"
         FROM clinic_prosthetics.case_stage_history csh
         WHERE csh."toStatus" = 'DELIVERED'
         ORDER BY csh."caseId", csh."changedAt" DESC
       )
       SELECT pc.id AS "caseId", pc."patientId", ld."deliveredAt"
       FROM clinic_prosthetics.prosthetics_cases pc
       JOIN last_delivered ld ON ld."caseId" = pc.id
       WHERE pc.status = 'DELIVERED'
         AND pc."deletedAt" IS NULL
         AND ld."deliveredAt" <= NOW() - INTERVAL '7 days'`,
    );

    const podiatryRows = await this.prisma.$queryRawUnsafe<Array<{ receptionId: string; patientId: string; sessionDate: Date }>>(
      `SELECT DISTINCT ON (s."receptionId") s."receptionId" AS "receptionId", r."patientId", s."createdAt" AS "sessionDate"
       FROM clinic_podiatry.podiatry_sessions s
       JOIN clinic_podiatry.podiatry_receptions r ON r.id = s."receptionId"
       WHERE s."installedAt" IS NULL
         AND s."createdAt" <= NOW() - INTERVAL '7 days'
       ORDER BY s."receptionId", s."createdAt" DESC`,
    );

    const existingSurveys = await this.prisma.patientSurvey.findMany({
      where: {
        OR: [
          { department: 'PROSTHETICS', caseId: { in: prostheticsRows.map((r) => r.caseId) } },
          { department: 'PODIATRY', caseId: { in: podiatryRows.map((r) => r.receptionId) } },
        ],
      },
      select: { department: true, caseId: true },
    });
    const surveyedProsthetics = new Set(existingSurveys.filter((s) => s.department === 'PROSTHETICS').map((s) => s.caseId));
    const surveyedPodiatry = new Set(existingSurveys.filter((s) => s.department === 'PODIATRY').map((s) => s.caseId));

    const pendingProsthetics = prostheticsRows.filter((r) => !surveyedProsthetics.has(r.caseId));
    const pendingPodiatry = podiatryRows.filter((r) => !surveyedPodiatry.has(r.receptionId));

    const patientIds = [...new Set([...pendingProsthetics.map((r) => r.patientId), ...pendingPodiatry.map((r) => r.patientId)])];
    const patients = await this.prisma.patient.findMany({
      where: { id: { in: patientIds } },
      select: { id: true, patientNumber: true, firstName: true, lastName: true, phone: true },
    });
    const patientMap = Object.fromEntries(patients.map((p) => [p.id, p]));
    const daysSince = (d: Date) => Math.floor((Date.now() - new Date(d).getTime()) / 86400000);

    return {
      prosthetics: pendingProsthetics.map((r) => ({
        caseId: r.caseId,
        patientId: r.patientId,
        patient: patientMap[r.patientId] ?? null,
        deliveredAt: r.deliveredAt,
        daysSinceDelivered: daysSince(r.deliveredAt),
      })),
      podiatry: pendingPodiatry.map((r) => ({
        receptionId: r.receptionId,
        patientId: r.patientId,
        patient: patientMap[r.patientId] ?? null,
        sessionDate: r.sessionDate,
        daysSinceSession: daysSince(r.sessionDate),
      })),
    };
  }

  // عدد الاستبيانات لكل قسم + نسبة رضى عامة محسوبة من تجميع overallCompanyRating لكل الاستبيانات
  // (مش من استبيان واحد لحاله) — overallCompanyRating من 1 إلى 5، النسبة = المعدل ÷ 5 × 100
  async getStats() {
    const [byDept, agg] = await Promise.all([
      this.prisma.patientSurvey.groupBy({ by: ['department'], _count: { id: true } }),
      this.prisma.patientSurvey.aggregate({
        _avg: { overallCompanyRating: true },
        _count: { id: true },
      }),
    ]);

    const byDepartment = { prosthetics: 0, podiatry: 0, physio: 0 };
    for (const r of byDept) {
      if (r.department === 'PROSTHETICS') byDepartment.prosthetics = r._count.id;
      else if (r.department === 'PODIATRY') byDepartment.podiatry = r._count.id;
      else if (r.department === 'PHYSIO') byDepartment.physio = r._count.id;
    }

    const avgRating = agg._avg.overallCompanyRating ?? 0;
    const satisfactionPercent = Math.round((avgRating / 5) * 1000) / 10;

    return {
      total: agg._count.id,
      byDepartment,
      averageRating: avgRating ? Math.round(avgRating * 10) / 10 : 0,
      satisfactionPercent,
    };
  }
}
