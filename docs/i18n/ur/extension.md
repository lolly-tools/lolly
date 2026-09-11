# براؤزر Extension

**Lolly URL Screenshot** extension ویب ایپ کو آپ کے براؤزر کے اندر سے کسی بھی ویب پیج کا screenshot لینے دیتا ہے۔ اس کے بغیر، کسی URL کو capture کرنے کے لیے desktop ایپ درکار ہوتی ہے - ایک براؤزر پیج خود سے کسی دوسری سائٹ کے pixels نہیں پڑھ سکتا۔ Extension یہ کر سکتا ہے، وہی capture استعمال کرتے ہوئے جو desktop ایپ استعمال کرتی ہے۔

یہ بالکل اسی طرح ایک اور کام بھی کرتا ہے: آپ کی نامزد کردہ ایک ہی صفحہ پڑھنا تاکہ Brand Studio کسی لائیو ویب سائٹ سے ایک برانڈ نکال سکے۔ دونوں کی تفصیل نیچے دی گئی ہے۔

یہ Chromium-بنیاد براؤزرز پر چلتا ہے: **Chrome, Edge, Brave, Arc, Opera** - Chrome 111 یا نیا۔

جب تک یہ انسٹال نہیں ہوتا، **URL Screenshot** پھر بھی کھلتا ہے تاکہ آپ ایک shot compose کر سکیں، اور tool کے controls کے اوپر ایک نوٹ بتاتا ہے کہ کیا کمی ہے۔

