import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { MailService } from './mail.service';
import { SendMailDto } from './dto/send-mail.dto';
import { SaveDraftDto } from './dto/save-draft.dto';
import { ListMailQueryDto } from './dto/list-mail.query.dto';
import { UpdateReadDto, UpdateStarDto } from './dto/update-read.dto';
import { MoveMailDto, MailFolder } from './dto/move-mail.dto';
import { JwtAuthGuard } from '@shared/auth';
import { PermissionsGuard } from '@shared';
import { Permission } from '@shared';
import { User } from '@shared/auth';

@ApiTags('mail')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('mail')
export class MailController {
  constructor(private readonly mailService: MailService) {}

  @Post('send')
  @Permission('mail:send')
  send(@User() user: any, @Body() dto: SendMailDto) {
    return this.mailService.send(user.userId, dto);
  }

  @Post('draft')
  @Permission('mail:draft')
  saveDraft(@User() user: any, @Body() dto: SaveDraftDto) {
    return this.mailService.saveDraft(user.userId, dto);
  }

  @Post(':id/reply')
  @Permission('mail:send')
  reply(@User() user: any, @Param('id') id: string, @Body() dto: SendMailDto) {
    return this.mailService.reply(user.userId, id, dto);
  }

  @Post(':id/reply-all')
  @Permission('mail:send')
  replyAll(@User() user: any, @Param('id') id: string, @Body() dto: SendMailDto) {
    return this.mailService.replyAll(user.userId, id, dto);
  }

  @Get('inbox')
  @Permission('mail:read_own')
  getInbox(@User() user: any, @Query() query: ListMailQueryDto) {
    return this.mailService.getFolder(user.userId, MailFolder.INBOX, query);
  }

  @Get('sent')
  @Permission('mail:read_own')
  getSent(@User() user: any, @Query() query: ListMailQueryDto) {
    return this.mailService.getSent(user.userId, query);
  }

  @Get('drafts')
  @Permission('mail:draft')
  getDrafts(@User() user: any, @Query() query: ListMailQueryDto) {
    return this.mailService.getDrafts(user.userId, query);
  }

  @Get('archive')
  @Permission('mail:read_own')
  getArchive(@User() user: any, @Query() query: ListMailQueryDto) {
    return this.mailService.getFolder(user.userId, MailFolder.ARCHIVE, query);
  }

  @Get('trash')
  @Permission('mail:read_own')
  getTrash(@User() user: any, @Query() query: ListMailQueryDto) {
    return this.mailService.getFolder(user.userId, MailFolder.TRASH, query);
  }

  @Get(':id')
  @Permission('mail:read_own')
  getById(@User() user: any, @Param('id') id: string) {
    return this.mailService.getById(user.userId, id);
  }

  @Patch('read')
  @Permission('mail:update')
  updateRead(@User() user: any, @Body() dto: UpdateReadDto) {
    return this.mailService.updateRead(user.userId, dto);
  }

  @Patch('star')
  @Permission('mail:update')
  updateStar(@User() user: any, @Body() dto: UpdateStarDto) {
    return this.mailService.updateStar(user.userId, dto);
  }

  @Patch('move')
  @Permission('mail:update')
  move(@User() user: any, @Body() dto: MoveMailDto) {
    return this.mailService.move(user.userId, dto);
  }

  @Delete(':id')
  @Permission('mail:delete')
  delete(@User() user: any, @Param('id') id: string) {
    return this.mailService.deleteMessage(user.userId, id);
  }
}
