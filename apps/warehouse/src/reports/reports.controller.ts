import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { DateRangeQueryDto } from './dto/reports.dto';
import { JwtAuthGuard } from '@shared/auth';
import { PermissionsGuard } from '@shared';
import { Permission } from '@shared';
import { PERMISSIONS } from '@shared/constants/permissions.constants';

@Controller('warehouse/reports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get('stock-valuation')
  @Permission(PERMISSIONS.WAREHOUSE.REPORTS_READ)
  stockValuation(@Query('warehouseId') warehouseId?: string) {
    return this.service.stockValuation(warehouseId);
  }

  @Get('low-stock')
  @Permission(PERMISSIONS.WAREHOUSE.REPORTS_READ)
  lowStock(@Query('warehouseId') warehouseId?: string) {
    return this.service.lowStock(warehouseId);
  }

  @Get('stock-movements')
  @Permission(PERMISSIONS.WAREHOUSE.REPORTS_READ)
  stockMovements(@Query() query: DateRangeQueryDto) {
    return this.service.stockMovementsSummary(query);
  }

  @Get('purchases-summary')
  @Permission(PERMISSIONS.WAREHOUSE.REPORTS_READ)
  purchasesSummary(@Query() query: DateRangeQueryDto) {
    return this.service.purchasesSummary(query);
  }

  @Get('sales-summary')
  @Permission(PERMISSIONS.WAREHOUSE.REPORTS_READ)
  salesSummary(@Query() query: DateRangeQueryDto) {
    return this.service.salesSummary(query);
  }

  @Get('material-requests-summary')
  @Permission(PERMISSIONS.WAREHOUSE.REPORTS_READ)
  materialRequestsSummary(@Query() query: DateRangeQueryDto) {
    return this.service.materialRequestsSummary(query);
  }

  @Get('returns-summary')
  @Permission(PERMISSIONS.WAREHOUSE.REPORTS_READ)
  returnsSummary(@Query() query: DateRangeQueryDto) {
    return this.service.returnsSummary(query);
  }

  @Get('inventory-variance')
  @Permission(PERMISSIONS.WAREHOUSE.REPORTS_READ)
  inventoryVariance(@Query('warehouseId') warehouseId?: string) {
    return this.service.lastCountVariance(warehouseId);
  }
}
