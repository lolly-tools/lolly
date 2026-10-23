# Lolly'yi kullanma

Lolly açık ve bir şey yapmak, saklamak ve iletmek istiyorsun. Bu sayfa o döngüyü anlatır: bir aracı aç, değiştirmene izin verdiği şeyi değiştir, sonucu kaydet ve bir bağlantı ya da dosya olarak paylaş.

Buradaki her şey hesap olmadan cihazında çalışır ve ihtiyacın olan araçlar ile varlıklar indirildikten sonra çevrimdışı da çalışmaya devam eder. Uygulamanın başlaması için WebGPU destekli bir tarayıcı veya uygulama gerekir; [Supported environments](/info/supported-environments.html) test edilenleri listeler.

## Yolunu bul

::: figure using-app-map
Ana ekran: üstte dört sekme ve altta çubuk. Açılan bir araç, denetimlerini canlı önizlemenin yanında gösterir.
:::

Ana ekranın üstünde dört sekme yer alır: **Tools**, **Utilities**, **Assets** ve **Projects**. Tools ile üretirsin, Utilities bir dosyayı dönüştürmek, denetlemek veya temizlemek gibi işler için tezgâhlardır, Assets kitaplığındır ve Projects kaydettiklerini tutar.

Alttaki çubuk **Open**, **Settings**, bir arama alanı, **Verify** ve **What?** içerir. Tools, Utilities, Assets, Projects, Settings ve uygulamada okuduğun kılavuzlarda görünür, bir araç açılınca kenara çekilir. [Search](/info/search.html), araçlarına, kayıtlı işlerine, varlıklarına ve ayarlarına o alandan ulaşır. [Ask Lolly](/info/ask.html), yazılı bir soruyu bu kılavuzların eşleşen bölümüyle yanıtlar.

O araçta yeni bir şey başlatmak için bir karta tıkla. Kayıtlı işler bunun yerine **Projects** içinden yeniden açılır.

![Örnek gezinme ve bir Yeni eylemi içeren bir galeri kartı](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&localize=1&dark=1&cropSelector=.gtile%5Bdata-tool-id%3D%22design%22%5D&filename=gallery&try=1)

Her araç bölünmüş bir görünümdür: bir yanda **denetimler**, diğer yanda canlı bir **önizleme**. Bir denetimi değiştirirsin ve önizleme hemen takip eder; gördüğün şey dışa aktarılan şeydir.

![Bir aracın bölünmüş görünümü - solda kontrol yığını, sağda çizdiği canlı gruplu çubuk grafik](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26t%3DExample%2520data%26st%3DSample%2520values%252C%2520not%2520a%2520real%2520dataset%26d%3DMonth%252CSeries%2520A%252CSeries%2520B%252CSeries%2520C%250AJan%252C12%252C9%252C5%250AFeb%252C18%252C14%252C7%250AMar%252C24%252C17%252C11%250AApr%252C29%252C23%252C15%26lg%3D1&width=1440&height=900&dpi=192&waitMs=2500&walker=1&format=svg&dark=1&filename=vt-tool-split-view)

**Design** istisnadır. Sürüklediğin, yeniden boyutlandırdığın ve içine yazdığın kutulardan oluşan serbest bir tuval olarak açılır; kendi üst çubuğu, zaman çizelgesi ve sunum denetimleri vardır. [Design: the free canvas](/info/design.html) onun kılavuzudur.

## Aracın değiştirmene izin verdiğini değiştir

Bir araç yalnızca değişmesi amaçlanan girdileri gösterir. Yazarı renkleri, düzeni, yazıyı ve mantığı zaten sabitlemiştir; bu yüzden ne yaparsan yap onun kurallarına uyar. Girdiler metin, sürgüler, renk seçiciler, açılır menüler, tarihler, görsel seçiciler ve yinelenen satır grupları içerir ve bazıları katlanan bölümlerde durur.

![Bir aracın kontrol yığını - bir metin alanı, renk düğmeleri ve bir kaydırıcı, yazarın sabitlemeyi seçtiği başka hiçbir şey yok](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=%23tool-inputs&walker=1&format=svg&dark=1&filename=use-tool-inputs)

**Denetimini bulmak için tasarıma tıkla.** Önizlemedeki herhangi bir öğeye tıkla; eşleşen denetim odak alır ve görünüme kayar. Yinelenen bir satır grubunda tıkladığın tam satır açılır.

Denetimlerin üstündeki **Clear changes**, her girdiyi varsayılanına döndürür.

**Tasarım sistemi seçimleri.** Tasarım sistemin birden fazla colourway, açık ve koyu bir görünüm veya başka bir tema seçeneği sunduğunda, denetimlerin altındaki bir **Design system** bölümü bunları tutar. Bir seçenek yalnızca bu aracı değiştirdiğinde görünür; bu yüzden bir dosya yardımcı aracı hiç bölüm göstermez. Her colourway kendi renklerinde bir noktadır, açık ve koyu iki düğmedir ve diğer her seçenek bir listedir.

