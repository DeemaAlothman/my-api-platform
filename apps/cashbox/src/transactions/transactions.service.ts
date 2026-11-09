import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CashBoxesService } from '../cashboxes/cashboxes.service';
import { DisbursementDto, ReceiptDto, HandoverDto, RefillDto, ListTransactionsQueryDto } from './dto/transaction.dto';

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cashBoxes: CashBoxesService,
  ) {}

  private async getMainBox() {
    const main = await this.prisma.cashBox.findFirst({ where: { type: 'MAIN', isActive: true } });
    if (!main) throw new BadRequestException({ code: 'NO_MAIN_CASHBOX', message: 'ما في صندوق رئيسي معرَّف بعد' });
    return main;
  }

  private async assertBoxActive(id: string) {
    const box = await this.cashBoxes.findOne(id);
    if (!box.isActive) throw new BadRequestException({ code: 'CASHBOX_INACTIVE', message: 'الصندوق غير فعّال' });
    return box;
  }

  // أمر صرف — لموظف، بسبب. بيرفض لو بيخلي رصيد الصندوق بهالعملة سالب
  async disbursement(dto: DisbursementDto, userId: string) {
    await this.assertBoxActive(dto.cashBoxId);
    const balance = await this.cashBoxes.getBalance(dto.cashBoxId, dto.currencyId);
    if (balance < dto.amount) {
      throw new BadRequestException({
        code: 'INSUFFICIENT_BALANCE',
        message: `رصيد الصندوق الحالي (${balance}) أقل من مبلغ الصرف المطلوب`,
      });
    }
    return this.prisma.cashTransaction.create({
      data: {
        cashBoxId: dto.cashBoxId,
        transactionType: 'DISBURSEMENT',
        amount: dto.amount,
        currencyId: dto.currencyId,
        reason: dto.reason,
        targetEmployeeId: dto.targetEmployeeId,
        createdByUserId: userId,
      },
    });
  }

  // أمر قبض — من مريض أو زبون، بالضبط واحد منهم
  async receipt(dto: ReceiptDto, userId: string) {
    await this.assertBoxActive(dto.cashBoxId);
    if (dto.patientId && dto.customerId) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'أمر القبض إما من مريض أو من زبون — مش الاثنين معاً' });
    }
    if (!dto.patientId && !dto.customerId) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'لازم تحدّدي مريض أو زبون لأمر القبض' });
    }
    return this.prisma.cashTransaction.create({
      data: {
        cashBoxId: dto.cashBoxId,
        transactionType: 'RECEIPT',
        amount: dto.amount,
        currencyId: dto.currencyId,
        reason: dto.reason,
        patientId: dto.patientId ?? null,
        customerId: dto.customerId ?? null,
        createdByUserId: userId,
      },
    });
  }

  // تسليم من صندوق فرعي للرئيسي — الرئيسي يُحدَّد تلقائياً، ويُرفض لو بيخلي رصيد الفرعي سالب
  async handover(dto: HandoverDto, userId: string) {
    const box = await this.assertBoxActive(dto.cashBoxId);
    if (box.type !== 'SUB') {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'التسليم يكون من صندوق فرعي فقط' });
    }
    const main = await this.getMainBox();
    if (main.id === box.id) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'ما يمكن تسليم الصندوق الرئيسي لنفسه' });
    }
    const balance = await this.cashBoxes.getBalance(dto.cashBoxId, dto.currencyId);
    if (balance < dto.amount) {
      throw new BadRequestException({
        code: 'INSUFFICIENT_BALANCE',
        message: `رصيد الصندوق الفرعي الحالي (${balance}) أقل من مبلغ التسليم المطلوب`,
      });
    }
    return this.prisma.cashTransaction.create({
      data: {
        cashBoxId: dto.cashBoxId,
        relatedCashBoxId: main.id,
        transactionType: 'HANDOVER',
        amount: dto.amount,
        currencyId: dto.currencyId,
        reason: dto.reason,
        createdByUserId: userId,
      },
    });
  }

  // تعبئة صندوق فرعي من الرئيسي — الرئيسي يُحدَّد تلقائياً، ويُرفض لو بيخلي رصيد الرئيسي سالب
  async refill(dto: RefillDto, userId: string) {
    const box = await this.assertBoxActive(dto.cashBoxId);
    if (box.type !== 'SUB') {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'التعبئة تكون لصندوق فرعي فقط' });
    }
    const main = await this.getMainBox();
    const mainBalance = await this.cashBoxes.getBalance(main.id, dto.currencyId);
    if (mainBalance < dto.amount) {
      throw new BadRequestException({
        code: 'INSUFFICIENT_BALANCE',
        message: `رصيد الصندوق الرئيسي الحالي (${mainBalance}) أقل من مبلغ التعبئة المطلوب`,
      });
    }
    return this.prisma.cashTransaction.create({
      data: {
        cashBoxId: box.id,
        relatedCashBoxId: main.id,
        transactionType: 'REFILL',
        amount: dto.amount,
        currencyId: dto.currencyId,
        reason: dto.reason,
        createdByUserId: userId,
      },
    });
  }

  async list(query: ListTransactionsQueryDto) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const where: any = {};
    if (query.cashBoxId) where.OR = [{ cashBoxId: query.cashBoxId }, { relatedCashBoxId: query.cashBoxId }];
    if (query.transactionType) where.transactionType = query.transactionType;

    const [items, total] = await Promise.all([
      this.prisma.cashTransaction.findMany({
        where,
        include: { currency: true, cashBox: true, relatedCashBox: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.cashTransaction.count({ where }),
    ]);
    return { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }
}
