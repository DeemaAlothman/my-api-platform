import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { LeaveRequestsService } from './leave-requests.service';
import { InternalAuthGuard } from '@shared';

@Controller('leave-requests')
@UseGuards(InternalAuthGuard)
export class LeaveRequestsInternalController {
  constructor(private readonly leaveRequestsService: LeaveRequestsService) {}

  @Get('internal/check-overlap')
  checkOverlap(
    @Query('userId') userId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.leaveRequestsService.checkOverlap(userId, new Date(from), new Date(to));
  }
}
