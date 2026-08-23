import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertReviewDto } from './dto/review.dto';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(receptionId: string, dto: UpsertReviewDto, userId: string) {
    const reception = await this.prisma.podiatryReception.findUnique({ where: { id: receptionId } });
    if (!reception) throw new NotFoundException('Reception not found');

    return this.prisma.podiatryReview.create({
      data: { receptionId, notes: dto.notes ?? null, createdBy: userId },
    });
  }

  async findAll(receptionId: string) {
    const reception = await this.prisma.podiatryReception.findUnique({ where: { id: receptionId } });
    if (!reception) throw new NotFoundException('Reception not found');
    return this.prisma.podiatryReview.findMany({
      where:   { receptionId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(receptionId: string, reviewId: string, dto: UpsertReviewDto, userId: string) {
    const review = await this.prisma.podiatryReview.findFirst({ where: { id: reviewId, receptionId } });
    if (!review) throw new NotFoundException('Review not found');
    return this.prisma.podiatryReview.update({
      where: { id: reviewId },
      data:  { notes: dto.notes ?? null, updatedBy: userId },
    });
  }

  async remove(receptionId: string, reviewId: string) {
    const review = await this.prisma.podiatryReview.findFirst({ where: { id: reviewId, receptionId } });
    if (!review) throw new NotFoundException('Review not found');
    return this.prisma.podiatryReview.delete({ where: { id: reviewId } });
  }
}
