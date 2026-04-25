import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';

type DocumentType =
  | 'CONTRACT'
  | 'NATIONAL_ID'
  | 'PASSPORT'
  | 'RESIDENCE'
  | 'CERTIFICATE'
  | 'PHOTO'
  | 'MEDICAL'
  | 'BANK_ACCOUNT'
  | 'OTHER';
type DocumentStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';

const ALLOWED_MIMES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/heic',
  'image/heif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const storage = diskStorage({
  destination: '/app/uploads/documents',
  filename: (_req, file, cb) => {
    cb(null, `${randomUUID()}${extname(file.originalname)}`);
  },
});

@ApiTags('Documents')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('documents')
export class DocumentsController {
  constructor(private readonly service: DocumentsService) {}

  @Post('upload')
  @ApiOperation({ summary: 'رفع مستند لموظف' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        employeeId: { type: 'string' },
        type: {
          type: 'string',
          enum: [
            'CONTRACT',
            'NATIONAL_ID',
            'PASSPORT',
            'RESIDENCE',
            'CERTIFICATE',
            'PHOTO',
            'MEDICAL',
            'BANK_ACCOUNT',
            'OTHER',
          ],
        },
        titleAr: { type: 'string' },
        titleEn: { type: 'string' },
        notes: { type: 'string' },
        issueDate: { type: 'string', format: 'date' },
        expiryDate: { type: 'string', format: 'date' },
      },
      required: ['file', 'employeeId', 'type', 'titleAr'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage,
      limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
      fileFilter: (_req, file, cb) => {
        if (ALLOWED_MIMES.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              'نوع الملف غير مسموح به. المسموح: PDF, JPG, PNG, HEIC, DOC, DOCX',
            ),
            false,
          );
        }
      },
    }),
  )
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateDocumentDto,
    @Request() req: any,
  ) {
    if (!file) throw new BadRequestException('يجب رفع ملف');
    return this.service.uploadAndCreate(file, dto, req.user?.sub);
  }

  @Get()
  @ApiOperation({ summary: 'قائمة المستندات' })
  @ApiQuery({ name: 'employeeId', required: false })
  @ApiQuery({
    name: 'type',
    enum: [
      'CONTRACT',
      'NATIONAL_ID',
      'PASSPORT',
      'RESIDENCE',
      'CERTIFICATE',
      'PHOTO',
      'MEDICAL',
      'BANK_ACCOUNT',
      'OTHER',
    ],
    required: false,
  })
  @ApiQuery({
    name: 'status',
    enum: ['ACTIVE', 'EXPIRED', 'CANCELLED'],
    required: false,
  })
  findAll(
    @Query('employeeId') employeeId?: string,
    @Query('type') type?: DocumentType,
    @Query('status') status?: DocumentStatus,
  ) {
    return this.service.findAll(employeeId, type, status);
  }

  @Get('expiring')
  @ApiOperation({ summary: 'المستندات المنتهية قريباً (خلال N يوم)' })
  @ApiQuery({
    name: 'days',
    required: false,
    description: 'عدد الأيام (افتراضي: 30)',
  })
  getExpiring(@Query('days') days?: string) {
    return this.service.getExpiringDocuments(days ? parseInt(days) : 30);
  }

  @Get(':id')
  @ApiOperation({ summary: 'تفاصيل مستند' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'تعديل بيانات مستند' })
  update(@Param('id') id: string, @Body() dto: UpdateDocumentDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'حذف مستند (يحذف الملف أيضاً)' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Patch('sync-expired')
  @ApiOperation({ summary: 'تحديث حالة المستندات المنتهية' })
  syncExpired() {
    return this.service.syncExpiredStatuses();
  }
}
