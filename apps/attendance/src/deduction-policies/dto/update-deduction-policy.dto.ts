import { PartialType } from '@nestjs/mapped-types';
import { CreateDeductionPolicyDto } from './create-deduction-policy.dto';
import { IsOptional, IsBoolean } from 'class-validator';

export class UpdateDeductionPolicyDto extends PartialType(CreateDeductionPolicyDto) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
