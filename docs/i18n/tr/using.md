# Lolly'yi kullanma

Bir aracı aç, değiştirmene izin verdiği şeyleri değiştir, sonucu kaydet ve bağlantı veya dosya olarak paylaş.

Her şey hesap gerektirmeden cihazında çalışır; ihtiyacın olan araçlar ve varlıklar indirildiğinde çevrimdışı da çalışır. Uygulamanın başlaması için WebGPU destekli bir tarayıcı veya uygulama gerekir. [Desteklenen ortamlar](/info/supported-environments.html), test edilen ortamları listeler.

**Döngü**, dört adımda:

::: steps
- <!--i:eti-home--> **[Bir araç aç](#find-your-way-around)** Ana ekranda bir karta tıkla. Denetimler, canlı önizlemenin yanında yer alır.
- <!--i:eti-sliders--> **[Girdileri değiştir](#change-what-the-tool-lets-you-change)** Yalnızca yazarın açık bıraktığı girdileri. Denetimini bulmak için tasarıma tıkla.
- <!--i:eti-folder-plus--> **[İşini kaydet](#saving-continuing)** **Save**, işini My library içinde tutar ve Projects onu geri getirir.
- <!--i:eti-link--> **[Tasarımı paylaş](#sharing-your-work)** Her girdiyi taşıyan bir bağlantı veya tek bir `.lolly` dosyası.
:::

<!--i:eti-home-->
## Yolunu bul

::: figure using-app-map
Ana ekran: üst kısımda dört sekme, en altta çubuk. Açık bir araç, denetimlerini canlı önizlemenin yanında gösterir.
:::

Ana ekranın üst kısmında dört sekme bulunur: **Tools**, **Utilities**, **Assets** ve **Projects**. Tools, üretmek için kullandığın araçlardır. Utilities, dosya dönüştürür, denetler veya temizler. Assets, kitaplığındır. Projects, kaydettiklerini saklar.

Alttaki çubukta **Open**, **Settings**, arama alanı, Lolly Verify'a giden **Verify** kısayolu ve bu kılavuzları açan **Docs** bulunur. Çubuk, Tools, Utilities, Assets, Projects, Settings ve uygulama içi kılavuzlarda görünür; bir araç açıldığında gizlenir. [Lolly Search](/info/search.html), bu alandan araçlarını, kayıtlı işlerini, varlıklarını ve ayarlarını bulur. [Ask Lolly](/info/ask.html), yazdığın soruya bu kılavuzların ilgili bölümüyle yanıt verir.

O araçta yeni bir işe başlamak için bir karta tıkla. Kayıtlı işler **Projects** üzerinden yeniden açılır. İlk ziyarette, galerinin üstündeki karşılama bandı başlamak için bir eylem sunar: Lolly Demo altında **Start making** veya kendi tasarım sistemini kurmak için **Make it yours**.

![Örnek gezinme ve New eylemi bulunan bir galeri kartı](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&localize=1&dark=1&cropSelector=.gtile%5Bdata-tool-id%3D%22design%22%5D&filename=gallery&try=1)

Her araç ikiye bölünmüş bir görünüm sunar: bir tarafta **denetimler**, diğer tarafta canlı **önizleme**. Bir denetimi değiştirdikçe önizleme güncellenir ve gördüğün şey dışa aktarılır.

![Bir aracın bölünmüş görünümü - solda denetimler, sağda çizdiği canlı gruplandırılmış çubuk grafik](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26t%3DExample%2520data%26st%3DSample%2520values%252C%2520not%2520a%2520real%2520dataset%26d%3DMonth%252CSeries%2520A%252CSeries%2520B%252CSeries%2520C%250AJan%252C12%252C9%252C5%250AFeb%252C18%252C14%252C7%250AMar%252C24%252C17%252C11%250AApr%252C29%252C23%252C15%26lg%3D1&width=1440&height=900&dpi=192&waitMs=2500&walker=1&format=svg&dark=1&filename=vt-tool-split-view)

**Lolly Design** bir istisnadır: sürüklediğin, yeniden boyutlandırdığın ve içine yazdığın kutulardan oluşan serbest bir tuvaldir; kendi üst çubuğu, zaman çizelgesi ve sunum denetimleri vardır. Kılavuzu, [Lolly Design: serbest tuval](/info/design.html) sayfasıdır.

<!--i:eti-sliders-->
## Aracın değiştirmene izin verdiğini değiştir

Araç, yalnızca değişmesi amaçlanan girdileri gösterir. Yazarı renkleri, düzeni, yazıyı ve mantığı sabitlemiştir; böylece işin onun kurallarına uyar. Girdiler arasında metin, sürgüler, renk seçiciler, açılır menüler, tarihler, görsel seçiciler ve yinelenen satır grupları vardır. Bazıları katlanabilir bölümlerde yer alır.

![Bir aracın denetimleri - bir metin alanı, renk düğmeleri ve bir sürgü; yazarın kilitlemeyi seçtiği diğer öğeler yok](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=%23tool-inputs&walker=1&format=svg&dark=1&filename=use-tool-inputs)

**Denetimini bulmak için tasarıma tıkla.** Önizlemedeki bir öğeye tıkladığında denetimi odaklanarak görünüme kayar. Yinelenen satır grubunda tıkladığın satır açılır.

**Clear changes**, denetimlerin üstünde yer alır ve her girdiyi varsayılan değerine döndürür.

**Tasarım sistemi seçimleri.** Tasarım sistemin birden fazla colourway, açık ve koyu görünüm veya başka bir tema seçeneği sunduğunda bunlar denetimlerin altındaki **Design system** bölümünde yer alır. Seçim, yalnızca bu aracı etkiliyorsa görünür; dolayısıyla bir dosya yardımcı aracı bu bölümü göstermez. Her colourway kendi renklerinde bir noktadır, açık ve koyu iki düğmedir ve diğer seçimlerin her biri bir listedir.

Seçim, bu çalışmaya aittir. Bağlantıyla ve kayıtlı oturumla taşınır. Tasarım sistemine bağlı her renk bu seçime uyar; uygulamanın kendi renkleri aynı kalır. Lolly Design, aynı seçimleri Inspector'ın **Canvas** sekmesinde sunar. Renkleri içeriğini oluşturan bir araç, kurallı colourway üzerinde kalabilir ve bu durumda colourway noktalarını göstermez. [Lolly Demo kullanımda](/info/lolly-demo-in-use.html#colourways-on-real-work), gerçek işlerde colourway'leri gösterir. Uygulamada ve her yeni çalışmada aynı colourway'i kullanmak için **Settings → Appearance** içinde seç ([Bir colourway'i kendine uyarla](/info/colourways.html#make-a-colourway-your-own)).

### Önizlemeyi yakınlaştır ve kaydır

- **Yakınlaştır:** Cmd/Ctrl ile kaydır veya izleme dörtgeninde sıkıştır; merkez işaretçindir. Klavyede `0` veya `Shift+1` tümünü sığdırır, `1` veya `Shift+0` %100'e ayarlar ve `Shift+2` seçimi sığdırır. `+` / `−`, işaretçi sahnenin üzerindeyse işaretçinin, değilse merkezin etrafında yakınlaştırır veya uzaklaştırır.
- **Kaydır:** **Space** tuşunu basılı tutarak sürükle veya orta fare düğmesiyle sürükle. Normal tıklamalar, tasarımın parçalarına tıklamak için serbest kalır.
- **Dokunma:** yakınlaştırmak için sıkıştır, kaydırmak için sürükle, sığdırmak için çift dokun.
- **Yakınlaştırma HUD'u:** `−`, **Fit** ve `+` düğmelerini açmak için köşedeki Lolly girdabını basılı tut. Girdaba kısaca dokunmak yine profil menünü açar.

Lolly Design'da **Fit all**, çalışma alanlarıyla serbest katmanları kapsar. Sayfa görünümün yarısını kaplayana kadar elle yakınlaştırma %20'nin altına inebilir. Kesin alt sınır, normal Fit ölçeğinin %5'i ile %2 mutlak yakınlaştırmadan daha düşük olanıdır.

Çıktı boyutunu değiştirmek, görünümü her seferinde yeniden sığdırır.

![Tuvalin köşesindeki girdaptan açılmış yakınlaştırma HUD'u - eksi, Fit, artı, sonra tema ve ses anahtarları ve yerini değiştiren tutamaç](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=.stage-nav%7Bopacity%3A1!important%7D&drive=drag%3A.stage-nav-profile%7Cdx%3D1%7Chold%3Bwait%3A700&cropSelector=.stage-nav&walker=1&format=svg&dark=1&filename=use-zoom-hud)

### Geri alma ve yineleme

**Cmd/Ctrl-Z** bir adım geri, **Cmd/Ctrl-Shift-Z** (veya **Cmd/Ctrl-Y**) bir adım ileri gider. **Undo** ve **Redo** düğmeleri denetimlerin üstünde, Lolly Design'da ise üst çubukta bulunur. Yapılacak adımı kalmayan düğme soluklaşır. Her geri almanın hangi girdiyi geri yüklediğini söyleyen mesajda bir **Redo** düğmesi bulunur.

- **Bir sürükleme tek adımdır.** Bir denetimde yarım saniye içinde tekrarlanan değişiklikler tek adımda birleşir.
- **Son 100 adım saklanır.** Geri almadan sonra yapılan yeni bir düzenleme, ileri yığınını temizler.
- **Metin kutusunda**, Cmd/Ctrl-Z karakter karakter alana aittir. Sürgüler, açılır menüler, renkler ve anahtarlarda Lolly devralır.
- **Dosya seçmek**, dosya girdisinde bir adım sayılmaz; çünkü bu baytlar yalnızca o oturumda tutulur.

Canlı bir [işbirliğinde](/info/collaborate.html), diğer cihazdan gelen değişiklik asla senin geri alma yığınına eklenmez. Geri alma, araçtan ayrılana veya sayfayı yeniden yükleyene kadar kullanılabilir. Daha eski değişiklikler için, çalışırken kaydeden araçlar önceki sürümleri **History** altında saklar ([Önceki bir sürüme dön](/info/find-your-work.html#go-back-to-an-earlier-version)).

### Canlı kamera

Kamera varsa **Filter** aracındaki efektler (Halftone, Scanline, Posterize, Voronoi, Duotone, Stretch, Misprint, Dither, ASCII art ve Glitch) **Go live** düğmesini gösterir. Açtığında efekt, web kameranın görüntüsünü kare kare izler. Hareket dışa aktarması, sonucu GIF, WebM veya MP4 olarak kaydeder. Kareler cihazında işlenir. Durdurduğunda veya araçtan çıktığında kamera hemen serbest bırakılır. Her görsel seçicide tek bir kare çekmek için **Take a photo** da bulunur.

<!--i:eti-folder-plus-->
## Kaydetme & devam etme

Çalışmanı saklamak için render hapında **Export** yanındaki tik işareti olan **Save** düğmesine bas. Yeni çalışma **My library** içine kaydedilir, önceden kaydettiğin çalışma bulunduğu yerde güncellenir ve hiçbir dosya indirilmez. Aynı **Save** düğmesi dışa aktarma panelinde de bulunur.

Kaydedileceği yeri seçmek için dışa aktarma panelinde **Download** yanındaki **Save as** düğmesine bas. **Save to a project** altında **My library** seçimini koru veya bir proje seç (**＋ New project…** yeni bir proje oluşturur), ardından **Save** düğmesine bas. **Save as a template**, tasarımı yeni belgeler için başlangıç noktası olan bir [şablon](/info/templates.html) olarak saklar. Lolly Design'da **Save as**, Lolly menüsünde yer alır. Telefonda önce **•••**, ardından **File menu**, ardından **Save as** düğmesine bas.

![İki parçalı render hapı: dışa aktarma panelini açan yukarı oklu Export ve bulunduğu yere kaydeden tik işaretli Save](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=%23tool-inputs%7Bdisplay%3Anone%7D&cropSelector=.render-pill&walker=1&format=svg&dark=1&filename=use-render-pill)

::: timeline
- <!--i:check--> Render hapında **Save** düğmesine veya proje seçmek için **Save as** düğmesine bas.
- <!--i:folder--> Öğe **My library** içine veya seçtiğin projeye kaydedilir.
- <!--i:home--> Daha sonra sol üstteki **Home** düğmesine bas ve **Projects** sekmesini aç.
- <!--i:document--> Öğeyi aç. Tüm ayarlar geri gelir; yeniden değiştirmeye ve dışa aktarmaya hazırdır.
:::

Öğeler, dışa aktarma paneline yazdığın dosya adını veya ad yazmadıysan **QR Code** gibi kendi araçlarının adını alır. **Download** ile aldığın dosya bitmiş bir kopyadır. Daha sonra değiştirmek için Projects içindeki kayıtlı öğeyi aç.

::: note Kayıtlar bu cihazda kalır
[Sync](/info/sync.html) özelliğini açmadığın sürece kişisel kayıtların bu cihazda, kaydettiğin tarayıcı veya uygulamada kalır.
:::

Bir şeyi beklediğin yerde bulamazsan [Çalışmanı bulma ve kurtarma](/info/find-your-work.html), kapanmış bir sekmeden silinmiş tarayıcı verilerine kadar tüm durumları ele alır.

::: details Lolly Work ile ekip projeleri (isteğe bağlı)
[Kuruluşun Lolly Work kullanıyorsa](/info/organisation.html) kuruluşun örneğinde oturum aç ve seninle paylaşılan oturumlar için **Projects → Team projects** bölümünü aç. Erişim ve saklama kurallarını kuruluş belirler; bu oturumları kuruluşun Lolly Work hizmeti saklar. Kuruluşun canlı düzenlemeye izin veriyorsa paylaşılan bir oturum açılırken canlı işbirliğine katılır. [Birlikte çalışma](/info/collaborate.html#collabs-through-lolly-work-optional) adımları açıklar.

Kişisel kitaplığın ayrı kalır. Başka bir cihazda oturum açtığında ekip çalışmalarına erişirsin. Kişisel kayıtları taşımak için yine Sync veya yedek gerekir.
:::

<!--i:eti-link-->
## Çalışmanı paylaşma

Bir tasarımı bağlantı veya dosya olarak paylaş. Dışa aktarma denetimlerindeki **Share**, iki seçeneği de sunan bir iletişim kutusu açar. Projects içindeki kayıtlı bir oturumda **Share link**, o oturum için aynı iletişim kutusunu açar. Google Drive, Nextcloud, bir S3 bucket'ı, Dropbox veya OneDrive'a dosya gönderdikten sonra iletişim kutusu o hizmet üzerinden bir bağlantı da oluşturabilir ([Dosya dışa aktar](/info/exporting.html#how-export-works)).

::: cols
## Bağlantı

- Her girdiyi adresin içinde taşır; böylece bağlantı tasarımı yeniden oluşturur.
- Bu cihazdan eklediğin görselleri ve dosyaları, çok uzun metinleri ve çok büyük listeleri dışarıda bırakır.
- Her tarayıcıda açılır; böylece bağlantıyı yer imlerine ekleyebilir, yapıştırabilir veya commit edebilirsin.

## .lolly dosyası

- Kayıtlı oturumu bu cihazdaki görseller ve dosyalarla birlikte taşır; aracı ve tasarım sistemini de taşıyabilir.
- Dosyaları dahil etmeyi seçmediğin sürece lisanslı katalog çalışmalarını dışarıda bırakır.
- Lolly'de açılır: çift tıkla, **Open** kullan veya uygulamaya bırak.
:::

### Bağlantı

Bağlantı, iletişim kutusunun üstünde yer alır. Yanında **Copy** ve bağlantıyı QR Code aracında açan **QR** düğmesi bulunur. Bağlantının altındaki **Link options** şunları içerir:

- **Open in the installed app**, tüm parametreleri koruyarak bağlantıyı Shortcuts, başlatıcılar ve otomasyon için bir `lolly://` adresine dönüştürür.
- **Shortest link**, uzun bir tasarımı kısa bir belirteçte paketler ve kaç karakter kazanıldığını gösterir. Okunabilir biçim de kullanılabilir kalır.
- **Password-protect this link**, bağlantıyı cihazında AES-256 ile şifreler. Parola hiçbir zaman bağlantının parçası olmaz.
- **Pin this tool version**, `_v` bayrağını ekler; böylece sonraki bir araç güncellemesi bağlantının render ettiği sonucu değiştiremez.
- **When the recipient opens the link…**, tam ekranı, dışa aktarma panelinin açık olmasını, açılışta indirmeyi (`&export`) veya panoya kopyalamayı (`&copy`) seçer.
- **Copy credit**, bir gönderi veya slayt için bağlantıyla birlikte "Lolly ile yapıldı" açıklamasını kopyalar.

Bir araç adın gibi kişisel alanlar içeriyorsa **Review personal fields**, sen ilgili alanı işaretleyene kadar o alanı bağlantının dışında tutar. [URL modu](/info/url-mode.html), bir bağlantının taşıyabileceği her şeyi ele alır.

**İletişim kutusu, bağlantının neleri taşıyamadığını söyler.** Lolly bağlantıyı oluştururken adrese sığmayan her şeyi sayar. Bir şey dışarıda bırakıldıysa iletişim kutusu bunları listeler ve dosya seçeneğini gösterir. Yalnızca uzun olan bir bağlantı için karakter sayısını içeren daha hafif bir not gösterilir.

**Bazı araçlarda bağlantı ürünün tamamıdır.** Jump Page, paylaşman için bağlantılarını tek sayfada toplar: bir profil bağlantısı, konuşma veya mağaza vitrini. Sayfanın kendisi bağlantıdır; bu yüzden hiçbir şey barındırılmaz ve sayfanın arkasında bir hesap bulunmaz. Ziyaretçi, kaydırdıkça her sahnede bir bağlantı olacak şekilde sayfayı tam genişlikte görür.

![Düzenleyicide Jump Page: sayfanın üstünde başlık sahnesi, altında bağlantı sahneleri](/t/url-shot?url=%2F%23%2Ftool%2Fjump%3Ffull%26heading%3DFind%2520us%2520everywhere%26subheading%3DOne%2520link%2520for%2520everything.%26links%3DURL%252CName%252CEmoji%257Ehttps%25253A%25252F%25252Fexample.com%252CWebsite%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fnews%252CNewsletter%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fhello%252CSay%252520hello%252C&width=900&height=1300&dpi=96&waitMs=2000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=use-jump-page)

::: details Lolly Work ile kuruluşun yönettiği bağlantılar
Lolly Work, süre sonu, iptal veya parola gerektiren paylaşımlar için paylaşılan oturumlara, araçlara ve katalog varlıklarına yönetilen bağlantılar sunar. Bu bağlantılar kuruluşun hizmeti üzerinden çözümlenir ve kuruluşun erişim kurallarına uyar. Yukarıdaki kendi kendine yeten bağlantılardan ayrıdır. Birini iptal etmek, birinin daha önce indirdiği dosyayı geri alamaz. [Render ve paylaşım](/info/manage/sharing.html), bağlantı türlerini ve izinleri listeler.
:::

### .lolly dosyası

Share iletişim kutusunun **Editable file** bölümündeki **Download .lolly**, geçerli tasarımı tek bir dosya olarak yazar. Standart katalog çalışmaları, bu cihazdaki görseller ve dosyalarla birlikte dahil edilir. Güncelliğini yitirmiş veya kullanılamayan bir dosya, harici başvuru olarak kalır. Kaydetmeden önce iletişim kutusu dosyanın boyutunu, kaç dosya gömdüğünü, kaç dosyaya başvurduğunu ve aracın dahil olup olmadığını gösterir. Cihazında paylaşım menüsü varsa **Send to…**, dosyayı bu menüye aktarır (AirDrop, Android paylaşımı).

**Projects** içindeki bir klasörün menüsünde bulunan **Download project (.lolly)**, klasörün tamamını yazar; böylece başka biri klasördeki her oturum üzerinde çalışmaya devam edebilir. Toplu işlem oturumları dışarıda bırakılır ve bildirim bunların sayısını belirtir. Aynı menüdeki **Download originals**, her öğenin ayrı bir dosya olduğu standart bir zip yazar.

Dosya gönderilmeden önce üç şeye karar verirsin:

- **Adının dahil olup olmayacağı.** Adın, e-posta adresin ve kuruluşun yalnızca [profilinde](/info/profile.html) **Use my details to create** açıkken yazılır. Kapalıyken dosya yalnızca Lolly ile yapıldığını ve ne zaman yapıldığını kaydeder.
- **Dışarıda tutulan çalışmaların dahil olup olmayacağı.** Lisanslı ve markaya kilitli çalışmalar varsayılan olarak dışarıda kalır. Kayıtlı lisansını Lolly'nin henüz okuyamadığı katalog çalışmaları da dışarıda kalır. Tasarım bunlardan birini kullanıyorsa iletişim kutusu kaç tane olduğunu söyler ve *Download without them* veya *Include and download* seçeneklerini sunar. Bunları dahil etmek, dosyaları `.lolly` dosyasını açan kişiye verir. Hakları hakkında hiçbir kayıt bulunmayan katalog çalışmaları dosyayla birlikte gider; iletişim kutusu göndermeden önce kontrol edebilmen için her birini listeler. Dosyanın `CREDITS.txt` dosyası, nelerin taşındığını ve nelerin taşınmadığını nedenleriyle listeler. [Yaratıcı hakları ve atıflar](/info/creative-rights.html) kuralları açıklar.
- **Aracın dahil olup olmayacağı.** **Include the tool**, aracın kendi dosyalarını paketler; böylece tasarım o aracın bulunmadığı bir cihazda açılır. Çatallanmış bir araç gibi özel araçlarda başlangıçta işaretlidir; imzalı katalogda listelenen araçlarda işaretli değildir. İmzalı kataloğu olmayan bir derlemede her araç özel sayılır.

**Dosyayı açma.** Masaüstü ve mobil uygulamalarda bir `.lolly` dosyasına çift tıkla veya dokun, **Open with Lolly** seç ya da paylaşım menüsünden Lolly'ye gönder. Web uygulamasında **Open** düğmesine bas veya dosyayı Lolly'ye bırak. Her yöntem önce dosyanın bildirimini okur ve herhangi bir şey yazılmadan önce boyutunu, içeriğini ve ne yapılacağını gösterir.

::: warning Bir araç kurulduğunda kodu çalışır
Dosya, sende olmayan bir araç içeriyorsa **Trust this tool?** aracı ve yazarını gösterir ve açıldığında aracın kendi kodunun cihazında çalışacağını söyler. **Trust & install** işlemi sürdürür.
:::

Reddedersen çalışma yine Projects içine kaydedilir ve aracı ekleyene kadar bekler. Kodu modül olarak dağıtılan bir araç henüz bu yolla kurulamaz ve aynı şekilde reddedilir.

::: details .lolly neler içerir ve nasıl açılır
`.lolly`, Lolly'nin paket uzantısıdır; `format` alanı ise `manifest.json` dosyasında paketin içeriğini belirtir:

- **Paylaşılan tasarım** (`lolly-share`), bir kayıtlı oturumu, gömülü dosyalarını ve hâlâ başvuru yoluyla çözümlenen her şey için bir makbuzu içerir. Aracı ve tasarım sistemini de içerebilir. Açıldığında yeni bir Project ekler ve hiçbir oturumun üzerine yazmaz.
- **Paylaşılan proje** (`lolly-share`, türü `project`), Projects içindeki bir klasörü içerir: alt klasörlerini, içlerindeki her oturumu kartıyla birlikte ve orada saklanan görselleri. Açıldığında klasörün bir kopyasını ekler. Her oturum `sessions/<key>.json` olarak, kartı da `thumbs/` altında taşınır. Proje dosyaları çıkmadan önceki bir Lolly sürümü güncelleme yapmanı ister.
- **Tasarım sistemi paketi** (`lolly-brand`), token'ları içerir; yazı tiplerini, logoları, yayımlanmış sürümleri ve saklanan kaynakları da içerebilir. Paket açıldığında ayrı, adlandırılmış bir tasarım sistemi eklenir ve bu sistem etkinleştirilir.
- **Çalışma alanı veya örnek paketi**, tanımlanmış araçları, katalog varlıklarını ve isteğe bağlı olarak bir örnek adresini içeren bir `lolly-brand` paketidir. Yüklendiğinde önceden yüklenmiş tek çalışma alanı katmanının yerini alır; önizleme cihazın tamamını etkileyen bu değişiklikleri listeler.

Tam cihaz yedeği bir `.lolly` değildir. `LollyTools-….zip` (biçim `lolly-backup`) olarak kalır ve **Settings → Storage → Import data…** üzerinden geri yüklenir. Zip olarak sıkıştırılmış bir araç klasörü de `.zip` olarak kalır. [Veri aktarımı](/info/data-transfer.html), biçimlerin başvuru kaynağıdır.

Bir `.lolly`, standart bir zip dosyasıdır. İçine bakmak için adını `.zip` olarak değiştir. Kendi görsellerin `assets/uploads/`, katalog çalışmaları ise `assets/catalog/` altındadır. `manifest.json` her dosyayı listeler; README dosyanın ne olduğunu açıklar.

macOS, Windows, Linux, iOS ve Android'in tümü bu biçimi kaydeder. Masaüstü dosya yöneticileri dosyayı bir Lolly belgesi olarak gösterir; GNOME Files, kayıtlı oturumun kendi küçük resmini de gösterebilir. Lolly Design System Setup üzerinden açarken paylaşılan tasarım bir tasarım sistemi içeriyorsa tasarım sistemi eylemi önerilir, ancak **Open shared design** hiçbir zaman gizlenmez.

iOS veya Android'de başka bir uygulamadan aktarılan belge için sınır 48 MB'tır ve uygulama bunu belirtir. Aktarım, baytları uygulama sınırının ötesine kopyalar. Lolly içindeki **Open** için böyle bir sınır yoktur; daha büyük paketlerde onu kullan.

Onayından sonra Lolly, paketi bir kez açar ve doğrular. Varlıklar kitaplığına gider; sağlama toplamıyla eşleştirildiğinden cihazda zaten bulunan dosya yeniden kullanılır. Oturumlar Projects içine yeni kimliklerle kaydedilir; bu yüzden aynı dosya iki kez açılabilir. Aracı eksik olan oturum orada bekler. 100 MB üzerindeki dosyalar büyük olarak işaretlenir; tarayıcı depolaması dosyanın gerektirdiğinden daha az boş alan bildirirse önizleme uyarır. Herhangi bir şey kalıcı olarak yazılmadan önce bütünlük denetimi kapsamındaki tüm parçalar kontrol edilir; hasarlı bir kopya hiçbir şey bırakmadan reddedilir.
:::

Bağlantı da dosya da anlık bir kopya aktarır. Canlı düzenleme için [Birlikte çalışma](/info/collaborate.html), iki cihaz arasındaki özel işbirliklerini ve Lolly Work üzerinden isteğe bağlı iş işbirliklerini ele alır.

<!--i:eti-images-->
## Assets - kitaplığın

**Lolly Assets** (`#/a`), araçlarının kullanabileceği kaynakları içerir: türlerine göre gruplanmış marka logoları, görseller, ses ve hareketli içerikler ile kendi dosyaların. Yüklemelerin cihazında saklanır. Lolly Work kullanan bir kuruluş, kendi erişim kuralları kapsamında paylaşılan bir katalog da sağlayabilir ([Lolly'yi kuruluşunda kullan](/info/organisation.html)).

![Markanın renk örneklerini, yazı tiplerini ve kendi yüklemelerini gösteren Assets](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches%2Cfonts&width=1440&height=900&dpi=96&waitMs=2400&css=.plat-swatch-grid~%2A%7Bdisplay%3Anone%7D&walker=1&format=svg&localize=1&dark=1&filename=assets)

- <!--i:upload--> **Dosyalarını içeri al.** Yükleme alanına bir görsel, SVG, ses klibi, video, Lottie, PDF veya PowerPoint sunumu bırak ya da seçmek için tıkla. Dosya hemen Assets içinde ve her aracın varlık seçicisinde görünür. Çok sayfalı bir PDF veya `.pptx`, hangi sayfa veya slaytları tutacağını sorar; her biri bir SVG varlığına dönüşür. Bir aracın içinden eklediğin görsel **My images** içinde değiştirilmeden saklanır; böylece üzerindeki Content Credential hâlâ doğrulanır. Yalnızca çok büyük dosyalarda yeniden boyutlandırmak isteyip istemediğin sorulur. **Settings → Storage**, **My images** içeriğinin ne kadar yer kapladığını gösterir. Cihazının depolama alanı dışında bir sınır yoktur. Yüklerken EXIF ve GPS verilerini kaldırmak için **Settings → Feature flags** altında **Strip metadata from uploads** seçeneğini aç. Content Credentials her iki durumda da korunur.
- <!--i:star--> **Sık kullandıklarını favorilerine ekle.** Bir varlığa veya markanın renk örneğine yıldız ver; her seçicinin üstüne sabitlenir.
- <!--i:folder--> **Düzenle.** Bir varlığı başka gruba taşı, kullanmadığın paylaşılan marka varlığını gizle (**Show hidden** geri getirir) veya kendi yüklemelerini sil. Projects içindekiyle aynı seçim çubuğu, seçimin tamamında işlem yapar.
- <!--i:layers--> **Videoyu arka planından ayır.** Videonun ayrıntılarını aç veya bir varlık seçicisindeki kartına sağ tıkla ve **Remove background…** seç. **On-device model**, bir özneyi karmaşık bir sahneden ayırır. **Colour key**, yeşil perde gibi eşit aydınlatılmış bir arka planı kaldırır ve indirme gerektirmez. **Tolerance**, **Softness** ve **Spill removal** kenarını ayarlar. **Resolution** (360, 480, 720 veya 1080p; hiçbir zaman kaynağın üzerinde değil), ayrıntı ile hız arasındaki dengeyi belirler. Ayrılan görüntü, saydamlıklı animasyonlu WebP veya PNG olarak özgün dosyanın yanına kaydedilir. Kaynağın Content Credential bilgisi, bir bileşen olarak ayrılan görüntüye eşlik eder. [Bir kez üretilir, aynı şekilde render edilir](/info/ai-features.html), bunun neden sıradan bir düzenleme olarak kaldığını açıklar.

### Paletini ve yazı tiplerini her yere taşı

Assets içindeki **Swatches** paneli markanın renklerini gösterir: marka renklerini, eklediğin renkleri, renk rampalarını ve spektrumunu. Lolly'nin arayüz için tuttuğu rol renkleri (metin, yüzeyler, kenarlar, colourway ana renkleri ve başka adlar altındaki marka rengi kopyaları), panelin altındaki gri **Show colour roles** kartının arkasındadır.

Her renk, diğer varlıklar gibi bir karttır. Ayrıntılarını açmak için birine tıkla, birkaçını seçip indir veya paletin tamamını diğer aracının okuyabildiği biçimde indir:

- <!--i:code--> Stil sayfası veya derleme için **Design tokens (JSON)**, **CSS variables** ya da **CSS classes**. sRGB'den daha geniş bir renk, geniş değerini korur: CSS bu değeri hex'ten sonra tanımlar; JSON ise hex'i geniş renk, CMYK bileşimi ve spot mürekkeple birlikte saklar.
- <!--i:palette--> Illustrator veya Photoshop için **Adobe Swatch Exchange (.ase)**. CMYK bileşimine kilitli bir renk, o CMYK renk örneği olarak; spot mürekkep, adlandırılmış spot renk örneği olarak; sRGB'den daha geniş bir renk ise Lab olarak gelir.
- <!--i:pentool--> GIMP veya Inkscape için **GIMP palette (.gpl)** ve **SCSS variables**; ikisi de sRGB kullanır.

![Swatches paneli - üstte beş palet indirme düğmesi, ardından her marka rengi için ayrıntılarını açan bir çip](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches&width=1440&height=900&dpi=96&waitMs=1800&css=.cat-group%3Anot%28%5Bdata-group%3Dswatches%5D%29%7Bdisplay%3Anone%7D&cropSelector=%5Bdata-group%3Dswatches%5D&walker=1&format=svg&dark=1&filename=use-swatch-downloads)

::: details Birkaç renk seç veya bir rengin ayrıntılarını aç
Her karttaki noktayla renkleri seç: aradaki tüm renkleri seçmek için ikinci bir noktaya Shift ile tıkla, boşluklardan geçecek şekilde bir seçim kutusu sürükle veya bir kart odaktayken Cmd/Ctrl+A tuşlarına bas. Çubukta aynı altı biçimde **Download as…**, **Copy hex** ve **Favourite** bulunur. Sen biçim seçmeden önce menü, hiçbir biçimin tutamadığı renkleri (Transparent'ın rengi yoktur), geniş bir rengi sRGB yedek değeriyle kaydeden biçimleri (SCSS ve GIMP) ve CMYK ile spot değerlerini taşıyan biçimleri (JSON ve .ase) listeler. Tek renk üzerinde aynı işlemler için karta sağ tıkla.

Bir rengin ayrıntıları, önizlemeyi o renkle doldurur ve **Linked values** (CMYK bileşimi veya spot mürekkebi, belirli bir renk uzayı veya baskı makinesi için tanımlanmış değerleri ve tasarım token'ı), **Every notation** (hex, OKLCH, Display-P3 ve diğerleri; her birinde kopyalama düğmesi bulunur), **Plotted on a colour space**, **Tones** ve **Readability** bölümlerini açar. Ok tuşları palette ilerler, **Copy link** rengi paylaşır ve **Open in Colour Lab** üzerinde çalışmaya devam etmen için rengi açar.
:::

**Fonts** paneli, yerel olarak kurmak veya matbaaya vermek için her birinde **download** bulunan marka yazı tiplerini listeler.

<!--i:eti-grid-->
## Izgarayı kendine göre düzenle

- <!--i:star--> **Kullandıklarını favorilerine ekle.** Bir karta sağ tıkla ve **Add to favourites** seç. Araç, ızgaranın üzerindeki şeritte büyük bir kartla yer alır. [Favorilerin](/info/favourites.html) bu şeridi ele alır.
- <!--i:eyeoff--> **Hiç kullanmadığın aracı gizle.** Bir karta sağ tıkla veya birkaçını seç ve **Hide tool** seç. Araç ızgaradan ve ızgaraya yazarak bulabildiklerinden çıkar. Araç ızgaradan kalkar ve ızgaraya yazdığında artık eşleşmez. Sondaki gri **Show hidden tools (N)** kartı, gizli araçları yeniden soluk olarak gösterir; her birinin menüsünde **Unhide tool** bulunur. Gizleme yalnızca senin ızgaranı değiştirir: araç bir bağlantıdan veya yer iminden açılmaya devam eder.
- <!--i:clock--> **Önce senin araçların.** Üç farklı araçta çalışma kaydettikten sonra ızgaranın üzerinde beliren **Yours** çip satırı, önce favorilerini ve son kullandığın araçları gösterir.
- <!--i:sliders--> **Düzeni kendin belirle.** **View options**, düzeni (**Grid**, **Card** veya **List**), kart boyutunu ve yoğunluğunu, sıralamayı ve kategori filtresini ayarlar.

![Gizli araçlar gösterildiğinde Tools ızgarasının sonu: soluk Wordmark kartı ve yanında onu yeniden görünür yapan, şimdi Hide hidden tools yazan gri kart](/t/url-shot?url=%2F%23%2F&width=1440&height=680&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A.gtile--hiddenbox%3Bpress%3AEnd%3Bwait%3A800%3Bhover%3A.gtile--hiddenbox%3Bwait%3A300&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&rasterDpi=96&dark=1&filename=misc-hidden-tools)
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

**Birden fazla kartta aynı anda işlem yap.** Her kartın onay kutusunu işaretle, boş alanda bir seçim kutusu sürükle veya Shift/Cmd ile tıkla; o görünümün izin verdiği işlemleri içeren bir çubuk açılır:

- **Tools ve Utilities:** Favourite, Hide, Available offline, **View sessions** (Projects içinde yalnızca o araçlarla yapılmış oturumları gösterir) ve tek bir kart için Copy link.
- **Assets:** Her seçim için Favourite ve Hide. Duplicate, Download ve Delete yalnızca seçilen öğelerin tümü senin yüklemelerinse görünür; çünkü paylaşılan bir tasarım sistemi varlığı kalıcı bir sözleşmedir.
- **Projects:** bkz. [Çalışmanı bulma ve kurtarma](/info/find-your-work.html#find-something-you-saved).

![İki araç için Available offline, View sessions, Favourite ve Hide sunan galeri seçim çubuğu](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%21important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-select%3D%22gradient%22%5D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=misc-bulkbar-gallery&cropSelector=.gallery-bulkbar)
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

**View sessions**, yalnızca bir şey seçiliyken görünür. Seçili olmayan tek bir karta sağ tıklayarak **N saved sessions** listesini aç: o aracın kayıtlı oturumları listelenir ve silinen oturum Trash'e taşınır.

<!--i:eti-layers-->
## Telefonda

Dar bir ekranda düzen tek sütuna dönüşür:

- **Denetimler bir panele dönüşür** ve üstte yer alır; alt kenarında bir sürükleme tutamacı bulunur. **Kısa**, **yarım** veya **tam** görünüme oturtmak için tutamacı sürükle ya da daraltıp genişletmek için dokun. Önizleme alttaki alanı doldurur ve düzenlerken görünür kalır.
- Yüzen **Export** düğmesi dışa aktarma panelini açar: biçim, boyut, kopyalama, kaydetme ve indirme. Paneli kapatmak için arka plana dokun.

![Telefon genişliğinde bir ekranda araç - üstte panel olarak denetimler, alttaki önizlemeyi dolduran üretilmiş palet ve alt ortada yüzen render hapı](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3Df97316%26harmony%3Dadjacent-3%26steps%3D9&width=430&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=vt-phone-palette)

<!--i:eti-copy-->
## Katlanabilir cihazlar ve iPhone Duo

Katlanabilir bir cihazda, iPhone Duo'da veya kareye yakın bir dokunmatik ekranda Lolly, aracı iki bölmeye yerleştirir:

- **Bir yanda denetimler, diğer yanda tuval.** Denetimler çizim yaptığın elden uzakta durur. **Settings → Accessibility** içinde **Dominant hand** seç veya denetimlerin üstündeki **Swap sides** düğmesine bas. Sağdan sola yazılan bir dilde taraflar tersine döner.
- **Ayırıcı, menteşe hizasındadır.** Cihaz katlanma konumunu bildirdiğinde bölmeler kat yerinde buluşur; böylece hiçbir denetim veya çalışma kat çizgisine gelmez. Kesintisiz bir ekranda ayırıcıyı genişliğin üçte birine, yarısına veya üçte ikisine sürükle. Lolly, bu cihazda her görünüm için seçimini hatırlar.
- **Masa üzerinde.** Cihaz yarı açıkken ve kat çizgisi ekranı yatay olarak bölerken tuval üst yarıda, denetimler kat yerinin altında durur. Sunum yaparken slayt üstte; notların, sonraki slayt ve **Back** ile **Next** altta yer alır. Sequence'te önizleme üstte, zaman çizelgesi alttadır.
- **Lolly Design, Design System Setup ve Assets.** Lolly Design'da Inspector, katmanlar ve dışa aktarma paneli tuvalin yanındaki sekmelerdir. Araçlar, tuvalin dış kenarı boyunca çizim elinin altında durur. Araçlar sığmadığında sütun kaydırılır; oklu bir soluklaşma, kalan araçların hangi yönde olduğunu gösterir. Masa üzerinde araçlar tuvalin alt kenarında sıralanır. Lolly Design System Setup, Board'u bir yanda, açtığın odayı diğer yanda tutar. Assets içinde bir varlığın ayrıntıları kitaplığın yanında açılır; böylece sonraki dokunuş aynı yerde sonraki varlığı gösterir.
- **Kat çizgisinde hiçbir şey yok.** Kat yeri bildirildiğinde iletişim kutusu denetimlerin bulunduğu sayfada açılır. Ana ekranın altındaki arama kutusu ve sonuçları da orada açılır. Düz ekranda bunlar ortada kalır.
- **Katlamak hiçbir şeyi kaybettirmez.** Cihazı katlamak, açmak veya çevirmek belgeni, seçimini, yakınlaştırmayı ve yazdığın alanı korur; imleç yerinde kalır.

Katlanabilir cihazın dış ekranı yukarıdaki telefon düzenini korur. Bölünmüş ekranın bir yarısındaki Lolly penceresi de aynı düzeni kullanır.

<!--i:eti-smile-->
## Ayarlar, ses ve rahatlık

Ana ekranın altındaki **Settings**, bilgilerini, tasarım sistemlerini, erişilebilirliği, depolamayı ve çevrimdışı indirmeleri içerir. [Lolly Ayarları](/info/dashboard.html) her sekmeyi açıklar.

- **Bilgilerin ve profil fotoğrafın**, e-posta imzası veya yaka kartı gibi bunları kullanmak için yapılmış araçları doldurur. [Profiller](/info/profile.html) bunları ele alır.
- **Accessibility**, rahatlık için dört anahtar sunar: **Reduce motion**, **Hide colourful previews**, **High contrast** ve **Large text**. Bunlar çalışmanın çevresindeki uygulamayı değiştirir; araç tuvalini veya dışa aktarılan dosyayı asla değiştirmez. Yanlarındaki **Dominant hand**, iki bölmeli düzende denetimlerin hangi tarafta yer alacağını seçer.
- **Sound**, eylemlerin için hafif yardımcı sesler çalar; **Neurospicy Mode** ise sakin bir odaklanma parçası çalar. **Settings → Accessibility** veya profil menüsünden açana kadar ikisi de kapalıdır. Sound anahtarının altındaki **Sound shape** sürgüsü, sesleri yumuşak, yuvarlak damlalardan (Bouba) kuru tıkırtılara ve sürtünme seslerine (Kiki) taşır; ortada Lolly'nin çan sesleri bulunur. Neurospicy'nin parçaları, Lolly'nin ürettiği istasyonları içerir: **Lolly Sings** ve türleri ile üç **Lofi stations**. İstasyonlar çalarken sonsuz müzik üretir. Her birinde davul ve doku denetimleri (Lofi'de ruh hâli de), duyduğun melodiyi paylaşmak için bir bağlantı ve melodiyi varlıklarına kaydeden bir düğme bulunur. [Üretilen müzik](/info/generated-music.html), melodinin nasıl yapıldığını açıklar. Utilities altındaki **Music generator** (`#/music`), bir melodiyi şekillendirmeni sağlar.
- **Available offline**, bağlantıyı kaybetmeden önce uygulamanın geri kalanını, araçlarını, kataloğu ve kılavuzları indirir. Lolly'yi web uygulaması olarak kurmak için tarayıcının kurulum düğmesini veya telefonda *Add to Home Screen* seçeneğini kullan. Kurulu uygulama tam ekran çalışır ve yeniden çevrimiçi olduğunda kendini günceller.
- **Settings → Feature flags** altındaki **Performance UI**, uygulamaya çizimi daha az kaynak gerektiren daha sade bir görünüm verir. Araç tuvalleri ve dışa aktarmalar aynı kalır. Yavaş bir cihazda Lolly bu görünümü kendisi açar ve nedenini **Undo** ve **Keep** seçenekleriyle bildirir ([Performance UI](/info/configuration.html#curating-what-people-see)).
- **Storage**, Lolly'nin bu cihazda neler tuttuğunu gösterir. [Tarayıcı verilerini silersen](/info/find-your-work.html#if-you-clear-your-browser-data), silme işleminin neleri kaldırdığını açıklar; [Gizlilik Politikası](/info/privacy.html) ise uygulamanın aldığı veya gönderdiği her şeyi listeler.

::: note Güncellemeden sonra bir görünüm yüklenmezse
Güncellemeden hemen sonra boş bir panel veya "failed to fetch" mesajı genellikle sayfayı bir kez yeniden yükleyince düzelir. Kayıtlı çalışmaların, oturumların ve tasarım sistemlerin cihazında saklandığı için etkilenmez. Yalnızca ekleyip hiç kaydetmediğin bir görseli yeniden eklemen gerekebilir.
:::

<!--i:eti-map-pin-->
## Sırada nereye gitmeli

- **[Lolly Design: serbest tuval](/info/design.html)**: tuval, şekiller, zaman çizelgesi ve slayt sunumu yapma.
- **[Toplu işlem ve Lolly Multi-edit](/info/batch.html)**: bir tasarımın birçok sürümü veya birlikte düzenlenen birkaç kayıtlı tasarım.
- **[Dosya dışa aktar](/info/exporting.html)**: biçim, boyut, baskı birimleri, saydamlık ve video seçme.
- **[Tasarım içeri aktar](/info/design-import.html)**: Figma, Penpot, Illustrator, InDesign, Affinity veya DXF dosyasını Lolly Design'a getir ve düzenlemeye devam et.
- **[Şablonlar](/info/templates.html)**: bir araç için kayıtlı başlangıç noktaları.
- **[Geniş Renk ve HDR](/info/hdr-editing.html)**: Lolly Design ve Lolly Darkroom'da özgün görsel hassasiyetini koru.
- **[Çalışmanı bulma ve kurtarma](/info/find-your-work.html)**: her şeyin nerede olduğu ve başka bir cihaza nasıl taşınacağı.
