# Gizlilik Politikası

*Son güncelleme: 10 Kasım 2026*

- <!--i:eti-home--> **Lolly'de üretim cihazında gerçekleşir.** Bir aracı açma, yazma, önizleme, dışa aktarma ve bir dosyayı denetleme işlemlerinin tümü telefonundaki, bilgisayarındaki veya tarayıcındaki uygulamada çalışır. Hesaba ihtiyacın yoktur ve uygulama bunların hiçbiri için çerez oluşturmaz.
- <!--i:eti-globe--> **Ürettiklerin yalnızca sen istediğinde cihazından çıkar.** Google Font eklemek, Drive veya Dropbox'a dosya göndermek, Sync'i açmak, radyo dinlemek ya da cihazda çalışan bir yapay zekâ modelini indirmek, senin başlattığın birer istek oluşturur. Uygulama ayrıca araçlarını ve güncellemelerini kendi adresinden alır ve bu istekler ürettiğin hiçbir şeyi taşımaz. [Uygulamanın yapabileceği her ağ isteği](#every-network-request-the-app-can-make) bunları sunucu sunucu listeler.
- <!--i:eti-cpu--> **Birkaç Lolly hizmeti sunucuda çalışır.** Render bağlantıları, görsel getirici, yapay zekâ ajanı uç noktası ve doğrulanmış kimlik hizmeti yalnızca onlara gönderdiğini alır ve bu sayfada belirtilenden uzun süre saklamaz.
- <!--i:eti-building--> **Kuruluşunun Lolly Work örneği farklıdır.** Oraya koyduğun paylaşılan işleri, oturum açmalarının ve orada yaptıklarının kaydını saklar ve bu verilere bu politika değil, işletmecisinin politikası uygulanır.

Verilerin hakkında soru sormak veya haklarını kullanmak için [Hakların](#your-rights) ve [Kim sorumlu](#who-is-responsible-and-how-to-reach-us) bölümlerine bak.

::: figure privacy-where-data-goes
Verilerin nereye gider: sen bir istek başlatmadıkça cihazında kalır ve her istek türünün kendi hedefi vardır.
:::

<!--i:eti-clipboard-->
## Bu politikanın kapsamı

Lolly, herkesin çalıştırabileceği açık kaynaklı bir yazılımdır: bir motor, web, masaüstü, mobil ve terminal için uygulama kabukları ve bir tarayıcı uzantısı. Bu politika iki bölümden oluşur:

- <!--i:code--> **Yazılımın kendisi**: nerede çalışırsa çalışsın verilerinle ne yaptığı ve ne yapmadığı. Bu, kodun bir özelliğidir; bu yüzden bizim veya başkasının, her Lolly kurulumunda geçerlidir.
- <!--i:server--> SUSE'nin işlettiği referans kurulum **lolly.tools**: isteğe bağlı sunucu bileşenlerinin işletilmesinde yapılan seçimler, örneğin neyin, ne kadar süreyle ve kim tarafından kaydedildiği.

Kendi sunucunda barındırdığın veya kurumsal bir Lolly örneğinde aşağıdaki yazılım davranışı yine geçerlidir, ancak sunucularındaki her şeyden SUSE değil, o örneğin *işletmecisi* sorumludur: render uç noktası, MCP sunucusu, sertifika hizmeti ve Lolly Work örneği. Kendi politikalarını onlardan iste. [Benimseme & Yönetişim](/info/adoption-governance.html), Lolly işletmenin neleri kapsadığını anlatır.

<!--i:eti-home-->
## Cihazında neler kalır

Lolly'nin web, masaüstü ve mobil uygulamaları render motorunun tamamını cihazda çalıştırır. Kullandığın araçlar, varlıklar ve kodlayıcılar cihaza geldikten sonra render etme ve indirme için sunucu gerekmez.

**Uygulamayı bağımsız kullanmak çerez oluşturmaz.** Kuruluş oturumu açmanın ve isteğe bağlı doğrulanmış kimlik kaydının, kendi bölümlerinde açıklanan çerezleri vardır. Uygulama şu kayıtları cihazda tutar:

- <!--i:sliders--> **Arayüz tercihleri**: tema, dil, ses ayarları, erişilebilirlik ayarları, kenar çubuğu ve yakınlaştırma boyutları, sıralama ve görünüm seçimleri ve gördüğün ipuçları, uygulama açılmayı bitirmeden hazır olmaları için profil kaydında ve `localStorage` içinde tutulur.
- <!--i:usercheck--> **Profil bilgilerin**: **Settings** içinde girdiğin ad, e-posta adresi, telefon numarası, iş unvanı, kuruluş, şehir, ülke ve portre fotoğrafı, IndexedDB içinde tutulur. Bunları isteyen araçları doldururlar ve yalnızca *Use my details* seçeneğini açtığında bir dışa aktarmanın kaynak kaydına veya paylaşılan bir `.lolly` dosyasına yazılırlar.
- <!--i:download--> **Araç kataloğunun ve varlık önizlemelerinin çevrimdışı önbelleği**, böylece galeri bağlantı olmadan çalışır.
- <!--i:hash--> Profil kartının istatistikleri için **yerel kullanım sayaçları**, örneğin dışa aktarma sayısı ve kullanılan araçlar: `localStorage` içinde küçük, sınırlı bir kayıt; biz bunu asla okumayız. Yalnızca kendi yedek dosyanın veya Sync kopyanın içinde cihazdan çıkarlar.
- <!--i:folder--> **Kendi işlerin**: belgeler, kayıtlı oturumlar ve geçmişleri, yüklenen görseller ve yazı tipleri, dosya sonuçları ve önceki sürümler ve daha önce boşaltmazsan silinen öğeleri 30 gün tutan Trash. 30 günden sonra, kayıtlı bir iş öğeyi hâlâ kullanmıyorsa, öğe Projects'i bir sonraki açışında silinir; örneğin bir görsel veya yazı tipi hâlâ kullanılıyor olabilir. Bunlar cihazda IndexedDB içinde ve tarayıcının özel dosya depolama alanında (OPFS) bulunur ve Sync veya paylaşmayı seçmedikçe orada kalır.
- <!--i:globe--> **Meeting Planner'ın şehir aramaları**, her şehrin bir kez aranması için `localStorage` içinde tutulur.
- <!--i:cpu--> **İndirilen modeller ve sabitlenen araçlar**: indirmeyi kabul ettiğin, cihazda çalışan yapay zekâ modelleri ve çevrimdışı kullanım için sabitlediğin araçlar.
- <!--i:seal--> Kaydolduktan sonra **imzalama kimliğin**: Content Credentials bilgilerini imzalayan kalıcı anahtar çifti ve doğrulanmış e-posta adresini içeren sertifikası, IndexedDB içinde tutulur. Özel anahtar cihazdan asla çıkmaz. Kaydolmadığında her dışa aktarmanın anahtarı o dışa aktarma için oluşturulur ve sonra atılır; [Doğrulanmış kimlik](#verified-identity-a-sign-in-you-start-yourself) ikisini de açıklar.
- <!--i:link--> **Bağlı hizmetler**: saklamayı seçtiğin oturum açma bilgileri, uygulama parolaları, anahtarlar ve Sync parola ifadesi, yanlarında gösterilen hesap etiketleri ve her dosyanın adı ve bağlantısıyla **Links you've shared** listesi. Bunlar hiçbir zaman bir yedekte veya Sync kopyasında yer almaz; [Gönderdiğin dosyalar](#files-you-send) her hizmeti açıklar.

::: details Uygulamanın cihazda tuttuğu diğer kayıtlar
- **Yanıtların.** Bir kez sorulan hangi soruları nasıl yanıtladığın: Google Font ekleme, **Ask an agent** içindeki her ajana ilk istek, **Allow pages from any site** ve **Allow AI control**. Ayrıca kapattığın bildirimler ve karşılamalar.
- **Son etkinlik.** Dashboard için her dosyanın adı, aracı, ayarları ve küçük resmiyle son indirmelerinin kısa bir listesi ve en son kullandığın varlıklar ve araçlar.
- **Bağlı bir örnek.** Adresi, bu cihaz için bir kurulum kimliği, hangi yerel kopyanın hangi çalışma alanından geldiğinin kaydı ve örneğin uygulamaya gönderdiklerinin önbelleğe alınmış bir kopyası: ayarları ve hesabının adı, e-posta adresi, grupları ve rolü.
- **Çalışma dosyaları.** OPFS içindeki devam eden ekran kayıtları, ses önizlemeleri ve video kodlamaları ve başka bir uygulamanın Lolly ile paylaştığı, uygulama bir sonraki kez başlayana kadar tutulan bir dosya.
- **Belgelendirme sayfaları.** lolly.tools/info çerez oluşturmaz. Temanı, dilini ve dil sıranı `localStorage` içinde tutar, uygulamanın Reduce motion ve Large text ayarlarını ve uygulamaya dönüş için bu tarayıcı sekmesinin geldiği uygulama görünümünün adresini okur. Belgelerin bir kopyasını yalnızca çevrimdışı kullanım için indirirsen tutar.
:::

**Settings → Storage**, işlerin, Trash, indirilen modeller, çevrimdışı kopyalar ve önbellekleri tek tek listeleyerek Lolly'nin cihazda ne kadar yer kullandığını gösterir. Oradaki **Clear all my data**, önce Sync'i kapatır ve Lolly'nin service worker'ları ve çevrimdışı önbellekleri dahil yerel kopyayı kaldırır. Yalnızca diğer açık Lolly sekmelerine silme işleminin gerçekleştiğini bildiren bir işaret tutar. Kuruluş oturumunu sonlandırmaz: o çerez, oturumu kapattığında veya tarayıcında sitenin verilerini temizlediğinde silinir; sitenin verilerini temizlemek bu düğmenin kaldırdığı her şeyi de kaldırır. İstediğin hizmet için kesinlikle gerekli olan depolama, ePrivacy Directive (Art. 5(3)) kapsamında onay gerektirmez; yalnızca bu belgenin ve uygulama içi bildirimin sağladığı şeffaflığı gerektirir.

![Telefon genişliğinde bir ekranda Settings'in depolama bölümü: cihazdaki her veri kategorisi adlandırılmış, listenin yanında Clear all my data düğmesi var](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-selbar%2C.profile-row-value%2C.profile-group-value%2C%23store-hero-num%2C%23store-headroom%7Bdisplay%3Anone%7D&format=svg&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

**Export my data**, sakladığın ve kontrol ettiğin bir `lolly-backup` dosyası üretir. Kendin bir yere göndermedikçe sunucularımıza asla ulaşmaz. Bkz. [Veri aktarımı](/info/data-transfer.html).

### Cihazında çalışan yardımcı araçlar

**Lolly Strip Hidden Data**, **Compress** ve **Runs on your device** rozeti taşıyan diğer bazı araçlar, sağladığın bir dosya üzerinde çalışır. Dosya belleğe okunur, cihazda dönüştürülür ve indirilmek üzere geri sunulur. İşlem yolunda sunucu olmadığı için asla yüklenmez. Bu yardımcı araçlar çevrimdışı çalışır ve çıktıları bize ait filigran veya meta veri taşımaz.

**Lolly Rondocode** tek istisnadır, çünkü senin bir dosyanı dönüştürmek yerine şarkından yeni ses üretir. Yazdığı her ses dosyası, şarkıyı kaydeden ve yapay zekâyla üretilmiş vokalleri bildiren Content Credentials taşır. Export paneli bunu dışa aktarmadan önce söyler ve [Lolly Rondocode şarkıları](/info/rondocode.html#files-from-the-rondocode-utility) tam olarak nelerin kaydedildiğini listeler.

**Music generator** da yeni ses üretir. Ondan indirdiğin bir WAV veya M4A, parçanın Lolly'nin müzik üreticisi tarafından yapıldığını söyleyen ve müziğin lisansını, CC BY 4.0'ı belirten Content Credentials bilgilerini her zaman taşır; atıf metni *Lolly ile üretilen müzik (https://lolly.tools), CC BY 4.0* şeklindedir. Ondan kaydettiğin bir melodi, profilinde bir ad varsa yapımcısı olarak profil adını, Lolly ve motor sürümlerini ve o lisansı kaydeder; hepsi Assets içindeki melodi ayrıntılarında gösterilir. O ad kitaplığında kalır: melodiyi çalan bir dışa aktarma, adı yalnızca *Use my details* açıkken ekler ve müzik üreticisinden yapılan indirme ad taşımaz. [Bir parçanın kaydettikleri](/info/generated-music.html#what-a-track-records) her kaydı listeler.

![Bu araçların taşıdığı rozet: Runs on your device - hiçbir şey yüklenmez](/t/url-shot?url=%2F%23%2Ftool%2Ftext-helper&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%5Bdata-privacy%5D&dark=1&filename=pv-ondevice-badge)

**Prepare for sharing** ve **Lolly Compare**, cihazda bellekte çalışır ve sunucuya hiçbir şey göndermez; Prepare da bir sonucu kaydedene kadar geçmişe, bağlantılara, yedeklere veya Sync'e hiçbir şey eklemez.

<a id="how-prepare-for-sharing-and-compare-handle-your-files"></a>
::: details Prepare for sharing ve Lolly Compare dosyalarını nasıl işler
**Prepare for sharing**, çalışma girdilerini, özel bulguları ve değiştirme eşlemelerini bellekte tutar ve hiçbir kimlik bilgisini çevrimiçi denetlemez. Bir sonucu kopyalamayı, indirmeyi, göndermeyi veya kitaplığına kaydetmeyi sen seçersin; kaydedilen sonuç daha sonra kitaplığının yedekleme ve Sync ayarlarını izler. Tarif dosyaları önceki içeriği ve birebir eşlemeleri içermez ve özet raporlar sayıları, kapsam kimliklerini ve dosya karmalarını içerir. CLI, özgün değerleri içeren özel bir inceleme dosyasını yalnızca `--review-file` ile istendiğinde kaydeder. Bir hazırlık görünümünden ayrılmak, onun çalışma durumunu serbest bırakır; bu, tarayıcı veya işletim sistemi belleğinden adli incelemeyle kurtarılamayacak biçimde silindiği anlamına gelmez.

Hazırlanan kopyalar ve tamamlanan dosya işlemleri Lolly Compare denetimlerini paylaşır. Kaldırılan değerler başlangıçta daraltılmıştır ve karşılaştırma raporları, dahil etmeyi seçmedikçe kaynak adlarını, yolları ve değerleri içermez. Dosya geçmişi kopyayı kaydeder; bu yüzden yeniden yüklemeden sonra karşılaştırmak, özgün dosyayı kayıtlı SHA-256 değeriyle eşleştirerek yeniden seçmek demektir. Onu seçmek dosyayı kaydetmez veya yüklemez.
:::

Lolly Strip Hidden Data ve Prepare for sharing, DOCX, PPTX ve XLSX dosyalarını da cihazda inceler. Desteklenen DOCX dosyalarında seçilen özellikler yeni bir kopyadan kaldırılabilir; diğer Office içerikleri yalnızca incelenir ve özel önizlemeler bir gösterme denetiminin arkasında kalır.

::: details Office incelemesinin okudukları ve kaldırdıkları
| Office biçimi | İncelenen paket içeriği | Desteklenen kaldırma işlemi |
|---|---|---|
| DOCX | Temel, uygulama ve özel özellikler; yorumlar ve yazarlar; izlenen değişiklik işaretleri ve önizlemeleri; gizli metin parçaları; dış ilişkiler; gömülü nesneler | Seçilen yazar, son kaydeden, oluşturulma/değiştirilme/son yazdırılma tarihleri, başlık, konu, açıklama, anahtar sözcükler, özel özellikler, Company, Manager, Template, köprü tabanı, uygulama adı ve sürümü ve istatistikler (toplam düzenleme süresi ve sayfa, sözcük, karakter, satır ve paragraf sayıları) |
| PPTX | Özellikler; yorumlar ve yazar kayıtları; konuşmacı notları; gizli slayt işaretleri; dış ilişkiler; gömülü nesneler ve desteklenen iç içe çalışma kitapları | Yok |
| XLSX | Özellikler; yorumlar ve notlar; gizli sayfa, satır ve sütun işaretleri; tanımlı adlar; dış ilişkiler ve bağlantılar; dış bağlantı ve pivot önbelleği alanları; gömülü nesneler | Yok |

**Sınırlar.** Tarama, görünür metni, formülleri, bağımlılıkları, render edilmiş görünümü veya herhangi bir ikili parçayı tam olarak incelemez. En fazla 300 paket parçasını, bildirilen toplam 64 MiB açılmış boyutu, XML parçası başına 2 MiB'ı ve gömülü paketlerde iki iç içe düzeyi destekler; Prepare, parça ve açılmış boyut sınırlarını işin tamamı için ortak kullanır. Kesilmiş, hatalı biçimlendirilmiş, şifrelenmiş ve desteklenmeyen içerik raporlanır ve korunur. Makro içeriği tanımlanır ve asla çalıştırılmaz, eski ikili Office biçimleri ve XLSB incelenmez ve dış başvurular asla getirilmez.

**DOCX temizliğinin korudukları.** Temizlik, standart temel, özel ve genişletilmiş özellik parçalarını içeren geçiş dönemi DOCX paket biçimini destekler. Genişletilmiş özelliklerden Company, Manager, Template, HyperlinkBase, Application, AppVersion ve TotalTime, Pages, Words, Characters, CharactersWithSpaces, Lines ve Paragraphs istatistikleri kaldırılabilir. DocSecurity, başlık ve parça başlıkları, bağlantı bayrakları ve diğer uygulama özellikleri korunur. Template'i kaldırmak, belge ayarlarındaki ekli şablon bağlantısını bırakır; tarama bunu orada bir dış ilişki olarak raporlar.

Bazı okuyucular grafik ve çizimleri nasıl çizeceklerini uygulama adı ve sürümüne göre seçer; örneğin LibreOffice, bunlar olmadan bir Word 2007 dosyasındaki grafiği farklı gösterir. Dosyada grafik, resim, şekil veya gömülü nesne olduğunda ikisi de korunur ve inceleme bunları korunanlar olarak listeler. Bir Word alanının gösterdiği özellik (TEMPLATE, EDITTIME, NUMPAGES, NUMWORDS veya NUMCHARS) korunur; bağlantı alanları ve göreli dış bağlantılar da HyperlinkBase'i korur, çünkü hedefleri o taban adrese göre çözümlenir.

**Yalnızca incelemeyle sınırlı kalanlar.** Genişletilmiş dijital imza verileri temizliği engeller. İmzalı, makro etkin, şifrelenmiş, hatalı biçimlendirilmiş, yeniden adlandırılmış veya iç içe Office paketleri yalnızca incelemeyle sınırlı kalır. DOCPROPERTY veya AUTHOR gibi özelliğe bağlı başka Word alanları ya da XML'e bağlı içerik denetimleri bulunan dosyalar da böyledir; çünkü bir özelliği kaldırmak, Word bu bağlamaları güncellediğinde belgeyi değiştirebilir ve önbellekteki alan metni bir sonraki render'ın aynı görüneceğini gösteremez. Alışılmadık dosya adı uzantıları olan XML parçaları, güvenli biçimde incelenemeyen Word XML ilişki hedefleri, yanlış bildirilmiş üstbilgi veya altbilgi parçaları ve `.svg` uzantısıyla XML olarak bildirilmiş SVG parçaları da bu ilk temizlik sürümünde yalnızca incelemeyle sınırlı kalır.

**Temizlik yaptığı işi nasıl denetler.** Özellik parçaları, bildirimleri, ilgisiz paket üyeleri, XML yorumları ve ZIP yorumları korunur. Temizlik, tarama sınırlarını uygular ve yazmadan önce her üyenin bütünlüğünü denetler, sonra ortaya çıkan özellikleri yeniden inceler. Lolly Compare, desteklenen özellik farklarını değerler daraltılmış olarak gösterir; görünür metni veya render edilmiş görünümü karşılaştırmaz. Değerler en fazla 2048 karakterlik önizlemeler kullanır; bu yüzden önizlemenin ötesindeki farklar görünmeyebilir ve kısmi bir inceleme iki dosyanın eşit olduğunu kanıtlayamaz. CLI'nin `prepare --strip-hidden-data` komutu desteklenen DOCX özelliklerini kaldırır ve özel bir inceleme zarfı bunları tek tek seçebilir. Bir temizlik güvenlik denetimi başarısız olursa dosya korunur ve başarısız bir işlem raporlanır.
:::

<!--i:eti-globe-->
## Uygulamanın yapabileceği her ağ isteği

Çoğu istek cihazına araçlar, yazı tipleri veya modeller getirir. Send eylemleri seçtiğin dosyayı iletir, Sync seçtiğin depolama alanına bir yedek iletir ve kuruluş hizmetleri ortak çalışma için gereken içeriği veya bilgileri iletir. Aşağıdaki her grup, cihazından neyin ne zaman çıktığını ve bir işletmeci isteği engellerse ne olduğunu listeler. İşletmecinin yapılandırdığı kimlik ve varlık sağlayıcıları o kuruluma hedefler ekleyebilir. [Her sabit sunucu, tek tabloda](#every-fixed-host-in-one-table), web uygulamasının iletişim kurabileceği sunucuları listeler.

::: details Cihazına getirilenler
- <!--i:download--> **Araç kataloğu.** Kişisel hiçbir şey yok: başlangıçta uygulamanın kendi adresine, Lolly'nin herkese açık araç ve varlık dizini için bir istek gönderilir ve ardından çevrimdışı önbelleğe alınır. Engellenirse uygulama önbellekteki araçlarla çalışır ve yenilerini keşfetmeyi bırakır.
- <!--i:sparkle--> **Emoji kümeleri.** Seçtiğin küme, onu ilk kullandığında uygulamanın kendi adresinden indirilir. Kişisel hiçbir şey gönderilmez. Lottie animasyonları cihazda okunur ve kimseyle iletişim kurmaz.
- <!--i:document--> **Google Fonts.** Seçilen ailenin adı ve IP adresin Google'ın yazı tipi sunucularına gider (stil sayfası için `fonts.googleapis.com`, yazı tipi dosyası için `fonts.gstatic.com`). Bu yalnızca Lolly Design System Setup içinde bir Google Font eklediğinde ve yalnızca tam olarak bunu söyleyen bir iletişim kutusunda onay verdikten sonra olur. Her aile bir kez getirilir, ardından cihazda tutulur ve çevrimdışı kullanılır. Engellenirse seçici güvenli biçimde işlemi durdurur; bunun yerine bir yazı tipi dosyası yükle.
- <!--i:cpu--> **Cihazda çalışan yapay zekâ modelleri.** Kişisel hiçbir şey yok: bir model dosyası indirilir, ardından cihazda tutulur. Web derlemeleri varsayılan olarak uygulamanın kendi adresini kullanır; bir derleme başka bir model sunucusu belirtebilir, örneğin paketlenmiş uygulamalar için Lolly'nin yayın sunucusu `lolli.li`. Sunucu isteği ve IP adresini alır; hesap ve model girdileri almaz. Bu yalnızca model gerektiren bir özellik kullandığında (Lolly Verify'ın derin taraması, görsel büyütme, konuşma ve benzerleri) veya çevrimdışı kullanım için modelleri indirmeyi seçtiğinde olur. Engellenirse o özellik bekler ve diğer her şey çalışır.
- <!--i:sliders--> **ICC baskı profilleri.** Kişisel hiçbir şey yok: yalnızca baskı profili yöneticisinde bir ICC önayarına tıkladığında, profil başına bir kez, ICC'nin herkese açık kayıt sistemine (`registry.color.org`, `www.color.org`) standart baskı koşulu profili için bir istek gönderilir. Engellenirse önayarlar çalışmaz; kendi `.icc` profilini sağla.
- <!--i:globe--> **İnternet radyosu.** Kişisel hiçbir şey yok: yalnızca ses oynatıcısındaki isteğe bağlı radyoyu çaldığında istasyondan (`api.somafm.com` ve işaret ettiği akış sunucusu, `*.somafm.com`) bir çalma listesi isteği ve ses akışı alınır. Engellenirse radyo çalışmaz ve diğer tüm ses özellikleri çalışır.
:::

::: details Canlı veri gerektiren bir araç
- <!--i:globe--> **Meeting Planner'ın şehir araması.** Şu anda canlı veri getiren tek araç budur. `geocoding-api.open-meteo.com` adresinden her şehir adını (ev sahibi şehir ve her ekip üyesinin şehri) koordinatlara ve saat dilimine dönüştürmesini ister; hesap, anahtar veya isteğin kendisi dışında bir tanımlayıcı kullanmaz. Host city girdisi bunu açıklar ve her yanıt cihazda kaydedilir; böylece bir şehir bir kez aranır. Yalnızca araç açıkken çalışır. Engellenirse arama başarısız olur ve başka hiçbir şey etkilenmez.
:::

::: details Gönderdiğin dosyalar
Bunların her biri, hizmetin kendi penceresinde tamamladığın bir oturum açma işleminden sonra Send düğmesine bastığında yalnızca seçtiğin tek dosyayı gönderir. Bluesky uygulama parolası, Discord webhook adresi, Nextcloud uygulama parolası ve S3 anahtarları yalnızca bu cihazda saklanır, asla bir yedekte bulunmaz ve **Disconnect** bunları siler.

- <!--i:upload--> **Google Drive.** Dosya, hangi biçimde olursa olsun, Google'ın Drive API'sine (`www.googleapis.com`) gider. Lolly'nin erişimi oluşturduğu dosyalarla sınırlıdır (`drive.file` kapsamı); bu yüzden Drive'ının geri kalanını asla okuyamaz. Web uygulamasında oturum açma belirteci oturum boyunca bellekte tutulur ve asla depolanmaz; diğer uygulamalarda yenileme belirteci yalnızca **Stay connected** seçeneğini işaretlersen bu cihazda saklanır. Düğme yalnızca işletmecinin bir Google istemci kimliği yapılandırdığı derlemelerde bulunur. Engellenirse düğme hiç görünmez; dosyayı indir ve kendin yükle. **Paylaşım bağlantıları.** **Create a share link** düğmesine basarsan `www.googleapis.com` adresine yapılan ikinci bir çağrı o dosyaya bir izin ekler (bağlantıya sahip herkes, Workspace alan adın veya yazdığın adresler; son durumda Google onlara e-posta gönderir) ve bağlantısını okur. **Stop sharing** izni siler. Başka hiçbir şey gerekmez: `drive.file` kapsamı zaten Lolly'nin oluşturduğu dosyaları kapsar.
- <!--i:upload--> **Dropbox.** Dosya Dropbox'ın API'sine gider (oturum açma ve meta veri için `api.dropboxapi.com`, dosya için `content.dropboxapi.com`). Erişim yalnızca uygulama klasörüne yöneliktir; bu yüzden Lolly, `Apps/` ve oradaki kendi klasörü dışında hiçbir şey görmez. Gösterdiği **Open** bağlantısı kısa ömürlü özel bir bağlantıdır ve herkese açık bir paylaşım oluşturulmaz. Yenileme belirteci yalnızca **Stay connected** seçeneğini işaretlersen saklanır. Düğme yalnızca işletmecinin yapılandırdığı bir Dropbox istemci kimliğiyle bulunur. **Paylaşım bağlantıları.** Yalnızca **Create a share link** düğmesine ilk bastığında Dropbox bir izin daha, `sharing.write`, onaylamanı ister. Ardından Lolly, bağlantıyı oluşturmak (`sharing/create_shared_link_with_settings`) ve **Stop sharing** için o bağlantıyı iptal etmek üzere `api.dropboxapi.com` adresini çağırır. Dosya gönderirken bu izin asla istenmez.
- <!--i:upload--> **OneDrive.** Dosya Microsoft'un kimlik ve Graph hizmetlerine gider (oturum açma için `login.microsoftonline.com`, yükleme için `graph.microsoft.com`); büyük bir dosya parçalar halinde `api.onedrive.com` adresine veya işletmecinin yapılandırdığı depolama kaynaklarına yüklenir. Erişim, `Apps/` altındaki Lolly'nin kendi klasörüyle ve hesap etiketi için görünen adınla sınırlıdır. Yenileme belirteci yalnızca **Stay connected** seçeneğini işaretlersen saklanır. Düğme yalnızca işletmecinin yapılandırdığı bir Microsoft istemci kimliğiyle bulunur. **Paylaşım bağlantıları.** **Create a share link**, zaten verdiğin erişimle `graph.microsoft.com` adresini çağırır (dosya üzerinde `createLink`). Microsoft bunu reddederse Lolly daha geniş erişim istemez: Share düğmesini kullanman için seni dosyanın OneDrive'daki kendi sayfasına gönderir. **Stop sharing** bağlantının iznini siler.
- <!--i:upload--> **LinkedIn**, **yalnızca masaüstü uygulamalarında**. Dosya, adı gönderi metni olarak kullanılarak LinkedIn'e (kendi tarayıcında oturum açma için `www.linkedin.com`, yükleme ve gönderi için `api.linkedin.com`) kendi akışında herkese açık bir gönderi olarak gider. Lolly senin adına gönderi paylaşabilir ve hesap etiketi için adını okuyabilir; başka hiçbir şey yapamaz. Oturum açma bilgisi yalnızca **Stay connected** seçeneğini işaretlersen tutulur ve LinkedIn belirteçleri 60 gün geçerlidir ve sessizce yenilenemez; bu yüzden kendiliğinden sona erer. Bu sunucular web uygulamasının bağlantı politikasında yoktur. Düğme yalnızca bir LinkedIn uygulaması yapılandırılmış derlemelerde bulunur.
- <!--i:upload--> **Penpot.** Uygulamaya yapıştırdığın Penpot kişisel erişim belirtecin ve tasarımın `.penpot` arşivi, uygulamanın kendi adresindeki küçük bir aktarma üzerinden (`/api/penpot`) Penpot'un API'sine (`design.penpot.app`) gider, çünkü Penpot'un API'si bir tarayıcıya doğrudan yanıt vermez. Aktarma iletir ve unutur; masaüstü uygulamaları Penpot ile doğrudan iletişim kurar. Bu yalnızca Design aracında **Send to Penpot** düğmesine basıp bir projeyi onayladığında olur. Engellenirse gönderme güvenli biçimde durur; `.penpot` dosyasını dışa aktar ve kendin içeri aktar.
- <!--i:upload--> **Bluesky.** Görsel, gönderi metni ve alternatif metin olarak adı ve kullanıcı adın ile uygulama parolan (Bluesky → Settings → App passwords altında oluşturulan, asla hesap parolan değil), belirttiğin Bluesky sunucusuna gider; başka bir tane seçmezsen `bsky.social`. Önce **Settings → Connected services** içinde hesabı bağlarsın.
- <!--i:upload--> **Discord.** Dosya, discord.com üzerinde yapıştırdığın kanal webhook adresine ek olarak gider. Bir webhook adresine sahip herkes o kanala gönderi yapabilir; bu yüzden adres cihazda kalır.
- <!--i:upload--> **Mastodon.** Dosya, adı gönderi metni olarak kullanılarak, sunucunun kendi penceresinde oturum açtıktan sonra belirttiğin Mastodon veya uyumlu sunucuya gider. Bağlanmak, o sunucuda bu cihaz için küçük bir uygulama kaydeder ve oturum açma bilgisi yalnızca **Stay connected** seçeneğini işaretlersen tutulur.
- <!--i:upload--> **Nextcloud veya WebDAV.** Dosya, girdiğin sunucu adresi, kullanıcı adı ve uygulama parolasıyla (Nextcloud → Settings → Security → Devices & sessions; asla hesap parolan değil), kimliği doğrulanmış tek bir yüklemeyle kendi sunucuna gider. **Paylaşım bağlantıları.** **Create a share link**, seçtiğin parola ve son kullanma tarihiyle herkese açık salt okunur bir bağlantı için, aynı uygulama parolasıyla kendi sunucunun paylaşım hizmetine (`/ocs/v2.php/apps/files_sharing/api/v1/shares`) bir çağrı yapar. **Stop sharing** o paylaşımı siler.
- <!--i:upload--> **S3 uyumlu depolama.** Dosya, girdiğin anahtar çiftiyle cihazda imzalanarak kendi bucket'ına (AWS S3, MinIO, R2, B2, Garage veya herhangi bir SigV4 uç noktası) gider. **Paylaşım bağlantıları.** Bağlantı, kayıtlı anahtarlarından cihazında oluşturulan önceden imzalanmış bir adrestir; bu yüzden oluşturulurken hiçbir şey gönderilmez. En fazla yedi gün geçerlidir ve daha erken kapatılamaz.

**Seçtiğin sunucular işletmecinin onayını gerektirir.** Bluesky, Discord, Mastodon, Nextcloud ve S3 sunucuları Lolly'nin sabit listesinde yoktur, çünkü onları sen seçersin. İşletmeci o HTTPS sunucusunu tam olarak onaylayana kadar uygulama ona hiçbir şey göndermez: web'de kurulumun Content Security Policy ayarında, masaüstü uygulamalarında ise uygulama derlenirken. Aynı durum özel depolama ve SharePoint yükleme sunucuları için de geçerlidir. Web'de sunucunun uygulamadan gelen tarayıcı çağrılarına (CORS) da izin vermesi gerekir ve yönlendirme olursa işlem güvenli biçimde durur; bu yüzden yönlendirme yapmayan bir adres kullan. Masaüstü uygulamaları her yönlendirmeyi onaylı listeyle karşılaştırır.

Bu liste, uygulamanın hangi sunuculara ulaşabileceğini sınırlar. Google veya Microsoft'taki hesapları ya da kiracıları birbirinden ayırmaz ve hangi hesaplara ve eylemlere izin verildiğine sağlayıcının kendi izinleri karar verir. Ayrıca kendi kuralları olan oturum açma pencerelerini, diğer kaynak türlerini veya yerel özellikleri kapsamaz. Bir değişiklik, yeni bir masaüstü derlemesi veya yeni web yanıt başlıkları gerektirir; değişikliği almak için uygulamayı yeniden açmadan önce işini kaydet. [Bağlayıcı kaynakları](/info/connector-origins.html) yapılandırmayı açıklar.
:::

::: details Cihazların arasında Sync
- <!--i:folder--> **Cihazdan çıkanlar.** Bu cihazda ürettiklerinin (kayıtlı oturumlar ve projeler, yazı tipleri ve logolarıyla tasarım sistemlerin, yüklenen görseller, profilin ve tercihlerin) tek dosyalık bir kopyası, seçtiğin tek depolama alanına gider: Dropbox'ındaki Lolly uygulama klasörü (`api.dropboxapi.com`, `content.dropboxapi.com`), Google Drive'ında Lolly'nin oluşturduğu dosyalar (`www.googleapis.com`), OneDrive'ındaki Lolly uygulama klasörü (`graph.microsoft.com`; daha büyük dosyalar `api.onedrive.com` adresine veya işletmecinin yapılandırdığı depolama kaynaklarına yüklenir ve indirmeler işletmecinin tam olarak yapılandırdığı depolama kaynaklarından yapılır) ya da kendi Nextcloud, WebDAV sunucun veya S3 bucket'ın. Aynı depolama alanı en fazla yedi günlük kopya ve son uygulama işleminden önceki bir kopyayı tutar.
- <!--i:shieldcheck--> **Lolly'ye hiçbir şey gitmez.** Yolda hiçbir Lolly sunucusu, aktarma sunucusu veya Lolly Work sunucusu bulunmaz ve uygulamalar bunun için oturum açmak dahil hiçbir Lolly web sitesine ihtiyaç duymaz. Kopya, yalnızca bir parola ifadesi belirlersen önce cihazda şifrelenir. Oturum açma bilgileri, anahtarlar, uygulama parolaları, parola ifadesi ve Sync ayarları cihazda kalır ve asla kopyada bulunmaz. Web'de hatırlanan bir Google Drive bağlantısı yalnızca bir hesap etiketi, genellikle Google hesabının e-posta adresi, sahip olduğu izin ve bağlandığın zamanı tutar (ve verdiysen kendi istemci kimliğini). Erişim belirteci saklanmaz ve Google oturumu tek ziyaret boyunca sürer. Android uygulamasında Google Drive oturum açma işlemi, telefonda Google'ın işlettiği Google Play hizmetleri üzerinden yapılır.
- <!--i:sliders--> **Ne zaman.** Yalnızca **Sync across my devices** seçeneğini açtıktan veya **Sync now** düğmesine bastıktan sonra: her değişiklikten kısa süre sonra ve uygulamadan ayrıldığında bir yükleme ve uygulama başladığında daha yeni kopya denetimi. Engellenirse Sync başarısız olur ve nedenini söyler; işin cihazda kalır. Bunun yerine verilerini bir dosyaya dışa aktarıp kendin taşıyabilirsin. [Cihazlarını eşitle](/info/sync.html) bu özelliği anlatır.
:::

::: details Diğer sitelerden web sayfaları, ekran görüntüleri ve resimler
- <!--i:monitor--> **Bir araçtan yakalamasını istediğin URL.** URL ekran görüntüsü aracı, yalnızca yakalamayı başlattığında tam olarak yazdığın adresi ister. Adresi o anda seçtiğin için bağlantı politikasında yer almaz ve bir işletmeci sunucuya göre izin veremez veya engelleyemez; kaldırmak için aracı kaldırmak gerekir.
- <!--i:globe--> **Bir Lolly Design kutusundaki web sayfası.** Sayfa, IP adresinle birlikte geldiği siteden, sayfanın kendisinin istediği her şeyle birlikte istenir. Tarayıcının desteklediği durumlarda çerçeveye çerez ve uygulamanın kendi kaynağı dışında bir adres gönderilmez; bu yüzden belgen ve bağlantısı istekle asla taşınmaz. Web uygulamasında yalnızca şu oynatıcılar çerçeveye alınabilir: `www.youtube-nocookie.com`, `player.vimeo.com`, `www.loom.com`, `www.google.com` (haritalar) ve `www.figma.com`; ayrıca `wikipedia.org` ve `*.wikipedia.org`, `commons.wikimedia.org`, `upload.wikimedia.org`, `www.wikidata.org`, `www.mediawiki.org` ve `www.openstreetmap.org` üzerindeki başvuru sayfaları. **Settings → Trusted sites** altındaki **Allow pages from any site**, Lolly'yi cihazında herhangi bir `https:` sayfasını çerçeveye alabilen bir politikayla yeniden yükler ve güven ve izin isteme konusundaki aynı kurallar geçerliliğini korur. Bir sayfa yalnızca kaldırılabilir varsayılan başvuru siteleri dahil Trusted sites listendeki bir site için veya o kutuyu Inspector'ında onayladıktan sonra yüklenir; birinin sana gönderdiği sunum o zamana kadar her sayfanın bir resmini gösterir. Sunum yapmadan önce liste her site için **Just this time** ve **Always trust** seçeneklerini sunar ve sunum sırasında hiçbir şey sorulmaz. Engellenirse kutu, sayfayı yeni sekmede açan bir bağlantıyla resmini gösterir. Bir kutudaki Lolly araçları ve Lolly Sandbox demoları uygulamanın kendi adresinde çalışır ve kimseyle iletişim kurmaz.
- <!--i:sliders--> **Gösterdiğin bir sayfayı değiştirmek.** Web sayfası kutusunun **Use page** eylemi, sayfa içindeki çerezleri reddetmeni veya bir banner'ı kapatmanı sağlar. Erişilebilir Lolly sayfalarında **Hide cookie banners**, çerezleri kabul etmeden veya sitenin onay seçimini değiştirmeden OneTrust dahil bilinen kaplamaları gizler. **Page CSS**, o kutunun canlı sayfasını ve sunumunu değiştirir; dışa aktarmalar seçilen poster görselini kullanmaya devam eder. Kurallar kaynak veya yazı tipi içeri aktaramaz ve tarayıcılar Lolly'nin başka bir sitenin CSS'ini değiştirmesini engeller. Lolly Sandbox önizlemelerinin **Edit in Sandbox** altında kendi CSS düzenleyicisi vardır.
- <!--i:code--> **Bir Lolly Sandbox demosunun web kaynakları.** Demonun kodunun bağlantı verdiği her stil sayfası, betik, yazı tipi veya görsel, IP adresinle ve çerez olmadan onu barındıran siteden istenir; getirilen bir stil sayfasının belirttiği dosyalar, örneğin Google Fonts'un yazı tipi dosyaları, ayrı siteler olarak sayılır. Bu yalnızca **Fetch & inline** düğmesine tıkladıktan sonra veya Trusted sites listendeki bir site için olur; dosyanın yanındaki **Always trust** onun sitesini o listeye ekler. Engellenirse demo o dosyalar olmadan çalışır ve Lolly Sandbox getiremediği her dosyayı ve nedenini listeler.
- <!--i:download--> **URL'den görsel ekleme.** Varlık seçicideki veya Assets içindeki **Add from URL**, tam olarak yapıştırdığın görsel adresini ister. Web uygulamasının kendi politikası tarayıcının başka bir siteden doğrudan içerik getirmesini engeller; bu yüzden uygulamanın kendi adresindeki küçük bir aktarma (`/api/fetch-image`) görseli getirir ve yalnızca baytları geri verir; hiçbir şey saklamaz, adresi unutur ve herkese açık bir görsel adresi olmayan her şeyi reddeder. Masaüstü uygulamaları adresi doğrudan getirir. Yapıştırdığın bir Lolly bağlantısı hiç getirilmez: cihazda render edilir. İşletmeci aktarmayı kapatırsa (`LOLLY_DISABLE_IMAGE_PROXY=1`) web uygulamasında yalnızca Lolly bağlantıları, `data:` görselleri ve aynı kaynaktaki görseller eklenebilir ve masaüstü uygulamaları etkilenmez.
- <!--i:palette--> **Bir web sitesinden tasarım sistemi.** Lolly Design System Setup, belirttiğin bir sitenin tek sayfasını [tarayıcı uzantısı](#the-browser-extension) veya masaüstü uygulamasının kendi getirme işlemi üzerinden okuyabilir; asla bir Lolly sunucusu üzerinden okumaz. Sen basmadan hiçbir şey getirilmez ve sayfadaki bağlantılar takip edilmez.
:::

::: details Diğer insanlarla ve ajanlarla çalışma
- <!--i:link--> **Özel bir işbirliği.** İki cihaz, arada sunucu olmadan doğrudan bağlanır. Davet ve yanıt, her cihazın kendi ağında görebildiği adresleri taşır ve bu derleme dışarıda bir adres keşif sunucusu yapılandırmaz; bu yüzden bunları yalnızca birlikte çalıştığın kişiye ver. Bkz. [Birlikte çalışma](/info/collaborate.html).
- <!--i:monitor--> Masaüstü uygulamasında **Nearby**. Görünür olduğun sürece, yani bir işbirliği daveti başlattığında on dakika boyunca veya bu seçeneği açarsan uygulama her çalıştığında, uygulama yerel ağda rastgele bir adı, seçtiğin görünen adı ve cihaz türünü duyurur. E-posta adresi, hesap veya kalıcı tanımlayıcı duyurmaz.
- <!--i:link--> **Invite an agent.** Davet edilen belgenin durumu, ajanın istediği önizlemeler, ajanın kimliği ve düzenlemeleri yapılandırılmış canlı aktarma sunucusundan (lolly.tools üzerinde `lolly.ing`) davet ettiğin ajana geçer. Yüklü bir barındırılan eklenti de çağrıları lolly.tools bağlayıcısı üzerinden davetin seçtiği aktarma sunucusuna iletir; bağlayıcı çağrılar arasında davet veya belge tutmaz. Aktarma sunucusu, sen bağlantıyı kesene veya süreleri dolana kadar davetleri ve bekleyen istekleri bellekte tutar: kullanılmamış bir davet için on dakika ve katılım sağlanmış bir davet için otuz dakika hareketsizlik. Ajanının sağlayıcısı aldığı verileri kendi politikasına göre işler. Bu yalnızca Share içinde bir davet oluşturup talimatlarını ajanına verdikten sonra olur; okuma erişimi incelemeye, düzenleme erişimi ayrıca değişikliklere izin verir. Pause değişiklikleri durdurur ve Disconnect veya davetin iptal edilmesi erişimi sonlandırır. Engellenirse ajan katılamaz veya devam edemez ve sen düzenlemeyi sürdürürsün.
- <!--i:cpu--> Masaüstü uygulamasında **Allow AI control**. Bu bilgisayarda çalışan bir ajan, bilgisayarda kalan bir bağlantı üzerinden açık Lolly Design belgesini okuyabilir ve düzenleyebilir. Sen açana kadar kapalıdır. Lolly bunun için sunucuya hiçbir şey göndermez; ajanın sağlayıcısı, ajanın okuduklarını kendi politikasına göre işler. [Tehdit Modeli & Güven Sınırları](/info/threat-model.html) böyle bir ajanın yapabileceklerini ve yapamayacaklarını listeler.
- <!--i:cpu--> Masaüstü uygulamasında **Ask an agent**. Lolly Design içinde **Ask an agent** panelini açmak, uygulamanın bu bilgisayarda dört ajan komut satırı aracını (Claude Code, Codex, Gemini CLI ve GitHub Copilot CLI), yedi uygulamayı (Claude, ChatGPT, Codex, Cursor, Visual Studio Code, LM Studio ve Ollama) ve `127.0.0.1` üzerindeki Ollama ve LM Studio sunucularını aramasını sağlar. Her aracın sürüm ve yardım komutlarını (ve Codex'in özellik listesini) çalıştırır, uygulama paketlerinden uygulama adlarını ve sürümlerini okur ve iki yerel sunucuya hangi modelleri tuttuklarını sorar. Oturum açma veya kimlik bilgisi dosyası okumaz, sonuç uygulamanın belleğinde kalır ve bununla ilgili hiçbir şey hiçbir yere gönderilmez. Bir ajana sorduğunda isteğin ve açık belge, yüklenen resimler hariç tutularak, o aracın oturum açtığı hesap altında ajanın sağlayıcısına (Claude Code için Anthropic, Codex için OpenAI) gider ve ücret o sağlayıcıdaki planından karşılanır. Yolda hiçbir Lolly sunucusu yoktur. Her ajana ilk istekten önce panel bunu gösterir ve bir kez sorar; yanıtın bu cihazda `localStorage` içinde tutulur. Ajan, boş bir geçici klasörde, araç kullanmadan ve yalnızca kendi oturum açma bilgilerini bulmak için gereken ortam değişkenleriyle çalışır; bu yüzden ortamda ayarlanan API anahtarları geride kalır. Yönetilen bir örnekte kuruluşun politikası bunu kapatabilir ve o zaman uygulama ajan aramaz veya başlatmaz.
- <!--i:server--> **Uzak bir örnek.** Uygulamayı başka bir Lolly kurulumuna yönlendirdiğinde aynı katalog eşitlemesi üzerinden o örneğin sunduklarını alır; ayrıca ona giden isteklere bir sürüm etiketi eklenir (uygulama türü ve motor sürümü, bir kullanıcı aracısının taşıdığı aynı bilgiler); böylece işletmecisi hangi Lolly sürümlerinin kullanıldığını görebilir. Yönetilen bir örnekte oturumun açıkken etiket bu cihaz için bir kurulum kimliği de taşır; böylece işletmecinin cihaz listesi kurulumları ayırt edebilir. Ayrılmak kimliği siler ve daha sonra yeniden bağlanan bir cihaz yeni bir kimlik sunar. Sunucuyu sen seçersin; bu yüzden bağlantı politikasında yer almaz. Engellenirse geçiş başarısız olur ve yerel örneğin etkilenmez.
- <!--i:people--> **Kuruluşunun Lolly Work örneği.** Oturum açma kimliği ve cihaz bilgileri, politika istekleri, kullandığın paylaşılan oturumlar, işbirliği düzenlemeleri, yüklemeler, onay başvuruları, yayımladığın marka sayfaları ve teslimat dosyaları kuruluşunun örneğine gider; oturum açma işlemi onun kimlik sağlayıcısından geçer. Politika yenilemeleri kullanım sırasında çalışabilir; ortak işler, işbirlikleri, inceleme ve teslimat bu iş akışlarının parçası olarak içerik gönderir. Lolly'nin kendi uygulamaları örneğe kullanım olayı göndermez. Engellenirse bu kuruluş özellikleri tamamlanamaz ve kişisel işin ayrı kalır. Bkz. [Lolly Work ile kuruluş hizmetleri](#organisation-services-with-lolly-work).
:::

### Her sabit sunucu, tek tabloda

Web uygulamasının Content Security Policy ayarı, bir betiğin listede olmayan herhangi bir sunucuya ulaşmasını engeller. Tablo, uygulamanın kendi adresinin yanı sıra, politikanın listelediği her sunucuyu ve masaüstü uygulamalarının eklediği, yalnızca masaüstü olarak işaretlenmiş iki LinkedIn sunucusunu verir. Bir CI testi bu tabloyu dağıtımdaki politikayla karşılaştırır; bu yüzden birine sunucu eklenirken diğerine de eklenmesi gerekir.

| Ne | Cihazından gerçekte ne çıkar | Sunucular |
|---|---|---|
| Paketlenmiş uygulamalarda cihazda çalışan modeller ve sürüm dosyaları | IP adresinle birlikte herkese açık bir dosya isteği | `lolli.li` |
| Google Fonts | Yazı tipi ailesinin adı ve IP adresin | `fonts.googleapis.com`, `fonts.gstatic.com` |
| Google Drive'a gönderme ve onunla Sync | Seçtiğin dosya veya yedek ve paylaşım bağlantısı istediğinde paylaşım izni | `www.googleapis.com` |
| Dropbox'a gönderme ve onunla Sync | Seçtiğin dosya veya yedek ve paylaşım bağlantısı istediğinde bağlantı ayarları | `api.dropboxapi.com`, `content.dropboxapi.com` |
| OneDrive'a gönderme ve onunla Sync | Seçtiğin dosya veya yedek, hesap etiketi için görünen adın ve paylaşım bağlantısı istediğinde bağlantı isteği | `login.microsoftonline.com`, `graph.microsoft.com`, `api.onedrive.com` |
| Meeting Planner'ın şehir araması | Her şehir adı | `geocoding-api.open-meteo.com` |
| ICC baskı profilleri | Herkese açık bir profil isteği | `registry.color.org`, `www.color.org` |
| İnternet radyosu | Bir çalma listesi isteği ve ses akışı | `api.somafm.com`, `*.somafm.com` |
| Invite an agent ve lolly.ing çalışma alanı | Davet edilen belgenin durumu, önizlemeleri ve düzenlemeleri ve yaptığın çalışma alanı istekleri | `lolly.ing` |
| Lolly Design web kutusundaki oynatıcılar | IP adresinle birlikte sayfa isteği | `www.youtube-nocookie.com`, `player.vimeo.com`, `www.loom.com`, `www.google.com`, `www.figma.com` |
| Lolly Design web kutusundaki başvuru sayfaları | IP adresinle birlikte sayfa isteği | `wikipedia.org`, `*.wikipedia.org`, `commons.wikimedia.org`, `upload.wikimedia.org`, `www.wikidata.org`, `www.mediawiki.org`, `www.openstreetmap.org` |
| Yalnızca masaüstü uygulamalarında LinkedIn'e gönderme | Adı herkese açık gönderi olarak kullanılan dosya | `www.linkedin.com`, `api.linkedin.com` |

Masaüstü uygulamalarının kendi listesinde Drive oturumu açmak için Google'ın belirteç uç noktası da bulunur. Belirttiğin bir Mastodon veya Nextcloud sunucusu gibi diğer her sunucu, Gönderdiğin dosyalar bölümünde açıklandığı gibi işletmecinin onayını gerektirir. Yakaladığın bir URL veya belirttiğin uzak örnek gibi kullanım anında seçtiğin sunucular hiçbir listede görünmez.


**SEAL imzaları istek oluşturmaz.** Lolly Verify, imzalama anahtarı DNS'te yayımlanabilen bir düzen olan SEAL imzalarını denetleyebilir. Tarayıcılar DNS sorgusu yapamaz; bu yüzden bir web aramasının, denetlenen alan adını ve IP adresini görecek üçüncü taraf bir DNS-over-HTTPS çözümleyicisinden geçmesi gerekir. Lolly önceden Cloudflare'ın çözümleyicisini kullanıyordu; artık kullanmıyor ve Cloudflare'ın yerini hiçbir şey almadı. Şu anda hiçbir Lolly uygulaması SEAL anahtarlarını aramıyor: masaüstü ve mobil uygulamalar aynı Verify görünümünü çalıştırıyor ve komut satırındaki `lolly validate` SEAL'i denetlemiyor. SEAL kaydı anahtarını satır içinde taşıyan bir dosya çevrimdışı denetlenir ve Lolly Verify, alan adını doğrulamadan imzanın kendi içinde tutarlı olduğunu belirtir. Anahtarı yalnızca DNS'te bulunan bir dosya, "anahtar çözümleyicisi ve satır içi anahtar yok" gerekçesiyle **SEAL signature did not verify** mesajını gösterir.

![Lolly Verify ekranı: yalnızca bir bırakma alanı - dosya, yükleme ve hesap olmadan, zaten bulunduğu yerde denetlenir](/t/url-shot?url=%2F%23%2Fverify&width=1440&height=900&dpi=192&waitMs=1400&walker=1&format=svg&cropSelector=.valid-layout&dark=1&filename=cc-verify-drop)

Bu sayfadaki bu iddiayı ve diğer tüm iddiaları kendin denetleyebilirsin: [Kendin Doğrula](/info/verify-yourself.html) komutları ve beklenen çıktıyı verir.

<!--i:eti-cpu-->
## lolly.tools tarafından çalıştırılan hizmetler

Bunlar lolly.tools üzerinde herkes için çalışır. Her biri yalnızca gönderdiğini alır. [Sunucu Yüzeyi](/info/server-surface.html), aynı bileşenlerin herhangi bir kurulumda nasıl çalıştığını açıklar.

### Render bağlantıları

Her `https://lolly.tools/tool/<tool-id>.<ext>?<inputs>` URL'si gerçek bir render üretir ve girdileri URL'de taşınır; böylece paylaşılan bir Lolly bağlantısı README, wiki veya gösterge panelinde canlı bir görsel olarak görünebilir. Birini getirmek, sunucudan adrese yazılan girdilerle **herkese açık araç ve katalog verilerini** render etmesini ister.

- <!--i:usercheck--> **Hesap yok, çerez yok, durum yok.** Yol oturum açmanı istemez ve cihazındaki hiçbir şey okunmaz. Belgelerin, oturumların ve yüklemelerin tarayıcından asla çıkmaz ve bu bağlantılarda görünemez.
- <!--i:document--> **URL'nin kendisi kaydedilir.** Bir URL'nin sorgu dizesi isteğin parçasıdır; bu yüzden istenen herhangi bir yol gibi barındırma platformunun sıradan erişim günlüklerinde görünür. Bir bağlantının girdileri, yaka kartı veya e-posta imzasında olabileceği gibi birinin adını ya da e-posta adresini içeriyorsa **o metin bu günlüklerde bulunur**. Bir render bağlantısına yalnızca herkese açık bir sayfaya koyacağın şeyleri ver.
- <!--i:globe--> **Girdiler zaten herkese açıktır.** Bağlantının yazarının URL'ye yazdığı her şeydir ve bağlantının ulaştığı herkes tarafından okunabilir. Hassas içerik için Lolly bağlantı şifrelemesi sunar.
- <!--i:eyeoff--> **Önbelleğe alınır, sınırlandırılır ve dizine eklenmez.** Yanıtlar, herkese açık her görsel gibi önbelleğe alınır ve hız sınırlamasına tabidir; arama motorlarının render'larını dışarıda bırakması için `noindex` olarak işaretlenir.

Herkese açık bir render yolu istemeyen, kendi sunucusunda barındırılan bir kurulum `LOLLY_DISABLE_RENDER_GET=1` ayarını yapar ve bu URL'lerin her biri 404 döndürür.

### Görsel getirici ve Penpot aktarması

Web uygulamasındaki **Add from URL** ve **Send to Penpot**, lolly.tools üzerindeki iki küçük aktarmayı kullanır; bunlar [Uygulamanın yapabileceği her ağ isteği](#every-network-request-the-app-can-make) altında açıklanır. Görsel getirici hiçbir şey tutmaz ve adresi unutur. Penpot aktarması belirtecini ve arşivini Penpot'a iletir ve ikisini de tutmaz; komut adını ve Penpot'un yanıt durumunu günlüğe kaydeder.

### Yapay zekâ ajanları için MCP sunucusu

Bir yapay zekâ ajanı, işletmecinin çalıştırdığı bir uç nokta üzerinden Model Context Protocol ile Lolly'ye ulaşabilir. lolly.tools böyle bir uç nokta çalıştırır ve herkes tamamen çevrimdışı dahil kendi uç noktasını çalıştırabilir.

- <!--i:cpu--> **Bir ajanın gönderdiği dosyalar.** Dosya alan araçlar (`lolly_transform`, `lolly_verify`, `lolly_redact`, `lolly_read`, `lolly_check`, `lolly_package`, `lolly_compose`, `lolly_rebrand` ve görsel araçları `lolly_look`, `lolly_sample_color` ve `lolly_trace_edges`) dosyayı bellekte işler ve sonucu aynı çağrıda döndürür. Dosya asla diske yazılmaz ve istek tamamlandıktan sonra tutulmaz. `lolly_inspect` de dosya alır ve video ve baskı üretimi denetimleri, çağrı döndüğünde silinen geçici bir çalışma kopyası yazar. Diğer her araç çağrıdaki parametrelerle çalışır: metin, sayılar, renkler, URL'ler, katalog varlık kimlikleri veya çağrıyı yapanın sağladığı bir belge.
- <!--i:cpu--> **Lolly Rebrand, bir sunumun nereye gittiğini belirtir.** `lolly_rebrand` aracının ilk aşaması olan `capabilities`, herhangi bir bayt göndermeden önce baytlarının nereye gideceğini açıkça söyler: kendi barındırdığın yerel bir sunucuda sunum o makineden asla çıkmaz; barındırılan bir sunucuda ise `lolly_rebrand` çağrısı, o aşamanın verdiği boyut ve slayt sınırlarına kadar sunumu oraya gönderir.
- <!--i:lock--> **Açık uç nokta.** lolly.tools üzerinde `lolly.tools/api/mcp`, belirteç olmadan herkese açıktır. Çağrılar adres başına ve günlük bir bütçeyle sınırlandırılır. Aşağıdaki oturum açma uç noktalarında olduğu gibi adres, kötüye kullanım denetimi deposunda takma adlı bir özete dönüştürülür ve bütçe adres olmadan yalnızca CPU süresini ve gönderilen baytları sayar. Kısıtlı bir uç noktanın bearer belirteci hiçbir zaman bir günlüğe veya render URL'sine yazılmaz.
- <!--i:link--> **Büyük sonuçlar için indirme bağlantıları.** lolly.tools sonuçları yanıtın içinde döndürür ve bu bağlantıları asla oluşturmaz. Bir işletmeci bunları kendi kimlik doğrulamalı ağ geçidinde açabilir; burada sonuç en fazla beş dakika tutulur ve onu yalnızca çağrıyı yapanın kendi bearer belirteci getirebilir; bkz. [MCP Sunucusu](/info/mcp.html#private-download-links-for-large-results). `mcp.lolly.tools` adresinde planlanan kısıtlı uç nokta, işletmecinin güvenilir istemcilere verdiği bir bearer belirteci veya paylaşılan bir gizli anahtara karşı denetlenen kısa ömürlü imzalı belirteçlerle OAuth 2.1 kabul edecektir; etkinleştirilmesi beklemededir ve [Dağıtım sunucuları ve veri işleyenler](#delivery-hosts-and-processors) altında listelenir.

### Doğrulanmış kimlik: kendin başlattığın bir oturum açma

Lolly, dışa aktarmalarına bir **Content Credential** mühürleyebilir; böylece herkes bir dosyanın Lolly'den çıktığından beri değişmediğini çevrimdışı denetleyebilir. Bu kadarı **varsayılan olarak açık ve tamamen yereldir**: imzalama anahtarı cihazında oluşturulur ve imzalama çevrimdışı gerçekleşir. Kaydolmadığında bu anahtar tek kullanımlıktır; her dışa aktarma için yeni bir anahtar çifti oluşturulur ve ardından atılır. Kaydolduktan sonra anahtar kalıcıdır ve **dışarı çıkarılamaz** olarak üretilir; bu yüzden Lolly'nin kendi kodu bile onu okuyamaz, yalnızca imzalamasını isteyebilir. Her iki durumda da cihazından asla çıkmaz.

[Dışa aktarma](/info/exporting.html#content-credentials-c2pa), bir kimlik bilgisinin neleri kaydettiğini listeler: araç, zaman, genel dışa aktarma ortamı, yalnızca *Use my details* seçeneğini açtığında adın, dışa aktarmanın yerleştirdiği atıflı çalışmalar, bir video veya ses dışa aktarmasının çaldığı her Lolly Rondocode şarkısı (adı, kaynağının karması ve Lolly'nin korumalı ortamının şarkıyı nasıl render ettiği) ve böyle bir dışa aktarmanın çaldığı her kayıtlı melodi (adı, tarifinin karması, motor sürümü ve melodi bir lisans kaydediyorsa o lisans). Kayıtlı bir melodinin yapımcısı, yani melodinin kaydedildiği ad, yalnızca *Use my details* açıkken eklenir; bu yüzden o anahtar kapalıyken bu yolla da cihazından hiçbir ad çıkmaz. Dışa aktarma paneli, dışa aktarmadan önce bu şarkıları ve melodileri listeler ve melodinin yapımcısını yalnızca ad yazılacaksa gösterir.

Kimlik bilgisi ve dosyanın meta verileri, dışa aktarmayı çizen [tasarım sistemi ve colourway'i](/info/exporting.html#the-design-system-record) de kaydeder: tasarım sisteminin kimliği ve adı, yayımlanmış sürümü ve colourway. Bir tasarım sisteminin adı, sahiplerinin yazdığı metindir ve bir müşterinin adı olabilir; bu yüzden dışa aktarma panelinin **Design system** kartı, dışa aktarmadan önce tam metni gösterir. Bunları dışarıda bırakmak için kartın işaretini kaldır veya `_madewith=0` ya da `--no-madewith` kullan.

Bir tasarım sisteminin yayımcısı, [marka sayfasının](/info/brand-page.html#lead-back-from-your-files) adresini de aynı kayda eklemeyi seçebilir. Eklenen tek şey adrestir. Ayar, yayımcı açana kadar kapalıdır ve bir paket veya kopyayla taşınmaz; aynı kart adresi gösterir ve dışarıda bırakmanı sağlar. Bir dosyayı yeniden okumak o adresi asla yüklemez: Lolly Verify sunucuyu gösterir ve sayfayı açıp açmayacağını sen seçersin.

Bir kuruluşun Lolly Work örneği üzerinden onaylanan dosya, imzalı bir onay kaydı da taşıyabilir: onay kimliği, karar tarihi ve incelenen dosyanın özeti; ad, e-posta, grup, yorum veya zincir adı içermez. İnceleme isteyen kişi bunu işaretli bir kutu olarak görür ve işareti kaldırabilir; kuruluş da kaydı kapatabilir.

Bir [niyetten](/info/visual-intent.html#what-goes-in-the-file) oluşturulan dosya, kendisinden isteneni de kaydeder: amaç, ortam, araç, dil ve isteğin özeti. Vesile, hedef kitle, bölge ve varsa istem yalnızca parmak izleriyle yer alır. İstemin kendi sözcükleri yalnızca o render'ı çalıştıran kişi veya ajan istediğinde eklenir ve çalıştırma bunu belirtir, çünkü dosyanın ulaştığı herkes bunları okuyabilir. Kayıt dışarıda bırakılabilir ve başka hiçbir dışa aktarma böyle bir kayıt taşımaz.

Bunun üzerindeki tek *isteğe bağlı* adım, doğrulanmış bir kimlikle kaydolmaktır; böylece dışa aktarmaların anonim bir anahtar belirtmek yerine "Doğrulandı - imzalayan: \<your email\>" der. **Kaydolmayı atlarsan sertifika hizmeti senden hiçbir kayıt verisi almaz.**

![Settings içindeki Verified identity kartı, telefon genişliğinde: sertifika ömrü seçicisi ve altındaki kayıt adımı, sen başlatana kadar etkin değil](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

Kaydolursan tam olarak şunlar olur:

::: timeline
- <!--i:usercheck--> **Bir oturum açma yöntemi seçersin**: GitHub, Google, SUSE (id.suse.com) veya e-postayla gönderilen bir bağlantı. Üç OIDC sağlayıcısı için, bizim değil onların gizlilik politikası kapsamında sağlayıcının kendi giriş sayfasına gidersin ve sertifika hizmeti yalnızca doğrulanmış bir e-posta adresi ve sağlayıcının adını geri alır. E-posta bağlantısı için yazdığın adres, yalnızca o tek bağlantıyı iletmek üzere işlemsel e-posta hizmeti **Resend**'e gider.
- <!--i:lock--> **Kısa ömürlü bir çerez yönlendirmeyi korur.** Sertifika hizmeti, `HttpOnly` olan, `/api/ca` ile sınırlı ve on dakika içinde süresi dolan `lolly_ca_state` çerezini oluşturur. İzleme tanımlayıcısı yerine rastgele bir değer taşır, yalnızca oturum açma yönlendirmesinin taklit edilmesini önlemek için vardır ve oturum açma tamamlanır tamamlanmaz temizlenir.
- <!--i:eyeoff--> Oturum açma uç noktalarının **kötüye kullanımını önlemek için IP adresin kısa süreliğine kullanılır**; böylece tek bir betik gelen kutusunu dolduramaz veya e-posta kotasını tüketemez. Lolly, adresi kısa ömürlü kötüye kullanım denetimi deposuna ulaşmadan önce SHA-256 özetine dönüştürür; böylece ham adres oraya gönderilmez. Özet anonim değil, takma adlıdır: depoyu elinde tutan biri, tüm olasılıkları deneyerek bir IPv4 adresini geri elde edebilir. Kovanın süresi yaklaşık bir dakika sonra dolar ve başka hiçbir şey için kullanılmaz. Sıradan barındırma erişim günlükleri ayrıdır ve aşağıda açıklanır.
- <!--i:seal--> **Hizmet bir sertifika düzenler** ve doğrulanmış e-posta adresini cihazının açık anahtarına bağlar. Özel anahtar cihazda kalır: istemci, bağlanmış bir sahiplik kanıtıyla bir sertifika isteği gönderir ve iki düzenleyici modundan hiçbirine cihazın özel anahtarı gitmez.
- <!--i:check--> **İmzalama yerel kalır.** Eski düzenleyiciyle bir dışa aktarma, sertifika hizmetine istek gerektirmez. Yönetilen bir kimlik ayrıca düzenleyicisinden güncel, imzalı bir iptal listesi gerektirir; istemci yapılandırılmış güncellik süresi içinde önbellekteki listeyi kullanabilir ve onu yenilemek, dışa aktarma sırasında sertifika hizmetiyle iletişim kurabilir. Eksik, süresi dolmuş veya geçersiz durum, yönetilen kimliğin kullanılmasını engeller.
:::

::: details Her düzenleyici modunda saklama ve geri çekme
**Eski barındırılan düzenleme hizmeti**, işletmecinin koyduğu üst sınıra tabi olarak 7, 30, 90 veya 365 gün sunar. Kimlik envanteri ve düzenleme günlüğü tutmaz; bu yüzden kimin sertifika aldığını arayamaz veya o kişinin sertifikalarını iptal edemez; geri çekme, geçerlilik süresinin dolmasıyla sağlanır.

**Yönetilen kuruluş düzenleme hizmeti**, kendi kök ve düzenleyici güven politikasıyla varsayılan olarak en fazla 24 saat ve üst sınır olarak yedi gün geçerlilik süresi kullanır ve imzalama, işletmecisinin yapılandırdığı Vault düzenleyicisine gider. Kayıt uygulaması, yalnızca anahtarlı bir kimlik doğrulama tanımlayıcısını ve istek özetini en fazla on dakika tutan, paylaşılan tek kullanımlık bir kabul deposu kullanır; kimlik envanteri veya sertifika yanıtlarının önbelleğini saklamaz. PKI sağlayıcısının, denetim aygıtlarının, ağ geçitlerinin ve yedeklerinin kendi veri akışları vardır. Sıradan sertifika düzenleme depolaması kapalıyken bile sertifikaya dayalı iptal, e-posta kimliği dahil sertifikayı tutabilir ve iptal seri numaraları ve denetim tanımlayıcıları ilişkilendirilebilir kalabilir; bu envanteri, kimlerin erişebileceğini ve ne kadar saklanacağını işletmecinin politikası belirler.

Yönetilen bir cihaz, cihazın kimliği doğrulanmış kanıtıyla kendi sertifikasının iptalini isteyebilir ve hiçbir API cihazın özel anahtarını istemez. İşletmeci, güven politikası üzerinden bir düzenleyiciyi geri çekebilir. Lolly, kişilerden sertifikalara bir eşleme tutmaz; bu yüzden ayrılan bir kişinin sertifikalarını iptal etmek işletmecinin tuttuğu kayıtlara bağlıdır ve PKI kayıtları, denetim kayıtları, alıcılar ve yedekler işletmecinin politikasını izler. [Sertifika hizmeti tasarımı](https://github.com/lolly-tools/lolly/blob/main/services/ca/README.md), düzenleyicinin anahtar muhafazasını, sağlayıcının saklama politikasını ve yeterliliğini kapsar.
:::

<!--i:eti-building-->
## Lolly Work ile kuruluş hizmetleri

**Lolly Work**, Lolly projesinin isteğe bağlı kuruluş hizmetidir; bir örnek çalıştıran her kuruluş tarafından ayrı olarak kurulur. Bir örneğe bağlanmak, yerel düzenlemenin yanına o sunucuda tutulan verileri ekler. Kurulumun gizlilik politikası, erişim denetimleri, alıcıları, saklama süreleri ve yedeklerinden işletmecisi sorumludur.

Bir çalışma alanı bağlıyken uygulamanın ilk ekranındaki gizlilik satırı bunu söyler: çalışma alanı, projelerine kaydettiklerini veya onun üzerinden paylaştıklarını ve oturum açmalarının ve orada yaptıklarının günlüğünü tutar.

| İş akışı | Kuruluşun hizmetinin işlediği veriler |
|---|---|
| Oturum açma ve hesap sağlama | Kimlik sağlayıcısının beyanları, hesap ve grup üyeliği, oturum açma oturumları ve cihaz bilgileri. Oturum açmayı OIDC yönetir; yöneticiler SCIM üzerinden hesap sağlayabilir ve devre dışı bırakabilir |
| Paylaşılan katalog ve projeler | Yüklenen varlıklar, meta veriler ve sürümler; paylaşılan projeler ve oturumlar; yayımladığın marka sayfaları; yapılandırılmış kitaplık sağlayıcılarından alınan içerik |
| Lolly Work işbirlikleri | Örnek üzerinden gönderilen paylaşılan oturum durumu, canlı düzenlemeler ve katılımcıların mevcudiyeti; kaydedilen durum, depolama politikası kapsamında kalıcı olur |
| Yönetilen paylaşım bağlantıları | Son kullanma tarihi ve isteğe bağlı parola koruması gibi bağlantı hedefi ve erişim ayarları; istekler örnek üzerinden çözümlenir ve iptal edilebilir |
| İnceleme ve teslimat | Gönderilen içerik, onay kararları, seçilen hedef, teslimata hazırlanan dosyalar ve teslimat makbuzları |
| Sunucu render'ları ve toplu işler | Gönderilen araç girdileri, render istekleri, durum ve saklanan çıktı dosyaları. Bu işler cihazın yerine sunucuda çalışır |
| Kullanım raporlama | Aşağıdaki telemetri politikasına göre bunları gönderen bir istemciden gelen araç kimliği, biçim ve varlık kimliği gibi izin listesindeki olay etiketleri |
| Denetim | Kurallara tabi işlemler için, kullanım telemetrisinden ayrı tutulan aktör ve eylem kayıtları |

Hizmet, sertifika hizmetinin çerezinden ayrı kimlik doğrulama çerezleri kullanır; oturum açmış üyeler için `lw_session` ve etkinleştirildiği yerlerde misafir erişimi için `lw_guest` bunlara dahildir. Politika yenilemeleri, her biri için ayrı bir tıklama olmadan uygulama kullanımdayken istek yapabilir. Bu, yapılandırılan örneğe giden trafiktir; Lolly projesine, işletmediği kurulumlar hakkında bir rapor değildir.

**Yeni sürüm denetimi.** Bir Lolly Work sunucusu, daha yeni bir sürüm için GitHub'da yayımlanan chart dizinini günde bir kez denetler; herhangi bir `helm repo update` komutunun yaptığı aynı sade istekle, örnek veya kullanıcıları hakkında hiçbir şey taşımaz. Varsayılan olarak açıktır ve örneğin yöneticisi kapatabilir veya bir aynaya yönlendirebilir ([`updates`](/info/work-configuration.html#updates)).

**Kullanım telemetrisinin üç düzeyi vardır.** Lolly'nin kendi uygulamaları şu anda kullanım olayı göndermez; bu yüzden bu düzeyler işletmecinin bağladığı başka bir istemciden gelen olaylara uygulanır. `off` kullanım olayı saklamaz, `aggregate` kullanıcı kimliklerini çıkarır ve `standard` olayları kullanıcılarla ilişkilendirebilir. Varsayılan düzey `standard` olduğundan işletmecisi `off` seçmedikçe bir örnek aldığı kullanım olaylarını saklar. Varsayılan ilişkilendirme politikası `opt-in` olduğundan kullanıcı kimliği saklanmadan önce onayın gerekir; işletmeci bunun yerine `telemetryAttribution: default` ile kullanıcılarla ilişkilendirilmiş raporlama yapılandırabilir. İzin verilen öznitelikler etikettir, asla araç girdisi değerleri değildir. Bkz. [Lolly Work telemetrisi](/info/work-telemetry.html).

**Denetim ayrıdır.** Kurallara tabi eylemler, telemetri onayın ne olursa olsun kimliği belirli bir denetim kaydı tutabilir. Telemetriyi kapatmak paylaşılan oturum depolamasını, onay kayıtlarını, render işi depolamasını veya denetimi kapatmaz. Denetim günlüğünün takma adlandırılması dahil saklama ve silmeyi işletmeci yönetir; bkz. [Lolly Work depolama ve veri yaşam döngüsü](/info/work-data-lifecycle.html).

| | Cihazın | Kuruluşunun örneği |
|---|---|---|
| Ne tutar | Kişisel işlerin, tercihlerin ve önbelleklerin | Paylaşılan işler, hesaplar, yüklemeler, onaylar, render'lar, denetim ve yapılandırılmış telemetri |
| Kim siler | **Clear all my data** veya tarayıcının site verileri ile sen | Örneğin kendi denetimleri üzerinden işletmeci |
| Kime sormalı | Kimseye: kayıtlar cihazında | Erişim, dışa aktarma veya silme için örneğin işletmecisine |

::: warning Yerel silme, sunucudan silme değildir
Bir örnekten ayrılmak veya tarayıcını temizlemek, kuruluşun sakladığı kayıtları veya yedekleri değil, yerel durumu kaldırır. Kişisel [Sync](/info/sync.html) ve **Export my data**, kuruluşun hizmetini değil, cihazını yedekler. Herkese açık [lolly.work](https://lolly.work) demosu durumunu yalnızca bellekte tutar ve işin için kalıcı depolama değildir.
:::

<!--i:eti-camera-->
## Tarayıcı uzantısı

**Lolly URL Screenshot** tarayıcı uzantısı bizim için kişisel veri toplamaz. Analitiği, izlemesi ve kendine ait sunucusu yoktur. [Tarayıcı uzantısı](/info/extension.html) sayfası nasıl çalıştığını açıklar.

**Ne yapar.** Lolly web uygulaması, bir web sayfasının ekran görüntüsünü veya bir web sitesinden tasarım sistemi başlatmak için sayfanın içeriğini isteyebilir. Her istek, uzantıda isteyen siteyi, ekran görüntüsü mü yoksa sayfa içeriği mi istediğini ve sayfa adresini gösteren bir onay penceresi açar. Yalnızca **Approve once** düğmesine bastıktan sonra uzantı o sayfayı geçici bir arka plan sekmesinde açar, ekran görüntüsünü alır veya sayfayı okur, sonucu isteyen Lolly sekmesine verir ve sekmeyi kapatır. SVG ekran görüntüsü için o sekmede sayfanın düzenini, resimlerini ve yazı tipi dosyalarını da okur ve uygulama bunları cihazında şekillere dönüştürür. Her istek kendi onayını gerektirir.

**Veriler.**

- <!--i:shieldcheck--> **Hiçbir şey toplamıyoruz.** Sonuç, aynı tarayıcıda yalnızca isteyen Lolly sayfasına gider. Uzantı sayfa içeriği saklamaz ve başka alıcı eklemez.
- <!--i:globe--> **Ağ istekleri.** Onayladığın sayfa, kendisinin istediği her şeyle birlikte herhangi bir sekmede olduğu gibi yüklenir. Bir sayfanın içeriğini okumak, o sayfanın stil sayfalarını ve simge ve logo görsellerinden birkaçını da sayfanın içinden getirir ve bu getirme işlemleri başka sitelere çerez göndermez. Bir SVG ekran görüntüsü, sayfanın yüklediği yazı tipi dosyalarını sayfadan yeniden ister; tarayıcın bunu genellikle önbelleğinden karşılar. Uzantı başka istek yapmaz ve hiçbiri bir Lolly sunucusuna gitmez.
- <!--i:lock--> **Tarayıcı oturumun.** Sayfa, kendin açtığında olacağı gibi tarayıcı oturumunla yüklenir; bu yüzden oturum açtığın bir sayfa sonuca özel bilgiler koyabilir.
- <!--i:link--> **Onayladığın adresler** yalnızca o tek istek için o tek sayfayı yüklemekte kullanılır. Günlüğe kaydedilmez veya paylaşılmazlar.

**İzinler.**

- <!--i:wrench--> **`debugger`**: Lolly masaüstü uygulamasının kullandığı aynı mekanizma olan DevTools Protocol üzerinden ekran görüntüsü almak ve bir SVG için geçici sekmede sayfa taramasını çalıştırmak için.
- <!--i:monitor--> **`tabs`**: geçici sekmeyi açıp kapatmak ve onayladığından beri ne Lolly sayfasının ne de hedef sayfanın başka bir adrese geçmediğini denetlemek için.
- <!--i:code--> **`scripting`**: o isteği onayladıktan sonra geçici sekmede bir sayfanın içeriğini okumak için.
- <!--i:database--> **`storage`**: geçici sekmelerinin kimliklerini oturum depolamasına kaydetmek için; böylece tarayıcı bir istek sırasında uzantıyı durdurursa sekmeler yine kapanır. Sayfa içeriği saklanmaz.
- <!--i:check--> **İsteğe bağlı site erişimi (`http://*/*`, `https://*/*`)**: kurulumda verilmez. **Approve once** düğmesine bastığında uzantı Chrome'dan o istekteki tek siteye erişim ister ve Chrome her site için ilk seferinde sana sorar. Daha önce izin verdiğin bir site, her istek için yine yeni onay gerektirir.

Bunların hiçbiri, onayladığın tek isteğin ötesinde gezinmeni okumak, izlemek veya iletmek için kullanılmaz.

<!--i:eti-map-pin-->
## Dağıtım sunucuları ve veri işleyenler

Herkese açık katalog dosyaları, araçlar ve görüntüleme sürümleri varsayılan olarak uygulamanın kendi adresinden gelir. İçeriğe göre adreslenen adlar, isteği kimin aldığını değil, dosyanın nereden getirildiğini değiştirir. Bu dağıtım özelliği üçüncü taraf CDN etkinleştirmez. TLS'i sonlandıran bir CDN, aynı tarayıcı ana bilgisayar adı altında bile IP adresleri ve kendisine iletilen çerezler veya bearer kimlik bilgileri dahil istek ayrıntılarını alır; bu yüzden CDN ekleyen işletmeci yeni bir veri işleyen kullanmış olur.

**Herhangi bir CDN veya dış model sunucusu eklemeden önce** yönetici; veri işleyenin adını, ana bilgisayar adını, tabi olduğu yargı bölgelerini, alınan meta verileri, saklama ve aktarım düzenlemelerini yayımlamalıdır. [Dağıtım kurulumu](/info/deploy-delivery.html) açıklanması gerekenleri listeler. Özel çalışma alanı yanıtları paylaşılan önbellekleri atlar: kişisel sonuçlar, erişim retleri ve hatalar `private, no-store` kullanır ve izin verilen özel bir yanıt, herkese açık hale gelmeden tarayıcında yeniden doğrulanabilir.

Referans hizmetler aşağıdaki barındırmayı kullanır. Bu bir ana bilgisayar adı listesidir; başka bir kuruluşun örneğinin aynı bölgeyi kullandığı iddiası değildir.

| Ana bilgisayar adı veya hizmet | İşlev ve alıcı | Bölge ve veri işleme |
|---|---|---|
| lolly.tools | Herkese açık uygulama, katalog, render ve sertifika hizmetleri; UpCloud barındırması | Frankfurt, Almanya. İstek ayrıntıları altyapı günlüklerinde görünebilir; sıradan yerel düzenleme cihazda kalır |
| lolly.ing | Yönetilen çalışma alanı ve belge ajanı hizmetleri; UpCloud barındırması | Frankfurt, Almanya. Özel veritabanı ve dosya depolaması aynı sunucudadır. Hesaplar, paylaşılan içerik ve hizmet kayıtları örnek yöneticisinin politikasını izler |
| mcp.lolly.tools | Planlanan isteğe bağlı kimlik doğrulamalı MCP ağ geçidi ve özel sonuç indirmeleri; UpCloud barındırması | Frankfurt, Almanya, aynı barındırma veri işleyeniyle. Etkinleştirme beklemede. Ağ geçidi, istek ayrıntılarını ve çağrıyı yapanın gönderdiği parametreleri veya dosyaları alacaktır |
| lolli.li | Herkese açık sürüm ve model dosyaları; uygulama kümesinden ayrı UpCloud Managed Object Storage | Frankfurt, Almanya, UpCloud'un europe-2 nesne depolama bölgesinde. Bir indirme, modelin daha sonra işlediği girdileri değil, istek ayrıntılarını gönderir |
| Yapılandırılmış kimlik sağlayıcısı | Google, GitHub veya işletmecinin OIDC sağlayıcısı | Oturum açma, o sağlayıcının politikasını izler. Ana bilgisayar adı, bölge ve aktarım düzenlemeleri için örneğin işletmecisine sor |
| Yapılandırılmış varlık sağlayıcısı | Brandfolder veya işletmecinin seçtiği başka bir kitaplık | Sağlayıcı izin verilen kitaplık isteklerini alır. Kaynak izinleri ve örneğin politikası erişimi yönetir; ana bilgisayar adları ve bölgeleri için işletmeciye sor |
| Yapılandırıldığında e-posta ile kayıt | Resend, istenen oturum açma bağlantısını iletir | O mesaj için hedef e-posta adresini alır; kendi işleme koşulları geçerlidir |

Referans uygulama başka barındırma, veritabanı veya kötüye kullanım denetimi sağlayıcısı kullanmaz. Bir işletmeci farklı bir örnek için başka sağlayıcılar seçebilir ve barındırma, kimlik, varlık ve e-posta sağlayıcılarının her biri için ayrı açıklama gerekir. Model sunucusunun [nesne depolama bölgesi](https://upcloud.com/docs/products/managed-object-storage/availability/), uygulamanın bölgesinden ayrı doğrulanır.

**İsteğe bağlı, kimliği doğrulanmış çağırana bağlı MCP indirme bağlantıları.** Bir işletmeci, kimlik doğrulamalı, tek replikalı bir ağ geçidinde büyük sonuçlar için indirme bağlantılarını açabilir. Varsayılan olarak kapalıdırlar. `lolly.tools/api/mcp` adresindeki anonim ağ geçidi sonuçları yanıtın içinde döndürür ve bu bağlantıları asla oluşturmaz. Planlanan kısıtlı ana bilgisayar adı, Frankfurt'taki aynı UpCloud veri işleyeni üzerinde `mcp.lolly.tools` adresidir; etkinleştirme beklemededir ve bu sayfa çalışan bir indirme bağlantısı hizmeti olduğunu iddia etmez. Bağlantılar üçüncü taraf CDN eklemez.

::: details İşletmecinin MCP indirme bağlantıları nasıl tutulur
Yalnızca dosya kapsamı olan, kimliği doğrulanmış bir çağıran bağlantı alabilir ve onu getirmek için aynı çağıranın bearer belirteci gerekir: aynı hesabın başka bir belirtecini değil, render çağrısındaki doğrulanmış bearer belirtecini kullan. İznin süresi 300 saniye içinde dolar. Sahiplik ve sonuç araması ağ geçidinin belleğinde kalır ve çıktı baytları, süre dolduktan sonra temizlenen veya düzgün kapanışta kaldırılan özel geçici dosyalara gider. Ağ geçidinin yeniden başlaması mevcut bağlantıları geçersiz kılar. Tutulan sonuçlar, bearer belirteci başına 64 MiB, ağ geçidinin tamamında 256 MiB ve bekleyen veya tutulan 200 dosyayla sınırlıdır. Günlük CPU ve kodu çözülmüş bayt bütçeleri, sonuçları hem tutulduklarında hem indirildiklerinde sayar. Yanıtlar `private, no-store` ve `Referrer-Policy: no-referrer` kullanır. Bir bağlantının belirteci tek başına başka bir kişinin veya ajanın sonucu okumasına izin vermez.
:::

<!--i:eti-file-->
## Altyapı günlükleri

Bu bölüm, herkese açık lolly.tools kurulumunu açıklar. Barındırma platformu sıradan istek ayrıntılarını kaydeder: IP adresi, istenen yol, zaman damgası ve kullanıcı aracısı. Yerel düzenlemeler o sunucuya ulaşmaz. Yukarıda açıklandığı gibi bir render bağlantısının sorgu dizesi, çağrıyı yapanın sağladığı metni içerebilir. MCP dosya araçları kendilerine verilen baytları bellekte işler. Bir Lolly Work örneği, işletmecisinin günlük politikasına göre yukarıda açıklanan kayıtları da tutar.

**Herkese açık hizmetler uygulama günlüklerini en az düzeyde tutar.** MCP sunucusu başlangıç, yapılandırma ve render uyarılarını kaydeder; kendine ait istek günlüğü tutmaz ve belirteçleri veya çağrıyı yapanların adreslerini kaydetmez. Penpot aktarması her komut adını ve Penpot'un yanıt durumunu kaydeder; başlıkları, belirteçleri veya dosyayı asla kaydetmez. Sertifika hizmeti başlangıç ayarlarını ve yapılandırma uyarılarını, ayrıca başarısızlık durumunda ayrıntılardan arındırılmış iki satırı kaydeder: alıcı adresi olmadan bir gönderme hatası durum kodu ve hata metni, yığın izi veya URL olmadan sabit bir hata satırı; çünkü bir sağlayıcı hatası kimlik değerleri veya kimlik bilgileri taşıyabilir. Günlükteki diğer her şey barındırma platformundan gelir.

lolly.tools için UpCloud üzerindeki istek günlüğü tutma, döndürme ve saklama işlemlerini örnek yöneticisi kontrol eder. Bu sayfa, doğrulanmamış bir azami günlük saklama süresi belirtmez. Güncel takvim ve sunucuda tutulan günlüklerle ilgili her türlü talep için aşağıdaki veri sorumlusuyla iletişime geç. Başka bir örnek için, günlük dışa aktarmaları veya diğer veri işleyenler dahil, işletmecisinin ayarları geçerlidir.

<!--i:eti-stamp-->
## Hukuki dayanaklar, saklama ve alıcılar

Bu tablo referans **lolly.tools** kurulumunu kapsar. Kuruluşunun Lolly Work örneğinin hukuki dayanaklarını veya saklama sürelerini belirtmez; işletmecisi bunları kendi politikasında sağlar.

| İşleme | Hukuki dayanak (GDPR Art. 6) | Saklama süresi |
|---|---|---|
| Cihazındaki her şey (belgeler, tercihler, önbellek, sayaçlar) | **Bizim yaptığımız bir işleme hiç yoktur**: bize asla ulaşmaz. Cihazındaki depolama, istediğin hizmet için kesinlikle gereklidir (ePrivacy Art. 5(3)); bu yüzden onay gerektirmez | Sen silene kadar |
| Eski barındırılan Content Credentials kaydı sırasında e-posta adresin | **Art. 6(1)(b)**, açıkça istediğin bir hizmetin yerine getirilmesi | Eski hizmette kimlik envanteri veya sertifika düzenleme günlüğü yoktur; e-posta istek sırasında kullanılır ve sertifikana eklenir. Yönetilen kuruluş PKI, denetim ve iptal kayıtlarının saklanması işletmecisinin politikasını izler |
| Oturum açma uç noktaları ve herkese açık render, görsel ve MCP uç noktalarına hız sınırı uygulamak için IP adresinden oluşturulan takma adlı SHA-256 özeti | **Art. 6(1)(f)**, ücretsiz bir hizmetin ve üçüncü tarafın e-posta kotasının kötüye kullanımını önlemeye yönelik meşru menfaatimiz. Ham adres sınırlayıcıya gönderilmediği, özet yalnızca kötüye kullanım denetimi için kullanıldığı ve kendiliğinden sona erdiği için bunun dengeleme testini geçtiğini düşünüyoruz | Kötüye kullanım denetimi deposunda yaklaşık bir dakika; sonrasında tutulmaz |
| Barındırma erişim günlükleri (IP, yol, zaman damgası, kullanıcı aracısı) | **Art. 6(1)(f)**, hizmet güvenliği, kötüye kullanımın önlenmesi ve arızaların teşhis edilmesine yönelik meşru menfaatimiz | Yönetici tarafından yapılandırılan döndürme ve saklama; güncel takvim için veri sorumlusuyla iletişime geç |

**Alıcılar.** Alıcı kategorileri, uygulamanın veritabanını ve kötüye kullanım denetimi deposunu barındıran barındırma sağlayıcımız (UpCloud) ve yalnızca e-postayla oturum açma seçeneğini kullanırsan işlemsel e-posta sağlayıcısıdır (Resend). Kötüye kullanım denetimi deposu yalnızca kısa ömürlü özetleri alır, ham IP adresini asla almaz. GitHub, Google veya SUSE (id.suse.com) ile oturum açarsan doğrudan o sağlayıcıyla, onun kendi gizlilik politikası kapsamında işlem yaparsın ve bize doğrulanmış bir e-posta adresi dışında hiçbir şey söylemezler. Kişisel verileri başka kimseyle paylaşmayız ve veri satmayız, reklam yayımlamayız veya kullanıcı profillemesi yapmayız.

**AEA dışına aktarımlar.** Referans uygulamanın barındırması, veritabanı ve dosya depolaması Frankfurt'tadır. İsteğe bağlı kimlik, e-posta ve varlık sağlayıcılarının AEA dışından erişimi de içerebilen kendi işleme konumları ve koşulları vardır ve bir sunucunun bölgesi tek başına her alıcının tabi olduğu yargı bölgesini belirlemez. Geçerli sağlayıcı sözleşmeleri ve aktarım düzenlemeleri için veri sorumlusuyla iletişime geç; başka bir örnek için işletmecisine sor. Avrupa Komisyonu'nun [Standart Sözleşme Maddeleri](https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/standard-contractual-clauses-scc_en), bu tür aktarımlar için kullanılabilecek güvencelerden biridir; bu sayfa, doğrulanmamış bir sağlayıcı sözleşmesinin bunları kullandığını iddia etmez.

**Otomatik karar verme.** Yok. Profilleme ve hukuki veya benzer derecede önemli etkileri olan otomatik karar yoktur (Art. 22).

<!--i:eti-smile-->
## Çocukların gizliliği

Uygulamanın sıradan yerel kullanımı lolly.tools adresine kişisel içerik göndermez. İsteğe bağlı Content Credentials kaydı bir e-posta adresi alır ve çocuklara yönelik veya çocuklar için tasarlanmış değildir. Kuruluş hizmetlerinin, işletmecilerinin politikası kapsamında kendi hesapları ve veri işleme uygulamaları vardır.

<!--i:eti-user-check-->
## Hakların

Yalnızca cihazında saklanan kayıtlar için verilere kendin erişebilir, onları düzeltebilir, silebilir ve taşıyabilirsin. Veriler, tarayıcının veya uygulamanın depolama alanında, inceleyebileceğin, dışa aktarabileceğin (yukarıdaki **Export my data**) veya silebileceğin (**Clear all my data** veya tarayıcının site verileri) bir biçimde bulunur.

Hukuken GDPR Articles 15-22 kapsamında kişisel verilerine **erişme**, onları **düzeltme**, **silme**, işlenmelerini **kısıtlama** veya işlemeye **itiraz etme** (meşru menfaate dayandırdığımız her şey dahil), **veri taşınabilirliği** ve işlemenin onaya dayandığı durumlarda, onayını geri çekmeden önce gerçekleşenlerin hukuka uygunluğunu etkilemeden **bu onayı istediğin zaman geri çekme** hakkına sahipsin.

Herkese açık sertifika hizmeti düzenleme günlüğü tutmaz. Altyapı günlükleri istek ayrıntıları içerebilir; bu yüzden bu politika, barındırma ortamının kişisel veri tutmadığını vaat etmez. Bu kayıtlara erişim, bunların silinmesi veya başka bir talep için veri sorumlusuyla iletişime geç; hangi kayıtların bulunduğunu ve ne yapılabileceğini açıklayacağız. Bir kuruluşun tuttuğu işler, kimlikler, telemetri ve denetim kayıtları için Lolly Work işletmecinle iletişime geç, çünkü yerel dışa aktarma ve silme denetimleri o kopyalara ulaşmaz.

**Şikâyet etme hakkın var.** Verilerini uygunsuz biçimde işlediğimizi düşünüyorsan bir veri koruma denetim makamına şikâyette bulunabilirsin: AB'de ikamet ettiğin, çalıştığın veya ihlalin gerçekleştiğine inandığın ülkedeki makama (Art. 77). Baş denetim makamımız Almanya'nın Ansbach şehrindeki *Bayerisches Landesamt für Datenschutzaufsicht* (BayLDA) kurumudur. Sorunu düzeltme fırsatı istememize rağmen önce bizimle iletişime geçmen gerekmez.

<!--i:eti-history-->
## Bu politikadaki değişiklikler

Bu belge her değiştiğinde üstteki tarih değişir. Cihazından çıkanları veya saklananları değiştiren bir değişiklik, sessiz bir düzenleme yerine burada kendi satırını alır. Neyin değiştiğini görmek için sor (aşağıda) veya [herkese açık kaynakla](https://github.com/lolly-tools/lolly/commits/main/docs/privacy.md) karşılaştır.

::: details Önceki değişiklikler, 29 Eylül - 23 Ekim 2026
**29 Eylül 2026:** isteğe bağlı lolly.work hizmeti, kuruluşun tuttuğu içerik, kimlik doğrulama çerezleri, kullanım telemetrisi ve denetim kayıtları ve yerel silme ile sunucuda saklama arasındaki ayrım netleştirildi. Bunlar mevcut isteğe bağlı iş akışlarıdır; yerel düzenleme için yeni bir yükleme zorunluluğu değildir.

**11 Ekim 2026:** kullanımdan kaldırılan Vercel barındırma açıklamasının yerini UpCloud uygulama ana bilgisayar adı envanteri aldı, isteğe bağlı kimlik ve varlık sağlayıcıları birbirinden ayrıldı ve içeriğe göre adreslenen dağıtım ve sonuçların tutulduğu MCP indirme modu açıklandı. Bu değişiklik üçüncü taraf CDN etkinleştirmez. Günlük saklama, belirtilen bir Vercel planı varsayılanı yerine yönetici tarafından kontrol edilir.

**22 Ekim 2026:** mevcut davranışın açıklaması düzeltildi. Tarayıcı uzantısı bölümü artık her istek için onay penceresini, her seferinde tek site için istenen site erişimini ve bir web sitesini okurken stil sayfası ve simge getirme işlemlerini kapsıyor. Ayrıca şunlar düzeltildi: Send to Google Drive ve Meeting Planner satırları, SEAL notu (hiçbir Lolly uygulaması DNS'te SEAL anahtarı aramaz), kuruluş hizmetinin varsayılan kullanım telemetrisi düzeyi, MCP görsel araçları ve herkese açık hizmetlerin uygulama günlükleri. Yazılımın kendisi değişmedi.

**23 Ekim 2026:** politika her isteği neyin başlattığına göre yeniden düzenlendi ve daha önce kapsamadığı mevcut davranışlar açıklandı: yerel ağ adresleri taşıyan özel işbirliği davetleri, masaüstü uygulamasındaki Nearby, Allow AI control, bir web sitesinden tasarım sistemi okuma, emoji kümeleri, Meeting Planner'ın cihazdaki şehir araması önbelleği, Trash ve Settings → Storage'ın listelediği diğer kayıtlar. İki ifade düzeltildi: Bluesky ve Discord yalnızca masaüstüyle sınırlı değildir ve kişinin gönderim için seçtiği her sunucu hem web hem masaüstü uygulamalarında işletmecinin onayını gerektirir; IP adresinin hız sınırlaması için kullanılan özeti anonim değil, takma adlıdır. Yazılımın kendisi değişmedi.
:::

**3 Kasım 2026:** Send sonrasında paylaşım bağlantıları eklendi. Create a share link düğmesine bastığında Lolly, dosyayı gönderdiğin sağlayıcıya (Google Drive, Dropbox, OneDrive veya kendi Nextcloud'un) bir ek çağrı yapar ve Stop sharing, bağlantıyı kapatmak için başka bir çağrı yapar. S3 paylaşım bağlantısı cihazında oluşturulur ve hiçbir şey göndermez. Yeni bir sunucu devreye girmez ve Lolly, sunucuda hiçbir bağlantının veya belirtecin kopyasını tutmaz.

**3 Kasım 2026:** masaüstü uygulamasındaki **Ask an agent** eklendi: panel açıldığında uygulamanın bilgisayarda neleri aradığı ve sorduğunda, o sağlayıcıdaki kendi hesabın altında ajanın sağlayıcısına nelerin gittiği.

**10 Kasım 2026:** mevcut davranışın açıklaması tamamlandı ve düzeltildi. Cihaz listesi artık profil bilgilerini, imzalama kimliğini, saklanan oturum açma bilgilerini ve paylaşılan bağlantıları, bir kez sorulan sorulara yanıtlarını, son indirmeleri, bağlı örneğin kayıtlarını, tarayıcının dosya depolamasındaki çalışma dosyalarını ve belgelendirme sayfalarının tuttuklarını adlandırıyor. Düzeltilenler: yerel kullanım sayaçları kendi yedek dosyanın ve Sync kopyanın içinde taşınır; Clear all my data kuruluş oturumunu sonlandırmaz; Trash, 30 günden eski öğeleri Projects'i bir sonraki açışında boşaltır; web'de hatırlanan Google Drive bağlantısı Google hesabının e-posta adresiyle etiketlenir; Lolly'nin kendi uygulamaları Lolly Work örneğine kullanım olayı göndermez. Ayrıca 1.2.0'ın eklediği çalışma alanı gizlilik satırı ve bir örnekte yayımlanan marka sayfaları açıklandı. O gizlilik satırı dışında yazılımın kendisi değişmedi.

**10 Kasım 2026:** Lolly Work yeni sürüm denetimi eklendi: bir Lolly Work sunucusu, yöneticilerine daha yeni bir sürümü bildirmek için yayımlanan chart dizinini günde bir kez okur. İstek, örnek veya kullanıcıları hakkında hiçbir şey taşımaz ve yönetici bunu kapatabilir veya bir aynaya yönlendirebilir.

<!--i:eti-mail-->
## Kim sorumlu ve bize nasıl ulaşabilirsin

lolly.tools için **veri sorumlusu**:

> SUSE Software Solutions Germany GmbH
>
> Frankenstraße 146
>
> 90461 Nürnberg
>
> Almanya

SUSE, [privacy@suse.com](mailto:privacy@suse.com) adresinden ulaşılabilen bir **Veri Koruma Görevlisi** atamıştır. Yukarıdaki "Hakların" kapsamındaki her türlü resmî talep için o adresi kullan.

Lolly'nin nasıl çalıştığı, bir şeyin neden öyle olduğu veya bu belgede bir düzeltme gibi Lolly'nin kendisiyle ilgili her konuda **Andy Fitzsimon** ile [fitzy@suse.com](mailto:fitzy@suse.com) adresinden iletişime geç.

Kendi sunucunda barındırdığın veya kurumsal bir Lolly örneği için onu işleten kişiyle iletişime geç: işletmeci kendi kurulumunun veri sorumlusudur. SUSE ve Lolly açık kaynak projesi, işletmedikleri kurulumlar için veri tutmaz.
