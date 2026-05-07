import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { DeviceService } from './device.service';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { JwtAuthGuard } from '@shared/auth';
import { PermissionsGuard } from '@shared';
import { Permission } from '@shared';

@Controller('biometric-devices')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DeviceController {
  constructor(private readonly deviceService: DeviceService) {}

  @Post()
  @Permission('biometric.devices.create')
  create(@Body() dto: RegisterDeviceDto) {
    return this.deviceService.create(dto);
  }

  @Get()
  @Permission('biometric.devices.read')
  findAll() {
    return this.deviceService.findAll();
  }

  @Get(':id/status')
  @Permission('biometric.devices.read')
  getStatus(@Param('id') id: string) {
    return this.deviceService.getStatus(id);
  }

  @Get(':id')
  @Permission('biometric.devices.read')
  findOne(@Param('id') id: string) {
    return this.deviceService.findOne(id);
  }

  @Patch(':id')
  @Permission('biometric.devices.update')
  update(@Param('id') id: string, @Body() dto: UpdateDeviceDto) {
    return this.deviceService.update(id, dto);
  }

  @Delete(':id')
  @Permission('biometric.devices.delete')
  remove(@Param('id') id: string) {
    return this.deviceService.remove(id);
  }
}
