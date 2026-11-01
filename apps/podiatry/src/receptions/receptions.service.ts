import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReceptionDto } from './dto/create-reception.dto';
import { UpdateReceptionDto } from './dto/update-reception.dto';
import { ComplaintDto, MedicalHistoryDto } from './dto/complaint.dto';
import { AssignPractitionersDto } from './dto/assign-practitioners.dto';

const PATIENTS_URL   = process.env.PATIENTS_SERVICE_URL   || 'http://patients:4010';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

@Injectable()
export class ReceptionsService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolvePatients(
    patientIds: string[],
  ): Promise<Record<string, { firstName: string; lastName: string; patientNumber: string }>> {
    const ids = [...new Set(patientIds.filter(Boolean))];
    if (ids.length === 0) return {};
    try {
      const res = await fetch(`${PATIENTS_URL}/api/v1/patients/internal/find-by-ids`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-token': INTERNAL_TOKEN },
        body: JSON.stringify({ patientIds: ids }),
      });
      if (!res.ok) return {};
      const json: any = await res.json();
      const list: any[] = Array.isArray(json) ? json : (json?.data ?? []);
      const map: Record<string, any> = {};
      for (const p of list) {
        if (p?.id) map[p.id] = { firstName: p.firstName, lastName: p.lastName, patientNumber: p.patientNumber };
      }
      return map;
    } catch {
      return {};
    }
  }

  // تحويل حالة معاينة طبيب (من خدمة physio) إلى استقبال طب أقدام جديد
  async createFromExam(patientId: string, podiatristId: string | undefined, createdBy: string | undefined) {
    const reception = await this.prisma.podiatryReception.create({
      data: {
        patientId,
        createdBy: createdBy || 'system',
        practitionerIds: podiatristId ? [podiatristId] : [],
      },
    });
    return { id: reception.id };
  }

  async create(dto: CreateReceptionDto, userId: string) {
    const reception = await this.prisma.podiatryReception.create({
      data: {
        patientId:           dto.patientId,
        height:              dto.height ?? null,
        weight:              dto.weight ?? null,
        occupation:          dto.occupation ?? null,
        activities:          dto.activities ?? null,
        problemDescription:  dto.problemDescription ?? null,
        historyOfSymptoms:   dto.historyOfSymptoms ?? null,
        affectedSide:        dto.affectedSide ?? [],
        footSymptoms:        dto.footSymptoms ?? [],
        footSymptomsRight:   dto.footSymptomsRight ?? [],
        footSymptomsLeft:    dto.footSymptomsLeft ?? [],
        visitTypes:          dto.visitTypes ?? [],
        visitTypesRight:     dto.visitTypesRight ?? [],
        visitTypesLeft:      dto.visitTypesLeft ?? [],
        medicalHistory:      dto.medicalHistory ?? [],
        medicalHistoryOther: dto.medicalHistoryOther ?? null,
        vasScore:            dto.vasScore ?? null,
        createdBy:           userId,
      },
      include: { sessions: true },
    });
    const patientMap = await this.resolvePatients([reception.patientId]);
    return { ...reception, patient: patientMap[reception.patientId] ?? null };
  }

  async findAll(patientId?: string) {
    const receptions = await this.prisma.podiatryReception.findMany({
      where: patientId ? { patientId } : undefined,
      orderBy: { createdAt: 'desc' },
      include: { sessions: { orderBy: { sessionDate: 'asc' } } },
    });
    const patientMap = await this.resolvePatients(receptions.map(r => r.patientId));
    return receptions.map(r => ({ ...r, patient: patientMap[r.patientId] ?? null }));
  }

  async findOne(id: string) {
    const reception = await this.prisma.podiatryReception.findUnique({
      where: { id },
      include: { sessions: { orderBy: { sessionDate: 'asc' } } },
    });
    if (!reception) throw new NotFoundException('Reception not found');
    const patientMap = await this.resolvePatients([reception.patientId]);
    return { ...reception, patient: patientMap[reception.patientId] ?? null };
  }

  private async getUsersByJobTitle(code: string): Promise<string[]> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ userId: string }>>(
      `SELECT e."userId" FROM users.employees e
       JOIN users.job_titles jt ON jt.id = e."jobTitleId"
       WHERE jt.code = $1 AND e."deletedAt" IS NULL`,
      code,
    ).catch(() => [] as Array<{ userId: string }>);
    return rows.map(r => r.userId).filter(Boolean);
  }

  // تنبيه "استمارة غير مكتملة" — بيروح لرئيس قسم الأطراف الصناعية وطب الأقدام (VTX-JTL-000035)
  async notifyIncompleteForm(id: string) {
    const reception = await this.prisma.podiatryReception.findUnique({ where: { id } });
    if (!reception) throw new NotFoundException('Reception not found');
    const patientMap = await this.resolvePatients([reception.patientId]);
    const info = patientMap[reception.patientId];
    const patientName = info ? `${info.firstName} ${info.lastName}` : 'غير معروف';

    const headUserIds = await this.getUsersByJobTitle('VTX-JTL-000035');
    for (const userId of headUserIds) {
      await this.prisma.$queryRawUnsafe(
        `INSERT INTO users.notifications (id, "userId", type, "titleAr", "titleEn", "messageAr", "messageEn", data, "createdAt")
         VALUES (gen_random_uuid()::text, $1, 'GENERAL'::"users"."NotificationType", $2, $2, $3, $3, $4::jsonb, NOW())`,
        userId,
        'تنبيه بخصوص استمارة غير مكتملة',
        `قام المدير الطبي بإرسال تنبيه بخصوص استمارة المريض (${patientName}). الرجاء توجيه الموظف المستلم للحالة لإكمال الاستمارة خلال 24 ساعة.`,
        JSON.stringify({ type: 'INCOMPLETE_FORM_ALERT', receptionId: id, link: `/clinic/podiatry/${id}` }),
      ).catch(() => {});
    }
    return { sent: headUserIds.length > 0 };
  }

  async update(id: string, dto: UpdateReceptionDto) {
    const reception = await this.prisma.podiatryReception.update({
      where: { id },
      data: {
        ...(dto.height              !== undefined && { height: dto.height }),
        ...(dto.weight              !== undefined && { weight: dto.weight }),
        ...(dto.occupation          !== undefined && { occupation: dto.occupation }),
        ...(dto.activities          !== undefined && { activities: dto.activities }),
        ...(dto.problemDescription  !== undefined && { problemDescription: dto.problemDescription }),
        ...(dto.historyOfSymptoms   !== undefined && { historyOfSymptoms: dto.historyOfSymptoms }),
        ...(dto.affectedSide        !== undefined && { affectedSide: dto.affectedSide }),
        ...(dto.footSymptoms        !== undefined && { footSymptoms:        dto.footSymptoms }),
        ...(dto.footSymptomsRight   !== undefined && { footSymptomsRight:   dto.footSymptomsRight }),
        ...(dto.footSymptomsLeft    !== undefined && { footSymptomsLeft:    dto.footSymptomsLeft }),
        ...(dto.visitTypes          !== undefined && { visitTypes:          dto.visitTypes }),
        ...(dto.visitTypesRight     !== undefined && { visitTypesRight:     dto.visitTypesRight }),
        ...(dto.visitTypesLeft      !== undefined && { visitTypesLeft:      dto.visitTypesLeft }),
        ...(dto.medicalHistory      !== undefined && { medicalHistory: dto.medicalHistory }),
        ...(dto.medicalHistoryOther !== undefined && { medicalHistoryOther: dto.medicalHistoryOther }),
        ...(dto.vasScore            !== undefined && { vasScore: dto.vasScore }),
      },
      include: { sessions: true },
    });
    const patientMap = await this.resolvePatients([reception.patientId]);
    return { ...reception, patient: patientMap[reception.patientId] ?? null };
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.podiatryReception.delete({ where: { id } });
  }

  // ── فريق المعالجين ────────────────────────────────────────────────────────

  async resolveEmployeeIdByUserId(userId: string): Promise<string | null> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM users.employees WHERE "userId" = $1 AND "deletedAt" IS NULL LIMIT 1`,
      userId,
    ).catch(() => []);
    return rows[0]?.id ?? null;
  }

  private async notifyNewPractitioners(receptionId: string, patientId: string, employeeIds: string[]) {
    if (employeeIds.length === 0) return;
    const rows = await this.prisma.$queryRawUnsafe<Array<{ id: string; userId: string | null }>>(
      `SELECT id, "userId" FROM users.employees WHERE id = ANY($1) AND "deletedAt" IS NULL`,
      employeeIds,
    ).catch(() => []);
    const payload = { receptionId, patientId };
    for (const row of rows) {
      if (!row.userId) continue;
      await this.prisma.$queryRawUnsafe(
        `INSERT INTO users.notifications (id, "userId", type, "titleAr", "titleEn", "messageAr", "messageEn", data, "createdAt")
         VALUES (gen_random_uuid()::text, $1, 'GENERAL'::"users"."NotificationType", $2, $2, $3, $3, $4::jsonb, NOW())`,
        row.userId,
        'تم تكليفك بحالة جديدة',
        'تم تعيينك كمعالج مسؤول عن حالة مريض بطب الأقدام',
        JSON.stringify(payload),
      ).catch(() => {});
    }
  }

  async assignPractitioners(id: string, dto: AssignPractitionersDto) {
    const reception = await this.findOne(id);
    const before = new Set(reception.practitionerIds);
    const newlyAdded = dto.practitionerIds.filter((pid) => !before.has(pid));

    const updated = await this.prisma.podiatryReception.update({
      where: { id },
      data: { practitionerIds: dto.practitionerIds },
    });

    await this.notifyNewPractitioners(id, updated.patientId, newlyAdded);
    return updated;
  }

  async findMyPatients(practitionerId: string) {
    const receptions = await this.prisma.podiatryReception.findMany({
      where: { practitionerIds: { has: practitionerId } },
      orderBy: { createdAt: 'desc' },
      include: { sessions: { orderBy: { sessionDate: 'asc' } } },
    });
    const patientMap = await this.resolvePatients(receptions.map((r) => r.patientId));
    return receptions.map((r) => ({ ...r, patient: patientMap[r.patientId] ?? null }));
  }

  async upsertComplaint(id: string, dto: ComplaintDto) {
    await this.findOne(id);
    const data: any = {};
    const fields: (keyof ComplaintDto)[] = [
      'mainComplaint', 'startDate', 'possibleCause',
      'previousDoctor', 'previousTreatment',
      'symptomsBetterTime', 'symptomsWorseTime',
      'painType', 'painLevel', 'painTrend', 'hadInjuryBefore',
      'problemDescription', 'historyOfSymptoms',
      'affectedSide', 'footSymptoms', 'visitTypes',
      'vasScore', 'occupation', 'activities',
    ];
    for (const field of fields) {
      if (dto[field] !== undefined) data[field] = dto[field];
    }
    return this.prisma.podiatryReception.update({ where: { id }, data });
  }

  async upsertMedicalHistory(id: string, dto: MedicalHistoryDto) {
    await this.findOne(id);
    const data: any = {};
    const fields: (keyof MedicalHistoryDto)[] = [
      'height', 'weight',
      'currentMedications', 'previousDiagnoses',
      'herbalPreparations', 'herbalPreparationsDetails',
      'otherHealthProblems', 'doctorRestrictions',
      'smoker', 'everSmoked', 'smokingFrequency',
      'hasPacemaker', 'isPregnant', 'allergyToAdhesives',
      'surgeries',
      'hadPhysicalTherapy', 'hasOtherTreatments',
      'diagnosis',
      'imagingProcedures',
      'radiographyTypes', 'radiographyOther', 'radiographyResults',
      'hasNewAnalysis', 'newAnalysisDate', 'newAnalysisNotes',
      'hasOldAnalysis', 'oldAnalysisDate', 'oldAnalysisNotes',
      'boneDensityScan', 'hospitalizedPastYear',
      'medicalHistory', 'medicalHistoryOther',
    ];
    for (const field of fields) {
      if (dto[field] !== undefined) data[field] = dto[field];
    }
    return this.prisma.podiatryReception.update({ where: { id }, data });
  }

  // ── مبيعات فيتافوت ──────────────────────────────────────────────────────
  // جلسات فيها تركيب فعلي (installedAt) وغير مؤرشفة — بدون أي بيانات طبية،
  // فقط ما يلزم لفريق المبيعات. يُرجع سطر لكل جلسة تركيب (مش مُجمَّع بالمريض/الاستقبال)
  // سطر واحد لكل مريض (آخر تركيب له حسب installedAt)، مع installCount = كل تركيباته غير
  // المؤرشفة عبر كل استقباله. total/totalPages بعدد المرضى، مش التركيبات.
  async getSales(page = 1, limit = 20, search?: string, canViewCost = false) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;

    const searchTerm = search ? `%${search}%` : null;

    const [items, totalRows] = await Promise.all([
      this.prisma.$queryRawUnsafe<Array<{
        sessionId: string; receptionId: string; patientId: string; patientNumber: string; patientName: string;
        insoleType: string[]; shoeSize: number | null; installedAt: Date; installCount: bigint;
        insoleCost: number | null; totalCost: number | null;
      }>>(
        `WITH ranked AS (
           SELECT s.*,
             ROW_NUMBER() OVER (PARTITION BY s."patientId" ORDER BY s."installedAt" DESC) AS rn,
             COUNT(*) OVER (PARTITION BY s."patientId") AS install_count,
             SUM(s."insoleCost") OVER (PARTITION BY s."patientId") AS total_cost
           FROM clinic_podiatry.podiatry_sessions s
           WHERE s."installedAt" IS NOT NULL AND s."archivedAt" IS NULL
         )
         SELECT r.id AS "sessionId", r."receptionId", r."patientId", p."patientNumber",
                (p."firstName" || ' ' || p."lastName") AS "patientName",
                r."insoleType", r."shoeSize", r."installedAt", r.install_count AS "installCount",
                r."insoleCost"::float8 AS "insoleCost", r.total_cost::float8 AS "totalCost"
         FROM ranked r
         JOIN clinic_patients.patients p ON p.id = r."patientId" AND p."deletedAt" IS NULL
         WHERE r.rn = 1
           AND ($3::text IS NULL OR p."firstName" ILIKE $3 OR p."lastName" ILIKE $3 OR p."patientNumber" ILIKE $3)
         ORDER BY r."installedAt" DESC
         LIMIT $1 OFFSET $2`,
        safeLimit, skip, searchTerm,
      ),
      this.prisma.$queryRawUnsafe<{ count: bigint }[]>(
        `SELECT COUNT(DISTINCT s."patientId") as count
         FROM clinic_podiatry.podiatry_sessions s
         JOIN clinic_patients.patients p ON p.id = s."patientId" AND p."deletedAt" IS NULL
         WHERE s."installedAt" IS NOT NULL AND s."archivedAt" IS NULL
           AND ($1::text IS NULL OR p."firstName" ILIKE $1 OR p."lastName" ILIKE $1 OR p."patientNumber" ILIKE $1)`,
        searchTerm,
      ),
    ]);

    const total = Number(totalRows[0]?.count ?? 0);
    return {
      items: items.map((r) => ({
        sessionId: r.sessionId,
        receptionId: r.receptionId,
        patientId: r.patientId,
        patientNumber: r.patientNumber,
        patientName: r.patientName,
        insoleType: r.insoleType,
        shoeSize: r.shoeSize,
        installedAt: r.installedAt,
        installCount: Number(r.installCount),
        // التكلفة تُحجب (null) عن أي مستخدم ما عندو صلاحية عرض التكلفة
        insoleCost: canViewCost && r.insoleCost !== null ? Number(r.insoleCost) : null,
        totalCost: canViewCost && r.totalCost !== null ? Number(r.totalCost) : null,
      })),
      page: safePage, limit: safeLimit, total, totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    };
  }

  /**
   * تعديل تكلفة الضبان لجلسة تركيب واحدة. null تمسح القيمة.
   * ما بتلمس أي حقل تاني بالجلسة، وبتسجّل بسجل التدقيق مين عدّل والقيمة القديمة والجديدة.
   */
  async updateInsoleCost(
    sessionId: string,
    insoleCost: number | null,
    user?: { userId?: string; username?: string },
    req?: { ip?: string; headers?: Record<string, any> },
  ) {
    const rows = await this.prisma.$queryRawUnsafe<Array<{
      id: string; patientId: string; installedAt: Date | null; archivedAt: Date | null; insoleCost: number | null;
    }>>(
      `SELECT id, "patientId", "installedAt", "archivedAt", "insoleCost"::float8 AS "insoleCost"
       FROM clinic_podiatry.podiatry_sessions WHERE id = $1`,
      sessionId,
    );
    const session = rows[0];
    if (!session) throw new NotFoundException('الجلسة غير موجودة');
    if (!session.installedAt) throw new BadRequestException('لا يمكن تسجيل تكلفة لجلسة بدون تركيب');
    if (session.archivedAt) throw new BadRequestException('لا يمكن تعديل تكلفة جلسة مؤرشفة');

    const oldValue = session.insoleCost === null ? null : Number(session.insoleCost);

    await this.prisma.$executeRawUnsafe(
      `UPDATE clinic_podiatry.podiatry_sessions
       SET "insoleCost" = $1::numeric, "updatedAt" = NOW()
       WHERE id = $2`,
      insoleCost, sessionId,
    );

    // إجمالي تكاليف تركيبات هذا المريض غير المؤرشفة بعد التعديل
    const totals = await this.prisma.$queryRawUnsafe<Array<{ totalCost: number | null }>>(
      `SELECT SUM("insoleCost")::float8 AS "totalCost"
       FROM clinic_podiatry.podiatry_sessions
       WHERE "patientId" = $1 AND "installedAt" IS NOT NULL AND "archivedAt" IS NULL`,
      session.patientId,
    );
    const totalCost = totals[0]?.totalCost ?? null;

    const ip = (req?.headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req?.ip || null;
    const path = `/api/v1/podiatry/sales/${sessionId}/cost`;
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO public.audit_logs ("userId", username, action, resource, "resourceId", method, path, ip, metadata, "createdAt")
       VALUES ($1, $2, $3, $4, $5, 'PATCH', $6, $7, $8::jsonb, NOW())`,
      user?.userId ?? null, user?.username ?? null,
      'PODIATRY_SALES_INSOLE_COST_UPDATED', 'podiatry_sessions', sessionId, path, ip,
      JSON.stringify({ field: 'insoleCost', from: oldValue, to: insoleCost }),
    ).catch(() => { /* فشل التدقيق ما بيوقف العملية */ });

    return {
      sessionId,
      insoleCost: insoleCost === null ? null : Number(insoleCost),
      totalCost: totalCost === null ? null : Number(totalCost),
    };
  }
}
