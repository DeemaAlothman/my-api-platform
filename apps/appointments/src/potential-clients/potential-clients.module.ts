import { Module } from '@nestjs/common';
import { PotentialClientsController } from './potential-clients.controller';
import { PotentialClientsService } from './potential-clients.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [PotentialClientsController],
  providers: [PotentialClientsService, PrismaService],
})
export class PotentialClientsModule {}
