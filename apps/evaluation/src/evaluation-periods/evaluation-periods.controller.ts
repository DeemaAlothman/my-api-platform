import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { EvaluationPeriodsService } from './evaluation-periods.service';
import { CreatePeriodDto } from './dto/create-period.dto';
import { UpdatePeriodDto } from './dto/update-period.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permissions } from '../common/decorators/permissions.decorator';

@Controller('evaluation-periods')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EvaluationPeriodsController {
  constructor(private readonly periodsService: EvaluationPeriodsService) {}

  @Get()
  findAll() {
    return this.periodsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.periodsService.findOne(id);
  }

  @Post()
  @Permissions('evaluation:periods:create')
  create(@Body() createPeriodDto: CreatePeriodDto) {
    return this.periodsService.create(createPeriodDto);
  }

  @Patch(':id')
  @Permissions('evaluation:periods:update')
  update(@Param('id') id: string, @Body() updatePeriodDto: UpdatePeriodDto) {
    return this.periodsService.update(id, updatePeriodDto);
  }

  @Delete(':id')
  @Permissions('evaluation:periods:delete')
  delete(@Param('id') id: string) {
    return this.periodsService.delete(id);
  }

  @Post(':id/open')
  @Permissions('evaluation:periods:manage')
  openPeriod(@Param('id') id: string) {
    return this.periodsService.openPeriod(id);
  }

  @Post(':id/close')
  @Permissions('evaluation:periods:manage')
  closePeriod(@Param('id') id: string) {
    return this.periodsService.closePeriod(id);
  }
}
