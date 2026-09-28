import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StockService } from '../stock/stock.service';

function dateRange(dateFrom?: string, dateTo?: string) {
  const range: any = {};
  if (dateFrom) range.gte = new Date(dateFrom);
  if (dateTo) range.lte = new Date(dateTo);
  return Object.keys(range).length ? range : undefined;
}

// السعر الفعّال لكل صنف حسب طريقة التكلفة المعتمدة له تحديداً (قرار: لكل قطعة طريقتها الخاصة)
function unitCostFor(item: { costingMethod: string }, balance: { avgUnitCost: any; lastUnitCost: any; highestUnitCost: any }): number {
  if (item.costingMethod === 'LAST_PRICE') return Number(balance.lastUnitCost ?? 0);
  if (item.costingMethod === 'HIGHEST_PRICE') return Number(balance.highestUnitCost ?? 0);
  return Number(balance.avgUnitCost ?? 0); // AVERAGE_PRICE هو الافتراضي
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
  ) {}

  // قيمة المخزون الحالي — لكل صنف/مستودع حسب طريقة التكلفة المعتمدة على الصنف نفسه
  async stockValuation(warehouseId?: string) {
    const where: any = { onHandQty: { gt: 0 } };
    if (warehouseId) where.warehouseId = warehouseId;

    const balances = await this.prisma.stockBalance.findMany({
      where,
      include: { item: { include: { unit: true } }, warehouse: true },
    });

    const rows = balances.map((b) => {
      const unitCost = unitCostFor(b.item, b);
      const onHand = Number(b.onHandQty);
      return {
        warehouseId: b.warehouseId,
        warehouseName: b.warehouse.name,
        itemId: b.itemId,
        itemName: b.item.name,
        sku: b.item.sku,
        costingMethod: b.item.costingMethod,
        onHandQty: onHand,
        unitCost,
        totalValue: onHand * unitCost,
      };
    });
    const totalValue = rows.reduce((s, r) => s + r.totalValue, 0);
    return { items: rows, totalValue, count: rows.length };
  }

  lowStock(warehouseId?: string) {
    return this.stock.lowStock(warehouseId);
  }

  // ملخص حركة المخزون بفترة — إجمالي وارد/صادر لكل صنف/مستودع
  async stockMovementsSummary(query: { dateFrom?: string; dateTo?: string; warehouseId?: string; itemId?: string }) {
    const where: any = {};
    const createdAt = dateRange(query.dateFrom, query.dateTo);
    if (createdAt) where.createdAt = createdAt;
    if (query.warehouseId) where.warehouseId = query.warehouseId;
    if (query.itemId) where.itemId = query.itemId;

    const movements = await this.prisma.stockMovement.findMany({
      where,
      include: { item: true, warehouse: true },
    });

    const byKey = new Map<string, any>();
    for (const m of movements) {
      const key = `${m.warehouseId}:${m.itemId}`;
      if (!byKey.has(key)) {
        byKey.set(key, {
          warehouseId: m.warehouseId, warehouseName: m.warehouse.name,
          itemId: m.itemId, itemName: m.item.name, sku: m.item.sku,
          totalIn: 0, totalOut: 0, movementsCount: 0,
        });
      }
      const row = byKey.get(key);
      const delta = Number(m.onHandDelta);
      if (delta > 0) row.totalIn += delta; else row.totalOut += Math.abs(delta);
      row.movementsCount += 1;
    }
    return { items: Array.from(byKey.values()), dateFrom: query.dateFrom, dateTo: query.dateTo };
  }

  // ملخص المشتريات المرحّلة فعلياً (POSTED) — حسب المورّد والعملة
  async purchasesSummary(query: { dateFrom?: string; dateTo?: string }) {
    const invoiceDate = dateRange(query.dateFrom, query.dateTo);
    const where: any = { status: 'POSTED' };
    if (invoiceDate) where.invoiceDate = invoiceDate;

    const invoices = await this.prisma.purchaseInvoice.findMany({
      where,
      include: { supplier: true, currency: true },
    });

    const bySupplier = new Map<string, any>();
    for (const inv of invoices) {
      if (!bySupplier.has(inv.supplierId)) {
        bySupplier.set(inv.supplierId, { supplierId: inv.supplierId, supplierName: inv.supplier.name, invoicesCount: 0, byCurrency: {} as Record<string, number> });
      }
      const row = bySupplier.get(inv.supplierId);
      row.invoicesCount += 1;
      row.byCurrency[inv.currency.code] = (row.byCurrency[inv.currency.code] ?? 0) + Number(inv.total);
    }
    return { suppliers: Array.from(bySupplier.values()), totalInvoices: invoices.length, dateFrom: query.dateFrom, dateTo: query.dateTo };
  }

  // ملخص المبيعات المعتمدة + نسبة تحوّل العروض لفواتير
  async salesSummary(query: { dateFrom?: string; dateTo?: string }) {
    const invoiceDate = dateRange(query.dateFrom, query.dateTo);
    const invWhere: any = { status: 'APPROVED' };
    if (invoiceDate) invWhere.invoiceDate = invoiceDate;

    const invoices = await this.prisma.salesInvoice.findMany({ where: invWhere, include: { currency: true } });
    const byCurrency: Record<string, { count: number; total: number }> = {};
    for (const inv of invoices) {
      const code = inv.currency.code;
      if (!byCurrency[code]) byCurrency[code] = { count: 0, total: 0 };
      byCurrency[code].count += 1;
      byCurrency[code].total += Number(inv.total);
    }

    const createdAt = dateRange(query.dateFrom, query.dateTo);
    const quoWhere: any = {};
    if (createdAt) quoWhere.createdAt = createdAt;
    const quotationsByStatus = await this.prisma.quotation.groupBy({
      by: ['status'],
      where: quoWhere,
      _count: { _all: true },
    });

    return {
      byCurrency,
      totalInvoices: invoices.length,
      quotationsByStatus: quotationsByStatus.map((q) => ({ status: q.status, count: q._count._all })),
      dateFrom: query.dateFrom, dateTo: query.dateTo,
    };
  }

  // ملخص طلبات المواد — حسب الحالة + الأصناف الأكثر طلباً
  async materialRequestsSummary(query: { dateFrom?: string; dateTo?: string }) {
    const createdAt = dateRange(query.dateFrom, query.dateTo);
    const where: any = {};
    if (createdAt) where.createdAt = createdAt;

    const [byStatus, requests] = await Promise.all([
      this.prisma.materialRequest.groupBy({ by: ['status'], where, _count: { _all: true } }),
      this.prisma.materialRequest.findMany({ where, include: { items: { include: { item: true } } } }),
    ]);

    const byItem = new Map<string, any>();
    for (const req of requests) {
      for (const it of req.items) {
        if (!byItem.has(it.itemId)) byItem.set(it.itemId, { itemId: it.itemId, itemName: it.item.name, sku: it.item.sku, totalRequestedQty: 0 });
        byItem.get(it.itemId).totalRequestedQty += Number(it.requestedQty);
      }
    }
    const topItems = Array.from(byItem.values()).sort((a, b) => b.totalRequestedQty - a.totalRequestedQty).slice(0, 10);

    return {
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count._all })),
      topItems,
      totalRequests: requests.length,
      dateFrom: query.dateFrom, dateTo: query.dateTo,
    };
  }

  // ملخص المرتجعات — عدد وكمية حسب النوع
  async returnsSummary(query: { dateFrom?: string; dateTo?: string }) {
    const createdAt = dateRange(query.dateFrom, query.dateTo);
    const where: any = {};
    if (createdAt) where.createdAt = createdAt;

    const returns = await this.prisma.return.findMany({ where, include: { items: true } });
    const byType = new Map<string, { returnType: string; count: number; totalQty: number }>();
    for (const r of returns) {
      if (!byType.has(r.returnType)) byType.set(r.returnType, { returnType: r.returnType, count: 0, totalQty: 0 });
      const row = byType.get(r.returnType)!;
      row.count += 1;
      row.totalQty += r.items.reduce((s, it) => s + Number(it.qty), 0);
    }
    return { byType: Array.from(byType.values()), totalReturns: returns.length, dateFrom: query.dateFrom, dateTo: query.dateTo };
  }

  // فروقات آخر جرد مكتمل لكل مستودع (أو مستودع محدد)
  async lastCountVariance(warehouseId?: string) {
    const where: any = { status: 'COMPLETED' };
    if (warehouseId) where.warehouseId = warehouseId;

    const warehouses = warehouseId
      ? [{ id: warehouseId }]
      : await this.prisma.warehouse.findMany({ select: { id: true } });

    const results = [];
    for (const w of warehouses) {
      const lastCount = await this.prisma.inventoryCount.findFirst({
        where: { warehouseId: w.id, status: 'COMPLETED' },
        orderBy: { completedAt: 'desc' },
        include: { items: { include: { item: true } }, warehouse: true },
      });
      if (!lastCount) continue;
      const variances = lastCount.items
        .filter((it) => it.differenceQty != null && Number(it.differenceQty) !== 0)
        .map((it) => ({
          itemId: it.itemId, itemName: it.item.name, sku: it.item.sku,
          systemQty: Number(it.systemQty), actualQty: it.actualQty != null ? Number(it.actualQty) : null,
          differenceQty: Number(it.differenceQty),
        }));
      results.push({
        warehouseId: w.id,
        warehouseName: lastCount.warehouse.name,
        documentNo: lastCount.documentNo,
        completedAt: lastCount.completedAt,
        variances,
      });
    }
    return { warehouses: results };
  }
}
