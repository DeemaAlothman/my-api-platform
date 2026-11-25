import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  private buildAssessmentData(dto: CreateSessionDto) {
    return {
      ...(dto.subjectiveHistory !== undefined && { subjectiveHistory: dto.subjectiveHistory }),
      ...(dto.visualInspection  !== undefined && { visualInspection:  dto.visualInspection }),
      ...(dto.palpation         !== undefined && { palpation:         dto.palpation }),
      ...(dto.rangeOfMotion     !== undefined && { rangeOfMotion:     dto.rangeOfMotion }),
      ...(dto.dynamicAnalysis   !== undefined && { dynamicAnalysis:   dto.dynamicAnalysis }),
      ...(dto.shoeWearPattern   !== undefined && { shoeWearPattern:   dto.shoeWearPattern }),
      ...(dto.footMeasurements  !== undefined && { footMeasurements:  dto.footMeasurements }),
      ...(dto.insoleType        !== undefined && { insoleType:        dto.insoleType }),
      ...(dto.shoeSize          !== undefined && { shoeSize:          dto.shoeSize }),
      ...(dto.insolesCount      !== undefined && { insolesCount:      dto.insolesCount }),
      ...(dto.notes             !== undefined && { notes:             dto.notes }),
      ...(dto.clinicianName     !== undefined && { clinicianName:     dto.clinicianName }),
      ...(dto.clinicianSignature !== undefined && { clinicianSignature: dto.clinicianSignature }),
      ...(dto.doctorDecision    !== undefined && { doctorDecision:    dto.doctorDecision }),
    };
  }

  async create(receptionId: string, dto: CreateSessionDto, userId: string) {
    const reception = await this.prisma.podiatryReception.findUnique({ where: { id: receptionId } });
    if (!reception) throw new NotFoundException('Reception not found');

    // الاستقبال الواحد قد تتعدّد نماذج تقييمه: كان الإنشاء يَعدِل الموجود بدل أن
    // يُنشئ، فلا يبقى للمريض إلا آخر تقييم ويُطمَس ما قبله. المراجعات وقرار
    // الطبيب تبقى واحدة لكل استقبال، فلا يمسّها هذا.

    return this.prisma.podiatrySession.create({
      data: {
        receptionId,
        patientId:   reception.patientId,
        clinicalPlan: [],
        createdBy:   userId,
        ...this.buildAssessmentData(dto),
      },
    });
  }

  private async resolveUserName(userId: string | null): Promise<string | null> {
    if (!userId) return null;
    const rows = await this.prisma.$queryRawUnsafe<Array<{ fullName: string | null }>>(
      `SELECT "fullName" FROM users.users WHERE id = $1`,
      userId,
    );
    return rows[0]?.fullName ?? null;
  }

  async findAll(receptionId: string, includeArchived = false) {
    const reception = await this.prisma.podiatryReception.findUnique({ where: { id: receptionId } });
    if (!reception) throw new NotFoundException('Reception not found');
    const sessions = await this.prisma.podiatrySession.findMany({
      where: { receptionId, ...(!includeArchived && { archivedAt: null }) },
      orderBy: [{ createdAt: 'desc' }, { sessionDate: 'desc' }],
    });
    const userIds = [...new Set(sessions.map(s => s.createdBy).filter(Boolean))];
    let userMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const placeholders = userIds.map((_, i) => `$${i + 1}`).join(',');
      const rows = await this.prisma.$queryRawUnsafe<Array<{ id: string; fullName: string | null }>>(
        `SELECT id, "fullName" FROM users.users WHERE id IN (${placeholders})`,
        ...userIds,
      );
      userMap = Object.fromEntries(rows.map(r => [r.id, r.fullName ?? '']));
    }
    return sessions.map(s => ({ ...s, createdByName: userMap[s.createdBy] ?? null }));
  }

  async findOne(receptionId: string, sessionId: string) {
    const session = await this.prisma.podiatrySession.findFirst({
      where: { id: sessionId, receptionId },
    });
    if (!session) throw new NotFoundException('Session not found');
    const createdByName = await this.resolveUserName(session.createdBy);
    return { ...session, createdByName };
  }

  async update(receptionId: string, sessionId: string, dto: UpdateSessionDto, userId?: string) {
    const before = await this.findOne(receptionId, sessionId);
    const data: any = this.buildAssessmentData(dto);

    // حالة التركيب تقود تاريخَه ومُنفِّذَه معاً، فلا يفترق المعلَن عن المسجَّل:
    // «رُكِّب» يختم الوقت وصاحبَه، وما عداه يمحوهما فلا يبقى أثر تركيبٍ أُلغي.
    if (dto.installStatus !== undefined) {
      data.installStatus = dto.installStatus ?? null;
      if (dto.installStatus === 'INSTALLED') {
        data.installedAt = (before as any).installedAt ?? new Date();
        data.installedBy = (before as any).installedBy ?? userId ?? null;
      } else {
        data.installedAt = null;
        data.installedBy = null;
      }
    }

    const updated = await this.prisma.podiatrySession.update({
      where: { id: sessionId },
      data,
    });

    if (dto.installStatus !== undefined && dto.installStatus !== (before as any).installStatus) {
      await this.logInstallStatusChange(
        receptionId, sessionId, (before as any).installStatus ?? null, dto.installStatus ?? null, userId,
      ).catch(() => {});
    }

    return updated;
  }

  // كل تغيير في حالة التركيب يُسجَّل: الحالة تُحوِّل النموذج إلى عملية بيع أو
  // تُخرجه منها، فمن يراجع المبيعات لاحقاً يحتاج أن يعرف من غيّرها ومتى.
  private async logInstallStatusChange(
    receptionId: string,
    sessionId: string,
    from: string | null,
    to: string | null,
    userId?: string,
  ) {
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO public.audit_logs ("userId", username, action, resource, "resourceId", method, path, metadata, "createdAt")
       VALUES ($1, NULL, 'PODIATRY_INSTALL_STATUS_CHANGED', 'podiatry', $2, 'PATCH', $3, $4::jsonb, NOW())`,
      userId ?? null,
      sessionId,
      `/api/v1/podiatry/receptions/${receptionId}/sessions/${sessionId}`,
      JSON.stringify({ receptionId, sessionId, from, to }),
    );
  }

  // التركيبُ ونزعُه صارا حالةً تُحدَّث بـ update، فتقود الحالةُ تاريخَها ومُنفِّذَها
  // معاً ويُسجَّل كلُّ تغيُّرٍ لها. ولم تبقَ لهما دالَّتان تكتبان التاريخَ وحدَه.

  async archive(receptionId: string, sessionId: string, userId: string) {
    await this.findOne(receptionId, sessionId);
    return this.prisma.podiatrySession.update({
      where: { id: sessionId },
      data: { archivedAt: new Date(), archivedBy: userId },
    });
  }

  // الحذف لنموذجٍ أُنشئ بالغلط. والمركَّب ليس كذلك: هو عملية بيع مسجَّلة، فحذفه
  // يُسقطها من المبيعات بلا أثر. يُنزَع تركيبه أولاً إن كان ذلك هو المقصود.
  async remove(receptionId: string, sessionId: string) {
    const session = await this.findOne(receptionId, sessionId);
    const isInstalled =
      (session as any).installStatus === 'INSTALLED' || (session as any).installedAt != null;
    if (isInstalled) {
      throw new BadRequestException({
        code: 'SESSION_INSTALLED',
        message: 'لا يمكن حذف نموذج مركَّب — يُنزَع تركيبه أولاً',
      });
    }
    return this.prisma.podiatrySession.delete({ where: { id: sessionId } });
  }
}
