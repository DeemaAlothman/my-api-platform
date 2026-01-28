import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { LeaveBalancesService } from './leave-balances.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permission } from '../common/decorators/permission.decorator';
import { EmployeeId } from '../common/decorators/employee.decorator';
import { EmployeeInterceptor } from '../common/interceptors/employee.interceptor';

@Controller('leave-balances')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UseInterceptors(EmployeeInterceptor)
export class LeaveBalancesController {
  constructor(private readonly leaveBalancesService: LeaveBalancesService) { }

  // الحصول على جميع الأرصدة (HR/Admin)
  @Get()
  @Permission('leave_balances:read_all')
  findAll(@Query('year') year?: string) {
    const yearNum = year ? parseInt(year, 10) : undefined;
    return this.leaveBalancesService.findAll(yearNum);
  }

  // الحصول على رصيد الموظف الحالي
  @Get('my')
  @Permission('leave_balances:read')
  findMy(@EmployeeId() employeeId: string, @Query('year') year?: string) {
    const yearNum = year ? parseInt(year, 10) : undefined;
    return this.leaveBalancesService.findByEmployee(employeeId, yearNum);
  }

  // الحصول على رصيد موظف معين (HR فقط)
  @Get('employee/:employeeId')
  @Permission('leave_balances:read_all')
  findByEmployee(@Param('employeeId') employeeId: string, @Query('year') year?: string) {
    const yearNum = year ? parseInt(year, 10) : undefined;
    return this.leaveBalancesService.findByEmployee(employeeId, yearNum);
  }

  // الحصول على رصيد محدد
  @Get(':id')
  @Permission('leave_balances:read')
  findOne(@Param('id') id: string) {
    return this.leaveBalancesService.findOne(id);
  }

  // إنشاء رصيد جديد (HR فقط)
  @Post()
  @Permission('leave_balances:create')
  create(
    @Body()
    body: {
      employeeId: string;
      leaveTypeId: string;
      year: number;
      totalDays: number;
    },
  ) {
    return this.leaveBalancesService.create(
      body.employeeId,
      body.leaveTypeId,
      body.year,
      body.totalDays,
    );
  }

  // تعديل رصيد (HR فقط)
  @Post(':id/adjust')
  @Permission('leave_balances:adjust')
  adjust(
    @Param('id') id: string,
    @Body() body: { adjustmentDays: number; adjustmentReason: string },
  ) {
    return this.leaveBalancesService.adjust(id, body.adjustmentDays, body.adjustmentReason);
  }

  // ترحيل أرصدة موظف (HR فقط)
  @Post('employee/:employeeId/carry-over')
  @Permission('leave_balances:carry_over')
  carryOver(
    @Param('employeeId') employeeId: string,
    @Body() body: { fromYear: number; toYear: number },
  ) {
    return this.leaveBalancesService.carryOver(employeeId, body.fromYear, body.toYear);
  }

  // تهيئة أرصدة موظف جديد (HR فقط)
  @Post('employee/:employeeId/initialize')
  @Permission('leave_balances:initialize')
  initialize(@Param('employeeId') employeeId: string, @Query('year') year?: string) {
    const yearNum = year ? parseInt(year, 10) : undefined;
    return this.leaveBalancesService.initializeForEmployee(employeeId, yearNum);
  }

  // حذف رصيد (HR فقط)
  @Delete(':id')
  @Permission('leave_balances:delete')
  remove(@Param('id') id: string) {
    return this.leaveBalancesService.remove(id);
  }
}
