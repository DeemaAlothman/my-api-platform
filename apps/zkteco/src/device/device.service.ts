import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';

@Injectable()
export class DeviceService {
  constructor(private prisma: PrismaService) {}

  async create(dto: RegisterDeviceDto) {
    const existing = await this.prisma.biometricDevice.findUnique({
      where: { serialNumber: dto.serialNumber },
    });
    if (existing) {
      throw new ConflictException('الرقم التسلسلي مسجل مسبقاً');
    }

    return this.prisma.biometricDevice.create({ data: dto });
  }

  async findAll() {
    return this.prisma.biometricDevice.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const device = await this.prisma.biometricDevice.findUnique({ where: { id } });
    if (!device) {
      throw new NotFoundException('الجهاز غير موجود');
    }
    return device;
  }

  async update(id: string, dto: UpdateDeviceDto) {
    await this.findOne(id);
    return this.prisma.biometricDevice.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.$transaction([
      this.prisma.rawAttendanceLog.deleteMany({ where: { deviceId: id } }),
      this.prisma.employeeFingerprint.deleteMany({ where: { deviceId: id } }),
      this.prisma.biometricDevice.delete({ where: { id } }),
    ]);
    return { message: 'Device deleted successfully' };
  }

  async getStatus(id: string) {
    const device = await this.findOne(id);
    const now = new Date();
    const lastSync = device.lastSyncAt;
    const isOnline = lastSync && (now.getTime() - lastSync.getTime()) < 5 * 60 * 1000; // 5 minutes

    return {
      id: device.id,
      serialNumber: device.serialNumber,
      isActive: device.isActive,
      isOnline: !!isOnline,
      lastSyncAt: device.lastSyncAt,
    };
  }

  async findBySerialNumber(serialNumber: string) {
    return this.prisma.biometricDevice.findUnique({ where: { serialNumber } });
  }

  async updateLastSync(id: string) {
    return this.prisma.biometricDevice.update({
      where: { id },
      data: { lastSyncAt: new Date() },
    });
  }
}
