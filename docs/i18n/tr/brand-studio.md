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
- **Export** - bütün markayı tek bir `LollyBrand-….lolly` olarak yazar.
- **Tokens (.json)** - bir depo, bir derleme adımı ya da başka bir belirteç aracı için, tek başına düz tasarım-belirteçleri belgesi.
- **Restore brand settings** - bir içe aktarmadan ya da marka ayarlarının değiştirilmesinden önce kaydedilen bir kontrol noktasına dön.
- **Versions** - tasarım sisteminin adlandırılmış kopyalarını yayınla, etkinleştir ve geri yükle. Yayınlanacak kendi bir şeyin olana kadar gizlidir (ya da bir `?area=versions` bağlantısı onu adıyla istemedikçe).

![Stüdyo oda rayı - Overview, Colours, Type, Logos, Tokens ve Files](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-rail&waitSelector=.ds-rail&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

## Overview

Overview ilk odadır ve iki yüzü vardır.

**Henüz hiçbir şey seçilmemişken** **Sana özel yap** yazar. **Referansla başla**, bir logo, ekran görüntüsü, web sayfası ya da tasarım dosyası için kaynak seçiciyi açar. **Bir renk seç**, **Bir yüz seç** ve **Logo ekle**, kendi mevcut kontrollerini doğrudan açar. Her yol bir seçimle başlar; birini açmak hiçbir şey yazmaz. **Araçları keşfet** hemen kullanılabilir.

Bir şey senin olduğu anda, aynı oda **elinde ne olduğunu** gösterir, önce yaptığın sayılar gelir. Colours, tasarım sisteminin taşıdığı renk sayısını okur ve yalnızca gösterilen kalıtsal renkler olduğunda soluk bir `· N starter` ekler; yanındaki şerit önce senin seçtiğin renkleri, sonra ince bir çizgi ve soluk starter olanları koyar. Type role göre okur (*başlıklar için Inter*, altında *geri kalanı için Starter · SUSE, SUSE Mono*). Logos kaç yuvanın dolu olduğunu okur, ya da **Ayarlanmadı**. Tokens köşe yarıçapını taşır, onu taşımadan önce *starter* olarak etiketlenir. Files, kitaplık boşken **Henüz bir şey yok** der. Her blok kendi odasına açılan bir kapıdır. Burada sayılar vardır, asla bir ilerleme çubuğu ve asla bir bitirme kartı yoktur - bu stüdyoda kimseye borç yoktur.

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
- **Bir SVG yükle, Lolly renklerini okusun.** Yepyeni bir kurulumda, logodan aldığı birincil rengi sessizce ayarlar ve bunu belirtir. Mevcut bir markada ise rengi bunun yerine bir öneri olarak sunar - *"Found in the logo: #…"* yanında bir **Birincil olarak kullan** düğmesiyle - Colours odasında, orada kabul edebilir ya da reddedebilirsin.

## Colours

Oda, tasarım sistemiyle birlikte büyür. Henüz ihtiyaç duymadığın hiçbir şey sayfada değildir, bu yüzden ilk ziyaret tek bir karardır ve geri kalanı palet büyüdükçe gelir.

### İlk renk

Kendi rengi olmayan bir tasarım sistemi, tek bir ortalanmış sütunda açılır: **Start with one colour**, büyük bir canlı çip, bir alan ve rollerin, tonların ve baskı ayarlarının sistem büyüdükçe geleceğini söyleyen sessiz bir satır.

- **Çip seçicidir.** Ona bas, stüdyonun kendi OKLCH kartı çipin üzerinde açılır, alanın o an tuttuğu şeyle başlar: bir ad, çark, dört kadran, alfa ve **Şu şekilde saklanır**, altta **İptal** ve **Renk ekle** ile birlikte. Bir kadranı sürüklemek çipi boyar ve alanı yeniden yazar, **Renk ekle**'ye basana kadar hiçbir şey tasarım sistemine ulaşmaz.
- **Alan her gösterimi kabul eder** - `#e0452b`, `rgb(224 69 43)`, `oklch(58% .19 32)` ya da düz bir renk adı - ve bütün bir renk *listesi* yapıştırmak, teker teker ekleyebileceğin bir çip sırasına dönüşür.
- **Yanında iki kapı daha var.** Damlalık (birine sahip bir tarayıcıda) ekrandan bir renk alır, **Bir görselden renk al** ise bu cihazdaki bir ekran görüntüsünü ya da fotoğrafı okur ve bulduğu renkleri sunar.
- **Ekle asla devre dışı değildir.** Alanda okunabilir hiçbir şey yokken seçiciyi açar, boş bir basışın genelde anlamı budur; ayrıştıramadığı bir metin, ölü bir düğme yerine alanın altında bunu söyleyen bir satır alır.

İlk renk **Birincil** olur, ekleme işlemine yanıt veren çip de bunu söyler - *"Birincil artık Vivid Violet"* - yanında **İnce ayar** ile birlikte.

![Henüz hiçbir şey seçilmemiş Colours odası - büyük bir canlı çip, bir alan ve daha sonra neyin geleceğine dair bir satır](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

### Starter

**Starter**, seçilmek yerine uygulamayla birlikte gelen her şey için kullanılan kelimedir. Yepyeni bir kurulum hiçbir renk taşımaz: sahip olduğu tek şey nötr bir tondur, kağıt üzerinde mürekkep, böylece kimse henüz hiçbir şeye karar vermeden yüzeyler, metin ve ince çizgiler render edilir. Bu nötrler bir iskeledir, bu yüzden renk olarak sayılmazlar ve palet bölmesinde çizilmezler. [Tokens](#tokens) odasında **Nötrler · başlangıç · 9** olarak yaşarlar, onları Colours bölmesinde katlanmış, etiketli tek bir grup olarak gösteren bir **Aç** ile birlikte (`#/start?area=color&group=neutral`).

Aynı kelime her odada geçerlidir: bir starter renk üzerinde duran bir rol *"Starter Paper stands in"* olarak okunur ve seçicisi **Seç…** sunar; bir starter yüz **Starter** etiketi taşır ve tonlanmaz; bir starter köşe yarıçapı Overview'da etiketlenir. Kalıtsal malzeme asla kesikli bir kenarlıkla çizilmez, çünkü burada kesikli bir kenarlık bir bırakma hedefi anlamına gelir.

### Palet büyüdükçe

Renklerin, geniş bir ekranda bir **In context** önizlemesinin yanında durur, daha küçük ekranlarda ise onun üzerinde yığılır. Önizleme, paletini kullanan bir poster, grafik ya da arayüz kartı gösterebilir. Starter renkler kendi katlanabilir gruplarında kalır, eklediğin renklerden ayrı.

Tek tek renkler ya da bir ton seti ekle, rollerini ata ve ihtiyaç duyduğunda gelişmiş bölümleri aç. Renk çizelgesi, gradyanlar ve indirme denetimleri paletle birlikte kalır.

![Bir renk eklendikten sonra Colours odası, paletiyle ve canlı bir kompozisyon önizlemesiyle](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

### Roller - araçların okuduğu

**Roles**, renk örneklerinin üstündeki katmandır: her araçta ve dışa aktarımda hangi rengin hangi görevi oynadığı. Roller isteğe bağlıdır (üç bağımsız renkten oluşan ve rolsüz bir tasarım sistemi de gayet iyidir), herhangi bir renk örneği bir rol alabilir ve kontrast okuması yüzeye karşı, önce APCA olmak üzere ölçülür.

Bir satır üç kayıttan birinde okunur, böylece şerit kimsenin almadığı bir kararı asla iddia etmez:

- rolü tam güçte kendi rengiyle karşılayan bir renk;
- **Starter *Paper* stands in** - soluk, seçicisinde **Seç…** ile;
- **↳ Birincili izler** - rol, kendi rengi yerine birincil üzerinden çözülür.

Palet tonlara sahip olduğunda, şerit bir aracın okuyabileceği yedi yuvanın tümüne büyür: Birincil, İkincil, Yüzey, Metin, Soluk, Kenar ve Birincil üzerinde. Birincil üzerinde, birincilden türetilir, **Türetildi** olarak okunur ve seçici taşımaz.

**Uygulamanın kendi vurgusu bir tercihtir, bir token değil.** Varsayılan olarak arayüz tasarım sistemini izler ve arayüz vurgusu birincil rengi alır. Bu, [profilinde](/info/profile.html) bir Görünüm ayarıdır - **Arayüz tasarım sistemini izler** - ve onu kapatmak arayüzü nötr bırakır. Araçlar, tuvaller ve dışa aktarımlar her iki durumda da etkilenmez, yazı tipleri ve köşe yarıçapı ise ayar açık ya da kapalı olsun tasarım sistemini izler.

### Uzman kanatlar

Kompozisyon önizlemesinin ve renk rollerinin altında dört katlanmış bölüm bulunur. İstediğini aç; her biri `#/start?area=color&focus=<wing>` olarak derin bağlantı verilebilir, bu da oda başka ne gösteriyor olursa olsun onu açar:

- **Explore shades & harmonies** (`focus=generate`) - bir renkten tam bir ton setine. Aşağıda anlatılıyor.
- **Shade curves** (`focus=curves`) - bir tonu nokta nokta yeniden şekillendir. Lightness, chroma ve hue her biri L / C / H ile değiştirilen kendi eğrisine sahiptir ve sürüklerken alttaki tonlar canlı olarak yeniden pişirilir.
- **Contrast** (`focus=contrast`) - **Contrast-lock**, seçtiğin bir arka plana karşı APCA hedeflerini tutturmak için bir tonu yeniden tonlar, her adım kendi hue ve chroma'sını korur; **Rotate hue**, bütün tonu tekerlek etrafında topluca döndürür, her ton kendi lightness ve chroma'sını korur.
- **Print** (`focus=print`) - birincil rengin baskıda ne olacağı: otomatik ekran değeri ya da bunun yerine sabitlenmiş bir CMYK derlemesi ya da adlandırılmış bir spot mürekkep.

### Bir renk, bütün bir palet

**Explore shades & harmonies** içinde bir **Starting colour** seç. Lolly, motorun her yerde kullandığı aynı algısal renk matematiğini (OKLCH) kullanarak eşleşen tonlar önerir. Önerileri ayarla:

- **Scheme** - Mono, Complement, Analogous ya da Triad - ikincil rengin birincil renkle nasıl ilişkilendiğini belirler.
- **Shades** - 3 ile 20 arasında bir kaydırıcı (varsayılan 5), her tonun kaç adım üreteceğini denetler.
- **Fine-tune** (katlanmış) - **UI intensity** (Muted / Deep), **Contrast** (Comfort / High) ve **Text on brand** (Auto / Light / Dark).

Başlangıç rengini ve denetimleri değiştirmek yalnızca önerileri değiştirir. O rengi eklemek için bir tona tıkla, ya da bir grup eklemek için **5 ton ekle** (sayı, Shades ayarını izler). Mevcut renkler ve roller yerinde kalır. Geri al, eklemeyi kaldırır.

**Birincil**, **Nötr** ve **İkincil** satırları önerilen tonları gösterir. Açık ve koyu örnekleri ve kontrast okumalarını incelemek için **Theme preview**'i aç. Önerilen tema çapalarını ayarlamak için orada bir Nötr ya da İkincil adımı seç. Bütün paletin yeniden oluşturulması, aşağıda ayrı, gözden geçirilen bir eylem olarak kalır.

![Ayrı ekleme denetimleriyle ve ayrı bir Theme preview ile üç önerilen ton grubu](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

### Paletini oluştur (uyum üretici)

**Find matching colours** içinde, uyum üretici birincil renkten eşleşen vurgu renkleri önerir. Bir **Uyum** seç - **Tamamlayıcı**, **Komşu**, **Üçlü**, **Dörtlü** ya da **Analog** (kendi **Vurgular** sayısını, 2 ila 5 arası, ve 10°-45° arasında bir ton **Açısı** getirir) - ve her aday, otomatik oluşturulmuş okunabilir bir adla ve bir **+ Ekle** düğmesiyle gelir. Birini eklemek o rengi paletine anında koyar, bir basış bir token'a karşılık gelir. **In context**, eklediğin renkleri örnek kompozisyonlar üzerinde önizler.

![Üretilen vurgular, her biri bir renk örneği, otomatik oluşturulmuş bir ad, hex kodu ve bir Ekle düğmesiyle](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&drive=click%3A.be-generate-detail%3Anot%28%5Bdata-be-rebuild%5D%29%20%3E%20summary%3Bwait%3A500&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### Üretilen bir paleti onaylamak

Önerilen bir rengi ya da ton grubunu eklemek paletinin geri kalanını korur. Tam bir değişiklik için **Rebuild the whole palette…**'i aç ve **Preview full rebuild**'e bas. İnceleme değişiklikleri açıklar: kaç rolün atadığın gibi kaldığı, kendin eklediğin kaç rengin korunduğu, kaç ton eğrisinin yeniden çıpalandığı, kaç baskı kilidinin yeniden sabitlendiği, kaç gizli tonun gizli kaldığı, kaç gradyan durağının rengini koruduğu.

O karttaki **Apply rebuilt palette** onu onaylar; **İptal** vazgeçer ve hiçbir şeyi değiştirmez. Çalıştıktan sonra kart, odak zaten üzerinde olan bir **Geri al** sunar - ve değişimden *önce* bütün tasarım sisteminin bir kontrol noktası alınır, böylece "eski haline getir" kayıp bir öğleden sonra değil bir geri yükleme olur.

### Palet, çizelge ve her renk örneği

Palet, tasarım sisteminin renklerini katlanabilir gruplarda listeler, her biri kendi **+ Ekle** denetimiyle. Çalışmanı düzenlemek için gruplar oluştur ve yeniden adlandır. Bir rol asla ikinci bir kutucuk oluşturmaz: bir token bir kutucuktur, bir rolün işaret ettiği kutucuk ise bunun yerine küçük bir köşe işareti taşır (**P**, **S**, **Su**, **T**). Kutucukların altında, **Renk tablosu** aynı renk örneklerinin iki görünümüyle açılır: **Tekerlek** (OKLCH tekerleği - yeniden renklendirmek için bir noktayı sürükle, düzenlemek için bir noktaya tıkla ya da yeni bir renk örneği koymak için boş alana tıkla) ve görüntülenebilir aralığın gerçekte nerede bittiğini gösteren **Gamut** tablosu. `#/start?area=color&focus=chart`, kartı `?wheel`'in her zaman yaptığı gibi doğrudan açar.

![Palet bölmesi, her grup katlanabilir, indirme hapı alt kenarda park etmiş](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![OKLCH çarkı - açı ton, dıştaki mesafe doygunluk ve griler yan tarafta bir açıklık rayında ilerliyor](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

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

### Çok sayıda renk örneğiyle çalışmak

Her renk örneğinin ayrı bir sürükleme tutamacı vardır. Renkleri kendi grubu içinde yeniden sıralamak için sürükle, ya da odakla, Space'e bas, ok tuşlarını kullan ve bırakmak için tekrar Space'e bas. Escape iptal eder. Sıra, stüdyoyu yeniden açtığında korunur ve geri alınabilir. Renkleri gruplar arasında taşımak için renk örneği düzenleyicisinin **Grup** denetimini kullan ya da birkaç rengi seçip **Taşı**'yı kullan. Token adları ve rol referansları sağlam kalır.

Palet bölmesinde seçim bir jesttir, bir mod değil. Önce basılacak bir düğme yoktur, çubuk ilk seçilen kutucukla gelir ve sonuncuyla gider.

- **Bölmenin boş alanında sürükleyerek** bir dikdörtgen çiz: dokunduğu her kutucuk, grup sınırlarını aşarak seçime katılır. Katlanmış bir bölüm hiçbir şey katmaz, hiç hareket etmeyen bir sürükleme ise seçimi temizler.
- **Shift-click**, aralığı okuma sırasına göre alır; **Cmd/Ctrl-click** bir kutucuğu değiştirir; düz bir tıklama yine de o kutucuğun düzenleyicisini açar.
- Her grup başlığı bir **Tümünü seç** taşır ve bir kutucuk odaktayken **Cmd-A**, tasarım sisteminin sahip olduğu her rengi alır - asla bir starter renk değil.
- Izgaranın tek bir sekme durağı vardır. Oklar üzerinde gezinir, Shift-oklar seçimi genişletir, Space bir kutucuğu değiştirir, Delete seçimi kaldırır ve Escape onu temizler. (Oklar yalnızca odağı taşır: bir kanalı kaydırmak için önce `l`, `c` ya da `h`'ye bas, okuma bunu söyler.)
- Dokunmatik bir ekranda dikdörtgen yoktur. Bir seçim başlatmak için bir kutucuğa bas ve tut, sonra eklemek için dokun; grup başına **Tümünü seç** gerisini getirir.

Çubuğun kendisi **{n} seçili** okur, ardından **Taşı** (mevcut bir grup, ya da menü içinde adlandırdığın yeni bir grup), **Bir rol ver** (seçili her renk sırayla bir sonraki rolü alır, böylece dört kutucuk tek basışta dört rolün tamamını doldurur), **İndir** (seçimi altı palet biçiminden herhangi birinde), **Değerleri kopyala** (her renk için, saklandığı gösterimde bir satır) ve **Sil**. Taşı ve Bir rol ver, palette taşınacak tonlar olduğunda görünür. Tek bir Ctrl/Cmd-Z, kırk öğelik bir taşımayı, bir rol dağıtımını, bir silmeyi - bütün bir toplu eylemi geri alır - ve bir silme neyi koruduğunu söyler, çünkü bir seçim bu odanın kaldırmadığı kutucuklara da ulaşır.

### Gradyanlar

İsteğe bağlı bir **Gradyanlar** paneli, arka planlar ve vurgular için paletten karışım token'ları oluşturur. Tasarım sistemin gradyan kullanmıyorsa tamamen atla. Her gradyanın bir önizlemesi, adlandırılmış durakları (2-8) ve bir açısı vardır. Kilit davranış: **bir durak bir renk örneğine referans verir**, o yüzden o renk örneğini yeniden renklendir ve gradyan onu izler. İnterpolasyon temiz karışımlar için OKLCH'de çalışır. Çalıştırmayı kısaltmak için bir durağı sil.

### Paleti başka bir yere taşı

Palet bölmesinin alt kenarında park etmiş yüzen hap, bütün paleti **Tasarım belirteçleri (JSON)**, **CSS değişkenleri**, **CSS sınıfları**, **SCSS değişkenleri**, bir **GIMP palette (.gpl)** ya da bir **Adobe Swatch Exchange (.ase)** olarak indirir - böylece tasarım sistemi doğrudan Illustrator, Figma, GIMP ya da bir stil sayfasına düşer. Bölmenin kaydırma alanının dışında oturur, böylece palet ne kadar kaydırılırsa kaydırılsın yerini korur ve palet tonlara sahip olduğunda görünür. (Paleti [Varlıklar](/info/using.html#assets-your-library)'dan da indirebilirsin.)

## Tip

Bu oda da aynı şekilde büyür. Kendi yüzü olmadan tek bir kart ve tek bir karardır: bugün ona hizmet eden yüzde okuma boyutunda ayarlanmış **Birincil**, adın yanında bir **Starter** etiketi, dolu bir **Bir yüz seç** ve *"Birini seçene kadar hiçbir şey kurulmaz."* satırı. Kartın altında *"Başlıklar, kod ve italik, sen onları seçene kadar birincili izler"* yazar, **Ayrı ayrı seç** ise ziyaretin geri kalanı için diğer üç kartı ortaya çıkarır.

![Henüz bir yüz seçilmemiş Type odası - okuma boyutunda bir kart, üzerinde bir Starter etiketi ve dolu bir Bir yüz seç](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

Bir yüz seç, oda **dört rol kartına**, Fonts listesine ve canlı numuneye açılır. Dört yüz, uygulamanın, araçlarının ve her dışa aktarımın gerçekte okuduğu yüzlerdir:

- **Birincil** - gövde metni, düğmeler ve her araç.
- **Başlıklar** - `h1`/`h2` için gösterim yüzü.
- **Kod** - kod ve veri için tek aralıklı bir yüz.
- **İtalik** - vurgu, alıntı ve ara sözler için gerçek bir italik eşlik.

Başlıklar, kod ve italik, sen onları atayana kadar birincile geri döner, böylece tek yüzlü bir tasarım sistemi burada hiçbir karar gerektirmez.

**Bir ton, onu senin seçtiğin anlamına gelir.** Bir kart yalnızca o yüzü kurduğun yerde tonlanır. Bir starter yüz, paletin kalıtsal gruplarının taşıdığı aynı **Starter** etiketini, soluk kayıtta ve tonsuz taşır; kimsenin seçmediği bir rol ise, sanki seçilmiş gibi birincilin adını tekrarlamak yerine **↳ Birincili izler** olarak okunur. Düğme, kendi yüzünde **Değiştir**, her yerde başka **Bir yüz seç** yazar. Bir kart üzerindeki hiçbir şey bir şey onaylamaz: düğme, o role kapsamlanmış **karşılaştırma sahnesini** açar.

![Ortaya çıkan dört rol kartı - her biri kendine hizmet eden yüzde ayarlanmış, kimsenin seçmediği yerde bir Starter etiketiyle ve İtalik'in Birincili izlemesiyle](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

### Karşılaştırma sahnesi

![Kartının altında açılan karşılaştırma sahnesi, arama satırı, sabitlenmiş aileler ve tek satırlık bir şeride katlanmış kartlarla](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

Sahne bir iletişim kutusunda değil, **odanın içinde, satır içinde** ve bastığın kartın hemen altında açılır. Açıkken kartlar rol ve yüzden oluşan tek satırlık bir şeride katlanır, böylece sahne telefonda bile ilk ekrandadır. Escape iptal eder ve klavyeyi onu açtığın karta geri verir.

Bir yüz seçmek üç basıştır:

1. Kartta **Bir yüz seç**.
2. Bir aile adı yaz ve **Önizleme**'ye bas - ya da alanın altındaki altı **Sabitli** aileden birine, her birine bir kez, bas. Kart, henüz görmediğin bir yüzün yerine geçen arayüz yüzü yerine, numunenin olacağı yerde bir iskelet çubuğuyla, zaten yükleniyor halde görünür.
3. **Bu yüzü kullan**.

**Onay yalnızca bir kez, yaptığın basışta sorulur.** Bir önizleme ilk kez Google Fonts'a ulaştığında, bir iletişim kutusu ne olacağını söyler: *Google, aile adını ve IP adresini öğrenir. Dosya sonra bu cihazda tutulur ve çevrimdışı kullanılır. Bu, stüdyodaki üçüncü bir tarafa ulaşan tek adımdır.* **Google'dan getir** devam eder ve hatırlanır. **İptal**, kartı *"Getirilmedi. Google'a hiçbir şey gönderilmedi."* demeye bırakır, kendi canlı **Google'dan getir**'iyle birlikte, böylece fikrini değiştirmek kartın kendisinde tek bir basıştır. Hiçbir kart asla ölü bir düğme göstermez: hangi durumda olursa olsun, tek bir birincili sonraki adımın ne olduğunu söyler.

**Sahneye bir font dosyası bırak**, anında önizlenir - kendi makinenden **TTF**, **OTF** ya da **WOFF**, zaten sahip olduğun lisanslı bir kurumsal yazı tipi için yoldur bu. O bırakma bölgesi, odadaki tek dosya kapısıdır.

Her iki durumda da yüz bu cihazda kalır, uygulamada, araçlarında ve her dışa aktarımda görüntülenir, sonsuza dek çevrimdışıdır ve tasarım sistemi dosyasında seyahat eder - render zamanında hiçbir şey getirilmez. Google Fonts'taki her şey açık bir lisans (OFL/Apache/UFL) altında gönderilir.

### Bu cihazdaki fontlar

**Yazı tipleri** paneli, bu cihazın tuttuğu her yüzü ve hizmet ettiği rolü listeler. Eklediğin yüzler **Tasarım sisteminde** altında öne çıkar, her biri rolleriyle ve bir silme ile birlikte, Birincil'e hizmet eden ise rozeti taşır. Starter yüzler tek bir katlanmış satırda arkadan gelir - *"Starter · SUSE, SUSE Mono · Birincil ve Kod'a hizmet ediyor, sen seçene kadar"* - soluk, silmesiz ve terfi ettirilecek hiçbir şey olmadan, çünkü ikisi de kimsenin verdiği bir karar değildir. **Bir yüz ekle**, aynı karşılaştırma sahnesini kapsamsız açar.

Alttaki **Yazı rolleri** paneli, her rolün canlı bir numunesini gösterir - birincilde gövde ve arayüz, üst başlıklar için isteğe bağlı bir gösterim yüzü, vurgu için bir italik, kod ve veri için bir mono - her birinin yanında aile ve durumuyla birlikte (*Inter*, *SUSE · starter*, *SUSE · Birincili izler*), böylece bütün set bir bakışta okunabilir.

## Token'lar

Tasarım sisteminin geri kalanı, koda dokunmadan düzenlenebilir:

![Tokens odası - bir köşe yarıçapı kaydırıcısı ile boşluk, boyutlandırma, gölgeler ve sistemin geri kalanı](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **Yuvarlatılmış köşeler** - uygulama genelinde kartların, düğmelerin ve panellerin izlediği tek bir yarıçap kaydırıcısı (0-1.5rem).
- **Neutrals** - yepyeni bir kurulumun geldiği kağıt-üzerinde-mürekkep tonu, dokuz adımıyla ve Colours bölmesine bir **Aç** ile **Nötrler · başlangıç · 9** olarak listelenir. Starter nötrlerin yönetildiği tek yerdir ve *starter* etiketi, kalıtsal olmak yerine ton üretildiği anda gider.
- **Daha fazla token** - **aralık**, **boyutlandırma**, **kontur genişliği**, **opaklık**, **döndürme**, düz **sayılar** ve **gölgeler** ekle ve düzenle. Bir tür seç, adlandır (*Gutter, Card shadow…*) ve değerini ayarla. Bunlar standart [tasarım token'ları](/info/design-tokens.html) (DTCG) olarak saklanır ve tasarım sistemiyle birlikte seyahat eder.

## Dosyalar

Markanın tuttuğu dosyaları - logolar hariç - buraya bırak: **vektör**, **görsel**, **ses** ve **hareket** (video, Lottie, animasyonlu) varlıkları. [Varlıklar](/info/using.html#assets-your-library) görünümüne düşerler, bölümlere ayrılmış ve her aracın varlık seçicisinde hazır halde. Her şey bu cihazda kalır. (Rayda oda **Dosyalar** olarak etiketlenir; URL anahtarı `catalogue` olarak kalır, çünkü bir panel anahtarı kalıcı bir sözleşmedir.)

## Bir marka getir

Rayın altındaki **Şuradan ekle…**, iki aşamalı bir seçici açar. İlk aşama neyin *olduğunu* sorar, hangi biçim olduğunu değil:

- **Design tokens or a design file** - DTCG ya da Tokens Studio JSON, bir Penpot projesi, bir **token seti zip'i**, bir Lolly tasarım sistemi paketi ya da bir SVG.
- **PDF** - renkleri, işaretleri ve gömülü yazı tipleri için bu cihazda okunan bir sunum ya da bir kılavuz dosyası.
- **Logo veya ekran görüntüsü** - bir görsel, bu cihazda okunan önerilen bir palet olur. Hiçbir şey yüklenmez. Bu, resimdeki yazı tipini ya da yerleşimi değil, renkleri okur.
- **Saved web page** - bir HTML dosyası ve CSS dosyalarını seç, ya da HTML veya CSS yapıştır. Toplam 20 dosyaya ve 2 MB'a kadar. Yalnızca sağlanan metin okunur; bağlantılı kaynaklar getirilmez ve betikler çalışmaz. Bu yol, uzantı ya da masaüstü uygulaması olmadan da çalışır.
- **Yazı tipi dosyası** - TTF, OTF ya da WOFF. Yüzün kurulduğu Type odasını açar.
- **Web sitesi** - renkleri ve tipi için okunan tek bir sayfa. Bu kutucuk yalnızca bir sayfayı gerçekten okuyabilen bir cihazda görünür, çünkü kimsenin basamayacağı bir şeyi reklam eden devre dışı bir kutucuk, hiç kutucuk olmamasından daha kötüdür. Göründüğü yerde hangi okuyucunun kullanıldığını açıkça söyler: bu cihazda uygulama tarafından getirilir, ya da sen olarak oturum açmış halde, bir arka plan sekmesinde tarayıcı eklentisi üzerinden okunur. Bir URL adlandırmak alanı yalnızca *önceden doldurur* - getirme düğmesi rızadır, bu yüzden birinin sana gönderdiği bir bağlantı bir okumayı asla kendiliğinden başlatamaz.

Tasarım dosyası kaynağını seç ve ikinci aşama aşağıdaki karttır: kabul edilen biçimler tercih sırasına göre simge kutucukları olarak öne çıkar ve bütün kart tek bir bırakma hedefidir - herhangi bir yerine tıkla ya da üzerine bir dosya sürükle. Bir dosyayı doğrudan stüdyoya da bırakabilirsin.

![İçe aktarma kartı - kabul edilen biçimler simge kutucukları olarak öne çıkar ve bütün kart tek bir bırakma hedefidir](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

Her tasarım dosyasının sana verdiği:

- bir **Lolly design-system** paketi (`.lolly`; eski `.zip` hâlâ kabul edilir) - tek adımda kurulur;
- bir **Penpot** dışa aktarımı (`.penpot`) - tasarım token'larını çeker;
- bir **Design Tokens** dosyası (`.json`) - W3C DTCG;
- bir **Tokens Studio** dosyası (`.json`) - Tokens Studio;
- düz bir **SVG** (`.svg`) - Lolly renklerini tarar ve hangilerini tutacağını seçmene izin verir, ilki birincilin olur.

Bir logo/ekran görüntüsü, web sitesi ya da kaydedilmiş sayfa **Size önerilen tasarım sistemi**'ni açar. Önerilen renkleri kullanan bir örneğe bak, gerekirse farklı bir **Ana renk** seç ve sistemi adlandır. **Bu tasarım sistemini kullanın**, üretilen açık ve koyu paletleri uygular ve Overview'a döner. Mevcut yazı tipleri yerinde kalır. Bu, etkin sistemin renklerini ve diğer token ayarlarını değiştirir. Önce bir kontrol noktasının başarılı olması gerekir; **Marka ayarlarını geri yükle** önceki ayarları kurtarır.

**Kaynak detayları ve bireysel seçimler**, ne okunduğunu, algılanan yazı tipi adlarını ve önizlemenin metin/eylem kontrastını gösterir. Ayrıca **Listedeki öğeleri ayrı ayrı seçin** ve **Tasarım bağlamını indir**'i sunar. JSON raporu gözlemleri, önerilen token'ları ve kaynak bilgisini taşır; kaydedilen HTML/CSS, sağlanan metnin bir SHA-256'sını içerir. Ham sayfa metni içermez ve imzalı bir Content Credential değildir. Yazı tipi adları önerilerdir: yazı tiplerini seçmek ve kurmak için yer, Type olarak kalır.

PDF ve diğer tasarım dosyası içe aktarımları mevcut inceleme denetimlerini korur. **Tepsi**'de tutulan öğeler, o tür malzemenin sahibi olan oda üzerinden eklenene kadar hiçbir şeyi değiştirmez.

`#/start?source=<kind>`, seçiciyi belirli bir kaynakta açar (`file`, `pdf`, `image`, `font`, `url`, `page`) ve `?import` onu düz listede açar.

## Bir markayı cihazlar arasında taşı

Rayın altındaki **Export**, tek bir **`LollyBrand-….lolly`** yazar - token'ların, fontların, logoların ve tema tercihin, geri dönüşte doğrulanan bir bütünlük manifestiyle birlikte. 1.0.7'den önceki web sürümleri aynı yükü `.zip` olarak adlandırıyordu; bu eski yazım hâlâ kabul edilir. Yanında, **Token'lar (.json)**, düz tasarım-token'ları belgesini tek başına yazar: font yok, logo yok, sadece token'lar, bir deponun, bir CI adımının ya da başka bir token'lar aracının gerçekte okuduğu şey.

Birini geri getirmek **Şuradan ekle… → Tasarım token'ları ya da bir tasarım dosyası**'dır (yukarıda), ya da stüdyoya bir sürükle-bırak. Bir meslektaşın sana bir marka vermesinin ya da onu ikinci bir kuruluma taşımanın yolu budur - hesap yok, bulut yok. Komut satırından bir marka getirmek için bunun yerine [`ingest:brand`](/info/configuration.html#brand-packs)'e bak.

## Önceki ayarları geri yükle

Rayın altındaki **Marka ayarlarını geri yükle**'yi seç, tarihli bir kontrol noktası belirle, sonra **Geri yükle**'ye bas. Bu, etkin marka için renkleri, yazı tipi ayarlarını ve diğer marka token'larını geri yükler. Yazı tipi ve görsel dosyaları oldukları gibi kalır.

Lolly, kontrol noktasını uygulamadan önce mevcut ayarlarını **Before restore** olarak kaydeder. Geri yüklemeyi tersine çevirmek için, tarayıcıyı kapatıp yeniden açtıktan sonra bile, o kontrol noktasını seç. Son 20 kontrol noktası bu cihazda tutulur. Depolama okunamıyorsa ya da mevcut ayarlar kaydedilemiyorsa, iletişim kutusu yeniden deneyebilmen için sorunu bildirir.

## Sürümler

**Versions**, rayın alt kısmında, bir tasarım sisteminin hareketli bir hedef olmaktan çıktığı yerdir. Birini yayınla ve bu cihazda tutulan **kalıcı, adlandırılmış bir kopya** elde et: bundan sonra asla değişmez, bu yüzden onu sabitleyen bir araç aynı şeyi çizmeye devam eder. Panel, yayınlanacak kendine ait bir şey olana kadar gizli kalır, bu yüzden asla yayınlamayan bir stüdyo bu kontrolleri hiç görmez.

Herhangi bir şeye basmadan önce bilmen gereken üç şey var, ve panel bu üçünü de basmadan önce söyler, sonra değil:

- **Bir sürüm kalıcıdır.** Henüz silme yok, bu yüzden panel yalan söyleyen bir düğme sunmak yerine neyin tutulduğunu ve tutulmaya devam ettiğini belirtir.
- **Kaldırmalar uyumluluk kartına öncülük eder.** Eklenen ve değiştirilen tokenlar haberdir; *kaldırılan* bir tane bir aracı bozan şeydir, bu yüzden önce o adlandırılır ve ne olduğu söylenir.
- **Yayınlamak geri alınamaz; geri yükleme geri alınabilir.** *Restore latest from this version*, başa yapılan sıradan bir düzenlemedir, bu yüzden stüdyonun geri alma yığınına gider ve panel sana hemen **Undo**'yu sunar.

**Sadece Yayımla** veya **Yayımla ve etkinleştir** seçebilirsin - fark, araçların ve uygulamanın bundan sonra o sürümü mü izleyeceği yoksa en güncel düzenlemeni mi izlemeye devam edeceği. **Yeniden en güncel hâli izle**, her düzenlemeyi yapıldığı anda canlıya alır. `#/start?area=versions` paneli doğrudan açar.

## Marka sabit olduğunda

Bazı yapılar, SUSE Brand gibi **kilitli bir tasarım sistemi** ile gelir. Onu açmak, **Make an editable copy** ve **Switch** ile birlikte salt okunur bir not gösterir. Orijinal renkleri, yazı tipleri ve token'ları sağlam kalır. Kilitli sistem cihazdaki ilk sistem olsa bile, kendi yerel sistemlerin düzenlenebilir kalır. Profile'da, **Aç** bir sistemi seçer ve stüdyosunu açar; **Make a new one**, yerel bir sistem oluşturur ve onu, ad alanı odaklanmış halde `#/start`'ta açar.

## Bundan sonra nereye

- **[Lolly'yi kullanma](/info/using.html)** - tuval, kaydetme, projeler ve Varlıklar.
- **[Tasarım Tokenleri](/info/design-tokens.html)** - markanın ifade edildiği token modeli.
- **[Dışa aktarma ve formatlar](/info/exporting.html)** - baskı birimleri, CMYK ve markanın dışa aktarıldığı formatlar.


## Bir görünüm bul ve karşılaştır

**Bir görünüm bul**'u Overview'dan ya da Profile'daki tasarım sistemi listesinden aç. Bu cihazda kaydedilmiş sistemlere ve birkaç yeniden kullanılabilir Lolly örneğine göz at. Ada, renk etiketine ya da beyan edilen yazı tipine göre ara. **Mevcut paletime en yakın**, ölçülen renk benzerliğine göre sıralar, eşleşen yazı tipi aileleri beraberlikleri bozar; bu bir kalite puanı değildir.

Bir görünümü incelemek için birini, karşılaştırmak için ikisini seç. İnceleme düğmesi küçük bir ekranda da kullanılabilir kalır. Bir görünümü seçmek hiçbir şeyi değiştirmez. **Bu kaydedilen sistemi kullan**, mevcut tasarım sistemi kayıt defteri içinde geçiş yapar. **Bu renkleri kullan**, mevcut yazı tiplerini koruyarak bir örneği olağan kontrol noktası ve kurulum akışı üzerinden uygular. **Marka ayarlarını geri yükle**, önceki görünümü kurtarabilir.

**Detaylar ve tasarım bağlamı** altında, kaydedilen sistemlerin düzenlenebilir **Etiketleri ara**'sı ve bir bağlam indirmesi vardır. Örnekler orijinal Lolly renk tariflerini kullanır; uzaktan kazınmış bir ilham koleksiyonu ya da gerekli bir hesap yoktur.

![Herhangi bir renk sistemini uygulamadan önce Sunroom ve Orchard'ı yan yana karşılaştır.](/t/url-shot?url=%2F%23%2Fstart&width=1280&height=900&dpi=96&waitMs=3000&format=svg&filename=brand-compare-looks&try=1&drive=click%3A%5Bdata-ds-door%3D%22looks%22%5D%3Bwait%3A500%3Bclick%3A%5Bdata-look-select%3D%22example%3Asunroom%22%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Aorchard%22%5D%3Bclick%3A%5Bdata-looks-review%5D%3Bwait%3A500&cropSelector=.ds-looks-comparison&waitSelector=%5Bdata-ds-door%3D%22looks%22%5D&walker=1&rasterDpi=96)

Karşılaştırma, her iki paleti de birlikte görünür tutar. Bir görünümü incelemek, **Bu renkleri kullan** ya da **Bu kaydedilen sistemi kullan**'ı seçene kadar hiçbir şeyi değiştirmez.

## Kaynak kanıtını oku

Kaynak incelemesinin isteğe bağlı detayları, gözlemlendiği yerlerde tipografiyi, boşlukları, dolguyu ve köşe değerlerini gösterir. Kaydedilen HTML/CSS ve doğal web sitesi okumaları, render edilen sayfa tarafından kullanılmayabilecek bildirimleri raporlar. Tarayıcı eklentisi, görünür alanı ve tarayıcı renk tercihiyle birlikte, görünür öğelerin sınırlı bir örnekleminden ölçülen stilleri raporlayabilir. Eski eklentiler hâlâ bildirilen stillerle çalışır. Eksik alanlar **Gözlemlenmedi** der.

Bunlar gözlemlerdir, otomatik stil ayarları değil. Yazı tipi dosyaları bir referans taraması tarafından getirilmez ya da kurulmaz, ve kaynak boşluğu kendi boşluğunun yerini sessizce almaz. Sayılar örnekteki tekrarları tanımlar, güveni ya da kaliteyi değil.

## Bir kompozisyonu tasarım sistemine göre kontrol et

Design'da **Dışa aktar**'ı aç, sonra **Dışa aktarmadan önce**'yi. Kontrol, render ile aynı etkin tasarım sistemi sürümünü kullanır. Yazılmış renkleri, token takma adlarını, yazı tipi seçimlerini ve görsel varlık kimliklerini karşılaştırır. Özel değerler kasıtlı olabilir; beyan edilen marka varlıklarının dışındaki bir görsel, yasaklı bir görsel değil, bir inceleme öğesidir.

Somut bir renk ya da yazı tipi önerisi mevcut olduğunda, düğmesi yalnızca o katmanı değiştirir. Olağan **Geri al**, orijinal değeri geri yükler. Kilitli ya da değiştirilmiş katmanlar eski bir öneri tarafından üzerine yazılmaz. Eksik kaynak kanıtı bir eşleşmeden ayrı kalır. Render edilen kontrast ve metin yerleşimi, mevcut yerleşik kontroller tarafından denetlenir. Gradyanlar, efektler, iç içe araç içeriği, haklar ve öznel kalite marka karşılaştırması tarafından değerlendirilmez. Kontroller İndir'i engellemez.

## Tasarım bağlamını yerel olarak kullan

**Tasarım bağlamını indir**, token belgesini, çözülmüş renkleri, beyan edilen yazı tipi ailelerini, varlık kimliklerini, kaydedildiği yerlerde kaynak kanıtını, kapsamı ve açık kuralları içerir. Yazı tipi dosyalarını ya da sahiplik kanıtını içermez. Referans incelemesi ayrıca önerilen token'larını ve gözlemlerini de içerir.

CLI, bir sunucu olmadan her iki indirmeyi de okuyabilir:

```bash
lolly system import ./lolly-design-context.json
lolly system context --output=design-context.json
lolly system check ./design-inputs.json --file=design-context.json
```

`system check`, bir `boxes` dizisine sahip Design girdilerini ya da derlenmiş bir Design belgesini kabul eder. Kompozisyonu değiştirmeden önerilen düzeltmeleri raporlar. Tarayıcı yerleşimini ya da render edilen kontrastı ölçemez. Mevcut MCP kaynağı **lolly://design-context**, yapılandırılmış yerel MCP süreci üzerinden etkin sistemin bağlamını sunar; yeni bir barındırılan hizmete ya da API anahtarına gerek yoktur.