Seçim bu parçaya aittir. Bağlantıda ve kayıtlı oturumda taşınır, tasarım sistemine bağlı her renk onu izler ve uygulamanın kendi renkleri olduğu gibi kalır. Design aynı seçimleri Inspector'ın **Canvas** sekmesinde gösterir. Renkleri içeriği olan bir araç kurallı colourway üzerinde kalabilir ve o zaman colourway noktası sunmaz. [Lolly Demo in use](/info/lolly-demo-in-use.html#colourways-on-real-work) gerçek işlerde colourway'leri gösterir.

### Önizlemeyi yakınlaştır ve kaydır

Önizleme her zaman tam olarak dışa aktarılacak şeyi gösterir.

- **Yakınlaştır:** Cmd/Ctrl ile kaydır veya izleme dörtgeninde sıkıştır; işaretçinde ortalanır. Klavyede `0` pencereye sığdırır, `1` yüzde 100'dür ve `+` / `−` yakınlaştırır.
- **Kaydır:** **Space** tuşunu basılı tutup sürükle ya da orta fare düğmesiyle sürükle. Düz tıklamalar tasarımın parçalarına tıklamak için serbest kalır.
- **Dokunma:** yakınlaştırmak için sıkıştır, kaydırmak için sürükle ve sığdırmak için çift dokun.
- **Yakınlaştırma HUD'u:** `−`, **Fit** ve `+` düğmelerini açmak için köşedeki Lolly girdabına basılı tut. Girdaba kısa dokunuş yine profil menünü açar.

Çıktı boyutunun değişmesi görünümü her zaman temiz bir sığdırmaya geri alır.

