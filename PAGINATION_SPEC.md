# Pagination Implementation Spec

## Pattern المعتمد (مطابق لـ Users Service)

### Query Parameters (نفس الـ DTO في كل مكان)
```
?page=1&limit=10
```
- `page`: integer, min 1, default 1
- `limit`: integer, min 1, max 100, default 10

### Response Shape (نفسها في كل مكان)
```json
{
  "items": [...],
  "page": 1,
  "limit": 10,
  "total": 150,
  "totalPages": 15
}
```

### Prisma Pattern
```ts
const skip = (page - 1) * limit;

const [items, total] = await Promise.all([
  this.prisma.model.findMany({ where, skip, take: limit, orderBy: ... }),
  this.prisma.model.count({ where }),
]);

const totalPages = Math.max(1, Math.ceil(total / limit));
return { items, page, limit, total, totalPages };
```

---

## الملفات اللي تحتاج تعديل

---

## 1. Leave Service — `apps/leave/src/`

### 1.1 Leave Requests

**الملفات:**
- `leave-requests/leave-requests.controller.ts`
- `leave-requests/leave-requests.service.ts`
- `leave-requests/dto/` → أضف ملف `list-leave-requests.query.dto.ts`

**DTO الجديد (`list-leave-requests.query.dto.ts`):**
```ts
export class ListLeaveRequestsQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page: number = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit: number = 10;

  @IsOptional() @IsUUID()
  employeeId?: string;

  @IsOptional() @IsEnum(LeaveRequestStatus)
  status?: LeaveRequestStatus;

  @IsOptional() @IsDateString()
  dateFrom?: string;

  @IsOptional() @IsDateString()
  dateTo?: string;

  @IsOptional() @IsUUID()
  leaveTypeId?: string;
}
```

**Controller — عدّل الـ endpoints:**
```ts
// GET /leave-requests  (HR / Manager)
@Get()
findAll(@Query() query: ListLeaveRequestsQueryDto) {
  return this.leaveRequestsService.findAll(query);
}

// GET /leave-requests/my/requests
@Get('my/requests')
findMyRequests(@EmployeeId() employeeId: string, @Query() query: ListLeaveRequestsQueryDto) {
  return this.leaveRequestsService.findByEmployee(employeeId, query);
}
```

**Service — عدّل `findAll` و `findByEmployee`:**
- أضف `skip/take` بدل `findMany` بدون حدود
- أرجع `{ items, page, limit, total, totalPages }`

---

### 1.2 Holidays

**الملفات:**
- `holidays/holidays.controller.ts`
- `holidays/holidays.service.ts`
- `holidays/dto/` → أضف `list-holidays.query.dto.ts`

**DTO الجديد:**
```ts
export class ListHolidaysQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page: number = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit: number = 10;

  @IsOptional() @Type(() => Number) @IsInt()
  year?: number;

  @IsOptional() @IsString()
  type?: string; // PUBLIC | RELIGIOUS | etc.
}
```

**Controller:**
```ts
@Get()
findAll(@Query() query: ListHolidaysQueryDto) {
  return this.holidaysService.findAll(query);
}
```

> ملاحظة: `/holidays/upcoming/list` يبقى كما هو (limit فقط، بدون page).

---

## 2. Attendance Service — `apps/attendance/src/`

### 2.1 Attendance Records ⚡ (أعلى أولوية)

**الملفات:**
- `attendance-records/attendance-records.controller.ts`
- `attendance-records/attendance-records.service.ts`
- `attendance-records/dto/` → أضف `list-attendance-records.query.dto.ts`

**DTO الجديد:**
```ts
export class ListAttendanceRecordsQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page: number = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit: number = 10;

  @IsOptional() @IsUUID()
  employeeId?: string;

  @IsOptional() @IsDateString()
  dateFrom?: string;

  @IsOptional() @IsDateString()
  dateTo?: string;

  @IsOptional() @IsString()
  status?: string;
}
```

