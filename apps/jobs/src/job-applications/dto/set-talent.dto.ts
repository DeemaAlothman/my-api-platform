import { IsBoolean } from 'class-validator';

export class SetTalentDto {
  @IsBoolean()
  isTalent: boolean;
}
