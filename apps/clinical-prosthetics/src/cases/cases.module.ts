import { Module } from '@nestjs/common';
import { CasesController, CasesInternalController } from './cases.controller';
import { CasesService } from './cases.service';
import { PdfService } from './pdf.service';
import { PrismaService } from '../prisma/prisma.service';
import { CaseWritableGuard } from '../common/guards/case-writable.guard';
import { MissingFieldsInterceptor } from '../common/interceptors/missing-fields.interceptor';

@Module({
  controllers: [CasesController, CasesInternalController],
  providers: [CasesService, PdfService, PrismaService, CaseWritableGuard, MissingFieldsInterceptor],
})
export class CasesModule {}
