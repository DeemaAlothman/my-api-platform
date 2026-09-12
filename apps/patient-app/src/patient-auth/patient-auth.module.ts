import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ErpClientService } from '../integrations/erp-client.service';
import { PatientAuthService } from './patient-auth.service';
import { PatientAuthController } from './patient-auth.controller';

// ملاحظة: PatientJwtStrategy تُسجَّل مرة واحدة على مستوى AppModule (نفس نمط JwtStrategy المشترك بباقي الخدمات)
@Module({
  controllers: [PatientAuthController],
  providers: [PatientAuthService, PrismaService, ErpClientService],
})
export class PatientAuthModule {}
