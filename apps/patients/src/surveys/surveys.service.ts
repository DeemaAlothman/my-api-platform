import { Injectable, NotFoundException } from '@nestjs/common';
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
}
