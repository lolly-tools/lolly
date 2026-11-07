# Lolly Design System Setup

<a id="design-system-setup"></a>

Logon, renklerin ve yazı tiplerin tek yerde durmalı ki her araç, sayfa ve dışa aktarma onlarla çizsin. O yer, `#/start` adresindeki **Lolly Design System Setup**'tır.

Elinde ne varsa onunla başla. Bir logo bırak ve Lolly renklerini okur. Bir yazı tipi seç ya da şirketinin lisansladığı yazı tipi dosyasını bırak. Her değişiklik uygulamanın tamamında hemen görünür. Logon, yazı tiplerin ve token'ların bu cihazda kalır. Bir Google Font seçmek dışarıya uzanan tek adımdır: Lolly önce sorar, sonra aileyi bir kez getirir.

Doğru göründüğünde tasarım sistemine bir ad ver ve **Export** düğmesine bas. Saklayacağın, başka bir cihazda açacağın ya da bir meslektaşına vereceğin tek bir `.lolly` dosyası alırsın. [Lolly Settings](/info/dashboard.html#design-system) etkin sistemi salt okunur gösterir ve kapağı düzenleme için buraya geri bağlanır.

## Beş dakikada kendine ait yap

::: timeline
- <!--i:upload--> **Logon'u bırak** **Logos** içindeki bırakma alanına. Lolly şeklini ve renklerini okur.
- <!--i:palette--> **Bu renkleri kullan.** Logonun ana rengi birincil rengin olur ve logodan koyu bir nötr metin rengin olur.
- <!--i:font--> **Type** içinde **bir yazı tipi seç**: bir Google Font ya da sahip olduğun bir yazı tipi dosyası.
- <!--i:pentool--> **Sisteme ad ver.** İlk düzenlemen kendi tasarım sistemini oluşturur ve Lolly adını bir kez sorar.
- <!--i:download--> **Export**, sistemin tamamını tek bir `LollyBrand-….lolly` dosyası olarak yazar.
:::

Stüdyonun üstündeki çubuk tasarım sisteminin adını taşır ve ad istediğin zaman değiştirebileceğin bir alandır: **Enter** yeni adı korur, **Escape** eskisini geri getirir. İlk düzenlemen **What is this design system called?** diye sorduğunda, logon yazıyı hecelediyse logondaki sözcükler doldurulur. **Save name** adı korur; **Not now** sen çubuğa bir tane yazana kadar yer tutucuyu korur. Ad, sistemi Settings'te ve geçiş yaparken etiketler ve **Export**'un yazdığı dosyanın adı olur.

## Odalar

Stüdyo, sabit bir sırası olmayan odalardan oluşur: hiçbir şey numaralı değildir ve hiçbir şey başka bir şeyi beklemez. Masaüstünde odalar çubuğun altındaki tek bir şeritte durur. Telefonda alt kenardaki bir çubuğa taşınır; orada başparmak erişir, açık oda görünür alana kaydırılır, palet sayfası ve tepsi o çubuğun üstüne yükselir ve sen yazarken çubuk kenara çekilir. Klavyeyle Tab şeride bir kez ulaşır; ok tuşları, Home ve End odadan odaya geçirir.

![Stüdyonun çubuğu ve odaları: Board, Colours, Type, Logos, Tokens, Files, Rules ve Skills](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-top&waitSelector=.ds-room-nav&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

| Oda | Orada ne yaparsın | Bağlantı anahtarı |
|---|---|---|
| **Board** | Sistemin neleri tuttuğunu, her odaya bir kapıyla gör | `overview` |
| **Colours** | Renk ekle, onlara rol ver, ton ve palet kur | `color` |
| **Type** | Uygulamanın, araçların ve her dışa aktarmanın okuduğu dört yazı tipini seç | `type` |
| **Logos** | İşaretlerini her yönde ve işlemde yerleştir | `logos` |
| **Tokens** | Köşeler, aralık, gölgeler ve adlandırılmış diğer her değer | `tokens` |
| **Files** | Markanın tuttuğu görsel, ses ve hareket dosyaları | `catalogue` |
| **Rules** | Markanın uyguladığı kurallar, gerçek örnekler üzerinde denetlenir | `usage` |
| **Skills** | Markanın insanlar ve ajanlar için yazılı standartları; okumak ve indirmek için | `skills` |

Bir odaya `#/start?area=<key>` ile bağlan. Files odası `catalogue`, Board `overview` ve Rules `usage` anahtarını korur, çünkü bir oda anahtarı kalıcı bir sözleşmedir ve `?tab=` eski bir takma ad olarak hâlâ çalışır. Bilinmeyen bir anahtar Board'u açar.

**Çubuk**, tek bir oda yerine tüm sistemin eylemlerini tutar. **Add from…** bir markayı içeri getirir ([Bring a brand in](#bring-a-brand-in)) ve **Tray** bir taramanın bulduğu ama henüz eklemediğin şeyleri tutar. **Export** sistemi tek bir dosya olarak yazar; **More** ise **Tokens (.json)**, **Fonts for Linux (.rpm)**, **Versions & publishing**, **Restore brand settings** ve **Design systems** öğelerini tutar, sonuncusu geçiş yaptığın listeyi Settings'te açar ([Keep and move your design system](#keep-and-move-your-design-system)). Her biri üzerinde işlem yapacağı bir şey olduğunda görünür. Telefonda **Add from…** **More** içine taşınır ve **Export** simgesi olarak görünür.

## Board

Henüz hiçbir şey seçilmemişken Board başlamak için dört yol sunar. **Start from a reference** bir logo, ekran görüntüsü, web sayfası veya tasarım dosyası için kaynak seçiciyi açar; **Pick a colour**, **Choose a face** ve **Add a logo** bu denetimleri doğrudan açar. Birini açmak hiçbir şey yazmaz ve **Explore the tools** en baştan oradadır.

Herhangi bir şey sana ait olduğunda Board, kendi sayılarının önde olduğu elindekileri gösterir. Colours renk sayısını, miras alınan renklerin göründüğü yerde soluk bir `· N starter` ile verir; şeridi önce renklerini, sonra bir ince çizgiyi, sonra soluk starter renkleri koyar. Colourways her colourway'i öncü renginde küçük bir karo olarak gösterir. Type role göre okunur ve her aileyi kendi yazı tipiyle dizer (*Inter for headings*, altındaki satırda *Starter for the rest*). Logos kaç yuvanın dolu olduğunu söyler (veya **Not set**), Tokens köşe yarıçapını gösterir ve Files kitaplık boşken **Nothing yet** der. Her blok kendi odasını açar.

Uygulamayla gelen ve düzenlenebilen bir tasarım sistemi, örneğin Lolly Demo, bunların hepsine baştan sahiptir: Board renklerini, colourway'lerini, yazı tiplerini ve işaretlerini gösterir ve başlığın yanında bir **Came with this app** etiketi durur.

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
- Board'da ve Tokens'ta sayılır.
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

![Horizontal ve Vertical açık logo yuvaları: her işlem kendi yuvasıdır ve her yuva isteğe bağlıdır](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&system=new-design-system&width=1440&height=1600&dpi=192&waitMs=1600&drive=click%3A.be-logo-identity%3Edetails.be-logo-group--fold%3Anot%28.be-logo-group--custom%29%3Esummary%3Bwait%3A600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Custom marks**, markanın bir simge, arma veya favicon gibi kendi adıyla çağırdığı işaretlerdir.
- **More identities.** Bir alt marka, ürün veya etkinliğin kendi tam seti olabilir: **+ Add another logo** ve sete bir ad ver. Ana setin "Your logo"dur. Bir logo kimliğinin ne zaman doğru blok olduğunu [Brand architectures](/info/brand-architectures.html) gösterir.
- **Lolly logonun renklerini okur.** Bırakma alanının altındaki ve yine Colours'un en üstündeki bir kart logonun renklerini listeler ve en güçlü renk zaten seçili olarak (asla dışa aktarıldığı beyaz değil) **Which is the main colour?** diye sorar. **Use these colours** onları paletine ekler, ana rengi birincil rengin yapar ve logonun kâğıtta okunan koyu bir nötrü varsa onu metin rengi yapar. **Not now** onları Tray içinde bırakır. Yepyeni bir kurulumda en olası yanıt hemen uygulanır ve kart **Undo** veya başka bir ana renk sunar. Bir SVG tam renkleri verir; bir PNG, JPEG veya WebP işaretin gerçek payını kaplayan renkleri verir.

## Colours

Oda tasarım sistemiyle birlikte büyür: ilk ziyaret tek bir karardır ve gerisi palet gibi gelir.

### İlk renk

Kendi rengi olmayan bir sistem, kendi grubunda açık duran starter nötrlerini ve odanın en üstünde kesikli bir yapıştırma ve bırakma alanı gösterir: tek bir büyük çip ve tek bir alan. Alanın herhangi bir yerine bir görsel ya da renk listesi bırak; Lolly renkleri bıraktığından okur.

- **Çip seçicidir.** **Pick a colour** düğmesine bas ve stüdyonun OKLCH kartı alanın tuttuğuyla tohumlanmış olarak açılır: önce rengin adı ve hex değeri, renk uzayları, tekerlek, dört kadran ve alfa **Fine-tune** altında; altta **Cancel** ve **Add colour** vardır. Sen **Add colour** düğmesine basana kadar sisteme hiçbir şey ulaşmaz.
- **Alan her gösterimi alır**: `#e0452b`, `rgb(224 69 43)`, `oklch(58% .19 32)` veya bir renk adı. Bir liste yapıştır; tek tek veya **Add all** ile eklenecek bir çip satırı olur.
- **İki yol daha.** **Pick a colour from the screen** tarayıcıda varsa damlalığı kullanır ve **Take colours from an image** bu cihazdaki bir ekran görüntüsünü veya fotoğrafı okur.
- **Add asla devre dışı değildir.** Alan boşken seçiciyi açar; okuyamadığı metin için alanın altında bunu söyleyen bir satır çıkar.

İlk rengin **birincil** olur ve bir çip bunu doğrular, örneğin *"Primary is now Vivid Violet"*, rengi ayarlamak için **Fine-tune** ile.


### Palet büyüdükçe

Renkler geniş ekranda bir **In context** önizlemesinin yanında, daha küçük ekranda üstünde durur. Önizleme paletinde bir poster, grafik veya arayüz kartı gösterir. Starter renkler kendi katlanan gruplarında kalır; sistemin kendi renkleri olunca grup katlanır ve yapıştırma ve bırakma alanı tek kompakt bir satıra dönüşür. Export çubuktaki **Export** düğmesinde ve Tokens odasında durur, bu yüzden odanın başlığında export yoktur.

![Lolly Demo üzerinde Colours odası: katlanan gruplarda palet, adı ve hex değeriyle her renk ve başlıkta palet indirmesi](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-roles-fold%5D%3Esummary%3Bwait%3A500&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

![Bir renk eklendikten sonra Lolly Demo üzerinde Colours odası: Colour roles tablosu, ardından yeni rengin Use as Lead? ve Fine-tune sunan çipi, canlı bir kompozisyon önizlemesinin yanında](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

### Colour roles: renklerin adı ne

Tasarım sistemi renklerinin adının ne olduğunu ve her birinin ne işe yaradığını söyler; Lolly bunu okur. **Colour roles** Colours odasının başında durur. Geniş ekranda **In context** görünümü paylaşır, bu yüzden bir değişiklik sen yaparken poster, grafik ve arayüz kartında görünür.

![Wefthouse üzerinde, uydurma bir tekstil markası, kendi sözcükleriyle Colour roles tablosu: colourway çipleri Indigo, Madder ve Weld, ardından Main, Accent, Supporting ve Tertiary; her birinin açık ve koyu rengi var ve sırasıyla ana renk, ortak rengi ve yalnızca adıyla okunuyor; tablonun altında hiçbir rolün doldurmadığı okumalar olarak Background, Text, Quiet text ve Hairlines listelenmiş](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&system=wefthouse&width=2720&height=2000&dpi=192&waitMs=1800&cropSelector=%5Bdata-be-roles-fold%5D&format=svg&walker=1&dark=1&filename=bs-colour-roles)

Tablonun dört sütunu vardır ve telefonda her satır, açık ve koyu değeri yan yana tutan bir karta dönüşür:

| Sütun | Ne tutar |
|---|---|
| **Role** | Tasarım sisteminin kendi sözcüğü, yerinde düzenleyebilirsin; ayrıca rengin ne işe yaradığını söyleyen bir satır |
| **Light** ve **Dark** | Seçili colourway için o görünümdeki renk, adı veya değeri ve kontrastı |
| **Lolly reads this as** | Bir aracın rolle ne yaptığı, Lolly'nin kendi sözcükleriyle |

**Lolly bir rolü nasıl okur.** Her okuma bir rol alır, bu yüzden başka bir rolün tuttuğu bir okumayı seçmek o okumayı buraya taşır. Lolly anlamı asla bir sözcükten çıkarmaz.

| Okuma | Ondan ne çıkar |
|---|---|
| **Lead colour** | Büyük şekiller, düğmeler, bir aracın öne çıkardığı renk |
| **Partner colour** | Bir aracın ikinci olarak seçtiği renk |
| **Background** | Her şeyin arkasında durur |
| **Text** | Başlıklar ve gövde metni |
| **Quiet text** | Alt yazılar ve küçük yazı |
| **Hairlines** | Çizgiler, kenarlıklar ve ayırıcılar |
| **By name only** | Hiçbir araç rolü kendiliğinden seçmez. Her renk alanında ve Design'da sunulur; orada seçim bağlı kalır, bu yüzden colourway'i izler |

Hiçbir rolün doldurmadığı bir okuma tasarım sisteminin tanımladığı gibi kalır ve oda bunları tablonun altında listeler. Bir okumanın kendi kimliğini paylaşan bir rol, örneğin Primary adlı bir rol, o okumadır ve taşınamaz.

**Değerler.** O rol için, o görünümde, seçili colourway'de bir renk seçmek için bir değere bas. **Same as light**, kendi rengini seçene kadar koyu değerin açık değeri izlemesini sağlar. **Aa** çipi Lolly'nin o rengin üstüne koymak için seçtiği metni gösterir ve değerin altındaki satır bu metnin görünüm başına nasıl okunduğunu söyler: **Text reads well**, **Large text only** veya **Hard to read as text**. Bu, renk üzerindeki metinle ilgilidir ve rengin kendisi aleyhine bir şey söylemez; renk yine şekiller ve büyük alanlar için işe yarayabilir. Yalnızca adıyla okunan bir rol aynı sözcükleri uyarı rengi olmadan gösterir, çünkü hiçbir araç üstüne kendiliğinden metin koymaz. Sözcüklerin arkasındaki rakamlar, önce APCA sonra WCAG, ipucunda ve seçicide durur. **Own text colour**, dosyası metin rengini belirten ve bu yüzden kalan bir değeri işaretler. **Copied**, başka bir colourway'den veya ortak renkten gelen ve kimsenin henüz seçmediği bir değeri işaretler; seçicideki **Keep this colour** değeri sabitler.

**Başlangıç noktaları.** Kendi rolü olmayan bir tasarım sistemi bugünün sözcüklerini gösterir: Primary, Secondary, Surface ve Text. Sen birini değiştirene kadar hiçbir şey yazılmaz. **+ Add a role**, öneri olarak **Primary, Secondary** veya **Main, Accent, Supporting, Tertiary** sunar, ayrıca yazdığın her sözcüğü, her birinin alacağı okumayla birlikte. İlk iki sözcük ana renk ve ortak renk olur. Araçlar aynı renkleri çizmeye devam eder ve tek ana renkli bir sistemde ilk colourway o rengin adını alır.

**Yeniden adlandırma, yeniden sıralama, kaldırma.** Yeniden adlandırma yalnızca sözcüğü değiştirir, bu yüzden rolü kullanan her şey çalışmaya devam eder. Bir rolü tutamacından sürükle ya da tutamaçta Space'e bas, ok tuşlarını kullan ve bırakmak için Space'e bas. **Remove** rolü hâlâ neyin kullandığını söyler. Araçlar rolü okuyorsa **Remove and keep those colours** her okumayı şimdi çizdiği renkle bırakır. Rolü kullanan bir marka kuralı, bir kılavuz grubu, bir araç alanı veya başka bir token, o kullanım değişene kadar rolü tutar. Kaydedilmiş bir Design belgesi de bir rolü adıyla kullanabilir ve Lolly bunu token dosyasından göremez: bunu yapan bir belge rengi çözülmemiş olarak bildirir.

**Elle yazılmış bir dosya.** Bir token dosyasının tuttuğu ve hiçbir rolün bildirmediği renkler, her biri bir sözcük alanı ve **Make a role** ile **In this file, with no role yet** altında listelenir. Her iki durumda da adıyla çalışmaya devam ederler. Adında rakam olan bir token rol olamaz, bu yüzden dosyada kalır ve yoluyla çalışmaya devam eder. Dosyada doğrulanamayan bir kayıt, tabloyu denetimsiz gösterir ve nedenini söyler.

**Odanın geri kalanı aynı sözcüklerle konuşur.** Çipler, renk örneğinin **Use as** satırı ve paletin **Colour roles** grubu tasarım sisteminin sözcüklerini kullanır ve bir renk rolünün karosu değerini açar. Dışa aktarılan dosyalar roller hakkında yeni bir şey kaydetmez: bir render'daki renkler token'lar değiştiği için değişir.

**Sözcükler nereye gider.** Sözcükler ve açıklamalar tasarım sistemiyle birlikte taşınır. Ajanlar bunları tasarım özetinde, `lolly://tokens` içinde ve bir marka sayfasının `AGENTS.md` dosyasında okur, terminal bunları `lolly system status` içinde gösterir ve bir marka sayfası bunları `brand.json` içinde listeler ve her rol için bir kontrast çifti ölçer. Her dışa aktarma biçimi sığdırabildiğini tutar: DTCG ve Tokens Studio dosyaları her şeyi tutar, `DESIGN.md` sözcükleri ve okumaları tutar ve bir PowerPoint teması yalnızca markanın sırasını tutar. [Colour roles in other formats](/info/design-tokens.html#colour-roles-in-other-formats) tam listeyi içerir. Sözcükler her zaman tasarım sisteminin verisi olarak alıntılanır, asla talimat olarak okunmaz.

**Bir rengin seçildiği yer.** Bir araçtaki ve Lolly Design'daki her renk alanı, tasarım sisteminin rolleriyle, kendi sırasıyla ve her sözcük ile rengin ne işe yaradığı görünür olarak başlar. Bir rolün yanındaki **Aa**, o rolün üstünde duran rengi seçer. Gerisi **Other colours** altında gelir; bir colourway'in kendi kopyaları, üstteki renkler ve bir rolün zaten doldurduğu okumalar olmadan. Bir seçim role bağlı kalır ve colourway'i izler, alan hangi colourway seçilirse seçilsin sözcüğü göstermeye devam eder ve Settings ile Tokens da sözcüğü kullanır. Rolü olmayan bir tasarım sistemi her zaman sahip olduğu renk örnekleri ızgarasını korur.

### Bir aracın okuduğu her renk

**Colour roles** kapalıyken ilk kararlar odanın başında çipler olarak durur; her biri rolü oynayan rengi ve adını gösterir. Kendi sözcükleri olmayan bir sistemde bunlar **Primary**, **Secondary**, **Surface** ve **Text**'tir. Rengini paletin kendi renk örneklerinden seçmek için bir çipe bas. **Colour roles** altındaki **Every colour a tool reads** tam şeridi içerir.

Şerit, bir aracın okuyabileceği yedi rengi gösterir: Primary, Secondary, Surface, Text, Muted, Edge ve On primary; tasarım sisteminin kendi sözcükleri varsa onlarla. Her biri her araçta ve dışa aktarmada aynı rolü oynar. Hiçbirinin ayarlanması gerekmez (üç serbest renk iyi bir sistem olur), her renk birini doldurabilir ve kontrast göstergesi yüzeye karşı ölçülür, önce APCA. Her satır tam güçte kendi bir rengi, yerine geçen bir starter rengi veya **↳ follows Primary** gösterir.

On primary birincil renkten türetilir, **Derived** yazar ve seçicisi yoktur. Yanındaki **Light** ve **Dark** anahtarı ile **In context** yanındaki anahtar, şeridin, paletin ve önizlemenin hangi görünümü göstereceğini seçer.

Uygulamanın kendi vurgusu varsayılan olarak tasarım sistemini izler. Bu, **Settings → Appearance** içindeki **Interface follows the design system** ayarıdır; ayarı kapatmak uygulamanın arayüzünü nötr bırakır, araçlar, tuvaller ve dışa aktarmalar iki durumda da tasarım sistemini izler.

**Colourways.** Bir tasarım sistemi, her biri parça başına seçilen birkaç öncü renk tutabilir. **Colour roles** başındaki **Colourways** satırı her colourway için bir çip gösterir; kurallı olanda **Default** yazar. **+ Add**, paletin renklerinden birinden yeni bir colourway başlatır. Bir çip seç; tablo, şerit, palet ve önizlemeler o colourway'i gösterir; seçili colourway yeniden adlandırılabilir, çoğaltılabilir, varsayılan yapılabilir veya kaldırılabilir. Colourway'li bir sistemde her colourway'in kendi birincil ve ikincil rengi ve colourway'ler arka planı tonladığında kendi yüzeyi gerekir; bu yüzden bu roller renk örneği düzenleyicisinde ayarlı kalır. [Add colourways to a design system](/info/colourways.html#add-colourways-to-a-design-system) adımları ve token biçimini içerir, [Lolly Demo in use](/info/lolly-demo-in-use.html#colourways-on-real-work) ise gerçek işlerde colourway'leri gösterir.

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

Palet renklerini, her birinin kendi **+ Add** düğmesi olan katlanan gruplarda listeler. Grupları istediğin gibi oluştur ve yeniden adlandır. Bir rol hiçbir zaman ikinci bir karo üretmez: bir rolün işaret ettiği karo bunun yerine rolün adını taşır, örneğin **Primary**. Karoların altındaki **Colour chart** aynı renkleri OKLCH **Wheel** üzerinde (bir noktayı sürükleyerek yeniden renklendir, boş bir yere tıklayarak renk örneği ekle) ve görüntülenebilir aralığın nerede bittiğini gösteren **Gamut** grafiğinde gösterir. `#/start?area=color&focus=chart` grafiği doğrudan açar.

![Palet bölmesi, her grup katlanabilir, palet indirmesi başlığında](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-roles-fold%5D%3Esummary%3Bwait%3A500%3Bclick%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![OKLCH çarkı - açı ton, dıştaki mesafe doygunluk ve griler yan tarafta bir açıklık rayında ilerliyor](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

Düzenleyicisini açmak için bir örneğe tıkla:

- Renk örneğini **yeniden adlandır**.
- Rengi OKLCH kaydırıcılarında ya da **Hex**, **HSL**, **RGB** veya **CMYK** ile **ayarla**. Değer alanı etkin uzayda okur ve yazar. Buradaki CMYK ekran rengini dönüşümle ayarlar; tam mürekkepleri sabitlemek için **Print substitutes** kullan.
- **Stored as** renk örneğinin nasıl kaydedileceğini seçer: **LCH** (varsayılan, algısal ve geniş gamlı), Hex, RGB veya HSL.
- **Use as** renk örneğine doğrudan bir rol verir; tasarım sisteminin kendi sözcükleri varsa onlarla. Rolü temizlemek için vurgulanmış bir role yeniden bas.
- **Print substitutes** (katlanmış): **CMYK**'yi **Auto**'dan tam mürekkep değerlerine kilitle ya da bir **Name** (örneğin `PANTONE 186 C`), isteğe bağlı bir **Book** ve folyo, kabartma, çukur baskı, nokta vernik, yumuşak dokunuş ya da bıçak, kırım veya perforaj için bir **Finish** ile bir **Spot colour** ayarla. Bir baskı makinesi bu kilitleri bir CMYK PDF veya TIFF dışa aktardığında kullanır; bkz. [Colour profiles](/info/exporting.html#colour-profiles).
- **In other spaces** (katlanmış): renk uzayı başına bir değer, türetilmiş ya da senin yazdığın; senin yazdığın dışa aktarmada kazanır.

**Bir örneği silmek** güvenlidir. Türetilmiş tonlar ve tema rolleri gizlenir; böylece onları okuyan hiçbir şey bozulmaz, eklediğin renkler ise kaldırılır.

::: details Birçok örnekle çalışmak
Her örneğin bir sürükleme tutamağı vardır. Bir grup içinde yeniden sıralamak için sürükle ya da tutamağa odaklan, Space'e bas, ok tuşlarını kullan ve bırakmak için yeniden Space'e bas; Escape iptal eder. Telefonda palet satır başına dört renk gösterir ve tutamaklar her rengin altında bir satır olarak değil, Select modunda görünür. Renkleri gruplar arasında taşımak için düzenleyicinin **Group** denetimini kullan ya da birkaçını seç ve **Move to** kullan.

Seçim için ayrı bir anahtar gerekmez. Çubuk ve onay kutuları ilk seçili karoyla görünür ve sonuncusuyla kaybolur.

- **Boş alanda sürükle** bir dikdörtgen çizmek için; dokunduğu her karo gruplar boyunca seçime katılır. Katlanmış bir bölüm hiçbir şey eklemez.
- **Shift ile tıkla** okuma sırasında bir aralık alır, **Cmd/Ctrl ile tıkla** bir karoyu açıp kapatır ve düz bir tıklama düzenleyiciyi açar.
- Her grup başlığında **Select all** vardır ve bir karo odaktayken **Cmd-A** sahip olduğun her rengi alır, asla bir starter rengi değil.
- Izgaranın tek bir sekme durağı vardır: oklar gezdirir, Shift-oklar genişletir, Space açıp kapatır, Delete kaldırır ve Escape temizler. Bir kanalı hafifçe oynatmak için önce `l`, `c` veya `h` tuşuna bas.
- Dokunmatik ekranda bir seçim başlatmak için bir karoya basılı tut, sonra eklemek için dokun.

Çubuk **{n} selected** yazar, sonra **Move to**, **Give a role** (her renk sırayla bir sonraki rolü alır), **Download** (seçim, altı palet biçiminden herhangi birinde), **Duplicate** (her birinin, orijinalden sonra yerleştirilen bir kopyası), **Copy values** ve **Delete**. Tek bir kopya doğrudan düzenleyicide açılır; birkaçı seçili kalır. Tek bir Cmd/Ctrl-Z toplu bir eylemin tamamını geri alır.
:::

### Gradyanlar

İsteğe bağlı **Gradients** paneli paletten karışım token'ları kurar. Her gradyanın bir önizlemesi, 2 ila 8 adlandırılmış durağı ve bir açısı vardır. Bir durak bir örneği işaret eder; örneği yeniden renklendirirsen gradyan izler. Karışımlar OKLCH içinde çalışır.

Palet indirmeleri (tasarım token'ları, CSS, SCSS, GIMP ve Adobe Swatch Exchange) tonlar olduğunda paletin başında, başlığının yanında durur. [Take your palette and fonts anywhere](/info/using.html#take-your-palette-and-fonts-anywhere) her biçimi anlatır.

## Tip

Kendi yazı tipi olmadığında oda tek bir karttır: bugün onu sunan yazı tipiyle okuma boyutunda ayarlı **Primary**, bir **Starter** etiketi, bir **Choose for Primary** düğmesi ve *"Nothing installs until you choose one."* satırı. Headings, code ve italic sen seçene kadar birincili izler; **Choose them separately** kartlarını gösterir.

![Henüz bir yüz seçilmemiş Type odası - okuma boyutunda bir kart, üzerinde bir Starter etiketi ve dolu bir Choose for Primary](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&system=new-design-system&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

Bir yazı tipi seç ve oda dört rol kartına, Fonts listesine ve canlı bir örneğe açılır:

- **Primary**: gövde metni, düğmeler ve her araç.
- **Headings**: `h1` ve `h2` için görüntüleme yazı tipi.
- **Code**: kod ve veri için tek aralıklı bir yazı tipi.
- **Italic**: vurgu, alıntılar ve yan notlar için gerçek bir italik.

Bir kart yalnızca o yazı tipini kurduğun yerde tonludur. Düğmesi hangi rol için olduğunu söyler: kendi yazı tipinde **Change Headings**, her yerde **Choose for Headings**. Örnek satır kesilmek yerine sarılır. Bir karttaki hiçbir şey bir şey uygulamaz: düğme o rol için karşılaştırma sahnesini açar.

![Ortaya çıkan dört rol kartı - her biri kendine hizmet eden yüzde ayarlanmış, kimsenin seçmediği yerde bir Starter etiketiyle ve İtalik'in Birincili izlemesiyle](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&system=new-design-system&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

### Karşılaştırma sahnesi

Sahne odanın içinde, bastığın kartın altında açılır ve kartlar tek satırlık bir şeride katlanır; böylece sahne bir telefonun ilk ekranında görünür. Escape iptal eder ve odağı karta geri verir.

1. Kartta **Choose for** ve rol düğmesine bas.
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
- **Karolar**, her token türünü sayar ve bölümüne atlar: Colours, Type, Logos, Shape and spacing, More ve All tokens. Her bölümün tuttuğunu sayarlar; yalnızca boş starter ile gelen malzemeyi tutan bir bölüm **Starter** etiketi taşır, uygulamayla gelen bir sistem ise kendi malzemesini etiketsiz sayar. Telefonda karolar üç karolu iki satıra sarılır.
- **Colours**, araçların bir araya getirdiği çiftlerle (yüzeyde metin, birincilde, yüzeyde soluk) açık ve koyuda bir APCA göstergesiyle başlar ve bir çift yetersiz kaldığında **Weak contrast** işaretler. Sonra her renk grubu: bir satır çip olarak rampa, değeri ve araçların kullandığı başvuruyla diğer renkler; örneğin `{color.brand.spearmint}`. Başvuruyu kopyalamak için bir başvuruya bas. **Edit in Colours** bir grubu Colours odasında açar. [Renk rolleri](#colour-roles-what-the-colours-are-called) olan bir tasarım sisteminde önce **Colour roles** gelir; her rol sistemin kendi sözleriyle ve sırasıyla bir kez yer alır. Bir rol her renk varyantı ve görünüm için bir renk tutar; bu renkler kendi başlarına renk olarak görünmez, rolle kalır: bunları Colour roles tablosunda değiştir.
- **Type** ve **Logos**, kendine ait olanlar olduğunda **Edit in Type** ve **Edit in Logos** ile her rol ve her logo yuvası için yazı tipini listeler.
- **Shape and spacing**, **Rounded corners** (`shape.radius`) ve **Spacing rhythm** (`space.base`) tutar. Her biri sürgüyü oynatana kadar *Lolly default*, sonra *Yours* okunur, hemen kaydeder ve geri alınabilir.
- **More tokens**, standart [tasarım token'ları](/info/design-tokens.html) olarak saklanan aralık, boyutlandırma, çizgi kalınlığı, opaklık, döndürme, düz sayılar ve gölgeler ekler.
- **App appearance (advanced)**, Lolly'nin kendi ekranlarının kullandığı renkleri, boyutları ve gölgeleri listeler ve **Inspect every token (advanced)** her değişikliği önce inceleme için göstererek saklanan her değeri arar ve düzenler. Orada bir renk rolünün her renk varyantındaki değerleri rolle birlikte listelenir: renk varyantı başına bir satır görmek için rolün token'ını seç; açık ve koyu yan yana durur, sayı satırı da rollerin kaç değer tuttuğunu söyler. Salt okunur bir tasarım sistemi aynı listeyi gösterir.

İçinde hiçbir şey olmayan bir bölüm boşluğu doldurmanın yolunu sunar: **Pick a colour**, **Choose a face** veya **Add a logo**.

## Dosyalar

Markanın tuttuğu dosyaları, logolar dışında bırak: **vector**, **image**, **audio** ve **motion** dosyaları (video, Lottie ve animasyonlar). [Assets](/info/using.html#assets-your-library) içinde bölümlere ayrılmış olarak görünürler, her aracın varlık seçicisinde hazırdırlar ve bu cihazda kalırlar.

## Rules

**Rules**, markanın seçimlerini işe koşar: insanların neyi değiştirebileceği, neyin sabit kaldığı ve Lolly'nin neyi denetleyebileceği.

![Lolly Demo üzerinde Rules: her biri Checked in Design ve Required ya da Advisory olarak işaretlenmiş dört marka kuralı, ardından örnekleri render edilmeye hazır Try your design system in use](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dusage&width=1440&height=1200&dpi=192&waitMs=2400&cropSelector=%23start-panel-usage&format=svg&walker=1&dark=1&filename=bs-usage-rules)

**Brand rules** kurallarını listeler. **Add rule** (veya **Add your first rule**) kısa bir form açar:

- kendi sözcüklerinle bir **Rule name**, örneğin *Beacon accents*;
- **Check**: **Colour choices**, **Font choices**, **Fixed artwork** veya **Text length**; kullandığı marka rolüyle, rol için kendi adınla;
- uygulandığı **Example** (Poster, Title slide, Content slide veya Lolly Chart), **Mode** ve **Required** mi **Advisory** mi olduğu;
- **Reviewed by**, ardından **Save draft** veya **Approve & save**.

Onay, bu cihazdaki kendi kararını kaydeder. Onaylı zorunlu kurallar yeniden kullanılabilir posteri kısıtlar ve denetimler yalnızca örnek PNG'leri kapsar; başka hiçbir aracı değiştirmezler.

Bir tasarım sisteminin token dosyasında getirdiği kurallar, örneğin onaylı renk eşleşmeleri, metin ağırlığı ve hizası ya da yüzey başına bir logo, burada **Checked in Design** olarak listelenir. Lolly Design bunları dışa aktarma panelinin **Before you export** kartında katman katman denetler ve `lolly check` kaydedilmiş bir Lolly Design belgesi için aynısını yapar ([Before you export](/info/design.html#before-you-export)). Bu derlemenin denetleyicisi olmayan bir kural, verildiği gibi tutulur ve **Unchecked** olarak işaretlenir.

Lolly Demo dört onaylı marka kuralıyla gelir. Başlıklar asla büyük harfle yazılmaz: bu kural zorunludur, bu yüzden `lolly check` büyük harfli bir başlığı hata olarak bildirir. Diğer üçü tavsiye niteliğindedir. Gövde metni sola hizalıdır. Birincil işaretler açık yüzeylere, ters işaretler koyu yüzeylere konur. Kesikli çizgiler buraya bırak demektir.

**Try your design system in use**, **Render & check examples** ile geçerli revizyondan dört örneği render eder. Bir **Mode** ve başlık, destekleyici metin ve slayt metni için **Try your own text** seç. Her örnek ölçülenleri **See checks & sources** ve **Download check report** ile bildirir ve **Make reusable poster**, sabit düzeni ve onaylı girdi seçimleri dosyayla birlikte taşınan bir `.lolly` indirir. Örnekler yereldir: bir denetim çalıştırmak hiçbir şeyi yayımlamaz ya da onaylamaz.

Sabit bir markayla gelen bir derleme, aynı kuralları ve örnekleri salt okunur olarak *This brand is set* altında gösterir.

## Skills

**Skills**, etkin tasarım sisteminin [marka becerilerini](/info/brand-skills.html) listeler: markanın insanlar ve yapay zeka ajanları için, her disiplin başına bir tane yazılı standartları. Her satır disiplini, markanın kendi durumunu (**Taslak** veya **Onaylandı**), becerinin herkese açık mı yoksa dahili mi olduğunu ve revizyonunu verir. Becerinin satırlarını token'larınla karşılaştıran kapsamının yanında okumak için bir satır seç: Lolly'nin neyi denetlediği, neyin çeliştiği, neyin uyduğu ve neyin yalnızca rehber olduğu.

**Beceriyi indir (.zip)**, beceriyi bir ajan aracı için Agent Skills klasörü olarak yazar; katalog bağlantıları bu Lolly'yi gösterir. **Tek dosya olarak kopyala** aynı metni bir sohbet penceresi için panoya koyar. Kendi becerisi olmayan bir tasarım sistemi, Lolly'nin taban çizgisi her okunduğunda token'larından ve ev kurallarından yazdığı bir taban çizgisini listeler. Oda becerileri okur ve asla düzenlemez.

## Bir marka getir

Çubuktaki **Add from…**, biçimin ne olduğunu değil elinde ne olduğunu soran bir seçici açar:

- **Design tokens or a design file**: DTCG veya Tokens Studio JSON, bir Penpot projesi, token setlerinden oluşan bir zip, bir Lolly tasarım sistemi paketi, bir SVG, bir `DESIGN.md` veya bir marka sayfası klasörü.
- **PDF**: bir sunum veya yönerge dosyası; renkleri, işaretleri ve gömülü yazı tipleri için bu cihazda okunur.
- **Logo or screenshot**: bir görsel, bu cihazda okunan önerilmiş bir palete dönüşür. Renkleri okur; yazı tipini veya düzeni okumaz.
- **Saved web page**: bir HTML dosyası ve CSS dosyaları ya da yapıştırılmış HTML veya CSS, en fazla 20 dosya ve 2 MB. Yalnızca verdiğin metin okunur: bağlantılı kaynaklar getirilmez ve betikler çalışmaz.
- **Font file**: TTF, OTF veya WOFF. Yazı tipinin kurulduğu Type odasını açar.
- **Website**: bir sayfa, renkleri ve yazısı için okunur. Bu kutucuk yalnızca bir sayfayı okuyabilen cihazda görünür ve hangi okuyucuyu kullandığını söyler: bu cihazdaki uygulama ya da arka plan sekmesinde, senin adına oturum açmış tarayıcı uzantısı. Bir URL yazmak yalnızca alanı doldurur; getir düğmesine basmak onaydır.

Tasarım dosyası kaynağını seç; sonraki kart kabul edilen biçimleri simge karoları olarak listeler ve kartın tamamı tek bir bırakma hedefidir. Bir dosyayı doğrudan stüdyonun üzerine de bırakabilirsin.

![İçe aktarma kartı - kabul edilen biçimler simge kutucukları olarak öne çıkar ve bütün kart tek bir bırakma hedefidir](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

- Bir **Lolly design-system pack** (`.lolly` veya eski bir `.zip`) tek adımda kurulur.
- Bir **Penpot** dışa aktarması (`.penpot`) tasarım token'larını getirir.
- Bir **Design Tokens** (W3C DTCG) veya **Tokens Studio** dosyası (`.json`) token'larını getirir. Bir okuyucudan talimatları yok saymasını isteyen, izinler iddia eden ya da kod çalıştırmasını isteyen bir açıklama dışarıda bırakılır ve içe aktarma nerede durduğunu söyler. Bu satır satır bir denetimdir ve başka ifadeleri kaçırır, bu yüzden token'ları uygulamadan önce tanımadığın birinden gelen bir dosyayı oku.
- Bir **plain SVG**, aralarından seçeceğin renkler için taranır ve ilki birincil rengin olur.
- Bir **`DESIGN.md`** (`.md`) token'ları yazıldığı gibi **Try these colours** ekranına gider. Düzyazısı taslak bir marka becerisi olarak tutulabilir ve kart, bir okuyucudan talimatları yok saymasını, izinler iddia etmesini ya da kod çalıştırmasını isteyen satırları işaretler. Ajanlar ve marka sayfaları, sen Skills odasında **Keep this skill** düğmesine basana kadar bir taslağı görmez ve tutulan bir beceri dahili kalır.
- Klasör olarak seçilen, bırakılan ya da zip'lenen bir **brand page folder** aynı incelemeye gider. Her dosya klasörün `brand.json` dosyasına karşı denetlenir ve eşleşmeyen biri tüm klasörü reddeder. Token'ları ekler. Logolar ve yazı tipleri klasörde kalır.

Lolly bir marka sayfasını senin verdiğin dosyalardan okur. Başka bir sitenin adresini getirmez.

### Kendi renk sözcükleri olan bir dosya

Bir token dosyası veya bir `DESIGN.md`, renkleri için kendi sözcüklerini, örneğin main, accent, supporting ve tertiary, kullanabilir. Lolly bu tür sözcükler bulduğunda, inceleme hiçbir şey uygulanmadan önce her birini listeler: sözcük, her görünümdeki rengi, geldiği token ve Lolly'nin onu neyin olarak okuyacağı. Lolly bu okumaları yalnızca sözcüklerden, kısa bir listeye karşı önerir ve model kullanmaz. Listede olmayan bir sözcük markanın kendisininki olarak, **By name only** ile gelir. Herhangi bir sözcüğü yeniden adlandır, ne işe yaradığını söyle, başka bir şey olarak oku ya da adlandırılmış bir renk olarak bırakmak için işaretini kaldır.

**Install with these roles** bunları yazar ve **Install without roles** dosyayı geldiği gibi kurar. Böyle sözcükleri olmayan bir dosya yeni bir adım göstermez. Kendi rollerini belirten bir dosya, örneğin Lolly'nin yazdığı biri, bunları yazıldığı gibi gösterir ve değiştirmeden kurar; sonradan Colours odasında düzenleyebilirsin. Terminalde inceleme yoktur, bu yüzden `lolly system import` belirtilmiş bir kaydı korur ve diğer dosyaların sözcüklerini adlandırılmış renkler olarak bırakır.

### Bir başvuruyu incele

Bir logo, ekran görüntüsü, web sitesi veya kayıtlı sayfa **Try these colours** açar: önerilen renklerde bir örnek, değiştirebileceğin bir **Main colour** ve yeni bir sistem için bir ad. Bir kutu uygulamanın ne yaptığını sıralar: etkin token ayarlarını oluşturulan palet ve varsayılan stillerle **değiştirir**, yazı tiplerini ve kitaplık dosyalarını **korur** ve önceki sistem **kurtarılabilir**. **Apply suggested settings**, bir kontrol noktasından sonra açık ve koyu paletleri uygular ve **Restore brand settings** eski ayarları geri getirebilir. **Change reference** başka bir kaynak seçer.

**Palette, source details and individual choices**, nelerin okunduğunu, bulunan yazı tipi adlarını ve önizlemenin kontrastını gösterir. Yazı tipi adları yalnızca öneridir; yazı tipini kurduğun yer yine Type'tır. Kaynak ayrıntıları, gözlemlenen yerde tipografiyi, boşlukları, dolguyu ve köşe değerlerini içerebilir; aksi hâlde **Not observed** etiketlenir. Kayıtlı bir sayfa veya yerel bir web sitesi okuması, sayfanın kullanmayabileceği bildirilmiş stilleri bildirir ve tarayıcı uzantısı görünür öğelerden bir örnekten ölçülmüş stilleri bildirebilir. Bunlar gözlemlerdir: hiçbir şey kurulmaz ve kaynak aralığı asla seninkinin yerini almaz. **Choose individual items in the tray** tek tek öğeleri tutar ve **Download design context** gözlemlerin, önerilen token'ların ve kaynak bilgisinin (sağlanan HTML veya CSS'in SHA-256 değeriyle) bir JSON raporunu kaydeder. Rapor ham sayfa metni içermez ve imzalı bir Content Credential değildir.

PDF ve tasarım dosyası içe aktarmaları kendi inceleme denetimlerini korur. **Tray** içindeki öğeler, o tür malzemenin sahibi odada ekleyene kadar hiçbir şeyi değiştirmez. `#/start?source=<kind>` seçiciyi bir kaynakta açar (`file`, `pdf`, `image`, `font`, `url`, `page`) ve `?import` düz listeyi açar.

### Bir görünüm bul ve karşılaştır

Board'dan ya da Settings'teki tasarım sistemi listesinden **Find a look** aç. Bu cihazda kayıtlı sistemlere ve birkaç yeniden kullanılabilir Lolly örneğine göz at ve ada, renk etiketine veya bildirilmiş yazı tipine göre ara. **Closest to my current palette**, ölçülen renk benzerliğine göre sıralar; eşleşen yazı tipleri beraberlikleri bozar; bir kalite puanı değildir.

Bir görünümü bağlam içinde önizlemek için ona tıkla. Önizleme hiçbir şeyi değiştirmez. Her kartın **Use this look** düğmesi o görünümü kullanır. Kaydedilmiş bir sistem etkin olan olur; bu hiçbir şeyi düzenlemez. Bir örneğin renkleri, olağan kontrol noktasından geçerek açık tasarım sistemine girer; sistemin logoları, yazı tipleri ve örneğin tanımlamadığı her şey olduğu gibi kalır. **Compare looks** her karta bir onay kutusu ekler, böylece ikisini seçip yan yana karşılaştırabilirsin. **Restore brand settings** önceki görünümü geri getirir. Kaydedilmiş sistemlerin **Details and design context** altında düzenlenebilir **Search tags** alanı vardır. Örnekler özgün Lolly renk tarifleridir; kazınmış bir koleksiyon ve hesap yoktur.

![Herhangi bir renk sistemini uygulamadan önce Sunroom ve Orchard'ı yan yana karşılaştır.](/t/url-shot?url=%2F%23%2Fstart&width=1280&height=900&dpi=96&waitMs=3000&format=svg&filename=brand-compare-looks&try=1&drive=click%3A%5Bdata-ds-door%3D%22looks%22%5D%3Bwait%3A500%3Bclick%3A%5Bdata-looks-compare-toggle%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Asunroom%22%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Aorchard%22%5D%3Bclick%3A%5Bdata-looks-review%5D%3Bwait%3A500&cropSelector=.ds-looks-comparison&waitSelector=%5Bdata-ds-door%3D%22looks%22%5D&walker=1&rasterDpi=96)

## Tasarım sistemini sakla ve taşı

### Bir markayı cihazlar arasında taşı

**Export**, tek bir **`LollyBrand-….lolly`** dosyası yazar: token'ların, yazı tiplerin, logoların ve tema tercihin; geri girerken denetlenen bir bütünlük bildirimiyle. 1.0.7 öncesi web sürümleri aynı dosyayı `.zip` olarak adlandırıyordu ve bu yazım hâlâ kabul edilir. **Tokens (.json)** düz tasarım token'ları belgesini, yazı tipi veya logo olmadan, bir depo, bir derleme adımı veya başka bir token aracı için tek başına yazar.

Birini geri getirmek için **Add from… → Design tokens or a design file** kullan ya da dosyayı stüdyonun üzerine bırak. Bir meslektaşın sana bir marka bu şekilde verir veya bir markayı ikinci bir kuruluma böyle taşırsın; hesap yok, bulut yok. Markayı alan kişi başka bir kuruluşta çalışıyorsa başka neyin gönderileceğini [Ortaklarla çalışma](/info/partners.html) anlatır. Bir markayı komut satırından getirmek için bkz. [`ingest:brand`](/info/configuration.html#brand-packs).

**Fonts for Linux (.rpm)**, eklediğin yazı tiplerini kurulabilir bir RPM'de paketler. Bunlardan herhangi birini kendin yüklediysen Lolly önce onları yeniden dağıtabileceğini onaylamanı ister.

### Önceki ayarları geri yükle

Çubuktaki **More** menüsünü aç, **Restore brand settings** seç, tarihli bir kontrol noktası seç ve **Restore** düğmesine bas. Etkin marka için renkleri, yazı ayarlarını ve diğer token'ları geri yükler; yazı tipi ve görsel dosyaları olduğu gibi kalır. Lolly önce geçerli ayarlarını **Before restore** olarak kaydeder; böylece tarayıcıyı kapattıktan sonra bile bir geri yüklemeyi tersine çevirebilirsin. En son 20 kontrol noktası bu cihazda tutulur.

### Sürümler

Yayımlanmış bir sürüm, bu cihazda tutulan **kalıcı, adlandırılmış bir kopyadır**. Asla değişmez; bu yüzden onu sabitleyen bir araç veya bağlantı (`designv` ile) aynı şeyi çizmeye devam eder. Kendine ait bir şeyi olan bir sistem, çubuğun **More** menüsünde **Versions & publishing** öğesini listeler; ilk yayımlamandan sonra **Versions** odalara katılır. `#/start?area=versions` onu doğrudan açar.

- **Bir sürüm kalıcıdır.** Henüz silme yok ve panel bunu söyler.
- **Kaldırmalar uyumluluk kartına öncülük eder**, çünkü bir aracı bozan şey kaldırılmış bir token'dır.
- **Yayımlama geri alınamaz; geri yükleme alınabilir.** *Restore latest from this version* sıradan bir düzenlemedir ve hemen **Undo** sunulur.

**Publish only** araçların izlediğini değiştirmeden bir sürümü tutar; **Publish and make active** araçların ve uygulamanın o sürümü izlemesini sağlar. **Follow the latest again**, her düzenlemeyi yaptığın anda yayına alır.

### Bir marka sayfası yayımla

Bir [brand page](/info/brand-page.html) hem insanlar hem ajanlar için tek bir adrestir: logoları, renkleri, yazıyı ve örnekleri gösteren bir sayfa; aynı bilgiler sayfanın yanındaki dosyalarda. Versions & publishing altındaki **Publish a brand page** canlı sayfayı gösterir ve sayfanın yanında şunları:

- **Goes public**: her dosya, gruplanmış, boyutuyla.
- **Held back**: dışarıda kalanlar ve nedeni. Kayıtlı lisansı olmayan bir logo, logonun adını işaretleyene kadar dışarıda kalır. Bir yazı tipi dosyası, başkasına geçirmeye izin veren kayıtlı bir lisans ister ve dosya dışarıda kaldığında sayfa anahatlı bir örnek gösterir. Dahili marka becerileri asla görünmez.
- **What was checked**: colourway ve mod başına renk çiftleri ile marka kuralları. Bunlar ölçümdür, hüküm değil.
- **In your words**: bir kullanım açıklaması ve bir iletişim. Sayfa yazdığını basar ve Lolly hiçbir lisans ya da hukuki iddia eklemez. Bir anahtar, alt bilgideki "Made with Lolly" satırını kapatır.
- **On exports**: [sayfanın adresini bu tasarım sisteminin dışa aktarmalarına kaydeden](/info/brand-page.html#lead-back-from-your-files) bir anahtar. Sen açana kadar kapalıdır, bir `https` adresi ister ve bir paketle ya da kopyayla taşınmaz. Kilitli bir tasarım sistemi anahtarı göstermez, çünkü karar yöneticisine aittir.

**Download folder** klasörü, istediğin yerde barındırman için bir ZIP olarak kaydeder ve sen barındırana kadar hiçbir şey herkese açık olmaz. Bir terminalde `lolly system publish --out=<dir>` aynı klasörü yazar. Marka sayfalarını sunan bir instance ayrıca adresine **Publish to** sunar; bu tek bir açık basıştır ve varsa onay zincirinden geçer. Yönetilen bir tasarım sistemi yalnızca yöneticisi izin verdiğinde yayımlanır.

### Bir ajan bağla

Aynı yerdeki **Connect an agent** sana yapıştıracağın metni verir ve her seçeneğin neler yapabildiğini söyler:

- Bir projedeki **`AGENTS.md`**: ajanlar sistemin adlarını ve kurallarını okur. Hiçbir şey çizmez ve sunucu gerektirmez.
- **Lolly's public server**: burada hangi sistemi açtıysan açmış ol, Lolly Demo ile çizer. Anahtar gerektirmez.
- **Your instance**: instance'ın tuttuğu sistemlerle çizer ve bir hizmet token'ını bir ortam değişkeninden okur. Sayfa değişkenin adını verir ve bir token'ı asla göstermez.

Sistemini hiçbir barındırılan sunucu çizmediğinde sayfa bunu söyler.

## Tasarım sistemlerini yönet

Sistemleri değiştirmek, eklemek veya kaldırmak için **Settings → Preferences → Design systems** aç. **Open** bir sistemi seçer ve burada açar; **Make a new one** yerel bir sistem oluşturur ve ad alanı hazır olarak açar. Aynı anda tüm cihaz için bir sistem etkindir. Bir markanın kendi tasarım sistemine ne zaman ihtiyaç duyduğuna karar vermeye [Brand architectures](/info/brand-architectures.html) yardım eder.

**Bir sistemin nereden geldiği.** Bir dağıtımın kataloğunun sağladığı sistem **Came with this app** ya da bir örneğe bağlı uygulamada **From this instance** okunur. Kimin sağladığını, token varlığını ve ad alanını ve bilinen sürümü veya sağlama toplamını görmek için **Catalogue source** bölümünü genişlet; bir yenileme başarısız olursa önbellekteki malzeme etiketlenir.

**Yönetilen sistemler salt okunurdur.** Kataloğu sistemi kilitlediğinde bir sistem **Managed by this instance** (ya da instance'sız masaüstü uygulamasında **Managed by this app**) yazar. Onu kullanabilir ve indirebilirsin; burada açmak **Make an editable copy** ve **Switch** içeren salt okunur bir not, ardından renk rollerini ve token'larını düzenleme denetimleri olmadan gösterir. Yönetilen sistem önce gelmiş olsa bile kendi yerel sistemlerin düzenlenebilir kalır. Tek bir sabit markalı bir derleme, Lolly Design System Setup'ı markanın token'ları ve kullanım kuralları okunabilir olarak *This brand is set* ekranında açar.

**Sağlanan diğer her sistem** lolly.tools üzerindeki Lolly Demo ve Lolly Starter dahil gizlemek, düzenlemek ve sıfırlamak için **senindir**. Birini düzenlemek adını korur ve satırı **Edited here** olarak işaretler ve menüsündeki **Reset to original** bu cihazda yapılan değişiklikleri atar. Boş starter istisnadır: oradaki ilk değişiklik kendi tasarım sistemini başlatır, bu yüzden Lolly yeni sisteme ne ad vereceğini bir kez sorar. Kendi sisteminin neyin yerini aldığını [Lolly Demo in use](/info/lolly-demo-in-use.html#switch-to-your-own) gösterir.

### Bir tasarım sistemini kaldırma

Bir sistemin menüsünden **Remove** seç; onay, sonrasında hangi sistemin etkin olacağını söyler. Kayıtlı oturumlar, yüklemeler ve başka bir sistemle paylaşılan malzeme kalır.

Sağlanan bir sistemi kaldırmak onu yalnızca gizler: katalog varlıkları kalır, **Bring back** onu yeniden gösterir ve diğer her şeyi kaldırırsan kendiliğinden geri döner. İçe aktarılmış veya düzenlenmiş bir kopyayı kaldırmak sağlanan sistemi, logolarını veya yazı tiplerini kaldırmaz ve kopya etkinse sağlanan sistem yeniden etkin olur. Etkin barındırılan bir kopyayı kaldırmak yalnızca o kopyanın bağlantısını temizler; ayrıca seçilen bir örnek seçili kalır.

Bir sunucunun sağladığını değiştirmek bir yönetici işidir: operatörü kaynak kataloğu değiştirir ve yeniden dağıtır ya da bir Lolly Work yöneticisi bir sunucu değişikliğini inceler ve uygular. Buradaki düzenlemeler yerel kalır, tek bir istisnayla: sana `brand.edit` veren bir Lolly Work instance'ında yönetilen bir sistem ayrıca o instance için **Edit for** sunar; bu bir düzenleme kopyası açar ve **Versions** içindeki **Send to** renklerini, colourway'lerini, renk rollerini ve marka sayfası adresini instance'a geri gönderir. [Edit this instance from the studio](/info/work-design-system-administration.html#edit-this-instance-from-the-studio) bir düzenlemenin neyi değiştirebileceğini ve instance'ın değişikliği nasıl sunduğunu kapsar. Bkz. [Removing a catalogue design system](/info/configuration.html#removing-a-catalogue-design-system) ve [Configuration](/info/configuration.html#supplied-and-local-design-systems).

## Tasarım bağlamını uygulamanın dışında kullan

**Download design context** token belgesini, çözülmüş renkleri, bildirilen yazı tipi ailelerini, varlık kimliklerini, kaydedildiği yerde kaynak kanıtını, kapsamı ve açık kuralları kaydeder; yazı tipi dosyası ve sahiplik kanıtı yoktur. Komut satırı dosyayı sunucusuz okur: `lolly system import` onu terminalin tasarım sistemi yapar ve `lolly system check` Lolly Design girdilerini kaydedilmiş bağlama karşı denetler. [Bring your design system](/info/cli.html#bring-your-design-system) içe aktarmayı, [Which design system a command uses](/info/cli-decks.html#which-design-system-a-command-uses) denetimi kapsar ve bir MCP istemcisi aynı özeti `lolly://design-context` üzerinden okur ([MCP Server](/info/mcp.html)).

## Bundan sonra nereye

- **[Using Lolly](/info/using.html)**: araçlar, kaydetme, paylaşma ve Assets.
- **[Marka mimarileri](/info/brand-architectures.html)**: bölümlerin, ürünlerin, onaylı markaların, müşterilerin ve sezonların tasarım sistemlerine, colourway'lere ve logo kimliklerine nasıl eşlendiği.
- **[Ortaklarla çalışmak](/info/partners.html)**: markanı bir ortakla paylaşmak ve sana verilen bir markada çalışmak.
- **[Marka sayfaları](/info/brand-page.html)**: tasarım sistemini tek bir adreste, basın kiti ve ajan kiti olarak yayımla.
- **[Design Tokens](/info/design-tokens.html)**: markanın içinde yazıldığı token modeli.
- **[Bir dosya dışa aktar](/info/exporting.html)**: baskı birimleri, CMYK ve markanın render edildiği biçimler.
