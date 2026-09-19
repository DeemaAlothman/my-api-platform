import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ErpClientService } from '../integrations/erp-client.service';
import { AccountsService } from './accounts.service';
import { AccountsController, AccountsInternalController } from './accounts.controller';

@Module({
  controllers: [AccountsController, AccountsInternalController],
  providers: [AccountsService, PrismaService, ErpClientService],
})
export class AccountsModule {}
