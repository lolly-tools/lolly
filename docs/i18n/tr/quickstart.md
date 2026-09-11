# Hızlı başlangıç

Lolly, kurallarını - renkleri, tipografiyi, yerleşimleri, mantığı - herkesin birkaç alanı doldurarak bitmiş dosyalar üretebileceği araçlara dönüştürür: görseller, PDF'ler, sosyal medya kartları, video. Öğrenilecek pek bir şey yok, yüklenecek hiçbir şey yok: üretmek de dışa aktarmak da, çevrimiçi ya da çevrimdışı, kendi cihazında çalışır.

Önce okunması gereken tek sayfa bu. Seni üretken kılan iki şey var: **Lolly'yi kendine göre ayarlamak** ve **halihazırda elinde olanı içeri almak** (tasarım dosyaların ve token'ların). Geri kalan her şey bir bağlantı uzakta.

> Lolly'de yenisin ve hemen bir şey üretmek mi istiyorsun? [60 saniyede bir şey üret](/info/make-something.html) sana üç örnek üzerinden yol gösterir; ya da [uygulamayı aç](/#/), galeriden bir araç seç, boşlukları doldur ve **Export**'a bas. Ürettiğin şeyin *senin* markanı taşımasını istediğinde buraya geri dön.

![Utilities görünümü - Strip Hidden Data, Compress PDF ve Convert Image gibi cihaz üzerinde çalışan iş atları, hepsi tek yerde](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## 1. Kendine göre ayarla - tasarım sistemini yapılandır

Lolly'deki markan küçük bir **design-tokens** belgesidir - renkler, fontlar ve birkaç kural - ve her araç bunu temel alarak render eder. Bir kez ayarla, ürettiğin her şey denetim sayesinde değil, kuruluşu gereği markaya uygun olsun. Üç giriş yolu var; markanın hâlihazırda durduğu yere uyanı seç.

### Sıfırdan başla (tasarım sistemi oluşturucusu)

İlk açılışta seni **galeri** karşılar; üzerinde üç giriş yolu sunan kısa bir hoş geldin penceresi olur - **Make it yours** (`#/start` adresindeki Brand Studio), **Bring your design** (bir Figma, Penpot, InDesign ya da PDF dosyası bırak, düzenlenebilir bir yerleşim olarak açılsın - aşağıdaki [Halihazırda elinde olanı içeri al](#2-bring-in-what-you-already-have) bölümüne giden en hızlı yol) ve **Explore the community tools** - ayrıca İngilizce senin dilin değilse bir dil sırası. İlk kartı seç, [**Brand Studio**](/info/brand-studio.html) açılsın. Ona bir ad ve bir ana renk ver; Lolly bundan eksiksiz, erişilebilir bir palet *türetir* - açık/koyu yüzeyler, metin, vurgular - motorun her yerde kullandığı aynı renk matematiğiyle.

![Brand Studio'nun Colours odası - bir ana renk ve Lolly'nin ondan türettiği erişilebilir palet](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours) Bir font seç, bir dakikadan kısa sürede çalışan bir markan olsun. Sonrasında stüdyonun altı odası - Overview, Colours, Type, Logos, Tokens, Files - markanı istediğin kadar ileri götürmene izin verir; sıra fark etmez, her geri dönüşünde herhangi bir yerini yeniden inceltebilirsin. Panonun **Design system** sekmesi (`#/d`) sonucu salt okunur gösterir ve düzenlemenin yapıldığı `#/start` adresine yönlendirir (markası kilitli bir Lolly sürümünde değilsen; orada marka sabittir ve değiştirilecek bir şey yoktur).

### Halihazırda sahip olduğun bir markayı içeri aktar

Markan zaten design token olarak kayıtlıysa - **Penpot**, **Tokens Studio** (Figma) ya da herhangi bir düz **DTCG** dosyasından - yeniden yazmak yerine toptan içeri al. İki yol var:

- <!--i:palette--> **Uygulamada:** [tasarım sistemi oluşturucusu: Brand Studio](/info/brand-studio.html) (`#/start`) bunu oda rayının altındaki **Add from…** ile alır - bir token dosyası, bir Penpot dışa aktarımı, bir SVG ya da bir `LollyBrand` paketi. Bırak, palet anında canlansın.
- <!--i:code--> **Komut satırından**, yeniden kullanılabilir bir marka paketi kurmak için:

```bash
# a monolithic tokens.json, a one-file-per-set directory, or a Penpot project archive
npm run ingest:brand -- ./my-tokens.json --name acme --label "Acme" --activate
```

`ingest:brand`, Penpot / Tokens Studio'nun aynı belgeyi dışa aktardığı üç kabın üçünü de kabul eder - tek bir `tokens.json`, bir dizin (`$metadata.json` + set başına dosyalar) ya da bir `project.penpot` arşivi. `--activate` ile markayı bir profil olarak kaydeder, ona geçer ve kataloğu yeniden derler. Marka paketleriyle profillerin birbirine nasıl oturduğu için [Yapılandırma](/info/configuration.html) sayfasına bak.

### Uygulamada ince ayar yap

Bir marka etkinleştikten sonra onu [**Brand Studio**](/info/brand-studio.html) (`#/start`) içinde şekillendirmeye devam et - bir rengi ya da bir rolü değiştir, uygulamadaki her önizleme sen yazarken güncellensin. (Panonun `#/d` adresindeki **Design system** sekmesi markayı salt okunur *gösterir*; düzenleme Studio'da yapılır.)

![Panonun Design-system sekmesi - etkin marka salt okunur gösteriliyor](/t/url-shot?url=%2F%23%2Fd%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=dashboard-brand) Aynı marka **Profile → Your brand** kartında da özetlenir. Fontlar gerçektir: Google Fonts'tan birini seç, Lolly dosyayı bir marka varlığı olarak **cihazında** saklasın; böylece tipografin çevrimdışı da yanında gelir ve render sırasında hiçbir şey indirilmez.

Sonuçtan memnunsan **markayı bir `LollyBrand` paketi olarak dışa aktar** - bir iş arkadaşının içeri aktarıp tıpatıp aynı paleti, fontları ve kuralları alabileceği tek bir dosya. Bir marka, arada bir sunucu olmadan insanlar ve makineler arasında böyle dolaşır.

> **Marka token'ları iki yönde de gidip gelir.** Lolly'nin markası doğrudan DTCG token'larından *ibaret* olduğu için - Penpot'un kendiliğinden okuyup yazdığı, Tokens Studio'nun Figma'ya taşıdığı format - tasarım yaparken kullandığın palet ile Lolly'nin *dayattığı* palet tek bir belgedir; elle senkron tuttuğun iki liste değil. Bkz. [Design Tokens](/info/design-tokens.html).

## 2. Halihazırda elinde olanı içeri al

Boş bir sayfadan başlamıyorsun. Lolly, zaten sahip olduğun tasarım işlerini ve açık formatları açar.

### Açık kaynaklı tasarım dosyaları

**Figma, Penpot, Illustrator, InDesign ya da herhangi bir SVG uygulamasında** bitirdiğin işlerin, onları çizdiğin uygulamada kilitli kalması gerekmez. **Design**'ı aç, **Import a design**'a tıkla; dosya düzleştirilmiş bir resim olarak değil, *canlı bir yerleşim* olarak açılır. Her katman düzenlenebilir bir kutuya dönüşür: metin yeniden yazılabilir kalır, şekiller şekil kalır, görseller kitaplığına iner ve karmaşık vektör çizimleri sadakatle korunur. Dosya, marka yazı karakterlerine ve renk kurallarına uydurulmuş olarak gelir.

| Elindeki | İçeri alma yolu |
|---|---|
| Bir Figma frame'i | Yerel `.fig` (File → Save local copy) ya da bir SVG dışa aktarımı |
| Bir Penpot tasarımı | `.penpot` dışa aktarımı ya da herhangi bir SVG |
| Bir Illustrator dosyası | Yerel `.ai` (PDF uyumlu) ya da `.pdf` - doğrudan açılır |
| Bir InDesign yerleşimi | `.idml` (File → Export → InDesign Markup) |
| Başka her şey | **Herhangi bir SVG** - herkese açık giriş kapısı |

İçeri aktarmanın tamamı **cihazında** olur - dosya tarayıcında ayrıştırılır ve hiçbir şey yüklenmez. Tüm ayrıntılar ve tam olarak nelerin aktarıldığı [Import a design](/info/design-import.html) sayfasında.

Elinde bir **PowerPoint sunumu** mu var? `.pptx` dosyasını **Deck Builder** üzerine bırak, markana oturmuş halde slayt slayt düzenle - ya da **Rebrand a Deck**'i çalıştır, aynı sunumu grafikleri ve animasyonları bozulmadan yeniden temalanmış olarak geri al.

### Tek seferlik bir işten şablona

Asıl kazanç şu: içeri aktarılan bir yerleşim sıradan bir Design oturumudur, yani **kaydettiğin** anda bir URL'de yaşar. Lolly'si olan herkes o URL'yi açıp metinleri değiştirebilir, bir görseli değiştirebilir ve kendi sürümünü render edebilir - tasarım uygulamasına gerek yok, kilitli parçalar da kilitli kalır. Tek seferlik bir tasarım, yeniden kullanılabilir bir araca dönüşür. Bütün fikir bu ve buraya tek satır yapılandırma yazmadan varılıyor.

### Açık veri ve açık araçlar

[Topluluk araç seti](/info/builders.html) açık kaynaklıdır ve markadan bağımsızdır - QR kodları, sokak haritaları, filtreler, gizlilik araçları - ve markanı etkinleştirdiğin anda *senin* markanla render eder.

Araçlara kendi açık verini de ver: bir **CSV** ya da **JSON** tablosunu yapıştır veya sürükleyip bırak, aracın tekrarlanan alanları oradan dolsun; her satır için bitmiş bir varlık.

## 3. Bir şey üret, sonra paylaş ya da otomatikleştir

Etkin bir marka ve elindeki malzemeyle her araç bitmiş bir dosya üretir:

- <!--i:download--> Herhangi bir aracı **SVG, PDF, PNG, JPG, WebP, video** ve daha fazlasına **render et** - gerektiğinde gerçek baskı boyutlarında ve fiziksel birimlerle. Bkz. [Dışa aktarma & formatlar](/info/exporting.html).
- <!--i:link--> **Bağlantı paylaş.** Her araç durumu bir URL'dir, yani bitmiş bir varlık yeniden üretilebilir ve parametreyle adreslenebilir - bağlantıyı kaydet, istediğinde yeniden üret.
- <!--i:layers--> **Toplu yap.** [Toplu ızgarada](/info/exporting.html) bir şablonu hesap tablosundan sür: her satır için bitmiş bir varlık.
- <!--i:cpu--> **Otomatikleştir.** Aynı render [CLI](/info/cli.html) üzerinden ve bir [yapay zekâ ajanı](/info/ai-agents.html) üzerinden de çalışır - URL zaten API'dir.

"URL zaten API'dir" sözü birebir doğrudur. Aşağıdaki grafiği kimse çizmedi: türü, başlığı ve bütün veri tablosu adres çubuğuna yazıldı ve aynı bağlantı, her cihazda aynı grafiği render ediyor.

![Her değeri bir tıklama yerine sorgu parametresi olarak gelen, aylık kayıtları gösteren bir alan grafiği](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Darea%26d%3DMonth%2CSignups%250AJan%2C120%250AFeb%2C180%250AMar%2C265%250AApr%2C340%250AMay%2C455%26t%3DSignups%2520this%2520year%26full&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-d3-url-chart)

## Bundan sonra nereye

Burada ne yapmak istediğine göre üç yol:

- <!--i:people--> **[Üretenler için Lolly](/info/creators.html)** - bir şeyler üretiyorsun. Avantajlar ve uygulamadan en iyi şekilde yararlanmanın yolları.
- <!--i:code--> **[Geliştiriciler için Lolly](/info/builders.html)** - araç yazıyor, entegre ediyor ve dağıtıyorsun. Teknik dokümantasyon.
- <!--i:shieldcheck--> **[Operatörler için Lolly](/info/operators.html)** - bir kurum genelinde markadan, güvenlikten ve yaygınlaştırmadan sen sorumlusun.
