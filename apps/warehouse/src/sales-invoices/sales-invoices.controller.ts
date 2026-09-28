import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { SalesInvoicesService } from './sales-invoices.service';
import { CreateSalesInvoiceFromQuotationDto } from './dto/sales-invoice.dto';
import { JwtAuthGuard } from '@shared/auth';
import { PermissionsGuard } from '@shared';
import { Permission } from '@shared';
import { User } from '@shared/auth/decorators/current-user.decorator';
import { PERMISSIONS } from '@shared/constants/permissions.constants';

@Controller('warehouse/sales-invoices')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SalesInvoicesController {
  constructor(private readonly service: SalesInvoicesService) {}

  // نفس صلاحية عرض أسعار العروض — نفس المفهوم (هل يحق له رؤية السعر أم لا)
  private canSeePrices(user: any): boolean {
    return (user.permissions as string[] ?? []).includes(PERMISSIONS.WAREHOUSE.QUOTATIONS_VIEW_PRICES);
  }

  @Get()
  @Permission(PERMISSIONS.WAREHOUSE.SALES_INVOICES_READ)
  async list(
    @User() user: any,
    @Query('status') status?: string,
    @Query('patientId') patientId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.service.list({
      status, patientId,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    if (this.canSeePrices(user)) return result;
    return { ...result, items: result.items.map((i) => this.service.technicianCopy(i)) };
  }

  @Get(':id')
  @Permission(PERMISSIONS.WAREHOUSE.SALES_INVOICES_READ)
  async findOne(@Param('id') id: string, @User() user: any) {
    const inv = await this.service.findOne(id);
    return this.canSeePrices(user) ? inv : this.service.technicianCopy(inv);
  }

  @Post()
  @Permission(PERMISSIONS.WAREHOUSE.SALES_INVOICES_CREATE)
  create(@Body() dto: CreateSalesInvoiceFromQuotationDto, @User() user: any) {
    return this.service.createFromQuotation(dto, user.userId);
  }

  @Post(':id/approve')
  @Permission(PERMISSIONS.WAREHOUSE.SALES_INVOICES_APPROVE)
  approve(@Param('id') id: string, @User() user: any) {
    return this.service.approve(id, user.userId);
  }

  @Post(':id/cancel')
  @Permission(PERMISSIONS.WAREHOUSE.SALES_INVOICES_APPROVE)
  cancel(@Param('id') id: string) {
    return this.service.cancel(id);
  }
}
