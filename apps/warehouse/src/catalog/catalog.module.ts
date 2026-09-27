import { Module } from '@nestjs/common';
import { UnitsController, CategoriesController, SuppliersController, ItemsController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [UnitsController, CategoriesController, SuppliersController, ItemsController],
  providers: [CatalogService, PrismaService],
})
export class CatalogModule {}
