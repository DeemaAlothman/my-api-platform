import { Module } from '@nestjs/common';
import { CasesController, CasesInternalController } from './cases.controller';
import { CasesService } from './cases.service';
import { PdfService } from './pdf.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [CasesController, CasesInternalController],
  providers: [CasesService, PdfService, PrismaService],
})
export class CasesModule {}
