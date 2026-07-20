import { Module } from '@nestjs/common';
import { ReceptionsService } from './receptions.service';
import { ReceptionsController } from './receptions.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [ReceptionsController],
  providers: [ReceptionsService, PrismaService],
})
export class ReceptionsModule {}
