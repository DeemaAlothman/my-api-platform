import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '@shared/auth';
import { PermissionsGuard } from '@shared/guards/permissions.guard';
import { Permission } from '@shared/decorators/permission.decorator';
import { PERMISSIONS } from '@shared/constants/permissions.constants';
import { User } from '@shared/auth/decorators/current-user.decorator';
import { RatingsService } from './ratings.service';
import { ListRatingsQueryDto } from './dto/rating.dto';

// حصراً لرئيس قسم العلاج الفيزيائي (clinic_physio_dept_head) وsuper_admin — VIEW_THERAPIST_RATINGS
@Controller('patient-app/admin')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RatingsAdminController {
  constructor(private readonly service: RatingsService) {}

  @Get('ratings')
  @Permission(PERMISSIONS.CLINIC_PATIENT_APP.RATINGS_VIEW)
  list(@Query() query: ListRatingsQueryDto, @User() user: any, @Req() req: Request) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || null;
    return this.service.list(query, user.userId, user.username, ip);
  }
}
