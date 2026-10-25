# خود تصدیق کریں

اس سائٹ پر ہر وعدہ جانچا جا سکتا ہے، بغیر اکاؤنٹ۔ زیادہ تر جانچوں کو صرف براؤزر چاہیے؛ باقی کو ٹرمینل اور ماخذ کی کاپی۔ اگر نیچے کی کوئی جانچ دکھایا گیا نتیجہ نہ دے تو وہ بگ یا ٹوٹا ہوا وعدہ ہے، اور ہم سننا چاہتے ہیں: دیکھیں [اگر جانچ ناکام ہو](#if-a-check-fails)۔

سب سے تیز سے شروع کریں: Verify پر فائل ڈالیں۔ پھر آگے جائیں: ٹول استعمال کرتے ہوئے نیٹ ورک دیکھیں، پلگ نکالیں اور کام جاری رکھیں، کوکیز گنیں اور ماخذ پڑھیں۔

یہ جانچیں Lolly کو اکیلے ڈھانپتی ہیں۔ اگر آپ کی تنظیم Lolly Work چلاتی ہے تو وہ سائن اِن، مشترکہ مواد، ترتیب دی گئی ٹیلی میٹری اور آڈٹ ریکارڈز شامل کرتی ہے؛ انہیں [Server Surface](/info/server-surface.html) اور [رازداری کی پالیسی کے تنظیمی سیکشن](/info/privacy.html#organisation-services-with-lolly-work) سے جانچیں۔

## اسے کام کرتے دیکھیں، دس سیکنڈ میں

[`/verify`](/#/verify) کھولیں اور صفحے پر فائل ڈالیں۔ کوئی اپ لوڈ نہیں، کوئی اکاؤنٹ نہیں اور سرور کا انتظار نہیں۔ یہاں یہ Our AI Stance سے [بنایا گیا Queensland طوفان](/info/ai-stance.html) جانچتا ہے: Gemini کی بنائی تصویر، جسے Lolly نے کھولا، نشان زد کیا اور بدلا۔ ہر بیج ڈیوائس پر، فائل کے اپنے بائٹس سے نکالا گیا۔

![Verify on a phone-width screen - the storm image, a green Made with Lolly verdict and the credential-intact and bytes-unchanged badges stacked beneath it](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=440&height=1500&dpi=192&waitMs=6000&waitSelector=.valid-steps&walker=1&format=svg&rasterDpi=96&cropSelector=.valid-top&dark=1&filename=cc-verify-mobile)

فیصلہ بیجز کا چھوٹا ڈھیر ہے، ہر ایک آزاد حقیقت:

- <!--i:lock--> **Made with Lolly**: credential سالم ہے *اور* Lolly ایکسپورٹ ریکارڈ کرتا ہے۔
- <!--i:seal--> **The credential is intact**: دستخط شدہ C2PA مینی فیسٹ پارس ہوتا ہے اور اس کا اپنا claim دستخط تصدیق ہوتا ہے۔
- <!--i:hash--> **The bytes have not changed**: فائل کا ہیش اب بھی اس سے ملتا ہے جس پر دستخط ہوئے۔ ایک پکسل بدلیں اور یہ بیج پلٹ جاتا ہے۔
- <!--i:sparkle--> **GEN AI**: مشین نے یہ پکسلز بنائے، اور فائل یہ کہتی ہے۔ Lolly وہ اعلان واپس پڑھتا ہے بجائے اس کے کہ حقیقت چھپائے۔

پوری ہسٹری فائل کے ساتھ سفر کرتی ہے۔ یہاں نو قدم بچے ہیں: پانچ جو Google نے تصویر بناتے اور واٹر مارک کرتے وقت ریکارڈ کیے، پھر چار جو Lolly نے اس صفحے پر کاپی کھولتے، نشان زد کرتے اور بدلتے وقت ریکارڈ کیے۔ Verify انہیں سیدھے بائٹس سے پڑھتا ہے اور ٹائم لائن کے طور پر ڈرا کرتا ہے۔

![The change history Verify reads back out of the storm image - five steps recorded by Google, then four by Lolly, ending in the WebP on this page](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

یہ ڈیمو ہے۔ نیچے کی جانچیں اس کے نیچے کی ضمانتیں ہیں، اور ہر ایک دوبارہ پیدا کی جا سکتی ہے۔ [Content Credentials](/info/content-credentials-identity.html) ہر فیصلہ سمجھاتا ہے۔

## آپ کے براؤزر میں، کسی ٹول کی ضرورت نہیں

::: timeline
- <!--i:globe--> **1. نیٹ ورک دیکھیں۔** [lolly.tools](https://lolly.tools) کھولیں، اپنے براؤزر کے DevTools (F12) کھولیں، **Network** پر جائیں اور ٹول استعمال کریں: [QR Code](/t/qr-code) میں ویب ایڈریس ٹائپ کریں، رنگ بدلیں، PNG ایکسپورٹ کریں۔ ہر درخواست `lolly.tools` پر رہتی ہے: ایپ شیل، ٹول کی اپنی فائلیں اور کیٹلاگ ایسیٹس۔ کوئی اینالیٹکس ہوسٹ، کوئی CDN beacon، کوئی فونٹ سروس اور کوئی error-reporting اینڈ پوائنٹ نہیں۔ جو آپ ٹول میں ٹائپ کرتے ہیں وہ **کسی درخواست میں بالکل ظاہر نہیں ہوتا**، کیونکہ رینڈرنگ مقامی ہے۔
- <!--i:eyeoff--> **2. پلگ نکالیں۔** ایپ لوڈ کریں اور ایک دو ٹول کھولیں، پھر آف لائن جائیں (ایئر پلین موڈ، یا DevTools → Network → Offline) اور ری لوڈ کریں۔ گیلری اور ہر وہ ٹول جو آپ نے کھولا کام کرتا رہتا ہے، رینڈرنگ اور ان فارمیٹس میں ایکسپورٹ سمیت جو آپ نے استعمال کیے۔ ٹول کی فائلیں اور فارمیٹ کا انکوڈر پہلی بار استعمال پر کیش ہوتے ہیں، اس لیے آف لائن آزمانے سے پہلے ٹول ایک بار آن لائن استعمال کریں۔ یہ اس صفحے کی سب سے مضبوط واحد جانچ ہے: جو سافٹ ویئر گھر فون کرتا ہے وہ اپنی ڈوری کٹنے پر نہیں بچتا۔
- <!--i:check--> **3. کوکیز گنیں۔** DevTools → **Application** (Firefox: **Storage**) → Cookies → `https://lolly.tools`۔ فہرست خالی ہے: ایپ کوئی کوکی سیٹ نہیں کرتی۔ کنسول میں `document.cookie` پیسٹ کریں اور آپ کو `""` ملتا ہے۔ اختیاری CA اندراج مختصر مدت کی `HttpOnly` کوکی `lolly_ca_state` سیٹ کرتا ہے، جس کا دائرہ `/api/ca` ہے، جسے `document.cookie` نہیں دکھا سکتا۔ Lolly Work انسٹینس اپنی سائن اِن کوکیز استعمال کرتا ہے؛ انہیں [Privacy](/info/privacy.html#organisation-services-with-lolly-work) سے ملائیں۔
- <!--i:layers--> **4. اپنا اسٹوریج پڑھیں۔** اسی پینل میں، جو کچھ Lolly رکھتا ہے آپ کے سامنے ہے: چند درجن سادہ `localStorage` کلیدیں (تھیم، زبان، سائیڈ بار کی چوڑائی، آواز اور منظر کی سیٹنگز، اور عوامی ٹول کیٹلاگ انڈیکس کی کیش کاپی) اور IndexedDB میں آپ کی اپنی دستاویزات۔ ہر قدر پڑھنے کے قابل اسٹرنگ یا JSON ہے، کچھ مبہم نہیں۔ سائٹ ڈیٹا صاف کرنا یہ مقامی ریکارڈز ہٹاتا ہے، لیکن Sync بیک اپ یا Lolly Work انسٹینس کے ریکارڈز نہیں۔ **Settings → Storage → Clear all my data** ایپ کے اندر سے یہی کرتا ہے، اور آپ اسٹورز اور کیشز کو خالی ہوتے دیکھ سکتے ہیں۔
- <!--i:lock--> **5. جانچیں کہ انکشاف کا رابطہ موجود ہے۔** [`/.well-known/security.txt`](/.well-known/security.txt) [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116) رابطہ بلاک کے ساتھ جواب دیتا ہے، HTML صفحہ نہیں۔
:::

::: details Network ٹیب میں اور کیا نظر آ سکتا ہے
کچھ فیچرز نیٹ ورک تک صرف تب پہنچتے ہیں جب آپ انہیں استعمال کریں، اور ہر ایک اسی ٹیب میں نظر آتا ہے:

- Design System Setup میں **Google Font** شامل کرنا وہ ایک فیملی Google سے حاصل کرتا ہے، رضامندی ڈائیلاگ کے بعد جو یہ بتاتا ہے، ایک بار، پہلے فیچ سے پہلے؛
- **ICC press-profile پری سیٹ** پر کلک کرنا وہ پروفائل color.org پر ICC کی عوامی رجسٹری سے حاصل کرتا ہے؛
- اختیاری بلٹ ان **ریڈیو** چلانا اسٹیشن سے اسٹریم کرتا ہے؛
- **Meeting Planner** میں مقام درج کرنا اس جگہ کو open-meteo کی geocoding سروس پر اس کے کوآرڈینیٹس اور ٹائم زون کے لیے تلاش کرتا ہے، فی شہر ایک بار (جوابات آپ کی ڈیوائس پر محفوظ ہوتے ہیں)، اور فیلڈ جہاں آپ ٹائپ کرتے ہیں وہاں یہ بتاتا ہے؛
- **URL Screenshot** وہ ایڈریس لوڈ کرتا ہے جو آپ نے ٹائپ کیا، کیونکہ یہی اس کا کام ہے، اور آپ اسے ہوتے دیکھتے ہیں۔

جو ٹول نیٹ ورک صلاحیت کا اعلان کرے وہ صرف انہی ہوسٹس سے حاصل کر سکتا ہے جنہیں اس کا مینی فیسٹ allowlist کرے، اور وہ جانچ بند ہو کر ناکام ہوتی ہے۔ آج بھیجا گیا کوئی ٹول ایسا اعلان نہیں کرتا، اس لیے براؤزر سے نافذ Content-Security-Policy ہی اوپر کی فہرست کو اس کے ہوسٹس تک رکھتی ہے۔ [رازداری کی پالیسی](/info/privacy.html) ان سب کا معیاری جدول رکھتی ہے، بشمول منظم انسٹینس ٹریفک جیسے پالیسی ریفریش اور فعال رپورٹنگ۔
:::

## ٹرمینل سے

**6. رینڈر اینڈ پوائنٹ صرف عوامی ڈیٹا کے ساتھ جواب دیتا ہے۔** واحد سرور فیچر جو ٹائپ کیے ان پٹس کو URL میں ڈالتا ہے، hot-link رینڈرز، یہاں لائیو ہے۔ [رازداری کی پالیسی](/info/privacy.html) بتاتی ہے کہ اس کا لنک میں ڈالے ان پٹس کے لیے کیا مطلب ہے۔

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://lolly.tools/tool/qr-code.svg?url=test'
# 200
```

ہر تعیناتی چنتی ہے (`LOLLY_DISABLE_RENDER_GET=1`): جس انسٹینس پر یہ سیٹ ہو وہاں وہی پروب `404` لوٹاتا ہے۔ وہ فرق سیٹنگ کا کام کرنا ہے، تضاد نہیں۔

**7. اپنی تعیناتی کی فعال سروسز جانچیں۔** [Server Surface](/info/server-surface.html) اختیاری سروسز درج کرتا ہے اور ان کے تفصیلی حوالے جوڑتا ہے۔ Lolly Work کے لیے اس کے تصدیق شدہ APIs، collaboration کنکشن، اسٹوریج اور ترتیب دیے فراہم کنندگان شامل کریں۔ عوامی lolly.tools کی پروب نجی تنظیمی انسٹینس کو نہیں جانچتی۔

اگر آپ اپنا انسٹینس چلاتے ہیں تو [Delivery deployment](/info/deploy-delivery.html) میں اس کی ریلیز جانچیں ہیں: ماڈل سالمیت، edge پروب اور اس کی نمونہ فہرست، ڈسپلے renditions، نجی ڈاؤن لوڈ گیٹ وے اور براؤزر میں دستخط شدہ کیٹلاگ۔


## سورس کوڈ میں

اوپر کا سب کچھ پھر بھی ڈرامہ ہو سکتا ہے اگر تعینات کوڈ عوامی کوڈ سے مختلف ہو۔ اس لیے کوڈ جانچیں۔ تعیناتی [عوامی ریپوزٹری](https://github.com/lolly-tools/lolly) سے بنتی ہے:

```bash
git clone https://github.com/lolly-tools/lolly.git
cd lolly
```

**8. کہیں کوئی ٹریکر اور اینالیٹکس SDK نہیں۔** وہ کوڈ تلاش کریں جو بھیجا جاتا ہے (انجن، براؤزر ایکسٹینشن سمیت ہر شیل، Tauri برج اوور رائڈز اور سروس ورکر، سرور فنکشنز اور ٹول پیکس) معمول کے مشتبہ ناموں کے لیے:

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' --include='*.html' \
  -e googletagmanager -e google-analytics -e posthog -e mixpanel -e hotjar \
  -e sentry.io -e segment.com -e '@vercel/analytics' \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output)
```

یہ اسکین تیسرے فریق کے ٹریکنگ SDKs کو ڈھونڈتا ہے۔ یہ فرسٹ پارٹی استعمال رپورٹنگ کی غیر موجودگی نہیں دکھاتا: Lolly Work تنظیمی ٹیلی میٹری اور الگ آڈٹ لاگ سپورٹ کرتا ہے، اپنی پالیسی اور ٹیسٹس کے ساتھ۔

**9. کوئی تیسرے فریق کا DNS ریزولور نہیں۔** Verify کی SEAL جانچ کبھی DNS-over-HTTPS فراہم کنندہ کے ذریعے تلاش نہیں بھیجتی، کیونکہ ایپ کے پاس ریزولور نہیں:

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' \
  -e cloudflare-dns.com -e dns.google -e /dns-query \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output: outside this page and its built copies, the only place those
#  hostnames appear in the repo is tests/no-trackers.test.ts, the test that
#  bans them)
```

**10. سرٹیفکیٹ سروس اجراء کا لاگ نہیں رکھتی۔** شناختی CA نہ جاری کردہ کا لاگ رکھتی ہے نہ شناختوں کی فہرست: کوئی stdout لائن نہیں، کوئی ویب ہک نہیں، کوئی سرٹیفکیٹ اسٹور نہیں۔ غیر موجودگی تلاش کی جا سکتی ہے:

```bash
grep -rn logIssuance services/ca api/ca
# (no output)
```

CA مختصر مدت کی ورکنگ حالت رکھتی ہے: ریٹ لمٹ بکٹس اپنی کھڑکی کے لیے ہیش شدہ IP اور ای میل کلیدیں رکھتے ہیں، اور منظم تعیناتی کا admission اسٹور زیادہ سے زیادہ دس منٹ کے لیے کلیدی شناخت کنندہ اور درخواست ڈائجسٹ رکھتا ہے۔ [Content Credentials engineering](/info/content-credentials-engineering.html#protocol) میں تفصیل ہے۔

## ٹیسٹس سے نافذ

اوپر کی ماخذ جانچیں ایک بار کا آڈٹ نہیں: وہ ٹیسٹ سویٹ میں پن ہیں، اس لیے خاموشی سے سڑ نہیں سکتیں۔ [`tests/no-trackers.test.ts`](https://github.com/lolly-tools/lolly/blob/main/tests/no-trackers.test.ts) اوپر کے اسکین سے لمبی ٹریکر ناموں کی فہرست جانچتا ہے اور بلڈ ناکام کرتا ہے اگر:

- کوئی اینالیٹکس یا ٹریکنگ SDK اس بھیجے گئے ماخذ میں کہیں ظاہر ہو جسے یہ اسکین کرتا ہے، ایپ، انجن، سرور، ایکسٹینشن اور ٹول پیک کوڈ میں؛
- کوئی تیسرے فریق کا DNS-over-HTTPS ریزولور اس ماخذ میں ظاہر ہو؛
- CA اجراء کا لاگ واپس آئے، ماخذ **یا** تیار کردہ سرور بنڈل میں؛
- رازداری کی پالیسی اپنے قانونی طور پر لازمی بیانات کھو دے (نامزد کنٹرولر، قانونی بنیاد، شکایت کا حق)۔

انہیں کلون میں خود چلائیں (Node 22.18 یا بعد کا؛ اس فائل کو `pnpm install` نہیں چاہیے):

```bash
node --test tests/no-trackers.test.ts
# ✔ no analytics or tracking SDK appears anywhere in shipped source
# ✔ no third-party DNS-over-HTTPS resolver is contacted
# ✔ the certificate service logs no personal data
# ✔ privacy policy states a controller, a legal basis and a right to complain
```

مکمل سوٹ (`pnpm install && pnpm test`) مزید کئی ہزار ٹیسٹس چلاتا ہے، بشمول [Security & Verification](/info/security.html) میں بیان کردہ ایڈورسیریل کرپٹوگرافی ٹیسٹس۔

## جو آپ باہر سے جانچ نہیں سکتے

- **ہوسٹنگ ایکسیس لاگز۔** کوئی بھی سرور جو درخواست کا جواب دے اسے لاگ کر سکتا ہے: IP ایڈریس، راستہ اور وقت۔ باہر سے کی گئی پروب طے نہیں کر سکتی کہ لاگز کتنی دیر رکھے جاتے ہیں۔ آپریٹر لاگنگ، گردش اور ایکسپورٹس کو کنٹرول کرتا ہے، اور اسے وہ انتخاب ظاہر کرنے ہوں گے۔ مقامی رینڈرنگ عام ایڈٹس آپ کی ڈیوائس پر رکھتی ہے؛ اختیاری سرور رینڈرنگ اور مشترکہ ورک اسپیس سروسز کے وہ الگ ڈیٹا بہاؤ ہیں جو رازداری کی پالیسی بیان کرتی ہے۔
- **کہ تعیناتی یہی کوڈ چلاتی ہے۔** آپ جانچ سکتے ہیں کہ ماخذ صاف ہے اور تعینات رویہ اس سے ملتا ہے، اور اوپر کی جانچیں دونوں کرتی ہیں۔ ویب تعیناتی کی بائنری سطح کی تصدیق وہ چیز نہیں جو ویب پلیٹ فارم پیش کرتا ہے۔ تخفیف عوامی ریپوزٹری، نافذ ٹیسٹس اور آف لائن جانچ ہیں: چھیڑ چھاڑ شدہ تعیناتی جو گھر فون کرے وہ جانچ 1 اور 2 میں ایک ساتھ ناکام ہوتی ہے۔
- **ٹول ہکس۔** بلٹ ان ٹول کی اختیاری منطق سینڈ باکس کے بجائے ریویو ہوتی ہے: یہ صفحے میں چلتی ہے جب تک ٹول Worker نہ چنے۔ lolly.tools پر ہر ٹول فرسٹ پارٹی ہے اور بھیجنے سے پہلے ریویو ہوتا ہے۔ [Threat Model](/info/threat-model.html#trust-boundaries) بتاتا ہے کہ ہکس کہاں چلتے ہیں اور انہیں کیا محدود کرتا ہے۔

## اگر کوئی جانچ ناکام ہو جائے

اس صفحے اور آپ کے مشاہدے میں فرق سیکیورٹی رپورٹ ہے۔ اسے [Security & Verification](/info/security.html#reporting-a-vulnerability) کے نجی چینلز سے بھیجیں۔ ہم coordinated disclosure پر عمل کرتے ہیں اور رپورٹ کرنے والوں کو کریڈٹ دیتے ہیں۔
