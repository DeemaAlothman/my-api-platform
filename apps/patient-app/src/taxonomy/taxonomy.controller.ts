import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@shared/auth';
import { PermissionsGuard } from '@shared/guards/permissions.guard';
import { Permission } from '@shared/decorators/permission.decorator';
import { PERMISSIONS } from '@shared/constants/permissions.constants';
import { TaxonomyService } from './taxonomy.service';
import {
  CreateBodyRegionDto, UpdateBodyRegionDto,
  CreateTargetRegionDto, UpdateTargetRegionDto,
  CreateSubTargetRegionDto, UpdateSubTargetRegionDto,
  CreateExerciseGoalDto, UpdateExerciseGoalDto,
} from './dto/taxonomy.dto';

// القراءة متاحة أيضاً لمن يملك صلاحية إسناد/إدارة التمارين (يحتاجها عند تصفية المكتبة)، والإدارة (إنشاء/تعديل) محصورة بـTAXONOMY_MANAGE
const READ_PERMS = [
  PERMISSIONS.CLINIC_PATIENT_APP.TAXONOMY_MANAGE,
  PERMISSIONS.CLINIC_PATIENT_APP.EXERCISE_LIBRARY_MANAGE,
  PERMISSIONS.CLINIC_PATIENT_APP.ASSIGNMENT_CREATE,
] as const;

@Controller('patient-app/taxonomy')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TaxonomyController {
  constructor(private readonly service: TaxonomyService) {}

  @Get('body-regions')
  @Permission(...READ_PERMS)
  listBodyRegions() {
    return this.service.listBodyRegions();
  }
  @Post('body-regions')
  @Permission(PERMISSIONS.CLINIC_PATIENT_APP.TAXONOMY_MANAGE)
  createBodyRegion(@Body() dto: CreateBodyRegionDto) {
    return this.service.createBodyRegion(dto);
  }
  @Put('body-regions/:id')
  @Permission(PERMISSIONS.CLINIC_PATIENT_APP.TAXONOMY_MANAGE)
  updateBodyRegion(@Param('id') id: string, @Body() dto: UpdateBodyRegionDto) {
    return this.service.updateBodyRegion(id, dto);
  }

  @Get('target-regions')
  @Permission(...READ_PERMS)
  listTargetRegions(@Query('bodyRegionId') bodyRegionId?: string) {
    return this.service.listTargetRegions(bodyRegionId);
  }
  @Post('target-regions')
  @Permission(PERMISSIONS.CLINIC_PATIENT_APP.TAXONOMY_MANAGE)
  createTargetRegion(@Body() dto: CreateTargetRegionDto) {
    return this.service.createTargetRegion(dto);
  }
  @Put('target-regions/:id')
  @Permission(PERMISSIONS.CLINIC_PATIENT_APP.TAXONOMY_MANAGE)
  updateTargetRegion(@Param('id') id: string, @Body() dto: UpdateTargetRegionDto) {
    return this.service.updateTargetRegion(id, dto);
  }

  @Get('sub-target-regions')
  @Permission(...READ_PERMS)
  listSubTargetRegions(@Query('targetRegionId') targetRegionId?: string) {
    return this.service.listSubTargetRegions(targetRegionId);
  }
  @Post('sub-target-regions')
  @Permission(PERMISSIONS.CLINIC_PATIENT_APP.TAXONOMY_MANAGE)
  createSubTargetRegion(@Body() dto: CreateSubTargetRegionDto) {
    return this.service.createSubTargetRegion(dto);
  }
  @Put('sub-target-regions/:id')
  @Permission(PERMISSIONS.CLINIC_PATIENT_APP.TAXONOMY_MANAGE)
  updateSubTargetRegion(@Param('id') id: string, @Body() dto: UpdateSubTargetRegionDto) {
    return this.service.updateSubTargetRegion(id, dto);
  }

  @Get('goals')
  @Permission(...READ_PERMS)
  listGoals() {
    return this.service.listGoals();
  }
  @Post('goals')
  @Permission(PERMISSIONS.CLINIC_PATIENT_APP.TAXONOMY_MANAGE)
  createGoal(@Body() dto: CreateExerciseGoalDto) {
    return this.service.createGoal(dto);
  }
  @Put('goals/:id')
  @Permission(PERMISSIONS.CLINIC_PATIENT_APP.TAXONOMY_MANAGE)
  updateGoal(@Param('id') id: string, @Body() dto: UpdateExerciseGoalDto) {
    return this.service.updateGoal(id, dto);
  }
}
