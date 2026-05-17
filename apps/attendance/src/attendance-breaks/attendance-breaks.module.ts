import { Module } from '@nestjs/common';
import { AttendanceBreaksController } from './attendance-breaks.controller';
import { AttendanceBreaksService } from './attendance-breaks.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [AttendanceBreaksController],
  providers: [AttendanceBreaksService, PrismaService],
})
export class AttendanceBreaksModule {}
