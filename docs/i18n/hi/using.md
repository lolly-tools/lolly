# Lolly का उपयोग

आपके पास Lolly खुला है और आप कुछ बनाना, रखना और आगे भेजना चाहते हैं। यह पेज वही चक्र दिखाता है: टूल खोलें, जो बदलने देता है उसे बदलें, परिणाम सहेजें और लिंक या फ़ाइल के रूप में साझा करें।

यहाँ सब कुछ आपके डिवाइस पर चलता है, बिना खाते के, और जरूरी टूल व एसेट डाउनलोड होने के बाद ऑफ़लाइन भी चलता रहता है। ऐप को शुरू होने के लिए WebGPU वाला ब्राउज़र या ऐप चाहिए; [Supported environments](/info/supported-environments.html) परखे गए वातावरण सूचीबद्ध करता है।

## अपना रास्ता खोजें

::: figure using-app-map
होम स्क्रीन: ऊपर चार टैब और नीचे बार। खुला टूल अपने नियंत्रण लाइव प्रीव्यू के बगल में दिखाता है।
:::

होम स्क्रीन के ऊपर चार टैब हैं: **Tools**, **Utilities**, **Assets** और **Projects**। Tools वे हैं जिनसे आप बनाते हैं, Utilities फ़ाइल बदलने, जाँचने या साफ़ करने जैसे कामों के वर्कबेंच हैं, Assets आपकी लाइब्रेरी है और Projects में वह है जो आपने सहेजा।

नीचे के बार में **Open**, **Settings**, खोज फ़ील्ड, **Verify** और **What?** हैं। यह Tools, Utilities, Assets, Projects, Settings और ऐप में पढ़ी जाने वाली गाइड पर दिखता है, और टूल खुलने पर हट जाता है। [Search](/info/search.html) उसी फ़ील्ड से आपके टूल, सहेजे काम, एसेट और सेटिंग तक पहुँचता है। [Ask Lolly](/info/ask.html) टाइप किए प्रश्न का उत्तर इन गाइड के मेल खाते खंड से देता है।

उस टूल में कुछ नया शुरू करने के लिए कार्ड क्लिक करें। सहेजा काम इसके बजाय **Projects** से दोबारा खुलता है।

![उदाहरण नेविगेशन और एक New कार्रवाई वाला गैलरी कार्ड](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&localize=1&dark=1&cropSelector=.gtile%5Bdata-tool-id%3D%22design%22%5D&filename=gallery&try=1)

हर टूल बँटा हुआ व्यू है: एक तरफ़ **नियंत्रण** और दूसरी तरफ़ लाइव **प्रीव्यू**। नियंत्रण बदलें और प्रीव्यू तुरंत साथ चलता है, और जो आप देखते हैं वही एक्सपोर्ट होता है।

![एक टूल का स्प्लिट व्यू - बाईं ओर कंट्रोल स्टैक, और दाईं ओर वह लाइव ग्रुप्ड बार चार्ट जो वह बनाता है](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26t%3DExample%2520data%26st%3DSample%2520values%252C%2520not%2520a%2520real%2520dataset%26d%3DMonth%252CSeries%2520A%252CSeries%2520B%252CSeries%2520C%250AJan%252C12%252C9%252C5%250AFeb%252C18%252C14%252C7%250AMar%252C24%252C17%252C11%250AApr%252C29%252C23%252C15%26lg%3D1&width=1440&height=900&dpi=192&waitMs=2500&walker=1&format=svg&dark=1&filename=vt-tool-split-view)

**Design** अपवाद है। वह बॉक्स के मुक्त कैनवास के रूप में खुलता है जिसमें आप खींचते, आकार बदलते और टाइप करते हैं, अपने ऊपरी बार, टाइमलाइन और डेक नियंत्रण के साथ। [Design: the free canvas](/info/design.html) उसकी गाइड है।

## जो टूल बदलने देता है उसे बदलें

टूल केवल वही इनपुट दिखाता है जिन्हें बदलने का इरादा है। उसके लेखक ने रंग, लेआउट, टाइप और तर्क पहले से तय कर दिए हैं, इसलिए आप जो भी बनाते हैं वह उनके नियमों में रहता है। इनपुट में टेक्स्ट, स्लाइडर, रंग पिकर, ड्रॉपडाउन, तिथियाँ, इमेज पिकर और दोहराए जाने वाले पंक्ति समूह शामिल हैं, और कुछ तह होने वाले खंडों में हैं।

