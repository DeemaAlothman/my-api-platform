/**
 * تنظيف نص الرسالة وتوليد سطر المعاينة.
 *
 * التنظيف يجري **عند الحفظ** لا عند العرض: الواجهة تنظّف أيضاً، لكن أي عميل آخر
 * (تطبيق، سكربت، استدعاء مباشر) يتجاوز تنظيف الواجهة، فما يصل قاعدة البيانات
 * يجب أن يكون نظيفاً بذاته.
 *
 * هذا ليس محلّل HTML كاملاً — هو إزالة محافِظة للعناصر الخطرة المعروفة. يبقى
 * تنظيف الواجهة عند العرض طبقة ثانية مطلوبة، لا بديلاً عنها.
 */

/** الحد الأقصى لطول نص الرسالة بعد التنظيف (محارف). صورة 2MB تصير ~2.7MB بـbase64. */
export const MAX_BODY_CHARS = 10_000_000;

/** طول سطر المعاينة في القوائم. */
const PREVIEW_CHARS = 150;

/**
 * يزيل الوسوم القادرة على تنفيذ كود أو تسريب بيانات، مع إبقاء التنسيق
 * (ألوان، جداول، روابط، صور مضمّنة) كما هو.
 */
export function sanitizeMailHtml(html: string | null | undefined): string {
  if (!html) return '';
  let out = String(html);

  // وسوم تُزال بمحتواها كاملاً
  for (const tag of ['script', 'iframe', 'object', 'embed', 'style', 'link', 'meta', 'base', 'form']) {
    out = out.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, 'gi'), '');
    // النسخة ذاتية الإغلاق أو غير المغلقة
    out = out.replace(new RegExp(`<\\/?${tag}\\b[^>]*>`, 'gi'), '');
  }

  // معالِجات الأحداث: onclick= onerror= onload= ... بأي نوع اقتباس أو بدونه
  out = out.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '');
  out = out.replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '');
  out = out.replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '');

  // روابط التنفيذ: javascript: و vbscript: و data:text/html — مع تجاهل المسافات
  // والمحارف الصفرية التي تُستعمل للتحايل (java\0script:)
  out = out.replace(
    /(href|src|xlink:href|action|formaction)\s*=\s*(["']?)\s*(?:java|vb)[\s\u0000- ]*script[\s\u0000- ]*:/gi,
    '$1=$2#',
  );
  out = out.replace(
    /(href|src)\s*=\s*(["']?)\s*data[\s\u0000- ]*:[\s]*text\/html/gi,
    '$1=$2#',
  );

  // srcdoc على iframe أُزيل أصلاً، لكن قد يرد على وسم آخر
  out = out.replace(/\ssrcdoc\s*=\s*(["'])[\s\S]*?\1/gi, '');

  return out;
}

/** يتحقق من الحجم بعد التنظيف. يرمي النص الجاهز للاستعمال في الخطأ. */
export function assertBodyWithinLimit(body: string): void {
  if (body.length > MAX_BODY_CHARS) {
    throw new Error(
      `حجم نص الرسالة ${(body.length / 1_000_000).toFixed(1)}MB يتجاوز الحد المسموح ` +
      `${MAX_BODY_CHARS / 1_000_000}MB — قلّلي عدد الصور المضمّنة أو حجمها`,
    );
  }
}

/**
 * سطر المعاينة: نص خالص بلا وسوم ولا صور ولا مسافات مكرّرة.
 *
 * تُحذف الصور المضمّنة قبل نزع الوسوم، وإلا بقي من `<img src="data:...">` آلافُ
 * المحارف نصاً خاماً في المعاينة.
 */
export function makePreview(html: string | null | undefined, max = PREVIEW_CHARS): string {
  if (!html) return '';
  let text = String(html);

  // الصور والوسوم ذات المحتوى المشفَّر تُزال كاملة أولاً
  text = text.replace(/<img\b[^>]*>/gi, ' ');
  text = text.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ');

  // فواصل الأسطر تصير مسافات حتى لا تلتصق الكلمات
  text = text.replace(/<(br|\/p|\/div|\/tr|\/li|\/h[1-6])\s*\/?>/gi, ' ');
  text = text.replace(/<[^>]+>/g, '');

  // كيانات HTML الشائعة
  text = text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'");

  text = text.replace(/\s+/g, ' ').trim();

  return text.length > max ? text.slice(0, max).trimEnd() + '…' : text;
}
