import { Module } from '@nestjs/common';
import { MaterialRequestsController, MaterialRequestsInternalController } from './material-requests.controller';
import { MaterialRequestsService } from './material-requests.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [MaterialRequestsController, MaterialRequestsInternalController],
  providers: [MaterialRequestsService, PrismaService],
})
export class MaterialRequestsModule {}
