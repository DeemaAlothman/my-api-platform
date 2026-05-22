import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CitiesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.city.findMany({ orderBy: [{ governorate: 'asc' }, { nameAr: 'asc' }] });
  }

  async findByGovernorate() {
    const cities = await this.prisma.city.findMany({
      orderBy: [{ governorate: 'asc' }, { nameAr: 'asc' }],
    });

    const grouped: Record<string, typeof cities> = {};
    for (const city of cities) {
      if (!grouped[city.governorate]) grouped[city.governorate] = [];
      grouped[city.governorate].push(city);
    }

    return Object.entries(grouped).map(([governorate, items]) => ({ governorate, cities: items }));
  }
}
