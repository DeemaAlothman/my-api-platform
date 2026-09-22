import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ErpClientService } from '../integrations/erp-client.service';
import { CompleteExerciseDto, SkipExerciseDto } from './dto/me.dto';

@Injectable()
export class MeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly erp: ErpClientService,
  ) {}

  async getProfile(patientAccountId: string, erpPatientId: string) {
    const account = await this.prisma.patientAccount.findUniqueOrThrow({ where: { id: patientAccountId } });
    const patients = await this.erp.findPatientsByIds([erpPatientId]);
    return {
      id: account.id,
      username: account.username,
      status: account.status,
      lastLoginAt: account.lastLoginAt,
      erpPatient: patients[erpPatientId] ?? null,
    };
  }

  // مواعيد المريض القادمة/الحديثة من ERP (بند 9/15 بالتوصيف)
  async getAppointments(erpPatientId: string) {
    return this.erp.getPatientAppointments(erpPatientId);
  }

  // جلسات المريض الفيزيائية من ERP — ليختار المريض جلسة منها ويرى تمارينها (مكافئ الـendpoint الإداري)
  async getSessions(erpPatientId: string) {
    return this.erp.getPatientSessions(erpPatientId);
  }

  // كل تمارين المريض عبر كل جلساته دفعة وحدة، وكل تمرين معه معلومات الجلسة التابع إلها
  async listAllExercises(erpPatientId: string, patientAccountId: string) {
    const [assignments, sessions] = await Promise.all([
      this.prisma.sessionExerciseAssignment.findMany({
        where: { erpPatientId },
        include: {
          exercise: true,
          executions: { where: { patientAccountId }, orderBy: { createdAt: 'desc' }, take: 1 },
        },
        orderBy: [{ erpSessionId: 'asc' }, { sortOrder: 'asc' }],
      }),
      this.erp.getPatientSessions(erpPatientId),
    ]);

    const sessionById = new Map(sessions.map((s) => [s.id, s]));
    // تمرين تابع لجلسة حالتها محذوفة أو مش PHYSIO ما رح يرجع أصلاً (بدل ما يرجع بـsession: null)
    const visible = assignments.filter((a) => sessionById.has(a.erpSessionId));

    const { start, end } = this.ammanTodayBoundsUtc();
    const todayCounts = visible.length
      ? await this.prisma.exerciseExecution.groupBy({
          by: ['assignmentId'],
          where: {
            patientAccountId,
            status: 'COMPLETED',
            completedAt: { gte: start, lt: end },
            assignmentId: { in: visible.map((a) => a.id) },
          },
          _count: { _all: true },
        })
      : [];
    const todayCountByAssignment = new Map(todayCounts.map((c) => [c.assignmentId, c._count._all]));

    return visible.map((a) => ({
      ...a,
      execution: a.executions[0] ?? null,
      executions: undefined,
      session: sessionById.get(a.erpSessionId),
      todayCompletedCount: todayCountByAssignment.get(a.id) ?? 0,
    }));
  }

  // حدود "اليوم" بتوقيت عمّان (UTC+3 ثابت بدون توقيت صيفي) مُعبَّرة كـUTC — لاستخدامها بفلاتر completedAt
  private ammanTodayBoundsUtc(refDate: Date = new Date()) {
    const AMMAN_OFFSET_MS = 180 * 60_000;
    const shifted = new Date(refDate.getTime() + AMMAN_OFFSET_MS);
    const dateKey = shifted.toISOString().slice(0, 10);
    const start = new Date(new Date(`${dateKey}T00:00:00.000Z`).getTime() - AMMAN_OFFSET_MS);
    const end = new Date(start.getTime() + 86_400_000);
    return { start, end };
  }

  private ammanDateKey(d: Date): string {
    return new Date(d.getTime() + 180 * 60_000).toISOString().slice(0, 10);
  }

  // سجل الإنجاز اليومي (للرسم البياني وحساب أيام الالتزام المتتالية) — بتوقيت عمّان، أيام بدون إنجاز ترجع 0
  async getDailyProgress(patientAccountId: string, days: number) {
    const n = Math.min(Math.max(Math.trunc(days) || 14, 1), 90);
    const todayKey = this.ammanDateKey(new Date());
    const todayUtcMidnight = new Date(`${todayKey}T00:00:00.000Z`);
    const rangeStartUtc = new Date(todayUtcMidnight.getTime() - (n - 1) * 86_400_000 - 180 * 60_000);

    const executions = await this.prisma.exerciseExecution.findMany({
      where: { patientAccountId, status: 'COMPLETED', completedAt: { gte: rangeStartUtc } },
      select: { completedAt: true },
    });

    const counts = new Map<string, number>();
    for (const e of executions) {
      const key = this.ammanDateKey(e.completedAt!);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const result: { date: string; completed: number }[] = [];
    for (let i = n - 1; i >= 0; i--) {
      const dayUtc = new Date(todayUtcMidnight.getTime() - i * 86_400_000);
      const key = dayUtc.toISOString().slice(0, 10);
      result.push({ date: key, completed: counts.get(key) ?? 0 });
    }
    return result;
  }

  async listSessionExercises(erpPatientId: string, erpSessionId: string, patientAccountId: string) {
    const session = await this.erp.getSession(erpSessionId);
    if (!session.exists || session.patientId !== erpPatientId) {
      throw new NotFoundException({ code: 'SESSION_NOT_FOUND', message: 'الجلسة غير موجودة' });
    }

    const assignments = await this.prisma.sessionExerciseAssignment.findMany({
      where: { erpSessionId },
      include: {
        exercise: true,
        executions: { where: { patientAccountId }, orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { sortOrder: 'asc' },
    });

    return assignments.map((a) => ({
      ...a,
      execution: a.executions[0] ?? null,
      executions: undefined,
    }));
  }

  private async mustLoadOwnAssignment(assignmentId: string, erpPatientId: string) {
    const assignment = await this.prisma.sessionExerciseAssignment.findUnique({
      where: { id: assignmentId },
      include: { exercise: true },
    });
    if (!assignment || assignment.erpPatientId !== erpPatientId) {
      throw new NotFoundException({ code: 'ASSIGNMENT_NOT_FOUND', message: 'التمرين غير موجود' });
    }
    return assignment;
  }

  // إشعار تلقائي للمعالج المسؤول (بدون أي تدخل يدوي منه) — نفس نظام إشعارات الموظفين الموجود
  // أصلاً بخدمة users (يظهر بنفس جرس الإشعارات الحالي بالداشبورد، صفر بنية جديدة)
  private async notifyTherapist(erpTherapistId: string | null | undefined, titleAr: string, messageAr: string) {
    if (!erpTherapistId) return;
    await this.prisma.$queryRawUnsafe(
      `INSERT INTO users.notifications (id, "userId", type, "titleAr", "titleEn", "messageAr", "messageEn", data, "createdAt")
       VALUES (gen_random_uuid()::text, $1, 'GENERAL'::"users"."NotificationType", $2, $2, $3, $3, $4::jsonb, NOW())`,
      erpTherapistId, titleAr, messageAr, JSON.stringify({}),
    ).catch(() => {});
  }

  private async getPatientDisplayName(erpPatientId: string): Promise<string> {
    const patients = await this.erp.findPatientsByIds([erpPatientId]);
    const p = patients[erpPatientId];
    return p ? `${p.firstName} ${p.lastName}` : 'المريض';
  }

  private async getOrCreateExecution(assignmentId: string, patientAccountId: string) {
    let execution = await this.prisma.exerciseExecution.findFirst({
      where: { assignmentId, patientAccountId, status: { in: ['NOT_STARTED', 'IN_PROGRESS'] } },
      orderBy: { createdAt: 'desc' },
    });
    if (!execution) {
      execution = await this.prisma.exerciseExecution.create({ data: { assignmentId, patientAccountId } });
    }
    return execution;
  }

  async start(assignmentId: string, erpPatientId: string, patientAccountId: string) {
    const assignment = await this.mustLoadOwnAssignment(assignmentId, erpPatientId);
    if (assignment.status === 'CANCELLED') {
      throw new ForbiddenException({ code: 'ASSIGNMENT_CANCELLED', message: 'لا يمكن بدء تمرين ملغي' });
    }
    const execution = await this.getOrCreateExecution(assignmentId, patientAccountId);
    if (execution.status === 'COMPLETED' || execution.status === 'SKIPPED') {
      return execution;
    }
    return this.prisma.exerciseExecution.update({
      where: { id: execution.id },
      data: { status: 'IN_PROGRESS', startedAt: execution.startedAt ?? new Date() },
    });
  }

  async complete(assignmentId: string, erpPatientId: string, patientAccountId: string, dto: CompleteExerciseDto) {
    const assignment = await this.mustLoadOwnAssignment(assignmentId, erpPatientId);
    if (assignment.status === 'CANCELLED') {
      throw new ForbiddenException({ code: 'ASSIGNMENT_CANCELLED', message: 'لا يمكن إكمال تمرين ملغي' });
    }
    const execution = await this.getOrCreateExecution(assignmentId, patientAccountId);
    const completedAt = new Date();
    const elapsedSeconds = execution.startedAt
      ? Math.max(0, Math.round((completedAt.getTime() - execution.startedAt.getTime()) / 1000))
      : assignment.durationSeconds;

    const minRequiredSeconds = this.minRequiredSeconds(assignment);
    if (elapsedSeconds < minRequiredSeconds) {
      throw new BadRequestException({
        code: 'EXERCISE_DURATION_NOT_ELAPSED',
        message: `لازم يمضي ${minRequiredSeconds} ثانية على الأقل قبل إكمال هذا التمرين`,
        requiredSeconds: minRequiredSeconds,
        elapsedSeconds,
      });
    }

    const updated = await this.prisma.exerciseExecution.update({
      where: { id: execution.id },
      data: {
        status: 'COMPLETED',
        startedAt: execution.startedAt ?? completedAt,
        completedAt,
        elapsedSeconds,
        completionNote: dto.completionNote,
      },
    });

    const patientName = await this.getPatientDisplayName(erpPatientId);
    this.notifyTherapist(
      assignment.erpTherapistId,
      'إكمال تمرين',
      `المريض ${patientName} أكمل تمرين "${assignment.exercise.nameAr}" من برنامجه.`,
    ).catch(() => {});

    return updated;
  }

  async skip(assignmentId: string, erpPatientId: string, patientAccountId: string, dto: SkipExerciseDto) {
    const assignment = await this.mustLoadOwnAssignment(assignmentId, erpPatientId);
    if (assignment.status === 'CANCELLED') {
      throw new ForbiddenException({ code: 'ASSIGNMENT_CANCELLED', message: 'لا يمكن تخطي تمرين ملغي' });
    }
    if (!dto.skipReasonId && !dto.skipReasonText) {
      throw new BadRequestException({ code: 'SKIP_REASON_REQUIRED', message: 'سبب التخطي إلزامي' });
    }
    let reasonNameAr: string | null = null;
    if (dto.skipReasonId) {
      const reason = await this.prisma.skipReason.findUnique({ where: { id: dto.skipReasonId } });
      if (!reason) throw new BadRequestException({ code: 'INVALID_SKIP_REASON', message: 'سبب التخطي غير صالح' });
      if (reason.nameEn.toLowerCase() === 'other' && !dto.skipReasonText) {
        throw new BadRequestException({ code: 'SKIP_REASON_TEXT_REQUIRED', message: 'يرجى كتابة سبب التخطي' });
      }
      reasonNameAr = reason.nameAr;
    }

    const execution = await this.getOrCreateExecution(assignmentId, patientAccountId);
    const updated = await this.prisma.exerciseExecution.update({
      where: { id: execution.id },
      data: {
        status: 'SKIPPED',
        completedAt: new Date(),
        skipReasonId: dto.skipReasonId,
        skipReasonText: dto.skipReasonText,
      },
    });

    const patientName = await this.getPatientDisplayName(erpPatientId);
    const reasonForMessage = dto.skipReasonText || reasonNameAr || 'غير محدد';
    this.notifyTherapist(
      assignment.erpTherapistId,
      'تخطي تمرين',
      `المريض ${patientName} تخطى تمرين "${assignment.exercise.nameAr}" — السبب: ${reasonForMessage}`,
    ).catch(() => {});

    return updated;
  }

  async listSkipReasons() {
    const reasons = await this.prisma.skipReason.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } });
    // سبب "أخرى" فقط هو اللي يتطلب نص (نفس الشرط المعتمد فعلياً بـskip()) — حتى يطلبه التطبيق من المريض قبل الإرسال
    return reasons.map((r) => ({ ...r, requiresText: r.nameEn.toLowerCase() === 'other' }));
  }

  // الحد الأدنى المطلوب (ثواني) قبل قبول "إكمال" — يطابق حساب التطبيق بالضبط، بدون احتساب أوقات الراحة (قابلة للتخطي)
  private minRequiredSeconds(assignment: { durationSeconds: number; sets: number | null; reps: number | null; holdSeconds: number | null }): number {
    const sets = assignment.sets ?? 1;
    if (assignment.reps) {
      return assignment.holdSeconds ? sets * assignment.reps * assignment.holdSeconds : sets * assignment.reps * 2;
    }
    return sets * assignment.durationSeconds;
  }

  async getProgress(erpPatientId: string, patientAccountId: string) {
    const [total, completed, skipped, inProgress] = await Promise.all([
      this.prisma.sessionExerciseAssignment.count({ where: { erpPatientId, status: 'ACTIVE' } }),
      this.prisma.exerciseExecution.count({ where: { patientAccountId, status: 'COMPLETED' } }),
      this.prisma.exerciseExecution.count({ where: { patientAccountId, status: 'SKIPPED' } }),
      this.prisma.exerciseExecution.count({ where: { patientAccountId, status: 'IN_PROGRESS' } }),
    ]);
    return { totalActiveAssignments: total, completed, skipped, inProgress };
  }
}
