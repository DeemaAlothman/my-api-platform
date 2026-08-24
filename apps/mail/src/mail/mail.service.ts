import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SendMailDto, RecipientType } from './dto/send-mail.dto';
import { SaveDraftDto } from './dto/save-draft.dto';
import { ListMailQueryDto } from './dto/list-mail.query.dto';
import { UpdateReadDto, UpdateStarDto } from './dto/update-read.dto';
import { MoveMailDto, MailFolder } from './dto/move-mail.dto';
import { EditMailDto } from './dto/edit-mail.dto';

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

async function resolveUserIdsToNames(
  userIds: string[],
): Promise<Record<string, { firstNameAr: string; lastNameAr: string; firstNameEn?: string | null; lastNameEn?: string | null; employeeId?: string }>> {
  if (!userIds.length) return {};
  const resolved = await internalPost(
    `${USERS_URL}/api/v1/employees/internal/find-by-user-ids`,
    { userIds },
  );
  const list: any[] = Array.isArray(resolved) ? resolved : (resolved?.data ?? []);
  const map: Record<string, any> = {};
  for (const item of list) {
    if (item.userId) {
      map[item.userId] = {
        firstNameAr: item.firstNameAr,
        lastNameAr: item.lastNameAr,
        firstNameEn: item.firstNameEn,
        lastNameEn: item.lastNameEn,
        employeeId: item.employeeId,
      };
    }
  }
  return map;
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

    if (allRecipients.length === 0 && dto.recipients.length > 0) {
      throw new BadRequestException({
        code: 'RECIPIENTS_NOT_RESOLVED',
        message: 'None of the provided employeeIds could be resolved to users. Make sure each employee has a linked user account.',
        details: dto.recipients.map(r => ({ employeeId: r.employeeId })),
      });
    }

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
      importance: dto.importance,
      attachmentIds: dto.attachmentIds,
    });
  }

  private async sendWithUserIds(
    senderId: string,
    allRecipients: Array<{ userId: string; type: RecipientType }>,
    dto: { subject: string; body: string; parentMessageId?: string; importance?: string; attachmentIds?: string[] },
  ) {
    // Append sender signature
    const senderInfo = await internalPost(
      `${USERS_URL}/api/v1/employees/internal/find-by-user-id`,
      { userId: senderId },
    );
    // أضف التوقيع فقط للرسائل الجديدة — الردود والتحويل ما تحتاجه
    const signature = (!dto.parentMessageId && senderInfo)
      ? `\n\n---\n${senderInfo.firstNameAr ?? ''} ${senderInfo.lastNameAr ?? ''}${senderInfo.jobTitle?.nameAr ? '\n' + senderInfo.jobTitle.nameAr : ''}`
      : '';
    const bodyWithSignature = (dto.body ?? '') + signature;

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
          importance: (dto as any).importance ?? 'NORMAL',
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

      // ربط المرفقات اليتيمة المرفوعة مسبقاً (uploadedBy=senderId, messageId=null)
      if (dto.attachmentIds?.length) {
        await (tx as any).mailAttachment.updateMany({
          where: {
            id: { in: dto.attachmentIds },
            uploadedBy: senderId,
            messageId: null,
          },
          data: { messageId: message.id },
        });
      }

      // إشعار جميع المستلمين TO + CC + BCC (fire-and-forget)
      const notifyIds = deduped.map((r) => r.userId);
      setImmediate(() => {
        for (const recipientId of notifyIds) {
          internalPost(`${USERS_URL}/api/v1/notifications/internal`, {
            userId: recipientId,
            type: 'GENERAL',
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

  async sendInternal(dto: {
    senderId: string;
    recipientUserIds: string[];
    subject: string;
    body: string;
    data?: Record<string, any>;
  }) {
    const unique = [...new Set(dto.recipientUserIds.filter(id => id && id !== dto.senderId))];
    if (unique.length === 0) return null;

    const message = await (this.prisma as any).mailMessage.create({
      data: {
        senderId: dto.senderId,
        subject: dto.subject,
        body: dto.body,
        isDraft: false,
        recipients: {
          createMany: {
            data: unique.map(userId => ({
              recipientId: userId,
              type: RecipientType.TO,
              folder: MailFolder.INBOX,
            })),
          },
        },
      },
    });

    setImmediate(() => {
      for (const userId of unique) {
        internalPost(`${USERS_URL}/api/v1/notifications/internal`, {
          userId,
          type: 'GENERAL',
          titleAr: 'رسالة داخلية جديدة',
          titleEn: 'New Internal Message',
          messageAr: `لديك رسالة جديدة بعنوان: ${dto.subject}`,
          messageEn: `You have a new message: ${dto.subject}`,
          data: { messageId: message.id, ...(dto.data ?? {}) },
        });
      }
    });

    return message;
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

  async forward(senderId: string, originalMessageId: string, dto: SendMailDto) {
    const original = await (this.prisma as any).mailMessage.findUnique({
      where: { id: originalMessageId, deletedAt: null },
    });
    if (!original) {
      throw new NotFoundException({ code: 'MAIL_NOT_FOUND', message: 'Original message not found', details: [] });
    }

    const forwardSubject = original.subject.startsWith('Fwd: ')
      ? original.subject
      : `Fwd: ${original.subject}`;

    const separator = '\n\n---------- رسالة محوَّلة ----------\n';
    const forwardBody = dto.body?.trim()
      ? dto.body + separator + original.body
      : original.body;

    return this.send(senderId, {
      ...dto,
      subject: forwardSubject,
      body: forwardBody,
      parentMessageId: originalMessageId,
    });
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
      if (r.recipientId !== senderId && !existing.has(r.recipientId) && r.type !== RecipientType.BCC) {
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

    // INBOX: عرض محادثات (مبدأ Gmail) — صف واحد لكل محادثة = آخر رسالة، يطلع لفوق مع كل رد جديد
    if (folder === MailFolder.INBOX) {
      const { ids, total } = await this.getConversationRecipientIds(userId, MailFolder.INBOX, { search, dateFrom, dateTo, page, limit });
      const items = await this.fetchAndEnrichInbox(ids);
      return { items, total, page, limit };
    }

    // ARCHIVE / TRASH: عرض مسطّح كالمعتاد
    const skip = (page - 1) * limit;
    const where: any = { recipientId: userId, folder, deletedAt: null };
    if (folder === MailFolder.ARCHIVE && archiveFolderId) where.archiveFolderId = archiveFolderId;

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
    if (Object.keys(messageFilter).length > 0) where.message = messageFilter;

    const include = {
      message: {
        include: {
          attachments: { select: { id: true, fileName: true, fileSize: true, mimeType: true } },
          recipients: { where: { type: { not: 'BCC' } }, select: { recipientId: true, type: true } },
        },
      },
    };

    const [items, total] = await Promise.all([
      (this.prisma as any).mailRecipient.findMany({ where, include, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      (this.prisma as any).mailRecipient.count({ where }),
    ]);

    const senderIds = [...new Set(items.map((i: any) => i.message?.senderId).filter(Boolean))];
    const nameMap = await resolveUserIdsToNames(senderIds as string[]);
    const enriched = items.map((i: any) => ({
      ...i,
      message: i.message ? { ...i.message, senderInfo: nameMap[i.message.senderId] ?? null } : null,
    }));

    return { items: enriched, total, page, limit };
  }

  // معرّفات سجلات المستلِم لعرض المحادثات: صف واحد لكل محادثة = آخر رسالة، مرتّبة بالأحدث (مبدأ Gmail)
  private async getConversationRecipientIds(
    userId: string,
    folder: MailFolder,
    opts: { search?: string; dateFrom?: string; dateTo?: string; page: number; limit: number },
  ): Promise<{ ids: string[]; total: number }> {
    const offset = (opts.page - 1) * opts.limit;
    const conds = [`mr."recipientId" = $1`, `mr.folder::text = $2`, `mr."deletedAt" IS NULL`, `m."deletedAt" IS NULL`];
    const params: any[] = [userId, folder];
    let p = 3;
    if (opts.search) { conds.push(`(m.subject ILIKE $${p} OR m.body ILIKE $${p})`); params.push(`%${opts.search}%`); p++; }
    if (opts.dateFrom) { conds.push(`m."createdAt" >= $${p}`); params.push(new Date(opts.dateFrom)); p++; }
    if (opts.dateTo) { conds.push(`m."createdAt" <= $${p}`); params.push(new Date(opts.dateTo)); p++; }
    const whereSql = conds.join(' AND ');

    const countRows = await (this.prisma as any).$queryRawUnsafe(
      `SELECT COUNT(*)::int AS total FROM (
         SELECT DISTINCT COALESCE(m."threadRootId", m.id) AS troot
         FROM mail.mail_recipients mr JOIN mail.mail_messages m ON m.id = mr."messageId"
         WHERE ${whereSql}
       ) t`,
      ...params,
    );
    const total = Number(countRows?.[0]?.total ?? 0);

    const idRows = await (this.prisma as any).$queryRawUnsafe(
      `SELECT id FROM (
         SELECT DISTINCT ON (COALESCE(m."threadRootId", m.id)) mr.id AS id, m."createdAt" AS cat
         FROM mail.mail_recipients mr JOIN mail.mail_messages m ON m.id = mr."messageId"
         WHERE ${whereSql}
         ORDER BY COALESCE(m."threadRootId", m.id), m."createdAt" DESC
       ) t ORDER BY t.cat DESC LIMIT $${p} OFFSET $${p + 1}`,
      ...params, opts.limit, offset,
    );
    return { ids: (idRows as any[]).map((r) => r.id), total };
  }

  // جلب سجلات الوارد بالترتيب الصحيح + إثراء أسماء المرسِلين
  private async fetchAndEnrichInbox(ids: string[]) {
    if (!ids.length) return [];
    const include = {
      message: {
        include: {
          attachments: { select: { id: true, fileName: true, fileSize: true, mimeType: true } },
          recipients: { where: { type: { not: 'BCC' } }, select: { recipientId: true, type: true } },
        },
      },
    };
    const rows = await (this.prisma as any).mailRecipient.findMany({ where: { id: { in: ids } }, include });
    const byId = new Map(rows.map((r: any) => [r.id, r]));
    const ordered = ids.map((id) => byId.get(id)).filter(Boolean);
    const senderIds = [...new Set(ordered.map((i: any) => i.message?.senderId).filter(Boolean))];
    const nameMap = await resolveUserIdsToNames(senderIds as string[]);
    return ordered.map((i: any) => ({
      ...i,
      message: i.message ? { ...i.message, senderInfo: nameMap[i.message.senderId] ?? null } : null,
    }));
  }

  async getSent(userId: string, query: ListMailQueryDto) {
    const { page = 1, limit = 20, search, dateFrom, dateTo } = query;

    // SENT: عرض محادثات (مبدأ Gmail) — صف واحد لكل محادثة = آخر رسالة، مرتّبة بالأحدث
    const { ids, total } = await this.getConversationRecipientIds(userId, MailFolder.SENT, { search, dateFrom, dateTo, page, limit });
    if (!ids.length) return { items: [], total, page, limit };

    const include = {
      message: {
        include: {
          attachments: { select: { id: true, fileName: true, fileSize: true, mimeType: true } },
          recipients: {
            // استبعد سجل المرسل نفسه (folder=SENT) من قائمة المستقبلين
            where: { type: { not: 'BCC' }, folder: { not: MailFolder.SENT } },
            select: { recipientId: true, type: true },
          },
        },
      },
    };
    const rows = await (this.prisma as any).mailRecipient.findMany({ where: { id: { in: ids } }, include });
    const byId = new Map(rows.map((r: any) => [r.id, r]));
    const ordered = ids.map((id) => byId.get(id)).filter(Boolean);

    // enrich recipient names for the TO list
    const allRecipientIds = [...new Set(
      ordered.flatMap((i: any) => (i.message?.recipients ?? []).map((r: any) => r.recipientId))
    )];
    const nameMap = await resolveUserIdsToNames(allRecipientIds as string[]);
    const enriched = ordered.map((i: any) => ({
      ...i,
      message: i.message ? {
        ...i.message,
        recipients: (i.message.recipients ?? []).map((r: any) => ({
          ...r, employeeInfo: nameMap[r.recipientId] ?? null,
        })),
      } : null,
    }));

    return { items: enriched, total, page, limit };
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
        // التحكم بالوصول على مستوى كل رسالة داخل المحادثة:
        // المستخدم يرى فقط الرسائل التي هو مُرسِلها أو أحد مستقبليها
        AND: [
          {
            OR: [
              { senderId: userId },
              { recipients: { some: { recipientId: userId } } },
            ],
          },
        ],
      },
      include: {
        attachments: { select: { id: true, fileName: true, fileSize: true, mimeType: true } },
        recipients: { where: { type: { not: 'BCC' }, folder: { not: MailFolder.SENT } } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const messageIds = messages.map((m: any) => m.id);
    await (this.prisma as any).mailRecipient.updateMany({
      where: { messageId: { in: messageIds }, recipientId: userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });

    // enrich sender + recipients with employee names
    const userIds = [...new Set(messages.flatMap((m: any) => [
      m.senderId,
      ...(m.recipients ?? []).map((r: any) => r.recipientId),
    ]).filter(Boolean))];
    const nameMap = await resolveUserIdsToNames(userIds as string[]);

    return messages.map((m: any) => ({
      ...m,
      senderInfo: nameMap[m.senderId] ?? null,
      recipients: (m.recipients ?? []).map((r: any) => ({
        ...r, employeeInfo: nameMap[r.recipientId] ?? null,
      })),
    }));
  }

  async getById(userId: string, messageId: string) {
    const recipient = await (this.prisma as any).mailRecipient.findFirst({
      where: { messageId, recipientId: userId, deletedAt: null },
      include: {
        message: {
          include: {
            recipients: { where: { type: { not: 'BCC' }, folder: { not: MailFolder.SENT } } },
            attachments: true,
          },
        },
      },
    });

    let message: any = null;

    if (recipient) {
      if (!recipient.isRead) {
        await (this.prisma as any).mailRecipient.update({
          where: { id: recipient.id },
          data: { isRead: true, readAt: new Date() },
        });
      }
      message = recipient.message;
    } else {
      const sent = await (this.prisma as any).mailMessage.findFirst({
        where: { id: messageId, senderId: userId, deletedAt: null },
        include: {
          recipients: { where: { type: { not: 'BCC' }, folder: { not: MailFolder.SENT } } },
          attachments: true,
        },
      });
      if (!sent) throw new NotFoundException({ code: 'MAIL_NOT_FOUND', message: 'Message not found', details: [] });
      message = sent;
    }

    // enrich sender + recipients with employee names
    const userIds = [
      message.senderId,
      ...(message.recipients ?? []).map((r: any) => r.recipientId),
    ].filter(Boolean);
    const nameMap = await resolveUserIdsToNames([...new Set(userIds)] as string[]);

    const enrichedMessage = {
      ...message,
      senderInfo: nameMap[message.senderId] ?? null,
      recipients: (message.recipients ?? []).map((r: any) => ({
        ...r, employeeInfo: nameMap[r.recipientId] ?? null,
      })),
    };

    return recipient
      ? { ...recipient, message: enrichedMessage, editHistory: enrichedMessage.editHistory ?? [] }
      : enrichedMessage;
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

  async editMessage(userId: string, messageId: string, dto: EditMailDto) {
    if (!dto.subject && !dto.body) {
      throw new BadRequestException({ code: 'EDIT_EMPTY', message: 'يجب تقديم subject أو body للتعديل', details: [] });
    }

    const message = await (this.prisma as any).mailMessage.findUnique({
      where: { id: messageId },
    });

    if (!message || message.deletedAt) {
      throw new NotFoundException({ code: 'MAIL_NOT_FOUND', message: 'Message not found', details: [] });
    }

    if (message.senderId !== userId) {
      throw new ForbiddenException({ code: 'EDIT_FORBIDDEN', message: 'فقط المرسل يمكنه تعديل الرسالة', details: [] });
    }

    if (message.isDraft) {
      throw new BadRequestException({ code: 'EDIT_DRAFT', message: 'المسودات لا تدعم التعديل — استخدم تحديث المسودة', details: [] });
    }

    // جلب اسم المعدِّل من users service
    const editorInfo = await internalPost(
      `${USERS_URL}/api/v1/employees/internal/find-by-user-id`,
      { userId },
    );
    const editorName = editorInfo
      ? `${editorInfo.firstNameAr ?? ''} ${editorInfo.lastNameAr ?? ''}`.trim()
      : userId;

    const currentHistory: any[] = Array.isArray(message.editHistory) ? message.editHistory : [];
    const historyEntry = {
      editedAt: new Date().toISOString(),
      editedByUserId: userId,
      editedByName: editorName,
      previousSubject: message.subject,
      previousBody: message.body,
    };

    const updated = await (this.prisma as any).mailMessage.update({
      where: { id: messageId },
      data: {
        ...(dto.subject ? { subject: dto.subject } : {}),
        ...(dto.body ? { body: dto.body } : {}),
        editHistory: [...currentHistory, historyEntry],
      },
    });

    return updated;
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

    // المرسل لا يستطيع حذف الرسالة المرسلة — فقط التعديل مسموح
    const message = await (this.prisma as any).mailMessage.findFirst({
      where: { id: messageId, senderId: userId },
    });

    if (!message) {
      throw new NotFoundException({ code: 'MAIL_NOT_FOUND', message: 'Message not found', details: [] });
    }

    if (!message.isDraft) {
      throw new ForbiddenException({ code: 'DELETE_SENT_FORBIDDEN', message: 'لا يمكن حذف رسالة مرسلة — يمكنك تعديلها فقط', details: [] });
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

  // جذور المحادثات التي يشارك فيها المستخدم (مُرسِل root له سجل SENT، أو مُستقبِل له سجل INBOX)
  // تُستخدم لطيّ الردود في القوائم: إذا كان المستخدم يملك الجذر، نخفي ردوده/الردود عليه من القائمة
  private async threadRootIdsForUser(userId: string): Promise<string[]> {
    const rows = await (this.prisma as any).mailMessage.findMany({
      where: {
        parentMessageId: null,
        recipients: { some: { recipientId: userId, deletedAt: null } },
      },
      select: { id: true },
    });
    return rows.map((r: any) => r.id);
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
