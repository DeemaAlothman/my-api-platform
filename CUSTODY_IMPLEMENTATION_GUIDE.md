# دليل تعديلات نظام العهدة (Custody/Asset Management)

## نظرة عامة

إضافة نظام إدارة العهد (الأصول) للموظفين، بحيث يمكن تسجيل القطع المسلّمة لكل موظف وتتبع حالتها، مع منع الاستقالة قبل تسليم جميع العهد.

---

## القرار المعماري: أين نضيف الميزة؟

### التوصية: موديول جديد داخل `users-service`

**الأسباب:**
- العهدة مرتبطة مباشرة بالموظف (Employee)
- لا تحتاج workflow موافقات معقد
- تشارك نفس الـ Prisma schema مع Employee
- أبسط في التنفيذ والصيانة
- نفس النمط المتبع في modules الأخرى (departments, job-titles, job-grades)

**البديل المرفوض:** خدمة مستقلة - تعقيد غير مبرر لميزة بسيطة مرتبطة بالموظفين.

---

## 1. تعديلات Prisma Schema

**الملف:** `apps/users-service/prisma/schema.prisma`

### إضافة enum لحالة العهدة

```prisma
enum CustodyStatus {
  WITH_EMPLOYEE    // مع الموظف (مسلّمة)
  RETURNED         // تم إرجاعها
  DAMAGED          // تالفة
  LOST             // مفقودة
}
```

### إضافة enum لفئة العهدة

```prisma
enum CustodyCategory {
  ELECTRONICS      // إلكترونيات (لابتوب، جوال، تابلت)
  FURNITURE        // أثاث (مكتب، كرسي)
  VEHICLE          // مركبة
  TOOLS            // أدوات عمل
  KEYS             // مفاتيح
  UNIFORM          // زي رسمي
  OTHER            // أخرى
}
```

### إضافة موديل Custody

```prisma
model Custody {
  id            Int             @id @default(autoincrement())

  // بيانات القطعة
  name          String          // اسم القطعة (مثال: لابتوب Dell Latitude)
  description   String?         // وصف القطعة
  serialNumber  String?         @unique // الرقم التسلسلي
  category      CustodyCategory @default(OTHER) // فئة القطعة

  // بيانات التسليم
  employeeId    Int             // الموظف المسلّم له
  employee      Employee        @relation(fields: [employeeId], references: [id])
  assignedDate  DateTime        // تاريخ التسليم
  returnedDate  DateTime?       // تاريخ الإرجاع (فارغ إذا لم تُرجع)

  // الحالة
  status        CustodyStatus   @default(WITH_EMPLOYEE)
  notes         String?         // ملاحظات

  // تتبع
  createdBy     Int?            // من أضاف السجل
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt
  deletedAt     DateTime?       // soft delete

  @@map("custodies")
  @@index([employeeId])
  @@index([status])
  @@index([serialNumber])
}
```

### تعديل موديل Employee - إضافة العلاقة

```prisma
// داخل model Employee أضف:
custodies     Custody[]
```

---

## 2. إنشاء موديول Custody

### هيكل الملفات الجديدة

```
apps/users-service/src/custodies/
├── custodies.module.ts
├── custodies.controller.ts
├── custodies.service.ts
└── dto/
    ├── create-custody.dto.ts
    ├── update-custody.dto.ts
    ├── return-custody.dto.ts
    └── list-custodies.query.dto.ts
```

---

### 2.1 DTOs

**ملف:** `dto/create-custody.dto.ts`

```typescript
import { IsString, IsOptional, IsInt, IsDateString, IsEnum } from 'class-validator';
import { CustodyCategory } from '@prisma/client';

export class CreateCustodyDto {
  @IsString()
  name: string;               // اسم القطعة

  @IsOptional()
  @IsString()
  description?: string;        // وصف القطعة

  @IsOptional()
  @IsString()
  serialNumber?: string;       // الرقم التسلسلي

  @IsOptional()
  @IsEnum(CustodyCategory)
  category?: CustodyCategory;  // فئة القطعة

  @IsInt()
  employeeId: number;          // الموظف المسلّم له

  @IsDateString()
  assignedDate: string;        // تاريخ التسليم

  @IsOptional()
  @IsString()
  notes?: string;              // ملاحظات
}
```

