# Lolly architecture

![Lolly آئیکن - بڑی سبز اور سفید لالی پاپ کینڈی](/info/icon.svg)

یہ صفحہ ان لوگوں کے لیے ہے جو Lolly کا کوڈ بدلتے ہیں: انجن، شیلز اور ٹول پیکس کیسے جڑتے ہیں، ہر ایک ریپوزٹری میں کہاں ہے، اور وہ عہد جو ہر تبدیلی کو پابند کرتے ہیں۔ اگر آپ جاننا چاہتے ہیں کہ Lolly کیا کرتا ہے اور کون استعمال کرتا ہے تو پہلے [Lolly کیسے کام کرتا ہے](/info/how-lolly-works.html) پڑھیں۔

دو ساتھی صفحات مزید گہرائی میں جاتے ہیں۔ [`engine/README.md`](../engine/README.md) انجن کا ماڈیول بہ ماڈیول نقشہ ہے، کوڈ سے بنایا ہوا۔ [Threat Model & Trust Boundaries](/info/threat-model.html) اسی فن تعمیر کو اعتماد کی سرحدوں کے طور پر پڑھتا ہے، اور انجن کس چیز کو ناقابل اعتماد سمجھتا ہے اس بارے میں ہر سوال کے لیے وہی صفحہ ہے۔

## بڑی تصویر

ٹولز اوپر ڈیٹا ہیں۔ بیچ میں انجن کسی پلیٹ فارم کو نہیں جانتا۔ نیچے شیلز ایک معاہدہ نافذ کرتے ہیں، اور کیٹلاگ مواد فراہم کرتے ہیں۔

![ٹولز مشترکہ انجن کو مینی فیسٹ، ٹیمپلیٹ اور ہکس فراہم کرتے ہیں۔ ویب، Tauri اور ٹرمینل شیلز HostV1 capability bridge نافذ کرتے ہیں اور کیٹلاگ سے ٹولز اور ایسیٹس پڑھتے ہیں۔](/info/diagrams/concepts/platform-layers.svg)

اگر آپ اسے خالص ڈیٹا اور Handlebars میں بیان کر سکتے ہیں تو وہ **انجن** میں آتا ہے۔ اگر وہ DOM، فائل سسٹم، نیٹ ورک یا کسی براؤزر یا آپریٹنگ سسٹم API کو چھوتا ہے تو وہ **host** میں آتا ہے، یعنی برج کی شیل والی طرف۔ انجن اوپن سورس ہے، اور کسی خاص برانڈ یا پلیٹ فارم کو جاننے والی کوئی چیز انجن میں نہیں جاتی۔

## ریپوزٹری کی ترتیب

Lolly ایک ریپوزٹری ہے۔ نیچے کی ہر ڈائریکٹری اس میں سادہ ڈائریکٹری ہے، سوائے `brands/suse` کے، جو **نجی** git submodule ہے اور SUSE ٹول پیک اور کیٹلاگ رکھتا ہے، جسے عوامی کلون نہیں لیتا۔ بلڈ کون سے پیکس پڑھتا ہے یہ content profile (`profiles.json`) ہے، جو عالمی طور پر بدلنے کے بجائے فی پروسیس حل ہوتا ہے۔ [Build Guide](/info/build-guide.html) میں کلون کمانڈ ہے اور یہ کہ نجی پیک کے اندر تبدیلی کیسے کمٹ ہوتی ہے۔

| ڈائریکٹری | یہ کیا رکھتی ہے |
|---|---|
| `engine/` | پلیٹ فارم سے آزاد مرکزی حصہ: لوڈر، رن ٹائم، ان پٹس، ٹیمپلیٹس، URL موڈ، یونٹس اور فارمیٹ ماڈیولز |
| `shells/` | ویب ایپ، Tauri ڈیسک ٹاپ اور موبائل ایپس، CLI، TUI اور براؤزر ایکسٹینشن |
| `packages/` | ٹول مصنف SDK (`@lolly-tools/core`)، مشترکہ Node شیل حصے اور docs رینڈرر، دیگر کے ساتھ |
| `community/` | برانڈ سے آزاد ٹولز، ساتھ مشترکہ ایموجی پیکس |
| `brands/` | برانڈ پیکس: `lolly-demo` (Lolly Demo، وہ ڈیزائن سسٹم جو lolly.tools چلاتا ہے)، `lolly-start` (خالی ابتدائی) اور نجی `suse` |
| `services/` | اختیاری MCP، سرٹیفکیٹ اور Penpot سروسز، اور ان کا مشترکہ سرور کوڈ |
| `schemas/` | ٹول مینی فیسٹس، ایسیٹ اندراجات اور ایسیٹ حوالوں کے لیے JSON Schema |
| `scripts/`, `tests/`, `docs/`, `api/` | بلڈ اور کیٹلاگ اسکرپٹس، انجن ٹیسٹ سویٹ، یہ docs اور تیار شدہ serverless بنڈلز |

