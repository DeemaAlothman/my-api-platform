import { Module } from '@nestjs/common';
import { AttendanceBreaksController } from './attendance-breaks.controller';
import { AttendanceBreaksService } from './attendance-breaks.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AttendanceBreaksController],
  providers: [AttendanceBreaksService],
})
export class AttendanceBreaksModule {}
