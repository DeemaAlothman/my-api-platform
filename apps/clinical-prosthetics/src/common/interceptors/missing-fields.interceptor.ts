import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { CasesService } from '../../cases/cases.service';

/**
 * يعيد حساب الحقول الناقصة ويخزّنها بعد كل كتابة ناجحة على حالة.
 *
 * مكان واحد بدل استدعاء التحديث من كل دالة كتابة — نفس منطق CaseWritableGuard.
 * يعمل بعد نجاح العملية فقط، وبصمت: فشل التحديث لا يُفشل الطلب الأصلي، لأن
 * النواقص بيانات مشتقة يعيد السكربت حسابها متى لزم.
 *
 * لا يغطي المسارات التي لا تحمل معرّف الحالة في الرابط (الداخلية، والتي تبدأ
 * من معرّف جلسة) — تُحدَّث هذه بالسكربت أو بأول كتابة لاحقة على الحالة.
 */
@Injectable()
export class MissingFieldsInterceptor implements NestInterceptor {
  constructor(private readonly cases: CasesService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    if (req.method === 'GET') return next.handle();

    const caseId: string | undefined = req.params?.id;
    if (!caseId) return next.handle();

    return next.handle().pipe(
      tap({
        next: () => {
          // بلا await: الاستجابة لا تنتظر إعادة الحساب
          void this.cases.refreshMissingFields(caseId);
        },
      }),
    );
  }
}
