import { Module } from '@nestjs/common';
import { MaterialRequestsController } from './material-requests.controller';
import { MaterialRequestsService } from './material-requests.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [MaterialRequestsController],
  providers: [MaterialRequestsService, PrismaService],
})
export class MaterialRequestsModule {}
