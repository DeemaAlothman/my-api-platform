import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { SalaryAdvancesService } from './salary-advances.service';
import { CreateSalaryAdvanceDto } from './dto/create-salary-advance.dto';
import { UpdateSalaryAdvanceDto } from './dto/update-salary-advance.dto';
import { JwtAuthGuard } from '@shared/auth';
import { PermissionsGuard, Permission } from '@shared';

@Controller('salary-advances')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SalaryAdvancesController {
  constructor(private readonly service: SalaryAdvancesService) {}

  @Post()
  @Permission('payroll.advances.create')
  create(@Body() dto: CreateSalaryAdvanceDto, @Req() req: any) {
    return this.service.create(dto, req.user.sub);
  }

  @Get()
  @Permission('payroll.advances.read')
  findAll(
    @Query('employeeId') employeeId?: string,
    @Query('status') status?: string,
    @Query('year') year?: string,
  ) {
    return this.service.findAll({
      employeeId,
      status,
      year: year ? parseInt(year) : undefined,
    });
  }

  @Get(':id')
  @Permission('payroll.advances.read')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Permission('payroll.advances.update')
  update(@Param('id') id: string, @Body() dto: UpdateSalaryAdvanceDto) {
    return this.service.update(id, dto);
  }

  @Post(':id/cancel')
  @Permission('payroll.advances.cancel')
  cancel(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Req() req: any,
  ) {
    return this.service.cancel(id, reason, req.user.sub);
  }

  @Delete(':id')
  @Permission('payroll.advances.delete')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
