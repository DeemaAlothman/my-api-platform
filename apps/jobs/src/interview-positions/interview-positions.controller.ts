import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InterviewPositionsService } from './interview-positions.service';
import { CreateInterviewPositionDto } from './dto/create-interview-position.dto';
import { UpdateInterviewPositionDto } from './dto/update-interview-position.dto';
import { CreateTechnicalQuestionDto } from './dto/create-technical-question.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('Interview Positions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('interview-positions')
export class InterviewPositionsController {
  constructor(private readonly service: InterviewPositionsService) {}

  @Post()
  create(@Body() dto: CreateInterviewPositionDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(@Query() query: { status?: string; page?: string; limit?: string }) {
    return this.service.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateInterviewPositionDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  // Technical Questions
  @Post(':id/technical-questions')
  addQuestion(@Param('id') id: string, @Body() dto: CreateTechnicalQuestionDto) {
    return this.service.addTechnicalQuestion(id, dto);
  }

  @Put(':id/technical-questions/:questionId')
  updateQuestion(
    @Param('id') id: string,
    @Param('questionId') questionId: string,
    @Body() dto: Partial<CreateTechnicalQuestionDto>,
  ) {
    return this.service.updateTechnicalQuestion(id, questionId, dto);
  }

  @Delete(':id/technical-questions/:questionId')
  removeQuestion(@Param('id') id: string, @Param('questionId') questionId: string) {
    return this.service.removeTechnicalQuestion(id, questionId);
  }

  @Get(':id/technical-questions')
  getQuestions(@Param('id') id: string) {
    return this.service.getTechnicalQuestions(id);
  }

  @Get(':id/comparison')
  getComparison(@Param('id') id: string) {
    return this.service.getComparison(id);
  }
}
