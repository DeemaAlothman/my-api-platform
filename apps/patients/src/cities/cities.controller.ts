import { Controller, Get, UseGuards } from '@nestjs/common';
import { CitiesService } from './cities.service';
import { JwtAuthGuard } from '@shared/auth';

@Controller('cities')
@UseGuards(JwtAuthGuard)
export class CitiesController {
  constructor(private readonly service: CitiesService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('by-governorate')
  byGovernorate() {
    return this.service.findByGovernorate();
  }
}
