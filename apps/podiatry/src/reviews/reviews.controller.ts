import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { UpsertReviewDto } from './dto/review.dto';
import { JwtAuthGuard, User } from '@shared/auth';
import { PermissionsGuard, Permission, PERMISSIONS } from '@shared';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('podiatry/receptions/:receptionId/reviews')
export class ReviewsController {
  constructor(private readonly service: ReviewsService) {}

  @Permission(PERMISSIONS.CLINIC_PODIATRY.SESSION_CREATE)
  @Post()
  create(
    @Param('receptionId') receptionId: string,
    @Body() dto: UpsertReviewDto,
    @User() user: any,
  ) {
    return this.service.create(receptionId, dto, user.userId);
  }

  @Permission(PERMISSIONS.CLINIC_PODIATRY.RECEPTION_VIEW)
  @Get()
  findAll(@Param('receptionId') receptionId: string) {
    return this.service.findAll(receptionId);
  }

  @Permission(PERMISSIONS.CLINIC_PODIATRY.SESSION_CREATE)
  @Patch(':reviewId')
  update(
    @Param('receptionId') receptionId: string,
    @Param('reviewId') reviewId: string,
    @Body() dto: UpsertReviewDto,
    @User() user: any,
  ) {
    return this.service.update(receptionId, reviewId, dto, user.userId);
  }

  @Permission(PERMISSIONS.CLINIC_PODIATRY.RECEPTION_EDIT)
  @Delete(':reviewId')
  remove(
    @Param('receptionId') receptionId: string,
    @Param('reviewId') reviewId: string,
  ) {
    return this.service.remove(receptionId, reviewId);
  }
}
