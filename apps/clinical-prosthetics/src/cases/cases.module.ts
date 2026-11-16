import { Module } from '@nestjs/common';
import { CasesController, CasesInternalController } from './cases.controller';
import { CasesService } from './cases.service';
import { PdfService } from './pdf.service';
import { PrismaService } from '../prisma/prisma.service';
import { CaseWritableGuard } from '../common/guards/case-writable.guard';

@Module({
  controllers: [CasesController, CasesInternalController],
  providers: [CasesService, PdfService, PrismaService, CaseWritableGuard],
})
export class CasesModule {}
