import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { LeaveBalancesService } from './leave-balances.service';
import { InternalServiceGuard } from '../common/guards/internal-service.guard';

@Controller('internal/leave-balances')
@UseGuards(InternalServiceGuard)
export class InternalLeaveBalancesController {
  constructor(private readonly service: LeaveBalancesService) {}

  @Post('initialize')
  initialize(@Body() body: { employeeId: string; year?: number }) {
    return this.service.initializeForEmployee(body.employeeId, body.year);
  }
}
