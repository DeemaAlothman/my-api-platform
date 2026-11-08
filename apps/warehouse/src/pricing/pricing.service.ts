import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertProstheticsPricingSettingsDto } from './dto/pricing.dto';

@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  // السعر النهائي = الأساس (آخر/أعلى سعر شراء) + markupAmount الثابت + قيمة الربح (ثابتة
  // أو نسبة من الأساس). null لو الأساس نفسه مش متوفر بعد (ما في شراء فعلي لهالقطعة لسا)
  private computeFinalPrice(
    basePrice: number | null,
    markupAmount: number,
    profitType: 'FIXED' | 'PERCENT' | null,
    profitValue: number | null,
  ): number | null {
    if (basePrice === null) return null;
    const profitAmount = profitType === 'PERCENT' ? (basePrice * (profitValue ?? 0)) / 100 : (profitValue ?? 0);
    return basePrice + markupAmount + profitAmount;
  }

  // إعداد عام واحد (singleton) — يُطبَّق على كل قطع الأطراف الصناعية بدون استثناء.
  // ما في صف محفوظ بعد = قيم افتراضية (بدون ربح إضافي، آخر سعر شراء، صفر قيمة ثابتة)
  async getSettings() {
    const settings = await this.prisma.prostheticsPricingSettings.findFirst({ orderBy: { createdAt: 'asc' } });
    return (
      settings ?? {
        id: null,
        priceBasis: 'LAST_PURCHASE' as const,
        markupAmount: 0,
        profitType: null,
        profitValue: null,
        updatedByUserId: null,
        updatedAt: null,
      }
    );
  }

  async upsertSettings(dto: UpsertProstheticsPricingSettingsDto, userId: string) {
    const existing = await this.prisma.prostheticsPricingSettings.findFirst();
    const data = {
      markupAmount: dto.markupAmount,
      priceBasis: (dto.priceBasis as any) ?? 'LAST_PURCHASE',
      profitType: (dto.profitType as any) ?? null,
      profitValue: dto.profitValue ?? null,
      updatedByUserId: userId,
    };
    if (existing) {
      return this.prisma.prostheticsPricingSettings.update({ where: { id: existing.id }, data });
    }
    return this.prisma.prostheticsPricingSettings.create({ data });
  }

  // السعر النهائي لصنف واحد — تُستخدم من QuotationsService لتسعير بنود العروض تلقائياً.
  // null يعني: الصنف مش قطعة أطراف صناعية (بدون partCode)، أو ما عنده فاتورة شراء مرحَّلة بعد
  async getFinalPriceForItem(itemId: string): Promise<number | null> {
    const item = await this.prisma.item.findFirst({ where: { id: itemId, deletedAt: null } });
    if (!item?.partCode) return null;

    const rows = await this.prisma.$queryRawUnsafe<Array<{ lastPurchasePrice: string | null; highestPurchasePrice: string | null }>>(
      `SELECT
         (SELECT pii."unitPrice" FROM warehouse.purchase_invoice_items pii
            JOIN warehouse.purchase_invoices pi ON pi.id = pii."purchaseInvoiceId"
            WHERE pii."itemId" = $1 AND pi.status = 'POSTED'
            ORDER BY pi."invoiceDate" DESC, pi."approvedAt" DESC
            LIMIT 1) AS "lastPurchasePrice",
         (SELECT MAX(pii."unitPrice") FROM warehouse.purchase_invoice_items pii
            JOIN warehouse.purchase_invoices pi ON pi.id = pii."purchaseInvoiceId"
            WHERE pii."itemId" = $1 AND pi.status = 'POSTED') AS "highestPurchasePrice"`,
      itemId,
    );
    const lastPurchasePrice = rows[0]?.lastPurchasePrice != null ? Number(rows[0].lastPurchasePrice) : null;
    const highestPurchasePrice = rows[0]?.highestPurchasePrice != null ? Number(rows[0].highestPurchasePrice) : null;
    if (lastPurchasePrice === null && highestPurchasePrice === null) return null;

    const settings = await this.getSettings();
    const basePrice = settings.priceBasis === 'HIGHEST_PURCHASE' ? highestPurchasePrice : lastPurchasePrice;
    return this.computeFinalPrice(basePrice, Number(settings.markupAmount), settings.profitType as any, settings.profitValue != null ? Number(settings.profitValue) : null);
  }
}
