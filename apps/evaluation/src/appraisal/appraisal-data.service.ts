import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CommitmentInput } from './appraisal-scoring';

// قراءة فقط من مخططات الخدمات الأخرى (نفس قاعدة البيانات) — لا كتابة خارج مخطط evaluation.

export interface DirEmployee {
  id: string;
  userId: string | null;
  name: string;
  managerId: string | null;
  departmentId: string;
  departmentName: string | null;
  jobTitleId: string | null;
  jobTitleName: string | null;
  gradeCode: string | null;
  company: string | null;
}

// درجات المسار القيادي: المدراء ورؤساء الأقسام والمشرفون يقيّمون أقرانهم من نفس الدرجة
export const LEADER_PEER_GRADES = ['G3', 'G4'];

/** خريطة الموظفين الفعّالين + العلاقات (مدير/مرؤوس/زميل) — تُبنى من users.employees */
export class Directory {
  readonly byId = new Map<string, DirEmployee>();
  private readonly subs = new Map<string, DirEmployee[]>();

  constructor(rows: DirEmployee[]) {
    for (const r of rows) this.byId.set(r.id, r);
    for (const r of rows) {
      if (r.managerId && this.byId.has(r.managerId)) {
        if (!this.subs.has(r.managerId)) this.subs.set(r.managerId, []);
        this.subs.get(r.managerId)!.push(r);
      }
    }
  }

  get all() { return [...this.byId.values()]; }
  subordinatesOf(id: string) { return this.subs.get(id) ?? []; }
  hasSubordinates(id: string) { return this.subordinatesOf(id).length > 0; }
  managerOf(id: string) {
    const m = this.byId.get(id)?.managerId;
    return m ? this.byId.get(m) ?? null : null;
  }

  /**
   * مجموعة الأقران (تبادلية):
   * - قيادي (له مرؤوسون) بدرجة G3/G4 ← الأقران القياديون من نفس الدرجة
   * - غير ذلك ← الزملاء تحت نفس المدير المباشر (من غير المسار القيادي)
   */
  peerGroupKey(id: string): string | null {
    const e = this.byId.get(id);
    if (!e) return null;
    if (this.hasSubordinates(id) && e.gradeCode && LEADER_PEER_GRADES.includes(e.gradeCode)) {
      return `grade:${e.gradeCode}`;
    }
    return e.managerId ? `mgr:${e.managerId}` : null;
  }

  peersOf(id: string): DirEmployee[] {
    const key = this.peerGroupKey(id);
    if (!key) return [];
    return this.all.filter((o) => o.id !== id && this.peerGroupKey(o.id) === key);
  }

  /** هل يحق لـ evaluator تقييم evaluatee على هذا المحور؟ */
  canEvaluate(axis: string, evaluatorId: string, evaluateeId: string): boolean {
    const ee = this.byId.get(evaluateeId);
    const er = this.byId.get(evaluatorId);
    if (!ee || !er) return false;
    switch (axis) {
      case 'SELF': return evaluatorId === evaluateeId;
      case 'MANAGER': return ee.managerId === evaluatorId;
      case 'UPWARD': return er.managerId === evaluateeId;
      case 'PEER': {
        const k = this.peerGroupKey(evaluatorId);
        return evaluatorId !== evaluateeId && !!k && k === this.peerGroupKey(evaluateeId);
      }
      default: return false;
    }
  }
}

/** نطاق الدورة كنص تاريخ: [start, endExclusive) */
export interface Range { start: string; endExclusive: string }

export function cycleRange(startDate: Date, endDate: Date): Range {
  const end = new Date(endDate);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start: startDate.toISOString().slice(0, 10), endExclusive: end.toISOString().slice(0, 10) };
}

@Injectable()
export class AppraisalDataService {
  constructor(private prisma: PrismaService) {}

