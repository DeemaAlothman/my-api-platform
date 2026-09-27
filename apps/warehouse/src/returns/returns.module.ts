import { Module } from '@nestjs/common';
import { ReturnsController } from './returns.controller';
import { ReturnsService } from './returns.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [ReturnsController],
  providers: [ReturnsService, PrismaService],
})
export class ReturnsModule {}
