import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST || 'smtp.hostinger.com',
      port: Number(process.env.MAIL_PORT) || 465,
      secure: process.env.MAIL_SECURE !== 'false',
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });
  }

  async sendRejectionEmail(candidate: { firstNameAr: string; lastNameAr: string; email: string }, jobTitle: string) {
    if (!process.env.MAIL_USER || !process.env.MAIL_PASS) {
      this.logger.warn('Mail credentials not configured — skipping rejection email');
      return;
    }

    const candidateName = `${candidate.firstNameAr} ${candidate.lastNameAr}`;
    const from = process.env.MAIL_FROM || `"فريق الموارد البشرية - فيتاكسير" <${process.env.MAIL_USER}>`;

    try {
      await this.transporter.sendMail({
        from,
        to: candidate.email,
        subject: `نتيجة طلب التوظيف - ${jobTitle}`,
        html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; line-height: 1.8;">
            <p>السيد/ السيدة ${candidateName}،</p>
            <p>السلام عليكم ورحمة الله وبركاته،</p>
            <p>نشكركم على تخصيص وقتكم للمشاركة في مقابلة التقديم للوظيفة [${jobTitle}] في شركة فيتاكسير.</p>
            <p>لقد كان من دواعي سرورنا التعرف على خبراتكم وإنجازاتكم المتميزة.</p>
            <p>نقدر عالياً المستوى الاحترافي الذي أبديتموه خلال المقابلة، ولكن بعد دراسة متأنية من قبل فريقنا، نأسف لإعلامكم بأننا قد قررنا المضي قدماً مع مرشح آخر تتطابق خبراته بشكل أكبر مع متطلبات المرحلة الحالية للمنصب.</p>
            <p>هذا القرار لم يكن سهلاً، ونود التأكيد على أننا نتمنى لكم كل النجاح والتوفيق في مسيرتكم المهنية. سنحتفظ بسيرتكم الذاتية في قاعدة بياناتنا للوظائف المستقبلية التي قد تتناسب مع مهاراتكم المميزة.</p>
            <p>شاكرين لكم حسن تعاونكم وتفهمكم.</p>
            <br/>
            <p>مع خالص التحية والتقدير،<br/>فريق الموارد البشرية<br/>شركة فيتاكسير</p>
          </div>
        `,
      });
      this.logger.log(`Rejection email sent to ${candidate.email}`);
    } catch (err) {
      this.logger.error(`Failed to send rejection email to ${candidate.email}: ${(err as any)?.message}`);
    }
  }
}
