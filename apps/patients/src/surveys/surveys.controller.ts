import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { SurveysService } from './surveys.service';
import { CreateSurveyDto } from './dto/create-survey.dto';
import { JwtAuthGuard } from '@shared/auth';
import { PermissionsGuard } from '@shared/guards/permissions.guard';
import { Permission } from '@shared/decorators/permission.decorator';
import { PERMISSIONS } from '@shared/constants/permissions.constants';
import { User } from '@shared/auth/decorators/current-user.decorator';

@Controller('patients/surveys')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SurveysController {
  constructor(private readonly service: SurveysService) {}

  @Post()
  @Permission(PERMISSIONS.CLINIC_PATIENTS.SURVEYS_CREATE)
  create(@Body() dto: CreateSurveyDto, @User() user: any) {
    return this.service.create(dto, user.userId);
  }

  @Get()
  @Permission(PERMISSIONS.CLINIC_PATIENTS.SURVEYS_VIEW)
  findAll(
    @Query('patientId') patientId?: string,
    @Query('department') department?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll({
      patientId, department,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id')
  @Permission(PERMISSIONS.CLINIC_PATIENTS.SURVEYS_VIEW)
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }
}
