import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SendMailDto, RecipientType } from './dto/send-mail.dto';
import { SaveDraftDto } from './dto/save-draft.dto';
import { ListMailQueryDto } from './dto/list-mail.query.dto';
import { UpdateReadDto, UpdateStarDto } from './dto/update-read.dto';
import { MoveMailDto, MailFolder } from './dto/move-mail.dto';

@Injectable()
export class MailService {
  constructor(private readonly prisma: PrismaService) {}

  async send(senderId: string, dto: SendMailDto) {
    return this.prisma.$transaction(async (tx) => {
      const toRecipients = dto.recipients.filter((r) => r.type === RecipientType.TO);
      if (toRecipients.length === 0) {
        throw new BadRequestException({ code: 'MAIL_NO_TO_RECIPIENT', message: 'At least one TO recipient is required', details: [] });
      }

      const deduped = this.dedupRecipients(dto.recipients, senderId);

      const message = await (tx as any).mailMessage.create({
        data: {
          senderId,
          subject: dto.subject,
          body: dto.body,
          isDraft: false,
          parentMessageId: dto.parentMessageId ?? null,
          threadRootId: dto.parentMessageId
            ? await this.resolveThreadRoot(tx, dto.parentMessageId)
            : undefined,
          recipients: {
            createMany: {
              data: deduped.map((r) => ({
                recipientId: r.userId,
                type: r.type,
                folder: MailFolder.INBOX,
              })),
            },
          },
        },
        include: { recipients: true },
      });

      await (tx as any).mailRecipient.create({
        data: {
          messageId: message.id,
          recipientId: senderId,
          type: RecipientType.TO,
          folder: MailFolder.SENT,
          isRead: true,
          readAt: new Date(),
        },
      }).catch(() => {});

      return message;
    });
  }

  async saveDraft(senderId: string, dto: SaveDraftDto) {
    const deduped = dto.recipients ? this.dedupRecipients(dto.recipients, senderId) : [];

    const message = await (this.prisma as any).mailMessage.create({
      data: {
        senderId,
        subject: dto.subject ?? '',
        body: dto.body ?? '',
        isDraft: true,
        recipients: deduped.length > 0
          ? {
              createMany: {
                data: deduped.map((r) => ({
                  recipientId: r.userId,
                  type: r.type,
                  folder: MailFolder.DRAFTS,
                })),
              },
            }
          : undefined,
      },
      include: { recipients: true },
    });

    return message;
  }

  async reply(senderId: string, parentId: string, dto: SendMailDto) {
    const parent = await (this.prisma as any).mailMessage.findUnique({ where: { id: parentId } });
    if (!parent) throw new NotFoundException({ code: 'MAIL_NOT_FOUND', message: 'Parent message not found', details: [] });

    return this.send(senderId, { ...dto, parentMessageId: parentId });
  }

  async replyAll(senderId: string, parentId: string, dto: SendMailDto) {
    const parent = await (this.prisma as any).mailMessage.findUnique({
      where: { id: parentId },
      include: { recipients: true },
    });
    if (!parent) throw new NotFoundException({ code: 'MAIL_NOT_FOUND', message: 'Parent message not found', details: [] });

    const existing = new Map<string, RecipientType>();
    for (const r of dto.recipients) {
      existing.set(r.userId, r.type);
    }

    if (!existing.has(parent.senderId) && parent.senderId !== senderId) {
      existing.set(parent.senderId, RecipientType.TO);
    }

    for (const r of parent.recipients) {
      if (r.recipientId !== senderId && !existing.has(r.recipientId)) {
        existing.set(r.recipientId, RecipientType.CC);
      }
    }

    const merged = Array.from(existing.entries()).map(([userId, type]) => ({ userId, type }));
    return this.send(senderId, { ...dto, recipients: merged, parentMessageId: parentId });
  }

  async getFolder(userId: string, folder: MailFolder, query: ListMailQueryDto) {
    const { page = 1, limit = 20, search } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      recipientId: userId,
      folder,
      deletedAt: null,
    };

    const include = {
      message: {
        include: {
          attachments: { select: { id: true, fileName: true, fileSize: true, mimeType: true } },
        },
      },
    };

