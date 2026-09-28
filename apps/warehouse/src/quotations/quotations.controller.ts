import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { QuotationsService } from './quotations.service';
import {
  CreateQuotationDto, UpdateQuotationDto, NewQuotationVersionDto,
  AdjustQuotationPricesDto, AcceptQuotationDto, RejectQuotationDto,
} from './dto/quotation.dto';
import { JwtAuthGuard } from '@shared/auth';
import { PermissionsGuard } from '@shared';
import { Permission } from '@shared';
import { User } from '@shared/auth/decorators/current-user.decorator';
import { PERMISSIONS } from '@shared/constants/permissions.constants';

@Controller('warehouse/quotations')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class QuotationsController {
  constructor(private readonly service: QuotationsService) {}

  private canSeePrices(user: any): boolean {
    return (user.permissions as string[] ?? []).includes(PERMISSIONS.WAREHOUSE.QUOTATIONS_VIEW_PRICES);
  }

  @Get()
  @Permission(PERMISSIONS.WAREHOUSE.QUOTATIONS_READ)
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
  @Permission(PERMISSIONS.WAREHOUSE.QUOTATIONS_READ)
  async findOne(@Param('id') id: string, @User() user: any) {
    const q = await this.service.findOne(id);
    return this.canSeePrices(user) ? q : this.service.technicianCopy(q);
  }

  @Post()
  @Permission(PERMISSIONS.WAREHOUSE.QUOTATIONS_CREATE)
  create(@Body() dto: CreateQuotationDto, @User() user: any) {
    return this.service.create(dto, user.userId);
  }

  @Patch(':id')
  @Permission(PERMISSIONS.WAREHOUSE.QUOTATIONS_CREATE)
  update(@Param('id') id: string, @Body() dto: UpdateQuotationDto) {
    return this.service.update(id, dto);
  }

  @Post(':id/approve')
  @Permission(PERMISSIONS.WAREHOUSE.QUOTATIONS_APPROVE)
  approve(@Param('id') id: string, @User() user: any) {
    return this.service.approve(id, user.userId);
  }

  @Post(':id/adjust-prices')
  @Permission(PERMISSIONS.WAREHOUSE.QUOTATIONS_EDIT_PRICES)
  adjustPrices(@Param('id') id: string, @Body() dto: AdjustQuotationPricesDto) {
    return this.service.adjustPrices(id, dto);
  }

  @Post(':id/send')
  @Permission(PERMISSIONS.WAREHOUSE.QUOTATIONS_APPROVE)
  send(@Param('id') id: string) {
    return this.service.send(id);
  }

  @Post(':id/accept')
  @Permission(PERMISSIONS.WAREHOUSE.QUOTATIONS_APPROVE)
  accept(@Param('id') id: string, @Body() dto: AcceptQuotationDto) {
    return this.service.accept(id, dto);
  }

  @Post(':id/reject')
  @Permission(PERMISSIONS.WAREHOUSE.QUOTATIONS_APPROVE)
  reject(@Param('id') id: string, @Body() dto: RejectQuotationDto) {
    return this.service.reject(id, dto);
  }

  @Post(':id/new-version')
  @Permission(PERMISSIONS.WAREHOUSE.QUOTATIONS_CREATE)
  newVersion(@Param('id') id: string, @Body() dto: NewQuotationVersionDto, @User() user: any) {
    return this.service.newVersion(id, dto, user.userId);
  }
}
