import {
  Controller, Get, Post, Patch,
  Param, Body, Query, UseGuards, Req, Res,
} from '@nestjs/common';
import { Response } from 'express';
import { PayrollService } from './payroll.service';
import { GeneratePayrollDto } from './dto/generate-payroll.dto';
import { JwtAuthGuard } from '@shared/auth';
import { PermissionsGuard } from '@shared';
import { Permission } from '@shared';

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
   * GET /payroll/:employeeId/:year/:month/payslip
   * كشف راتب مفصّل لموظف (Payslip)
   */
  @Get(':employeeId/:year/:month/payslip')
  @Permission('attendance.payroll.read')
  getPayslip(
    @Param('employeeId') employeeId: string,
    @Param('year') year: string,
    @Param('month') month: string,
  ) {
    return this.service.getPayslip(employeeId, parseInt(year), parseInt(month));
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

  /**
   * PATCH /payroll/:id/other-deduction
   * تعديل الخصم الآخر (يدوي) على كشف DRAFT
   */
  @Patch(':id/other-deduction')
  @Permission('attendance.payroll.edit-other-deduction')
  updateOtherDeduction(
    @Param('id') id: string,
    @Body() body: { amount: number; notes?: string },
  ) {
    return this.service.updateOtherDeduction(id, body.amount, body.notes);
  }

  /**
   * PATCH /payroll/:id/note
   * تعديل ملاحظات الكشف
   */
  @Patch(':id/note')
  @Permission('attendance.payroll.edit-notes')
  updateNote(@Param('id') id: string, @Body() body: { notes: string }) {
    return this.service.updateNote(id, body.notes);
  }

  /**
   * POST /payroll/reset/:year/:month
   * حذف كشوف DRAFT لشهر معين مع إرجاع أرصدة السلف
   */
  @Post('reset/:year/:month')
  @Permission('attendance.payroll.generate')
  resetMonth(
    @Param('year') year: string,
    @Param('month') month: string,
  ) {
    return this.service.resetMonth(parseInt(year), parseInt(month));
  }

  /**
   * GET /payroll/export-xlsx/:year/:month
   * تصدير كشوف الرواتب بصيغة Excel
   */
  @Get('export-xlsx/:year/:month')
  @Permission('attendance.payroll.export-xlsx')
  async exportXlsx(
    @Param('year') year: string,
    @Param('month') month: string,
    @Res() res: Response,
  ) {
    return this.service.exportXlsx(parseInt(year), parseInt(month), res);
  }
}
