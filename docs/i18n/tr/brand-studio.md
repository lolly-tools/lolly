# Lolly Design System Setup

<a id="design-system-setup"></a>

**Lolly Design System Setup**, `#/start` adresinde logonu, renklerini ve yazı tiplerini içerir. Her araç, sayfa ve dışa aktarma bunlarla çizilir.

Bir logo bırak; Lolly renklerini okur. Bir yazı tipi seç veya şirketinin lisansını aldığı yazı tipi dosyasını bırak. Her değişiklik uygulamanın tamamında hemen görünür. Logon, yazı tiplerin ve token'ların bu cihazda kalır. Yalnızca bir Google Font seçmek dışarıya bağlanır: Lolly önce sorar, sonra aileyi bir kez indirir.

Tasarım sistemine bir ad ver ve tek bir `.lolly` dosyası almak için **Export** düğmesine bas. Dosyayı sakla, başka bir cihazda aç veya bir meslektaşına ver. [Lolly Settings](/info/dashboard.html#design-system), etkin sistemi salt okunur olarak gösterir; kapağı, düzenlemek için buraya geri bağlanır.

<!--i:eti-clock-->
## Beş dakikada kendine uyarla

::: timeline
- <!--i:upload--> **Logonu bırak**: **Logos** içindeki bırakma alanına. Lolly şeklini ve renklerini okur.
- <!--i:palette--> **Use these colours.** Logonun ana rengi birincil rengin olur ve logodaki koyu bir nötr renk, metin rengin olur.
- <!--i:font--> **Type** içinde **Choose a face** ile bir yazı tipi seç: bir Google Font veya sahip olduğun bir yazı tipi dosyası.
- <!--i:pentool--> **Sisteme ad ver.** İlk düzenlemen, sana ait bir tasarım sistemi oluşturur ve Lolly adını bir kez sorar.
- <!--i:download--> **Export**, tüm sistemi tek bir `LollyBrand-….lolly` dosyası olarak yazar.
:::

Stüdyonun üstündeki çubuk, tasarım sisteminin adını düzenlenebilir bir alan olarak gösterir. **Enter**, yeni adı saklar ve **Escape**, eski adı geri getirir. İlk düzenlemende **What is this design system called?** sorulduğunda logonda sözcükler varsa Lolly bunları alana doldurur. **Save name**, adı saklar; **Not now**, çubuğa bir ad yazana kadar yer tutucuyu korur. Bu ad, Settings içinde ve sistemler arasında geçiş yaparken sistemi tanımlar ve **Export** eyleminin yazdığı dosyanın adı olur.

<!--i:eti-grid-->
## Odalar

Stüdyo, sabit bir sırası olmayan odalardan oluşur. Hiçbir oda diğerini beklemez. Masaüstünde odalar, çubuğun altında tek bir şerit halinde durur. Telefonda alt kenar boyunca uzanan bir çubuğa taşınırlar ve açık oda görünüme kaydırılır. Palet paneli ve tepsi bu çubuğun üzerinde yükselir; yazı yazarken çubuk kenara çekilir. Klavyede Tab şeride tek seferde ulaşır; ok tuşları, Home ve End ise odalar arasında hareket eder.

![Stüdyonun çubuğu ve odaları: Board, Colours, Type, Logos, Tokens, Files, Sound, Rules ve Skills](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-top&waitSelector=.ds-room-nav&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

| Oda | Orada ne yaparsın | Bağlantı anahtarı |
|---|---|---|
| **Board** | Her odaya açılan bir kapıyla sistemin içeriğini gör | `overview` |
| **Colours** | Renkler ekle, onlara roller ver, tonlar ve bir palet oluştur | `color` |
| **Type** | Uygulamanın, araçların ve her dışa aktarmanın okuduğu dört yazı tipini seç | `type` |
| **Logos** | Logolarını her yön ve uygulama biçiminde yerleştir | `logos` |
| **Tokens** | Köşeler, aralıklar, gölgeler ve diğer tüm adlandırılmış değerler | `tokens` |
| **Files** | Markanın sakladığı görseller, ses ve hareket dosyaları | `catalogue` |
| **Sound** | Ses kimliğini, farklı kullanımlar için müziği ve insan sesiyle kurulan ilişkiyi şekillendir | `sound` |
| **Rules** | Markanın uyguladığı kurallar, gerçek örnekler üzerinde denetlenir | `usage` |
| **Skills** | İnsanların ve ajanların okuması ve indirmesi için markanın yazılı standartları | `skills` |

Bir odaya `#/start?area=<key>` ile bağlantı ver. Oda anahtarları kalıcıdır; bu yüzden Files için `catalogue`, Board için `overview` ve Rules için `usage` korunur. `?tab=`, eski bir takma ad olarak hâlâ çalışır. Bilinmeyen bir anahtar Board'u açar.

**Çubuk**, tüm sisteme ait eylemleri tutar. **Add from…**, bir markayı içeri getirir ([Bir markayı içeri getir](#bring-a-brand-in)). **Tray**, taramanın bulduğu ama henüz eklemediğin öğeleri tutar. **Export**, sistemi tek bir dosya olarak yazar. **More** içinde **Tokens (.json)**, **Fonts for Linux (.rpm)**, **Versions & publishing**, **Restore brand settings** ve sistemler arasında geçiş yaptığın Settings listesini açan **Design systems** bulunur ([Tasarım sistemini sakla ve taşı](#keep-and-move-your-design-system)). Her eylem, üzerinde çalışabileceği bir şey olduğunda görünür. Telefonda **Add from…**, **More** içine taşınır ve **Export** simgesiyle gösterilir.

Tasarım sistemi, uygulamayla birlikte gelen sistem olduğu sürece çubuğun başında **Find a look**, **Add from…** ve **Pick a colour** seçeneklerinden oluşan **Make it yours** menüsü bulunur. Sistem sana ait olduğunda **Export** yeniden o yeri alır.

<!--i:eti-clipboard-->
## Pano

Henüz hiçbir şey seçilmediğinde Board, başlamak için dört yol sunar. **Start from a reference**, logo, ekran görüntüsü, web sayfası veya tasarım dosyası için kaynak seçiciyi açar. **Pick a colour**, **Choose a face** ve **Add a logo**, ilgili denetimleri açar. Birini açmak hiçbir veri yazmaz. Altlarında **Find a look**, denemen için hazır renkler ve yazı tipleri sunar; **Explore the tools** ise en başından beri oradadır.

Herhangi bir şey sana ait olduğunda Board, önce sana ait olanların sayılarıyla birlikte elindekileri gösterir. Colours, devralınanlar için soluk bir `· N starter` ifadesiyle renk sayısını verir. Şeridinde önce senin renklerin, sonra ince bir çizgi, ardından soluk başlangıç renkleri görünür. Colourways, her colourway'i ana renginde küçük bir kutucuk olarak gösterir. Type, her rolü listeler ve her aileyi kendi yazı tipiyle dizer (*Başlıklar için Inter*, alt satırda *Geri kalanı için Starter*). Logos, kaç yuvanın dolu olduğunu (veya **Not set**) belirtir; Tokens, köşe yarıçapını gösterir ve kitaplık boşken Files, **Nothing yet** der. Her blok kendi odasını açar.

Lolly Demo gibi uygulamayla birlikte gelen düzenlenebilir bir tasarım sistemi, renklerini, colourway'lerini, yazı tiplerini ve logolarını en baştan Board üzerinde gösterir; başlığın yanında **Came with this app** etiketi bulunur. Bunların üstünde **Start here**, **Find a look**, **Add from…** ve **Pick a colour** sunar.

### Starter ve sana ait olanlar

Her odada **Starter**, uygulamayla birlikte gelen ve kimsenin seçmediği her şeyi işaretler. Yeni bir kurulum hiçbir renk içermez; yalnızca mürekkep renginden kâğıt rengine uzanan bir nötr ton dizisi bulunur. Böylece kimse seçim yapmadan yüzeyler, metinler ve ince çizgiler render edilebilir.

::: cols
## Starter

- Uygulamayla birlikte geldi: mürekkepten kâğıda uzanan nötr renkler, başlangıç yazı tipleri, varsayılan köşe yarıçapı.
- Soluk, **Starter** etiketli ve renklendirmesiz.
- Senin renklerin olarak sayılmaz. Nötr renkler, **Tokens** içinde **Neutrals · starter · 9** olarak bulunur ve **Open**, bunları Colours içinde tek bir katlanmış grup olarak gösterir (`#/start?area=color&group=neutral`).
- Başlangıç rengi kullanan bir rolde, seçicisindeki **Choose…** ile birlikte *"Starter Paper yerini tutuyor"* yazar.

## Sana ait olanlar

- Senin seçtiğin veya yüklediğin öğeler.
- Tam yoğunlukta; yazı tipi yüklediğin yerde renklendirilmiş bir kartla.
- Board ve Tokens içinde sayılır.
- Başka bir rolü izleyen rolde **↳ follows Primary** yazar.
:::

Devralınan malzemenin asla kesik çizgili kenarlığı olmaz. Kesik çizgili kenarlık, bırakma hedefi anlamına gelir.

<!--i:eti-shapes-->
## Logolar

Üstteki **"Drop marks here, or choose several at once"** bırakma alanı, elindeki tüm dosyaları alır. Lolly, her dosyanın şeklini ve mürekkebini okur. Dosya daha sonra **Waiting for a slot** altında, *"Horizontal primary gibi görünüyor"* örneğindeki gibi neye benzediğini söyleyen bir çip olarak, kullanılan ölçüm ve bir **Place** düğmesiyle (yuva doluysa **Replace**) bekler. Lolly emin değilse çip bunu söyler ve sekiz yuvanın tamamını listeleyen **Change slot** sunar. Bir düğmeye basana kadar hiçbir şey yerleştirilmez.

Fazladan boş kenar payı olan bir logo için önce kırpma önerilir. Öneriye yanıt ver veya özgün logoyu değiştirmeden yerleştirmek için Escape tuşuna bas. Bir logo, ilişkili boş bir yuvayı doldurabiliyorsa oda, türetilmiş **mono** veya **reverse** sürümünü *Generated* etiketli bir çip olarak sunar.

Her logo, her **yön** ve **uygulama biçimi** için bir tane olmak üzere sekiz isteğe bağlı yuvadan oluşan bir ızgaraya yerleşir:

- **Yönler:** Horizontal (aynı sırada logotype ve simge) ve Vertical (kare ve uzun alanlar için üst üste).
- **Uygulama biçimleri:** Primary, Primary reverse (koyu arka planlar için), Mono (tek renk) ve Mono reverse.

Logosu olmayan bir grup tek satıra katlanır; yuvalarını görmek için grubu aç. PNG, SVG, JPEG veya WebP eklemek için bir yuvaya tıkla ya da logoyu değiştirmek için dolu bir yuvaya tıkla. Boş bir yuva, bırakılan dosyayı da alır. Yatay logolar geniş kutucuklarda, dikey olanlar karelerde durur; her biri tasarlandığı yüzey üzerinde, yüksekliğinin dörtte biri kadar boşlukla gösterilir. Her şey bu cihazda kalır.

![Horizontal ve Vertical açıkken logo yuvaları: her uygulama biçiminin kendi yuvası vardır ve her yuva isteğe bağlıdır](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&system=new-design-system&width=1440&height=1600&dpi=192&waitMs=1600&drive=click%3A.be-logo-identity%3Edetails.be-logo-group--fold%3Anot%28.be-logo-group--custom%29%3Esummary%3Bwait%3A600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Custom marks**, simge, arma veya favicon gibi markanın kendi adıyla andığı logolardır.
- **Daha fazla kimlik.** Bir alt marka, ürün veya etkinliğin kendine ait tam bir seti olabilir: **+ Add another logo** düğmesine bas ve sete bir ad ver. Ana setin "Your logo"dur. [Marka mimarileri](/info/brand-architectures.html), ne zaman bir logo kimliği kullanılacağını gösterir.
- **Lolly, logonun renklerini okur.** Bırakma alanının altında ve Colours'ın üstünde yer alan bir kart, logonun renklerini listeler ve **Which is the main colour?** diye sorar. En baskın renk seçilir; logonun dışa aktarıldığı beyaz zemin asla seçilmez. **Use these colours**, bunları paletine ekler ve ana rengi birincil rengin yapar. Logoda kâğıt üzerinde okunabilen koyu bir nötr renk varsa o renk metin rengi olur. **Not now**, bunları Tray içinde bırakır. Yepyeni bir kurulumda Lolly, en olası yanıtı hemen uygular ve kart **Undo** veya başka bir ana renk sunar. SVG kesin renkleri verir; PNG, JPEG veya WebP ise logonun önemli bir bölümünü kaplayan renkleri verir.

<!--i:eti-palette-->
## Renkler

Oda, tasarım sistemiyle birlikte büyür. İlk ziyaret tek bir karar ister; palet büyüdükçe daha fazla denetim görünür.

### İlk renk

Kendine ait renkleri olmayan bir sistem, başlangıç nötr renklerini kendi açık gruplarında gösterir. Odanın üstünde kesik çizgili bir yapıştırma ve bırakma alanı vardır: büyük bir çip ve bir alan. Alanın herhangi bir yerine bir görsel veya renk listesi bırak; Lolly renkleri okur.

- **Çip, seçicidir.** **Pick a colour**, stüdyonun OKLCH kartını alandaki içerikle başlatarak açar. Kart önce rengin adını ve hex değerini gösterir. Renk uzayları, çark, dört kadran ve alfa, **Fine-tune** altındadır; **Cancel** ve **Add colour** ise en alttadır. **Add colour** düğmesine basana kadar sisteme hiçbir şey eklenmez.
- **Alan her gösterimi kabul eder**: `#e0452b`, `rgb(224 69 43)`, `oklch(58% .19 32)` veya bir renk adı. Yapıştırılan bir liste, tek tek veya **Add all** ile eklenebilecek bir çip sırasına dönüşür.
- **İki yol daha.** **Pick a colour from the screen**, tarayıcıda varsa damlalığı kullanır ve **Take colours from an image**, bu cihazdaki bir ekran görüntüsünü veya fotoğrafı okur.
- **Add hiçbir zaman devre dışı kalmaz.** Alan boşsa seçiciyi açar; okuyamadığı bir metin varsa alanın altındaki bir satır bunu belirtir.

İlk rengin **birincil** renk olur. Bir çip, *"Birincil renk artık Vivid Violet"* gibi bir ifadeyle değişikliği onaylar ve rengi ayarlamak için **Fine-tune** sunar.


### Palet büyüdükçe

Geniş ekranda renklerin, **In context** önizlemesinin yanında; daha küçük ekranda ise önizlemenin üzerinde durur. Önizleme, paletinde bir poster, grafik veya arayüz kartı gösterir. Başlangıç renklerinin kendi grubu vardır ve sistemin kendine ait renkleri olduğunda bu grup katlanır. Yapıştırma ve bırakma alanı tek bir kompakt satıra dönüşür. Odanın üstünde dışa aktarma yoktur; çubuktaki **Export** düğmesini veya Tokens odasını kullan.

![Lolly Demo'daki Colours odası: üstte rol çipleri ve yapıştırma ve bırakma alanı, ardından katlanan gruplar halinde palet; her renk adı ve hex değeriyle gösteriliyor](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-roles-fold%5D%3Esummary%3Bwait%3A500&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

![Bir renk eklendikten sonra Lolly Demo'daki Colours odası: Colour roles tablosu, ardından canlı bir kompozisyon önizlemesinin yanında Use as Lead? ve Fine-tune sunan yeni renk çipi](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

### Renk rolleri: renklerin adları

Tasarım sistemi, renklerine ad verir ve her birinin ne işe yaradığını söyler; Lolly ikisini de okur. **Colour roles**, Colours odasının başında yer alır. **In context**, her değişikliği hemen gösterir.

![Kurgusal bir tekstil markası olan Wefthouse'un kendi sözcükleriyle Colour roles tablosu: Indigo, Madder ve Weld colourway çipleri, ardından her biri açık ve koyu rengiyle, ana renk, eşlik eden renk veya yalnızca adıyla okunan Main, Accent, Supporting ve Tertiary; tablonun altında ise hiçbir rolün karşılamadığı kullanımlar olarak Background, Text, Quiet text ve Hairlines listeleniyor](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&system=wefthouse&width=2720&height=2000&dpi=192&waitMs=1800&cropSelector=%5Bdata-be-roles-fold%5D&format=svg&walker=1&dark=1&filename=bs-colour-roles)

Tablonun dört sütunu vardır. Telefonda her satır, açık ve koyu renklerin yan yana durduğu bir karta dönüşür:

| Sütun | İçeriği |
|---|---|
| **Role** | Tasarım sisteminin yerinde düzenleyebileceğin kendi sözcüğü ve rengin ne işe yaradığını söyleyen bir satır |
| **Light** ve **Dark** | Seçili colourway için o görünümdeki renk, adı veya değeri ve kontrastıyla birlikte |
| **Lolly reads this as** | Lolly'nin kendi sözcükleriyle bir aracın bu rolle ne yaptığı |

**Lolly bir rolü nasıl yorumlar.** Her yorum bir role atanır. Başka bir rolün taşıdığı yorumu seçmek, yorumu bu role taşır. Lolly hiçbir zaman bir sözcükten anlam çıkarmaz.

| Yorum | Ne belirler |
|---|---|
| **Lead colour** | Büyük şekiller, düğmeler, bir aracın öne çıkardığı renk |
| **Partner colour** | Bir aracın kullandığı ikinci renk |
| **Background** | Diğer her şeyin arkasında durur |
| **Text** | Başlıklar ve gövde metni |
| **Quiet text** | Açıklamalar ve küçük yazılar |
| **Hairlines** | Çizgiler, kenarlıklar ve ayırıcılar |
| **By name only** | Hiçbir araç rolü kendiliğinden seçmez. Her renk alanında ve Design'da sunulur; orada yapılan seçim bağlı kalır ve colourway'i izler |

Hiçbir rolün karşılamadığı bir yorum, tasarım sisteminin tanımını korur ve bölüm bu yorumları tablonun altında listeler. Primary adlı bir rol gibi, bir yorumun kendi kimliğini paylaşan rol, o yorumun kendisidir ve taşınamaz.

**Bir grafikte.** Lolly Chart'ın **Design system - colour roles first** paleti, serilere önce tasarım sisteminin renk rollerini kendi sırasıyla, ardından paletinin geri kalanını verir. Arka plan, metin, soluk metin veya ince çizgiler olarak yorumlanan bir rol dışarıda bırakılır; çünkü grafik zeminini ve yazılarını bu renklerle çizer. Bu paleti seçene kadar hiçbir şey değişmez. Renk rolü olmayan bir tasarım sistemi paleti **Design system - ordered** olarak çizer.

**Değerler.** O görünümde ve seçili colourway'de rolün rengini seçmek için bir değere bas. **Same as light**, koyu bir renk seçene kadar koyu değerin açık değeri izlemesini sağlar. **Aa** çipi, Lolly'nin rengin üzerine koymak için seçtiği metni gösterir. Değerin altındaki satır, bu metnin her görünümde ne kadar okunaklı olduğunu söyler: **Text reads well**, **Large text only** veya **Hard to read as text**. Derecelendirme yalnızca rengin üzerindeki metinle ilgilidir; renk, şekiller ve geniş alanlar için hâlâ uygun olabilir. Yalnızca adıyla yorumlanan bir rol, aynı sözcükleri uyarı rengi olmadan gösterir; çünkü hiçbir araç kendiliğinden o rolün üzerine metin koymaz. Araç ipucu ve seçici, önce APCA, sonra WCAG olmak üzere sayıları gösterir. **Own text colour**, dosyasında metin rengi belirtilen bir değeri işaretler; bu metin rengi korunur. **Copied**, başka bir colourway'den veya eşlik eden renkten gelen ve henüz kimsenin seçmediği bir değeri işaretler; seçicideki **Keep this colour** değeri kesinleştirir.

**Başlangıç noktaları.** Kendine ait rolü olmayan bir tasarım sistemi mevcut sözcükleri gösterir: Primary, Secondary, Surface ve Text. Birini değiştirene kadar hiçbir şey yazılmaz. **+ Add a role**, **Primary, Secondary** veya **Main, Accent, Supporting, Tertiary** önerir ya da yazdığın herhangi bir sözcüğü kabul eder ve her birinin alacağı yorumu gösterir. İlk iki sözcük ana renk ve eşlik eden renk olur. Araçlar aynı renkleri çizmeye devam eder. Tek bir ana rengi olan bir sistemde ilk colourway bu rengin adını alır.

**Yeniden adlandırma, yeniden sıralama, kaldırma.** Yeniden adlandırma yalnızca sözcüğü değiştirir; rolü kullanan her şey çalışmaya devam eder. Bir rolü tutamacından sürükle ya da tutamaçta Space tuşuna bas, ok tuşlarını kullan ve bırakmak için Space tuşuna bas. **Remove**, rolü nelerin hâlâ kullandığını söyler. Araçlar rolü okuduğunda **Remove and keep those colours**, her yorumu mevcut rengiyle bırakır. Rolü kullanan bir kurumsal kural, bir kılavuz grubu, bir araç alanı veya başka bir token, bu kullanım değişene kadar rolün kaldırılmasını engeller. Kayıtlı bir Design belgesi de bir rolü adıyla kullanabilir ve Lolly bunu token dosyasından göremez. Böyle bir belge rengi çözümlenmemiş olarak bildirir.

::: details Elle yazılmış bir token dosyasındaki roller
**Elle yazılmış bir dosya.** Bir token dosyasında hiçbir rolün tanımlamadığı renkler, her biri için bir sözcük alanı ve **Make a role** ile **In this file, with no role yet** altında listelenir. Her iki durumda da adlarıyla çalışmaya devam ederler. Adında rakam bulunan bir token rol olamaz; dosyada kalır ve yoluyla çalışmaya devam eder. Dosyadaki bir kayıt doğrulamadan geçmezse tablo denetimler olmadan gösterilir ve nedenini söyler.
:::

**Bölümün geri kalanı aynı sözcükleri kullanır.** Çipler, renk örneğinin **Use as** satırı ve paletin **Colour roles** grubu, tasarım sisteminin sözcüklerini kullanır. Bir renk rolünün kutucuğu o rolün değerini açar. Dışa aktarılan dosyalar roller hakkında yeni bir şey kaydetmez; bir render'ın renkleri, token'lar değiştiği için değişir.

**Sözcükler nereye gider.** Sözcükler ve açıklamalar tasarım sistemiyle birlikte taşınır. Ajanlar bunları tasarım özetinde, `lolly://tokens` içinde ve bir marka sayfasının `AGENTS.md` dosyasında okur. Terminal bunları `lolly system status` içinde gösterir. Bir marka sayfası bunları `brand.json` içinde listeler ve her rol için bir kontrast çifti ölçer. DTCG ve Tokens Studio dosyaları her şeyi korur, `DESIGN.md` sözcükleri ve yorumları korur ve bir PowerPoint teması yalnızca markanın sırasını korur. [Diğer biçimlerde renk rolleri](/info/design-tokens.html#colour-roles-in-other-formats) tam listeyi içerir. Sözcükler her zaman tasarım sisteminin verisi olarak alıntılanır, asla talimat olarak okunmaz.

**Bir rengin seçildiği yer.** Bir araçtaki ve Lolly Design'daki her renk alanı, tasarım sisteminin rollerini her sözcük ve amacıyla birlikte, kendi sırasıyla ilk sırada listeler. Bir rolün yanındaki **Aa**, o rolün üzerine gelen rengi seçer. Diğer renkler, colourway'in kendi kopyaları, üzerine gelen renkler ve bir rolün zaten karşıladığı yorumlar olmadan **Other colours** altında sıralanır. Bir seçim role bağlı kalır ve colourway'i izler. Alan her colourway'de sözcüğü gösterir ve Settings ile Tokens da bu sözcüğü kullanır. Rolü olmayan bir tasarım sistemi renk örnekleri ızgarasını korur.

### Bir aracın okuduğu her renk

Bölüm, **Colour roles** kapalıyken ilk kararlar için çiplerle başlar. Her çip rolün rengini ve adını gösterir. Kendine ait sözcükleri olmayan bir sistemde bunlar **Primary**, **Secondary**, **Surface** ve **Text** olur. Rengini paletin renk örneklerinden seçmek için bir çipe bas. **Colour roles** altındaki **Every colour a tool reads**, şeridin tamamını içerir.

Şerit, bir aracın okuyabildiği yedi rengi gösterir: Primary, Secondary, Surface, Text, Muted, Edge ve On primary; tasarım sisteminin kendi sözcükleri varsa bunları kullanır. Her biri her araçta ve dışa aktarmada aynı görevi üstlenir. Hiçbirini ayarlamak zorunda değilsin ve herhangi bir renk bunlardan birinin yerini alabilir. Birbirinden bağımsız üç renk iyi bir sistem oluşturur. Gösterge, önce APCA olmak üzere, metnin yüzey üzerinde ne kadar okunaklı olduğunu söyler. Her satır kendi rengini tam yoğunlukta, onun yerine geçen bir başlangıç rengini veya **↳ follows Primary** ifadesini gösterir.

On primary, primary'den türetilir, **Derived** olarak görünür ve seçicisi yoktur. On primary yanındaki **Light** ve **Dark** anahtarı ile **In context** yanındaki anahtar, şeridin, paletin ve önizlemenin hangi görünümü göstereceğini seçer.

Uygulamanın kendi vurgu rengi, **Settings → Appearance** içindeki **Interface follows the design system** ayarıyla varsayılan olarak tasarım sistemini izler. Ayar kapalıyken uygulamanın arayüz çerçevesi nötr kalır. Araçlar, tuvaller ve dışa aktarmalar her iki durumda da tasarım sistemini izler.

**Colourway'ler.** Bir tasarım sistemi, her parça için ayrı seçilen birkaç ana renk barındırabilir. **Colour roles** başındaki **Colourways** satırı, her colourway için bir çip gösterir; kurallı olanın üzerinde **Default** yazar. **+ Add**, bir palet renginden yeni bir colourway başlatır. Bir çip seç; tablo, şerit, palet ve önizlemeler o colourway'i gösterir. Seçili colourway'i yeniden adlandırabilir, çoğaltabilir, kaldırabilir veya varsayılan yapabilirsin. Colourway'leri olan bir sistemde her colourway'in kendi primary ve secondary rengi, colourway'ler arka planı renklendiriyorsa kendi surface rengi gerekir. Bu roller renk örneği düzenleyicisinde ayarlı kalır. [Bir tasarım sistemine colourway ekle](/info/colourways.html#add-colourways-to-a-design-system), adımları ve token biçimini içerir; [Lolly Demo kullanımda](/info/lolly-demo-in-use.html#colourways-on-real-work) ise gerçek işlerde colourway'leri gösterir. Herkes **Settings → Appearance** içinde bir colourway'i kendine seçebilir ([Bir colourway'i kendine seç](/info/colourways.html#make-a-colourway-your-own)).

### Daha fazla renk bul

Üç araç primary renginden yola çıkar. İlk ikisi yalnızca önerir; üçüncüsü paleti değiştirir.

::: cols
## Tonları & armonileri keşfet

Bir **Starting colour**, bir **Scheme** (Mono, Complement, Analogous veya Triad) ve kaç **Shades** olacağını seç (3 ile 20 arası, varsayılan 5). **Fine-tune**, arayüz yoğunluğunu, kontrastı ve marka rengi üzerindeki metni ayarlar. Eklemek için bir tona veya bir grup eklemek için **Add 5 shades** düğmesine tıkla. Renklerin ve rollerin korunur.

## Uyumlu renkler bul

Bir **Harmony** seç: Complementary, Adjacent, Triad, Tetrad veya Analogous (**Accents** 2 ile 5 arası ve **Angle** 10° ile 45° arası). Her adayın oluşturulmuş bir adı ve **+ Add** düğmesi vardır; her renk için bir kez bas.

## Tüm paleti yeniden oluştur

Nelerin değiştiği ve nelerin korunduğu incelendikten sonra paleti tek bir başlangıç renginden yeniden oluşturur.
:::

Üçü de motorla aynı algısal renk matematiğini (OKLCH) kullanır. **Explore shades & harmonies** içinde **Primary**, **Neutral** ve **Secondary** satırları önerilen tonları gösterir; **Theme preview** ise kontrast ölçümleriyle birlikte açık ve koyu örnekler gösterir.

![Ayrı ekleme denetimleri ve ayrı bir Theme preview ile önerilen üç ton grubu](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

![Her biri bir renk örneği, otomatik oluşturulmuş ad, hex değeri ve Add düğmesi içeren oluşturulmuş vurgu renkleri](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&drive=click%3A.be-generate-detail%3Anot%28%5Bdata-be-rebuild%5D%29%20%3E%20summary%3Bwait%3A500&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### Oluşturulmuş bir paleti uygulama

Şu seçeneği aç: **Rebuild the whole palette…**, ardından **Preview full rebuild** düğmesine bas. İnceleme, kaç rolün atadığın gibi kaldığını, kendi renklerinden kaçının korunduğunu ve kaç ton eğrisinin, baskı kilidinin, gizli tonun ve gradyan durağının yeniden bağlandığını veya korunduğunu sayar. **Apply rebuilt palette** uygular; **Cancel** hiçbir şeyi değiştirmez. Ardından kart, odağı zaten üzerinde olan **Undo** düğmesini sunar ve değişimden önce alınan kontrol noktası tüm sistemi geri yükler.

Colourway'leri olan bir sistem, yeniden oluşturma sırasında her colourway'i korur. Kurallı colourway yeni başlangıç rengini izler ve diğer her colourway kendi renklerini, adını, sırasını ve ayarlarını korur. İnceleme, hangi colourway'in yeni rengi izlediğini ve hangilerinin renklerini koruduğunu listeler. Lolly, colourway'lerini düzenleyemeyeceği bir şekilde kodlayan bir sistemi yeniden oluşturmaz; kart nedenini söyler ve hiçbir şey değişmez.

### Uzman bölümleri

Önizleme ve rollerin altında dört katlanmış bölüm bulunur. Her biri `#/start?area=color&focus=<name>` ile açılır:

- **Explore shades & harmonies** (`focus=generate`).
- **Shade curves** (`focus=curves`), ayrı açıklık, kroma ve ton eğrileriyle (L / C / H) bir ton dizisini nokta nokta yeniden şekillendirir; sen sürüklerken tonlar yeniden çizilir.
- **Contrast** (`focus=contrast`): **Contrast-lock**, seçtiğin arka plana karşı APCA hedeflerine ulaşmak için bir dizinin tonlarını yeniden ayarlar ve **Rotate hue** tüm diziyi çarkta döndürür.
- **Print** (`focus=print`), primary renginin baskıda neye dönüşeceğini belirler: otomatik değeri, sabitlenmiş bir CMYK karışımı veya adlandırılmış bir spot mürekkep.

### Palet ve her renk örneği

Palet, renklerini her biri kendi **+ Add** düğmesine sahip katlanabilir gruplarda listeler. Gruplar oluşturabilir ve yeniden adlandırabilirsin. Bir rol hiçbir zaman ikinci bir kutucuk oluşturmaz; rolün işaret ettiği kutucuk, **Primary** gibi rolün adını gösterir. Kutucukların altındaki **Colour chart**, aynı renkleri OKLCH **Wheel** üzerinde (rengi değiştirmek için bir noktayı sürükle, renk örneği eklemek için boş alana tıkla) ve görüntülenebilir aralığın nerede bittiğini gösteren **Gamut** grafiğinde gösterir. `#/start?area=color&focus=chart` grafiği açar.

![Her grubu katlanabilir palet bölmesi](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-roles-fold%5D%3Esummary%3Bwait%3A500%3Bclick%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![OKLCH çarkı - açı tonu, merkezden uzaklık kromayı gösterir ve griler yandaki açıklık rayı boyunca uzanır](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

Düzenleyicisini açmak için bir renk örneğine tıkla:

- **Rename** ile renk örneğini yeniden adlandır.
- OKLCH sürgüleriyle veya **Hex**, **HSL**, **RGB** ya da **CMYK** olarak **rengi ayarla**. Değer alanı etkin uzayda okur ve yazar. Buradaki CMYK, ekran rengini dönüşümle ayarlar; kesin mürekkep değerlerini sabitlemek için **Print substitutes** kullan.
- **Stored as**, renk örneğinin nasıl kaydedileceğini seçer: **LCH** (varsayılan, algısal ve geniş renk gamlı), Hex, RGB veya HSL.
- **Use as**, renk örneğine bir rol verir; tasarım sisteminin kendi sözcükleri varsa bunları kullanır. Rolü temizlemek için vurgulanan role tekrar bas.
- **Print substitutes** (katlanmış): **CMYK** değerini **Auto** yerine kesin mürekkep değerlerine kilitle veya bir **Name** (örneğin `PANTONE 186 C`), isteğe bağlı bir **Book** ve yaldız, kabartma, çökertme, bölgesel vernik, yumuşak dokunuş ya da kalıplı kesim, kırım veya perforasyon için bir **Finish** ile **Spot colour** ayarla. CMYK PDF veya TIFF dışa aktardığında baskı makinesi bu kilitleri kullanır; bkz. [Renk profilleri](/info/exporting.html#colour-profiles). Bir spot mürekkep, Print PDF içinde kendi kalıbında basılır; tek bir dışa aktarmada her spot mürekkebi proses renklerle basmak için bkz. [Spot mürekkepleri proses renklerle basma](/info/exporting.html#spot-inks-as-process).
- **In other spaces** (katlanmış): her renk uzayı için türetilmiş veya senin tanımladığın bir değer; dışa aktarmada senin tanımladığın değer önceliklidir.

**Bir renk örneğini silmek** güvenlidir. Türetilmiş tonlar ve tema rolleri gizlenir, böylece onları okuyan hiçbir şey bozulmaz. Eklediğin renkler kaldırılır.

::: details Çok sayıda renk örneğiyle çalışma
Normal durumda bir renk örneği rengini, adını ve hex değerini gösterir. Select, her ekranda her renk örneğinin onay kutusunu ve sürükleme tutamacını gösterir; klavye odağı olan bir kutucuk da tutamacını gösterir. Grup içinde yeniden sıralamak için bir tutamacı sürükle ya da tutamaca odaklan, Space tuşuna bas, ok tuşlarını kullan ve bırakmak için tekrar Space tuşuna bas; Escape iptal eder. Telefonda palet her satırda dört renk gösterir. Renkleri gruplar arasında taşımak için düzenleyicinin **Group** denetimini kullan veya birkaçını seçip **Move to** kullan.

Seçim için ayrı bir anahtar gerekmez: çubuk ve onay kutuları ilk kutucuk seçildiğinde görünür ve son kutucuğun seçimi kaldırıldığında kaybolur.

- Bir dikdörtgen çizmek için **boş alanda sürükle**; dokunduğu her kutucuk, gruplar arasında da seçime katılır. Katlanmış bir bölüm hiçbir şey eklemez.
- **Shift-click** okuma sırasına göre bir aralık seçer, **Cmd/Ctrl-click** tek bir kutucuğun seçimini değiştirir ve normal bir tıklama düzenleyiciyi açar.
- Her grup başlığında **Select all** vardır ve bir kutucuk odaktayken **Cmd-A**, sana ait her rengi seçer, başlangıç renklerini asla seçmez.
- Izgaranın tek bir sekme durağı vardır: oklar hareket ettirir, Shift-oklar seçimi genişletir, Space seçimi değiştirir, Delete kaldırır ve Escape temizler. Bir kanalı küçük adımlarla değiştirmek için önce `l`, `c` veya `h` tuşuna bas.
- Dokunmatik ekranda seçim başlatmak için bir kutucuğa basılı tut, ardından eklemek için dokun.

Çubukta **{n} selected**, ardından **Move to**, **Give a role** (her renk sırayla bir sonraki rolü alır), **Download** (seçim, altı palet biçiminden herhangi birinde), **Duplicate** (her birinin, özgün olanın ardına yerleştirilen bir kopyası), **Copy values** ve **Delete** görünür. Tek bir kopya düzenleyicide açılır; birden fazlası seçili kalır. Bir Cmd/Ctrl-Z, toplu bir eylemi geri alır.
:::

### Gradyanlar

İsteğe bağlı **Gradients** paneli, paletten karışım token'ları oluşturur. Her gradyanın bir önizlemesi, 2 ile 8 arasında adlandırılmış durağı ve bir açısı vardır. Bir durak bir renk örneğini işaret eder; renk örneğini yeniden renklendirdiğinde gradyan da onu izler. Karışımlar OKLCH içinde gerçekleşir.

Palet indirmeleri (tasarım token'ları, CSS, SCSS, GIMP ve Adobe Swatch Exchange) paletin başında yer alır. [Paletini ve yazı tiplerini her yere taşı](/info/using.html#take-your-palette-and-fonts-anywhere), her biçimi açıklar.

<!--i:eti-type-->
## Tipografi

Kendine ait yazı tipi yoksa bölüm tek bir kart gösterir: mevcut yazı tipiyle okuma boyutunda dizilmiş **Primary**, bir **Starter** etiketi, bir **Choose for Primary** düğmesi ve *"Sen birini seçene kadar hiçbir şey kurulmaz."* satırı. Başlıklar, kod ve italik için ayrı seçim yapana kadar bunlar primary'yi izler; **Choose them separately** bunların kartlarını gösterir.

![Henüz yazı tipi seçilmemiş Type bölümü - okuma boyutunda tek bir kart, üzerinde bir Starter etiketi ve tek bir dolgulu Choose for Primary düğmesi](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&system=new-design-system&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

Bir yazı tipi seç; bölüm dört rol kartı, Fonts listesi ve canlı bir örnekle genişler:

- **Primary**: gövde metni, düğmeler ve her araç.
- **Headings**: `h1` ve `h2` için başlık yazı tipi.
- **Code**: kod ve veri için eş aralıklı bir yazı tipi.
- **Italic**: vurgu, alıntılar ve ara notlar için gerçek bir italik.

Bir kart, yalnızca o yazı tipini sen kurduysan renklendirilir. Düğmesi rolü gösterir: sana ait bir yazı tipinde **Change Headings**, diğer her yerde **Choose for Headings**. Örnek satır alt satıra kayar. Karttaki hiçbir şey bir değişikliği uygulamaz; düğme, o rol için karşılaştırma alanını açar.

![Açılan dört rol kartı - her biri o rolün yazı tipiyle dizilmiş, kimsenin seçim yapmadığı yerde Starter etiketi var ve Italic primary'yi izliyor](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&system=new-design-system&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

### Karşılaştırma alanı

Alan, bastığın kartın altında açılır. Kartlar tek satırlık bir şeride katlanır, böylece alan telefonun ilk ekranında görünür. Escape iptal eder ve odağı karta döndürür.

1. Kartta **Choose for** ve rolün yazdığı düğmeye bas.
2. Bir aile adı yaz ve **Preview** düğmesine bas ya da alanın altındaki altı **Pinned** ailesinden birine bas.
3. **Use this face** düğmesine bas.

![Kartının altında açık karşılaştırma alanı; arama satırı, sabitlenmiş aileler ve tek satırlık şeride katlanmış kartlarla](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

**İzin bir kez istenir.** Bir önizleme ilk kez Google Fonts'a bağlandığında bir iletişim kutusu şunu açıklar: *Google, aile adını ve IP adresini öğrenir. Dosya daha sonra bu cihazda tutulur ve çevrimdışı kullanılır. Stüdyoda üçüncü bir tarafa bağlanan tek adım budur.* **Fetch from Google** devam eder ve seçim hatırlanır. **Cancel**, kartta kendi **Fetch from Google** düğmesiyle birlikte *"Alınmadı. Google'a hiçbir şey gönderilmedi."* yazısını bırakır.

**Alana bir yazı tipi dosyası bırak** (TTF, OTF veya WOFF); böylece sahip olduğun lisanslı bir yazı tipini önizleyebilirsin. Her iki durumda da yazı tipi bu cihazda kalır, uygulamada, araçlarda ve her dışa aktarmada çevrimdışı render edilir ve tasarım sistemi dosyasıyla taşınır. Google Fonts'taki her şey açık bir lisansla gelir (OFL, Apache veya UFL).

### Bu cihazdaki yazı tipleri

Bu cihazdaki her yazı tipini ve üstlendiği rolü **Fonts** paneli listeler. Eklediğin yazı tipleri, her birinin rolleri ve silme seçeneğiyle **In the design system** altında ilk sırada yer alır. Başlangıç yazı tipleri, tek bir soluk ve katlanmış satırda onları izler. **Add a face**, herhangi bir rol için karşılaştırma alanını açar. **Type roles** paneli, her rolün ailesi ve durumuyla birlikte canlı bir örneğini gösterir; örneğin *Inter* veya *Inter · Primary'yi izler*.

<!--i:eti-tag-->
## Token'lar

Token'lar tasarım sisteminin arkasındaki adlandırılmış değerlerdir: renkler, yazı tipleri, logolar, köşeler ve aralıklar. Araçlar bunları adlarıyla okur, bu yüzden buradaki bir değişiklik her araca aynı anda ulaşır.

![Tokens bölümü: sistemden bir örnek ve dosya eylemlerinin bulunduğu üst kısım, her token türünü sayan kutucuklar, ardından kontrast göstergeleriyle renk çiftleri](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **Üst kısım**, kendi sisteminden bir örnek (*Primary, Spearmint'tir, #033633*) ve dosya eylemlerini sunar: **Download** (tasarım token'ları olarak sistem veya diğer beş biçimde palet), **Copy CSS** ve bir JSON dosyasını geri okumak için **Add from…**.
- **Kutucuklar**, her token türünü sayar ve bölümüne atlar: Colours, Type, Logos, Shape and spacing, More ve All tokens. Yalnızca boş başlangıç sistemiyle gelenleri içeren bir bölüm **Starter** etiketi taşır; uygulamayla gelen bir sistem kendi malzemesini etiketsiz sayar. Telefonda kutucuklar üçerli iki satıra yerleşir.
- **Colours**, araçların bir araya getirdiği çiftlerle (yüzey üzerinde metin, primary üzerinde metin, yüzey üzerinde soluk metin), açık ve koyu görünümde APCA göstergesiyle başlar ve bir çift yetersiz kaldığında **Weak contrast** uyarısı verir. Ardından her renk grubu gelir: bir ton dizisi tek bir çip satırı olarak, diğer renkler ise değerleri ve araçların kullandığı referansla, örneğin `{color.brand.spearmint}`, gösterilir. Referansı kopyalamak için üzerine bas. **Edit in Colours**, bir grubu Colours bölümünde açar. [Renk rolleri](#colour-roles-what-the-colours-are-called) olan bir tasarım sisteminde **Colour roles** ilk sırada gelir; her rol, sistemin kendi sözcükleriyle ve sırasıyla bir kez görünür. Bir rol, her colourway ve görünüm için bir renk tutar. Bu renkler ayrı renkler olarak değil, rolle birlikte listelenir; bunları Colour roles tablosunda değiştir.
- **Type** ve **Logos**, her rolün yazı tipini ve her logo yuvasını listeler; kendine ait olanları eklediğinde **Edit in Type** ve **Edit in Logos** sunulur.
- **Shape and spacing**, **Rounded corners** (`shape.radius`) ve **Spacing rhythm** (`space.base`) içerir. Her biri, sürgüyü hareket ettirene kadar *Lolly default*, sonrasında *Yours* gösterir, hemen kaydedilir ve geri alınabilir.
- **More tokens**, standart [tasarım token'ları](/info/design-tokens.html) olarak saklanan aralık, boyut, çizgi kalınlığı, opaklık, döndürme, düz sayılar ve gölgeler ekler.
- **App appearance (advanced)**, Lolly'nin kendi ekranlarının kullandığı renkleri, boyutları ve gölgeleri listeler; **Inspect every token (advanced)** ise saklanan herhangi bir değeri arar ve düzenler ve her değişikliği önce inceleme için gösterir. Orada bir renk rolünün her colourway'deki değerleri rolle birlikte listelenir: her colourway için açık ve koyu yan yana olacak şekilde bir satır görmek için rolün token'ını seç. Sayı satırı, rollerin kaç değer tuttuğunu söyler. Salt okunur bir tasarım sistemi de aynı listeyi gösterir.

Boş bir bölüm **Pick a colour**, **Choose a face** veya **Add a logo** sunar.

<!--i:eti-images-->
## Dosyalar

Markanın sakladığı, logolar dışındaki dosyaları bırak: **vektör**, **görsel**, **ses** ve **hareket** dosyaları (video, Lottie ve animasyonlar). Bunlar [Assets](/info/using.html#assets-your-library) içinde bölümlere ayrılmış olarak ve her aracın varlık seçicisinde görünür. Bu cihazda kalırlar.

## Ses

**Sound** dinleyerek seçilir. Bölüm, **Calm**, **Steady** ve **Bright** adlı üç başlangıç sesiyle açılır; her biri kendi türünün renklerinde, oynatma düğmeli bir karttır. Kısa bir bölümünü dinlemek için birini oynat; başka birini başlatmak ilkini durdurur. **Choose**, o sesi her kullanımın sesi yapar. Dördüncü kart **Mixed**, her kullanıma kendi sesini verir: Explain için Calm, Demonstrate için Steady ve Play için Bright. Oynatma düğmesi üçünü sırayla çalar. **Save sound** seçeneğini seçene kadar hiçbir şey kaydedilmez. Ardından ses, diğer bölümlerin kullandığı aynı geçmişte bir kontrol noktasıyla bu tasarım sisteminin parçası olur. Sesi olmayan bir tasarım sistemi eskisi gibi çalışmaya devam eder.

Kullanım, sesin çaldığı bir andır: başlangıçta **Explain**, **Demonstrate** ve **Play**. Her kullanım, kendi oynatma düğmesi olan bir çiptir. Çiplerin üzerindeki **Music** veya **With narration**, bir çipin yalnızca müziği mi yoksa konuşmanın altında müziği mi çalacağını belirler. Seçtiğin kullanım, amacını ve müziğini sade sözcüklerle gösterir; örneğin "Sıcak · 84 bpm · Rhodes, akıcı bas, puslu davul seti". Her kullanım seçili sesin türünü, temposunu ve enstrümanlarını alır (Mixed ile kendi sesininkileri alır). Her kullanım kendi melodisini ve dengesini korur: Explain, melodinin konuşmayı örtmesini önler ve Play, melodiyi öne çıkarır. Mixed ile tek bir ses arasında geçmek her ikisini de korur. Kendin eklediğin bir kullanım, Mixed altında sahip olduğu sesi korur. Tasarım sistemi hangisini seçtiğini kaydeder. **Add a use**, bir kullanım ekler ve adını yerinde yazmanı sağlar. **Make main**, başka bir şey istenmediğinde çalınacak kullanımı seçer. **Another tune**, aynı ayarlarla yeni bir beste çalar.

**Edit in the music generator**, [müzik oluşturucuyu](/info/generated-music.html#the-music-generator) o kullanımın ayarlarıyla açar; üstte kimin sesini düzenlediğini söyleyen bir satır bulunur. **Save to this use**, ayarları bölüme geri getirir; **Cancel**, hiçbir şeyi değiştirmeden geri döner. Bölümdeki kaydedilmemiş seçimler sen yokken bekler. Bu sırada başka biri sesi başka bir sekmede kaydederse yeni kayıt geçerli olur ve senin düzenlemen dışarıda kalır.

**Voice**, kullanım için bir konuşma sesi, konuşma hızı ve müziğin konuşma altındaki ses düzeyini seçer; **Hear the voice with the music** ikisini birlikte çalar. **More** altında konuşma sırasında sesin ne kadar kısılacağı, denenecek sözcükler (bölümde kalırlar), telaffuz notları (her satıra bir tane, yazılış = söyleniş biçiminde) ve konuşma sesiyle ilgili notlar bulunur. Önizlemeler yerel konuşma modelini ve bir sekans dışa aktarmasıyla aynı miksajı kullanır. Önizlemenin sesi kademeli olarak azalır; bu, bestelenmiş bir bitiş değildir.

**Notes and signature**, bir kullanımda nelerin dinlenmesi gerektiğini ve bir ses imzasını tutar: kendi ses dosyası olarak saklanan sabit bir açılış veya kapanış. İmzayı sekansına yerleştir; oluşturulan müzik hiçbir zaman imzayı içermez. Lolly'nin bu sürümünün denetleyemediği bir gereklilik, o kullanım için yeni müzik oluşturulmasını durdurur.

**Details**, markanın karakterini (sesin nasıl hissettirmesi gerektiğini, nelerin aynı kaldığını ve nelerden kaçınılacağını) ve dinleme incelemesini tutar. **Record a listening review**, inceleyenin adını, tarihi ve notlarını sesin kayıtlı sürümüyle birlikte saklar. Herhangi bir değişiklik sesi yeniden taslak yapar. Bir inceleme o sürümü kapsar, daha sonra o sesten yapılan her melodiyi değil: paylaşılmadan önce her yeni parçayı dinle.

**Make a music project**, kullanımı müzik oluşturucuda kullanımı, sesin sürümünü ve kesin ayarları koruyan bir proje olarak açar. Oradaki **New tune**, yeni bir beste oluşturur ve sesi korur. Ayarları değiştirirsen **Put the sound back** sese geri döner ve **Keep as my own** bağımsız bir melodiyle devam eder. Seçim yapana kadar proje bu sesten yapılmış olarak kaydedilemez veya indirilemez. Paylaşım bağlantıları yalnızca müzik ayarlarını taşır. Proje ve kayıtlı bir melodi, paylaşım bağlantılarına ve ses dosyasının herkese açık kimlik bilgilerine dahil edilmeyen ses notlarını da saklar. Sesin tam hâlinin oluşturucunun gelecekteki sürümlerinde de korunması gerekiyorsa render edilmiş bir kayıt sakla.

<!--i:eti-checklist-->
## Kurallar

**Rules**, insanların neleri değiştirebileceğini, nelerin sabit kalacağını ve Lolly'nin neleri denetleyebileceğini belirler.

![Lolly Demo'da Rules: her biri Checked in Design ve Required veya Advisory olarak işaretlenmiş dört kurumsal kural, ardından örnekleri render edilmeye hazır Try your design system in use](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dusage&width=1440&height=1200&dpi=192&waitMs=2400&cropSelector=%23start-panel-usage&format=svg&walker=1&dark=1&filename=bs-usage-rules)

**Brand rules**, kurallarını listeler. **Add rule** (veya **Add your first rule**) kısa bir form açar:

- kendi sözcüklerinle bir **Rule name**, örneğin *Beacon vurgu renkleri*;
- **Check**: **Colour choices**, **Font choices**, **Fixed artwork** veya **Text length**, kullandığı marka rolüyle birlikte, role verdiğin ad altında;
- uygulandığı **Example** (Poster, Title slide, Content slide veya Lolly Chart), **Mode** ve **Required** mı yoksa **Advisory** mi olduğu;
- **Reviewed by**, ardından **Save draft** veya **Approve & save**.

Onay, kendi kararını bu cihazda kaydeder. Onaylanmış zorunlu kurallar yeniden kullanılabilir posteri sınırlar ve denetimler yalnızca örnek PNG'leri kapsar; başka hiçbir aracı değiştirmezler.

Bir tasarım sisteminin token dosyasındaki onaylanmış renk eşleşmeleri, metin kalınlığı ve hizalama veya yüzey başına bir logo gibi kurallar burada **Checked in Design** olarak listelenir. Lolly Design, dışa aktarma panelindeki **Before you export** kartında bunları katman katman denetler ve `lolly check`, kayıtlı bir Lolly Design belgesi için aynısını yapar ([Dışa aktarmadan önce](/info/design.html#before-you-export)). Bu derlemede denetleyicisi olmayan bir kural, sağlandığı gibi korunur ve **Unchecked** olarak işaretlenir.

Lolly Demo, onaylanmış dört kurumsal kural getirir. Başlıklar asla tümü büyük harflerle dizilmez: bu kural zorunludur, bu yüzden `lolly check`, tümü büyük harfli bir başlığı hata olarak bildirir. Diğer üçü tavsiye niteliğindedir. Gövde metni sola hizalanır. Ana logolar açık yüzeylerde, ters renkli logolar koyu yüzeylerde yer alır. Kesikli çizgiler buraya bırak anlamına gelir.

**Try your design system in use**, **Render & check examples** ile mevcut revizyondan dört örnek render eder. Bir **Mode** seç ve başlık, destekleyici metin ve slayt metni için **Try your own text** kullan. Her örnek, **See checks & sources** ve **Download check report** ile nelerin ölçüldüğünü bildirir. **Make reusable poster**, sabit düzeni ve onaylanmış girdi seçeneklerini içeren bir `.lolly` indirir. Örnekler yereldir: bir denetim çalıştırmak hiçbir şeyi yayımlamaz veya onaylamaz.

Sabit bir markayla gelen bir derleme, aynı kuralları ve örnekleri *This brand is set* altında salt okunur olarak gösterir.

<!--i:eti-graduation-cap-->
## Beceriler

**Skills**, etkin tasarım sisteminin [marka becerilerini](/info/brand-skills.html) listeler: insanlar ve yapay zekâ ajanları için, her disipline bir tane olmak üzere markanın yazılı standartları. Her satır disiplini, markanın kendi durumunu (**Draft** veya **Approved**), becerinin herkese açık mı yoksa kurum içi mi olduğunu ve revizyonunu verir. Beceriyi kapsamıyla birlikte okumak için bir satır seç; kapsam, becerinin satırlarını token'larınla karşılaştırır: Lolly'nin neleri denetlediği, nelerin çeliştiği, nelerin uyumlu olduğu ve nelerin yalnızca yol gösterici olduğu.

**Download skill (.zip)**, beceriyi bir ajan aracı için Agent Skills klasörü olarak yazar; katalog bağlantıları bu Lolly'yi işaret eder. **Copy as one file**, aynı metni bir sohbet penceresi için panoya koyar. Kendine ait becerileri olmayan bir tasarım sistemi, Lolly'nin her okunduğunda sistemin token'larından ve kurumsal kurallarından yazdığı bir temel metin listeler. Bölüm becerileri okur ve asla düzenlemez.

<!--i:eti-upload-->
## Bir markayı içeri al

**Add from…** çubuktadır ve biçiminin ne olduğunu değil, elinde ne olduğunu soran bir seçici açar:

- **Design tokens or a design file**: DTCG veya Tokens Studio JSON, bir Penpot projesi, token kümeleri içeren bir zip, bir Lolly tasarım sistemi paketi, bir SVG, bir `DESIGN.md` veya bir marka sayfası klasörü.
- **PDF**: renkleri, logoları ve gömülü yazı tipleri için bu cihazda okunan bir sunum veya kılavuz dosyası.
- **Logo or screenshot**: bir görsel, bu cihazda okunarak önerilen bir palete dönüşür. Renkleri okur, yazı tipini veya düzeni değil.
- **Saved web page**: bir HTML dosyası ve CSS dosyaları ya da yapıştırılmış HTML veya CSS; en fazla 20 dosya ve 2 MB. Yalnızca sağladığın metin okunur: bağlı kaynaklar alınmaz ve betikler çalışmaz.
- **Font file**: TTF, OTF veya WOFF. Yazı tipinin kurulduğu Type bölümünü açar.
- **Website**: renkleri ve tipografisi için okunan tek bir sayfa. Bu kutucuk yalnızca bir sayfayı okuyabilen cihazda görünür ve hangi okuyucuyu kullandığını söyler: bu cihazdaki uygulama veya arka plan sekmesinde senin hesabınla oturum açmış tarayıcı uzantısı. URL yazmak yalnızca alanı doldurur; alma düğmesine basmak izin vermektir.

Tasarım dosyası kaynağını seç; sonraki kart kabul edilen biçimleri simgeli kutucuklar olarak listeler. Kart tek bir bırakma hedefidir. Stüdyoya da dosya bırakabilirsin.

![İçeri aktarma kartı - kabul edilen biçimler simgeli kutucuklar olarak ilk sırada ve kartın tamamı tek bir bırakma hedefi](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

- Bir **Lolly tasarım sistemi paketi** (`.lolly` veya eski bir `.zip`) tek adımda kurulur.
- Bir **Penpot** dışa aktarması (`.penpot`), tasarım token'larını getirir.
- Bir **Design Tokens** (W3C DTCG) veya **Tokens Studio** dosyası (`.json`), token'larını getirir. Okuyucudan talimatları yok saymasını isteyen, izinleri olduğunu iddia eden veya kod çalıştırmasını isteyen bir açıklama dışarıda bırakılır ve içeri aktarma nerede bulunduğunu söyler.
- Bir **düz SVG**, aralarından seçim yapacağın renkler için taranır; ilki primary rengin olur.
- Bir **`DESIGN.md`** (`.md`), token'ları yazıldığı gibi **Try these colours** ekranına gider. Düzyazısı taslak marka becerisi olarak saklanabilir ve kart, okuyucudan talimatları yok saymasını veya kod çalıştırmasını isteyen ya da izin iddiasında bulunan satırları işaretler. Skills bölümünde **Keep this skill** düğmesine basana kadar ajanlar ve marka sayfaları taslağı görmez; saklanan beceri kurum içi olarak kalır.
- Klasör olarak seçilen, bırakılan veya zip olarak verilen bir **marka sayfası klasörü** aynı incelemeye gider. Her dosya, klasörün `brand.json` dosyasına göre denetlenir; eşleşmeyen tek bir dosya tüm klasörün reddedilmesine yol açar. İçeri aktarma token'ları ekler. Logolar ve yazı tipleri klasörde kalır.

::: warning Talimat denetimi satır satır okur
Bir token dosyasının açıklamalarındaki talimatları dışarıda bırakan denetim, satır satır okur ve başka ifadeleri kaçırır. Tanımadığın birinden gelen dosyayı, token'ları uygulamadan önce oku.
:::

Lolly, bir marka sayfasını sağladığın dosyalardan okur. Başka bir sitenin adresine bağlanıp sayfayı almaz.

### Kendi renk sözcükleri olan bir dosya

Bir token dosyası veya `DESIGN.md`, renkleri için main, accent, supporting ve tertiary gibi kendi sözcüklerini kullanabilir. Lolly böyle sözcükler bulduğunda, herhangi bir şey uygulanmadan önce inceleme her sözcüğü listeler: sözcük, her görünümdeki rengi, geldiği token ve Lolly'nin önerdiği yorum. Lolly, model kullanmadan, kısa bir listeye göre yalnızca sözcüklerden yorum önerir. Listede olmayan bir sözcük, markanın kendi sözcüğü olarak **By name only** ile gelir. Herhangi bir sözcüğü yeniden adlandırabilir, ne için kullanıldığını söyleyebilir, ona başka bir yorum verebilir veya adlandırılmış bir renk olarak kalması için işaretini kaldırabilirsin.

**Install with these roles** rolleri yazar; **Install without roles** dosyayı geldiği gibi kurar. Böyle sözcükleri olmayan bir dosya bu adımı atlar. Lolly'nin yazdığı bir dosya gibi kendi rollerini belirten bir dosya, bunları yazıldığı gibi gösterir ve değiştirmeden kurar; daha sonra Colours bölümünde düzenleyebilirsin. Terminalde inceleme yoktur: `lolly system import`, belirtilmiş bir kaydı korur ve diğer dosyaların sözcüklerini adlandırılmış renkler olarak bırakır.

### Bir referansı incele

Bir logo, ekran görüntüsü, web sitesi veya kayıtlı sayfa **Try these colours** ekranını açar: önerilen renklerde bir örnek, değiştirebileceğin bir **Main colour** ve yeni bir sistem için bir ad. Bir kutu, uygulamanın ne yaptığını söyler: etkin token ayarlarını oluşturulan palet ve varsayılan stillerle **değiştirir**, yazı tiplerini ve kitaplık dosyalarını **korur** ve önceki sistem **geri getirilebilir**. **Apply suggested settings** bir kontrol noktası alır, ardından açık ve koyu paletleri uygular. **Restore brand settings**, eski ayarları geri getirebilir. **Change reference**, başka bir kaynak seçer.

::: details Bir referansın okudukları ve tasarım bağlamı raporu
**Palette, source details and individual choices**, nelerin okunduğunu, bulunan yazı tipi adlarını ve önizlemenin kontrastını gösterir. Yazı tipi adları yalnızca öneridir; yazı tipini Type içinde kurarsın. Kaynak ayrıntıları, gözlemlendiği yerlerde tipografi, boşluk, iç boşluk ve köşe değerlerini içerebilir; aksi durumda **Not observed** olarak etiketlenir. Kayıtlı bir sayfa veya yerel uygulamayla web sitesi okuması, sayfanın kullanmıyor olabileceği tanımlanmış stilleri bildirir. Tarayıcı uzantısı, görünür öğelerden alınan bir örnekte ölçülen stilleri bildirebilir. Bunlar gözlemdir: hiçbir şey kurulmaz ve kaynağın aralıkları hiçbir zaman seninkilerin yerini almaz. **Choose individual items in the tray**, tek tek öğeleri saklar. **Download design context**, gözlemler, önerilen token'lar ve kaynak bilgileri içeren bir JSON raporu kaydeder (sağlanan HTML veya CSS'nin SHA-256 özetiyle birlikte). Rapor ham sayfa metni içermez ve imzalı bir Content Credential değildir.
:::

PDF ve tasarım dosyası içeri aktarmaları kendi inceleme denetimlerini korur. **Tray** içindeki öğeler, o tür malzemenin ait olduğu bölümde onları ekleyene kadar hiçbir şeyi değiştirmez. `#/start?source=<kind>`, seçiciyi bir kaynakta açar (`file`, `pdf`, `image`, `font`, `url`, `page`); `?import` ise düz listeyi açar.

### Bir görünüm bul ve karşılaştır

Board'dan veya Settings içindeki tasarım sistemi listesinden **Find a look** aç. Bu cihazda kayıtlı sistemlere ve yeniden kullanılabilir birkaç Lolly örneğine göz at; ada, renk etiketine veya belirtilmiş yazı tipine göre ara. **Closest to my current palette**, ölçülen renk benzerliğine göre sıralar; eşitlikleri eşleşen yazı tipleri bozar. Bu bir kalite puanı değildir.

Bir görünümü bağlam içinde önizlemek için ona tıkla; önizleme hiçbir şeyi değiştirmez. Karttaki **Use this look**, o görünümü uygular. Kayıtlı bir sistem etkin olur ve bu hiçbir şeyi düzenlemez. Bir örneğin renkleri, olağan kontrol noktasından sonra açık tasarım sistemine eklenir. Sistemin logoları, yazı tipleri ve örneğin tanımlamadığı diğer her şey olduğu gibi kalır. **Compare looks**, her karta bir onay kutusu ekler: yan yana karşılaştırmak için iki tane seç. **Restore brand settings**, önceki görünümü geri getirir. Kayıtlı sistemlerin **Details and design context** altında düzenlenebilir **Search tags** alanı vardır. Örnekler özgün Lolly renk tarifleridir; kazınarak toplanmış bir koleksiyon veya hesap yoktur.

![İki renk sisteminden birini uygulamadan önce Lolly'de Sunroom ve Orchard'ı yan yana karşılaştır.](/t/url-shot?url=%2F%23%2Fstart&width=1280&height=900&dpi=96&waitMs=3000&format=svg&filename=brand-compare-looks&try=1&drive=click%3A%5Bdata-ds-door%3D%22looks%22%5D%3Bwait%3A500%3Bclick%3A%5Bdata-looks-compare-toggle%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Asunroom%22%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Aorchard%22%5D%3Bclick%3A%5Bdata-looks-review%5D%3Bwait%3A500&cropSelector=.ds-looks-comparison&waitSelector=%5Bdata-ds-door%3D%22looks%22%5D&walker=1&rasterDpi=96)

<!--i:eti-package-->
## Tasarım sistemini sakla ve taşı

### Bir markayı cihazlar arasında taşı

**Export**, tek bir **`LollyBrand-….lolly`** dosyası yazar: token'ların, yazı tiplerin, logoların ve tema tercihin, içeri aktarmada denetlenen bir bütünlük bildirimiyle birlikte. 1.0.7 öncesi web sürümleri dosyayı `.zip` olarak adlandırıyordu ve Lolly bu yazımı hâlâ kabul eder. **Tokens (.json)**, bir depo, bir derleme adımı veya başka bir token aracı için, yazı tipleri veya logolar olmadan düz tasarım token'ları belgesini yazar.

Birini geri almak için **Add from… → Design tokens or a design file** kullan veya dosyayı stüdyoya bırak. Bir meslektaşın sana markayı böyle verir ya da sen onu ikinci bir kuruluma böyle taşırsın; hesap ve bulut olmadan. [İş ortaklarıyla çalışma](/info/partners.html), markanı alan kişi başka bir kuruluşta çalışıyorsa başka neler göndermen gerektiğini kapsar. Komut satırından bir markayı içeri almak için bkz. [`ingest:brand`](/info/configuration.html#brand-packs).

**Fonts for Linux (.rpm)**, eklediğin yazı tiplerini kurulabilir bir RPM olarak paketler. Bunlardan herhangi birini kendin yüklediysen Lolly önce bunları yeniden dağıtma hakkın olduğunu onaylamanı ister.

### Önceki ayarları geri yükle

Çubukta **More** aç, **Restore brand settings** seç, tarihli bir kontrol noktası seç ve **Restore** düğmesine bas. Bu, etkin markanın renklerini, tipografi ayarlarını ve diğer token'larını geri yükler; yazı tipi ve görsel dosyaları olduğu gibi kalır. Lolly önce mevcut ayarlarını **Before restore** olarak kaydeder, böylece tarayıcıyı kapattıktan sonra bile bir geri yüklemeyi tersine çevirebilirsin. En son 20 kontrol noktası bu cihazda tutulur. Stüdyo **Saving…** gösterirken yapılan bir düzenleme, sayfa yeniden yüklendiğinde korunur ve bir kart, kaydı tamamlanmamış değişiklikleri geri yüklemeyi sunar.

### Sürümler

Yayımlanmış bir sürüm, bu cihazda tutulan **kalıcı, adlandırılmış bir kopyadır**. Hiçbir zaman değişmez, bu yüzden onu sabitleyen bir araç veya bağlantı (`designv` ile) aynı şeyi çizmeye devam eder. Sana ait bir şey içeren bir sistem, çubuğun **More** menüsünde **Versions & publishing** gösterir; ilk yayımlamandan sonra **Versions** bölümlere katılır. `#/start?area=versions`, Versions bölümünü açar.

::: warning Yayımlanmış bir sürüm kalıcıdır
Henüz silme yoktur ve panel bunu söyler. Yayımlama geri alınamaz; geri yükleme alınabilir. *Restore latest from this version*, hemen **Undo** sunulan sıradan bir düzenlemedir.
:::

**Uyumluluk kartının başında kaldırmalar yer alır**, çünkü kaldırılan bir token bir aracı bozar.

**Publish only**, araçların neyi izlediğini değiştirmeden bir sürümü saklar; **Publish and make active**, araçların ve uygulamanın o sürümü izlemesini sağlar. **Follow the latest again**, her düzenlemeyi hemen kullanıma alır.

### Bir marka sayfası yayımla

Bir [marka sayfası](/info/brand-page.html), insanlar ve ajanlar için tek bir adrestir: logolar, renkler, tipografi ve örneklerden oluşan bir sayfa ve yanında aynı bilgileri içeren dosyalar. Versions & publishing altındaki **Publish a brand page**, canlı sayfayı ve sayfanın yanında şunları gösterir:

- **Goes public**: boyutuyla birlikte gruplanmış her dosya.
- **Held back**: nelerin dışarıda kaldığı ve nedenleri. Kayıtlı lisansı olmayan bir logo, adını işaretleyene kadar dışarıda kalır. Bir yazı tipi dosyası, başkalarına aktarılmasına izin veren kayıtlı bir lisans gerektirir ve dosya dışarıda kaldığında sayfa, anahatlara dönüştürülmüş bir örnek gösterir. Kurum içi marka becerileri asla görünmez.
- **What was checked**: her colourway ve mod için renk çiftleri ve kurumsal kurallar. Bunlar ölçümdür, bir hüküm değildir.
- **In your words**: bir kullanım beyanı ve bir iletişim bilgisi. Sayfa senin yazdıklarını gösterir ve Lolly hiçbir lisans veya hukuki iddia eklemez. Bir anahtar, altbilgideki "Made with Lolly" satırını kapatır.
- **On exports**: [sayfanın adresini bu tasarım sisteminin dışa aktarmalarına kaydeden](/info/brand-page.html#lead-back-from-your-files) bir anahtar. Anahtar sen açana kadar kapalıdır, bir `https` adresi gerektirir ve bir paket veya kopyayla taşınmaz. Kilitli bir tasarım sistemi anahtarı göstermez, çünkü kararı yöneticisi verir.

**Download folder**, klasörü seçtiğin yerde barındırman için ZIP olarak kaydeder. Klasörü barındırana kadar hiçbir şey herkese açılmaz. Terminalde `lolly system publish --out=<dir>` aynı klasörü yazar. Marka sayfaları sunan bir örnek, kendi adresine **Publish to** seçeneğini de sunar: tek bir açık düğme basışıyla, örneğin onay zinciri varsa bu zincir üzerinden. Yönetilen bir tasarım sistemi yalnızca yöneticisi izin verdiğinde yayımlanır.

### Bir ajan bağla

**Connect an agent** de aynı yerdedir; yapıştırman için metin verir ve her seçeneğin neler yapabileceğini söyler:

- Bir projedeki **`AGENTS.md`**: ajanlar sistemin adlarını ve kurallarını okur. Hiçbir şey çizmez ve sunucu gerektirmez.
- **Lolly'nin herkese açık sunucusu**: burada hangi sistem açık olursa olsun Lolly Demo ile çizer. Anahtar gerektirmez.
- **Senin örneğin**: örneğin barındırdığı sistemlerle çizer ve bir ortam değişkeninden hizmet token'ı okur. Panel değişkenin adını verir ve hiçbir zaman token göstermez.

Barındırılan hiçbir sunucu senin sisteminle çizim yapmıyorsa panel bunu söyler.

<!--i:eti-layers-->
## Tasarım sistemlerini yönet

Sistemler arasında geçiş yapmak, sistem eklemek veya kaldırmak için **Settings → Preferences → Design systems** aç. **Open**, bir sistemi seçer ve burada açar; **Make a new one**, yerel bir sistem oluşturur ve ad alanı hazır olarak açar. Tüm cihaz için aynı anda tek bir sistem etkindir. [Marka mimarileri](/info/brand-architectures.html), bir markanın ne zaman kendine ait bir tasarım sistemine ihtiyaç duyduğuna karar vermene yardımcı olur.

**Bir sistemin geldiği yer.** Bir dağıtımın kataloğunun sağladığı sistemde **Came with this app**, bir örneğe bağlı uygulamada ise **From this instance** yazar. Kimin sağladığını, token varlığını ve ad alanını, bilinen sürümünü veya sağlama toplamını görmek için **Catalogue source** seçeneğini genişlet; yenileme başarısız olursa önbellekteki malzeme etiketlenir.

**Yönetilen sistemler salt okunurdur.** Kataloğu sistemi kilitlediğinde sistemde **Managed by this instance** (örneğe bağlı olmayan masaüstü uygulamasında **Managed by this app**) yazar. Yönetilen bir sistemi kullanabilir ve indirebilirsin. Burada birini açmak, **Make an editable copy** ve **Switch** ile salt okunur notunu, ardından düzenleme denetimleri olmadan renk rollerini ve token'larını gösterir. Yönetilen sistem önce gelmiş olsa bile kendi yerel sistemlerin düzenlenebilir kalır. Tek bir sabit markası olan bir derleme, Lolly Design System Setup'ı *This brand is set* ekranında, okuyabileceğin marka token'ları ve kullanım kurallarıyla açar.

**Sağlanan diğer her sistem senindir**; lolly.tools üzerindeki Lolly Demo ve Lolly Starter dahil, bunları gizleyebilir, düzenleyebilir ve sıfırlayabilirsin. Birini düzenlemek adını korur ve satırı **Edited here** olarak işaretler. Menüsündeki **Reset to original**, bu cihazda yapılan değişiklikleri atar. Boş başlangıç sistemi istisnadır: oradaki ilk değişiklik sana ait bir tasarım sistemi başlatır ve Lolly adını bir kez sorar. [Lolly Demo kullanımda](/info/lolly-demo-in-use.html#switch-to-your-own), kendi sisteminin nelerin yerini aldığını gösterir.

### Bir tasarım sistemini kaldırma

Bir sistemin menüsünden **Remove** seç; onay, sonrasında hangi sistemin etkin olacağını söyler. Kayıtlı oturumlar, yüklemeler ve başka bir sistemle paylaşılan malzeme kalır.

Sağlanan bir sistemi kaldırmak yalnızca sistemi gizler: katalog varlıkları kalır, **Bring back** onu yeniden gösterir ve diğer her şeyi kaldırırsan kendiliğinden geri gelir. İçeri aktarılmış veya düzenlenmiş bir kopyayı kaldırmak, sağlanan sistemi, logolarını veya yazı tiplerini kaldırmaz. Kopya etkinse sağlanan sistem yeniden etkin olur. Etkin, barındırılan bir kopyayı kaldırmak yalnızca o kopyanın bağlantısını temizler; ayrıca seçilmiş bir örnek seçili kalır.

::: details Bir sunucunun sağladığı tasarım sistemini değiştirme
Bir sunucunun sağladıklarını değiştirmek bir yöneticinin görevidir: işletmecisi kaynak kataloğu değiştirir ve yeniden dağıtır ya da bir Lolly Work yöneticisi sunucu değişikliğini inceler ve uygular. Buradaki düzenlemeler bir istisna dışında yerel kalır. Sana `brand.edit` yetkisi veren bir Lolly Work örneğinde yönetilen sistem, o örnek için bir düzenleme kopyası açan **Edit for** seçeneğini de sunar. **Versions** içinde o örneğe yönelik **Send to**, renklerini, colourway'lerini, renk rollerini ve marka sayfası adresini geri gönderir. [Bu örneği stüdyodan düzenle](/info/work-design-system-administration.html#edit-this-instance-from-the-studio), bir düzenlemenin neleri değiştirebileceğini ve örneğin değişikliği nasıl sunduğunu kapsar. Bkz. [Bir katalog tasarım sistemini kaldırma](/info/configuration.html#removing-a-catalogue-design-system) ve [Yapılandırma](/info/configuration.html#supplied-and-local-design-systems).
:::

<!--i:eti-code-->
## Tasarım bağlamını uygulama dışında kullan

**Download design context**, token belgesini, çözümlenmiş renkleri, belirtilmiş yazı tipi ailelerini, varlık kimliklerini, kaydedilmiş kaynak kanıtlarını, kapsamı ve açık kuralları kaydeder; yazı tipi dosyaları veya sahiplik kanıtı içermez. Komut satırı dosyayı sunucu olmadan okur: `lolly system import`, onu terminalin tasarım sistemi yapar ve `lolly system check`, Lolly Design girdilerini kayıtlı bağlama göre denetler. [Tasarım sistemini getir](/info/cli.html#bring-your-design-system) içeri aktarmayı, [Bir komutun kullandığı tasarım sistemi](/info/cli-decks.html#which-design-system-a-command-uses) ise denetimi kapsar. Bir MCP istemcisi aynı özeti `lolly://design-context` üzerinden okur ([MCP Sunucusu](/info/mcp.html)).

<!--i:eti-map-pin-->
## Sırada nereye gitmeli

- **[Lolly'yi kullanma](/info/using.html)**: araçlar, kaydetme, paylaşma ve Assets.
- **[Marka mimarileri](/info/brand-architectures.html)**: bölümlerin, ürünlerin, desteklenen markaların, müşterilerin ve sezonların tasarım sistemleri, colourway'ler ve logo kimlikleriyle nasıl eşleştiği.
- **[İş ortaklarıyla çalışma](/info/partners.html)**: markanı bir iş ortağıyla paylaşma ve sana verilen bir markayla çalışma.
- **[Marka sayfaları](/info/brand-page.html)**: tasarım sistemini tek bir adreste, basın kiti ve ajan kiti olarak yayımla.
- **[Tasarım token'ları](/info/design-tokens.html)**: markanın yazıldığı token modeli.
- **[Dosya dışa aktar](/info/exporting.html)**: baskı birimleri, CMYK ve markanın render edildiği biçimler.
