import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from './prisma/prisma.service';
import { JwtStrategy, PRISMA_FOR_JWT } from '@shared/auth';
import { SourcesModule } from './sources/sources.module';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET!,
      signOptions: { expiresIn: '15m' },
    }),
    SourcesModule,
  ],
  providers: [
    PrismaService,
    JwtStrategy,
    { provide: PRISMA_FOR_JWT, useExisting: PrismaService },
  ],
})
export class AppModule {}
