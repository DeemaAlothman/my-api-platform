import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateSourceDto, UpdateSourceDto,
  CreateVisitDto, UpdateVisitDto,
  ListSourcesQueryDto,
} from './dto/source.dto';

@Injectable()
export class SourcesService {
  constructor(private prisma: PrismaService) {}

  // ── Sources ───────────────────────────────────────────────────────

  async create(dto: CreateSourceDto, userId: string) {
    return this.prisma.referralSource.create({
      data: { ...dto, createdBy: userId },
    });
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

    const [items, total] = await Promise.all([
      this.prisma.referralSource.findMany({
        where,
        include: { _count: { select: { visits: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.referralSource.count({ where }),
    ]);

    return { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
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
    return source;
  }

  async update(id: string, dto: UpdateSourceDto) {
    await this.findOne(id);
    return this.prisma.referralSource.update({
      where: { id },
      data: dto,
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

  async getPatientCount(sourceId: string): Promise<{ sourceId: string; patientCount: number }> {
    await this.findOne(sourceId);
    const rows = await this.prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count
      FROM clinic_patients.patients
      WHERE "referralSourceId" = ${sourceId}
        AND "deletedAt" IS NULL
    `;
    return { sourceId, patientCount: Number(rows[0].count) };
  }

  async getStats() {
    const [byType, topSources, patientCounts] = await Promise.all([
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
      this.prisma.$queryRaw<{ referralSourceId: string; count: bigint }[]>`
        SELECT "referralSourceId", COUNT(*) as count
        FROM clinic_patients.patients
        WHERE "referralSourceId" IS NOT NULL
          AND "deletedAt" IS NULL
        GROUP BY "referralSourceId"
      `,
    ]);

    const patientCountMap = new Map(
      patientCounts.map(r => [r.referralSourceId, Number(r.count)])
    );

    const topSourcesWithPatients = topSources.map(s => ({
      ...s,
      patientCount: patientCountMap.get(s.id) ?? 0,
    }));

    return { byType, topSources: topSourcesWithPatients };
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
    return this.prisma.referralVisit.findMany({
      where: { sourceId },
      orderBy: { visitDate: 'desc' },
    });
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
