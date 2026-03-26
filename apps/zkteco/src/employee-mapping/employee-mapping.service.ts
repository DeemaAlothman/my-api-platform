import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMappingDto } from './dto/create-mapping.dto';
import { UpdateMappingDto } from './dto/update-mapping.dto';

@Injectable()
export class EmployeeMappingService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateMappingDto) {
    // تحقق إن الجهاز موجود ونشط
    const device = await this.prisma.biometricDevice.findUnique({
      where: { id: dto.deviceId },
    });
    if (!device) throw new NotFoundException('الجهاز غير موجود');
    if (!device.isActive) throw new BadRequestException('الجهاز غير نشط');

    // تحقق إن الموظف موجود
    const employees = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM users.employees
      WHERE id = ${dto.employeeId} AND "deletedAt" IS NULL LIMIT 1
    `;
    if (employees.length === 0) throw new NotFoundException('الموظف غير موجود');

    // تحقق إن PIN مو مستخدم على نفس الجهاز
    const existing = await this.prisma.employeeFingerprint.findUnique({
      where: { pin_deviceId: { pin: dto.pin, deviceId: dto.deviceId } },
    });
    if (existing) throw new ConflictException('هذا PIN مستخدم مسبقاً على نفس الجهاز');

    return this.prisma.employeeFingerprint.create({ data: dto });
  }

  async bulkCreate(mappings: CreateMappingDto[]) {
    const results = [];
    const errors = [];

    for (const dto of mappings) {
      try {
        const result = await this.create(dto);
        results.push(result);
      } catch (err) {
        errors.push({ dto, error: err.message });
      }
    }

    return { created: results.length, failed: errors.length, errors };
  }

  async findAll() {
    return this.prisma.employeeFingerprint.findMany({
      include: { device: { select: { id: true, serialNumber: true, nameAr: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByEmployee(employeeId: string) {
    return this.prisma.employeeFingerprint.findMany({
      where: { employeeId },
      include: { device: { select: { id: true, serialNumber: true, nameAr: true } } },
    });
  }

  async findOne(id: string) {
    const mapping = await this.prisma.employeeFingerprint.findUnique({
      where: { id },
      include: { device: true },
    });
    if (!mapping) throw new NotFoundException('الربط غير موجود');
    return mapping;
  }

  async update(id: string, dto: UpdateMappingDto) {
    await this.findOne(id);
    return this.prisma.employeeFingerprint.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.employeeFingerprint.delete({ where: { id } });
  }

  async findByPinAndDevice(pin: string, deviceId: string) {
    return this.prisma.employeeFingerprint.findUnique({
      where: { pin_deviceId: { pin, deviceId } },
    });
  }
}
