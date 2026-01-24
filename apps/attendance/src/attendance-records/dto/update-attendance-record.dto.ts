import { PartialType } from '@nestjs/mapped-types';
import { CreateAttendanceRecordDto } from './create-attendance-record.dto';

export class UpdateAttendanceRecordDto extends PartialType(CreateAttendanceRecordDto) {}
