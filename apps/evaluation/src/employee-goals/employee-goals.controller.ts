import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { EmployeeGoalsService } from './employee-goals.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { User } from '../common/decorators/current-user.decorator';
import { CurrentUser } from '../common/interfaces/user.interface';

@Controller('employee-goals')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EmployeeGoalsController {
  constructor(private readonly goalsService: EmployeeGoalsService) {}

  @Get('forms/:formId')
  findByForm(@Param('formId') formId: string, @User() user: CurrentUser) {
    return this.goalsService.findByForm(formId, user);
  }

  @Post('forms/:formId')
  create(
    @Param('formId') formId: string,
    @Body() dto: CreateGoalDto,
    @User() user: CurrentUser,
  ) {
    return this.goalsService.create(formId, dto, user);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateGoalDto,
    @User() user: CurrentUser,
  ) {
    return this.goalsService.update(id, dto, user);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @User() user: CurrentUser) {
    return this.goalsService.delete(id, user);
  }
}
