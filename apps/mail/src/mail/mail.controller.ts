import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { MailService } from './mail.service';
import { SendMailDto } from './dto/send-mail.dto';
import { SaveDraftDto } from './dto/save-draft.dto';
import { ListMailQueryDto } from './dto/list-mail.query.dto';
import { UpdateReadDto, UpdateStarDto } from './dto/update-read.dto';
import { MoveMailDto, MailFolder } from './dto/move-mail.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permission } from '../common/decorators/permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('mail')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('mail')
export class MailController {
  constructor(private readonly mailService: MailService) {}

  // B.5.2: Internal endpoint — only callable with INTERNAL_SERVICE_TOKEN header
  @Post('internal/system-send')
  systemSend(
    @Headers('x-internal-token') token: string,
    @Body() dto: { recipientUserId: string; subject: string; body: string },
  ) {
    if (!token || token !== process.env.INTERNAL_SERVICE_TOKEN) {
      throw new UnauthorizedException('Invalid internal token');
    }
    return this.mailService.systemSend(dto);
  }

  @Post('send')
  @Permission('mail:send')
  send(@CurrentUser() user: any, @Body() dto: SendMailDto) {
    return this.mailService.send(user.userId, dto);
  }

  @Post('draft')
  @Permission('mail:draft')
  saveDraft(@CurrentUser() user: any, @Body() dto: SaveDraftDto) {
    return this.mailService.saveDraft(user.userId, dto);
  }

  @Post(':id/reply')
  @Permission('mail:send')
  reply(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: SendMailDto) {
    return this.mailService.reply(user.userId, id, dto);
  }

  @Post(':id/reply-all')
  @Permission('mail:send')
  replyAll(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: SendMailDto) {
    return this.mailService.replyAll(user.userId, id, dto);
  }

  @Get('inbox')
  @Permission('mail:read_own')
  getInbox(@CurrentUser() user: any, @Query() query: ListMailQueryDto) {
    return this.mailService.getFolder(user.userId, MailFolder.INBOX, query);
  }

  @Get('sent')
  @Permission('mail:read_own')
  getSent(@CurrentUser() user: any, @Query() query: ListMailQueryDto) {
    return this.mailService.getSent(user.userId, query);
  }

  @Get('drafts')
  @Permission('mail:draft')
  getDrafts(@CurrentUser() user: any, @Query() query: ListMailQueryDto) {
    return this.mailService.getDrafts(user.userId, query);
  }

  @Get('archive')
  @Permission('mail:read_own')
  getArchive(@CurrentUser() user: any, @Query() query: ListMailQueryDto) {
    return this.mailService.getFolder(user.userId, MailFolder.ARCHIVE, query);
  }

  @Get('trash')
  @Permission('mail:read_own')
  getTrash(@CurrentUser() user: any, @Query() query: ListMailQueryDto) {
    return this.mailService.getFolder(user.userId, MailFolder.TRASH, query);
  }

  @Get(':id')
  @Permission('mail:read_own')
  getById(@CurrentUser() user: any, @Param('id') id: string) {
    return this.mailService.getById(user.userId, id);
  }

  @Patch('read')
  @Permission('mail:update')
  updateRead(@CurrentUser() user: any, @Body() dto: UpdateReadDto) {
    return this.mailService.updateRead(user.userId, dto);
  }

  @Patch('star')
  @Permission('mail:update')
  updateStar(@CurrentUser() user: any, @Body() dto: UpdateStarDto) {
    return this.mailService.updateStar(user.userId, dto);
  }

  @Patch('move')
  @Permission('mail:update')
  move(@CurrentUser() user: any, @Body() dto: MoveMailDto) {
    return this.mailService.move(user.userId, dto);
  }

  @Delete(':id')
  @Permission('mail:delete')
  delete(@CurrentUser() user: any, @Param('id') id: string) {
    return this.mailService.deleteMessage(user.userId, id);
  }
}
