import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ProbationCriteriaService } from './probation-criteria.service';
import { CreateProbationCriteriaDto, JobTitleCriteriaDto } from './dto/create-probation-criteria.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('Probation Criteria')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('probation/criteria')
export class ProbationCriteriaController {
  constructor(private readonly service: ProbationCriteriaService) {}

  @Get()
  findAll() { return this.service.findAll(); }

  @Post()
  create(@Body() dto: CreateProbationCriteriaDto) { return this.service.create(dto); }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateProbationCriteriaDto>) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  deactivate(@Param('id') id: string) { return this.service.deactivate(id); }

  @Get('by-job-title/:jobTitleId')
  getByJobTitle(@Param('jobTitleId') jobTitleId: string) {
    return this.service.getByJobTitle(jobTitleId);
  }

  @Put('job-title/:jobTitleId')
  setJobTitleCriteria(@Param('jobTitleId') jobTitleId: string, @Body() dto: JobTitleCriteriaDto) {
    return this.service.setJobTitleCriteria(jobTitleId, dto.criteriaIds);
  }
}
