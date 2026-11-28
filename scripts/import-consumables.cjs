#!/usr/bin/env node
/*
 * استيراد جرد المواد المستهلكة من ملف Excel إلى خدمة المستودع.
 *
 * يُشغَّل من جهاز المستخدمة لا من الخادم: الملفُ عندها، فلا يُنقَل ولا يُلصَق
 * منه سطرٌ واحد. ويُنادي الواجهةَ العامة، فيَسلك كلُّ إنشاءٍ منطقَ الخدمة نفسَه
 * (توليد الـSKU، وحركةَ المخزون، وتحديثَ الرصيد) لا كتابةً مباشرةً في الجداول.
 *
 * يبدأ بجولةٍ جافّة: يطبع ما سيُنشئه ولا يُنشئ شيئاً. وبـ--apply يُنفِّذ،
 * ويتوقّف عند أول فشلٍ بدل أن يُكمل نصفَه.
 *
 *   node scripts/import-consumables.cjs "<مسار الملف>"            جولة جافّة
 *   node scripts/import-consumables.cjs "<مسار الملف>" --apply    تنفيذ
 */

const path = require('path');
const readline = require('readline');
const ExcelJS = require(path.join(__dirname, '..', 'node_modules', 'exceljs'));

const BASE = process.env.VITAXIR_BASE || 'https://system.vitaxirpro.com';
const FILE = process.argv[2];
const APPLY = process.argv.includes('--apply');

// المستودعان كما قُرِّر: مكانان منفصلان لكلٍّ رفوفُه، فيُجرَد كلٌّ على حِدة
const WAREHOUSE_CODES = {
  'مستودع البطاريات': 'WH-BATT',
  'مستودع المنظفات بالجنينة': 'WH-CLEAN',
};

// «أكياس» و«كيس» وحدةٌ واحدة بصيغتين
const UNIT_ALIASES = { 'أكياس': 'كيس' };

// «بدون ماركة» مكتوبةً في خانة الماركة تعني أن لا ماركةَ لها، فالخانةُ تُترَك
// فارغةً ولا يُلحَق النصُّ بالاسم: «محارم تنشيف — بدون ماركة» ليس اسماً لشيء.
const BLANK = new Set(['', '-', '—', 'لا', 'بدون', 'بدون ماركة', 'بلا ماركة']);
const isBlank = (v) => !v || BLANK.has(v.trim());

// المسافاتُ الداخلية تُوحَّد كما في بقية النظام: حقلٌ حُفظ بمسافةٍ زائدة يُنتِج
// اسماً بمسافتين فلا يُطابِق ما يُكتَب على وجهه
const norm = (v) => String(v ?? '').trim().replace(/\s+/g, ' ');

function cellText(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map((t) => t.text).join('').trim();
    if (v.text !== undefined) return String(v.text).trim();
    if (v.result !== undefined) return String(v.result).trim();
    return '';
  }
  return String(v).trim();
}

// ── قراءة الملف ────────────────────────────────────────────────────────────

async function readRows(file) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const ws = wb.worksheets[0];
  const rows = [];
  ws.eachRow({ includeEmpty: false }, (row, n) => {
    if (n === 1) return; // ترويسة
    const c = (i) => cellText(row.getCell(i).value);
    const name = norm(c(2));
    if (!name) return; // أسطرٌ فارغة تماماً في آخر الملف
    const variantRaw = norm(c(3));
    const unitRaw = norm(c(6));
    const supplierRaw = norm(c(7));
    const qtyRaw = norm(c(5));
    rows.push({
      excelRow: n,
      name,
      variant: isBlank(variantRaw) ? null : variantRaw,
      category: norm(c(4)) || null,
      quantity: isBlank(qtyRaw) || isNaN(Number(qtyRaw)) ? null : Number(qtyRaw),
      unit: UNIT_ALIASES[unitRaw] || unitRaw || null,
      supplier: isBlank(supplierRaw) ? null : supplierRaw,
      place: norm(c(9)) || null,
    });
  });
  return rows;
}

// الماركةُ تُضَم للاسم ليُقرأ في القوائم، وتبقى في حقلها فيُفرَز عليها.
// بغير الضمِّ تتشابه أربعةٌ وعشرون اسماً فتندمج ويضيع ثلاثةَ عشرَ صنفاً.
const finalName = (r) => (r.variant ? `${r.name} — ${r.variant}` : r.name);

