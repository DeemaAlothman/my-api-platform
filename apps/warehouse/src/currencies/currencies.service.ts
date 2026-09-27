import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCurrencyDto, SetExchangeRateDto } from './dto/currency.dto';

@Injectable()
export class CurrenciesService {
  constructor(private readonly prisma: PrismaService) {}

  listCurrencies() {
    return this.prisma.currency.findMany({ orderBy: { code: 'asc' } });
  }

  async createCurrency(dto: CreateCurrencyDto) {
    const existing = await this.prisma.currency.findUnique({ where: { code: dto.code } });
    if (existing) throw new BadRequestException({ code: 'DUPLICATE_CODE', message: 'يوجد عملة بنفس الكود مسبقاً' });

    if (dto.isBaseCurrency) {
      return this.prisma.$transaction(async (tx) => {
        await tx.currency.updateMany({ where: { isBaseCurrency: true }, data: { isBaseCurrency: false } });
        return tx.currency.create({ data: { code: dto.code, name: dto.name, isBaseCurrency: true } });
      });
    }
    return this.prisma.currency.create({ data: { code: dto.code, name: dto.name, isBaseCurrency: false } });
  }

  // عملة الأساس ديناميكية — لا تُثبَّت بالكود، هي أي عملة عليها isBaseCurrency=true (واحدة فقط دائماً)
  async setBaseCurrency(id: string) {
    const currency = await this.prisma.currency.findUnique({ where: { id } });
    if (!currency) throw new NotFoundException({ code: 'CURRENCY_NOT_FOUND', message: 'العملة غير موجودة' });

    return this.prisma.$transaction(async (tx) => {
      await tx.currency.updateMany({ where: { isBaseCurrency: true }, data: { isBaseCurrency: false } });
      return tx.currency.update({ where: { id }, data: { isBaseCurrency: true } });
    });
  }

  async addExchangeRate(currencyId: string, dto: SetExchangeRateDto, userId: string) {
    const currency = await this.prisma.currency.findUnique({ where: { id: currencyId } });
    if (!currency) throw new NotFoundException({ code: 'CURRENCY_NOT_FOUND', message: 'العملة غير موجودة' });
    if (currency.isBaseCurrency) {
      throw new BadRequestException({ code: 'BASE_CURRENCY_RATE_FIXED', message: 'عملة الأساس سعر صرفها دائماً 1 — لا حاجة لتسجيل سعر لها' });
    }
    return this.prisma.exchangeRate.create({
      data: { currencyId, rate: dto.rate, enteredByUserId: userId },
    });
  }

  async listExchangeRates(currencyId: string) {
    return this.prisma.exchangeRate.findMany({ where: { currencyId }, orderBy: { effectiveFrom: 'desc' } });
  }

  // السعر الحالي الفعّال — 1 دائماً لعملة الأساس، وإلا آخر سعر مُدخل
  async getCurrentRate(currencyId: string): Promise<number> {
    const currency = await this.prisma.currency.findUnique({ where: { id: currencyId } });
    if (!currency) throw new NotFoundException({ code: 'CURRENCY_NOT_FOUND', message: 'العملة غير موجودة' });
    if (currency.isBaseCurrency) return 1;

    const latest = await this.prisma.exchangeRate.findFirst({
      where: { currencyId },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (!latest) throw new BadRequestException({ code: 'NO_EXCHANGE_RATE', message: 'لا يوجد سعر صرف مسجَّل لهذه العملة بعد' });
    return Number(latest.rate);
  }
}