![The URL Screenshot tool's note offering the extension, shown when capture to file has no host to run on](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%23capture-hint-notice&dark=1&filename=exp-url-shot-notice)

جب تک آپ انتظار کرتے ہیں ہر control فعال رہتا ہے: target URL، scroll depth، settle delay، crop insets اور recolour۔ صرف capture کو ہی ایک host درکار ہے۔

![The URL Screenshot controls with a target URL, scroll depth, settle delay and crop insets, all usable before the extension exists](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot%3Furl%3Dhttps%3A%2F%2Flolly.tools%26scrollDepth%3D0.3%26waitMs%3D1200&width=1440&height=2200&dpi=192&waitMs=2400&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&walker=1&dark=1&filename=fq-url-shot-controls)

## انسٹال کریں

### Chrome Web Store سے

*جلد آ رہا ہے۔* شائع ہونے کے بعد آپ اسے ایک کلک میں انسٹال کریں گے، پھر Lolly reload کریں۔

### خود لوڈ کریں (ڈویلپرز)

Extension repo میں `shells/chrome-extension/` پر موجود ہے۔

1. `chrome://extensions` کھولیں۔
2. **Developer mode** آن کریں (اوپر دائیں طرف)۔
3. **Load unpacked** پر کلک کریں اور `shells/chrome-extension/` فولڈر منتخب کریں۔
4. Lolly reload کریں - **URL Screenshot** اب براؤزر میں کام کرتا ہے۔

## یہ کیسے کام کرتا ہے

- ایک چھوٹا script Lolly کو بتاتا ہے کہ extension موجود ہے، جس سے **URL Screenshot** tool خودبخود آن ہو جاتا ہے - کوئی سیٹ اپ نہیں۔
- جب آپ render کرتے ہیں تو extension ایک background tab میں target پیج کھولتا ہے، اسے DevTools Protocol کے ذریعے capture کرتا ہے (وہی `Page.captureScreenshot` جو desktop ایپ استعمال کرتی ہے)، پھر tab بند کر کے تصویر واپس دیتا ہے۔
- یہ مکمل طور پر آپ کے براؤزر میں، آپ کے نیٹ ورک پر چلتا ہے - اس لیے `localhost` یا کسی اندرونی سائٹ کو capture کرنا کام کرتا ہے۔ capture خود کبھی کہیں اپلوڈ نہیں ہوتا؛ واحد نیٹ ورک ٹریفک آپ کے اپنے براؤزر کا اس پیج کو لوڈ کرنا ہے جسے آپ نے shoot کرنے کو کہا۔

جب capture چل رہا ہو تو آپ کو عارضی tab پر مختصر طور پر ایک *"…started debugging this browser"* banner نظر آ سکتا ہے۔ یہ DevTools Protocol کا کام ہے؛ shot مکمل ہونے پر یہ خود صاف ہو جاتا ہے۔

## Brand Studio کے لیے سائٹ پڑھنا

Brand Studio میں **Website** ماخذ ایک ایسی سائٹ سے brand شروع کرتا ہے جو آپ کے پاس پہلے سے موجود ہے۔ Chromium پر extension ہی اسے پڑھتا ہے؛ desktop ایپ پر ایک native fetch وہی کام کرتا ہے اور بغیر extension والے عام براؤزر پر یہ tile سرے سے پیش نہیں کی جاتی۔

جب آپ اسے دباتے ہیں تو کیا ہوتا ہے:

- ایک پتہ، ایک پیج۔ Extension اسے اسی طرح کے background tab میں کھولتا ہے، رینڈر شدہ markup، stylesheet متن اور چند icon اور logo تصاویر پڑھتا ہے، پھر tab بند کر دیتا ہے۔ یہ links کو follow نہیں کرتا اور crawl نہیں کرتا۔
- کہیں اور hosted stylesheets اور fonts (ایک CDN، ایک font service) بھی fetch کیے جاتے ہیں، کیونکہ پیج کے رنگ اور type انہی میں ہوتے ہیں۔ Cross-origin درخواستیں آپ کے cookies کے بغیر جاتی ہیں؛ same-origin درخواستیں انہیں استعمال کرتی ہیں، بالکل ویسے ہی جیسے خود پیج کرتا۔
- ہر چیز پر حد لگی ہوئی ہے - sheets، images اور bytes کی ایک محدود تعداد - تاکہ ایک نقصان دہ یا آدھی خراب سائٹ رکنے کے بجائے جزوی مواد واپس کرے۔
- Bytes سیدھے اسی Lolly tab کو واپس جاتے ہیں جس نے پوچھا تھا۔ رنگوں، type اور logos میں parsing آپ کے آلے پر ہوتی ہے؛ کچھ بھی اپلوڈ نہیں ہوتا۔

جب تک آپ دبائیں نہیں کچھ بھی نہیں پڑھا جاتا۔ پتہ paste کرنے سے صرف field بھر جاتا ہے۔

## انسٹال کرنے کے بعد

Lolly tab reload کریں۔ "Get the extension" prompt غائب ہو جاتا ہے اور **URL Screenshot** gallery اور Batch mode میں دستیاب ہو جاتا ہے۔

## اجازتیں

اس کا `manifest.json` چار اجازتیں نیز host رسائی بیان کرتا ہے:

- `debugger` - background tab کو DevTools Protocol کے ذریعے چلانا۔ یہی screenshot لیتا ہے۔
- `tabs` - عارضی background tab کھولنا اور بعد میں دوبارہ بند کرنا۔
- `scripting` - آپ کے بتائے گئے سائٹ کے اندر one-page reader چلانا، Brand Studio کے Website ماخذ کے لیے۔
- `storage` - اپنے کھولے گئے tab کا id، صرف session storage میں نوٹ کرنا، تاکہ اگر براؤزر extension کو read کے درمیان معطل کر دے تو بھی tab بند ہو جائے۔ اگلی شروعات پر صاف ہو جاتا ہے؛ آپ کے بارے میں کچھ محفوظ نہیں ہوتا۔
- `host_permissions: ["<all_urls>"]` - *تمام* سائٹس تک host رسائی، کیونکہ آپ اسے کسی بھی URL کی طرف اشارہ کر سکتے ہیں جو آپ چنیں۔ Chrome انسٹال کے وقت اسے ایک وسیع "read and change all your data on all websites" انتباہ کے طور پر دکھاتا ہے۔

اس انتباہ کے باوجود، یہ صرف وہ واحد پیج پڑھتا ہے جسے آپ نے capture یا import کرنے کو کہا، اور یہ آپ کا browsing ڈیٹا نہ پڑھتا ہے نہ منتقل کرتا ہے - کچھ بھی کہیں اپلوڈ نہیں ہوتا۔

Manifest `minimum_chrome_version: 111` بھی مقرر کرتا ہے۔ موجودہ ورژن 0.2.1 ہے۔

## مسئلہ حل

- **ابھی بھی "Get the extension" نظر آ رہا ہے؟** Lolly tab reload کریں - پہچان پیج لوڈ ہونے پر ہوتی ہے۔
- **اس سائٹ پر کچھ نہیں ہو رہا؟** Extension صرف Lolly کے اپنے origins پر فعال ہوتا ہے۔ کسی دوسرے domain پر custom build چلا رہے ہیں؟ اسے extension کے `manifest.json` میں `content_scripts.matches` میں شامل کریں۔
- **Capture ناکام ہو رہا ہے؟** چیک کریں کہ URL قابلِ رسائی ہے اور `http://` یا `https://` سے شروع ہوتا ہے۔ کچھ پیجز automated capture کو فعال طور پر روکتے ہیں۔