    if (search) {
      where.message = {
        OR: [
          { subject: { contains: search, mode: 'insensitive' } },
          { body: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    const [items, total] = await Promise.all([
      (this.prisma as any).mailRecipient.findMany({
        where,
        include,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      (this.prisma as any).mailRecipient.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async getSent(userId: string, query: ListMailQueryDto) {
    const { page = 1, limit = 20, search } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      senderId: userId,
      isDraft: false,
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        { subject: { contains: search, mode: 'insensitive' } },
        { body: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      (this.prisma as any).mailMessage.findMany({
        where,
        include: {
          recipients: { where: { folder: MailFolder.SENT } },
          attachments: { select: { id: true, fileName: true, fileSize: true, mimeType: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      (this.prisma as any).mailMessage.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async getDrafts(userId: string, query: ListMailQueryDto) {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where = { senderId: userId, isDraft: true, deletedAt: null };

    const [items, total] = await Promise.all([
      (this.prisma as any).mailMessage.findMany({
        where,
        include: { recipients: true },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      (this.prisma as any).mailMessage.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async getById(userId: string, messageId: string) {
    const recipient = await (this.prisma as any).mailRecipient.findFirst({
      where: { messageId, recipientId: userId, deletedAt: null },
      include: {
        message: {
          include: {
            recipients: {
              where: { type: { not: 'BCC' } },
            },
            attachments: true,
          },
        },
      },
    });

    if (recipient) {
      if (!recipient.isRead) {
        await (this.prisma as any).mailRecipient.update({
          where: { id: recipient.id },
          data: { isRead: true, readAt: new Date() },
        });
      }
      return { ...recipient, message: recipient.message };
    }

    const sent = await (this.prisma as any).mailMessage.findFirst({
      where: { id: messageId, senderId: userId, deletedAt: null },
      include: {
        recipients: {
          where: { type: { not: 'BCC' } },
        },
        attachments: true,
      },
    });

    if (!sent) {
      throw new NotFoundException({ code: 'MAIL_NOT_FOUND', message: 'Message not found', details: [] });
    }
    return sent;
  }

  async updateRead(userId: string, dto: UpdateReadDto) {
    await (this.prisma as any).mailRecipient.updateMany({
      where: { messageId: { in: dto.messageIds }, recipientId: userId, deletedAt: null },
      data: dto.isRead
        ? { isRead: true, readAt: new Date() }
        : { isRead: false, readAt: null },
    });
    return { updated: dto.messageIds.length };
  }

  async updateStar(userId: string, dto: UpdateStarDto) {
    await (this.prisma as any).mailRecipient.updateMany({
      where: { messageId: { in: dto.messageIds }, recipientId: userId, deletedAt: null },
      data: { isStarred: dto.isStarred },
    });
    return { updated: dto.messageIds.length };
  }

  async move(userId: string, dto: MoveMailDto) {
    await (this.prisma as any).mailRecipient.updateMany({
      where: { messageId: { in: dto.messageIds }, recipientId: userId, deletedAt: null },
      data: { folder: dto.folder },
    });
    return { moved: dto.messageIds.length };
  }

  async deleteMessage(userId: string, messageId: string) {
    const recipient = await (this.prisma as any).mailRecipient.findFirst({
      where: { messageId, recipientId: userId, deletedAt: null },
    });

    if (recipient) {
      if (recipient.folder === MailFolder.TRASH) {
        await (this.prisma as any).mailRecipient.update({
          where: { id: recipient.id },
          data: { deletedAt: new Date() },
        });
      } else {
        await (this.prisma as any).mailRecipient.update({
          where: { id: recipient.id },
          data: { folder: MailFolder.TRASH },
        });
      }
      return { deleted: true };
    }

    const message = await (this.prisma as any).mailMessage.findFirst({
      where: { id: messageId, senderId: userId },
    });

    if (!message) {
      throw new NotFoundException({ code: 'MAIL_NOT_FOUND', message: 'Message not found', details: [] });
    }

    await (this.prisma as any).mailMessage.update({
      where: { id: messageId },
      data: { deletedAt: new Date() },
    });

    return { deleted: true };
  }

  private dedupRecipients(recipients: Array<{ userId: string; type: RecipientType }>, senderId: string) {
    const seen = new Set<string>();
    const result: Array<{ userId: string; type: RecipientType }> = [];
    for (const r of recipients) {
      if (!seen.has(r.userId) && r.userId !== senderId) {
        seen.add(r.userId);
        result.push(r);
      }
    }
    return result;
  }

  private async resolveThreadRoot(tx: any, parentMessageId: string): Promise<string> {
    const parent = await (tx as any).mailMessage.findUnique({
      where: { id: parentMessageId },
      select: { threadRootId: true, id: true },
    });
    return parent?.threadRootId ?? parent?.id ?? parentMessageId;
  }
}
