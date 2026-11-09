import { Controller, Get, Post, Body, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { CyclesService } from './cycles.service';
import { AddHrNomineeDto } from './dto/cycle.dto';
import { JwtAuthGuard } from '@shared/auth';
import { PermissionsGuard } from '@shared';
import { Permission } from '@shared';
import { PERMISSIONS } from '@shared/constants/permissions.constants';

@Controller('star-of-month')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CyclesController {
  constructor(private readonly service: CyclesService) {}

  @Get(':year/:month')
  @Permission(PERMISSIONS.STAR_OF_MONTH.VIEW)
  getCycle(@Param('year', ParseIntPipe) year: number, @Param('month', ParseIntPipe) month: number) {
    return this.service.getCycle(year, month);
  }

  // توليد/إعادة توليد القائمة التلقائية — عادةً من cron يوم 1، ومتاح يدوياً هون كمان
  @Post(':year/:month/generate')
  @Permission(PERMISSIONS.STAR_OF_MONTH.NOMINATE)
  generate(@Param('year', ParseIntPipe) year: number, @Param('month', ParseIntPipe) month: number) {
    return this.service.generateCycle(year, month);
  }

  @Post(':year/:month/hr-nominee')
  @Permission(PERMISSIONS.STAR_OF_MONTH.NOMINATE)
  addHrNominee(
    @Param('year', ParseIntPipe) year: number,
    @Param('month', ParseIntPipe) month: number,
    @Body() dto: AddHrNomineeDto,
  ) {
    return this.service.addHrNominee(year, month, dto);
  }
}
