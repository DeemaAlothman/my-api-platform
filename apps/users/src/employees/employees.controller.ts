import { Controller, Get, Post, Put, Patch, Delete, Query, Param, Body, UseGuards, HttpCode, HttpStatus, Headers, UnauthorizedException, Res } from '@nestjs/common';
import type { Response } from 'express';
import { EmployeesService } from './employees.service';
import { JwtAuthGuard } from '@shared/auth';
import { PermissionsGuard } from '@shared';
import { Permission } from '@shared';
import { User } from '@shared/auth';
import type { CurrentUser } from '@shared/auth';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { ListEmployeesQueryDto } from './dto/list-employees.query.dto';
import { LinkUserDto } from './dto/link-user.dto';
import { IsString } from 'class-validator';
import { sendExcelMultiSheet } from '../common/utils/excel.util';

class UpdateManagerNotesDto {
  @IsString()
  notes: string;
}

@Controller('employees')
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('employees:read')
  @Get()
  list(@Query() query: ListEmployeesQueryDto, @User() user: CurrentUser) {
    return this.employees.list(query, user.permissions.includes('employees:manager-notes:read'));
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('employees:read')
  @Get('department/:departmentId')
  getByDepartment(@Param('departmentId') departmentId: string) {
    return this.employees.getByDepartment(departmentId);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('employees:read')
  @Get('manager/:managerId/subordinates')
  getSubordinates(@Param('managerId') managerId: string) {
    return this.employees.getSubordinates(managerId);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('employees:read')
  @Get(':id/reporting-chain')
  getReportingChain(@Param('id') id: string) {
    return this.employees.getReportingChain(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('my')
  getMyEmployee(@User() user: CurrentUser) {
    return this.employees.findByUsername(user.username);
  }

  // B.4: HR Reports
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('employees:probation-report:read')
  @Get('reports/probation-ending')
  getProbationEndingReport(@Query('days') days: string) {
    return this.employees.getProbationEndingReport(parseInt(days ?? '30', 10));
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('employees:contract-report:read')
  @Get('reports/contract-ending')
  getContractEndingReport(@Query('days') days: string) {
    return this.employees.getContractEndingReport(parseInt(days ?? '30', 10));
  }

  @UseGuards(JwtAuthGuard)
  @Get('basic')
  findAllBasic() {
    return this.employees.findAllBasic();
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/basic')
  findBasic(@Param('id') id: string) {
    return this.employees.findBasic(id);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('employees:read')
  @Get(':id')
  findOne(@Param('id') id: string, @User() user: CurrentUser) {
    return this.employees.findOne(id, user.permissions.includes('employees:manager-notes:read'));
  }

  // B.1: Manager Notes endpoints
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('employees:manager-notes:read')
  @Get(':id/manager-notes')
  getManagerNotes(@Param('id') id: string) {
    return this.employees.getManagerNotes(id);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('employees:manager-notes:write')
  @Put(':id/manager-notes')
  updateManagerNotes(
    @Param('id') id: string,
    @Body() dto: UpdateManagerNotesDto,
    @User() user: CurrentUser,
  ) {
    return this.employees.updateManagerNotes(id, dto.notes, user.userId);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('employees:create')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateEmployeeDto) {
    return this.employees.create(dto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('employees:update')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateEmployeeDto) {
    return this.employees.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('employees:delete')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.employees.remove(id);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('employees:update')
  @Post(':id/link-user')
  linkUser(@Param('id') id: string, @Body() dto: LinkUserDto) {
    return this.employees.linkUser(id, dto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permission('employees:export')
  @Get(':id/export-full')
  async exportFull(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const data = await this.employees.buildExportFullData(id);
    const e = data.employee as any;

    const today = new Date().toISOString().split('T')[0];
    const filename = `employee-${e.employeeNumber ?? id}-${today}`;

    const sheets = [
      {
        name: 'معلومات أساسية',
        headers: ['الحقل', 'القيمة'],
        rows: [
          ['الاسم الكامل', `${e.firstNameAr ?? ''} ${e.lastNameAr ?? ''}`],
          ['الرقم الوظيفي', e.employeeNumber ?? ''],
          ['تاريخ التعيين', e.hireDate ? new Date(e.hireDate).toLocaleDateString('ar-SY') : ''],
          ['القسم', e.department?.nameAr ?? ''],
          ['المنصب', e.jobTitle?.nameAr ?? ''],
          ['المدير المباشر', e.directManager ? `${e.directManager.firstNameAr} ${e.directManager.lastNameAr}` : ''],
          ['الراتب الأساسي', e.basicSalary ?? ''],
          ['الجنسية', e.nationality ?? ''],
          ['تاريخ الميلاد', e.dateOfBirth ? new Date(e.dateOfBirth).toLocaleDateString('ar-SY') : ''],
          ['البريد الإلكتروني', e.email ?? ''],
          ['الهاتف', e.phone ?? ''],
          ['نوع التوظيف', e.employmentType ?? ''],
          ['حالة التوظيف', e.employmentStatus ?? ''],
        ],
      },
      {
        name: 'الحضور الشهري',
        headers: ['السنة', 'الشهر', 'أيام العمل', 'أيام الحضور', 'أيام الغياب', 'أيام التأخير', 'دقائق التأخير الكلية', 'دقائق الأوفرتايم'],
        rows: Array.isArray(data.attendanceSummary)
          ? data.attendanceSummary.map((r: any) => [r.year, r.month, r.workingDays, r.presentDays, r.absentDays, r.lateDays, r.totalLateMinutes, r.overtimeMinutes])
          : [],
      },
      {
        name: 'الإجازات',
        headers: ['تاريخ البداية', 'تاريخ النهاية', 'نوع الإجازة', 'الأيام', 'الحالة'],
        rows: Array.isArray(data.leaveRequests)
          ? data.leaveRequests.map((r: any) => [r.startDate, r.endDate, r.leaveType?.nameAr ?? r.leaveTypeId, r.totalDays, r.status])
          : [],
      },
      {
        name: 'أرصدة الإجازات',
        headers: ['نوع الإجازة', 'الرصيد الكلي', 'المستخدم', 'المتبقي'],
        rows: Array.isArray(data.leaveBalances)
          ? data.leaveBalances.map((b: any) => [b.leaveType?.nameAr ?? b.leaveTypeId, b.totalDays, b.usedDays, b.remainingDays])
          : [],
      },
      {
        name: 'تقييم التجربة',
        headers: ['تاريخ الإنشاء', 'الحالة', 'التوصية', 'النسبة النهائية %', 'نسبة المدير %', 'نسبة الذاتي %'],
        rows: Array.isArray(data.evaluations)
          ? data.evaluations.map((ev: any) => [
              ev.createdAt ? new Date(ev.createdAt).toLocaleDateString('ar-SY') : '',
              ev.status, ev.finalRecommendation ?? '',
              ev.finalScorePercent ?? '', ev.managerScorePercent ?? '', ev.selfScorePercent ?? '',
            ])
          : [],
      },
      {
        name: 'الراتب الشهري',
        headers: ['السنة', 'الشهر', 'الراتب الإجمالي', 'صافي الراتب', 'الحسميات الكلية', 'الحالة'],
        rows: Array.isArray(data.payrolls)
          ? data.payrolls.map((p: any) => [p.year, p.month, p.grossSalary ?? '', p.netSalary ?? '', p.totalDeductionMinutes ?? '', p.status])
          : [],
      },
      {
        name: 'التنبيهات والمخالفات',
        headers: ['التاريخ', 'نوع التنبيه', 'الخطورة', 'الرسالة', 'الحالة'],
        rows: Array.isArray(data.alerts)
          ? data.alerts.map((a: any) => [
              a.date ? new Date(a.date).toLocaleDateString('ar-SY') : '',
              a.alertType, a.severity ?? '', a.messageAr ?? a.message ?? '', a.status,
            ])
          : [],
      },
    ];

    await sendExcelMultiSheet(res, filename, sheets);
  }

  // Internal endpoint — called by evaluation-service (no JWT required, service-to-service)
  @Post('internal/probation-result')
  updateProbationResult(@Body() dto: { employeeId: string; result: string; completedAt: string }) {
    return this.employees.updateProbationResult(dto);
  }

  // Internal endpoint — called by jobs-service (no JWT required, service-to-service)
  @Post('internal/interview-result')
  updateInterviewResult(@Body() dto: { jobApplicationId: string; totalScore: number; decision: string; proposedSalary?: number }) {
    return this.employees.updateInterviewResult(dto);
  }

  @Post('internal/basic-by-ids')
  findBasicByIds(
    @Headers('x-internal-token') token: string,
    @Body() dto: { ids: string[] },
  ) {
    const expected = process.env.INTERNAL_SERVICE_TOKEN;
    if (expected && token !== expected) {
      throw new UnauthorizedException('Invalid internal token');
    }
    return this.employees.findBasicByIds(dto.ids ?? []);
  }

  @Post('internal/subordinate-ids')
  getSubordinateIds(
    @Headers('x-internal-token') token: string,
    @Body() dto: { managerId: string },
  ) {
    const expected = process.env.INTERNAL_SERVICE_TOKEN;
    if (expected && token !== expected) {
      throw new UnauthorizedException('Invalid internal token');
    }
    return this.employees.getSubordinateIds(dto.managerId);
  }

  // Internal endpoint — called by mail-service to expand userIds and departmentIds
  @Post('internal/resolve-recipients')
  resolveRecipients(
    @Headers('x-internal-token') token: string,
    @Body() dto: { userIds?: string[]; departmentIds?: string[]; excludeInactive?: boolean },
  ) {
    if (!token || token !== process.env.INTERNAL_SERVICE_TOKEN) {
      throw new UnauthorizedException('Invalid internal token');
    }
    return this.employees.resolveRecipients(
      dto.userIds ?? [],
      dto.departmentIds ?? [],
      dto.excludeInactive !== false,
    );
  }
}
