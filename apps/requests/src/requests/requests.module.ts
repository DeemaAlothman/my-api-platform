import { Module } from '@nestjs/common';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';
import { PrismaService } from '../prisma/prisma.service';
import { ApprovalService } from './approval.service';
import { ApprovalResolverService } from './approval-resolver.service';
import { RequestNotificationsService } from './notifications.service';

@Module({
  controllers: [RequestsController],
  providers: [RequestsService, ApprovalService, ApprovalResolverService, PrismaService, RequestNotificationsService],
})
export class RequestsModule {}
