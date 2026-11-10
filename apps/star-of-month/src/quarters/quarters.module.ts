import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QuartersController } from './quarters.controller';
import { QuartersService } from './quarters.service';
import { CertificateService } from './certificate.service';
import { QuarterGenerationCron } from './quarter-generation.cron';

@Module({
  controllers: [QuartersController],
  providers: [QuartersService, CertificateService, PrismaService, QuarterGenerationCron],
  exports: [QuartersService],
})
export class QuartersModule {}
