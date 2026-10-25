# Dosya dışa aktar

Bir şey yaptın ve Lolly'den çıkması gerekiyor: bir sohbet için bir PNG, matbaa için bir PDF, bir meslektaşının düzenlemeye devam edeceği bir sunum. **Export | Save** hapının sol yarısı olan **Export** düğmesine bas. Dosya adının yanından bir biçim seç, sonra **Download** düğmesine bas. Dosya cihazında yapılır.

Tuvalde gördüğün, dosyanın içerdiğidir. Biçim menüsü yalnızca bu aracın bu tarayıcıda yapabildiklerini listeler.

İşlerin çoğu için üç biçimden biri doğrudur:

| İçin | Kullan | Çünkü |
|---|---|---|
| Bir ekran, bir mesaj veya bir slayt | **PNG** | Her uygulama onu açar ve araç sunduğunda saydam bir arka planı korur |
| Bitmiş bir sayfa veya basılan herhangi bir şey | **PDF** | Göründüğü gibi basılan gerçek bir sayfa boyutu; bir araç sunuyorsa **Print PDF**, matbaa için CMYK sürümüdür |
| Her boyutta net kalması gereken görseller | **SVG** | Vektör şekiller, bir rozetten bir bannera kadar net |

::: check Dosyayı kullanılacağı boyutta kontrol et
Göndermeden önce, yapıldığı ekranda aç, ya da gerçek boyutunda yazdır.
:::

::: details Lolly Work ile onaylar ve teslimat (isteğe bağlı)
[Lolly Work çalıştıran bir kuruluş](/info/organisation.html) üyelerinin hangi biçimleri ve dışa aktarma ayarlarını göreceğini yönetebilir. Onayın gerektiği yerde **Request approval**, **Download** düğmesinin yerini alır. Örneğinin gösterdiği politikayı izle.

Lolly Work ayrıca onay adımları, teslimat makbuzları ve denetim kaydıyla yapılandırılmış S3, WebDAV ve HTTP hedeflerine dosya teslim edebilir. O iş akışı için bir dosya göndermek, onu kuruluşun hizmetine gönderir; sıradan bir indirme cihazında kalır. Kişisel Send hedefleri ve kuruluş teslimatı ayrı yapılandırılır.

İşletmeler bunu [organisation delivery guide](/info/work-delivery.html) ile kurar. Kuyruğa alınmış sunucu render'ları ve toplu işler için bkz. [CLI batch and automation](/info/cli-automation.html#organisation-jobs-with-lolly-work).
:::

## Dışa aktarma nasıl çalışır

Dışa aktardığında aracın tuvali seçtiğin biçime render edilir ve sana indirme olarak teslim edilir ya da panona konur.

Üç yol bir dosya üretir. Çoğu araç **tuvali render eder**. Metin ve veri biçimleri (HTML, Markdown, TXT, JSON, CSV, ICS, VCF), resimden çizilmek yerine **aracın içeriğinden üretilir**. *Strip Hidden Data* gibi gizlilik yardımcı araçları **seçtiğin dosyayı** cihazında **dönüştürür** ve zaten kendi dosyan olduğu için tuval, filigran veya eklenmiş meta veri olmadan geri verir.

![Üç dışa aktarma yolu bitmiş bir dosyada buluşur: tuvali render et, içerikten metin veya veri üret ya da seçilen bir dosyayı cihazda dönüştür.](/info/diagrams/concepts/three-export-paths.svg)

Dışa aktarma paneli bu eylemleri sunar. Bir aracın yazarı hangilerinin görüneceğini seçer; varsayılan küme Copy, Download ve Save'dir.

