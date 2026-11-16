import { CanActivate, ExecutionContext, Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * يمنع أي كتابة على حالة تم تسليمها (DELIVERED).
 *
 * حارس واحد على المتحكم بدل تكرار الشرط في عشرات الدوال: كل طلب غير GET يحمل
 * معرّف حالة في المسار يُفحص هنا قبل أن يصل إلى الخدمة. الاستثناء الوحيد هو
 * الحالة المُعاد فتحها (isReopened = true)، وتبقى مفتوحة حتى يُعاد قفلها.
 *
 * ما لا يغطيه الحارس: المسارات التي لا تحمل معرّف الحالة في الرابط (المسارات
 * الداخلية خدمة-لخدمة، والمسارات التي تبدأ من معرّف جلسة). هذه تبقى على سلوكها.
 */
@Injectable()
export class CaseWritableGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  // مسارات تعمل على حالة مسلَّمة عمداً — فتح القفل وإعادته
  private static readonly ALWAYS_ALLOWED = /\/(reopen|relock)$/;

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    if (req.method === 'GET') return true;
    if (CaseWritableGuard.ALWAYS_ALLOWED.test(req.path ?? '')) return true;

    const caseId: string | undefined = req.params?.id;
    if (!caseId) return true;

    const found = await this.prisma.prostheticsCase.findFirst({
      where: { id: caseId, deletedAt: null },
      select: { status: true, isReopened: true },
    });
    // الحالة غير الموجودة تُترك للخدمة لترمي 404 برسالتها المعتادة
    if (!found) return true;

    if (found.status === 'DELIVERED' && !found.isReopened) {
      throw new BadRequestException({
        code: 'CASE_DELIVERED_LOCKED',
        message: 'الحالة مسلَّمة ولا يمكن التعديل عليها — أعد فتحها أولاً لاستكمال النواقص',
      });
    }
    return true;
  }
}
