import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@shared/auth';
import { PermissionsGuard } from '@shared/guards/permissions.guard';
import { Permission } from '@shared/decorators/permission.decorator';
import { PERMISSIONS } from '@shared/constants/permissions.constants';
import { User } from '@shared/auth/decorators/current-user.decorator';
import { ChatService } from './chat.service';
import { SendMessageDto, ListMessagesQueryDto } from './dto/chat.dto';

// جانب المعالج (staff) — بمرضاه المسندين فقط (erpTherapistId = userId المعالج نفسه)
@Controller('patient-app/chat')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ChatStaffController {
  constructor(private readonly service: ChatService) {}

  @Get('conversations')
  @Permission(PERMISSIONS.CLINIC_PATIENT_APP.CHAT_USE)
  listConversations(@User() user: any) {
    return this.service.listConversationsForTherapist(user.userId);
  }

  @Get('conversations/:id/messages')
  @Permission(PERMISSIONS.CLINIC_PATIENT_APP.CHAT_USE)
  async listMessages(@Param('id') id: string, @Query() query: ListMessagesQueryDto, @User() user: any) {
    await this.service.assertTherapistOwnsConversation(id, user.userId);
    return this.service.listMessages(id, query.after);
  }

  @Post('conversations/:id/messages')
  @Permission(PERMISSIONS.CLINIC_PATIENT_APP.CHAT_USE)
  async sendMessage(@Param('id') id: string, @Body() dto: SendMessageDto, @User() user: any) {
    await this.service.assertTherapistOwnsConversation(id, user.userId);
    return this.service.sendMessage(id, 'THERAPIST', user.userId, dto.messageText);
  }

  @Post('conversations/:id/read')
  @Permission(PERMISSIONS.CLINIC_PATIENT_APP.CHAT_USE)
  async markRead(@Param('id') id: string, @User() user: any) {
    await this.service.assertTherapistOwnsConversation(id, user.userId);
    return this.service.markRead(id, 'THERAPIST');
  }
}
