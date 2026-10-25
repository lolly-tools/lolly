# الإعدادات

الإعدادات هي حيث تغيّر كيف يعمل Lolly لأجلك: تفاصيلك ونظام التصميم الذي تستخدمه وإمكانية الوصول وما هو مخزن على هذا الجهاز وما هو جاهز دون اتصال. افتحها بـ **Settings** في الشريط أسفل الشاشة الرئيسية، أو من قائمة صورتك الرمزية. تُفتح على **Preferences**، مع أربعة تبويبات أخرى بجانبها.

| التبويب | العنوان | ما يحتويه |
|---|---|---|
| **Preferences** | `#/settings` | تفاصيلك وأنظمة التصميم والمظهر والإيموجي وإمكانية الوصول والاتصالات والتخزين وتنزيلات العمل دون اتصال |
| **This device** | `#/settings?tab=device` | قراءة حية لهذا المتصفح وهذا الجهاز، مع الصوت وعرض تخزين للقراءة فقط |
| **Design system** | `#/settings?tab=brand` | نظام التصميم النشط غلافاً وصفحات، مع شريط أغلفة لتبديل الأنظمة |
| **Capabilities** | `#/settings?tab=caps` | كل ما يستطيع Lolly فعله، بطاقات قابلة للبحث |
| **Activity & stats** | `#/settings?tab=activity` | الفهرس وعدّاداتك المحلية والعمل الأخير |

لكل تبويب عنوانه الخاص، وما زالت روابط `#/profile` و`#/d` القديمة تفتح المكان الصحيح، حتى الإعدادات الفردية.

## Preferences

Preferences صفحة طويلة واحدة بـ **شريط إعدادات** على الجانب وحقل **Search settings** فوق الشريط يرشّحه أثناء الكتابة. يُفتح كل قسم مباشرة من رابط بالشكل `#/settings?focus=<section-id>`، مثل `#/settings?focus=storage-section`.

