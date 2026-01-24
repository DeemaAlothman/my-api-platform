import { Module } from '@nestjs/common';
import { AttendanceRecordsController } from './attendance-records.controller';
import { AttendanceRecordsService } from './attendance-records.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [AttendanceRecordsController],
  providers: [AttendanceRecordsService, PrismaService],
  exports: [AttendanceRecordsService],
})
export class AttendanceRecordsModule {}
