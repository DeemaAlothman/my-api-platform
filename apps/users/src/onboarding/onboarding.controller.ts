import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { WorkflowType, WorkflowStatus } from '@prisma/client';
import { OnboardingService } from './onboarding.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowTaskDto } from './dto/update-task.dto';

@ApiTags('Onboarding')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly service: OnboardingService) {}

  // ─── Templates ────────────────────────────────────────────────────────────

  @Post('templates')
  @ApiOperation({ summary: 'Create onboarding/offboarding template' })
  createTemplate(@Body() dto: CreateTemplateDto) {
    return this.service.createTemplate(dto);
  }

  @Get('templates')
  @ApiOperation({ summary: 'List templates' })
  @ApiQuery({ name: 'type', enum: WorkflowType, required: false })
  findAllTemplates(@Query('type') type?: WorkflowType) {
    return this.service.findAllTemplates(type);
  }

  @Get('templates/:id')
  @ApiOperation({ summary: 'Get template by id' })
  findOneTemplate(@Param('id') id: string) {
    return this.service.findOneTemplate(id);
  }

  @Delete('templates/:id')
  @ApiOperation({ summary: 'Delete template (soft)' })
  deleteTemplate(@Param('id') id: string) {
    return this.service.deleteTemplate(id);
  }

  // ─── Workflows ────────────────────────────────────────────────────────────

  @Post('workflows')
  @ApiOperation({ summary: 'Start onboarding/offboarding workflow for employee' })
  createWorkflow(@Body() dto: CreateWorkflowDto) {
    return this.service.createWorkflow(dto);
  }

  @Get('workflows')
  @ApiOperation({ summary: 'List workflows' })
  @ApiQuery({ name: 'employeeId', required: false })
  @ApiQuery({ name: 'status', enum: WorkflowStatus, required: false })
  @ApiQuery({ name: 'type', enum: WorkflowType, required: false })
  findWorkflows(
    @Query('employeeId') employeeId?: string,
    @Query('status') status?: WorkflowStatus,
    @Query('type') type?: WorkflowType,
  ) {
    return this.service.findWorkflows(employeeId, status, type);
  }

  @Get('workflows/:id')
  @ApiOperation({ summary: 'Get workflow with tasks' })
  findOneWorkflow(@Param('id') id: string) {
    return this.service.findOneWorkflow(id);
  }

  @Patch('workflows/:workflowId/tasks/:taskId')
  @ApiOperation({ summary: 'Update task status' })
  updateTask(
    @Param('workflowId') workflowId: string,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateWorkflowTaskDto,
  ) {
    return this.service.updateWorkflowTask(workflowId, taskId, dto);
  }

  @Patch('workflows/:id/cancel')
  @ApiOperation({ summary: 'Cancel workflow' })
  cancelWorkflow(@Param('id') id: string) {
    return this.service.cancelWorkflow(id);
  }
}
