import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CandidatesService } from './candidates.service';
import { CandidatesController } from './candidates.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, HttpModule],
  controllers: [CandidatesController],
  providers: [CandidatesService],
})
export class CandidatesModule {}
