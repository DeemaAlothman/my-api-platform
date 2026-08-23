import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { JwtAuthGuard, User } from '@shared/auth';
import { PermissionsGuard, Permission, PERMISSIONS } from '@shared';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('podiatry/receptions/:receptionId/sessions')
export class SessionsController {
  constructor(private readonly service: SessionsService) {}

  @Permission(PERMISSIONS.CLINIC_PODIATRY.SESSION_CREATE)
  @Post()
  create(@Param('receptionId') receptionId: string, @Body() dto: CreateSessionDto, @User() user: any) {
    return this.service.create(receptionId, dto, user.userId);
  }

  @Permission(PERMISSIONS.CLINIC_PODIATRY.RECEPTION_VIEW)
  @Get()
  findAll(@Param('receptionId') receptionId: string, @Query('includeArchived') includeArchived?: string) {
    return this.service.findAll(receptionId, includeArchived === 'true');
  }

  @Permission(PERMISSIONS.CLINIC_PODIATRY.RECEPTION_VIEW)
  @Get(':sessionId')
  findOne(@Param('receptionId') receptionId: string, @Param('sessionId') sessionId: string) {
    return this.service.findOne(receptionId, sessionId);
  }

  @Permission(PERMISSIONS.CLINIC_PODIATRY.SESSION_EDIT)
  @Patch(':sessionId')
  update(
    @Param('receptionId') receptionId: string,
    @Param('sessionId') sessionId: string,
    @Body() dto: UpdateSessionDto,
  ) {
    return this.service.update(receptionId, sessionId, dto);
  }

  @Permission(PERMISSIONS.CLINIC_PODIATRY.SESSION_CREATE)
  @Post(':sessionId/install')
  install(@Param('receptionId') receptionId: string, @Param('sessionId') sessionId: string, @User() user: any) {
    return this.service.install(receptionId, sessionId, user.userId);
  }

  @Permission(PERMISSIONS.CLINIC_PODIATRY.SESSION_ARCHIVE)
  @Post(':sessionId/archive')
  archive(@Param('receptionId') receptionId: string, @Param('sessionId') sessionId: string, @User() user: any) {
    return this.service.archive(receptionId, sessionId, user.userId);
  }

  @Permission(PERMISSIONS.CLINIC_PODIATRY.RECEPTION_EDIT)
  @Delete(':sessionId')
  remove(@Param('receptionId') receptionId: string, @Param('sessionId') sessionId: string) {
    return this.service.remove(receptionId, sessionId);
  }
}