// ── الواجهة ────────────────────────────────────────────────────────────────

let TOKEN = null;

async function api(method, pathname, body) {
  const res = await fetch(`${BASE}/api/v1${pathname}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* نصٌّ ليس JSON */ }
  if (!res.ok) {
    const msg = json?.message || json?.error?.message || text.slice(0, 300) || res.statusText;
    const err = new Error(`${method} ${pathname} → ${res.status}: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`);
    err.status = res.status;
    throw err;
  }
  return json?.data !== undefined ? json.data : json;
}

// الردُّ قد يكون مصفوفةً أو مغلَّفاً بـitems — يُقرأ الشكلان
const asList = (d) => (Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : []);

function ask(question, hidden = false) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (!hidden) return rl.question(question, (a) => { rl.close(); resolve(a.trim()); });
    // الإدخالُ المخفيُّ لا يُطبَع ولا يُحفَظ في سجل الأوامر
    process.stdout.write(question);
    const onData = (ch) => {
      const s = ch.toString();
      if (s === '\r' || s === '\n') {
        process.stdin.setRawMode(false);
        process.stdin.removeListener('data', onData);
        process.stdout.write('\n');
        rl.close();
        resolve(buf);
      } else if (s === '\u0003') { process.exit(1); }
      else if (s === '\u007f' || s === '\b') { buf = buf.slice(0, -1); }
      else { buf += s; }
    };
    let buf = '';
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', onData);
  });
}

async function login() {
  if (process.env.VITAXIR_TOKEN) { TOKEN = process.env.VITAXIR_TOKEN; return '(توكن من البيئة)'; }
  const username = await ask('اسم المستخدم: ');
  const password = await ask('كلمة المرور (مخفية): ', true);
  const data = await api('POST', '/auth/login', { username, password });
  TOKEN = data.accessToken;
  if (!TOKEN) throw new Error('الدخول نجح لكن ما رجع توكن');
  return data.user?.fullName || username;
}

// ── الخطة ──────────────────────────────────────────────────────────────────

async function buildPlan(rows) {
  const [units, categories, suppliers, warehouses, items] = await Promise.all([
    api('GET', '/warehouse/units').then(asList),
    api('GET', '/warehouse/categories').then(asList),
    api('GET', '/warehouse/suppliers').then(asList),
    api('GET', '/warehouse/warehouses').then(asList),
    // قائمةُ الأصناف غيرُ مُرقَّمةِ الصفحات فترجع كاملةً — وعليها يقوم تخطّي
    // ما أُنشئ عند إعادة التشغيل بعد فشل
    api('GET', '/warehouse/items').then(asList),
  ]);

  const byName = (list, key = 'name') => {
    const m = new Map();
    for (const x of list) if (x?.[key]) m.set(norm(x[key]), x);
    return m;
  };

  // الأصنافُ تُطابَق بالاسمين كليهما: الكتالوجُ القائم مُسمّى بالإنكليزية بلا اسمٍ
  // عربي، فالمطابقةُ بالعربيِّ وحدَه تُرِي الجدولَ فارغاً. وعلى هذه المطابقةِ يقوم
  // تخطّي ما أُنشئ عند إعادة التشغيل، فلا يُنشَأ صنفٌ مرتين — والجدولُ لا يَمنع
  // تكرارَ الاسم من نفسه.
  const itemsByAnyName = new Map();
  for (const x of items) {
    for (const k of [x?.nameAr, x?.name]) if (k) itemsByAnyName.set(norm(k), x);
  }
  const existing = {
    units: byName(units),
    categories: byName(categories),
    suppliers: byName(suppliers),
    warehouses: byName(warehouses),
    items: itemsByAnyName,
    itemsFetched: items.length,
  };

  const need = { units: new Set(), categories: new Set(), suppliers: new Set(), warehouses: new Set() };
  for (const r of rows) {
    if (r.unit && !existing.units.has(r.unit)) need.units.add(r.unit);
    if (r.category && !existing.categories.has(r.category)) need.categories.add(r.category);
    if (r.supplier && !existing.suppliers.has(r.supplier)) need.suppliers.add(r.supplier);
    if (r.place && !existing.warehouses.has(r.place)) need.warehouses.add(r.place);
  }

  const itemsToCreate = [];
  const itemsExisting = [];
  for (const r of rows) {
    const nm = finalName(r);
    (existing.items.has(norm(nm)) ? itemsExisting : itemsToCreate).push({ ...r, finalName: nm });
  }

  return { existing, need, itemsToCreate, itemsExisting, rows };
}

// ── الطباعة ────────────────────────────────────────────────────────────────

function printPlan(plan) {
  const { existing, need, itemsToCreate, itemsExisting, rows } = plan;
  const line = (n = 78) => console.log('─'.repeat(n));

  console.log('\n════════ ما هو موجود في النظام الآن ════════');
  console.log(`  الوحدات    : ${[...existing.units.keys()].join(' · ') || '(لا شيء)'}`);
  console.log(`  التصنيفات  : ${[...existing.categories.keys()].join(' · ') || '(لا شيء)'}`);
  console.log(`  الموردون   : ${[...existing.suppliers.keys()].join(' · ') || '(لا شيء)'}`);
  console.log(`  المستودعات : ${[...existing.warehouses.keys()].join(' · ') || '(لا شيء)'}`);
  console.log(`  الأصناف    : ${existing.itemsFetched} صنفاً مسجَّلاً (منها ${existing.items.size} باسمٍ يُطابَق)`);

  console.log('\n════════ ما سيُنشأ ════════');
  for (const [label, set] of [
    ['وحدات', need.units], ['تصنيفات', need.categories],
    ['موردين', need.suppliers], ['مستودعات', need.warehouses],
  ]) {
    console.log(`  ${String(set.size).padStart(3)} ${label}: ${[...set].join(' · ') || '—'}`);
  }
  console.log(`  ${String(itemsToCreate.length).padStart(3)} صنفاً جديداً`);
  const withQty = itemsToCreate.filter((r) => r.quantity !== null && r.quantity > 0);
  console.log(`  ${String(withQty.length).padStart(3)} حركة إدخال كمية`);
  if (itemsExisting.length) {
    console.log(`\n  ⚠️  ${itemsExisting.length} صنفاً موجودٌ بنفس الاسم فسيُتخطّى:`);
    for (const r of itemsExisting) console.log(`      سطر ${r.excelRow}: ${r.finalName}`);
  }

  console.log('\n════════ الأصناف بأسمائها النهائية ════════');
  line();
  console.log('سطر | الاسم النهائي                        | الماركة    | التصنيف  | الكمية  | المستودع');
  line();
  for (const r of itemsToCreate) {
    const qty = r.quantity === null ? '— بلا' : `${r.quantity} ${r.unit}`;
    console.log(
      String(r.excelRow).padStart(3) + ' | ' +
      r.finalName.padEnd(36).slice(0, 36) + ' | ' +
      String(r.variant ?? '—').padEnd(10).slice(0, 10) + ' | ' +
      String(r.category ?? '—').padEnd(8).slice(0, 8) + ' | ' +
      qty.padEnd(7).slice(0, 7) + ' | ' +
      String(r.place ?? '—'),
    );
  }
  line();

  const noQty = itemsToCreate.filter((r) => r.quantity === null);
  if (noQty.length) {
    console.log(`\n  ${noQty.length} صنفاً بلا كمية — يُنشَأ الصنفُ ولا تُسجَّل له حركة، فرصيدُه صفر:`);
    for (const r of noQty) console.log(`      سطر ${r.excelRow}: ${r.finalName}`);
  }
  const noSupplier = itemsToCreate.filter((r) => !r.supplier);
  console.log(`\n  ${noSupplier.length} صنفاً بلا مورّد — تبقى الخانة فارغة، لا يُخترَع شيء`);
  const noBrand = itemsToCreate.filter((r) => !r.variant);
  console.log(`  ${noBrand.length} صنفاً بلا ماركة — يبقى الاسم كما هو بلا إضافة`);
  console.log(`\n  إجمالي أسطر الملف المقروءة: ${rows.length}`);
}

// ── التنفيذ ────────────────────────────────────────────────────────────────

async function apply(plan) {
  const { existing, need, itemsToCreate } = plan;
  let created = { units: 0, categories: 0, suppliers: 0, warehouses: 0, items: 0, movements: 0 };

  console.log('\n════════ التنفيذ ════════\n');

  for (const name of need.units) {
    const u = await api('POST', '/warehouse/units', { name });
    existing.units.set(norm(name), u);
    created.units++;
    console.log(`  ✓ وحدة: ${name}`);
  }
  for (const name of need.categories) {
    // name إجباري ولا تُتاح ترجمةٌ إنكليزية، فيُكتَب العربيُّ فيهما كما في الصفِّ القائم
    const c = await api('POST', '/warehouse/categories', { name, nameAr: name });
    existing.categories.set(norm(name), c);
    created.categories++;
    console.log(`  ✓ تصنيف: ${name}`);
  }
  for (const name of need.suppliers) {
    const s = await api('POST', '/warehouse/suppliers', { name });
    existing.suppliers.set(norm(name), s);
    created.suppliers++;
    console.log(`  ✓ مورّد: ${name}`);
  }
  for (const name of need.warehouses) {
    const code = WAREHOUSE_CODES[name];
    if (!code) throw new Error(`ما في رمز معرَّف للمستودع «${name}» — أضفه في WAREHOUSE_CODES`);
    const w = await api('POST', '/warehouse/warehouses', { code, name, type: 'OTHER' });
    existing.warehouses.set(norm(name), w);
    created.warehouses++;
    console.log(`  ✓ مستودع: ${name} (${code})`);
  }

  console.log('');
  for (const r of itemsToCreate) {
    const unit = r.unit ? existing.units.get(norm(r.unit)) : null;
    if (!unit) throw new Error(`سطر ${r.excelRow}: ما لقيت الوحدة «${r.unit}»`);
    const body = {
      nameAr: r.finalName,
      unitId: unit.id,
      ...(r.variant ? { brand: r.variant } : {}),
      ...(r.category && existing.categories.get(norm(r.category))
        ? { categoryId: existing.categories.get(norm(r.category)).id } : {}),
      ...(r.supplier && existing.suppliers.get(norm(r.supplier))
        ? { supplierId: existing.suppliers.get(norm(r.supplier)).id } : {}),
    };
    const item = await api('POST', '/warehouse/items', body);
    created.items++;

    if (r.quantity !== null && r.quantity > 0) {
      const wh = existing.warehouses.get(norm(r.place));
      if (!wh) throw new Error(`سطر ${r.excelRow}: ما لقيت المستودع «${r.place}»`);
      // رقمُ السطر يُحفَظ في الحركة، فيبقى الجردُ على النظام مطابَقاً للملف سطراً بسطر
      await api('POST', '/warehouse/stock/adjust', {
        warehouseId: wh.id,
        itemId: item.id,
        direction: 'IN',
        quantity: r.quantity,
        notes: `رصيد افتتاحي — جرد المواد المستهلكة، سطر ${r.excelRow}`,
      });
      created.movements++;
      console.log(`  ✓ ${String(r.excelRow).padStart(3)} ${r.finalName} — ${r.quantity} ${r.unit} → ${r.place}`);
    } else {
      console.log(`  ✓ ${String(r.excelRow).padStart(3)} ${r.finalName} — بلا كمية`);
    }
  }

  console.log('\n════════ الحصيلة ════════');
  console.log(`  وحدات: ${created.units} · تصنيفات: ${created.categories} · موردون: ${created.suppliers} · مستودعات: ${created.warehouses}`);
  console.log(`  أصناف: ${created.items} · حركات إدخال: ${created.movements}`);
}

// ── المسار الرئيسي ─────────────────────────────────────────────────────────

(async () => {
  if (!FILE) {
    console.error('الاستعمال: node scripts/import-consumables.cjs "<مسار ملف الإكسل>" [--apply]');
    process.exit(1);
  }
  const rows = await readRows(FILE);
  console.log(`قُرئ من الملف: ${rows.length} سطراً`);

  const who = await login();
  console.log(`الدخول: ${who}`);

  const plan = await buildPlan(rows);
  printPlan(plan);

  if (!APPLY) {
    console.log('\n⚪ جولة جافّة — لم يُنشَأ شيء.');
    console.log('   للتنفيذ، أعِد الأمر نفسه وأضِف في آخره:  --apply\n');
    return;
  }

  await apply(plan);
  console.log('\n✅ تمّ.\n');
})().catch((e) => {
  console.error('\n❌ توقّف: ' + e.message);
  console.error('   ما سبق هذا السطر نُفِّذ فعلاً؛ وإعادةُ التشغيل تتخطّى ما أُنشئ،');
  console.error('   لأن الخطةَ تُبنى في كل مرة من الموجود في النظام.\n');
  process.exit(1);
});
