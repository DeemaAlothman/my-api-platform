import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, UserId, User } from '@shared/auth';
import { PermissionsGuard, Permission } from '@shared';
import { SourcesService } from './sources.service';
import {
  CreateSourceDto, UpdateSourceDto,
  CreateVisitDto, UpdateVisitDto,
  CreateSpecialtyDto,
  ListSourcesQueryDto,
  LinkUnlinkedDto,
} from './dto/source.dto';

@ApiTags('referrals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('referrals/sources')
export class SourcesController {
  constructor(private readonly service: SourcesService) {}

  // ── Specialties ───────────────────────────────────────────────────

  @Get('specialties')
  @Permission('clinic.referrals.view')
  getSpecialties() {
    return this.service.getSpecialties();
  }

  @Post('specialties')
  @Permission('clinic.referrals.manage')
  addSpecialty(@Body() dto: CreateSpecialtyDto) {
    return this.service.addSpecialty(dto);
  }

  // ── Sources ───────────────────────────────────────────────────────

  @Post()
  @Permission('clinic.referrals.manage')
  create(@Body() dto: CreateSourceDto, @UserId() userId: string) {
    return this.service.create(dto, userId);
  }

  @Get()
  @Permission('clinic.referrals.view')
  findAll(@Query() query: ListSourcesQueryDto) {
    return this.service.findAll(query);
  }

  @Get('stats')
  @Permission('clinic.referrals.stats.view')
  getStats() {
    return this.service.getStats();
  }

  // الأسماء الحرة التي أُدخلت دون ربطها بجهة اتصال. يجب أن يبقى هذا المسار قبل
  // مسارات :id وإلا التُقط 'unlinked-names' على أنه معرّف.
  @Get('unlinked-names')
  @Permission('clinic.referrals.view')
  getUnlinkedNames(@Query('type') type?: string) {
    return this.service.getUnlinkedNames(type);
  }

  // قبل @Get(':id') وإلا التُقط 'link-preview' جزءاً من المعرّف
  @Get(':id/link-preview')
  @Permission('clinic.referrals.manage')
  linkPreview(@Param('id') id: string, @Query('name') name: string) {
    return this.service.linkPreview(id, name);
  }

  @Post(':id/link-unlinked')
  @Permission('clinic.referrals.manage')
  linkUnlinked(
    @Param('id') id: string,
    @Body() dto: LinkUnlinkedDto,
    @User() user: any,
  ) {
    return this.service.linkUnlinked(id, dto, user);
  }

  @Get(':id/patient-count')
  @Permission('clinic.referrals.stats.view')
  getPatientCount(@Param('id') id: string) {
    return this.service.getPatientCount(id);
  }

  @Get(':id/patients')
  @Permission('clinic.referrals.view')
  getPatients(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('realOnly') realOnly?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.service.getPatients(
      id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      realOnly === 'true',
      dateFrom,
      dateTo,
    );
  }

  @Get(':id')
  @Permission('clinic.referrals.view')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Permission('clinic.referrals.manage')
  update(@Param('id') id: string, @Body() dto: UpdateSourceDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Permission('clinic.referrals.manage')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  // ── Visits ────────────────────────────────────────────────────────

  @Post(':id/visits')
  @Permission('clinic.referrals.visits.add')
  addVisit(
    @Param('id') sourceId: string,
    @Body() dto: CreateVisitDto,
    @UserId() userId: string,
  ) {
    return this.service.addVisit(sourceId, dto, userId);
  }

  @Get(':id/visits')
  @Permission('clinic.referrals.view')
  getVisits(@Param('id') sourceId: string) {
    return this.service.getVisits(sourceId);
  }

  @Patch(':id/visits/:visitId')
  @Permission('clinic.referrals.visits.add')
  updateVisit(
    @Param('id') sourceId: string,
    @Param('visitId') visitId: string,
    @Body() dto: UpdateVisitDto,
  ) {
    return this.service.updateVisit(sourceId, visitId, dto);
  }

  @Delete(':id/visits/:visitId')
  @Permission('clinic.referrals.manage')
  deleteVisit(
    @Param('id') sourceId: string,
    @Param('visitId') visitId: string,
  ) {
    return this.service.deleteVisit(sourceId, visitId);
  }
}
