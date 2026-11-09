import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export enum RewardTypeEnum {
  CASH = 'CASH',
  PAID_LEAVE = 'PAID_LEAVE',
}

export class SetRewardDto {
  @IsString() @IsNotEmpty() company: string;
  @IsEnum(RewardTypeEnum) rewardType: RewardTypeEnum;
  // CASH: المبلغ (افتراضي 50$ حسب المواصفة لو ما انبعت). PAID_LEAVE: عدد الأيام (إجباري،
  // ما في سياسة ثابتة متفق عليها بعد)
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) amount?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) days?: number;
}

export class SetWinnerImageDto {
  @IsString() @IsNotEmpty() company: string;
  @IsString() @IsNotEmpty() imageUrl: string;
}

export class AddCommentDto {
  @IsString() @IsNotEmpty() text: string;
}
