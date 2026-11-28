# Ayarlar

Ayarlar; bilgilerini, tasarım sistemini, erişilebilirliği, bu cihazdaki depolamayı ve çevrimdışı indirmeleri içerir. Ana ekranın altındaki çubuktan veya avatar menünden **Settings**'i aç; **Preferences** sekmesinde açılır.

| Sekme | Adres | İçeriği |
|---|---|---|
| **Preferences** | `#/settings` | Bilgilerin, tasarım sistemleri, görünüm, emoji, erişilebilirlik, bağlantılar, depolama ve çevrimdışı indirmeler |
| **This device** | `#/settings?tab=device` | Bu tarayıcı ve makine hakkında canlı bilgiler, ayrıca ses ve salt okunur bir depolama görünümü |
| **Design system** | `#/settings?tab=brand` | Kapak ve sayfalar olarak etkin tasarım sistemi, sistem değiştirmek için bir kapak şeridiyle birlikte |
| **Capabilities** | `#/settings?tab=caps` | Aranabilir kartlar halinde Lolly'nin yapabildiği her şey |
| **Activity & stats** | `#/settings?tab=activity` | Katalog, yerel sayaçların ve son işlerin |

Eski `#/profile` ve `#/d` bağlantıları, tek tek ayarlara kadar hâlâ doğru yeri açar.

<!--i:eti-sliders-->
## Tercihler

Preferences, yanında aşağı doğru uzanan bir **ayarlar rayı** bulunan tek uzun sayfadır. Rayın üstündeki **Search settings** alanı, sen yazdıkça rayı filtreler. Her bölümün `#/settings?focus=storage-section` gibi `#/settings?focus=<section-id>` biçiminde bir bağlantısı vardır.

