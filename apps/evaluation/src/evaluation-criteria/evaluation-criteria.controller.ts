import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { EvaluationCriteriaService } from './evaluation-criteria.service';
import { CreateCriteriaDto } from './dto/create-criteria.dto';
import { UpdateCriteriaDto } from './dto/update-criteria.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permissions } from '../common/decorators/permissions.decorator';

@Controller('evaluation-criteria')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EvaluationCriteriaController {
  constructor(private readonly criteriaService: EvaluationCriteriaService) {}

  @Get()
  findAll(@Query('category') category?: string) {
    return this.criteriaService.findAll(category);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.criteriaService.findOne(id);
  }

  @Post()
  @Permissions('evaluation:criteria:create')
  create(@Body() createCriteriaDto: CreateCriteriaDto) {
    return this.criteriaService.create(createCriteriaDto);
  }

  @Patch(':id')
  @Permissions('evaluation:criteria:update')
  update(
    @Param('id') id: string,
    @Body() updateCriteriaDto: UpdateCriteriaDto,
  ) {
    return this.criteriaService.update(id, updateCriteriaDto);
  }

  @Delete(':id')
  @Permissions('evaluation:criteria:delete')
  delete(@Param('id') id: string) {
    return this.criteriaService.delete(id);
  }
}
