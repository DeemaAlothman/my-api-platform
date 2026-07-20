import { PartialType } from '@nestjs/mapped-types';
import { CreateReceptionDto } from './create-reception.dto';

export class UpdateReceptionDto extends PartialType(CreateReceptionDto) {}
