import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ErpClientService } from '../integrations/erp-client.service';
import { MeService } from './me.service';
import { MeController } from './me.controller';

@Module({
  controllers: [MeController],
  providers: [MeService, PrismaService, ErpClientService],
})
export class MeModule {}
