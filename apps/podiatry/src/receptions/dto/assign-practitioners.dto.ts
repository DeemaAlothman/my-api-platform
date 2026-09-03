import { IsArray, IsString } from 'class-validator';

export class AssignPractitionersDto {
  @IsArray()
  @IsString({ each: true })
  practitionerIds: string[];
}
