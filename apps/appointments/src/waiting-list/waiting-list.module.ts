import { Module } from '@nestjs/common';
import { WaitingListController } from './waiting-list.controller';
import { WaitingListService } from './waiting-list.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [WaitingListController],
  providers: [WaitingListService, PrismaService],
})
export class WaitingListModule {}
