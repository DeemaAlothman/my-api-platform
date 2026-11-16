import {
  BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { AppraisalDataService, Directory, cycleRange } from './appraisal-data.service';
import {
  AXES, Axis, bonusTier, commitmentScore, normalize, ratingToPercent, round2, submissionPercent,
} from './appraisal-scoring';
import {
  CreateCycleDto, UpdateCycleDto, SaveSubmissionDto, UpdateSettingsDto,
  SetDepartmentConfigDto, SetReadinessJobTitlesDto,
} from './dto/appraisal.dto';

const MANUAL_AXES = ['MANAGER', 'PEER', 'UPWARD', 'SELF'];

const ACHIEVEMENT_DIR = process.env.UPLOAD_DIR
  ? path.join(process.env.UPLOAD_DIR, 'appraisal-achievements')
  : '/app/uploads/appraisal-achievements';
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = [
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

@Injectable()
export class AppraisalService {
  constructor(private prisma: PrismaService, private data: AppraisalDataService) {}

  // ─────────────────────────── الدورات (HR) ───────────────────────────

  async createCycle(dto: CreateCycleDto, userId: string) {
    if (!dto.code || !dto.nameAr || !dto.startDate || !dto.endDate) {
      throw new BadRequestException('code و nameAr و startDate و endDate مطلوبة');
    }
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    if (!(end > start)) throw new BadRequestException('تاريخ النهاية يجب أن يكون بعد البداية');
    const exists = await this.prisma.appraisalCycle.findUnique({ where: { code: dto.code } });
    if (exists) throw new ConflictException('يوجد دورة بنفس الرمز');
    return this.prisma.appraisalCycle.create({
      data: { code: dto.code, nameAr: dto.nameAr, startDate: start, endDate: end, createdBy: userId },
    });
  }

  listCycles() {
    return this.prisma.appraisalCycle.findMany({ orderBy: { startDate: 'desc' } });
  }

  async getCycle(id: string) {
    const c = await this.prisma.appraisalCycle.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('الدورة غير موجودة');
    return c;
  }

  async updateCycle(id: string, dto: UpdateCycleDto) {
    const c = await this.getCycle(id);
    if (c.status !== 'DRAFT') throw new BadRequestException('لا يمكن تعديل دورة بعد فتحها');
    return this.prisma.appraisalCycle.update({
      where: { id },
      data: {
        nameAr: dto.nameAr ?? undefined,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
    });
  }

  async transition(id: string, to: 'OPEN' | 'CLOSED' | 'FINALIZED', userId: string) {
    const c = await this.getCycle(id);
    const allowed: Record<string, string[]> = {
      OPEN: ['DRAFT', 'CLOSED'],     // إعادة فتح دورة مغلقة مسموحة قبل التجميد
      CLOSED: ['OPEN'],
      FINALIZED: ['CLOSED'],
    };
    if (!allowed[to].includes(c.status)) {
      throw new BadRequestException(`لا يمكن الانتقال من ${c.status} إلى ${to}`);
    }
    if (to === 'OPEN') {
      const other = await this.prisma.appraisalCycle.findFirst({ where: { status: 'OPEN', id: { not: id } } });
      if (other) throw new ConflictException(`الدورة ${other.code} مفتوحة حالياً — أغلقيها أولاً`);
    }
    if (to === 'FINALIZED') {
      // التجميد يعتمد على آخر حساب — نعيد الحساب الآن لضمان أن النتائج حديثة
      await this.compute(id);
    }
    const now = new Date();
    return this.prisma.appraisalCycle.update({
      where: { id },
      data: {
        status: to,
        openedAt: to === 'OPEN' ? now : undefined,
        closedAt: to === 'CLOSED' ? now : undefined,
        finalizedAt: to === 'FINALIZED' ? now : undefined,
        finalizedBy: to === 'FINALIZED' ? userId : undefined,
      },
    });
  }

  // ─────────────────────────── الإعدادات (HR) ───────────────────────────

  async getSettings() {
    const s = await this.prisma.appraisalSettings.findUnique({ where: { id: 1 } });
    if (!s) throw new NotFoundException('إعدادات التقييم غير مهيأة');
    return s;
  }

  async updateSettings(dto: UpdateSettingsDto, userId: string) {
    await this.getSettings();
    return this.prisma.appraisalSettings.update({ where: { id: 1 }, data: { ...dto, updatedBy: userId } });
  }

  /** كل الأقسام مع تصنيفها — configured=false يعني لم تصنّفه HR بعد */
  async listDepartmentConfig() {
    const [depts, cfg] = await Promise.all([
      this.data.listDepartments(),
      this.prisma.appraisalDepartmentConfig.findMany(),
    ]);
    const map = new Map(cfg.map((c) => [c.departmentId, c]));
    return depts.map((d) => {
      const c = map.get(d.id);
      return {
        departmentId: d.id, code: d.code, nameAr: d.nameAr, parentId: d.parentId,
        configured: !!c,
        isCenterMedical: c ? c.satisfactionSource !== null : null,
        satisfactionSource: c?.satisfactionSource ?? null,
      };
    });
  }

  async setDepartmentConfig(departmentId: string, dto: SetDepartmentConfigDto, userId: string) {
    const src = dto.satisfactionSource ?? null;
    return this.prisma.appraisalDepartmentConfig.upsert({
      where: { departmentId },
      create: { departmentId, satisfactionSource: src as any, updatedBy: userId },
      update: { satisfactionSource: src as any, updatedBy: userId },
    });
  }

  async listReadinessJobTitles() {
    const [titles, chosen] = await Promise.all([
      this.data.listJobTitles(),
      this.prisma.appraisalReadinessJobTitle.findMany(),
    ]);
    const set = new Set(chosen.map((c) => c.jobTitleId));
    return titles.map((t) => ({ ...t, isReadiness: set.has(t.id) }));
  }

  async setReadinessJobTitles(dto: SetReadinessJobTitlesDto) {
    const ids = [...new Set(dto.jobTitleIds ?? [])];
    // يستبدل القائمة كاملة — جدول إعداد صغير خاص بهذه الوحدة
    await this.prisma.$transaction([
      this.prisma.appraisalReadinessJobTitle.deleteMany({ where: { jobTitleId: { notIn: ids } } }),
      ...ids.map((jobTitleId) => this.prisma.appraisalReadinessJobTitle.upsert({
        where: { jobTitleId }, create: { jobTitleId }, update: {},
      })),
    ]);
    return this.listReadinessJobTitles();
  }

  // ─────────────────────────── الموظف: المهام والإدخال ───────────────────────────

  getQuestions() {
    return this.prisma.appraisalQuestion.findMany({
      where: { isActive: true },
      orderBy: [{ axis: 'asc' }, { displayOrder: 'asc' }],
    });
  }

  async currentCycle() {
    return this.prisma.appraisalCycle.findFirst({
      where: { status: { in: ['OPEN', 'CLOSED', 'FINALIZED'] } },
      orderBy: { startDate: 'desc' },
    });
  }

  private async me(userId: string) {
    const id = await this.data.resolveEmployeeId(userId);
    if (!id) throw new ForbiddenException('لا يوجد ملف موظف مرتبط بهذا الحساب');
    return id;
  }

  /** من يجب أن أقيّم بهذه الدورة، وحالة كل تقييم */
  async myTasks(cycleId: string, userId: string) {
    const cycle = await this.getCycle(cycleId);
    const meId = await this.me(userId);
    const dir = await this.data.loadDirectory();
    const self = dir.byId.get(meId);
    if (!self) throw new ForbiddenException('ملف الموظف غير فعّال');

    const targets: Array<{ axis: Axis; e: { id: string; name: string; jobTitleName: string | null } }> = [];
    targets.push({ axis: 'SELF', e: self });
    for (const s of dir.subordinatesOf(meId)) targets.push({ axis: 'MANAGER', e: s });
    const mgr = dir.managerOf(meId);
    if (mgr) targets.push({ axis: 'UPWARD', e: mgr });
    for (const p of dir.peersOf(meId)) targets.push({ axis: 'PEER', e: p });

    const subs = await this.prisma.appraisalSubmission.findMany({
      where: { cycleId, evaluatorId: meId },
      select: { id: true, axis: true, evaluateeId: true, status: true },
    });
    const key = (a: string, e: string) => `${a}:${e}`;
    const subMap = new Map(subs.map((s) => [key(s.axis, s.evaluateeId), s]));

    return {
      cycle: { id: cycle.id, code: cycle.code, nameAr: cycle.nameAr, status: cycle.status },
      canEdit: cycle.status === 'OPEN',
      tasks: targets.map((t) => {
        const s = subMap.get(key(t.axis, t.e.id));
        return {
          axis: t.axis,
          evaluateeId: t.e.id,
          evaluateeName: t.e.name,
          evaluateeJobTitle: t.e.jobTitleName,
          submissionId: s?.id ?? null,
          status: s?.status ?? 'NOT_STARTED',
        };
      }),
    };
  }

  /** تقييمي لشخص معيّن (مسودة أو مُرسل) — المقيِّم يرى ما أدخله هو فقط */
  async getMySubmission(cycleId: string, axis: string, evaluateeId: string, userId: string) {
    const meId = await this.me(userId);
    const s = await this.prisma.appraisalSubmission.findUnique({
      where: { cycleId_axis_evaluateeId_evaluatorId: { cycleId, axis: axis as any, evaluateeId, evaluatorId: meId } },
      include: { answers: true },
    });
    return s;
  }

  async saveSubmission(cycleId: string, dto: SaveSubmissionDto, userId: string) {
    if (!dto.axis || !dto.evaluateeId || !Array.isArray(dto.answers)) {
      throw new BadRequestException('axis و evaluateeId و answers مطلوبة');
    }
    if (!MANUAL_AXES.includes(dto.axis)) throw new BadRequestException('هذا المحور يُحسب آلياً');
    const cycle = await this.getCycle(cycleId);
    if (cycle.status !== 'OPEN') throw new BadRequestException('الدورة غير مفتوحة للإدخال');

    const meId = await this.me(userId);
    const dir = await this.data.loadDirectory();
    if (!dir.canEvaluate(dto.axis, meId, dto.evaluateeId)) {
      throw new ForbiddenException('لا يحق لك تقييم هذا الموظف على هذا المحور');
    }
    if (dto.axis !== 'SELF' && (dto.achievementNote !== undefined)) {
      throw new BadRequestException('ملاحظة الإنجازات خاصة بالتقييم الذاتي');
    }

    const questions = await this.prisma.appraisalQuestion.findMany({ where: { axis: dto.axis as any, isActive: true } });
    const qMap = new Map(questions.map((q) => [q.id, q]));
    for (const a of dto.answers) {
      const q = qMap.get(a.questionId);
      if (!q) throw new BadRequestException(`سؤال غير تابع لهذا المحور: ${a.questionId}`);
      if (!Number.isInteger(a.score) || a.score < 1 || a.score > q.maxScore) {
        throw new BadRequestException(`درجة السؤال «${q.textAr}» يجب أن تكون بين 1 و ${q.maxScore}`);
      }
    }

    const where = { cycleId_axis_evaluateeId_evaluatorId: {
      cycleId, axis: dto.axis as any, evaluateeId: dto.evaluateeId, evaluatorId: meId,
    } };
    const existing = await this.prisma.appraisalSubmission.findUnique({ where });
    if (existing?.status === 'SUBMITTED') throw new BadRequestException('تم إرسال هذا التقييم ولا يمكن تعديله');

    return this.prisma.$transaction(async (tx) => {
      const sub = existing
        ? await tx.appraisalSubmission.update({
            where: { id: existing.id },
            data: { comments: dto.comments ?? undefined, achievementNote: dto.achievementNote ?? undefined },
          })
        : await tx.appraisalSubmission.create({
            data: {
              cycleId, axis: dto.axis as any, evaluateeId: dto.evaluateeId, evaluatorId: meId,
              comments: dto.comments, achievementNote: dto.achievementNote,
            },
          });
      for (const a of dto.answers) {
        await tx.appraisalAnswer.upsert({
          where: { submissionId_questionId: { submissionId: sub.id, questionId: a.questionId } },
          create: { submissionId: sub.id, questionId: a.questionId, score: a.score },
          update: { score: a.score },
        });
      }
      return tx.appraisalSubmission.findUnique({ where: { id: sub.id }, include: { answers: true } });
    });
  }

  async submit(cycleId: string, submissionId: string, userId: string) {
    const cycle = await this.getCycle(cycleId);
    if (cycle.status !== 'OPEN') throw new BadRequestException('الدورة غير مفتوحة للإدخال');
    const meId = await this.me(userId);
    const sub = await this.prisma.appraisalSubmission.findUnique({
      where: { id: submissionId }, include: { answers: { include: { question: true } } },
    });
    if (!sub || sub.cycleId !== cycleId || sub.evaluatorId !== meId) throw new NotFoundException('التقييم غير موجود');
    if (sub.status === 'SUBMITTED') return sub;

    const questions = await this.prisma.appraisalQuestion.findMany({ where: { axis: sub.axis, isActive: true } });
    const answered = new Set(sub.answers.map((a) => a.questionId));
    const missing = questions.filter((q) => !answered.has(q.id));
    if (missing.length) {
      throw new BadRequestException(`أسئلة بلا إجابة: ${missing.map((q) => q.displayOrder).join('، ')}`);
    }
    const active = new Set(questions.map((q) => q.id));
    const percent = submissionPercent(
      sub.answers.filter((a) => active.has(a.questionId)).map((a) => ({ score: a.score, maxScore: a.question.maxScore })),
    );
    return this.prisma.appraisalSubmission.update({
      where: { id: sub.id },
      data: { status: 'SUBMITTED', scorePercent: percent, submittedAt: new Date() },
    });
  }

  // ─────────────────────────── مرفق الإنجازات (الذاتي) ───────────────────────────

  async uploadAchievement(cycleId: string, file: Express.Multer.File, userId: string) {
    if (!file || !file.buffer || file.size === 0) throw new BadRequestException('الملف فارغ أو لم يتم استلامه');
    if (file.size > MAX_FILE_BYTES) throw new BadRequestException('حجم الملف يتجاوز الحد المسموح (10 ميغابايت)');
    if (!ALLOWED_MIME.includes(file.mimetype)) throw new BadRequestException('نوع الملف غير مدعوم');
    const cycle = await this.getCycle(cycleId);
    if (cycle.status !== 'OPEN') throw new BadRequestException('الدورة غير مفتوحة للإدخال');
    const meId = await this.me(userId);

    const where = { cycleId_axis_evaluateeId_evaluatorId: { cycleId, axis: 'SELF' as any, evaluateeId: meId, evaluatorId: meId } };
    const existing = await this.prisma.appraisalSubmission.findUnique({ where });
    if (existing?.status === 'SUBMITTED') throw new BadRequestException('تم إرسال التقييم الذاتي ولا يمكن تعديله');

    // ملف جديد باسم فريد — لا يُحذف أي ملف سابق (الاستبدال يغيّر الرابط فقط)
    if (!fs.existsSync(ACHIEVEMENT_DIR)) fs.mkdirSync(ACHIEVEMENT_DIR, { recursive: true });
    const ext = path.extname(file.originalname || '').replace(/[^.a-zA-Z0-9]/g, '').slice(0, 10);
    const diskPath = path.join(ACHIEVEMENT_DIR, `${cycleId}-${meId}-${Date.now()}${ext}`);
    fs.writeFileSync(diskPath, file.buffer);

    const sub = existing
      ? await this.prisma.appraisalSubmission.update({ where: { id: existing.id }, data: { achievementFileUrl: diskPath } })
      : await this.prisma.appraisalSubmission.create({
          data: { cycleId, axis: 'SELF', evaluateeId: meId, evaluatorId: meId, achievementFileUrl: diskPath },
        });
    return { submissionId: sub.id, uploaded: true };
  }

  /** المرفق يراه: صاحبه، مديره المباشر، أو HR */
  async achievementFilePath(cycleId: string, employeeId: string, userId: string, isHr: boolean) {
    if (!isHr) {
      const meId = await this.me(userId);
      if (meId !== employeeId) {
        const dir = await this.data.loadDirectory();
        if (dir.byId.get(employeeId)?.managerId !== meId) throw new ForbiddenException('غير مصرح');
      }
    }
    const s = await this.prisma.appraisalSubmission.findUnique({
      where: { cycleId_axis_evaluateeId_evaluatorId: { cycleId, axis: 'SELF', evaluateeId: employeeId, evaluatorId: employeeId } },
    });
    if (!s?.achievementFileUrl) throw new NotFoundException('لا يوجد مرفق');
    if (!fs.existsSync(s.achievementFileUrl)) throw new NotFoundException('الملف لم يعد موجوداً على الخادم');
    return s.achievementFileUrl;
  }

  // ─────────────────────────── الحساب ───────────────────────────

  /** يحسب ويخزّن نتائج كل الموظفين الفعّالين. لا يلمس أي بيانات خارج جداول Appraisal. */
  async compute(cycleId: string) {
    const cycle = await this.getCycle(cycleId);
    if (cycle.status === 'FINALIZED') throw new BadRequestException('الدورة مجمَّدة — النتائج نهائية');
    if (cycle.status === 'DRAFT') throw new BadRequestException('الدورة لم تُفتح بعد');

    const range = cycleRange(cycle.startDate, cycle.endDate);
    const [dir, settings, deptCfg, readiness, submissions] = await Promise.all([
      this.data.loadDirectory(),
      this.getSettings(),
      this.prisma.appraisalDepartmentConfig.findMany(),
      this.prisma.appraisalReadinessJobTitle.findMany(),
      this.prisma.appraisalSubmission.findMany({ where: { cycleId, status: 'SUBMITTED' } }),
    ]);
    const deptMap = new Map(deptCfg.map((d) => [d.departmentId, d]));
    const readinessTitles = new Set(readiness.map((r) => r.jobTitleId));

    // رضا العملاء — مرة واحدة لكل مصدر
    const satCache = new Map<string, { avgRating: number | null; surveys: number }>();
    const sat = async (key: string) => {
      if (!satCache.has(key)) {
        satCache.set(key, key === 'READINESS'
          ? await this.data.centerReadinessSatisfaction(range)
          : await this.data.departmentSatisfaction(key, range));
      }
      return satCache.get(key)!;
    };

    const employees = dir.all;
    const commit = await this.data.commitmentInputs(employees.map((e) => e.id), range, settings.countedLeaveTypeCodes);

    // التقييمات المرسلة مجمَّعة حسب المقيَّم والمحور
    const byEval = new Map<string, Map<string, number[]>>();
    for (const s of submissions) {
      if (s.scorePercent === null) continue;
      // تقييم من شخص لم يعد له حق (تغيّر المدير مثلاً) يُتجاهل
      if (!dir.canEvaluate(s.axis, s.evaluatorId, s.evaluateeId)) continue;
      if (!byEval.has(s.evaluateeId)) byEval.set(s.evaluateeId, new Map());
      const m = byEval.get(s.evaluateeId)!;
      if (!m.has(s.axis)) m.set(s.axis, []);
      m.get(s.axis)!.push(s.scorePercent);
    }
    const avg = (xs?: number[]) => (xs && xs.length ? round2(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

    const warnings = { unconfiguredDepartments: new Set<string>(), noReadinessTitles: readinessTitles.size === 0 };
    let saved = 0;

    for (const e of employees) {
      const m = byEval.get(e.id) ?? new Map<string, number[]>();
      const hasManager = !!dir.managerOf(e.id);
      const missing: string[] = [];

      // 1. المدير — مطلوب إذا للموظف مدير
      const managerPercent = avg(m.get('MANAGER'));
      if (hasManager && managerPercent === null) missing.push('MANAGER');

      // 2. رضا العملاء
      let customerPercent: number | null = null;
      let customer: Record<string, unknown>;
      if (e.jobTitleId && readinessTitles.has(e.jobTitleId)) {
        const r = await sat('READINESS');
        customerPercent = r.avgRating !== null ? ratingToPercent(r.avgRating) : null;
        customer = { source: 'CENTER_READINESS', ...r };
      } else {
        const cfg = deptMap.get(e.departmentId);
        if (!cfg) {
          warnings.unconfiguredDepartments.add(e.departmentName ?? e.departmentId);
          customer = { source: null, reason: 'DEPARTMENT_NOT_CONFIGURED' };
        } else if (!cfg.satisfactionSource) {
          customer = { source: null, reason: 'ADMINISTRATIVE' };
        } else {
          const r = await sat(cfg.satisfactionSource);
          customerPercent = r.avgRating !== null ? ratingToPercent(r.avgRating) : null;
          customer = { source: cfg.satisfactionSource, ...r, ...(r.surveys === 0 ? { reason: 'NO_SURVEYS' } : {}) };
        }
      }

      // 3، 4. الزملاء والمرؤوسون — بلا تقييمات = غير منطبق (يُطبَّع)
      const peerPercent = avg(m.get('PEER'));
      const upwardPercent = dir.hasSubordinates(e.id) ? avg(m.get('UPWARD')) : null;

      // 5. الالتزام — دائماً منطبق
      const c = commitmentScore(commit.get(e.id)!, settings);

      // 6. الذاتي — مطلوب
      const selfPercent = avg(m.get('SELF'));
      if (selfPercent === null) missing.push('SELF');

      const percents: Partial<Record<Axis, number | null>> = {
        MANAGER: managerPercent, CUSTOMER: customerPercent, PEER: peerPercent,
        UPWARD: upwardPercent, COMMITMENT: c.percent, SELF: selfPercent,
      };
      const n = normalize(percents);
      const complete = missing.length === 0;
      const finalScore = complete ? n.finalScore : null;

      const row = {
        managerPercent, customerPercent, peerPercent, upwardPercent,
        commitmentPercent: c.percent, selfPercent,
        peerCount: m.get('PEER')?.length ?? 0,
        upwardCount: dir.hasSubordinates(e.id) ? (m.get('UPWARD')?.length ?? 0) : 0,
        appliedWeights: n.weights as any,
        missingAxes: missing,
        details: {
          employee: { name: e.name, departmentId: e.departmentId, departmentName: e.departmentName,
            jobTitleName: e.jobTitleName, gradeCode: e.gradeCode, company: e.company },
          hasManager, hasSubordinates: dir.hasSubordinates(e.id),
          availableWeight: n.availableWeight,
          customer,
          commitment: { ...c, input: commit.get(e.id) },
        } as any,
        finalScore,
        bonusTier: finalScore !== null ? bonusTier(finalScore) as any : null,
        computedAt: new Date(),
      };
      await this.prisma.appraisalResult.upsert({
        where: { cycleId_employeeId: { cycleId, employeeId: e.id } },
        create: { cycleId, employeeId: e.id, ...row },
        update: row,
      });
      saved++;
    }

    return {
      computed: saved,
      warnings: {
        unconfiguredDepartments: [...warnings.unconfiguredDepartments],
        noReadinessJobTitles: warnings.noReadinessTitles,
      },
    };
  }

  // ─────────────────────────── النتائج ───────────────────────────

  /** قائمة HR — بلا أسماء المقيّمين */
  async listResults(cycleId: string) {
    await this.getCycle(cycleId);
    const rows = await this.prisma.appraisalResult.findMany({ where: { cycleId }, orderBy: { finalScore: 'desc' } });
    return rows.map((r) => ({ ...r, employeeName: (r.details as any)?.employee?.name ?? null }));
  }

  /** تقدّم الإدخال: كم تقييم مطلوب وكم أُرسل لكل محور */
  async progress(cycleId: string) {
    await this.getCycle(cycleId);
    const dir = await this.data.loadDirectory();
    const expected: Record<string, number> = { SELF: 0, MANAGER: 0, UPWARD: 0, PEER: 0 };
    for (const e of dir.all) {
      expected.SELF++;
      expected.MANAGER += dir.subordinatesOf(e.id).length;
      if (dir.managerOf(e.id)) expected.UPWARD++;
      expected.PEER += dir.peersOf(e.id).length;
    }
    const grouped = await this.prisma.appraisalSubmission.groupBy({
      by: ['axis', 'status'], where: { cycleId }, _count: { _all: true },
    });
    return MANUAL_AXES.map((axis) => ({
      axis,
      expected: expected[axis],
      submitted: grouped.find((g) => g.axis === axis && g.status === 'SUBMITTED')?._count._all ?? 0,
      drafts: grouped.find((g) => g.axis === axis && g.status === 'DRAFT')?._count._all ?? 0,
    }));
  }

  /**
   * تفصيل نتيجة موظف لـ HR. أسماء مقيّمي الزملاء/المرؤوسين لا تظهر إلا بصلاحية
   * التدقيق (قرار 6: السرية — HR فقط عند الحاجة).
   */
  async resultDetail(cycleId: string, employeeId: string, withRaters: boolean) {
    const result = await this.prisma.appraisalResult.findUnique({ where: { cycleId_employeeId: { cycleId, employeeId } } });
    if (!result) throw new NotFoundException('لا توجد نتيجة محسوبة لهذا الموظف');
    const subs = await this.prisma.appraisalSubmission.findMany({
      where: { cycleId, evaluateeId: employeeId },
      include: { answers: true },
      orderBy: { axis: 'asc' },
    });
    let names = new Map<string, string>();
    if (withRaters) {
      const dir = await this.data.loadDirectory();
      names = new Map(dir.all.map((e) => [e.id, e.name]));
    }
    return {
      result,
      submissions: subs.map((s) => {
        const anonymous = s.axis === 'PEER' || s.axis === 'UPWARD';
        const showRater = !anonymous || withRaters;
        return {
          axis: s.axis, status: s.status, scorePercent: s.scorePercent, submittedAt: s.submittedAt,
          comments: s.comments, achievementNote: s.achievementNote, hasAchievementFile: !!s.achievementFileUrl,
          evaluatorId: showRater ? s.evaluatorId : null,
          evaluatorName: showRater ? names.get(s.evaluatorId) ?? null : null,
          answers: s.answers,
        };
      }),
    };
  }

  /** نتيجتي — تظهر بعد التجميد فقط، ومحاور الزملاء/المرؤوسين كمتوسط وعدد بلا أسماء */
  async myResult(cycleId: string, userId: string) {
    const cycle = await this.getCycle(cycleId);
    if (cycle.status !== 'FINALIZED') throw new BadRequestException('النتائج لم تُعتمد بعد');
    const meId = await this.me(userId);
    const r = await this.prisma.appraisalResult.findUnique({ where: { cycleId_employeeId: { cycleId, employeeId: meId } } });
    if (!r) throw new NotFoundException('لا توجد نتيجة لك بهذه الدورة');
    const d = r.details as any;
    return {
      cycle: { id: cycle.id, code: cycle.code, nameAr: cycle.nameAr },
      axes: AXES.map((a) => ({
        axis: a,
        percent: (r as any)[`${a.toLowerCase()}Percent`] ?? null,
        weight: (r.appliedWeights as any)?.[a] ?? 0,
      })),
      peerCount: r.peerCount,
      upwardCount: r.upwardCount,
      commitment: { score: d?.commitment?.score, deductions: d?.commitment?.deductions, bonus: d?.commitment?.bonus },
      finalScore: r.finalScore,
      bonusTier: r.bonusTier,
      missingAxes: r.missingAxes,
    };
  }
}
