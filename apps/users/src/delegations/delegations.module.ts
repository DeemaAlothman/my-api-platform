import { Module } from '@nestjs/common';
import { DelegationExpiryService } from './delegation-expiry.service';
import { DelegationsController } from './delegations.controller';
import { DelegationsService } from './delegations.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [DelegationsController],
  providers: [DelegationExpiryService, DelegationsService, PrismaService],
})
export class DelegationsModule {}
