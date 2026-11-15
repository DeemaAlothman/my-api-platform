import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as QRCode from 'qrcode';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pino = require('pino');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');

// مجلد جلسة تسجيل الدخول (رمز QR) — لازم يكون مسار دائم (volume)، وإلا كل إعادة نشر
// بتحتاج مسح QR من جديد. المسار جاي من ARG/env، صفر قيمة افتراضية جوا الحاوية فقط
const AUTH_DIR = process.env.WHATSAPP_AUTH_DIR || path.join(process.cwd(), 'wa-auth');

@Injectable()
export class BaileysClientService implements OnModuleInit {
  private readonly logger = new Logger(BaileysClientService.name);
  private sock: any = null;
  private currentQrDataUrl: string | null = null;
  private connected = false;

  async onModuleInit() {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
    await this.connect();
  }

  private async connect() {
    try {
      const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
      const { version } = await fetchLatestBaileysVersion();

      this.sock = makeWASocket({
        auth: state,
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
      });

      this.sock.ev.on('creds.update', saveCreds);

      this.sock.ev.on('connection.update', async (update: any) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
          try {
            this.currentQrDataUrl = await QRCode.toDataURL(qr);
          } catch (err) {
            this.logger.error(`QR encode failed: ${(err as any)?.message}`);
          }
        }
        if (connection === 'open') {
          this.connected = true;
          this.currentQrDataUrl = null;
          this.logger.log('WhatsApp connected');
        }
        if (connection === 'close') {
          this.connected = false;
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const loggedOut = statusCode === DisconnectReason.loggedOut;
          this.logger.warn(`WhatsApp connection closed (loggedOut=${loggedOut}) — ${lastDisconnect?.error?.message ?? ''}`);
          if (!loggedOut) {
            await this.connect(); // انقطاع مؤقت — أعد الاتصال بنفس الجلسة
          }
          // لو سجّل خروج فعلياً، لازم مسح يدوي للمجلد + إعادة تشغيل الخدمة لمسح QR من جديد
        }
      });
    } catch (err) {
      this.logger.error(`WhatsApp connect failed: ${(err as any)?.message}`);
    }
  }

  getStatus() {
    return { connected: this.connected, hasQrPending: !!this.currentQrDataUrl };
  }

  getQrDataUrl(): string | null {
    return this.currentQrDataUrl;
  }

  // بيحوّل أي رقم مخزَّن (بأي صيغة) لصيغة JID المطلوبة من واتساب — بياخد الأرقام بس
  private toJid(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    return `${digits}@s.whatsapp.net`;
  }

  async sendText(phone: string, text: string): Promise<void> {
    if (!this.sock || !this.connected) {
      throw new Error('WhatsApp غير متصل حالياً');
    }
    await this.sock.sendMessage(this.toJid(phone), { text });
  }

  // فصل الرقم الحالي ومسح جلسته — بيحتاج مسح QR جديد بعدها. ما بيلمس أي بيانات
  // بقاعدة البيانات، بس ملفات جلسة واتساب المحلية (wa-auth)
  async logout(): Promise<void> {
    try {
      await this.sock?.logout();
    } catch {
      /* تجاهل — الهدف الأساسي مسح الجلسة المحلية بكل الأحوال */
    }
    this.connected = false;
    this.currentQrDataUrl = null;
    fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    fs.mkdirSync(AUTH_DIR, { recursive: true });
    await this.connect();
  }
}
