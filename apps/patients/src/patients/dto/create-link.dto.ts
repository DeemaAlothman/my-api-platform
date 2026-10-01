import { IsString, IsUrl, IsNotEmpty } from 'class-validator';

export class CreateLinkDto {
  @IsString() @IsNotEmpty() title: string;
  @IsUrl({ require_tld: false }) url: string;
}
