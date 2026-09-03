import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { WaitingListService } from './waiting-list.service';
import {
  CreateWaitingListEntryDto, UpdateWaitingListEntryDto, ListWaitingListQueryDto,
} from './dto/waiting-list.dto';
import { JwtAuthGuard } from '@shared/auth';
import { PermissionsGuard } from '@shared/guards/permissions.guard';
import { Permission } from '@shared/decorators/permission.decorator';
import { PERMISSIONS } from '@shared/constants/permissions.constants';
import { User } from '@shared/auth/decorators/current-user.decorator';

@Controller('appointments/waiting-list')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WaitingListController {
  constructor(private readonly service: WaitingListService) {}

  @Post()
  @Permission(PERMISSIONS.CLINIC_WAITING_LIST.CREATE)
  create(@Body() dto: CreateWaitingListEntryDto, @User() user: any) {
    return this.service.create(dto, user.userId);
  }

  @Get()
  @Permission(PERMISSIONS.CLINIC_WAITING_LIST.VIEW)
  findAll(@Query() query: ListWaitingListQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @Permission(PERMISSIONS.CLINIC_WAITING_LIST.VIEW)
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Put(':id')
  @Permission(PERMISSIONS.CLINIC_WAITING_LIST.EDIT)
  update(@Param('id') id: string, @Body() dto: UpdateWaitingListEntryDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Permission(PERMISSIONS.CLINIC_WAITING_LIST.DELETE)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
