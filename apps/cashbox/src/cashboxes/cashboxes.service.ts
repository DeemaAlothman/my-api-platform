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

  // الرصيد الحالي لصندوق بعملة معيّنة — مجموع كل الحركات، حسب نوعها واتجاهها.
  //
  // المالُ الخارجُ يُحسَب لحظةَ تسجيله، والداخلُ لحظةَ تأكيد مستلِمِه. فالتسليمُ
  // والتعبئةُ سطرٌ واحدٌ له طرفان يقعان في وقتين: يَخرج من المرسِل فوراً فلا
  // يَحسب نفسَه مرتين ولا يَصرِفه مرةً أخرى، ولا يَدخل المستلِمَ حتى يُقِرَّ أنه
  // قبضه فعلاً. ومن ذلك أن رفضَ الاستلام يُعيد المبلغَ إلى المرسِل من تلقائه
  // بمجرَّد تغيُّر الحالة، بلا حركةٍ معاكسةٍ تُسجَّل.
  //
  // والصرفُ المنتظِرُ موافقةَ المدير لا يُخصَم، فهو طلبٌ لم يُبَتَّ فيه بعد.
  private static readonly BALANCE_SUM = `COALESCE(SUM(CASE
         -- داخلٌ إلى هذا الصندوق: لا يُحسَب إلا منفَّذاً
         WHEN "cashBoxId" = $1 AND "transactionType" = 'RECEIPT'      AND status = 'COMPLETED' THEN amount
         WHEN "cashBoxId" = $1 AND "transactionType" = 'DEPOSIT'      AND status = 'COMPLETED' THEN amount
         WHEN "cashBoxId" = $1 AND "transactionType" = 'REFILL'       AND status = 'COMPLETED' THEN amount
         WHEN "relatedCashBoxId" = $1 AND "transactionType" = 'HANDOVER' AND status = 'COMPLETED' THEN amount
         -- خارجٌ من هذا الصندوق: يُحسَب منفَّذاً، ومنتظِراً تأكيدَ مستلِمِه
         WHEN "cashBoxId" = $1 AND "transactionType" = 'DISBURSEMENT' AND status = 'COMPLETED' THEN -amount
         WHEN "cashBoxId" = $1 AND "transactionType" = 'HANDOVER'
              AND status IN ('COMPLETED', 'PENDING_RECEIPT') THEN -amount
         WHEN "relatedCashBoxId" = $1 AND "transactionType" = 'REFILL'
              AND status IN ('COMPLETED', 'PENDING_RECEIPT') THEN -amount
         ELSE 0
       END), 0)`;

  // صاحبُ الصندوق مُسنَدٌ بمعرِّف موظف، ومن يسجِّل الحركةَ معروفٌ بمعرِّف مستخدم،
  // فلا يتطابقان حتى يُترجَم أحدُهما إلى الآخر. وبغير هذه الترجمة لا يُؤكِّد صاحبُ
  // صندوقٍ قبضَه أبداً، ولا يَصدُق التأكيدُ التلقائي لمن سجَّل لنفسه.
  async custodianUserId(cashBoxId: string): Promise<string | null> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ userId: string | null }>>(
      `SELECT e."userId"
       FROM cashbox.cash_boxes b
       JOIN users.employees e ON e.id = b."custodianEmployeeId"
       WHERE b.id = $1 AND e."deletedAt" IS NULL
       LIMIT 1`,
      cashBoxId,
    );
    return rows[0]?.userId ?? null;
  }

  async getBalance(cashBoxId: string, currencyId: string): Promise<number> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ balance: string }>>(
      `SELECT ${CashBoxesService.BALANCE_SUM} as balance
       FROM cashbox.cash_transactions
       WHERE "currencyId" = $2 AND ("cashBoxId" = $1 OR "relatedCashBoxId" = $1)`,
      cashBoxId, currencyId,
    );
    return Number(rows[0]?.balance ?? 0);
  }

  // مبالغُ معلَّقة لهذا الصندوق بكل عملة: ما ينتظر تأكيدَ هذا الصندوق فيَدخله،
  // وما خرج منه ينتظر تأكيدَ غيره فهو في الطريق. وهي خارجُ الرصيد كلُّها،
  // تُعرَض إلى جانبه لا داخله.
  async getPendingTotals(cashBoxId: string) {
    await this.findOne(cashBoxId);
    const rows = await this.prisma.$queryRawUnsafe<Array<{
      currencyId: string; code: string; name: string;
      awaitingReceipt: string; inTransit: string;
    }>>(
      `SELECT t."currencyId", c.code, c.name,
              COALESCE(SUM(CASE WHEN t.status = 'PENDING_RECEIPT' AND (
                   (t."cashBoxId" = $1 AND t."transactionType" IN ('RECEIPT', 'REFILL'))
                OR (t."relatedCashBoxId" = $1 AND t."transactionType" = 'HANDOVER')
              ) THEN t.amount ELSE 0 END), 0)::text AS "awaitingReceipt",
              COALESCE(SUM(CASE WHEN t.status = 'PENDING_RECEIPT' AND (
                   (t."cashBoxId" = $1 AND t."transactionType" = 'HANDOVER')
                OR (t."relatedCashBoxId" = $1 AND t."transactionType" = 'REFILL')
              ) THEN t.amount ELSE 0 END), 0)::text AS "inTransit"
       FROM cashbox.cash_transactions t
       JOIN cashbox.currencies c ON c.id = t."currencyId"
       WHERE t.status = 'PENDING_RECEIPT' AND (t."cashBoxId" = $1 OR t."relatedCashBoxId" = $1)
       GROUP BY t."currencyId", c.code, c.name
       ORDER BY c.code`,
      cashBoxId,
    );
    return rows.map((r) => ({
      currency: { id: r.currencyId, code: r.code, name: r.name },
      awaitingReceipt: Number(r.awaitingReceipt),
      inTransit: Number(r.inTransit),
    }));
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
