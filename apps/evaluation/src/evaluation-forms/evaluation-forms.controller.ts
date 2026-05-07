import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { EvaluationFormsService } from './evaluation-forms.service';
import { CreateEvaluationFormDto } from './dto/create-evaluation-form.dto';
import { SaveSelfEvaluationDto } from './dto/save-self-evaluation.dto';
import { SaveManagerEvaluationDto } from './dto/save-manager-evaluation.dto';
import { HRReviewDto } from './dto/hr-review.dto';
import { GMApprovalDto } from './dto/gm-approval.dto';
import { JwtAuthGuard, User } from '@shared/auth';
import { PermissionsGuard, Permission } from '@shared';
import type { CurrentUser } from '@shared/auth';

@Controller('evaluation-forms')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EvaluationFormsController {
  constructor(private readonly formsService: EvaluationFormsService) {}

  @Post()
  @Permission('evaluation:forms:view-all')
  create(@Body() createFormDto: CreateEvaluationFormDto) {
    return this.formsService.create(createFormDto);
  }

  @Get('my')
  getMyForm(@User() user: CurrentUser, @Query('periodId') periodId?: string) {
    return this.formsService.getMyForm(user, periodId);
  }

  @Get('pending-my-review')
  getPendingMyReview(@User() user: CurrentUser) {
    return this.formsService.getPendingMyReview(user);
  }

  @Get()
  @Permission('evaluation:forms:view-all')
  findAll(
    @User() user: CurrentUser,
    @Query('periodId') periodId?: string,
    @Query('status') status?: string,
    @Query('employeeId') employeeId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.formsService.findAll(user, { periodId, status, employeeId, page, limit });
  }

  @Get(':id')
  findOne(@Param('id') id: string, @User() user: CurrentUser) {
    return this.formsService.findOne(id, user);
  }

  @Patch(':id/self')
  saveSelfEvaluation(
    @Param('id') id: string,
    @Body() dto: SaveSelfEvaluationDto,
    @User() user: CurrentUser,
  ) {
    return this.formsService.saveSelfEvaluation(id, dto, user);
  }

  @Post(':id/self/submit')
  submitSelfEvaluation(@Param('id') id: string, @User() user: CurrentUser) {
    return this.formsService.submitSelfEvaluation(id, user);
  }

  @Patch(':id/manager')
  @Permission('evaluation:forms:manager-evaluate')
  saveManagerEvaluation(
    @Param('id') id: string,
    @Body() dto: SaveManagerEvaluationDto,
    @User() user: CurrentUser,
  ) {
    return this.formsService.saveManagerEvaluation(id, dto, user);
  }

  @Post(':id/manager/submit')
  @Permission('evaluation:forms:manager-evaluate')
  submitManagerEvaluation(
    @Param('id') id: string,
    @User() user: CurrentUser,
  ) {
    return this.formsService.submitManagerEvaluation(id, user);
  }

  @Post(':id/hr-review')
  @Permission('evaluation:forms:hr-review')
  hrReview(
    @Param('id') id: string,
    @Body() dto: HRReviewDto,
    @User() user: CurrentUser,
  ) {
    return this.formsService.hrReview(id, dto, user);
  }

  @Post(':id/gm-approval')
  @Permission('evaluation:forms:gm-approval')
  gmApproval(
    @Param('id') id: string,
    @Body() dto: GMApprovalDto,
    @User() user: CurrentUser,
  ) {
    return this.formsService.gmApproval(id, dto, user);
  }
}
