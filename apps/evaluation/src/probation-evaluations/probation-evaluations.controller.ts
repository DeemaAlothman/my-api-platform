import { Controller, Get, Post, Put, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ProbationEvaluationsService } from './probation-evaluations.service';
import { CreateProbationEvaluationDto, WorkflowActionDto } from './dto/create-probation-evaluation.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permissions } from '../common/decorators/permissions.decorator';

@ApiTags('Probation Evaluations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('probation-evaluations')
export class ProbationEvaluationsController {
  constructor(private readonly service: ProbationEvaluationsService) {}

  @Post()
  create(@Body() dto: CreateProbationEvaluationDto) {
    return this.service.create(dto);
  }

  @Get('pending-my-action')
  findPendingMyAction(@Request() req: any) {
    return this.service.findPendingMyAction(req.user?.userId);
  }

  @Permissions('probation:view-all')
  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('employee/:employeeId')
  findByEmployee(@Param('employeeId') employeeId: string) {
    return this.service.findByEmployee(employeeId);
  }

  @Get(':id/history')
  findHistory(@Param('id') id: string) {
    return this.service.findHistory(id);
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
  submit(@Param('id') id: string, @Body() dto: WorkflowActionDto, @Request() req: any) {
    return this.service.submit(id, req.user?.userId ?? 'system', dto);
  }

  @Permissions('probation:senior-review')
  @Post(':id/senior-approve')
  seniorApprove(@Param('id') id: string, @Body() dto: WorkflowActionDto, @Request() req: any) {
    return this.service.seniorApprove(id, req.user?.userId ?? 'system', dto);
  }

  @Permissions('probation:senior-review')
  @Post(':id/senior-reject')
  seniorReject(@Param('id') id: string, @Body() dto: WorkflowActionDto, @Request() req: any) {
    return this.service.seniorReject(id, req.user?.userId ?? 'system', dto);
  }

  @Permissions('probation:hr-review')
  @Post(':id/hr-document')
  hrDocument(@Param('id') id: string, @Body() dto: WorkflowActionDto, @Request() req: any) {
    return this.service.hrDocument(id, req.user?.userId ?? 'system', dto);
  }

  @Permissions('probation:hr-review')
  @Post(':id/hr-reject')
  hrReject(@Param('id') id: string, @Body() dto: WorkflowActionDto, @Request() req: any) {
    return this.service.hrReject(id, req.user?.userId ?? 'system', dto);
  }

  @Permissions('probation:ceo-review')
  @Post(':id/ceo-decide')
  ceoDecide(@Param('id') id: string, @Body() dto: WorkflowActionDto, @Request() req: any) {
    return this.service.ceoDecide(id, req.user?.userId ?? 'system', dto);
  }

  @Post(':id/employee-acknowledge')
  employeeAcknowledge(@Param('id') id: string, @Body() dto: WorkflowActionDto, @Request() req: any) {
    return this.service.employeeAcknowledge(id, req.user?.userId ?? 'system', dto);
  }

  @Post(':id/schedule-meeting')
  scheduleMeeting(@Param('id') id: string, @Body() body: { meetingProposedAt: string }, @Request() req: any) {
    return this.service.scheduleMeeting(id, req.user?.userId ?? 'system', new Date(body.meetingProposedAt));
  }

  @Post(':id/confirm-meeting')
  confirmMeeting(@Param('id') id: string, @Body() body: { role: 'employee' | 'manager' }, @Request() req: any) {
    return this.service.confirmMeeting(id, req.user?.userId ?? 'system', body.role);
  }

  @Post(':id/close-evaluation')
  closeEvaluation(@Param('id') id: string, @Body() body: { decisionDocumentUrl?: string }, @Request() req: any) {
    return this.service.closeEvaluation(id, req.user?.userId ?? 'system', body.decisionDocumentUrl);
  }
}