![Tuvalin köşesindeki girdaptan açılan yakınlaştırma HUD'u - eksi, Fit, artı, ardından tema ve ses anahtarları ve onu taşıyan tutamaç](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=.stage-nav%7Bopacity%3A1!important%7D&drive=drag%3A.stage-nav-profile%7Cdx%3D1%7Chold%3Bwait%3A700&cropSelector=.stage-nav&walker=1&format=svg&dark=1&filename=use-zoom-hud)

### Geri alma ve yineleme

**Cmd/Ctrl-Z** geri alır ve **Cmd/Ctrl-Shift-Z** (veya **Cmd/Ctrl-Y**) yineler. Aynı çift, denetimlerin üstünde **Undo** ve **Redo** düğmeleri olarak da durur (Design'da üst çubuktadırlar) ve geri alınacak bir şey kalmadığında her biri soluklaşır. Bir mesaj her geri almanın hangi girdiyi geri yüklediğini söyler; mesajda bir **Redo** düğmesi vardır.

- **Bir sürükleme tek adımdır.** Bir denetimde yarım saniye içindeki tekrarlanan değişiklikler birleşir; bu yüzden bir sürgüyü aralığı boyunca çekmek tek bir geri almadır.
- **Son 100 adım tutulur.** Bir geri almadan sonraki yeni düzenleme ileri yığınını temizler.
- **Bir metin kutusunda** Cmd/Ctrl-Z alana aittir, karakter karakter. Lolly sürgüler, açılır menüler, renkler ve anahtarlar için devralır.
- **Bir dosya girdisinde dosya seçmek** bir adım değildir; çünkü o baytlar yalnızca bu oturum için tutulur.

Canlı bir [işbirliğinde](/info/collaborate.html) geçmişin sana ait kalır: diğer cihazdan gelen bir değişiklik asla senin yığınına girmez. Geri alma, araçtan çıkana veya sayfayı yenileyene kadar sürer. Daha eskisi için, çalışırken kaydeden araçlar önceki sürümleri **History** altında tutar; bkz. [Go back to an earlier version](/info/find-your-work.html#go-back-to-an-earlier-version).

### Canlı kamera

**Filter** aracının efektleri (Halftone, Scanline, Posterize, Voronoi, Duotone, Stretch, Misprint, Dither, ASCII art ve Glitch) bir kamera varsa **Go live** düğmesi gösterir. Aç; efekt web kameranı kare kare izler ve bir hareket dışa aktarması sonucu GIF, WebM veya MP4 olarak kaydeder. Kareler cihazında işlenir ve kamera sen durdurduğun ya da araçtan ayrıldığın anda bırakılır. Her görsel seçicide ayrıca tek bir kare için **Take a photo** vardır.

## Kaydetme ve devam etme

İşini saklamak için render hapındaki **Export** yanındaki tik olan **Save** düğmesine bas. Yeni iş **My library** içine gider, daha önce kaydettiğin iş olduğu yerde güncellenir ve hiçbir şey indirilmez. Dışa aktarma panelinde aynı **Save** düğmesi vardır.

Nereye gideceğini seçmek için dışa aktarma panelinde **Download** yanındaki **Save as** düğmesine bas. **Save to a project** altında **My library** seçili kalsın ya da bir proje seç (**＋ New project…** bir tane yapar), sonra **Save** düğmesine bas; **Save as a template** tasarımı yeni belgeler için bir başlangıç noktası olan bir [şablon](/info/templates.html) olarak saklar. Design'da **Save as** Lolly menüsündedir; bir telefonda **•••**, sonra **File menu**, sonra **Save as** düğmesine bas.

![İki yarımlı render hapı: yukarı oklu, dışa aktarma panelini açan Export ve tikli, yerinde kaydeden Save](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=%23tool-inputs%7Bdisplay%3Anone%7D&cropSelector=.render-pill&walker=1&format=svg&dark=1&filename=use-render-pill)

::: timeline
- <!--i:check--> Render hapında **Save** düğmesine bas ya da bir proje seçmek için **Save as** düğmesine bas.
- <!--i:folder--> Öğe **My library** içine ya da seçtiğin projeye gider.
- <!--i:home--> Sonra sol üstteki **Home** düğmesine bas ve **Projects** sekmesini aç.
- <!--i:document--> Öğeyi aç. Her ayar geri gelir; değiştirmeye ve yeniden dışa aktarmaya hazırdır.
:::

Öğeler, dışa aktarma panelinde yazdığın dosya adından ya da yoksa **QR Code** gibi araçlarının adından adlandırılır. **Download** ile aldığın dosya bitmiş bir kopyadır; sonra değiştirmek için kayıtlı öğeyi Projects içinde aç.

Kişisel kayıtlar, [Sync](/info/sync.html) açmadıkça bu cihazda, kaydettiğin tarayıcıda veya uygulamada kalır. Bir şey beklediğin yerde değilse [Find and recover your work](/info/find-your-work.html), kapatılmış bir sekmeden temizlenmiş tarayıcı verisine kadar her durumu kapsar.

::: details Lolly Work ile team projects (isteğe bağlı)
[Kuruluşun Lolly Work kullanıyorsa](/info/organisation.html) örneğine giriş yap ve seninle paylaşılan oturumlar için **Projects → Team projects** bölümünü aç. Erişimi ve saklamayı kuruluş belirler ve bu oturumları onun Lolly Work hizmeti saklar. Kuruluşun canlı düzenlemeye izin veriyorsa paylaşılan bir oturum açılırken canlı collab'ına katılır; adımları [Working together](/info/collaborate.html#work-collabs-with-lolly-work-optional) açıklar.

Kişisel kitaplığın ayrı kalır. Başka bir cihazda giriş yapmak sana ekip işini getirir; kişisel kayıtların cihazlar arasında taşınması için yine Sync veya bir yedek gerekir.
:::

## Çalışmanı paylaşma

Bir tasarım bağlantı veya dosya olarak gider. Dışa aktarma denetimlerindeki **Share** ikisini de sunan bir iletişim kutusu açar; Projects içindeki kayıtlı bir oturumdaki **Share link** aynı kutuyu o oturum için açar.

::: cols
## Bir bağlantı

- Her girdiyi adreste taşır; böylece bağlantı tasarımı yeniden üretir.
- Bu cihazdan eklediğin görselleri ve dosyaları, çok uzun metni ve çok büyük listeleri geride bırakır.
- Herhangi bir tarayıcıda açılır; bağlantıyı yer imine ekleyebilir, yapıştırabilir veya işleyebilirsin.

## Bir .lolly dosyası

- Kayıtlı oturumu bu cihazdaki görseller ve dosyalarla taşır; aracı ve tasarım sistemini de taşıyabilir.
- Dosyaları dahil etmeyi seçmedikçe lisanslı katalog çalışmalarını geride tutar.
- Lolly'de açılır: çift tıkla, **Open** kullan veya uygulamaya bırak.
:::

### Bağlantı

Kopyalamaya hazır bağlantı iletişim kutusunun üstünde, **Copy** ve bağlantıda QR Code aracını açan bir **QR** düğmesiyle durur. Bağlantının altında **Link options** şunları içerir:

- **Open in the installed app**, bağlantıyı Shortcuts, başlatıcılar ve otomasyon için, her parametresi değişmeden bir `lolly://` adresine çevirir.
- **Shortest link**, uzun bir tasarımı kompakt bir belirtece paketler ve karakter cinsinden kazancı gösterir. Okunabilir biçim de her zaman oradadır.
- **Password-protect this link**, bağlantıyı cihazında AES-256 ile şifreler. Parola hiçbir zaman bağlantının parçası olmaz.
- **Pin this tool version**, `_v` bayrağını ekler; böylece sonraki bir araç güncellemesi bağlantının render ettiğini değiştiremez.
- **When the recipient opens the link…**, tam ekranı, dışa aktarma panelinin önceden açık olmasını, açılışta indirmeyi (`&export`) veya panoya kopyalamayı (`&copy`) seçer.
- **Copy credit**, bir gönderi veya slayt için bağlantıyla birlikte "Made with Lolly" alt yazısını kopyalar.

Bir araç adın gibi kişisel alanlar içerdiğinde **Review personal fields** her birini sen o alanı işaretleyene kadar bağlantının dışında tutar. [URL mode](/info/url-mode.html) bir bağlantının taşıyabileceği her şeyi kapsar.

**İletişim kutusu bir bağlantının neleri taşıyamayacağını söyler.** Bu cihazdan eklediğin bir görsel veya dosya, çok uzun bir metin değeri ve çok büyük bir liste bir adrese sığmaz. Her biri bağlantı kurulurken sayılır. Bir şeyin bırakılması gerekmişse iletişim kutusu bunu listeler ve sana, bir resmi eksik açılan bir bağlantı vermek yerine dosya seçeneğini gösterir. Yalnızca uzun olan bir bağlantı, karakter sayısıyla birlikte daha yumuşak bir not alır.

**Bazı araçlar bağlantıyı ürünün tamamı yapar.** Jump Page bağlantılarını dağıtılacak tek bir sayfada toplar: bir biyografi bağlantısı, bir konuşma, bir mağaza vitrini. Hiçbir şey barındırılmaz ve sayfanın arkasında hesap yoktur; çünkü sayfa bağlantının kendisidir. Ziyaretçi onu tam genişlikte, kaydırdıkça sahne başına bir bağlantıyla alır.

![Düzenleyicideki Jump Page: sayfanın üstündeki başlık sahnesi ve altındaki bağlantı sahneleri](/t/url-shot?url=%2F%23%2Ftool%2Fjump%3Ffull%26heading%3DFind%2520us%2520everywhere%26subheading%3DOne%2520link%2520for%2520everything.%26links%3DURL%252CName%252CEmoji%257Ehttps%25253A%25252F%25252Fexample.com%252CWebsite%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fnews%252CNewsletter%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fhello%252CSay%252520hello%252C&width=900&height=1300&dpi=96&waitMs=2000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=use-jump-page)

::: details Lolly Work ile kuruluş tarafından yönetilen bağlantılar
Süre sonu, iptal veya parola gerektiren paylaşım için Lolly Work, paylaşılan oturumlara, araçlara ve katalog varlıklarına yönetilen bağlantılar sunar. Bunlar kuruluşun hizmeti üzerinden çözülür ve onun erişim kurallarını izler. Yukarıdaki kendi kendine yeten bağlantılardan ayrıdır ve birini iptal etmek, birinin zaten indirdiği bir dosyayı geri çağıramaz. [Rendering and sharing](/info/manage/sharing.html) bağlantı türlerini ve izinleri listeler.
:::

### .lolly dosyası

Share iletişim kutusunun **Editable file** bölümündeki **Download .lolly**, geçerli tasarımı tek bir dosya olarak yazar. Kayıtlı oturumu bu cihazdaki görseller ve dosyalarla taşır; sıradan katalog çalışmaları da eşlik eder. Eski veya erişilemeyen bir dosya, kaybolmak yerine harici bir başvuru olarak kalır. Kaydetmeden önce iletişim kutusu dosyanın boyutunu, kaç dosya gömdüğünü, kaçına başvurduğunu ve aracın dahil olup olmadığını gösterir. Cihazında bir paylaşım sayfası varsa **Send to…** dosyayı doğrudan ona verir (AirDrop, bir Android paylaşımı).

**Projects** içinde bir klasörün menüsündeki **Download project (.lolly)**, bütün bir klasörü yazar; böylece başkası klasördeki her oturumla devam edebilir. Batch oturumları geride kalır ve bildirim kaç tane olduğunu söyler. Aynı menüdeki **Download originals**, her öğeyi kendi dosyası olarak içeren düz bir zip yazar.

Bir dosya gitmeden önce karar vermen gereken üç şey var:

- **Adının girip girmeyeceği.** Adın, e-postan ve kuruluşun yalnızca [profilinde](/info/profile.html) **Use my details to create** açıkken yazılır. Kapalıyken dosya yalnızca Lolly ile ve ne zaman yapıldığını kaydeder.
- **Geride tutulan çalışmaların girip girmeyeceği.** Lisanslı çalışmalar, markaya kilitli çalışmalar ve lisansı hiç kaydedilmemiş katalog eserleri varsayılan olarak dışarıda kalır. Tasarım bunlardan herhangi birini kullanıyorsa iletişim kutusu kaç tane olduğunu söyler ve *Download without them* veya *Include and download* seçeneklerini sunar; çünkü onları dahil etmek dosyaları `.lolly` dosyasını açan kişiye verir. Dosyanın `CREDITS.txt` dosyası nelerin gittiğini ve nelerin gitmediğini nedeniyle birlikte listeler; kuralları [Creative rights and credits](/info/creative-rights.html) açıklar.
- **Aracın girip girmeyeceği.** **Include the tool**, aracın kendi dosyalarını paketler; böylece tasarım o araç olmayan bir cihazda açılır. Fork gibi özel bir araç için işaretli, imzalı katalogda listelenen bir araç için işaretsiz başlar. İmzalı kataloğu olmayan bir sürümde her araç özel sayılır.

**Birini açmak.** Masaüstü ve mobil uygulamalarda bir `.lolly` dosyasına çift tıkla veya dokun, **Open with Lolly** seç ya da paylaşım sayfasından Lolly'ye gönder. Web uygulamasında **Open** düğmesine bas veya dosyayı Lolly'ye bırak. Her yol, hiçbir şey yazılmadan önce dosyanın bildirimini okur ve boyutunu, içeriğini ve ne olacağını gösterir.

Dosya sende olmayan bir araç taşıyorsa **Trust this tool?** aracı ve yazarını gösterir ve onu açmanın aracın kendi kodunu cihazında çalıştıracağını söyler. **Trust & install** devam eder. Reddedersen iş yine Projects içine, aracı eklediğin güne kadar bekleyecek şekilde kaydedilir. Kodu bir modül olarak gelen bir araç henüz bu yolla kurulamaz ve aynı şekilde geri çevrilir.

::: details Bir .lolly neyi tutar ve birini açmak nasıl çalışır
`.lolly`, Lolly'nin paket uzantısıdır ve `manifest.json` içindeki `format` içeride ne olduğunu söyler:

- Bir **paylaşılan tasarım** (`lolly-share`) tek bir kayıtlı oturumu, gömülü dosyalarını ve hâlâ başvuruyla çözümlenen her şey için bir makbuzu tutar. Aracı ve tasarım sistemini de taşıyabilir. Açmak yeni bir Project ekler ve bir oturumun üzerine asla yazmaz.
- Bir **paylaşılan proje** (`lolly-share`, tür `project`) Projects'ten bir klasörü tutar: alt klasörlerini, içindeki her oturumu kendi karosuyla ve oraya dosyalanan resimleri. Açmak tüm klasörün bir kopyasını ekler. Her oturum `sessions/<key>.json` olarak, karosu `thumbs/` altında taşınır. Proje dosyalarının var olmasından önceki bir Lolly senden güncelleme yapmanı ister.
- Bir **tasarım sistemi paketi** (`lolly-brand`) token'ları tutar ve yazı tiplerini, logoları, yayımlanmış sürümleri ve tutulan kaynakları da tutabilir. Paketi açmak ayrı adlandırılmış bir tasarım sistemi ekler ve o sistemi etkin yapar.
- Bir **çalışma alanı veya örnek paketi**, bildirilmiş araçları, katalog varlıkları ve isteğe bağlı olarak bir örnek adresi olan bir `lolly-brand`'dir. Birini yüklemek, daha önce yüklenen tek çalışma alanı bindirmesinin yerini alır ve önizleme bu cihaz çapındaki etkileri listeler.

Tam bir cihaz yedeği bir `.lolly` değildir. Bir `LollyTools-….zip` (biçim `lolly-backup`) olarak kalır ve **Settings → Storage → Import data…** ile geri yüklenir. Zip'lenmiş bir araç klasörü de `.zip` olarak kalır. [Data transfer](/info/data-transfer.html) biçim başvurusudur.

Bir `.lolly` sıradan bir zip'tir. İçine bakmak için adını `.zip` yap: kendi görsellerin `assets/uploads/` altında, katalog çalışmaları `assets/catalog/` altında, `manifest.json` her dosyayı listeler ve bir README dosyanın ne olduğunu söyler.

macOS, Windows, Linux, iOS ve Android'in hepsi biçimi kaydeder, masaüstü dosya yöneticileri onu bir Lolly belgesi olarak gösterir ve GNOME Files bir kayıtlı oturumun kendi küçük resmini gösterebilir. Design System Setup'tan açmak, paylaşılan bir tasarım bir tane taşıdığında tasarım sistemi eylemini önerir ama **Open shared design** düğmesini asla gizlemez.

iOS veya Android'de başka bir uygulamadan verilen bir belge 48 MB ile sınırlıdır, çünkü devir baytlarını uygulama sınırı boyunca kopyalar ve uygulama bunu söyler. Lolly içindeki **Open** böyle bir sınır taşımaz; daha büyük bir paket için onu kullan.

Onayladıktan sonra Lolly paketi bir kez açar ve doğrular. Varlıklar kitaplığına gider; sağlama toplamıyla eşleştirilir, böylece cihazda zaten olan bir dosya yeniden kullanılır. Oturumlar yeni kimliklerle Projects'e gider, böylece aynı dosya iki kez açılabilir; aracı eksik bir oturum orada bekler. 100 MB'ı aşan dosyalar büyük olarak belirtilir ve tarayıcı depolaması dosyanın gerektirdiğinden az boş alan bildirdiğinde önizleme uyarır. Bütünlükle kapsanan her parça herhangi bir şey işlenmeden önce denetlenir ve hasarlı bir kopya hiçbir şey geride bırakılmadan reddedilir.
:::

Bir bağlantı ve bir dosya, ikisi de bir anlık görüntü teslim eder. Canlı düzenleme için [Working together](/info/collaborate.html), iki cihaz arasındaki özel collab'ları ve Lolly Work üzerinden isteğe bağlı work collab'ları kapsar.

## Varlıklar - kütüphanen

**Assets** (`#/a`), araçlarının kullanabileceği her şeyi toplar: marka logoları, görseller, ses ve hareket; türe göre gruplanmış, kendi dosyalarınla birlikte. Yüklemelerin cihazında saklanır. Lolly Work kullanan bir kuruluş, kendi erişim kuralları altında paylaşılan bir katalog da sağlayabilir; bkz. [Use Lolly at your organisation](/info/organisation.html).

![Varlıklar, markanın renk örnekleri ve yazı tipleriyle ve kendi yüklemelerinle](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches%2Cfonts&width=1440&height=900&dpi=96&waitMs=2400&css=.plat-swatch-grid~%2A%7Bdisplay%3Anone%7D&walker=1&format=svg&localize=1&dark=1&filename=assets)

- <!--i:upload--> **Dosyalarını getir.** Yükleme alanına bir görsel, SVG, ses klibi, video, Lottie, PDF veya PowerPoint sunumu bırak ya da seçmek için tıkla. Assets içine ve her aracın varlık seçicisine hemen gelir. Çok sayfalı bir PDF veya bir `.pptx` hangi sayfaların veya slaytların tutulacağını sorar ve her biri bir SVG varlığı olur. Bir araç içinde eklediğin görsel **My images** içinde geldiği gibi tutulur; böylece üzerindeki bir Content Credential hâlâ doğrulanır ve yalnızca çok büyük bir dosya yeniden boyutlandırıp boyutlandırmayacağını sorar. **Settings → Storage**, **My images**'ın ne kadar tuttuğunu gösterir. Cihazının depolaması dışında bir sınır yoktur. Görseller gelirken EXIF ve GPS verilerini silmek için **Settings → Feature flags** altında **Strip metadata from uploads** seçeneğini aç; Content Credentials her iki durumda da korunur.
- <!--i:star--> **Uzandıklarını favorile.** Bir varlığı veya marka rengini yıldızla; her seçicinin en üstüne sabitlenir.
- <!--i:folder--> **Topla.** Bir varlığı başka bir gruba taşı, kullanmadığın paylaşılan bir marka varlığını gizle (**Show hidden** geri getirir) veya kendi yüklemelerini sil. Projects ile aynı seçim çubuğu tüm seçim üzerinde işlem yapar.
- <!--i:layers--> **Bir videoyu arka planından ayır.** Bir videonun ayrıntılarını aç ya da bir varlık seçicideki kartına sağ tıkla ve **Remove background…** seç. Bir **On-device model** kalabalık bir sahneden bir konuyu keser; bir **Colour key** yeşil perde gibi eşit aydınlatılmış bir fonu kaldırır, kenar için **Tolerance**, **Softness** ve **Spill removal** vardır ve indirme gerektirmez. **Resolution** (360, 480, 720 veya 1080p, asla kaynağı aşmaz) ayrıntıyı hız için takas eder. Kesit, gerçek saydamlığa sahip animasyonlu bir WebP veya PNG, orijinalin yanına kaydedilir ve kaynağın Content Credential'ı bir bileşen olarak eşlik eder. [Generated once, rendered the same](/info/ai-features.html) bunun neden sade bir düzenleme kaldığını açıklar.

### Paletini ve yazı tiplerini her yere taşı

Assets içindeki **Swatches** paneli markanın hangi renklerden oluştuğunu gösterir: marka renkleri, eklediğin renkler, rampaları ve spektrumu. Lolly'nin arayüz için tuttuğu rol renkleri (metin, yüzeyler, kenarlar, colourway öncüleri ve bir marka renginin başka adla kopyaları) panelin altındaki gri bir **Show colour roles** kartının arkasında bekler.

Her renk, diğer her varlık gibi bir karttır. Ayrıntılarını açmak için birine tıkla, yalnızca onları indirmek için birkaçını seç ya da paletin tamamını diğer aracının okuduğu biçimde indir:

- <!--i:code--> Bir stil sayfası veya derleme için **Design tokens (JSON)**, **CSS variables** veya **CSS classes**. sRGB'den geniş bir renk geniş değerini korur: CSS onu hex'ten sonra ayarlar ve JSON hex'i geniş renk, CMYK derlemesi ve spot mürekkeple birlikte tutar.
- <!--i:palette--> Illustrator veya Photoshop için **Adobe Swatch Exchange (.ase)**. Bir CMYK derlemesine kilitli renk o CMYK örneği olarak, bir spot mürekkep adlandırılmış bir spot örnek olarak ve sRGB'den geniş bir renk Lab olarak gelir.
- <!--i:pentool--> GIMP veya Inkscape için **GIMP palette (.gpl)** ve **SCSS variables**; ikisi de sRGB'de.

![Swatches paneli - üstte beş palet indirme düğmesi, ardından ayrıntılarını açan bir çip olarak her marka rengi](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches&width=1440&height=900&dpi=96&waitMs=1800&css=.cat-group%3Anot%28%5Bdata-group%3Dswatches%5D%29%7Bdisplay%3Anone%7D&cropSelector=%5Bdata-group%3Dswatches%5D&walker=1&format=svg&dark=1&filename=use-swatch-downloads)

Renkleri her kartın üzerindeki noktayla seç: arasındakilerin hepsi için ikinci bir noktaya Shift ile tıkla, boşlukların arasından bir kutu sürükle ya da bir kart odaktayken Cmd/Ctrl+A bas. Çubuk aynı altı biçimde **Download as…**, **Copy hex** ve **Favourite** sunar. Bir biçim seçmeden önce menü, hiçbir biçimin tutamadığı renkleri (Transparent hiç renk değildir), hangi biçimlerin geniş bir rengi sRGB yedeği olarak kaydettiğini (SCSS ve GIMP) ve hangilerinin CMYK ve spot değerlerini taşıdığını (JSON ve .ase) listeler. Aynı eylemler için tek bir renkte bir karta sağ tıkla.

Bir rengin ayrıntıları önizlemeyi renkle doldurur ve **Linked values** (CMYK derlemesi veya spot mürekkebi, belirli bir uzay veya baskı için yazılmış her değer ve tasarım token'ı), **Every notation** (hex, OKLCH, Display-P3 ve gerisi; her birinin bir kopyala düğmesiyle), **Plotted on a colour space**, **Tones** ve **Readability** bölümlerini açar. Ok tuşları paletin içinde gezinir, **Copy link** rengin kendisini paylaşır ve **Open in Colour Lab** onu daha ileri götürür.

**Fonts** paneli marka yazı tiplerini, yerel olarak kurmak veya bir baskı atölyesine vermek için her biri için bir **download** ile listeler.

## Izgarayı kendine göre yap

- <!--i:star--> **Kullandığını favorile.** Bir karta sağ tıkla ve **Add to favourites** seç; ızgaranın üstündeki bir şeritte büyük bir karo alır. [Your favourites](/info/favourites.html) şeridi kapsar.
- <!--i:eyeoff--> **Hiç kullanmadığın bir aracı gizle.** Bir karta sağ tıkla ya da birkaçını seç ve **Hide tool** seç. Izgaradan ve ızgarada yazdığında bulunanlardan düşer. Sondaki gri bir **Show hidden tools (N)** karosu onları soluk olarak yeniden gösterir; her birinin menüsünde **Unhide tool** vardır. Gizlemek yalnızca ızgaranı değiştirir: araç yine bir bağlantıdan veya yer işaretinden açılır.
- <!--i:clock--> **Önce senin araçların.** Üç farklı araçta kayıtlı iş yaptığında, ızgaranın üstündeki bir **Yours** çip satırı favorilerin ve son araçlarınla başlar.
- <!--i:sliders--> **Kendi yolunla düzenle.** **View options** düzeni (**Grid**, **Card** veya **List**), kart boyutunu ve yoğunluğu, sıralamayı ve bir kategori filtresini ayarlar.

![Gizli araçların gösterildiği Tools ızgarasının sonu: soluk Wordmark kartı ve yanında onu yeniden görünür yapan, şimdi Hide hidden tools yazan gri karo](/t/url-shot?url=%2F%23%2F&width=1440&height=680&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A.gtile--hiddenbox%3Bpress%3AEnd%3Bwait%3A800%3Bhover%3A.gtile--hiddenbox%3Bwait%3A300&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&rasterDpi=96&dark=1&filename=misc-hidden-tools)
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

**Aynı anda birkaç kart üzerinde işlem yap.** Her kartın onay kutusunu işaretle, boş alan üzerinde bir seçim kutusu sürükle ya da Shift/Cmd ile tıkla; o görünümün izin verdikleriyle bir çubuk belirir:

- **Tools ve Utilities:** Favourite, Hide, Available offline, **View sessions** (Projects, yalnızca o araçlarla yapılan oturumları gösterir) ve tek bir kart için Copy link.
- **Assets:** herhangi bir seçim için Favourite ve Hide. Duplicate, Download ve Delete yalnızca seçilen her öğe kendi yüklemelerinden biri olduğunda görünür; çünkü paylaşılan bir tasarım sistemi varlığı kalıcı bir sözleşmedir.
- **Projects:** bkz. [Find and recover your work](/info/find-your-work.html#find-something-you-saved).

![İki araç için galeri seçim çubuğu, Available offline, View sessions, Favourite ve Hide sunuyor](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%21important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-select%3D%22gradient%22%5D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=misc-bulkbar-gallery&cropSelector=.gallery-bulkbar)
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

**View sessions** yalnızca bir şey seçildiğinde görünür. Bunun yerine seçilmemiş tek bir karta sağ tıkla; o aracın kayıtlı oturumlarının, bir silmenin oturumu Çöp Kutusu'na taşıdığı bir listesi olan **N saved sessions** sunar.

## Telefonda

Dar bir ekranda düzen tek sütun olur:

- **Denetimler**, alt kenarında bir sürükleme tutamağı olan üstte bir sayfaya **dönüşür**. **peek**, **half** veya **full** konumuna oturmak için tutamağı sürükle ya da daraltıp genişletmek için dokun. Önizleme aşağıdaki alanı doldurur ve sen düzenlerken görünür kalır.
- Yüzen bir **Export** düğmesi dışa aktarma sayfasını açar: biçim, boyut, kopyalama, kaydetme ve indirme tek yerde. Sayfayı kapatmak için arka plana dokun.

![Telefon genişliğinde bir ekranda bir araç - üstte panel hâlinde kontroller, altta önizlemeyi dolduran üretilmiş palet ve alt ortada yüzen oluşturma düğmesi](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3Df97316%26harmony%3Dadjacent-3%26steps%3D9&width=430&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=vt-phone-palette)

## Ayarlar, ses ve rahatlık

Ana ekranın altındaki **Settings**, ayrıntılarını, tasarım sistemlerini, erişilebilirliği, depolamayı ve çevrimdışı indirmeleri tutar. [Settings](/info/dashboard.html) her sekmeyi haritalar.

- **Ayrıntıların ve profil fotoğrafın**, bir e-posta imzası veya rozet gibi bunları kullanmak için yapılmış her aracı doldurur. [Profiles](/info/profile.html) bunları kapsar.
- **Accessibility** dört rahatlık anahtarına sahiptir: **Reduce motion**, **Hide colourful previews**, **High contrast** ve **Large text**. Çalışmanın etrafındaki uygulamayı değiştirirler, asla bir araç tuvalini veya bir dışa aktarmayı değil.
- **Sound**, yaptıklarına karşılık yumuşak yardımcı sesler çalar ve **Neurospicy Mode** sakin bir odak parçası çalar. İkisi de **Settings → Accessibility** veya profil menüsünde açana kadar kapalıdır.
- **Available offline**, bağlantıyı kaybetmeden önce uygulamanın geri kalanını, araçlarını, kataloğu ve kılavuzları indirir. Lolly kurabileceğin bir web uygulamasıdır: tarayıcının kur düğmesini ya da telefonda *Add to Home Screen* seçeneğini kullan; yeniden çevrimiçi olduğunda kendini güncelleyen tam ekran bir uygulama elde edersin.
- **Storage**, Lolly'nin bu cihazda neleri tuttuğunu gösterir. [If you clear your browser data](/info/find-your-work.html#if-you-clear-your-browser-data) temizlemenin neleri kaldırdığını açıklar ve [Privacy Policy](/info/privacy.html) uygulamanın getirdiği veya gönderdiği her şeyi listeler.

::: note Bir güncellemeden sonra bir görünüm yüklenmezse
Bir güncellemeden hemen sonra boş bir panel veya "failed to fetch" mesajı genellikle tek bir yenilemeyle düzelir. Kayıtlı işlerin, oturumların ve tasarım sistemlerin cihazında saklandığı için etkilenmez. Yalnızca eklediğin ve hiç kaydetmediğin bir resmin yeniden eklenmesi gerekebilir.
:::

## Bundan sonra nereye

- **[Design: the free canvas](/info/design.html)**: tuval, şekiller, zaman çizelgesi ve bir sunumu sunma.
- **[Batch and Multi-edit](/info/batch.html)**: bir tasarımın birçok sürümü ya da birlikte düzenlenen birkaç kayıtlı tasarım.
- **[Export a file](/info/exporting.html)**: biçim, boyut, baskı birimleri, saydamlık ve video seçimi.
- **[Import a design](/info/design-import.html)**: bir Figma, Penpot, Illustrator veya InDesign dosyasını Design'a getir ve düzenlemeye devam et.
- **[Templates](/info/templates.html)**: bir araç için kayıtlı başlangıç noktaları.
- **[Wide Colour and HDR](/info/hdr-editing.html)**: Design ve Darkroom'da özgün görsel hassasiyetini koru.
- **[Find and recover your work](/info/find-your-work.html)**: her şeyin nerede olduğu ve başka bir cihaza nasıl taşınacağı.
