import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateWaitingListEntryDto, UpdateWaitingListEntryDto, ListWaitingListQueryDto,
} from './dto/waiting-list.dto';

@Injectable()
export class WaitingListService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateWaitingListEntryDto, userId: string) {
    return this.prisma.waitingListEntry.create({
      data: {
        patientName:    dto.patientName,
        gender:         dto.gender as any,
        age:            dto.age,
        arrivalMethod:  dto.arrivalMethod as any,
        serviceType:    dto.serviceType,
        contactNumber:  dto.contactNumber,
        priority:       dto.priority,
        notes:          dto.notes,
        createdBy:      userId,
      },
    });
  }

  async findAll(query: ListWaitingListQueryDto) {
    const page  = query.page  ?? 1;
    const limit = query.limit ?? 50;
    const skip  = (page - 1) * limit;

    const where: any = {};
    if (query.status) where.status = query.status;

    const [items, total] = await Promise.all([
      this.prisma.waitingListEntry.findMany({
        where, skip, take: limit,
        orderBy: [{ priority: 'desc' }, { registrationDate: 'asc' }],
      }),
      this.prisma.waitingListEntry.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async findOne(id: string) {
    const entry = await this.prisma.waitingListEntry.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException('لم يتم العثور على السجل بقائمة الانتظار');
    return entry;
  }

  async update(id: string, dto: UpdateWaitingListEntryDto) {
    await this.findOne(id);
    return this.prisma.waitingListEntry.update({
      where: { id },
      data: {
        patientName:   dto.patientName,
        gender:        dto.gender as any,
        age:           dto.age,
        arrivalMethod: dto.arrivalMethod as any,
        serviceType:   dto.serviceType,
        contactNumber: dto.contactNumber,
        priority:      dto.priority,
        notes:         dto.notes,
        status:        dto.status as any,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.waitingListEntry.delete({ where: { id } });
    return { message: 'تم حذف السجل من قائمة الانتظار' };
  }
}
