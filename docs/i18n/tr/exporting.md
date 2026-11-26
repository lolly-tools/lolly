# Dosya dışa aktar

Hap biçimindeki **Export | Save** düğmesinin sol yarısı olan **Export** düğmesine bas, dosya adının yanından bir biçim seç ve **Download** düğmesine bas. Dosya cihazında oluşturulur.

Dosya, tuvalde gördüklerini içerir. Biçim menüsü yalnızca bu aracın bu tarayıcıda oluşturabildiklerini listeler.

Çoğu iş için üç biçimden biri gerekir:

| İçin | Seç | Çünkü |
|---|---|---|
| Bir ekran, mesaj veya slayt | **PNG** | Her uygulama açar ve araç sunduğunda saydam arka planı korur |
| Bitmiş bir sayfa veya basılacak herhangi bir şey | **PDF** | Göründüğü gibi basılan gerçek bir sayfa boyutu; araç sunuyorsa **Print PDF**, matbaa için CMYK sürümüdür |
| Her boyutta net kalması gereken görseller | **SVG** | Vektör şekiller |

::: check Dosyayı kullanılacağı boyutta kontrol et
Dosyayı göndermeden önce, hazırlandığı ekranda aç veya gerçek boyutunda yazdır.
:::

::: details Lolly Work ile onaylar ve teslimat (isteğe bağlı)
[Lolly Work çalıştıran bir kuruluş](/info/organisation.html), üyelerinin hangi biçimleri ve dışa aktarma ayarlarını göreceğini seçebilir. Onay gerektiğinde **Request approval**, **Download** düğmesinin yerini alır. Kullandığın kurulumun gösterdiği politikayı izle.

Lolly Work ayrıca onay adımları, teslimat makbuzları ve denetim kaydıyla yapılandırılmış S3, WebDAV ve HTTP hedeflerine dosya teslim edebilir. Bu teslimat dosyayı kuruluşun hizmetine gönderir. Sıradan bir indirme cihazında kalır. Kişisel Send hedefleri ve kuruluş teslimatı ayrı yapılandırılır.

Sistem yöneticileri bunu [kuruluş teslimat kılavuzuyla](/info/work-delivery.html) kurar. Kuyruğa alınmış sunucu render'ları ve toplu işler için [CLI toplu iş ve otomasyon](/info/cli-automation.html#organisation-jobs-with-lolly-work) sayfasına bak.
:::

<!--i:eti-cpu-->
## Dışa aktarma nasıl çalışır

Üç yol bir dosya üretir. Çoğu araç **tuvali render eder**. Metin ve veri biçimleri (HTML, Markdown, TXT, JSON, CSV, ICS, VCF) **aracın içeriğinden üretilir**. *Lolly Strip Hidden Data* gibi gizlilik yardımcı araçları, cihazında **seçtiğin dosyayı dönüştürür**. Sonuçta tuval, filigran veya eklenmiş meta veri bulunmaz.

![Üç dışa aktarma yolu bitmiş bir dosyada birleşir: tuvali render et, içerikten metin veya veri üret ya da seçilen dosyayı cihazda dönüştür.](/info/diagrams/concepts/three-export-paths.svg)

Aracın yazarı, dışa aktarma panelinin hangi eylemleri sunacağını seçer. Varsayılan küme Copy, Download ve Save'dir.

