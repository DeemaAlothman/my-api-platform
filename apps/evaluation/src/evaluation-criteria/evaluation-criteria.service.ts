import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCriteriaDto } from './dto/create-criteria.dto';
import { UpdateCriteriaDto } from './dto/update-criteria.dto';

@Injectable()
export class EvaluationCriteriaService {
  constructor(private prisma: PrismaService) {}

  async findAll(category?: string) {
    const where: any = {};

    if (category) {
      where.category = category;
    }

    return this.prisma.evaluationCriteria.findMany({
      where,
      orderBy: { displayOrder: 'asc' },
    });
  }

  async findOne(id: string) {
    const criteria = await this.prisma.evaluationCriteria.findUnique({
      where: { id },
    });

    if (!criteria) {
      throw new NotFoundException(`Criteria with ID ${id} not found`);
    }

    return criteria;
  }

  async create(createCriteriaDto: CreateCriteriaDto) {
    // Check if code already exists
    const existing = await this.prisma.evaluationCriteria.findUnique({
      where: { code: createCriteriaDto.code },
    });

    if (existing) {
      throw new BadRequestException(
        `Criteria with code ${createCriteriaDto.code} already exists`,
      );
    }

    return this.prisma.evaluationCriteria.create({
      data: createCriteriaDto,
    });
  }

  async update(id: string, updateCriteriaDto: UpdateCriteriaDto) {
    await this.findOne(id);

    return this.prisma.evaluationCriteria.update({
      where: { id },
      data: updateCriteriaDto,
    });
  }

  async delete(id: string) {
    await this.findOne(id);

    // Check if criteria is used in any evaluation sections
    const sectionsCount = await this.prisma.evaluationSection.count({
      where: { criteriaId: id },
    });

    if (sectionsCount > 0) {
      throw new BadRequestException(
        'Cannot delete criteria that is used in evaluation forms',
      );
    }

    return this.prisma.evaluationCriteria.delete({
      where: { id },
    });
  }
}
