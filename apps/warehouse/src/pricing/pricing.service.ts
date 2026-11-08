import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ListProstheticsPricingQueryDto, UpsertItemMarkupDto } from './dto/pricing.dto';

@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  // قطع الأطراف الصناعية = كل صنف عنده partCode (مفتاح الربط مع مكوّنات الأطراف الصناعية)
  // وعنده فعلياً فاتورة شراء مرحَّلة واحدة عالأقل. آخر/أعلى سعر يُحسبان لحظياً من فواتير
  // الشراء المرحَّلة نفسها — ما بيترحّزنوا، فبيضلوا محدَّثين تلقائياً مع كل شراء جديد
  async listProstheticsPricing(query: ListProstheticsPricingQueryDto) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;
    const search = query.search?.trim();

    const searchCondition = search ? `AND (i.name ILIKE $3 OR i."nameAr" ILIKE $3 OR i.sku ILIKE $3 OR i."partCode" ILIKE $3)` : '';
    const params: any[] = [limit, skip];
    if (search) params.push(`%${search}%`);

    const items = await this.prisma.$queryRawUnsafe<Array<{
      id: string; sku: string; partCode: string; name: string | null; nameAr: string | null;
      lastPurchasePrice: string | null; highestPurchasePrice: string | null;
    }>>(
      `SELECT i.id, i.sku, i."partCode", i.name, i."nameAr",
        (SELECT pii."unitPrice" FROM warehouse.purchase_invoice_items pii
           JOIN warehouse.purchase_invoices pi ON pi.id = pii."purchaseInvoiceId"
           WHERE pii."itemId" = i.id AND pi.status = 'POSTED'
           ORDER BY pi."invoiceDate" DESC, pi."approvedAt" DESC
           LIMIT 1) AS "lastPurchasePrice",
        (SELECT MAX(pii."unitPrice") FROM warehouse.purchase_invoice_items pii
           JOIN warehouse.purchase_invoices pi ON pi.id = pii."purchaseInvoiceId"
           WHERE pii."itemId" = i.id AND pi.status = 'POSTED') AS "highestPurchasePrice"
       FROM warehouse.items i
       WHERE i."partCode" IS NOT NULL AND i."deletedAt" IS NULL
         AND EXISTS (
           SELECT 1 FROM warehouse.purchase_invoice_items pii2
           JOIN warehouse.purchase_invoices pi2 ON pi2.id = pii2."purchaseInvoiceId"
           WHERE pii2."itemId" = i.id AND pi2.status = 'POSTED'
         )
         ${searchCondition}
       ORDER BY i.name ASC
       LIMIT $1 OFFSET $2`,
      ...params,
    );

    const countParams: any[] = [];
    const countSearchCondition = search ? `AND (i.name ILIKE $1 OR i."nameAr" ILIKE $1 OR i.sku ILIKE $1 OR i."partCode" ILIKE $1)` : '';
    if (search) countParams.push(`%${search}%`);
    const countRows = await this.prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*)::int as count FROM warehouse.items i
       WHERE i."partCode" IS NOT NULL AND i."deletedAt" IS NULL
         AND EXISTS (
           SELECT 1 FROM warehouse.purchase_invoice_items pii2
           JOIN warehouse.purchase_invoices pi2 ON pi2.id = pii2."purchaseInvoiceId"
           WHERE pii2."itemId" = i.id AND pi2.status = 'POSTED'
         )
         ${countSearchCondition}`,
      ...countParams,
    );
    const total = Number(countRows[0]?.count ?? 0);

    const itemIds = items.map((i) => i.id);
    const markups = itemIds.length
      ? await this.prisma.itemPricingMarkup.findMany({ where: { itemId: { in: itemIds } } })
      : [];
    const markupMap = new Map(markups.map((m) => [m.itemId, m]));

    const enriched = items.map((i) => {
      const markup = markupMap.get(i.id);
      const priceBasis = markup?.priceBasis ?? 'LAST_PURCHASE';
      const markupAmount = markup ? Number(markup.markupAmount) : 0;
      const lastPurchasePrice = i.lastPurchasePrice !== null ? Number(i.lastPurchasePrice) : null;
      const highestPurchasePrice = i.highestPurchasePrice !== null ? Number(i.highestPurchasePrice) : null;
      const basePrice = priceBasis === 'HIGHEST_PURCHASE' ? highestPurchasePrice : lastPurchasePrice;
      return {
        itemId: i.id,
        sku: i.sku,
        partCode: i.partCode,
        name: i.name,
        nameAr: i.nameAr,
        lastPurchasePrice,
        highestPurchasePrice,
        priceBasis,
        markupAmount,
        finalPrice: basePrice !== null ? basePrice + markupAmount : null,
      };
    });

    return { items: enriched, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  async upsertMarkup(itemId: string, dto: UpsertItemMarkupDto, userId: string) {
    const item = await this.prisma.item.findFirst({ where: { id: itemId, deletedAt: null } });
    if (!item) throw new NotFoundException({ code: 'ITEM_NOT_FOUND', message: 'الصنف غير موجود' });
    if (!item.partCode) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'هذا الصنف ليس قطعة أطراف صناعية (بدون partCode)' });
    }

    return this.prisma.itemPricingMarkup.upsert({
      where: { itemId },
      create: {
        itemId,
        markupAmount: dto.markupAmount,
        priceBasis: (dto.priceBasis as any) ?? 'LAST_PURCHASE',
        updatedByUserId: userId,
      },
      update: {
        markupAmount: dto.markupAmount,
        ...(dto.priceBasis ? { priceBasis: dto.priceBasis as any } : {}),
        updatedByUserId: userId,
      },
    });
  }
}
