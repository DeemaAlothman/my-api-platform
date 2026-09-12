import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ErpClientService } from '../integrations/erp-client.service';
import { AssignmentsService } from './assignments.service';
import { AssignmentsController } from './assignments.controller';

@Module({
  controllers: [AssignmentsController],
  providers: [AssignmentsService, PrismaService, ErpClientService],
  exports: [AssignmentsService],
})
export class AssignmentsModule {}