**ملف:** `dto/update-custody.dto.ts`

```typescript
import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateCustodyDto } from './create-custody.dto';

// يسمح بتعديل كل الحقول ما عدا employeeId (نقل العهدة عملية منفصلة)
export class UpdateCustodyDto extends PartialType(
  OmitType(CreateCustodyDto, ['employeeId'] as const)
) {}
```

**ملف:** `dto/return-custody.dto.ts`

```typescript
import { IsOptional, IsString, IsDateString, IsEnum } from 'class-validator';
import { CustodyStatus } from '@prisma/client';

export class ReturnCustodyDto {
  @IsOptional()
  @IsDateString()
  returnedDate?: string;   // تاريخ الإرجاع (افتراضي: اليوم)

  @IsEnum(CustodyStatus)
  status: CustodyStatus;   // RETURNED أو DAMAGED أو LOST

  @IsOptional()
  @IsString()
  notes?: string;          // ملاحظات الإرجاع
}
```

**ملف:** `dto/list-custodies.query.dto.ts`

```typescript
import { IsOptional, IsInt, IsEnum, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { CustodyStatus, CustodyCategory } from '@prisma/client';

export class ListCustodiesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  employeeId?: number;        // فلتر حسب الموظف

  @IsOptional()
  @IsEnum(CustodyStatus)
  status?: CustodyStatus;     // فلتر حسب الحالة

  @IsOptional()
  @IsEnum(CustodyCategory)
  category?: CustodyCategory; // فلتر حسب الفئة

  @IsOptional()
  @IsString()
  search?: string;            // بحث بالاسم أو السيريال
}
```

---

### 2.2 Service

**ملف:** `custodies.service.ts`

