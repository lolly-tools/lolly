# بلڈرز کے لیے Lolly

تکنیکی دستاویزات - ہر اُس شخص کے لیے جو ٹولز تصنیف کرتا ہے، Lolly کو کسی پائپ لائن میں مربوط کرتا ہے، اسے خود ہوسٹ کرتا ہے، یا پلیٹ فارم کو وسعت دیتا ہے۔

**اِس میں آپ کے لیے کیا ہے۔** ایک بار ٹول بنا لیں اور وہی درخواست بار بار آپ کے پاس آنا بند ہو جاتی ہے۔ "کیا آپ مجھے بس ایک… بنا دیں گے" جیسی تکراری فرمائش جو آپ کی دوپہریں کھا جاتی ہے، ایک ٹیمپلیٹ بن جاتی ہے جسے دوسرے لوگ خود بھرتے ہیں - درست طریقے سے، آپ کو درمیان میں لائے بغیر۔ آپ کا کام سادہ HTML/CSS/JS ہے: ورژن کنٹرولڈ، قابلِ diff، قابلِ جائزہ، اور ایک کھلے انجن پر چلتا ہے جس میں کوئی وینڈر لاک اِن نہیں، سو یہ آپ ہی کا رہتا ہے۔ پروڈکشن رن کو خودکار بنا دیں اور آپ کا وقت دلچسپ مسئلے کو جاتا ہے، دس ہزارویں ایکسپورٹ کو نہیں۔

Lolly ایک پلیٹ فارم سے آزاد **انجن** ہے جو کئی **شیلز** (web PWA، Tauri ڈیسک ٹاپ/موبائل، CLI، TUI) میں یکساں رینڈر پاتھ چلاتا ہے۔ ٹولز **کوڈ نہیں بلکہ ڈیٹا ہیں** - ایک مینی فیسٹ جمع ایک ٹیمپلیٹ جمع اختیاری hooks - سو نئے ٹولز کسی ایپ اپ ڈیٹ کے بغیر آتے ہیں۔ آرکیٹیکچر کے لیے [جائزہ](/info/overview.html) سے شروع کریں، پھر وہ ٹریک اپنائیں جو آپ کی تعمیر سے میل کھاتا ہے۔

پلیٹ فارم پر نئے ہیں؟ گہرائی میں جانے سے پہلے **[کوئیک اسٹارٹ](/info/quickstart.html)** ایک برانڈ اور آپ کا پہلا رینڈر اپنی جگہ لے آتا ہے۔

## آرکیٹیکچر کو سمجھیں



- **[جائزہ](/info/overview.html)** - Lolly کیوں وجود رکھتا ہے، engine/shell/tools کی علیحدگی، capability bridge، اور طے شدہ آرکیٹیکچرل وابستگیاں۔
- **[ڈیزائن ٹوکنز](/info/design-tokens.html)** - وہ DTCG ٹوکن ماڈل جس میں برانڈز کا اظہار ہوتا ہے، اور ٹولز اُنہیں کیسے استعمال کرتے ہیں۔

## ٹولز تصنیف کریں

نیچے دکھایا گیا ہر کنٹرول `tool.json` میں بیان کیے گئے کسی ان پٹ سے تیار ہوا ہے۔ آپ مینی فیسٹ کی لائن لکھتے ہیں، ہوسٹ ویجٹ بناتا ہے، اور وہی ماڈل CLI اور URL کو بھی چلاتا ہے۔

![One declared input, one generated control: a url, a colour, a select, a number, a boolean](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code&width=1440&height=900&dpi=192&waitMs=2000&cropSelector=.tool-inputs&walker=1&format=svg&dark=1&filename=aud-manifest-controls)

یہ پانچ کنٹرولز سے کہیں آگے تک پھیلتا ہے۔ کسی ان پٹ کو `section` دیں اور ہوسٹ اسے سمیٹ دیتا ہے، چنانچہ D3 Chart Studio جیسا پچاس ان پٹ والا ٹول بھی ایک مختصر فہرست کی صورت میں کھلتا ہے اور باقی سب نام والے گروپوں کے پیچھے ترتیب سے رہتا ہے۔

