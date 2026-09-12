import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExercisesService } from './exercises.service';
import { ExercisesController } from './exercises.controller';

@Module({
  controllers: [ExercisesController],
  providers: [ExercisesService, PrismaService],
  exports: [ExercisesService],
})
export class ExercisesModule {}
