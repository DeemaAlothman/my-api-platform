import { Controller, Get, Post, Body, Patch, Param, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { AttendanceJustificationsService } from './attendance-justifications.service';
import { CreateAttendanceJustificationDto } from './dto/create-attendance-justification.dto';
import { ManagerReviewDto } from './dto/manager-review.dto';
import { HrReviewDto } from './dto/hr-review.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permission } from '../common/decorators/permission.decorator';
import { EmployeeInterceptor } from '../common/interceptors/employee.interceptor';
import { EmployeeId, UserId } from '../common/decorators/employee.decorator';

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
    @Query('status') status?: string,
  ) {
    return this.service.findMine(employeeId, { status });
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
  findAll(
    @Query('employeeId') employeeId?: string,
    @Query('status') status?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.service.findAll({ employeeId, status, dateFrom, dateTo });
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
