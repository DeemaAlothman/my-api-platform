import { Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { ReceptionsService } from './receptions.service';
import { UpdateInsoleCostDto } from './dto/update-insole-cost.dto';
import { JwtAuthGuard, User } from '@shared/auth';
import { PermissionsGuard, Permission, PERMISSIONS } from '@shared';

// مبيعات فيتافوت — بدون أي بيانات طبية، لفريق المبيعات (نفس صلاحية مصادر الإحالة)
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('podiatry/sales')
export class SalesController {
  constructor(private readonly service: ReceptionsService) {}

  @Get()
  @Permission(PERMISSIONS.CLINIC_REFERRALS.VIEW)
  getSales(
    @User() user: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    // التكلفة لها صلاحية عرض منفصلة؛ ومن يملك صلاحية التعديل يراها بالضرورة.
    // من لا يملك أياً منهما يحصل على insoleCost و totalCost بقيمة null.
    const perms: string[] = user?.permissions ?? [];
    const canViewCost =
      perms.includes(PERMISSIONS.CLINIC_PODIATRY.SALES_VIEW_COST) ||
      perms.includes(PERMISSIONS.CLINIC_PODIATRY.SALES_UPDATE_COST);

    return this.service.getSales(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      search,
      canViewCost,
    );
  }

  @Patch(':sessionId/cost')
  @Permission(PERMISSIONS.CLINIC_PODIATRY.SALES_UPDATE_COST)
  updateCost(
    @Param('sessionId') sessionId: string,
    @Body() dto: UpdateInsoleCostDto,
    @User() user: any,
    @Req() req: any,
  ) {
    return this.service.updateInsoleCost(sessionId, dto.insoleCost ?? null, user, req);
  }
}
