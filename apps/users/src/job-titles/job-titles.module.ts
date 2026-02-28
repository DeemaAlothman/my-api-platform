import { Module } from '@nestjs/common';
import { JobTitlesController } from './job-titles.controller';
import { JobTitlesService } from './job-titles.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [JobTitlesController],
  providers: [JobTitlesService, PrismaService],
})
export class JobTitlesModule {}
