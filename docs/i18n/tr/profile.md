# Profiller - üretirken kim olduğun

Bir **profil**, Lolly'nin *olarak* oluşturduğu çalışma kimliğidir. Bir aracın, her seferinde yeniden yazmaman için başvurabileceği küçük bir detay kümesidir - adın, iletişim bilgilerin, isteğe bağlı bir vesikalık, birkaç tercih - artı çalışırken biriktirdiğin her şey: kaydedilmiş oturumlar, yüklenen görseller ve yerel etkinlik sayacı.

Bir profildeki her şey, tarayıcının yerel veritabanında **cihazda** yaşar (web PWA'da IndexedDB, Tauri uygulamalarında dosya sistemi). Hesap yoktur ve hiçbir şey yüklenmez. Onu **Profil** altından (galerinin sağ üstünde) yönetirsin; araçlar onu yalnızca *okur* ve yalnızca önceden doldurmak üzere yapıldıkları belirli alanları.

> Bir profil *seninle* (ya da burada oluşturan kim ise onunla) ilgilidir. **Platform**'dan - markanın renkleri, fontları ve genel ayarları - ve **Capabilities**'ten - uygulamanın yapabildiklerinin kataloğu - farklıdır. Sonda [Profile vs Platform vs Capabilities](#profile-vs-platform-vs-capabilities) bölümüne bak.

## Bir profilde neler var

| Bölüm | Ne olduğu |
|---|---|
| **Ad** | Ad ve soyad. |
| **İletişim** | E-posta ve telefon. |
| **Konum** | Şehir ve ülke. |
| **Vesikalık** | Kareye kırpılmış ve yerel bir görsel olarak tutulan isteğe bağlı bir fotoğraf. E-posta imzaları, alıntı kartları, organizasyon şemaları ve dinamik düzenler gibi araçlar tarafından kullanılır. |
| **Use my details to create** (Bilgilerimi oluşturmak için kullan) | Tek bir opt-in anahtarı (açıldığında **Using my details** yazar). Kişisel bilgilerinin dışa aktarılan dosyalara gömülü **köken** - yazar/kredi satırı - olarak ve **/pro** toplu çalıştırmalarında yazar olarak eşlik edip etmeyeceğini kontrol eder. (Ön doldurmayı kapılamaz: bkz. [How tools use your profile](#how-tools-use-your-profile).) |
| **Tercihler** | Temanız (Light, Dark veya Brand - marka teması uygulamayı kendi paletinle boyar) ve **Feature flags** aracılığıyla uygulamanın hangi bölümlerini etkinleştirdiğin. |
| **Erişilebilirlik** | Profil kaydında tutulan dört konfor anahtarı - *Reduce motion*, *Hide colourful previews*, *High contrast*, *Large text* - böylece bir profil dışa aktarımında da eşlik ederler. Bkz. [Erişilebilirlik](#accessibility). |
| **Çalışman** | **[Projects](/info/using.html)** içinde iç içe klasörlere düzenlenmiş kaydedilmiş oturumlar (küçük resimlerle) - **My images** kütüphanen (Görsellerim) ve bu profile bağlı yerel etkinlik istatistikleri. |

![Three theme cards, each previewing its own type and colour, with the active one flagged](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

![Profile ekranı - ad, iletişim, isteğe bağlı bir vesikalık ve tercihlerin](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&walker=1&localize=1&dark=1&filename=profile-details)

| Bölüm | Nedir |
|---|---|
| **Ad** | Ad ve soyad. |
| **İletişim** | E-posta ve telefon. |
| **Konum** | Şehir ve ülke. |
| **Vesikalık fotoğraf** | İsteğe bağlı bir fotoğraf, kareye kırpılır ve yerel bir görsel olarak tutulur. E-posta imzaları, alıntı kartları, renk blokları ve dinamik düzenler gibi araçlar tarafından kullanılır. |
| **Bilgilerimi kullan** | Tek bir isteğe bağlı anahtar. Kişisel bilgilerinin dışa aktarılan dosyalara gömülen yazar/künye satırı olan **köken** olarak ve **/pro** toplu çalıştırmalarında yazar olarak eşlik edip etmeyeceğini denetler. (Önceden doldurmayı kapatmaz: bkz. [Araçlar profilini nasıl kullanır](#araclar-profilini-nasil-kullanir).) |
| **Tercihler** | Temandır (açık, koyu veya SUSE) ve uygulamanın **Özellik bayrakları** ile hangi bölümlerini etkinleştirdiğin. |
| **Çalışmaların** | Kayıtlı oturumlar (küçük resimlerle) - **[Projeler](/info/using.html)** içinde iç içe klasörlere düzenlenmiş - **Görsellerim** kitaplığın ve yerel etkinlik istatistikleri, hepsi bu profile bağlı. |

Sayfa uzun olduğundan, yanında kendi **ayarlar şeridini** taşır - Bilgilerin, Görünüm, Erişilebilirlik, Lolly örneği, Etkinliğin, Depolama, Çevrimdışı kullanılabilir, Özellik bayrakları, Content Credentials - üstünde de yazdıkça listeyi filtreleyen bir **Ayarlarda ara** alanı bulunur. Her bölüm `#/profile?focus=<section-id>` şeklinde derin bağlantı verilebilir durumdadır, bu da bölümü açar ve görünüme kaydırır (`#/profile?focus=storage-section`, `?focus=feature-flags-section` vb.), böylece bir bağlantı sayfanın en üstüne değil tek bir ayara işaret edebilir.

![Her biri kendi tipografisini ve rengini önizleyen üç tema kartı, etkin olan işaretlenmiş](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

## Bir profil, yalnızca bir kişi değil, bir bağlamdır

"Profil" kelimesi tek, sabit bir kişiyi çağrıştırır ama Lolly'de aslında bir **üretim bağlamıdır** - *bu şeyi yaparken kim olduğun*. O bağlam üç farklı biçimde olabilir ve Lolly hepsini aynı şekilde ele alır.

### Bir birey olarak

![The headshot control, empty until you upload a photo that then stays on this device](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-side&walker=1&dark=1&filename=pd-profile-headshot)

![Bir fotoğraf yükleyene kadar boş kalan, yüklendikten sonra bu cihazda kalan vesikalık kontrolü](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-side&walker=1&dark=1&filename=pd-profile-headshot)

### Bir ekip olarak

Bir profilin tek bir insan olması gerekmez. Bir kuruluş içindeki **bir ekip veya işlevin** yerine geçebilir: ekibin ortak adı, bir grup gelen kutusu adresi (`events@…`), bir departman, ekibin vesikalığı veya birim işareti. Bir kişi bunu kurar, dışa aktarır (aşağıya bak) ve ekibin geri kalanı aynı profili yükler - böylece ekibin ürettiği her şey, kimse yeniden girmeden tutarlı detaylar taşır. Paylaşılan bir kiosk veya ödünç verilen bir demo dizüstü bilgisayar, arkasındaki herkesin olarak oluşturduğu tek bir ekip profili çalıştırabilir.

### Bir işlev olarak - bazen giydiğin bir rol

Katı "tek kişi, tek profil" modelinin kaçırdığı durum budur. **Yılda üç gün etkinlik yöneticisi** ve zamanın geri kalanında tamamen başka bir şey olabilirsin. O üç gün etkinlik ayrıntılarını, etkinlik gelen kutusunu, belki rozetlerini ve tabelalarını dolduracak bir etkinlik alt markası istersin; diğer 362 gün normal kimliğini geri istersin.

Lolly'de o rol yalnızca **el altında tuttuğun bir başka profildir** - etkinlik için yükleyip sonrasında bir kenara koyduğun kayıtlı bir paket (sonraki bölüm). Rol bir şapkadır, yeni bir hesap değil. İhtiyacın olduğunda giy, işin bittiğinde çıkar.

## Tek kurulum, tek etkin profil - el altında tutabileceğin birçok profil

Herhangi bir anda bir kurulumun **tek bir etkin profili** vardır - bir aracın şu anda gördüğü detaylar. Uygulama içinde bir profil değiştirici yoktur; bunun yerine her profil **taşınabilir bir paket**tir (tek bir `.zip`, bkz. [aşağı](#moving-a-profile-to-a-new-device)). Bu, kasıtlı olarak yeni bir cihaza taşınmakla aynı mekanizmadır - bir profil, kaydedebileceğin, kopyalayabileceğin ve yükleyebileceğin bir dosyadır.

![The storage meter, breaking down saved sessions, images and cache against what the browser actually reports](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%2C.storage-subsection%2C.storage-actions%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

- <!--i:trash--> **En temiz geçiş:** **Profile → Storage → Clear all my data** (Profil → Depolama → Tüm verilerimi temizle), ardından geçtiğin bağlam için paketi **Import** (İçe aktar) et. Artık yalnızca o profil olarak oluşturuyorsun.
- <!--i:layers--> **Katmanlama:** önce temizlemeden içe aktarmak **birleştirir** - içe aktarılan profil, oturumlar ve görseller zaten orada olanın üstüne iner, aynı isimdeki her şeyin yerini alır ve geri kalanını bırakır. Bir ekibin kaydedilmiş oturumlarını kendi kurulumuna çekmek için kullanışlıdır; net bir rol sınırına ihtiyacın varsa istediğin şey bu değildir.
- <!--i:monitor--> **Yan yana:** her şey cihaza özgü olduğundan, ayrı bir tarayıcı profili, ayrı bir kullanıcı hesabı veya ikinci bir kurulu PWA, her biri kendi bağımsız Lolly profilini taşır. Kişisel kurulumunu ve etkinlik kiosku kurulumunu aynı anda, geçiş yapmadan çalıştır.

Yani gerçekten birkaç bağlamı bir arada yürütüyorsan (sen, ekibin, etkinlik yöneticisi şapkası) birkaç paket tutar ve ihtiyaç duyduğunu yüklersin:

![Kaydedilmiş oturumları, görselleri ve önbelleği tarayıcının gerçekte bildirdiğine karşı ayrıştıran depolama göstergesi](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%2C.storage-subsection%2C.storage-actions%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

> Bağlam başına bir paket tut ve dosyaları ne olduklarına göre yeniden adlandır (`LollyTools-events-2026.zip`, `LollyTools-me.zip`). Dosya, profilin *ta kendisidir*.

## Erişilebilirlik

**Profile → Accessibility** (Profil → Erişilebilirlik), çalışman *etrafındaki* uygulama için dört konfor ayarı barındırır. Her biri sen açana kadar kapalıdır ve hiçbiri bir araç tuvalinin veya dışa aktarımın içine ulaşmaz - daha sakin bir uygulama, gönderdiğin dosyanın bir pikselini bile oynatmamalıdır.

- <!--i:film--> **Reduce motion** (Hareketi azalt) - uygulamadaki geçişleri, kaymaları ve animasyonlu süslemeleri kapatır. Araç tuvalin ve herhangi bir animasyonlu dışa aktarım tam olarak tasarlandığı gibi hareket etmeye devam eder.
- <!--i:image--> **Hide colourful previews** (Renkli önizlemeleri gizle) - galeri önizleme görsellerini sakin simge-ve-metin kartlarıyla değiştirir ve proje küçük resimlerinin rengini ve kontrastını düşürerek göz yormadan tanınabilir kalmalarını sağlar. Bir aracın içinde her şey tam renkli görünür.
- <!--i:sliders--> **High contrast** (Yüksek kontrast) - uygulamanın kenarlıklarını, metnini ve odak halkalarını güçlendirir. Marka renklerin ve tuval üzerindeki her şey tam olarak ayarladığın gibi kalır.
- <!--i:font--> **Large text** (Büyük metin) - uygulama tipografisini büyütür: etiketler, menüler ve buton metni. Kontroller boyutlarını korur, bu yüzden yalnızca içlerindeki kelimeler büyür, ve tasarımların içindeki tipografiye dokunulmaz, bu yüzden dışa aktardığın hiçbir şey yeniden akmaz.

Bunlar profil kaydının kendisinde tutulur, bu yüzden bir profil dışa aktarımında yol alır ve bir sonraki kurulumda adınla ve oturumlarınla birlikte iner. (Cihaz ayrıca, ayarın ilk boyamadan önce uygulanması için küçük bir yerel yansı da tutar; bu yansı yalnızca cihaza özgüdür ve yol almaz.)

## Lolly örneğin

**Profile → Lolly instance** (Profil → Lolly örneği), bu kurulumun araçlarını ve kataloğunu nereden aldığını söyler - örneğin adresi, ya da her şey derlemenin içinde gönderiliyorsa *Bundled with this app* (Bu uygulamayla birlikte gelir). Bir dağıtım bunu sunuyorsa, bir **Instance console** (Örnek konsolu) bağlantısı yönetim yüzeyini açar ve **Change** (Değiştir) / **Disconnect** (Bağlantıyı kes) kurulumu yeniden yönlendirir veya ondan koparır.

Başka bir örneğe yeniden yönlendirmek **masaüstü uygulamasını** gerektirir: bir tarayıcı, bir sayfanın araçları ve varlıkları farklı kaynaklardan yüklemesini engeller, bu yüzden web'de bu bölüm sadece nerede olduğunu bildirir ve orada bırakır.

## Çevrimdışı kullanılabilir

Lolly ilerledikçe önbelleğe alır, ama ilerledikçe önbelleğe alma yalnızca zaten gittiğin yerleri kapsar. **Profile → Available offline** (Profil → Çevrimdışı kullanılabilir), önceden görebildiğin yolculuk içindir: bağlantısı olmayan bir uçuştan önce havaalanı wifi'sinde geçen bir saat gibi. İhtiyacın olacak parçaları indir, tek bir ilerleme çubuğunu izle ve aldığın her şey bağlantı gittikten sonra da çalışmaya devam etsin.

Yedi parça, her biri taahhüt etmeden önce boyutu belirtilmiş halde:

- <!--i:layout--> **Uygulama** - henüz açmadıkların dahil, her görünüm, düzenleyici ve font. Bu olmadan, çevrimiçiyken hiç ziyaret etmediğin bir ekran çevrimdışı yüklenemez.
- <!--i:image--> **Katalog** - temel öğelerin ötesindeki marka varlıkları. Hepsini al, ya da *Choose by tag* (Etikete göre seç) aç ve yalnızca kullandığın etiketleri al.
- <!--i:book--> **Kılavuzlar ve belgeler** - bu belgelendirme sitesi, kendi dilinde, ekran görüntüleri dahil.
- <!--i:cpu--> **Konuşma sesleri** - Script sesinin ve anlatımının arkasındaki ses modelleri. Bir kez indirilir, sonra cihaz üzerinde çalışır.
- <!--i:zap--> **Büyütme modelleri** - yapay zeka görsel büyütücüleri: fotoğraf, illüstrasyon/anime ve yüz.
- <!--i:layers--> **Arka plan kaldırma** - *Remove background* (Arka planı kaldır) aracının arkasındaki cihaz üzerindeki kesme modelleri.
- <!--i:shield--> **Verify deep scan** (Verify derin tarama) - bağlantıdan uzakta Content Credentials kontrolü için cihaz üzerindeki filigran tarayıcısı.

Son dört öğe **büyük indirme** olarak işaretlenmiştir ve bilerek ayrı ayrı katılımlıdır: en üstteki **Download everything**, uygulamayı, seçtiğin katalog kapsamını, belgeleri ve tüm araçları tek seferde alır, başka hiçbir şeyi değil. Konuşma sesleri, üst ölçekleyiciler, arka plan kaldırma ve derin tarama, yalnızca o satırı adıyla istediğinde indirilir - tek bir düğmenin içine birkaç yüz megabaytı gizlemek dürüst olmaz.

Parçaların altında araç başına liste yer alır: her araç ayrı ayrı indirilir (onay işareti çevrimdışı hazır anlamına gelir) veya **Download all** hepsini birden alır. İndirmeler kaldığı yerden devam eder - iptal edersen ya da bağlantıyı kaybedersen bir sonraki çalıştırma kaldığı yerden devam eder ve yalnızca eksik olanı getirir - ve yeniden çevrimiçi olduğunda kendilerini yeniler, yeni bir sürümün değiştirdiği kısmı çeker.

Tarayıcı kalıcı depolama izni vermemişse bölüm bunu belirtir ve bunu isteyen **Protect downloads**'ı sunar - "indirildi" ile "tarayıcı alanı geri isteyene kadar indirildi" arasındaki fark budur.

## Bir profili yeni bir cihaza taşıma

![The two buttons that move a whole install: Export my data writes one zip, Import data reads it back](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.storage-subsection&dark=1&filename=pd-transfer-controls)

Bir profil tamamen yerel olduğundan, onu boş bir kuruluma - yeni bir dizüstü, yeni sıfırlanmış bir tarayıcı, bir meslektaşın makinesi, çevrimdışı bir kutu - almanın tek yolu **dosyayı taşımaktır**. Hiçbir oturum açma onu senin için geri yüklemez ve mesele de budur: başından beri hiçbir şey cihazından çıkmadı.

- <!--i:download--> **Export my data**, ait olduğu profilin adıyla adlandırılmış tek bir `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` dosyası indirir - tekrarlanan dışa aktarımların çakışmaması için günlük bir sıra numarasıyla (profilde olmayan ad parçaları atlanır). İçinde profilin, kaydedilen her oturum (küçük resmiyle birlikte), yüklediğin görseller - marka belirteçlerin ve yüklü yazı tiplerin kullanıcı varlığı olarak buna dahildir - ve tercihlerin (tema, düzen, yerel etkinlik istatistikleri) bulunur.
- <!--i:upload--> Diğer kurulumdaki **Import data…**, o dosyayı geri okur ve tam olarak kaldığın yerden devam edersin.
- <!--i:box--> **Export my data & render everything**, aynı yedeği, kaydedilen her oturumu tamamlanmış çıktı dosyasına dönüştüren ve Projelerini yansıtan klasörlere yerleştiren ikinci bir zip dosyasıyla *birlikte* yazar. Hem kaynakların hem sonuçların eksiksiz bir çevrimdışı arşivi - çok sayıda oturumda büyük ve yavaş olabilir.

![Bütün bir kurulumu taşıyan iki düğme: Export my data tek bir zip yazar, Import data onu geri okur](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.storage-subsection&dark=1&filename=pd-transfer-controls)

Paket düz, kendi kendine yeten bir zip'tir; bu yüzden **her** yolla seyahat eder - USB, AirDrop, bir ağ paylaşımı, kendine e-posta - ve hedef tamamen çevrimdışı olabilir. Her parça sağlama toplamına tabidir; böylece aktarım sırasında hasar gören bir dosya, yarı bozuk geri yüklenmek yerine içe aktarmada yakalanır. İçe aktarma **birleştirir** (aynı adlı profil/oturum/görsel üzerine yazılır; gerisi korunur); bu yüzden zaten kullanımda olan bir hedefi asla silmez.

Taşınmayan şeyler: katalog önbelleği (yeni cihazda kendini yeniden indirir) ve araçların kendisi (zaten mevcut varsayılır). 

Tam paket düzeni, sürüm ilkesi ve bütünlük kuralları için bkz. **[Data Transfer](/info/data-transfer.html)**; uçtan uca anlatım için **[Using Lolly → Moving to another device](/info/using.html#moving-to-another-device)**.

## Araçlar profilini nasıl kullanır

![The single Use my details switch, sitting beside Save Profile and off until you turn it on](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-check&walker=1&dark=1&filename=pd-use-my-details)

Bir araç yalnızca bağlamak üzere açıkça yapıldığı profil alanlarını *önceden doldurur*:

**Onay kutusu (köken bilgisi).** Bir varlığı dışa aktardığında bilgilerin isteğe bağlı olarak **köken bilgisi (provenance)** olarak eşlik eder - dosyanın meta verisine gömülü bir yazar/kaynak satırı (PNG, PDF, SVG, …) - böylece bitmiş bir varlık kimin yaptığını söyleyebilir. **Use my details to create**'in yönettiği şey *tam olarak budur*: kapalı bırakırsan dışa aktarım yine de "Made with Lolly" araç/platform atfını taşır, ancak kişisel yazar/iletişim satırı gömülmez. (Aynı onay, **/pro** toplu çalıştırmalarında da yazarı ayarlar.) (Araç yazarları için bkz. [Authoring Tools → `bindToProfile`](/info/authoring-tools.html#bindtoprofile) ve [Host API → `host.profile`](/info/host-api.html#host-profile).)

![Save Profile'ın yanında duran ve sen açana kadar kapalı olan tek bir Use my details to create anahtarı](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-check&walker=1&dark=1&filename=pd-use-my-details)

## Profil, Platform ve Yetenekler

Arayüzde birbirine yakın duran ve karıştırılması kolay üç şey:

- <!--i:people--> **Profile** - *sen* (ya da ekibin ya da içinde bulunduğun rol): ad, iletişim bilgisi, profil fotoğrafı, kaydettiğin işler. Kişisel, cihazda yerel, bir paket olarak taşınabilir.
- <!--i:palette--> **Platform** - *marka*: her aracın üzerine render edildiği renkler, yazı tipleri ve genel ayarlar. Paylaşılan ve tutarlı, kişisel değil.
- <!--i:sliders--> **Capabilities** - *uygulamanın yapabildikleri*: tam özellik seti ve sana açık araçlar.

Bir profil, bir varlığın *kimden* geldiğini değiştirir; platform onun neye *benzediğini* değiştirir; yetenekler *neler yapabileceğindir*.

### "Profil" başka yerlerde iki şey daha anlamına gelir - bu değil

Kelime, proje genelinde birden çok anlam taşır. Bunların hiçbiri, bu sayfanın konusu olan kişisel profil değildir:

- <!--i:box--> **Content profile** - `profiles.json` içinde, bir dizi araç paketini bir marka kataloğuna bağlayan derleme zamanı yapılandırması (örn. `suse`, `lolly-start`). Bir operatörün dağıtım yaparken seçtiği şeydir; ayrıca `profile` **URL/CLI parametresi** de dışa aktarım sırasında bir *renk* varyantı seçmek için aynı adı kullanır (ICC/CMYK baskı koşulu - bkz. [URL Mode](/info/url-mode.html)). İkisi de *derleme/çıktı* ile ilgilidir, *seninle* değil. Bkz. [Configuration](/info/configuration.html).
- <!--i:seal--> **Identity profile** - kaydolabileceğin isteğe bağlı **doğrulanmış Content Credentials kimliği** (e-postanı imzalı dışa aktarımlarına bağlayan kısa ömürlü bir sertifika). Bu, kişisel profilin ad/iletişim alanlarından ayrı bir imzalama kimliğidir, ancak ikisinin de gömülüp gömülmeyeceğini **Use my details to create** belirler. Bkz. [Content Credentials Identity](/info/content-credentials-identity.html).

![Telefon genişliğinde Verified identity kartı: sertifika ömrü seçici ve altındaki kayıt adımı - kişisel bilgilerinden ayrı olan kimlik profili](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

## Gizlilik

Yukarıdaki isteğe bağlı kimlik kaydı dışında (bu, kaydolduğun e-postayı sertifika hizmetine gönderir - bkz. [Server Surface](/info/server-surface.html)), bir profil asla iletilmez, yüklenmez veya seni tanımlamak ya da izlemek için kullanılmaz - onaylanacak bir şey yok, yalnızca neyin saklandığını bilmen için bu bildirim var. İstediğin zaman **Profile → Clear all my data** ile tümünü sil. Bkz. [Privacy Policy](/info/privacy.html).
