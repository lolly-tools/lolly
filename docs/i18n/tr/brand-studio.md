# Brand Studio

`#/start` adresindeki **Brand Studio**, markanı şekillendirdiğin tek yerdir - logoları, renkleri, tipografisi, belirteçlerinin geri kalanı ve tuttuğu dosyalar. Burada bir kez ayarla, her araç, sayfa ve dışa aktarım *incelemeyle değil, yapısı gereği* onu izler.

Değişiklikler yaptığın anda **uygulamanın tamamında canlı olarak** önizlenir, böylece bir rengin ya da yazı tipinin her yere nasıl yansıdığını, onaylamadan önce görebilirsin. Hepsi cihaz üzerinde gerçekleşir: marka dosyaların ve belirteçlerin cihazından asla çıkmaz (bir Google Font seçmek, bir onay iletişim kutusundan sonra o tek aile yazı tipini Google'dan bir kez getirir) ve marka tek bir [brand pack](#move-a-brand-between-devices) dosyası içinde taşınır.

> **Burası düzenleyici. Dashboard ise aynadır.** Dashboard'daki (`#/d`) **Design system** sekmesi markanı salt okunur olarak *gösterir*; onu burada, `#/start`'ta *düzenlersin*. Daha sonra bir rengi değiştirmek istersen Brand Studio'ya geri dön.

## Odalar

Stüdyo, kenarda dikey bir rayda listelenen bir dizi **oda**dan oluşur - adım değil. Hiçbir şey numaralandırılmamıştır, hiçbiri başka bir şeye bağlı değildir ve hangisine gelirsen gel geçerlidir:

- **Overview** - merkez oda. Şu anda ne var, tek bakışta, her odaya açılan bir kapıyla birlikte.
- **Colours** - renkleri teker teker ekle, rol ata ya da tek bir renkten bütün bir palet üret.
- **Type** - uygulamanın, araçlarının ve her dışa aktarımın okuduğu dört yazı tipi.
- **Logos** - markaların, her yönelim ve işlemde.
- **Tokens** - köşe yarıçapı, boşluk, gölgeler ve sistemin geri kalanı.
- **Files** - markanın tuttuğu görsel, ses ve hareket dosyaları.

Telefonda aynı liste, başlığın altına sabitlenmiş yatay bir çip şeridine dönüşür. Oda değiştirmek hiçbir şeyi yeniden yüklemez - düzenleyici tüm panellerini yüklü tutar ve yalnızca istediğini gösterir.

`#/start?area=<key>` ile bir odaya **derin bağlantı** ver. Anahtarlar: `overview`, `color` *(URL'de ABD yazımına dikkat)*, `type`, `logos`, `tokens`, `catalogue` (Files odası - panel anahtarı kalıcı bir sözleşmedir, bu yüzden URL eski adı korur) ve `versions`. `?tab=` aynı şey için uzun süredir var olan takma addır ve hâlâ çözümlenir, böylece eski bağlantılar ve yer imleri çalışmaya devam eder; tanınmayan her şey çıkmaz sokağa girmek yerine Overview'ı açar.

**Rayın altına** sabitlenmiş olanlar, tek bir odaya değil bütün tasarım sistemine ait eylemlerdir:

- **Add from…** - bir markayı bir dosyadan, PDF'ten, görselden, yazı tipinden ya da bir web sitesinden getirmek için kaynak seçici. Aşağıda bkz. [Bring a brand in](#bring-a-brand-in).
- **Tray** - bir taramanın bulduğu ama henüz uygulanmamış adaylar. Bir tarama gerçekten bir şey tutana kadar gizli kalır, tuttuğunda bir sayı taşır; o satırda Add'e basana kadar içindeki hiçbir şey markanı değiştirmez.
- **Export** - bütün markayı tek bir `LollyBrand-…zip` olarak yazar.
- **Tokens (.json)** - bir depo, bir derleme adımı ya da başka bir belirteç aracı için, tek başına düz tasarım-belirteçleri belgesi.
- **Versions** - tasarım sisteminin adlandırılmış kopyalarını yayınla, etkinleştir ve geri yükle. Yayınlanacak kendi bir şeyin olana kadar gizlidir (ya da bir `?area=versions` bağlantısı onu adıyla istemedikçe).

![Stüdyo oda rayı - Overview, Colours, Type, Logos, Tokens ve Files](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-rail&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

## Overview

Overview, ilk geldiğin odadır ve iki yüzü vardır.

**Henüz hiçbir şey kurulmamışken** iki kapı sunar - **Start from a file** (tasarım belirteçleri, bir Penpot projesi, bir tasarım sistemi paketi ya da bir SVG) ve **Start from scratch** (bir renk ekle, sonra ne zaman istersen devam et) - ve bunların altında sessiz bir **Explore the tools** çıkışı, çünkü ayrılmak da geçerli bir cevaptır.

Bir tasarım sistemi var olduğunda, aynı oda **elinde ne olduğunu** gösterir: palet ve renk sayısı, yürürlükteki yazı tipi aileleri, kaç logo yuvasının dolu olduğu, kaç belirteç olduğu ve Files odası. Her blok kendi odasına açılan bir kapıdır. Burada sayılar vardır, asla bir ilerleme çubuğu ve asla bir bitirme kartı yoktur - bu stüdyoda kimseye borç yoktur.

## Logos

Marka dosyalarının bulunduğu klasörü en üstteki bırakma bölgesine boşaltarak başla: **"Drop marks here, or choose several at once"**, elindeki dosyaların tümünü tek seferde alır. Her dosya şekli ve mürekkebi için okunur, ardından ne düşündüğünü söyleyen bir çip olarak **Waiting for a slot** altında sıraya girer - *"Looks like the Horizontal primary"*, dayandığı ölçümle birlikte, ve bir **Place** düğmesi (o yuva zaten doluysa **Replace**). Emin olmadığında çip bunu açıkça söyler ve bunun yerine sekizinin tümünü listeleyen **Change slot**'u sunar. Bir şeye basana kadar hiçbir şey yerleştirilmez.

O sırada iki şey olur. Fazla boş kenar boşluğu olan bir marka önce bir **kırpma önerisi** alır - yanıtla ya da Escape'e bas, orijinal dosya dokunulmadan girer. Ve bir markanın boş bir kardeş yuvayı doldurabileceği durumlarda oda, türetilmiş **mono** ya da **reverse** sürümünü *Generated* olarak işaretlenmiş kendi çipinde sunar; o yuvayı başka bir şekilde doldurursan bu çip yeniden kaybolur.

Onun altında her markanın son bulduğu ızgara yer alır - **yönelim × işlem** yuvaları:

- **Orientations:** Horizontal (bir satırda kelime işareti + sembol) ve Vertical (üst üste, kare ve dikey alanlar için).
- **Treatments:** Primary, Primary reverse (koyu arka planlar için), Mono (tek renk) ve Mono reverse.

Bu, sekiz isteğe bağlı yuva demek. Bir PNG, SVG, JPEG ya da WebP eklemek için bir yuvaya tıkla; değiştirmek için dolu bir yuvaya tıkla. Her yuva isteğe bağlıdır ve her şey bu cihazda kalır.

![Logo matrisi - üstte her yönelim, kendi kesikli çizgili yuvası olan her işlem, hepsi isteğe bağlı](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&width=1440&height=1600&dpi=192&waitMs=1600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Custom marks** - markanın kendi adlandırdığı markaları (bir simge, bir arma, bir favicon) **Custom marks** altında ekle; ona bir ad ver ve bir dosya seç.
- **More identities** - bir alt marka, ürün ya da etkinlik kendi tam logo setine sahip olabilir. **+ Add another logo**'yu kullan ve ona bir ad ver; ana setin sadece "Your logo"dur.
- **Bir SVG yükle, Lolly renklerini okusun.** Yepyeni bir kurulumda, logodan aldığı birincil rengi sessizce ayarlar ve bunu belirtir. Mevcut bir markada ise rengi bunun yerine bir öneri olarak sunar - *"Found in the logo: #…"* yanında bir **Use as primary** düğmesiyle - Colours odasında, orada kabul edebilir ya da reddedebilirsin.

## Colours

![The Colours room after one colour - the two panes back, the generate offer, roles reading in three registers and the pane at one colour](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

En zengin oda, iki bölmeli. Sol taraf çalıştığın yer; sağ taraf ise **canlı palet**in. Aralarındaki ayırıcıyı sürükleyerek boyutlandır (üzerinde Enter'a basmak paleti kenara katlar).

![Colours odası - bir birincil renk tonlar türetir, kontrast oranlı numune kartları ve canlı bir palet](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

### Bir renk ekle, sonra ona bir görev ver

**Add a colour**, basit yolun tamamıdır: herhangi bir gösterimde bir rengi yapıştır ya da seç, tam olarak bir belirteç haline gelir. Ondan hiçbir şey türetilmez, içine hiçbir şey önerilmez, başka hiçbir şey istenmez. Bütün bir renk *listesi* yapıştır, her biri ayrı ayrı ekleyebileceğin bir çip haline gelir.

**Roles**, üstteki katmandır - hangi rengin hangi rolü oynadığı. Roller isteğe bağlıdır (üç bağımsız renkten oluşan ve rolsüz bir tasarım sistemi de gayet iyidir), herhangi bir renk örneği bir rol alabilir ve kontrast okuması yüzeye karşı, önce APCA olmak üzere ölçülür.

### Uzman kanatlar

Bu ikisinin altında dört katlanmış bölüm bulunur. İstediğini aç; her biri `#/start?area=color&focus=<wing>` olarak derin bağlantı verilebilir:

- **Generate a starter palette** (`focus=generate`) - bir renkten tam bir ton setine. Aşağıda anlatılıyor.
- **Shade curves** (`focus=curves`) - bir tonu nokta nokta yeniden şekillendir. Lightness, chroma ve hue her biri L / C / H ile değiştirilen kendi eğrisine sahiptir ve sürüklerken alttaki tonlar canlı olarak yeniden pişirilir.
- **Contrast** (`focus=contrast`) - **Contrast-lock**, seçtiğin bir arka plana karşı APCA hedeflerini tutturmak için bir tonu yeniden tonlar, her adım kendi hue ve chroma'sını korur; **Rotate hue**, bütün tonu tekerlek etrafında topluca döndürür, her ton kendi lightness ve chroma'sını korur.
- **Print** (`focus=print`) - birincil rengin baskıda ne olacağı: otomatik ekran değeri ya da bunun yerine sabitlenmiş bir CMYK derlemesi ya da adlandırılmış bir spot mürekkep.

### Bir renk, bütün bir palet

**Generate a starter palette** içinde bir **Primary colour** seç, Lolly de motorun her yerde kullandığı aynı algısal renk matematiğini (OKLCH) kullanarak tam bir palet çıkarır - açık ve koyu yüzeyler, metin, vurgular ve tam tint/shade tonları. Türetmeyi ayarla:

- **Scheme** - Mono, Complement, Analogous ya da Triad - ikincil rengin birincil renkle nasıl ilişkilendiğini belirler.
- **Shades** - 3 ile 20 arasında bir kaydırıcı (varsayılan 5), her tonun kaç adım üreteceğini denetler.
- **Fine-tune** (katlanmış) - **UI intensity** (Muted / Deep), **Contrast** (Comfort / High) ve **Text on brand** (Auto / Light / Dark).

Bu kanattaki hiçbir şey markana yazılmaz. Bu, **Replace palette**'e basana kadar (aşağıda) değerlendirebilmen için uygulamanın tamamında canlı olan bir önizlemedir.

Birincilin altında canlı **Primary / Neutral / Secondary / Blend** tonlarını ve her biri kendi kontrast okumasını taşıyan Light ve Dark numune kartlarını görürsün - yanında APCA `Lc` değeriyle birlikte WCAG oranı. Türetilmiş varsayılan yerine o tonu sabitlemek için **Neutral ya da Secondary tonunda bir adıma tıkla**.

![Açık ve koyu numune kartlarının üzerinde istiflenmiş dört rampa, her kart kendi WCAG kontrast oranını taşıyor](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

### Paletini oluştur (uyum üretici)

Aynı kanatta, **Paletini oluştur** birincil renginden eşleşen vurgu renkleri üretir. Bir **Uyum** seç - **Tümleyici**, **Komşu**, **Üçlü**, **Dörtlü** ya da **Analog** (kendi **Vurgular** sayısını, 2 ila 5 arası, ve 10°-45° arasında bir ton **Açısı** getirir) - ve her aday, otomatik oluşturulmuş okunabilir bir adla ve bir **+ Ekle** düğmesiyle gelir. Birini eklemek o rengi paletine anında koyar, bir basış bir token'a karşılık gelir. *"Paletin, uygulanmış hali"* bütün seti gerçek grafikler üzerinde önizler.

![Üretilen vurgular, her biri bir renk örneği, otomatik oluşturulmuş bir ad, hex kodu ve bir Ekle düğmesiyle](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### Üretilen bir paleti onaylamak

**Paleti değiştir**, bu kanattaki herhangi bir şey yazan tek kontroldür ve asla hemen yazmaz. Ona bas, önce bir inceleme kartı açılır, **"Palet değiştirilsin mi?"** başlığını taşır ve hemen olacak şeyi tam olarak sıralar: kaç rolün senin atadığın gibi kaldığı, kendin eklediğin kaç rengin korunduğu, kaç ton eğrisinin yeniden çıpalandığı, kaç baskı kilidinin yeniden sabitlendiği, kaç gizli tonun gizli kaldığı, kaç gradyan durağının rengini koruduğu.

O kart üzerindeki **Paleti değiştir** işlemi onaylar; **İptal** vazgeçer ve hiçbir şeyi değiştirmez. Çalıştıktan sonra kart **"Palet değiştirildi."** haline gelir, üzerinde tek bir **Geri al** zaten odaklanmış durumdadır - ve değişimden *önce* bütün tasarım sisteminin bir kontrol noktası alınır, böylece "eski haline getir" kayıp bir öğleden sonra değil bir geri yükleme olur.

### Palet, çizelge ve her renk örneği

Sağ bölme markanın taşıdığı her rengi listeler, gruplanmış halde (Birincil, Nötr, İkincil, Spektrum, Özel, Roller), her grup kendi **+ Ekle** düğmesiyle katlanabilir. Altında, **Renk çizelgesi** aynı renk örneklerinin iki görünümüyle açılır: **Çark** (OKLCH çarkı - yeniden renklendirmek için bir noktayı sürükle, düzenlemek için bir noktaya tıkla ya da yeni bir renk örneği koymak için boş alana tıkla) ve **Gamut** çizelgesi, görüntülenebilir aralığın gerçekte nerede bittiğini gösterir. `#/start?area=color&focus=chart`, kartı `?wheel`'in her zaman yaptığı gibi doğrudan açar.

![Palet bölmesi, her grup katlanabilir, indirme hapı alt kenarda park etmiş](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A500%3Bclick%3A%5Bdata-be-generate-cta-go%5D%3Bwait%3A900%3Bclick%3A%5Bdata-be-replace-palette%5D%3Bwait%3A800%3Bclick%3A%5Bdata-be-review-go%5D%3Bwait%3A1400&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![OKLCH çarkı - açı ton, dıştaki mesafe doygunluk ve griler yan tarafta bir açıklık rayında ilerliyor](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A500%3Bclick%3A%5Bdata-be-generate-cta-go%5D%3Bwait%3A900%3Bclick%3A%5Bdata-be-replace-palette%5D%3Bwait%3A800%3Bclick%3A%5Bdata-be-review-go%5D%3Bwait%3A1400%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

Düzenleyicisini açmak için herhangi bir renk örneğine tıkla:

- Onu **Yeniden adlandır**.
- **Rengi ayarla** - seçici algısal **OKLCH** kaydırıcılarıyla açılır, **Hex**, **HSL**, **RGB** ve **CMYK** modlarıyla; değer alanı hangi uzay etkinse ondan okur *ve* ona yazar, böylece bir hex yapıştırabilir ya da mürekkep yüzdeleri yazabilirsin. CMYK girmenin *ekran* rengini dönüşüm yoluyla ayarladığını unutma - kesin mürekkepleri sabitlemek için aşağıdaki baskı kilidini kullan.
- **Şu şekilde saklanır** - renk örneğinin nasıl kalıcı hale getirileceğini seç: **LCH** (varsayılan - algısal, geniş gamut, düzenleme için en iyi seçim), Hex, RGB ya da HSL. Kesin bir eski hex'i sabitlemen ya da bir sRGB değeriyle eşleştirmen gerektiğinde bunu geçersiz kıl.
- **Şu olarak kullan** - Roller paneline geri dönmeden bu renk örneğine marka rollerinden birini doğrudan ver. (Bir rolün kendi kutucuğu bunu sunmaz - bir rol bir rol alamaz.)
- **Baskı ikameleri** (katlanmış) - rengin baskı davranışını kilitle:
  - **CMYK** - otomatik sRGB→CMYK dönüşümünü kesin mürekkep değerleriyle (C/M/Y/K, 0-100) geçersiz kılmak için **Otomatik**'ten **Kilitli**'ye geçir.
  - **Spot renk** - renk örneğini bir spot renge kilitlemek için **Yok**'tan **Ayarlandı**'ya geçir; bir **Ad** ver (örn. `PANTONE 186 C`), isteğe bağlı bir **Kitap** ve mürekkep hiç mürekkep değilse - bir yaldız, bir kabartma ya da gömme baskı, bir spot vernik, yumuşak dokunuş ya da bir kesim, katlama ya da delikleme için isteğe bağlı bir **Bitiş** (varsayılan olarak Sıradan mürekkep).
- **Diğer uzaylarda** (katlanmış) - aynı fikrin genişletilmişi: her satır bu renk örneğinin ifade edilebileceği bir uzaydır, ya kanonik değerden türetilmiş ya da senin tarafından yazılmış, yazılmış olan dışa aktarımda kazanır.

Bu baskı kilitleri, bir CMYK PDF ya da TIFF dışa aktardığında bir matbaanın kullandığı şeydir - bkz. [Dışa aktarma](/info/exporting.html#colour-profiles).

**Bir renk örneğini silmek** güvenlidir: türetilmiş ton adımları ve tema rolleri *gizlenir* (alttaki token çözülmeye devam eder, böylece hiçbir şey akış aşağısında bozulmaz), kendin eklediğin renkler ise tamamen kaldırılır.

### Gradyanlar

İsteğe bağlı bir **Gradyanlar** paneli, arka planlar ve vurgular için paletinden karışım token'ları oluşturur. Markan gradyan kullanmıyorsa tamamen atla. Her gradyanın bir önizlemesi, adlandırılmış durakları (2-8) ve bir açısı vardır. Kilit davranış: **bir durak bir renk örneğine referans verir**, o yüzden o renk örneğini yeniden renklendir ve gradyan onu izler. İnterpolasyon temiz karışımlar için OKLCH'de çalışır. Çalıştırmayı kısaltmak için bir durağı sil.

### Paleti başka bir yere taşı

Palet bölmesinin alt kenarında park etmiş yüzen hap, bütün paleti **Tasarım token'ları (JSON)**, **CSS değişkenleri**, **CSS sınıfları**, **SCSS değişkenleri**, bir **GIMP paleti (.gpl)** ya da bir **Adobe Swatch Exchange (.ase)** olarak indirir - böylece marka doğrudan Illustrator, Figma, GIMP ya da bir stil sayfasına düşer. Bölmenin kaydırma alanının dışında oturur, böylece palet ne kadar kaydırılırsa kaydırılsın yerini korur. (Paleti [Katalog](/info/using.html) görünümünden de indirebilirsin.)

## Tip

![The compare stage open under its card, with the search row, the pinned families and the cards folded to a one-line strip](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

Oda **dört rol kartıyla** başlar - uygulamanın, araçlarının ve her dışa aktarımın gerçekte okuduğu dört yüz. Her kart o role şu anda ne hizmet ettiğini, o yüzde ayarlanmış olarak, altında gerçek bir metin satırıyla gösterir:

- **Birincil** - gövde metni, düğmeler ve her araç.
- **Başlıklar** - `h1`/`h2` için gösterim yüzü.
- **Kod** - kod ve veri için tek aralıklı bir yüz.
- **İtalik** - vurgu, alıntı ve ara sözler için gerçek bir italik eşlik.

Başlıklar, kod ve italik, sen onları atayana kadar birincile geri döner, böylece tek fontluk bir marka burada hiçbir karar gerektirmez. Bir kart üzerindeki hiçbir şey bir şey onaylamaz: **Değiştir** (ya da boş bir rolde **Bir yüz seç**), o role kapsamlanmış **karşılaştırma sahnesini** açar.

![Tip odası - rol kartları ve her yüzün işini yaparken canlı bir numunesi](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

### Karşılaştırma sahnesi

Sahne bir iletişim kutusunda değil, **odanın içinde** açılır, böylece geldiğin kartlar ekranda kalır. Bir Google Fonts ailesini ara (Inter, Fraunces, Space Grotesk…) ya da bir font dosyası bırak, **Karşılaştırmaya ekle**ye bas ve adaylar hiçbiri kurulmadan önce aynı sözcüklerde yan yana durur. Escape iptal eder ve klavyeyi onu açtığın karta geri verir.

Bu tek giriş kapısıdır, bu yüzden markana görülmeden hiçbir şey girmez. Sahnenin altında iki yönetim paneli bulunur:

- **Bu cihazdaki fontlar** - kurulu her aile, hizmet ettiği roller ve bir silme. Buradaki **Bir yüz ekle**, aynı karşılaştırma sahnesini kapsamsız açar.
- **Fontların** - kendi makinenden bir **TTF**, **OTF** ya da **WOFF** yükle. Zaten sahip olduğun lisanslı bir kurumsal yazı tipi için yol budur.

Her iki durumda da yüz bu cihazda kalır, uygulamada, araçlarında ve her dışa aktarımda görüntülenir, sonsuza dek çevrimdışıdır ve marka paketinde seyahat eder - render zamanında hiçbir şey getirilmez. Google Fonts'taki her şey açık bir lisans (OFL/Apache/UFL) altında gönderilir.

Altta yer alan **Tip rolleri** paneli her rolün canlı bir numunesini gösterir - birincil yüzde gövde ve arayüz, üst başlıklar için isteğe bağlı bir gösterim yüzü, vurgu için bir italik, kod ve veri için bir mono - böylece bütün seti birlikte çalışırken görebilirsin.

![Tip rolleri numunesi - başlık, gövde, italik ve kod, her biri o rolün çözüldüğü yüzde ayarlanmış, yanında yüz adıyla](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

## Token'lar

Tasarım sisteminin geri kalanı, koda dokunmadan düzenlenebilir:

![Token'lar odası - bir köşe yarıçapı kaydırıcısı ile boşluk, boyutlandırma, gölgeler ve sistemin geri kalanı](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **Yuvarlatılmış köşeler** - uygulama genelinde kartların, düğmelerin ve panellerin izlediği tek bir yarıçap kaydırıcısı (0-1.5rem).
- **Daha fazla token** - **boşluk**, **boyutlandırma**, **çizgi genişliği**, **saydamlık**, **döndürme**, düz **sayılar** ve **gölgeler** ekle ve düzenle. Bir tür seç, adlandır (*Gutter, Kart gölgesi…*) ve değerini ayarla. Bunlar standart [tasarım token'ları](/info/design-tokens.html) (DTCG) olarak saklanır ve markanla birlikte seyahat eder.

## Dosyalar

Markanın tuttuğu dosyaları - logolar hariç - buraya bırak: **vektör**, **görsel**, **ses** ve **hareket** (video, Lottie, animasyonlu) varlıkları. [Kataloğuna](/info/using.html) düşerler, bölümlere ayrılmış ve her aracın varlık seçicisinde hazır halde. Her şey bu cihazda kalır. (Rayda oda **Dosyalar** olarak etiketlenir; URL anahtarı `catalogue` olarak kalır, çünkü bir panel anahtarı kalıcı bir sözleşmedir.)

## Bir marka getir

Rayın altındaki **Şuradan ekle…**, iki aşamalı bir seçici açar. İlk aşama neyin *olduğunu* sorar, hangi biçim olduğunu değil:

- **Tasarım token'ları ya da bir tasarım dosyası** - DTCG ya da Tokens Studio JSON, bir Penpot projesi, bir **token seti zip'i**, bir Lolly tasarım sistemi paketi ya da bir SVG.
- **PDF** - renkleri, işaretleri ve gömülü yazı tipleri için bu cihazda okunan bir sunum ya da bir kılavuz dosyası.
- **Görsel** - bir ekran görüntüsü ya da bir fotoğraf; renkleri bu cihazda okunur ve hiçbir şey yüklenmez.
- **Font dosyası** - TTF, OTF ya da WOFF. Yüzün kurulduğu Tip odasını açar.
- **Web sitesi** - renkleri ve tipi için okunan tek bir sayfa. Bu kutucuk yalnızca bir sayfayı gerçekten okuyabilen bir cihazda görünür, çünkü kimsenin basamayacağı bir şeyi reklam eden devre dışı bir kutucuk, hiç kutucuk olmamasından daha kötüdür. Göründüğü yerde okuyucusunu açıkça adlandırır: bu cihazda uygulama tarafından getirilir ya da sen olarak oturum açmış halde, bir arka plan sekmesinde tarayıcı eklentisi üzerinden okunur. Bir URL adlandırmak alanı yalnızca *önceden doldurur* - getirme düğmesi rızadır, bu yüzden birinin sana gönderdiği bir bağlantı bir okumayı asla kendiliğinden başlatamaz.

Tasarım dosyası kaynağını seç ve ikinci aşama aşağıdaki karttır: kabul edilen biçimler tercih sırasına göre simge kutucukları olarak öne çıkar ve bütün kart tek bir bırakma hedefidir - herhangi bir yerine tıkla ya da üzerine bir dosya sürükle. Bir dosyayı doğrudan stüdyoya da bırakabilirsin.

![İçe aktarma kartı - kabul edilen biçimler simge kutucukları olarak öne çıkar ve bütün kart tek bir bırakma hedefidir](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

Her tasarım dosyasının sana verdiği:

- bir **LollyBrand** paketi (`.zip`) - tek adımda kurulur;
- bir **Penpot** dışa aktarımı (`.penpot`) - tasarım token'larını çeker;
- bir **Design Tokens** dosyası (`.json`) - W3C DTCG;
- bir **Tokens Studio** dosyası (`.json`) - Tokens Studio;
- düz bir **SVG** (`.svg`) - Lolly renklerini tarar ve hangilerini tutacağını seçmene izin verir, ilki birincilin olur.

Bir kaynak kurulumu **önce bir kontrol noktası** alır, böylece "içe aktarımdan öncesine geri dön" tek bir geri yükleme olur. Ve bir taramanın bulduğu şey doğrudan içeri girmez: adaylar **Tepsi**'ye düşer, her biri o tür malzemenin sahibi olan oda üzerinden kendi basışıyla eklenir.

`#/start?source=<kind>`, seçiciyi belirli bir kaynakta açar (`file`, `pdf`, `image`, `font`, `url`) ve `?import` onu düz listede açar.

## Bir markayı cihazlar arasında taşı

Rayın altındaki **Dışa aktar**, tek bir **`LollyBrand-…zip`** yazar - token'ların, fontların, logoların ve tema tercihin, geri dönüşte doğrulanan bir bütünlük manifestiyle birlikte. Yanında, **Token'lar (.json)**, düz tasarım-token'ları belgesini tek başına yazar: font yok, logo yok, sadece token'lar, bir deponun, bir CI adımının ya da başka bir token'lar aracının gerçekte okuduğu şey.

Birini geri getirmek **Şuradan ekle… → Tasarım token'ları ya da bir tasarım dosyası**'dır (yukarıda), ya da stüdyoya bir sürükle-bırak. Bir meslektaşın sana bir marka vermesinin ya da onu ikinci bir kuruluma taşımanın yolu budur - hesap yok, bulut yok. Komut satırından bir marka getirmek için bunun yerine [`ingest:brand`](/info/configuration.html#brand-packs)'e bak.

## Sürümler

**Versions**, rayın alt kısmında, bir tasarım sisteminin hareketli bir hedef olmaktan çıktığı yerdir. Birini yayınla ve bu cihazda tutulan **kalıcı, adlandırılmış bir kopya** elde et: bundan sonra asla değişmez, bu yüzden onu sabitleyen bir araç aynı şeyi çizmeye devam eder. Panel, yayınlanacak kendine ait bir şey olana kadar gizli kalır, bu yüzden asla yayınlamayan bir stüdyo bu kontrolleri hiç görmez.

Herhangi bir şeye basmadan önce bilmen gereken üç şey var, ve panel bu üçünü de basmadan önce söyler, sonra değil:

- **Bir sürüm kalıcıdır.** Henüz silme yok, bu yüzden panel yalan söyleyen bir düğme sunmak yerine neyin tutulduğunu ve tutulmaya devam ettiğini belirtir.
- **Kaldırmalar uyumluluk kartına öncülük eder.** Eklenen ve değiştirilen tokenlar haberdir; *kaldırılan* bir tane bir aracı bozan şeydir, bu yüzden önce o adlandırılır ve ne olduğu söylenir.
- **Yayınlamak geri alınamaz; geri yükleme geri alınabilir.** *Restore latest from this version*, başa yapılan sıradan bir düzenlemedir, bu yüzden stüdyonun geri alma yığınına gider ve panel sana hemen **Undo**'yu sunar.

**Sadece Yayımla** veya **Yayımla ve etkinleştir** seçebilirsin - fark, araçların ve uygulamanın bundan sonra o sürümü mü izleyeceği yoksa en güncel düzenlemeni mi izlemeye devam edeceği. **Yeniden en güncel hâli izle**, her düzenlemeyi yapıldığı anda canlıya alır. `#/start?area=versions` paneli doğrudan açar.

## Marka sabit olduğunda

Bazı yapılar **kilitli bir marka** ile gelir - renkleri, yazı tipleri ve tokenleri her aracın ve dışa aktarımın kullandığı şeydir, ve değiştirilecek bir şey yoktur. Bu durumda stüdyonun yerini, bu yapının sabit bir markayla geldiğini ve düzenlemenin kapalı olduğunu açıklayan kısa bir not alır. Bu kasıtlıdır: bir kuruluşun her şeyin markaya uygun kalmasını garanti etme yoludur.

## Bundan sonra nereye

- **[Lolly'yi kullanma](/info/using.html)** - tuval, kaydetme, projeler ve katalog.
- **[Tasarım Tokenleri](/info/design-tokens.html)** - markanın ifade edildiği token modeli.
- **[Dışa aktarma ve formatlar](/info/exporting.html)** - baskı birimleri, CMYK ve markanın dışa aktarıldığı formatlar.
