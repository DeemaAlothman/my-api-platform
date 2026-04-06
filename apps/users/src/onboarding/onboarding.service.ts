import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WorkflowType, WorkflowStatus, TaskStatus } from '@prisma/client';
import { CreateTemplateDto } from './dto/create-template.dto';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowTaskDto } from './dto/update-task.dto';

@Injectable()
export class OnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Templates ───────────────────────────────────────────────────────────

  async createTemplate(dto: CreateTemplateDto) {
    const { tasks, ...templateData } = dto;
    return this.prisma.onboardingTemplate.create({
      data: {
        ...templateData,
        tasks: {
          create: tasks.map((t, i) => ({ ...t, order: t.order ?? i })),
        },
      },
      include: { tasks: { orderBy: { order: 'asc' } } },
    });
  }

  async findAllTemplates(type?: WorkflowType) {
    return this.prisma.onboardingTemplate.findMany({
      where: { deletedAt: null, ...(type ? { type } : {}) },
      include: { tasks: { orderBy: { order: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneTemplate(id: string) {
    const template = await this.prisma.onboardingTemplate.findFirst({
      where: { id, deletedAt: null },
      include: { tasks: { orderBy: { order: 'asc' } } },
    });
    if (!template) throw new NotFoundException('Template not found');
    return template;
  }

  async deleteTemplate(id: string) {
    await this.findOneTemplate(id);
    await this.prisma.onboardingTemplate.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { success: true };
  }

  // ─── Workflows ───────────────────────────────────────────────────────────

  async createWorkflow(dto: CreateWorkflowDto) {
    const template = await this.prisma.onboardingTemplate.findFirst({
      where: { id: dto.templateId, deletedAt: null },
      include: { tasks: { orderBy: { order: 'asc' } } },
    });
    if (!template) throw new NotFoundException('Template not found');

    const employee = await this.prisma.employee.findFirst({ where: { id: dto.employeeId } });
    if (!employee) throw new NotFoundException('Employee not found');

    const startDate = new Date(dto.startDate);

    return this.prisma.onboardingWorkflow.create({
      data: {
        employeeId: dto.employeeId,
        templateId: dto.templateId,
        type: dto.type,
        startDate,
        targetDate: dto.targetDate ? new Date(dto.targetDate) : null,
        notes: dto.notes,
        tasks: {
          create: template.tasks.map((t) => ({
            templateTaskId: t.id,
            titleAr: t.titleAr,
            titleEn: t.titleEn,
            assignedTo: t.assignedTo,
            dueDate: t.daysFromStart > 0
              ? new Date(startDate.getTime() + t.daysFromStart * 86400000)
              : null,
          })),
        },
      },
      include: {
        tasks: { orderBy: { dueDate: 'asc' } },
        template: true,
        employee: { select: { firstNameAr: true, lastNameAr: true, firstNameEn: true, lastNameEn: true } },
      },
    });
  }

  async findWorkflows(employeeId?: string, status?: WorkflowStatus, type?: WorkflowType) {
    return this.prisma.onboardingWorkflow.findMany({
      where: {
        ...(employeeId ? { employeeId } : {}),
        ...(status ? { status } : {}),
        ...(type ? { type } : {}),
      },
      include: {
        tasks: { orderBy: { dueDate: 'asc' } },
        template: { select: { nameAr: true, nameEn: true } },
        employee: { select: { firstNameAr: true, lastNameAr: true, firstNameEn: true, lastNameEn: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneWorkflow(id: string) {
    const workflow = await this.prisma.onboardingWorkflow.findUnique({
      where: { id },
      include: {
        tasks: { orderBy: { dueDate: 'asc' } },
        template: { include: { tasks: { orderBy: { order: 'asc' } } } },
        employee: { select: { firstNameAr: true, lastNameAr: true, firstNameEn: true, lastNameEn: true } },
      },
    });
    if (!workflow) throw new NotFoundException('Workflow not found');
    return workflow;
  }

  async updateWorkflowTask(workflowId: string, taskId: string, dto: UpdateWorkflowTaskDto) {
    const task = await this.prisma.onboardingWorkflowTask.findFirst({
      where: { id: taskId, workflowId },
    });
    if (!task) throw new NotFoundException('Task not found');

    const updated = await this.prisma.onboardingWorkflowTask.update({
      where: { id: taskId },
      data: {
        ...dto,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        completedAt: dto.status === TaskStatus.COMPLETED ? new Date() : undefined,
      },
    });

    // تحقق إذا انتهت كل المهام → أكمل الـ workflow
    await this.checkAndCompleteWorkflow(workflowId);

    return updated;
  }

  async cancelWorkflow(id: string) {
    const workflow = await this.findOneWorkflow(id);
    if (workflow.status !== WorkflowStatus.IN_PROGRESS) {
      throw new BadRequestException('Only IN_PROGRESS workflows can be cancelled');
    }
    return this.prisma.onboardingWorkflow.update({
      where: { id },
      data: { status: WorkflowStatus.CANCELLED },
    });
  }

  private async checkAndCompleteWorkflow(workflowId: string) {
    const tasks = await this.prisma.onboardingWorkflowTask.findMany({ where: { workflowId } });
    const allDone = tasks.every(
      (t) => t.status === TaskStatus.COMPLETED || t.status === TaskStatus.SKIPPED,
    );
    if (allDone) {
      await this.prisma.onboardingWorkflow.update({
        where: { id: workflowId },
        data: { status: WorkflowStatus.COMPLETED, completedAt: new Date() },
      });
    }
  }
}
