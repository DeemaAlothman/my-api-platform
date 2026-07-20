import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ReceptionsService } from './receptions.service';
import { CreateReceptionDto } from './dto/create-reception.dto';
import { UpdateReceptionDto } from './dto/update-reception.dto';
import { JwtAuthGuard } from '@shared/auth';
import { User } from '@shared/auth';

@UseGuards(JwtAuthGuard)
@Controller('podiatry/receptions')
export class ReceptionsController {
  constructor(private readonly service: ReceptionsService) {}

  @Post()
  create(@Body() dto: CreateReceptionDto, @User() user: any) {
    return this.service.create(dto, user.userId);
  }

  @Get()
  findAll(@Query('patientId') patientId?: string) {
    return this.service.findAll(patientId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateReceptionDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
