import { Module } from '@nestjs/common';
import { UnitsController, CategoriesController, SuppliersController, ItemsController, ManufacturersController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [UnitsController, CategoriesController, SuppliersController, ItemsController, ManufacturersController],
  providers: [CatalogService, PrismaService],
})
export class CatalogModule {}
