import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CyclesController } from './cycles.controller';
import { CyclesService } from './cycles.service';
import { CycleGenerationCron } from './cycle-generation.cron';

@Module({
  controllers: [CyclesController],
  providers: [CyclesService, PrismaService, CycleGenerationCron],
  exports: [CyclesService],
})
export class CyclesModule {}