::: details انجن اور شیل کی فائلیں جن سے آپ پہلے ملتے ہیں
```
engine/src/
  index.ts          public surface: loader, runtime, template, inputs, url-mode
  loader.ts         fetches and validates tool files
  runtime.ts        orchestrates one mounted tool, from load to export
  template.ts       Handlebars hydration and annotateTemplate
  inputs.ts         manifest to runtime input model
  url-mode.ts       URL to input state and back
  validate.ts       JSON Schema validation of manifests
  compose.ts        nested tool renders (composes)
  embed.ts          portable lolly.tools embed URLs
  bridge/host-v1.ts type re-export of the @lolly-tools/core contract

shells/web/src/
  main.ts           boot and routing
  bridge/           the web implementations of the host APIs
  catalog/sync.ts   boot-time catalog sync and offline cache
  views/            the gallery, tool, projects, free canvas and the other views
  pro/              Batch (#/batch)

shells/cli/         bin/lolly.ts (entry), src/run.ts (headless render), src/bridge.ts
shells/tui/         src/main.tsx (the full-screen app), src/bridge.ts
```
:::

ریپوزٹری کی جڑ میں `tools/` یا `catalog/` ڈائریکٹری نہیں ہے۔ `packages/node-shell/src/content-roots.ts` پوچھنے پر `profiles.json` سے جواب دیتا ہے کہ "ٹول `<id>` کہاں ہے" اور "کیٹلاگ کہاں ہے"۔ حقیقی `tools/` اور `catalog/` کی جوڑی صرف بلڈ آؤٹ پٹ میں لکھی جاتی ہے، مثلاً `dist/`، RPM payload یا کنٹینر امیج، کیونکہ براؤزر وہ دو راستے HTTP پر حاصل کرتا ہے۔

## Lolly کہاں چلتا ہے

ہر سطح وہی انجن اور وہی ٹول فائلیں استعمال کرتی ہے۔

- **ویب ایپ۔** ترقی پسند ویب ایپ جو سروس ورکر کے ٹولز اور ایسیٹس کیش کرنے کے بعد آف لائن کام کرتی ہے۔ اسے اکاؤنٹ نہیں چاہیے؛ حالت ہر ڈیوائس پر IndexedDB میں رہتی ہے۔ ایک جوابی لے آؤٹ ڈیسک ٹاپ اور فون دونوں کو سنبھالتا ہے: فون پر کنٹرولز شیٹ بن جاتے ہیں اور ایکسپورٹ کنٹرولز تیرتی pill سے کھلتے ہیں۔
- **ڈیسک ٹاپ اور موبائل ایپس۔** اسی ویب ایپ کے Tauri پیکج، مقامی فائل ڈائیلاگز، فائل سسٹم کی حالت اور مکمل آف لائن استعمال کے ساتھ۔
- **CLI۔** `lolly <tool-id> --input=value --output=file.png` وہی انجن ہیڈ لیس DOM میں لوڈ کرتا ہے اور فائل لکھتا ہے۔ یہ مختلف ٹرانسپورٹ پر URL موڈ ہے، الگ نفاذ نہیں۔ دیکھیں [CLI](/info/cli.html)۔
- **TUI۔** مکمل اسکرین، کی بورڈ پہلے ٹرمینل ایپ جو CLI کا برج دوبارہ استعمال کرتی ہے، محفوظ سیشنز ڈسک پر رکھتی ہے (ایپ انسٹال ہو تو ڈیسک ٹاپ ایپ کے اپنے فولڈر میں، ورنہ `~/.lolly` کے تحت) اور صرف تب محدود ہیڈ لیس براؤزر شروع کرتی ہے جب فارمیٹ کو چاہیے ہو۔ دیکھیں [TUI](/info/tui.html)۔

