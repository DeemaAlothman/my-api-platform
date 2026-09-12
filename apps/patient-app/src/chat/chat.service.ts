import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ErpClientService } from '../integrations/erp-client.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly erp: ErpClientService,
    private readonly notifications: NotificationsService,
  ) {}

  // المريض لا يختار معالجه — الطرف المقابل هو المعالج المسؤول الحالي من ERP (بند 11 بالتوصيف)
  async getOrCreateActiveConversationForPatient(erpPatientId: string) {
    const responsible = await this.erp.getResponsibleTherapist(erpPatientId);
    if (!responsible.exists || !responsible.erpTherapistId) {
      throw new NotFoundException({ code: 'NO_RESPONSIBLE_THERAPIST', message: 'لا يوجد معالج مسؤول عنك حالياً' });
    }

    const existing = await this.prisma.chatConversation.findFirst({
      where: { erpPatientId, active: true },
    });

    if (existing && existing.erpTherapistId === responsible.erpTherapistId) {
      return existing;
    }

    // تغيّر المعالج المسؤول (أو لا يوجد محادثة سابقة) — القديمة تبقى محفوظة (active=false)، محادثة جديدة مع الحالي
    if (existing) {
      await this.prisma.chatConversation.update({ where: { id: existing.id }, data: { active: false } });
    }

    return this.prisma.chatConversation.create({
      data: { erpPatientId, erpTherapistId: responsible.erpTherapistId, active: true },
    });
  }

  private async mustLoadConversation(id: string) {
    const conversation = await this.prisma.chatConversation.findUnique({ where: { id } });
    if (!conversation) throw new NotFoundException({ code: 'CONVERSATION_NOT_FOUND', message: 'المحادثة غير موجودة' });
    return conversation;
  }

  async assertPatientOwnsConversation(conversationId: string, erpPatientId: string) {
    const conversation = await this.mustLoadConversation(conversationId);
    if (conversation.erpPatientId !== erpPatientId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'لا يمكنك الوصول لهذه المحادثة' });
    }
    return conversation;
  }

  async assertTherapistOwnsConversation(conversationId: string, erpTherapistId: string) {
    const conversation = await this.mustLoadConversation(conversationId);
    if (conversation.erpTherapistId !== erpTherapistId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'هذه المحادثة ليست ضمن مرضاك' });
    }
    return conversation;
  }

  async listMessages(conversationId: string, after?: string) {
    return this.prisma.chatMessage.findMany({
      where: {
        conversationId,
        ...(after ? { sentAt: { gt: new Date(after) } } : {}),
      },
      orderBy: { sentAt: 'asc' },
      take: 200,
    });
  }

  async sendMessage(conversationId: string, senderType: 'PATIENT' | 'THERAPIST', senderId: string, messageText: string) {
    const [message, conversation] = await this.prisma.$transaction([
      this.prisma.chatMessage.create({
        data: { conversationId, senderType, senderId, messageText },
      }),
      this.prisma.chatConversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } }),
    ]);

    // إشعار المريض عند رسالة جديدة من المعالج (بند 11 بالتوصيف) — best-effort
    if (senderType === 'THERAPIST') {
      this.notifications
        .notifyByErpPatientId(
          conversation.erpPatientId,
          'NEW_CHAT_MESSAGE',
          'رسالة جديدة من معالجك',
          'New message from your therapist',
          messageText.length > 100 ? messageText.slice(0, 100) + '…' : messageText,
          messageText.length > 100 ? messageText.slice(0, 100) + '…' : messageText,
        )
        .catch(() => {});
    }

    return message;
  }

  // تعليم رسائل الطرف الآخر كمقروءة
  async markRead(conversationId: string, readerType: 'PATIENT' | 'THERAPIST') {
    const otherSide = readerType === 'PATIENT' ? 'THERAPIST' : 'PATIENT';
    await this.prisma.chatMessage.updateMany({
      where: { conversationId, senderType: otherSide as any, readAt: null },
      data: { readAt: new Date() },
    });
    return { marked: true };
  }

  // قائمة محادثات المعالج (staff-facing) — بمرضاه المسندين فقط
  async listConversationsForTherapist(erpTherapistId: string) {
    return this.prisma.chatConversation.findMany({
      where: { erpTherapistId, active: true },
      orderBy: { updatedAt: 'desc' },
    });
  }
}
