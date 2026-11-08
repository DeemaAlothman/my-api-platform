import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { PurchasingService } from './purchasing.service';
import {
  CreatePurchaseInvoiceDto,
  RejectPurchaseInvoiceDto,
  ApprovePurchaseInvoiceDto,
  RequestCancelPurchaseInvoiceDto,
  CancelPurchaseInvoiceDto,
  RejectCancelRequestDto,
} from './dto/purchase-invoice.dto';
import { JwtAuthGuard } from '@shared/auth';
import { PermissionsGuard } from '@shared';
import { Permission } from '@shared';
import { User } from '@shared/auth/decorators/current-user.decorator';
import { PERMISSIONS } from '@shared/constants/permissions.constants';

@Controller('warehouse/purchase-invoices')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PurchasingController {
  constructor(private readonly service: PurchasingService) {}

  private canSeePrices(user: any): boolean {
    return (user.permissions as string[] ?? []).includes(PERMISSIONS.WAREHOUSE.PURCHASE_PRICES_VIEW);
  }

  @Get()
  @Permission(PERMISSIONS.WAREHOUSE.PURCHASE_INVOICES_READ)
  async list(
    @User() user: any,
    @Query('status') status?: string,
    @Query('supplierId') supplierId?: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.service.list({
      status, supplierId, warehouseId,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    if (this.canSeePrices(user)) return result;
    return { ...result, items: result.items.map((i) => this.service.stripPrices(i)) };
  }

  @Get(':id')
  @Permission(PERMISSIONS.WAREHOUSE.PURCHASE_INVOICES_READ)
  async findOne(@Param('id') id: string, @User() user: any) {
    const invoice = await this.service.findOne(id);
    return this.canSeePrices(user) ? invoice : this.service.stripPrices(invoice);
  }

  @Post()
  @Permission(PERMISSIONS.WAREHOUSE.PURCHASE_INVOICES_CREATE)
  create(@Body() dto: CreatePurchaseInvoiceDto, @User() user: any) {
    return this.service.create(dto, user.userId);
  }

  @Post(':id/approve')
  @Permission(PERMISSIONS.WAREHOUSE.PURCHASE_INVOICES_APPROVE)
  approve(@Param('id') id: string, @Body() dto: ApprovePurchaseInvoiceDto, @User() user: any) {
    return this.service.approve(id, user.userId, dto);
  }

  @Post(':id/reject')
  @Permission(PERMISSIONS.WAREHOUSE.PURCHASE_INVOICES_APPROVE)
  reject(@Param('id') id: string, @Body() dto: RejectPurchaseInvoiceDto) {
    return this.service.reject(id, dto);
  }

  @Post(':id/post')
  @Permission(PERMISSIONS.WAREHOUSE.PURCHASE_INVOICES_POST)
  post(@Param('id') id: string, @User() user: any) {
    return this.service.post(id, user.userId);
  }

  // مدير المستودع (نفس صلاحية الإنشاء) — يطلب إلغاء، ما بيلغي مباشرة
  @Post(':id/request-cancel')
  @Permission(PERMISSIONS.WAREHOUSE.PURCHASE_INVOICES_CREATE)
  requestCancel(@Param('id') id: string, @Body() dto: RequestCancelPurchaseInvoiceDto, @User() user: any) {
    return this.service.requestCancel(id, user.userId, dto);
  }

  // المدير المالي فقط (نفس صلاحية الاعتماد) — إلغاء مباشر أو اعتماد طلب إلغاء قائم
  @Post(':id/cancel')
  @Permission(PERMISSIONS.WAREHOUSE.PURCHASE_INVOICES_APPROVE)
  cancel(@Param('id') id: string, @Body() dto: CancelPurchaseInvoiceDto, @User() user: any) {
    return this.service.cancel(id, user.userId, dto);
  }

  // المدير المالي فقط — رفض طلب إلغاء قائم
  @Post(':id/reject-cancel-request')
  @Permission(PERMISSIONS.WAREHOUSE.PURCHASE_INVOICES_APPROVE)
  rejectCancelRequest(@Param('id') id: string, @Body() dto: RejectCancelRequestDto) {
    return this.service.rejectCancelRequest(id, dto);
  }
}
