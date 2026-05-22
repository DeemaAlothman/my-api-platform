import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from './prisma/prisma.service';
import { InventoryModule } from './inventory/inventory.module';
import { JwtStrategy, PRISMA_FOR_JWT } from '@shared/auth';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET!,
      signOptions: { expiresIn: '15m' },
    }),
    InventoryModule,
  ],
  providers: [
    PrismaService,
    JwtStrategy,
    { provide: PRISMA_FOR_JWT, useExisting: PrismaService },
  ],
})
export class AppModule {}
