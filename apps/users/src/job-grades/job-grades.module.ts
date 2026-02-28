import { Module } from '@nestjs/common';
import { JobGradesController } from './job-grades.controller';
import { JobGradesService } from './job-grades.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [JobGradesController],
  providers: [JobGradesService, PrismaService],
})
export class JobGradesModule {}