![ڈیسک ٹاپ اسپلٹ منظر: بائیں مینی فیسٹ سے بنے کنٹرولز، دائیں لائیو کینوس](/t/url-shot?url=%2F%23%2Ftool%2Fchart&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&filename=aud-web-split)

فون کی چوڑائی پر وہی ٹول دوسرے لے آؤٹ کا محتاج نہیں: کنٹرولز اوپر شیٹ بن جاتے ہیں اور پری ویو اسکرین سنبھالتا ہے۔

![430px چوڑی اسکرین پر آڈیوگرام: اوپر کنٹرولز شیٹ، نیچے مکمل چوکور آرٹ ورک اور تیرتا ایکسپورٹ pill](/t/url-shot?url=%2F%23%2Ftool%2Faudiogram%3Faudio%3Dlolly%2Floops%2Ffireplace-loop%26title%3DField%2520notes%26subtitle%3DEpisode%252012%26style%3Dwave&width=430&height=900&dpi=192&waitMs=3200&css=%23ag-wave%7Bdisplay%3Anone!important%7D.ag-ph%7Bdisplay%3Ablock!important%7D&walker=1&format=svg&rasterDpi=110&dark=1&filename=ov2-phone-audiogram)

ویب ایپ **Batch** (`#/batch`، `shells/web/src/pro/`) بھی ساتھ لاتی ہے، اسپریڈ شیٹ طرز کا گرڈ جو ایک یا کئی ٹولز میں بہت سی قطاریں ایک ساتھ رینڈر کرتا ہے؛ [Batch اور Multi-edit](/info/batch.html#make-many-versions-of-one-design) Batch کا احاطہ کرتا ہے۔ **Settings → Capabilities** وہ سب دکھاتا ہے جو پلیٹ فارم اپنے کرنے کے قابل بتاتا ہے۔

![نئی انسٹالیشن پر Batch: ٹول کا انتظار کرتی ایک خالی قطار، ڈیٹا آنے سے پہلے اسپریڈ شیٹ سطح اور اس کا Render بٹن اپنی جگہ پر](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=ov2-batch-grid)

## آرکیٹیکچرل وعدے

یہ فیصلے طے شدہ ہیں۔ ان میں سے کسی کو بدلنا بڑا کام ہے، کیونکہ یہ کوڈ بیس کے ہر دوسرے فیصلے کو شکل دیتے ہیں۔

### 1۔ اعلانیہ ٹولز، ایک امری فرار کے راستے کے ساتھ

ٹول مینی فیسٹ (`tool.json`)، ٹیمپلیٹ (`template.html`) اور اختیاری `hooks.js` ہے۔ **مینی فیسٹ ان پٹس اعلان کرتا ہے**، ٹیمپلیٹ کبھی نہیں: ان پٹس Handlebars ٹوکنز سے اخذ نہیں ہوتے۔ زیادہ تر ٹولز صرف مینی فیسٹ اور ٹیمپلیٹ ہیں، جو غیر ڈیولپرز کو انہیں تصنیف کرنے دیتا ہے۔

![Street Map کا کنٹرول اسٹیک: شہر کا ڈراپ ڈاؤن، تھیم سلیکٹ، وزن کی سلائیڈرز اور رنگ ٹریگرز، ہر ایک مینی فیسٹ کی ایک لائن سے بنا](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-street-map-controls)

جو ٹولز قدریں نکالتے ہیں، مثلاً QR انکوڈنگ یا چارٹ کی شکل، وہ hooks شامل کرتے ہیں: نام والے لائف سائیکل فنکشنز جنہیں رن ٹائم capability bridge انجیکٹ کر کے کال کرتا ہے۔ Hooks پورٹیبلٹی کا معاہدہ ہیں، سیکیورٹی سینڈ باکس نہیں، اور وہ وقت کے بجٹ میں چلتے ہیں۔ جن ٹولز کے hooks صفحے کے globals سے آزاد ثابت ہوں وہ `isolate: true` رکھتے ہیں اور Worker میں چلتے ہیں۔ [Tool hooks](/info/tool-hooks.html) میں لائف سائیکل اور بجٹ ہیں، اور [Threat Model](/info/threat-model.html) بتاتا ہے کہ صفحے کے اندر کا executor کیا روکتا ہے اور کیا نہیں۔

### 2۔ ٹولز اور اثاثے ڈیٹا ہیں، بنڈل شدہ کوڈ نہیں

ویب اور Tauri ایپس بوٹ پر ٹول اور ایسیٹ کیٹلاگ حاصل کرتی ہیں، انہیں کیش کرتی ہیں اور جو وہاں ہو اس کے ساتھ کام کرتی ہیں، اس لیے نئے ٹول یا ایسیٹ کو ایپ ریلیز نہیں چاہیے۔ ایسیٹ بائٹس کا SHA-256 چیک سم ہوتا ہے، اور ایسیٹ کا `id` اور `version` کیش کی تجدید چلاتے ہیں۔

### 3. Capability bridge ہی واحد API ہے جو ٹولز دیکھتے ہیں

ٹولز اپنے ٹیمپلیٹ سے باہر کبھی DOM کو نہیں چھوتے، `fetch` براہ راست کال نہیں کرتے اور فائل سسٹم کبھی نہیں پڑھتے۔ وہ ورژن والے `host.*` طریقے کال کرتے ہیں۔ معاہدے کی معیاری تعریف `packages/core/src/host-v1.ts` میں ہے، ٹول مصنف SDK `@lolly-tools/core`، تاکہ کوئی تیسرا فریق انجن پر انحصار کیے بغیر اس کے خلاف بنا سکے؛ `engine/src/bridge/host-v1.ts` اس کی اقسام دوبارہ ایکسپورٹ کرتا ہے۔

| ضروری API | یہ کیا کرتی ہے |
|---|---|
| `host.profile` | صارف کی تفصیلات؛ `bindToProfile` کے ذریعے ان پٹس کو پہلے سے بھرتی ہے |
| `host.assets` | کیٹلاگ کوئریز، ایسیٹ کا حل اور host کا پکر |
| `host.state` | ان پٹ سلاٹس محفوظ اور لوڈ کرنا: ویب پر IndexedDB، Tauri میں فائل سسٹم، CLI میں میموری |
| `host.clipboard` | کلپ بورڈ پر متن یا تصویر لکھنا، پلیٹ فارم متبادلات کے ساتھ |
| `host.export` | رینڈر ہدف کو راسٹرائز یا سیریلائز کرنا، اور آن ڈیوائس فائل ٹرانسفارم راستہ |
| `host.log` | host کو درجہ بند لاگنگ |

باقی ہر API اختیاری اور اضافی ہے: `tokens`، `text`، `color`، `geom`، `pdf`، `compose`، `media`، `recorder` اور بہت سی اور۔ ٹول کا مینی فیسٹ `requires` کے تحت وہ اختیاری APIs درج کرتا ہے جنہیں اس کے hooks بغیر جانچے کال کرتے ہیں، اور جس host میں وہ نہ ہو وہ ٹول ماؤنٹ کرنے سے انکار کرتا ہے؛ hooks باقی کی feature-detect کرتے ہیں۔ چند، جیسے `recorder`، ایسی ڈیوائس صلاحیت بھی مانگتے ہیں جس کا ٹول اعلان کرتا ہے۔ `packages/core/src/host-v1/apis.ts` سب درج کرتا ہے اور [Host API](/info/host-api.html) ہر ایک کو دستاویز کرتا ہے۔ طریقہ شامل کرنا minor ورژن ہے؛ ہٹانا یا بدلنا major ورژن ہے، اور v2 آنے پر v1 چلتا رہتا ہے۔

### 4. ایسیٹ آئی ڈیز ہمیشہ کے لیے ہیں

`lolly/logo/primary` معاہدہ ہے۔ شائع ہونے کے بعد آئی ڈی کبھی نہیں بدلتی اور کبھی دوبارہ استعمال نہیں ہوتی۔ بائٹ کی تبدیلی ایسیٹ اندراج میں `version` بڑھاتی ہے، اور متبادل `deprecated: true` اور، اختیاری طور پر، `replacedBy` سیٹ کرتا ہے، تاکہ موجودہ حوالے ہمیشہ حل ہوں۔ یہی محفوظ سیشنز اور شیئر لنکس کو برسوں چلتا رکھتا ہے۔

### 5۔ URL موڈ فرسٹ-کلاس ہے

ہر ان پٹ URL پیرامیٹر کے طور پر ظاہر ہو سکتا ہے، اس لیے لنک مکمل فائل ہے:

```
https://lolly.tools/t/qr-code?url=https://example.com&ecl=H
```

![وہ لنک اکیلا، بغیر کسی اور چیز کے، مکمل فائل ہے](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Fexample.com%26ecl%3DH%26full&width=760&height=760&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-url-mode-qr)

پیرامیٹر بدلیں اور آپ کو مختلف فائل ملتی ہے۔ یہ پوری پیلیٹ ایک seed رنگ، ایک ہم آہنگی اور قدموں کی تعداد ہے:

![نو مراحل چار رنگتوں میں، سب اسی ایک بیج رنگ سے تخلیق کیے گئے جو لنک میں موجود ہے](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3De0521a%26harmony%3Dtetrad-4%26steps%3D9%26full&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-url-palette)

CLI اپنے آرگومنٹس سے وہی URL حالت بناتا ہے اور وہی پائپ لائن چلاتا ہے، اس لیے CLI ایپ سے الگ نہیں ہو سکتا۔ `engine/src/url-mode.ts` پارس اور سیریلائز کرتا ہے؛ محفوظ ناموں کا سیٹ (`format`، `width`، `dpi`، `c2pa`، `z` اور دیگر) ٹول کو کبھی نہیں دیا جاتا، اور [Reserved URL parameters](/info/url-parameters.html) سب درج کرتا ہے۔ ایسیٹ ان پٹس `id` سے سفر کرتے ہیں اور ٹیمپلیٹ بھرنے سے پہلے `host.assets.get()` سے حل ہوتے ہیں۔

### 6. اسٹوریج برج سے گزرتا ہے

ویب ایپ IndexedDB استعمال کرتی ہے، Tauri فائل سسٹم اور CLI میموری۔ ٹولز صرف `host.state.save(slot, data)` اور `host.state.load(slot)` دیکھتے ہیں، کبھی `localStorage` نہیں۔ لوگ بغیر اکاؤنٹ کے فی ٹول کئی نام والے سیشنز رکھ سکتے ہیں۔ چونکہ برج ہی واحد جوڑ ہے، وہ حالت پورٹیبل بھی ہے: `shells/web/src/data-transfer.ts` اسے ایک `lolly-backup` فائل میں واپس پڑھتا ہے جو کسی بھی دوسری انسٹالیشن پر امپورٹ ہوتی ہے ([Data transfer](/info/data-transfer.html))، اور [Sync](/info/sync.html) وہی بنڈل شخص کے چنے ہوئے اسٹوریج کو بھیجتا ہے۔

### 7. میچورٹی ٹیگز بتاتے ہیں کہ ٹول کیا ہے

ہر ٹول `status: official | community | experimental` اعلان کرتا ہے۔ گیلری status کے لحاظ سے ترتیب دیتی ہے، اور experimental ٹولز بطور ڈیفالٹ اپنی ایکسپورٹس پر واٹر مارک لگاتے ہیں: رن ٹائم واٹر مارک آن کرتا ہے جب تک کالر `watermark: false` نہ دے، اور آن ڈیوائس ٹولز مستثنیٰ ہیں۔ کیٹلاگ کے گرد ٹیم جو بھی عمل رکھے وہ اس کے اوپر بیٹھتا ہے۔

### 8. ان پٹس مینی فیسٹ میں ٹائپ شدہ ہیں

ان پٹ `type` اعلان کرتا ہے: `text`، `longtext`، `number`، `boolean`، `color`، `select`، `asset`، `date`، `time`، `datetime-local`، `url`، `blocks`، `vector`، `table` یا `file`۔ host ہر قسم کے لیے کنٹرول رینڈر کرتا ہے، اس لیے ٹولز کنٹرول کوڈ نہیں لکھتے، اور کوئی بھی ان پٹ `bindToProfile` رکھ سکتا ہے۔ تین سب سے زیادہ وزن رکھتے ہیں:

- **`asset`**، `filter` اور `allowUpload` کے ساتھ، ایسیٹ سسٹم کا برج ہے۔ `allowUpload: false` سلاٹ کو لائبریری ایسیٹس تک محدود کرتا ہے، اور صارف اپ لوڈز لائبریری کی `AssetRef` شکل بانٹتے ہیں۔
- **`blocks`** سائیڈ پینل میں ایڈٹ ہونے والا دہرایا جانے والا فیلڈ گروپ ہے، جو Meeting Planner، Wayfinding، Diagrams اور دوسروں میں استعمال ہوتا ہے۔ رینڈر کیے بلاک پر کلک اس کی قطار پر فوکس کرتا ہے۔
- **`file`** صارف کی اپنی فائل آن ڈیوائس یوٹیلیٹیز، مثلاً Strip Hidden Data اور Compress، کے لیے میموری میں رکھتا ہے، اور **`vector`** اعداد کے مقررہ سیٹ کو ایک کنٹرول میں گروپ کرتا ہے۔

### 9. ٹیمپلیٹس logic-less ہیں

ٹیمپلیٹس Handlebars ہیں، اس لیے چنے گئے کہ غیر ڈیولپرز انہیں لکھ سکیں: `{{x}}` escape کرتا ہے، اور `{{{x}}}` واضح opt-in ہے۔ منطق `hooks.js` میں رہتی ہے، جہاں وہ واضح اور قابل ریویو ہے۔ کئی ٹیمپلیٹس hook کے نکالے markup کے لیے `{{{` استعمال کرتے ہیں، اس لیے ہر hook کو وہ escape کرنا ہوگا جو وہ دیتا ہے۔ helpers `default`، `upper`، `lower`، `eq`، `markdown`، `asset`، `framing` اور `media` ہیں، ساتھ `icsStamp`، `rfcText`، `csvCell` اور `arrow` ساتھی `.ics`، `.vcf` اور `.csv` ٹیمپلیٹس کے لیے۔ [Templates and rendering](/info/tool-rendering.html) ان کا احاطہ کرتا ہے۔

### 10۔ ٹولز ٹولز کو compose کرتے ہیں

ٹول دوسرے ٹول کا رینڈر بغیر ٹول سے ٹول imports کے ایمبیڈ کر سکتا ہے؛ انجن composition حل کرتا ہے۔ مینی فیسٹ `composes: [{ id, tool, inputs }]` اعلان کر سکتا ہے اور child کو `{{asset <id>}}` سے رکھ سکتا ہے، اور پورٹیبل ایمبیڈ URL (`https://lolly.tools/tool/<id>.svg?…`) child کو مقامی طور پر رینڈر کرتا ہے، یوں Design لائیو QR کوڈ یا چارٹ رکھتا ہے۔ SVG child SVG یا PDF parent میں ویکٹر رہتا ہے۔ Children درمیانی نتائج ہیں، کبھی واٹر مارک یا اسٹیمپ نہیں ہوتے، اور جو شیل ایک رینڈر نہ کر سکے وہ سلاٹ خالی چھوڑتا ہے جبکہ parent پھر بھی رینڈر ہوتا ہے۔ [Composition and brand overlays](/info/tool-composition.html) میں تفصیلات ہیں۔

## جو ہم نے نہ کرنے کا انتخاب کیا

- **ٹیمپلیٹس میں من مانی JavaScript نہیں۔** منطق `hooks.js` میں رہتی ہے۔
- **لازمی ایسیٹ سرور نہیں۔** لوگ ایپ میں Assets میں اپنی فائلیں شامل کرتے ہیں اور کام سیشن کے طور پر آگے دیتے ہیں: ان پٹس اور سیٹنگز کے لیے شیئر لنک، `.lolly` فائل جب اپ لوڈز بھی ساتھ جائیں۔ مشترکہ سیشن ٹول کے چوزر میں ٹیمپلیٹ بن سکتا ہے۔ جو تنظیم منظم کیٹلاگ چاہتی ہے وہ Lolly Work کا کیٹلاگ، منظوریاں اور پالیسیاں استعمال کر سکتی ہے، یا برانڈ پیک git میں سنبھال کر وہیں تبدیلیاں ریویو کر سکتی ہے۔
- **زبردستی رسائی کنٹرول نہیں۔** کھلی ایپ بطور ڈیفالٹ عوامی ہے، اور پختگی کے ٹیگز اور واٹر مارکس برانڈ کا خطرہ اٹھاتے ہیں۔ جب ٹیم چاہے تو تنظیمی سائن اِن، کردار اور پالیسی Lolly Work سے آتی ہے۔
- **مرکزی ڈیٹا بیس نہیں۔** صارف کی حالت ہر ڈیوائس پر رہتی ہے، اور اختیاری Sync اسے شخص کے چنے ہوئے اسٹوریج پر کاپی کرتا ہے، کبھی Lolly ڈیٹا بیس پر نہیں۔
- **ٹولز اور انجن کے درمیان مشترکہ کوڈ راستہ نہیں۔** انجن اور کمیونٹی ٹولز اوپن سورس ہیں، اور برانڈ پیک جیسے نجی `brands/suse/` اپنے ٹولز اور کیٹلاگ اپنی شرائط پر رکھتا ہے۔ کوئی ٹول `engine/` سے import نہیں کرتا، اس لیے تقسیم صاف رہتی ہے۔

## ایک رینڈر کا لائف سائیکل

کوئی `https://lolly.tools/t/qr-code?url=https://example.com&ecl=H` کھولتا ہے:

1. **بوٹ۔** ویب ایپ IndexedDB کھولتی ہے، capability bridge بناتی ہے اور ٹول اور ایسیٹ کیٹلاگ sync کرتی ہے، یا آف لائن ہونے پر کیش سے لوڈ کرتی ہے۔
2. **راستہ۔** پاتھ `qr-code` کا ٹول منظر چنتا ہے، کوئری اس کی ابتدائی قدروں کے طور پر۔
3. **لوڈ۔** `loadTool` `tool.json` حاصل کرتا ہے، اسے اسکیمے سے جانچتا ہے اور ٹیمپلیٹ، اسٹائلز اور hooks حاصل کرتا ہے۔
4. **لنک پارس کریں۔** `parseUrlState` پیرامیٹرز کو ان پٹ قدروں میں بدلتا ہے۔ ایسیٹ حوالہ جیسے `?logo=lolly/logo/primary` غیر حل شدہ `{ id }` بن جاتا ہے۔
5. **رن ٹائم شروع کریں۔** `createRuntime(tool, host, initialValues)` پروفائل ڈیٹا، ڈیفالٹس اور لنک سے ان پٹ ماڈل بناتا ہے، ایسیٹ حوالے حل کرتا ہے، hooks لوڈ کرتا ہے اور `onInit` کال کرتا ہے۔
6. **رینڈر۔** شیل رن ٹائم کو سبسکرائب کرتا ہے، ماڈل سے کنٹرولز ڈرا کرتا ہے اور بھرا ٹیمپلیٹ `#tool-canvas` میں لکھتا ہے۔
7. **تعامل۔** ٹائپ کرنا `runtime.setInput` کال کرتا ہے، جو پابندیاں لگاتا ہے، `onInput` کال کرتا ہے، ٹیمپلیٹ دوبارہ بھرتا ہے اور دوبارہ ڈرا کرتا ہے۔
8. **ایکسپورٹ۔** **Download** `runtime.export(node, format)` کال کرتا ہے، اور شیل کا `host.export` فائل بناتا ہے: راسٹر، DOM walker سے ویکٹر، PDF، دستاویز یا `schemas/tool.schema.json` میں دوسرے فارمیٹس میں سے ایک۔ فزیکل یونٹس فی فارمیٹ بدلے جاتے ہیں، اور میٹا ڈیٹا اور Content Credentials وہاں ایمبیڈ ہوتے ہیں جہاں فارمیٹ رکھ سکے۔ Experimental ٹولز اپنا واٹر مارک host سے پاتے ہیں، ٹول سے نہیں۔ [Templates and rendering](/info/tool-rendering.html) اور [فائل ایکسپورٹ کریں](/info/exporting.html) ایکسپورٹ قدم کا احاطہ کرتے ہیں۔

![?options جو ایکسپورٹ پینل کھولتا ہے: فائل نام اور فارمیٹ کی جوڑی، آؤٹ پٹ سائز اور فائل لکھنے والے کنٹرولز](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=aud-export-popup)

وہی لائف سائیکل Tauri میں چلتا ہے، اور CLI میں ہیڈ لیس DOM کے ساتھ، جہاں آؤٹ پٹ فائل یا stdout میں جاتی ہے۔

## لائسنس

کوڈ، بشمول `engine/`، `shells/`، `services/`، `schemas/` اور دستاویزات جنریٹر، MPL-2.0 ہے، ایک عوامی ریپوزٹری میں، [`lolly-tools/lolly`](https://github.com/lolly-tools/lolly)۔ دستاویزات کا متن CC BY-SA 4.0 ہے۔ برانڈ پیکس اپنی شرائط ہر پیک کے `NOTICE.md` میں رکھتے ہیں: کمیونٹی ٹولز MPL-2.0 ہیں، اور نجی SUSE پیک SUSE کی ملکیت ہے۔ [About](/info/about.html) میں مکمل لائسنسنگ نوٹ ہے۔
