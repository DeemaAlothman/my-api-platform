import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, Req, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { CandidatesService } from './candidates.service';
import { CreateCandidateDto } from './dto/create-candidate.dto';
import { MoveStageDto } from './dto/move-stage.dto';
import { CreateOfferDto } from './dto/create-offer.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permission } from '../common/decorators/permission.decorator';

@ApiTags('Candidates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('candidates')
export class CandidatesController {
  constructor(private readonly service: CandidatesService) {}

  @Post()
  @Permission('job-applications:update')
  @ApiOperation({ summary: 'إضافة متقدم جديد' })
  create(@Body() dto: CreateCandidateDto, @Req() req: any) {
    return this.service.create(dto, req.user?.sub);
  }

  @Get()
  @Permission('job-applications:read')
  @ApiOperation({ summary: 'قائمة المتقدمين' })
  @ApiQuery({ name: 'stage', required: false })
  @ApiQuery({ name: 'positionId', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findAll(
    @Query('stage') stage?: string,
    @Query('positionId') positionId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll({
      stage,
      positionId,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  @Get(':id')
  @Permission('job-applications:read')
  @ApiOperation({ summary: 'تفاصيل متقدم' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id/stage')
  @Permission('job-applications:update')
  @ApiOperation({ summary: 'تغيير مرحلة المتقدم في الـ pipeline' })
  moveStage(@Param('id') id: string, @Body() dto: MoveStageDto, @Req() req: any) {
    return this.service.moveStage(id, dto, req.user?.sub);
  }

  @Delete(':id')
  @Permission('job-applications:update')
  @ApiOperation({ summary: 'حذف متقدم (soft delete)' })
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }

  // ==================== Offers ====================

  @Post(':id/offers')
  @Permission('job-applications:update')
  @ApiOperation({ summary: 'إنشاء عرض عمل للمتقدم' })
  createOffer(@Param('id') id: string, @Body() dto: CreateOfferDto, @Req() req: any) {
    return this.service.createOffer(id, dto, req.user?.sub);
  }

  @Patch('offers/:offerId/status')
  @Permission('job-applications:update')
  @ApiOperation({ summary: 'تحديث حالة عرض العمل (SENT/ACCEPTED/REJECTED/EXPIRED)' })
  updateOfferStatus(@Param('offerId') offerId: string, @Body('status') status: string) {
    return this.service.updateOfferStatus(offerId, status);
  }

  // ==================== تحويل لموظف ====================

  @Post(':id/convert-to-employee')
  @Permission('job-applications:update')
  @ApiOperation({ summary: 'تحويل المتقدم المقبول إلى موظف' })
  convertToEmployee(
    @Param('id') id: string,
    @Body() body: { departmentId: string; jobTitleId?: string; hireDate?: string; contractType?: string; basicSalary?: number },
    @Req() req: any,
  ) {
    return this.service.convertToEmployee(id, body, req.user?.sub);
  }
}
