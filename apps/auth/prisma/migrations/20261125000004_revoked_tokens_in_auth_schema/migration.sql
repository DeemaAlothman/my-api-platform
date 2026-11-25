-- قائمةُ التوكنات الملغاة يقرؤها حارسُ التوكن في المكتبة المشتركة باسمٍ مؤهَّلٍ
-- بسكيما auth، في كل خدمةٍ وعند كل طلب. وترحيلُ إنشائها كتب الجدولَ بلا تأهيل،
-- فيسكن سكيما رابطِ الخدمة — وهي users — فيكتب أحدُهما حيث لا يقرأ الآخر.
-- يُثبَّت الجدولُ هنا في سكيماه التي يُقرأ منها، صراحةً. الموجودُ يبقى بسطوره
-- كما هو: كلُّ عبارةٍ هنا لا تفعل شيئاً إن كان موضوعُها قائماً.
CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.revoked_tokens (
    "id"        TEXT         NOT NULL,
    "jti"       TEXT         NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revoked_tokens_pkey" PRIMARY KEY ("id")
);

-- يعتمد عليه ON CONFLICT عند إلغاء توكنٍ أُلغي من قبل، ويُسرِّع فحصَ كل طلب
CREATE UNIQUE INDEX IF NOT EXISTS "revoked_tokens_jti_key"
  ON auth.revoked_tokens ("jti");

-- الجدولُ التوأمُ في سكيما users لم يُقرأ منه قطُّ ولا سطرَ فيه، ويُترَك كما هو:
-- حذفُ جدولٍ لا يَلزَمُ حذفُه ليس من عمل هذا الترحيل.
