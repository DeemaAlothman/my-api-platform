import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@shared/auth';
import { PermissionsGuard } from '@shared/guards/permissions.guard';
import { Permission } from '@shared/decorators/permission.decorator';
import { PERMISSIONS } from '@shared/constants/permissions.constants';
import { User } from '@shared/auth/decorators/current-user.decorator';
import { ExercisesService } from './exercises.service';
import { CreateExerciseDto, UpdateExerciseDto, ListExercisesQueryDto } from './dto/exercise.dto';

const READ_PERMS = [
  PERMISSIONS.CLINIC_PATIENT_APP.EXERCISE_LIBRARY_MANAGE,
  PERMISSIONS.CLINIC_PATIENT_APP.ASSIGNMENT_CREATE,
] as const;

@Controller('patient-app/exercises')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ExercisesController {
  constructor(private readonly service: ExercisesService) {}

  @Get()
  @Permission(...READ_PERMS)
  findAll(@Query() query: ListExercisesQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @Permission(...READ_PERMS)
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Permission(PERMISSIONS.CLINIC_PATIENT_APP.EXERCISE_LIBRARY_MANAGE)
  create(@Body() dto: CreateExerciseDto, @User() user: any) {
    return this.service.create(dto, user.userId);
  }

  @Put(':id')
  @Permission(PERMISSIONS.CLINIC_PATIENT_APP.EXERCISE_LIBRARY_MANAGE)
  update(@Param('id') id: string, @Body() dto: UpdateExerciseDto, @User() user: any) {
    return this.service.update(id, dto, user.userId);
  }
}