```typescript
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustodyDto } from './dto/create-custody.dto';
import { UpdateCustodyDto } from './dto/update-custody.dto';
import { ReturnCustodyDto } from './dto/return-custody.dto';
import { ListCustodiesQueryDto } from './dto/list-custodies.query.dto';
import { CustodyStatus } from '@prisma/client';

@Injectable()
export class CustodiesService {
  constructor(private prisma: PrismaService) {}

  // ==================== إنشاء عهدة ====================
  async create(dto: CreateCustodyDto, userId: number) {
    // التحقق من وجود الموظف
    const employee = await this.prisma.employee.findUnique({
      where: { id: dto.employeeId },
    });
    if (!employee) {
      throw new NotFoundException('الموظف غير موجود');
    }

    // التحقق من عدم تكرار السيريال
    if (dto.serialNumber) {
      const existing = await this.prisma.custody.findUnique({
        where: { serialNumber: dto.serialNumber },
      });
      if (existing) {
        throw new BadRequestException('الرقم التسلسلي مستخدم مسبقاً');
      }
    }

    return this.prisma.custody.create({
      data: {
        ...dto,
        assignedDate: new Date(dto.assignedDate),
        status: CustodyStatus.WITH_EMPLOYEE,
        createdBy: userId,
      },
      include: {
        employee: {
          select: {
            id: true,
            firstNameAr: true,
            lastNameAr: true,
            employeeNumber: true,
          },
        },
      },
    });
  }

  // ==================== جلب كل العهد مع فلترة وتصفح ====================
  async findAll(query: ListCustodiesQueryDto) {
    const { page = 1, limit = 10, employeeId, status, category, search } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: null, // soft delete
    };

    if (employeeId) where.employeeId = employeeId;
    if (status) where.status = status;
    if (category) where.category = category;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { serialNumber: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.custody.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          employee: {
            select: {
              id: true,
              firstNameAr: true,
              lastNameAr: true,
              employeeNumber: true,
              department: { select: { id: true, nameAr: true } },
            },
          },
        },
      }),
      this.prisma.custody.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ==================== جلب عهدة واحدة ====================
  async findOne(id: number) {
    const custody = await this.prisma.custody.findFirst({
      where: { id, deletedAt: null },
      include: {
        employee: {
          select: {
            id: true,
            firstNameAr: true,
            lastNameAr: true,
            firstNameEn: true,
            lastNameEn: true,
            employeeNumber: true,
            department: { select: { id: true, nameAr: true, nameEn: true } },
          },
        },
      },
    });
    if (!custody) {
      throw new NotFoundException('العهدة غير موجودة');
    }
    return custody;
  }

  // ==================== تعديل عهدة ====================
  async update(id: number, dto: UpdateCustodyDto) {
    await this.findOne(id); // تحقق من الوجود
    return this.prisma.custody.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.assignedDate && { assignedDate: new Date(dto.assignedDate) }),
      },
    });
  }

  // ==================== إرجاع عهدة ====================
  async returnCustody(id: number, dto: ReturnCustodyDto) {
    const custody = await this.findOne(id);

    if (custody.status !== CustodyStatus.WITH_EMPLOYEE) {
      throw new BadRequestException('هذه العهدة ليست مع الموظف حالياً');
    }

    // الحالة يجب أن تكون RETURNED أو DAMAGED أو LOST (ليس WITH_EMPLOYEE)
    if (dto.status === CustodyStatus.WITH_EMPLOYEE) {
      throw new BadRequestException('لا يمكن تغيير الحالة إلى "مع الموظف"');
    }

    return this.prisma.custody.update({
      where: { id },
      data: {
        status: dto.status,
        returnedDate: dto.returnedDate ? new Date(dto.returnedDate) : new Date(),
        notes: dto.notes || custody.notes,
      },
    });
  }

  // ==================== حذف عهدة (Soft Delete) ====================
  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.custody.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // ==================== جلب عهد موظف معين ====================
  async findByEmployee(employeeId: number) {
    return this.prisma.custody.findMany({
      where: {
        employeeId,
        deletedAt: null,
      },
      orderBy: { assignedDate: 'desc' },
    });
  }

  // ==================== التحقق من تسليم جميع العهد (للاستقالة) ====================
  async hasUnreturnedCustodies(employeeId: number): Promise<boolean> {
    const count = await this.prisma.custody.count({
      where: {
        employeeId,
        status: CustodyStatus.WITH_EMPLOYEE,
        deletedAt: null,
      },
    });
    return count > 0;
  }

  // ==================== جلب ملخص عهد موظف ====================
  async getEmployeeCustodySummary(employeeId: number) {
    const [total, withEmployee, returned, damaged, lost] = await Promise.all([
      this.prisma.custody.count({ where: { employeeId, deletedAt: null } }),
      this.prisma.custody.count({ where: { employeeId, status: CustodyStatus.WITH_EMPLOYEE, deletedAt: null } }),
      this.prisma.custody.count({ where: { employeeId, status: CustodyStatus.RETURNED, deletedAt: null } }),
      this.prisma.custody.count({ where: { employeeId, status: CustodyStatus.DAMAGED, deletedAt: null } }),
      this.prisma.custody.count({ where: { employeeId, status: CustodyStatus.LOST, deletedAt: null } }),
    ]);

    return { total, withEmployee, returned, damaged, lost };
  }
}
```

---

### 2.3 Controller

**ملف:** `custodies.controller.ts`

