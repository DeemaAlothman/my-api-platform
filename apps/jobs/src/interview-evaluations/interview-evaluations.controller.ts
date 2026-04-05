import { Controller, Get, Post, Put, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InterviewEvaluationsService } from './interview-evaluations.service';
import { CreateInterviewEvaluationDto } from './dto/create-interview-evaluation.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('Interview Evaluations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('interview-evaluations')
export class InterviewEvaluationsController {
  constructor(private readonly service: InterviewEvaluationsService) {}

  @Post()
  create(@Body() dto: CreateInterviewEvaluationDto, @Request() req: any) {
    return this.service.create(dto, req.user?.userId);
  }

  @Get()
  findAll(@Query() query: { positionId?: string; decision?: string; page?: string; limit?: string }) {
    return this.service.findAll(query);
  }

  @Get('by-application/:jobApplicationId')
  findByApplication(@Param('jobApplicationId') jobApplicationId: string) {
    return this.service.findByApplicationId(jobApplicationId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateInterviewEvaluationDto>, @Request() req: any) {
    return this.service.update(id, dto, req.user?.userId);
  }

  @Post(':id/transfer-to-employee')
  transfer(@Param('id') id: string) {
    return this.service.transferToEmployee(id);
  }
}
