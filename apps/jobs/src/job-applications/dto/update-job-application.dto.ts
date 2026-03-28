import { IsString, IsOptional, IsNumber, IsIn, Min, Max, ValidateIf } from 'class-validator';

export class UpdateJobApplicationDto {
  @IsString()
  @IsIn(['PENDING', 'INTERVIEW_READY', 'ACCEPTED', 'REJECTED', 'HIRED'])
  status: string;

  @IsOptional()
  @IsString()
  reviewNotes?: string;

  /** إجباري عند REJECTED */
  @ValidateIf((o) => o.status === 'REJECTED')
  @IsString({ message: 'rejectionNote مطلوب عند الرفض' })
  rejectionNote?: string;

  /** إجباري عند ACCEPTED - قيمة بين 1-5 */
  @ValidateIf((o) => o.status === 'ACCEPTED')
  @IsNumber({}, { message: 'rating مطلوب عند القبول' })
  @Min(1)
  @Max(5)
  rating?: number;
}
