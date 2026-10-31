import { Module } from '@nestjs/common';
import { ReceptionsService } from './receptions.service';
import { ReceptionsController } from './receptions.controller';
import { SalesController } from './sales.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [ReceptionsController, SalesController],
  providers: [ReceptionsService, PrismaService],
})
export class ReceptionsModule {}
