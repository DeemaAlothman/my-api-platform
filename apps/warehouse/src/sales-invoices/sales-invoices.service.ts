import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QuotationsService } from '../quotations/quotations.service';
import { CreateSalesInvoiceFromQuotationDto } from './dto/sales-invoice.dto';

const PRICE_FIELDS = ['unitPrice', 'discountType', 'discountValue', 'lineTotal'];
const INVOICE_PRICE_FIELDS = ['subtotal', 'total', 'discountType', 'discountValue', 'exchangeRate'];

@Injectable()
export class SalesInvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quotations: QuotationsService,
  ) {}

  // نسخة "الفني" — بدون أي سعر (نفس منطق QuotationsService.technicianCopy)
  technicianCopy(invoice: any) {
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

  private async generateDocumentNo(): Promise<string> {
    const last = await this.prisma.salesInvoice.findFirst({
      where: { documentNo: { startsWith: 'VTX-INV-' } },
      orderBy: { documentNo: 'desc' },
      select: { documentNo: true },
    });
    const n = last ? parseInt(last.documentNo.replace('VTX-INV-', ''), 10) : 0;
    return `VTX-INV-${String(n + 1).padStart(6, '0')}`;
  }

  async findOne(id: string) {
    const inv = await this.prisma.salesInvoice.findUnique({
      where: { id },
      include: { items: { include: { item: true } }, currency: true, quotation: { select: { id: true, documentNo: true } } },
    });
    if (!inv) throw new NotFoundException({ code: 'SALES_INVOICE_NOT_FOUND', message: 'الفاتورة غير موجودة' });
    return inv;
  }

  async list(query: { status?: string; patientId?: string; page?: number; limit?: number }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.patientId) where.patientId = query.patientId;

    const [items, total] = await Promise.all([
      this.prisma.salesInvoice.findMany({
        where,
        include: { items: { include: { item: true } }, currency: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.salesInvoice.count({ where }),
    ]);
    return { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  // عرض واحد مقبول = فاتورة واحدة فقط (القرار المعتمد) — القيم منسوخة حرفياً من العرض وقت التوليد
  async createFromQuotation(dto: CreateSalesInvoiceFromQuotationDto, userId: string) {
    const q = await this.quotations.assertAcceptedAndUninvoiced(dto.quotationId);
    const documentNo = await this.generateDocumentNo();

    return this.prisma.salesInvoice.create({
      data: {
        documentNo,
        quotationId: q.id,
        patientId: q.patientId,
        currencyId: q.currencyId,
        exchangeRate: q.exchangeRate,
        discountType: q.discountType as any,
        discountValue: q.discountValue,
        subtotal: q.subtotal,
        total: q.total,
        paymentMethod: dto.paymentMethod,
        paymentTerms: dto.paymentTerms ?? q.paymentTerms,
        createdByUserId: userId,
        items: {
          create: q.items.map((it: any) => ({
            lineType: it.lineType,
            itemId: it.itemId,
            description: it.description,
            qty: it.qty,
            unitPrice: it.unitPrice,
            discountType: it.discountType,
            discountValue: it.discountValue,
            lineTotal: it.lineTotal,
          })),
        },
      },
      include: { items: { include: { item: true } } },
    });
  }

  async approve(id: string, userId: string) {
    const inv = await this.findOne(id);
    if (inv.status !== 'DRAFT') throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'الفاتورة ليست مسودة' });
    return this.prisma.salesInvoice.update({
      where: { id },
      data: { status: 'APPROVED', approvedByUserId: userId, approvedAt: new Date() },
      include: { items: { include: { item: true } } },
    });
  }

  async cancel(id: string) {
    const inv = await this.findOne(id);
    if (inv.status === 'CANCELLED') throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'الفاتورة ملغاة أصلاً' });
    return this.prisma.salesInvoice.update({ where: { id }, data: { status: 'CANCELLED' } });
  }
}
