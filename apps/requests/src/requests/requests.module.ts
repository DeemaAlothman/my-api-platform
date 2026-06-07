import { Module } from '@nestjs/common';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';
import { PrismaService } from '../prisma/prisma.service';
import { ApprovalService } from './approval.service';
import { ApprovalResolverService } from './approval-resolver.service';
import { RequestNotificationsService } from './notifications.service';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceService } from './maintenance.service';

@Module({
  controllers: [RequestsController, MaintenanceController],
  providers: [RequestsService, ApprovalService, ApprovalResolverService, PrismaService, RequestNotificationsService, MaintenanceService],
})
export class RequestsModule {}