![A tool's control stack - a text field, colour triggers and a slider and nothing else the author chose to lock down](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=%23tool-inputs&walker=1&format=svg&dark=1&filename=use-tool-inputs)

**डिज़ाइन पर क्लिक करके उसका नियंत्रण खोजें।** प्रीव्यू में किसी भी तत्व पर क्लिक करें और मेल खाता नियंत्रण फ़ोकस पाता है और दृश्य में स्क्रॉल होता है। दोहराए जाने वाले पंक्ति समूह में आपकी क्लिक की ठीक वही पंक्ति खुल जाती है।

नियंत्रणों के ऊपर **Clear changes** हर इनपुट को उसके डिफ़ॉल्ट पर लौटा देता है।

**Design system के विकल्प।** जब आपका design system एक से अधिक colourway, हल्का और गहरा रूप या कोई और थीम विकल्प देता है, तो नियंत्रणों के नीचे **Design system** खंड उन्हें रखता है। विकल्प तभी दिखता है जब वह इस टूल को बदलता है, इसलिए फ़ाइल यूटिलिटी कोई खंड नहीं दिखाती। हर colourway अपने रंगों में एक बिंदु है, हल्का और गहरा दो बटन हैं और कोई भी अन्य विकल्प सूची है।

यह चुनाव इस रचना का है। वह लिंक और सहेजे सत्र में चलता है, design system से जुड़ा हर रंग उसका पालन करता है और ऐप के अपने रंग जैसे हैं वैसे रहते हैं। Design यही विकल्प Inspector के **Canvas** टैब में दिखाता है। जिस टूल के रंग ही उसकी सामग्री हैं, वह कैनोनिकल colourway पर रह सकता है, और तब कोई colourway बिंदु नहीं देता। [Lolly Demo in use](/info/lolly-demo-in-use.html#colourways-on-real-work) असली काम पर colourway दिखाता है।

### प्रीव्यू को ज़ूम और पैन करें

प्रीव्यू हमेशा ठीक वही दिखाता है जो एक्सपोर्ट होगा।

- **ज़ूम:** Cmd/Ctrl-स्क्रॉल या ट्रैकपैड पर पिंच, आपके पॉइंटर पर केंद्रित। कीबोर्ड पर `0` विंडो में फ़िट करता है, `1` 100% है और `+` / `−` ज़ूम करते हैं।
- **पैन:** **Space** दबाए रखकर खींचें, या बीच के माउस बटन से खींचें। सामान्य क्लिक डिज़ाइन के हिस्सों पर क्लिक करने के लिए खाली रहते हैं।
- **टच:** ज़ूम के लिए पिंच करें, पैन के लिए खींचें और फ़िट के लिए डबल-टैप करें।
- **ज़ूम HUD:** कोने में Lolly स्विर्ल को दबाए रखें, `−`, **Fit** और `+` खुल जाते हैं। स्विर्ल पर छोटा टैप अब भी आपका प्रोफ़ाइल मेनू खोलता है।

आउटपुट का आकार बदलने पर व्यू हमेशा साफ़ फ़िट पर लौट आता है।

![कैनवास के कोने में स्विर्ल से खुला ज़ूम HUD: माइनस, Fit, प्लस, फिर थीम और ध्वनि टॉगल और उसे हिलाने वाली पकड़](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=.stage-nav%7Bopacity%3A1!important%7D&drive=drag%3A.stage-nav-profile%7Cdx%3D1%7Chold%3Bwait%3A700&cropSelector=.stage-nav&walker=1&format=svg&dark=1&filename=use-zoom-hud)

### अनडू और रीडू

**Cmd/Ctrl-Z** पीछे जाता है और **Cmd/Ctrl-Shift-Z** (या **Cmd/Ctrl-Y**) आगे। यही जोड़ी नियंत्रणों के ऊपर **Undo** और **Redo** बटन के रूप में है (Design में वे ऊपरी बार में हैं), और जब वापस लेने को कुछ नहीं बचता तो हर एक धूसर हो जाता है। एक संदेश बताता है कि हर undo ने कौन सा इनपुट लौटाया, संदेश में **Redo** बटन के साथ।

- **एक ड्रैग एक चरण है।** आधे सेकंड के भीतर एक नियंत्रण में बार-बार हुए बदलाव मिल जाते हैं, इसलिए स्लाइडर को उसकी पूरी रेंज में खींचना एक ही undo है।
- **पिछले 100 चरण रखे जाते हैं।** undo के बाद नया संपादन आगे की स्टैक साफ़ कर देता है।
- **टेक्स्ट बॉक्स में** Cmd/Ctrl-Z फ़ील्ड का है, अक्षर-दर-अक्षर। स्लाइडर, ड्रॉपडाउन, रंग और स्विच के लिए Lolly संभालता है।
- **फ़ाइल चुनना** फ़ाइल इनपुट में चरण नहीं है, क्योंकि वे बाइट्स केवल इस सत्र के लिए रखे जाते हैं।

लाइव [collaboration](/info/collaborate.html) में आपका इतिहास आपका रहता है: दूसरे डिवाइस का बदलाव कभी आपकी स्टैक में नहीं जाता। Undo तब तक चलता है जब तक आप टूल छोड़ें या रीलोड करें। इससे पुराने के लिए, काम करते समय सहेजने वाले टूल पुराने संस्करण **History** में रखते हैं; देखें [Go back to an earlier version](/info/find-your-work.html#go-back-to-an-earlier-version)।

### लाइव कैमरा

**Filter** टूल के प्रभाव (Halftone, Scanline, Posterize, Voronoi, Duotone, Stretch, Misprint, Dither, ASCII art और Glitch) जहाँ कैमरा उपलब्ध हो वहाँ **Go live** बटन दिखाते हैं। इसे चालू करें और प्रभाव आपके वेबकैम का फ़्रेम-दर-फ़्रेम अनुसरण करता है, और मोशन एक्सपोर्ट परिणाम को GIF, WebM या MP4 के रूप में रिकॉर्ड करता है। फ़्रेम आपके डिवाइस पर प्रोसेस होते हैं, और जैसे ही आप रोकते या टूल छोड़ते हैं कैमरा मुक्त हो जाता है। हर इमेज पिकर में एकल फ़्रेम के लिए **Take a photo** भी है।

## सेव करना और जारी रखना

अपना काम रखने के लिए **Save** दबाएँ, रेंडर पिल पर **Export** के बगल में टिक। नया काम **My library** में जाता है, पहले सहेजा काम वहीं अपडेट होता है जहाँ वह है और कुछ डाउनलोड नहीं होता। एक्सपोर्ट पैनल में भी यही **Save** बटन है।

यह चुनने के लिए कि वह कहाँ जाए, एक्सपोर्ट पैनल में **Download** के बगल में **Save as** दबाएँ। **Save to a project** के नीचे **My library** चुना रहने दें या कोई प्रोजेक्ट चुनें (**＋ New project…** एक बनाता है), फिर **Save** दबाएँ; **Save as a template** डिज़ाइन को [template](/info/templates.html) के रूप में रखता है, नए दस्तावेज़ों का आरंभ बिंदु। Design में **Save as** Lolly मेनू में है; फ़ोन पर **•••**, फिर **File menu**, फिर **Save as** दबाएँ।

![दो-हिस्सों वाली रेंडर पिल: Export, ऊपर के तीर के साथ जो एक्सपोर्ट पैनल खोलता है, और Save, टिक के साथ जो वहीं सहेजता है](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=%23tool-inputs%7Bdisplay%3Anone%7D&cropSelector=.render-pill&walker=1&format=svg&dark=1&filename=use-render-pill)

::: timeline
- <!--i:check--> रेंडर पिल पर **Save** दबाएँ, या प्रोजेक्ट चुनने के लिए **Save as**।
- <!--i:folder--> आइटम **My library** में जाता है, या आपके चुने प्रोजेक्ट में।
- <!--i:home--> बाद में, ऊपर बाएँ **Home** दबाएँ और **Projects** टैब खोलें।
- <!--i:document--> आइटम खोलें। हर सेटिंग वापस है, बदलने और फिर एक्सपोर्ट करने के लिए तैयार।
:::

आइटम का नाम एक्सपोर्ट पैनल में आपके टाइप किए फ़ाइल नाम पर रखा जाता है, अन्यथा उनके टूल पर, जैसे **QR Code**। **Download** से मिली फ़ाइल तैयार प्रति है; उसे बाद में बदलने के लिए Projects में सहेजा आइटम खोलें।

निजी सेव इसी डिवाइस पर रहते हैं, उस ब्राउज़र या ऐप में जिसमें आपने सहेजा, जब तक आप [Sync](/info/sync.html) चालू न करें। अगर कुछ उम्मीद की जगह नहीं है, तो [Find and recover your work](/info/find-your-work.html) बंद टैब से लेकर साफ़ किए ब्राउज़र डेटा तक हर स्थिति कवर करता है।

::: details Lolly Work के साथ टीम प्रोजेक्ट (वैकल्पिक)
अगर आपका [संगठन Lolly Work उपयोग करता है](/info/organisation.html), तो उसके इंस्टेंस में साइन इन करें और आपके साथ साझा सत्रों के लिए **Projects → Team projects** खोलें। पहुँच और प्रतिधारण संगठन तय करता है, और उसकी Lolly Work सेवा वे सत्र संग्रहीत करती है। जब आपका संगठन लाइव संपादन की अनुमति देता है, साझा सत्र खुलते ही अपने लाइव collab में जुड़ जाता है; [Working together](/info/collaborate.html#work-collabs-with-lolly-work-optional) चरण समझाता है।

आपकी निजी लाइब्रेरी अलग रहती है। दूसरे डिवाइस पर साइन इन करने से टीम का काम मिलता है, जबकि निजी सेव को आर-पार ले जाने के लिए अब भी Sync या बैकअप चाहिए।
:::

## अपना काम शेयर करना

डिज़ाइन लिंक या फ़ाइल के रूप में बाहर जाता है। एक्सपोर्ट नियंत्रणों में **Share** दोनों देने वाला डायलॉग खोलता है, और Projects में सहेजे सत्र पर **Share link** उसी सत्र के लिए वही डायलॉग खोलता है।

::: cols
## एक लिंक

- हर इनपुट पते में रखता है, इसलिए लिंक डिज़ाइन को दोहराता है।
- इस डिवाइस से जोड़ी गई इमेज और फ़ाइलें, बहुत लंबा टेक्स्ट और बहुत बड़ी सूचियाँ पीछे छोड़ देता है।
- किसी भी ब्राउज़र में खुलता है, इसलिए आप लिंक को बुकमार्क, पेस्ट या कमिट कर सकते हैं।

## एक .lolly फ़ाइल

- इस डिवाइस की इमेज और फ़ाइलों सहित सहेजा सत्र रखती है, और टूल व design system भी रख सकती है।
- लाइसेंस वाली कैटलॉग कला तब तक रोक लेती है जब तक आप फ़ाइलें शामिल करना न चुनें।
- Lolly में खुलती है: उस पर डबल-क्लिक करें, **Open** उपयोग करें या उसे ऐप पर डालें।
:::

### लिंक

कॉपी के लिए तैयार लिंक डायलॉग के ऊपर है, **Copy** और **QR** बटन के साथ जो लिंक पर QR Code टूल खोलता है। लिंक के नीचे **Link options** में ये हैं:

- **Open in the installed app** लिंक को Shortcuts, लॉन्चर और ऑटोमेशन के लिए `lolly://` पते में बदलता है, हर पैरामीटर वैसा ही।
- **Shortest link** लंबे डिज़ाइन को संक्षिप्त टोकन में पैक करता है और अक्षरों में बचत दिखाता है। पढ़ने योग्य रूप हमेशा वहाँ भी रहता है।
- **Password-protect this link** लिंक को आपके डिवाइस पर AES-256 से एन्क्रिप्ट करता है। पासवर्ड कभी लिंक का हिस्सा नहीं होता।
- **Pin this tool version** `_v` फ़्लैग जोड़ता है, ताकि बाद का टूल अपडेट लिंक के रेंडर को न बदल सके।
- **When the recipient opens the link…** फ़ुलस्क्रीन, पहले से खुला एक्सपोर्ट पैनल, खुलते ही डाउनलोड (`&export`) या क्लिपबोर्ड पर कॉपी (`&copy`) चुनता है।
- **Copy credit** लिंक के साथ "Made with Lolly" कैप्शन कॉपी करता है, पोस्ट या स्लाइड के लिए।

जब टूल में निजी फ़ील्ड हों, जैसे आपका नाम, तो **Review personal fields** हर एक को तब तक लिंक से बाहर रखता है जब तक आप वह फ़ील्ड टिक न करें। [URL mode](/info/url-mode.html) बताता है कि लिंक क्या-क्या रख सकता है।

**डायलॉग बताता है कि लिंक क्या नहीं रख सकता।** इस डिवाइस से जोड़ी गई इमेज या फ़ाइल, बहुत लंबा टेक्स्ट मान और बहुत बड़ी सूची पते में नहीं समातीं। लिंक बनते समय हर एक गिनी जाती है। अगर कुछ छोड़ना पड़ा, तो डायलॉग उसे सूचीबद्ध करता है और फ़ाइल विकल्प की ओर इशारा करता है, ऐसा लिंक देने के बजाय जो चित्र के बिना खुले। जो लिंक केवल लंबा है उसे अक्षर गिनती के साथ हल्का नोट मिलता है।

**कुछ टूल लिंक को ही पूरा उत्पाद बना देते हैं।** Jump Page आपके लिंक को बाँटने के लिए एक पेज में जमा करता है: बायो लिंक, कोई टॉक, कोई दुकान का सामने वाला हिस्सा। कुछ होस्ट नहीं होता और पेज के पीछे कोई खाता नहीं, क्योंकि पेज ही लिंक है। आगंतुक को वह पूरी चौड़ाई में मिलता है, स्क्रॉल करने पर हर दृश्य में एक लिंक।

![एडिटर में Jump Page: पेज के ऊपर हेडिंग सीन, और उसके नीचे लिंक सीन](/t/url-shot?url=%2F%23%2Ftool%2Fjump%3Ffull%26heading%3DFind%2520us%2520everywhere%26subheading%3DOne%2520link%2520for%2520everything.%26links%3DURL%252CName%252CEmoji%257Ehttps%25253A%25252F%25252Fexample.com%252CWebsite%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fnews%252CNewsletter%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fhello%252CSay%252520hello%252C&width=900&height=1300&dpi=96&waitMs=2000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=use-jump-page)

::: details Lolly Work के साथ संगठन-प्रबंधित लिंक
जिस साझा करने में समाप्ति, निरस्तीकरण या पासवर्ड चाहिए, उसके लिए Lolly Work साझा सत्रों, टूल और कैटलॉग एसेट के प्रबंधित लिंक देता है। वे संगठन की सेवा से हल होते हैं और उसके पहुँच नियमों का पालन करते हैं। वे ऊपर के आत्म-निहित लिंक से अलग हैं, और किसी एक को रद्द करने से वह फ़ाइल वापस नहीं बुलाई जा सकती जिसे कोई पहले ही डाउनलोड कर चुका। [Rendering and sharing](/info/manage/sharing.html) लिंक प्रकार और अनुमतियाँ सूचीबद्ध करता है।
:::

### .lolly फ़ाइल

Share डायलॉग के **Editable file** खंड में **Download .lolly** मौजूदा डिज़ाइन को एक फ़ाइल के रूप में लिखता है। वह इस डिवाइस की इमेज और फ़ाइलों सहित सहेजा सत्र रखती है, और सामान्य कैटलॉग कला भी साथ जाती है। पुरानी या अनुपलब्ध फ़ाइल गायब होने के बजाय बाहरी संदर्भ बनी रहती है। सहेजने से पहले डायलॉग फ़ाइल का आकार, वह कितनी फ़ाइलें एम्बेड करती है, कितनी का संदर्भ देती है और क्या टूल शामिल है, यह दिखाता है। जहाँ आपके डिवाइस पर शेयर शीट है, **Send to…** फ़ाइल को सीधे उसे सौंपता है (AirDrop, Android शेयर)।

**Projects** में फ़ोल्डर के मेनू में **Download project (.lolly)** पूरा फ़ोल्डर लिखता है, ताकि कोई और फ़ोल्डर के हर सत्र के साथ आगे बढ़ सके। बैच सत्र पीछे रहते हैं, और सूचना बताती है कितने। उसी मेनू में **Download originals** हर आइटम की अलग फ़ाइल के रूप में सादी zip लिखता है।

फ़ाइल जाने से पहले तीन बातें आपके तय करने की हैं:

- **आपका नाम जाएगा या नहीं।** आपका नाम, ईमेल और संगठन तभी लिखे जाते हैं जब [आपकी प्रोफ़ाइल](/info/profile.html) में **Use my details to create** चालू हो। बंद होने पर फ़ाइल केवल यह दर्ज करती है कि वह Lolly से बनी, और कब।
- **रोकी हुई कला जाएगी या नहीं।** लाइसेंस वाली कला, ब्रांड-लॉक कला और वे कैटलॉग कार्य जिनका लाइसेंस कभी दर्ज नहीं हुआ, डिफ़ॉल्ट रूप से बाहर रहते हैं। अगर डिज़ाइन में कोई उपयोग होती है, तो डायलॉग बताता है कितनी और *Download without them* या *Include and download* देता है, क्योंकि शामिल करना `.lolly` खोलने वाले को फ़ाइलें सौंपना है। फ़ाइल की `CREDITS.txt` कारण सहित बताती है कि क्या गया और क्या नहीं; [Creative rights and credits](/info/creative-rights.html) नियम समझाता है।
- **टूल जाएगा या नहीं।** **Include the tool** टूल की अपनी फ़ाइलें पैक करता है, ताकि डिज़ाइन उस टूल के बिना डिवाइस पर खुले। यह कस्टम टूल के लिए, जैसे फ़ोर्क, टिक किया हुआ शुरू होता है और हस्ताक्षरित कैटलॉग में सूचीबद्ध टूल के लिए बिना टिक का। बिना हस्ताक्षरित कैटलॉग वाले बिल्ड पर हर टूल कस्टम गिना जाता है।

**एक को खोलना।** डेस्कटॉप और मोबाइल ऐप में `.lolly` पर डबल-क्लिक या टैप करें, **Open with Lolly** चुनें या उसे शेयर शीट से Lolly को भेजें। वेब ऐप में **Open** दबाएँ या फ़ाइल को Lolly पर डालें। हर रास्ता कुछ लिखे जाने से पहले फ़ाइल का मैनिफ़ेस्ट पढ़ता है और उसका आकार, सामग्री और क्या होगा, यह दिखाता है।

अगर फ़ाइल ऐसा टूल लाती है जो आपके पास नहीं है, तो **Trust this tool?** टूल और उसके लेखक को दिखाता है, और बताता है कि उसे खोलना टूल का अपना कोड आपके डिवाइस पर चलाता है। **Trust & install** आगे बढ़ता है। मना करने पर भी काम Projects में सहेजा जाता है, उस दिन के इंतज़ार में जब आप टूल जोड़ें। जिस टूल का कोड मॉड्यूल के रूप में आता है, उसे इस तरह अभी इंस्टॉल नहीं किया जा सकता, और उसे भी इसी तरह लौटा दिया जाता है।

::: details .lolly में क्या होता है, और उसे खोलना कैसे काम करता है
`.lolly` Lolly का बंडल एक्सटेंशन है, और उसके `manifest.json` का `format` बताता है कि भीतर क्या है:

- **साझा डिज़ाइन** (`lolly-share`) में एक सहेजा सत्र, उसकी एम्बेड फ़ाइलें और उन चीज़ों की रसीद होती है जो अब भी संदर्भ से हल होती हैं। उसमें टूल और design system भी हो सकते हैं। उसे खोलना नया Project जोड़ता है और किसी सत्र को कभी अधिलेखित नहीं करता।
- **साझा प्रोजेक्ट** (`lolly-share`, kind `project`) में Projects का एक फ़ोल्डर होता है: उसके उप-फ़ोल्डर, उनमें हर सत्र अपनी टाइल सहित और वहाँ दर्ज चित्र। उसे खोलना पूरे फ़ोल्डर की प्रति जोड़ता है। हर सत्र `sessions/<key>.json` के रूप में चलता है और उसकी टाइल `thumbs/` के नीचे। प्रोजेक्ट फ़ाइलों से पहले का Lolly आपसे अपडेट करने को कहता है।
- **design-system पैक** (`lolly-brand`) में टोकन होते हैं और फ़ॉन्ट, लोगो, प्रकाशित संस्करण और रखे गए संसाधन हो सकते हैं। पैक खोलना अलग नामित design system जोड़ता है और उस सिस्टम को सक्रिय बनाता है।
- **वर्कस्पेस या इंस्टेंस पैक** घोषित टूल, कैटलॉग एसेट और वैकल्पिक रूप से इंस्टेंस पते वाला `lolly-brand` है। एक को लोड करना पहले लोड किए गए एकल वर्कस्पेस ओवरले की जगह लेता है, और प्रीव्यू उन डिवाइस-व्यापी प्रभावों को सूचीबद्ध करता है।

पूरा डिवाइस बैकअप `.lolly` नहीं है। वह `LollyTools-….zip` (फ़ॉर्मेट `lolly-backup`) रहता है और **Settings → Storage → Import data…** से बहाल होता है। ज़िप किया हुआ टूल फ़ोल्डर भी `.zip` रहता है। [Data transfer](/info/data-transfer.html) फ़ॉर्मेट संदर्भ है।

`.lolly` सामान्य zip है। भीतर देखने के लिए उसका नाम `.zip` कर दें: आपकी अपनी इमेज `assets/uploads/` के नीचे हैं, कैटलॉग कला `assets/catalog/` के नीचे, `manifest.json` हर फ़ाइल सूचीबद्ध करता है, और एक README बताता है कि फ़ाइल क्या है।

macOS, Windows, Linux, iOS और Android सब इस फ़ॉर्मेट को पंजीकृत करते हैं, डेस्कटॉप फ़ाइल मैनेजर इसे Lolly दस्तावेज़ के रूप में दिखाते हैं और GNOME Files सहेजे सत्र का अपना थंबनेल दिखा सकता है। Design System Setup से खोलने पर, जब साझा डिज़ाइन में design-system क्रिया हो तो वही सुझाई जाती है, पर **Open shared design** कभी नहीं छिपता।

iOS या Android पर किसी दूसरे ऐप से सौंपा गया दस्तावेज़ 48 MB पर सीमित है, क्योंकि हैंड-ऑफ़ उसके बाइट्स को ऐप की सीमा के आर-पार कॉपी करता है, और ऐप यह बताता है। Lolly के भीतर **Open** की ऐसी कोई सीमा नहीं, इसलिए बड़े बंडल के लिए उसे उपयोग करें।

आपके पुष्टि करने के बाद Lolly बंडल को एक बार खोलकर सत्यापित करता है। एसेट आपकी लाइब्रेरी में जाते हैं, चेकसम से मिलाए जाते हैं ताकि डिवाइस पर पहले से मौजूद फ़ाइल दोबारा उपयोग हो। सत्र नई id के साथ Projects में जाते हैं, इसलिए वही फ़ाइल दो बार खोली जा सकती है; जिस सत्र का टूल गायब है वह वहीं प्रतीक्षा करता है। 100 MB से बड़ी फ़ाइलें बड़ी बताई जाती हैं, और जब ब्राउज़र स्टोरेज फ़ाइल की ज़रूरत से कम खाली जगह बताता है तो प्रीव्यू चेतावनी देता है। कुछ भी कमिट होने से पहले हर अखंडता-आवृत भाग जाँचा जाता है, और क्षतिग्रस्त प्रति को बिना कुछ छोड़े अस्वीकार कर दिया जाता है।
:::

लिंक और फ़ाइल दोनों एक स्नैपशॉट सौंपते हैं। लाइव संपादन के लिए [Working together](/info/collaborate.html) दो डिवाइस के बीच निजी collab और Lolly Work से वैकल्पिक work collab कवर करता है।

## एसेट - आपकी लाइब्रेरी

**Assets** (`#/a`) वह सब जमा करता है जिस पर आपके टूल आधारित हो सकते हैं: ब्रांड लोगो, इमेज, ऑडियो और मोशन, प्रकार के अनुसार समूहित, और आपकी अपनी फ़ाइलें। आपके अपलोड आपके डिवाइस पर संग्रहीत होते हैं। Lolly Work उपयोग करने वाला संगठन अपने पहुँच नियमों के तहत साझा कैटलॉग भी दे सकता है; देखें [अपने संगठन में Lolly उपयोग करें](/info/organisation.html)।

![एसेट, ब्रांड के स्वॉच और फ़ॉन्ट के साथ, और आपके अपने अपलोड](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches%2Cfonts&width=1440&height=900&dpi=96&waitMs=2400&css=.plat-swatch-grid~%2A%7Bdisplay%3Anone%7D&walker=1&format=svg&localize=1&dark=1&filename=assets)

- <!--i:upload--> **अपनी फ़ाइलें लाएँ।** अपलोड क्षेत्र पर इमेज, SVG, ऑडियो क्लिप, वीडियो, Lottie, PDF या PowerPoint डेक डालें, या चुनने के लिए क्लिक करें। वह तुरंत Assets में और हर टूल के एसेट पिकर में आ जाती है। बहु-पृष्ठ PDF या `.pptx` पूछता है कि कौन से पृष्ठ या स्लाइड रखने हैं, और हर एक SVG एसेट बनता है। टूल के भीतर जोड़ी गई इमेज **My images** में वैसी ही रखी जाती है जैसी आई थी, इसलिए उस पर Content Credential अब भी सत्यापित होता है, और केवल बहुत बड़ी फ़ाइल पूछती है कि आकार बदलना है या नहीं। **Settings → Storage** दिखाता है कि **My images** में कितना है। आपके डिवाइस के स्टोरेज से आगे कोई सीमा नहीं। इमेज आते समय EXIF और GPS डेटा साफ़ करने के लिए **Settings → Feature flags** के अंतर्गत **Strip metadata from uploads** चालू करें; Content Credentials दोनों हाल में रखे जाते हैं।
- <!--i:star--> **जो बार-बार लेते हैं उसे पसंदीदा बनाएँ।** एसेट या ब्रांड स्वैच पर तारा लगाएँ और वह हर पिकर के ऊपर पिन हो जाता है।
- <!--i:folder--> **व्यवस्थित करें।** एसेट को दूसरे समूह में ले जाएँ, जो साझा ब्रांड एसेट आप उपयोग नहीं करते उसे छिपाएँ (**Show hidden** उसे वापस लाता है) या अपने अपलोड हटाएँ। Projects वाला वही चयन बार पूरे चयन पर काम करता है।
- <!--i:layers--> **वीडियो को उसकी पृष्ठभूमि से अलग करें।** वीडियो का विवरण खोलें, या एसेट पिकर में उसके कार्ड पर राइट-क्लिक करें, और **Remove background…** चुनें। **On-device model** व्यस्त दृश्य में से विषय को काट निकालता है; **Colour key** समान रोशनी वाली पृष्ठभूमि, जैसे ग्रीन स्क्रीन, हटाता है, किनारे के लिए **Tolerance**, **Softness** और **Spill removal** के साथ, और कोई डाउनलोड नहीं चाहिए। **Resolution** (360, 480, 720 या 1080p, स्रोत से ऊपर कभी नहीं) ब्योरे और गति का सौदा करता है। कटआउट, असली पारदर्शिता वाला एनिमेटेड WebP या PNG, मूल के बगल में सहेजा जाता है, और स्रोत का Content Credential इंग्रीडिएंट के रूप में साथ चलता है। [Generated once, rendered the same](/info/ai-features.html) समझाता है कि यह सादा संपादन क्यों बना रहता है।

### अपना पैलेट और फ़ॉन्ट कहीं भी ले जाएँ

Assets में **Swatches** पैनल वे रंग दिखाता है जिनसे आपका ब्रांड बना है: उसके ब्रांड रंग, आपके जोड़े रंग, उसकी रैम्प और उसका स्पेक्ट्रम। जो भूमिका-रंग Lolly इंटरफ़ेस के लिए रखता है (टेक्स्ट, सतहें, किनारे, colourway लीड और किसी ब्रांड रंग की दूसरे नाम से प्रतियाँ) पैनल के नीचे धूसर **Show colour roles** कार्ड के पीछे प्रतीक्षा करते हैं।

हर रंग किसी भी अन्य एसेट की तरह एक कार्ड है। उसका विवरण खोलने के लिए एक पर क्लिक करें, केवल कुछ डाउनलोड करने के लिए कई चुनें या पूरा पैलेट उस फ़ॉर्मेट में डाउनलोड करें जो आपका दूसरा टूल पढ़ता है:

- <!--i:code--> **Design tokens (JSON)**, **CSS variables** या **CSS classes**, स्टाइलशीट या बिल्ड के लिए। sRGB से चौड़ा रंग अपना चौड़ा मान रखता है: CSS उसे हेक्स के बाद सेट करती है, और JSON हेक्स को चौड़े रंग, CMYK बिल्ड और स्पॉट इंक के साथ रखता है।
- <!--i:palette--> **Adobe Swatch Exchange (.ase)**, Illustrator या Photoshop के लिए। CMYK बिल्ड से बँधा रंग उसी CMYK स्वैच के रूप में आता है, स्पॉट इंक नामित स्पॉट स्वैच के रूप में और sRGB से चौड़ा रंग Lab के रूप में।
- <!--i:pentool--> **GIMP palette (.gpl)**, GIMP या Inkscape के लिए, और **SCSS variables**, दोनों sRGB में।

![Swatches पैनल: ऊपर पाँच पैलेट डाउनलोड बटन, फिर हर ब्रांड रंग एक चिप के रूप में जो उसका विवरण खोलती है](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches&width=1440&height=900&dpi=96&waitMs=1800&css=.cat-group%3Anot%28%5Bdata-group%3Dswatches%5D%29%7Bdisplay%3Anone%7D&cropSelector=%5Bdata-group%3Dswatches%5D&walker=1&format=svg&dark=1&filename=use-swatch-downloads)

हर कार्ड के बिंदु से रंग चुनें: बीच के सबके लिए दूसरे बिंदु पर Shift-क्लिक करें, खाली जगह में बॉक्स खींचें या किसी कार्ड पर फ़ोकस के साथ Cmd/Ctrl+A दबाएँ। बार उन्हीं छह फ़ॉर्मेट में **Download as…**, **Copy hex** और **Favourite** देता है। फ़ॉर्मेट चुनने से पहले मेनू वे रंग सूचीबद्ध करता है जिन्हें कोई फ़ॉर्मेट नहीं रख सकता (Transparent में कोई रंग ही नहीं), कौन से फ़ॉर्मेट चौड़े रंग को उसके sRGB विकल्प के रूप में सहेजते हैं (SCSS और GIMP) और कौन CMYK और स्पॉट मान रखते हैं (JSON और .ase)। एक रंग पर वही क्रियाएँ पाने के लिए कार्ड पर राइट-क्लिक करें।

रंग का विवरण प्रीव्यू को उस रंग से भर देता है और **Linked values** (उसका CMYK बिल्ड या स्पॉट इंक, किसी ख़ास स्पेस या प्रेस के लिए लिखा कोई मान और उसका डिज़ाइन टोकन), **Every notation** (हेक्स, OKLCH, Display-P3 और बाकी, हर एक कॉपी बटन के साथ), **Plotted on a colour space**, **Tones** और **Readability** खोलता है। तीर कुंजियाँ पैलेट में चलती हैं, **Copy link** रंग को स्वयं साझा करता है और **Open in Colour Lab** उसे आगे ले जाता है।

**Fonts** पैनल आपके ब्रांड फ़ेस सूचीबद्ध करता है, हर एक के लिए **download** के साथ, स्थानीय रूप से इंस्टॉल करने या प्रिंट शॉप को देने के लिए।

## ग्रिड को अपना बनाएँ

- <!--i:star--> **जो उपयोग करते हैं उसे पसंदीदा बनाएँ।** कार्ड पर राइट-क्लिक करके **Add to favourites** चुनें, और उसे ग्रिड के ऊपर की पट्टी में बड़ी टाइल मिलती है। [Your favourites](/info/favourites.html) पट्टी को कवर करता है।
- <!--i:eyeoff--> **जो टूल कभी उपयोग नहीं करते उसे छिपाएँ।** कार्ड पर राइट-क्लिक करें, या कई चुनें, और **Hide tool** चुनें। वह ग्रिड से और ग्रिड में टाइप करने पर मिलने वाले परिणामों से बाहर हो जाता है। अंत में धूसर **Show hidden tools (N)** टाइल उन्हें फिर धुँधला करके दिखाती है, हर एक के मेनू में **Unhide tool** के साथ। छिपाना केवल आपका ग्रिड बदलता है: टूल अब भी लिंक या बुकमार्क से खुलता है।
- <!--i:clock--> **आपके टूल, पहले।** जब आप तीन अलग टूल में काम सहेज लें, तो ग्रिड के ऊपर चिप की **Yours** पंक्ति आपके पसंदीदा और हाल के टूल से शुरू होती है।
- <!--i:sliders--> **अपने ढंग से सजाएँ।** **View options** लेआउट (**Grid**, **Card** या **List**), कार्ड का आकार और घनत्व, क्रम और श्रेणी फ़िल्टर तय करता है।

![Tools ग्रिड का अंत, छिपे टूल दिखाए हुए: धुँधला Wordmark कार्ड, और उसके बगल में वह धूसर टाइल जिसने उसे दृश्य में टॉगल किया, अब Hide hidden tools पढ़ती हुई](/t/url-shot?url=%2F%23%2F&width=1440&height=680&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A.gtile--hiddenbox%3Bpress%3AEnd%3Bwait%3A800%3Bhover%3A.gtile--hiddenbox%3Bwait%3A300&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&rasterDpi=96&dark=1&filename=misc-hidden-tools)
<!--
SHOT NOTE (misc-hidden-tools): the trailing `press:End` is required. The
hidden box and the revealed cards live at the very END of the grid, and
clicking the box runs applyView(), which re-lays the grid out and drops the
scroll back to the top - so without it the frame published the TOP of the
gallery under a caption about its bottom. `press:` with no `on=` goes to the
keyboard, and the End key with focus on the just-clicked box scrolls the
document; the walker then anchors the body walk to that band.
The tile reads "HIDE hidden tools" in the shot, not "Show" - it is a toggle and
the recipe has just pressed the tile. The alt says so rather than quoting the resting
label the prose above already gives.
The recipe hides nothing itself. The lolly-demo catalog the captures pin
ships Wordmark hidden (`defaultHiddenTools` in its assets index.json), so a
fresh profile already has one hidden tool and the recipe only clicks the grey
reveal tile (`.gtile--hiddenbox`, confirmed in gallery.ts). It used to tick
the QR Code card and press the bulk bar's Hide button first; under lolly-demo
that published Wordmark dimmed and QR Code not, under a caption naming QR
Code, so the steps were dropped rather than relied on. QR Code was hidden
in that run too: the End scroll had left the pointer over its card, and a
hovered hidden card lifts its dimming (gallery.css), so it read as a normal
tool. The closing `hover:` puts the pointer back on the reveal tile, which
keeps every revealed card dimmed.
-->

**एक साथ कई कार्ड पर काम करें।** हर कार्ड का चेकबॉक्स टिक करें, खाली जगह पर चयन बॉक्स खींचें या Shift/Cmd-क्लिक करें, और एक बार आता है जिसमें वह है जो वह व्यू अनुमत करता है:

- **Tools और Utilities:** Favourite, Hide, Available offline, **View sessions** (Projects, केवल उन टूल से बने सत्र दिखाते हुए) और एकल कार्ड के लिए Copy link।
- **Assets:** किसी भी चयन के लिए Favourite और Hide। Duplicate, Download और Delete तभी दिखते हैं जब चुना हर आइटम आपका अपना अपलोड हो, क्योंकि साझा design-system एसेट स्थायी अनुबंध है।
- **Projects:** देखें [Find and recover your work](/info/find-your-work.html#find-something-you-saved)।

![दो टूल के लिए गैलरी सिलेक्शन बार, जिसमें Available offline, View sessions, Favourite और Hide दिए गए हैं](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%21important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-select%3D%22gradient%22%5D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=misc-bulkbar-gallery&cropSelector=.gallery-bulkbar)
<!--
SHOT NOTE (misc-bulkbar-gallery): drive targets `[data-select="qr-code"]` /
`[data-select="gradient"]` - the `.tile-check[data-select="<ref>"]` checkbox button
confirmed directly in views/gallery.ts's card markup (the same attribute
cardMarkup gives every tile), so these two clicks tick both cards without
opening either tool.

SHOT NOTE (misc-sessions-by-tool, NOT PUBLISHED): the "View sessions" result
had a recipe of its own (`/#/p?tools=qr-code,d3`, views/projects.ts's
toolsBodyHtml()), dropped here because it has no `drive=` that can
manufacture its own content - a saved session isn't a click away, it has to
already exist, and build-docs-shots.ts gives every shot a fresh
`browser.newContext()`. It would publish an empty list. Same dependency the
`projects` shot (now on find-your-work.md) carries; revisit if the pipeline gains a
storage-seeding hook.
-->

**View sessions** तभी दिखता है जब कुछ चुना गया हो। इसके बजाय किसी एक बिना चुने कार्ड पर राइट-क्लिक करें और वह **N saved sessions** देता है, उस टूल के सहेजे सत्रों की सूची जहाँ हटाना सत्र को ट्रैश में ले जाता है।

## फ़ोन पर

संकरी स्क्रीन पर लेआउट एक स्तंभ बन जाता है:

- **नियंत्रण एक शीट बन जाते हैं** ऊपर, निचले किनारे पर ड्रैग ग्रिप के साथ। **peek**, **half** या **full** पर टिकाने के लिए ग्रिप खींचें, या समेटने और फैलाने के लिए टैप करें। प्रीव्यू नीचे की जगह भरता है और संपादन के दौरान दृश्य में रहता है।
- तैरता **Export** बटन एक्सपोर्ट शीट खोलता है: फ़ॉर्मेट, आकार, कॉपी, सेव और डाउनलोड एक जगह। शीट बंद करने के लिए बैकड्रॉप टैप करें।

![A tool on a phone-width screen - controls as a sheet up top, the generated palette filling the preview below and the render pill floating bottom-centre](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3Df97316%26harmony%3Dadjacent-3%26steps%3D9&width=430&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=vt-phone-palette)

## Settings, ध्वनि और आराम

होम स्क्रीन के नीचे **Settings** में आपका ब्योरा, आपके design system, एक्सेसिबिलिटी, स्टोरेज और ऑफ़लाइन डाउनलोड हैं। [Settings](/info/dashboard.html) हर टैब का नक्शा देता है।

- **आपका ब्योरा और हेडशॉट** ऐसे किसी भी टूल में भरते हैं जो उन्हें उपयोग करने के लिए बना है, जैसे ईमेल सिग्नेचर या बैज। [Profiles](/info/profile.html) उन्हें कवर करता है।
- **Accessibility** में चार आराम स्विच हैं: **Reduce motion**, **Hide colourful previews**, **High contrast** और **Large text**। वे आपके काम के आसपास का ऐप बदलते हैं, टूल कैनवास या एक्सपोर्ट कभी नहीं।
- **Sound** आपके कामों के लिए हल्की सहायक ध्वनियाँ बजाता है, और **Neurospicy Mode** शांत फ़ोकस ट्रैक बजाता है। दोनों तब तक बंद हैं जब तक आप **Settings → Accessibility** या प्रोफ़ाइल मेनू में उन्हें चालू न करें।
- **Available offline** कनेक्शन जाने से पहले ऐप का बाकी हिस्सा, आपके टूल, कैटलॉग और गाइड डाउनलोड करता है। Lolly इंस्टॉल हो सकने वाला वेब ऐप है: फ़ुलस्क्रीन ऐप के लिए अपने ब्राउज़र का इंस्टॉल बटन उपयोग करें, या फ़ोन पर *Add to Home Screen*, जो ऑनलाइन लौटने पर स्वयं अपडेट होता है।
- **Storage** दिखाता है कि Lolly इस डिवाइस पर क्या रखता है। [If you clear your browser data](/info/find-your-work.html#if-you-clear-your-browser-data) समझाता है कि साफ़ करने से क्या हटता है, और [Privacy Policy](/info/privacy.html) वह सब सूचीबद्ध करती है जो ऐप लाता या भेजता है।

::: note अपडेट के बाद कोई व्यू लोड न हो तो
अपडेट के ठीक बाद खाली पैनल या "failed to fetch" संदेश आमतौर पर एक रीलोड से साफ़ हो जाता है। आपका सहेजा काम, सत्र और design system अछूते रहते हैं, क्योंकि वे आपके डिवाइस पर संग्रहीत हैं। केवल वह चित्र जो आपने जोड़ा और कभी सहेजा नहीं, उसे दोबारा जोड़ना पड़ सकता है।
:::

## आगे कहाँ जाएँ

- **[Design: the free canvas](/info/design.html)**: कैनवास, आकृतियाँ, टाइमलाइन और डेक प्रस्तुत करना।
- **[Batch and Multi-edit](/info/batch.html)**: एक डिज़ाइन के कई संस्करण, या कई सहेजे डिज़ाइन एक साथ संपादित।
- **[Export a file](/info/exporting.html)**: फ़ॉर्मेट, आकार, प्रिंट इकाइयाँ, पारदर्शिता और वीडियो चुनना।
- **[Import a design](/info/design-import.html)**: Figma, Penpot, Illustrator या InDesign फ़ाइल को Design में लाएँ और संपादन जारी रखें।
- **[Templates](/info/templates.html)**: टूल के सहेजे आरंभ बिंदु।
- **[Wide Colour and HDR](/info/hdr-editing.html)**: Design और Darkroom में मूल इमेज की सटीकता रखें।
- **[Find and recover your work](/info/find-your-work.html)**: सब कुछ कहाँ है, और उसे दूसरे डिवाइस पर कैसे ले जाएँ।
