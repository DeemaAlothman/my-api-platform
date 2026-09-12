import { Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';

let firebaseApp: admin.app.App | null = null;

function getFirebaseApp(): admin.app.App | null {
  if (firebaseApp) return firebaseApp;
  const json = process.env.FCM_SERVICE_ACCOUNT_JSON;
  if (!json) return null;
  try {
    const credentials = JSON.parse(json);
    firebaseApp = admin.initializeApp({ credential: admin.credential.cert(credentials) }, 'patient-app');
    return firebaseApp;
  } catch {
    return null;
  }
}

// إرسال Push فعلي عبر Firebase Cloud Messaging (FCM). يعتمد على FCM_SERVICE_ACCOUNT_JSON
// (محتوى ملف Service Account JSON كسطر واحد) — إن لم يُضبط، تُسجَّل المحاولة فقط بدون إرسال فعلي
// (لا يفشل أي طلب بسبب ذلك — الإشعار يبقى مرئياً بقائمة إشعارات التطبيق دائماً).
@Injectable()
export class PushSenderService {
  private readonly logger = new Logger(PushSenderService.name);

  isConfigured(): boolean {
    return !!getFirebaseApp();
  }

  async send(tokens: string[], titleAr: string, bodyAr: string, data?: Record<string, string>): Promise<boolean> {
    if (tokens.length === 0) return false;

    const app = getFirebaseApp();
    if (!app) {
      this.logger.debug(`[push disabled - no FCM credentials] would notify ${tokens.length} device(s): ${titleAr}`);
      return false;
    }

    try {
      const response = await admin.messaging(app).sendEachForMulticast({
        tokens,
        notification: { title: titleAr, body: bodyAr },
        data,
      });
      if (response.failureCount > 0) {
        response.responses.forEach((r, i) => {
          if (!r.success) this.logger.warn(`Push failed for token ${tokens[i].slice(0, 12)}...: ${r.error?.message}`);
        });
      }
      return response.successCount > 0;
    } catch (e: any) {
      this.logger.error(`FCM send failed: ${e.message}`);
      return false;
    }
  }
}
