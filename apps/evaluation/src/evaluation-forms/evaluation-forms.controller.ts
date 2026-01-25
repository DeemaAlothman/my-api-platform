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
import { SaveSelfEvaluationDto } from './dto/save-self-evaluation.dto';
import { SaveManagerEvaluationDto } from './dto/save-manager-evaluation.dto';
import { HRReviewDto } from './dto/hr-review.dto';
import { GMApprovalDto } from './dto/gm-approval.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { User } from '../common/decorators/current-user.decorator';
import { CurrentUser } from '../common/interfaces/user.interface';

@Controller('evaluation-forms')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EvaluationFormsController {
  constructor(private readonly formsService: EvaluationFormsService) {}

  @Get('my')
  getMyForm(@User() user: CurrentUser, @Query('periodId') periodId?: string) {
    return this.formsService.getMyForm(user, periodId);
  }

  @Get('pending-my-review')
  getPendingMyReview(@User() user: CurrentUser) {
    return this.formsService.getPendingMyReview(user);
  }

  @Get()
  @Permissions('evaluation:forms:view-all')
  findAll(@User() user: CurrentUser) {
    return this.formsService.findAll(user);
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
  @Permissions('evaluation:forms:manager-evaluate')
  saveManagerEvaluation(
    @Param('id') id: string,
    @Body() dto: SaveManagerEvaluationDto,
    @User() user: CurrentUser,
  ) {
    return this.formsService.saveManagerEvaluation(id, dto, user);
  }

  @Post(':id/manager/submit')
  @Permissions('evaluation:forms:manager-evaluate')
  submitManagerEvaluation(
    @Param('id') id: string,
    @User() user: CurrentUser,
  ) {
    return this.formsService.submitManagerEvaluation(id, user);
  }

  @Post(':id/hr-review')
  @Permissions('evaluation:forms:hr-review')
  hrReview(
    @Param('id') id: string,
    @Body() dto: HRReviewDto,
    @User() user: CurrentUser,
  ) {
    return this.formsService.hrReview(id, dto, user);
  }

  @Post(':id/gm-approval')
  @Permissions('evaluation:forms:gm-approval')
  gmApproval(
    @Param('id') id: string,
    @Body() dto: GMApprovalDto,
    @User() user: CurrentUser,
  ) {
    return this.formsService.gmApproval(id, dto, user);
  }
}
