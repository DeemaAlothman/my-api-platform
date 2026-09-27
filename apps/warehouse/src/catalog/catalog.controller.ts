import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import {
  CreateUnitDto, UpdateUnitDto,
  CreateCategoryDto, UpdateCategoryDto,
  CreateSupplierDto, UpdateSupplierDto,
  CreateItemDto, UpdateItemDto,
} from './dto/catalog.dto';
import { JwtAuthGuard } from '@shared/auth';
import { PermissionsGuard } from '@shared';
import { Permission } from '@shared';
import { PERMISSIONS } from '@shared/constants/permissions.constants';

@Controller('warehouse/units')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UnitsController {
  constructor(private readonly service: CatalogService) {}

  @Get()
  @Permission(PERMISSIONS.WAREHOUSE.UNITS_READ)
  list() {
    return this.service.listUnits();
  }

  @Post()
  @Permission(PERMISSIONS.WAREHOUSE.UNITS_CREATE)
  create(@Body() dto: CreateUnitDto) {
    return this.service.createUnit(dto);
  }

  @Put(':id')
  @Permission(PERMISSIONS.WAREHOUSE.UNITS_UPDATE)
  update(@Param('id') id: string, @Body() dto: UpdateUnitDto) {
    return this.service.updateUnit(id, dto);
  }
}

@Controller('warehouse/categories')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CategoriesController {
  constructor(private readonly service: CatalogService) {}

  @Get()
  @Permission(PERMISSIONS.WAREHOUSE.ITEMS_READ)
  list() {
    return this.service.listCategories();
  }

  @Post()
  @Permission(PERMISSIONS.WAREHOUSE.ITEMS_CREATE)
  create(@Body() dto: CreateCategoryDto) {
    return this.service.createCategory(dto);
  }

  @Put(':id')
  @Permission(PERMISSIONS.WAREHOUSE.ITEMS_UPDATE)
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.service.updateCategory(id, dto);
  }
}

@Controller('warehouse/suppliers')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SuppliersController {
  constructor(private readonly service: CatalogService) {}

  @Get()
  @Permission(PERMISSIONS.WAREHOUSE.SUPPLIERS_READ)
  list() {
    return this.service.listSuppliers();
  }

  @Post()
  @Permission(PERMISSIONS.WAREHOUSE.SUPPLIERS_CREATE)
  create(@Body() dto: CreateSupplierDto) {
    return this.service.createSupplier(dto);
  }

  @Put(':id')
  @Permission(PERMISSIONS.WAREHOUSE.SUPPLIERS_UPDATE)
  update(@Param('id') id: string, @Body() dto: UpdateSupplierDto) {
    return this.service.updateSupplier(id, dto);
  }
}

@Controller('warehouse/items')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ItemsController {
  constructor(private readonly service: CatalogService) {}

  @Get()
  @Permission(PERMISSIONS.WAREHOUSE.ITEMS_READ)
  list(
    @Query('search') search?: string,
    @Query('itemType') itemType?: string,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.service.listItems({ search, itemType, categoryId });
  }

  @Get(':id')
  @Permission(PERMISSIONS.WAREHOUSE.ITEMS_READ)
  findOne(@Param('id') id: string) {
    return this.service.findItem(id);
  }

  @Post()
  @Permission(PERMISSIONS.WAREHOUSE.ITEMS_CREATE)
  create(@Body() dto: CreateItemDto) {
    return this.service.createItem(dto);
  }

  @Put(':id')
  @Permission(PERMISSIONS.WAREHOUSE.ITEMS_UPDATE)
  update(@Param('id') id: string, @Body() dto: UpdateItemDto) {
    return this.service.updateItem(id, dto);
  }

  @Delete(':id')
  @Permission(PERMISSIONS.WAREHOUSE.ITEMS_UPDATE)
  remove(@Param('id') id: string) {
    return this.service.deleteItem(id);
  }
}
