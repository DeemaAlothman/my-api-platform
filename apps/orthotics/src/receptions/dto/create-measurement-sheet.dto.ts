import { IsString, IsOptional, IsObject, IsIn } from 'class-validator';

// sheet: BELOW_KNEE | FULL_LEG | FOOT_ACCESSORIES — يحدد أي رسمة استُخدمت
// side: RIGHT | LEFT
// values: المفتاح اسم الخانة بالرسمة (مثل circ_01، len_03)، القيمة نص كما كُتب بالضبط
export class CreateMeasurementSheetDto {
  @IsIn(['BELOW_KNEE', 'FULL_LEG', 'FOOT_ACCESSORIES'])
  sheet: string;

  @IsIn(['RIGHT', 'LEFT'])
  side: string;

  @IsOptional() @IsString() notes?: string;

  @IsObject()
  values: Record<string, string>;
}
