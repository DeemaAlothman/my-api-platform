import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReceptionsService } from './receptions.service';
import { JwtAuthGuard } from '@shared/auth';
import { PermissionsGuard, Permission, PERMISSIONS } from '@shared';

// مبيعات فيتافوت — بدون أي بيانات طبية، لفريق المبيعات (نفس صلاحية مصادر الإحالة)
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('podiatry/sales')
export class SalesController {
  constructor(private readonly service: ReceptionsService) {}

  @Get()
  @Permission(PERMISSIONS.CLINIC_REFERRALS.VIEW)
  getSales(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.service.getSales(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      search,
    );
  }
}
