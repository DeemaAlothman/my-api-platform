import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateHolidayDto {
  nameAr: string;
  nameEn?: string;
  date: string; // ISO date
  endDate?: string; // ISO date
  type?: 'PUBLIC' | 'RELIGIOUS' | 'NATIONAL' | 'OTHER';
  isRecurring?: boolean;
  year?: number; // Optional: will be auto-extracted from date if not provided
}

export interface UpdateHolidayDto {
  nameAr?: string;
  nameEn?: string;
  date?: string;
  endDate?: string;
  type?: 'PUBLIC' | 'RELIGIOUS' | 'NATIONAL' | 'OTHER';
  isRecurring?: boolean;
  year?: number;
}

@Injectable()
export class HolidaysService {
  constructor(private prisma: PrismaService) {}

  // إنشاء عطلة جديدة
  async create(createDto: CreateHolidayDto) {
    // Auto-extract year from date if not provided
    const year = createDto.year ?? new Date(createDto.date).getFullYear();

    const holiday = await this.prisma.holiday.create({
      data: {
        nameAr: createDto.nameAr,
        nameEn: createDto.nameEn,
        date: new Date(createDto.date),
        endDate: createDto.endDate ? new Date(createDto.endDate) : null,
        type: createDto.type || 'PUBLIC',
        isRecurring: createDto.isRecurring || false,
        year,
      },
    });

    return holiday;
  }

  // تحديث عطلة
  async update(id: string, updateDto: UpdateHolidayDto) {
    const holiday = await this.prisma.holiday.findUnique({
      where: { id },
    });

    if (!holiday) {
      throw new NotFoundException('Holiday not found');
    }

    // Auto-extract year from date if date is updated but year is not provided
    let year = updateDto.year;
    if (updateDto.date && !updateDto.year) {
      year = new Date(updateDto.date).getFullYear();
    }

    const updated = await this.prisma.holiday.update({
      where: { id },
      data: {
        nameAr: updateDto.nameAr,
        nameEn: updateDto.nameEn,
        date: updateDto.date ? new Date(updateDto.date) : undefined,
        endDate: updateDto.endDate ? new Date(updateDto.endDate) : undefined,
        type: updateDto.type,
        isRecurring: updateDto.isRecurring,
        year,
      },
    });

    return updated;
  }

  // الحصول على جميع العطل
  async findAll(year?: number, type?: string) {
    const where: any = {};

    if (year) {
      where.year = year;
    }

    if (type) {
      where.type = type;
    }

    return this.prisma.holiday.findMany({
      where,
      orderBy: { date: 'asc' },
    });
  }

  // الحصول على عطلة واحدة
  async findOne(id: string) {
    const holiday = await this.prisma.holiday.findUnique({
      where: { id },
    });

    if (!holiday) {
      throw new NotFoundException('Holiday not found');
    }

    return holiday;
  }

  // الحصول على العطل في نطاق زمني
  async findInRange(startDate: string, endDate: string) {
    return this.prisma.holiday.findMany({
      where: {
        date: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      orderBy: { date: 'asc' },
    });
  }

  // الحصول على العطل الحالية والقادمة
  async findUpcoming(limit = 10) {
    return this.prisma.holiday.findMany({
      where: {
        date: {
          gte: new Date(),
        },
      },
      orderBy: { date: 'asc' },
      take: limit,
    });
  }

  // حذف عطلة
  async remove(id: string) {
    const holiday = await this.prisma.holiday.findUnique({
      where: { id },
    });

    if (!holiday) {
      throw new NotFoundException('Holiday not found');
    }

    await this.prisma.holiday.delete({
      where: { id },
    });

    return { message: 'Holiday deleted successfully' };
  }

  // استنساخ عطل من سنة إلى أخرى
  async cloneYear(fromYear: number, toYear: number) {
    const holidays = await this.prisma.holiday.findMany({
      where: { year: fromYear, isRecurring: true },
    });

    const newHolidays = [];

    for (const holiday of holidays) {
      // تغيير السنة في التاريخ
      const oldDate = new Date(holiday.date);
      const newDate = new Date(oldDate);
      newDate.setFullYear(toYear);

      let newEndDate = null;
      if (holiday.endDate) {
        const oldEndDate = new Date(holiday.endDate);
        newEndDate = new Date(oldEndDate);
        newEndDate.setFullYear(toYear);
      }

      const newHoliday = await this.prisma.holiday.create({
        data: {
          nameAr: holiday.nameAr,
          nameEn: holiday.nameEn,
          date: newDate,
          endDate: newEndDate,
          type: holiday.type,
          isRecurring: holiday.isRecurring,
          year: toYear,
        },
      });

      newHolidays.push(newHoliday);
    }

    return newHolidays;
  }
}
