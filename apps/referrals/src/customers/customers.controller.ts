import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, UserId } from '@shared/auth';
import { PermissionsGuard, Permission } from '@shared';
import { CustomersService } from './customers.service';
import { CreateCustomerDto, UpdateCustomerDto, ListCustomersQueryDto } from './dto/customer.dto';

@ApiTags('referrals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('referrals/customers')
export class CustomersController {
  constructor(private readonly service: CustomersService) {}

  @Post()
  @Permission('sales.customers.manage')
  create(@Body() dto: CreateCustomerDto, @UserId() userId: string) {
    return this.service.create(dto, userId);
  }

  @Get()
  @Permission('sales.customers.view')
  findAll(@Query() query: ListCustomersQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @Permission('sales.customers.view')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Permission('sales.customers.manage')
  update(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Permission('sales.customers.manage')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