- <!--i:download--> **Download** dosyayı kaydeder. Sonradan bulamazsan bkz. [Find a file you downloaded](/info/find-your-work.html#find-a-file-you-downloaded).
- <!--i:photos--> **Copy** görseli panona koyar; bir sohbete, e-postaya veya belgeye yapıştırmaya hazır. Bir tarayıcının görsel kopyalayamadığı yerde bunun yerine indirir ve bunu söyler.
- <!--i:folder--> **Save** geçerli tasarımı tek tıkla Projects içinde tutar ve asla dosya indirmez. **Download** yanındaki **Save as** nereye olacağını sorar (bkz. [Saving and continuing](/info/using.html#saving-continuing)).
- <!--i:link--> **Share** Share iletişim kutusunu açar: tasarımı yeniden üreten bir bağlantı, ziyaret sırasındaki anahtarlar (tam ekran, dışa aktarma paneli, açılışta indirme veya kopyalama) ve tüm durumu kompakt bir belirteçte paketleyen isteğe bağlı **Shortest link** (bkz. [URL Mode](/info/url-mode.html)).

![Dışa aktarma paneli - format, boyut ve Kopyala / İndir / Kaydet / Paylaş eylemleri](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&walker=1&dark=1&filename=export-panel)

Bir tasarım, örneğin bir QR Code bağlantısı tutan bir Design görsel kutusu gibi, başka bir aracın render'ını gömdüğünde, iç içe render ebeveynin dışa aktarmasına çizilir. SVG ve PDF'de gerçek vektör kalır ve PNG, JPG ve WebP'de net rasterleşir. Gömülü render filigran ve kendi kaynak bilgisini almaz; yalnızca bitmiş dosya alır. HTML, Markdown ve TXT dışa aktarmaları bileşik bir render tutamaz.

## Bir biçim seç

Dosya adı ve format menüsü, **İndir**'in altında tek bir `name.format` çifti olarak birlikte durur.

![Dosya adı alanı format seçiciyle birleşmiş, böylece dışa aktarma tek bir ad.format çifti gibi okunur](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.filename-extension&walker=1&dark=1&filename=exp-format-picker)

Dosyanın nereye gittiğinden başla. Her kart o hedefe uyan biçimleri listeler; bir araç yalnızca yapabildiklerini gösterir.

::: figure exporting-format-chooser
Altı hedef ve her birine uyan biçimler.
:::

Tasarım sisteminin yazı tipinde dizilmiş bir logotype, her harfi dış çizgili bir yol olarak SVG dışa aktarılır; böylece tek dosya hem kartvizit boyutunda hem bina kaplaması boyutunda net kalır.

![Aurora yazan, ince, geniş aralıklı bir logotype; tablonun SVG satırının anlattığı türden saf vektör çalışma](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DAurora%26weight%3D200%26tracking%3D16%26size%3D200%26full&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=%23tool-canvas&walker=1&format=svg&filename=vt-wordmark-vector)

::: details Her biçim ve ne için olduğu
| İstediğin | Kullan | Neden |
|---|---|---|
| Ölçeklenen net logolar veya çalışmalar | **SVG** | Vektör: ölçeklenebilir, küçük ve düzenlenebilir; vektör dışa aktarmanın çizemediği bir efekt görsel olarak gömülür |
| Office ve Windows uygulamaları için vektör | **EMF** | PowerPoint ve Word'e canlı metinle düzenlenebilir vektör olarak yapışır; Google Drive onu Google Drawings'te açar |
| Baskı ve tasarım uygulamaları için vektör | **EPS** veya **EPS (CMYK)** | Illustrator ve baskı iş akışları için PostScript vektör |
| Kesim makineleri için vektör | **DXF** | Lazer kesiciler, vinil plotterlar ve CNC: milimetre cinsinden dış çizgi yolları |
| Düzenlenebilir bir slayt sunumu | **PowerPoint** (PPTX) | Yerel düzenlenebilir metin ve şekiller; görseller ve vektörler çıkarılabilir kalır |
| Düzenlenebilir bir metin belgesi | **Word** (DOCX) veya **OpenDocument** (ODT) | Bir kelime işlemcinin düzenlemeye devam edebileceği gerçek paragraflar ve başlıklar (Doc Studio) |
| InDesign için bir düzen | **InDesign IDML (static subset)** | Metin, dikdörtgenler, oval şekiller ve görseller; çalışma alanı başına bir yayılım (Design) |
| Düzenlenebilir bir Penpot belgesi | **Penpot** | Panolar, şekiller, metin ve bağlı token'lar |
| Bir fotoğraf veya genel amaçlı görsel | **PNG** (kayıpsız) veya **JPG** (daha küçük) | Evrensel raster |
| Daha küçük modern görseller | **WebP** veya **AVIF** | Saydamlıkla daha iyi sıkıştırma |
| Baskı | **PDF** veya **Print PDF** (CMYK) | Gerçek sayfa boyutu; baskı makinesi için CMYK |
| Baskı makinesi için raster baskı | **Print TIFF** (CMYK) | RIP için DeviceCMYK pikselleri |
| Web için animasyonlu | **GIF** | Her yerde oynar; daha büyük dosyalar |
| Tam renkli ve gerçek saydamlıklı animasyon | **APNG** | Animasyonlu PNG: palet sınırı yok |
| Animasyonlu, en küçük dosya | **Animated WebP** | Tam renk ve saydamlık, GIF veya APNG'den küçük |
| Ölçeklenen animasyonlu vektör | **Animated SVG** | Kendi kendine yeten; tarayıcıda veya bir `<img>` içinde, her boyutta döner (Lottie Ad) |
| Düzenlenebilir kalan bir animasyon | **dotLottie** | Design'ın zaman çizelgesinden şekiller, yollar ve dış dönüşüm anahtarları |
| Bir Premiere devri | **Premiere XML + media** | Premiere için zamanlanmış klipler ve özgün medya (Design) |
| Sosyal medya ve paylaşım için video | **MP4** veya **WebM** | Dosya boyutuna göre en iyi kalite (bkz. [Video](#video)) |
| Altyazılar | **SRT** veya **VTT** | Bir video oynatıcı için zamanlanmış metin (Captions, Audiogram ve Record) |
| Bir eğitim kursu | **SCORM (LMS)** | Sürümlü bir web sitesi, SCORM veya xAPI paketi (bkz. [SCORM](#scorm-course-packages)) |
| Zengin metin veya bir e-posta imzası | **HTML** | Posta istemcilerine biçimlendirilmiş olarak yapışır |
| Düz içerik | **MD** veya **TXT** | Yalnızca metin |
| Bir takvim etkinliği | **ICS** | Herhangi bir takvim uygulamasına aktarılır |
| Bir kişi kartı | **VCF** | Adres defterlerine aktarılır |
| Yeniden içe aktarılacak yapılandırılmış veri | **JSON** veya **CSV** | Aracın içeriğini gidiş dönüş yapar |
| Bir favicon | **ICO** | Çok boyutlu site simgesi; **ZIP** birkaç biçimi paketler |
:::

### Saydamlık

Destekleyen araçlar **No BG** gibi saydam arka plan anahtarı sunar. PNG, WebP, AVIF, SVG, APNG ve Animated WebP saydamlığı korur ve GIF sert bir kenar tutar. JPG ve PDF her zaman opaktır. TIFF beyaza düzleşir veya [HDR](#hdr-bright-colours) altında anlatılan HDR yolunda siyaha.

## Boyut ve baskı birimleri

Araç **boyutlar** sunmadıkça dışa aktarmalar aracın yerel piksel boyutunu kullanır. Sunduğunda genişlik, yükseklik ve bir **unit** ayarlarsın:

- **px** (varsayılan) tam piksellerdir.
- **mm, cm, in, pt** ve **pc** fiziksel boyutlardır. Fiziksel bir birimle ayrıca **DPI** (varsayılan 300) ayarlarsın. Bir **PDF** o boyutta gerçek bir sayfa olur, bir **raster** o DPI için piksel sayısını alır ve çözünürlüğü kaydeder ve bir **SVG** fiziksel birimi bir piksel viewBox ile korur.

Daha yüksek çözünürlüklü bir raster için daha büyük bir genişlik ve yükseklik gir ya da fiziksel bir birim seç ve DPI'yi yükselt (piksel = boyut × DPI). Genişlik `210`, yükseklik `297` ve birim `mm` bir A4 sayfası yapar.

![210 çarpı 297 mm olarak ayarlanmış boyutlar satırı, birim fiziksel olduğu için ortaya çıkan DPI alanıyla](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26w%3D210%26h%3D297%26unit%3Dmm%26format%3Dpdf%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-dims&walker=1&dark=1&filename=exp-export-dims)

## Zamanlı bir kompozisyondan durağan kareler

Design içindeki bir [Sequence](/info/sequence-editor.html) zaman çizelgesi gibi zamanlanmış bir kompozisyon hareket eder; bu yüzden durağan bir dışa aktarma bir an seçmelidir: **oynatma kafasındaki kare**. Oynatma kafasını resmi istediğin yere park et ve dışa aktar.

Birden fazla an için çıktı boyutunun yanında **Frames** alanı belirir. Yalnızca zamanlanmış bir kompozisyon ve durağan bir biçim (PNG, JPG, WebP, SVG veya PDF) için gösterilir. Oynatma kafasındaki kare için `1` bırak. Yükseltirsen tüm dizi boyunca eşit aralıklı olarak o kadar durağan görsel elde edersin:

- PNG, JPG, WebP ve SVG tek bir ZIP olarak gelir: `<name>-01.png`, `-02.png` ve böyle devam eder.
- PDF o kadar sayfalı tek bir belge olarak gelir.

Her durağan görsel, zaman çizelgesinin diliminin ortasından gelir; bu yüzden ilk kare asla yarı solmuş bir giriş, sonuncusu asla her klip bittikten sonraki boş an olmaz.

::: figure exporting-contact-sheet
Frames: 4 diziyi dört eşit dilime keser ve her birinin ortasını alır.
:::

Bir storyboard, bir inceleme kontak sayfası veya bir video düzenlemesinden kesilmiş bir sosyal medya karuseli için kullan. Sayı 64 ile sınırlıdır ve alana yazılan başka her şey `1` değerine döner. Her kare sıradan bir durağan görseldir; bu yüzden kimlik bilgileri, Imprint, fiziksel birimler ve DPI tek bir dışa aktarmadaki gibi davranır. Bir dışa aktarma bağlantısı, CLI ve MCP aynı sayfayı `cuts=` ile ister (bkz. [Contact sheets](/info/url-export.html#contact-sheets)).

## Aynı anda çok dosya

Lolly'nin hacimli çalışmak için üç yolu vardır; her biri farklı bir iş için:

::: cols
## Bir tablo tek bir belge olur
**Battlecards** gibi tablo girdili bir araç her satırı bir sayfaya çevirir. Elektronik tablondan bir tablo yapıştır ve tek bir PDF al. Satırları elektronik tabloda düzelt ve yeniden yapıştır.
## Bir CSV satır başına bir dosya olur
**Batch** (`#/batch`) bir CSV alır ve her satır için bir dışa aktarma render eder: isim rozetleri veya sertifikalar, her biri bir dosya, bir ZIP içinde teslim edilir. Bkz. [Batch](/info/batch.html#make-many-versions-of-one-design).
## Birkaç tasarım tek düzenleme alır
**Multi-edit**, farklı tasarımlarda aynı rötuşu yapmak için birkaç kayıtlı oturumu yan yana açar. Bkz. [Multi-edit](/info/batch.html#edit-several-saved-designs-together).
:::

**Projects** içinden **Render folder**, bir klasördeki ve alt klasörlerindeki her kayıtlı oturumu iç içe tek bir ZIP olarak dışa aktarır ve **Render selection** herhangi bir çoklu seçim için aynısını yapar; tek bir kayıtlı oturum kendi dosyasına render edilir. Kayıtlı bir oturum ayrıca Projects içinden, aynı ayarlarla yeniden açan bir araç bağlantısı olarak yeniden paylaşılabilir.

## Başka yerde düzenlenebilir kalan dosyalar

Bazı biçimler işini bir resim yerine düzenlenebilir içerik olarak başka bir uygulamaya devreder.

### PowerPoint (PPTX)

Design, Markdown Slides, Booklet, Doc Studio, Chart, Diagrams, Flow Chart ve Agenda, sayfa başına bir slayt olacak şekilde bir PowerPoint sunumu dışa aktarır. Her sayfa yerel nesnelere ayrılır; böylece bir meslektaşın sunumu düzenleyebilir ve varlıkları çıkarabilir:

- <!--i:font--> **Metin**, düzenin yazı tipi boyutu, rengi, ağırlığı, italikleri ve hizalamasıyla düzenlenebilir PowerPoint metin kutuları olur.
- <!--i:pentool--> Logolar ve simgeler gibi **vektörler** SVG resimleri olarak gömülür; net kalırlar ve PowerPoint onlar üzerinde *Convert to Shape* yapabilir.
- <!--i:photos--> **Görseller** yerel çözünürlükte kendi resimleri olarak gelir. Kırpılmış bir kahraman görsel, kırpmanın arkasındaki tam görseli korur ve üzerindeki her filtre veya karışım içine işlenir.
- <!--i:layers--> **Arka planlar, kenarlıklar ve çizgiler** dikdörtgen ve çizgi şekilleri olur.

![PowerPoint seçiliyken dışa aktarma paneli: sayfa başına bir slayt, metin ve şekiller düzenlenebilir kalır](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio%3Foptions&width=1440&height=900&dpi=192&waitMs=2500&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22pptx%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-pptx)

Düzen yaklaşıktır; amaç yeniden kullanılabilir içeriktir. Yürüteç karmaşık filtreli veya maskeli bir bölge gibi yerel olarak ifade edemediği her şey bir resim olarak gömülür; böylece hiçbir şey kaybolmaz. Bir sunumun ilk sayfadan alınan tek bir slayt boyutu vardır.

PowerPoint ayrıca bir giriş yoludur: [Rebrand a deck](/info/rebrand.html) bir sunumu tasarım sistemine taşır ve [Import a design](/info/design-import.html) birini Design'da açar.

### Penpot

SVG dışa aktaran araçların çoğu ayrıca Penpot'ta düzenlemeye devam etmeye hazır bir **Penpot dosyası** (`.penpot`) da dışa aktarır.

| Ne yaptın | Penpot'ta |
|---|---|
| Metin | Düzenlenebilir metin nesneleri: bir yazım hatasını düzelt veya yeniden stillendir |
| Şekiller, yollar, gradyanlar ve görseller | Kendi düzenlenebilir vektör şekilleri |
| Bir tasarım sistemi token'ından renk veya yazı tipi | Canlı bir token bağlantısı: token'ı düzenle ve onu devralan her şekil izler |
| Tüm tasarım | Assets panelinde yeniden kullanılabilir bir bileşen |
| Karmaşık bir çizim veya canlı tuval | Kendi başına bir görsel olarak gömülür; çevresindeki düzenlenebilir içeriğe dokunulmaz |

Design'dan her çerçeve bir Penpot panosu olur. Tasarım sisteminin renkleri ve tipografileri Assets paneline, tam token kümesi Tokens paneline iner. Penpot oradan kendi kopyasını tutar: Penpot'ta düzenlenen bir token, [Design System Setup](/info/brand-studio.html) içindeki içe aktarma yoluyla geri gelir.

![Penpot seçiliyken dışa aktarma paneli: .penpot dosyası ve indirmenin yanında Send to Penpot](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22penpot%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-penpot)

Dosyayı açmak için Penpot'u başlat, bir proje seç ve **Import** seç. Dışa aktarma panelinden Penpot'ta oturum açtıysan **Send to Penpot** bu adımı senin için yapar.

### Word, OpenDocument ve InDesign

**Doc Studio**, gerçek paragraflar ve başlıklarla **Word** (DOCX) ve **OpenDocument** (ODT) dışa aktarır.

**Design**, **InDesign IDML (static subset)** dışa aktarır: metin, dikdörtgenler, oval şekiller ve PNG veya JPEG görseller; çalışma alanı başına bir yayılım. Desteklenen satır içi biçimlendirme düzenlenebilir kalır, görseller `Links` içinde taşınır ve koordinatlar InDesign noktalarına dönüşür. Yeniden bağlama, yazı tipi ikamesi ve değişen metin sarma dikkat gerektirebilir. Efektler, animasyon, bileşik hikâyeler ve desteklenmeyen geometri, onları listeleyen bir raporla dışa aktarmayı durdurur. IDML özgün belgeyi korumaz; bu yüzden bitmiş çalışma için PDF gönder.

### Zaman çizelgeleri: dotLottie ve Premiere

Design'ın zaman çizelgesinden **dotLottie**, Lottie araçlarında düzenlenebilir kalan bir animasyon yazar; neleri koruduğunu [Lottie animations](/info/sequence-editor.html#lottie-animations) listeler. **Premiere XML + media**, zamanlanmış klipleri ve özgün medyalarını Premiere için paketler; bkz. [Premiere XML exchange](/info/sequence-editor.html#premiere-xml-exchange).

### SCORM (kurs paketleri)

Kurs dışa aktarma, Settings → Preferences → Feature flags altında **Training and courses** seçeneğini açana kadar kapalıdır.

Sonra desteklenen bir araçtan, bir proje klasöründen veya bir seçimden **Export course** seç. Design'da **SCORM (LMS)** seçip **Download** düğmesine basmak aynı kurs iş akışını açar. Lolly işi kaydeder, kurs içeriğini ve sırasını incelemene izin verir, sonra modülü ve dışa aktarma iletişim kutusunu açar.

- <!--i:layers--> Her kaynak için bir sunum seç: durağan sayfalar, video olarak hareket, ses veya indirilebilir bir kaynak. Modülde ders metni ve okuma alternatifleri ekle.
- <!--i:clock--> Öğrenci oynatıcısını önizle ve açıklamaları ile altyazıları incele. Sessiz animasyon dahil hareket, video olarak eklenir.
- <!--i:document--> Website, SCORM 1.2, SCORM 2004 4th Edition veya deneysel bir xAPI hedefi seç. İçeriği ve ZIP boyutunu denetle, sonra denetlenen sürümü kaydet ve indir.
- <!--i:check--> Tamamlama, her zorunlu dersin onaylanmasını ve Finish seçilmesini gerektirir.

![SCORM (LMS) seçiliyken bir Design destesindeki dışa aktarma paneli](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour%26format%3Dscorm%26options&width=1440&height=900&dpi=192&waitMs=3500&css=.fc-insp%7Bdisplay%3Anone!important%7D.edge-dock-slot--fill%7Bflex%3A1%201%20auto!important%3Bheight%3Aauto!important%3Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D.export-popup.is-floating%7Bheight%3Aauto!important%7D.export-popup-body%7Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D&drive=click:.edge-dock-tab%3Ahas-text%28%22Export%22%29;wait:600&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-scorm)

Paket bitmiş içeriğini tutar ve Lolly hesabı gerektirmez. Bir Website ZIP'ini bir HTTP(S) sunucusuna koy; bir LMS ZIP'ini değiştirmeden içe aktar. Kursu paylaşmadan önce hedefi test et. Birkaç kayıtlı yaratımdan kurulan bir kurs için bkz. [Create a training course](/info/training-creators.html).

### DXF (kesim dosyaları)

Asset Export, Diagrams, Growth, Logo Wall, QR Code, Street Map, Wayfinding ve Wordmark, lazer kesicilerin, vinil plotterların ve CNC yazılımlarının okuduğu AutoCAD R12 değişim biçimi olan **DXF** dışa aktarır. Geometri milimetre cinsinden dış çizgi yolları olarak yazılır, metin dış çizgilenir ve renk, genellikle kesicinin işlemini yöneten en yakın AutoCAD Color Index'e eşlenir. DXF yalnızca çizgi sanatıdır: fotoğrafik veya filtreli bir bölgenin kesim yolu yoktur ve bir uyarıyla bırakılır. Raster içeriği korumak için SVG veya PDF kullan.

Street Map en net örnektir. Tüm tasarım zaten çizgilerden oluşur; bu yüzden her yol ve kanal bir kesim yolu olur.

::: showcase
![Krem üzerine mürekkeple çizilmiş bir Street Map Paris render'ı - saf çizgi sanatı, böylece her çizgi bir kesiciye giden yolculuğu atlatır](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Dparis%26roadColor%3D1a1a2e%26waterColor%3D93c5fd%26background%3Dfaf7f2%26full&width=1440&height=900&dpi=96&waitMs=3200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-street-map-cut)

Kaydır, ve kamera gerçek geometrinin içinden geri çekilir: yedi yol, hiçbir yerde piksel yok, her zumda kıl payı netliğinde her çizgi. Bu, bir kesicinin okuduğu dosyanın aynısıdır.
:::

## Baskı

**Print PDF**, adlandırılmış bir baskı koşuluna karşı, varsayılan olarak **Coated FOGRA39** ile CMYK yazar. Ölçülmüş mürekkep değerli marka örnekleri tam olarak dönüştürülür; diğer renkler standart bir aygıt dönüşümü kullanır. **Print TIFF** bir RIP için DeviceCMYK pikselleri yazar ve aynı baskı koşulunu TIFF meta verisinde kaydeder. Colour profile denetimi ikisini de yönetir; ayrıntı [Colour profiles](#colour-profiles) altında.

**Print marks & bleed** baskı biçimlerinde kendi kartına sahiptir: milimetre cinsinden taşma payı ve Crop, Registration, Bleed, Colour bars ile Stamp ayrıntıları.

Bazı araçlar **çok sayfalı bir PDF** kurar: bir kapak, gerektiği kadar sayfaya akan içerik ve bir arka sayfa; *Booklet* aracındaki gibi. Her sayfa A4, US Letter veya A5 boyutunda gerçek bir dikey PDF sayfasıdır ve herhangi bir bloğu yeni bir sayfaya zorlayabilirsin. Bunlar, tek sayfalı Print PDF'e ait olan kesim veya taşma işaretleri olmayan RGB belgelerdir. Bir Design PDF'i ayrıca bir **Notes handout** da olabilir: her slayt için altında konuşmacı notlarıyla bir dikey sayfa.

**Before you export.** Panelin altındaki **Before you export** kartı, bir matbaanın göreceği şeyi söyler: biçim, boyut ve taşma payı, kesim ve taşma alanları, mürekkep kapsama, plaka sayıları ve sayfa sayısı; başlığının yanında bir kararla. Asla bir dışa aktarmayı engellemez. Design, tasarım sisteminin kurumsal stil kurallarını katman katman ve belgenin metni için yazım sinyalini içeren kendi denetimleriyle kartı her zaman gösterir ([Before you export](/info/design.html#before-you-export)) ve **Print preflight** açıkken bu baskı denetimlerini ekler. Diğer araçlarda Settings → Preferences → Feature flags altında **Print preflight** aç; varsayılan olarak kapalıdır ve bir Lolly Work dağıtımı bunu üyeleri için açabilir.

**After you export.** Dosya hazır olduğunda Lolly onu geri okur ve seçtiklerinle karşılaştırır: biçim, piksel veya sayfa boyutu, klip uzunluğu, saydam arka plan, CMYK renk, HDR, Content Credentials ve bir PDF veya ZIP parolası. Farklı olan her şey dışa aktarma kartına yazılır. Her ölçüm ayardan değil dosyadan gelir ve dosyanın yanıtlayamadığı bir özellik eşleşme sayılmaz. Komut satırı tam karşılaştırmayı `--export-report` ile yazar (bkz. [Render with the CLI](/info/cli-rendering.html)).

Design'ın denetleyici denetimleri ve Design System Setup'taki marka karşılaştırması ayrı denetimlerdir: tasarıma bakarlar, bu iki kart ise dosyaya.

::: details Bir fiyat kartından maliyet
Preflight'ın altında bir maliyet kartı, yalnızca birinin sağladığı fiyatları kullanarak aynı sayıları paraya çevirir. Preflight kartının kendisi kapalı olsa bile bu sayıları okur. İki şeye ihtiyaç duyar: bir fiyat listesinin fiyatlayabileceği bir iş (plakalar, tabakalar, alan, sayfalar, varyant satırları veya çıktı dosyaları; yani düz bir logo PNG'si onu asla göstermez) ve bir **rate card**, matbaandan bir JSON fiyat listesi. Varsayılan bir derleme hiç taşımaz ve onu yüklemek için uygulama içinde bir yol yoktur. Bir rate card, bir dağıtımın gönderdiği bir katalog varlığı olarak ya da kendi sunucusunda barındıran birinin veya bir denetim düzleminin açtığı isteğe bağlı rate-card uzantısı aracılığıyla gelir. Rate card yoksa hiçbir şey gösterilmez.

Her rakam, senin sağladığın bir oran çarpı Lolly'nin saydığı bir miktardır; örneğin `4 plate × €35.00` ve toplam kaynağını taşır: kartın düzenleyicisi ve oranlarının tarihi. Varsayılan para birimi ve yer tutucu fiyat yoktur. Dosyanın kendisi hakkında söyledikleri aktarılan söz olarak kalır: *"The file says: … Lolly has not verified this."*

Bir rakam hesaplanamadığında tablo doldurulmak yerine geri çekilir:

- Kartın fiyatlamadığı satırlar **hiç toplam olmaması** anlamına gelir; yalnızca kaç tanesinin fiyatsız olduğunu söyleyen bir başlık.
- Üst sınır olan bir miktar ara toplamına **"up to"** taşır.
- Geçerlilik tarihini aşan oranlar, *Use these rates anyway* düğmesine basana kadar **yalnızca sayıları** gösterir; sonra son kullanma tarihi rakamla birlikte gider.
- Bir **bağlantı** üzerinden açıldığında, bu cihazda isteyene kadar para gizli kalır. CLI `--rate-card=<file.json>` değerini yerel bir dosya olarak alır ve asla bir bağlantı parametresi olarak değil.

Kart her dışa aktarma aşamasından çıkarılır; bu yüzden dosyayı asla değiştirmez. Bu bir teklif değil aritmetiktir; yalnızca matbaan teklif verebilir.
:::

## Hareket ve ses

### Video

Animasyonlu araçlar **MP4** ve **WebM** dışa aktarır. Seçici yalnızca bu tarayıcının yapabildiği kapsayıcıları gösterir ve yapamadığını isteyen paylaşılan bir `?format=` bağlantısı eşleşen bir dosya adıyla diğerine döner. Animasyonlu araçlar ayrıca kayıttan önce animasyonlar ve yazı tiplerinin oturması için tuvali bir an sabit tutan **Start after** ve bitmiş klibin uzunluğu olan **Duration** sunar. **Motion blur** (Off, Draft quality, Standard veya High; bir **Shutter angle** ile) hızlı hareketi render süresi pahasına bulanıklaştırır. Tarayıcının desteklediği yerde **Record live**, bunun yerine bir ekran paylaşımı aracılığıyla ekrandaki önizlemeyi gerçek zamanlı kaydeder.

![Animasyonlu bir dışa aktarmanın zamanlama ayarları: Start after, Duration, Shutter angle ile Motion blur ve Record live](/t/url-shot?url=%2F%23%2Ftool%2Flottie-digi-ad%3Fformat%3Dmp4%26options&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=.video-params&walker=1&format=svg&dark=1&filename=exp-video-settings)

**Quality** Smaller file, Balanced veya Best quality seçer. **Advanced** **Codec**, **Frame rate**, **Rate mode** ve **Hardware acceleration** seçeneklerini açar. Bir aracın altyazıları olduğunda **Captions**, videonun yanında bir **Embedded track** ya da bir **Sidecar .vtt + .srt** seçer. Bir bağlantı kaliteyi, codec'i, kare hızını, süreyi ve başlangıç gecikmesini `vq`, `codec`, `fps`, `seconds` ve `wait` olarak taşır ([URL parameters](/info/url-parameters.html)).

Video dışa aktarmaları seslerini korur. Bir araç klibin altına bir **music bed** serebilir: klip uzunluğuna döngülenmiş veya kırpılmış, görüntünün kendi sesinin altında solma, ses düzeyi ve kısma olan bir ses varlığı. Kayıt araçları canlı seslerini dosyaya taşır.

Tıklamalı sunum olarak kalan bir Design sunumu yine de video olarak çıkabilir. Present menüsündeki **Export slides as video**, dışa aktarma sayfasını MP4 üzerinde açar. Her slayt kendi bekleme süresi kadar ya da yoksa dışa aktarma sayfasının Duration değeri kadar oynar ve sunumun slayt geçişi aralarında bir çözülme olarak oynar. Belgenin kendisi değişmez.

### Animasyonlu görseller

**GIF** her yerde oynar ve sohbet ile e-postaya uygundur; videodan daha büyüktür ve daha az rengi vardır. **APNG** ve **Animated WebP** tam rengi ve saydamlığı korur. **Lottie Ad** ayrıca **Animated SVG** dışa aktarır: gömülü CSS anahtar kareleriyle vektör kareler; böylece herhangi bir boyuta ölçeklenir ve codec olmadan bir tarayıcı sekmesinde veya bir `<img>` içinde döner. Metni dış çizgilenir ve her kare bir bitmap'ten daha ağır olduğu için daha düşük bir varsayılan kare hızı kullanır. Bunların hepsi sessizdir.

### Ses

Bazı araçlar sesi tek başına dışa aktarır. **Voice Recorder** canlı seviye göstergesiyle bir mikrofon çekimi yakalar ve cihazında kodlanmış **MP3**, **WAV**, **M4A (AAC)** veya **Opus (WebM)** olarak kaydeder. `wav`, `mp3`, `m4a` ve `opus` sıradan biçim kimlikleridir; bu yüzden bir ses dışa aktarması bir PNG kadar paylaşılabilir ve betiklenebilirdir.

Varlık seçici bir müzik zemini için MP3 ve FLAC'ten MIDI ve izleyici modüllerine geniş bir ses yelpazesini kabul eder; [Formats](/info/formats.html) onları listeler. Bir [Rondocode song](/info/rondocode.html) klibinin istediği uzunlukta oynar.

## Renk ve HDR

Lolly her modern CSS rengini okur, renk matematiğini algısal olarak yapar ve her dosyayı bir okuyucunun açabileceği bir uzayda yazar: ekranlar için sRGB, baskı için CMYK ve HDR için Rec.2100 PQ. Nasıl olduğunu [Colour in the engine](/info/colour-engine.html) açıklar. **Wide colour / HDR** olarak ayarlanmış bir Design belgesi, [Wide colour and HDR editing](/info/hdr-editing.html) bölümünde anlatılan kendi kurallarını izler.

### Renk profilleri

Dışa aktarmalar bir renk profiliyle etiketlenir; böylece matbaalar, Photoshop ve tarayıcılar gibi renk yönetimli uygulamalar renkleri senin gördüğün gibi okur. Bu otomatik olur; küçük resimler ve önizlemeler küçük kalmak için etiketi atlar.

- **PNG ve JPG**, önizlemenin çizildiği uzay olan gömülü bir **sRGB** ICC profili taşır. Pikseller etiketlenir, yeniden kodlanmaz.
- **Print PDF (CMYK)** baskı koşulunu *OutputIntent* içinde bildirir ve bir matbaaya CMYK mürekkeplerinin nasıl okunması gerektiğini söyler.
- **Print TIFF (CMYK)** etiketsiz DeviceCMYK pikselleri yazar ve baskı koşulunu TIFF meta verisinde kaydeder. Bir TIFF bir baskı profili gömemez; bu yüzden bir **Embed** satırı yalnızca o profilin adını kaydeder.
- **TIFF (RGB)** arşiv veya bir düzenleyiciyle gidiş dönüş için sıkıştırılmamış sRGB kardeşidir. Saydamlığı beyaza düzleştirir. İki TIFF de yalnızca masaüstüdür, çünkü tarayıcılar bir TIFF'i önizleyemez.
- **SVG**, **EMF**, **EPS** ve **DXF**, gömülü profili olmayan vektörlerdir: SVG'nin renkleri sRGB'dir, EMF ve EPS aygıt RGB'sini kullanır, **EPS (CMYK)** DeviceCMYK yazar ve DXF AutoCAD Color Index kullanır. SVG, EPS ve DXF metni yollara dış çizgiler. EMF metni Office ve Google Slides'ta canlı ve düzenlenebilir tutar, yalnızca biçimin ifade edemediği parçalar için dış çizgilere döner; dışa aktarma panelinin **Outline fonts** seçeneği her yerde yolları zorlar. SVG ayrıca CSS kutu gölgelerini, içte ve dışta yeniden üretir.

::: details PDF/X-4 ve kendi baskı profilin
Lolly ile hiçbir CMYK profili gelmez. Adlandırılmış bir baskı koşulu, PDF/X-4 uyumluluğunu iddia etmeden çıktı amacını yazar, çünkü PDF/X-4 profilin gömülmesini ister.

Kendi CMYK profilini yükle ve Colour profile denetiminde **Embed** satırını seç. Dosyanın *DestOutputProfile* değeri olarak gömülür ve dosyanın geri kalanı izin verdiğinde PDF, PDF/X-4 iddiasında bulunur. Bildirdiği baskı koşulu o profilden okunur: profilin kanıtladığı yerde kayıtlı bir ad ya da profilin kendi adı altında `Custom`.

Üç şey iddiayı esirgerken çıktı amacını korur: CMYK geçişinin dönüştüremediği RGB çalışma, `prov` kanıt kenar boşluğu atıf metni (gömülü olmayan standart bir yazı tipiyle çizilir) ve **Strong** bir parola, çünkü PDF/X-4 şifrelemeyi yasaklar. Her PDF ayrıca PDF/X-4 meta verisi taşır: sayfa kutuları, XMP, bir belge kimliği ve profiliyle bir sRGB çıktı amacı.
:::

### HDR (parlak renkler)

Bu, sıradan bir çalışmayı HDR ekranlar için parlaklaştıran dışa aktarma panelinin **HDR** kartıdır. HDR özgünlerini düzenleme boyunca korumak farklı bir özelliktir: [Wide colour and HDR editing](/info/hdr-editing.html).

Sıradan bir dışa aktarma sRGB'dir: doygun bir marka rengi, ekranın normal beyazı kadar parlaktır. Bir HDR ekranın bunun üstünde boşluğu vardır. **HDR** kartı marka renklerini ve beyaz metni tepe parlaklığa doğru güçlendirirken koyu alanlar koyu kalır ve parıltıya kontrastını verir.

![Dışa aktarma panelindeki HDR kartı, açık, altında görünen White / Reach / Dark lift / Focus kadranlarıyla](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26hdr%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-hdr&walker=1&dark=1&filename=exp-hdr-card)

- **Biçimler.** PNG, JPG, AVIF ve TIFF. WebP 8 bittir ve çalışan bir HDR çözme yolu yoktur; vektörlerin ve PDF'in HDR modeli yoktur.
- **Varsayılan olarak kapalı**, çünkü pikselleri değiştirir. Kartı işaretle ya da bir paylaşım bağlantısında `hdr=1` ver.
- **Kadranlar.** **White** (tepe parlaklık tavanı, 400 ila 2000 nit), **Reach** (parıltının tonlar boyunca ne kadar aşağı yayıldığı), **Dark lift** (koyuların ne kadar parladığı; `0` onları koyu tutar) ve **Focus** (güçlendirmenin ne kadar renk zenginliği koruduğu). Tek bir değer olarak taşınırlar: `hdr=1600-60-0-50` White 1600, Reach 60, Dark lift 0 ve Focus 50 demektir.
- **Ne yazılır.** PNG, bir `cICP` parçasıyla 16 bit Rec.2100 PQ alır. JPG bir ISO 21496-1 kazanç haritası JPEG'idir: sıradan bir SDR resim artı eklenmiş bir kazanç haritası. AVIF yeniden yazılmış bir `colr` kutusu alır. TIFF, bir `cicp` etiketi taşıyan üretilmiş bir ICC v4 profiliyle PQ pikselleri alır ve siyaha düzleşir, çünkü beyaz PQ'da 10.000 nitlik koddur ve her kenarı bir haleyle çevrelerdi. Güçlendirme algısal (OKLab) açıklığı izler ve tonu korur; bir marka yeşili nane değil, daha parlak olur.
- **Parıltının göründüğü yer.** Bir HDR ekranda renk yönetimli görüntüleyiciler: Apple cihazlarda Preview, Quick Look ve Safari veya bir HDR monitörde Chrome. Bir SDR ekran normal bir görsel gösterir.
- **Göndermeden önce.** Birçok platform yüklemeleri yeniden kodlar ve HDR sinyalini çıkarır; bu da görselin koyu veya soluk kalmasına yol açabilir. HDR'yi hedefi denetlediğin yerlerde kullan; örneğin kendi sitende, bir video duvarında veya parlak bir panelde bir sunumda.
- **Terminalden.** `--export=png` veya `--export=jpg` ile `--hdr=1`, aynı PNG'yi ve kazanç haritalı JPEG'i, aynı motor kodlayıcılarından, yolda tarayıcı olmadan [CLI](/info/cli.html) üzerinde yazar. AVIF ve TIFF şimdilik web dışa aktarmaları olarak kalır.

## Dosyanla birlikte neler gider

Bitmiş bir dosya resmin yanında birkaç kayıt taşıyabilir. Bazıları piksellerin yanında gider ve dosya yeniden kaydedildiğinde ya da sıyrıldığında kaybolur; iki işaret pikselin içinde yaşar.

::: figure exporting-what-travels
Her kaydın nerede yaşadığı, varsayılan olarak açık olup olmadığı ve her birini hangi bağlantı parametresinin denetlediği.
:::

Dışa aktarma paneli **Licence**, **Source credits**, *Password protect*, **C2PA Credentials**, **Lolly Imprint** ve **Durable credential** öğelerini yalnızca seçilen biçimin kullanabileceği kartları gösteren tek bir **Content protection** grubuna katlar. Bir bağlantı veya belge zaten bir lisans bildirdiğinde ya da bir kaynak senden bir karar gerektirdiğinde kendiliğinden açılır. **Design system** kartı grubun dışında, her dışa aktarmada görünür kalır.

![Bir PNG dışa aktarmada açılmış Content protection grubu, yalnızca ona uygulanan kartları gösteriyor](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26imprint%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-protection&dark=1&filename=exp-content-protection)

### Provenance ve filigran

Biçimin alanları olduğu yerde dışa aktarmalar **provenance metadata** taşır: yazılım, kaynak, aracın adı ve profil atıf satırın; PNG iTXt, JPEG EXIF, PDF bilgisi, SVG `<metadata>` veya bir GIF yorumuna yazılır. Yalnızca yazarlığı kaydeder ve hiçbir şey yüklenmez. **Experimental** araçlar ayrıca görünür bir filigran damgalar; ana bilgisayar tarafından uygulanır, böylece aracı düzenlemek işareti kaldıramaz.

**Lolly Imprint**, **varsayılan olarak açık** görünmez bir piksel filigranıdır. Kimlik bilgisi ve meta veri piksellerin yanında gider ve bir yeniden kaydetmede, ekran görüntüsünde veya meta veri temizlemede kaybolur. Imprint piksellerde yaşar ve yeniden sıkıştırmadan sağ çıkar; bu yüzden bir kopya yine Lolly yapımı olarak tanınabilir. Kriptografik bir garanti değil bir ipucudur ve kişisel veri taşımaz. JPEG XL, PNG, JPG, WebP, AVIF, TIFF ve BMP içinde ve Lolly'nin bir PDF veya PPTX içine render ettiği rasterlerde gider, gömdüğün bir görselde asla. Imprint'i dışarıda bırakmak için **Lolly Imprint** işaretini kaldır ya da `imprint=0` ver. AVIF'in yeniden kodlamadan sağ çıkışı henüz kalibre edilmedi. [Verify](/verify) onu cihazında algılar; bkz. [The Lolly Imprint](/info/what-verify-checks.html#the-lolly-imprint).

**Durable credential**, Lolly'nin kimliğini TrustMark biçiminde cihaz üzerindeki bir sinir ağı modeliyle piksellere yazar; böylece "made with Lolly" bağlantısı bir meta veri temizlemeden ve yeniden kodlamadan sağ çıkar ve TrustMark farkındalıklı araçlarca okunabilir. **Varsayılan olarak kapalıdır**, çünkü dışa aktarma başına bir sinir ağı geçişine ve tek seferlik bir model indirmesine mal olur. PNG, JPG, WebP, AVIF ve TIFF'i kapsar; panelde işaretle ya da `durable=1` ver. Masaüstü ve mobil uygulamalar kartı gizler, çünkü çevrimdışıyken modeli getirebilecekleri bir kaynak yoktur.

**Licence.** Başkalarının çalışmanı nasıl kullanabileceğini seç: varsayılan olarak *None (all rights reserved)*, CC0 1.0, Public Domain Mark 1.0 veya bir Creative Commons 4.0 lisansı (BY, BY-SA, BY-NC, BY-NC-SA, BY-ND, BY-NC-ND). Lisans adı ve metnine bağlantı, dosyanın lisans meta verisine (biçimde varsa EXIF, XMP ve RIFF) ve Content Credential'ına gider. Seçim belgeyle birlikte kaydedilir ve bir bağlantıda `licence=` olarak gider. Lolly seçtiğin lisansı yazar; koşulları denetlemez veya uygulamaz. Claim gibi kendi lisans alanı olan bir araç o alanı korur.

### Tasarım sistemi kaydı

Bir dışa aktarma, dosyayı yapan tasarım sistemini kaydeder: adı, çizildiği yayımlanmış sürüm (çalışma sürümü olmadığında) ve çizildiği [colourway](/info/colourways.html). Bir tasarım sisteminin bildirdiği yoğunluk gibi diğer her tema seçimi aynı şekilde kaydedilir. Açık veya koyu seçimi dışarıda bırakılır, çünkü resim zaten hangisinin kullanıldığını gösterir.

**Hiçbir şey yazılmadan önce kaydı görürsün.** Varsayılan olarak işaretli **Design system** kartı, dosyanın taşıyacağı tam sözcükleri, örneğin *Records: Acme · Colourway: Beach*, ve açıklamanın nasıl okunacağını gösterir. Bir tasarım sisteminin adı sahiplerinin yazdığı şeydir; bu yüzden kart onu yazıldığı gibi gösterir. Kaydı o dışa aktarmanın dışında bırakmak için kartın işaretini kaldır. Design'ın belge paneli aynı sözcükleri *Embedded in exports* altında listeler.

**Açıklama, colourway'i aracın yanında verir.** Kart işaretliyken *"Made with https://lolly.tools : Chart"*, *"Made with https://lolly.tools : Chart (Beach colourway)"* olur. Tasarım sisteminin kendi adı açıklamada değil kayıtta kalır. Araç adı olmayan bir açıklama ya da bir aracın kendi girdilerinden yazdığı bir açıklama olduğu gibi bırakılır. `tokenAxes` yoluyla colourway'leri yok sayan bir araç hiçbirini kaydetmez ve PDF kanıt atfı (`prov` baskı işareti) aynı kuralı izler.

**Bir ajana rehberlik eden marka becerileri.** Bir ajan parçayı yaptığında ve okuyup izlediği [brand skills](/info/brand-skills.html) öğelerini adlandırdığında kayıt ayrıca her beceriyi revizyonuyla listeler; örneğin *Guided by: acme-brand 1.0*. Sözcükler becerinin işe rehberlik ettiği anlamına gelir. Bir denetim değildir: Lolly parçayı bir beceriye karşı sınamaz. Listeyi yalnızca ajanın kendi beyanı ekler; bugün bu, [MCP server](/info/mcp.html)'ın `lolly_render` komutunun `brandSkills` argümanı demektir, yani uygulamada veya bir paylaşım bağlantısından yapılan bir parça hiçbirini taşımaz. Content Credential listeyi `brandSkills` olarak, her becerinin kimliği, adı, revizyonu ve SHA-256 karmasıyla tek bir JSON değeri olarak tutar. XMP paketi ve SVG meta verisi aynı değeri `lolly:BrandSkills` olarak tutar, kayıttan yazılan bir PDF her beceri için bir anahtar sözcük kazanır ve açıklama olduğu gibi kalır. Dahili bir beceri kimliği, adı, revizyonu ve karmasıyla kaydedilir, asla metniyle değil. Aynı anahtarlar listeyi kaydın geri kalanıyla birlikte dışarıda bırakır: **Design system** kartı, `_madewith=0`, `--no-madewith` ve `madeWith: false`. MCP sunucusu dosyayı bir tarayıcıda çizdiğinde (bir PDF, bir JPEG ve tarayıcısız yolunun yazamadığı diğer biçimler), dosyanın kendi meta verisi liste tutmaz ve yalnızca bir Content Credential tutabilir. Kaydı korumak için `c2pa` ver; kimlik bilgisi olmadan render, marka becerilerinin kaydedilmediği konusunda uyarır.

**Kaydı geri okumak.** [Verify](/verify), kaydı bir dosyanın kimlik bilgisi ayrıntılarında **Design system** olarak ve marka becerilerini **Guided by** olarak listeler. *Recreate with these settings* aracı kaydedilen sürümde ve colourway'de yeniden açar. Bağlantı, bu cihaz aynı kimlik ve ada sahip bir tasarım sistemi tutuyorsa kaydedilen tasarım sistemiyle, aksi hâlde etkin tasarım sistemin ile açılır.

::: details Neyin nereye yazıldığı ve hangi çalıştırmaların kaydı dışarıda bıraktığı
| Nerede | Ne yazılır |
|---|---|
| Content Credential | `tools.lolly.export` iddiasında `designSystem` (kimlik), `designSystemLabel`, `designVersion` ve `themes`; her biri düz bir metin değeri; `themes` seçimlerin bir JSON listesidir |
| PNG, JPEG, WebP ve JXL | Dosyanın XMP paketinin `lolly:` özellikleri olarak aynı dört değer, `https://lolly.tools/ns/export/1.0/` ad alanında |
| SVG | `<metadata>` bloğunun içinde aynı `lolly:` özellikleri |
| PDF | *Design system: Acme* ve *Colourway: Beach* gibi anahtar sözcükler |
| Açıklama alanı olan her biçim | Açıklama, colourway aracın yanında |

Kart yalnızca kaydedilecek bir şey olduğunda ve biçim kaydı tutabildiğinde görünür. CSV, JSON, bir takvim dosyası ve diğer metin veya veri biçimleri meta veri tutmaz ve EPS, EMF, DXF ve BMP'nin kayıt için alanı yoktur. HTML, Markdown ve CSS kaydı yalnızca Content Credential içinde tutar; bu yüzden onlar için kart açıklama satırı göstermez ve **C2PA Credentials** kapalıyken gizlenir. Tasarım sisteminin vermediği bir alan dosyanın dışında kalır.

Bir paylaşım bağlantısı kaydı `_madewith=0` ile kapatır ([URL parameters](/info/url-parameters.html)); komut satırı `--no-madewith` alır, [MCP server](/info/mcp.html)'ın `lolly_render` komutu `madeWith: false` alır ve terminal uygulamasının dışa aktarma panelinde bir **Design system** satırı vardır. Komut satırı, bir araç render'ı ve `lolly run` ile kayıtlı bir Design oturumundan dışa aktarılan her dosya için, bitmiş bir dosyanın taşıdığı sözcükleri standart hata çıktısına yazar ve bir MCP render'ı bunları dosyanın yanında yazar; ikisi de dosyadan geri okunur. Komut satırının tarayıcısız çizdiği bir PNG dosya meta verisi taşımaz; bu yüzden kaydı yalnızca kimlik bilgisinde gider. Cihaz üzerindeki yardımcı araçlar hiç meta veri eklemez.

**Design system** kartı olmayan çalıştırmalar kaydı dışarıda bırakır: bir Batch çalıştırması, Projects'ten dışa aktarılan bir klasör ve bir 3D koleksiyon dışa aktarması; terminal uygulamasında da bir CSV toplu işi, bir Projects klasörü veya seçim dışa aktarması ve her şeyi render et görünümü. Tasarım sistemini kaydetmek için araçtan tek bir dosya dışa aktar.
:::

### Content Credentials (C2PA)

Dışa aktarmalar **Content Credentials** taşıyabilir: dosyayı neyin, ne zaman ve nerede yaptığını kaydeden, dosyanın baytlarının bir karmasına bağlı, imzalı bir [C2PA](https://c2pa.org) bildirimi; böylece sonraki her düzenleme algılanabilir. Şartnameyi C2PA yayımlar ve Lolly herhangi bir C2PA okuyucusunun inceleyebileceği standart bildirimler yazar.

![C2PA Credentials kartı, işaretli, onay kutusunun yanında kimlik bilgisi ömrüyle](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26c2pa%3D30%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-c2pa%5Bdata-c2pa-only%5D&walker=1&dark=1&filename=exp-c2pa-card)

- **Varsayılan olarak açık.** **C2PA Credentials** kartı hemen her araç için önceden seçili gelir. Bir dışa aktarma için işaretini kaldır ya da bir bağlantıda `c2pa=off` ver. Bir araç bildiriminde vazgeçebilir.
- **Biçimler.** PDF (RGB ve Print), PNG ve APNG, JPG, GIF, SVG, TIFF (RGB ve Print), WebP (durağan ve animasyonlu), AVIF, MP4, WebM, ses kapsayıcıları MP3, WAV, M4A, OGG/Opus ve FLAC ile HTML, Markdown ve CSS. Bir ZIP desteklenen her üyeyi damgalar; bir Animated SVG'nin bir tane alma biçimi budur. MP4, AVIF ve M4A standart BMFF bağlamasını, MP3 ID3v2 eşlemesini kullanır; bu yüzden `c2patool` ve diğer okuyucular bunları doğrular. WebM ve OGG/Opus'un henüz standart bir eşlemesi yoktur; bu yüzden Lolly bildirimi bir Matroska eki ve bir OpusTags alanı olarak taşır ve bunu Lolly'nin kendi doğrulayıcısı denetler. ICO, EPS, EMF, DXF, BMP, PPTX, Office biçimleri ve diğer metin ve veri biçimlerinin C2PA kapsayıcısı yoktur.
- **Ne kaydeder.** Dosyayı yapan araç ve uygulama, imzalama zamanı, dışa aktaran kabuk, **Design system** kartı işaretliyken [tasarım sistemi ve colourway](#the-design-system-record) ve etkin girdilerin parmak izleri. Girdi metni, profile bağlı alanlar, etkin olmayan denetimler, tarayıcı sürümleri ve işletim sistemi ayrıntıları dışarıda bırakılır. Adın ve e-postan yalnızca Settings → Preferences → Your details altında **Use my details to create** açıkken yazar olarak görünür. Bir dışa aktarmanın yerleştirdiği kaynaklar bileşen olarak gider: emoji gibi [credited works](#source-credits) ve bir video veya ses dışa aktarmasında [Rondocode songs](/info/rondocode.html#songs-in-the-credential).
- **Alıcılar ne görür.** Adobe uygulamaları, `c2patool` ve contentcredentials.org/verify gibi C2PA araçları bildirimi okur ve iddiayı gösterir. Lolly, bir güven listesinden alınan bir sertifikayla değil, cihazında üretilen bir anahtarla imzalar; bu yüzden görüntüleyiciler *unverified* bir kimlik bilgisi bildirir: yapı ve kurcalama kanıtı gerçektir, imzalayan için kefil olunmaz. Bunu değiştirmek için Settings → Preferences → Content Credentials altında bir **verified identity** kaydet; bkz. [Content Credentials Identity](/info/content-credentials-identity.html).
- **Bir dosyayı denetleme.** Herhangi bir dosyayı [Verify](/verify) üzerine bırak ya da `lolly validate <file>` çalıştır; dosyayı Lolly'nin yapıp yapmadığıyla ve sonradan değişip değişmediğiyle başlayan, cihaz üzerindeki bir rapor için. Verify ayrıca kimlik bilgisinin ötesine de bakar; bkz. [What Verify checks](/info/what-verify-checks.html).
- **Gizlilik.** İmzalama anahtarı dışa aktarma için üretilir ve cihazından asla çıkmaz ve iddia yalnızca kaynak bilgisi meta verisinin zaten taşıdığını tutar. Kendi dosyalarını dönüştüren gizlilik yardımcı araçları kimlik bilgisi eklemez ve *Strip Hidden Data* bir C2PA bildirimini diğer her meta veri gibi kaldırır. Rondocode yardımcı aracı yeni ses yapar; bu yüzden yazdığını imzalar ([Rondocode songs](/info/rondocode.html#files-from-the-rondocode-utility)).
- **Etkileşimler.** Parola korumalı bir PDF her iki katmanda da Content Credentials taşıyamaz. Kimlik bilgisi, DPI, EXIF, renk profili, PDF/X meta verisi ve baskı işaretlerinden sonra, bitmiş baytların üzerine en son eklenir.

### Kaynak atıfları

Başkasının çalışmasını yerleştiren bir dışa aktarma o kaynağı kimlik bilgisinde kaydeder. Seçilen emoji setinden çizilen bir emoji gündelik örnektir: çalışma, yaratıcısı, lisans, tam baytların nereden geldiği ve neyin değiştiği, dosyayla birlikte gider. Şablonu SVG olan bir araçtaki metin sistemin kendi emojisini korur; bu yüzden orada hiçbir şey atfedilmez. **Source credits** satırı, indirmeden önce kaynakların teslimattan ne istediğini söyler ve indirmeden sonra atıfların dosyada olduğunu söylemeden önce teslim edilen baytları geri okur. Paylaşmak üzere olduğun, yeniden renklendirilmiş bir CC BY-SA glifi gibi senden seçim yapmanı isteyen bir lisans, seçeneklerle bir kart alır; indirme asla engellenmez. Ifadeyi, incelenen lisansları ve neyin sende kaldığını [Creative rights and credits](/info/creative-rights.html) içerir.

## Parola koruması

İki tür kilit, ikisi de cihazında yapılır. Dışa aktarma panelinin *Password protect* kartı ikisini de yönetir.

![Bir PDF dışa aktarımında açılmış Şifreyle koru kartı, şifre alanı ve iki kilit kademesiyle](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpdf%26password%3Ddemo%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-pdfpass&dark=1&filename=exp-pdf-password)

**Bir PDF açma parolası** bir parola yazdığında iki katmana sahiptir:

- **Weak**: 40 bit RC4, koruma değil caydırıcı. Parolası bir paylaşım bağlantısında düz metin olarak gidebilir. Yalnızca RGB `pdf`.
- **Strong**: AES-256 (PDF 2.0). Dışa aktarmada yazılır ve asla bir bağlantıya konmaz. Ayrıca Print PDF'lere ve bir toplu ZIP içindeki her PDF'e uygulanır. Strong kilitli bir Print PDF, CMYK'sini, işaretlerini ve çıktı amacını korur ama PDF/X-4 iddiasını düşürür.

**Kilitli bir ZIP**, bir ZIP dışa aktarmasını, Projects'ten bir klasör indirmesini veya bir toplu işi iki katmanlı tek bir parolayla kapsar: **Weak** (ZipCrypto, bir caydırıcı; bir `?password=` bağlantısında gidebilir) veya **Strong** (AES-256, dışa aktarmada yazılır, asla bir bağlantıda değil). Parola her üyeyi korur ve içindeki her PDF ayrıca kendi başına AES-256 ile kilitlenir; böylece ZIP açıldıktan sonra da kilitli kalır. İstem indirme başladığında belirir; boş bir parola kilit yok demektir.

**Parola korumalı bir paylaşım bağlantısı** açılmadan önce alıcıdan bir parola ister. Tüm bağlantı durumu parolayı türetilen bir anahtarla (PBKDF2) AES-256 ile şifrelenir; böylece yalnızca şifreli metin gider ve şifre çözme alıcının tarayıcısında olur. Bağlantıyı sunan sunucu parolayı veya tasarımı asla görmez. **Share** iletişim kutusunda aç. Şifreli bir bağlantı yalnızca Lolly'de açılır, asla gömülü bir görsel olarak değil. Bkz. [URL Mode](/info/url-mode.html).

## Telefonda

Dışa aktarma denetimleri yüzen **Export** düğmesinin arkasında durur; bu, **Export** sayfasını açar: aynı biçimler, boyut, kopyalama, indirme ve paylaşım; dokunmaya göre boyutlandırılmış.

## Bağlantılar ve CLI için biçim kimlikleri

Bunlar URL `format=` parametresi ve CLI `--export=` bayrağı için değerlerdir (bkz. [URL parameters](/info/url-parameters.html) ve [CLI](/info/cli.html)). Bir aracın menüsü yalnızca o aracın yapabildiği biçimleri gösterir; bu yüzden her zaman bu listeden kısadır.

| Tür | Kimlikler |
|---|---|
| Raster | `png` · `jpg`/`jpeg` · `webp` · `avif` · `jxl` · `jxl-lossless` · `tiff` (RGB TIFF) · `cmyk-tiff` (Print TIFF) · `bmp` · `ico` |
| Vektör | `svg` · `svgz` (gzip'lenmiş SVG) · `emf` · `wmf` · `eps` · `eps-cmyk` (EPS CMYK) · `dxf` (kesim dosyası) |
| Sayfa ve belge | `pdf` · `pdf-cmyk` (Print PDF) · `pptx` (PowerPoint) · `docx` (Word) · `odt` (OpenDocument Text) · `idml` (InDesign) · `penpot` (Penpot tasarım dosyası) · `scorm` (kurs paketi, bir ZIP) |
| Hareket | `gif` · `apng` (Animated PNG) · `webp-anim` (Animated WebP) · `svg-anim` (Animated SVG) · `webm` · `mp4` · `lottie` (dotLottie) · `premiere-xml` (Premiere XML + media) |
| Ses | `wav` · `mp3` · `m4a` · `aac` · `opus` · `ogg` · `flac` |
| Metin ve veri | `html` · `md` · `txt` · `json` · `csv` · `ics` · `vcf` · `srt` · `vtt` · `css` · `scss` · `gpl` (GIMP palette) |
| Paketler ve bundle'lar | `zip` · `rpm` ve `tar.gz` (render, bir Linux paketine mühürlenmiş) |

Birkaç kimlik bir aracın kendi dışa aktarma kodundan gelir: `ase` (Palette Lab'den Adobe Swatch Exchange) ve `exr` ile `hdr` (Darkroom'dan yüksek dinamik aralıklı rasterler). **Convert Font** sağladığın bir yazı tipi dosyasından `ttf`, `otf` ve `woff` yazar; bu yüzden çıplak bir bağlantının render edecek bir şeyi yoktur.
