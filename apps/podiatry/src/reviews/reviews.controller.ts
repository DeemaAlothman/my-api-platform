import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { UpsertReviewDto } from './dto/review.dto';
import { JwtAuthGuard, User } from '@shared/auth';
import { PermissionsGuard, Permission, PERMISSIONS } from '@shared';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('podiatry/receptions/:receptionId/review')
export class ReviewsController {
  constructor(private readonly service: ReviewsService) {}

  @Permission(PERMISSIONS.CLINIC_PODIATRY.SESSION_CREATE)
  @Post()
  upsert(
    @Param('receptionId') receptionId: string,
    @Body() dto: UpsertReviewDto,
    @User() user: any,
  ) {
    return this.service.upsert(receptionId, dto, user.userId);
  }

  @Permission(PERMISSIONS.CLINIC_PODIATRY.RECEPTION_VIEW)
  @Get()
  findOne(@Param('receptionId') receptionId: string) {
    return this.service.findOne(receptionId);
  }
}
