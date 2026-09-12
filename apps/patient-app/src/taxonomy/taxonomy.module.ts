import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TaxonomyService } from './taxonomy.service';
import { TaxonomyController } from './taxonomy.controller';

@Module({
  controllers: [TaxonomyController],
  providers: [TaxonomyService, PrismaService],
  exports: [TaxonomyService],
})
export class TaxonomyModule {}
