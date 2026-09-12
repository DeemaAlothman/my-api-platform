import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ErpClientService } from '../integrations/erp-client.service';
import { AccountsService } from './accounts.service';
import { AccountsController } from './accounts.controller';

@Module({
  controllers: [AccountsController],
  providers: [AccountsService, PrismaService, ErpClientService],
})
export class AccountsModule {}
