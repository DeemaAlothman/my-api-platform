import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, User } from '@shared/auth';
import { PermissionsGuard } from '@shared';
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
  create(@Body() dto: CreateSourceDto, @User('sub') userId: string) {
    return this.service.create(dto, userId);
  }

  @Get()
  findAll(@Query() query: ListSourcesQueryDto) {
    return this.service.findAll(query);
  }

  @Get('stats')
  getStats() {
    return this.service.getStats();
  }

  @Get(':id/patient-count')
  getPatientCount(@Param('id') id: string) {
    return this.service.getPatientCount(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSourceDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  // ── Visits ────────────────────────────────────────────────────────

  @Post(':id/visits')
  addVisit(
    @Param('id') sourceId: string,
    @Body() dto: CreateVisitDto,
    @User('sub') userId: string,
  ) {
    return this.service.addVisit(sourceId, dto, userId);
  }

  @Get(':id/visits')
  getVisits(@Param('id') sourceId: string) {
    return this.service.getVisits(sourceId);
  }

  @Patch(':id/visits/:visitId')
  updateVisit(
    @Param('id') sourceId: string,
    @Param('visitId') visitId: string,
    @Body() dto: UpdateVisitDto,
  ) {
    return this.service.updateVisit(sourceId, visitId, dto);
  }

  @Delete(':id/visits/:visitId')
  deleteVisit(
    @Param('id') sourceId: string,
    @Param('visitId') visitId: string,
  ) {
    return this.service.deleteVisit(sourceId, visitId);
  }
}
