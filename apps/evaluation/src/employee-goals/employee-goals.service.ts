import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { CurrentUser } from '../common/interfaces/user.interface';

@Injectable()
export class EmployeeGoalsService {
  constructor(private prisma: PrismaService) {}

  async findByForm(formId: string, user: CurrentUser) {
    // Check if form exists and user has access
    const form = await this.prisma.evaluationForm.findUnique({
      where: { id: formId },
    });

    if (!form) {
      throw new NotFoundException(`Form with ID ${formId} not found`);
    }

    const hasAccess =
      form.employeeId === user.userId ||
      form.evaluatorId === user.userId ||
      user.permissions.includes('evaluation:forms:view-all');

    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to these goals');
    }

    return this.prisma.employeeGoal.findMany({
      where: { formId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(formId: string, dto: CreateGoalDto, user: CurrentUser) {
    // Check if form exists
    const form = await this.prisma.evaluationForm.findUnique({
      where: { id: formId },
    });

    if (!form) {
      throw new NotFoundException(`Form with ID ${formId} not found`);
    }

    // Only employee can create goals for their form
    if (form.employeeId !== user.userId) {
      throw new ForbiddenException(
        'You can only create goals for your own evaluation',
      );
    }

    const data: any = {
      formId,
      title: dto.title,
      description: dto.description,
      weight: dto.weight,
    };

    if (dto.targetDate) {
      data.targetDate = new Date(dto.targetDate);
    }

    return this.prisma.employeeGoal.create({
      data,
    });
  }

  async update(id: string, dto: UpdateGoalDto, user: CurrentUser) {
    const goal = await this.prisma.employeeGoal.findUnique({
      where: { id },
      include: { form: true },
    });

    if (!goal) {
      throw new NotFoundException(`Goal with ID ${id} not found`);
    }

    // Determine what can be updated based on user role
    const isEmployee = goal.form.employeeId === user.userId;
    const isManager = goal.form.evaluatorId === user.userId;

    if (!isEmployee && !isManager) {
      throw new ForbiddenException('You do not have access to update this goal');
    }

    const data: any = {};

    // Employee can update basic info and self assessment
    if (isEmployee) {
      if (dto.title !== undefined) data.title = dto.title;
      if (dto.description !== undefined) data.description = dto.description;
      if (dto.weight !== undefined) data.weight = dto.weight;
      if (dto.selfAchievement !== undefined)
        data.selfAchievement = dto.selfAchievement;
      if (dto.selfComments !== undefined) data.selfComments = dto.selfComments;
      if (dto.status !== undefined) data.status = dto.status;
      if (dto.targetDate !== undefined) {
        data.targetDate = new Date(dto.targetDate);
      }
    }

    // Manager can update manager assessment
    if (isManager) {
      if (dto.managerAchievement !== undefined)
        data.managerAchievement = dto.managerAchievement;
      if (dto.managerComments !== undefined)
        data.managerComments = dto.managerComments;
      if (dto.status !== undefined) data.status = dto.status;
    }

    return this.prisma.employeeGoal.update({
      where: { id },
      data,
    });
  }

  async delete(id: string, user: CurrentUser) {
    const goal = await this.prisma.employeeGoal.findUnique({
      where: { id },
      include: { form: true },
    });

    if (!goal) {
      throw new NotFoundException(`Goal with ID ${id} not found`);
    }

    // Only employee can delete their goals
    if (goal.form.employeeId !== user.userId) {
      throw new ForbiddenException(
        'You can only delete goals from your own evaluation',
      );
    }

    return this.prisma.employeeGoal.delete({
      where: { id },
    });
  }
}