![The D3 sidebar - a handful of primary controls, then Data, Columns, Chart, Axes and the other sections collapsed into one line each](/t/url-shot?url=%2F%23%2Ftool%2Fchart&width=1440&height=1600&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-d3-sections)

- **[ٹولز کی تصنیف](/info/authoring-tools.html)** - مکمل رہنما: مینی فیسٹ، ٹیمپلیٹ، اسٹائلز، hooks، کمپوزیشن، اور اشاعت۔
- **[ایسیٹس کی تصنیف](/info/authoring-assets.html)** - کیٹلاگ ایسیٹس، ٹئیرز، لوکیلز، پیلیٹس، تھیم ایبل آئیکنز، اور فونٹس۔
- **[Host API](/info/host-api.html)** - `HostV1` capability bridge جس کے مطابق ہر ٹول لکھا جاتا ہے (واحد API جو ٹولز دیکھتے ہیں)۔
- **[URL موڈ](/info/url-mode.html)** - ہر ان پٹ بطور URL پیرامیٹر؛ محفوظ params، compact encoding، پیک شدہ لنکس۔

## چلائیں اور مربوط کریں

- **[CLI](/info/cli.html)** - headless رینڈرنگ؛ GUI جیسا ہی رینڈر پاتھ، `--foo=bar` argv سے چلایا گیا۔
- **[TUI](/info/tui.html)** - انٹرایکٹو ٹرمینل شیل۔
- **[MCP سرور](/info/mcp.html)** - وہ نیٹو اینڈ پوائنٹ جو کسی AI ایجنٹ کو ٹولز دریافت کرنے اور چلانے دیتا ہے۔
- **[AI ایجنٹس](/info/ai-agents.html)** - Lolly کو کسی ماڈل سے چلانا: URL ہی API ہے۔
- **[Chrome ایکسٹینشن](/info/extension.html)** - کسی لائیو URL کو قابلِ استعمال ایسیٹ کے طور پر کیپچر کریں۔

## اسے شپ اور آپریٹ کریں

- **[بلڈ گائیڈ](/info/build-guide.html)** - ہر ٹارگٹ بنائیں: CLI، TUI، ڈیسک ٹاپ، موبائل۔
- **[ڈیپلائمنٹ](/info/deployment.html)** - ویب ایپ، ایپس، اور بیک اینڈ سروسز؛ ہر جزو کہاں چلتا ہے۔
- **[کنفیگریشن](/info/configuration.html)** - پروفائلز، برانڈ پیکس، capability gating، فیچر فلیگز، اور کیٹلاگ ویلیڈیشن۔

## اعتماد اور ڈیٹا

حقوق اور تصنیف بھی باقی سب کی طرح ان پٹ ہی ہیں۔ Embed & Track Image تخلیق کار، کاپی رائٹ، لائسنس اور رابطے کے خانے بیان کرتا ہے، اور ایکسپورٹ اُنہیں فائل کے اپنے میٹا ڈیٹا اور اُس کے C2PA مینی فیسٹ میں لکھ دیتا ہے۔

![The Embed and Track Image controls - creator, copyright, a licence dropdown, contact and title, filled from the link](/t/url-shot?url=%2F%23%2Ftool%2Fclaim%3Fcreator%3DAda%2520Lovelace%26title%3DEngine%2520Notes&width=1440&height=1200&dpi=192&waitMs=2200&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-rights-fields)

- **[Content Credentials Identity](/info/content-credentials-identity.html)** - آن ڈیوائس C2PA کے لیے CA سے جاری کردہ سائننگ؛ engine کنٹریکٹس اور آپریٹر رن بک۔
- **[ڈیٹا ٹرانسفر](/info/data-transfer.html)** - `lolly-backup` بنڈل: اینویلپ، سالمیت، اور کراس شیل ضمانتیں۔
- **[بابت](/info/about.html)** - پروجیکٹ، اس کی لائسنس حد، اور ریپازٹری۔
