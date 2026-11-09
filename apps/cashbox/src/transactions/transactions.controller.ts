import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { DisbursementDto, ReceiptDto, HandoverDto, RefillDto, DepositDto, ListTransactionsQueryDto } from './dto/transaction.dto';
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
}
