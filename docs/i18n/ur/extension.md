# براؤزر Extension

**Lolly URL Screenshot** extension ویب ایپ کو آپ کے براؤزر کے اندر سے کسی بھی ویب پیج کا screenshot لینے دیتا ہے۔ اس کے بغیر، کسی URL کو capture کرنے کے لیے desktop ایپ درکار ہوتی ہے - ایک براؤزر پیج خود سے کسی دوسری سائٹ کے pixels نہیں پڑھ سکتا۔ Extension یہ کر سکتا ہے، وہی capture استعمال کرتے ہوئے جو desktop ایپ استعمال کرتی ہے۔

یہ اسی طرح دو اور کام بھی کرتا ہے۔ کسی image slot میں paste کیا گیا ویب ایڈریس اس صفحے کا screenshot بن سکتا ہے (**اس صفحے کا اسکرین شاٹ لیں**)، اور extension آپ کی نامزد کردہ ایک ہی صفحہ پڑھ سکتا ہے تاکہ Brand Studio کسی لائیو ویب سائٹ سے ایک برانڈ نکال سکے۔ ہر درخواست extension میں آپ کی منظوری کا انتظار کرتی ہے۔

یہ Chromium-بنیاد براؤزرز پر چلتا ہے: **Chrome, Edge, Brave, Arc, Opera** - Chrome 111 یا نیا۔

جب تک یہ انسٹال نہیں ہوتا، **URL Screenshot** پھر بھی کھلتا ہے تاکہ آپ ایک shot compose کر سکیں، اور tool کے controls کے اوپر ایک نوٹ بتاتا ہے کہ کیا کمی ہے۔

