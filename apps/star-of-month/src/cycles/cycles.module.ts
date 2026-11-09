import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CyclesController } from './cycles.controller';
import { CyclesService } from './cycles.service';
import { VotesService } from './votes.service';
import { CycleGenerationCron } from './cycle-generation.cron';
import { VotingCloseCron } from './voting-close.cron';

@Module({
  controllers: [CyclesController],
  providers: [CyclesService, VotesService, PrismaService, CycleGenerationCron, VotingCloseCron],
  exports: [CyclesService, VotesService],
})
export class CyclesModule {}
