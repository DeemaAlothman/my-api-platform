import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCashBoxDto, UpdateCashBoxDto } from './dto/cashbox.dto';

@Injectable()
export class CashBoxesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.cashBox.findMany({ orderBy: [{ type: 'asc' }, { name: 'asc' }] });
  }

  async findOne(id: string) {
    const box = await this.prisma.cashBox.findUnique({ where: { id } });
    if (!box) throw new NotFoundException({ code: 'CASHBOX_NOT_FOUND', message: 'الصندوق غير موجود' });
    return box;
  }

  // صندوق رئيسي واحد بس دايماً — نفس مبدأ isBaseCurrency بالمستودع
  async create(dto: CreateCashBoxDto) {
    if (dto.type === 'MAIN') {
      return this.prisma.$transaction(async (tx) => {
        await tx.cashBox.updateMany({ where: { type: 'MAIN' }, data: { type: 'SUB' } });
        return tx.cashBox.create({
          data: { name: dto.name, custodianEmployeeId: dto.custodianEmployeeId, type: 'MAIN' },
        });
      });
    }
    return this.prisma.cashBox.create({
      data: { name: dto.name, custodianEmployeeId: dto.custodianEmployeeId, type: 'SUB' },
    });
  }

  async update(id: string, dto: UpdateCashBoxDto) {
    await this.findOne(id);
    return this.prisma.cashBox.update({ where: { id }, data: dto });
  }

  async setMain(id: string) {
    await this.findOne(id);
    return this.prisma.$transaction(async (tx) => {
      await tx.cashBox.updateMany({ where: { type: 'MAIN' }, data: { type: 'SUB' } });
      return tx.cashBox.update({ where: { id }, data: { type: 'MAIN' } });
    });
  }

  // الرصيد الحالي لصندوق بعملة معيّنة — مجموع كل الحركات، حسب نوعها واتجاهها
  async getBalance(cashBoxId: string, currencyId: string): Promise<number> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ balance: string }>>(
      `SELECT COALESCE(SUM(CASE
         WHEN "cashBoxId" = $1 AND "transactionType" = 'RECEIPT'      THEN amount
         WHEN "cashBoxId" = $1 AND "transactionType" = 'DISBURSEMENT' THEN -amount
         WHEN "cashBoxId" = $1 AND "transactionType" = 'HANDOVER'     THEN -amount
         WHEN "cashBoxId" = $1 AND "transactionType" = 'REFILL'       THEN amount
         WHEN "relatedCashBoxId" = $1 AND "transactionType" = 'HANDOVER' THEN amount
         WHEN "relatedCashBoxId" = $1 AND "transactionType" = 'REFILL'   THEN -amount
         ELSE 0
       END), 0) as balance
       FROM cashbox.cash_transactions
       WHERE "currencyId" = $2 AND ("cashBoxId" = $1 OR "relatedCashBoxId" = $1)`,
      cashBoxId, currencyId,
    );
    return Number(rows[0]?.balance ?? 0);
  }

  // أرصدة صندوق بكل العملات يلي صار فيها حركة له
  async getBalances(cashBoxId: string) {
    await this.findOne(cashBoxId);
    const currencyIds = await this.prisma.$queryRawUnsafe<Array<{ currencyId: string }>>(
      `SELECT DISTINCT "currencyId" FROM cashbox.cash_transactions
       WHERE "cashBoxId" = $1 OR "relatedCashBoxId" = $1`,
      cashBoxId,
    );
    const currencies = await this.prisma.currency.findMany({
      where: { id: { in: currencyIds.map((c) => c.currencyId) } },
    });
    const balances = await Promise.all(
      currencies.map(async (c) => ({ currency: c, balance: await this.getBalance(cashBoxId, c.id) })),
    );
    return balances;
  }
}
