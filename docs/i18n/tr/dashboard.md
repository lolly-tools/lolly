# Settings

Settings, Lolly'nin senin için nasıl çalışacağını değiştirdiğin yerdir: ayrıntıların, kullandığın tasarım sistemi, erişilebilirlik, bu cihazda nelerin saklandığı ve nelerin çevrimdışı hazır olduğu. Ana ekranın altındaki çubukta **Settings** ile ya da avatar menüsünden aç. **Preferences** sekmesinde açılır; yanında dört sekme daha vardır.

| Sekme | Adres | Neyi tutar |
|---|---|---|
| **Preferences** | `#/settings` | Ayrıntıların, tasarım sistemleri, görünüm, emoji, erişilebilirlik, bağlantılar, depolama ve çevrimdışı indirmeler |
| **This device** | `#/settings?tab=device` | Bu tarayıcı ve makinenin canlı bir okuması, ayrıca ses ve salt okunur bir depolama görünümü |
| **Design system** | `#/settings?tab=brand` | Bir kapak ve sayfalar olarak etkin tasarım sistemi; sistemleri değiştirmek için bir kapak şeridiyle |
| **Capabilities** | `#/settings?tab=caps` | Lolly'nin yapabildiği her şey, aranabilir kartlar olarak |
| **Activity & stats** | `#/settings?tab=activity` | Katalog, yerel sayaçların ve son işler |

Her sekmenin kendi adresi vardır ve eski `#/profile` ve `#/d` bağlantıları, tek tek ayarlara kadar doğru yeri açmaya devam eder.

## Preferences

Preferences, yanda bir **ayarlar rayı** ve rayın üstünde yazdıkça onu filtreleyen bir **Search settings** alanı olan uzun bir sayfadır. Her bölüm doğrudan `#/settings?focus=<section-id>` biçimindeki bir bağlantıdan açılır; örneğin `#/settings?focus=storage-section`.

