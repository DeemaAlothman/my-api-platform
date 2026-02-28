import { Controller, Get, Post, Patch, Delete, Query, Param, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { JobTitlesService } from './job-titles.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permission } from '../common/decorators/permission.decorator';
import { CreateJobTitleDto } from './dto/create-job-title.dto';
import { UpdateJobTitleDto } from './dto/update-job-title.dto';
import { ListJobTitlesQueryDto } from './dto/list-job-titles.query.dto';

@Controller('job-titles')
export class JobTitlesController {
  constructor(private readonly jobTitles: JobTitlesService) {}

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('job-titles:read')
  @Get()
  list(@Query() query: ListJobTitlesQueryDto) {
    return this.jobTitles.list(query);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('job-titles:read')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.jobTitles.findOne(id);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('job-titles:create')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateJobTitleDto) {
    return this.jobTitles.create(dto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('job-titles:update')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateJobTitleDto) {
    return this.jobTitles.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('job-titles:delete')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.jobTitles.remove(id);
  }
}
