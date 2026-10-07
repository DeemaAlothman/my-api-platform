import { Controller, Get, Put, Patch, Query, Param, Body, UseGuards, Req } from '@nestjs/common';
import { JobApplicationsService } from './job-applications.service';
import { JwtAuthGuard } from '@shared/auth';
import { PermissionsGuard } from '@shared';
import { Permission } from '@shared';
import { ListJobApplicationsQueryDto } from './dto/list-job-applications.query.dto';
import { UpdateJobApplicationDto } from './dto/update-job-application.dto';
import { SetTalentDto } from './dto/set-talent.dto';

@Controller('job-applications')
export class JobApplicationsController {
  constructor(private readonly jobApplications: JobApplicationsService) {}

  // جلب جميع الطلبات
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('job-applications:read')
  @Get()
  findAll(@Query() query: ListJobApplicationsQueryDto) {
    return this.jobApplications.findAll(query);
  }

  // إحصائيات الطلبات (يجب أن يكون قبل :id)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('job-applications:read')
  @Get('stats')
  getStats() {
    return this.jobApplications.getStats();
  }

  // جلب طلب واحد
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('job-applications:read')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.jobApplications.findOne(id);
  }

  // تحديث حالة طلب
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('job-applications:update')
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateJobApplicationDto) {
    return this.jobApplications.update(id, dto);
  }

  // إضافة/إزالة الطلب من قائمة المواهب
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('job-applications:update')
  @Patch(':id/talent')
  setTalent(@Param('id') id: string, @Body() dto: SetTalentDto, @Req() req: any) {
    return this.jobApplications.setTalent(id, dto.isTalent, req.user?.userId ?? req.user?.sub);
  }

  // موافقة المدير التنفيذي — ينقل الحالة إلى HIRED
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('job-applications:ceo-approve')
  @Patch(':id/ceo-approve')
  ceoApprove(@Param('id') id: string) {
    return this.jobApplications.ceoApprove(id);
  }
}
