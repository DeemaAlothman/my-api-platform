import { Controller, Get, Post, Put, Param, Body, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ProbationEvaluationsService } from './probation-evaluations.service';
import { CreateProbationEvaluationDto, WorkflowActionDto } from './dto/create-probation-evaluation.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('Probation Evaluations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('probation/evaluations')
export class ProbationEvaluationsController {
  constructor(private readonly service: ProbationEvaluationsService) {}

  @Post()
  create(@Body() dto: CreateProbationEvaluationDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('employee/:employeeId')
  findByEmployee(@Param('employeeId') employeeId: string) {
    return this.service.findByEmployee(employeeId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateProbationEvaluationDto>) {
    return this.service.update(id, dto);
  }

  @Post(':id/submit')
  submit(@Param('id') id: string, @Body() dto: WorkflowActionDto) {
    // TODO: extract performedBy from JWT
    return this.service.submit(id, 'system', dto);
  }

  @Post(':id/senior-approve')
  seniorApprove(@Param('id') id: string, @Body() dto: WorkflowActionDto) {
    return this.service.seniorApprove(id, 'system', dto);
  }

  @Post(':id/senior-reject')
  seniorReject(@Param('id') id: string, @Body() dto: WorkflowActionDto) {
    return this.service.seniorReject(id, 'system', dto);
  }

  @Post(':id/hr-document')
  hrDocument(@Param('id') id: string, @Body() dto: WorkflowActionDto) {
    return this.service.hrDocument(id, 'system', dto);
  }

  @Post(':id/hr-reject')
  hrReject(@Param('id') id: string, @Body() dto: WorkflowActionDto) {
    return this.service.hrReject(id, 'system', dto);
  }

  @Post(':id/ceo-decide')
  ceoDecide(@Param('id') id: string, @Body() dto: WorkflowActionDto) {
    return this.service.ceoDecide(id, 'system', dto);
  }

  @Post(':id/employee-acknowledge')
  employeeAcknowledge(@Param('id') id: string, @Body() dto: WorkflowActionDto) {
    return this.service.employeeAcknowledge(id, 'system', dto);
  }
}
