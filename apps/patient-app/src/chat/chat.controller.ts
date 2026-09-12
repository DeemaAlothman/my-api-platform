import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { PatientJwtAuthGuard } from '../patient-auth/guards/patient-jwt-auth.guard';
import { CurrentPatient } from '../patient-auth/decorators/current-patient.decorator';
import { ChatService } from './chat.service';
import { SendMessageDto, ListMessagesQueryDto } from './dto/chat.dto';

// جانب المريض — نص فقط، الطرف المقابل يُحدَّد تلقائياً (المعالج المسؤول)، ما فيه اختيار يدوي
@Controller('patient-app/me/chat')
@UseGuards(PatientJwtAuthGuard)
export class ChatController {
  constructor(private readonly service: ChatService) {}

  @Get()
  async getConversation(@CurrentPatient() patient: { erpPatientId: string }) {
    const conversation = await this.service.getOrCreateActiveConversationForPatient(patient.erpPatientId);
    const messages = await this.service.listMessages(conversation.id);
    return { conversation, messages };
  }

  @Get('messages')
  async listMessages(@CurrentPatient() patient: { erpPatientId: string }, @Query() query: ListMessagesQueryDto) {
    const conversation = await this.service.getOrCreateActiveConversationForPatient(patient.erpPatientId);
    return this.service.listMessages(conversation.id, query.after);
  }

  @Post('messages')
  async sendMessage(@CurrentPatient() patient: { patientAccountId: string; erpPatientId: string }, @Body() dto: SendMessageDto) {
    const conversation = await this.service.getOrCreateActiveConversationForPatient(patient.erpPatientId);
    return this.service.sendMessage(conversation.id, 'PATIENT', patient.patientAccountId, dto.messageText);
  }

  @Post('read')
  async markRead(@CurrentPatient() patient: { erpPatientId: string }) {
    const conversation = await this.service.getOrCreateActiveConversationForPatient(patient.erpPatientId);
    return this.service.markRead(conversation.id, 'PATIENT');
  }
}
