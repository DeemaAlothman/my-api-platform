import { Module } from '@nestjs/common';
import { CustodiesController } from './custodies.controller';
import { CustodiesService } from './custodies.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [CustodiesController],
  providers: [CustodiesService, PrismaService],
  exports: [CustodiesService],
})
export class CustodiesModule {}
