import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards, UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InventoryService } from './inventory.service';
import { CreateItemDto } from './dto/create-item.dto';
import { CreateTransactionDto, InternalDeductDto } from './dto/create-transaction.dto';
import { JwtAuthGuard } from '@shared/auth';
import { PermissionsGuard } from '@shared';
import { Permission } from '@shared';
import { InternalAuthGuard } from '@shared';
import { User } from '@shared/auth/decorators/current-user.decorator';
import { PERMISSIONS } from '@shared/constants/permissions.constants';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly service: InventoryService) {}

  // ── Categories ────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission(PERMISSIONS.CLINIC_INVENTORY.VIEW)
  @Get('categories')
  listCategories() {
    return this.service.listCategories();
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission(PERMISSIONS.CLINIC_INVENTORY.MANAGE)
  @Post('categories')
  createCategory(@Body() body: any) {
    return this.service.createCategory(body);
  }

  // ── Suppliers ─────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission(PERMISSIONS.CLINIC_INVENTORY.VIEW)
  @Get('suppliers')
  listSuppliers() {
    return this.service.listSuppliers();
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission(PERMISSIONS.CLINIC_INVENTORY.MANAGE)
  @Post('suppliers')
  createSupplier(@Body() body: any) {
    return this.service.createSupplier(body);
  }

  // ── Items ─────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission(PERMISSIONS.CLINIC_INVENTORY.VIEW)
  @Get('items')
  listItems(
    @Query('type') type?: string,
    @Query('categoryId') categoryId?: string,
    @Query('search') search?: string,
    @Query('lowStock') lowStock?: string,
  ) {
    return this.service.listItems({
      type,
      categoryId: categoryId ? parseInt(categoryId) : undefined,
      search,
      lowStock: lowStock === 'true',
    });
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission(PERMISSIONS.CLINIC_INVENTORY.MANAGE)
  @Post('items')
  createItem(@Body() dto: CreateItemDto, @User() user: any) {
    return this.service.createItem(dto, user.userId);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission(PERMISSIONS.CLINIC_INVENTORY.VIEW)
  @Get('items/by-code/:code')
  findByCode(@Param('code') code: string) {
    return this.service.findItemByCode(code);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission(PERMISSIONS.CLINIC_INVENTORY.VIEW)
  @Get('items/:id')
  findItem(@Param('id') id: string) {
    return this.service.findItem(id);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission(PERMISSIONS.CLINIC_INVENTORY.MANAGE)
  @Put('items/:id')
  updateItem(@Param('id') id: string, @Body() dto: Partial<CreateItemDto>) {
    return this.service.updateItem(id, dto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission(PERMISSIONS.CLINIC_INVENTORY.MANAGE)
  @Delete('items/:id')
  deleteItem(@Param('id') id: string) {
    return this.service.deleteItem(id);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission(PERMISSIONS.CLINIC_INVENTORY.MANAGE)
  @Post('items/import-excel')
  @UseInterceptors(FileInterceptor('file'))
  async importExcel(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('لم يتم رفع ملف');
    return this.service.importFromExcel(file.buffer);
  }

  // ── Transactions ──────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission(PERMISSIONS.CLINIC_INVENTORY.ISSUE)
  @Post('items/:id/transactions')
  addTransaction(
    @Param('id') id: string,
    @Body() dto: CreateTransactionDto,
    @User() user: any,
  ) {
    return this.service.addTransaction(id, dto, user.userId);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission(PERMISSIONS.CLINIC_INVENTORY.VIEW)
  @Get('items/:id/history')
  getHistory(@Param('id') id: string) {
    return this.service.getItemHistory(id);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission(PERMISSIONS.CLINIC_INVENTORY.VIEW)
  @Get('transactions')
  listTransactions(@Query('from') from?: string, @Query('to') to?: string) {
    return this.service.listTransactions({ from, to });
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission(PERMISSIONS.CLINIC_INVENTORY.VIEW)
  @Get('low-stock-alerts')
  lowStockAlerts() {
    return this.service.getLowStockAlerts();
  }

  // ── Internal endpoints ─────────────────────────────────────────────

  @UseGuards(InternalAuthGuard)
  @Post('transactions/internal-deduct')
  internalDeduct(@Body() dto: InternalDeductDto) {
    return this.service.internalDeduct(dto);
  }

  @UseGuards(InternalAuthGuard)
  @Get('items/:id/check-stock')
  checkStock(@Param('id') id: string, @Query('qty') qty: string) {
    return this.service.checkStock(id, parseFloat(qty) || 1);
  }
}
