import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export enum WorkLocation {
  SHAHBA = 'SHAHBA',         // شركة شهباء
  CENTER = 'CENTER',         // مركز
  NEW_ALEPPO = 'NEW_ALEPPO', // شركة حلب الجديدة
}

export enum MaintenancePriority {
  URGENT = 'URGENT',   // عاجل
  MEDIUM = 'MEDIUM',   // متوسط
  NORMAL = 'NORMAL',   // عادي
}

export enum RepairOption {
  INTERNAL = 'INTERNAL',                   // يمكن إصلاحه داخلياً
  INTERNAL_PARTS = 'INTERNAL_PARTS',       // داخلياً لكن بحاجة قطع خارجية
  EXTERNAL_WORKSHOP = 'EXTERNAL_WORKSHOP', // تكليف ورشة خارجية
}

// إنشاء طلب صيانة — يعبّيه الموظف مقدّم الطلب
export class CreateMaintenanceDto {
  @IsEnum(WorkLocation)
  workLocation: WorkLocation;

  @IsNotEmpty()
  @IsString()
  assetType: string; // نوع الأصل (نص حر)

  @IsOptional()
  @IsString()
  assetNumber?: string; // رقم الأصل (اختياري)

  @IsOptional()
  @IsString()
  brandModel?: string; // الماركة والموديل (اختياري)

  @IsNotEmpty()
  @IsString()
  faultDescription: string; // وصف العطل

  @IsEnum(MaintenancePriority)
  priority: MaintenancePriority; // مستوى الأولوية
}

// قرار المسؤول اللوجستي
export class LogisticsDecisionDto {
  @IsOptional()
  @IsString()
  situationDescription?: string; // توصيف الحالة (اختياري)

  @IsEnum(RepairOption)
  repairOption: RepairOption;

  @IsNotEmpty()
  @IsString()
  assignedEmployeeId: string; // الموظف المكلَّف بالإصلاح / المشرف على الورشة

  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number; // المبلغ المدفوع (للقطع أو الورشة الخارجية)
}

export class MaintenanceDecisionDto {
  @IsOptional()
  @IsString()
  notes?: string;
}
