import { Module } from '@nestjs/common';
import { AttendanceJustificationsController } from './attendance-justifications.controller';
import { AttendanceJustificationsService } from './attendance-justifications.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [AttendanceJustificationsController],
  providers: [AttendanceJustificationsService, PrismaService],
  exports: [AttendanceJustificationsService],
})
export class AttendanceJustificationsModule {}
