import { IsString, IsOptional, IsNumber, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateOfferDto {
  @ApiProperty() @IsNumber() @Type(() => Number) basicSalary: number;
  @ApiPropertyOptional() @IsOptional() @IsString() currency?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() startDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() expiresAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() benefits?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}
