import { PartialType } from '@nestjs/mapped-types';
import { CreateAttendanceAlertDto } from './create-attendance-alert.dto';

export class UpdateAttendanceAlertDto extends PartialType(CreateAttendanceAlertDto) {}
