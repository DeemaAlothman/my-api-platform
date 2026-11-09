import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CyclesController } from './cycles.controller';
import { CyclesService } from './cycles.service';
import { VotesService } from './votes.service';
import { RewardsService } from './rewards.service';
import { CommentsService } from './comments.service';
import { CommentsController, CommentModerationController } from './comments.controller';
import { CycleGenerationCron } from './cycle-generation.cron';
import { VotingCloseCron } from './voting-close.cron';

@Module({
  controllers: [CyclesController, CommentsController, CommentModerationController],
  providers: [
    CyclesService,
    VotesService,
    RewardsService,
    CommentsService,
    PrismaService,
    CycleGenerationCron,
    VotingCloseCron,
  ],
  exports: [CyclesService, VotesService],
})
export class CyclesModule {}
