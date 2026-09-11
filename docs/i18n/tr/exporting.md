# Dışa Aktarma ve Formatlar

Bir araçtan bitmiş bir dosyanın nasıl alınacağı - doğru formatı seçmek, çıktı boyutunu ayarlamak ve her seçeneğin ne yaptığı. Her şeyde olduğu gibi, **dışa aktarma cihazında gerçekleşir**; hiçbir şey yüklenmez.

## Dışa aktarma nasıl çalışır

Önizleme *dosyanın kendisidir*. Dışa aktardığında, host o tuvali seçtiğin formata işler ve sana bir indirme sunar (veya panoya koyar). Bir araç yalnızca yazarının bildirdiği formatları sunar, ve seçici tarayıcının üretemeyeceği formatları gizler (bkz. [Video](#video)).

Bir dosya üreten üç yol vardır. Çoğu araç **tuvali** seçilen formata işler. Metin ve veri formatları (HTML, MD, TXT, JSON, CSV, ICS, VCF) ise resimden rasterleştirilmek yerine **aracın içeriğinden üretilir**. Ve gizlilik araçları (örn. *Gizli Verileri Temizle*) üçüncü bir yol kullanır: *senin* seçtiğin dosya cihaz üzerinde bayt bayt dönüştürülür ve doğrudan geri verilir - tuval yok, filigran yok ve eklenen köken meta verisi yok, çünkü zaten senin kendi dosyandır.

Dışa aktarma kontrollerindeki eylemler:

- <!--i:download--> **İndir** - dosyayı kaydet (birincil eylem).
- <!--i:photos--> **Kopyala** - görseli doğrudan Slack'e, e-postaya, bir belgeye yapıştırmak üzere panona koy. Tarayıcının görselleri kopyalayamadığı yerde bunun yerine indirir ve sana bildirir.
- <!--i:folder--> **Kaydet** - mevcut tasarımı kitaplığında kayıtlı bir araç oturumu olarak tut.
- <!--i:link--> **Paylaş** - **Paylaşım iletişim kutusunu** açar: tasarımı yeniden üreten kopyalanabilir bir bağlantı, ziyarette açılan geçişler (tam ekran, dışa aktarma paneli, açılışta indirme veya kopyalama) ve tüm durumu kompakt bir tokene sıkıştıran isteğe bağlı bir **En Kısa Bağlantı** (bkz. [URL Modu](/info/url-mode.html)).

(Bunlardan hangilerinin görüneceğini aracın yazarı seçer; varsayılan küme Kopyala, İndir ve Kaydet'tir.)

![Dışa aktarma paneli - format, boyut ve Kopyala / İndir / Kaydet / Paylaş eylemleri](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&walker=1&dark=1&filename=export-panel)

Paylaş, aracın üzerinde açılır; bağlantı önceden oluşturulmuş ve ziyarette açılan geçişler altındadır.

### Aynı anda birçoğunu işleme

Tek bir dışa aktarma bir dosyadır, ama tek geçişte **birçoğunu** işleyebilirsin - her biri bir `.zip` olarak teslim edilir:

- <!--i:folder--> **Projeler → Klasörü işle**, bir klasördeki (ve alt klasörlerindeki) her kaydedilmiş oturumu tek bir iç içe zip olarak dışa aktarır; **Seçimi işle** aynısını herhangi bir çoklu seçim için yapar; tek bir kaydedilmiş oturum doğrudan kendi dosyasına işlenir. Batch/Pro gerekmez - bkz. [Lolly'yi Kullanma → Projeler](/info/using.html).
- <!--i:layers--> **Batch (Pro)**, girdi kümelerinden oluşan bir ızgarayı işler - tek bir şablonun tüm varyantlarını bir kerede.

Kaydedilmiş bir oturum, Projeler'den bir araç bağlantısı olarak yeniden de paylaşılabilir (kaydedilmiş girdilerden araç URL'sini yeniden oluşturur), böylece bir bağlantı onu tam olarak aynı ayarlarla yeniden açar.

## Format seçme

Dosya adı ve format seçici, panelin üstünde tek bir `ad.format` çifti olarak durur, ve seçici yalnızca bu aracın yazarının bildirdiği formatları listeler.

![Dosya adı alanı format seçiciyle birleşmiş, böylece dışa aktarma tek bir ad.format çifti gibi okunur](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.filename-extension&walker=1&dark=1&filename=exp-format-picker)

| İstediğin… | Kullan | Neden |
|---|---|---|
| Ölçeklenen net logolar/görseller | **SVG** | Vektör - sonsuz ölçeklenebilir, küçük, düzenlenebilir |
| Office/Windows uygulamaları için vektör | **EMF** | PowerPoint/Word'e düzenlenebilir vektör olarak yapıştırılır; metin canlı ve düzenlenebilir kalır, Google Drive ise Slaytlar için Google Çizimler'de açar |
| Baskı/tasarım uygulamaları için vektör | **EPS** veya **EPS (CMYK)** | Illustrator/matbaa iş akışları için PostScript vektör |
| Kesim/CAD makineleri için vektör | **DXF** | Lazer kesiciler, vinil plotterlar, CNC - milimetre cinsinden dış hat yolları |
| Düzenlenebilir bir slayt destesi | **PowerPoint** (PPTX) | Yerel düzenlenebilir metin + şekiller, görseller ve vektörler çıkarılabilir kalır |
| Bir LMS'in içe aktarabileceği bir kurs | **SCORM** (LMS) | Manifest, bir başlatma sayfası, slaytlar ve altyazılı seslendirilmiş film içeren bir zip dosyası - bir Design destesinden |
| Düzenlenebilir bir metin belgesi | **Word** (DOCX) veya **OpenDocument** (ODT) | Bir kelime işlemcinin düzenlemeye devam edebileceği gerçek paragraflar ve başlıklar (Doc Studio) |
| Bir fotoğraf veya genel amaçlı görsel | **PNG** (kayıpsız) veya **JPG** (daha küçük) | Evrensel raster |
| Daha küçük modern görseller | **WebP** / **AVIF** | Daha iyi sıkıştırma, alfa |
| Baskı | **PDF** veya **Print PDF** (CMYK) | Gerçek sayfa boyutu; matbaa için CMYK |
| Matbaa için baskı rasteri | **Print TIFF** (CMYK) | Bir RIP için DeviceCMYK pikselleri |
| Web için animasyon | **GIF** | Her yerde çalışır, daha büyük dosyalar |
| Tam renk + gerçek alfa ile animasyon | **APNG** | Animasyonlu PNG - palet sınırı yok, gerçek saydamlık |
| Animasyon, en küçük dosya | **Animated WebP** | Tam renk + alfa, GIF veya APNG'den daha iyi sıkıştırılmış |
| Ölçeklenen animasyonlu vektör | **Animated SVG** | Kendi kendine yeterli; bir tarayıcıda veya `<img>` içinde döngüye girer, codec gerekmez, her boyutta |
| Sosyal medya/paylaşım için video | **MP4** veya **WebM** | Bayt başına en iyi kalite (aşağıya bakın) |
| Zengin metin/e-posta imzası | **HTML** | Posta istemcilerine biçimlendirilmiş şekilde yapıştırılır |
| Düz içerik | **MD** / **TXT** | Sadece metin |
| Bir takvim etkinliği | **ICS** | Herhangi bir takvim uygulamasına aktarılır |
| Bir kişi kartı | **VCF** | Kişiler/adres defterlerine aktarılır |
| Yeniden içe aktarılacak yapılandırılmış veri | **JSON** / **CSV** | Aracın içeriğini karşılıklı olarak aktarır |
| Bir favicon | **ICO** | Çok boyutlu site simgesi (**ZIP** birkaç formatı bir araya getirir) |

İlk satır yaygın durumdur. Marka yazı tipinle oluşturulmuş bir kelime markası SVG olarak dışa aktarılır, burada her harf bir piksel değil çevresi çizilmiş bir yoldur, bu yüzden aynı dosyadan hem bir kartvizit boyutunda hem de bir bina cephesi boyutunda keskin kalır.

![Aurora yazan, ince ve geniş harf aralıklı bir kelime markası, SVG satırının bahsettiği türden saf vektör çizim](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DAurora%26weight%3D200%26tracking%3D16%26size%3D200%26full&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-wordmark-vector)

## Boyut ve baskı birimleri

Varsayılan olarak dışa aktarımlar aracın doğal piksel boyutunu kullanır. Bir aracın **boyutlar** sunduğu yerde, genişlik × yükseklik ve bir **birim** ayarlayabilirsin:

- **px** (varsayılan) - tam piksel.
- **mm · cm · in · pt · pc** - fiziksel/baskı boyutları. Fiziksel bir birimle **DPI** de ayarlarsın (baskı için varsayılan **300**); motor formata göre doğru şekilde dönüştürür - **PDF** o boyutta gerçek bir sayfa olur, **raster** DPI için doğru piksel sayısında işlenir (ve çözünürlüğü gömer), **SVG** px viewBox ile fiziksel birimi korur.

Daha yüksek çözünürlüklü bir raster elde etmek için daha büyük bir genişlik/yükseklik gir, veya fiziksel bir birim seçip DPI'yi yükselt (piksel = boyut × DPI). Tek tıklamalı bir ölçek anahtarı yoktur.

Örnek: genişlik `210`, yükseklik `297`, birim `mm` → bir A4 sayfası.

![210 çarpı 297 mm olarak ayarlanmış boyutlar satırı, birim fiziksel olduğu için ortaya çıkan DPI alanıyla](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26w%3D210%26h%3D297%26unit%3Dmm%26format%3Dpdf%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-dims&walker=1&dark=1&filename=exp-export-dims)

## Zamanlı bir kompozisyondan durağan kareler

**Zamanlanmış bir kompozisyon** - Design'daki bir [Sequence](/info/using.html#timeline-sequence) zaman çizelgesi ya da zaman çizelgesi tabanlı herhangi bir çalışma yüzeyi - hareketli bir şeydir, bu yüzden sabit bir dışa aktarma "hangi an?" sorusunu yanıtlamak zorundadır. Kural beklediğin gibidir: **oynatma başlığındaki kare**. Oynatma başlığını istediğin görüntünün olduğu yere getir ve dışa aktar; gördüğün şey çıkan şeydir.

Birden fazla an istediğinde, çıktı boyutunun yanında **Kareler** alanı görünür (yalnızca zamanlı bir kompozisyon için, ve yalnızca durağan bir format için - PNG, JPG, WebP, SVG veya PDF). Oynatma başlığı karesi için `1`'de bırak. Yükselttiğinde, tüm dizi boyunca eşit aralıklarla örneklenmiş o kadar durağan kare elde edersin:

- **Raster ve SVG** tek bir **zip** olarak döner - `<name>-01.png`, `-02.png` ve benzeri.
- **PDF** ise **o kadar sayfadan oluşan tek bir belge** olarak döner.

Bir hikaye tahtası, bir küçük resim sayfası, inceleme için bir kontak baskı sayfası veya doğrudan bir video kurgusundan kesilen bir sosyal medya karuseli için kullanışlıdır.

Örnekleme, kenarlarda değil her aralığın **orta noktasında** alınır, çünkü bir dizinin ilk anı genellikle henüz solmamış bir giriş geçişidir ve son anı da her klibin bittiği durumdur - uç nokta örneklemesi karelerinden ikisini neredeyse boş olanlara harcardı. Sayı **64** ile sınırlıdır (bir kontak baskı sayfası bir insanın okuması içindir), ve alana yazılan anlamsız herhangi bir şey, dışa aktarımı başarısız kılmak yerine `1`'e geri döner. Her kare sıradan bir durağan karedir, bu yüzden Content Credentials, damga, fiziksel birimler ve DPI tam olarak tek bir dışa aktarımda davrandığı gibi davranır.

**Kareler** alanı bugün bir sayfa elde etmenin yoludur. Motor eşleşen bir `cuts` URL parametresi ayırır, ama henüz hiçbir shell bunu bir bağlantıdan okumaz, bu yüzden paylaşılan bir bağlantı her zaman oynatma başlığı karesinde yeniden açılır - bkz. [URL Modu](/info/url-mode.html#contact-sheets-cuts).

## Çok sayfalı PDF

Bazı araçlar tek bir çalışma yerine **çok sayfalı bir PDF belgesi** oluşturur - bir kapak, gerektiği kadar sayfaya yayılan içerik ve bir arka sayfa, hepsi tek bir dosyada (*Booklet* aracına bakın). Her sayfa, o sayfanın kutusuna göre boyutlandırılmış **gerçek bir PDF sayfasıdır**, böylece okuyucular ve yazıcılar tek bir uzun görsel değil, gerçek sayfalar alır.

- **İçerikten sayfalar.** Metin ve görsel blokları ekle; bloklar doldukça yeni sayfalar otomatik olarak oluşturulur, ve herhangi bir bloğu yeni bir sayfa başlatmaya zorlayabilirsin.
- **Gerçek sayfa boyutları.** A4, US Letter veya A5 (dikey - iki sütunlu düzen bunun için tasarlanmıştır) seç - her sayfa, ve dışa aktarılan PDF, tam olarak o boyutta işlenir.

Çok sayfalı PDF'ler RGB belgelerdir ve kesim/taşma işaretleri taşımaz - bunlar yukarıdaki tek sayfalı **Print PDF** yoluna aittir. Ancak her PDF dışa aktarımıyla aynı **PDF/X-4 meta verilerini** taşırlar (sayfa kutuları, XMP, belge kimliği, gömülü profille bir sRGB çıktı amacı) ve **Content Credentials** sunarlar (aşağıda) - *Booklet* aracında bu seçenek önceden seçilmiş olarak gelir.

## Aynı anda birçok şey üretme

Lolly'nin hacimde çalışmak için üç farklı yolu vardır, ve bunlar farklı işleri çözer - toplu düzenleme platformun birinci sınıf bir yeteneğidir, her aracın yeniden icat ettiği bir şey değil:

- <!--i:document--> **Bir tasarım × bir satır tablosu → tek bir çok sayfalı belge.** `table` girdisine sahip araçlar (*Battlecards* gibi) her satırı otomatik olarak bir sayfaya dönüştürür - elektronik tablondan bir tablo yapıştır, deste boyutunda bir PDF al. Gerçek toplu düzenleyicin elektronik tablo olarak kalır: on satırı orada düzelt, yeniden yapıştır. Aracın kendisi sayfaları hiç yönetmez.
- <!--i:layers--> **Bir tasarım × bir veri dosyası → birçok ayrı dosya.** `/pro` toplu ızgarası bir CSV alır ve *satır başına* bir dışa aktarım işler - isim rozetleri, sertifikalar, her biri bir dosya.
- <!--i:sliders--> **Yan yana düzenlenen birçok farklı varlık.** *Multi-edit*, farklı tasarımlar arasında koordineli rötuşlar için tek bir görünümde birkaç kaydedilmiş oturumu açar.

Genel kural: **tek bir belgeye** ait aynı tasarımın satırları → tablo tabanlı bir araç; **ayrı dosyalar** olarak gönderilmesi gereken satırlar → `/pro`; aynı düzeltmeyi gerektiren **farklı tasarımlar** → multi-edit. (Planlanan bir "medyayı birleştir" işleme seçeneği ilk ikisi arasında köprü kuracak - aynı formattaki dışa aktarımları tek bir PDF'de, tek bir videoda veya bir onay kontak baskı sayfasında birleştirerek.)

## PowerPoint (PPTX)

Design, Markdown Slides, Booklet, Doc Studio, Chart ve Diagrams bir **PowerPoint destesi** dışa aktarabilir - sayfa başına bir slayt. Buradaki amaç piksel mükemmelliğinde bir ekran görüntüsü değil; bir meslektaşına gerçekten **düzenleyebileceği ve içinden varlık çıkarabileceği** bir deste vermektir. Bu yüzden her sayfa yerel nesnelere ayrıştırılır:

- <!--i:font--> **Metin**, düzendeki yazı tipi boyutu, rengi, kalınlığı, italiği ve hizalamasıyla gerçek, **düzenlenebilir PowerPoint metin kutularına** dönüşür - böylece PowerPoint'te bir yazım hatasını düzeltebilir veya stili yeniden ayarlayabilirsin.
- <!--i:pentool--> **Vektörler** (logolar, ikonlar, SUSE amblemi) **gerçek SVG resimleri** olarak gömülür - her boyutta net kalırlar ve PowerPoint bunlar üzerinde *Convert to Shape* bile yapabilir.
- <!--i:photos--> **Görseller**, kendi çıkarılabilir resimleri olarak yerel çözünürlüklerinde gelir (`cover` ile kırpılmış bir kahraman görsel, kırpmanın arkasındaki tam görseli korur, böylece yeniden çerçeveleyebilirsin), görsel üzerindeki her işlem (filtreler, karışımlar) sadakatle pişirilmiş olarak.
- <!--i:layers--> **Arka planlar, kenarlıklar ve çizgiler** gerçek dikdörtgen/çizgi şekillerine dönüşür.

![PowerPoint seçiliyken dışa aktarma paneli: sayfa başına bir slayt, metin ve şekiller düzenlenebilir kalır](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio%3Foptions&width=1440&height=900&dpi=192&waitMs=2500&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22pptx%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-pptx)

Düzen tasarım gereği yaklaşıktır - amaç, kilitli bir ekran görüntüsü değil, sadık ve yeniden kullanılabilir **içerik**tir. Walker'ın yerel olarak ifade edemediği her şey (karmaşık filtrelenmiş veya maskelenmiş bir bölge) hiçbir şey kaybolmasın diye resim olarak gömülür. Bir sunumun tek bir slayt boyutu vardır, ilk sayfadan alınır.

PowerPoint aynı zamanda **içeri** giren bir yoldur. Herhangi bir yükleme yüzeyine bir `.pptx` bırak ve istediğin slaytları seç - her biri yerleştirebileceğin, düzenleyebileceğin veya üzerine inşa edebileceğin bir varlık haline gelir. **Markdown Slides**, Markdown'dan yepyeni bir deste yazar (ve markalı bir `.pptx` şablonu verir), **Rebrand** yardımcı aracı ise var olan bir desteyi olduğu yerde yeniden temalandırır - tema paleti, sabit kodlanmış renkler ve yazı tipleri - grafiklerine, SmartArt'ına veya animasyonlarına dokunmadan, geri bir `.pptx` verir. Bkz. [Bir tasarımı içe aktar → Desteler ve belgeler](/info/design-import.html#decks-and-documents).

## Penpot

SVG dışa aktarabilen herhangi bir araç bir **Penpot dosyası** (`.penpot`) da dışa aktarabilir - sadece bakmak için değil, Penpot'ta düzenlemeye devam etmeye hazır bir belge.

- <!--i:layout--> **Design**'dan, her çerçeve bir Penpot **board**'una (pano) dönüşür, üzerindeki her kutu kendi düzenlenebilir şekli olarak aktarılır - dikdörtgen, elips, metin, görsel veya yol - ve sonuç, Assets panelinde yeniden dışarı sürüklemeye hazır, yeniden kullanılabilir bir **component** (bileşen) olarak gelir.
- <!--i:pentool--> Çıktısı **düz geometri** olan bir araçtan - QR Code, Street Map, Wordmark ve Palette Lab gibi vektör araçları - her yol, dikdörtgen, metin dizisi ve gradyan aynı şekilde, kendi düzenlenebilir şekli olarak aktarılır.
- <!--i:font--> Çıktısını **HTML** olarak düzenleyen bir araçtan, **metin metin olarak kalır** - satır başına bir düzenlenebilir Penpot metin nesnesi, bir dış hat veya düz bir resim değil. Penpot'un karşılığı olmayan bir sanat eseri parçası - karmaşık bir illüstrasyon, canlı bir tuval - kendi başına bir görsel olarak yanında gelir, böylece etrafındaki metni ve kutuları asla düzleştirmez. Penpot'un sadakatle ayıramayacağı bütün bir düzen yine de tam sadakatte tek bir görsel olarak aktarılabilir, böylece hiçbir şey asla kaybolmaz.
- <!--i:palette--> Bir şeklin **bir marka token'ından devraldığı** bir renk veya yazı tipi, dosyada o token'a **bağlı** kalır: token'ı Penpot'un Tokens panelinde değiştir, onu devralan her şekil birlikte yeniden boyanır; tek seferlik sabit bir renk ise tam olduğu yerde kalır. Markanın renkleri ve tipografileri de **Assets** paneline, tam tasarım-token setiyse **Tokens** paneline düşer - Lolly'nin kendi paletinin kullandığı aynı DTCG token setidir bu. Penpot buradan kendi kopyasını tutar: Tokens panelinde yapılan bir düzenleme, kendiliğinden değil, [Brand Studio'nun içe aktarımı](/info/design-import.html) üzerinden markaya geri döner.

| Ne yaptın | Penpot'ta |
|---|---|
| Metin | Düzenlenebilir metin nesneleri - bir yazım hatasını düzelt veya yeniden biçimlendir |
| Şekiller, yollar, gradyanlar, görseller | Kendi düzenlenebilir vektör şekilleri |
| Bir marka token'ından gelen renk veya yazı tipi | Canlı bir token bağlantısı - token'ı düzenle, onu devralan her şekil izler |
| Tüm tasarım | Assets panelinde yeniden kullanılabilir bir bileşen |
| Karmaşık bir illüstrasyon veya canlı tuval | Kendi başına bir görsel olarak gömülür, etrafındaki düzenlenebilir içerik dokunulmamış kalır |

![Penpot seçiliyken dışa aktarma paneli: .penpot dosyası ve indirmenin yanında Send to Penpot](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22penpot%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-penpot)

Açmak için Penpot'u başlat, bir proje seç ve **Import**'u (İçe Aktar) seç. Dışa aktarma panelinden Penpot'a giriş yapılmışsa, **Send to Penpot** bu adımı senin yerine yapar - orada bir proje seç, dosya doğrudan içine gider.

## SCORM (kurs paketleri)

Bir Design destesi bir **SCORM paketi** olarak dışarı çıkabilir - bir öğrenim yönetim sisteminin içe aktardığı zip dosyası, ister Moodle, Canvas, Blackboard ister kurumsal bir LMS olsun. Format seçicide **SCORM (LMS)**'i seç, dışa aktarma şunları yazar:

- <!--i:layout--> **Slaytlar**, çalışma yüzeyi başına bir görsel, izin verdiği yerde vektör, izin vermediği yerde ise sadece piksel olarak.
- <!--i:play--> **Seslendirilmiş film**, altyazı izlemesiyle birlikte - cihaz üzerinde çalışan bir sesle okunan konuşmacı notları, tam olarak [Presenting](/info/create/using.html#presenting)'in oynattığı şekilde.
- <!--i:file--> Slaytlar arasında adım adım ilerleyen, filmi oynatan ve tamamlanma durumunu her LMS'in kabul ettiği sürüm olan SCORM 1.2 çalışma zamanı üzerinden LMS'e bildiren **bir başlatma sayfası**.
- <!--i:font--> Destenin kullandığı yazı tipleri, böylece başlatma sayfası çevrimdışıyken de aynı şekilde görüntülenir.

![SCORM (LMS) seçiliyken bir Design destesindeki dışa aktarma paneli](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour%26format%3Dscorm%26options&width=1440&height=900&dpi=192&waitMs=3500&css=.fc-insp%7Bdisplay%3Anone!important%7D.edge-dock-slot--fill%7Bflex%3A1%201%20auto!important%3Bheight%3Aauto!important%3Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D.export-popup.is-floating%7Bheight%3Aauto!important%7D.export-popup-body%7Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-scorm)

Paketin içindeki hiçbir şey eve telefon etmez: bir zip içindeki dosyalardır ve LMS içinde paketleyici, CDN veya hesap gerekmeden çalışır. Web ve masaüstü uygulamaları bunu oluşturur; CLI oluşturmaz, çünkü çalışma yüzeylerini fotoğraflamak ve filmi kodlamak tarayıcı gerektirir.

## DXF (kesim dosyaları)

Vektör araçları (Brand Lockup, QR Code, Street Map, Wayfinding Signage, Pose Geeko, logo varyantları, Diagram Builder) **DXF** olarak dışa aktarabilir - lazer kesicilerin, vinil plotterların ve CNC/CAD yazılımının okuduğu AutoCAD R12 değişim formatı. Geometri, **milimetre cinsinden kontur yolları** olarak yazılır (eğriler ince bir toleransla düzleştirilir), metin kontur yollarına dönüştürülür ve renk en yakın AutoCAD Color Index'e eşlenir (bu genellikle bir kesicideki aracı/işlemi yönlendirir). DXF yalnızca çizgi sanatıdır - fotoğrafik veya filtrelenmiş bir bölgenin kesim yolu formu yoktur ve atlanır (Lolly uyarır), bu yüzden raster içeriği korumak gerektiğinde SVG/PDF kullan.

Street Map en net örnektir: tüm tasarım zaten çizgilerden oluşur, yani her yol ve kanal, düşecek hiçbir şey olmadan bir kesim yoluna dönüşür.

::: showcase
![Krem üzerine mürekkeple çizilmiş bir Street Map Paris render'ı - saf çizgi sanatı, böylece her çizgi bir kesiciye giden yolculuğu atlatır](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Dparis%26roadColor%3D1a1a2e%26waterColor%3D93c5fd%26background%3Dfaf7f2%26full&width=1440&height=900&dpi=96&waitMs=3200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-street-map-cut)

Kaydır, ve kamera gerçek geometrinin içinden geri çekilir: yedi yol, hiçbir yerde piksel yok, her zumda kıl payı netliğinde her çizgi. Bu, bir kesicinin okuduğu dosyanın aynısıdır.
:::

## Animasyonlu SVG

Hareket araçları (Animated Ad, Lottie Ad) **Animasyonlu SVG** dışa aktarabilir - kendi kendine yeten, *vektör* bir animasyon. Her kareyi piksellere örnekleyen GIF/APNG/WebP'nin aksine, animasyonlu bir SVG, gömülü CSS anahtar kareleriyle vektör anlık görüntülerini üst üste yığar, böylece **hiçbir kodek ve harici çalışma zamanı olmadan her boyuta ölçeklenir** - bir tarayıcı sekmesinde veya bir `<img>` içinde döngüye girer. Metin anahatlı kalır, böylece her yerde işlenir. Animasyonlu formatların **Süre** / kare hızı denetimlerini paylaşır ve (kare başına bir bitmap'ten daha ağır olduğu için) daha düşük bir varsayılan kare hızı kullanır.

## Saydamlık

Bunu destekleyen araçlar bir **saydam arka plan** düğmesi sunar (örn. *No BG*). Saydamlık; PNG, WebP, AVIF, SVG (durağan ve animasyonlu), APNG ve Animated WebP tarafından korunur. JPG ve PDF her zaman opaktır ve TIFF beyaza düzleşir (HDR yolunda siyaha - aşağıya bak).

## Renk uzayları

Ayrı tutulmaya değer iki farklı soru: Lolly'nin **okuyup düşünebildiği** renk uzayları hangileri, **yazdığı** uzaylar hangileri.

**Okuma.** Bir rengin yazıldığı her yerde - bir aracın stil sayfası, içe aktarılmış bir SVG'nin boyası, bir tasarım token'ının değeri, bir CSS kısaltması içindeki gölge veya gradyan - Lolly tam **CSS Color 4** kelime dağarcığını okur: `#hex`, `rgb()`, `hsl()`, `hwb()`, `lab()`, `lch()`, `oklab()`, `oklch()`, CSS adlandırılmış renkleri ve önceden tanımlı uzaylardaki `color()` - `srgb`, `srgb-linear`, `display-p3`, `a98-rgb`, `prophoto-rgb`, `rec2020`, `xyz-d50`, `xyz-d65` - `none` anahtar sözcüğü olarak yazılan bileşenler dahil. Tek bir ayrıştırıcı bunu tüm platform için yapar, böylece tarayıcı ve her dışa aktarma walker'ı bir renk dizisinin ne anlama geldiği konusunda hemfikirdir.

Bu, kulağa geldiğinden daha önemli, çünkü bir tarayıcı modern CSS'yi modern CSS'ye çözer. `color-mix(in oklab, …)` yaz ve Chrome `oklab(…)` hesaplar; `oklch()` olarak saklanan bir marka token'ı kullan ve dışa aktarma walker'ının gördüğü değer tam olarak budur. Bu biçimlerdeki renkler düşürülmek yerine doğru okunur - sadece `rgb()` anlayan bir walker'ın yaptığı, marka renkli metni siyah olarak dışa aktarmak, tonlanmış panelleri ve tablo çizgilerini kaybetmek ve `oklch(0.7 0.1 200) 0px 2px 4px`'i 0.7 ile 0.1'lik bir gölge kayması olarak okumaktı.

**Düşünme.** Renk matematiği ham kanallarda değil, algısal olarak gerçekleşir. Palet türetme, rampalar, uyumlar ve kontrast **OKLCH/OKLab**'de çalışır ve gamut dışı bir renk, kanalları kırpmak yerine CSS Color 4'ün kendi gamut eşleme algoritmasıyla - algısal mesafe kontrolüyle kroma azaltma - aralığa getirilir, böylece canlı bir renk, düzleştirilmiş bir renk yerine gerçekten kabul edeceğin en yakın renkte yerleşir. Gradyanlar seçtiğin bir uzayda enterpolasyon yapar (varsayılan olarak OKLab, veya `oklch`, `lab`, `lch`, `srgb`, `srgb-linear`, `hsl`, kutupsal olanlar için bir ton geçiş yönüyle), ve karıştırma **ön çarpımlıdır**, bu yüzden saydamlığa doğru bir geçiş, yol boyunca siyaha doğru koyulaşmak yerine doğru rengi korur. Tek bir enterpolatör hem önizlemeye hem de dışa aktarma walker'larına hizmet eder - bu da konik bir gradyanın ekranda bir şekilde, dışa aktarılan dosyada başka bir şekilde karıştırılmasını engelleyen şeydir.

**Yazma.** Çıktı kasıtlı olarak girdiden daha dardır, çünkü bir dosya onu açan her şey tarafından okunabilir olmalıdır ve bir uzay yalnızca sayılar gerçekten ona dönüştürüldüğünde çıktıda *belirtilir*. Ekran ve web formatları **sRGB** olarak yazılır ve öyle etiketlenir; baskı formatları adlandırılmış bir baskı koşuluna (aşağıda) karşı **CMYK** olarak yazılır; ve HDR yolu **Rec.2100 PQ**'dur (yukarıda). Dışa aktarmaya ulaşan geniş gamutlu bir renk, yanlış etiketlenmek yerine sRGB'ye eşlenir - `color(display-p3 …)`'ü bir vektör dosyasına taşımak, bugünkü dışa aktarmaların yaptığını iddia ettiği bir şey değil, planlanan bir genişletmedir. OKLab'da tasarlanan bir gradyan, çıkışta düz sRGB duraklarına *pişirilir*, ek duraklar yalnızca sRGB'nin algısal eğriden görünür biçimde saptığı yerlere eklenir, çünkü bir SVG `<linearGradient>`'i ve bir PDF eksenel gölgelendirmesinin niyeti taşıyacak bir enterpolasyon-uzayı ayarı yoktur. Tek tasarlanan değer, üç işleyici, hiç sapma yok.

## Renk profilleri

Renkler renk yönetimli uygulamalarda (baskı büroları, Photoshop, tarayıcılar) sadakatle yeniden üretilsin diye, dışa aktarmalar bir **renk profiliyle etiketlenir**:

- **PNG / JPG** gömülü bir **sRGB** ICC profili taşır - önizlemenin gerçekten işlendiği renk uzayı - böylece tahmin edilecek hiçbir şey kalmaz. (Yalnızca etiketleme; pikseller yeniden kodlanmaz.)
- **Baskı PDF'i (CMYK)**, *OutputIntent*'inde hedef bir **baskı koşulu** bildirir (varsayılan *Coated FOGRA39*), bir RIP/baskı bürosuna CMYK mürekkeplerinin nasıl okunması gerektiğini söyler. Ölçülmüş mürekkep değerlerine sahip marka renk örnekleri tam olarak dönüştürülür; diğer renkler standart bir cihaz dönüşümü kullanır. Bu bildirim bir *isim*dir: Lolly ile hiçbir CMYK profili gelmez ve PDF/X-4, profilin gömülü olmasını ister, bu yüzden adlandırılmış bir koşul PDF/X-4 uyumluluğu iddia etmeden çıktı niyetini yazar. Kendi CMYK profilini yükle ve Renk profili denetiminde **Embed** satırını seç, o zaman dosyanın *DestOutputProfile*'ı olarak gömülür - bu noktada PDF gerçekten PDF/X-4 olabilir ve dosyanın geri kalanı izin verdiğinde bunu iddia eder. Üç şey iddiayı geri tutarken çıktı niyetini korur (bir RIP hâlâ onu ister): CMYK geçişinin dönüştüremediği RGB sanat çalışması, `prov` kanıt-kenar boşluğu kredi metni (gömülü olmayan standart bir yazı tipiyle çizilir ve X-4 bunlar için istisna tanımaz) ve **Strong** bir parola, çünkü X-4 şifrelemeyi yasaklar. Bildirdiği koşul, sonra o profilden okunur: profilin kanıtladığı yerde kayıtlı bir isim, kanıtlamadığı yerde profilin kendi adı altında `Custom` - böylece dosya bir baskı koşulunu adlandırırken başka birinin ölçümlerini taşıyamaz.
- **Baskı TIFF'i (CMYK)** etiketlenmemiş **DeviceCMYK** pikselleri yazar ve aynı baskı koşulunu bir profil gömmek yerine TIFF meta verisinde (*ImageDescription*) köken olarak kaydeder. Aynı Renk profili denetimi her iki CMYK formatını da yönetir - bir TIFF hiç baskı profili gömemez, bu yüzden bir **Embed** satırı orada yalnızca o profilin kendi adını kaydeder, başka bir şey değil.
- **TIFF (RGB)** düz, sıkıştırılmamış sRGB kardeşidir - arşivleme veya bir editör gidiş-dönüşü için seçilen DPI'da kayıpsız bir raster, köken aynı TIFF meta verisinde kaydedilir. Herhangi bir saydamlık beyaza düzleşir (bu profil alfa taşımaz). CMYK TIFF gibi bu da yalnızca masaüstündedir, çünkü tarayıcılar bir TIFF'i önizleyemez ve mobil indirmeler çıkmaza girer.
- **SVG**, **EMF**, **EPS** ve **DXF**, gömülü profili olmayan çözünürlükten ve profilden bağımsız vektörlerdir - SVG'nin renkleri düz sRGB'dir, EMF'nin ve EPS'nin renkleri cihaz RGB'sidir (ve **EPS (CMYK)** naif DeviceCMYK yazar) ve **DXF** en yakın AutoCAD Color Index'i taşır. (SVG, EPS ve DXF, PDF gibi, her metni vektör yollarına anahatlar, böylece sonuç yazı tipi kurulu olmayan yerde bile işlenir. EMF bunun yerine metni varsayılan olarak CANLI tutar - Office ve Google Slides'ta seçilebilir ve düzenlenebilir kalan gerçek metadosya metin kayıtları, formatın ifade edemediği koşular için yalnızca anahatlara döner; dışa aktarma panelindeki "Outline fonts" seçeneği her yerde yolları zorlar.) **SVG** ayrıca HTML'den CSS `box-shadow`'unu yeniden üretir - her dış gölge kutunun arkasına, tarayıcıyla eşleşecek şekilde kaydırılmış/yayılmış ve Gauss bulanıklaştırılmış olarak boyanır, iç gölgeler ise aynı şekilde kutunun içine boyanır.

Bu otomatiktir - üzerinde oynanacak bir ayar yoktur. Küçük görseller ve önizlemeler küçük kalmak için etiketi atlar. Bir profil *bir seçimdir*, çünkü yalnızca etiketlemek yerine pikselleri değiştirir - aşağıdaki **HDR**'ye bak.

## HDR (parlak renkler)

Sıradan dışa aktarmalar sRGB'dir: beyaz beyazdır ve doygun bir marka rengi ekranın normal beyazı kadar parlaktır. HDR uyumlu bir ekranda bunun üzerinde çok fazla alan vardır ve dışa aktarma panelindeki **HDR** kartı bunu kullanır - marka renklerin ve beyaz metnin gerçekten *parlaması* için tepe parlaklığa doğru yükseltilir, koyu alanlar ise koyu kalır ve parlamaya kontrastını verir.

![Dışa aktarma panelindeki HDR kartı, açık, altında görünen White / Reach / Dark lift / Focus kadranlarıyla](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26hdr%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-hdr&walker=1&dark=1&filename=exp-hdr-card)

- **Formatlar.** Sinyali taşıyacak bir yeri olan raster formatlar: **PNG**, **JPG**, **AVIF** ve **TIFF**. (WebP değil - 8 bit olduğu ve çalışan bir HDR çözme yolu olmadığı için, bir PQ WebP sadece karanlık görünürdü. Vektörlerin ve PDF'in ise hiç HDR modeli yok.)
- Renk etiketlemenin aksine **varsayılan olarak kapalıdır** - pikselleri değiştirir, bu yüzden isteğe bağlıdır. Kartı işaretle veya bir paylaşım bağlantısında `hdr=1` geçir.
- **Aslında ne yazılıyor.** Pikseller **Rec.2100 PQ**'ya yeniden kodlanır - SMPTE ST 2084 (PQ) aktarım eğrisiyle BT.2020 birincil renkleri - ve konteyner, renk yönetimli bir uygulamanın onları o şekilde okuması gerektiğini bilmesi için eşleşen sinyali taşır: oluşturulmuş bir **`cicp` etiketli ICC v4 profili** (JPG, TIFF), bir **`cICP` parçası** (PNG) veya yeniden yazılmış bir `colr` kutusu (AVIF). Artırım **algısal (OKLab) parlaklığa** göre kısılır, böylece orta ve üstü renkler tepe noktaya vurur, koyu renkler ise patlatılmak yerine yumuşatılır; ayrıca ton koruyucudur - marka yeşili daha parlak olur, naneli olmaz.
- **Kadranlar.** Kart açıldığında ortaya çıkan dört tanesi: **White** (tepe parlaklık tavanı, 400–2000 nit), **Reach** (parıltının tonlar arasında ne kadar aşağı yayıldığı), **Dark lift** (koyu tonların ne kadar aydınlatıldığı - `0` onları koyu tutar) ve **Focus** (artırımın ne kadar renk zenginliği koruduğu). Bunlar kompakt ayarlı bir değerle aynı parametrede taşınır - `hdr=1600-60-0-50`, White 1600, Reach 60, Dark lift 0, Focus 50 demektir - böylece ayarlanmış bir görünüm bağlantıdan yeniden üretilebilir.
- **Nerede göreceksin.** Bir HDR ekranda renk yönetimli görüntüleyiciler: Apple cihazlarında Preview / Quick Look / Safari, bir HDR monitörde Chrome. Sıradan bir SDR ekranda dosya yine de normal bir görsel olarak görünür.
- **Yayınlamadan önce bilmen gerekenler.** Birçok platform yüklediğin şeyi **yeniden kodlar** ve HDR sinyalini kaldırır - sosyal ağlar, mesajlaşma uygulamaları, bazı CMS'ler - bu da görselin karanlık veya solgun görünmesine yol açabilir. HDR'yi hedefi kontrol ettiğin yerlerde kullan (kendi oluşturduğun bir site, bir video duvarı, parlak bir panelde bir deste), her şey için varsayılan olarak değil.
- **Saydamlık.** PNG ve AVIF alfa kanallarını korur; JPG her zamanki gibi opaktır. **TIFF** yolu, SDR yolunun beyazı yerine **siyah** üzerine düzleştirir - PQ'da beyaz, 10.000 nit'lik koddur, bu yüzden onun üzerine düzleştirmek her kenarı kör edici bir hale ile çevrelerdi.
- **Terminalden aynı baytlar.** `--export=png` veya `--export=jpg` ile birlikte `--hdr=1`, [CLI](/info/cli.html)'de de 16 bit Rec.2100 PQ PNG'yi ve ISO 21496-1 kazanç haritalı JPEG'i yazar, bir tarayıcı yerine aynı motor kodlayıcılarından - böylece `<svg>` tabanlı bir araç, yolda hiçbir Chromium olmadan bir HDR dosyası üretir ve PNG, web kabuğununkiyle bayt bayt aynıdır. AVIF ve TIFF şimdilik web kabuğu dışa aktarımları olarak kalır.

## Video

Animasyonlu araçlar hareketi **MP4**, **WebM** veya **GIF** olarak dışa aktarır - ve sunulduğu yerde, **APNG**, **Animated WebP** veya vektör **Animasyonlu SVG** (yukarıda). Hangi video kapsayıcısını gördüğün tarayıcına bağlıdır - seçici yalnızca gerçekten kaydedebildiğini gösterir:

| Tarayıcı | Gösterir |
|---|---|
| Safari / iOS | **MP4** |
| Firefox | **WebM** |
| Chrome / Edge 126+ / Android | **MP4 ve WebM** |
| Eski Chrome | **WebM** |

GIF her yerde çalışır (sohbet/e-posta için harika; video'dan daha büyük ve daha düşük renklidir). Animasyonlu araçlar ayrıca **Wait** (kaydetmeden önce animasyonun oturması için beklenecek saniye) ve **Duration** (klip uzunluğu) sunar.

> Tarayıcının kaydedemediği bir kapsayıcı isteyen paylaşılan bir `?format=…` bağlantısı, incelikle diğerine döner ve dosyayı buna göre adlandırır.

**Ses.** Video dışa aktarmaları sessiz değildir. Bir araç klibin altına bir **müzik altyapısı** yerleştirebilir - katalogdan bir ses varlığı, klip uzunluğuna döngülenmiş veya kırpılmış, giriş/çıkış solması, ses düzeyi ve görüntünün kendi sesinin altında otomatik kısma ile - ve kayıt araçları görüntülerinin canlı sesini doğrudan dosyaya taşır. **MP4** ve **WebM** karıştırılmış izi korur; GIF ve animasyonlu görsel formatları (APNG, Animated WebP, Animasyonlu SVG) doğaları gereği sessizdir.

## Ses

Bazı araçlar **sesi tek başına** dışa aktarır, yalnızca bir video izi olarak değil. **Voice Recorder**, canlı bir seviye ölçeriyle ve nazik yönlendirmeyle bir mikrofon çekimi yakalar, ardından **MP3** (varsayılan, tarayıcında kod dönüştürülür) veya kendi yerel kapsayıcısında kaydeder - tarayıcının kaydettiği hangisiyse, **M4A** (AAC), **OGG** veya **WebM** (Opus). Her şey gibi, kodlama cihazında gerçekleşir - hiçbir şey yüklenmez.

*İçeri getirdiğin* ses de aynı derecede geniştir. Varlık seçici **MP3**, **WAV**, **OGG**/**Opus**, **M4A**/**AAC** ve **FLAC** (bayt bayt korunur ve cihazda çözülür), **MIDI** (`.mid` - içe aktarmada küçük bir cihaz üstü sentezleyici izine dönüştürülür) ve **tracker modülleri** - **MOD**, **XM**, **IT**, **S3M**, **STM**, **MTM** (dahil bir oynatıcı tarafından cihazda çözülür, birkaç kilobaytlık şarkı verisi) kabul eder. Bunların herhangi biri bir video dışa aktarmanın altında **müzik altyapısı** olabilir veya Neurospicy Mode'un ortam çalarında oynatılabilir.

Ses aşağıdaki `format=` / `--export=` hattının *bir parçasıdır*: `wav`, `mp3`, `m4a` ve `opus` sıradan format kimlikleridir, bu yüzden yalnızca ses dışa aktarma bir PNG kadar paylaşılabilir ve komut dosyasıyla çalıştırılabilir. Çıkan şey yalnızca sestir, görsel yoktur.

## Köken ve filigran

Formatın desteklediği yerde, dışa aktarmalar **köken meta verisi** taşır - yazılım, kaynak, aracın adı ve profil kredi satırın - yerel olarak gömülü (PNG iTXt, JPEG EXIF, PDF bilgisi, SVG `<metadata>`, GIF yorumu). Bu yalnızca yazarlıktır; hiçbir şey yüklenmez. **Experimental** araçlar ek olarak görünür bir filigran damgalar, ana bilgisayar tarafından uygulanır, böylece aracı düzenleyerek kaldırılamaz.

**Lolly Damgası.** Raster dışa aktarmalar ayrıca Lolly'nin kendi **görünmez piksel filigranını** taşır - *Lolly Imprint* - Content Credentials gibi **varsayılan olarak açık**. Kimlik bilgisi ve köken meta verisi piksellerin *yanında* seyahat edip yeniden kaydetmede, ekran görüntüsünde veya bir meta veri temizlemesinde kaybolurken, Damga piksellerin *içinde* yaşar ve yeniden sıkıştırmadan sağ çıkar - böylece görselin bir kopyası daha sonra bile Lolly yapımı olarak tanınabilir. Kriptografik bir garanti değil, kalıcı bir ipucudur ve yalnızca varlık bildirir (kişisel veri taşımaz). **PNG, JPG, WebP, AVIF, TIFF ve BMP**'de, ve bir **PDF veya PPTX**'e bileşimlenmiş Lolly tarafından işlenmiş rasterlerde yolculuk eder - hiçbir zaman *senin* gömdüğün bir görselde değil, yalnızca Lolly'nin kendisinin işlediğinde. Dışa aktarma panelindeki **Lolly Imprint** kartının işaretini kaldır ya da bir paylaşım bağlantısında `imprint=0` geçir. (AVIF'in yeniden kodlamadan sağ çıkması henüz kalibre edilmedi; PDF/PPTX tespiti gömülü Lolly rasterlerini kapsar.) [/verify](/verify) bunu cihazda tespit eder - bkz. [Content Credentials Kimliği](/info/content-credentials-identity.html#the-lolly-imprint).

**Kalıcı kimlik bilgisi.** Damganın yanında ikinci, daha ağır bir işaret durur: "made with Lolly" bağlantısının bir meta veri temizlemesinden, yeniden kodlamadan ve TrustMark farkında araçlar tarafından (Lolly'ninkiler kadar) yeniden okunmadan sağ çıkması için Lolly'nin kimliğini piksellerin *içine* yazmak üzere cihaz üstü bir sinir modeli (TrustMark formatı) kullanan **Durable credential**. **Varsayılan olarak kapalıdır** - saf JavaScript Damgadan farklı olarak dışa aktarma başına bir sinir geçişine artı tek seferlik bir model indirmesine mal olur, bu yüzden sessiz bir vergi değil, kasıtlı bir katılımdır. Yalnızca raster (**PNG, JPG, WebP, AVIF, TIFF**), dışa aktarma panelinde işaretlenir veya bir paylaşım bağlantısında `durable=1` olarak geçirilir. Masaüstü ve mobil uygulamalarda, modeli çevrimdışı getirecek bir kaynak olmadığı için kart işlevsiz gösterilmek yerine tamamen gizlenir.

**İçerik koruması.** Dışa aktarma panelinde, *Password protect*, **C2PA Credentials**, **Lolly Imprint** ve **Durable credential**, tek bir daraltılmış, formata duyarlı **Content protection** grubuna katlanır, böylece bir dosyanın köken ve koruma seçenekleri tek bir yerde yaşar - grup yalnızca seçilen formata uygulanan kartları gösterir ve hiçbiri uygulanmadığında kendini tamamen gizler. Baskı işaretleri kasıtlı olarak bunun *dışındadır*: koruma değil baskı üretim geometrisidir, bu yüzden **Print marks & bleed** - milimetre cinsinden taşma ölçümü artı Crop, Registration, Bleed, Colour bars ve Stamp details - baskı formatlarında kendi üst düzey kartını korur.

![Bir PNG dışa aktarmada açılmış Content protection grubu, yalnızca ona uygulanan kartları gösteriyor](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26imprint%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-protection&dark=1&filename=exp-content-protection)

**Dışa aktarmadan önce (baskı ön kontrolü).** Profilinin özellik bayraklarında **Print preflight**'ı (`export-preflight`) aç - **varsayılan olarak kapalıdır**, bu yüzden bir sohbet mesajı için PNG dışa aktaran bir birey asla baskı öncesi bulgularla pusuya düşürülmez ve bir dağıtımın kontrol düzlemi ([lolly.work](https://lolly.work)) üyeleri için varsayılan olarak açabilir - ve baskı kurallarının iş hakkında söyleyecek doğru bir şeyi olduğunda panelin altında, düğmelerin hemen üzerinde bir **Before you export** kartı belirir: format, boyut ve taşma, ardından kırpma ve taşma alanları, mürekkep kaplaması, plaka sayıları ve sayfa sayısı, başlığının yanında bir hükümle birlikte. Her ayarın altında durur çünkü o ayarlar hakkında bir ifadedir, onlardan bir tanesi daha değil - ve asla bir dışa aktarmayı engellemez. Bir baskı bürosunun az sonra göreceği şeyi sana söyler.

**Fiyat listesinden hesaplanan maliyet.** Ön kontrolün altında - hepsinin sonuncusu, hâlâ düğmelerin üzerinde - aynı sayıları paraya çeviren bir kart durur ve bunu yalnızca birinin ona verdiği fiyatlardan yapar. Ön kontrol geçişinin saydığı her şeyi okur, ön kontrol kartının kendisi açık olsun olmasın, ve iki şeyin doğru olması gerekir: işin bir fiyat listesinin fiyatlandırabileceği bir şeyi olması (plakalar, tabakalar, alan, sayfalar, varyant satırları veya çıktı dosyaları - böylece düz bir logo PNG'si onu asla göstermez) **ve** bir **rate card**'ın var olması. Bir rate card, yazıcından gelen bir JSON fiyat listesidir. Varsayılan bir derleme hiçbirini taşımaz ve uygulama içinde birini yükleyecek bir yolu yoktur: ya bir dağıtımın sunduğu bir katalog varlığı olarak gelir ya da bir self-hoster'ın veya kontrol düzleminin açtığı isteğe bağlı rate-card uzantısı yoluyla gelir. Rate card olmadan hiçbir şey gösterilmez - ne bir istem ne boş bir tablo.

Her şeyin üzerine kurulu olduğu kural, **asla para uydurmadığıdır**. Her rakam senin sağladığın bir oranın Lolly'nin saydığı bir miktarla çarpımıdır - `4 plaka × 35,00 €` - ve toplam, rakamla aynı cümlede kendi kaynağını adlandırır: kartın adlandırdığı yayıncı ve kartın oranlarının hangi tarihten olduğunu söylediği tarih. Varsayılan para birimi yoktur, yer tutucu yoktur ve eksik bir fiyatın yerine geçen sıfır yoktur. Dosyanın kendisi hakkında söylediği şey aktarılmış söz olarak kalır: *"Dosya şunu söylüyor: … Lolly bunu doğrulamadı."*

Ve dürüstçe hesaplayamadığında, çalışma tablosu grileşmiş veya doldurulmuş bir rakama düşmek yerine **tamamen kaybolur**:

- Kartın fiyatlandırmadığı satırlar **hiç toplam olmaması** anlamına gelir - yalnızca kaçının fiyatlandırılmadığını söyleyen bir başlık. Kısmi bir toplam daha küçük bir cevap değil, yanlış bir cevaptır.
- Tam bir sayım değil bir tavan olan bir miktar, alt toplamına kadar **"up to"**yu taşır, böylece bir sınır asla düz bir rakama dönüştürülmez.
- Geçerlilik tarihini geçmiş oranlar, sen *Use these rates anyway*'e basana kadar yalnızca **sayıları** gösterir - ve o zaman son kullanma tarihi rakamla birlikte gelir, böylece süresi dolmuş bir toplam güncel bir toplam olarak okunamaz.
- Bir **bağlantı** üzerinden açıldığında, bu cihazda istemedikçe para gizli kalır. Ne kart ne de o açığa çıkarma asla bir URL'de seyahat eder - CLI'nin `--rate-card=<file.json>`'ı bir bağlantı parametresi olarak değil yerel bir dosya bayrağı olarak almasının aynı nedeni.

Kart bir bezemedir, asla içerik değil: her dışa aktarma aşamasından soyulur, bu yüzden indirdiğin dosyanın bir pikselini bile oynatamaz. Ve bir tekliften çok bir aritmetiktir - yalnızca yazıcın sana bir teklif verebilir.

**Bileşimlenmiş render'lar.** Bir araç başka bir aracın çıktısını gömdüğünde (örn. bir *Event Name Badge*'in bir *QR Code*'u gömmesi), iç içe render ebeveynin dışa aktarmasına satır içi yerleştirilir - SVG ve PDF'de **gerçek bir vektör** olarak kalır ve PNG/JPG/WebP'de keskin bir şekilde rasterleştirilir. Gömülü çocuk bir ara üründür: kendi filigranı *yok*, kendi kökeni *yok*; yalnızca bitmiş ebeveyn varlık taşır. (Bileşim SVG'yi ve raster formatlarını kapsar; HTML/MD/TXT bileşimlenemez.)

## Parola koruması

Tamamen cihaz üzerinde çalışan iki bağımsız kilit türü.

**PDF açma şifresi** - dışa aktarma panelindeki *Şifreyle koru* kartı iki kademe sunar:

![Bir PDF dışa aktarımında açılmış Şifreyle koru kartı, şifre alanı ve iki kilit kademesiyle](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpdf%26password%3Ddemo%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-pdfpass&dark=1&filename=exp-pdf-password)

- **Standart** - temel bir 40-bit kilit (RC4). *Her* PDF uygulamasında açılır ve - hafif bir caydırıcı olduğu, gerçek bir koruma olmadığı için - bir paylaşım bağlantısında (tasarım gereği düz metin olarak) yolculuk edebilir. Sadece RGB `pdf`.
- **Güçlü** - AES-256 (PDF 2.0). Şifresi dışa aktarımda girilir ve **asla** bir bağlantıya konmaz; yalnızca daha yeni PDF uygulamalarında açılır (Acrobat / Preview ~2018 ve sonrası), eski uygulamalar dosyayı hasarlı olarak bildirebilir. Güçlü kademe **Yazdır / CMYK PDF'ler** için ve **bir toplu zip içindeki her PDF** için de geçerlidir (toplu onay diyalogu şifreyi toplar). PDF/X-4 şifrelemeyi yasakladığından, Güçlü kilitli bir Yazdır PDF'i CMYK'sını, kesim işaretlerini ve çıktı amacını korur ama PDF/X-4 uyumluluk beyanını düşürür.

Her iki kademe de Content Credentials ile karşılıklı dışlayıcıdır (şifrelenmiş bir PDF kimlik bilgisini alamaz).

**Kilitli indirmeler (tüm zip + derinlemesine savunma)** - bir **ZIP** dışa aktarımı (dışa aktarma panelinin, bir aracın birden çok biçimini bir araya toplayan *ZIP* biçimi), bir **klasör** indirmesi (Projeler → İndir) veya **toplu ızgara** tüm zip'i tek bir şifreyle iki kademede kilitleyebilir:

- **Standart** - geleneksel **ZipCrypto**: Windows Explorer'ın yerleşik ayıklama aracı dahil *her* unzip aracında açılır, ama zayıftır (bir caydırıcı). Şifresi bir `?password=` paylaşım bağlantısında yolculuk edebilir.
- **Güçlü** - **AES-256** (WinZip AE-2): güçlüdür, ama Windows Explorer'ın yerleşik ayıklama aracında **açılmaz** - alıcının 7-Zip / WinZip / Keka / macOS'a ihtiyacı vardır. Dışa aktarımda girilir, asla bir bağlantıya konmaz.

Dışa aktarma panelindeki aynı *Şifreyle koru* kartı hem PDF hem de ZIP kilitlerini yönetir, seçilen biçime göre kendini yeniden ifade eder. Tek şifre **her** üyeyi korur - görseller, SVG, her şeyi, PDF'ler dahil (kendi kilidi olmayan PDF dışı dosyaları yalnızca zip kapsayıcısı koruyabilir). Ve bu **derinlemesine savunmadır**: içindeki herhangi bir PDF *ayrıca* aynı şifreyle tek tek AES-256 ile kilitlenir, böylece zip açıldıktan sonra bile PDF kilitli kalır. İstem, indirmeyi başlattığında görünür; boş bir şifre kilit olmadığı anlamına gelir.

**Şifre korumalı paylaşım bağlantıları** - herhangi bir paylaşım bağlantısı, açıldığında alıcıdan şifre istenecek şekilde şifrelenebilir. Tüm bağlantı durumu, şifreden türetilen bir anahtar (PBKDF2) altında AES-256 ile şifrelenir; yalnızca şifreli metin yolculuk eder, böylece **şifre asla bağlantıda değildir** ve şifre çözme **alıcının tarayıcısında** gerçekleşir - bağlantıyı sunan sunucu URL'de yalnızca şifreli metni görür, ne şifreyi ne de çözülmüş tasarımı asla görmez. **Paylaş** diyalogunda açarsın. Şifrelenmiş bir bağlantı yalnızca Lolly içinde *açılabilir* (görsel olarak gömülemez, çünkü o yol bir istem gösteremez). Bkz. [URL Modu → Şifrelenmiş bağlantılar](/info/url-mode.html).

## Content Credentials (C2PA)

Dışa aktarımlar **Content Credentials** taşıyabilir - dosyanın Lolly ile yapıldığını ve o zamandan beri değiştirilmediğini kurcalamaya dayanıklı bir şekilde kaydeden, dosyaya gömülü imzalı bir [C2PA](https://c2pa.org) manifestosu. Bu, yukarıdaki köken (provenance) meta verisinin standart yolla ilerleyen sürümüdür: dosyanın bayt hash'ine bağlanan kriptografik bir iddia (dosyayı ne oluşturdu, ne zaman, kim tarafından ve nerede), böylece sonraki bir düzenleme C2PA farkında bir görüntüleyici tarafından tespit edilebilir. Standart, [Content Authenticity Initiative](https://contentauthenticity.org) (Adobe, BBC, Microsoft, Nikon ve diğerleri) tarafından yürütülüyor, dolayısıyla Lolly'nin yazdığı kimlik bilgileri kameraların, haber odalarının ve yaratıcı paketlerin benimsediği kimlik bilgileriyle aynıdır.

![Önceden işaretlenmiş C2PA Credentials kartı, yanında kimlik bilgisi ömrüyle](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26c2pa%3D30%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-c2pa%5Bdata-c2pa-only%5D&walker=1&dark=1&filename=exp-c2pa-card)

- **Biçimler.** C2PA gömme yapabilen her kapsayıcı: **PDF** (hem RGB hem Yazdır), **PNG / Animasyonlu PNG**, **JPG**, **GIF**, **SVG**, **TIFF** (RGB ve Yazdır), **WebP** (durağan ve animasyonlu), **AVIF**, **MP4**, **WebM** ve ses kapsayıcıları **MP3**, **WAV**, **M4A** ve **OGG/Opus** - böylece kaydedilmiş veya sentezlenmiş bir ses klibi de bir resim gibi aynı kimlik bilgisiyle çıkar. Bir **ZIP** demeti desteklenen her üyeyi ayrı ayrı damgalar, bir **Animasyonlu SVG**'nin bunu edindiği yer de burasıdır (altında sıradan bir SVG belgesidir; doğrudan bir Animasyonlu SVG dışa aktarımı kendi kartını sunmaz). MP4, AVIF ve M4A, spesifikasyonun BMFF bağlamasını, MP3 ise ID3v2 eşlemesini kullanır, böylece `c2patool` ve diğer C2PA farkında görüntüleyiciler bunları doğrulayabilir; **WebM** ve **OGG/Opus**'un henüz standartlaştırılmış bir C2PA eşlemesi yok, bu yüzden Lolly manifestoyu sırasıyla bir Matroska eki ve bir OpusTags alanı olarak taşır, bunları Lolly'nin kendi doğrulayıcısı (ve CLI'si) denetler. (`ico`, `eps`, `emf`, `dxf`, `bmp`, `pptx`, Office biçimleri ve metin/veri biçimlerinin C2PA kapsayıcısı yoktur.)
- **Varsayılan olarak açık.** Dışa aktarma panelindeki **C2PA Credentials** kartı neredeyse her araç için önceden seçilidir - tek bir dışa aktarımda kimlik bilgisini atlamak için işareti kaldır (veya bir paylaşım bağlantısında `c2pa=off` geçir). Bir araç, manifestosunda tamamen vazgeçebilir.
- **Neyi kaydeder.** Dosyayı oluşturan araç ve uygulama, imzalama zamanı, dışa aktarma yüzeyi (tarayıcı motoru ailesi + işletim sistemi ailesi - bilerek kaba, asla bir parmak izi) ve - yalnızca *Profil → Bilgilerimi kullan* açıkken - adın ve e-postan işin yazarı olarak.
- **Alıcıların gördüğü.** İçerik kimlik bilgilerini inceleyen araçlar (Adobe uygulamaları, `c2patool`, contentcredentials.org/verify) manifestoyu okuyup iddiayı gösterecektir. Lolly, bir güven listesinden bir sertifika yerine **cihazında** oluşturulan bir anahtarla imzaladığı için, görüntüleyiciler bunu *doğrulanmamış* bir kimlik bilgisi olarak bildirir. Yapı ve kurcalamaya dayanıklılık gerçektir; yalnızca imzalayan kimliği bir otorite tarafından teyit edilmemiştir. Bunu yükseltmek için bir **doğrulanmış kimlik** kaydedebilirsin (Profil → Content Credentials): Lolly CA'dan kısa ömürlü bir sertifika, imzalama anahtarı yine hiç cihazından çıkmadan e-postanı dışa aktarımlarına bağlar - bkz. [Content Credentials Identity](/info/content-credentials-identity.html).
- **Bir dosyayı kontrol etme.** Lolly kendi kimlik bilgilerini de doğrular: [/verify](/verify) üzerine herhangi bir dosya bırak (veya CLI'de `lolly validate <file>` çalıştır) cihaz üzerinde bir rapor için - dosyanın gerçekten Lolly ile yapıldığı ve o zamandan beri değişmediği başlıkta yer alır. Web Doğrula görünümü kimlik bilgisinin çok ötesini okur: **AI tarafından üretilmiş içeriği** işaretler, **Lolly Damgası**'nı tespit eder, **SEAL** imzalarını ve (isteğe bağlı) üçüncü taraf piksel filigranlarını kontrol eder ve **gizli veriyi** ortaya çıkarır - hepsi cihaz üzerinde, hiçbir şey yüklenmeden. Bkz. [Content Credentials Identity → Beyond the credential](/info/content-credentials-identity.html#beyond-the-credential-what-else-verify-shows).
- **Gizlilik.** Her şey cihazında olur: imzalama anahtarı dışa aktarım için oluşturulur ve tarayıcıdan asla çıkmaz, hiçbir şey yüklenmez ve iddia yalnızca köken meta verisinin zaten taşıdığını içerir. Gizlilik araçları (*kendi* dosyalarının cihaz üzerinde dönüşümleri) asla kimlik bilgisi eklemez ve *Gizli Veriyi Sil*, diğer gömülü meta veriler gibi bir C2PA manifestosunu da kaldırır.
- **Etkileşimler.** PDF'ler için, Content Credentials ve **şifre koruması** (her iki kademe de - yukarıya bak) karşılıklı dışlayıcıdır (şifrelenmiş bir PDF kimlik bilgisi ekini alamaz). Kimlik bilgisi, tamamlanmış baytlar üzerinde son adım olarak eklenir - DPI/EXIF/renk profili damgalamasından, PDF/X meta verisinden ve baskı işaretlerinden sonra.

## Telefonda

Dışa aktarma denetimleri, dokunmaya göre boyutlandırılmış aynı biçimler, boyut, kopyalama, indirme ve paylaşımı açan yüzen **Render** düğmesinin arkasında, **Export** sayfasında yer alır.

## Biçim referansı

Ana bilgisayarın işleyebildiği her kimlik, gruplandırılmış. Bunlar aynı zamanda URL `format=` parametresinin ve CLI `--export=` bayrağının değerleridir - bkz. [URL Modu](/info/url-mode.html) ve [CLI](/info/cli.html). Bir araç yalnızca yazarının belirttiği alt kümeyi sunar, bu yüzden seçici her zaman bu listeden daha kısadır.

| Tür | Kimlikler |
|---|---|
| Raster | `png` · `jpg`/`jpeg` · `webp` · `avif` · `tiff` (RGB TIFF) · `cmyk-tiff` (Print TIFF) · `bmp` · `ico` |
| Vektör | `svg` · `svgz` (gzip'li SVG) · `emf` · `wmf` · `eps` · `eps-cmyk` (EPS CMYK) · `dxf` (kesim dosyası) |
| Sayfa ve belge | `pdf` · `pdf-cmyk` (Print PDF) · `pptx` (PowerPoint) · `scorm` (SCORM kurs paketi, bir zip) · `penpot` (Penpot tasarım dosyası) · `docx` (Word) · `odt` (OpenDocument Text) |
| Hareket | `gif` · `apng` (Animated PNG) · `webp-anim` (Animated WebP) · `svg-anim` (Animated SVG) · `webm` · `mp4` |
| Ses | `wav` · `mp3` · `m4a` · `opus` |
| Metin ve veri | `html` · `md` · `txt` · `json` · `csv` · `ics` · `vcf` · `css` · `scss` · `gpl` (GIMP paleti) |
| Paket | `zip` |

Birkaç kimlik daha ortak render yolu yerine **bir aracın kendi dışa aktarma kancasından** gelir: `ase` (Adobe Swatch Exchange, Palette Lab'dan), `exr` ve `hdr` (Darkroom'un yüksek dinamik aralık rasterları) ve `ttf` / `otf` / `woff` (Font Convert). Bir biçimi aynı şekilde seçerler - seçici, `format=`, `--export=` - baytlar sadece araç tarafından üretilir. Font Convert tek istisnadır: *senin* sağladığın bir yazı tipi dosyasını dönüştürür, dolayısıyla düz bir URL'nin render edecek hiçbir şeyi yoktur.
