import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertReviewDto } from './dto/review.dto';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(receptionId: string, dto: UpsertReviewDto, userId: string) {
    const reception = await this.prisma.podiatryReception.findUnique({ where: { id: receptionId } });
    if (!reception) throw new NotFoundException('Reception not found');

    return this.prisma.podiatryReview.upsert({
      where:  { receptionId },
      create: { receptionId, notes: dto.notes ?? null, createdBy: userId },
      update: { notes: dto.notes ?? null, updatedBy: userId },
    });
  }

  async findOne(receptionId: string) {
    const reception = await this.prisma.podiatryReception.findUnique({ where: { id: receptionId } });
    if (!reception) throw new NotFoundException('Reception not found');
    return this.prisma.podiatryReview.findUnique({ where: { receptionId } });
  }
}