**Controller — عدّل `findAll` و `getMyAttendance`:**
```ts
@Get()
findAll(@Query() query: ListAttendanceRecordsQueryDto) {
  return this.service.findAll(query);
}

@Get('my-attendance')
getMyAttendance(
  @EmployeeId() employeeId: string,
  @Query() query: ListAttendanceRecordsQueryDto,
) {
  return this.service.getMyAttendance(employeeId, query);
}
```

---

### 2.2 Attendance Alerts ⚡ (أعلى أولوية)

**الملفات:**
- `attendance-alerts/attendance-alerts.controller.ts`
- `attendance-alerts/attendance-alerts.service.ts`
- `attendance-alerts/dto/` → أضف `list-attendance-alerts.query.dto.ts`

**DTO الجديد:**
```ts
export class ListAttendanceAlertsQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page: number = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit: number = 10;

  @IsOptional() @IsUUID()
  employeeId?: string;

  @IsOptional() @IsString()
  type?: string;

  @IsOptional() @IsString()
  status?: string;

  @IsOptional() @IsDateString()
  dateFrom?: string;

  @IsOptional() @IsDateString()
  dateTo?: string;
}
```

**Controller:**
```ts
@Get()
findAll(@Query() query: ListAttendanceAlertsQueryDto) {
  return this.service.findAll(query);
}

@Get('my-alerts')
getMyAlerts(@EmployeeId() employeeId: string, @Query() query: ListAttendanceAlertsQueryDto) {
  return this.service.getMyAlerts(employeeId, query);
}
```

---

### 2.3 Attendance Justifications

**الملفات:**
- `attendance-justifications/attendance-justifications.controller.ts`
- `attendance-justifications/attendance-justifications.service.ts`
- `attendance-justifications/dto/` → أضف `list-attendance-justifications.query.dto.ts`

**DTO الجديد:**
```ts
export class ListAttendanceJustificationsQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page: number = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit: number = 10;

  @IsOptional() @IsUUID()
  employeeId?: string;

  @IsOptional() @IsString()
  status?: string;

  @IsOptional() @IsDateString()
  dateFrom?: string;

  @IsOptional() @IsDateString()
  dateTo?: string;
}
```

---

## 3. Evaluation Service — `apps/evaluation/src/`

### 3.1 Evaluation Forms

**الملفات:**
- `evaluation-forms/evaluation-forms.controller.ts`
- `evaluation-forms/evaluation-forms.service.ts`
- `evaluation-forms/dto/` → أضف `list-evaluation-forms.query.dto.ts`

**DTO الجديد:**
```ts
export class ListEvaluationFormsQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page: number = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit: number = 10;

  @IsOptional() @IsUUID()
  periodId?: string;

  @IsOptional() @IsString()
  status?: string;

  @IsOptional() @IsUUID()
  employeeId?: string;
}
```

**Controller:**
```ts
@Get()
@Permissions('evaluation:forms:view-all')
findAll(@User() user: CurrentUser, @Query() query: ListEvaluationFormsQueryDto) {
  return this.formsService.findAll(user, query);
}
```

---

### 3.2 Evaluation Periods

**الملفات:**
- `evaluation-periods/evaluation-periods.controller.ts`
- `evaluation-periods/evaluation-periods.service.ts`

**Query Parameters المضافة فقط:**
```
?page=1&limit=10&status=ACTIVE
```
بيانات محدودة، لكن يفضل توحيد الـ pattern.

---

## ملاحظات للمطور

1. **استخدم نفس الـ DTO base** — ممكن تعمل `BasePaginationDto` في shared أو تكرره بسيط.
2. **`@Type(() => Number)`** ضروري لأن query params بتجي كـ string.
3. **لا تنسى `import { Type } from 'class-transformer'`** في كل DTO.
4. **الـ orderBy الافتراضي:**
   - Records/Alerts: `{ date: 'desc' }` أو `{ createdAt: 'desc' }`
   - Forms/Periods: `{ createdAt: 'desc' }`
5. **لا تغير** الـ endpoints اللي بترجع بيانات محدودة بطبيعتها مثل:
   - `GET /leave-types` (عادةً أقل من 20)
   - `GET /work-schedules` (بيانات ثابتة)
   - `GET /evaluation-criteria`
   - `GET /leave-balances` (مرتبطة بموظف محدد)
