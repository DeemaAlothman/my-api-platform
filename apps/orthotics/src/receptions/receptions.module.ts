import { Module } from '@nestjs/common';
import { ReceptionsService } from './receptions.service';
import { ReceptionsController, ReceptionsInternalController } from './receptions.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [ReceptionsController, ReceptionsInternalController],
  providers: [ReceptionsService, PrismaService],
})
export class ReceptionsModule {}
