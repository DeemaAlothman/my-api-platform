import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SourcesController } from './sources.controller';
import { SourcesService } from './sources.service';

@Module({
  controllers: [SourcesController],
  providers: [SourcesService, PrismaService],
})
export class SourcesModule {}
