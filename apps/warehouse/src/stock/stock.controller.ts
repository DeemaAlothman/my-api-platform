import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { StockService } from './stock.service';
import { AdjustStockDto } from './dto/stock.dto';
import { JwtAuthGuard } from '@shared/auth';
import { PermissionsGuard } from '@shared';
import { Permission } from '@shared';
import { User } from '@shared/auth/decorators/current-user.decorator';
import { PERMISSIONS } from '@shared/constants/permissions.constants';

@Controller('warehouse/stock')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class StockController {
  constructor(private readonly service: StockService) {}

  @Get('balances')
  @Permission(PERMISSIONS.WAREHOUSE.STOCK_READ)
  listBalances(@Query('warehouseId') warehouseId?: string, @Query('itemId') itemId?: string) {
    return this.service.listBalances({ warehouseId, itemId });
  }

  @Get('movements')
  @Permission(PERMISSIONS.WAREHOUSE.STOCK_READ)
  listMovements(
    @Query('warehouseId') warehouseId?: string,
    @Query('itemId') itemId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.listMovements({
      warehouseId,
      itemId,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Post('adjust')
  @Permission(PERMISSIONS.WAREHOUSE.STOCK_ADJUST)
  adjust(@Body() dto: AdjustStockDto, @User() user: any) {
    return this.service.adjust(dto, user.userId);
  }
}