![The URL Screenshot tool's note offering the extension, shown when capture to file has no host to run on](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%23capture-hint-notice&dark=1&filename=exp-url-shot-notice)

جب تک آپ انتظار کرتے ہیں ہر control فعال رہتا ہے: target URL، scroll depth، settle delay، crop insets اور recolour۔ صرف capture کو ہی ایک host درکار ہے۔

![The URL Screenshot controls with a target URL, scroll depth, settle delay and crop insets, all usable before the extension exists](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot%3Furl%3Dhttps%3A%2F%2Flolly.tools%26scrollDepth%3D0.3%26waitMs%3D1200&width=1440&height=2200&dpi=192&waitMs=2400&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&walker=1&dark=1&filename=fq-url-shot-controls)

## انسٹال کریں

### Chrome Web Store سے

*جلد آ رہا ہے۔* شائع ہونے کے بعد آپ اسے ایک کلک میں انسٹال کریں گے، پھر Lolly reload کریں۔

### خود لوڈ کریں (ڈویلپرز)

Extension repo میں `shells/chrome-extension/` پر موجود ہے۔ یہ فولڈر production build ہے، جو صرف `https://lolly.tools` پر Lolly کے ساتھ کام کرتا ہے۔

1. `chrome://extensions` کھولیں۔
2. **Developer mode** آن کریں (اوپر دائیں طرف)۔
3. **Load unpacked** پر کلک کریں اور `shells/chrome-extension/` فولڈر منتخب کریں۔
4. Lolly reload کریں - **URL Screenshot** اب براؤزر میں کام کرتا ہے۔

مقامی development server کے لیے `pnpm run pack:chrome-extension:dev` چلائیں اور اس کے بجائے `dist/chrome-extension-dev` لوڈ کریں۔ وہ پیکیج `http://localhost:5173` کو بھی قبول کرتا ہے اور اس کے نام میں **Development** ہوتا ہے۔

## یہ کیسے کام کرتا ہے

- ایک چھوٹا script Lolly کو بتاتا ہے کہ extension موجود ہے، تاکہ **URL Screenshot** مزید کسی سیٹ اپ کے بغیر captures محفوظ کر سکے۔
- ہر درخواست کی منظوری آپ دیتے ہیں۔ جب Lolly پوچھتا ہے تو extension اپنی **Approve page request** ونڈو کھولتا ہے، جو درخواست کرنے والی سائٹ، یہ کہ وہ screenshot چاہتی ہے یا صفحے کا مواد، اور صفحے کا ایڈریس دکھاتی ہے۔ جب تک آپ **Approve once** نہ دبائیں کچھ بھی نہیں پڑھا جاتا۔ **Cancel** دبانے یا ونڈو بند کرنے سے درخواست ختم ہو جاتی ہے۔
- کسی سائٹ کی درخواست پہلی بار منظور کرنے پر Chrome یہ بھی پوچھتا ہے کہ کیا extension اس سائٹ تک رسائی حاصل کر سکتا ہے۔ آپ اجازت دے دیں تو Chrome وہ رسائی برقرار رکھتا ہے، لیکن بعد کی ہر درخواست کو پھر بھی اپنا **Approve once** درکار ہوتا ہے۔
- ایک منظوری ایک ہی درخواست کا احاطہ کرتی ہے اور 30 سیکنڈ بعد ختم ہو جاتی ہے۔ ایک وقت میں صرف ایک درخواست انتظار یا عمل کر سکتی ہے، اور منظور شدہ درخواست 55 سیکنڈ بعد رک جاتی ہے۔ اگر Lolly کا صفحہ بند یا تبدیل ہو جائے، یا target صفحہ کسی دوسری سائٹ پر چلا جائے تو درخواست منسوخ ہو جاتی ہے۔
- آپ کی منظوری کے بعد extension ایک background tab میں target پیج کھولتا ہے، اسے DevTools Protocol کے ذریعے capture کرتا ہے (وہی `Page.captureScreenshot` جو desktop ایپ استعمال کرتی ہے)، پھر tab بند کر کے تصویر اُس Lolly tab کو واپس دیتا ہے جس نے پوچھا تھا۔
- یہ مکمل طور پر آپ کے براؤزر میں، آپ کے نیٹ ورک پر چلتا ہے - اس لیے `localhost` یا کسی اندرونی سائٹ کو capture کرنا کام کرتا ہے۔ پیج آپ کے براؤزر سیشن کے ساتھ لوڈ ہوتا ہے، اس لیے جس پیج میں آپ سائن ان ہیں وہ نتیجے میں نجی معلومات دکھا سکتا ہے۔ capture خود کبھی کہیں اپلوڈ نہیں ہوتا؛ واحد نیٹ ورک ٹریفک آپ کے اپنے براؤزر کا اس پیج کو لوڈ کرنا ہے جسے آپ نے shoot کرنے کو کہا۔

جب capture چل رہا ہو تو آپ کو عارضی tab پر مختصر طور پر ایک *"…started debugging this browser"* banner نظر آ سکتا ہے۔ یہ DevTools Protocol کا کام ہے؛ shot مکمل ہونے پر یہ خود صاف ہو جاتا ہے۔

## Brand Studio کے لیے سائٹ پڑھنا

Brand Studio میں **Website** ماخذ ایک ایسی سائٹ سے brand شروع کرتا ہے جو آپ کے پاس پہلے سے موجود ہے۔ Chromium پر extension ہی اسے پڑھتا ہے؛ desktop ایپ پر ایک native fetch وہی کام کرتا ہے اور بغیر extension والے عام براؤزر پر یہ tile سرے سے پیش نہیں کی جاتی۔

جب آپ اسے دباتے ہیں تو کیا ہوتا ہے:

- ایک پتہ، ایک پیج۔ آپ کی منظوری کے بعد extension اسے اسی طرح کے background tab میں کھولتا ہے، رینڈر شدہ markup، stylesheet متن اور چند icon اور logo تصاویر پڑھتا ہے، پھر tab بند کر دیتا ہے۔ یہ links کو follow نہیں کرتا اور crawl نہیں کرتا۔
- کہیں اور hosted stylesheets (ایک CDN، ایک font service) بھی fetch کیے جاتے ہیں، کیونکہ پیج کے رنگ اور type انہی میں ہوتے ہیں۔ Cross-origin درخواستیں آپ کے cookies کے بغیر جاتی ہیں؛ same-origin درخواستیں انہیں استعمال کرتی ہیں، بالکل ویسے ہی جیسے خود پیج کرتا۔
- ہر چیز پر حد لگی ہوئی ہے - sheets، images اور bytes کی ایک محدود تعداد - تاکہ ایک نقصان دہ یا آدھی خراب سائٹ رکنے کے بجائے جزوی مواد واپس کرے۔
- Bytes سیدھے اسی Lolly tab کو واپس جاتے ہیں جس نے پوچھا تھا۔ رنگوں، type اور logos میں parsing آپ کے آلے پر ہوتی ہے؛ کچھ بھی اپلوڈ نہیں ہوتا۔

پتہ paste کرنے سے صرف field بھر جاتا ہے۔ جب تک آپ پڑھنا شروع نہ کریں اور **Approve once** نہ دبائیں کچھ بھی نہیں پڑھا جاتا۔

## انسٹال کرنے کے بعد

Lolly tab reload کریں۔ "Get the extension" prompt غائب ہو جاتا ہے، **URL Screenshot** (یوٹیلیٹیز کے تحت) captures کو فائل میں محفوظ کر سکتا ہے، اور یہ tool Batch mode میں دستیاب ہو جاتا ہے۔

## اجازتیں

اس کا `manifest.json` چار اجازتیں بیان کرتا ہے، نیز سائٹ رسائی جو وہ ایک وقت میں ایک سائٹ کے لیے مانگتا ہے:

- `debugger` - background tab کو DevTools Protocol کے ذریعے چلانا۔ یہی screenshot لیتا ہے۔
- `tabs` - عارضی background tab کھولنا اور بعد میں دوبارہ بند کرنا، اور یہ جانچنا کہ آپ کی منظوری کے بعد نہ Lolly کا صفحہ اور نہ target صفحہ کہیں اور گیا ہے۔
- `scripting` - آپ کے بتائے گئے سائٹ کے اندر one-page reader چلانا، Brand Studio کے Website ماخذ کے لیے۔
- `storage` - اپنے کھولے گئے tab کا id، صرف session storage میں نوٹ کرنا، تاکہ اگر براؤزر extension کو read کے درمیان معطل کر دے تو بھی tab بند ہو جائے۔ اگلی شروعات پر صاف ہو جاتا ہے؛ آپ کے بارے میں کچھ محفوظ نہیں ہوتا۔
- `optional_host_permissions: ["http://*/*", "https://*/*"]` - سائٹ رسائی، جو انسٹال کے وقت نہیں دی جاتی۔ جب آپ **Approve once** دباتے ہیں تو extension Chrome سے اس درخواست کی ایک سائٹ تک رسائی مانگتا ہے، اور Chrome ہر سائٹ کے لیے پہلی بار آپ سے پوچھتا ہے۔

یہ صرف وہ واحد پیج پڑھتا ہے جسے آپ منظور کرتے ہیں، اور یہ آپ کا browsing ڈیٹا نہ پڑھتا ہے نہ منتقل کرتا ہے - کچھ بھی کہیں اپلوڈ نہیں ہوتا۔

Manifest `minimum_chrome_version: 111` بھی مقرر کرتا ہے۔ موجودہ ورژن 0.4.0 ہے۔

## مسئلہ حل

- **ابھی بھی "Get the extension" نظر آ رہا ہے؟** Lolly tab reload کریں - پہچان پیج لوڈ ہونے پر ہوتی ہے۔
- **اس سائٹ پر کچھ نہیں ہو رہا؟** Extension صرف `https://lolly.tools` پر کام کرتا ہے، اور development پیکیج میں `http://localhost:5173` پر بھی۔ کوئی اور origin، مثلاً Lolly کی self-hosted کاپی، کے لیے extension کا الگ build درکار ہے جو اس origin کو `manifest.json` اور `policy.js` دونوں میں درج کرے۔ صرف manifest میں ترمیم کرنا اب کام نہیں کرتا۔
- **Capture ناکام ہو رہا ہے؟** چیک کریں کہ URL قابلِ رسائی ہے اور `http://` یا `https://` سے شروع ہوتا ہے۔ کچھ پیجز automated capture کو فعال طور پر روکتے ہیں۔ اگر آپ نے **Cancel** دبایا، منظوری کی ونڈو بند کی یا 30 سیکنڈ سے زیادہ انتظار کیا تو capture دوبارہ شروع کریں۔
