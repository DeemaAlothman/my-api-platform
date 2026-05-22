import { Module } from '@nestjs/common';
import { CasesController } from './cases.controller';
import { CasesService } from './cases.service';
import { PdfService } from './pdf.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [CasesController],
  providers: [CasesService, PdfService, PrismaService],
})
export class CasesModule {}