- <!--i:usercheck--> **Your details** - اسمك وتفاصيل اتصالك وصورتك الشخصية ومفتاح **Use my details to create**. يشرح [الملفات الشخصية](/info/profile.html) كيف تستخدمها الأدوات.
- <!--i:seal--> **Content Credentials** - الهوية الموثّقة الاختيارية التي توقّع تصديراتك. راجع [Content Credentials](/info/content-credentials-identity.html).
- <!--i:palette--> **Design systems** - بدّل أنظمة التصميم أو أضفها أو أخفها أو أزلها. يغطي [Design System Setup](/info/brand-studio.html#manage-your-design-systems) كل إجراء.
- <!--i:moon--> **Appearance** - السمة (Light أو Dark أو Brand، التي تطلي التطبيق بلوحتك) و**Interface follows the design system**.
- <!--i:sparkle--> **Emoji** - المجموعة التي ترسم منها الإيموجي عندما تبدأ شيئاً جديداً، مع ترخيص أعمالها الفنية، ومدى إعادة تلوينها بلوحتك (**Off** أو **Subtle** أو **Strong** أو **Full** أو **Mono** أو **Duotone**). يترك **Keep skin tones and flags** تلك بألوانها الخاصة. والعمل الذي صنعته سابقاً يحتفظ بالمجموعة التي صُنع بها.
- <!--i:eyeoff--> **Accessibility** - أربعة مفاتيح راحة، إضافة إلى Sound وNeurospicy Mode. راجع [إمكانية الوصول](#accessibility).
- <!--i:link--> **Connected services** - التخزين الذي تربطه، مثل Dropbox أو Google Drive أو OneDrive أو Nextcloud أو S3، و**Sync across devices**. راجع [زامن أجهزتك](/info/sync.html).
- <!--i:globe--> **Trusted sites** - المواقع التي يجوز لصندوق صفحة ويب في Design أو عرض Sandbox الاتصال بها دون سؤال، وحيث يقدمه الخادم، **Allow pages from any site**. وتسرد [سياسة الخصوصية](/info/privacy.html) ما يرسله كل طلب.
- <!--i:download--> **Your renders** - يحتفظ **Save my renders to my library** بنسخة من كل صورة ومقطع صوتي وفيديو تنزّله في Assets، تحت وسم Renders.
- <!--i:database--> **Storage** - ما يحتفظ به Lolly على هذا الجهاز، والأزرار التي تمسح بياناتك أو تنقلها. راجع [التخزين](#storage).
- <!--i:cpu--> **Available offline** - نزّل ما تحتاج إليه قبل أن تفقد الاتصال. راجع [Available offline](#available-offline).
- <!--i:folder--> **Hot folder** - في تطبيق سطح المكتب، راقب مجلداً واحداً واسحب إلى Lolly كل ما يُسقط فيه، عبر المنتقي نفسه الذي يحصل عليه السحب والإفلات.
- <!--i:clock--> **Your activity** - ما صنعته على هذا الجهاز، محسوباً محلياً.
- <!--i:sliders--> **Feature flags** - شغّل أجزاء من التطبيق أو أوقفها، مثل **Print preflight** أو **Strip metadata from uploads**.
- <!--i:server--> **Lolly instance** - من أين يحصل هذا التثبيت على أدواته وفهرسه. راجع [Lolly instance](#lolly-instance).

بطاقات السمات معاينات حية وتُطبَّق لحظة تختار واحدة، على هذا الجهاز فقط.

![ثلاث بطاقات سمات (themes)، تعرض كل واحدة نوعها ولونها الخاصين، مع تمييز السمة النشطة](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dappearance-section&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

### إمكانية الوصول

يحتوي **Settings → Preferences → Accessibility** أربعة إعدادات راحة للتطبيق المحيط بعملك. كل منها متوقف حتى تشغّله، ولا يصل أي منها إلى داخل لوحة أداة أو تصدير، فلا يحرّك تطبيق أهدأ بكسلاً من الملف الذي تسلّمه.

- <!--i:pause--> يوقف **Reduce motion** انتقالات التطبيق وانزلاقاته وزخارفه. وتواصل لوحتك وأي تصدير متحرك الحركة كما صُمم.
- <!--i:photos--> يستبدل **Hide colourful previews** رسوم معاينات المعرض ببطاقات هادئة من أيقونة ونص، ويخفف الصور المصغرة للمشاريع لتبقى معروفة دون صخب.
- <!--i:sliders--> يقوّي **High contrast** حدود التطبيق ونصه وحلقات التركيز. وتبقى ألوان علامتك واللوحة كما ضبطتها.
- <!--i:font--> يكبّر **Large text** تسميات التطبيق وقوائمه ونص أزراره. والخط داخل تصاميمك لا يُمس، فلا يعاد تدفق شيء مما تصدّره.

تعيش هذه الإعدادات في ملفك الشخصي، فتسافر في تصدير الملف الشخصي وتصل على التثبيت التالي مع اسمك وجلساتك. وتطبقها نسخة صغيرة على الجهاز فقط قبل أول رسم.

تحتوي البطاقة نفسها **Sound**، طبقة لطيفة من الأصوات المساعدة لما تفعله (الوصول إلى المعرض، ونتيجة Content Credentials، وإغلاق لوحة)، و**Neurospicy Mode**، مقطع تركيز هادئ. تشغيل Neurospicy يفتح مشغّلاً صغيراً في الزاوية يتبعك عبر التطبيق. تختار هناك مقطعاً وتتخطى وتضبط مستوى الصوت وتصغّر المشغّل أو تغلقه. تشمل المقاطع ألحان *Lolly Sings* الإجرائية وحلقات محيطية وإيقاعات وصوتك الخاص ومحطات راديو الإنترنت، وهذه تحتاج إلى اتصال. كلاهما متوقف افتراضياً ومحفوظ، وإيقاف Sound يكتم مقطع التركيز أيضاً. وتحمل قائمة الملف الشخصي و**This device** المفتاح نفسه.

يمكن التنقل في الواجهة بلوحة المفاتيح، وتحمل عناصر التحكم المخصصة تسميات لقارئات الشاشة، وتُعرض المعاينة الحية لكل أداة كصورة واحدة معنونة تصف ما تعرضه.

### التخزين

يحصي مقياس التخزين كل بايت يحتفظ به هذا التثبيت، فئة فئة، مقابل ما يبلّغ عنه المتصفح.

![مقياس التخزين، يفصّل الجلسات المحفوظة والصور وذاكرة التخزين المؤقت مقابل ما يبلّغ عنه المتصفح فعلاً](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

تحت المقياس:

- يحتوي **Move to another device** على **Export my data** و**Import data…** و**Export my data & render everything**. يمشي بك [انقل عملك إلى جهاز آخر](/info/find-your-work.html#move-your-work-to-another-device) خلالها.
- يسقط **Clear cache** ملفات الفهرس المنزّلة، وتُنزَّل مجدداً عند الحاجة.
- يحرر **Remove automatic checkpoints older than 30 days** مساحة History ويُبقي الإصدارات المحفوظة والمسماة.
- يزيل **Clear all my data** كل ما يحتفظ به Lolly في هذا المتصفح، بعد أن تكتب كلمة للتأكيد. يسرد [إذا مسحت بيانات متصفحك](/info/find-your-work.html#if-you-clear-your-browser-data) ما يذهب.

### Available offline

يخزّن Lolly الشاشات مؤقتاً أثناء زيارتك لها، وهذا لا يغطي إلا حيث ذهبت بالفعل. **Available offline** للرحلة التي تراها قادمة: نزّل الأجزاء التي ستحتاج إليها وراقب شريط تقدم واحداً، ويواصل كل ما أخذته العمل دون اتصال.

- <!--i:monitor--> **App, catalogue and guides** - **The app** (كل عرض ومحرر وخط، بما فيها الشاشات التي لم تفتحها قط) و**Catalogue** (كله، أو **Choose by tag**) و**Guides & docs** (هذه الوثائق بلغتك، بما فيها لقطات الشاشة).
- <!--i:cpu--> **AI models** - كل نموذج على الجهاز في صفه مع حجمه: Speech voices وUpscaling models وBackground removal وText recognition وVerify deep scan وDurable credential وRewriter model وAsk matching model وAI text detector وSinging voices. ويُعلَّم النموذج الذي يتجاوز 50 MB بـ **large download**.
- <!--i:wrench--> **Tools** - تُنزَّل كل أداة وحدها، أو يأخذ **Download all** كل الأدوات. تعني العلامة أنها جاهزة دون اتصال.

يأخذ **Download everything** في الأعلى التطبيق ونطاق الفهرس الذي اخترته والأدلة وكل الأدوات. حدد **Include all the AI models** لإضافة النماذج، أو نزّل نموذجاً من صفه؛ وأصوات الغناء لا تُنزَّل إلا من صفها. ويمكن لسياسة مؤسسة أن توقف تنزيلات الذكاء الاصطناعي، وتخبرك الصفوف عندئذ.

تستأنف التنزيلات من حيث توقفت إذا ألغيت أو فقدت الاتصال، وتحدّث نفسها عندما تعود متصلاً، فتجلب فقط ما غيّره إصدار. وإذا لم يمنح المتصفح تخزيناً دائماً، يطلبه **Protect downloads**: هو الفرق بين "منزَّل" و"منزَّل إلى أن يريد المتصفح المساحة مجدداً".

### Lolly instance

يقول **Lolly instance** من أين يحصل هذا التثبيت على أدواته وفهرسه: عنوان نسخة، أو *Bundled with this app* عندما يأتي كل شيء داخل البناء.

- يبيّن **Design-system source** من أين يأتي نظام التصميم المقدَّم.
- يفتح **Instance console** صفحات إدارة النشر، حيث يقدمها.
- يوجّه **Change** تطبيق سطح المكتب إلى نسخة أخرى. لا يستطيع المتصفح تحميل الأدوات والأصول عبر الأصول، فيقدم القسم على الويب **Open a workspace** بدلاً من ذلك.
- يزيل **Leave** نظام تصميم النسخة وأدواتها وفهرسها، ويبقى عملك الخاص. راجع [استخدم Lolly في مؤسستك](/info/organisation.html#leaving).
- عندما تكون مسجلاً الدخول إلى مؤسسة، ينهي **Sign out** هذه الجلسة وينهي **Sign out everywhere** جلساتك على كل جهاز، بما فيه هذا.

## هذا الجهاز

- <!--i:monitor--> **This Machine** - الشاشة والإدخال والرسوميات والذاكرة والمرمّزات وواجهة التخزين وغيرها، تُقرأ حية من هذه الجلسة. لا يُخزَّن شيء ولا يُرسل شيء. يُفتح من تلقاء نفسه على الشاشة العريضة، حيث يرتب التبويب نفسه في عمودين.
- <!--i:neurobeat--> **Sound** - أصوات الواجهة وحلقات تركيز Neurospicy، وهو المفتاح الوحيد في هذا التبويب الذي يكتب أي شيء.
- <!--i:database--> **Storage** - عرض للقراءة فقط للمقياس في [Preferences](#storage)، وهو حيث تمسح بياناتك أو تنقلها.

## نظام التصميم

نظام التصميم النشط، مرتباً للقراءة. عندما يحتفظ هذا المتصفح بنظامَي تصميم أو أكثر، يسردها شريط أغلفة صغيرة في الأعلى: اختر واحداً لجعله نشطاً، ويعيد **Undo** في الإشعار التالي السابق.

![تبويب Design system على Lolly Demo: شريط أغلفة لتبديل الأنظمة، ثم الغلاف بشعاره واسمه وملاحظته وأعداد تفتح كل صفحة](/t/url-shot?url=%2F%23%2Fsettings%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=2400&format=svg&walker=1&dark=1&filename=settings-design-system)

يُفتح التبويب على غلاف مطلي بألوان النظام نفسه، بشعاره واسمه بوجه العرض وملاحظة كتبها مؤلفه. يربط سطر أعداد على الغلاف بكل صفحة:

- <!--i:palette--> **Colour** - السطح والنص والأساسي والثانوي للمظهرين الفاتح والداكن، وكل لون مسمى شريحة باسمه وست عشريه، وشريط لكل متدرج ظلال وطيف المخططات، وأدوار الألوان في طية. حدد قيمة لنسخ الست عشري.
- <!--i:font--> **Type** - Headings وText وEmphasis وCode، كل منها بوجهه الخاص.
- <!--i:photos--> **Logos** - كل ملف شعار على الأرضية التي صُنع لها.
- <!--i:layers--> **Colourways** - الزوج الفاتح والداكن لكل طقم ألوان، عندما يملك النظام أكثر من واحد.
- <!--i:sliders--> **Tokens** - نصف القطر والتباعد والتأثيرات والتدرجات.
- <!--i:document--> **Print & CMYK** - الألوان المقفلة على حبر دقيق، وظروف الطباعة التي يستطيع PDF بـ CMYK إعلانها.

التبديل هو التغيير الوحيد الذي يجريه هذا التبويب. تحرر نظام التصميم في [Design System Setup](/info/brand-studio.html) على `#/start`، الذي يرتبط به الغلاف. والنظام للقراءة فقط يقول ذلك على غلافه؛ وتظل الأنظمة المحلية التي تنشئها قابلة للتحرير. `/b` و`/brand` رابطان مختصران مباشران إلى هذا التبويب.

## Capabilities

كل جزء من المنصة مكتوب في بطاقة، في اثنتي عشرة مجموعة: Experiences وPlatforms & runtimes وAccessibility & languages وExport formats وImport formats وPrint production وAutomation & AI وDeterminism & reproducibility وBrand & design system وPrivacy & data ownership وSecurity & access control وArchitecture (for builders). تنطوي كل مجموعة وتعرض عدد بطاقاتها. وتُفتح البطاقة في مربع حوار بميزات تلك القدرة، ولنحو نصفها، لقطة الشاشة التي تستخدمها هذه الوثائق.

يرشّح حقل البحث فوق المجموعات البطاقات أثناء الكتابة ويفتح أي مجموعة ما زالت تحتوي مطابقة. ويقول كم قدرة يبحث فيها، والاستعلام بلا مطابقة يقول ذلك بالكلمات.

هذا التبويب توثيق مكتوب لما يستطيع Lolly فعله، يُبقى متسقاً مع هذه الأدلة. لا يفحص الجهاز الذي أنت عليه؛ **This device** يفعل ذلك.

## Activity & stats

البناء أولاً: كم أداة محمّلة، وكم صيغة تصدير موجودة، وعلى كم سطحاً تعمل المنصة، وكم أصل علامة يحمل الفهرس، مع لوحة **Catalogue** تفصّل ما يُشحن في هذا البناء.

ثم جانبك أنت: يحصي **Your activity** ما صنعته على هذا الجهاز، و**Recent creations** و**Latest exports** مكدسان يمكنك تمريرهما، يظهر كل منهما بمجرد وجود ما يُعرض. كلاهما يفتح عنصراً كما كان. تبقى هذه العدادات على الجهاز؛ وتحتفظ نسخة Lolly Work الاختيارية بـ[سجلات القياس عن بعد والتدقيق للمؤسسة](/info/privacy.html#organisation-services-with-lolly-work) الخاصة بها.

## الروابط العميقة

لكل تبويب وقسم في Settings رابطه الخاص، الذي يمكنك وضع إشارة مرجعية عليه أو لصقه. يوجّه [البحث](/info/search.html) نتائج **Settings** إلى السجل نفسه الذي يُرسم منه Settings، فلا يمكن إعادة تسمية قسم من تحت نتيجة بحث.

::: details كل شكل من الروابط

- **تبويب:** `#/settings?tab=brand` و`#/settings?tab=caps` و`#/settings?tab=device` و`#/settings?tab=activity`.
- **قسم في Preferences:** `#/settings?focus=<section-id>`، مثل `#/settings?focus=offline-section`.
- **قسم بدقة:** معرّفه علماً مجرداً، مثل `#/settings?dash-storage` و`#/settings?dash-logos` و`#/settings?dash-colourways` أو `#/settings?cap-formats`. تفتح الروابط الأقدم `#/settings?dash-lock` و`#/settings?dash-palette-wheel` الغلاف وصفحة Colour.
- **قسم بكلمة مفتاحية:** `#/settings?print` و`#/settings?formats` و`#/settings?palette` (صفحة Colour) أو `#/settings?tokens`. يمكن أن تُشارَك الكلمات المفتاحية: ينتمي `print` إلى مرجع الطباعة في تبويب العلامة وإلى مجموعة Print production معاً، ويفوز الأول بحسب ترتيب الصفحة. استخدم المعرّف عندما يهم أيهما.

ينتقل الرابط العميق إلى التبويب الذي يملك الهدف، ويفتح أي مجموعة مطوي بداخلها، ثم يمرر إليه، مستقراً لحظة بينما تنهي الأقسام فوقه تخطيطها. وتنطوي العناوين المتقاعدة `#/platform` و`#/capabilities` في Settings مع بقاء أعلام روابطها العميقة سليمة.
:::

---

**ذو صلة:** [الملفات الشخصية](/info/profile.html) لتفاصيلك والسياقات التي تنشئ فيها. [Design System Setup](/info/brand-studio.html) لتحرير ما يعرضه تبويب Design system. [اعثر على عملك واستعده](/info/find-your-work.html) للتخزين والنسخ الاحتياطية والانتقال بين الأجهزة.
