import {
  Injectable, NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import * as fs from 'fs';
import * as path from 'path';

type DocumentType = 'CONTRACT' | 'NATIONAL_ID' | 'PASSPORT' | 'RESIDENCE' | 'CERTIFICATE' | 'PHOTO' | 'MEDICAL' | 'BANK_ACCOUNT' | 'OTHER';
type DocumentStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED';

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  async uploadAndCreate(
    file: Express.Multer.File,
    dto: CreateDocumentDto,
    uploadedBy: string,
  ) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, deletedAt: null },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    return this.prisma.employeeDocument.create({
      data: {
        employeeId: dto.employeeId,
        type: dto.type,
        titleAr: dto.titleAr,
        titleEn: dto.titleEn,
        notes: dto.notes,
        issueDate: dto.issueDate ? new Date(dto.issueDate) : null,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
        fileUrl: `/uploads/documents/${file.filename}`,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        uploadedBy,
      },
    });
  }

  async findAll(employeeId?: string, type?: DocumentType, status?: DocumentStatus) {
    return this.prisma.employeeDocument.findMany({
      where: {
        deletedAt: null,
        ...(employeeId ? { employeeId } : {}),
        ...(type ? { type } : {}),
        ...(status ? { status } : {}),
      },
      include: {
        employee: {
          select: { firstNameAr: true, lastNameAr: true, firstNameEn: true, lastNameEn: true, employeeNumber: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const doc = await this.prisma.employeeDocument.findFirst({
      where: { id, deletedAt: null },
      include: {
        employee: {
          select: { firstNameAr: true, lastNameAr: true, firstNameEn: true, lastNameEn: true, employeeNumber: true },
        },
      },
    });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  async update(id: string, dto: UpdateDocumentDto) {
    await this.findOne(id);
    return this.prisma.employeeDocument.update({
      where: { id },
      data: {
        ...dto,
        issueDate: dto.issueDate ? new Date(dto.issueDate) : undefined,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
      },
    });
  }

  async remove(id: string) {
    const doc = await this.findOne(id);

    // حذف الملف من القرص
    const filePath = path.join('/app', doc.fileUrl);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await this.prisma.employeeDocument.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { success: true };
  }

  async getExpiringDocuments(daysAhead = 30) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysAhead);

    return this.prisma.employeeDocument.findMany({
      where: {
        deletedAt: null,
        status: 'ACTIVE',
        expiryDate: {
          not: null,
          lte: targetDate,
          gte: new Date(),
        },
      },
      include: {
        employee: {
          select: { firstNameAr: true, lastNameAr: true, firstNameEn: true, lastNameEn: true, employeeNumber: true },
        },
      },
      orderBy: { expiryDate: 'asc' },
    });
  }

  async syncExpiredStatuses() {
    const updated = await this.prisma.employeeDocument.updateMany({
      where: {
        deletedAt: null,
        status: 'ACTIVE',
        expiryDate: { lt: new Date() },
      },
      data: { status: 'EXPIRED' },
    });
    return { updatedCount: updated.count };
  }
}
