import { Module } from '@nestjs/common';
import { DelegationExpiryService } from './delegation-expiry.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  providers: [DelegationExpiryService, PrismaService],
})
export class DelegationsModule {}
