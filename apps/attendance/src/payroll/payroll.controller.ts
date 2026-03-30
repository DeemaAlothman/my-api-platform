import {
  Controller, Get, Post, Patch,
  Param, Body, Query, UseGuards, Req,
} from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { GeneratePayrollDto } from './dto/generate-payroll.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permission } from '../common/decorators/permission.decorator';

@Controller('payroll')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PayrollController {
  constructor(private readonly service: PayrollService) {}

  /**
   * POST /payroll/generate
   * توليد كشوف الرواتب الشهرية
   */
  @Post('generate')
  @Permission('attendance.payroll.generate')
  generate(@Body() dto: GeneratePayrollDto) {
    return this.service.generate(dto);
  }

  /**
   * GET /payroll
   * عرض كشوف الرواتب
   */
  @Get()
  @Permission('attendance.payroll.read')
  findAll(
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Query('departmentId') departmentId?: string,
    @Query('status') status?: string,
  ) {
    return this.service.findAll({
      year: year ? parseInt(year) : undefined,
      month: month ? parseInt(month) : undefined,
      departmentId,
      status,
    });
  }

  /**
   * GET /payroll/:employeeId/:year/:month
   * كشف موظف محدد
   */
  @Get(':employeeId/:year/:month')
  @Permission('attendance.payroll.read')
  findOne(
    @Param('employeeId') employeeId: string,
    @Param('year') year: string,
    @Param('month') month: string,
  ) {
    return this.service.findOne(employeeId, parseInt(year), parseInt(month));
  }

  /**
   * PATCH /payroll/:id/confirm
   * تأكيد الكشف
   */
  @Patch(':id/confirm')
  @Permission('attendance.payroll.confirm')
  confirm(@Param('id') id: string, @Req() req: any) {
    const confirmedBy = req.user?.sub || 'unknown';
    return this.service.confirm(id, confirmedBy);
  }

  /**
   * POST /payroll/export/:year/:month
   * تصدير الكشوف المؤكدة للنظام المالي
   */
  @Post('export/:year/:month')
  @Permission('attendance.payroll.export')
  exportMonth(
    @Param('year') year: string,
    @Param('month') month: string,
  ) {
    return this.service.exportMonth(parseInt(year), parseInt(month));
  }
}
