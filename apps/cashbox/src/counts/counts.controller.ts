import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { CountsService } from './counts.service';
import { CreateCashCountDto, ListCashCountsQueryDto } from './dto/count.dto';
import { JwtAuthGuard } from '@shared/auth';
import { PermissionsGuard } from '@shared';
import { Permission } from '@shared';
import { User } from '@shared/auth/decorators/current-user.decorator';
import { PERMISSIONS } from '@shared/constants/permissions.constants';

@Controller('cashbox/counts')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CountsController {
  constructor(private readonly service: CountsService) {}

  @Get()
  @Permission(PERMISSIONS.CASHBOX.COUNTS_READ)
  list(@Query() query: ListCashCountsQueryDto) {
    return this.service.list(query);
  }

  @Post()
  @Permission(PERMISSIONS.CASHBOX.COUNTS_CREATE)
  create(@Body() dto: CreateCashCountDto, @User() user: any) {
    return this.service.create(dto, user.userId);
  }
}
