import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ErpClientService } from '../integrations/erp-client.service';
import { CreateAssignmentDto, UpdateAssignmentDto, ReorderAssignmentsDto } from './dto/assignment.dto';

@Injectable()
export class AssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly erp: ErpClientService,
  ) {}

  private async mustLoadSession(erpSessionId: string) {
    const session = await this.erp.getSession(erpSessionId);
    if (!session.exists) throw new NotFoundException({ code: 'SESSION_NOT_FOUND', message: 'الجلسة غير موجودة في النظام' });
    return session;
  }

  async listBySession(erpSessionId: string) {
    await this.mustLoadSession(erpSessionId);
    return this.prisma.sessionExerciseAssignment.findMany({
      where: { erpSessionId },
      include: { exercise: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async create(erpSessionId: string, dto: CreateAssignmentDto, assignedByUserId: string) {
    const session = await this.mustLoadSession(erpSessionId);

    const exercise = await this.prisma.exercise.findFirst({ where: { id: dto.exerciseId, deletedAt: null } });
    if (!exercise) throw new BadRequestException({ code: 'EXERCISE_NOT_FOUND', message: 'التمرين غير موجود' });

    let sortOrder = dto.sortOrder;
    if (sortOrder === undefined) {
      const last = await this.prisma.sessionExerciseAssignment.findFirst({
        where: { erpSessionId, status: 'ACTIVE' },
        orderBy: { sortOrder: 'desc' },
        select: { sortOrder: true },
      });
      sortOrder = (last?.sortOrder ?? 0) + 1;
    }

    return this.prisma.sessionExerciseAssignment.create({
      data: {
        erpPatientId: session.patientId!,
        erpSessionId,
        exerciseId: dto.exerciseId,
        assignedByUserId,
        erpTherapistId: session.physiotherapistId ?? null,
        sortOrder,
        durationSeconds: dto.durationSeconds,
        sets: dto.sets,
        reps: dto.reps,
        holdSeconds: dto.holdSeconds,
        restSeconds: dto.restSeconds,
        frequencyTextAr: dto.frequencyTextAr,
        frequencyTextEn: dto.frequencyTextEn,
        customInstructionAr: dto.customInstructionAr,
        customInstructionEn: dto.customInstructionEn,
      },
      include: { exercise: true },
    });
  }

  private async mustLoadAssignment(id: string) {
    const assignment = await this.prisma.sessionExerciseAssignment.findUnique({ where: { id } });
    if (!assignment) throw new NotFoundException({ code: 'ASSIGNMENT_NOT_FOUND', message: 'التمرين غير موجود ضمن الجلسة' });
    return assignment;
  }

  async update(id: string, dto: UpdateAssignmentDto) {
    const assignment = await this.mustLoadAssignment(id);
    if (assignment.status === 'CANCELLED') {
      throw new BadRequestException({ code: 'ASSIGNMENT_CANCELLED', message: 'لا يمكن تعديل تمرين ملغي' });
    }
    return this.prisma.sessionExerciseAssignment.update({ where: { id }, data: dto, include: { exercise: true } });
  }

  // إلغاء (وليس حذف) — يبقى ظاهراً للمريض بحالة ملغي حسب بند 6 بالتوصيف
  async cancel(id: string, reason: string | undefined, cancelledByUserId: string) {
    const assignment = await this.mustLoadAssignment(id);
    if (assignment.status === 'CANCELLED') return assignment;
    return this.prisma.sessionExerciseAssignment.update({
      where: { id },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledByUserId, cancellationReason: reason },
    });
  }

  async reorder(erpSessionId: string, dto: ReorderAssignmentsDto) {
    await this.mustLoadSession(erpSessionId);
    const ids = dto.items.map((i) => i.id);
    const existing = await this.prisma.sessionExerciseAssignment.findMany({
      where: { id: { in: ids }, erpSessionId },
      select: { id: true },
    });
    if (existing.length !== ids.length) {
      throw new BadRequestException({ code: 'INVALID_ASSIGNMENT_IDS', message: 'بعض التمارين لا تنتمي لهذه الجلسة' });
    }
    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.sessionExerciseAssignment.update({ where: { id: item.id }, data: { sortOrder: item.sortOrder } }),
      ),
    );
    // TODO (Phase 2): إرسال Notification للمريض بأن البرنامج تم تعديله (بند 7/10 بالتوصيف)
    return this.listBySession(erpSessionId);
  }

  // عرض تنفيذ المريض بالداشبورد (بند 8 بالتوصيف)
  async listExecutionsByPatient(erpPatientId: string) {
    return this.prisma.sessionExerciseAssignment.findMany({
      where: { erpPatientId },
      include: { exercise: true, executions: { orderBy: { createdAt: 'desc' }, take: 1, include: { skipReason: true } } },
      orderBy: [{ erpSessionId: 'asc' }, { sortOrder: 'asc' }],
    });
  }
}