```typescript
import {
  Controller, Get, Post, Put, Delete, Patch,
  Body, Param, Query, ParseIntPipe, UseGuards, Req,
} from '@nestjs/common';
import { CustodiesService } from './custodies.service';
import { CreateCustodyDto } from './dto/create-custody.dto';
import { UpdateCustodyDto } from './dto/update-custody.dto';
import { ReturnCustodyDto } from './dto/return-custody.dto';
import { ListCustodiesQueryDto } from './dto/list-custodies.query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '@shared/guards/permissions.guard';
import { Permission } from '@shared/decorators/permission.decorator';

@Controller('custodies')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CustodiesController {
  constructor(private readonly custodiesService: CustodiesService) {}

  // POST /api/v1/custodies - إنشاء عهدة جديدة
  @Post()
  @Permission('custodies:create')
  create(@Body() dto: CreateCustodyDto, @Req() req: any) {
    return this.custodiesService.create(dto, req.user.sub);
  }

  // GET /api/v1/custodies - جلب كل العهد
  @Get()
  @Permission('custodies:read')
  findAll(@Query() query: ListCustodiesQueryDto) {
    return this.custodiesService.findAll(query);
  }

  // GET /api/v1/custodies/:id - جلب عهدة واحدة
  @Get(':id')
  @Permission('custodies:read')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.custodiesService.findOne(id);
  }

  // PUT /api/v1/custodies/:id - تعديل عهدة
  @Put(':id')
  @Permission('custodies:update')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCustodyDto) {
    return this.custodiesService.update(id, dto);
  }

  // PATCH /api/v1/custodies/:id/return - إرجاع عهدة
  @Patch(':id/return')
  @Permission('custodies:update')
  returnCustody(@Param('id', ParseIntPipe) id: number, @Body() dto: ReturnCustodyDto) {
    return this.custodiesService.returnCustody(id, dto);
  }

  // DELETE /api/v1/custodies/:id - حذف عهدة
  @Delete(':id')
  @Permission('custodies:delete')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.custodiesService.remove(id);
  }

  // GET /api/v1/custodies/employee/:employeeId - عهد موظف معين
  @Get('employee/:employeeId')
  @Permission('custodies:read')
  findByEmployee(@Param('employeeId', ParseIntPipe) employeeId: number) {
    return this.custodiesService.findByEmployee(employeeId);
  }

  // GET /api/v1/custodies/employee/:employeeId/summary - ملخص عهد موظف
  @Get('employee/:employeeId/summary')
  @Permission('custodies:read')
  getSummary(@Param('employeeId', ParseIntPipe) employeeId: number) {
    return this.custodiesService.getEmployeeCustodySummary(employeeId);
  }

  // GET /api/v1/custodies/employee/:employeeId/check - التحقق من وجود عهد غير مسلّمة
  @Get('employee/:employeeId/check')
  @Permission('custodies:read')
  checkUnreturned(@Param('employeeId', ParseIntPipe) employeeId: number) {
    return this.custodiesService.hasUnreturnedCustodies(employeeId).then(
      (hasUnreturned) => ({ hasUnreturned }),
    );
  }
}
```

---

### 2.4 Module

**ملف:** `custodies.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { CustodiesController } from './custodies.controller';
import { CustodiesService } from './custodies.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CustodiesController],
  providers: [CustodiesService],
  exports: [CustodiesService], // تصدير للاستخدام في modules أخرى (مثل الاستقالة)
})
export class CustodiesModule {}
```

---

## 3. تسجيل الموديول في AppModule

**الملف:** `apps/users-service/src/app.module.ts`

```typescript
// أضف الاستيراد
import { CustodiesModule } from './custodies/custodies.module';

@Module({
  imports: [
    // ... الموديولات الموجودة
    CustodiesModule,  // أضف هذا
  ],
})
export class AppModule {}
```

---

## 4. تعديل Gateway لتمرير طلبات العهد

**الملف:** `apps/gateway/src/proxy/proxy.module.ts`

### إضافة Proxy Controller للعهد

أنشئ ملف جديد أو أضف في نفس ملف الـ proxy controllers:

```typescript
@Controller('custodies')
export class CustodiesProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  @All()
  forwardRoot(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, 'users');
  }

  @All('*')
  forwardWithPath(@Req() req: Request, @Res() res: Response) {
    return this.proxyService.forward(req, res, 'users');
  }
}
```

ثم سجّل الـ controller في `ProxyModule`:

