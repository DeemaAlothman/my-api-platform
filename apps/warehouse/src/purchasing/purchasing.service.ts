import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CurrenciesService } from '../currencies/currencies.service';
import { InventoryCountsService } from '../inventory-counts/inventory-counts.service';
import {
  CreatePurchaseInvoiceDto,
  RejectPurchaseInvoiceDto,
  ApprovePurchaseInvoiceDto,
  RequestCancelPurchaseInvoiceDto,
  CancelPurchaseInvoiceDto,
  RejectCancelRequestDto,
} from './dto/purchase-invoice.dto';

const PRICE_FIELDS = ['unitPrice', 'baseUnitPrice', 'lineTotal'];
const INVOICE_PRICE_FIELDS = ['subtotal', 'total', 'discountType', 'discountValue', 'exchangeRate', 'subtotalBase', 'totalBase', 'usdExchangeRate', 'subtotalUSD', 'totalUSD'];

@Injectable()
export class PurchasingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currencies: CurrenciesService,
    private readonly inventoryCounts: InventoryCountsService,
  ) {}

  // يُستدعى من الـcontroller فقط لمن لا يملك warehouse.purchase_prices.view
  stripPrices(invoice: any) {
    const clone = { ...invoice };
    for (const f of INVOICE_PRICE_FIELDS) delete clone[f];
    if (Array.isArray(clone.items)) {
      clone.items = clone.items.map((it: any) => {
        const item = { ...it };
        for (const f of PRICE_FIELDS) delete item[f];
        return item;
      });
    }
    return clone;
  }

  // يضيف إجمالي الفاتورة بعملة الأساس (subtotalBase/totalBase) وبالدولار دايماً (subtotalUSD/totalUSD)
  // — محسوب فقط وقت القراءة، باستخدام exchangeRate/usdExchangeRate المجمَّدين على الفاتورة نفسها،
  // بدون أي لمس لأي عمود مخزَّن
  private async attachBaseCurrencyTotals<
    T extends { subtotal: any; total: any; exchangeRate: any; usdExchangeRate?: any; currency?: any },
  >(
    invoice: T,
  ): Promise<
    T & {
      baseCurrencyCode: string | null;
      subtotalBase: number | null;
      totalBase: number | null;
      subtotalUSD: number | null;
      totalUSD: number | null;
    }
  > {
    const baseCurrency = await this.prisma.currency.findFirst({ where: { isBaseCurrency: true } });

    let subtotalBase: number | null = null;
    let totalBase: number | null = null;
    // ما في عملة/سعر صرف بعد (قبل الاعتماد المالي) — null لحد ما يصير فيه شي يُحسَب عليه
    if (baseCurrency && invoice.exchangeRate !== null && invoice.exchangeRate !== undefined) {
      const rate = Number(invoice.exchangeRate);
      subtotalBase = Number(invoice.subtotal) * rate;
      totalBase = Number(invoice.total) * rate;
    }

    // إجمالي الفاتورة بالدولار دايماً: مباشرة لو عملة الفاتورة أصلاً دولار، وإلا بيتحول عبر
    // subtotalBase/totalBase (المحسوبين بالأعلى بشكل عام مهما كانت عملة الفاتورة) ثم عبر
    // usdExchangeRate — هيك بتضل صحيحة حتى لو انضافت عملة ثالثة غير الليرة والدولار مستقبلاً.
    // null لحد الاعتماد أو لو ما في عملة دولار مُعرَّفة أصلاً
    let subtotalUSD: number | null = null;
    let totalUSD: number | null = null;
    const currencyCode = (invoice as any).currency?.code;
    if (currencyCode === 'USD') {
      subtotalUSD = Number(invoice.subtotal);
      totalUSD = Number(invoice.total);
    } else if (
      invoice.usdExchangeRate !== null &&
      invoice.usdExchangeRate !== undefined &&
      subtotalBase !== null &&
      totalBase !== null
    ) {
      const usdRate = Number(invoice.usdExchangeRate);
      if (usdRate > 0) {
        subtotalUSD = subtotalBase / usdRate;
        totalUSD = totalBase / usdRate;
      }
    }

    return {
      ...invoice,
      baseCurrencyCode: baseCurrency?.code ?? null,
      subtotalBase,
      totalBase,
      subtotalUSD,
      totalUSD,
    };
  }

  private async generateDocumentNo(): Promise<string> {
    const last = await this.prisma.purchaseInvoice.findFirst({
      where: { documentNo: { startsWith: 'VTX-PI-' } },
      orderBy: { documentNo: 'desc' },
      select: { documentNo: true },
    });
    const n = last ? parseInt(last.documentNo.replace('VTX-PI-', ''), 10) : 0;
    return `VTX-PI-${String(n + 1).padStart(6, '0')}`;
  }

  async findOne(id: string) {
    const invoice = await this.prisma.purchaseInvoice.findUnique({
      where: { id },
      include: { items: { include: { item: true } }, supplier: true, warehouse: true, currency: true },
    });
    if (!invoice) throw new NotFoundException({ code: 'PURCHASE_INVOICE_NOT_FOUND', message: 'فاتورة الشراء غير موجودة' });
    return this.attachBaseCurrencyTotals(invoice);
  }

  async list(query: { status?: string; supplierId?: string; warehouseId?: string; page?: number; limit?: number }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.supplierId) where.supplierId = query.supplierId;
    if (query.warehouseId) where.warehouseId = query.warehouseId;

    const [items, total] = await Promise.all([
      this.prisma.purchaseInvoice.findMany({
        where,
        include: { items: { include: { item: true } }, supplier: true, warehouse: true, currency: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.purchaseInvoice.count({ where }),
    ]);
    const itemsWithBase = await Promise.all(items.map((i) => this.attachBaseCurrencyTotals(i)));
    return { items: itemsWithBase, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  // 1) إنشاء فاتورة شراء DRAFT — يجمّد سعر الصرف الحالي لحظة الإنشاء
  async create(dto: CreatePurchaseInvoiceDto, userId: string) {
    const [supplier, warehouse] = await Promise.all([
      this.prisma.supplier.findUnique({ where: { id: dto.supplierId } }),
      this.prisma.warehouse.findUnique({ where: { id: dto.warehouseId } }),
    ]);
    if (!supplier) throw new NotFoundException({ code: 'SUPPLIER_NOT_FOUND', message: 'المورّد غير موجود' });
    if (!warehouse) throw new NotFoundException({ code: 'WAREHOUSE_NOT_FOUND', message: 'المستودع غير موجود' });
    if (!dto.items?.length) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'لازم بند واحد على الأقل' });

    // أمين المستودع عادة ما بيحدد عملة أصلاً — تحسب فقط إذا انبعتت (استثناء/توافق قديم)
    const exchangeRate = dto.currencyId ? await this.currencies.getCurrentRate(dto.currencyId) : null;

    let subtotal = 0;
    const itemsData = [];
    for (const it of dto.items) {
      const item = await this.prisma.item.findFirst({ where: { id: it.itemId, deletedAt: null } });
      if (!item) throw new BadRequestException({ code: 'ITEM_NOT_FOUND', message: `الصنف غير موجود: ${it.itemId}` });
      // أمين المستودع بينشئ الفاتورة بدون سعر — 0 مؤقتاً لحد ما المدير المالي يحدده عند الاعتماد
      const unitPrice = it.unitPrice ?? 0;
      const lineTotal = it.qty * unitPrice;
      subtotal += lineTotal;
      itemsData.push({
        itemId: it.itemId,
        qty: it.qty,
        unitPrice,
        baseUnitPrice: exchangeRate !== null ? unitPrice * exchangeRate : null,
        lineTotal,
      });
    }

    let total = subtotal;
    if (dto.discountType === 'PERCENT' && dto.discountValue) total = subtotal - (subtotal * dto.discountValue) / 100;
    else if (dto.discountType === 'FIXED' && dto.discountValue) total = subtotal - dto.discountValue;
    if (total < 0) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'قيمة الخصم أكبر من إجمالي الفاتورة' });

    for (let attempt = 0; attempt < 5; attempt++) {
      const documentNo = await this.generateDocumentNo();
      try {
        const created = await this.prisma.purchaseInvoice.create({
          data: {
            documentNo,
            supplierId: dto.supplierId,
            warehouseId: dto.warehouseId,
            currencyId: dto.currencyId,
            exchangeRate,
            invoiceDate: dto.invoiceDate ? new Date(dto.invoiceDate) : new Date(),
            discountType: dto.discountType as any,
            discountValue: dto.discountValue,
            subtotal,
            total,
            createdByUserId: userId,
            items: { create: itemsData },
          },
          include: { items: { include: { item: true } }, supplier: true, warehouse: true, currency: true },
        });
        await this.notifyCfoPendingPricing(created);
        return this.attachBaseCurrencyTotals(created);
      } catch (err: any) {
        if (err?.code === 'P2002' && err?.meta?.target?.includes('documentNo')) continue;
        throw err;
      }
    }
    throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'فشل توليد رقم الفاتورة' });
  }

  // 2) اعتماد مالي — المدير المالي يحدّد هون العملة والخصم (إذا ما تحددوا وقت الإنشاء) وسعر
  // كل صنف (لا يلمس الكميات إطلاقاً، الـDTO نفسه بلا حقل كمية)، أو يعتمد مباشرة لو الأسعار
  // محدَّدة مسبقاً. سعر الصرف يُحسب هون دايماً (آخر سعر مسجَّل لحظة الاعتماد). لا يمس المخزون
  // إطلاقاً (مرحلة منفصلة عن الترحيل)
  async approve(id: string, performedByUserId: string, dto?: ApprovePurchaseInvoiceDto) {
    const invoice: any = await this.findOne(id);
    if (invoice.status !== 'DRAFT') {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'الفاتورة ليست بانتظار الاعتماد' });
    }

    const effectiveCurrencyId: string | null = dto?.currencyId ?? invoice.currencyId ?? null;
    if (!effectiveCurrencyId) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'currencyId إجباري لاعتماد فاتورة بدون عملة محدَّدة' });
    }

    const usdCurrency = await this.currencies.getUsdCurrency();
    const isUsdInvoice = !!usdCurrency && effectiveCurrencyId === usdCurrency.id;

    // سعر صرف عملة الفاتورة مقابل عملة الأساس — يدعم سعر يدوي خاص بهي الفاتورة فقط لو
    // عملتها هي الدولار (عملة الأساس سعرها ثابت 1 دايماً، ما في داعي لتخصيصه)
    const exchangeRate = isUsdInvoice
      ? dto?.exchangeRate ?? (await this.currencies.getCurrentRate(effectiveCurrencyId))
      : await this.currencies.getCurrentRate(effectiveCurrencyId);

    // سعر صرف الدولار المجمَّد خصيصاً لحساب totalUSD لاحقاً (كم ليرة = 1 دولار)، بغض النظر
    // عن عملة الفاتورة نفسها. فاضي لو الفاتورة أصلاً بالدولار (المبلغ أصلاً دولار، ما بحتاجه)
    let usdExchangeRate: number | null = null;
    if (!isUsdInvoice) {
      if (dto?.exchangeRate != null) usdExchangeRate = dto.exchangeRate;
      else if (usdCurrency) usdExchangeRate = await this.currencies.getCurrentRate(usdCurrency.id);
    }

    let priceMap: Map<string, number> | null = null;
    if (dto?.items?.length) {
      const existingIds = new Set(invoice.items.map((it: any) => it.itemId));
      const providedIds = new Set(dto.items.map((it) => it.itemId));
      const sameSet = existingIds.size === providedIds.size && [...existingIds].every((eid) => providedIds.has(eid as string));
      if (!sameSet) {
        throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'لازم تحدّد سعر كل أصناف الفاتورة، لا أكثر ولا أقل' });
      }
      priceMap = new Map(dto.items.map((it) => [it.itemId, it.unitPrice]));
    } else {
      // ما انبعتوا أسعار جديدة — لازم كل الأصناف يكون عندها سعر محدَّد مسبقاً
      const unpriced = invoice.items.filter((it: any) => Number(it.unitPrice) <= 0);
      if (unpriced.length > 0) {
        throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'لازم تحدّد سعر كل الأصناف قبل الاعتماد' });
      }
    }

    // يعاد حساب baseUnitPrice لكل البنود دايماً بسعر الصرف الجديد، حتى لو سعرها انحدّد قبل
    let subtotal = 0;
    const itemUpdates = invoice.items.map((line: any) => {
      const unitPrice = priceMap ? priceMap.get(line.itemId)! : Number(line.unitPrice);
      const qty = Number(line.qty);
      const lineTotal = qty * unitPrice;
      subtotal += lineTotal;
      return { id: line.id, unitPrice, baseUnitPrice: unitPrice * exchangeRate, lineTotal };
    });

    // الخصم بالكامل من هون — بدون تحديده بالاعتماد تصير الفاتورة بلا خصم
    const discountType = dto?.discountType ?? null;
    const discountValue = dto?.discountValue ?? null;
    let total = subtotal;
    if (discountType === 'PERCENT' && discountValue) total = subtotal - (subtotal * discountValue) / 100;
    else if (discountType === 'FIXED' && discountValue) total = subtotal - discountValue;
    if (total < 0) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'قيمة الخصم أكبر من إجمالي الفاتورة' });

    const updated = await this.prisma.$transaction(async (tx) => {
      for (const u of itemUpdates) {
        await tx.purchaseInvoiceItem.update({
          where: { id: u.id },
          data: { unitPrice: u.unitPrice, baseUnitPrice: u.baseUnitPrice, lineTotal: u.lineTotal },
        });
      }
      return tx.purchaseInvoice.update({
        where: { id },
        data: {
          currencyId: effectiveCurrencyId,
          exchangeRate,
          usdExchangeRate,
          discountType: discountType as any,
          discountValue,
          subtotal,
          total,
          status: 'APPROVED',
          approvedByUserId: performedByUserId,
          approvedAt: new Date(),
        },
        include: { items: { include: { item: true } }, supplier: true, warehouse: true, currency: true },
      });
    });

    await this.notifyStorekeeperReadyToPost(updated);
    return this.attachBaseCurrencyTotals(updated);
  }

  // إشعار المدير المالي (صلاحية requests:cfo-approve) بفاتورة جديدة بانتظار التسعير والاعتماد
  private async notifyCfoPendingPricing(invoice: { id: string; documentNo: string }) {
    try {
      const cfoUsers = await this.prisma.$queryRaw<Array<{ userId: string }>>`
        SELECT DISTINCT u.id as "userId"
        FROM users.users u
        JOIN users.user_roles ur ON ur."userId" = u.id
        JOIN users.role_permissions rp ON rp."roleId" = ur."roleId"
        JOIN users.permissions p ON p.id = rp."permissionId"
        WHERE p.name = 'requests:cfo-approve' AND u.status = 'ACTIVE'
      `;
      for (const { userId } of cfoUsers) {
        await this.prisma.$executeRawUnsafe(
          `INSERT INTO users.notifications (id, "userId", type, "titleAr", "titleEn", "messageAr", "messageEn", data, "createdAt")
           VALUES (gen_random_uuid()::text, $1, 'GENERAL'::"users"."NotificationType", $2, $2, $3, $3, $4::jsonb, NOW())`,
          userId,
          'فاتورة شراء بانتظار التسعير',
          `فاتورة شراء جديدة (${invoice.documentNo}) بانتظار تحديد الأسعار والاعتماد المالي`,
          JSON.stringify({ type: 'PURCHASE_INVOICE_PENDING_PRICING', purchaseInvoiceId: invoice.id }),
        ).catch(() => {});
      }
    } catch {
      // الإشعار لا يكسر إنشاء الفاتورة
    }
  }

  // إشعار أمين المستودع (مسؤول المستودع تبع الفاتورة تحديداً) بأنها اعتمدت وجاهزة للترحيل
  private async notifyStorekeeperReadyToPost(invoice: { id: string; documentNo: string; warehouseId: string }) {
    try {
      const warehouse = await this.prisma.warehouse.findUnique({ where: { id: invoice.warehouseId } });
      if (!warehouse?.managerEmployeeId) return;
      const rows = await this.prisma.$queryRawUnsafe<Array<{ userId: string | null }>>(
        `SELECT "userId" FROM users.employees WHERE id = $1 AND "deletedAt" IS NULL LIMIT 1`,
        warehouse.managerEmployeeId,
      );
      const userId = rows[0]?.userId;
      if (!userId) return;
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO users.notifications (id, "userId", type, "titleAr", "titleEn", "messageAr", "messageEn", data, "createdAt")
         VALUES (gen_random_uuid()::text, $1, 'GENERAL'::"users"."NotificationType", $2, $2, $3, $3, $4::jsonb, NOW())`,
        userId,
        'فاتورة شراء جاهزة للترحيل',
        `تم اعتماد فاتورة الشراء (${invoice.documentNo}) مالياً — جاهزة للترحيل للمخزون`,
        JSON.stringify({ type: 'PURCHASE_INVOICE_APPROVED', purchaseInvoiceId: invoice.id }),
      ).catch(() => {});
    } catch {
      // الإشعار لا يكسر الاعتماد
    }
  }

  async reject(id: string, dto: RejectPurchaseInvoiceDto) {
    const invoice = await this.findOne(id);
    if (invoice.status !== 'DRAFT') {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'لا يمكن رفض فاتورة تم اعتمادها أو ترحيلها' });
    }
    return this.prisma.purchaseInvoice.update({
      where: { id },
      data: { status: 'REJECTED', rejectionReason: dto.reason },
    });
  }

  // طلب إلغاء (مدير المستودع) — لفاتورة معتمدة أو مرحَّلة فقط، بانتظار قرار المدير المالي
  async requestCancel(id: string, userId: string, dto: RequestCancelPurchaseInvoiceDto) {
    const invoice = await this.findOne(id);
    if (!['APPROVED', 'POSTED'].includes(invoice.status)) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'طلب الإلغاء متاح فقط للفواتير المعتمدة أو المرحَّلة' });
    }
    const updated = await this.prisma.purchaseInvoice.update({
      where: { id },
      data: {
        statusBeforeCancelRequest: invoice.status as any,
        status: 'CANCEL_REQUESTED',
        cancelRequestedByUserId: userId,
        cancelRequestedAt: new Date(),
        cancelRequestReason: dto.reason ?? null,
      },
      include: { items: { include: { item: true } }, supplier: true, warehouse: true, currency: true },
    });
    await this.notifyCfoCancelRequested(updated);
    return this.attachBaseCurrencyTotals(updated);
  }

  // رفض طلب الإلغاء (المدير المالي) — ترجع الفاتورة لحالتها قبل الطلب، بدون أي أثر على المخزون
  async rejectCancelRequest(id: string, dto: RejectCancelRequestDto) {
    const invoice = await this.findOne(id);
    if (invoice.status !== 'CANCEL_REQUESTED') {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'لا يوجد طلب إلغاء قيد الانتظار لهذه الفاتورة' });
    }
    const restoredStatus = (invoice as any).statusBeforeCancelRequest ?? 'APPROVED';
    const updated = await this.prisma.purchaseInvoice.update({
      where: { id },
      data: { status: restoredStatus, statusBeforeCancelRequest: null },
      include: { items: { include: { item: true } }, supplier: true, warehouse: true, currency: true },
    });
    await this.notifyRequesterCancelRejected(updated, dto.reason);
    return this.attachBaseCurrencyTotals(updated);
  }

  // إلغاء فعلي نهائي (المدير المالي فقط) — مباشرة لفاتورة معتمدة/مرحَّلة، أو اعتماد طلب إلغاء قائم.
  // لو كانت مرحَّلة، يتراجع عن أثرها بالمخزون — ويُرفض الإلغاء كاملاً لو أي صنف منها ما عاد
  // متوفر بالكمية الكافية حالياً (جزء منها اتصرف لاحقاً)، صفر سماح برصيد سالب
  async cancel(id: string, performedByUserId: string, dto: CancelPurchaseInvoiceDto) {
    const invoice: any = await this.findOne(id);
    if (!['APPROVED', 'POSTED', 'CANCEL_REQUESTED'].includes(invoice.status)) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'لا يمكن إلغاء فاتورة بهذه الحالة' });
    }
    const originalStatus = invoice.status === 'CANCEL_REQUESTED' ? invoice.statusBeforeCancelRequest : invoice.status;
    const wasPosted = originalStatus === 'POSTED';

    const updated = await this.prisma.$transaction(async (tx) => {
      if (wasPosted) {
        for (const line of invoice.items) {
          const qty = Number(line.qty);
          const rows = await tx.$queryRawUnsafe<Array<{ onHandQty: string }>>(
            `SELECT "onHandQty" FROM warehouse.stock_balances WHERE "warehouseId" = $1 AND "itemId" = $2 FOR UPDATE`,
            invoice.warehouseId, line.itemId,
          );
          const onHand = rows[0] ? parseFloat(rows[0].onHandQty) : 0;
          if (onHand < qty) {
            throw new BadRequestException({
              code: 'INSUFFICIENT_STOCK_FOR_CANCEL',
              message: `لا يمكن إلغاء الفاتورة — الكمية المتوفرة حالياً من الصنف (${line.item?.name ?? line.itemId}) أقل من الكمية التي أضافتها الفاتورة، على الأغلب تم التصرف بجزء منها`,
            });
          }
        }
        for (const line of invoice.items) {
          const qty = Number(line.qty);
          const updatedRows = await tx.$queryRawUnsafe<Array<{ onHandQty: string }>>(
            `UPDATE warehouse.stock_balances SET "onHandQty" = "onHandQty" - $3, "updatedAt" = NOW()
             WHERE "warehouseId" = $1 AND "itemId" = $2 RETURNING "onHandQty"`,
            invoice.warehouseId, line.itemId, qty,
          );
          await tx.stockMovement.create({
            data: {
              itemId: line.itemId,
              warehouseId: invoice.warehouseId,
              movementType: 'RETURN_OUT',
              onHandDelta: -qty,
              reservedDelta: 0,
              balanceAfter: updatedRows[0].onHandQty,
              documentType: 'PURCHASE_INVOICE_CANCEL',
              documentId: invoice.id,
              notes: 'تراجع تلقائي عن ترحيل فاتورة شراء تم إلغاؤها',
              performedByUserId,
            },
          });
        }
      }

      return tx.purchaseInvoice.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          statusBeforeCancelRequest: null,
          cancelledByUserId: performedByUserId,
          cancelledAt: new Date(),
          cancellationReason: dto.reason ?? invoice.cancelRequestReason ?? null,
        },
        include: { items: { include: { item: true } }, supplier: true, warehouse: true, currency: true },
      });
    });

    await this.notifyCeoInvoiceCancelled(updated);
    return this.attachBaseCurrencyTotals(updated);
  }

  // إشعار المدير المالي بطلب إلغاء فاتورة بانتظار قراره
  private async notifyCfoCancelRequested(invoice: { id: string; documentNo: string }) {
    try {
      const cfoUsers = await this.prisma.$queryRaw<Array<{ userId: string }>>`
        SELECT DISTINCT u.id as "userId"
        FROM users.users u
        JOIN users.user_roles ur ON ur."userId" = u.id
        JOIN users.role_permissions rp ON rp."roleId" = ur."roleId"
        JOIN users.permissions p ON p.id = rp."permissionId"
        WHERE p.name = 'requests:cfo-approve' AND u.status = 'ACTIVE'
      `;
      for (const { userId } of cfoUsers) {
        await this.prisma.$executeRawUnsafe(
          `INSERT INTO users.notifications (id, "userId", type, "titleAr", "titleEn", "messageAr", "messageEn", data, "createdAt")
           VALUES (gen_random_uuid()::text, $1, 'GENERAL'::"users"."NotificationType", $2, $2, $3, $3, $4::jsonb, NOW())`,
          userId,
          'طلب إلغاء فاتورة شراء',
          `مدير المستودع طلب إلغاء فاتورة الشراء (${invoice.documentNo}) — بانتظار قرارك`,
          JSON.stringify({ type: 'PURCHASE_INVOICE_CANCEL_REQUESTED', purchaseInvoiceId: invoice.id }),
        ).catch(() => {});
      }
    } catch {
      // الإشعار لا يكسر الطلب
    }
  }

  // إشعار صاحب طلب الإلغاء بأن المدير المالي رفض الطلب
  private async notifyRequesterCancelRejected(invoice: { id: string; documentNo: string; cancelRequestedByUserId: string | null }, reason?: string) {
    try {
      if (!invoice.cancelRequestedByUserId) return;
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO users.notifications (id, "userId", type, "titleAr", "titleEn", "messageAr", "messageEn", data, "createdAt")
         VALUES (gen_random_uuid()::text, $1, 'GENERAL'::"users"."NotificationType", $2, $2, $3, $3, $4::jsonb, NOW())`,
        invoice.cancelRequestedByUserId,
        'تم رفض طلب إلغاء الفاتورة',
        reason
          ? `رفض المدير المالي طلب إلغاء فاتورة الشراء (${invoice.documentNo}) — السبب: ${reason}`
          : `رفض المدير المالي طلب إلغاء فاتورة الشراء (${invoice.documentNo})`,
        JSON.stringify({ type: 'PURCHASE_INVOICE_CANCEL_REJECTED', purchaseInvoiceId: invoice.id }),
      ).catch(() => {});
    } catch {
      // الإشعار لا يكسر القرار
    }
  }

  // إشعار المدير التنفيذي (دور CEO) بأي إلغاء فعلي لفاتورة شراء
  private async notifyCeoInvoiceCancelled(invoice: { id: string; documentNo: string }) {
    try {
      const ceoUsers = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(`
        SELECT DISTINCT u.id FROM users.users u
        INNER JOIN users.user_roles ur ON ur."userId" = u.id
        INNER JOIN users.roles r ON r.id = ur."roleId"
        WHERE r.name IN ('CEO', 'super_admin') AND r."deletedAt" IS NULL AND u."deletedAt" IS NULL
      `);
      for (const { id: userId } of ceoUsers) {
        await this.prisma.$executeRawUnsafe(
          `INSERT INTO users.notifications (id, "userId", type, "titleAr", "titleEn", "messageAr", "messageEn", data, "createdAt")
           VALUES (gen_random_uuid()::text, $1, 'GENERAL'::"users"."NotificationType", $2, $2, $3, $3, $4::jsonb, NOW())`,
          userId,
          'تم إلغاء فاتورة شراء',
          `تم إلغاء فاتورة الشراء (${invoice.documentNo}) نهائياً`,
          JSON.stringify({ type: 'PURCHASE_INVOICE_CANCELLED', purchaseInvoiceId: invoice.id }),
        ).catch(() => {});
      }
    } catch {
      // الإشعار لا يكسر الإلغاء
    }
  }

  // 3) الترحيل — يزيد الرصيد فعلياً ويحدّث تكلفة الوحدة (متوسط مرجّح دائماً يُحدَّث،
  // costingMethod على الصنف يحدد فقط أي رقم يُعرَض لاحقاً بالتقارير)
  async post(id: string, performedByUserId: string) {
    const invoice = await this.findOne(id);
    if (invoice.status !== 'APPROVED') {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'الفاتورة يجب اعتمادها مالياً أولاً قبل الترحيل' });
    }
    await this.inventoryCounts.assertWarehouseNotFrozen(invoice.warehouseId);

    return this.prisma.$transaction(async (tx) => {
      for (const line of invoice.items) {
        const qty = Number(line.qty);
        const baseUnitPrice = Number(line.baseUnitPrice);

        await tx.$executeRawUnsafe(
          `INSERT INTO warehouse.stock_balances ("warehouseId", "itemId", "onHandQty", "reservedQty", "updatedAt")
           VALUES ($1, $2, 0, 0, NOW())
           ON CONFLICT ("warehouseId", "itemId") DO NOTHING`,
          invoice.warehouseId, line.itemId,
        );

        const rows = await tx.$queryRawUnsafe<Array<{ onHandQty: string; avgUnitCost: string | null; highestUnitCost: string | null }>>(
          `SELECT "onHandQty", "avgUnitCost", "highestUnitCost" FROM warehouse.stock_balances
           WHERE "warehouseId" = $1 AND "itemId" = $2 FOR UPDATE`,
          invoice.warehouseId, line.itemId,
        );
        const oldOnHand = parseFloat(rows[0].onHandQty);
        const oldAvg = rows[0].avgUnitCost ? parseFloat(rows[0].avgUnitCost) : 0;
        const oldHighest = rows[0].highestUnitCost ? parseFloat(rows[0].highestUnitCost) : 0;

        const newOnHand = oldOnHand + qty;
        const newAvg = newOnHand > 0 ? (oldOnHand * oldAvg + qty * baseUnitPrice) / newOnHand : baseUnitPrice;
        const newHighest = Math.max(oldHighest, baseUnitPrice);

        const updated = await tx.$queryRawUnsafe<Array<{ onHandQty: string }>>(
          `UPDATE warehouse.stock_balances
           SET "onHandQty" = $3, "avgUnitCost" = $4, "lastUnitCost" = $5, "highestUnitCost" = $6, "updatedAt" = NOW()
           WHERE "warehouseId" = $1 AND "itemId" = $2
           RETURNING "onHandQty"`,
          invoice.warehouseId, line.itemId, newOnHand, newAvg, baseUnitPrice, newHighest,
        );

        await tx.stockMovement.create({
          data: {
            itemId: line.itemId,
            warehouseId: invoice.warehouseId,
            movementType: 'PURCHASE',
            onHandDelta: qty,
            reservedDelta: 0,
            balanceAfter: updated[0].onHandQty,
            documentType: 'PURCHASE',
            documentId: invoice.id,
            performedByUserId,
          },
        });
      }

      return tx.purchaseInvoice.update({
        where: { id },
        data: { status: 'POSTED', postedByUserId: performedByUserId, postedAt: new Date() },
        include: { items: { include: { item: true } } },
      });
    });
  }
}