- <!--i:usercheck--> **Your details** - adın, iletişim bilgilerin ve profil fotoğrafın ile **Use my details to create** anahtarı. Araçların bunları nasıl kullandığını [Profiles](/info/profile.html) açıklar.
- <!--i:seal--> **Content Credentials** - dışa aktarmalarını imzalayan isteğe bağlı doğrulanmış kimlik. Bkz. [Content Credentials](/info/content-credentials-identity.html).
- <!--i:palette--> **Design systems** - tasarım sistemlerini değiştir, ekle, gizle veya kaldır. Her eylemi [Design System Setup](/info/brand-studio.html#manage-your-design-systems) kapsar.
- <!--i:moon--> **Appearance** - tema (Light, Dark veya uygulamayı paletinle boyayan Brand) ve **Interface follows the design system**.
- <!--i:sparkle--> **Emoji** - yeni bir şey başlattığında emojilerinin çizildiği set, sanat çalışması lisansı ve paletinin onları ne kadar güçlü yeniden renklendirdiği (**Off**, **Subtle**, **Strong**, **Full**, **Mono** veya **Duotone**). **Keep skin tones and flags** onları kendi renklerinde bırakır. Zaten yaptığın iş, yapıldığı seti korur.
- <!--i:eyeoff--> **Accessibility** - dört rahatlık anahtarı, ayrıca Sound ve Neurospicy Mode. Bkz. [Accessibility](#accessibility).
- <!--i:link--> **Connected services** - bağladığın depolama; örneğin Dropbox, Google Drive, OneDrive, Nextcloud veya S3 ve **Sync across devices**. Bkz. [Sync your devices](/info/sync.html).
- <!--i:globe--> **Trusted sites** - bir Design web sayfası kutusunun veya bir Sandbox demosunun sormadan iletişim kurabileceği siteler ve sunucu sunuyorsa **Allow pages from any site**. Her isteğin neyi gönderdiğini [Privacy Policy](/info/privacy.html) listeler.
- <!--i:download--> **Your renders** - **Save my renders to my library**, indirdiğin her görselin, ses klibinin ve videonun bir kopyasını Assets içinde Renders etiketi altında tutar.
- <!--i:database--> **Storage** - Lolly'nin bu cihazda neleri tuttuğu ve verilerini temizleyen veya taşıyan düğmeler. Bkz. [Storage](#storage).
- <!--i:cpu--> **Available offline** - bağlantıyı kaybetmeden önce ihtiyacın olanı indir. Bkz. [Available offline](#available-offline).
- <!--i:folder--> **Hot folder** - masaüstü uygulamasında bir klasörü izle ve içine bırakılan her şeyi, sürükle-bırakın kullandığı aynı seçici üzerinden Lolly'ye çek.
- <!--i:clock--> **Your activity** - bu cihazda yaptıkların, yerel olarak sayılır.
- <!--i:sliders--> **Feature flags** - **Print preflight** veya **Strip metadata from uploads** gibi uygulamanın bölümlerini aç ya da kapat.
- <!--i:server--> **Lolly instance** - bu kurulumun araçlarını ve kataloğunu nereden aldığı. Bkz. [Lolly instance](#lolly-instance).

Tema kartları canlı önizlemelerdir ve birini seçtiğin anda yalnızca bu cihazda uygulanır.

![Her biri kendi tipografisini ve rengini önizleyen üç tema kartı, etkin olan işaretlenmiş](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dappearance-section&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

### Accessibility

**Settings → Preferences → Accessibility**, çalışmanın etrafındaki uygulama için dört rahatlık ayarı tutar. Her biri sen açana kadar kapalıdır ve hiçbiri bir araç tuvalinin veya bir dışa aktarmanın içine ulaşmaz; bu yüzden daha sakin bir uygulama, gönderdiğin dosyanın tek pikselini oynatmaz.

- <!--i:pause--> **Reduce motion** uygulamanın geçişlerini, kaymalarını ve süslemelerini kapatır. Tuvalin ve animasyonlu her dışa aktarma tasarlandığı gibi hareket etmeye devam eder.
- <!--i:photos--> **Hide colourful previews** galerinin önizleme çalışmalarını sakin simge ve metin kartlarıyla değiştirir ve proje küçük resimlerini bağırmadan tanınır kalacak şekilde yumuşatır.
- <!--i:sliders--> **High contrast** uygulamanın kenarlıklarını, metnini ve odak halkalarını güçlendirir. Marka renklerin ve tuval ayarladığın gibi kalır.
- <!--i:font--> **Large text** uygulamanın etiketlerini, menülerini ve düğme metnini büyütür. Tasarımlarının içindeki yazıya dokunulmaz; bu yüzden dışa aktardığın hiçbir şey yeniden akmaz.

Bu ayarlar profilinde yaşar; bu yüzden bir profil dışa aktarmasında taşınır ve bir sonraki kurulumda adın ve oturumlarınla birlikte gelir. Küçük, yalnızca cihazdaki bir kopya bunları ilk boyamadan önce uygular.

Aynı kart, yaptıklarına karşılık yumuşak yardımcı seslerden oluşan bir katman olan **Sound**'u (galeriye varış, bir Content Credentials sonucu, bir paneli kapatma) ve sakin bir odak parçası olan **Neurospicy Mode**'u tutar. Neurospicy'yi açmak, uygulamada seni takip eden köşede küçük bir oynatıcı açar. Orada bir parça seçer, atlar, ses düzeyini ayarlar ve oynatıcıyı küçültür veya kapatırsın. Parçalar arasında prosedürel *Lolly Sings* melodileri, ortam döngüleri ve ritimler, kendi sesin ve bağlantı gerektiren internet radyo istasyonları bulunur. İkisi de varsayılan olarak kapalıdır ve hatırlanır; Sound'u kapatmak odak parçasını da susturur. Profil menüsü ve **This device** aynı anahtarı taşır.

Arayüz klavyeyle gezilebilir, özel denetimler ekran okuyucular için etiket taşır ve her aracın canlı önizlemesi, ne gösterdiğini tanımlayan tek bir etiketli görsel olarak sunulur.

### Storage

Depolama göstergesi, bu kurulumun tuttuğu her baytı kategori kategori, tarayıcının bildirdiğine göre hesaplar.

![Depolama göstergesi; kayıtlı oturumları, görselleri ve önbelleği tarayıcının gerçekten bildirdiğine göre dökümü](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

Göstergenin altında:

- **Move to another device**, **Export my data**, **Import data…** ve **Export my data & render everything** içerir. [Move your work to another device](/info/find-your-work.html#move-your-work-to-another-device) bunları adım adım anlatır.
- **Clear cache** indirilen katalog dosyalarını bırakır; gerektiğinde yeniden iner.
- **Remove automatic checkpoints older than 30 days** History alanını boşaltır ve kayıtlı ile adlandırılmış sürümleri korur.
- **Clear all my data**, onaylamak için bir sözcük yazdıktan sonra Lolly'nin bu tarayıcıda tuttuğu her şeyi kaldırır. [If you clear your browser data](/info/find-your-work.html#if-you-clear-your-browser-data) nelerin gittiğini listeler.

### Available offline

Lolly, ziyaret ettikçe ekranları önbelleğe alır; bu yalnızca zaten gittiğin yerleri kapsar. **Available offline**, geldiğini gördüğün yolculuk içindir: ihtiyacın olan parçaları indir ve tek bir ilerleme çubuğunu izle; aldığın her şey bağlantı olmadan çalışmaya devam eder.

- <!--i:monitor--> **App, catalogue and guides** - **The app** (hiç açmadığın ekranlar dahil her görünüm, düzenleyici ve yazı tipi), **Catalogue** (hepsi ya da **Choose by tag**) ve **Guides & docs** (bu belgeleme, kendi dilinde, ekran görüntüleri dahil).
- <!--i:cpu--> **AI models** - her cihaz üzerindeki model kendi satırında boyutuyla: Speech voices, Upscaling models, Background removal, Text recognition, Verify deep scan, Durable credential, Rewriter model, Ask matching model, AI text detector ve Singing voices. 50 MB üzerindeki bir model **large download** olarak işaretlenir.
- <!--i:wrench--> **Tools** - her araç kendi başına iner ya da **Download all** her aracı alır. Bir tik çevrimdışı hazır demektir.

En üstteki **Download everything** uygulamayı, seçtiğin katalog kapsamını, kılavuzları ve tüm araçları alır. Modelleri eklemek için **Include all the AI models** seçeneğini işaretle ya da bir modeli kendi satırından indir; şarkı sesleri yalnızca kendi satırından indirilir. Bir kuruluşun politikası yapay zekâ indirmelerini kapatabilir ve satırlar bunu söyler.

İptal edersen veya bağlantıyı kaybedersen indirmeler kaldıkları yerden sürer ve yeniden çevrimiçi olduğunda kendilerini yeniler, yalnızca bir sürümün değiştirdiğini getirir. Tarayıcı kalıcı depolama vermediyse **Protect downloads** onu ister: "indirildi" ile "tarayıcı yeri geri isteyene kadar indirildi" arasındaki fark.

### Lolly instance

**Lolly instance**, bu kurulumun araçlarını ve kataloğunu nereden aldığını söyler: bir örneğin adresi ya da her şey derlemenin içinde geldiğinde *Bundled with this app*.

- **Design-system source** sağlanan tasarım sisteminin nereden geldiğini gösterir.
- **Instance console** bir dağıtımın yönetici sayfalarını, sunuyorsa açar.
- **Change** masaüstü uygulamasını başka bir örneğe yönlendirir. Bir tarayıcı kaynaklar arasında araç ve varlık yükleyemez; bu yüzden web'de bölüm bunun yerine **Open a workspace** sunar.
- **Leave** örneğin tasarım sistemini, araçlarını ve kataloğunu kaldırır; kendi işin kalır. Bkz. [Use Lolly at your organisation](/info/organisation.html#leaving).
- Bir kuruluşta oturum açtığında **Sign out** bu oturumu sonlandırır ve **Sign out everywhere** bu cihaz dahil her cihazdaki oturumlarını sonlandırır.

## Bu cihaz

- <!--i:monitor--> **This Machine** - ekran, girdi, grafikler, bellek, codec'ler, depolama arka ucu ve daha fazlası, bu oturumdan canlı okunur. Hiçbir şey saklanmaz ve hiçbir şey gönderilmez. Sekmenin iki sütunda yerleştiği geniş bir ekranda kendiliğinden açılır.
- <!--i:neurobeat--> **Sound** - arayüz sesleri ve Neurospicy odak döngüleri; bu sekmede bir şey yazan tek anahtar.
- <!--i:database--> **Storage** - [Preferences](#storage) içindeki göstergenin salt okunur görünümü; verini temizlediğin veya taşıdığın yer orasıdır.

## Design system

Etkin tasarım sistemi, okunacak biçimde sunulur. Bu tarayıcı iki veya daha fazla tasarım sistemi tuttuğunda en üstteki küçük kapaklardan oluşan bir şerit onları listeler: birini etkin yapmak için seç ve ardından gelen bildirimdeki **Undo** öncekini geri getirir.

![Lolly Demo üzerinde Design system sekmesi: sistemleri değiştirmek için bir kapak şeridi, sonra logosu, adı, notu ve her sayfayı açan sayılarla kapak](/t/url-shot?url=%2F%23%2Fsettings%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=2400&format=svg&walker=1&dark=1&filename=settings-design-system)

Sekme, sistemin kendi renkleriyle boyanmış bir kapakla açılır; logosu, görüntüleme yazı tipindeki adı ve yazarının yazdığı not vardır. Kapaktaki bir sayı satırı her sayfaya bağlanır:

- <!--i:palette--> **Colour** - açık ve koyu görünümlerin yüzeyi, metni, birincil ve ikincil rengi, adı ve hex değeriyle çip olarak her adlandırılmış renk, her ton rampası ve grafik spektrumu için bir bant ve bir katlamada renk rolleri. Hex'i kopyalamak için bir değer seç.
- <!--i:font--> **Type** - her biri kendi yazı tipinde ayarlanmış Headings, Text, Emphasis ve Code.
- <!--i:photos--> **Logos** - her logo dosyası, yapıldığı zeminde.
- <!--i:layers--> **Colourways** - sistemin birden fazlası olduğunda her colourway'in açık ve koyu çifti.
- <!--i:sliders--> **Tokens** - yarıçap, aralık, efektler ve gradyanlar.
- <!--i:document--> **Print & CMYK** - tam bir mürekkebe kilitlenmiş renkler ve bir CMYK PDF'in bildirebileceği baskı koşulları.

Geçiş yapmak bu sekmenin yaptığı tek değişikliktir. Bir tasarım sistemini, kapağın bağlandığı `#/start` adresindeki [Design System Setup](/info/brand-studio.html) içinde düzenlersin. Salt okunur bir sistem bunu kapağında söyler; oluşturduğun yerel sistemler düzenlenebilir kalır. `/b` ve `/brand` doğrudan bu sekmeye kısa bağlantılardır.

## Capabilities

Platformun her parçası, on iki grupta bir kart olarak yazılmıştır: Experiences, Platforms & runtimes, Accessibility & languages, Export formats, Import formats, Print production, Automation & AI, Determinism & reproducibility, Brand & design system, Privacy & data ownership, Security & access control ve Architecture (for builders). Her grup katlanır ve kart sayısını gösterir. Bir kart, o yeteneğin özelliklerinin ve yaklaşık yarısı için bu belgelemenin kullandığı ekran görüntüsünün bulunduğu bir iletişim kutusuna açılır.

Grupların üstündeki arama alanı yazdıkça kartları filtreler ve hâlâ eşleşme tutan grupları açar. Kaç yeteneği aradığını söyler ve eşleşmesi olmayan bir sorgu bunu sözcüklerle söyler.

Bu sekme, Lolly'nin neler yapabildiğinin, bu kılavuzlarla uyumlu tutulan yazılı belgelemesidir. Bulunduğun makineyi yoklamaz; bunu **This device** yapar.

## Activity & stats

Önce derleme: kaç araç yüklü, kaç dışa aktarma biçimi var, platform kaç yüzeyde çalışıyor ve katalog kaç marka varlığı taşıyor; bu derlemede nelerin gönderildiğini döken bir **Catalogue** paneliyle.

Sonra kendi tarafın: **Your activity** bu cihazda yaptıklarını sayar; **Recent creations** ve **Latest exports** göstereceği bir şey olduğunda görünen, kaydırarak geçebileceğin yığınlardır. İkisi de bir öğeyi olduğu gibi açar. Bu sayaçlar cihazda kalır; isteğe bağlı bir Lolly Work örneği kendi [kuruluş telemetrisini ve denetim kayıtlarını](/info/privacy.html#organisation-services-with-lolly-work) tutar.

## Derin bağlantılar

Settings'in her sekmesinin ve bölümünün yer imine ekleyebileceğin veya yapıştırabileceğin kendi bağlantısı vardır. [Search](/info/search.html), **Settings** sonuçlarını Settings'in render edildiği aynı kayıt defterine yönlendirir; böylece bir bölüm, bir arama sonucunun altından yeniden adlandırılamaz.

::: details Bağlantının her biçimi

- **Bir sekme:** `#/settings?tab=brand`, `#/settings?tab=caps`, `#/settings?tab=device`, `#/settings?tab=activity`.
- **Bir Preferences bölümü:** `#/settings?focus=<section-id>`, örneğin `#/settings?focus=offline-section`.
- **Tam olarak bir bölüm:** kimliği çıplak bir bayrak olarak, örneğin `#/settings?dash-storage`, `#/settings?dash-logos`, `#/settings?dash-colourways` veya `#/settings?cap-formats`. Eski `#/settings?dash-lock` ve `#/settings?dash-palette-wheel` bağlantıları kapağı ve Colour sayfasını açar.
- **Anahtar sözcükle bir bölüm:** `#/settings?print`, `#/settings?formats`, `#/settings?palette` (Colour sayfası) veya `#/settings?tokens`. Anahtar sözcükler paylaşılabilir: `print` hem marka sekmesinin baskı başvurusuna hem Print production grubuna aittir ve sayfa sırasında ilki kazanır. Hangisinin önemli olduğunda kimliği kullan.

Derin bir bağlantı hedefin sahibi sekmeye geçer, içinde katlandığı her grubu açar, sonra ona kayar; üstündeki bölümler yerleşmeyi bitirirken kısa bir an sakinleşir. Emekliye ayrılan `#/platform` ve `#/capabilities` adresleri, derin bağlantı bayrakları bozulmadan Settings'e katlanır.
:::

---

**İlgili:** ayrıntıların ve yarattığın bağlamlar için [Profiles](/info/profile.html). Design system sekmesinin gösterdiklerini düzenlemek için [Design System Setup](/info/brand-studio.html). Depolama, yedekler ve cihaz taşıma için [Find and recover your work](/info/find-your-work.html).
