import {
  Body, Controller, Get, Param, Patch, Post, Put, Res, StreamableFile, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { JwtAuthGuard, User } from '@shared/auth';
import type { CurrentUser } from '@shared/auth';
import { PermissionsGuard, Permission } from '@shared';
import { AppraisalService } from './appraisal.service';
import {
  CreateCycleDto, UpdateCycleDto, SaveSubmissionDto, UpdateSettingsDto,
  SetDepartmentConfigDto, SetReadinessJobTitlesDto,
} from './dto/appraisal.dto';

export const PERM_MANAGE = 'evaluation:appraisal:manage';
export const PERM_VIEW_RATERS = 'evaluation:appraisal:view-raters';

const sendFile = (filePath: string, res: Response) => {
  const buffer = fs.readFileSync(filePath);
  res.set({
    'Content-Type': 'application/octet-stream',
    'Content-Disposition': `inline; filename="${encodeURIComponent(path.basename(filePath))}"`,
    'Content-Length': String(buffer.length),
  });
  return new StreamableFile(buffer);
};

// ═══════════════ الموارد البشرية ═══════════════
@ApiTags('Appraisal 360 — HR')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('appraisal')
export class AppraisalHrController {
  constructor(private readonly service: AppraisalService) {}

  @Permission(PERM_MANAGE) @Post('cycles')
  createCycle(@Body() dto: CreateCycleDto, @User() u: CurrentUser) { return this.service.createCycle(dto, u.userId); }

  @Permission(PERM_MANAGE) @Get('cycles')
  listCycles() { return this.service.listCycles(); }

  @Permission(PERM_MANAGE) @Patch('cycles/:id')
  updateCycle(@Param('id') id: string, @Body() dto: UpdateCycleDto) { return this.service.updateCycle(id, dto); }

  @Permission(PERM_MANAGE) @Post('cycles/:id/open')
  open(@Param('id') id: string, @User() u: CurrentUser) { return this.service.transition(id, 'OPEN', u.userId); }

  @Permission(PERM_MANAGE) @Post('cycles/:id/close')
  close(@Param('id') id: string, @User() u: CurrentUser) { return this.service.transition(id, 'CLOSED', u.userId); }

  @Permission(PERM_MANAGE) @Post('cycles/:id/finalize')
  finalize(@Param('id') id: string, @User() u: CurrentUser) { return this.service.transition(id, 'FINALIZED', u.userId); }

  @Permission(PERM_MANAGE) @Post('cycles/:id/compute')
  compute(@Param('id') id: string) { return this.service.compute(id); }

  @Permission(PERM_MANAGE) @Get('cycles/:id/progress')
  progress(@Param('id') id: string) { return this.service.progress(id); }

  @Permission(PERM_MANAGE) @Get('cycles/:id/results')
  results(@Param('id') id: string) { return this.service.listResults(id); }

  @Permission(PERM_MANAGE) @Get('cycles/:id/results/:employeeId')
  resultDetail(@Param('id') id: string, @Param('employeeId') employeeId: string, @User() u: CurrentUser) {
    return this.service.resultDetail(id, employeeId, u.permissions?.includes(PERM_VIEW_RATERS) ?? false);
  }

  @Permission(PERM_MANAGE) @Get('settings')
  settings() { return this.service.getSettings(); }

  @Permission(PERM_MANAGE) @Put('settings')
  updateSettings(@Body() dto: UpdateSettingsDto, @User() u: CurrentUser) { return this.service.updateSettings(dto, u.userId); }

  @Permission(PERM_MANAGE) @Get('department-config')
  departmentConfig() { return this.service.listDepartmentConfig(); }

  @Permission(PERM_MANAGE) @Put('department-config/:departmentId')
  setDepartmentConfig(@Param('departmentId') id: string, @Body() dto: SetDepartmentConfigDto, @User() u: CurrentUser) {
    return this.service.setDepartmentConfig(id, dto, u.userId);
  }

  @Permission(PERM_MANAGE) @Get('readiness-job-titles')
  readiness() { return this.service.listReadinessJobTitles(); }

  @Permission(PERM_MANAGE) @Put('readiness-job-titles')
  setReadiness(@Body() dto: SetReadinessJobTitlesDto) { return this.service.setReadinessJobTitles(dto); }
}

// ═══════════════ كل موظف ═══════════════
@ApiTags('Appraisal 360 — Employee')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('appraisal/me')
export class AppraisalMeController {
  constructor(private readonly service: AppraisalService) {}

  @Get('questions')
  questions() { return this.service.getQuestions(); }

  @Get('current-cycle')
  currentCycle() { return this.service.currentCycle(); }

  @Get('cycles/:id/tasks')
  tasks(@Param('id') id: string, @User() u: CurrentUser) { return this.service.myTasks(id, u.userId); }

  @Get('cycles/:id/submissions/:axis/:evaluateeId')
  getSubmission(
    @Param('id') id: string, @Param('axis') axis: string, @Param('evaluateeId') evaluateeId: string, @User() u: CurrentUser,
  ) { return this.service.getMySubmission(id, axis, evaluateeId, u.userId); }

  @Put('cycles/:id/submissions')
  save(@Param('id') id: string, @Body() dto: SaveSubmissionDto, @User() u: CurrentUser) {
    return this.service.saveSubmission(id, dto, u.userId);
  }

  @Post('cycles/:id/submissions/:submissionId/submit')
  submit(@Param('id') id: string, @Param('submissionId') sid: string, @User() u: CurrentUser) {
    return this.service.submit(id, sid, u.userId);
  }

  @Post('cycles/:id/achievement-file')
  @UseInterceptors(FileInterceptor('file'))
  upload(@Param('id') id: string, @UploadedFile() file: Express.Multer.File, @User() u: CurrentUser) {
    return this.service.uploadAchievement(id, file, u.userId);
  }

  /** مرفق إنجازات موظف — لصاحبه أو مديره المباشر أو HR */
  @Get('cycles/:id/achievement-file/:employeeId')
  async download(
    @Param('id') id: string, @Param('employeeId') employeeId: string, @User() u: CurrentUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const p = await this.service.achievementFilePath(id, employeeId, u.userId, u.permissions?.includes(PERM_MANAGE) ?? false);
    return sendFile(p, res);
  }

  @Get('cycles/:id/result')
  myResult(@Param('id') id: string, @User() u: CurrentUser) { return this.service.myResult(id, u.userId); }
}
