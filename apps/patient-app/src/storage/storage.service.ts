import { Injectable, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

export interface UploadFileParams {
  buffer: Buffer;
  fileName: string;
  contentType: string;
  folder: string;
}

export interface UploadFileResult {
  key: string;
  url: string;
}

// Abstraction حول تخزين الكائنات (S3-compatible) — Backblaze B2 حالياً، قابلة للاستبدال
// بأي مزوّد آخر (AWS S3, Cloudflare R2, MinIO) بدون تعديل أي منطق أعمال يستدعيها.
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private client: S3Client | null = null;
  private clientChecked = false;

  private getClient(): S3Client | null {
    if (this.clientChecked) return this.client;
    this.clientChecked = true;

    const endpoint = process.env.B2_ENDPOINT;
    const region = process.env.B2_REGION;
    const keyId = process.env.B2_KEY_ID;
    const applicationKey = process.env.B2_APPLICATION_KEY;
    if (!endpoint || !region || !keyId || !applicationKey) return null;

    this.client = new S3Client({
      endpoint,
      region,
      credentials: { accessKeyId: keyId, secretAccessKey: applicationKey },
    });
    return this.client;
  }

  isConfigured(): boolean {
    return !!this.getClient() && !!process.env.B2_BUCKET;
  }

  async uploadFile(params: UploadFileParams): Promise<UploadFileResult> {
    const client = this.getClient();
    const bucket = process.env.B2_BUCKET;
    if (!client || !bucket) throw new Error('STORAGE_NOT_CONFIGURED');

    const key = `${params.folder}/${params.fileName}`;
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: params.buffer,
        ContentType: params.contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
    return { key, url: this.getPublicUrl(key) };
  }

  async deleteFile(key: string): Promise<void> {
    const client = this.getClient();
    const bucket = process.env.B2_BUCKET;
    if (!client || !bucket || !key) return;
    try {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    } catch (e: any) {
      // فشل حذف الملف القديم لا يفشّل العملية — يُسجَّل فقط لتنظيفه لاحقاً
      this.logger.warn(`Failed to delete object "${key}" from storage: ${e.message}`);
    }
  }

  getPublicUrl(key: string): string {
    const base = (process.env.B2_PUBLIC_BASE_URL || '').replace(/\/$/, '');
    return `${base}/${key}`;
  }
}
