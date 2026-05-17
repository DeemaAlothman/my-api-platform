import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AttendanceBreaksService {
  constructor(private readonly prisma: PrismaService) {}

  private async findBreakOrThrow(breakId: string) {
    const brk = await this.prisma.attendanceBreak.findUnique({ where: { id: breakId } });
    if (!brk) throw new NotFoundException({ code: 'BREAK_NOT_FOUND', message: 'Break record not found' });
    return brk;
  }

  async authorize(breakId: string, reason: string) {
    if (!reason?.trim()) throw new BadRequestException('Reason is required for authorization');
    await this.findBreakOrThrow(breakId);
    return this.prisma.attendanceBreak.update({
      where: { id: breakId },
      data: { isAuthorized: true, reason },
    });
  }

  async reject(breakId: string, reason?: string) {
    await this.findBreakOrThrow(breakId);
    return this.prisma.attendanceBreak.update({
      where: { id: breakId },
      data: { isAuthorized: false, ...(reason && { reason }) },
    });
  }

  async updateType(breakId: string, type: string) {
    const validTypes = ['PRAYER', 'MEAL', 'PERSONAL', 'WORK_RELATED', 'OTHER'];
    if (!validTypes.includes(type)) {
      throw new BadRequestException(`Invalid break type. Valid values: ${validTypes.join(', ')}`);
    }
    await this.findBreakOrThrow(breakId);
    return this.prisma.attendanceBreak.update({
      where: { id: breakId },
      data: { type: type as any },
    });
  }

  async updateReason(breakId: string, reason: string) {
    await this.findBreakOrThrow(breakId);
    return this.prisma.attendanceBreak.update({
      where: { id: breakId },
      data: { reason },
    });
  }
}
