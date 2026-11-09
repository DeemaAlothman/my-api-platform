import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CurrenciesService {
  constructor(private readonly prisma: PrismaService) {}

  listCurrencies() {
    return this.prisma.currency.findMany({ orderBy: { code: 'asc' } });
  }

  async createCurrency(code: string, name: string) {
    const existing = await this.prisma.currency.findUnique({ where: { code } });
    if (existing) throw new BadRequestException({ code: 'DUPLICATE_CODE', message: 'يوجد عملة بنفس الكود مسبقاً' });
    return this.prisma.currency.create({ data: { code, name } });
  }
}
