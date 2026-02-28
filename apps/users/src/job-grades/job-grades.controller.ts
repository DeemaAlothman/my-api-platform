import { Controller, Get, Post, Patch, Delete, Query, Param, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { JobGradesService } from './job-grades.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permission } from '../common/decorators/permission.decorator';
import { CreateJobGradeDto } from './dto/create-job-grade.dto';
import { UpdateJobGradeDto } from './dto/update-job-grade.dto';
import { ListJobGradesQueryDto } from './dto/list-job-grades.query.dto';

@Controller('job-grades')
export class JobGradesController {
  constructor(private readonly jobGrades: JobGradesService) {}

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('job-grades:read')
  @Get()
  list(@Query() query: ListJobGradesQueryDto) {
    return this.jobGrades.list(query);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('job-grades:read')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.jobGrades.findOne(id);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('job-grades:create')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateJobGradeDto) {
    return this.jobGrades.create(dto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('job-grades:update')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateJobGradeDto) {
    return this.jobGrades.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('job-grades:delete')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.jobGrades.remove(id);
  }
}
