# Design System Setup

Logon, renklerin ve yazı tiplerin tek yerde durmalı ki her araç, sayfa ve dışa aktarma onlarla çizsin. O yer, `#/start` adresindeki **Design System Setup**'tır ve sloganı ne için olduğunu söyler: *Make it yours*.

Elinde ne varsa onunla başla. Bir logo bırak ve Lolly renklerini okur. Bir yazı tipi seç ya da şirketinin lisansladığı yazı tipi dosyasını bırak. Her değişiklik uygulamanın tamamında hemen görünür. Logon, yazı tiplerin ve token'ların bu cihazda kalır. Bir Google Font seçmek dışarıya uzanan tek adımdır: Lolly önce sorar, sonra aileyi bir kez getirir.

Doğru göründüğünde tasarım sistemine bir ad ver ve **Export** düğmesine bas. Saklayacağın, başka bir cihazda açacağın ya da bir meslektaşına vereceğin tek bir `.lolly` dosyası alırsın. [Settings](/info/dashboard.html#design-system) etkin sistemi salt okunur gösterir ve kapağı düzenleme için buraya geri bağlanır.

## Beş dakikada kendine ait yap

::: timeline
- <!--i:upload--> **Logon'u bırak** **Logos** içindeki bırakma alanına. Lolly şeklini ve renklerini okur.
- <!--i:palette--> **Bu renkleri kullan.** Logonun ana rengi birincil rengin olur ve logodan koyu bir nötr metin rengin olur.
- <!--i:font--> **Type** içinde **bir yazı tipi seç**: bir Google Font ya da sahip olduğun bir yazı tipi dosyası.
- <!--i:pentool--> **Sisteme ad ver.** İlk düzenlemen kendi tasarım sistemini oluşturur ve Lolly adını bir kez sorar.
- <!--i:download--> **Export**, sistemin tamamını tek bir `LollyBrand-….lolly` dosyası olarak yazar.
:::

Üst bilgi hangi tasarım sistemini **Editing** yaptığını gösterir ve adı istediğin zaman değiştirebileceğin bir alandır. İlk düzenlemen **What is this design system called?** diye sorduğunda, logon yazıyı hecelediyse logondaki sözcükler doldurulur. **Save name** adı korur; **Not now** sen üst bilgiye bir tane yazana kadar yer tutucuyu korur. Ad, sistemi Settings'te ve geçiş yaparken etiketler ve **Export**'un yazdığı dosyanın adı olur.

## Odalar

Stüdyo, yanda bir raydaki odalardan oluşur; sabit bir sıra yoktur: hiçbir şey numaralı değildir ve hiçbir şey başka bir şeyi beklemez. Telefonda ray, üst bilginin altında bir çip şeridi olur.

![Stüdyonun oda rayı: Overview, Colours, Type, Logos, Tokens, Files ve Usage & rules](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-rail&waitSelector=.ds-rail&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

| Oda | Orada ne yaparsın | Bağlantı anahtarı |
|---|---|---|
| **Overview** | Sistemin neleri tuttuğunu, her odaya bir kapıyla gör | `overview` |
| **Colours** | Renk ekle, onlara rol ver, ton ve palet kur | `color` |
| **Type** | Uygulamanın, araçların ve her dışa aktarmanın okuduğu dört yazı tipini seç | `type` |
| **Logos** | İşaretlerini her yönde ve işlemde yerleştir | `logos` |
| **Tokens** | Köşeler, aralık, gölgeler ve adlandırılmış diğer her değer | `tokens` |
| **Files** | Markanın tuttuğu görsel, ses ve hareket dosyaları | `catalogue` |
| **Usage & rules** | Markanın uyguladığı kurallar, gerçek örnekler üzerinde denetlenir | `usage` |

Bir odaya `#/start?area=<key>` ile bağlan. Files odası `catalogue` anahtarını korur, çünkü bir oda anahtarı kalıcı bir sözleşmedir ve `?tab=` eski bir takma ad olarak hâlâ çalışır. Bilinmeyen bir anahtar Overview'ı açar.

**Rayın altı**, tek bir oda yerine tüm sistemin eylemlerini tutar. **Add from…** bir markayı içeri getirir ([Bring a brand in](#bring-a-brand-in)) ve **Tray** bir taramanın bulduğu ama henüz eklemediğin şeyleri tutar. **Export**, **Tokens (.json)**, **Fonts for Linux (.rpm)**, **Versions** ve **Restore brand settings** sistemi saklar ve taşır ([Keep and move your design system](#keep-and-move-your-design-system)). Her biri üzerinde işlem yapacağı bir şey olduğunda görünür.

## Overview

Henüz hiçbir şey seçilmemişken Overview başlamak için dört yol sunar. **Start from a reference** bir logo, ekran görüntüsü, web sayfası veya tasarım dosyası için kaynak seçiciyi açar; **Pick a colour**, **Choose a face** ve **Add a logo** bu denetimleri doğrudan açar. Birini açmak hiçbir şey yazmaz ve **Explore the tools** en baştan oradadır.

Herhangi bir şey sana ait olduğunda Overview, kendi sayılarının önde olduğu elindekileri gösterir. Colours renk sayısını, miras alınan renklerin göründüğü yerde soluk bir `· N starter` ile verir; şeridi önce renklerini, sonra bir ince çizgiyi, sonra soluk starter renkleri koyar. Type role göre okunur (*Inter for headings*, altındaki satırda *Starter for the rest*). Logos kaç yuvanın dolu olduğunu söyler (veya **Not set**), Tokens köşe yarıçapını gösterir ve Files kitaplık boşken **Nothing yet** der. Her blok kendi odasını açar.

### Starter ve seninkiler

**Starter**, seçilmek yerine uygulamayla gelen her şey için kullanılan sözcüktür. Yeni bir kurulum hiç renk taşımaz; yalnızca mürekkepten kâğıda tek bir nötr rampa taşır, böylece yüzeyler, metin ve ince çizgiler kimse bir şeye karar vermeden render edilebilir. Aynı sözcük her odada miras alınan malzemeyi işaretler.

::: cols
## Starter

- Uygulamayla geldi: mürekkepten kâğıda nötrler, starter yazı tipleri, varsayılan köşe yarıçapı.
- Soluk, bir **Starter** etiketiyle ve tonsuz.
- Renklerin olarak sayılmaz. Nötrler **Tokens** içinde **Neutrals · starter · 9** olarak yaşar ve **Open** onları Colours içinde tek bir katlanmış grup olarak gösterir (`#/start?area=color&group=neutral`).
- Bir starter renge dayanan rol *"Starter Paper stands in"* olarak okunur ve seçicisinde **Choose…** vardır.

## Seninkiler

- Senin seçtiğin veya kurduğun.
- Tam güçte ve bir yazı tipi kurduğun yerde tonlu bir kart.
- Overview'da ve Tokens'ta sayılır.
- Başka bir rolü izleyen bir rol, birincil rengin adını tekrarlamak yerine **↳ follows Primary** olarak okunur.
:::

Miras alınan malzeme asla kesikli bir kenarlıkla çizilmez, çünkü burada kesikli kenarlık bir bırakma hedefi demektir.

## Logos

İşaretlerin klasörünü en üstteki bırakma alanına boşalt: **"Drop marks here, or choose several at once"** elindeki kadar dosya alır. Her dosya şekli ve mürekkebi için okunur, sonra **Waiting for a slot** altında neye benzediğini söyleyen bir çip olarak bekler; örneğin *"Looks like the Horizontal primary"*, kullandığı ölçümle ve bir **Place** düğmesiyle (yuva doluysa **Replace**). Emin olmadığı yerde çip bunu söyler ve sekizini de listeleyen **Change slot** sunar. Sen bir şeye basana kadar hiçbir şey yerleştirilmez.

Fazladan boş kenar boşluğu olan bir işaret önce bir kırpma önerisi alır; yanıtla ya da Escape'e bas ve özgünü dokunulmadan girer. Bir işaretin boş bir kardeş yuvayı doldurabildiği yerde oda türetilmiş **mono** veya **reverse** sürümü *Generated* işaretli bir çip olarak sunar.

Her işaret, **yön** ve **işlem** başına bir olan sekiz isteğe bağlı yuvadan oluşan bir ızgarada sona erer:

- **Yönler:** Horizontal (bir satırda logotype ve sembol) ve Vertical (kare ve uzun alanlar için yığılmış).
- **İşlemler:** Primary, Primary reverse (koyu arka planlar için), Mono (tek renk) ve Mono reverse.

Henüz işareti olmayan bir grup tek satıra katlanır; yuvalarını görmek için aç. Bir PNG, SVG, JPEG veya WebP eklemek için bir yuvaya tıkla ya da işareti değiştirmek için dolu bir yuvaya tıkla. Her şey bu cihazda kalır.

![Horizontal ve Vertical açık logo yuvaları: her işlem kendi yuvasıdır ve her yuva isteğe bağlıdır](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&width=1440&height=1600&dpi=192&waitMs=1600&drive=click%3A.be-logo-identity%3Edetails%3Anth-of-type%281%29%3Esummary%3Bclick%3A.be-logo-identity%3Edetails%3Anth-of-type%282%29%3Esummary%3Bwait%3A600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Custom marks**, markanın bir simge, arma veya favicon gibi kendi adıyla çağırdığı işaretlerdir.
- **More identities.** Bir alt marka, ürün veya etkinliğin kendi tam seti olabilir: **+ Add another logo** ve sete bir ad ver. Ana setin "Your logo"dur. Bir logo kimliğinin ne zaman doğru blok olduğunu [Brand architectures](/info/brand-architectures.html) gösterir.
- **Lolly logonun renklerini okur.** Bırakma alanının altındaki ve yine Colours'un en üstündeki bir kart logonun renklerini listeler ve en güçlü renk zaten seçili olarak (asla dışa aktarıldığı beyaz değil) **Which is the main colour?** diye sorar. **Use these colours** onları paletine ekler, ana rengi birincil rengin yapar ve logonun kâğıtta okunan koyu bir nötrü varsa onu metin rengi yapar. **Not now** onları Tray içinde bırakır. Yepyeni bir kurulumda en olası yanıt hemen uygulanır ve kart **Undo** veya başka bir ana renk sunar. Bir SVG tam renkleri verir; bir PNG, JPEG veya WebP işaretin gerçek payını kaplayan renkleri verir.

## Colours

Oda tasarım sistemiyle birlikte büyür: ilk ziyaret tek bir karardır ve gerisi palet gibi gelir.

### İlk renk

Kendi rengi olmayan bir sistem tek bir büyük çip ve tek bir alanla açılır; rollerin, tonların ve baskı ayarlarının sistem büyüdükçe geleceğini söyleyen bir satır eşlik eder.

- **Çip seçicidir.** **Pick a colour** düğmesine bas ve stüdyonun OKLCH kartı alanın tuttuğuyla tohumlanmış olarak açılır: bir ad, tekerlek, dört kadran, alfa ve **Stored as**; altta **Cancel** ve **Add colour** vardır. Sen **Add colour** düğmesine basana kadar sisteme hiçbir şey ulaşmaz.
- **Alan her gösterimi alır**: `#e0452b`, `rgb(224 69 43)`, `oklch(58% .19 32)` veya bir renk adı. Bir liste yapıştır; tek tek veya **Add all** ile eklenecek bir çip satırı olur.
- **İki yol daha.** **Pick a colour from the screen** tarayıcıda varsa damlalığı kullanır ve **Take colours from an image** bu cihazdaki bir ekran görüntüsünü veya fotoğrafı okur.
- **Add asla devre dışı değildir.** Alan boşken seçiciyi açar; okuyamadığı metin için alanın altında bunu söyleyen bir satır çıkar.

İlk rengin **birincil** olur ve bir çip bunu doğrular, örneğin *"Primary is now Vivid Violet"*, rengi ayarlamak için **Fine-tune** ile.


### Palet büyüdükçe

Renkler geniş ekranda bir **In context** önizlemesinin yanında, daha küçük ekranda üstünde durur. Önizleme paletinde bir poster, grafik veya arayüz kartı gösterir. Starter renkler kendi katlanan gruplarında kalır.

![Lolly Demo üzerinde Colours odası: katlanan gruplarda palet, adı ve hex değeriyle her renk ve altta indirme hapı](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

![Bir renk eklendikten sonra Colours odası, paletiyle ve canlı bir kompozisyon önizlemesiyle](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

### Roller: araçların okuduğu

**Roles**, her araçta ve dışa aktarmada hangi rengin hangi rolü oynadığını söyler. İsteğe bağlıdır (üç serbest renk ve rol olmaması mükemmel bir sistemdir), her renk bir rol alabilir ve kontrast göstergesi yüzeye karşı ölçülür, önce APCA. Her rol satırı tam güçte kendi bir rengi, yerine geçen bir starter rengi veya **↳ follows Primary** gösterir.

Palette tonlar olduğunda şerit, bir aracın okuyabileceği yedi rolün hepsini gösterir: Primary, Secondary, Surface, Text, Muted, Edge ve On primary. On primary birincil renkten türetilir, **Derived** yazar ve seçicisi yoktur.

Uygulamanın kendi vurgusu varsayılan olarak tasarım sistemini izler. Bu, **Settings → Appearance** içindeki **Interface follows the design system** ayarıdır; ayarı kapatmak uygulamanın arayüzünü nötr bırakır, araçlar, tuvaller ve dışa aktarmalar iki durumda da tasarım sistemini izler.

**Colourways.** Bir tasarım sistemi, her biri parça başına seçilen birkaç öncü renk tutabilir. Lolly her colourway'i korur ama bu oda henüz birini yazamaz: bir colourway token dosyasında yazılır. Colourway'leri olan bir sistemde her colourway'in kendi birincil ve ikincil rengi ve colourway'ler arka planı tonladığında kendi yüzeyi gerekir; bu yüzden bu roller renk örneği düzenleyicisinde ayarlı kalır. [Lolly Demo in use](/info/lolly-demo-in-use.html#colourways-on-real-work) gerçek işlerde colourway'leri gösterir ve [Add colourways to a design system](/info/colourways.html#add-colourways-to-a-design-system) biçimi içerir.

### Daha fazla renk bul

Üç araç birincil rengin üzerine kurulur. İlk ikisi yalnızca önerir; üçüncüsü değişikliği inceledikten sonra paleti değiştirir.

::: cols
## Explore shades & harmonies

Bir **Starting colour**, bir **Scheme** (Mono, Complement, Analogous veya Triad) ve kaç **Shades** (3 ila 20, varsayılan 5) seç. **Fine-tune** arayüz yoğunluğunu, kontrastı ve marka üzerindeki metni ayarlar. Eklemek için bir tona tıkla ya da bir grup için **Add 5 shades** seç. Renklerin ve rollerin kalır.

## Find matching colours

Bir **Harmony** seç: Complementary, Adjacent, Triad, Tetrad veya Analogous (2 ila 5 **Accents** ve 10° ila 45° **Angle** ile). Her adayın üretilmiş bir adı ve renk başına bir basışla **+ Add** düğmesi vardır.

## Rebuild the whole palette

Neyin değişip neyin kaldığının incelenmesinden sonra paleti tek bir başlangıç renginden değiştirir. Önce bir kontrol noktası alınır ve sonrasında **Undo** sunulur.
:::

Üçü de motorla aynı algısal renk matematiğini (OKLCH) kullanır. **Explore shades & harmonies** içinde **Primary**, **Neutral** ve **Secondary** satırları önerilen tonları gösterir ve **Theme preview** açık ve koyu örnekleri kontrast okumalarıyla gösterir.

![Ayrı ekleme denetimleriyle ve ayrı bir Theme preview ile üç önerilen ton grubu](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

![Üretilen vurgular, her biri bir renk örneği, otomatik oluşturulmuş bir ad, hex kodu ve bir Ekle düğmesiyle](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&drive=click%3A.be-generate-detail%3Anot%28%5Bdata-be-rebuild%5D%29%20%3E%20summary%3Bwait%3A500&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### Üretilen bir paleti onaylamak

**Rebuild the whole palette…** bölümünü aç ve **Preview full rebuild** düğmesine bas. İnceleme kaç rolün atadığın gibi kaldığını, kaç renginin korunduğunu ve kaç ton eğrisinin, baskı kilidinin, gizli tonun ve gradyan durağının yeniden sabitlendiğini ya da korunduğunu sayar. **Apply rebuilt palette** uygular; **Cancel** hiçbir şeyi değiştirmez. Sonrasında kart odak üzerindeyken **Undo** sunar ve değişimden önce alınan kontrol noktası sistemin tamamını geri yükler.

Colourway'li bir sistem, yeniden kurmada her colourway'i korur. Kurallı colourway yeni başlangıç rengini izler ve diğer her colourway kendi renklerini, adını, sırasını ve ayarlarını korur. İnceleme hangi colourway'in izlediğini ve hangilerinin renklerini koruduğunu listeler. Lolly, colourway'lerini düzenleyemeyeceği bir biçimde kodlayan bir sistemi yeniden kurmaz; kart nedenini söyler ve hiçbir şey değişmez.

### Uzman bölümleri

Önizlemenin ve rollerin altında dört katlanmış bölüm durur. Her biri `#/start?area=color&focus=<name>` ile doğrudan açılır:

- **Explore shades & harmonies** (`focus=generate`), yukarıda anlatıldı.
- **Shade curves** (`focus=curves`) bir rampayı nokta nokta yeniden şekillendirir; ayrı açıklık, kroma ve ton eğrileriyle (L / C / H) ve sen sürükledikçe yeniden çizilen tonlarla.
- **Contrast** (`focus=contrast`): **Contrast-lock** bir rampayı seçtiğin bir arka plana karşı APCA hedeflerine ulaşacak şekilde yeniden tonlar ve **Rotate hue** tüm rampayı tekerlek boyunca çevirir.
- **Print** (`focus=print`) birincil rengin baskıda neye dönüşeceğini ayarlar: otomatik değeri, sabitlenmiş bir CMYK derlemesi veya adlandırılmış bir spot mürekkep.

### Palet ve her örnek

Palet renklerini, her birinin kendi **+ Add** düğmesi olan katlanan gruplarda listeler. Grupları istediğin gibi oluştur ve yeniden adlandır. Bir rol asla ikinci bir karo oluşturmaz: bir rolün işaret ettiği karo bunun yerine küçük bir işaret taşır (**P**, **S**, **Su**, **T**). Karoların altındaki **Colour chart** aynı renkleri OKLCH **Wheel** üzerinde (yeniden renklendirmek için bir noktayı sürükle, örnek eklemek için boş alana tıkla) ve görüntülenebilir aralığın nerede bittiğini gösteren **Gamut** grafiğinde gösterir. `#/start?area=color&focus=chart` grafiği doğrudan açar.

![Palet bölmesi, her grup katlanabilir, indirme hapı alt kenarda park etmiş](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![OKLCH çarkı - açı ton, dıştaki mesafe doygunluk ve griler yan tarafta bir açıklık rayında ilerliyor](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

Düzenleyicisini açmak için bir örneğe tıkla:

- Örneği **yeniden adlandır**.
- OKLCH sürgüleriyle ya da **Hex**, **HSL**, **RGB** veya **CMYK** içinde **rengi ayarla**. Değer alanı etkin uzayda okur ve yazar. Buradaki CMYK ekran rengini dönüşümle ayarlar; tam mürekkepleri sabitlemek için **Print substitutes** kullan.
- **Stored as** örneğin nasıl kaydedileceğini seçer: **LCH** (varsayılan, algısal ve geniş gamut), Hex, RGB veya HSL.
- **Use as** örneğe doğrudan bir rol verir. Rolü temizlemek için vurgulanmış bir role yeniden bas.
- **Print substitutes** (katlanmış): **CMYK** değerini **Auto**'dan tam mürekkep değerlerine kilitle ya da bir **Name** (örneğin `PANTONE 186 C`), isteğe bağlı bir **Book** ve folyo, kabartma, çukur, spot vernik, soft touch veya bir kalıp kesimi, kırım ya da perforasyon için bir **Finish** ile bir **Spot colour** ayarla. Bir CMYK PDF veya TIFF dışa aktardığında bir baskı makinesi bu kilitleri kullanır; bkz. [Colour profiles](/info/exporting.html#colour-profiles).
- **In other spaces** (katlanmış): renk uzayı başına, türetilmiş veya senin yazdığın bir değer ve yazılmış olan dışa aktarmada kazanır.

**Bir örneği silmek** güvenlidir. Türetilmiş tonlar ve tema rolleri gizlenir; böylece onları okuyan hiçbir şey bozulmaz, eklediğin renkler ise kaldırılır.

::: details Birçok örnekle çalışmak
Her örneğin bir sürükleme tutamağı vardır. Bir grup içinde yeniden sıralamak için sürükle ya da tutamağa odaklan, Space'e bas, ok tuşlarını kullan ve bırakmak için yeniden Space'e bas; Escape iptal eder. Renkleri gruplar arasında taşımak için düzenleyicinin **Group** denetimini kullan ya da birkaçını seç ve **Move to** kullan.

Seçim için bir mod gerekmez. Çubuk ilk seçili karoyla belirir ve sonuncuyla kaybolur.

- **Boş alanda sürükle** bir dikdörtgen çizmek için; dokunduğu her karo gruplar boyunca seçime katılır. Katlanmış bir bölüm hiçbir şey eklemez.
- **Shift ile tıkla** okuma sırasında bir aralık alır, **Cmd/Ctrl ile tıkla** bir karoyu açıp kapatır ve düz bir tıklama düzenleyiciyi açar.
- Her grup başlığında **Select all** vardır ve bir karo odaktayken **Cmd-A** sahip olduğun her rengi alır, asla bir starter rengi değil.
- Izgaranın tek bir sekme durağı vardır: oklar gezdirir, Shift-oklar genişletir, Space açıp kapatır, Delete kaldırır ve Escape temizler. Bir kanalı hafifçe oynatmak için önce `l`, `c` veya `h` tuşuna bas.
- Dokunmatik ekranda bir seçim başlatmak için bir karoya basılı tut, sonra eklemek için dokun.

Çubuk **{n} selected** yazar, sonra **Move to**, **Give a role** (her renk sırayla bir sonraki rolü alır), **Download** (seçim, altı palet biçiminden herhangi birinde), **Duplicate** (her birinin, orijinalden sonra yerleştirilen bir kopyası), **Copy values** ve **Delete**. Tek bir kopya doğrudan düzenleyicide açılır; birkaçı seçili kalır. Tek bir Cmd/Ctrl-Z toplu bir eylemin tamamını geri alır.
:::

### Gradyanlar

İsteğe bağlı **Gradients** paneli paletten karışım token'ları kurar. Her gradyanın bir önizlemesi, 2 ila 8 adlandırılmış durağı ve bir açısı vardır. Bir durak bir örneği işaret eder; örneği yeniden renklendirirsen gradyan izler. Karışımlar OKLCH içinde çalışır.

Palet indirmeleri (tasarım token'ları, CSS, SCSS, GIMP ve Adobe Swatch Exchange) tonlar olduğunda paletin altındaki bir hapta durur. [Take your palette and fonts anywhere](/info/using.html#take-your-palette-and-fonts-anywhere) her biçimi anlatır.

## Tip

Kendi yazı tipi olmadığında oda tek bir karttır: bugün onu sunan yazı tipiyle okuma boyutunda ayarlı **Primary**, bir **Starter** etiketi, bir **Choose a face** düğmesi ve *"Nothing installs until you choose one."* satırı. Headings, code ve italic sen seçene kadar birincili izler; **Choose them separately** kartlarını gösterir.

![Henüz bir yüz seçilmemiş Type odası - okuma boyutunda bir kart, üzerinde bir Starter etiketi ve dolu bir Bir yüz seç](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

Bir yazı tipi seç ve oda dört rol kartına, Fonts listesine ve canlı bir örneğe açılır:

- **Primary**: gövde metni, düğmeler ve her araç.
- **Headings**: `h1` ve `h2` için görüntüleme yazı tipi.
- **Code**: kod ve veri için tek aralıklı bir yazı tipi.
- **Italic**: vurgu, alıntılar ve yan notlar için gerçek bir italik.

Bir kart yalnızca o yazı tipini kurduğun yerde tonludur ve düğmesi kendi yazı tipinde **Change**, her yerde **Choose a face** yazar. Bir karttaki hiçbir şey bir şey uygulamaz: düğme o rol için karşılaştırma sahnesini açar.

![Ortaya çıkan dört rol kartı - her biri kendine hizmet eden yüzde ayarlanmış, kimsenin seçmediği yerde bir Starter etiketiyle ve İtalik'in Birincili izlemesiyle](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

### Karşılaştırma sahnesi

Sahne odanın içinde, bastığın kartın altında açılır ve kartlar tek satırlık bir şeride katlanır; böylece sahne bir telefonun ilk ekranında görünür. Escape iptal eder ve odağı karta geri verir.

1. Kartta **Choose a face** düğmesine bas.
2. Bir aile adı yaz ve **Preview** düğmesine bas ya da alanın altındaki altı **Pinned** aileden birine bas.
3. **Use this face** düğmesine bas.

![Kartının altında açılan karşılaştırma sahnesi, arama satırı, sabitlenmiş aileler ve tek satırlık bir şeride katlanmış kartlarla](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

**Onay bir kez sorulur.** Bir önizleme Google Fonts'a ilk kez ulaştığında bir iletişim kutusu açıklar: *Google aile adını ve IP adresini öğrenir. Dosya sonra bu cihazda tutulur ve çevrimdışı kullanılır. Bu, stüdyoda üçüncü bir tarafa ulaşan tek adımdır.* **Fetch from Google** devam eder ve hatırlanır. **Cancel**, kartı kendi **Fetch from Google** düğmesiyle *"Not fetched. Nothing was sent to Google."* diye okunur bırakır.

Zaten sahip olduğun lisanslı bir yazı tipini önizlemek için **sahneye bir yazı tipi dosyası bırak** (TTF, OTF veya WOFF). Her iki durumda da yazı tipi bu cihazda kalır, uygulamada, araçlarda ve her dışa aktarmada çevrimdışı render edilir ve tasarım sistemi dosyasında taşınır. Google Fonts üzerindeki her şey açık bir lisansla (OFL, Apache veya UFL) gelir.

### Bu cihazdaki fontlar

**Fonts** paneli bu cihazdaki her yazı tipini ve hizmet ettiği rolü listeler. Eklediğin yazı tipleri **In the design system** altında, her biri rolleri ve bir silme düğmesiyle öne geçer. Starter yazı tipleri tek bir soluk, katlanmış satırda gelir. **Add a face** herhangi bir rol için karşılaştırma sahnesini açar. **Type roles** paneli her rolün ailesi ve durumuyla, örneğin *Inter* veya *Inter · follows Primary*, canlı bir örneğini gösterir.

## Token'lar

Token'lar tasarım sisteminin ardındaki adlandırılmış değerlerdir: renkler, yazı tipleri, logolar, köşeler ve aralık. Araçlar onları adlarıyla okur; bu yüzden burada yapılan bir değişiklik her araca bir anda ulaşır.

![Tokens odası: sistemden bir örnek ve dosya eylemleriyle başlık, her token türünü sayan karolar, ardından kontrast göstergeleriyle renk çiftleri](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **Başlık**, kendi sisteminden bir örnek verir (*Primary is Spearmint, #033633*) ve dosya eylemlerini: **Download** (sistemin tamamı tasarım token'ları olarak ya da palet beş başka biçimde), **Copy CSS** ve bir JSON dosyasını geri okumak için **Add from…**.
- **Karolar**, her token türünü sayar ve bölümüne atlar: Colours, Type, Logos, Shape and spacing, More ve All tokens. Overview'ın yaptığı gibi senin olanı sayarlar. Telefonda karolar yana kayar.
- **Colours**, araçların bir araya getirdiği çiftlerle (yüzeyde metin, birincilde, yüzeyde soluk) açık ve koyuda bir APCA göstergesiyle başlar ve bir çift yetersiz kaldığında **Weak contrast** işaretler. Sonra her renk grubu: bir satır çip olarak rampa, değeri ve araçların kullandığı başvuruyla diğer renkler; örneğin `{color.brand.spearmint}`. Başvuruyu kopyalamak için bir başvuruya bas. **Edit in Colours** bir grubu Colours odasında açar.
- **Type** ve **Logos**, kendine ait olanlar olduğunda **Edit in Type** ve **Edit in Logos** ile her rol ve her logo yuvası için yazı tipini listeler.
- **Shape and spacing**, **Rounded corners** (`shape.radius`) ve **Spacing rhythm** (`space.base`) tutar. Her biri sürgüyü oynatana kadar *Lolly default*, sonra *Yours* okunur, hemen kaydeder ve geri alınabilir.
- **More tokens**, standart [tasarım token'ları](/info/design-tokens.html) olarak saklanan aralık, boyutlandırma, çizgi kalınlığı, opaklık, döndürme, düz sayılar ve gölgeler ekler.
- **App appearance (advanced)**, Lolly'nin kendi ekranlarının kullandığı renkleri, boyutları ve gölgeleri listeler ve **Inspect every token (advanced)** her değişikliği önce inceleme için göstererek saklanan her değeri arar ve düzenler.

İçinde hiçbir şey olmayan bir bölüm boşluğu doldurmanın yolunu sunar: **Pick a colour**, **Choose a face** veya **Add a logo**.

## Dosyalar

Markanın tuttuğu dosyaları, logolar dışında bırak: **vector**, **image**, **audio** ve **motion** dosyaları (video, Lottie ve animasyonlar). [Assets](/info/using.html#assets-your-library) içinde bölümlere ayrılmış olarak görünürler, her aracın varlık seçicisinde hazırdırlar ve bu cihazda kalırlar.

## Usage & rules

**Usage & rules**, markanın seçimlerini işe koyar: insanların neyi değiştirebileceği, neyin sabit kaldığı ve Lolly'nin neyi denetleyebileceği.

![Lolly Demo üzerinde Usage & rules: Add your first rule içeren boş bir Brand rules kartı, sonra örnekleri render edilmeye hazır Try your brand in use](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dusage&width=1440&height=1200&dpi=192&waitMs=2400&cropSelector=%23start-panel-usage&format=svg&walker=1&dark=1&filename=bs-usage-rules)

**Brand rules** kurallarını listeler. **Add rule** (veya **Add your first rule**) kısa bir form açar:

- *Beacon accents* gibi kendi sözcüklerinle bir **Rule name**;
- **Check**: **Colour choices**, **Font choices**, **Fixed artwork** veya **Text length**; rol için kendi adınla kullandığı marka rolüyle;
- uygulandığı **Example** (Poster, Title slide, Content slide veya Chart), **Mode** ve **Required** mi **Advisory** mi olduğu;
- **Reviewed by**, sonra **Save draft** veya **Approve & save**.

Onay, bu cihazdaki kendi kararını kaydeder. Onaylı zorunlu kurallar yeniden kullanılabilir posteri kısıtlar ve denetimler yalnızca örnek PNG'leri kapsar; başka hiçbir aracı değiştirmezler.

Bir tasarım sisteminin token dosyasında getirdiği kurallar, örneğin onaylı renk eşleşmeleri, metin ağırlığı ve hizalama ya da yüzey başına bir logo, burada **Checked in Design** olarak listelenir. Design bunları dışa aktarma panelinin **Before you export** kartında katman katman denetler ve `lolly check` kayıtlı bir Design belgesi için aynısını yapar ([Before you export](/info/design.html#before-you-export)). Bu derlemenin denetleyicisi olmayan bir kural sağlandığı gibi tutulur ve **Unchecked** olarak işaretlenir.

**Try your brand in use**, **Render & check examples** ile geçerli düzeltmeden dört örnek render eder. Başlık, destekleyici metin ve slayt metni için bir **Brand mode** ve **Try your own text** seç. Her örnek neyin ölçüldüğünü **See checks & sources** ve **Download check report** ile bildirir ve **Make reusable poster**, sabit düzeni ve onaylı girdi seçimleri dosyayla birlikte giden bir `.lolly` indirir. Örnekler yereldir: bir denetim çalıştırmak hiçbir şeyi yayımlamaz veya onaylamaz.

Sabit bir markayla gelen bir derleme, aynı kuralları ve örnekleri salt okunur olarak *This brand is set* altında gösterir.

## Bir marka getir

Rayın altındaki **Add from…**, hangi biçimde olduğunu değil, elinde ne olduğunu soran bir seçici açar:

- **Design tokens or a design file**: DTCG veya Tokens Studio JSON, bir Penpot projesi, token kümelerinin bir zip'i, bir Lolly tasarım sistemi paketi veya bir SVG.
- **PDF**: bir sunum veya yönergeler dosyası, renkleri, işaretleri ve gömülü yazı tipleri için bu cihazda okunur.
- **Logo or screenshot**: bir görsel, bu cihazda okunan önerilen bir palet olur. Renkleri okur, yazı tipini veya düzeni değil.
- **Saved web page**: bir HTML dosyası ve CSS dosyaları ya da yapıştırılmış HTML veya CSS; en fazla 20 dosya ve 2 MB. Yalnızca sağladığın metin okunur: bağlı kaynaklar getirilmez ve betikler çalışmaz.
- **Font file**: TTF, OTF veya WOFF. Yazı tipinin kurulduğu Type odasını açar.
- **Website**: bir sayfa, renkleri ve yazısı için okunur. Bu karo yalnızca bir sayfayı okuyabilen cihazda görünür ve hangi okuyucuyu kullandığını söyler: bu cihazdaki uygulama veya arka plan sekmesinde, sen olarak oturum açmış tarayıcı uzantısı. Bir URL'yi adlandırmak yalnızca alanı doldurur; getir düğmesine basmak onaydır.

Tasarım dosyası kaynağını seç; sonraki kart kabul edilen biçimleri simge karoları olarak listeler ve kartın tamamı tek bir bırakma hedefidir. Bir dosyayı doğrudan stüdyonun üzerine de bırakabilirsin.

![İçe aktarma kartı - kabul edilen biçimler simge kutucukları olarak öne çıkar ve bütün kart tek bir bırakma hedefidir](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

- Bir **Lolly design-system pack** (`.lolly` veya eski bir `.zip`) tek adımda kurulur.
- Bir **Penpot** dışa aktarması (`.penpot`) tasarım token'larını getirir.
- Bir **Design Tokens** (W3C DTCG) veya **Tokens Studio** dosyası (`.json`) token'larını getirir.
- Bir **plain SVG** seçeceğin renkler için taranır; ilki birincil rengin olur.

### Bir başvuruyu incele

Bir logo, ekran görüntüsü, web sitesi veya kayıtlı sayfa **Try these colours** açar: önerilen renklerde bir örnek, değiştirebileceğin bir **Main colour** ve yeni bir sistem için bir ad. Bir kutu uygulamanın ne yaptığını sıralar: etkin token ayarlarını oluşturulan palet ve varsayılan stillerle **değiştirir**, yazı tiplerini ve kitaplık dosyalarını **korur** ve önceki sistem **kurtarılabilir**. **Apply suggested settings**, bir kontrol noktasından sonra açık ve koyu paletleri uygular ve **Restore brand settings** eski ayarları geri getirebilir. **Change reference** başka bir kaynak seçer.

**Palette, source details and individual choices**, nelerin okunduğunu, bulunan yazı tipi adlarını ve önizlemenin kontrastını gösterir. Yazı tipi adları yalnızca öneridir; yazı tipini kurduğun yer yine Type'tır. Kaynak ayrıntıları, gözlemlenen yerde tipografiyi, boşlukları, dolguyu ve köşe değerlerini içerebilir; aksi hâlde **Not observed** etiketlenir. Kayıtlı bir sayfa veya yerel bir web sitesi okuması, sayfanın kullanmayabileceği bildirilmiş stilleri bildirir ve tarayıcı uzantısı görünür öğelerden bir örnekten ölçülmüş stilleri bildirebilir. Bunlar gözlemlerdir: hiçbir şey kurulmaz ve kaynak aralığı asla seninkinin yerini almaz. **Choose individual items in the tray** tek tek öğeleri tutar ve **Download design context** gözlemlerin, önerilen token'ların ve kaynak bilgisinin (sağlanan HTML veya CSS'in SHA-256 değeriyle) bir JSON raporunu kaydeder. Rapor ham sayfa metni içermez ve imzalı bir Content Credential değildir.

PDF ve tasarım dosyası içe aktarmaları kendi inceleme denetimlerini korur. **Tray** içindeki öğeler, o tür malzemenin sahibi odada ekleyene kadar hiçbir şeyi değiştirmez. `#/start?source=<kind>` seçiciyi bir kaynakta açar (`file`, `pdf`, `image`, `font`, `url`, `page`) ve `?import` düz listeyi açar.

### Bir görünüm bul ve karşılaştır

Overview'dan ya da Settings'teki tasarım sistemi listesinden **Find a look** aç. Bu cihazda kayıtlı sistemlere ve birkaç yeniden kullanılabilir Lolly örneğine göz at ve ada, renk etiketine veya bildirilmiş yazı tipine göre ara. **Closest to my current palette**, ölçülen renk benzerliğine göre sıralar; eşleşen yazı tipleri beraberlikleri bozar; bir kalite puanı değildir.

Bir görünümü incelemek için birini, yan yana karşılaştırmak için ikisini seç. Seçmek hiçbir şeyi değiştirmez. **Use this saved system** ona geçer ve **Use these colours** bir örneğin renklerini olağan kontrol noktasından geçirerek uygular, yazı tiplerini korur. **Restore brand settings** önceki görünümü geri getirir. Kayıtlı sistemlerin **Details and design context** altında düzenlenebilir **Search tags** değerleri vardır. Örnekler özgün Lolly renk tarifleridir; kazınmış bir koleksiyon ve hesap yoktur.

![Herhangi bir renk sistemini uygulamadan önce Sunroom ve Orchard'ı yan yana karşılaştır.](/t/url-shot?url=%2F%23%2Fstart&width=1280&height=900&dpi=96&waitMs=3000&format=svg&filename=brand-compare-looks&try=1&drive=click%3A%5Bdata-ds-door%3D%22looks%22%5D%3Bwait%3A500%3Bclick%3A%5Bdata-look-select%3D%22example%3Asunroom%22%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Aorchard%22%5D%3Bclick%3A%5Bdata-looks-review%5D%3Bwait%3A500&cropSelector=.ds-looks-comparison&waitSelector=%5Bdata-ds-door%3D%22looks%22%5D&walker=1&rasterDpi=96)

## Tasarım sistemini sakla ve taşı

### Bir markayı cihazlar arasında taşı

**Export**, tek bir **`LollyBrand-….lolly`** dosyası yazar: token'ların, yazı tiplerin, logoların ve tema tercihin; geri girerken denetlenen bir bütünlük bildirimiyle. 1.0.7 öncesi web sürümleri aynı dosyayı `.zip` olarak adlandırıyordu ve bu yazım hâlâ kabul edilir. **Tokens (.json)** düz tasarım token'ları belgesini, yazı tipi veya logo olmadan, bir depo, bir derleme adımı veya başka bir token aracı için tek başına yazar.

Birini geri getirmek için **Add from… → Design tokens or a design file** kullan ya da dosyayı stüdyonun üzerine bırak. Bir meslektaşın sana bir marka bu şekilde verir veya bir markayı ikinci bir kuruluma böyle taşırsın; hesap yok, bulut yok. Bir markayı komut satırından getirmek için bkz. [`ingest:brand`](/info/configuration.html#brand-packs).

**Fonts for Linux (.rpm)**, eklediğin yazı tiplerini kurulabilir bir RPM'de paketler. Bunlardan herhangi birini kendin yüklediysen Lolly önce onları yeniden dağıtabileceğini onaylamanı ister.

### Önceki ayarları geri yükle

**Restore brand settings** seç, tarihli bir kontrol noktası seç ve **Restore** düğmesine bas. Etkin marka için renkleri, yazı ayarlarını ve diğer token'ları geri yükler; yazı tipi ve görsel dosyaları olduğu gibi kalır. Lolly önce geçerli ayarlarını **Before restore** olarak kaydeder; böylece tarayıcıyı kapattıktan sonra bile bir geri yüklemeyi tersine çevirebilirsin. En son 20 kontrol noktası bu cihazda tutulur.

### Sürümler

Yayımlanmış bir sürüm, bu cihazda tutulan **kalıcı, adlandırılmış bir kopyadır**. Asla değişmez; bu yüzden onu sabitleyen bir araç veya bağlantı (`designv` ile) aynı şeyi çizmeye devam eder. Kendine ait bir şeyi olan bir sistem, rayın altında sessiz bir **Versions & publishing** bağlantısı gösterir; ilk yayımlamandan sonra **Versions** girişi olur. `#/start?area=versions` onu doğrudan açar.

- **Bir sürüm kalıcıdır.** Henüz silme yok ve panel bunu söyler.
- **Kaldırmalar uyumluluk kartına öncülük eder**, çünkü bir aracı bozan şey kaldırılmış bir token'dır.
- **Yayımlama geri alınamaz; geri yükleme alınabilir.** *Restore latest from this version* sıradan bir düzenlemedir ve hemen **Undo** sunulur.

**Publish only** araçların izlediğini değiştirmeden bir sürümü tutar; **Publish and make active** araçların ve uygulamanın o sürümü izlemesini sağlar. **Follow the latest again**, her düzenlemeyi yaptığın anda yayına alır.

## Tasarım sistemlerini yönet

Sistemleri değiştirmek, eklemek veya kaldırmak için **Settings → Preferences → Design systems** aç. **Open** bir sistemi seçer ve burada açar; **Make a new one** yerel bir sistem oluşturur ve ad alanı hazır olarak açar. Aynı anda tüm cihaz için bir sistem etkindir. Bir markanın kendi tasarım sistemine ne zaman ihtiyaç duyduğuna karar vermeye [Brand architectures](/info/brand-architectures.html) yardım eder.

**Bir sistemin nereden geldiği.** Bir dağıtımın kataloğunun sağladığı sistem **Came with this app** ya da bir örneğe bağlı uygulamada **From this instance** okunur. Kimin sağladığını, token varlığını ve ad alanını ve bilinen sürümü veya sağlama toplamını görmek için **Catalogue source** bölümünü genişlet; bir yenileme başarısız olursa önbellekteki malzeme etiketlenir.

**Yönetilen sistemler salt okunurdur.** Kataloğu sistemi kilitlediğinde bir sistem **Managed by this instance** (ya da örneksiz masaüstü uygulamasında **Managed by this app**) okunur. Onu kullanabilir ve indirebilirsin ve burada açmak **Make an editable copy** ve **Switch** ile salt okunur bir not gösterir. Yönetilen sistem önce gelmiş olsa bile kendi yerel sistemlerin düzenlenebilir kalır. Tek sabit markalı bir derleme, Design System Setup'ı markanın token'ları ve okunacak kullanım kurallarıyla *This brand is set* üzerinde açar.

**Sağlanan diğer her sistem** lolly.tools üzerindeki Lolly Demo ve Lolly Starter dahil gizlemek, düzenlemek ve sıfırlamak için **senindir**. Birini düzenlemek adını korur ve satırı **Edited here** olarak işaretler ve menüsündeki **Reset to original** bu cihazda yapılan değişiklikleri atar. Boş starter istisnadır: oradaki ilk değişiklik kendi tasarım sistemini başlatır, bu yüzden Lolly yeni sisteme ne ad vereceğini bir kez sorar. Kendi sisteminin neyin yerini aldığını [Lolly Demo in use](/info/lolly-demo-in-use.html#switch-to-your-own) gösterir.

### Bir tasarım sistemini kaldırma

Bir sistemin menüsünden **Remove** seç; onay, sonrasında hangi sistemin etkin olacağını söyler. Kayıtlı oturumlar, yüklemeler ve başka bir sistemle paylaşılan malzeme kalır.

Sağlanan bir sistemi kaldırmak onu yalnızca gizler: katalog varlıkları kalır, **Bring back** onu yeniden gösterir ve diğer her şeyi kaldırırsan kendiliğinden geri döner. İçe aktarılmış veya düzenlenmiş bir kopyayı kaldırmak sağlanan sistemi, logolarını veya yazı tiplerini kaldırmaz ve kopya etkinse sağlanan sistem yeniden etkin olur. Etkin barındırılan bir kopyayı kaldırmak yalnızca o kopyanın bağlantısını temizler; ayrıca seçilen bir örnek seçili kalır.

Bir sunucunun sağladığını değiştirmek yöneticinin görevidir: işletmesi kaynak kataloğu değiştirir ve yeniden dağıtır ya da bir Lolly Work yöneticisi bir sunucu değişikliğini inceler ve uygular. Buradaki düzenlemeler yerel kalır. Bkz. [Removing a catalogue design system](/info/configuration.html#removing-a-catalogue-design-system) ve [Configuration](/info/configuration.html#supplied-and-local-design-systems).

## Tasarım bağlamını uygulamanın dışında kullan

**Download design context**, token belgesini, çözümlenmiş renkleri, bildirilmiş yazı tipi ailelerini, varlık kimliklerini, kaydedildiği yerde kaynak kanıtını, kapsamı ve açık kuralları kaydeder; yazı tipi dosyası ve sahiplik kanıtı olmadan. Komut satırı dosyayı sunucusuz okur: `lolly system import` onu terminalin tasarım sistemi yapar ve `lolly system check` Design girdilerini kayıtlı bağlama göre denetler. İçe aktarmayı [Bring your design system](/info/cli.html#bring-your-design-system), denetimi [Which design system a command uses](/info/cli-decks.html#which-design-system-a-command-uses) kapsar ve bir MCP istemcisi aynı özeti `lolly://design-context` adresinden okur ([MCP Server](/info/mcp.html)).

## Bundan sonra nereye

- **[Using Lolly](/info/using.html)**: araçlar, kaydetme, paylaşma ve Assets.
- **[Brand architectures](/info/brand-architectures.html)**: bölümlerin, ürünlerin, onaylı markaların, müşterilerin ve sezonların tasarım sistemlerine, colourway'lere ve logo kimliklerine nasıl eşlendiği.
- **[Design Tokens](/info/design-tokens.html)**: markanın yazıldığı token modeli.
- **[Export a file](/info/exporting.html)**: baskı birimleri, CMYK ve markanın render edildiği biçimler.
