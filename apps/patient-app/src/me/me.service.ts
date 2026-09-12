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
    const assignment = await this.prisma.sessionExerciseAssignment.findUnique({ where: { id: assignmentId } });
    if (!assignment || assignment.erpPatientId !== erpPatientId) {
      throw new NotFoundException({ code: 'ASSIGNMENT_NOT_FOUND', message: 'التمرين غير موجود' });
    }
    return assignment;
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

    return this.prisma.exerciseExecution.update({
      where: { id: execution.id },
      data: {
        status: 'COMPLETED',
        startedAt: execution.startedAt ?? completedAt,
        completedAt,
        elapsedSeconds,
        completionNote: dto.completionNote,
      },
    });
  }

  async skip(assignmentId: string, erpPatientId: string, patientAccountId: string, dto: SkipExerciseDto) {
    const assignment = await this.mustLoadOwnAssignment(assignmentId, erpPatientId);
    if (assignment.status === 'CANCELLED') {
      throw new ForbiddenException({ code: 'ASSIGNMENT_CANCELLED', message: 'لا يمكن تخطي تمرين ملغي' });
    }
    if (!dto.skipReasonId && !dto.skipReasonText) {
      throw new BadRequestException({ code: 'SKIP_REASON_REQUIRED', message: 'سبب التخطي إلزامي' });
    }
    if (dto.skipReasonId) {
      const reason = await this.prisma.skipReason.findUnique({ where: { id: dto.skipReasonId } });
      if (!reason) throw new BadRequestException({ code: 'INVALID_SKIP_REASON', message: 'سبب التخطي غير صالح' });
      if (reason.nameEn.toLowerCase() === 'other' && !dto.skipReasonText) {
        throw new BadRequestException({ code: 'SKIP_REASON_TEXT_REQUIRED', message: 'يرجى كتابة سبب التخطي' });
      }
    }

    const execution = await this.getOrCreateExecution(assignmentId, patientAccountId);
    return this.prisma.exerciseExecution.update({
      where: { id: execution.id },
      data: {
        status: 'SKIPPED',
        completedAt: new Date(),
        skipReasonId: dto.skipReasonId,
        skipReasonText: dto.skipReasonText,
      },
    });
  }

  async listSkipReasons() {
    return this.prisma.skipReason.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } });
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
