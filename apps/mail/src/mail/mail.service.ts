import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SendMailDto, RecipientType } from './dto/send-mail.dto';
import { SaveDraftDto } from './dto/save-draft.dto';
import { ListMailQueryDto } from './dto/list-mail.query.dto';
import { UpdateReadDto, UpdateStarDto } from './dto/update-read.dto';
import { MoveMailDto, MailFolder } from './dto/move-mail.dto';

const USERS_URL          = process.env.USERS_SERVICE_URL || 'http://localhost:4002';
const INTERNAL_TOKEN     = process.env.INTERNAL_SERVICE_TOKEN || '';

async function internalPost(url: string, body: any): Promise<any> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-token': INTERNAL_TOKEN },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const json = await res.json() as any;
    return json?.data ?? json;
  } catch {
    return null;
  }
}

async function resolveEmployeeIdsToUserIds(
  recipients: Array<{ employeeId: string; type: RecipientType }>,
): Promise<Array<{ userId: string; type: RecipientType }>> {
  const employeeIds = recipients.map(r => r.employeeId);
  const resolved = await internalPost(
    `${USERS_URL}/api/v1/employees/internal/resolve-employee-ids`,
    { employeeIds },
  );
  const mapping: Record<string, string> = {};
  const list: any[] = Array.isArray(resolved) ? resolved : (resolved?.data ?? []);
  for (const item of list) {
    if (item.employeeId && item.userId) mapping[item.employeeId] = item.userId;
  }
  return recipients
    .filter(r => mapping[r.employeeId])
    .map(r => ({ userId: mapping[r.employeeId], type: r.type }));
}

@Injectable()
export class MailService {
  constructor(private readonly prisma: PrismaService) {}

  async send(senderId: string, dto: SendMailDto) {
    // resolve employeeIds → userIds
    let allRecipients = await resolveEmployeeIdsToUserIds(dto.recipients);

    // توسيع departmentIds إلى userIds عبر users-service
    if (dto.departmentIds?.length) {
      const resolved = await internalPost(
        `${USERS_URL}/api/v1/employees/internal/resolve-recipients`,
        { departmentIds: dto.departmentIds, userIds: [], excludeInactive: true },
      );
      if (resolved?.resolvedUserIds?.length) {
        for (const uid of resolved.resolvedUserIds) {
          if (!allRecipients.find((r) => r.userId === uid)) {
            allRecipients.push({ userId: uid, type: RecipientType.TO });
          }
        }
      }
    }

    return this.sendWithUserIds(senderId, allRecipients, {
      subject: dto.subject,
      body: dto.body,
      parentMessageId: dto.parentMessageId,
    });
  }

