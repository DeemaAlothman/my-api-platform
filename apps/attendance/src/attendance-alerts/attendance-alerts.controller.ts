import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { AttendanceAlertsService } from './attendance-alerts.service';
import { CreateAttendanceAlertDto } from './dto/create-attendance-alert.dto';
import { UpdateAttendanceAlertDto } from './dto/update-attendance-alert.dto';
import { JwtAuthGuard } from '@shared/auth';
import { PermissionsGuard } from '@shared';
import { Permission } from '@shared';
import { EmployeeInterceptor } from '../common/interceptors/employee.interceptor';
import { EmployeeId, UserId } from '@shared/auth';
import { ListAttendanceAlertsQueryDto } from './dto/list-attendance-alerts.query.dto';

@Controller('attendance-alerts')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UseInterceptors(EmployeeInterceptor)
export class AttendanceAlertsController {
  constructor(private readonly service: AttendanceAlertsService) {}

  @Get('my-alerts')
  @Permission('attendance.alerts.read-own')
  getMyAlerts(
    @EmployeeId() employeeId: string,
    @Query() query: ListAttendanceAlertsQueryDto,
  ) {
    return this.service.getMyAlerts(employeeId, query);
  }

  @Post()
  @Permission('attendance.alerts.create')
  create(@Body() dto: CreateAttendanceAlertDto) {
    return this.service.create(dto);
  }

  @Get()
  @Permission('attendance.alerts.read')
  findAll(@Query() query: ListAttendanceAlertsQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @Permission('attendance.alerts.read')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Permission('attendance.alerts.update')
  update(@Param('id') id: string, @Body() dto: UpdateAttendanceAlertDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/resolve')
  @Permission('attendance.alerts.resolve')
  resolve(
    @Param('id') id: string,
    @UserId() userId: string,
    @Body('resolutionNotes') resolutionNotes?: string,
  ) {
    return this.service.markAsResolved(id, userId, resolutionNotes);
  }

  @Delete(':id')
  @Permission('attendance.alerts.delete')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
