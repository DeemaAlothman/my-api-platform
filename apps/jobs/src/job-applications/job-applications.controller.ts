import { Controller, Get, Put, Patch, Query, Param, Body, UseGuards } from '@nestjs/common';
import { JobApplicationsService } from './job-applications.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permission } from '../common/decorators/permission.decorator';
import { ListJobApplicationsQueryDto } from './dto/list-job-applications.query.dto';
import { UpdateJobApplicationDto } from './dto/update-job-application.dto';

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

  // موافقة المدير التنفيذي — ينقل الحالة إلى HIRED
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('job-applications:ceo-approve')
  @Patch(':id/ceo-approve')
  ceoApprove(@Param('id') id: string) {
    return this.jobApplications.ceoApprove(id);
  }
}
