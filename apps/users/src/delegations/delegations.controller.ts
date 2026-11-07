import { Body, Controller, Get, Param, Post, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { DelegationsService } from './delegations.service';
import { JwtAuthGuard, User } from '@shared/auth';
import { PermissionsGuard, Permission, PERMISSIONS } from '@shared';

const VALID_STATUSES = ['ACTIVE', 'UPCOMING', 'ENDED'] as const;

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('delegations')
export class DelegationsController {
  constructor(private readonly service: DelegationsService) {}

  @Get()
  @Permission(PERMISSIONS.DELEGATIONS.MANAGE)
  list(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (status && !VALID_STATUSES.includes(status as any)) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'status يجب أن يكون ACTIVE أو UPCOMING أو ENDED' });
    }
    return this.service.list(
      status as 'ACTIVE' | 'UPCOMING' | 'ENDED' | undefined,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Post(':id/revoke')
  @Permission(PERMISSIONS.DELEGATIONS.MANAGE)
  revoke(@Param('id') id: string, @Body('reason') reason: string | undefined, @User() user: any) {
    return this.service.revoke(id, user.userId, reason);
  }
}