- <!--i:usercheck--> **Your details** - adın, iletişim bilgilerin, portre fotoğrafın ve **Use my details to create** anahtarı. [Profiller](/info/profile.html), araçların bunları nasıl kullandığını açıklar.
- <!--i:seal--> **Content Credentials** - dışa aktarmalarını imzalayan isteğe bağlı doğrulanmış kimlik. Bkz. [Content Credentials](/info/content-credentials-identity.html).
- <!--i:palette--> **Design systems** - tasarım sistemlerini değiştir, ekle, gizle veya kaldır. [Lolly Design System Setup](/info/brand-studio.html#manage-your-design-systems) her eylemi ele alır.
- <!--i:moon--> **Appearance** - tema (Light, Dark veya uygulamayı senin paletinle renklendiren Brand), tasarım sistemi birden fazla colourway sunduğunda **Your colourway** ([Bir colourway'i kendine uyarla](/info/colourways.html#make-a-colourway-your-own)) ve **Interface follows the design system**.
- <!--i:sparkle--> **Emoji** - görsel lisansıyla birlikte yeni işler için emoji kümesi ve paletinin emojileri ne ölçüde yeniden renklendirdiği (**Off**, **Subtle**, **Strong**, **Full**, **Mono** veya **Duotone**). **Keep skin tones and flags**, bunları kendi renklerinde bırakır. Önceden yaptığın işler kendi kümesini korur.
- <!--i:eyeoff--> **Accessibility** - dört konfor anahtarı, ayrıca Sound ve Neurospicy Mode. Bkz. [Erişilebilirlik](#accessibility).
- <!--i:link--> **Connected services** - Dropbox, Google Drive, OneDrive, Nextcloud veya S3 gibi bağladığın depolama alanları ve **Sync across devices**. Bkz. [Cihazlarını eşitle](/info/sync.html).
- <!--i:globe--> **Trusted sites** - bir Lolly Design web sayfası kutusunun veya Lolly Sandbox demosunun sormadan iletişim kurabileceği siteler ve sunucu sunduğunda **Allow pages from any site**. [Gizlilik politikası](/info/privacy.html), her isteğin neler gönderdiğini listeler.
- <!--i:download--> **Your renders** - **Save my renders to my library**, indirdiğin her görselin, ses klibinin ve videonun bir kopyasını Assets içinde Renders etiketi altında saklar.
- <!--i:database--> **Storage** - Lolly'nin bu cihazda tuttukları ve verilerini temizleyen veya taşıyan düğmeler. Bkz. [Depolama](#storage).
- <!--i:cpu--> **Available offline** - bağlantını kaybetmeden önce ihtiyacın olanları indir. Bkz. [Çevrimdışı kullanılabilir](#available-offline).
- <!--i:folder--> **Hot folder** - masaüstü uygulamasında Lolly bir klasörü izler ve oraya bırakılan her şeyi sürükle ve bırak ile aynı seçici üzerinden içeri alır.
- <!--i:clock--> **Your activity** - bu cihazda yaptıkların, yerel olarak sayılır.
- <!--i:sliders--> **Feature flags** - **Print preflight** veya **Strip metadata from uploads** gibi uygulama bölümlerini aç veya kapat. **Performance UI**, uygulamaya çizilmesi daha az kaynak gerektiren daha sade bir görünüm verir. Lolly, yavaş bir cihazda Performance UI'ı kendiliğinden açabilir. Bu durumda anahtarın altındaki satır, **Allow again** ile birlikte ne zaman ve neden açıldığını belirtir ([nasıl karar verir](/info/configuration.html#curating-what-people-see)).
- <!--i:server--> **Lolly instance** - bu kurulumun araçlarını ve kataloğunu aldığı yer. Bkz. [Lolly örneği](#lolly-instance).

Tema kartları canlı önizlemelerdir. Seçtiğin tema hemen uygulanır, yalnızca bu cihazda.

![Her biri kendi yazı tipini ve rengini önizleyen, etkin olanı işaretlenmiş üç tema kartı](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dappearance-section&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

### Erişilebilirlik

**Settings → Preferences → Accessibility**, uygulama için dört konfor ayarı içerir. Her biri sen açana kadar kapalıdır ve hiçbiri araç tuvalinin veya dışa aktarmanın içine etki etmez; böylece daha sakin bir uygulama, teslim ettiğin dosyanın tek bir pikselini bile değiştirmez. Her biri varsayılan olarak kapalıdır. Hiçbiri araç tuvalini veya dışa aktarmayı değiştirmez.

- <!--i:pause--> **Reduce motion**, uygulamanın geçişlerini, kaymalarını ve süsleme animasyonlarını kapatır.
- <!--i:photos--> **Hide colourful previews**, galerinin önizleme görsellerini simge ve metin kartlarıyla değiştirir ve proje küçük resimlerini, tanınabilir kalacak şekilde sadeleştirir.
- <!--i:sliders--> **High contrast**, uygulamanın kenarlıklarını, metnini ve odak halkalarını belirginleştirir. Marka renklerin ve tuval, ayarladığın gibi kalır.
- <!--i:font--> **Large text**, uygulamanın etiketlerini, menülerini ve düğme metinlerini büyütür.

**Dominant hand** (Right veya Left), Lolly katlanabilir bir cihazda ya da kareye yakın bir tablette iki bölme gösterdiğinde denetimlerin hangi tarafta olacağını belirler. Bölme başlığındaki **Swap sides** da bunu değiştirir.

Bu ayarlar profilinde tutulur, bu yüzden profil dışa aktarmasında adın ve oturumlarınla birlikte taşınır. Yalnızca cihaza ait bir kopya, bunları ilk çizimden önce uygular.

Aynı kartta, galeriye varma, Content Credentials sonucu veya panel kapatma gibi eylemler için yumuşak yardımcı sesler sunan **Sound** bulunur. Ayrıca sakin bir odaklanma müziği olan **Neurospicy Mode** vardır. Neurospicy'yi açmak, köşede uygulama boyunca seninle kalan küçük bir oynatıcı açar. Oynatıcıda parça seçebilir, parça atlayabilir, ses düzeyini ayarlayabilir ve oynatıcıyı küçültebilir veya kapatabilirsin. Parçalar arasında Lolly'nin müzik üreten istasyonları, ambiyans döngüleri ve ritimler, kendi seslerin ve bağlantı gerektiren internet radyo istasyonları bulunur. İkisi de varsayılan olarak kapalıdır ve ayarları hatırlanır. Sound'u kapatmak odaklanma müziğini de susturur. Profil menüsü ve **This device** aynı anahtarı içerir.

Sound anahtarının altındaki sürgü, seslerin yapısını ayarlar. Yuvarlak **Bouba** şekline doğru sesler yumuşak damlalara, baloncuklara ve biraz basa dönüşür. Sivri uçlu **Kiki** yıldızına doğru kuru tıkırtılara, sürtünmelere ve metalik seslere dönüşür. Ortada Lolly'nin çan sesleri ve notaları kalır. Bir uçtaki seslere katlanmakta zorlanıyorsan diğer uca doğru ilerle. Sürgü Sound kapalıyken de çalışır ve sürgüyü bıraktığında kısa bir örnek çalar.

::: details Müzik üreten istasyonlar
Müzik üreten istasyonlar, örnek sesler veya kayıtlı vokaller kullanmadan müziklerini çalarken besteler. Her ezginin kendi enstrümanları, ritmik akışı ve çalınma sırası vardır.

- **Lolly Sings** bir istasyon ailesidir. Özgün Lolly Sings canlı ve melodiktir: majör tonlar, her ezgide bir ana melodi ve bossa, shuffle ve chiptune renkleri. Sugar ve K-pop'tan Country, Jazz, Metal ve D&B'ye kadar her türün kendi istasyonu da vardır.
- **Lofi istasyonları** (Warm, Late night ve Rainy) sonsuz lo-fi ritimlerdir.

Müzik üreten bir istasyonda sonraki ve önceki, ezgiler arasında geçiş yapar. Her ezgi bir başlangıç değerinden türetilir, bu yüzden nerede paylaşır veya kaydedersen kaydet aynı şekilde çalar (bkz. [Üretilen müzik](/info/generated-music.html)). Oynatma denetimlerinin altında **Mood**, Lofi istasyonları arasında geçiş yapar, **Drums** davul setini çıkarır ve **Texture** temiz sesten tozlu bir plak sesine uzanır. Ardından bir sıra simge düğmesi gelir. Adını görmek için bir düğmenin üzerine gel veya basılı tut:

- Müzik notası, **Open in the music generator**, ezgiyi `#/music` adresinde açar; burada enstrümanlarını bölüm bölüm değiştirebilirsin.
- Bağlantı simgesi, **Share this tune or moment**, aynı ezgiyi çalan bir bağlantı veya ayrıca bulunduğun yerden başlayan ve görselleştiriciyi geçerli önayarın ve renklerinle gösteren bir bağlantı sunar.
- Klasör, **Save to library**, ezgiyi varlıklarında saklar.
- Şimşek, **Light visualiser**, aşağıda açıklanan bir anahtardır.

Kayıtlı bir ezgi, istasyonunun grubu altında ton ve tempoya göre listelenir. Kayıtlı ezgiyi seçmek aynı ezgiyi yeniden çalar; herhangi bir parça gibi tekrar eder veya ileri modunda sonrakine geçer. Yalnızca istasyonu ve ezginin numarasını, birkaç baytı saklar ve müzik çalarken yeniden bestelenir. Varlıklarında kayıtlı bir ezgiyi yeniden adlandırabilir veya silebilir ve bir videonun arka plan müziği olarak kullanabilirsin. Lolly Demo ve Lolly Start, altışar kayıtlı ezgiyle gelir.

Görselleştirici her parçayı sabit bir düzeyde duyar, bu yüzden sessiz bir parça her ses düzeyinde yüksek sesli bir parça kadar görüntüyü hareket ettirir. Her Lolly Sings türü ve o türden kaydedilmiş bir ezgi **Light visualiser** sunar: müziğe ihtiyaç duyduğu işlem süresini bırakan basit seviye çubukları. Light visualiser, dokunmatik ekranlarda ve dört veya daha az çekirdeği ya da 4 GB veya daha az belleği olan cihazlarda açık başlar.
:::

Arayüzü klavyeyle kullanabilirsin. Özel denetimler ekran okuyucular için etiketler taşır. Her aracın canlı önizlemesi, gösterdiğini açıklayan etikete sahip tek bir görseldir.

### Depolama

Depolama göstergesi, bu kurulumun tuttuğu her baytı kategoriye göre tarayıcının bildirdiği değerle karşılaştırarak gösterir.

![Kayıtlı oturumları, görselleri ve önbelleği tarayıcının gerçekte bildirdiği değerle karşılaştırarak ayrıştıran depolama göstergesi](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

Göstergenin altında:

- **Move to another device**, **Export my data**, **Import data…** ve **Export my data & render everything** içerir. [İşini başka bir cihaza taşı](/info/find-your-work.html#move-your-work-to-another-device) bunları adım adım anlatır.
- **Clear cache**, indirilen katalog dosyalarını kaldırır; gerektiğinde yeniden indirilirler.
- **Remove automatic checkpoints older than 30 days**, History alanını boşaltır ve kaydedilmiş ve adlandırılmış sürümleri korur.
- **Clear all my data**, onaylamak için bir sözcük yazdıktan sonra Lolly'nin bu tarayıcıda tuttuğu her şeyi kaldırır. [Tarayıcı verilerini temizlersen](/info/find-your-work.html#if-you-clear-your-browser-data) nelerin silineceğini listeler.

### Çevrimdışı kullanılabilir

Lolly yalnızca ziyaret ettiğin ekranları önbelleğe alır. **Available offline**, ihtiyaç duyacağın bölümleri tek bir ilerleme çubuğuyla indirir ve bunlar bağlantı olmadan çalışmaya devam eder.

- <!--i:monitor--> **App, catalogue and guides** - **The app** (hiç açmadığın ekranlar dahil her görünüm, düzenleyici ve yazı tipi), **Catalogue** (tamamı veya **Choose by tag**) ve **Guides & docs** (ekran görüntüleri dahil bu belgelerin kendi dilindeki sürümü).
- <!--i:cpu--> **AI models** - cihazda çalışan her model, boyutuyla birlikte ayrı bir satırda: konuşma sesleri, büyütme modelleri, arka plan kaldırma, metin tanıma, Lolly Verify derin tarama, dayanıklı kimlik bilgisi, Rewriter modeli, Ask eşleştirme modeli, yapay zekâ metin algılayıcısı ve şarkı sesleri. 50 MB üzerindeki modeller **large download** olarak işaretlenir.
- <!--i:wrench--> **Tools** - her araç ayrı ayrı indirilir veya **Download all** tüm araçları indirir. Bir tik, çevrimdışı kullanıma hazır olduğunu gösterir.

Üstteki **Download everything**, uygulamayı, seçtiğin katalog kapsamını, kılavuzları ve tüm araçları indirir. Modelleri de eklemek için **Include all the AI models** seçeneğini işaretle veya bir modeli kendi satırından indir. Şarkı sesleri yalnızca kendi satırlarından indirilir. Bir kuruluşun politikası yapay zekâ indirmelerini kapatabilir ve satırlar da bunu gösterir.

İptal edersen veya bağlantı kesilirse indirmeler kaldığı yerden devam eder. Yeniden çevrimiçi olduğunda yenilenir ve yalnızca yeni sürümün değiştirdiklerini alırlar. Tarayıcı kalıcı depolama izni vermediyse **Protect downloads** bu izni ister. İzin olmadan tarayıcı, alanı geri almak istediğinde indirmeleri silebilir.

### Lolly örneği

**Lolly instance**, bu kurulumun araçlarını ve kataloğunu nereden aldığını söyler: bir örneğin adresi veya her şey derlemenin içinde geliyorsa *Bundled with this app*.

- **Design-system source**, sağlanan tasarım sisteminin kaynağını gösterir.
- **Instance console**, kurulum sunuyorsa yönetici sayfalarını açar.
- **Change**, masaüstü uygulamasını başka bir örneğe yönlendirir. Tarayıcı, farklı kökenlerden araç ve varlık yükleyemez; bu yüzden web'de bu bölüm bunun yerine **Open a workspace** sunar.
- **Leave**, örneğin tasarım sistemini, araçlarını ve kataloğunu kaldırır. Kendi işin kalır. Bkz. [Lolly'yi kuruluşunda kullan](/info/organisation.html#leaving).
- Bir kuruluşta oturum açtığında **Sign out** bu oturumu, **Sign out everywhere** ise bu cihaz dahil tüm cihazlardaki oturumlarını kapatır.

<!--i:eti-monitor-->
## Bu cihaz

- <!--i:monitor--> **This Machine** - ekran, giriş, grafik, bellek, codec'ler, depolama altyapısı ve daha fazlası, bu oturumdan canlı olarak okunur. Hiçbir şey saklanmaz veya gönderilmez. Geniş ekranda bu panel kendiliğinden açılır ve sekme iki sütun kullanır.
- <!--i:neurobeat--> **Sound** - arayüz sesleri ve Neurospicy odaklanma döngüleri. Sound, bu sekmede veri yazan tek anahtardır.
- <!--i:database--> **Storage** - göstergenin salt okunur görünümü. Verilerini [Tercihler](#storage) içinde temizle veya taşı.

<!--i:eti-palette-->
## Tasarım sistemi

Etkin tasarım sistemi, incelemen için sunulur. Bu tarayıcıda iki veya daha fazla tasarım sistemi varsa üstteki kapak şeridi bunları listeler. Etkinleştirmek için birini seç. Ardından gelen bildirimdeki **Undo**, önceki sistemi geri getirir.

![Lolly Demo'daki Design system sekmesi: sistemler arasında geçiş için bir kapak şeridi, ardından logosu, adı, notu ve her sayfayı açan sayımlarıyla kapak](/t/url-shot?url=%2F%23%2Fsettings%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=2400&format=svg&walker=1&dark=1&filename=settings-design-system)

Sekme, sistemin kendi renkleriyle boyanmış bir kapakla açılır; kapakta logosu, gösterim yazı tipiyle adı ve yazarının yazdığı not vardır. Kapaktaki sayım satırı her sayfaya bağlantı verir:

- <!--i:palette--> **Colour** - açık ve koyu görünümlerin yüzey, metin, birincil ve ikincil renkleri, adı ve hex değeriyle bir çip olarak adlandırılmış her renk, her ton dizisi ve grafik spektrumu için bir şerit ve katlanan bir bölümde renk rolleri. Hex değerini kopyalamak için bir değer seç.
- <!--i:font--> **Type** - Headings, Text, Emphasis ve Code, her biri kendi yazı tipiyle dizilir.
- <!--i:photos--> **Logos** - her logo dosyası, tasarlandığı zemin üzerinde.
- <!--i:layers--> **Colourways** - sistemde birden fazla colourway varsa her birinin açık ve koyu çifti.
- <!--i:sliders--> **Tokens** - yarıçap, aralık, efektler ve gradyanlar.
- <!--i:document--> **Print & CMYK** - belirli bir mürekkebe sabitlenmiş renkler ve bir CMYK PDF'in bildirebileceği baskı koşulları.

Bu sekmenin yaptığı tek değişiklik sistemler arasında geçiştir. Bir tasarım sistemini, kapağın bağlantı verdiği `#/start` adresindeki [Lolly Design System Setup](/info/brand-studio.html) içinde düzenle. Salt okunur bir sistem bunu kapağında belirtir. Oluşturduğun yerel sistemler düzenlenebilir kalır. `/b` ve `/brand`, bu sekmenin kısa bağlantılarıdır.

<!--i:eti-grid-->
## Yetenekler

Platformun her bölümünün on iki gruptan birinde bir kartı vardır: Deneyimler, Platformlar & çalışma ortamları, Erişilebilirlik & diller, Dışa aktarma biçimleri, İçe aktarma biçimleri, Baskı üretimi, Otomasyon & yapay zekâ, Belirlenimlilik & yeniden üretilebilirlik, Marka & tasarım sistemi, Gizlilik & veri sahipliği, Güvenlik & erişim denetimi ve Mimari (geliştiriciler için). Her grup katlanır ve kart sayısını gösterir. Bir kart, o yeteneğin özelliklerini ve kartların yaklaşık yarısında bu belgelerde kullanılan ekran görüntüsünü içeren bir iletişim kutusu açar.

Grupların üstündeki arama alanı, sen yazdıkça kartları filtreler ve eşleşme içeren grupları açar. Alan, kaç yetenek içinde arama yaptığını gösterir. Hiçbir eşleşme bulamayan bir sorgu, bunu yazıyla belirtir.

Bu sekme, bu kılavuzlarla aynı doğrultuda Lolly'nin yapabildiklerini belgeler. Kullandığın makineyi incelemez; bunu **This device** yapar.

<!--i:eti-gauge-->
## Etkinlik & istatistikler

Önce derleme: yüklenen araçların, dışa aktarma biçimlerinin, platformun çalıştığı ortamların ve katalogdaki marka varlıklarının sayısı. Bir **Catalogue** paneli, bu derlemede gelenleri ayrıntılarıyla gösterir.

Sonra kendi işin: **Your activity**, bu cihazda yaptıklarını sayar. **Recent creations** ve **Latest exports**, içerik olduğunda görünen ve kaydırarak gezebileceğin yığınlardır. İkisi de bir öğeyi olduğu haliyle açar. Bu sayaçlar cihazda kalır. İsteğe bağlı bir Lolly Work örneği kendi [kuruluş telemetrisini ve denetim kayıtlarını](/info/privacy.html#organisation-services-with-lolly-work) tutar.

<!--i:eti-link-->
## Derin bağlantılar

Settings içindeki her sekmenin ve bölümün, yer imlerine ekleyebileceğin veya yapıştırabileceğin kendi bağlantısı vardır. [Lolly Search](/info/search.html), **Settings** sonuçlarını Settings ile aynı kayıt listesinden oluşturur; böylece bir bölümün adının değişmesi arama sonucunu asla bozmaz.

::: details Tüm bağlantı biçimleri

- **Bir sekme:** `#/settings?tab=brand`, `#/settings?tab=caps`, `#/settings?tab=device`, `#/settings?tab=activity`.
- **Bir Preferences bölümü:** `#/settings?focus=<section-id>`, örneğin `#/settings?focus=offline-section`.
- **Tam olarak bir bölüm:** tek başına bir bayrak olarak kimliği, örneğin `#/settings?dash-storage`, `#/settings?dash-logos`, `#/settings?dash-colourways` veya `#/settings?cap-formats`. Eski `#/settings?dash-lock` ve `#/settings?dash-palette-wheel` bağlantıları, kapağı ve Colour sayfasını açar.
- **Anahtar sözcükle bir bölüm:** `#/settings?print`, `#/settings?formats`, `#/settings?palette` (Colour sayfası) veya `#/settings?tokens`. İki bölüm aynı anahtar sözcüğü paylaşabilir: `print`, hem marka sekmesinin baskı referansına hem de Print production grubuna aittir ve sayfa sırasındaki ilk bölüm açılır. Birini seçmek için kimliği kullan.

Bir derin bağlantı, hedefi içeren sekmeye geçer ve hedefin içinde katlı durduğu grupları açar. Ardından üstteki bölümlerin yerleşimi tamamlanınca hedefe kaydırır. Kullanımdan kaldırılmış `#/platform` ve `#/capabilities` adresleri, derin bağlantı bayrakları korunarak Settings içinde açılır.
:::

---

**İlgili:** Bilgilerin ve üretim yaptığın bağlamlar için [Profiller](/info/profile.html). Design system sekmesinin gösterdiklerini düzenlemek için [Lolly Design System Setup](/info/brand-studio.html). Depolama, yedekler ve cihaz değiştirme için [İşini bul ve kurtar](/info/find-your-work.html).
