import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { EmployeeSchedulesService } from './employee-schedules.service';
import { InternalAuthGuard } from '@shared';

// نقطة داخلية (خدمة-لخدمة): دوام الموظف لتاريخ — محمية بـ InternalAuthGuard فقط
@Controller('employee-schedules/internal')
export class EmployeeSchedulesInternalController {
  constructor(private readonly service: EmployeeSchedulesService) {}

  @Get(':employeeId/for-date')
  @UseGuards(InternalAuthGuard)
  forDate(@Param('employeeId') employeeId: string, @Query('date') date: string) {
    return this.service.getScheduleForDateInternal(employeeId, date);
  }
}