```typescript
@Module({
  controllers: [
    // ... الموجود
    CustodiesProxyController, // أضف هذا
  ],
})
```

---

## 5. إضافة الصلاحيات

**الملف:** `packages/shared/src/constants/permissions.constants.ts`

```typescript
// أضف ضمن الكائن الرئيسي
CUSTODIES: {
  READ: 'custodies:read',
  CREATE: 'custodies:create',
  UPDATE: 'custodies:update',
  DELETE: 'custodies:delete',
},
```

### تعديل Seed الصلاحيات

**الملف:** `apps/users-service/prisma/seed.ts` (أو ملف الـ migration المناسب)

أضف الصلاحيات الجديدة في seed data:

```typescript
const custodyPermissions = [
  { name: 'custodies:read', displayName: 'عرض العهد', module: 'custodies' },
  { name: 'custodies:create', displayName: 'إنشاء عهدة', module: 'custodies' },
  { name: 'custodies:update', displayName: 'تعديل عهدة', module: 'custodies' },
  { name: 'custodies:delete', displayName: 'حذف عهدة', module: 'custodies' },
];
```

---

## 6. ربط العهدة بالاستقالة (الجزء الأهم)

### الخيار الموصى به: تعديل خدمة الطلبات (Requests Service)

عند تقديم طلب استقالة (RESIGNATION)، يجب التحقق من عدم وجود عهد غير مسلّمة.

**الملف:** `apps/requests/src/requests/requests.service.ts`

في دالة إنشاء الطلب أو تقديمه، أضف التحقق عند نوع RESIGNATION:

