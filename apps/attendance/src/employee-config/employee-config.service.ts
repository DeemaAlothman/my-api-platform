import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeConfigDto } from './dto/create-employee-config.dto';
import { UpdateEmployeeConfigDto } from './dto/update-employee-config.dto';

@Injectable()
export class EmployeeConfigService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateEmployeeConfigDto) {
    const existing = await this.prisma.employeeAttendanceConfig.findUnique({
      where: { employeeId: dto.employeeId },
    });
    if (existing) {
      throw new ConflictException('إعدادات لهذا الموظف موجودة مسبقاً');
    }
    return this.prisma.employeeAttendanceConfig.create({ data: dto });
  }

  async findAll() {
    return this.prisma.employeeAttendanceConfig.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findByEmployee(employeeId: string) {
    const config = await this.prisma.employeeAttendanceConfig.findUnique({ where: { employeeId } });
    // إذا ما في إعدادات → ارجع القيم الافتراضية
    return config ?? { employeeId, salaryLinked: true, allowedBreakMinutes: 60 };
  }

  async update(employeeId: string, dto: UpdateEmployeeConfigDto) {
    const existing = await this.prisma.employeeAttendanceConfig.findUnique({ where: { employeeId } });
    if (!existing) {
      // إنشاء تلقائي إذا ما في
      return this.prisma.employeeAttendanceConfig.create({ data: { employeeId, ...dto } });
    }
    return this.prisma.employeeAttendanceConfig.update({ where: { employeeId }, data: dto });
  }
}
