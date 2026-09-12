import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ErpClientService } from '../integrations/erp-client.service';
import { RatingsService } from './ratings.service';
import { RatingsController } from './ratings.controller';
import { RatingsAdminController } from './ratings-admin.controller';

@Module({
  controllers: [RatingsController, RatingsAdminController],
  providers: [RatingsService, PrismaService, ErpClientService],
})
export class RatingsModule {}
