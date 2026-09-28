import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CurrenciesService } from '../currencies/currencies.service';
import {
  CreateQuotationDto, UpdateQuotationDto, NewQuotationVersionDto,
  AdjustQuotationPricesDto, AcceptQuotationDto, RejectQuotationDto,
  QuotationItemInputDto, DiscountTypeEnum,
} from './dto/quotation.dto';

const PRICE_FIELDS = ['unitPrice', 'discountType', 'discountValue', 'lineTotal'];
const QUOTATION_PRICE_FIELDS = ['subtotal', 'total', 'discountType', 'discountValue', 'exchangeRate'];

@Injectable()
export class QuotationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currencies: CurrenciesService,
  ) {}

  // نسخة "الفني" — بدون أي سعر إطلاقاً (حذف كامل للحقول، مش إخفاء بالواجهة فقط)
  technicianCopy(quotation: any) {
    const clone = { ...quotation };
    for (const f of QUOTATION_PRICE_FIELDS) delete clone[f];
    if (Array.isArray(clone.items)) {
      clone.items = clone.items.map((it: any) => {
        const item = { ...it };
        for (const f of PRICE_FIELDS) delete item[f];
        return item;
      });
    }
    return clone;
  }

  private async generateDocumentNo(): Promise<string> {
    const last = await this.prisma.quotation.findFirst({
      where: { documentNo: { startsWith: 'VTX-QT-' } },
      orderBy: { documentNo: 'desc' },
      select: { documentNo: true },
    });
    const n = last ? parseInt(last.documentNo.replace('VTX-QT-', ''), 10) : 0;
    return `VTX-QT-${String(n + 1).padStart(6, '0')}`;
  }

  private lineTotal(it: { qty: number; unitPrice: number; discountType?: DiscountTypeEnum; discountValue?: number }): number {
    const base = it.qty * it.unitPrice;
    if (it.discountType === DiscountTypeEnum.PERCENT && it.discountValue) return base - (base * it.discountValue) / 100;
    if (it.discountType === DiscountTypeEnum.FIXED && it.discountValue) return base - it.discountValue;
    return base;
  }

  private applyDiscount(subtotal: number, discountType?: DiscountTypeEnum, discountValue?: number): number {
    if (discountType === DiscountTypeEnum.PERCENT && discountValue) return subtotal - (subtotal * discountValue) / 100;
    if (discountType === DiscountTypeEnum.FIXED && discountValue) return subtotal - discountValue;
    return subtotal;
  }

  private async validateAndBuildItems(items: QuotationItemInputDto[]) {
    const rows = [];
    for (const it of items) {
      const lineType = it.lineType ?? 'ITEM';
      if (lineType === 'ITEM') {
        if (!it.itemId) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'بند من نوع ITEM يحتاج itemId' });
        const item = await this.prisma.item.findFirst({ where: { id: it.itemId, deletedAt: null } });
        if (!item) throw new BadRequestException({ code: 'ITEM_NOT_FOUND', message: `الصنف غير موجود: ${it.itemId}` });
      }
      rows.push({
        lineType: lineType as any,
        itemId: lineType === 'ITEM' ? it.itemId : null,
        description: it.description,
        qty: it.qty,
        unitPrice: it.unitPrice,
        discountType: it.discountType as any,
        discountValue: it.discountValue,
        lineTotal: this.lineTotal(it as any),
      });
    }
    return rows;
  }

  async findOne(id: string) {
    const q = await this.prisma.quotation.findUnique({
      where: { id },
      include: { items: { include: { item: true } }, currency: true, childVersions: { select: { id: true, version: true, status: true } } },
    });
    if (!q) throw new NotFoundException({ code: 'QUOTATION_NOT_FOUND', message: 'العرض غير موجود' });
    return q;
  }

  async list(query: { status?: string; patientId?: string; page?: number; limit?: number }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.patientId) where.patientId = query.patientId;

    const [items, total] = await Promise.all([
      this.prisma.quotation.findMany({
        where,
        include: { items: { include: { item: true } }, currency: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.quotation.count({ where }),
    ]);
    return { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  async create(dto: CreateQuotationDto, userId: string) {
    if (!dto.items?.length) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'لازم بند واحد على الأقل' });
    const exchangeRate = await this.currencies.getCurrentRate(dto.currencyId);
    const itemsData = await this.validateAndBuildItems(dto.items);
    const subtotal = itemsData.reduce((s, i) => s + Number(i.lineTotal), 0);
    const total = this.applyDiscount(subtotal, dto.discountType, dto.discountValue);
    if (total < 0) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'قيمة الخصم أكبر من إجمالي العرض' });

    const documentNo = await this.generateDocumentNo();
    return this.prisma.quotation.create({
      data: {
        documentNo,
        patientId: dto.patientId,
        currencyId: dto.currencyId,
        exchangeRate,
        discountType: dto.discountType as any,
        discountValue: dto.discountValue,
        subtotal,
        total,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
        paymentTerms: dto.paymentTerms,
        notes: dto.notes,
        createdByUserId: userId,
        items: { create: itemsData },
      },
      include: { items: { include: { item: true } } },
    });
  }

  // تعديل مباشر — فقط أثناء DRAFT (استبدال كامل للبنود لو أُرسلت)
  async update(id: string, dto: UpdateQuotationDto) {
    const q = await this.findOne(id);
    if (q.status !== 'DRAFT') {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'التعديل المباشر مسموح فقط أثناء المسودة — استخدمي إصدار جديد' });
    }

    let subtotal = Number(q.subtotal);
    let itemsData: any = undefined;
    if (dto.items) {
      itemsData = await this.validateAndBuildItems(dto.items);
      subtotal = itemsData.reduce((s: number, i: any) => s + Number(i.lineTotal), 0);
    }
    const discountType = dto.discountType ?? (q.discountType as any);
    const discountValue = dto.discountValue ?? (q.discountValue ? Number(q.discountValue) : undefined);
    const total = this.applyDiscount(subtotal, discountType, discountValue);
    if (total < 0) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'قيمة الخصم أكبر من إجمالي العرض' });

    return this.prisma.$transaction(async (tx) => {
      if (itemsData) {
        await tx.quotationItem.deleteMany({ where: { quotationId: id } });
      }
      return tx.quotation.update({
        where: { id },
        data: {
          validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
          paymentTerms: dto.paymentTerms,
          notes: dto.notes,
          discountType: discountType as any,
          discountValue,
          subtotal,
          total,
          ...(itemsData ? { items: { create: itemsData } } : {}),
        },
        include: { items: { include: { item: true } } },
      });
    });
  }

  // موافقة إدارية (أسعار/خصم) — أول اعتماد داخلي قبل الإرسال للمريض
  async approve(id: string, userId: string) {
    const q = await this.findOne(id);
    if (q.status !== 'DRAFT') throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'العرض ليس مسودة' });
    return this.prisma.quotation.update({
      where: { id },
      data: { status: 'APPROVED', approvedByUserId: userId, approvedAt: new Date() },
      include: { items: { include: { item: true } } },
    });
  }

  // صلاحية edit_prices فقط — تعديل أسعار/خصومات بدون فتح نسخة جديدة، مسموح قبل الإرسال فقط
  async adjustPrices(id: string, dto: AdjustQuotationPricesDto) {
    const q = await this.findOne(id);
    if (!['DRAFT', 'APPROVED'].includes(q.status)) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'تعديل الأسعار مسموح فقط قبل إرسال العرض' });
    }

    return this.prisma.$transaction(async (tx) => {
      for (const it of dto.items ?? []) {
        const existing = q.items.find((qi) => qi.id === it.quotationItemId);
        if (!existing) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: `بند غير موجود بهذا العرض: ${it.quotationItemId}` });
        const lineTotal = this.lineTotal({ qty: Number(existing.qty), unitPrice: it.unitPrice, discountType: it.discountType, discountValue: it.discountValue });
        await tx.quotationItem.update({
          where: { id: it.quotationItemId },
          data: { unitPrice: it.unitPrice, discountType: it.discountType as any, discountValue: it.discountValue, lineTotal },
        });
      }

      const freshItems = await tx.quotationItem.findMany({ where: { quotationId: id } });
      const subtotal = freshItems.reduce((s, i) => s + Number(i.lineTotal), 0);
      const discountType = dto.discountType ?? (q.discountType as any);
      const discountValue = dto.discountValue ?? (q.discountValue ? Number(q.discountValue) : undefined);
      const total = this.applyDiscount(subtotal, discountType, discountValue);
      if (total < 0) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'قيمة الخصم أكبر من إجمالي العرض' });

      return tx.quotation.update({
        where: { id },
        data: { subtotal, total, discountType: discountType as any, discountValue },
        include: { items: { include: { item: true } } },
      });
    });
  }

  async send(id: string) {
    const q = await this.findOne(id);
    if (q.status !== 'APPROVED') throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'العرض يحتاج اعتماداً إدارياً أولاً' });
    return this.prisma.quotation.update({ where: { id }, data: { status: 'SENT', sentAt: new Date() } });
  }

  async accept(id: string, dto: AcceptQuotationDto) {
    const q = await this.findOne(id);
    if (q.status !== 'SENT') throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'العرض لم يُرسل بعد للمريض' });
    return this.prisma.quotation.update({
      where: { id },
      data: { status: 'ACCEPTED', acceptedAt: new Date(), acceptedByName: dto.acceptedByName },
    });
  }

  async reject(id: string, dto: RejectQuotationDto) {
    const q = await this.findOne(id);
    if (!['DRAFT', 'APPROVED', 'SENT'].includes(q.status)) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'لا يمكن رفض العرض بحالته الحالية' });
    }
    return this.prisma.quotation.update({ where: { id }, data: { status: 'REJECTED', rejectionReason: dto.reason } });
  }

  // تعديل عرض بعد اعتماده = نسخة جديدة (القرار المعتمد) — القديم يصير SUPERSEDED
  async newVersion(id: string, dto: NewQuotationVersionDto, userId: string) {
    const parent = await this.findOne(id);
    if (['SUPERSEDED', 'CANCELLED'].includes(parent.status)) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'لا يمكن فتح نسخة جديدة من عرض مستبدَل أو ملغى' });
    }

    const itemsInput: QuotationItemInputDto[] = dto.items ?? parent.items.map((i) => ({
      lineType: i.lineType as any,
      itemId: i.itemId ?? undefined,
      description: i.description,
      qty: Number(i.qty),
      unitPrice: Number(i.unitPrice),
      discountType: i.discountType as any,
      discountValue: i.discountValue ? Number(i.discountValue) : undefined,
    }));
    const itemsData = await this.validateAndBuildItems(itemsInput);
    const subtotal = itemsData.reduce((s, i) => s + Number(i.lineTotal), 0);
    const discountType = dto.discountType ?? (parent.discountType as any);
    const discountValue = dto.discountValue ?? (parent.discountValue ? Number(parent.discountValue) : undefined);
    const total = this.applyDiscount(subtotal, discountType, discountValue);
    if (total < 0) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'قيمة الخصم أكبر من إجمالي العرض' });

    const documentNo = await this.generateDocumentNo();
    return this.prisma.$transaction(async (tx) => {
      await tx.quotation.update({ where: { id }, data: { status: 'SUPERSEDED' } });
      return tx.quotation.create({
        data: {
          documentNo,
          version: parent.version + 1,
          parentQuotationId: parent.id,
          patientId: parent.patientId,
          currencyId: parent.currencyId,
          exchangeRate: parent.exchangeRate,
          discountType: discountType as any,
          discountValue,
          subtotal,
          total,
          validUntil: dto.validUntil ? new Date(dto.validUntil) : parent.validUntil,
          paymentTerms: dto.paymentTerms ?? parent.paymentTerms,
          notes: dto.notes ?? parent.notes,
          createdByUserId: userId,
          items: { create: itemsData },
        },
        include: { items: { include: { item: true } } },
      });
    });
  }

  // يُستخدم من SalesInvoicesService.createFromQuotation قبل توليد الفاتورة
  async assertAcceptedAndUninvoiced(id: string) {
    const q = await this.findOne(id);
    if (q.status !== 'ACCEPTED') throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'العرض لم توافق عليه الحالة بعد' });
    const existing = await this.prisma.salesInvoice.findFirst({ where: { quotationId: id } });
    if (existing) throw new BadRequestException({ code: 'ALREADY_INVOICED', message: 'تم توليد فاتورة مبيعات لهذا العرض مسبقاً' });
    return q;
  }
}
