# Settings

Settings वह जगह है जहाँ आप बदलते हैं कि Lolly आपके लिए कैसे काम करे: आपका ब्योरा, आपका उपयोग किया design system, एक्सेसिबिलिटी, इस डिवाइस पर क्या संग्रहीत है और ऑफ़लाइन क्या तैयार है। इसे होम स्क्रीन के नीचे बार में **Settings** से खोलें, या अपने अवतार मेनू से। यह **Preferences** पर खुलता है, चार और टैब साथ में।

| टैब | पता | इसमें क्या है |
|---|---|---|
| **Preferences** | `#/settings` | आपका ब्योरा, design system, दिखावट, इमोजी, एक्सेसिबिलिटी, कनेक्शन, स्टोरेज और ऑफ़लाइन डाउनलोड |
| **This device** | `#/settings?tab=device` | इस ब्राउज़र और मशीन की लाइव रीडिंग, साथ में ध्वनि और केवल-पढ़ने का स्टोरेज व्यू |
| **Design system** | `#/settings?tab=brand` | सक्रिय design system कवर और पन्नों के रूप में, सिस्टम बदलने के लिए कवर की पट्टी के साथ |
| **Capabilities** | `#/settings?tab=caps` | Lolly जो कुछ कर सकता है, खोजने योग्य कार्ड के रूप में |
| **Activity & stats** | `#/settings?tab=activity` | कैटलॉग, आपके स्थानीय काउंटर और हाल का काम |

हर टैब का अपना पता है, और पुराने `#/profile` और `#/d` लिंक अब भी सही जगह खोलते हैं, अलग-अलग सेटिंग तक।

## Preferences

Preferences एक लंबा पेज है जिसके किनारे **settings rail** है और रेल के ऊपर **Search settings** फ़ील्ड है जो टाइप करते ही उसे छाँटता है। हर खंड सीधे `#/settings?focus=<section-id>` रूप के लिंक से खुलता है, उदाहरण के लिए `#/settings?focus=storage-section`।