  async resolveEmployeeId(userId: string): Promise<string | null> {
    const r = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM users.employees WHERE "userId" = $1 AND "deletedAt" IS NULL LIMIT 1`,
      userId,
    );
    return r[0]?.id ?? null;
  }

  async loadDirectory(): Promise<Directory> {
    const rows = await this.prisma.$queryRawUnsafe<DirEmployee[]>(`
      SELECT e.id, e."userId",
             TRIM(COALESCE(e."firstNameAr",'') || ' ' || COALESCE(e."lastNameAr",'')) AS name,
             e."managerId", e."departmentId", d."nameAr" AS "departmentName",
             e."jobTitleId", jt."nameAr" AS "jobTitleName",
             COALESCE(g1.code, g2.code) AS "gradeCode",
             e.company
        FROM users.employees e
        LEFT JOIN users.departments d  ON d.id  = e."departmentId"
        LEFT JOIN users.job_titles  jt ON jt.id = e."jobTitleId"
        LEFT JOIN users.job_grades  g1 ON g1.id = e."jobGradeId"
        LEFT JOIN users.job_grades  g2 ON g2.id = jt."gradeId"
       WHERE e."deletedAt" IS NULL
         AND e."employmentStatus"::text NOT IN ('TERMINATED', 'INACTIVE')`);
    return new Directory(rows);
  }

  async listDepartments() {
    return this.prisma.$queryRawUnsafe<Array<{ id: string; code: string; nameAr: string; parentId: string | null }>>(
      `SELECT id, code, "nameAr", "parentId" FROM users.departments WHERE "deletedAt" IS NULL ORDER BY "nameAr"`,
    );
  }

  async listJobTitles() {
    return this.prisma.$queryRawUnsafe<Array<{ id: string; code: string; nameAr: string }>>(
      `SELECT id, code, "nameAr" FROM users.job_titles WHERE "deletedAt" IS NULL ORDER BY "nameAr"`,
    );
  }

  /**
   * رضا مرضى قسم: متوسط كل استبيان (أسئلة القسم والخدمة، دون بنود الانتظار التي تخص
   * «جاهزية المركز»)، ثم متوسط الاستبيانات — كل مريض بوزن واحد. التقييمات من 1 إلى 5.
   */
  async departmentSatisfaction(source: string, r: Range) {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ avg: number | null; n: number }>>(`
      SELECT AVG(x.v)::float AS avg, COUNT(*)::int AS n FROM (
        SELECT (SELECT AVG(v) FROM unnest(ARRAY[
                  s."staffExplanationRating", s."specialistCareRating", s."overallCompanyRating",
                  s."measurementAccuracyRating", s."movementEaseRating",
                  s."medicalRecommendationRating", s."insoleComfortRating",
                  s."exerciseQualityRating", s."mobilityImprovementRating"]) AS v) AS v
          FROM clinic_patients.patient_surveys s
         WHERE s.department::text = $1
           AND s."createdAt" >= $2::date AND s."createdAt" < $3::date
      ) x WHERE x.v IS NOT NULL`, source, r.start, r.endExclusive);
    return { avgRating: rows[0]?.avg ?? null, surveys: rows[0]?.n ?? 0 };
  }

  /** جاهزية المركز: بنود الانتظار (منطقة الانتظار + مدة الانتظار) من استبيانات كل الأقسام */
  async centerReadinessSatisfaction(r: Range) {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ avg: number | null; n: number }>>(`
      SELECT AVG(x.v)::float AS avg, COUNT(*)::int AS n FROM (
        SELECT (SELECT AVG(v) FROM unnest(ARRAY[s."waitingAreaRating", s."waitingDurationRating"]) AS v) AS v
          FROM clinic_patients.patient_surveys s
         WHERE s."createdAt" >= $1::date AND s."createdAt" < $2::date
      ) x WHERE x.v IS NOT NULL`, r.start, r.endExclusive);
    return { avgRating: rows[0]?.avg ?? null, surveys: rows[0]?.n ?? 0 };
  }

  /** مدخلات مؤشر الالتزام لمجموعة موظفين دفعة واحدة */
  async commitmentInputs(employeeIds: string[], r: Range, leaveCodes: string[]): Promise<Map<string, CommitmentInput>> {
    const map = new Map<string, CommitmentInput>();
    for (const id of employeeIds) {
      map.set(id, { penalties: 0, justifications: 0, starOfMonthWins: 0, leaveDaysByMonth: {}, leaveHoursByMonth: {} });
    }
    if (employeeIds.length === 0) return map;

    const counts = async (sql: string, field: 'penalties' | 'justifications' | 'starOfMonthWins') => {
      const rows = await this.prisma.$queryRawUnsafe<Array<{ employeeId: string; n: number }>>(sql, employeeIds, r.start, r.endExclusive);
      for (const row of rows) { const m = map.get(row.employeeId); if (m) m[field] = row.n; }
    };

    // العقوبات (مادية/معنوية) النافذة
    await counts(`
      SELECT "employeeId", COUNT(*)::int AS n FROM users.employee_rewards_penalties
       WHERE "employeeId" = ANY($1::text[]) AND kind = 'PENALTY' AND status = 'ACTIVE'
         AND "effectiveDate" >= $2::date AND "effectiveDate" < $3::date
       GROUP BY 1`, 'penalties');

    // تبريرات التأخير المقدَّمة
    await counts(`
      SELECT "employeeId", COUNT(*)::int AS n FROM attendance.attendance_justifications
       WHERE "employeeId" = ANY($1::text[])
         AND "createdAt" >= $2::date AND "createdAt" < $3::date
       GROUP BY 1`, 'justifications');

    // لقب موظف الشهر — الشهر المُقيَّم يقع ضمن الدورة
    await counts(`
      SELECT c."employeeId", COUNT(*)::int AS n
        FROM star_of_month.candidates c
        JOIN star_of_month.cycles y ON y.id = c."cycleId"
       WHERE c."employeeId" = ANY($1::text[]) AND c."isWinner" = true
         AND make_date(y.year, y.month, 1) >= $2::date AND make_date(y.year, y.month, 1) < $3::date
       GROUP BY 1`, 'starOfMonthWins');

    // الإجازات اليومية المعتمدة من الأنواع المحتسبة — مجمَّعة حسب شهر البداية
    const days = await this.prisma.$queryRawUnsafe<Array<{ employeeId: string; month: string; v: number }>>(`
      SELECT r."employeeId", to_char(r."startDate", 'YYYY-MM') AS month, SUM(r."totalDays")::float AS v
        FROM leaves.leave_requests r
        JOIN leaves.leave_types t ON t.id = r."leaveTypeId"
       WHERE r."employeeId" = ANY($1::text[]) AND r.status::text = 'APPROVED' AND r."deletedAt" IS NULL
         AND r."isHourlyLeave" = false AND t.code = ANY($4::text[])
         AND r."startDate" >= $2::date AND r."startDate" < $3::date
       GROUP BY 1, 2`, employeeIds, r.start, r.endExclusive, leaveCodes);
    for (const row of days) { const m = map.get(row.employeeId); if (m) m.leaveDaysByMonth[row.month] = row.v; }

    // الإجازات الساعية المعتمدة — مجمَّعة حسب الشهر
    const hours = await this.prisma.$queryRawUnsafe<Array<{ employeeId: string; month: string; v: number }>>(`
      SELECT r."employeeId", to_char(r."startDate", 'YYYY-MM') AS month, SUM(COALESCE(r."durationHours", 0))::float AS v
        FROM leaves.leave_requests r
       WHERE r."employeeId" = ANY($1::text[]) AND r.status::text = 'APPROVED' AND r."deletedAt" IS NULL
         AND r."isHourlyLeave" = true
         AND r."startDate" >= $2::date AND r."startDate" < $3::date
       GROUP BY 1, 2`, employeeIds, r.start, r.endExclusive);
    for (const row of hours) { const m = map.get(row.employeeId); if (m) m.leaveHoursByMonth[row.month] = row.v; }

    return map;
  }
}
