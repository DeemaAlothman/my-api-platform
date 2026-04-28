import { Controller, Get, Post, Put, Patch, Delete, Query, Param, Body, UseGuards, HttpCode, HttpStatus, Headers, UnauthorizedException } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permission } from '../common/decorators/permission.decorator';
import { User } from '../common/decorators/current-user.decorator';
import type { CurrentUser } from '../common/interfaces/user.interface';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { ListEmployeesQueryDto } from './dto/list-employees.query.dto';
import { LinkUserDto } from './dto/link-user.dto';
import { IsString } from 'class-validator';

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
