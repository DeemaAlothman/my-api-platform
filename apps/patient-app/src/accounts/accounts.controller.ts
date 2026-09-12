import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@shared/auth';
import { PermissionsGuard } from '@shared/guards/permissions.guard';
import { Permission } from '@shared/decorators/permission.decorator';
import { PERMISSIONS } from '@shared/constants/permissions.constants';
import { User } from '@shared/auth/decorators/current-user.decorator';
import { AccountsService } from './accounts.service';
import { CreateAccountDto, UpdateAccountDto } from './dto/account.dto';

@Controller('patient-app/accounts')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AccountsController {
  constructor(private readonly service: AccountsService) {}

  @Post()
  @Permission(PERMISSIONS.CLINIC_PATIENT_APP.ACCOUNT_MANAGE)
  create(@Body() dto: CreateAccountDto, @User() user: any) {
    return this.service.create(dto, user.userId);
  }

  @Get(':id')
  @Permission(PERMISSIONS.CLINIC_PATIENT_APP.ACCOUNT_MANAGE)
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Get('by-patient/:erpPatientId')
  @Permission(PERMISSIONS.CLINIC_PATIENT_APP.ACCOUNT_MANAGE)
  findByPatient(@Param('erpPatientId') erpPatientId: string) {
    return this.service.findByErpPatientId(erpPatientId);
  }

  @Patch(':id')
  @Permission(PERMISSIONS.CLINIC_PATIENT_APP.ACCOUNT_MANAGE)
  update(@Param('id') id: string, @Body() dto: UpdateAccountDto) {
    return this.service.update(id, dto);
  }
}
