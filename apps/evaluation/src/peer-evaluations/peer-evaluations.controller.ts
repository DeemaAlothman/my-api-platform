import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { PeerEvaluationsService } from './peer-evaluations.service';
import { CreatePeerEvaluationDto } from './dto/create-peer-evaluation.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { User } from '../common/decorators/current-user.decorator';
import { CurrentUser } from '../common/interfaces/user.interface';

@Controller('peer-evaluations')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PeerEvaluationsController {
  constructor(
    private readonly peerEvaluationsService: PeerEvaluationsService,
  ) {}

  @Post('forms/:formId/peer')
  create(
    @Param('formId') formId: string,
    @Body() dto: CreatePeerEvaluationDto,
    @User() user: CurrentUser,
  ) {
    return this.peerEvaluationsService.create(formId, dto, user);
  }

  @Get('forms/:formId/peers')
  findByForm(@Param('formId') formId: string, @User() user: CurrentUser) {
    return this.peerEvaluationsService.findByForm(formId, user);
  }
}
