import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { SalesCommissionsService } from './sales-commissions.service';
import { CreateSalesCommissionDto } from './dto/create-sales-commission.dto';
import { UpdateSalesCommissionDto } from './dto/update-sales-commission.dto';
import { JwtAuthGuard } from '@shared/auth';
import { PermissionsGuard, Permission } from '@shared';

@Controller('sales-commissions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SalesCommissionsController {
  constructor(private readonly service: SalesCommissionsService) {}

  @Post()
  @Permission('payroll.commissions.create')
  create(@Body() dto: CreateSalesCommissionDto, @Req() req: any) {
    return this.service.create(dto, req.user.userId);
  }

  @Get()
  @Permission('payroll.commissions.read')
  findAll(
    @Query('employeeId') employeeId?: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Query('status') status?: string,
  ) {
    return this.service.findAll({
      employeeId,
      status,
      year:  year  ? parseInt(year)  : undefined,
      month: month ? parseInt(month) : undefined,
    });
  }

  @Get(':id')
  @Permission('payroll.commissions.read')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Permission('payroll.commissions.update')
  update(@Param('id') id: string, @Body() dto: UpdateSalesCommissionDto) {
    return this.service.update(id, dto);
  }

  @Post(':id/confirm')
  @Permission('payroll.commissions.confirm')
  confirm(@Param('id') id: string, @Req() req: any) {
    return this.service.confirm(id, req.user.userId);
  }

  @Delete(':id')
  @Permission('payroll.commissions.delete')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
