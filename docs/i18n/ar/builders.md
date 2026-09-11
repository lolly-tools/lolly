# Lolly للبنائين

الوثائق التقنية - لكل من يؤلف الأدوات، أو يدمج Lolly في خط إنتاج آلي، أو يستضيفه ذاتيا، أو يوسع المنصة.

**ما الذي ستجنيه أنت.** ابن أداة مرة واحدة فيتوقف الطلب عن العودة إليك. عبارة «هلا صنعت لي...» المتكررة التي تلتهم فترات ما بعد الظهيرة لديك تصبح قالبا يملؤه الآخرون بأنفسهم - بشكل صحيح، ومن دونك في الحلقة. عملك HTML/CSS/JS عادي: مدار بالإصدارات، وقابل للمقارنة والمراجعة، ويعمل على محرك مفتوح بلا احتكار مورد، فيبقى ملكك. أتمت جولة الإنتاج فيذهب وقتك إلى المشكلة المثيرة، لا إلى التصدير رقم عشرة آلاف.

Lolly **محرك** محايد تجاه المنصات يشغل مسار التصيير نفسه عبر عدة **أغلفة** (ويب PWA، وTauri لسطح المكتب/الهاتف، وCLI، وTUI). والأدوات **بيانات، لا كود مضمن** - بيان تعريف مع قالب مع خطافات اختيارية - فتشحن الأدوات الجديدة من دون تحديث للتطبيق. ابدأ بـ[نظرة عامة](/info/overview.html) للبنية، ثم اتبع المسار الذي يناسب ما تبنيه.

جديد على المنصة؟ **[البدء السريع](/info/quickstart.html)** يجهز علامة تجارية وأول تصيير لك قبل أن تتعمق.

## افهم البنية



- **[نظرة عامة](/info/overview.html)** - لماذا وجد Lolly، وفصل المحرك/الأغلفة/الأدوات، وجسر القدرات، والالتزامات المعمارية المستقرة.
- **[رموز التصميم](/info/design-tokens.html)** - نموذج رموز DTCG الذي تعبر به العلامات التجارية، وكيف تستهلكه الأدوات.

## ألف الأدوات

كل عنصر تحكم أدناه أنشئ من مدخل معلن في `tool.json`. أنت تكتب سطر بيان التعريف، والمضيف يرسم عنصر الواجهة، والنموذج نفسه يقود CLI والرابط.

![One declared input, one generated control: a url, a colour, a select, a number, a boolean](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code&width=1440&height=900&dpi=192&waitMs=2000&cropSelector=.tool-inputs&walker=1&format=svg&dark=1&filename=aud-manifest-controls)

وهذا يتوسع إلى ما يتجاوز خمسة عناصر تحكم. أعط المدخل `section` فيطويه المضيف، وبذلك تبقى أداة بخمسين مدخلا مثل D3 Chart Studio تفتح كقائمة قصيرة، والبقية مرتبة خلف مجموعات مسماة.

![The D3 sidebar - a handful of primary controls, then Data, Columns, Chart, Axes and the other sections collapsed into one line each](/t/url-shot?url=%2F%23%2Ftool%2Fchart&width=1440&height=1600&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-d3-sections)

- **[تأليف الأدوات](/info/authoring-tools.html)** - الدليل الكامل: بيان التعريف، والقالب، والأنماط، والخطافات، والتركيب، والنشر.
- **[تأليف الأصول](/info/authoring-assets.html)** - أصول الكتالوج، والمستويات، واللغات المحلية، ولوحات الألوان، والأيقونات المتوافقة مع السمات، والخطوط.
- **[واجهة المضيف](/info/host-api.html)** - جسر القدرات `HostV1` الذي تكتب كل أداة استنادا إليه (الواجهة الوحيدة التي تراها الأدوات).
- **[وضع URL](/info/url-mode.html)** - كل مدخل كمعامل URL؛ المعاملات المحجوزة، والترميز المضغوط، والروابط المحزومة.

## شغل وكامل

- **[CLI](/info/cli.html)** - تصيير من دون واجهة؛ مسار التصيير نفسه كالواجهة الرسومية، تقوده معاملات `--foo=bar` في argv.
- **[TUI](/info/tui.html)** - غلاف الطرفية التفاعلي.
- **[خادم MCP](/info/mcp.html)** - نقطة النهاية الأصلية التي تتيح لوكيل ذكاء اصطناعي اكتشاف الأدوات وتشغيلها.
- **[وكلاء الذكاء الاصطناعي](/info/ai-agents.html)** - قيادة Lolly من نموذج: الرابط هو الواجهة البرمجية.
- **[امتداد Chrome](/info/extension.html)** - التقط عنوان URL حيا كأصل قابل لإعادة الاستخدام.

## اشحنه وشغله

- **[دليل البناء](/info/build-guide.html)** - ابن كل الأهداف: CLI وTUI وسطح المكتب والهاتف.
- **[النشر](/info/deployment.html)** - تطبيق الويب، والتطبيقات، وخدمات الواجهة الخلفية؛ وأين يعمل كل جزء.
- **[الإعداد](/info/configuration.html)** - ملفات التعريف، وحزم العلامات التجارية، وبوابات القدرات، وأعلام الميزات، والتحقق من الكتالوج.

## الثقة والبيانات

الحقوق ونسبة التأليف مدخلات كغيرها. تعلن Embed & Track Image حقول المنشئ وحقوق النشر والترخيص وجهة الاتصال، والتصدير يكتبها في البيانات الوصفية للملف نفسه وفي بيان C2PA الخاص به.

![The Embed and Track Image controls - creator, copyright, a licence dropdown, contact and title, filled from the link](/t/url-shot?url=%2F%23%2Ftool%2Fclaim%3Fcreator%3DAda%2520Lovelace%26title%3DEngine%2520Notes&width=1440&height=1200&dpi=192&waitMs=2200&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-rights-fields)

- **[هوية Content Credentials](/info/content-credentials-identity.html)** - توقيع صادر عن مرجع إصدار (CA) لاعتمادات C2PA على الجهاز؛ عقود المحرك ودليل التشغيل للمشغلين.
- **[نقل البيانات](/info/data-transfer.html)** - حزمة `lolly-backup`: الغلاف، والسلامة، والضمانات عبر الأغلفة.
- **[حول المشروع](/info/about.html)** - المشروع، وحدود ترخيصه، والمستودع.