- <!--i:usercheck--> **Your details**: आपका नाम, संपर्क ब्योरा और हेडशॉट, और **Use my details to create** स्विच। [Profiles](/info/profile.html) समझाता है कि टूल उन्हें कैसे उपयोग करते हैं।
- <!--i:seal--> **Content Credentials**: वैकल्पिक सत्यापित पहचान जो आपके एक्सपोर्ट पर हस्ताक्षर करती है। देखें [Content Credentials](/info/content-credentials-identity.html)।
- <!--i:palette--> **Design systems**: design system बदलें, जोड़ें, छिपाएँ या हटाएँ। [Design System Setup](/info/brand-studio.html#manage-your-design-systems) हर क्रिया कवर करता है।
- <!--i:moon--> **Appearance**: थीम (Light, Dark या Brand, जो ऐप को आपके पैलेट में रंगता है) और **Interface follows the design system**।
- <!--i:sparkle--> **Emoji**: वह सेट जिससे आपके इमोजी बनते हैं जब आप कुछ नया शुरू करते हैं, उसके आर्टवर्क लाइसेंस सहित, और आपका पैलेट उन्हें कितना रंगता है (**Off**, **Subtle**, **Strong**, **Full**, **Mono** या **Duotone**)। **Keep skin tones and flags** उन्हें अपने रंगों में रखता है। जो काम आप पहले बना चुके हैं वह वही सेट रखता है जिससे बना था।
- <!--i:eyeoff--> **Accessibility**: चार आराम स्विच, साथ में Sound और Neurospicy Mode। देखें [Accessibility](#accessibility)।
- <!--i:link--> **Connected services**: आपका जोड़ा स्टोरेज, जैसे Dropbox, Google Drive, OneDrive, Nextcloud या S3, और **Sync across devices**। देखें [Sync your devices](/info/sync.html)।
- <!--i:globe--> **Trusted sites**: वे साइट जिनसे Design वेब-पेज बॉक्स या Sandbox डेमो बिना पूछे संपर्क कर सकता है, और जहाँ सर्वर दे, **Allow pages from any site**। [Privacy Policy](/info/privacy.html) बताती है कि हर अनुरोध क्या भेजता है।
- <!--i:download--> **Your renders**: **Save my renders to my library** आपके डाउनलोड की हर इमेज, ऑडियो क्लिप और वीडियो की प्रति Assets में रखता है, Renders टैग के नीचे।
- <!--i:database--> **Storage**: Lolly इस डिवाइस पर क्या रखता है, और आपका डेटा साफ़ करने या ले जाने वाले बटन। देखें [Storage](#storage)।
- <!--i:cpu--> **Available offline**: कनेक्शन जाने से पहले जो चाहिए डाउनलोड करें। देखें [Available offline](#available-offline)।
- <!--i:folder--> **Hot folder**: डेस्कटॉप ऐप में एक फ़ोल्डर पर नज़र रखें और उसमें डाली हर चीज़ Lolly में खींचें, उसी चयनकर्ता से जो ड्रैग-एंड-ड्रॉप को मिलता है।
- <!--i:clock--> **Your activity**: आपने इस डिवाइस पर क्या बनाया, स्थानीय रूप से गिना हुआ।
- <!--i:sliders--> **Feature flags**: ऐप के हिस्से चालू या बंद करें, जैसे **Print preflight** या **Strip metadata from uploads**।
- <!--i:server--> **Lolly instance**: यह इंस्टॉल अपने टूल और कैटलॉग कहाँ से पाता है। देखें [Lolly instance](#lolly-instance)।

थीम कार्ड लाइव प्रीव्यू हैं और चुनते ही लागू होते हैं, केवल इस डिवाइस पर।

![तीन थीम कार्ड, हर एक अपने ही टाइप और रंग का पूर्वावलोकन दिखाता हुआ, सक्रिय कार्ड चिह्नित है](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dappearance-section&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

### Accessibility

**Settings → Preferences → Accessibility** आपके काम के आसपास के ऐप के लिए चार आराम सेटिंग रखता है। हर एक चालू करने तक बंद है, और कोई भी टूल कैनवास या एक्सपोर्ट के भीतर नहीं पहुँचता, इसलिए शांत ऐप आपकी भेजी फ़ाइल का एक पिक्सेल नहीं हिलाता।

- <!--i:pause--> **Reduce motion** ऐप के ट्रांज़िशन, स्लाइड और सजावट बंद करता है। आपका कैनवास और कोई भी एनिमेटेड एक्सपोर्ट जैसे डिज़ाइन हुआ वैसे चलते रहते हैं।
- <!--i:photos--> **Hide colourful previews** गैलरी के प्रीव्यू आर्टवर्क की जगह शांत आइकन-और-टेक्स्ट कार्ड रखता है, और प्रोजेक्ट थंबनेल को धीमा करता है ताकि वे बिना चीखे पहचानने योग्य रहें।
- <!--i:sliders--> **High contrast** ऐप की सीमाएँ, टेक्स्ट और फ़ोकस रिंग मज़बूत करता है। आपके ब्रांड रंग और कैनवास वैसे रहते हैं जैसे आपने सेट किए।
- <!--i:font--> **Large text** ऐप के लेबल, मेनू और बटन का टेक्स्ट बड़ा करता है। आपके डिज़ाइन के भीतर का टाइप अछूता रहता है, इसलिए एक्सपोर्ट का कुछ दोबारा नहीं बहता।

ये सेटिंग आपकी प्रोफ़ाइल पर रहती हैं, इसलिए प्रोफ़ाइल एक्सपोर्ट में चलती हैं और अगली इंस्टॉल पर आपके नाम और सत्रों के साथ पहुँचती हैं। एक छोटी केवल-डिवाइस प्रति उन्हें पहले पेंट से पहले लागू करती है।

वही कार्ड **Sound** रखता है, आपके कामों के लिए सहायक ध्वनियों की कोमल परत (गैलरी में आना, Content Credentials परिणाम, पैनल बंद करना), और **Neurospicy Mode**, शांत फ़ोकस ट्रैक। Neurospicy चालू करने पर कोने में छोटा प्लेयर खुलता है जो ऐप भर में आपके साथ चलता है। वहाँ आप ट्रैक चुनते हैं, छोड़ते हैं, वॉल्यूम सेट करते हैं और प्लेयर छोटा या बंद करते हैं। ट्रैक में प्रोसीजरल *Lolly Sings* धुनें, परिवेश लूप और बीट, आपका अपना ऑडियो और इंटरनेट रेडियो स्टेशन शामिल हैं, जिन्हें कनेक्शन चाहिए। दोनों डिफ़ॉल्ट रूप से बंद हैं और याद रखे जाते हैं, और Sound बंद करने से फ़ोकस ट्रैक भी म्यूट होता है। प्रोफ़ाइल मेनू और **This device** यही स्विच रखते हैं।

इंटरफ़ेस कीबोर्ड से चलाया जा सकता है, कस्टम नियंत्रण स्क्रीन रीडर के लिए लेबल रखते हैं और हर टूल का लाइव प्रीव्यू एक लेबल वाली इमेज के रूप में उपलब्ध है जो बताती है कि वह क्या दिखाता है।

### Storage

स्टोरेज मीटर इस इंस्टॉल के हर बाइट का हिसाब श्रेणी-दर-श्रेणी देता है, ब्राउज़र जो रिपोर्ट करता है उसके सामने।

![स्टोरेज मीटर, सहेजे सत्र, इमेज और कैश का विवरण, ब्राउज़र जो वास्तव में रिपोर्ट करता है उसके सामने](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

मीटर के नीचे:

- **Move to another device** में **Export my data**, **Import data…** और **Export my data & render everything** हैं। [Move your work to another device](/info/find-your-work.html#move-your-work-to-another-device) उन्हें समझाता है।
- **Clear cache** डाउनलोड की कैटलॉग फ़ाइलें हटाता है, जो ज़रूरत पर फिर डाउनलोड होती हैं।
- **Remove automatic checkpoints older than 30 days** History की जगह खाली करता है और सहेजे व नामित संस्करण रखता है।
- **Clear all my data** पुष्टि के लिए एक शब्द टाइप करने के बाद इस ब्राउज़र में Lolly का रखा सब हटा देता है। [If you clear your browser data](/info/find-your-work.html#if-you-clear-your-browser-data) बताता है कि क्या जाता है।

### Available offline

Lolly स्क्रीन को आपके जाते ही कैश करता है, जो केवल वहीं कवर करता है जहाँ आप पहले जा चुके हैं। **Available offline** उस यात्रा के लिए है जो आप आती देख सकते हैं: जिन हिस्सों की ज़रूरत होगी उन्हें डाउनलोड करें और एक प्रगति पट्टी देखें, और जो आपने लिया वह बिना कनेक्शन के काम करता रहता है।

- <!--i:monitor--> **ऐप, कैटलॉग और गाइड**: **The app** (हर व्यू, संपादक और फ़ॉन्ट, वे स्क्रीन भी जो आपने कभी नहीं खोलीं), **Catalogue** (पूरा, या **Choose by tag**) और **Guides & docs** (आपकी भाषा में यह दस्तावेज़ीकरण, स्क्रीनशॉट सहित)।
- <!--i:cpu--> **AI मॉडल**: डिवाइस पर चलने वाला हर मॉडल अपनी पंक्ति में अपने आकार के साथ: Speech voices, Upscaling models, Background removal, Text recognition, Verify deep scan, Durable credential, Rewriter model, Ask matching model, AI text detector और Singing voices। 50 MB से बड़ा मॉडल **large download** चिह्नित होता है।
- <!--i:wrench--> **टूल**: हर टूल अलग से डाउनलोड होता है, या **Download all** हर टूल लेता है। टिक का मतलब ऑफ़लाइन तैयार।

ऊपर **Download everything** ऐप, आपके चुने कैटलॉग का दायरा, गाइड और सभी टूल लेता है। मॉडल जोड़ने के लिए **Include all the AI models** टिक करें, या मॉडल को उसकी अपनी पंक्ति से डाउनलोड करें; singing voices केवल अपनी पंक्ति से ही डाउनलोड होते हैं। संगठन की नीति AI डाउनलोड बंद कर सकती है, और तब पंक्तियाँ आपको बताती हैं।

रद्द करने या कनेक्शन खोने पर डाउनलोड वहीं से आगे बढ़ते हैं जहाँ रुके थे, और ऑनलाइन लौटने पर स्वयं ताज़ा होते हैं, केवल वही लाते हैं जो रिलीज़ ने बदला। अगर ब्राउज़र ने स्थायी स्टोरेज नहीं दिया है, तो **Protect downloads** उसे माँगता है: "डाउनलोड हुआ" और "डाउनलोड हुआ जब तक ब्राउज़र जगह वापस न चाहे" के बीच का फ़र्क़।

### Lolly instance

**Lolly instance** बताता है कि यह इंस्टॉल अपने टूल और कैटलॉग कहाँ से पाता है: इंस्टेंस का पता, या *Bundled with this app* जब सब कुछ बिल्ड के भीतर आता है।

- **Design-system source** दिखाता है कि दिया गया design system कहाँ से आता है।
- **Instance console** डिप्लॉयमेंट के एडमिन पेज खोलता है, जहाँ वह देता है।
- **Change** डेस्कटॉप ऐप को दूसरे इंस्टेंस की ओर इंगित करता है। ब्राउज़र ओरिजिन के पार टूल और एसेट लोड नहीं कर सकता, इसलिए वेब पर खंड इसके बजाय **Open a workspace** देता है।
- **Leave** इंस्टेंस का design system, टूल और कैटलॉग हटाता है, और आपका अपना काम रहता है। देखें [अपने संगठन में Lolly उपयोग करें](/info/organisation.html#leaving)।
- जब आप किसी संगठन में साइन इन हैं, **Sign out** यह सत्र समाप्त करता है और **Sign out everywhere** हर डिवाइस पर आपके सत्र समाप्त करता है, इसे भी मिलाकर।

## This device

- <!--i:monitor--> **This Machine**: स्क्रीन, इनपुट, ग्राफ़िक्स, मेमोरी, कोडेक, स्टोरेज बैकएंड और अधिक, इस सत्र से लाइव पढ़े। कुछ संग्रहीत नहीं होता और कुछ नहीं भेजा जाता। चौड़ी स्क्रीन पर यह अपने आप खुलता है, जहाँ टैब दो स्तंभों में सजता है।
- <!--i:neurobeat--> **Sound**: इंटरफ़ेस ध्वनियाँ और Neurospicy फ़ोकस लूप, इस टैब का एकमात्र स्विच जो कुछ लिखता है।
- <!--i:database--> **Storage**: [Preferences](#storage) के मीटर का केवल-पढ़ने का व्यू, जहाँ आप अपना डेटा साफ़ करते या ले जाते हैं।

## Design system

सक्रिय design system, पढ़ने के लिए सजा हुआ। जब इस ब्राउज़र में दो या अधिक design system हों, तो ऊपर छोटे कवर की पट्टी उन्हें सूचीबद्ध करती है: एक चुनें ताकि वह सक्रिय हो, और उसके बाद की सूचना में **Undo** पिछला लौटा देता है।

![Lolly Demo पर Design system टैब: सिस्टम बदलने के लिए कवर की पट्टी, फिर कवर जिसमें उसका लोगो, नाम, नोट और वे गिनतियाँ जो हर पेज खोलती हैं](/t/url-shot?url=%2F%23%2Fsettings%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=2400&format=svg&walker=1&dark=1&filename=settings-design-system)

टैब सिस्टम के अपने रंगों में रंगे कवर पर खुलता है, उसके लोगो, उसके डिस्प्ले फ़ेस में नाम और उसके लेखक के लिखे नोट के साथ। कवर पर गिनतियों की एक पंक्ति हर पेज से जोड़ती है:

- <!--i:palette--> **Colour**: हल्के और गहरे रूप की सतह, टेक्स्ट, प्राथमिक और द्वितीयक, हर नामित रंग नाम और हेक्स के साथ चिप के रूप में, हर टिंट रैम्प और चार्ट स्पेक्ट्रम के लिए पट्टी, और तह में रंग भूमिकाएँ। हेक्स कॉपी करने के लिए मान चुनें।
- <!--i:font--> **Type**: Headings, Text, Emphasis और Code, हर एक अपने फ़ेस में।
- <!--i:photos--> **Logos**: हर लोगो फ़ाइल उस ज़मीन पर जिसके लिए वह बनी।
- <!--i:layers--> **Colourways**: हर colourway का हल्का और गहरा जोड़ा, जब सिस्टम में एक से अधिक हों।
- <!--i:sliders--> **Tokens**: त्रिज्या, स्पेसिंग, प्रभाव और ग्रेडिएंट।
- <!--i:document--> **Print & CMYK**: ठीक इंक से बँधे रंग, और वे प्रेस स्थितियाँ जो CMYK PDF घोषित कर सकता है।

बदलना ही एकमात्र परिवर्तन है जो यह टैब करता है। आप design system को `#/start` पर [Design System Setup](/info/brand-studio.html) में संपादित करते हैं, जिससे कवर जुड़ता है। केवल-पढ़ने का सिस्टम अपने कवर पर यह कहता है; आपके बनाए स्थानीय सिस्टम संपादन योग्य रहते हैं। `/b` और `/brand` सीधे इस टैब के शॉर्टलिंक हैं।

## Capabilities

प्लेटफ़ॉर्म का हर हिस्सा कार्ड के रूप में लिखा गया है, बारह समूहों में: Experiences, Platforms & runtimes, Accessibility & languages, Export formats, Import formats, Print production, Automation & AI, Determinism & reproducibility, Brand & design system, Privacy & data ownership, Security & access control और Architecture (for builders)। हर समूह तह होता है और अपने कार्ड की गिनती दिखाता है। कार्ड डायलॉग में खुलता है जिसमें उस क्षमता की सुविधाएँ हैं और, लगभग आधे के लिए, वह स्क्रीनशॉट जो यह दस्तावेज़ीकरण उपयोग करता है।

समूहों के ऊपर की खोज फ़ील्ड टाइप करते ही कार्ड छाँटती है और जिन समूहों में अब भी मिलान है उन्हें खोलती है। वह बताती है कि कितनी क्षमताओं में खोज रही है, और बिना मिलान वाली क्वेरी शब्दों में यह कहती है।

यह टैब Lolly जो कर सकता है उसका लिखित दस्तावेज़ है, इन गाइड के साथ तालमेल में रखा हुआ। यह उस मशीन को नहीं जाँचता जिस पर आप हैं; **This device** वह करता है।

## Activity & stats

पहले बिल्ड: कितने टूल लोड हैं, कितने एक्सपोर्ट फ़ॉर्मेट हैं, प्लेटफ़ॉर्म कितनी सतहों पर चलता है और कैटलॉग कितने ब्रांड एसेट रखता है, **Catalogue** पैनल के साथ जो बताता है कि इस बिल्ड में क्या आता है।

फिर आपका अपना पक्ष: **Your activity** गिनती है कि आपने इस डिवाइस पर क्या बनाया, और **Recent creations** तथा **Latest exports** ऐसे स्टैक हैं जिन्हें आप स्वाइप कर सकते हैं, हर एक तब दिखता है जब दिखाने को कुछ हो। दोनों किसी आइटम को वैसा ही खोलते हैं जैसा वह था। ये काउंटर डिवाइस पर रहते हैं; वैकल्पिक Lolly Work इंस्टेंस अपने [संगठन टेलीमेट्री और ऑडिट रिकॉर्ड](/info/privacy.html#organisation-services-with-lolly-work) रखता है।

## डीप लिंक

Settings के हर टैब और खंड का अपना लिंक है, जिसे आप बुकमार्क या पेस्ट कर सकते हैं। [Search](/info/search.html) अपने **Settings** परिणाम उसी रजिस्ट्री की ओर इंगित करती है जिससे Settings रेंडर होता है, इसलिए खंड का नाम खोज परिणाम के नीचे से बदला नहीं जा सकता।

::: details लिंक का हर रूप

- **टैब:** `#/settings?tab=brand`, `#/settings?tab=caps`, `#/settings?tab=device`, `#/settings?tab=activity`।
- **Preferences खंड:** `#/settings?focus=<section-id>`, जैसे `#/settings?focus=offline-section`।
- **ठीक वही खंड:** उसकी id सादे फ़्लैग के रूप में, जैसे `#/settings?dash-storage`, `#/settings?dash-logos`, `#/settings?dash-colourways` या `#/settings?cap-formats`। पुराने `#/settings?dash-lock` और `#/settings?dash-palette-wheel` लिंक कवर और Colour पेज खोलते हैं।
- **कीवर्ड से खंड:** `#/settings?print`, `#/settings?formats`, `#/settings?palette` (Colour पेज) या `#/settings?tokens`। कीवर्ड साझा हो सकते हैं: `print` ब्रांड टैब के प्रिंट संदर्भ और Print production समूह दोनों का है, और पेज क्रम में पहला जीतता है। जब मायने रखे कि कौन सा, तो id उपयोग करें।

डीप लिंक लक्ष्य के स्वामी टैब पर स्विच करता है, जिस समूह के भीतर वह तह है उसे खोलता है, फिर उस तक स्क्रॉल करता है, और ऊपर के खंड लेआउट पूरा करें तब तक थोड़ी देर टिकता है। हटाए गए `#/platform` और `#/capabilities` पते अपने डीप-लिंक फ़्लैग सुरक्षित रखते हुए Settings में समा जाते हैं।
:::

---

**संबंधित:** आपके ब्योरे और जिन संदर्भों में आप बनाते हैं उनके लिए [Profiles](/info/profile.html)। Design system टैब जो दिखाता है उसे संपादित करने के लिए [Design System Setup](/info/brand-studio.html)। स्टोरेज, बैकअप और डिवाइस बदलने के लिए [Find and recover your work](/info/find-your-work.html)।
