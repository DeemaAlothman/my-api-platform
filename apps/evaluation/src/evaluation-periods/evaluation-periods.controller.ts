import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { EvaluationPeriodsService } from './evaluation-periods.service';
import { CreatePeriodDto } from './dto/create-period.dto';
import { UpdatePeriodDto } from './dto/update-period.dto';
import { JwtAuthGuard } from '@shared/auth';
import { PermissionsGuard, Permission } from '@shared';

@Controller('evaluation-periods')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EvaluationPeriodsController {
  constructor(private readonly periodsService: EvaluationPeriodsService) {}

  @Get()
  findAll(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.periodsService.findAll({ status, page, limit });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.periodsService.findOne(id);
  }

  @Post()
  @Permission('evaluation:periods:create')
  create(@Body() createPeriodDto: CreatePeriodDto) {
    return this.periodsService.create(createPeriodDto);
  }

  @Patch(':id')
  @Permission('evaluation:periods:update')
  update(@Param('id') id: string, @Body() updatePeriodDto: UpdatePeriodDto) {
    return this.periodsService.update(id, updatePeriodDto);
  }

  @Delete(':id')
  @Permission('evaluation:periods:delete')
  delete(@Param('id') id: string) {
    return this.periodsService.delete(id);
  }

  @Post(':id/open')
  @Permission('evaluation:periods:manage')
  openPeriod(@Param('id') id: string) {
    return this.periodsService.openPeriod(id);
  }

  @Post(':id/close')
  @Permission('evaluation:periods:manage')
  closePeriod(@Param('id') id: string) {
    return this.periodsService.closePeriod(id);
  }

  @Post(':id/generate-forms')
  @Permission('evaluation:periods:manage')
  generateForms(
    @Param('id') id: string,
    @Body() body: { employeeIds?: string[] },
  ) {
    return this.periodsService.generateForms(id, body?.employeeIds);
  }
}
