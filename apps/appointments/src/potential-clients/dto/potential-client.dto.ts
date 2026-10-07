import {
  IsString, IsOptional, IsEnum, IsInt, Min, IsNotEmpty,
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
}

export class ListPotentialClientsQueryDto extends ExportPotentialClientsQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  limit?: number = 50;
}
