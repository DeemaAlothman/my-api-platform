import {
  IsString, IsOptional, IsEnum, IsInt, Min, IsNotEmpty, Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { GenderEnum, ArrivalMethodEnum } from '../../waiting-list/dto/waiting-list.dto';

export class CreatePotentialClientDto {
  @IsString() @IsNotEmpty()
  patientName: string;

  @IsEnum(GenderEnum)
  gender: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  age?: number;

  @IsOptional() @IsEnum(ArrivalMethodEnum)
  arrivalMethod?: string;

  @IsString() @IsNotEmpty()
  interestedService: string;

  @IsString() @IsNotEmpty()
  contactNumber: string;

  @IsOptional() @IsString()
  notes?: string;
}

export class UpdatePotentialClientDto {
  @IsOptional() @IsString() @IsNotEmpty()
  patientName?: string;

  @IsOptional() @IsEnum(GenderEnum)
  gender?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  age?: number;

  @IsOptional() @IsEnum(ArrivalMethodEnum)
  arrivalMethod?: string;

  @IsOptional() @IsString() @IsNotEmpty()
  interestedService?: string;

  @IsOptional() @IsString() @IsNotEmpty()
  contactNumber?: string;

  @IsOptional() @IsString()
  notes?: string;
}

export class ExportPotentialClientsQueryDto {
  /** مطابقة كاملة للخدمة المهتم بها */
  @IsOptional() @IsString()
  interestedService?: string;

  /** بحث جزئي بالاسم / رقم التواصل / الخدمة */
  @IsOptional() @IsString()
  search?: string;

  /** من تاريخ التسجيل (YYYY-MM-DD، بداية اليوم بتوقيت سوريا) */
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dateFrom يجب أن يكون بصيغة YYYY-MM-DD' })
  dateFrom?: string;

  /** إلى تاريخ التسجيل (YYYY-MM-DD، شاملاً آخر اليوم بتوقيت سوريا) */
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dateTo يجب أن يكون بصيغة YYYY-MM-DD' })
  dateTo?: string;
}

export class ListPotentialClientsQueryDto extends ExportPotentialClientsQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  limit?: number = 50;
}
