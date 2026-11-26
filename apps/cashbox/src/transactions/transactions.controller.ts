import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { DisbursementDto, ReceiptDto, HandoverDto, RefillDto, DepositDto, RejectDto, ListTransactionsQueryDto } from './dto/transaction.dto';
import { JwtAuthGuard } from '@shared/auth';
import { PermissionsGuard } from '@shared';
import { Permission } from '@shared';
import { User } from '@shared/auth/decorators/current-user.decorator';
import { PERMISSIONS } from '@shared/constants/permissions.constants';

@Controller('cashbox/transactions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TransactionsController {
  constructor(private readonly service: TransactionsService) {}

  @Get()
  @Permission(PERMISSIONS.CASHBOX.TRANSACTIONS_READ)
  list(@Query() query: ListTransactionsQueryDto) {
    return this.service.list(query);
  }

  @Post('deposit')
  @Permission(PERMISSIONS.CASHBOX.TRANSACTIONS_DEPOSIT)
  deposit(@Body() dto: DepositDto, @User() user: any) {
    return this.service.deposit(dto, user.userId);
  }

  @Post('disbursement')
  @Permission(PERMISSIONS.CASHBOX.TRANSACTIONS_CREATE)
  disbursement(@Body() dto: DisbursementDto, @User() user: any) {
    return this.service.disbursement(dto, user.userId);
  }

  @Post('receipt')
  @Permission(PERMISSIONS.CASHBOX.TRANSACTIONS_CREATE)
  receipt(@Body() dto: ReceiptDto, @User() user: any) {
    return this.service.receipt(dto, user.userId);
  }

  @Post('handover')
  @Permission(PERMISSIONS.CASHBOX.TRANSACTIONS_CREATE)
  handover(@Body() dto: HandoverDto, @User() user: any) {
    return this.service.handover(dto, user.userId);
  }

  @Post('refill')
  @Permission(PERMISSIONS.CASHBOX.TRANSACTIONS_CREATE)
  refill(@Body() dto: RefillDto, @User() user: any) {
    return this.service.refill(dto, user.userId);
  }

  // ── قرار المدير التنفيذي على الصرف ────────────────────────────────────────

  @Patch(':id/ceo-approve')
  @Permission(PERMISSIONS.CASHBOX.CEO_APPROVE)
  ceoApprove(@Param('id') id: string, @User() user: any) {
    return this.service.ceoApprove(id, user.userId);
  }

  @Patch(':id/ceo-reject')
  @Permission(PERMISSIONS.CASHBOX.CEO_APPROVE)
  ceoReject(@Param('id') id: string, @Body() dto: RejectDto, @User() user: any) {
    return this.service.ceoReject(id, dto.reason, user.userId);
  }

  // سحبُ الطلب قبل البتّ فيه. الصلاحيةُ هي صلاحيةُ إنشائه، والقَصرُ على صاحبه
  // يُفحَص في الخدمة لأنه شرطُ مِلكيةٍ لا شرطُ صلاحية.
  @Patch(':id/cancel')
  @Permission(PERMISSIONS.CASHBOX.TRANSACTIONS_CREATE)
  cancel(@Param('id') id: string, @User() user: any) {
    return this.service.cancel(id, user.userId);
  }

  // ── تأكيد صاحب الصندوق المستلِم ───────────────────────────────────────────
  // الصلاحيةُ هي صلاحيةُ الحركات، ومَن يحقُّ له التأكيدُ يُفحَص في الخدمة:
  // صاحبُ الصندوق المستلِم، أو مَن له الصلاحيةُ الإدارية نيابةً عنه.

  @Patch(':id/confirm-receipt')
  @Permission(PERMISSIONS.CASHBOX.TRANSACTIONS_CREATE)
  confirmReceipt(@Param('id') id: string, @User() user: any) {
    return this.service.confirmReceipt(id, user.userId);
  }

  @Patch(':id/reject-receipt')
  @Permission(PERMISSIONS.CASHBOX.TRANSACTIONS_CREATE)
  rejectReceipt(@Param('id') id: string, @Body() dto: RejectDto, @User() user: any) {
    return this.service.rejectReceipt(id, dto.reason, user.userId);
  }
}
