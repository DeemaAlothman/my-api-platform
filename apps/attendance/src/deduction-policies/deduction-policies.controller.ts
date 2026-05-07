import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { DeductionPoliciesService } from './deduction-policies.service';
import { CreateDeductionPolicyDto } from './dto/create-deduction-policy.dto';
import { UpdateDeductionPolicyDto } from './dto/update-deduction-policy.dto';
import { JwtAuthGuard } from '@shared/auth';
import { PermissionsGuard } from '@shared';
import { Permission } from '@shared';

@Controller('deduction-policies')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DeductionPoliciesController {
  constructor(private readonly service: DeductionPoliciesService) {}

  @Post()
  @Permission('attendance.policies.create')
  create(@Body() dto: CreateDeductionPolicyDto) {
    return this.service.create(dto);
  }

  @Get()
  @Permission('attendance.policies.read')
  findAll(@Query('all') all?: string) {
    return this.service.findAll(all !== 'true');
  }

  @Get(':id')
  @Permission('attendance.policies.read')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Permission('attendance.policies.update')
  update(@Param('id') id: string, @Body() dto: UpdateDeductionPolicyDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Permission('attendance.policies.delete')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
