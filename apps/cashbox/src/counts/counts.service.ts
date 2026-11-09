import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CashBoxesService } from '../cashboxes/cashboxes.service';
import { CreateCashCountDto, ListCashCountsQueryDto } from './dto/count.dto';

@Injectable()
export class CountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cashBoxes: CashBoxesService,
  ) {}

  // يحسب الرصيد المتوقع لحظة الجرد (من الحركات)، ويجمّده مع الفرق عن الرصيد الفعلي المُدخَل
  async create(dto: CreateCashCountDto, userId: string) {
    await this.cashBoxes.findOne(dto.cashBoxId);
    const expectedBalance = await this.cashBoxes.getBalance(dto.cashBoxId, dto.currencyId);
    const variance = dto.actualBalance - expectedBalance;

    return this.prisma.cashCount.create({
      data: {
        cashBoxId: dto.cashBoxId,
        currencyId: dto.currencyId,
        expectedBalance,
        actualBalance: dto.actualBalance,
        variance,
        notes: dto.notes,
        countedByUserId: userId,
      },
      include: { currency: true, cashBox: true },
    });
  }

  async list(query: ListCashCountsQueryDto) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const where: any = {};
    if (query.cashBoxId) where.cashBoxId = query.cashBoxId;

    const [items, total] = await Promise.all([
      this.prisma.cashCount.findMany({
        where,
        include: { currency: true, cashBox: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.cashCount.count({ where }),
    ]);
    return { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }
}