  private async sendWithUserIds(
    senderId: string,
    allRecipients: Array<{ userId: string; type: RecipientType }>,
    dto: { subject: string; body: string; parentMessageId?: string },
  ) {
    // Append sender signature
    const senderInfo = await internalPost(
      `${USERS_URL}/api/v1/employees/internal/find-by-user-id`,
      { userId: senderId },
    );
    const signature = senderInfo
      ? `\n\n---\n${senderInfo.firstNameAr ?? ''} ${senderInfo.lastNameAr ?? ''}${senderInfo.jobTitle?.nameAr ? '\n' + senderInfo.jobTitle.nameAr : ''}`
      : '';
    const bodyWithSignature = dto.body + signature;

    return this.prisma.$transaction(async (tx) => {
      const toRecipients = allRecipients.filter((r) => r.type === RecipientType.TO);
      if (toRecipients.length === 0) {
        throw new BadRequestException({ code: 'MAIL_NO_TO_RECIPIENT', message: 'At least one TO recipient is required', details: [] });
      }

      const deduped = this.dedupRecipients(allRecipients, senderId);

      const message = await (tx as any).mailMessage.create({
        data: {
          senderId,
          subject: dto.subject,
          body: bodyWithSignature,
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

      // إشعار المستلمين (fire-and-forget — لا يوقف الإرسال عند الفشل)
      const toIds = deduped.filter((r) => r.type === RecipientType.TO).map((r) => r.userId);
      setImmediate(() => {
        for (const recipientId of toIds) {
          internalPost(`${USERS_URL}/api/v1/notifications/internal`, {
            userId: recipientId,
            type: 'INFO',
            titleAr: 'رسالة داخلية جديدة',
            titleEn: 'New Internal Message',
            messageAr: `لديك رسالة جديدة بعنوان: ${dto.subject}`,
            messageEn: `You received a new message: ${dto.subject}`,
            data: { messageId: message.id },
          });
        }
      });

      return message;
    });
  }

  async saveDraft(senderId: string, dto: SaveDraftDto) {
    const resolved = dto.recipients ? await resolveEmployeeIdsToUserIds(dto.recipients) : [];
    const deduped = resolved.length ? this.dedupRecipients(resolved, senderId) : [];

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

    // resolve dto.recipients (employeeIds) to userIds first
    const resolvedDtoRecipients = await resolveEmployeeIdsToUserIds(dto.recipients);

    const existing = new Map<string, RecipientType>();
    for (const r of resolvedDtoRecipients) {
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
    return this.sendWithUserIds(senderId, merged, {
      subject: dto.subject,
      body: dto.body,
      parentMessageId: parentId,
    });
  }

  async getFolder(userId: string, folder: MailFolder, query: ListMailQueryDto) {
    const { page = 1, limit = 20, search, dateFrom, dateTo, archiveFolderId } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      recipientId: userId,
      folder,
      deletedAt: null,
    };

    if (folder === MailFolder.ARCHIVE && archiveFolderId) {
      where.archiveFolderId = archiveFolderId;
    }

    const messageFilter: any = {};
    if (search) {
      messageFilter.OR = [
        { subject: { contains: search, mode: 'insensitive' } },
        { body: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (dateFrom || dateTo) {
      messageFilter.createdAt = {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(dateTo) } : {}),
      };
    }
    if (Object.keys(messageFilter).length > 0) {
      where.message = messageFilter;
    }

    const include = {
      message: {
        include: {
          attachments: { select: { id: true, fileName: true, fileSize: true, mimeType: true } },
        },
      },
    };

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
    const { page = 1, limit = 20, search, dateFrom, dateTo } = query;
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
    if (dateFrom || dateTo) {
      where.createdAt = {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(dateTo) } : {}),
      };
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

  async getThread(userId: string, messageId: string) {
    const message = await (this.prisma as any).mailMessage.findUnique({
      where: { id: messageId },
      select: { id: true, threadRootId: true },
    });
    if (!message) throw new NotFoundException({ code: 'MAIL_NOT_FOUND', message: 'Message not found', details: [] });

    const rootId = message.threadRootId ?? messageId;

    const messages = await (this.prisma as any).mailMessage.findMany({
      where: {
        OR: [{ id: rootId }, { threadRootId: rootId }],
        deletedAt: null,
      },
      include: {
        attachments: { select: { id: true, fileName: true, fileSize: true, mimeType: true } },
        recipients: { where: { type: { not: 'BCC' } } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const messageIds = messages.map((m: any) => m.id);
    await (this.prisma as any).mailRecipient.updateMany({
      where: { messageId: { in: messageIds }, recipientId: userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });

    return messages;
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
    const data: any = { folder: dto.folder };
    if (dto.folder === MailFolder.ARCHIVE && dto.archiveFolderId) {
      data.archiveFolderId = dto.archiveFolderId;
    } else {
      data.archiveFolderId = null;
    }
    await (this.prisma as any).mailRecipient.updateMany({
      where: { messageId: { in: dto.messageIds }, recipientId: userId, deletedAt: null },
      data,
    });
    return { moved: dto.messageIds.length };
  }

  async listArchiveFolders(userId: string) {
    return (this.prisma as any).mailArchiveFolder.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createArchiveFolder(userId: string, name: string) {
    return (this.prisma as any).mailArchiveFolder.create({
      data: { ownerId: userId, name },
    });
  }

  async deleteArchiveFolder(userId: string, folderId: string) {
    const folder = await (this.prisma as any).mailArchiveFolder.findFirst({
      where: { id: folderId, ownerId: userId },
    });
    if (!folder) throw new NotFoundException({ code: 'FOLDER_NOT_FOUND', message: 'Archive folder not found', details: [] });
    await (this.prisma as any).mailRecipient.updateMany({
      where: { archiveFolderId: folderId },
      data: { archiveFolderId: null },
    });
    await (this.prisma as any).mailArchiveFolder.delete({ where: { id: folderId } });
    return { deleted: true };
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

  // B.5.2: Internal system-send — used by auth, jobs cron services
  async systemSend(dto: { recipientUserId: string; subject: string; body: string }) {
    const senderId = process.env.SYSTEM_USER_ID || '00000000-0000-0000-0000-000000000001';

    const message = await (this.prisma as any).mailMessage.create({
      data: {
        senderId,
        subject: dto.subject,
        body: dto.body,
        isDraft: false,
        recipients: {
          create: {
            recipientId: dto.recipientUserId,
            type: RecipientType.TO,
            folder: MailFolder.INBOX,
          },
        },
      },
      include: { recipients: true },
    });

    return { messageId: message.id };
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
