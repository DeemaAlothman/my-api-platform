import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { JwtAuthGuard, User } from '@shared/auth';

@UseGuards(JwtAuthGuard)
@Controller('podiatry/receptions/:receptionId/sessions')
export class SessionsController {
  constructor(private readonly service: SessionsService) {}

  @Post()
  create(@Param('receptionId') receptionId: string, @Body() dto: CreateSessionDto, @User() user: any) {
    return this.service.create(receptionId, dto, user.userId);
  }

  @Get()
  findAll(@Param('receptionId') receptionId: string) {
    return this.service.findAll(receptionId);
  }

  @Get(':sessionId')
  findOne(@Param('receptionId') receptionId: string, @Param('sessionId') sessionId: string) {
    return this.service.findOne(receptionId, sessionId);
  }

  @Patch(':sessionId')
  update(
    @Param('receptionId') receptionId: string,
    @Param('sessionId') sessionId: string,
    @Body() dto: UpdateSessionDto,
  ) {
    return this.service.update(receptionId, sessionId, dto);
  }

  @Delete(':sessionId')
  remove(@Param('receptionId') receptionId: string, @Param('sessionId') sessionId: string) {
    return this.service.remove(receptionId, sessionId);
  }
}