```typescript
// عند إنشاء أو تقديم طلب استقالة
if (dto.type === 'RESIGNATION') {
  // استدعاء users-service API للتحقق من العهد
  const response = await this.httpService.axiosRef.get(
    `http://users-service:4002/api/v1/custodies/employee/${employeeId}/check`,
    { headers: { Authorization: req.headers.authorization } }
  );

  if (response.data.data.hasUnreturned) {
    throw new BadRequestException(
      'لا يمكن تقديم طلب استقالة قبل تسليم جميع العهد'
    );
  }
}
```

### بديل: التحقق عند الموافقة على الاستقالة

إذا أردت السماح بتقديم الطلب لكن منع الموافقة:

```typescript
// عند موافقة HR على طلب استقالة
if (request.type === 'RESIGNATION' && action === 'APPROVE') {
  // التحقق من تسليم العهد
  const response = await this.httpService.axiosRef.get(
    `http://users-service:4002/api/v1/custodies/employee/${request.employeeId}/check`,
    { headers: { Authorization: req.headers.authorization } }
  );

  if (response.data.data.hasUnreturned) {
    throw new BadRequestException(
      'لا يمكن الموافقة على الاستقالة - الموظف لديه عهد غير مسلّمة'
    );
  }
}
```

> **ملاحظة:** إذا كان Requests Service لا يستخدم `HttpModule`، يجب إضافته:
> ```typescript
> import { HttpModule } from '@nestjs/axios';
> // في imports الموديول
> HttpModule,
> ```

---

## 7. Database Migration

بعد تعديل الـ schema، شغّل:

```bash
cd apps/users-service
npx prisma migrate dev --name add-custody-model
npx prisma generate
```

---

## 8. الـ API Endpoints النهائية

| Method | Endpoint | الوصف |
|--------|----------|-------|
| `POST` | `/api/v1/custodies` | إنشاء عهدة جديدة |
| `GET` | `/api/v1/custodies` | جلب كل العهد (مع فلترة وتصفح) |
| `GET` | `/api/v1/custodies/:id` | جلب عهدة بالـ ID |
| `PUT` | `/api/v1/custodies/:id` | تعديل بيانات عهدة |
| `PATCH` | `/api/v1/custodies/:id/return` | إرجاع عهدة (تغيير الحالة) |
| `DELETE` | `/api/v1/custodies/:id` | حذف عهدة (soft delete) |
| `GET` | `/api/v1/custodies/employee/:employeeId` | عهد موظف معين |
| `GET` | `/api/v1/custodies/employee/:employeeId/summary` | ملخص عهد الموظف |
| `GET` | `/api/v1/custodies/employee/:employeeId/check` | التحقق من وجود عهد غير مسلّمة |

---

## 9. أمثلة على الطلبات (API Examples)

### إنشاء عهدة

```json
POST /api/v1/custodies
{
  "name": "لابتوب Dell Latitude 5540",
  "description": "لابتوب عمل - رام 16 قيقا - SSD 512",
  "serialNumber": "DL5540-2024-00142",
  "category": "ELECTRONICS",
  "employeeId": 5,
  "assignedDate": "2026-03-26",
  "notes": "مع الشاحن والحقيبة"
}
```

### إرجاع عهدة

```json
PATCH /api/v1/custodies/1/return
{
  "status": "RETURNED",
  "returnedDate": "2026-03-26",
  "notes": "تم الاستلام بحالة جيدة"
}
```

### الإبلاغ عن عهدة مفقودة

```json
PATCH /api/v1/custodies/1/return
{
  "status": "LOST",
  "notes": "فُقد الجهاز أثناء رحلة عمل"
}
```

### جلب عهد موظف مع فلترة

```
GET /api/v1/custodies?employeeId=5&status=WITH_EMPLOYEE&page=1&limit=10
```

---

## 10. ترتيب التنفيذ (خطوة بخطوة)

| # | المهمة | الملف/المجلد |
|---|--------|-------------|
| 1 | إضافة enums و model في Prisma schema | `apps/users-service/prisma/schema.prisma` |
| 2 | إضافة `custodies Custody[]` في Employee model | نفس الملف |
| 3 | تشغيل `prisma migrate dev` | terminal |
| 4 | إنشاء مجلد `custodies/` وملفاته (DTOs, Service, Controller, Module) | `apps/users-service/src/custodies/` |
| 5 | تسجيل `CustodiesModule` في `AppModule` | `apps/users-service/src/app.module.ts` |
| 6 | إضافة صلاحيات العهد في shared | `packages/shared/src/constants/permissions.constants.ts` |
| 7 | إضافة seed للصلاحيات الجديدة | `apps/users-service/prisma/seed.ts` |
| 8 | إضافة Proxy Controller في Gateway | `apps/gateway/src/proxy/` |
| 9 | تسجيل Proxy Controller في ProxyModule | `apps/gateway/src/proxy/proxy.module.ts` |
| 10 | إضافة التحقق من العهد عند الاستقالة | `apps/requests/src/requests/requests.service.ts` |
| 11 | اختبار جميع الـ endpoints | Postman/curl |

---

## 11. ملاحظات مهمة

1. **Soft Delete:** يتبع نفس نمط `EmployeeAttachment` الموجود - حقل `deletedAt` بدلاً من الحذف الفعلي.

2. **الحالات المقترحة:**
   - `WITH_EMPLOYEE` - العهدة مسلّمة للموظف (الحالة الافتراضية)
   - `RETURNED` - تم إرجاعها بنجاح
   - `DAMAGED` - تالفة (يمكن توثيق الضرر في notes)
   - `LOST` - مفقودة (يمكن اتخاذ إجراء إداري)

3. **نقل عهدة بين موظفين:** إذا احتجت هذه الميزة مستقبلاً، أنشئ endpoint `PATCH /custodies/:id/transfer` يقوم بـ:
   - تغيير الحالة إلى RETURNED للموظف الحالي
   - إنشاء سجل جديد للموظف الجديد

4. **التحقق المزدوج:** يُفضّل التحقق من العهد عند **تقديم** طلب الاستقالة **و** عند **الموافقة** عليه (احتياطاً).

5. **لا تعديل على Docker:** لا يحتاج الأمر أي تعديل على `docker-compose.yml` لأن العهد موديول داخل users-service الموجود أصلاً.
