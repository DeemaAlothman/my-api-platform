import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from './prisma/prisma.service';
import { HealthModule } from './health/health.module';
import { WarehousesModule } from './warehouses/warehouses.module';
import { CatalogModule } from './catalog/catalog.module';
import { StockModule } from './stock/stock.module';
import { MaterialRequestsModule } from './material-requests/material-requests.module';
import { CurrenciesModule } from './currencies/currencies.module';
import { PurchasingModule } from './purchasing/purchasing.module';
import { TransfersModule } from './transfers/transfers.module';
import { ReturnsModule } from './returns/returns.module';
import { InventoryCountsModule } from './inventory-counts/inventory-counts.module';
import { JwtStrategy, PRISMA_FOR_JWT } from '@shared/auth';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET!,
      signOptions: { expiresIn: '15m' },
    }),
    HealthModule,
    WarehousesModule,
    CatalogModule,
    StockModule,
    MaterialRequestsModule,
    CurrenciesModule,
    PurchasingModule,
    TransfersModule,
    ReturnsModule,
    InventoryCountsModule,
  ],
  providers: [
    PrismaService,
    JwtStrategy,
    { provide: PRISMA_FOR_JWT, useExisting: PrismaService },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
