import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, User } from '@shared/auth';
import { PermissionsGuard, Permission } from '@shared';
import { SourcesService } from './sources.service';
import {
  CreateSourceDto, UpdateSourceDto,
  CreateVisitDto, UpdateVisitDto,
  ListSourcesQueryDto,
} from './dto/source.dto';

@ApiTags('referrals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('referrals/sources')
export class SourcesController {
  constructor(private readonly service: SourcesService) {}

  // ── Sources ───────────────────────────────────────────────────────

  @Post()
  @Permission('clinic.referrals.manage')
  create(@Body() dto: CreateSourceDto, @User('sub') userId: string) {
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

  @Get(':id/patient-count')
  @Permission('clinic.referrals.stats.view')
  getPatientCount(@Param('id') id: string) {
    return this.service.getPatientCount(id);
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
    @User('sub') userId: string,
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