- <!--i:download--> **Download** dosyayı kaydeder. Sonradan bulamazsan [İndirdiğin dosyayı bul](/info/find-your-work.html#find-a-file-you-downloaded) bölümüne bak.
- <!--i:photos--> **Copy** görseli panona koyar. Tarayıcı görsel kopyalayamıyorsa Copy bunun yerine dosyayı indirir ve bunu sana bildirir.
- <!--i:folder--> **Save** geçerli tasarımı Projects içinde tutar ve asla dosya indirmez. **Download** yanındaki **Save as**, nereye kaydedileceğini sorar (bkz. [Kaydetme ve devam etme](/info/using.html#saving-continuing)).
- <!--i:link--> **Share**, Share iletişim kutusunu açar: tasarımı yeniden oluşturan bir bağlantı, ziyaret sırasında uygulanacak anahtarlar (tam ekran, dışa aktarma paneli, açılışta indirme veya kopyalama) ve durumu kompakt bir belirteçte paketleyen isteğe bağlı **Shortest link** (bkz. [URL Modu](/info/url-mode.html)).

**Send to**, dışa aktarma panelinde dosyayı bağladığın bir hizmete gönderen bir karttır. Google Drive, Nextcloud, S3 kovası, Dropbox veya OneDrive'a gönderimin ardından **Create a share link**, ikinci bir yükleme olmadan orada bir bağlantı oluşturabilir. Share iletişim kutusunun **Share through your cloud** bölümü, tek adımda bir `.lolly` dosyası gönderir ve bağlantısını oluşturur. Bağlantı paneli, bağlantıyı kimin açabileceğini, dosyanın nerede bulunduğunu ve bağlantının ne zaman sona ereceğini gösterir. Share iletişim kutusundaki **Links you've shared**, paylaşımı durdurmanı sağlar. Nextcloud bağlantılarının parolası ve son kullanma tarihi olabilir. S3 bağlantıları 1 ila 7 gün geçerlidir ve erken durdurulamaz. Lolly, sunucuda dosyanın kopyasını veya oturum açma belirtecini tutmaz. [Gizlilik](/info/privacy.html#every-network-request-the-app-can-make), her hizmetin ne aldığını listeler.

![Dışa aktarma paneli - biçim, boyut ve Copy / Download / Save / Share eylemleri](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&walker=1&dark=1&filename=export-panel)

Bir tasarım, QR Code bağlantısı içeren bir Lolly Design görsel kutusu gibi başka bir aracın render'ını gömdüğünde, üst tasarımın dışa aktarması iç içe render'ı çizer. SVG ve PDF'de vektör olarak kalır; PNG, JPG ve WebP'de rasterleşir. Gömülü render'a kendi filigranı veya kaynak bilgisi eklenmez; bunları yalnızca bitmiş dosya alır. HTML, Markdown ve TXT dışa aktarmaları birleşik bir render içeremez.

<!--i:eti-file-->
## Bir biçim seç

Dosya adı ve biçim menüsü, **Download** altında tek bir `name.format` çifti olarak birlikte durur.

![Dosya adı alanı biçim seçiciyle birleşmiş; böylece dışa aktarma tek bir name.format çifti gibi okunur](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.filename-extension&walker=1&dark=1&filename=exp-format-picker)

Dosyanın nereye gideceğinden başla. Her kart o hedefe uygun biçimleri listeler.

::: figure exporting-format-chooser
Altı hedef ve her birine uygun biçimler.
:::

Tasarım sisteminin yazı tipiyle yazılmış bir yazı logosu, her harfi dış çizgili bir yol olarak SVG biçiminde dışa aktarılır. Dosya her boyutta net kalır.

Başka bir dildeki metin, sahip olduğun yazı tiplerine bağlıdır. Tasarım sistemindeki bir yazı tipi harfleri içeriyorsa SVG ve PDF onları, sağdan sola satırlar dahil, biçimlendirilmiş ve okuma sırasında dış çizgiler olarak çizer. Hiçbiri içermiyorsa Lolly bir [yedek yazı tipi](/info/fallback-fonts.html) kullanır ve dışa aktarma kartı bu yazı tipini gösterir. Hiçbir yedek yazı tipinin kapsamadığı metin, SVG'de canlı metin olarak kalır ve görüntüleyicinin kendi yazı tipleriyle çizilir. PDF, EPS veya WMF'de ve **Outline fonts** açık olan EMF'de bu metin görsellere dönüşür. Bu sözcükler sayfadaki gibi görünür ancak seçilemez veya aranamaz. Dışa aktarma kartı bu yazı sistemlerini listeler. Vektör metin olarak kalmaları için o harfleri içeren bir yazı tipi ekle.

![Aurora yazan, çok ince ve geniş harf aralıklı bir yazı logosu; tablonun SVG satırında anlatılan türden saf vektör çalışma](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DAurora%26weight%3D200%26tracking%3D16%26size%3D200%26full&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=%23tool-canvas&walker=1&format=svg&filename=vt-wordmark-vector)

::: details Her biçim ve ne için olduğu
| İstediğin | Kullan | Neden |
|---|---|---|
| Ölçeklenen net logolar veya çalışmalar | **SVG** | Vektör: ölçeklenebilir, küçük ve düzenlenebilir; vektör dışa aktarmanın çizemediği bir efekt görsel olarak gömülür |
| Office ve Windows uygulamaları için vektör | **EMF** | PowerPoint ve Word'e canlı metinle düzenlenebilir vektör olarak yapıştırılır; Google Drive bunu Google Drawings'te açar |
| Baskı ve tasarım uygulamaları için vektör | **EPS** veya **EPS (CMYK)** | Illustrator ve baskı iş akışları için PostScript vektör |
| Kesim makineleri için vektör | **DXF** | Lazer kesiciler, vinil plotterlar ve CNC: milimetre cinsinden dış çizgi yolları |
| Düzenlenebilir bir slayt sunumu | **PowerPoint** (PPTX) | Yerel düzenlenebilir metin ve şekiller; görseller ve vektörler çıkarılabilir kalır |
| Düzenlenebilir bir metin belgesi | **Word** (DOCX) veya **OpenDocument** (ODT) | Kelime işlemcide düzenlenmeye devam edilebilen paragraflar ve başlıklar (Lolly Doc Studio) |
| InDesign için bir düzen | **InDesign IDML (static subset)** | Metin, dikdörtgenler, oval şekiller ve görseller; çalışma alanı başına bir yayılım (Lolly Design) |
| Düzenlenebilir bir Penpot belgesi | **Penpot** | Panolar, şekiller, metin ve bağlı token'lar |
| Fotoğraf veya genel amaçlı görsel | **PNG** (kayıpsız) veya **JPG** (daha küçük) | Evrensel raster |
| Daha küçük modern görseller | **WebP** veya **AVIF** | Saydamlıkla daha iyi sıkıştırma |
| Baskı | **PDF** veya **Print PDF** (CMYK) | Gerçek sayfa boyutu; matbaa için CMYK |
| Matbaa için raster baskı | **Print TIFF** (CMYK) | RIP için DeviceCMYK pikselleri |
| Web için animasyon | **GIF** | Her yerde oynar; daha büyük dosyalar |
| Tam renkli ve gerçek saydamlıklı animasyon | **APNG** | Animasyonlu PNG: palet sınırı yok |
| Animasyon, en küçük dosya | **Animated WebP** | Tam renk ve saydamlık, GIF veya APNG'den küçük |
| Ölçeklenen animasyonlu vektör | **Animated SVG** | Kendi kendine yeten; tarayıcıda veya bir `<img>` içinde her boyutta döngü halinde oynar (Lottie Ad) |
| Düzenlenebilir kalan animasyon | **dotLottie** | Lolly Design'ın zaman çizelgesinden şekiller, yollar ve dış dönüşüm anahtarları |
| Premiere'e aktarım | **Premiere XML + media** | Premiere için zamanlanmış klipler ve özgün medya (Lolly Design) |
| Sosyal medya ve paylaşım için video | **MP4** veya **WebM** | Dosya boyutuna göre en iyi kalite (bkz. [Video](#video)) |
| Altyazılar | **SRT** veya **VTT** | Video oynatıcı için zamanlanmış metin (Captions, Audiogram ve Record) |
| Yayın altyazıları | **TTML** veya **SCC** | IMSC1.1 zamanlanmış metin veya CEA-608 pop-on altyazılar (Captions; bkz. [Yayın altyazıları](#broadcast-captions)) |
| Eğitim kursu | **SCORM (LMS)** | Sürümlendirilmiş web sitesi, SCORM veya xAPI paketi (bkz. [SCORM](#scorm-course-packages)) |
| Zengin metin veya e-posta imzası | **HTML** | E-posta istemcilerine biçimlendirilmiş olarak yapıştırılır |
| Tarayıcıda oynayan animasyon | **HTML** | Lolly Design'ın zaman çizelgesinden veya Snippet'ten tek dosyada bir oynatıcı (bkz. [Video](#video)) |
| Düz içerik | **MD** veya **TXT** | Yalnızca metin |
| Takvim etkinliği | **ICS** | Her takvim uygulamasına içe aktarılır |
| Kişi kartı | **VCF** | Adres defterlerine içe aktarılır |
| Yeniden içe aktarılacak yapılandırılmış veri | **JSON** veya **CSV** | Aracın içeriğini dışa ve yeniden içe aktarır |
| Site simgesi | **ICO** | Çok boyutlu site simgesi; **ZIP** birkaç biçimi paketler |
:::

### Saydamlık

Destekleyen araçlar **No BG** gibi bir saydam arka plan anahtarı sunar. PNG, WebP, AVIF, SVG, APNG ve Animated WebP saydamlığı korur; GIF ise keskin kenarlı saydamlığı korur. JPG ve PDF her zaman opaktır. TIFF, beyaz üzerine veya [HDR](#hdr-bright-colours) yolunda siyah üzerine düzleştirilir.

<!--i:eti-crop-->
## Boyut ve baskı birimleri

Araç **boyutlar** sunmadığı sürece dışa aktarmalar aracın yerel piksel boyutunu kullanır. Sunuyorsa genişlik, yükseklik ve bir **birim** ayarlarsın:

- **px** (varsayılan), tam piksel sayısıdır.
- **mm, cm, in, pt** ve **pc** fiziksel boyutlardır. Fiziksel birim kullandığında **DPI** değerini de ayarlarsın (varsayılan 300). **PDF**, o boyutta gerçek bir sayfa olur. **Raster**, o DPI değerine karşılık gelen piksel sayısını alır ve çözünürlüğü kaydeder. **SVG**, piksel cinsinden bir viewBox ile fiziksel birimi korur.

Daha yüksek çözünürlüklü raster için daha büyük genişlik ve yükseklik gir veya fiziksel bir birim seçip DPI değerini yükselt (piksel = boyut × DPI). Genişlik `210`, yükseklik `297` ve birim `mm`, bir A4 sayfası oluşturur.

![210 x 297 mm olarak ayarlanmış boyut satırı; birim fiziksel olduğu için DPI alanı görünür](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26w%3D210%26h%3D297%26unit%3Dmm%26format%3Dpdf%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-dims&walker=1&dark=1&filename=exp-export-dims)

<!--i:eti-images-->
## Zamanlanmış bir kompozisyondan durağan görseller

Lolly Design'daki [Sequence](/info/sequence-editor.html) zaman çizelgesi gibi zamanlanmış bir kompozisyonda durağan görsel dışa aktarması **oynatma kafasındaki kareyi** alır. Oynatma kafasını görseli istediğin yere getir ve dışa aktar.

Birden fazla an için çıktı boyutunun yanındaki **Frames** alanını kullan. Yalnızca zamanlanmış bir kompozisyonda ve durağan bir biçimde (PNG, JPG, WebP, SVG veya PDF) görünür. `1`, oynatma kafasındaki kareyi verir. Daha yüksek bir sayı, sekans boyunca eşit aralıklarla dağıtılmış o sayıda durağan görsel verir:

- PNG, JPG, WebP ve SVG tek bir ZIP olarak gelir: `<name>-01.png`, `-02.png` ve devamı.
- PDF, o sayıda sayfa içeren tek bir belge olarak gelir.

Her durağan görsel, zaman çizelgesinde kendisine düşen dilimin ortasından alınır; böylece ilki asla yarı görünür bir giriş, sonuncusu da klipler bittikten sonraki boş an olmaz.

::: figure exporting-contact-sheet
Frames: 4, sekansı dört eşit dilime böler ve her birinin ortasını alır.
:::

Frames'i bir görsel senaryo, inceleme için kontak baskı veya video kurgusundan kesilen bir sosyal medya karuseli için kullan. Sayı 64 ile sınırlıdır. Alana yazılan diğer her şey `1` değerine döner. Her kare sıradan bir durağan görseldir; bu yüzden içerik kimlik bilgileri, Imprint, fiziksel birimler ve DPI, tek bir dışa aktarmada olduğu gibi davranır. Dışa aktarma bağlantısı, CLI ve MCP, `cuts=` ile aynı sayfayı ister (bkz. [Kontak baskılar](/info/url-export.html#contact-sheets)).

<!--i:eti-copy-->
## Aynı anda birçok dosya

Lolly, çok sayıda öğeyle çalışmak için üç yol sunar:

::: cols
## Bir tablo tek belgeye dönüşür
Tablo girdisini sayfalara bölmek için oluşturulmuş bir araç, her satırı bir sayfaya dönüştürür. Tek bir PDF elde etmek için hesap tablondan bir tablo yapıştır. Satırları düzeltmek için hesap tablosunu düzenle ve yeniden yapıştır. Battlecards örnek araçtır. Açık kaynaklı `community` klasöründedir ve lolly.tools üzerinde listelenmez.
## Bir CSV, satır başına bir dosyaya dönüşür
**Batch** (`#/batch`) bir CSV alır ve her satır için yaka kartı veya sertifika gibi bir çıktı render ederek ZIP içinde teslim eder. Bkz. [Lolly Batch](/info/batch.html#make-many-versions-of-one-design).
## Birkaç tasarıma aynı düzenleme uygulanır
**Lolly Multi-edit**, her birinde aynı değişikliği yapmak için birkaç kayıtlı oturumu yan yana açar. Bkz. [Lolly Multi-edit](/info/batch.html#edit-several-saved-designs-together).
:::

Booklet, Print Sheet, Lolly Doc Studio veya Lolly Markdown Slides gibi birden çok sayfası olan bir araç, PNG, JPG, WebP, SVG ve diğer tek görsel biçimlerini sayfa başına bir dosya olarak dışa aktarır; birden çok dosya varsa ZIP içine koyar. Print Sheet, tam sayfasını ve kesim işaretlerini seçilen DPI değerinde korur.

Bir klasördeki ve alt klasörlerindeki her kayıtlı oturum, **Projects** içindeki **Render folder** ile klasör yapısını koruyan tek bir ZIP olarak dışa aktarılır. **Render selection**, çoklu seçim için aynısını yapar. Tek bir kayıtlı oturum kendi dosyasına render edilir. Projects, kayıtlı bir oturumu aynı ayarlarla yeniden açan bir araç bağlantısı olarak da tekrar paylaşabilir.

<!--i:eti-pen-->
## Başka uygulamalarda düzenlenebilir kalan dosyalar

Bazı biçimler, çalışmanı başka bir uygulamaya görsel yerine düzenlenebilir içerik olarak aktarır.

### PowerPoint (PPTX)

Lolly Design, Lolly Markdown Slides, Booklet, Lolly Doc Studio, Lolly Chart, Diagrams, Flow Chart ve Agenda, sayfa başına bir slayt içeren PowerPoint sunumu dışa aktarır. Her sayfa, bir meslektaşının düzenleyip çıkarabileceği yerel nesnelere ayrılır:

- <!--i:font--> **Metin**, düzenin yazı tipi boyutu, rengi, kalınlığı, italik biçimi ve hizalamasıyla düzenlenebilir PowerPoint metin kutularına dönüşür. Lolly Design sunumu, asıl slayt olmasa bile her metin parçasına markanın yazı tipini uygular.
- <!--i:pentool--> Logo ve simge gibi **vektörler** SVG görselleri olarak gömülür ve PowerPoint bunlara *Convert to Shape* uygulayabilir.
- <!--i:photos--> **Görseller**, yerel çözünürlüklerinde ayrı görseller olarak aktarılır. Kırpılmış bir ana görsel, kırpmanın arkasında tam görseli korur. Görsele uygulanan her filtre veya karışım görselin içine işlenir.
- <!--i:layers--> **Arka planlar, kenarlıklar ve ayırıcı çizgiler**, dikdörtgen ve çizgi şekillerine dönüşür. Lolly Design'daki daireler, elipsler ve haplar yerel, düzenlenebilir şekiller olarak kalır.

![PowerPoint seçili dışa aktarma paneli: sayfa başına bir slayt, metin ve şekiller düzenlenebilir kalır](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio%3Foptions&width=1440&height=900&dpi=192&waitMs=2500&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22pptx%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-pptx)

Düzen yaklaşık olarak korunur. Karmaşık filtreli veya maskeli bir bölge gibi gezginin yerel nesnelerle ifade edemediği her şey görsel olarak gömülür. Sunumun ilk sayfadan alınan tek bir slayt boyutu vardır.

PowerPoint aynı zamanda bir içe aktarma yoludur: [Sunumu yeniden markala](/info/rebrand.html), sunumu tasarım sistemine taşır; [Tasarımı içe aktar](/info/design-import.html) ise Lolly Design'da açar.

### Penpot

SVG dışa aktaran çoğu araç, **Penpot dosyası** (`.penpot`) da dışa aktarır.

| Oluşturduğun | Penpot'ta |
|---|---|
| Metin | Düzenlenebilir metin nesneleri |
| Şekiller, yollar, gradyanlar ve görseller | Düzenlenebilir vektör şekiller |
| Tasarım sistemi token'ından gelen renk veya yazı tipi | Canlı token bağlantısı: token'ı düzenlediğinde onu devralan her şekil değişir |
| Tasarımın tamamı | Assets panelinde yeniden kullanılabilir bileşen |
| Karmaşık çizim veya canlı tuval | Gömülü görsel; çevresindeki içerik düzenlenebilir kalır |

Lolly Design'daki her çerçeve bir Penpot panosuna dönüşür. Tasarım sisteminin renkleri ve tipografileri Assets paneline, tüm token kümesi ise Tokens paneline gider. Penpot kendi kopyasını tutar. Penpot'ta düzenlenen bir token, [Lolly Design System Setup](/info/brand-studio.html) içindeki içe aktarmayla geri gelir.

![Penpot seçili dışa aktarma paneli: .penpot dosyası ve indirme düğmesinin yanında Send to Penpot](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22penpot%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-penpot)

Dosyayı açmak için Penpot'u başlat, bir proje seç ve **Import** seç. Dışa aktarma panelinden Penpot'ta oturum açarsan **Send to Penpot**, dosyayı senin için içe aktarır.

### Word, OpenDocument ve InDesign

**Lolly Doc Studio**, düzenlenebilir paragraflar ve başlıklarla **Word** (DOCX) ve **OpenDocument** (ODT) dışa aktarır. Word dosyası, belgenin stilleri aracılığıyla markanın yazı tiplerini ve metin rengini ayarlar, seçtiğin sayfa boyutunu kullanır ve SVG çizemeyen uygulamalar için SVG logosunun yanına bir PNG ekler.

**Lolly Design**, **InDesign IDML (static subset)** dışa aktarır: metin, dikdörtgenler, oval şekiller ve PNG veya JPEG görseller; çalışma alanı başına bir yayılım. Desteklenen satır içi biçimlendirme düzenlenebilir kalır, görseller `Links` içinde taşınır ve koordinatlar InDesign puntolarına dönüşür. Yeniden bağlama, yazı tipi değiştirme ve değişen satır kaydırma dikkat gerektirebilir. Efektler, animasyon, birleştirilmiş metin akışları ve desteklenmeyen geometri, bunları listeleyen bir raporla dışa aktarmayı durdurur. IDML özgün belgeyi korumaz. Bitmiş çalışma için PDF gönder.

### Zaman çizelgeleri: dotLottie ve Premiere

Lolly Design'ın zaman çizelgesinden dışa aktarırken **dotLottie**, Lottie araçlarında düzenlenebilir kalan bir animasyon yazar; [Lottie animasyonları](/info/sequence-editor.html#lottie-animations) neleri koruduğunu listeler. **Premiere XML + media**, zamanlanmış klipleri ve özgün medyalarını Premiere için paketler; bkz. [Premiere XML alışverişi](/info/sequence-editor.html#premiere-xml-exchange).

### SCORM (kurs paketleri)

Settings → Preferences → Feature flags altında **Training and courses** seçeneğini açana kadar kurs dışa aktarma kapalıdır.

Ardından desteklenen bir araçtan, proje klasöründen veya seçimden **Export course** seç. Lolly Design'da **SCORM (LMS)** ve **Download** seçmek aynı kurs iş akışını açar. Lolly çalışmayı kaydeder, incelemen için kurs içeriğini ve sırasını gösterir, ardından modülü ve dışa aktarma iletişim kutusunu açar.

- <!--i:layers--> Her kaynak için bir sunum biçimi seç: durağan sayfalar, video olarak hareket, ses veya indirilebilir kaynak. Modüle ders metni ve okuma alternatifleri ekle.
- <!--i:clock--> Öğrenci oynatıcısını önizle ve açıklamalarla altyazıları incele. Sessiz animasyon dahil hareketli içerik video olarak eklenir.
- <!--i:document--> Website, SCORM 1.2, SCORM 2004 4th Edition veya deneysel bir xAPI hedefi seç. İçeriği ve ZIP boyutunu kontrol et, ardından kontrol edilen sürümü kaydet ve indir.
- <!--i:check--> Tamamlamak için zorunlu derslerin her birini onaylamak ve Finish seçmek gerekir.

![SCORM (LMS) seçili bir Lolly Design sunumunun dışa aktarma paneli](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour%26format%3Dscorm%26options&width=1440&height=900&dpi=192&waitMs=3500&css=.fc-insp%7Bdisplay%3Anone!important%7D.edge-dock-slot--fill%7Bflex%3A1%201%20auto!important%3Bheight%3Aauto!important%3Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D.export-popup.is-floating%7Bheight%3Aauto!important%7D.export-popup-body%7Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D&drive=click:.edge-dock-tab%3Ahas-text%28%22Export%22%29;wait:600&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-scorm)

Paket bitmiş içeriğini barındırır ve Lolly hesabı gerektirmez. Website ZIP'ini bir HTTP(S) sunucusuna koy; LMS ZIP'ini değiştirmeden içe aktar. Kursu paylaşmadan önce hedefi test et. Birkaç kayıtlı çalışmadan oluşturulan kurs için [Eğitim kursu oluştur](/info/training-creators.html) sayfasına bak.

### Yayın altyazıları

Captions aracı **TTML** ve **SCC** de dışa aktarabilir. İkisi de SRT ve VTT dosyalarıyla aynı altyazı listesinden yazılır; bu yüzden sözcükler ve zamanlar eşleşir.

- **TTML**, medya zamanına göre saat değerleri ve alt ortada tek bir bölge içeren IMSC1.1 Text Profile'dır. Altyazı başına renk, yazı tipi veya konum taşımaz çünkü Lolly'nin altyazıları yalnızca başlangıç, bitiş ve metin içerir.
- **SCC**, kanal 1'de saniyede 29,97 kare hızında, drop-frame zaman koduyla CEA-608 pop-on altyazılar taşır. Temel Kuzey Amerika karakterlerinin yanı sıra özel ve genişletilmiş karakterleri de destekler. Bir altyazı kümede olmayan bir karakter içeriyorsa dışa aktarma durur ve hangi karakter olduğunu belirtir. Her altyazı 32 sütuna ve en fazla 15 satıra kaydırılır. Başlangıç zamanından önce yüklenemeyen bir altyazı birkaç kare geciktirilir.
- Roll-up ve paint-on altyazılar yazılmaz.

::: note SCC bir yayın aracında kontrol edilmedi
Donanım kod çözücüde de denenmedi. Teslimattan önce bir dosyayı kendi iş akışında test et.
:::

### DXF (kesim dosyaları)

Lolly Asset Export, Diagrams, Growth, Lolly Logo Wall, QR Code, Street Map, Wayfinding ve Wordmark, lazer kesicilerin, vinil plotterların ve CNC yazılımlarının okuduğu AutoCAD R12 alışveriş biçimi **DXF**'i dışa aktarır. Geometri milimetre cinsinden dış çizgi yolları olarak yazılır ve metin dış çizgilere dönüştürülür. Renk, genellikle kesicinin işlemini yöneten en yakın AutoCAD Color Index değerine eşlenir. DXF yalnızca çizgisel çizimdir: fotoğraf içeren veya filtreli bir bölgenin kesim yolu yoktur ve uyarıyla çıkarılır. Raster içeriği korumak için SVG veya PDF kullan. Bir [yedek yazı tipi](/info/fallback-fonts.html) dahil hiçbir yazı tipinin kapsamadığı metin, o metni alıntılayan bir mesajla dışa aktarmayı durdurur.

Street Map tasarımı tamamen çizgilerden oluşur; bu yüzden her yol ve kanal bir kesim yoluna dönüşür.

::: showcase
![Krem üzerine mürekkep renginde Paris'in Street Map render'ı - saf çizgisel çizim, bu yüzden kesiciye aktarılırken her çizgi korunur](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Dparis%26roadColor%3D1a1a2e%26waterColor%3D93c5fd%26background%3Dfaf7f2%26full&width=1440&height=900&dpi=96&waitMs=3200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-street-map-cut)

Kaydır; kamera geometrinin içinden geri çekilir: yedi yol ve hiç piksel yok. Kesici aynı dosyayı okur.
:::

<!--i:eti-stamp-->
## Baskı

**Print PDF**, adlandırılmış bir baskı koşuluna göre CMYK yazar; varsayılan **Coated FOGRA39**'dur. Ölçülmüş mürekkep değerlerine sahip marka renk örnekleri bu değerleri korur. Diğer renkler bir baskı profili üzerinden dönüştürülür: varsayılan olarak Lolly'nin kendi Coated FOGRA39 profili veya **Embed** satırını seçtiğinde kendi profilin. Griler ve siyah yalnızca siyah kalıpta kalır; böylece küçük yazılarda renk hizalama hatası oluşmaz. FOGRA51, SWOP ve GRACoL standart bir cihaz dönüşümü kullanır. Siyah yazı, altındaki rengin üzerine de basılır; böylece biraz hizasız bir baskı makinesi harflerin çevresinde beyaz kenar bırakmaz. **Print TIFF**, RIP için DeviceCMYK pikselleri yazar. Colour profile denetimi ikisini de yönetir ([Renk profilleri](#colour-profiles)). Print TIFF ve **EPS (CMYK)**, renkleri Print PDF ile aynı baskı profili üzerinden ayırır.

**Print marks & bleed**, baskı biçimlerinde kendi kartına sahiptir: milimetre cinsinden taşma payı ile Crop, Registration, Bleed, Colour bars ve Stamp details. Stamp details, tarihi, aracı ve adını kenar boşluğuna basar. Arapça, Çince, Kiril harfleri veya emoji gibi kenar boşluğu yazı tipinde bulunmayan karakterler içeren bir ad ya da araç adı, aynı gri renkte görsel olarak çizilir. Dışa aktarma kartı bu yazı sistemlerini listeler.

Bazı araçlar, örneğin *Booklet*, **çok sayfalı PDF** oluşturur: bir kapak, gerektiği kadar sayfaya akan içerik ve bir arka sayfa. Her sayfa A4, US Letter veya A5 boyutunda gerçek bir dikey PDF sayfasıdır. Herhangi bir bloğu yeni sayfadan başlamaya zorlayabilirsin. Bunlar kesim veya taşma işaretleri olmayan RGB belgeleridir; bu işaretler tek sayfalı Print PDF'ye aittir. Lolly Design PDF'si **Notes handout** da olabilir: her slayt için altında konuşmacı notları bulunan dikey bir sayfa.

**Dışa aktarmadan önce.** Panelin altındaki **Before you export** kartı, başlığının yanında bir değerlendirmeyle matbaanın göreceklerini gösterir: biçim, boyut ve taşma payı, kesim ve taşma alanları, mürekkep kaplama oranı, kalıp sayıları ve sayfa sayısı. Kart hiçbir zaman dışa aktarmayı engellemez. Lolly Design, tasarım sisteminin kurumsal kurallarını katman katman kontrol etme ve belge metninin yazım göstergesi dahil kendi kontrolleriyle kartı her zaman gösterir ([Dışa aktarmadan önce](/info/design.html#before-you-export)). Lolly Design, **Print preflight** açıkken bu baskı kontrollerini ekler. Diğer araçlarda Settings → Preferences → Feature flags altında **Print preflight** seçeneğini aç. Varsayılan olarak kapalıdır ve bir Lolly Work kurulumu bunu üyeleri için açabilir.

**Dışa aktardıktan sonra.** Lolly bitmiş dosyayı geri okur ve seçtiklerinle karşılaştırır: biçim, piksel veya sayfa boyutu, klip uzunluğu, saydam arka plan, CMYK renk, HDR, Content Credentials ve PDF veya ZIP parolası. Farklı olan her şey dışa aktarma kartına yazılır. Her ölçüm dosyadan gelir, asla ayardan gelmez. Dosyanın yanıt veremediği bir özellik eşleşme olarak sayılmaz. Komut satırı, `--export-report` ile tam karşılaştırmayı yazar (bkz. [CLI ile render et](/info/cli-rendering.html)).

::: details Komut satırından PDF erişilebilirlik kontrolleri
**PDF erişilebilirlik kontrolleri.** Komut satırı, PDF için `--export-report` dosyasında `pdfAccessibility` altında 32 erişilebilirlik kontrolü de listeler. Her kontrolün bir kimliği, sade bir açıklaması, bir sonucu ve dosyanın neresinde sorun bulduğu bilgisi vardır:

- **Passed**: kontrol bir şeyi inceledi ve yanlış bir şey bulmadı.
- **Failed**: kontrol bir sorun buldu. Sayfa numaraları veya etiketleri listelenir.
- **Not applicable**: dosyada incelenecek o tür bir şey yoktu; örneğin tablo içermeyen bir dosyada tablo kontrolleri. Bu, dosya hakkında bir şey söylemez.
- **Needs a person**: altı kontrol bir program tarafından değerlendirilemez (okuma sırası, renk kontrastı, yanıp sönme, betikler, zaman sınırları ve tekrarlanan bağlantılar).

Liste bir hüküm değildir. Bir PDF'nin PDF/UA'ya uyduğunu veya yardımcı teknoloji kullanan kişilerin PDF'yi kullanabileceğini söylemez. Yine de birinin dosyayı ekran okuyucuyla kontrol etmesi gerekir. Lolly'nin kendi PDF'leri şu anda etiketleme kontrollerinden geçmez çünkü dışa aktarıcılar henüz etiket yazmaz. Kontrol, dosyayı cihazında okur ve hiçbir şeyi değiştirmez. Parola gerektiren dosyalar geçmiş olarak değil, kontrol edilmemiş olarak belirtilir. Sana gönderilen bir PDF'yi kontrol etmek için [Lolly Strip Hidden Data](/info/utilities.html) içine bırak; aynı listeyi **PDF accessibility checks** altında gösterir.
:::

Lolly Design'ın Inspector kontrolleri ve Lolly Design System Setup'taki marka karşılaştırması tasarımı inceler. Bu iki kart dosyayı inceler.

::: details Fiyat tarifesinden maliyet
Baskı öncesi kontrolün altında bir maliyet kartı, baskı öncesi kontrol kartı kapalı olsa bile aynı sayıları paraya dönüştürür. İki şeye ihtiyaç duyar: fiyat listesinin fiyatlandırabileceği bir iş (kalıplar, tabakalar, alan, sayfalar, varyant satırları veya çıktı dosyaları; bu yüzden basit bir logo PNG'si kartı asla göstermez) ve matbaandan gelen JSON fiyat listesi olan bir **fiyat tarifesi**. Varsayılan derleme fiyat tarifesi içermez ve uygulama içinde yükleme yolu yoktur. Fiyat tarifesi, kurulumla gelen bir katalog varlığı olarak veya kendi sunucusunda barındıran kişinin ya da kontrol düzleminin açtığı isteğe bağlı fiyat tarifesi uzantısı üzerinden gelir. Fiyat tarifesi yoksa hiçbir şey gösterilmez.

Her tutar, `4 plate × €35.00` örneğindeki gibi, senin sağladığın birim fiyatla Lolly'nin saydığı miktarın çarpımıdır. Toplam, kaynağını gösterir: tarifeyi düzenleyen ve fiyatların tarihi. Varsayılan para birimi veya yer tutucu fiyat yoktur. Dosyanın kendisi hakkında söyledikleri aktarım olarak kalır: *"Dosya şöyle diyor: … Lolly bunu doğrulamadı."*

Bir tutar hesaplanamadığında tablo doldurulmak yerine kaldırılır:

- Tarifenin fiyatlandırmadığı satırlar varsa **hiçbir toplam verilmez**; yalnızca kaç satırın fiyatlandırılmadığını belirten bir başlık gösterilir.
- Üst sınır olan bir miktarın ara toplamına **"en fazla"** ifadesi eklenir.
- Geçerlilik tarihi dolmuş fiyatlarda **yalnızca sayılar** gösterilir; bu, *Use these rates anyway* seçeneğine basana kadar sürer. Son kullanma tarihi bundan sonra tutarın yanında kalır.
- Bir **bağlantı** üzerinden açıldığında, bu cihazda sen isteyene kadar parasal tutarlar gizli kalır. CLI, `--rate-card=<file.json>` değerini yerel dosya olarak kabul eder, asla bağlantı parametresi olarak kabul etmez.

Kart, dışa aktarmanın her aşamasından çıkarılır ve dosyayı asla değiştirmez. Bu bir hesaplamadır, fiyat teklifi değildir. Fiyat teklifini yalnızca matbaan verebilir.
:::

<!--i:eti-film-->
## Hareket ve ses

### Video

Animasyonlu araçlar **MP4** ve **WebM** dışa aktarır. Paylaşılan bir `?format=` bağlantısı bu tarayıcının oluşturamadığı bir kapsayıcıyı isterse uyumlu dosya adıyla diğerine geçilir. **Start after**, kayıttan önce animasyonlar ve yazı tipleri yerleşsin diye tuvali sabit tutar. **Duration**, bitmiş klibin uzunluğunu ayarlar. **Motion blur** (Off, Draft quality, Standard veya High; bir **Shutter angle** ile), hızlı hareketi bulanıklaştırır ve render'ı yavaşlatır. Tarayıcı destekliyorsa **Record live**, ekrandaki önizlemeyi ekran paylaşımı üzerinden gerçek zamanlı kaydeder.

![Animasyonlu dışa aktarmanın zamanlama ayarları: Start after, Duration, Shutter angle ile Motion blur ve Record live](/t/url-shot?url=%2F%23%2Ftool%2Flottie-digi-ad%3Fformat%3Dmp4%26options&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=.video-params&walker=1&format=svg&dark=1&filename=exp-video-settings)

**Quality** ile Smaller file, Balanced veya Best quality seçilir. **Advanced**, **Codec**, **Frame rate**, **Rate mode** ve **Hardware acceleration** ayarlarını açar. Araçta altyazı varsa **Captions**, **Embedded track** veya videonun yanında **Sidecar .vtt + .srt** seçeneğini sunar. Bağlantı; kalite, codec, kare hızı, süre ve başlangıç gecikmesini `vq`, `codec`, `fps`, `seconds` ve `wait` olarak taşır ([URL parametreleri](/info/url-parameters.html)).

Video dışa aktarmaları sesi korur. Bir araç klibin altına **fon müziği** yerleştirebilir: klip uzunluğuna göre döngüye alınmış veya kırpılmış, giriş ve çıkış geçişleriyle ses düzeyi ayarlanmış ve görüntünün kendi sesi sırasında sesi kısılan bir ses varlığı. Kayıt araçları canlı seslerini dosyaya taşır.

Lolly Design'da tıklamayla ilerleyen bir sunum video olarak da dışa aktarılabilir. Present menüsündeki **Export slides as video**, dışa aktarma panelini MP4 seçili olarak açar. Her slayt kendi bekleme süresi kadar veya bu süre yoksa dışa aktarma panelindeki Duration kadar oynar. Sunumun slayt geçişi, slaytlar arasında erime geçişi olarak oynar. Belge değişmez.

**HTML**, zamanlanmış bir Lolly Design belgesinden veya Snippet'ten alındığında tek dosyada bir oynatıcıdır: desteklenen yazı tipleri, görselleri ve sesi gömülü olan animasyonun üzerinde oynatma, konuma atlama ve ses denetimleri bulunur. Dosya çevrimdışı oynar. Sahneleri olan bir Lolly Design filmi, sahnelerinin menüsünü ekler. Video, Lottie veya 3D klip içeren bir sekans henüz HTML olarak dışa aktarılamaz; sekansı video olarak dışa aktar.

### Animasyonlu görseller

**GIF** her yerde oynar ve sohbetle e-postaya uygundur; videodan daha büyüktür ve daha az renk içerir. **APNG** ve **Animated WebP**, tam renk ve saydamlığı korur. **Lottie Ad**, **Animated SVG** de dışa aktarır: gömülü CSS anahtar kareleri içeren, her boyuta ölçeklenen ve codec olmadan tarayıcı sekmesinde veya bir `<img>` içinde döngü halinde oynayan vektör kareler. Metni dış çizgilere dönüştürülür. Her kare bir bitmap'ten daha ağır olduğu için daha düşük varsayılan kare hızı kullanır. Bunların hepsi sessizdir.

### Ses

Bazı araçlar sesi tek başına dışa aktarır. **Lolly Voice Recorder**, canlı seviye göstergesiyle bir mikrofon kaydı alır ve cihazında kodlanmış **MP3**, **WAV**, **M4A (AAC)** veya **Opus (WebM)** olarak kaydeder. `wav`, `mp3`, `m4a` ve `opus` sıradan biçim kimlikleridir; bu yüzden ses dışa aktarması da PNG kadar paylaşılabilir ve betiklerle çalıştırılabilir.

Varlık seçici, fon müziği için MP3 ve FLAC'tan MIDI ve tracker modüllerine kadar birçok ses biçimini kabul eder; [Biçimler](/info/formats.html) bunları listeler. Bir [Lolly Rondocode şarkısı](/info/rondocode.html), klibinin istediği uzunlukta çalar.

<!--i:eti-palette-->
## Renk ve HDR

Lolly her modern CSS rengini okur, renk hesaplamalarını algısal olarak yapar ve her dosyayı bir okuyucunun açabileceği renk uzayında yazar: ekranlar için sRGB, baskı için CMYK ve HDR için Rec.2100 PQ ([Motorda renk](/info/colour-engine.html)). **Wide colour / HDR** olarak ayarlanmış bir Lolly Design belgesi kendi kurallarını izler: bkz. [Geniş renk ve HDR düzenleme](/info/hdr-editing.html).

### Renk profilleri

Dışa aktarmalar renk profiliyle etiketlenir; böylece matbaalardaki renk yönetimli uygulamalar, Photoshop ve tarayıcılar renkleri senin gördüğün gibi okur. Küçük resimler ve önizlemeler, küçük kalmak için etiketi atlar.

- **PNG ve JPG**, önizlemenin çizildiği renk uzayı olan gömülü bir **sRGB** ICC profili taşır. Pikseller etiketlenir, yeniden kodlanmaz.
- **Print PDF (CMYK)**, baskı koşulunu *OutputIntent* içinde bildirerek matbaaya CMYK mürekkeplerinin nasıl okunması gerektiğini söyler.
- **Print TIFF (CMYK)**, etiketsiz DeviceCMYK pikselleri yazar ve baskı koşulunu TIFF meta verisine kaydeder. TIFF baskı profili gömemez; bu yüzden **Embed** satırı yalnızca profilin adını kaydeder.
- **TIFF (RGB)**, arşiv veya bir düzenleyiciye aktarılıp geri alınma için sıkıştırılmamış sRGB sürümüdür. Tarayıcılar TIFF önizleyemediği için her iki TIFF de yalnızca masaüstünde kullanılabilir.
- **SVG**, **EMF**, **EPS** ve **DXF**, gömülü profili olmayan vektörlerdir: SVG'nin renkleri sRGB'dir, EMF ve EPS cihaz RGB'sini kullanır, **EPS (CMYK)** DeviceCMYK yazar ve DXF AutoCAD Color Index kullanır. SVG, EPS ve DXF metni dış çizgi yollarına dönüştürür. EMF, Office ve Google Slides'ta metni canlı ve düzenlenebilir tutar; yalnızca biçimin ifade edemediği metin parçalarını dış çizgilere dönüştürür. Dışa aktarma panelindeki **Outline fonts** seçeneği, bağlantıdaki `_text=outline` ve komut satırındaki `--text=outline` gibi her yerde yolları zorunlu kılar. SVG, iç ve dış CSS kutu gölgelerini de yeniden oluşturur.

::: details PDF/X-4 ve kendi baskı profilin
Lolly, Fogra'nın FOGRA39 karakterizasyon verilerine uyarlanmış ve CC0 altında yayımlanmış tek bir CMYK profiliyle gelir; varsayılan baskı koşulu için renkleri bu profil üzerinden dönüştürür. Profil gömülmez çünkü ICC sürümü 4.3'tür ve PDF/X-4 en fazla 4.2 sürümünü kabul eder. Bu nedenle adlandırılmış bir baskı koşulu, PDF/X-4 uyumluluğu iddia etmeden çıktı amacını yazar.

Kendi CMYK profilini yükle ve Colour profile denetiminde profilin **Embed** satırını seç. Dosyanın *DestOutputProfile* değeri olarak gömülür ve dosyanın geri kalanı izin verdiğinde PDF, PDF/X-4 uyumluluğu iddia eder. Bildirdiği baskı koşulu bu profilden okunur: profilin kanıtladığı bir kayıtlı ad veya profilin kendi adı altında `Custom`.

Üç şey, çıktı amacını korurken uyumluluk iddiasını engeller: CMYK geçişinin dönüştüremediği RGB çalışma, `prov` prova kenar boşluğu kaynak metni (gömülü olmayan standart bir yazı tipiyle çizilir) ve **Strong** parola; çünkü PDF/X-4 şifrelemeyi yasaklar. Her PDF ayrıca PDF/X-4 meta verisi taşır: sayfa kutuları, XMP, belge kimliği ve profiliyle birlikte sRGB çıktı amacı.
:::

### Spot mürekkeplerin proses olarak basılması

Bir tasarım sistemi bir renge Pantone veya HLC rengi gibi bir spot mürekkep atayabilir. **Print PDF** daha sonra bu rengi kendi kalıbında basar. Lolly Demo, beyazları Sugar ve Daylight ile siyahı Void dışında her renge bir spot mürekkep atar. Lolly Demo'da oluşturulan bir Print PDF, renklerin çoğunu spot kalıplarda, siyahı ise siyah kalıpta basar.

Yalnızca dört renkli bir dosya için dışa aktarma panelinin Profile kartında **Print spot inks as process** seçeneğini işaretle. Her spot mürekkep daha sonra tasarım sisteminin o renk için verdiği CMYK bileşimini kullanarak camgöbeği, macenta, sarı ve siyahla basılır. Kendi bileşimi olmayan bir renk, tasarımdaki diğer tüm renkler gibi baskı profilinin dönüşümünü kullanır. Dosyada böylece yalnızca dört proses kalıbı bulunur. Seçenek varsayılan olarak kapalıdır. Panel bu kutuyu yalnızca **Print PDF** için ve yalnızca tasarım sistemi bir renge spot mürekkep atadığında gösterir.

Baskı sonrası işlem bir mürekkep değildir. Varak, kabartma, çökertme, bölgesel vernik, yumuşak dokunuş, bıçak kesim, kırım ve perforaj, kutu işaretliyken de kendi adlandırılmış kalıplarını korur; çünkü bir baskı sonrası işlemi proses olarak basmak, siyah maskesini sayfaya yerleştirir.

**Before you export** kartı ve `lolly preflight`, dosyada bulunacak kalıpları sayar. Kutu işaretliyken dört proses kalıbını ve varsa baskı sonrası işlem kalıplarını sayar, spot mürekkeplerin proses olarak basıldığını ve ek kalıp oluşturmadığını belirtirler. Kutu işaretli değilken tasarım sisteminin verdiği her spot mürekkep için en fazla bir spot kalıbı sayarlar. Fiyat tarifesi bu sayılara göre fiyatlandırır; böylece dosyada bulunmayacak bir spot kalıbı asla fiyatlandırmaz.

**Print TIFF** ve **EPS (CMYK)** adlandırılmış kalıplar içermez; bu yüzden seçenek açık da olsa kapalı da olsa her mürekkebi proses olarak basarlar. Bu iki biçim için kart ve `lolly preflight` dört proses kalıbını sayar, hiçbir spot veya baskı sonrası işlem kalıbını saymaz. Bir baskı sonrası işlem bu biçimlere siyah kalıptaki siyah maskesi olarak girer ve kart bunu bir hata olarak bildirir.

Aynı dosya bir bağlantıda `_spots=process`, komut satırında `--spots=process`, [MCP sunucusunda](/info/mcp.html) `spots: "process"` ve terminal uygulamasında **Spot inks** satırıyla istenir. Seçime ilişkin hiçbir bilgi dosyaya girmez: yalnızca mürekkepler değişir.

### HDR (parlak renkler)

Dışa aktarma panelinin **HDR** kartı sıradan tasarımları HDR ekranlar için parlaklaştırır. Düzenleme boyunca HDR özgünlerini korumak için bkz. [Geniş renk ve HDR düzenleme](/info/hdr-editing.html).

Sıradan bir dışa aktarma sRGB'dir: doygun bir marka rengi ekranın normal beyazı kadar parlaktır. Bir HDR ekran daha parlak olabilir. **HDR** kartı marka renklerini ve beyaz metni en yüksek parlaklığa doğru yükseltir. Koyu alanlar koyu kalır.

![Dışa aktarma panelinde açık olan HDR kartı; altında White / Reach / Dark lift / Focus ayarları görünür](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26hdr%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-hdr&walker=1&dark=1&filename=exp-hdr-card)

- **Biçimler.** PNG, JPG, AVIF ve TIFF. WebP 8 bittir ve çalışan bir HDR kod çözme yolu yoktur; vektörlerde ve PDF'te ise HDR modeli yoktur.
- **Varsayılan olarak kapalıdır**, çünkü pikselleri değiştirir. Kartı işaretle ya da bir paylaşım bağlantısında `hdr=1` ilet.
- **Ayarlar.** **White** (en yüksek parlaklık sınırı, 400 ila 2000 nit), **Reach** (ışımanın tonlarda ne kadar aşağı yayıldığı), **Dark lift** (koyu alanların ne kadar aydınlandığı; `0` onları koyu tutar) ve **Focus** (artışın renk zenginliğini ne kadar koruduğu). Tek bir değer olarak taşınırlar: `hdr=1600-60-0-50`, White 1600, Reach 60, Dark lift 0 ve Focus 50 demektir.
- **Yazılanlar.** PNG'ye `cICP` parçasıyla 16 bit Rec.2100 PQ yazılır. JPG, ISO 21496-1 kazanç haritalı JPEG'dir: sıradan bir SDR görüntü ve sonuna eklenmiş bir kazanç haritası. AVIF'e yeniden yazılmış bir `colr` kutusu eklenir. TIFF'e `cicp` etiketi taşıyan, oluşturulmuş bir ICC v4 profiliyle PQ pikselleri yazılır. TIFF siyah üzerine düzleştirilir; çünkü PQ'da beyaz 10.000 nit kodudur ve her kenarın etrafında bir hale oluşturur. Artış algısal (OKLab) açıklığı izler ve renk tonunu korur; böylece bir marka yeşili nane yeşiline dönüşmeden daha parlak olur.
- **Işımanın göründüğü yerler.** HDR ekranda renk yönetimi yapan görüntüleyiciler: Apple cihazlarında Preview, Quick Look ve Safari ya da HDR monitörde Chrome. SDR ekran normal bir görüntü gösterir.
- **Terminalden.** `--export=png` veya `--export=jpg` ile `--hdr=1`, [CLI](/info/cli.html) üzerinde aynı motor kodlayıcılarıyla, tarayıcı olmadan aynı PNG ve kazanç haritalı JPEG'i yazar. AVIF ve TIFF şimdilik yalnızca web'den dışa aktarılabilir.

::: warning Birçok platform HDR sinyalini kaldırır
Yüklenen dosyaları yeniden kodlayan bir platform görüntüyü koyu veya soluk bırakabilir. HDR'yi kendi siten, bir video duvarı veya parlak bir panelde gösterilen sunum gibi hedefini kontrol ettiğin yerlerde kullan.
:::

<!--i:eti-badge-check-->
## Dosyanla birlikte taşınanlar

Bitmiş bir dosyada birkaç kayıt bulunabilir. Bazıları piksellerin yanında yer alır ve dosya yeniden kaydedildiğinde, ekran görüntüsü alındığında veya meta verileri temizlendiğinde kaybolur. İki işaret ise piksellerin içinde bulunur.

::: figure exporting-what-travels
Her kaydın nerede bulunduğu, varsayılan olarak açık olup olmadığı ve her birini hangi bağlantı parametresinin kontrol ettiği.
:::

Dışa aktarma paneli **Licence**, **Source credits**, **Password**, **C2PA Credentials**, **Lolly Imprint** ve **Durable credential** kartlarını tek bir **Content protection** grubunda toplar; bu grup yalnızca seçilen biçimin kullanabileceği kartları gösterir. Bir bağlantı veya belge zaten bir lisans belirtiyorsa ya da bir kaynak kararını gerektiriyorsa grup kendiliğinden açılır. **Design system** kartı grubun dışında kalır ve her dışa aktarmada görünür.

![PNG dışa aktarmasında açılmış Content protection grubu, yalnızca o biçim için geçerli kartları gösterir](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26imprint%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-protection&dark=1&filename=exp-content-protection)

### Köken & filigran

Biçimde uygun alanlar varsa dışa aktarılan dosyalar **köken meta verilerini** taşır: yazılım, kaynak, aracın adı ve profilindeki katkı satırı; bunlar PNG iTXt, JPEG EXIF, PDF bilgisi, SVG `<metadata>` veya bir GIF yorumuna yazılır. Yalnızca eserin kime ait olduğunu kaydeder. Hiçbir şey yüklenmez. **Experimental** araçlar ayrıca görünür bir filigran ekler. Filigranı ana uygulama ekler; bu yüzden aracı düzenlemek işareti kaldıramaz.

**Lolly Imprint**, **varsayılan olarak açık** olan görünmez bir piksel filigranıdır. Yeniden sıkıştırmaya dayanır; böylece bir kopyanın Lolly ile yapıldığı hâlâ anlaşılabilir. Kriptografik bir garanti değil, bir ipucudur ve kişisel veri taşımaz. JPEG XL, PNG, JPG, WebP, AVIF, TIFF ve BMP'ye ve Lolly'nin PDF veya PPTX içine render ettiği rasterlere yazılır; gömdüğün bir görsele asla yazılmaz. Imprint'i dışarıda bırakmak için **Lolly Imprint** işaretini kaldır veya `imprint=0` ilet. AVIF'in yeniden kodlamaya dayanıklılığı henüz kalibre edilmemiştir. [Lolly Verify](/#/verify), Imprint'i cihazında algılar; bkz. [Lolly Imprint](/info/what-verify-checks.html#the-lolly-imprint).

**Durable credential**, cihazda çalışan bir sinir ağı modeliyle Lolly'nin kimliğini TrustMark biçiminde piksellere yazar; böylece "Lolly ile yapıldı" bağlantısı meta veriler kaldırıldıktan ve dosya yeniden kodlandıktan sonra da korunur ve TrustMark destekleyen araçlarla okunabilir. Her dışa aktarmada bir sinir ağı geçişi ve tek seferlik model indirmesi gerektirdiğinden **varsayılan olarak kapalıdır**. PNG, JPG, WebP, AVIF ve TIFF'i kapsar. Panelde işaretle veya `durable=1` ilet. Masaüstü ve mobil uygulamalar kartı gizler; çünkü çevrimdışıyken modeli alabilecekleri bir kaynak adresleri yoktur.

**Licence.** Başkalarının işini nasıl kullanabileceğini seç: varsayılan olarak *None (all rights reserved)*, CC0 1.0, Public Domain Mark 1.0 veya bir Creative Commons 4.0 lisansı (BY, BY-SA, BY-NC, BY-NC-SA, BY-ND, BY-NC-ND). Lisansın adı ve özet metnine giden bağlantı, dosyanın lisans meta verilerine (biçimde varsa EXIF, XMP ve RIFF) ve Content Credential kaydına yazılır. Seçim belgeyle birlikte kaydedilir ve bağlantıda `licence=` olarak taşınır. Lolly seçtiğin lisansı yazar. Lolly şartları denetlemez veya uygulamaz. Claim gibi kendi lisans alanı olan bir araç bunun yerine o alanı korur.

### Tasarım sistemi kaydı

Dışa aktarma, dosyayı oluşturan tasarım sistemini kaydeder: adını, çizimde kullanılan yayımlanmış sürümünü (bu sürüm çalışma sürümü değilse) ve çizimde kullanılan [colourway'i](/info/colourways.html). Tasarım sisteminin tanımladığı yoğunluk gibi diğer tema seçimleri de aynı şekilde kaydedilir. Açık veya koyu seçimi kayda alınmaz; çünkü hangisinin kullanıldığını görsel zaten gösterir.

**Herhangi bir şey yazılmadan önce kaydı görürsün.** Varsayılan olarak işaretli olan **Design system** kartı, *Records: Acme · Colourway: Beach* gibi dosyanın taşıyacağı tam metni ve açıklamayı gösterir. Tasarım sisteminin adı, sahiplerinin yazdığı addır ve kart adı yazıldığı gibi gösterir. Kaydı o dışa aktarmaya eklememek için kartın işaretini kaldır. Lolly Design'ın belge paneli aynı metni *Embedded in exports* altında listeler.

**Açıklama, colourway'i aracın yanında verir.** Kart işaretliyken *"https://lolly.tools ile yapıldı : Chart"*, *"https://lolly.tools ile yapıldı : Chart (Beach colourway)"* olur. Tasarım sisteminin kendi adı açıklamada değil, kayıtta kalır. Araç adı içermeyen veya bir aracın kendi girdilerinden yazdığı açıklama değişmez. `tokenAxes` aracılığıyla colourway'leri yok sayan bir araç hiçbirini kaydetmez ve PDF prova katkı satırı (`prov` baskı işareti) aynı kuralı izler.

::: details Kayıttaki marka becerileri, marka sayfaları ve iş ortağı şirketler
**Bir ajana rehberlik eden marka becerileri.** Parçayı bir ajan oluşturduğunda ve okuyup izlediği [marka becerilerini](/info/brand-skills.html) belirttiğinde, kayıt her beceriyi revizyonuyla birlikte de listeler; örneğin *Guided by: acme-brand 1.0*. Bu ifade, becerinin çalışmaya rehberlik ettiği anlamına gelir. Lolly parçayı bir beceriye göre test etmez. Listeyi yalnızca ajanın kendi beyanı ekler. Şu anda bu, [MCP sunucusunun](/info/mcp.html) `lolly_render` işlevinin `brandSkills` argümanıdır; bu yüzden uygulamada veya bir paylaşım bağlantısından oluşturulan parça bu listeyi taşımaz. Content Credential, listeyi `brandSkills` olarak, her becerinin kimliğini, adını, revizyonunu ve SHA-256 özetini içeren tek bir JSON değeri halinde tutar. XMP paketi ve SVG meta verileri aynı değeri `lolly:BrandSkills` olarak tutar. Kayıttan yazılan bir PDF'e her beceri için bir anahtar sözcük eklenir. Açıklama değişmez. Kurum içi bir becerinin metni asla kaydedilmez. Aynı anahtarlar listeyi kaydın geri kalanıyla birlikte dışarıda bırakır: **Design system** kartı, `_madewith=0`, `--no-madewith` ve `madeWith: false`. MCP sunucusu dosyayı bir tarayıcıda çizdiğinde (PDF, JPEG ve tarayıcısız yolunun yazamadığı diğer biçimler) dosyanın kendi meta verileri listeyi içermez. Orada listeyi yalnızca bir Content Credential tutabilir. Kaydı korumak için `c2pa` ilet. Kimlik bilgisi olmadığında render, marka becerilerinin kaydedilmediği konusunda uyarır.

**Yayımlayan kişi seçtiğinde marka sayfası.** Bir tasarım sistemini yayımlayan kişi, dışa aktarılan dosyalara [marka sayfasının](/info/brand-page.html#lead-back-from-your-files) adresini kaydetmeyi seçebilir. Ayar her tasarım sistemi için ayrıdır ve varsayılan olarak kapalıdır. Kart daha sonra adresi aynı satıra ekler; örneğin *Records: Acme · Colourway: Beach · Brand page: https://acme.example/brand/acme/*. Kartın işaretini kaldırmak adresi de diğer bilgilerle birlikte kaldırır. Kayıt, adresi tutar ve sayfa hakkında başka hiçbir şey tutmaz. Dosyada başka hiçbir şey değişmez. Adresi olmayan bir tasarım sistemi öncekiyle aynı dosyayı yazar.

**Adres bir paketle taşınmaz.** İmzalı bir dosyadaki kayıt, imzalayanın kendi kaydı olarak okunur. Bir adres, o adresi seçmemiş biri için kendiliğinden etkinleşmemeli ve bir paket başkalarının dosyalarını kendi seçtiği bir sayfaya yönlendirememelidir. Bir `.lolly` paketi, bir tasarım sisteminin kopyası veya çatallaması, **Try these colours**, geri yüklenen bir yedek ve tek bir çalıştırma için verilen token dosyası, bu ayar kapalı olarak gelir. Yazdığın bir adresle ayarı kendin açabilirsin. Yönetilen bir tasarım sistemi tek istisnadır: yöneticisinin kaynak token'larda belirlediği adresi korur. Ayrıntılar için bkz. [Dosyalarından geri yönlendir](/info/brand-page.html#lead-back-from-your-files).

**Bir Lolly Work iş ortaklığı programındaki iş ortağı şirket.** Bir iş ortağı şirket için oluşturulan parça, şirketi ve programını aynı satırda kaydeder; örneğin *Records: Acme · Colourway: Beach · Partner: Northwind IT (Resellers, EMEA)*. Şirket bilgilerinin revizyonu da dosyada bulunur. Kayıt hiçbir kişi, iletişim bilgisi, adres veya para birimi içermez. Şirketin iş ortağı kiti eklendiğinde satıra kitin revizyonu eklenir; örneğin *, kit revizyonu 2*. Kimlik bilgisi, kitin kimliğini ve revizyonunu tutar, renklerini veya kurallarını asla tutmaz. Kartın işaretini kaldırmak, iş ortağını kaydın geri kalanıyla birlikte kaldırır. PDF'e *Partner: Northwind IT* anahtar sözcüğü eklenir ve [Lolly Verify](/info/what-verify-checks.html#partner) kaydı **Partner** olarak gösterir ([Dosyalardaki iş ortağı kaydı](/info/manage/partner-programmes.html#the-partner-record-in-files)).
:::

**Kaydı geri okuma.** [Lolly Verify](/#/verify), dosyanın kimlik bilgisi ayrıntılarında kaydı **Design system**, varsa marka becerilerini de **Guided by** olarak listeler. Marka sayfası, [imzalayanın adres kaydı](/info/what-verify-checks.html#brand-page) olarak ayrı görünür. *Recreate with these settings*, aracı kaydedilmiş sürüm ve colourway ile yeniden açar. Bu cihazda aynı kimliğe ve ada sahip bir tasarım sistemi varsa bağlantı kaydedilmiş tasarım sistemiyle açılır; aksi halde etkin tasarım sisteminle açılır.

::: details Nereye ne yazılır ve hangi çalıştırmalar kaydı dışarıda bırakır
| Yer | Yazılanlar |
|---|---|
| Content Credential | `tools.lolly.export` beyanında `designSystem` (kimlik), `designSystemLabel`, `designVersion` ve `themes`; her biri düz metin değeridir; `themes`, seçimlerin JSON listesidir. Yayımlayan kişi seçtiğinde `brandPage` |
| PNG, JPEG, WebP ve JXL | Aynı değerler, dosyanın XMP paketinin `https://lolly.tools/ns/export/1.0/` ad alanındaki `lolly:` özellikleri olarak. Yayımlayan kişi seçtiğinde `lolly:BrandPage` |
| SVG | `<metadata>` bloğu içinde aynı `lolly:` özellikleri |
| PDF | *Tasarım sistemi: Acme*, *Colourway: Beach* ve yayımlayan kişi seçtiğinde *Marka sayfası: https://acme.example/brand/acme/* gibi anahtar sözcükler |
| Açıklama alanı olan her biçim | Colourway'in aracın yanında yer aldığı açıklama |

Kart yalnızca kaydedilecek bir şey varsa ve biçim kaydı tutabiliyorsa görünür. CSV, JSON, takvim dosyaları ve diğer metin veya veri biçimleri meta veri tutmaz; EPS, EMF, DXF ve BMP'de ise kayıt için alan yoktur. HTML, Markdown ve CSS kaydı yalnızca Content Credential içinde tutar; bu yüzden bunlarda kart açıklama satırı göstermez ve **C2PA Credentials** kapalıyken gizlenir. Tasarım sisteminin vermediği bir alan dosyaya girmez.

Bir paylaşım bağlantısı `_madewith=0` ile kaydı kapatır ([URL parametreleri](/info/url-parameters.html)). Komut satırı `--no-madewith`, [MCP sunucusunun](/info/mcp.html) `lolly_render` işlevi `madeWith: false` alır ve terminal uygulamasının dışa aktarma panelinde bir **Design system** satırı vardır. Komut satırı, bir araç render'ında ve `lolly run` komutunun kayıtlı bir Lolly Design oturumundan dışa aktardığı her dosyada, bitmiş dosyanın taşıdığı metni standart hataya yazar. MCP render'ı metni dosyanın yanında gösterir. İkisi de metni dosyadan geri okur. Komut satırının tarayıcı olmadan çizdiği PNG, dosya meta verisi taşımaz; bu yüzden kaydı yalnızca kimlik bilgisi içinde taşınır. Cihazda çalışan yardımcı araçlar meta veri eklemez.

**Design system** kartı olmayan çalıştırmalar kaydı dışarıda bırakır: bir Lolly Batch çalıştırması, Projects içinden dışa aktarılan bir klasör ve bir 3D koleksiyon dışa aktarması; terminal uygulamasında ise bir CSV toplu işi, Projects klasörü veya seçim dışa aktarması ve tümünü render etme görünümü. Tasarım sistemini kaydetmek için araçtan tek bir dosya dışa aktar.
:::

### Content Credentials (C2PA)

Dışa aktarılan dosyalar **Content Credentials** taşıyabilir: dosyayı neyin, ne zaman ve nerede oluşturduğunu kaydeden, dosyanın baytlarının özetine bağlı imzalı bir [C2PA](https://c2pa.org) bildirimi; böylece sonraki her düzenleme algılanabilir. Lolly, herhangi bir C2PA okuyucusunun inceleyebileceği standart bildirimler yazar.

![İşaretli C2PA Credentials kartı, onay kutusunun yanında kimlik bilgisinin geçerlilik süresi](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26c2pa%3D30%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-c2pa%5Bdata-c2pa-only%5D&walker=1&dark=1&filename=exp-c2pa-card)

- **Varsayılan olarak açıktır.** **C2PA Credentials** kartı neredeyse her araçta işaretlidir. Tek bir dışa aktarma için işaretini kaldır veya bir bağlantıda `c2pa=off` ilet. Bu durumda dosyada kimlik bilgisi bulunmaz ve katalog logosu gibi kimlik bilgisi taşıyan bir çalışmayı satır içinde barındıran SVG, o çalışmanın kimlik bilgisini de kaybeder. Lolly Imprint ve dosyanın diğer meta verileri kalır. Bir araç kendi bildiriminde bunu devre dışı bırakabilir.
- **Biçimler.** PDF (RGB ve Print), PNG ve APNG, JPG, GIF, SVG ve SVGZ, TIFF (RGB ve Print), WebP (durağan ve animasyonlu), AVIF, MP4, WebM, HTML, Markdown, CSS ve MP3, WAV, M4A, OGG/Opus ve FLAC ses kapsayıcıları. ZIP, desteklenen her üyesine kimlik bilgisi ekler; Animated SVG bu yolla kimlik bilgisi alır. MP4, AVIF ve M4A standart BMFF bağlamasını, MP3 ise ID3v2 eşlemesini kullanır; böylece `c2patool` ve diğer okuyucular bunları doğrular. WebM ve OGG/Opus için henüz standart eşleme yoktur; bu yüzden Lolly bildirimi bir Matroska eki ve bir OpusTags alanı olarak taşır ve bunları Lolly'nin kendi doğrulayıcısı denetler. SVGZ, sıkıştırılmış SVG'dir. C2PA belirtimi sıkıştırılmış bir biçim tanımlamaz; bu yüzden kimlik bilgisi sıkıştırmadan önce SVG'ye yazılır. Lolly'nin doğrulayıcısı dosyayı olduğu gibi okur; `c2patool`, dosya açıldıktan (`gunzip`) sonra aynı kimlik bilgisini okur. ICO, EPS, EMF, DXF, BMP, PPTX, Office biçimleri ve diğer metin ve veri biçimlerinde C2PA kapsayıcısı yoktur.
- **Kaydettikleri.** Dosyayı oluşturan araç ve uygulama, imzalama zamanı ve dosyayı dışa aktaran kabuk. Görsel, SVG veya PDF olarak dışa aktarılan bir Lolly Design sayfası için sayfayı çizen render motoru (`tools.lolly.export` beyanındaki `route`: GPU sayfa render motoru için `gpu`, vektör olarak yazılan çizim işlemleri için `operations`, tarayıcının kendi render motoru için `compatibility`) ve bu render motorunun sürümü (`renderer`: GPU tarifi, `design-draw-v` ve sürümü veya `dom-to-image` ve `dom-walker`). **Design system** kartı işaretliyken [tasarım sistemi ve colourway](#the-design-system-record). Etkin ayarlar: menü seçimleri, sayılar, anahtarlar ve renkler olduğu gibi; yazılan her şey (başlıklar, adlar, notlar, bağlantılar ve tarihler) ise yalnızca parmak izi olarak kaydedilir, böylece sözcükler dosyada bulunmaz. Profile bağlı alanlar, etkin olmayan denetimler, tarayıcı sürümleri ve işletim sistemi ayrıntıları dışarıda bırakılır. Adın ve e-postan yalnızca Settings → Preferences → Your details altında **Use my details to create** açıkken eser sahibi olarak görünür. Dışa aktarmada yerleştirilen kaynaklar bileşen olarak taşınır. Sayfada kendi Content Credential kaydını taşıyan her görsel, o kayıt ve belirttiği herhangi bir yapay zekâ kaynak türüyle birlikte sayfanın bir bileşeni olarak kaydedilir. Bu, PNG, JPEG, WebP, AVIF, TIFF, SVG veya PDF için ve görsel dışa aktarılan aralığın en az bir karesinde çizildiğinde GIF, APNG, animasyonlu WebP, MP4 veya WebM için geçerlidir. Darkroom, Filter veya Asset Export gibi bir aracın değiştirdiği tek görsel ise dosyanın üst kaynağı olarak kaydedilir; önce açılır, ardından aracın görsele yaptığı işlemler gelir. Diğer bileşenler emoji gibi [kaynağı belirtilen eserler](#source-credits), video veya ses dışa aktarmasındaki [Lolly Rondocode şarkıları](/info/rondocode.html#songs-in-the-credential) ve video veya ses dışa aktarmasındaki [kayıtlı melodilerdir](/info/generated-music.html#what-a-track-records). Her kayıtlı melodi için adı, melodi kaydediyorsa lisansı, tarifinin SHA-256 özeti, motor sürümü ve algoritmik medya bilgisi bulunur. Kayıtlı melodinin yapımcısı (kaydedilirken kullanılan profil adı), kendi adın gibi, yalnızca **Use my details to create** açıkken eklenir. Dışa aktarma paneli de yapımcıyı dışa aktarmadan önce yalnızca bu durumda gösterir.
- **Kaydedilmişse onay.** [Lolly Work](/info/work-approvals.html#review-an-exported-file) üzerinden onaylanan bir dosya, bu kimlik bilgisinin üzerine ikinci bir imzalı kayıt taşıyabilir: onay kimliği, karar tarihi ve incelenen dosyanın özeti. Ad, e-posta, grup, yorum veya zincir adı içermez. İstek iletişim kutusunda varsayılan olarak işaretlidir; tek bir istek için işareti kaldırılabilir veya bir örnek için kapatılabilir. İmzalayanın bir karar bildirdiğini kaydeder. Çalışmanın herhangi bir standardı karşıladığını söylemez.
- **Bir [niyetten](/info/visual-intent.html#what-goes-in-the-file) oluşturulan dosyada, yapılması istenenler.** Amaç, yüzey, araç, dil, kurallar ve sözlük sürümleri ile niyet özeti. O render'ı çalıştıran kişi veya ajan istemin metnini kaydetmeyi istemedikçe, vesile, hedef kitle, bölge ve istem yalnızca parmak izi olarak kaydedilir. Bu kaydı yalnızca bir niyetten başlayan render taşır. Çalıştırma neyi kaydettiğini söyler ve kayıt dışarıda bırakılabilir.
- **Alıcıların gördükleri.** Adobe uygulamaları, `c2patool` ve contentcredentials.org/verify gibi C2PA araçları bildirimi okur ve beyanı gösterir. Lolly, bir güven listesinden alınan sertifikayla değil, cihazında oluşturulan bir anahtarla imzalar; bu yüzden görüntüleyiciler kimlik bilgisini *doğrulanmamış* olarak bildirir. Yapı ve değişiklik kanıtı geçerlidir ama imzalayana kimse kefil olmaz. Bunu değiştirmek için Settings → Preferences → Content Credentials altında bir **doğrulanmış kimlik** kaydet; bkz. [Content Credentials kimliği](/info/content-credentials-identity.html).
- **Dosyayı denetleme.** Herhangi bir dosyayı [Lolly Verify](/#/verify) üzerine bırak veya `lolly validate <file>` çalıştır; cihazda oluşturulan rapor önce dosyanın Lolly ile yapılıp yapılmadığını ve o zamandan beri değişip değişmediğini gösterir. Lolly Verify, kimlik bilgisinin ötesini de inceler; bkz. [Lolly Verify neleri denetler](/info/what-verify-checks.html).
- **Gizlilik.** İmzalama anahtarı dışa aktarma için oluşturulur ve cihazından asla çıkmaz. Beyan yalnızca köken meta verilerinin zaten taşıdığı bilgileri içerir. Kendi dosyalarını dönüştüren gizlilik yardımcı araçları kimlik bilgisi eklemez ve *Lolly Strip Hidden Data*, C2PA bildirimini diğer meta veriler gibi kaldırır. Rondocode yardımcı aracı yeni ses oluşturur; bu yüzden yazdıklarını imzalar ([Lolly Rondocode şarkıları](/info/rondocode.html#files-from-the-rondocode-utility)). Müzik oluşturucu her WAV veya M4A indirmesini imzalar. Kimlik bilgisi, parçayı Lolly'nin müzik oluşturucusunun yaptığını ve müziğin tabi olduğu CC BY 4.0 lisansını, kaynak belirtimiyle birlikte kaydeder ([Bir parça ne kaydeder](/info/generated-music.html#what-a-track-records)).
- **Etkileşimler.** Parolayla korunan bir PDF, iki düzeyde de Content Credentials taşıyamaz. Kimlik bilgisi, DPI, EXIF, renk profili, PDF/X meta verileri ve baskı işaretlerinden sonra, tamamlanmış baytların üzerine en son eklenir.

### Kaynak belirtimleri

Başkasının eserini yerleştiren bir dışa aktarma, o kaynağı kimlik bilgisine kaydeder. Yaygın örnek, seçilen emoji setinden bir emojidir: eser, yaratıcısı, lisans, tam baytların nereden geldiği ve nelerin değiştiği dosyayla birlikte taşınır. Şablonu SVG olan bir araçtaki metin sistemin kendi emojisini korur; bu yüzden orada kaynak belirtilmez. İndirmeden önce **Source credits** satırı, kaynakların teslimat için neler istediğini söyler. İndirmeden sonra satır, kaynak belirtimlerinin dosyada olduğunu söylemeden önce teslim edilen baytları geri okur. Paylaşmak üzere olduğun, yeniden renklendirilmiş bir CC BY-SA glifi gibi seçim yapmanı isteyen bir lisans için seçenekleri içeren bir kart gösterilir. İndirme asla engellenmez. [Yaratıcı hakları ve kaynak belirtimleri](/info/creative-rights.html), kullanılan ifadeleri, incelenen lisansları ve sana ait kalanları açıklar.

<!--i:eti-lock-->
## Parola koruması

Lolly, ikisi de cihazında olmak üzere iki tür kilit oluşturur. Dışa aktarma panelinin **Password** kartı ikisini de ayarlar.

![PDF dışa aktarmasında genişletilmiş Password kartı, parola alanı ve iki kilit düzeyi](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpdf%26password%3Ddemo%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-pdfpass&dark=1&filename=exp-pdf-password)

**PDF açma parolası**, bir parola yazdığında iki düzey sunar:

- **Weak**: baskı işaretleri veya taşma payı olmayan RGB `pdf` ve yalnızca ASCII karakterlerinden oluşan parolalar için 40 bit RC4. Başka karakterler içeren parola Strong düzeyine geçer; çünkü okuyucular bu düzeyde bu şekilde kilitlenmiş bir dosyayı açamaz. Yalnızca ilk 32 karakter hesaba katılır.
- **Strong**: AES-256 (PDF 2.0). Print PDF'lere ve toplu iş ZIP'i içindeki her PDF'e de uygulanır. Strong ile kilitlenmiş bir Print PDF, CMYK'sını, işaretlerini ve çıktı amacını korur ama PDF/X-4 beyanını kaldırır.

::: warning Weak caydırıcıdır, koruma sağlamaz
Gizli bir dosya için **Strong** kullan.
:::

**Kilitli ZIP**, bir ZIP dışa aktarmasını, Projects'ten klasör indirmeyi veya toplu işi, iki düzeyde tek bir parolayla kapsar: **Weak** (ZipCrypto, caydırıcı) veya **Strong** (AES-256). Parola her üyeyi korur. İçindeki her PDF ayrıca kendi başına AES-256 ile kilitlenir; böylece ZIP açıldıktan sonra da PDF kilitli kalır. İndirme başladığında parola istenir. Boş parola, kilit olmadığı anlamına gelir.

**Yazılan parola iki düzeyde de bağlantılara girmez.** Bir dosya `?password=` bağlantısıyla gelirse Lolly değeri okur ve hemen adresten kaldırır. Dosyasının destekleyemeyeceği bir kilit isteyen bağlantı, dosya yazmaz ve nedenini söyler (bkz. [`password`](/info/url-parameters.html)).

**Parolayla açılan paylaşım bağlantısı**, açılmadan önce alıcıdan parola ister. Bağlantı durumu, paroladan türetilmiş bir anahtarla (PBKDF2) AES-256 kullanılarak şifrelenir. Yalnızca şifreli metin taşınır ve şifre çözme alıcının tarayıcısında gerçekleşir. Bağlantıyı sunan sunucu parolayı veya tasarımı asla görmez. **Share** iletişim kutusunda aç. Şifreli bağlantı yalnızca Lolly'de açılır, gömülü görsel olarak asla açılmaz. Bkz. [URL Modu](/info/url-mode.html).

<!--i:eti-monitor-->
## Telefonda

Dışa aktarma denetimleri, **Export** panelini açan yüzen **Export** düğmesinin arkasındadır: aynı biçimler, boyut, kopyalama, indirme ve paylaşma seçenekleri, dokunmaya uygun boyutta sunulur.

<!--i:eti-code-->
## Bağlantılar ve CLI için biçim kimlikleri

Bunlar URL `format=` parametresi ve CLI `--export=` bayrağı için değerlerdir (bkz. [URL parametreleri](/info/url-parameters.html) ve [CLI](/info/cli.html)). Bir aracın menüsü yalnızca o aracın üretebildiği biçimleri gösterir.

| Tür | Kimlikler |
|---|---|
| Raster | `png` · `jpg`/`jpeg` · `webp` · `avif` · `jxl` · `jxl-lossless` · `tiff` (RGB TIFF) · `cmyk-tiff` (Print TIFF) · `bmp` · `ico` |
| Vektör | `svg` · `svgz` (gzip ile sıkıştırılmış SVG) · `emf` · `wmf` · `eps` · `eps-cmyk` (EPS CMYK) · `dxf` (kesim dosyası) |
| Sayfa ve belge | `pdf` · `pdf-cmyk` (Print PDF) · `pptx` (PowerPoint) · `docx` (Word) · `odt` (OpenDocument Text) · `idml` (InDesign) · `penpot` (Penpot tasarım dosyası) · `scorm` (ders paketi, bir ZIP) |
| Hareket | `gif` · `apng` (Animated PNG) · `webp-anim` (Animated WebP) · `svg-anim` (Animated SVG) · `webm` · `mp4` · `lottie` (dotLottie) · `premiere-xml` (Premiere XML + media) |
| Ses | `wav` · `mp3` · `m4a` · `aac` · `opus` · `ogg` · `flac` · `mid` (Lolly Rondocode'dan MIDI notaları) |
| Metin ve veri | `html` · `md` · `txt` · `json` · `csv` · `ics` · `vcf` · `srt` · `vtt` · `ttml` · `scc` · `css` · `scss` · `gpl` (GIMP paleti) |
| Paketler | `zip` · `rpm` ve `tar.gz` (bir Linux paketine mühürlenmiş render) |

Birkaç kimlik aracın kendi dışa aktarma kodundan gelir: `ase` (Lolly Palette Lab'den Adobe Swatch Exchange) ile `exr` ve `hdr` (Lolly Darkroom'dan yüksek dinamik aralıklı rasterler). **Convert Font**, sağladığın bir yazı tipi dosyasından `ttf`, `otf` ve `woff` yazar; bu yüzden yalın bir bağlantı araca render edecek bir şey vermez.
