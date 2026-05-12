import { Controller, Get, Post, Body, Patch, Param, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { AttendanceJustificationsService } from './attendance-justifications.service';
import { CreateAttendanceJustificationDto } from './dto/create-attendance-justification.dto';
import { ManagerReviewDto } from './dto/manager-review.dto';
import { HrReviewDto } from './dto/hr-review.dto';
import { ListAttendanceJustificationsQueryDto } from './dto/list-attendance-justifications.query.dto';
import { JwtAuthGuard } from '@shared/auth';
import { PermissionsGuard } from '@shared';
import { Permission } from '@shared';
import { EmployeeInterceptor } from '../common/interceptors/employee.interceptor';
import { EmployeeId, UserId } from '@shared/auth';

@Controller('attendance-justifications')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UseInterceptors(EmployeeInterceptor)
export class AttendanceJustificationsController {
  constructor(private readonly service: AttendanceJustificationsService) {}

  // الموظف يرفع تبرير لتنبيهه
  @Post()
  @Permission('attendance.justifications.create-own')
  submit(@EmployeeId() employeeId: string, @Body() dto: CreateAttendanceJustificationDto) {
    return this.service.submit(employeeId, dto);
  }

  // الموظف يرى تبريراته
  @Get('my')
  @Permission('attendance.justifications.read-own')
  findMine(
    @EmployeeId() employeeId: string,
    @Query() query: ListAttendanceJustificationsQueryDto,
  ) {
    return this.service.findMine(employeeId, query);
  }

  // المدير يرى تبريرات موظفيه
  @Get('my-team')
  @Permission('attendance.justifications.manager-review')
  getMyTeamJustifications(
    @EmployeeId() employeeId: string,
    @Query() query: ListAttendanceJustificationsQueryDto,
  ) {
    return this.service.getMyTeamJustifications(employeeId, query);
  }

  // الإدارة: معالجة التنبيهات المنتهية مهلتها
  @Post('process-expired')
  @Permission('attendance.justifications.read')
  processExpired() {
    return this.service.processExpired();
  }

  // الإدارة: قائمة كل التبريرات
  @Get()
  @Permission('attendance.justifications.read')
  findAll(@Query() query: ListAttendanceJustificationsQueryDto) {
    return this.service.findAll(query);
  }

  // تفاصيل تبرير واحد
  @Get(':id')
  @Permission('attendance.justifications.read')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  // مراجعة المدير (APPROVE أو REJECT)
  @Patch(':id/manager-review')
  @Permission('attendance.justifications.manager-review')
  managerReview(
    @Param('id') id: string,
    @UserId() managerId: string,
    @Body() dto: ManagerReviewDto,
  ) {
    return this.service.managerReview(id, managerId, dto);
  }

  // مراجعة HR (APPROVE أو REJECT النهائي)
  @Patch(':id/hr-review')
  @Permission('attendance.justifications.hr-review')
  hrReview(
    @Param('id') id: string,
    @UserId() hrId: string,
    @Body() dto: HrReviewDto,
  ) {
    return this.service.hrReview(id, hrId, dto);
  }
}
