import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { HolidaysService, CreateHolidayDto, UpdateHolidayDto } from './holidays.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permission } from '../common/decorators/permission.decorator';

@Controller('holidays')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class HolidaysController {
  constructor(private readonly holidaysService: HolidaysService) {}

  // إنشاء عطلة جديدة (HR فقط)
  @Post()
  @Permission('holidays:create')
  create(@Body() createDto: CreateHolidayDto) {
    return this.holidaysService.create(createDto);
  }

  // تحديث عطلة (HR فقط)
  @Put(':id')
  @Permission('holidays:update')
  update(@Param('id') id: string, @Body() updateDto: UpdateHolidayDto) {
    return this.holidaysService.update(id, updateDto);
  }

  // الحصول على جميع العطل
  @Get()
  @Permission('holidays:read')
  findAll(@Query('year') year?: string, @Query('type') type?: string) {
    const yearNum = year ? parseInt(year, 10) : undefined;
    return this.holidaysService.findAll(yearNum, type);
  }

  // الحصول على عطلة واحدة
  @Get(':id')
  @Permission('holidays:read')
  findOne(@Param('id') id: string) {
    return this.holidaysService.findOne(id);
  }

  // الحصول على العطل في نطاق زمني
  @Get('range/:startDate/:endDate')
  @Permission('holidays:read')
  findInRange(@Param('startDate') startDate: string, @Param('endDate') endDate: string) {
    return this.holidaysService.findInRange(startDate, endDate);
  }

  // الحصول على العطل القادمة
  @Get('upcoming/list')
  @Permission('holidays:read')
  findUpcoming(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.holidaysService.findUpcoming(limitNum);
  }

  // حذف عطلة (HR فقط)
  @Delete(':id')
  @Permission('holidays:delete')
  remove(@Param('id') id: string) {
    return this.holidaysService.remove(id);
  }

  // استنساخ عطل من سنة إلى أخرى (HR فقط)
  @Post('clone-year')
  @Permission('holidays:create')
  cloneYear(@Body() body: { fromYear: number; toYear: number }) {
    return this.holidaysService.cloneYear(body.fromYear, body.toYear);
  }
}
