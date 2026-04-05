import { Controller, Get, Post, Put, Param, Body, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InterviewCriteriaService } from './interview-criteria.service';
import { CreateCriterionDto } from './dto/create-criterion.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('Interview Criteria')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('interview-criteria')
export class InterviewCriteriaController {
  constructor(private readonly service: InterviewCriteriaService) {}

  @Get('personal')
  getPersonal() {
    return this.service.getPersonalCriteria();
  }

  @Post('personal')
  createPersonal(@Body() dto: CreateCriterionDto) {
    return this.service.createPersonalCriterion(dto);
  }

  @Put('personal/:id')
  updatePersonal(@Param('id') id: string, @Body() dto: Partial<CreateCriterionDto>) {
    return this.service.updatePersonalCriterion(id, dto);
  }

  @Get('computer')
  getComputer() {
    return this.service.getComputerCriteria();
  }

  @Post('computer')
  createComputer(@Body() dto: CreateCriterionDto) {
    return this.service.createComputerCriterion(dto);
  }

  @Put('computer/:id')
  updateComputer(@Param('id') id: string, @Body() dto: Partial<CreateCriterionDto>) {
    return this.service.updateComputerCriterion(id, dto);
  }
}
