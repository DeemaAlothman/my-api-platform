import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAccountDto {
  @IsUUID() erpPatientId: string;
  @IsString() @MinLength(3) username: string;
  @IsString() @MinLength(6) password: string;
}

// إنشاء تلقائي (خدمة-لخدمة) عند تحويل حالة إلى علاج فيزيائي — اسم المستخدم يُبنى من اسم المريض داخلياً
export class AutoCreateAccountDto {
  @IsUUID() erpPatientId: string;
  @IsString() firstName: string;
  @IsString() lastName: string;
  @IsOptional() @IsString() patientNumber?: string;
}

export class UpdateAccountDto {
  @IsOptional() @IsEnum(['ACTIVE', 'INACTIVE', 'BLOCKED']) status?: 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
  @IsOptional() @IsString() @MinLength(6) password?: string;
}

export class ListAccountsQueryDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsEnum(['ACTIVE', 'INACTIVE', 'BLOCKED']) status?: 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}
