import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddCommentDto } from './dto/reward.dto';

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveEmployeeId(userId: string): Promise<string> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM users.employees WHERE "userId" = $1 AND "deletedAt" IS NULL LIMIT 1`,
      userId,
    );
    if (!rows.length) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'لا يوجد سجل موظف مرتبط بهذا الحساب' });
    return rows[0].id;
  }

  async addComment(candidateId: string, dto: AddCommentDto, userId: string) {
    const candidate = await this.prisma.candidate.findUnique({ where: { id: candidateId } });
    if (!candidate) throw new NotFoundException({ code: 'CANDIDATE_NOT_FOUND', message: 'الفائز/المرشح غير موجود' });
    const employeeId = await this.resolveEmployeeId(userId);
    return this.prisma.comment.create({ data: { candidateId, employeeId, text: dto.text } });
  }

  listComments(candidateId: string) {
    return this.prisma.comment.findMany({ where: { candidateId }, orderBy: { createdAt: 'asc' } });
  }

  async deleteComment(commentId: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment) throw new NotFoundException({ code: 'COMMENT_NOT_FOUND', message: 'التعليق غير موجود' });
    await this.prisma.comment.delete({ where: { id: commentId } });
    return { message: 'تم حذف التعليق' };
  }
}
