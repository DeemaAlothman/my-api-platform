import { PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateInterviewPositionDto } from './create-interview-position.dto';

export enum PositionStatus { OPEN = 'OPEN', CLOSED = 'CLOSED', SUSPENDED = 'SUSPENDED' }

export class UpdateInterviewPositionDto extends PartialType(CreateInterviewPositionDto) {
  @ApiPropertyOptional({ enum: PositionStatus })
  @IsOptional()
  @IsEnum(PositionStatus)
  status?: PositionStatus;
}
