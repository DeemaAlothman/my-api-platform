import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CashBoxesService } from '../cashboxes/cashboxes.service';
import { DisbursementDto, ReceiptDto, HandoverDto, RefillDto, DepositDto, ListTransactionsQueryDto } from './dto/transaction.dto';

type TxStatus = 'COMPLETED' | 'PENDING_CEO_APPROVAL' | 'PENDING_RECEIPT' | 'REJECTED' | 'CANCELLED';

const CEO_APPROVE_PERMISSION = 'cashbox.ceo-approve';
// الصلاحيةُ الإدارية القائمة تُغني عن استحداثِ قريبةٍ منها، وبها يُؤكَّد الاستلامُ
// نيابةً عن صاحب صندوقٍ غائب
const ADMIN_PERMISSION = 'cashbox.boxes.manage';

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

  // ── الصندوق المستلِم ومن يؤكِّد قبضَه ──────────────────────────────────────

  // يختلف بحسب النوع: التسليمُ يَصعد من الفرعي إلى الرئيسي فالمستلِمُ هو
  // relatedCashBoxId، والتعبئةُ تَنزل من الرئيسي إلى الفرعي فالمستلِمُ هو cashBoxId.
  // وخلطُ الاثنين يَجعل صاحبَ الصندوق الخطأ هو المطالَبَ بالتأكيد.
  private receivingBoxId(t: {
    transactionType: string; cashBoxId: string; relatedCashBoxId?: string | null;
  }): string | null {
    if (t.transactionType === 'HANDOVER') return t.relatedCashBoxId ?? null;
    if (t.transactionType === 'REFILL' || t.transactionType === 'RECEIPT') return t.cashBoxId;
    return null;
  }

  // من سجَّل مبلغاً داخلاً إلى صندوقه هو فقد أقرَّ بقبضه، فلا يُطالَب بتأكيدٍ ثانٍ
  private async incomingStatus(receivingBoxId: string, userId: string): Promise<TxStatus> {
    const custodian = await this.cashBoxes.custodianUserId(receivingBoxId).catch(() => null);
    return custodian && custodian === userId ? 'COMPLETED' : 'PENDING_RECEIPT';
  }

  // ── الإشعارات وسجل التدقيق ────────────────────────────────────────────────

  private async insertNotif(userId: string, data: object, titleAr: string, messageAr: string) {
    await this.prisma.$queryRawUnsafe(
      `INSERT INTO users.notifications (id, "userId", type, "titleAr", "titleEn", "messageAr", "messageEn", data, "createdAt")
       VALUES (gen_random_uuid()::text, $1, 'GENERAL'::"users"."NotificationType", $2, $2, $3, $3, $4::jsonb, NOW())`,
      userId, titleAr, messageAr, JSON.stringify(data),
    ).catch(() => {});
  }

  // عمودُ type في جدول الإشعارات نوعٌ محصور لا يُزاد إلا بترحيلٍ يمسُّ الجدولَ كلَّه،
  // فنوعُ الحدث يُحمَل في data كما في إشعارات المواعيد، وعليه تُبنى الأيقونةُ والتسمية
  private notifData(t: { id: string; cashBoxId: string }, type: string) {
    return { type, transactionId: t.id, link: `/cashbox/transactions?transactionId=${t.id}` };
  }

  private async usersWithPermission(permission: string): Promise<string[]> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT DISTINCT u.id
       FROM users.users u
       JOIN users.user_roles ur       ON ur."userId" = u.id
       JOIN users.role_permissions rp ON rp."roleId" = ur."roleId"
       JOIN users.roles r             ON r.id = ur."roleId" AND r."deletedAt" IS NULL
       JOIN users.permissions p       ON p.id = rp."permissionId"
       WHERE p.name = $1 AND u."deletedAt" IS NULL`,
      permission,
    ).catch(() => [] as Array<{ id: string }>);
    return rows.map((r) => r.id);
  }

  private async hasPermission(userId: string, permission: string): Promise<boolean> {
    const ids = await this.usersWithPermission(permission);
    return ids.includes(userId);
  }

  // خدمةُ الصندوق لم يكن لها سجلٌّ تدقيق، وهي تُحرِّك مالاً: كلُّ طلبٍ وقرارٍ
  // وتأكيدٍ وإلغاءٍ يُكتَب، ليُعرَف بعد شهرٍ من فعل ماذا ومتى
  private async audit(
    action: string,
    transactionId: string,
    userId: string,
    boxName: string | null,
    metadata: object,
  ) {
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO public.audit_logs
         ("userId", username, action, resource, "resourceId", method, path, metadata, "targetName", "createdAt")
       VALUES ($1, NULL, $2, 'cashbox', $3, 'PATCH', $4, $5::jsonb, $6, NOW())`,
      userId,
      action,
      transactionId,
      `/api/v1/cashbox/transactions/${transactionId}`,
      JSON.stringify(metadata),
      boxName,
    ).catch(() => {});
  }

  // ── لقطة الرصيد ───────────────────────────────────────────────────────────
  //
  // تُلتقَط لحظةَ وقوعِ الأثر لا لحظةَ القراءة، فتبقى شهادةً على ما كان الرصيدُ
  // عليه وقتَها لا تتبدَّل بما يُسجَّل بعدها. ولكل طرفٍ لقطتُه في وقته: التسليمُ
  // والتعبئةُ يَخرجان من المرسِل عند التسجيل ويَدخلان المستلِمَ عند تأكيده، فلو
  // أُخِذت لقطةُ المرسِل عند التأكيد لظهر قبلَه وبعدَه سواءً — وذلك كذبٌ عليه،
  // فمالُه كان قد خرج.

  private primaryDelta(transactionType: string, amount: number): number {
    return transactionType === 'DISBURSEMENT' || transactionType === 'HANDOVER' ? -amount : amount;
  }

  // عند اكتمال الحركة يُلتقَط الطرفُ الذي وقع أثرُه الآن: المستلِمُ في التسليم
  // والتعبئة، والصندوقُ نفسُه في الصرف والقبض. ويُحسَب قبل تغيير الحالة، فالرصيدُ
  // ما لم تكتمل الحركةُ لا يَشملها فهو عينُ «قبلها».
  private async completionSnapshot(t: {
    transactionType: string; cashBoxId: string; relatedCashBoxId: string | null;
    currencyId: string; amount: unknown;
  }) {
    const amount = Number(t.amount);
    if (t.transactionType === 'HANDOVER' && t.relatedCashBoxId) {
      const before = await this.cashBoxes.getBalance(t.relatedCashBoxId, t.currencyId);
      return { counterpartBalanceBefore: before, counterpartBalanceAfter: before + amount };
    }
    const before = await this.cashBoxes.getBalance(t.cashBoxId, t.currencyId);
    return { balanceBefore: before, balanceAfter: before + this.primaryDelta(t.transactionType, amount) };
  }

  private money(amount: unknown, code?: string) {
    return `${Number(amount).toLocaleString('en-US')}${code ? ` ${code}` : ''}`;
  }

  // ── الإنشاء ───────────────────────────────────────────────────────────────

  // إيداع/رصيد افتتاحي — رأس مال خارجي لأي صندوق (الرئيسي عادةً)، بدون مريض أو زبون.
  // صلاحية خاصة (cashbox.transactions.deposit) لأنها بتضيف مال "من العدم" بمنظور النظام.
  // ولا يَنتظر تأكيدَ استلام: لا مُرسِلَ له يُقِرُّ المستلِمُ أنه قبض منه.
  async deposit(dto: DepositDto, userId: string) {
    await this.assertBoxActive(dto.cashBoxId);
    const before = await this.cashBoxes.getBalance(dto.cashBoxId, dto.currencyId);
    return this.prisma.cashTransaction.create({
      data: {
        cashBoxId: dto.cashBoxId,
        transactionType: 'DEPOSIT',
        amount: dto.amount,
        currencyId: dto.currencyId,
        reason: dto.reason,
        createdByUserId: userId,
        status: 'COMPLETED',
        balanceBefore: before,
        balanceAfter: before + dto.amount,
      },
    });
  }

  // أمر صرف — لموظف، بسبب. بيرفض لو بيخلي رصيد الصندوق بهالعملة سالب.
  // ومع طلبِ موافقةِ المدير التنفيذي يُسجَّل طلباً بلا خصم، ويُفحَص الرصيدُ
  // هنا ومرةً أخرى عند الموافقة، فما بينهما قد يُصرَف غيرُه.
  async disbursement(dto: DisbursementDto, userId: string) {
    const box = await this.assertBoxActive(dto.cashBoxId);
    const balance = await this.cashBoxes.getBalance(dto.cashBoxId, dto.currencyId);
    if (balance < dto.amount) {
      throw new BadRequestException({
        code: 'INSUFFICIENT_BALANCE',
        message: `رصيد الصندوق الحالي (${balance}) أقل من مبلغ الصرف المطلوب`,
      });
    }
    const status: TxStatus = dto.requiresCeoApproval ? 'PENDING_CEO_APPROVAL' : 'COMPLETED';
    const created = await this.prisma.cashTransaction.create({
      data: {
        cashBoxId: dto.cashBoxId,
        transactionType: 'DISBURSEMENT',
        amount: dto.amount,
        currencyId: dto.currencyId,
        reason: dto.reason,
        targetEmployeeId: dto.targetEmployeeId,
        createdByUserId: userId,
        status,
        // طلبٌ ينتظر البتَّ فيه لم يَمَسَّ رصيداً، فلا لقطةَ له حتى يُوافَق عليه
        ...(status === 'COMPLETED'
          ? { balanceBefore: balance, balanceAfter: balance - dto.amount }
          : {}),
      },
      include: { currency: true },
    });

    if (status === 'PENDING_CEO_APPROVAL') {
      await this.audit('CASHBOX_DISBURSEMENT_REQUESTED', created.id, userId, box.name, {
        amount: String(created.amount), currency: created.currency.code,
        cashBoxId: box.id, targetEmployeeId: dto.targetEmployeeId, reason: dto.reason,
      });
      const approvers = await this.usersWithPermission(CEO_APPROVE_PERMISSION);
      const employeeName = await this.employeeName(dto.targetEmployeeId);
      const msg = `طلب صرف ${this.money(created.amount, created.currency.code)} من ${box.name}`
        + (employeeName ? ` للموظف ${employeeName}` : '')
        + `. السبب: ${dto.reason}`;
      for (const approver of approvers) {
        if (approver === userId) continue;
        await this.insertNotif(
          approver, this.notifData(created, 'CASH_DISBURSEMENT_PENDING'),
          'صرف بانتظار موافقتك', msg,
        );
      }
    }
    return created;
  }

  // أمر قبض — من مريض أو زبون، بالضبط واحد منهم. مبلغٌ داخل، فلا يدخل الرصيدَ
  // حتى يُقِرَّ صاحبُ الصندوق أنه قبضه — إلا أن يكون هو مَن سجَّله.
  async receipt(dto: ReceiptDto, userId: string) {
    const box = await this.assertBoxActive(dto.cashBoxId);
    if (dto.patientId && dto.customerId) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'أمر القبض إما من مريض أو من زبون — مش الاثنين معاً' });
    }
    if (!dto.patientId && !dto.customerId) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'لازم تحدّدي مريض أو زبون لأمر القبض' });
    }
    const status = await this.incomingStatus(dto.cashBoxId, userId);
    // المالُ الداخلُ لا يَمَسُّ الرصيدَ حتى يُقَرَّ قبضُه، فلا لقطةَ له قبل ذلك
    const before = status === 'COMPLETED'
      ? await this.cashBoxes.getBalance(dto.cashBoxId, dto.currencyId)
      : null;
    const created = await this.prisma.cashTransaction.create({
      data: {
        cashBoxId: dto.cashBoxId,
        transactionType: 'RECEIPT',
        amount: dto.amount,
        currencyId: dto.currencyId,
        reason: dto.reason,
        patientId: dto.patientId ?? null,
        customerId: dto.customerId ?? null,
        createdByUserId: userId,
        status,
        ...(before !== null ? { balanceBefore: before, balanceAfter: before + dto.amount } : {}),
      },
      include: { currency: true },
    });
    if (status === 'PENDING_RECEIPT') await this.notifyAwaitingReceipt(created, box.name, userId);
    return created;
  }

  // تسليم من صندوق فرعي للرئيسي — الرئيسي يُحدَّد تلقائياً، ويُرفض لو بيخلي رصيد الفرعي سالب.
  // يَخرج من الفرعي فوراً، ولا يَدخل الرئيسيَّ حتى يُقِرَّ صاحبُه قبضَه.
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
    const status = await this.incomingStatus(main.id, userId);
    // المرسِلُ هو الفرعيُّ وأثرُه واقعٌ الآن، فلقطتُه تُؤخَذ هنا دائماً.
    // والرئيسيُّ المستلِمُ لا يُلتقَط إلا إن اكتملت الحركةُ فوراً.
    const mainBefore = status === 'COMPLETED'
      ? await this.cashBoxes.getBalance(main.id, dto.currencyId)
      : null;
    const created = await this.prisma.cashTransaction.create({
      data: {
        cashBoxId: dto.cashBoxId,
        relatedCashBoxId: main.id,
        transactionType: 'HANDOVER',
        amount: dto.amount,
        currencyId: dto.currencyId,
        reason: dto.reason,
        createdByUserId: userId,
        status,
        balanceBefore: balance,
        balanceAfter: balance - dto.amount,
        ...(mainBefore !== null
          ? { counterpartBalanceBefore: mainBefore, counterpartBalanceAfter: mainBefore + dto.amount }
          : {}),
      },
      include: { currency: true },
    });
    if (status === 'PENDING_RECEIPT') await this.notifyAwaitingReceipt(created, box.name, userId);
    return created;
  }

  // تعبئة صندوق فرعي من الرئيسي — الرئيسي يُحدَّد تلقائياً، ويُرفض لو بيخلي رصيد الرئيسي سالب.
  // يَخرج من الرئيسي فوراً، ولا يَدخل الفرعيَّ حتى يُقِرَّ صاحبُه قبضَه.
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
    const status = await this.incomingStatus(box.id, userId);
    // المرسِلُ في التعبئة هو الرئيسيُّ، وهو الطرفُ المقابلُ في هذا السطر، وأثرُه
    // واقعٌ الآن. والفرعيُّ المستلِمُ لا يُلتقَط إلا إن اكتملت الحركةُ فوراً.
    const subBefore = status === 'COMPLETED'
      ? await this.cashBoxes.getBalance(box.id, dto.currencyId)
      : null;
    const created = await this.prisma.cashTransaction.create({
      data: {
        cashBoxId: box.id,
        relatedCashBoxId: main.id,
        transactionType: 'REFILL',
        amount: dto.amount,
        currencyId: dto.currencyId,
        reason: dto.reason,
        createdByUserId: userId,
        status,
        counterpartBalanceBefore: mainBalance,
        counterpartBalanceAfter: mainBalance - dto.amount,
        ...(subBefore !== null
          ? { balanceBefore: subBefore, balanceAfter: subBefore + dto.amount }
          : {}),
      },
      include: { currency: true },
    });
    if (status === 'PENDING_RECEIPT') await this.notifyAwaitingReceipt(created, main.name, userId);
    return created;
  }

  private async notifyAwaitingReceipt(
    created: { id: string; cashBoxId: string; relatedCashBoxId: string | null; transactionType: string; amount: unknown; reason: string | null; currency: { code: string } },
    senderBoxName: string,
    userId: string,
  ) {
    const receiving = this.receivingBoxId(created);
    if (!receiving) return;
    const custodian = await this.cashBoxes.custodianUserId(receiving).catch(() => null);
    await this.audit('CASHBOX_RECEIPT_PENDING', created.id, userId, senderBoxName, {
      amount: String(created.amount), currency: created.currency.code,
      transactionType: created.transactionType, receivingCashBoxId: receiving, reason: created.reason,
    });
    if (!custodian || custodian === userId) return;
    await this.insertNotif(
      custodian, this.notifData(created, 'CASH_RECEIPT_PENDING'),
      'مبلغ بانتظار تأكيد استلامك',
      `${this.money(created.amount, created.currency.code)} من ${senderBoxName}`
        + (created.reason ? `. السبب: ${created.reason}` : ''),
    );
  }

  private async employeeName(employeeId?: string | null): Promise<string | null> {
    if (!employeeId) return null;
    const rows = await this.prisma.$queryRawUnsafe<Array<{ name: string | null }>>(
      `SELECT TRIM(REGEXP_REPLACE(COALESCE("firstNameAr",'') || ' ' || COALESCE("lastNameAr",''), '\\s+', ' ', 'g')) AS name
       FROM users.employees WHERE id = $1 AND "deletedAt" IS NULL LIMIT 1`,
      employeeId,
    ).catch(() => [] as Array<{ name: string | null }>);
    const name = rows[0]?.name?.trim();
    return name ? name : null;
  }

  // ── القرارات ──────────────────────────────────────────────────────────────

  private async loadPending(id: string, expected: TxStatus) {
    const t = await this.prisma.cashTransaction.findUnique({
      where: { id },
      include: { currency: true, cashBox: true, relatedCashBox: true },
    });
    if (!t) throw new NotFoundException({ code: 'TRANSACTION_NOT_FOUND', message: 'الحركة غير موجودة' });
    if (t.status !== expected) {
      throw new BadRequestException({
        code: 'TRANSACTION_NOT_PENDING',
        message: `الحركة حالتها ${t.status} ولا تقبل هذا الإجراء`,
      });
    }
    return t;
  }

  // الانتقالُ مشروطٌ بالحالة القائمة في جملة التحديث نفسها، فطلبان متزامنان
  // لا يَنفُذ منهما إلا الأول؛ وبغير هذا الشرط قد يُخصَم مبلغٌ مرتين.
  private async transitionGuarded(id: string, from: TxStatus, data: object): Promise<boolean> {
    const res = await this.prisma.cashTransaction.updateMany({
      where: { id, status: from },
      data: data as any,
    });
    return res.count === 1;
  }

  private assertDecided(ok: boolean) {
    if (!ok) {
      throw new BadRequestException({
        code: 'TRANSACTION_ALREADY_DECIDED',
        message: 'الحركة حُسمت للتوّ من طلب آخر — راجعي حالتها',
      });
    }
  }

  // موافقة المدير التنفيذي على الصرف. الرصيدُ يُفحَص الآن من جديد لا عند الطلب
  // وحدَه: ما بينهما قد يُصرَف غيرُه فلا يبقى المبلغُ متاحاً.
  async ceoApprove(id: string, userId: string) {
    const t = await this.loadPending(id, 'PENDING_CEO_APPROVAL');
    const balance = await this.cashBoxes.getBalance(t.cashBoxId, t.currencyId);
    if (balance < Number(t.amount)) {
      throw new BadRequestException({
        code: 'INSUFFICIENT_BALANCE',
        message: `رصيد الصندوق الحالي (${balance}) أقل من مبلغ الصرف المطلوب (${Number(t.amount)}) — تعذّرت الموافقة`,
      });
    }
    const ok = await this.transitionGuarded(id, 'PENDING_CEO_APPROVAL', {
      status: 'COMPLETED', decidedByUserId: userId, decidedAt: new Date(), rejectReason: null,
      // الرصيدُ المقروءُ للتوِّ هو عينُ «قبلها»، فالحركةُ لم تكتمل بعد فلا تَشملها
      balanceBefore: balance, balanceAfter: balance - Number(t.amount),
    });
    this.assertDecided(ok);

    await this.audit('CASHBOX_DISBURSEMENT_APPROVED', id, userId, t.cashBox.name, {
      amount: String(t.amount), currency: t.currency.code, balanceAtApproval: balance,
    });
    if (t.createdByUserId !== userId) {
      await this.insertNotif(
        t.createdByUserId, this.notifData(t, 'CASH_DISBURSEMENT_APPROVED'),
        'تمت الموافقة على الصرف',
        `وُوفق على صرف ${this.money(t.amount, t.currency.code)} من ${t.cashBox.name}`,
      );
    }
    return this.findOne(id);
  }

  async ceoReject(id: string, reason: string, userId: string) {
    const t = await this.loadPending(id, 'PENDING_CEO_APPROVAL');
    const ok = await this.transitionGuarded(id, 'PENDING_CEO_APPROVAL', {
      status: 'REJECTED', decidedByUserId: userId, decidedAt: new Date(), rejectReason: reason,
    });
    this.assertDecided(ok);

    await this.audit('CASHBOX_DISBURSEMENT_REJECTED', id, userId, t.cashBox.name, {
      amount: String(t.amount), currency: t.currency.code, reason,
    });
    if (t.createdByUserId !== userId) {
      await this.insertNotif(
        t.createdByUserId, this.notifData(t, 'CASH_DISBURSEMENT_REJECTED'),
        'رُفض طلب الصرف',
        `رُفض صرف ${this.money(t.amount, t.currency.code)} من ${t.cashBox.name}. السبب: ${reason}`,
      );
    }
    return this.findOne(id);
  }

  // سحبُ الطلب قبل البتّ فيه، ولصاحبه وحدَه: من طَلَب هو من يَرجع عن طلبه،
  // وما بعد القرار ليس سحباً بل نقضٌ له
  async cancel(id: string, userId: string) {
    const t = await this.prisma.cashTransaction.findUnique({
      where: { id }, include: { currency: true, cashBox: true },
    });
    if (!t) throw new NotFoundException({ code: 'TRANSACTION_NOT_FOUND', message: 'الحركة غير موجودة' });
    if (t.createdByUserId !== userId) {
      throw new ForbiddenException({ code: 'NOT_REQUESTER', message: 'الإلغاء لصاحب الطلب فقط' });
    }
    if (t.status !== 'PENDING_CEO_APPROVAL' && t.status !== 'PENDING_RECEIPT') {
      throw new BadRequestException({
        code: 'TRANSACTION_NOT_PENDING',
        message: 'ما يمكن إلغاء حركة حُسمت أو نُفّذت',
      });
    }
    const ok = await this.transitionGuarded(id, t.status as TxStatus, {
      status: 'CANCELLED', decidedByUserId: userId, decidedAt: new Date(),
    });
    this.assertDecided(ok);
    await this.audit('CASHBOX_TRANSACTION_CANCELLED', id, userId, t.cashBox.name, {
      amount: String(t.amount), currency: t.currency.code, fromStatus: t.status,
    });
    return this.findOne(id);
  }

  // ── تأكيد الاستلام ────────────────────────────────────────────────────────

  private async assertMayConfirm(t: { transactionType: string; cashBoxId: string; relatedCashBoxId: string | null }, userId: string) {
    const receiving = this.receivingBoxId(t);
    if (!receiving) {
      throw new BadRequestException({
        code: 'NOT_AN_INCOMING_TRANSACTION', message: 'هذه الحركة ما إلها صندوق مستلِم',
      });
    }
    const custodian = await this.cashBoxes.custodianUserId(receiving).catch(() => null);
    if (custodian && custodian === userId) return receiving;
    // غيابُ صاحب الصندوق لا يَحبس المالَ: الصلاحيةُ الإدارية تُقِرُّ نيابةً عنه
    if (await this.hasPermission(userId, ADMIN_PERMISSION)) return receiving;
    throw new ForbiddenException({
      code: 'NOT_CUSTODIAN', message: 'تأكيد الاستلام لصاحب الصندوق المستلِم فقط',
    });
  }

  async confirmReceipt(id: string, userId: string) {
    const t = await this.loadPending(id, 'PENDING_RECEIPT');
    await this.assertMayConfirm(t, userId);
    // يُحسَب قبل تغيير الحالة: الطرفُ المستلِمُ لا يَشمل الحركةَ ما لم تكتمل
    const snapshot = await this.completionSnapshot(t);
    const ok = await this.transitionGuarded(id, 'PENDING_RECEIPT', {
      status: 'COMPLETED', decidedByUserId: userId, decidedAt: new Date(), rejectReason: null,
      ...snapshot,
    });
    this.assertDecided(ok);

    await this.audit('CASHBOX_RECEIPT_CONFIRMED', id, userId, t.cashBox.name, {
      amount: String(t.amount), currency: t.currency.code, transactionType: t.transactionType,
    });
    if (t.createdByUserId !== userId) {
      await this.insertNotif(
        t.createdByUserId, this.notifData(t, 'CASH_RECEIPT_CONFIRMED'),
        'تم تأكيد الاستلام',
        `أُكِّد استلام ${this.money(t.amount, t.currency.code)}`,
      );
    }
    return this.findOne(id);
  }

  // «لم يصل». وأثرُه يَقع من تلقائه: التسليمُ والتعبئةُ كان المبلغُ خارجاً من
  // المرسِل فيَعود إليه بمجرَّد أن تصير الحالةُ رفضاً، والقبضُ لم يَدخل أصلاً
  // فتَسقط حركتُه. لا حركةَ معاكسةَ تُسجَّل، فلا يَنتفخ السجلُّ بما لم يَحدث.
  async rejectReceipt(id: string, reason: string, userId: string) {
    const t = await this.loadPending(id, 'PENDING_RECEIPT');
    await this.assertMayConfirm(t, userId);
    const ok = await this.transitionGuarded(id, 'PENDING_RECEIPT', {
      status: 'REJECTED', decidedByUserId: userId, decidedAt: new Date(), rejectReason: reason,
    });
    this.assertDecided(ok);

    await this.audit('CASHBOX_RECEIPT_REJECTED', id, userId, t.cashBox.name, {
      amount: String(t.amount), currency: t.currency.code, transactionType: t.transactionType, reason,
    });
    if (t.createdByUserId !== userId) {
      const returned = t.transactionType === 'RECEIPT'
        ? 'وأُلغيت الحركة'
        : 'ورجع المبلغ للصندوق المرسِل';
      await this.insertNotif(
        t.createdByUserId, this.notifData(t, 'CASH_RECEIPT_REJECTED'),
        'رُفض تأكيد الاستلام',
        `لم يُستلَم ${this.money(t.amount, t.currency.code)} — ${returned}. السبب: ${reason}`,
      );
    }
    return this.findOne(id);
  }

  // ── العرض ─────────────────────────────────────────────────────────────────

  async findOne(id: string) {
    const t = await this.prisma.cashTransaction.findUnique({
      where: { id },
      include: { currency: true, cashBox: true, relatedCashBox: true },
    });
    if (!t) throw new NotFoundException({ code: 'TRANSACTION_NOT_FOUND', message: 'الحركة غير موجودة' });
    const [enriched] = await this.withActorNames([t]);
    return enriched;
  }

  // أسماءُ الطالب والحاسم تُحَلُّ دفعةً واحدة للصفحة كلِّها، لا استعلاماً لكل سطر
  private async withActorNames<T extends { createdByUserId: string; decidedByUserId: string | null }>(rows: T[]) {
    const userIds = [...new Set(rows.flatMap((r) => [r.createdByUserId, r.decidedByUserId]).filter(Boolean))] as string[];
    let nameByUserId = new Map<string, string>();
    if (userIds.length > 0) {
      const found = await this.prisma.$queryRawUnsafe<Array<{ userId: string; name: string | null }>>(
        `SELECT e."userId",
                TRIM(REGEXP_REPLACE(COALESCE(e."firstNameAr",'') || ' ' || COALESCE(e."lastNameAr",''), '\\s+', ' ', 'g')) AS name
         FROM users.employees e
         WHERE e."userId" = ANY($1::text[]) AND e."deletedAt" IS NULL`,
        userIds,
      ).catch(() => [] as Array<{ userId: string; name: string | null }>);
      nameByUserId = new Map(found.filter((f) => f.name?.trim()).map((f) => [f.userId, f.name!.trim()]));
    }
    return rows.map((r) => ({
      ...r,
      requestedByName: nameByUserId.get(r.createdByUserId) ?? null,
      decidedByName: r.decidedByUserId ? nameByUserId.get(r.decidedByUserId) ?? null : null,
    }));
  }

  // الحاويةُ تعمل بالتوقيت العالمي والعملُ على ساعةٍ تَسبقه بثلاث، فيومٌ يُطلَب
  // بغير تثبيتٍ على توقيت العمل يُسقِط ثلاثاً من ساعاته الأولى ويَضُمُّ ثلاثاً من
  // اليوم الذي قبله — فحركةٌ سُجِّلت 00:30 تُحسَب على اليوم السابق.
  //
  // والطرفان داخلان: dateTo يمتدُّ إلى آخر لحظةٍ في يومه، وإلا سقط ذلك اليومُ كلُّه
  // لأن التاريخَ وحدَه يعني منتصفَ ليله. ويومٌ واحد يُطلَب بإرسال التاريخ نفسِه فيهما.
  private assertRealDay(raw?: string, d?: Date) {
    if (!raw || !d) return;
    const parts = isNaN(d.getTime()) ? [] : new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(d);
    const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    if (`${part('year')}-${part('month')}-${part('day')}` !== raw) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `تاريخ غير موجود: ${raw} — تأكّدي من اليوم والشهر`,
      });
    }
  }

  private buildCreatedAtRange(dateFrom?: string, dateTo?: string) {
    if (!dateFrom && !dateTo) return undefined;
    const BUSINESS_UTC_OFFSET = '+03:00';
    const range: { gte?: Date; lte?: Date } = {};
    if (dateFrom) range.gte = new Date(`${dateFrom}T00:00:00.000${BUSINESS_UTC_OFFSET}`);
    if (dateTo) range.lte = new Date(`${dateTo}T23:59:59.999${BUSINESS_UTC_OFFSET}`);
    // يومٌ لا وجودَ له (2026-02-31) لا يُنتِج تاريخاً غيرَ صالح: يُدوَّر إلى الثالث
    // من آذار بلا إشارة، فيُرَدُّ للسائل مدىً لم يَطلبه ويَحسَبه جوابَ سؤاله.
    // فيُصاغ التاريخُ رجوعاً إلى يومه بتوقيت العمل ويُقارَن بما أُرسِل.
    this.assertRealDay(dateFrom, range.gte);
    this.assertRealDay(dateTo, range.lte);
    if (range.gte && range.lte && range.gte > range.lte) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'dateFrom بعد dateTo — ما في مدى بينهما',
      });
    }
    return range;
  }

  async list(query: ListTransactionsQueryDto) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const where: any = {};
    if (query.cashBoxId) where.OR = [{ cashBoxId: query.cashBoxId }, { relatedCashBoxId: query.cashBoxId }];
    if (query.transactionType) where.transactionType = query.transactionType;
    if (query.status) where.status = query.status;
    const createdAtRange = this.buildCreatedAtRange(query.dateFrom, query.dateTo);
    if (createdAtRange) where.createdAt = createdAtRange;

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
    return {
      items: await this.withActorNames(items),
      page, limit, total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }
}
