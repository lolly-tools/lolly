# Gizlilik Politikası

*Son güncelleme: 23 Ekim 2026*

**Lolly'de üretim cihazında gerçekleşir.** Bir aracı açmak, yazmak, önizlemek, dışa aktarmak ve bir dosyayı denetlemek; hepsi telefonundaki, bilgisayarındaki veya tarayıcındaki uygulamada çalışır. Hesap gerekmez ve uygulama bunlar için çerez ayarlamaz.

**Ürettiklerin cihazından yalnızca sen istediğinde çıkar.** Bir Google Font eklemek, Drive'a veya Dropbox'a dosya göndermek, Sync'i açmak, radyo çalmak veya cihaz üzerinde çalışan bir yapay zekâ modelini indirmek, her biri senin başlattığın bir istek oluşturur. Uygulama ayrıca araçlarını ve güncellemelerini kendi adresinden alır; bu isteklerde ürettiğin hiçbir şey yer almaz. [Uygulamanın yapabileceği her ağ isteği](#every-network-request-the-app-can-make) bunları sunucu sunucu listeler.

**Bazı Lolly hizmetleri bir sunucuda çalışır.** Render bağlantıları, görsel getirici, yapay zekâ ajanı uç noktası ve doğrulanmış kimlik hizmeti yalnızca onlara gönderdiğini alır ve bunu bu sayfada belirtilenden uzun süre tutmaz.

**Kuruluşunun Lolly Work örneği farklıdır.** Oraya koyduğun paylaşılan işleri saklar ve bu veriye, bu politikanın değil, örneği işleten tarafın politikası uygulanır.

::: figure privacy-where-data-goes
Verilerin nereye gittiği: bir istek başlatmadıkça cihazında kalır ve her istek türünün kendi hedefi vardır.
:::

## Bu politikanın kapsamı

Lolly, herkesin çalıştırabileceği açık kaynaklı bir yazılımdır: bir motor, web, masaüstü, mobil ve terminal için uygulama kabukları ve bir tarayıcı uzantısı. Bu politika iki bölümden oluşur:

- <!--i:code--> **Yazılımın kendisi**: nerede çalışırsa çalışsın, verinle neyi yapıp neyi yapmadığı. Bu kodun bir özelliğidir; dolayısıyla bizim de başkasının da her Lolly dağıtımı için geçerlidir.
- <!--i:server--> **lolly.tools**, SUSE'nin işlettiği referans dağıtım: isteğe bağlı sunucu parçalarının işletilmesinde yapılan seçimler; örneğin neyin, ne kadar süreyle ve kim tarafından günlüğe kaydedildiği.

Kendi sunucusunda barındırılan veya kurumsal bir Lolly örneğinde aşağıdaki yazılım davranışı yine geçerlidir; ancak sunucularındaki her şeyden SUSE değil, o örneği *işleten taraf* sorumludur: render uç noktası, MCP sunucusu, sertifika hizmeti ve Lolly Work örneği. Onlardan kendi politikalarını iste. [Adoption & Governance](/info/adoption-governance.html), Lolly'yi işletmenin neleri kapsadığını anlatır.

## Cihazında neler kalır

Lolly'nin web, masaüstü ve mobil uygulamaları render motorunun tamamını cihazda çalıştırır. Kullandığın araçlar, varlıklar ve kodlayıcılar cihazda olduktan sonra render ve indirme için sunucu gerekmez.

**Bağımsız uygulama kullanımı çerez ayarlamaz.** Kuruluş girişinin ve isteğe bağlı doğrulanmış kimlik kaydının kendi çerezleri vardır; bunlar kendi bölümlerinde anlatılır. Uygulama cihazda şu kayıtları tutar:

- <!--i:sliders--> **Arayüz tercihleri**: tema, dil, ses ayarları, kenar çubuğu ve yakınlaştırma boyutları, sıralama ve görünüm seçimleri ve hangi ipuçlarını gördüğün; uygulama açılışını bitirmeden hazır olsun diye `localStorage` içinde.
- <!--i:download--> **Araç kataloğunun ve varlık önizlemelerinin çevrimdışı önbelleği**, böylece galeri bağlantı olmadan çalışır.
- <!--i:hash--> Profil kartındaki istatistikler için **yerel kullanım sayaçları**, örneğin kaç dışa aktarma yapıldığı ve hangi araçların kullanıldığı: `localStorage` içinde küçük, sınırlı bir kayıt; bizim tarafımızdan asla okunmaz ve hiçbir yere gönderilmez.
- <!--i:folder--> **Kendi işlerin**: belgeler, kaydedilmiş oturumlar ve geçmişleri, yüklenen görseller ve yazı tipleri, dosya sonuçları ve önceki sürümler ve silinen öğeleri 30 gün boyunca tutan Çöp Kutusu. Bunlar cihazdaki IndexedDB içinde durur ve Sync veya paylaşımı seçmediğin sürece orada kalır.
- <!--i:globe--> **Meeting Planner'ın şehir aramaları**, her şehir bir kez aransın diye `localStorage` içinde.
- <!--i:cpu--> **İndirilen modeller ve sabitlenen araçlar**: indirmeyi kabul ettiğin cihaz üzerindeki yapay zekâ modelleri ve çevrimdışı kullanım için sabitlediğin araçlar.

**Settings → Storage**, Lolly'nin cihazda ne kadar yer kullandığını gösterir; işlerin, Çöp Kutusu, indirilen modeller, çevrimdışı kopyalar ve önbellekler tek tek listelenir. Oradaki **Clear all my data** yerel kopyayı kaldırır ve önce Sync'i kapatır; tarayıcında sitenin depolamasını temizlemek de aynı sonucu verir. İstediğin hizmet için kesinlikle gerekli olan depolama, ePrivacy Direktifi (Md. 5(3)) uyarınca onay gerektirmez, yalnızca şeffaflık gerektirir; bu belge ve uygulama içindeki bildirim de bunu sağlar.

![Ayarlar'ın telefon genişliğindeki ekranda depolama bölümü: cihazdaki verilerin her kategorisi adıyla listelenir, listenin yanında Clear all my data düğmesi yer alır](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-selbar%2C.profile-row-value%2C.profile-group-value%2C%23store-hero-num%2C%23store-headroom%7Bdisplay%3Anone%7D&format=svg&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

**Export my data**, sakladığın ve denetlediğin bir `lolly-backup` dosyası üretir. Kendin bir yere göndermedikçe sunucularımıza hiç dokunmaz. Bkz. [Data transfer](/info/data-transfer.html).

### Cihazında çalışan yardımcı araçlar

**Strip Hidden Data**, **Compress** gibi bazı araçlar ve **Runs on your device** rozetini taşıyan diğerleri, verdiğin bir dosya üzerinde çalışır. Dosya belleğe okunur, cihazda dönüştürülür ve indirme olarak sana geri sunulur. Yolda sunucu olmadığı için hiçbir zaman yüklenmez. Bu yardımcı araçlar çevrimdışı çalışır ve çıktılarında bizim filigranımız veya meta verimiz bulunmaz.

**Rondocode** tek istisnadır; çünkü senin dosyanı dönüştürmek yerine şarkından yeni ses üretir. Yazdığı her ses dosyası, şarkıyı kaydeden ve yapay zekâ üretimi şarkı sesini bildiren Content Credentials taşır. Export paneli bunu dışa aktarmadan önce söyler; [Rondocode songs](/info/rondocode.html#files-from-the-rondocode-utility) tam olarak nelerin kaydedildiğini listeler.

![Bu araçların taşıdığı rozet: Runs on your device - nothing is uploaded](/t/url-shot?url=%2F%23%2Ftool%2Ftext-helper&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%5Bdata-privacy%5D&dark=1&filename=pv-ondevice-badge)

**Prepare for sharing** ve **Compare** cihazda bellekte çalışır ve sunucuya hiçbir şey göndermez; Prepare, bir sonucu kaydedene kadar geçmişe, bağlantılara, yedeklere veya Sync'e hiçbir şey eklemez.

::: details Prepare for sharing ve Compare dosyalarını nasıl ele alır
**Prepare for sharing**, çalışma girdilerini, özel bulguları ve değiştirme eşlemelerini bellekte tutar; bunları geçmişe, bağlantılara, yedeklere veya Sync'e eklemez. İnceleme ve değiştirme, sunucuya dosya içeriği göndermez ve kimlik bilgilerini çevrimiçi denetlemez. Bir sonucu kopyalamayı, indirmeyi, göndermeyi veya kitaplığına kaydetmeyi sen seçersin; kaydedilen sonuç sonra kitaplığının yedekleme ve Sync ayarlarını izler. Tarif dosyaları önceki içeriği ve birebir eşlemeleri dışarıda bırakır; özet raporlar sayıları, kapsam kimliklerini ve dosya karmalarını içerir. CLI, orijinal değerleri içeren özel bir inceleme dosyasını yalnızca `--review-file` ile istendiğinde kaydeder. Bir hazırlık görünümünden ayrılmak çalışma durumunu serbest bırakır; bu, tarayıcı veya işletim sistemi belleğinden adli düzeyde silme sözü değildir.

Hazırlanan kopyalar ve tamamlanan dosya işlemleri Compare denetimlerini paylaşır. Kaldırılan değerler daraltılmış başlar; karşılaştırma raporları, dahil etmeyi seçmedikçe kaynak adlarını, yolları ve değerleri dışarıda bırakır. Dosya geçmişi kopyayı kaydeder, yani yeniden yüklemeden sonra karşılaştırmak, kayıtlı SHA-256 değeriyle eşleştirilerek orijinali yeniden seçmek anlamına gelir. Onu seçmek dosyayı kaydetmez veya yüklemez.
:::

Strip Hidden Data ve Prepare for sharing ayrıca DOCX, PPTX ve XLSX dosyalarını cihazda inceler. Desteklenen DOCX dosyalarında seçili özellikler yeni bir kopyada kaldırılabilir; diğer Office içeriği yalnızca incelenir ve özel önizlemeler bir gösterme denetiminin arkasında kalır.

::: details Office incelemesi neleri okur ve kaldırır
| Office biçimi | İncelenen paket içeriği | Desteklenen kaldırma |
|---|---|---|
| DOCX | Çekirdek, uygulama ve özel özellikler; yorumlar ve yazarlar; değişiklik izleme işaretleri ve önizlemeleri; gizli metin parçaları; harici ilişkiler; gömülü nesneler | Seçili yazar, son kaydeden, oluşturma/değiştirme/son yazdırma tarihleri, başlık, konu, açıklama, anahtar sözcükler, özel özellikler, Company, Manager, Template, köprü tabanı, uygulama adı ve sürümü ve istatistikler (toplam düzenleme süresi ile sayfa, sözcük, karakter, satır ve paragraf sayıları) |
| PPTX | Özellikler; yorumlar ve yazar kayıtları; konuşmacı notları; gizli slayt işaretleri; harici ilişkiler; gömülü nesneler ve desteklenen iç içe çalışma kitapları | Yok |
| XLSX | Özellikler; yorumlar ve notlar; gizli sayfa, satır ve sütun işaretleri; tanımlı adlar; harici ilişkiler ve bağlantılar; harici bağlantı ve pivot önbelleği yüzeyleri; gömülü nesneler | Yok |

**Sınırlar.** Sayım; görünür metni, formülleri, bağımlılıkları, işlenmiş görünümü veya rastgele ikili parçaları tam olarak incelemez. En fazla 300 paket parçasını, toplam 64 MiB bildirilmiş açılımı, XML parçası başına 2 MiB'ı ve iki iç içe gömülü paket düzeyini destekler; Prepare, parça ve açılım bütçelerini tüm iş boyunca paylaşır. Kesilmiş, bozuk, şifreli ve desteklenmeyen içerik raporlanır ve korunur. Makro içeriği tanımlanır ve asla çalıştırılmaz, eski ikili Office biçimleri ve XLSB incelenmez, harici başvurular asla getirilmez.

**DOCX temizliği neyi korur.** Temizlik, kurallı çekirdek, özel ve genişletilmiş özellik parçalarına sahip geçişli DOCX paket biçimini destekler. Genişletilmiş özelliklerden Company, Manager, Template, HyperlinkBase, Application, AppVersion ile TotalTime, Pages, Words, Characters, CharactersWithSpaces, Lines ve Paragraphs istatistikleri kaldırılabilir. DocSecurity, başlık ve parça başlıkları, bağlantı bayrakları ve diğer uygulama özellikleri korunur. Template kaldırıldığında ekli şablon bağlantısı belge ayarlarında kalır; sayım onu harici ilişki olarak raporlar.

Bazı okuyucular grafiklerin ve çizimlerin nasıl çizileceğini uygulama adından ve sürümünden seçer; örneğin LibreOffice, Word 2007 dosyasındaki bir grafiği bunlar olmadan farklı gösterir. Dosya grafik, resim, şekil veya gömülü nesne içerdiğinde ikisi de korunur ve inceleme bunları korunmuş olarak listeler. Bir Word alanının gösterdiği özellik (TEMPLATE, EDITTIME, NUMPAGES, NUMWORDS veya NUMCHARS) korunur; bağlantı alanları ve göreli harici bağlantılar HyperlinkBase'i korur, çünkü hedefleri bu taban adrese göre çözülür.

**Neler yalnızca inceleme olarak kalır.** Genişletilmiş dijital imza verisi temizliği engeller. İmzalı, makro etkin, şifreli, bozuk, yeniden adlandırılmış veya iç içe Office paketleri yalnızca incelenir. Özelliğe bağlı başka Word alanları (DOCPROPERTY veya AUTHOR gibi) ya da XML'e bağlı içerik denetimleri olan dosyalar da öyledir; çünkü Word bu bağlamaları güncellediğinde bir özelliği kaldırmak belgeyi değiştirebilir ve önbellekteki alan metni bir sonraki işlemenin aynı görüneceğini gösteremez. Olağandışı dosya uzantılı XML parçaları, güvenle incelenemeyen Word XML ilişki hedefleri, yanlış bildirilmiş üst veya alt bilgi parçaları ve `.svg` uzantılı XML olarak bildirilmiş SVG parçaları da bu ilk temizlik sürümünde yalnızca inceleme olarak kalır.

**Temizlik çalışmasını nasıl denetler.** Özellik parçaları, bildirimleri, ilgisiz paket üyeleri, XML yorumları ve ZIP yorumları korunur. Temizlik, sayım sınırlarını uygular ve yazmadan önce her üyenin bütünlüğünü denetler, ardından ortaya çıkan özellikleri yeniden inceler. Compare, desteklenen özellik farklarını değerler daraltılmış olarak gösterir; görünür metni veya işlenmiş görünümü karşılaştırmaz. Değerler 2048 karaktere kadar önizleme kullanır; dolayısıyla önizlemenin ötesindeki farklar görünmeyebilir ve kısmi bir inceleme iki dosyanın eşit olduğunu kanıtlayamaz. CLI'nin `prepare --strip-hidden-data` komutu desteklenen DOCX özelliklerini kaldırır ve özel bir inceleme zarfı tek tek özellikleri seçebilir. Başarısız bir temizlik koruması dosyayı korur ve başarısız bir işlem raporlar.
:::

## Uygulamanın yapabileceği her ağ isteği

İsteklerin çoğu cihazına araç, yazı tipi veya model getirir. Send eylemleri seçtiğin dosyayı, Sync seçtiğin depolamaya bir yedeği, kuruluş hizmetleri ise paylaşılan iş için gereken içeriği veya ayrıntıları iletir. Aşağıdaki her grup, cihazından nelerin, ne zaman çıktığını ve bir işletmen isteği engellerse ne olduğunu listeler. İşletmenin yapılandırdığı kimlik ve varlık sağlayıcıları o dağıtıma hedef ekleyebilir. [Her sabit sunucu tek tabloda](#every-fixed-host-in-one-table), web uygulamasının iletişim kurabileceği sunucuları listeler.

::: details Cihazına getirilenler
- <!--i:download--> **Araç kataloğu.** Kişisel hiçbir şey yok: Lolly'nin kendi herkese açık araç ve varlık dizini için uygulamanın kendi adresine, açılışta yapılan ve sonra çevrimdışı önbelleğe alınan bir istek. Engellenirse uygulama önbellekteki araçlarıyla çalışır ve yenilerini keşfetmeyi bırakır.
- <!--i:sparkle--> **Emoji setleri.** Seçtiğin set, onu ilk kullandığında uygulamanın kendi adresinden iner. Kişisel hiçbir şey gönderilmez. Lottie animasyonları cihazda okunur ve kimseyle iletişim kurmaz.
- <!--i:document--> **Google Fonts.** Seçilen aile adı ve IP adresin Google'ın yazı tipi sunucularına gider (stil sayfası için `fonts.googleapis.com`, yazı tipi dosyası için `fonts.gstatic.com`). Bu yalnızca Design System Setup içinde bir Google Font eklediğinde ve yalnızca tam olarak bunu söyleyen bir iletişim kutusunda onay verdikten sonra olur. Her aile bir kez getirilir, sonra cihazda tutulur ve çevrimdışı kullanılır. Engellenirse seçici güvenli biçimde başarısız olur; bunun yerine bir yazı tipi dosyası yükle.
- <!--i:cpu--> **Cihaz üzerindeki yapay zekâ modelleri.** Kişisel hiçbir şey yok: bir model dosyası indirilir, sonra cihazda tutulur. Web sürümleri varsayılan olarak uygulamanın kendi adresini kullanır; bir sürüm başka bir model sunucusu belirtebilir, örneğin paketlenmiş uygulamalar için Lolly'nin yayın sunucusu `lolli.li`. Sunucu isteği ve IP adresini alır; hesap veya model girdisi yoktur. Bu yalnızca bir modele ihtiyaç duyan bir özelliği kullandığında (Verify'ın derin taraması, görsel büyütme, konuşma ve benzerleri) veya modelleri çevrimdışı kullanım için indirmeyi seçtiğinde olur. Engellenirse o özellik bekler ve geri kalan her şey çalışır.
- <!--i:sliders--> **ICC baskı profilleri.** Kişisel hiçbir şey yok: ICC'nin herkese açık kayıt defterine (`registry.color.org`, `www.color.org`) standart bir baskı koşulu profili için istek; yalnızca baskı profili yöneticisinde bir ICC ön ayarına tıkladığında, profil başına bir kez. Engellenirse ön ayarlar başarısız olur; kendi `.icc` profilini sağla.
- <!--i:globe--> **İnternet radyosu.** Kişisel hiçbir şey yok: istasyondan bir çalma listesi isteği ve bir ses akışı (`api.somafm.com` ve işaret ettiği akış sunucusu, `*.somafm.com`); yalnızca ses oynatıcısındaki isteğe bağlı radyoyu çaldığın sürece. Engellenirse radyo çalışmaz ve diğer tüm ses özellikleri çalışır.
:::

::: details Canlı veriye ihtiyaç duyan bir araç
- <!--i:globe--> **Meeting Planner'ın şehir araması.** Bugün canlı veri getiren tek araç budur. Her şehir adını (ev sahibi şehir ve her ekip üyesinin şehri) koordinatlara ve saat dilimine çevirmesi için `geocoding-api.open-meteo.com` adresine sorar; hesap, anahtar veya isteğin kendisi dışında bir tanımlayıcı yoktur. Host city girdisi bunu açıklar ve her yanıt cihazda saklanır, böylece bir şehir bir kez aranır. Yalnızca araç açıkken çalışır. Engellenirse arama başarısız olur ve başka hiçbir şey etkilenmez.
:::

::: details Gönderdiğin dosyalar
Bunların her biri, Send düğmesine bastığında, hizmetin kendi penceresinde tamamladığın bir girişten sonra yalnızca seçtiğin tek dosyayı gönderir. Bluesky uygulama parolası, Discord webhook adresi, Nextcloud uygulama parolası ve S3 anahtarları yalnızca bu cihazda saklanır, hiçbir zaman bir yedeğe girmez ve **Disconnect** bunları siler.

- <!--i:upload--> **Google Drive.** Dosya, hangi biçimde olursa olsun Google'ın Drive API'sine (`www.googleapis.com`) gider. Lolly'nin erişimi kendi oluşturduğu dosyalarla sınırlıdır (`drive.file` kapsamı), dolayısıyla Drive'ının geri kalanını asla okuyamaz. Web uygulamasında giriş belirteci oturum boyunca bellekte tutulur ve hiç saklanmaz; diğer uygulamalarda bir yenileme belirteci yalnızca **Stay connected** kutusunu işaretlersen bu cihazda saklanır. Düğme yalnızca işletmenin bir Google istemci kimliği yapılandırdığı sürümlerde bulunur. Engellenirse düğme hiç görünmez; dosyayı indirip kendin yükle.
- <!--i:upload--> **Dropbox.** Dosya Dropbox'ın API'sine gider (giriş ve meta veriler için `api.dropboxapi.com`, dosya için `content.dropboxapi.com`). Erişim yalnızca uygulama klasörüyle sınırlıdır; Lolly orada `Apps/` ve kendi klasörünü görür, başka hiçbir şeyi görmez. Gösterdiği **Open** bağlantısı kısa ömürlü özel bir bağlantıdır ve herkese açık bir paylaşım oluşturulmaz. Yenileme belirteci yalnızca **Stay connected** kutusunu işaretlersen saklanır. Düğme yalnızca işletmenin yapılandırdığı bir Dropbox istemci kimliğiyle bulunur.
- <!--i:upload--> **OneDrive.** Dosya Microsoft'un kimlik ve Graph hizmetlerine gider (giriş için `login.microsoftonline.com`, yükleme için `graph.microsoft.com`); büyük bir dosya `api.onedrive.com` adresine veya işletmenin yapılandırdığı depolama kaynaklarına parçalar halinde yüklenir. Erişim, `Apps/` altındaki Lolly'nin kendi klasörüyle ve hesap etiketi için görünen adınla sınırlıdır. Yenileme belirteci yalnızca **Stay connected** kutusunu işaretlersen saklanır. Düğme yalnızca işletmenin yapılandırdığı bir Microsoft istemci kimliğiyle bulunur.
- <!--i:upload--> **LinkedIn**, yalnızca **masaüstü uygulamalarında**. Dosya, adı gönderi metni olarak, LinkedIn'e (kendi tarayıcındaki giriş için `www.linkedin.com`, yükleme ve gönderi için `api.linkedin.com`) kendi akışında herkese açık bir gönderi olarak gider. Lolly senin adına gönderi paylaşabilir ve hesap etiketi için adını okuyabilir, başka hiçbir şey yapamaz. Giriş yalnızca **Stay connected** kutusunu işaretlersen tutulur; LinkedIn belirteçleri 60 gün sürer ve sessizce yenilenemez, bu yüzden kendiliğinden sona erer. Bu sunucular web uygulamasının bağlantı politikasında yer almaz. Düğme yalnızca bir LinkedIn uygulamasının yapılandırıldığı sürümlerde bulunur.
- <!--i:upload--> **Penpot.** Uygulamaya yapıştırdığın Penpot kişisel erişim belirtecin ve tasarımın `.penpot` arşivi, uygulamanın kendi adresindeki küçük bir geçiş katmanı (`/api/penpot`) üzerinden Penpot'un API'sine (`design.penpot.app`) gider; çünkü Penpot'un API'si bir tarayıcıya doğrudan yanıt vermez. Geçiş katmanı iletir ve unutur; masaüstü uygulamaları Penpot ile doğrudan konuşur. Bu yalnızca Design aracında **Send to Penpot** düğmesine basıp bir projeyi onayladığında olur. Engellenirse gönderim güvenli biçimde başarısız olur; `.penpot` dosyasını dışa aktar ve kendin içe aktar.
- <!--i:upload--> **Bluesky.** Görsel, adı gönderi metni ve alternatif metin olarak, ayrıca kullanıcı adın ve uygulama parolan (Bluesky → Settings → App passwords altında oluşturulur, asla hesap parolan değil) belirttiğin Bluesky sunucusuna gider; başka bir tane seçmedikçe `bsky.social`. Hesabı önce **Settings → Connected services** içinde bağlarsın.
- <!--i:upload--> **Discord.** Dosya, yapıştırdığın kanal webhook adresine, discord.com üzerinde ek olarak gider. Bir webhook adresine sahip olan herkes o kanala gönderi paylaşabilir; bu yüzden adres cihazda kalır.
- <!--i:upload--> **Mastodon.** Dosya, adı gönderi metni olarak, o sunucunun kendi penceresinde giriş yaptıktan sonra belirttiğin Mastodon veya uyumlu sunucuya gider. Bağlanmak, o sunucuda bu cihaz için küçük bir uygulama kaydeder ve giriş yalnızca **Stay connected** kutusunu işaretlersen tutulur.
- <!--i:upload--> **Nextcloud veya WebDAV.** Dosya, girdiğin sunucu adresi, kullanıcı adı ve uygulama parolasıyla (Nextcloud → Settings → Security → Devices & sessions; asla hesap parolan değil) tek bir kimliği doğrulanmış yüklemeyle kendi sunucuna gider.
- <!--i:upload--> **S3 uyumlu depolama.** Dosya, girdiğin anahtar çiftiyle cihazda imzalanarak kendi kovana (AWS S3, MinIO, R2, B2, Garage veya herhangi bir SigV4 uç noktası) gider.

**Seçtiğin sunucular işletmenin onayını gerektirir.** Bluesky, Discord, Mastodon, Nextcloud ve S3 sunucuları Lolly'nin sabit listesinde yer almaz, çünkü onları sen seçersin. İşletmen o tam HTTPS sunucusunu onaylayana kadar uygulama oraya hiçbir şey göndermez: web'de dağıtımın Content Security Policy'sinde; masaüstü uygulamalarında uygulama derlendiğinde. Aynısı özel depolama ve SharePoint yükleme sunucuları için de geçerlidir. Web'de sunucunun ayrıca uygulamadan gelen tarayıcı çağrılarına izin vermesi gerekir (CORS) ve yönlendirme güvenli biçimde başarısız olur; bu yüzden yönlendirmeyen bir adres kullan. Masaüstü uygulamaları her yönlendirmeyi onaylı listeye karşı denetler.

Bu liste uygulamanın hangi sunuculara ulaşabileceğini sınırlar. Google veya Microsoft üzerindeki hesapları ya da kiracıları birbirinden ayırmaz; hangi hesapların ve eylemlerin izinli olduğunu sağlayıcının kendi izinleri belirler. Ayrıca kendi kuralları olan giriş pencerelerini, diğer kaynak türlerini veya yerel özellikleri de kapsamaz. Bir değişiklik yeni bir masaüstü sürümü veya yeni web yanıt başlıkları gerektirir; bunu almak için uygulamayı yeniden açmadan önce işini kaydet. [Connector origins](/info/connector-origins.html) yapılandırmayı anlatır.
:::

::: details Cihazların arasında Sync
- <!--i:folder--> **Neler çıkar.** Bu cihazda ürettiklerinin bir kopyası (kaydedilmiş oturumlar ve projeler, yazı tipleri ve logolarıyla tasarım sistemlerin, yüklenen görseller, profilin ve tercihlerin) tek bir dosya olarak, seçtiğin tek depolamaya gider: Dropbox'taki Lolly uygulama klasörü (`api.dropboxapi.com`, `content.dropboxapi.com`), Google Drive'ında Lolly'nin oluşturduğu dosyalar (`www.googleapis.com`), OneDrive'ındaki Lolly uygulama klasörü (`graph.microsoft.com`; daha büyük dosyalar `api.onedrive.com` adresine veya işletmenin yapılandırdığı depolama kaynaklarına yüklenir, indirmeler ise işletmenin yapılandırdığı tam depolama kaynaklarından yapılır) ya da kendi Nextcloud, WebDAV sunucun veya S3 kovan. Aynı depolama yedi güne kadar günlük kopya ve son uygulamandan önceki bir kopyayı tutar.
- <!--i:shieldcheck--> **Lolly'ye hiçbir şey gitmez.** Yolda hiçbir Lolly sunucusu, aktarıcı veya Lolly Work sunucusu yoktur ve uygulamalar bunun için hiçbir Lolly web sitesine ihtiyaç duymaz; giriş için bile. Kopya, yalnızca bir parola ifadesi belirlediysen önce cihazda şifrelenir. Girişler, anahtarlar, uygulama parolaları, parola ifadesi ve Sync ayarları cihazda kalır ve asla kopyada yer almaz. Web'de hatırlanan bir Google Drive bağlantısı yalnızca hesap adını (ve verdiysen kendi istemci kimliğini) tutar ve Google girişi bir ziyaret sürer. Android uygulamasında Google Drive girişi, telefondaki ve Google tarafından işletilen Google Play hizmetleri üzerinden yapılır.
- <!--i:sliders--> **Ne zaman.** Yalnızca **Sync across my devices** seçeneğini açtıktan veya **Sync now** düğmesine bastıktan sonra: her değişiklikten kısa süre sonra ve uygulamadan çıktığında bir yükleme ve uygulama açıldığında daha yeni bir kopya için denetim. Engellenirse Sync başarısız olur ve nedenini söyler; işin cihazda kalır. Bunun yerine verilerini bir dosyaya aktarıp kendin taşıyabilirsin. [Sync your devices](/info/sync.html) bu özelliği kapsar.
:::

::: details Web sayfaları, yakalamalar ve diğer sitelerden gelen resimler
- <!--i:monitor--> **Bir aracın yakalamasını istediğin URL.** URL screenshot aracı, yalnızca yakalamayı başlattığında, yazdığın adresin tam kendisini ister. Adresi o anda sen seçtiğin için bağlantı politikasında yer almaz ve işletmen onu sunucu bazında ne izin verebilir ne de engelleyebilir; kaldırmak için aracı kaldır.
- <!--i:globe--> **Bir Design kutusundaki web sayfası.** Sayfa, IP adresinle birlikte geldiği siteden istenir; sayfanın kendi istedikleri de buna eklenir. Tarayıcı destekliyorsa çerçeveye çerez ve uygulamanın kendi kaynağı dışında hiçbir adres gönderilmez, böylece belgen ve bağlantısı isteğle birlikte yolculuk etmez. Web uygulamasında yalnızca şu oynatıcılar çerçevelenebilir: `www.youtube-nocookie.com`, `player.vimeo.com`, `www.loom.com`, `www.google.com` (haritalar) ve `www.figma.com`; ayrıca `wikipedia.org` ve `*.wikipedia.org`, `commons.wikimedia.org`, `upload.wikimedia.org`, `www.wikidata.org`, `www.mediawiki.org` ve `www.openstreetmap.org` üzerindeki referans sayfaları. **Settings → Trusted sites** altındaki **Allow pages from any site**, Lolly'yi cihazında herhangi bir `https:` sayfasını çerçeveleyebilen bir politika altında yeniden yükler; güven ve sorma hakkındaki kurallar aynen geçerli kalır. Bir sayfa yalnızca Trusted sites listendeki bir site için (kaldırılabilir varsayılan referans siteleri dahil) ya da o kutuyu denetçisinde onayladıktan sonra yüklenir; birinin sana gönderdiği bir sunum, o zamana kadar her sayfanın bir resmini gösterir. Sunum yapmadan önce liste her site için **Just this time** ve **Always trust** seçeneklerini sunar; sunum sırasında hiçbir şey sorulmaz. Engellenirse kutu, sayfayı yeni sekmede açan bir bağlantıyla birlikte resmini gösterir. Bir kutudaki Lolly araçları ve Sandbox demoları uygulamanın kendi adresinde çalışır ve kimseyle iletişim kurmaz.
- <!--i:sliders--> **Gösterdiğin sayfayı değiştirmek.** Bir web sayfası kutusunun **Use page** eylemi, sayfanın içinde çerezleri reddetmene veya bir bannerı kapatmana olanak tanır. Erişilebilir Lolly sayfaları için **Hide cookie banners**, çerezleri kabul etmeden veya sitenin onay seçimini değiştirmeden OneTrust dahil bilinen yer paylaşımlarını gizler. **Page CSS**, o kutunun canlı sayfasını ve sunumunu değiştirir; dışa aktarmalar yine seçilen posteri kullanır. Kurallar kaynakları veya yazı tiplerini içe aktaramaz ve tarayıcılar Lolly'nin başka bir sitenin CSS'ini değiştirmesini engeller. Sandbox önizlemelerinin **Edit in Sandbox** altında kendi CSS düzenleyicisi vardır.
- <!--i:code--> **Bir Sandbox demosunun web kaynakları.** Demonun kodunun bağlandığı her stil sayfası, betik, yazı tipi veya görsel, IP adresinle ve çerezsiz olarak onu barındıran siteden istenir; getirilen bir stil sayfasının adını verdiği dosyalar, örneğin Google Fonts'un yazı tipi dosyaları, ayrı siteler sayılır. Bu yalnızca **Fetch & inline** düğmesine tıkladıktan sonra ya da Trusted sites listendeki bir site için olur; bir dosyanın yanındaki **Always trust** onun sitesini o listeye ekler. Engellenirse demo bu dosyalar olmadan çalışır ve Sandbox getiremediği her dosyayı nedeniyle birlikte listeler.
- <!--i:download--> **URL'den görsel ekle.** Varlık seçicideki veya Assets içindeki **Add from URL**, yapıştırdığın görsel adresinin tam kendisini ister. Web uygulamasının kendi politikası tarayıcının başka bir siteden doğrudan getirmesini engeller; bu yüzden uygulamanın kendi adresindeki küçük bir geçiş katmanı (`/api/fetch-image`) görseli getirir ve yalnızca baytları geri verir; hiçbir şey saklamaz, adresi unutur ve herkese açık bir görsel adresi olmayan her şeyi reddeder. Masaüstü uygulamaları adresi doğrudan getirir. Yapıştırdığın bir Lolly bağlantısı hiç getirilmez: cihazda render edilir. İşletmen geçiş katmanını kapatırsa (`LOLLY_DISABLE_IMAGE_PROXY=1`), web uygulamasında yalnızca Lolly bağlantıları, `data:` görselleri ve aynı kaynaktan görseller eklenebilir; masaüstü uygulamaları etkilenmez.
- <!--i:palette--> **Bir web sitesinden tasarım sistemi.** Design System Setup, adını verdiğin bir sitenin tek sayfasını [tarayıcı uzantısı](#the-browser-extension) veya masaüstü uygulamasının kendi getirmesi üzerinden okuyabilir; hiçbir zaman bir Lolly sunucusu üzerinden değil. Sen basmadan hiçbir şey getirilmez ve sayfadaki bağlantılar izlenmez.
:::

::: details Başka insanlarla ve ajanlarla çalışmak
- <!--i:link--> **Özel bir collab.** İki cihaz, arada sunucu olmadan doğrudan bağlanır. Davet ve yanıt, her cihazın kendi ağında görebildiği adresleri taşır ve bu sürüm dışarıdan bir adres keşif sunucusu yapılandırmaz; bu yüzden onları yalnızca birlikte çalıştığın kişiye ver. Bkz. [Working together](/info/collaborate.html).
- <!--i:monitor--> Masaüstü uygulamasında **Nearby**. Görünür olduğun sürece (bir collab daveti başlattığında on dakika, ya da açarsan uygulama çalıştığı sürece) uygulama yerel ağda rastgele bir ad, seçtiğin görünen ad ve cihaz türünü duyurur. E-posta adresi, hesap veya kalıcı bir tanımlayıcı duyurmaz.
- <!--i:link--> **Bir ajanı davet et.** Davet edilen belgenin durumu, ajanın istediği önizlemeler, ajanın kimliği ve düzenlemeleri, yapılandırılmış canlı aktarıcı (lolly.tools'ta `lolly.ing`) üzerinden davet ettiğin ajana geçer. Yüklü barındırılan bir eklenti de çağrıları lolly.tools bağlayıcısı üzerinden davetin seçtiği aktarıcıya iletir; bağlayıcı çağrılar arasında davet veya belge tutmaz. Aktarıcı davetleri ve bekleyen istekleri, sen bağlantıyı kesene veya süreleri dolana kadar bellekte tutar: kullanılmayan bir davet için on dakika, katılmış bir davet için etkinliksiz otuz dakika. Ajanının sağlayıcısı aldığı veriyi kendi politikası uyarınca işler. Bu yalnızca Share içinde bir davet oluşturup talimatlarını ajanına verdikten sonra olur; okuma erişimi incelemeye, düzenleme erişimi ayrıca değişikliğe izin verir. Pause değişiklikleri durdurur; Disconnect veya davetin iptali erişimi sonlandırır. Engellenirse ajan katılamaz veya devam edemez ve sen düzenlemeye devam edersin.
- <!--i:cpu--> Masaüstü uygulamasında **Allow AI control**. Bu bilgisayarda çalışan bir ajan, bilgisayarda kalan bir bağlantı üzerinden açık Design belgesini okuyup düzenleyebilir. Sen açana kadar kapalıdır. Lolly bunun için bir sunucuya hiçbir şey göndermez; ajanın okuduklarını ajanın sağlayıcısı kendi politikası uyarınca işler. [Threat Model & Trust Boundaries](/info/threat-model.html) böyle bir ajanın neler yapıp neler yapamayacağını listeler.
- <!--i:server--> **Uzak bir örnek.** Uygulamayı başka bir Lolly dağıtımına yönlendirdiğinde, aynı katalog eşitlemesi üzerinden o örneğin sunduğu her şeyi alır; ayrıca ona yapılan isteklere bir sürüm etiketi (uygulama türü ve motor sürümü, bir kullanıcı aracısının taşıdığı bilginin aynısı) eklenir, böylece işletmeni hangi Lolly sürümlerinin kullanıldığını görebilir. Yönetilen bir örnekte, oturum açtığın sürece etiket bu cihaz için bir kurulum kimliği de taşır; böylece işletmenin cihaz listesi kurulumları ayırt edebilir. Ayrılmak kimliği siler ve sonradan yeniden bağlanan cihaz yeni bir kimlik sunar. Sunucuyu sen seçtiğin için bağlantı politikasında yer almaz. Engellenirse geçiş başarısız olur ve yerel örneğin etkilenmez.
- <!--i:people--> **Kuruluşunun Lolly Work örneği.** Giriş kimliği ve cihaz bilgisi, politika istekleri, kullandığın paylaşılan oturumlar, iş birliği düzenlemeleri, yüklemeler, onay gönderimleri ve teslim dosyaları ile yapılandırılmışsa izin verilen kullanım olayı etiketleri, kuruluşunun örneğine gider; giriş onun kimlik sağlayıcısı üzerinden yapılır. Politika yenilemeleri ve etkin telemetri kullanım sırasında çalışabilir; paylaşılan iş, collab'lar, inceleme ve teslim bu iş akışlarının parçası olarak içerik gönderir. Engellenirse bu kuruluş özellikleri tamamlanamaz ve kişisel işin ayrı kalır. Bkz. [Lolly Work ile kuruluş hizmetleri](#organisation-services-with-lolly-work).
:::

### Her sabit sunucu, tek tabloda

Web uygulamasının Content Security Policy'si, bir betiğin listelemediği hiçbir sunucuya ulaşmasını engelleyen şeydir. Uygulamanın kendi adresinin yanında tablo, bu politikanın listelediği her sunucuyu ve masaüstü uygulamalarının eklediği, yalnızca masaüstü olarak işaretlenmiş iki LinkedIn sunucusunu verir. Bir CI testi bu tabloyu yayındaki politikayla karşılaştırır; bu yüzden bir sunucu diğeri olmadan eklenemez.

| Ne | Cihazından gerçekte ne çıkar | Sunucular |
|---|---|---|
| Paketlenmiş uygulamalardaki cihaz üzerindeki modeller ve yayın dosyaları | Herkese açık bir dosya isteği, IP adresinle birlikte | `lolli.li` |
| Google Fonts | Yazı tipi ailesi adı ve IP adresin | `fonts.googleapis.com`, `fonts.gstatic.com` |
| Google Drive'a gönderme ve Sync | Seçtiğin dosya veya yedek | `www.googleapis.com` |
| Dropbox'a gönderme ve Sync | Seçtiğin dosya veya yedek | `api.dropboxapi.com`, `content.dropboxapi.com` |
| OneDrive'a gönderme ve Sync | Seçtiğin dosya veya yedek ve hesap etiketi için görünen adın | `login.microsoftonline.com`, `graph.microsoft.com`, `api.onedrive.com` |
| Meeting Planner'ın şehir araması | Her şehir adı | `geocoding-api.open-meteo.com` |
| ICC baskı profilleri | Herkese açık bir profil isteği | `registry.color.org`, `www.color.org` |
| İnternet radyosu | Bir çalma listesi isteği ve bir ses akışı | `api.somafm.com`, `*.somafm.com` |
| Bir ajanı davet etme ve lolly.ing çalışma alanı | Davet edilen belgenin durumu, önizlemeleri ve düzenlemeleri ile yaptığın çalışma alanı istekleri | `lolly.ing` |
| Design web kutusundaki oynatıcılar | Sayfa isteği, IP adresinle birlikte | `www.youtube-nocookie.com`, `player.vimeo.com`, `www.loom.com`, `www.google.com`, `www.figma.com` |
| Design web kutusundaki referans sayfaları | Sayfa isteği, IP adresinle birlikte | `wikipedia.org`, `*.wikipedia.org`, `commons.wikimedia.org`, `upload.wikimedia.org`, `www.wikidata.org`, `www.mediawiki.org`, `www.openstreetmap.org` |
| LinkedIn'e gönderme, yalnızca masaüstü uygulamalarında | Dosya, adı herkese açık bir gönderi olarak | `www.linkedin.com`, `api.linkedin.com` |

Masaüstü uygulamalarının kendi listesi ayrıca Drive girişi için Google'ın belirteç uç noktasını içerir. Adını verdiğin bir Mastodon veya Nextcloud sunucusu gibi diğer her sunucu, Gönderdiğin dosyalar bölümünde anlatıldığı gibi işletmenin onayını gerektirir. Yakaladığın bir URL veya adını verdiğin bir uzak örnek gibi, kullanım anında seçtiğin sunucular hiçbir listede yer almaz.


**SEAL imzaları hiçbir istek yapmaz.** Verify, imza anahtarı DNS'te yayımlanabilen bir şema olan SEAL imzalarını denetleyebilir. Tarayıcılar DNS sorgusu yapamaz; bu yüzden bir web araması, denetlenen alan adını ve IP adresini görecek olan üçüncü taraf bir DNS-over-HTTPS çözümleyicisinden geçmek zorunda kalırdı. Lolly eskiden Cloudflare'in çözümleyicisini kullanıyordu; artık kullanmıyor ve Cloudflare'in yerine hiçbir şey konmadı. Bugün hiçbir Lolly uygulaması SEAL anahtarlarını aramaz: masaüstü ve mobil uygulamalar aynı Verify görünümünü çalıştırır ve komut satırındaki `lolly validate` SEAL'i denetlemez. SEAL kaydı anahtarını satır içinde taşıyan bir dosya çevrimdışı denetlenir ve Verify, alan adını doğrulamadan imzayı dahili olarak tutarlı bulur. Anahtarı yalnızca DNS'te bulunan bir dosya, "no key resolver and no inline key" nedeniyle **SEAL signature did not verify** gösterir.

![Verify ekranı: bir bırakma hedefi ve başka hiçbir şey - dosya bulunduğu yerde denetlenir, yükleme ve hesap yoktur](/t/url-shot?url=%2F%23%2Fverify&width=1440&height=900&dpi=192&waitMs=1400&walker=1&format=svg&cropSelector=.valid-layout&dark=1&filename=cc-verify-drop)

Bunu ve bu sayfadaki diğer her iddiayı kendin denetleyebilirsin: [Verify It Yourself](/info/verify-yourself.html) komutları ve beklenen çıktıyı verir.

## lolly.tools'un işlettiği hizmetler

Bunlar lolly.tools üzerinde herkes için çalışır. Her biri yalnızca gönderdiğini alır. [Server Surface](/info/server-surface.html) aynı bileşenleri herhangi bir dağıtımda çalıştıkları şekliyle anlatır.

### Render bağlantıları

Her `https://lolly.tools/tool/<tool-id>.<ext>?<inputs>` URL'si gerçekten render edilir ve girdileri URL içinde taşınır; böylece paylaşılan bir Lolly bağlantısı bir README'de, wiki'de veya panoda canlı bir görsel olarak görünebilir. Birini getirmek, sunucudan girdileri adrese yazılmış **herkese açık araç ve katalog verilerini** render etmesini ister.

- <!--i:usercheck--> **Hesap yok, çerez yok, durum yok.** Rota giriş istemez ve cihazındaki hiçbir şey okunmaz. Belgelerin, oturumların ve yüklemelerin tarayıcından asla çıkmaz ve bu bağlantılarda görünemez.
- <!--i:document--> **URL'nin kendisi kaydedilir.** Bir URL'nin sorgu dizesi isteğin parçasıdır; bu yüzden istenen her yol gibi barındırma platformunun olağan erişim günlüklerinde görünür. Bir bağlantının girdileri, bir isim kartı veya e-posta imzasında olabileceği gibi birinin adını veya e-posta adresini içeriyorsa, **o metin bu günlüklerde durur**. Bir render bağlantısına yalnızca herkese açık bir sayfaya koyacağın şeyi ver.
- <!--i:globe--> **Girdiler zaten herkese açıktır.** Bunlar bağlantının yazarının URL'ye yazdığı şeylerdir ve bağlantının ulaştığı herkes tarafından okunabilir. Paylaşılan bir bağlantıya sır koyma; Lolly hassas içerik için bağlantı şifreleme sunar.
- <!--i:eyeoff--> **Önbelleğe alınır, sınırlandırılır ve dizinlenmez.** Yanıtlar, herkese açık herhangi bir görsel gibi önbelleğe alınır ve hız sınırına tabidir; arama motorları render'larını dışarıda bıraksın diye `noindex` ile işaretlenir.

Herkese açık render rotası istemeyen, kendi sunucusunda barındırılan bir dağıtım `LOLLY_DISABLE_RENDER_GET=1` ayarlar ve bu URL'lerin hepsi 404 döndürür.

### Görsel getirici ve Penpot geçiş katmanı

Web uygulamasındaki **Add from URL** ve **Send to Penpot**, lolly.tools üzerindeki iki küçük geçiş katmanını kullanır; bunlar [Uygulamanın yapabileceği her ağ isteği](#every-network-request-the-app-can-make) bölümünde anlatılır. Görsel getirici hiçbir şey saklamaz ve adresi unutur. Penpot geçiş katmanı belirtecini ve arşivini Penpot'a iletir ve ikisini de saklamaz; komut adını ve Penpot'un yanıt durumunu günlüğe kaydeder.

### Yapay zekâ ajanları için MCP sunucusu

Bir yapay zekâ ajanı Lolly'ye, bir işletmenin çalıştırdığı uç nokta üzerinden Model Context Protocol ile ulaşabilir. lolly.tools bir tane işletir ve herkes tamamen çevrimdışı dahil kendi uç noktasını çalıştırabilir.

- <!--i:cpu--> **Bir ajanın gönderdiği dosyalar.** Dosya alan araçlar (`lolly_transform`, `lolly_verify`, `lolly_redact`, `lolly_read`, `lolly_check`, `lolly_package`, `lolly_compose`, `lolly_rebrand` ve görsel araçları `lolly_look`, `lolly_sample_color` ile `lolly_trace_edges`) onu bellekte işler ve sonucu aynı çağrıda döndürür. Dosya hiçbir zaman diske yazılmaz ve istek tamamlandıktan sonra tutulmaz. `lolly_inspect` de bir dosya alır ve video ile baskı üretimi denetimleri, çağrı döndüğünde silinen geçici bir çalışma kopyası yazar. Diğer her araç çağrıdaki parametrelerden çalışır: metin, sayılar, renkler, URL'ler, katalog varlık kimlikleri veya çağıranın sağladığı bir belge.
- <!--i:cpu--> **Rebrand, bir sunumun nereye gittiğini söyler.** `lolly_rebrand`'ın ilk aşaması olan `capabilities`, sen göndermeden önce baytlarının nereye gideceğini sözcüklerle söyler: kendi sunucusunda barındırılan yerel bir sunucuda sunum o makineden asla çıkmaz; barındırılan bir sunucuda `lolly_rebrand` çağırmak sunumu oraya gönderir, o aşamanın verdiği boyut ve slayt sınırlarına kadar.
- <!--i:lock--> **Açık uç nokta.** lolly.tools üzerinde `lolly.tools/api/mcp` belirteçsiz herkese açıktır. Çağrılar adres başına ve günlük bir bütçeyle sınırlandırılır. Adres, aşağıdaki giriş uç noktalarında olduğu gibi kötüye kullanım denetimi deposunda takma adlı bir özete dönüştürülür ve bütçe yalnızca CPU süresini ve gönderilen baytları sayar, adres içermez. Kısıtlı bir uç noktanın taşıyıcı belirteci hiçbir zaman bir günlüğe veya render URL'sine yazılmaz.
- <!--i:link--> **Büyük sonuçlar için indirme bağlantıları.** lolly.tools sonuçları satır içi döndürür ve bu bağlantıları hiç vermez. Bir işletmen bunları kendi kimliği doğrulanmış ağ geçidi için açabilir; orada bir sonuç en fazla beş dakika tutulur ve yalnızca çağıranın kendi taşıyıcı belirteci onu getirebilir; bkz. [MCP Server](/info/mcp.html#private-download-links-for-large-results). `mcp.lolly.tools` adresinde planlanan kısıtlı bir uç nokta, işletmenin güvenilen istemcilere verdiği bir taşıyıcı belirteci veya ortak bir sırra karşı denetlenen kısa ömürlü imzalı belirteçlerle OAuth 2.1 kabul eder; etkinleştirilmesi beklemededir ve [Teslimat sunucuları ve işleyiciler](#delivery-hosts-and-processors) altında listelenir.

### Doğrulanmış kimlik: kendi başlattığın bir giriş

Lolly dışa aktarmalarına bir **Content Credential** mühürleyebilir; böylece bir dosyanın Lolly'den çıktığından beri değişmediğini herkes çevrimdışı denetleyebilir. Bu kadarı **varsayılan olarak açıktır ve tamamen yereldir**: imza anahtarı cihazında üretilir ve imzalama çevrimdışı gerçekleşir. Kayıt olmadan o anahtar tek kullanımlıktır; her dışa aktarma için yeni bir anahtar çifti üretilir ve sonra atılır. Kayıt olduğunda anahtar kalıcı olur ve **dışa aktarılamaz** üretilir; yani Lolly'nin kendi kodu bile onu okuyamaz, yalnızca imzalamasını isteyebilir. Her iki durumda da cihazından asla çıkmaz.

[Exporting](/info/exporting.html#content-credentials-c2pa) bir kimlik bilgisinin neleri kaydettiğini listeler: aracı, zamanı, kaba dışa aktarma yüzeyini, adını yalnızca *Use my details* seçeneğini açtıysan, bir dışa aktarmanın yerleştirdiği atıflı eserleri ve bir video veya ses dışa aktarmasında çalan her Rondocode şarkısını (adı, kaynağının karması ve Lolly'nin sandbox'ının şarkıyı nasıl render ettiği). Export paneli bu şarkıları dışa aktarmadan önce listeler.

Kimlik bilgisi ve dosyanın meta verileri ayrıca dışa aktarmayı çizen [tasarım sistemini ve renk yolunu (colourway)](/info/exporting.html#the-design-system-record) de kaydeder: tasarım sisteminin kimliği ve adı, yayımlanmış sürümü ve colourway. Bir tasarım sisteminin adı sahiplerinin yazdığı bir metindir ve bir müşterinin adı olabilir; bu yüzden Export panelindeki **Design system** kartı, dışa aktarmadan önce tam sözcükleri gösterir. Onları dışarıda bırakmak için kartın işaretini kaldır veya `_madewith=0` ya da `--no-madewith` ver.

Bunun üstüne eklenen tek *isteğe bağlı* adım, doğrulanmış bir kimliğe kaydolmaktır; böylece dışa aktarmalarında anonim bir anahtarı adlandırmak yerine "Verified - signed by \<your email\>" yazar. **Kayıt adımını atlarsan sertifika hizmeti senden hiçbir kayıt verisi almaz.**

![Settings içindeki Verified identity kartı, telefon genişliğinde: sertifika ömrü seçici ve altındaki kayıt adımı; kendin başlatana kadar uykuda](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

Kayıt olursan olan şey tam olarak şudur:

::: timeline
- <!--i:usercheck--> **Bir giriş yöntemi seçersin**: GitHub, Google, SUSE (id.suse.com) veya e-postayla gelen bir bağlantı. Üç OIDC sağlayıcısı için, bizim değil o sağlayıcının gizlilik politikası altındaki kendi giriş sayfasına gidersin ve sertifika hizmeti yalnızca doğrulanmış bir e-posta adresini ve sağlayıcının adını geri alır. E-posta bağlantısı için yazdığın adres, yalnızca o tek bağlantıyı iletmek üzere, işlemsel bir e-posta hizmeti olan **Resend**'e gider.
- <!--i:lock--> **Kısa ömürlü bir çerez yönlendirmeyi korur.** Sertifika hizmeti `lolly_ca_state` çerezini `HttpOnly` olarak, `/api/ca` kapsamında ve on dakika içinde sona erecek şekilde ayarlar. İzleme tanımlayıcısı değil rastgele bir değer taşır, yalnızca giriş yönlendirmesinin taklit edilmesini önlemek için vardır ve giriş tamamlanır tamamlanmaz temizlenir.
- <!--i:eyeoff--> **IP adresin kötüye kullanımı önlemek için kısaca kullanılır**; giriş uç noktalarında tek bir betik bir gelen kutusunu dolduramaz veya e-posta kotasını tüketemez. Lolly onu, kısa ömürlü kötüye kullanım denetimi deposuna ulaşmadan önce SHA-256 özetine dönüştürür; yani ham adres oraya gönderilmez. Özet anonim değil takma adlıdır: depoya sahip biri olası her IPv4 adresini deneyerek bir adresi geri kazanabilir. Kova yaklaşık bir dakika sonra sona erer ve başka hiçbir şey için kullanılmaz. Olağan barındırma erişim günlükleri ayrıdır ve aşağıda anlatılır.
- <!--i:seal--> **Hizmet bir sertifika verir** ve doğrulanmış e-posta adresini cihazının genel anahtarına bağlar. Özel anahtar cihazda kalır: istemci, bağlı bir sahip olma kanıtıyla bir sertifika isteği gönderir ve hiçbir cihaz özel anahtarı iki düzenleyici moduna da gitmez.
- <!--i:check--> **İmzalama yerel kalır.** Eski düzenleyiciyle bir dışa aktarma, sertifika hizmetine istek gerektirmez. Yönetilen bir kimlik ayrıca düzenleyicisinden taze, imzalı bir iptal listesi gerektirir; istemci yapılandırılmış tazelik penceresi içinde önbellekteki bir listeyi kullanabilir ve onu yenilemek bir dışa aktarma sırasında sertifika hizmetiyle iletişime geçebilir. Eksik, süresi dolmuş veya geçersiz durum, yönetilen kimliğin kullanılmasını durdurur.
:::

::: details Her düzenleyici modunda saklama ve geri çağırma
**Eski barındırılan düzenleme** 7, 30, 90 veya 365 gün sunar; işletme tarafından üst sınır konur. Kimlik envanteri ve düzenleme günlüğü tutmaz; bu yüzden bir sertifikayı kimin aldığına bakamaz veya o kişinin sertifikalarını iptal edemez; ömür geri çağırmadır.

**Yönetilen kuruluş düzenlemesi** en çok 24 saatlik varsayılan bir ömür ve yedi günlük bir üst sınır kullanır; kendi kökü ve düzenleyici güven politikası vardır ve imzalama, işletmesinin yapılandırdığı Vault düzenleyicisine gider. Kayıt uygulaması, yalnızca anahtarlı bir kimlik doğrulama tanımlayıcısını ve bir istek özetini en çok on dakika tutan, paylaşılan tek kullanımlık bir kabul deposu kullanır ve kimlik envanteri veya sertifika yanıtlarının önbelleğini saklamaz. PKI sağlayıcısının, denetim cihazlarının, ağ geçitlerinin ve yedeklerinin kendi veri akışları vardır. Olağan düzenleme depolaması kapatılsa bile sertifika tabanlı iptal, e-posta kimliği dahil sertifikayı tutabilir; iptal seri numaraları ve denetim tanımlayıcıları birbirine bağlanabilir kalabilir. Bu envanteri, kimin erişebileceğini ve ne kadar süre tutulduğunu işletmenin politikası belirler.

Yönetilen bir cihaz, cihazın kimliği doğrulanmış bir kanıtıyla kendi sertifikasını iptal etmeyi isteyebilir ve hiçbir API cihaz özel anahtarını istemez. İşletme bir düzenleyiciyi güven politikası aracılığıyla geri çekebilir. Lolly kişilerden sertifikalara bir eşleme tutmaz; bu yüzden bir kişi ayrıldığında sertifikalarını iptal etmek, işletmenin tuttuğu kayıtlara bağlıdır ve PKI kayıtları, denetim kayıtları, alıcılar ve yedekler işletmenin politikasını izler. [Sertifika hizmeti tasarımı](https://github.com/lolly-tools/lolly/blob/main/services/ca/README.md), düzenleyici saklamasını, sağlayıcı tutmasını ve nitelendirmeyi kapsar.
:::

## Lolly Work ile kuruluş hizmetleri

**Lolly Work**, Lolly projesinin isteğe bağlı kuruluş hizmetidir ve bir örnek çalıştıran her kuruluş tarafından ayrı olarak dağıtılır. Bir örneğe bağlanmak, yerel düzenlemenin yanına o sunucuda tutulan veri ekler. İşletmesi, o dağıtımın gizlilik politikasından, erişim denetimlerinden, alıcılarından, saklama süresinden ve yedeklerinden sorumludur.

| İş akışı | Kuruluşun hizmetinin işlediği veri |
|---|---|
| Giriş ve hesap sağlama | Kimlik sağlayıcı talepleri, hesap ve grup üyeliği, oturum açma oturumları ve cihaz bilgisi. Girişi OIDC yönetir; yöneticiler SCIM aracılığıyla hesap sağlayıp devre dışı bırakabilir |
| Paylaşılan katalog ve projeler | Yüklenen varlıklar, meta veriler ve sürümler; paylaşılan projeler ve oturumlar; yapılandırılmış kitaplık sağlayıcılarından alınan içerik |
| Work collab'ları | Örnek üzerinden gönderilen paylaşılan oturum durumu, canlı düzenlemeler ve katılımcı varlığı; kaydedilen durum, depolama politikası uyarınca kalıcıdır |
| Yönetilen paylaşım bağlantıları | Bağlantı hedefi ve süre sonu ile isteğe bağlı parola koruması gibi erişim ayarları; istekler örnek üzerinden çözülür ve iptal edilebilir |
| İnceleme ve teslim | Gönderilen içerik, onay kararları, seçilen hedef, hazırlanan dosyalar ve teslim makbuzları |
| Sunucu render'ları ve toplu işler | Gönderilen araç girdileri, render istekleri, durum ve tutulan çıktı dosyaları. Bu işler cihazında değil sunucuda çalışır |
| Kullanım raporlama | Araç kimliği, biçim ve varlık kimliği gibi izin verilen olay etiketleri, aşağıdaki telemetri politikasına göre |
| Denetim | Yönetilen işlemler için aktör ve eylem kayıtları, kullanım telemetrisinden ayrı tutulur |

Hizmet, sertifika hizmetinin çerezinden ayrı olarak, oturum açmış üyeler için `lw_session` ve etkin olduğunda konuk erişimi için `lw_guest` dahil kimlik doğrulama çerezleri kullanır. Politika yenilemeleri ve etkin kullanım raporlaması, uygulama kullanılırken her biri için ayrı bir tıklama olmadan istek yapabilir. Bu, yapılandırılmış örneğe giden trafiktir; Lolly projesine, işletmediği dağıtımlar hakkında bir rapor değildir.

**Kullanım telemetrisinin üç düzeyi vardır.** `off` hiçbir kullanım olayı saklamaz, `aggregate` kullanıcı kimliklerini çıkarır ve `standard` olayları ilişkilendirebilir. Varsayılan düzey `standard`'dır; bu yüzden işletmesi `off` seçmedikçe bir örnek aldığı kullanım olaylarını saklar. Varsayılan ilişkilendirme politikası `opt-in`'dir; bir kullanıcı kimliği saklanmadan önce onayını gerektirir; bir işletme bunun yerine `telemetryAttribution: default` ile ilişkilendirilmiş raporlamayı yapılandırabilir. İzin verilen öznitelikler etikettir, asla araç girdi değerleri değildir. Bkz. [Work telemetry](/info/work-telemetry.html).

**Denetim ayrıdır.** Yönetilen eylemler, telemetri onayın ne olursa olsun kimliği belli bir denetim kaydı tutabilir. Telemetriyi kapatmak paylaşılan oturum depolamasını, onay kayıtlarını, render işi depolamasını veya denetimi kapatmaz. İşletme, denetim günlüğünün takma adlandırılması dahil saklamayı ve silmeyi denetler; bkz. [Work storage and data lifecycle](/info/work-data-lifecycle.html).

| | Cihazın | Kuruluşunun örneği |
|---|---|---|
| Neyi tutar | Kişisel işin, tercihlerin ve önbellekler | Paylaşılan iş, hesaplar, yüklemeler, onaylar, render'lar, denetim ve yapılandırılmış telemetri |
| Kim siler | Sen, **Clear all my data** ile veya tarayıcının site verileriyle | İşletme, örneğin kendi denetimleri üzerinden |
| Kime sorulur | Kimseye: kayıtlar cihazında | Erişim, dışa aktarma veya silme için örneğin işletmesi |

**Yerel silme, sunucudan silme değildir.** Bir örnekten ayrılmak veya tarayıcını temizlemek yerel durumu kaldırır; kuruluşun sakladığı kayıtları veya yedekleri kaldırmaz. Kişisel [Sync](/info/sync.html) ve **Export my data** cihazını yedekler, kuruluşun hizmetini değil. Herkese açık [lolly.work](https://lolly.work) demosu durumunu yalnızca bellekte tutar ve işin için kalıcı depolama değildir.

## Tarayıcı uzantısı

**Lolly URL Screenshot** tarayıcı uzantısı bizim için kişisel veri toplamaz. Analitiği, izlemesi ve kendi sunucusu yoktur. [Browser extension](/info/extension.html) sayfası nasıl çalıştığını anlatır.

**Ne yapar.** Lolly web uygulaması ondan bir web sayfasının ekran görüntüsünü ya da bir web sitesinden tasarım sistemi başlatmak için sayfanın içeriğini isteyebilir. Her istek, uzantıda isteyen siteyi, ekran görüntüsü mü sayfa içeriği mi istediğini ve sayfa adresini gösteren bir onay penceresi açar. Yalnızca **Approve once** düğmesine bastıktan sonra uzantı o sayfayı geçici bir arka plan sekmesinde açar, ekran görüntüsünü alır veya sayfayı okur, sonucu isteyen Lolly sekmesine verir ve sekmeyi kapatır. Her isteğin kendi onayı gerekir.

**Veri.**

- <!--i:shieldcheck--> **Hiçbir şey toplamayız.** Sonuç yalnızca isteyen Lolly sayfasına, aynı tarayıcıda gider. Uzantı sayfa içeriği saklamaz ve başka alıcı eklemez.
- <!--i:globe--> **Ağ istekleri.** Onayladığın sayfa, herhangi bir sekmede olduğu gibi, sayfanın kendi istedikleriyle birlikte yüklenir. Bir sayfanın içeriğini okumak ayrıca o sayfanın stil sayfalarını ve birkaç simge ile logo görselini sayfanın içinden getirir; bu getirmeler başka sitelere çerez göndermez. Uzantı başka istek yapmaz ve hiçbiri bir Lolly sunucusuna gitmez.
- <!--i:lock--> **Tarayıcı oturumun.** Sayfa, kendin açsaydın olacağı gibi tarayıcı oturumunla yüklenir; bu yüzden oturum açtığın bir sayfa sonuca özel bilgi koyabilir.
- <!--i:link--> **Onayladığın adresler** yalnızca o tek istek için o tek sayfayı yüklemekte kullanılır. Günlüğe kaydedilmez veya paylaşılmaz.

**İzinler.**

- <!--i:wrench--> **`debugger`**: ekran görüntüsünü DevTools Protocol üzerinden almak için; Lolly masaüstü uygulamasının kullandığı mekanizmanın aynısı.
- <!--i:monitor--> **`tabs`**: geçici sekmeyi açıp kapatmak ve onayından sonra ne Lolly sayfasının ne de hedef sayfanın taşınmadığını denetlemek için.
- <!--i:code--> **`scripting`**: o isteği onayladıktan sonra geçici sekmedeki sayfanın içeriğini okumak için.
- <!--i:database--> **`storage`**: geçici sekmelerinin kimliklerini oturum depolamasına not etmek için; böylece tarayıcı bir istek sırasında uzantıyı durdurursa yine kapanırlar. Sayfa içeriği saklanmaz.
- <!--i:check--> **İsteğe bağlı site erişimi (`http://*/*`, `https://*/*`)**: kurulumda verilmez. **Approve once** düğmesine bastığında uzantı, o istekteki tek site için Chrome'dan erişim ister ve Chrome her site için ilk seferde sana sorar. Daha önce izin verdiğin bir site yine de her istek için yeni bir onay gerektirir.

Bunların hiçbiri, onayladığın tek isteğin ötesinde gezinmeni okumak, izlemek veya iletmek için kullanılmaz.

## Teslimat sunucuları ve işleyiciler

Herkese açık katalog dosyaları, araçlar ve görüntüleme sürümleri varsayılan olarak uygulamanın kendi adresinden gelir. İçerik adresli adlar bir dosyanın nereden getirildiğini değiştirir, isteği kimin aldığını değil. Bu teslimat özelliği hiçbir üçüncü taraf CDN'i etkinleştirmez. TLS'yi sonlandıran bir CDN, aynı tarayıcı ana bilgisayar adı altında bile istek ayrıntılarını, IP adreslerini ve ona iletilen çerezleri veya taşıyıcı kimlik bilgilerini alırdı; bu yüzden birini ekleyen bir işletme yeni bir işleyici üstlenir.

**Herhangi bir CDN veya harici model sunucusu eklemeden önce** yönetici; işleyici adını, ana bilgisayar adını, yargı alanlarını, alınan meta verileri, saklamayı ve aktarım düzenlemelerini yayımlamalıdır. [Delivery deployment](/info/deploy-delivery.html) nelerin açıklanacağını listeler. Özel çalışma alanı yanıtları paylaşılan önbellekleri atlar: kişisel sonuçlar, erişim reddi ve hatalar `private, no-store` kullanır ve izin verilen özel bir yanıt, herkese açık hâle gelmeden tarayıcında yeniden doğrulanabilir.

Referans hizmetleri aşağıdaki barındırmayı kullanır. Bu bir ana bilgisayar adları listesidir; başka bir kuruluşun örneğinin aynı bölgeyi kullandığına dair bir iddia değildir.

| Ana bilgisayar adı veya hizmet | İşlev ve alıcı | Bölge ve veri işleme |
|---|---|---|
| lolly.tools | Herkese açık uygulama, katalog, render ve sertifika hizmetleri; UpCloud barındırma | Frankfurt, Almanya. İstek ayrıntıları altyapı günlüklerinde görünebilir; olağan yerel düzenleme cihazda kalır |
| lolly.ing | Yönetilen çalışma alanı ve belge ajanı hizmetleri; UpCloud barındırma | Frankfurt, Almanya. Özel veritabanı ve dosya depolama aynı sunucudadır. Hesaplar, paylaşılan içerik ve hizmet kayıtları örnek yöneticisinin politikasını izler |
| mcp.lolly.tools | Planlanan isteğe bağlı kimliği doğrulanmış MCP ağ geçidi ve özel sonuç indirmeleri; UpCloud barındırma | Frankfurt, Almanya, aynı barındırma işleyicisiyle. Etkinleştirme beklemede. Ağ geçidi istek ayrıntılarını ve çağıranın gönderdiği parametreleri veya dosyaları alır |
| lolli.li | Herkese açık yayın ve model dosyaları; uygulama kümesinden ayrı, UpCloud Managed Object Storage | Frankfurt, Almanya, UpCloud'un europe-2 nesne depolama bölgesinde. Bir indirme istek ayrıntılarını gönderir, modelin sonradan işlediği girdileri değil |
| Yapılandırılmış kimlik sağlayıcı | Google, GitHub veya bir işletmenin OIDC sağlayıcısı | Giriş o sağlayıcının politikasını izler. Ana bilgisayar adı, bölge ve aktarım düzenlemeleri için örneğin işletmesine sor |
| Yapılandırılmış varlık sağlayıcı | Brandfolder veya işletmenin seçtiği başka bir kitaplık | Sağlayıcı izin verilen kitaplık isteklerini alır. Erişimi kaynak izinleri ve örneğin politikası belirler; ana bilgisayar adları ve bölgeleri için işletmeye sor |
| E-posta kaydı, yapılandırıldığında | Resend istenen giriş bağlantısını iletir | O ileti için hedef e-posta adresini alır; kendi işleme koşulları geçerlidir |

Referans uygulama başka bir barındırma, veritabanı veya kötüye kullanım denetimi sağlayıcısı kullanmaz. Bir işletme farklı bir örnek için başka sağlayıcılar seçebilir; barındırma, kimlik, varlık ve e-posta sağlayıcılarının her biri kendi açıklamasını gerektirir. Model sunucusunun [nesne depolama bölgesi](https://upcloud.com/docs/products/managed-object-storage/availability/), uygulamanın bölgesinden ayrı olarak doğrulanır.

**İsteğe bağlı sorumluya bağlı MCP indirme bağlantıları.** Bir işletme, kimliği doğrulanmış tek kopyalı bir ağ geçidinde büyük sonuçlar için indirme bağlantılarını açabilir. Varsayılan olarak kapalıdır. `lolly.tools/api/mcp` adresindeki anonim ağ geçidi sonuçları satır içi döndürür ve bu bağlantıları hiç vermez. Planlanan kısıtlı ana bilgisayar adı, Frankfurt'taki aynı UpCloud işleyicisinde `mcp.lolly.tools`'tur; etkinleştirme beklemededir ve bu sayfa canlı bir indirme bağlantısı hizmeti olduğunu iddia etmez. Bağlantılar üçüncü taraf CDN eklemez.

Yalnızca dosya kapsamı olan kimliği doğrulanmış bir çağıran bağlantı alabilir ve onu getirmek için aynı çağıranın taşıyıcısı gerekir: render çağrısından doğrulanmış taşıyıcıyı kullan, aynı hesabın başka bir belirtecini değil. İzin 300 saniye içinde sona erer. Sahiplik ve sonuç araması ağ geçidi belleğinde kalır, çıktı baytları ise sona erdikten sonra temizlenen veya temiz kapanışta kaldırılan özel geçici dosyalara gider. Bir ağ geçidi yeniden başlatması mevcut bağlantıları geçersiz kılar. Tutulan sonuçlar taşıyıcı başına 64 MiB, ağ geçidi genelinde 256 MiB ve 200 bekleyen veya tutulan dosyayla sınırlıdır. Günlük CPU ve çözülmüş bayt bütçeleri sonuçları tutulduklarında ve indirildiklerinde sayar. Yanıtlar `private, no-store` ve `Referrer-Policy: no-referrer` kullanır. Bir bağlantının belirteci tek başına başka bir kişinin veya ajanın sonucu okumasına izin vermez.

## Altyapı günlükleri

Bu bölüm herkese açık lolly.tools dağıtımını anlatır. Barındırma platformu olağan istek ayrıntılarını kaydeder: IP adresi, istenen yol, zaman damgası ve kullanıcı aracısı. Yerel düzenlemeler o sunucuya ulaşmaz. Bir render bağlantısının sorgu dizesi, yukarıda açıklandığı gibi çağıranın sağladığı metni içerebilir. MCP dosya araçları kendilerine verilen baytları bellekte işler. Bir Lolly Work örneği ayrıca yukarıda anlatılan kayıtları, işletmesinin günlük politikası altında tutar.

**Herkese açık hizmetler uygulama günlüğünü en aza indirir.** MCP sunucusu başlatma, yapılandırma ve render uyarılarını günlüğe kaydeder; kendi istek günlüğünü tutmaz ve belirteçleri veya çağıran adreslerini kaydetmez. Penpot geçiş katmanı her komut adını ve Penpot'un yanıt durumunu günlüğe kaydeder, asla üst bilgileri, belirteçleri veya dosyayı değil. Sertifika hizmeti başlatma ayarlarını ve yapılandırma uyarılarını, ayrıca hata durumunda iki sadeleştirilmiş satır kaydeder: alıcı adresi içermeyen bir gönderim hatası durum kodu ve hata metni, yığın izi veya URL içermeyen sabit bir hata satırı; çünkü bir sağlayıcı hatası kimlik değerleri veya kimlik bilgileri taşıyabilir. Günlükteki diğer her şey barındırma platformundan gelir.

lolly.tools için istek günlüğünü, döndürmeyi ve saklamayı UpCloud üzerinde örnek yöneticisi denetler. Bu sayfa, doğrulanmamış bir en uzun günlük saklama süresi belirtmez. Güncel takvim ve sunucuda tutulan günlüklerle ilgili her talep için aşağıdaki sorumluyla iletişime geç. Başka bir örnek için, günlük dışa aktarmaları veya diğer işleyiciler dahil işletmesinin ayarları geçerlidir.

## Hukuki dayanaklar, saklama süreleri ve alıcılar

Bu tablo referans **lolly.tools** dağıtımını kapsar. Kuruluşunun Lolly Work örneğinin hukuki dayanaklarını veya saklama sürelerini belirtmez; bunları işletmesi kendi politikasında sağlar.

| İşleme | Hukuki dayanak (GDPR Md. 6) | Saklama süresi |
|---|---|---|
| Cihazındaki her şey (belgeler, tercihler, önbellek, sayaçlar) | **Hiç bizim işlememiz değil**: bize hiç ulaşmaz. Cihazındaki depolama, istediğin hizmet için kesinlikle gereklidir (ePrivacy Md. 5(3)); bu yüzden onay gerektirmez | Sen silene kadar |
| Eski barındırılan Content Credentials kaydı sırasında e-posta adresin | **Md. 6(1)(b)**, açıkça istediğin bir hizmetin ifası | Eski hizmette kimlik envanteri veya düzenleme günlüğü yok; e-posta istek sırasında kullanılır ve sertifikana dahil edilir. Yönetilen kuruluş PKI, denetim ve iptal saklaması işletmesinin politikasını izler |
| Giriş uç noktalarının ve herkese açık render, görsel ve MCP uç noktalarının hız sınırlaması için IP adresinden üretilen takma adlı bir SHA-256 özeti | **Md. 6(1)(f)**, ücretsiz bir hizmetin ve üçüncü bir tarafın e-posta kotasının kötüye kullanımını önlemedeki meşru menfaatimiz. Ham adres sınırlayıcıya gönderilmediği, özet yalnızca kötüye kullanım denetimi için kullanıldığı ve kendiliğinden sona erdiği için bunun bir denge testini geçtiğini düşünüyoruz | Kötüye kullanım denetimi deposunda yaklaşık bir dakika; sonrasında tutulmaz |
| Barındırma erişim günlükleri (IP, yol, zaman damgası, kullanıcı aracısı) | **Md. 6(1)(f)**, hizmet güvenliği, kötüye kullanımın önlenmesi ve arızaların teşhisindeki meşru menfaatimiz | Yönetici tarafından yapılandırılan döndürme ve saklama; güncel takvim için sorumluyla iletişime geç |

**Alıcılar.** Alıcı kategorileri, uygulamanın veritabanını ve kötüye kullanım denetimi deposunu barındıran barındırma sağlayıcımız (UpCloud) ve yalnızca e-posta ile giriş seçeneğini kullanırsan işlemsel bir e-posta sağlayıcısıdır (Resend). Kötüye kullanım denetimi deposu yalnızca kısa ömürlü özetleri alır, ham IP adresini asla almaz. GitHub, Google veya SUSE (id.suse.com) ile giriş yaparsan o sağlayıcıyla kendi gizlilik politikası altında doğrudan muhatap olursun ve bize doğrulanmış bir e-posta adresinden başka bir şey söylemezler. Kişisel verileri başkasıyla paylaşmayız; veri satmayız, reklam yapmayız ve kullanıcıları profillemeyiz.

**AEA dışına aktarımlar.** Referans uygulamanın barındırması, veritabanı ve dosya depolaması Frankfurt'tadır. İsteğe bağlı kimlik, e-posta ve varlık sağlayıcılarının AEA dışındaki erişimi içerebilen kendi işleme konumları ve koşulları vardır ve bir sunucunun bölgesi tek başına her alıcının yargı alanını belirlemez. Geçerli sağlayıcı sözleşmeleri ve aktarım düzenlemeleri için sorumluyla iletişime geç; başka bir örnek için işletmesine sor. Avrupa Komisyonu'nun [Standart Sözleşme Maddeleri](https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/standard-contractual-clauses-scc_en), bu tür aktarımlar için mevcut bir güvencedir; bu sayfa doğrulanmamış bir sağlayıcı sözleşmesinin onları kullandığını iddia etmez.

**Otomatik karar verme.** Yok. Profilleme yoktur ve hukuki veya benzer şekilde önemli sonuçları olan otomatik bir karar yoktur (Md. 22).

## Çocukların gizliliği

Olağan yerel uygulama kullanımı lolly.tools'a kişisel içerik göndermez. İsteğe bağlı Content Credentials kaydı bir e-posta adresi alır ve çocuklara yönelik veya çocuklar için tasarlanmış değildir. Kuruluş hizmetlerinin, işletmesinin politikası altında kendi hesapları ve veri işleme biçimi vardır.

## Haklarınız

Yalnızca cihazında saklanan kayıtlar için verilere kendin erişebilir, onları düzeltebilir, silebilir ve taşıyabilirsin. Bunlar tarayıcının veya uygulamanın depolamasında, inceleyebileceğin, dışa aktarabileceğin (yukarıdaki **Export my data**) veya silebileceğin (**Clear all my data** ya da tarayıcının site verileri) bir biçimde bulunur.

Resmî olarak, GDPR Md. 15-22 uyarınca kişisel verilerine **erişme**, onları **düzeltme**, **silme**, işlenmelerini (meşru menfaatlere dayandırdığımız her şey dahil) **kısıtlama** veya **itiraz etme**, **veri taşınabilirliği** ve işleme rızaya dayandığında, rızanı geri çektiğin ana kadar olanların hukuka uygunluğunu etkilemeden **rızanı her zaman geri çekme** hakkına sahipsin.

Herkese açık sertifika hizmeti bir düzenleme günlüğü tutmaz. Altyapı günlükleri istek ayrıntıları içerebilir; bu yüzden bu politika barındırma ortamının hiçbir kişisel veri tutmadığını vaat etmez. Bu kayıtlarla ilgili erişim, silme veya başka bir talep için sorumluyla iletişime geç; hangi kayıtların bulunduğunu ve neler yapılabileceğini açıklarız. Bir kuruluşun tuttuğu iş, kimlik, telemetri ve denetim kayıtları için Lolly Work işletmenle iletişime geç; çünkü yerel dışa aktarma ve silme denetimleri o kopyalara ulaşmaz.

**Şikâyet etme hakkın var.** Verilerini uygunsuz işlediğimizi düşünüyorsan bir veri koruma denetim makamına şikâyette bulunabilirsin: AB'de ikamet ettiğin ülkedeki, çalıştığın yerdeki veya ihlalin gerçekleştiğine inandığın yerdeki makam (Md. 77). Baş denetim makamımız, Almanya'nın Ansbach kentindeki *Bayerisches Landesamt für Datenschutzaufsicht*'tır (BayLDA). Önce bizimle iletişime geçmen gerekmez; yine de sorunu düzeltme fırsatı bulmak isteriz.

## Bu politikadaki değişiklikler

En üstteki tarih, bu belge her değiştiğinde değişir. Cihazından nelerin çıktığını veya nelerin tutulduğunu değiştiren bir değişiklik, sessiz bir düzenleme yerine burada kendi satırını alır. Nelerin değiştiğini görmek için sor (aşağıda) ya da [herkese açık kaynak](https://github.com/lolly-tools/lolly/commits/main/docs/privacy.md) ile karşılaştır.

**29 Eylül 2026:** isteğe bağlı lolly.work hizmeti, kuruluşun tuttuğu içerik, kimlik doğrulama çerezleri, kullanım telemetrisi ve denetim kayıtları ile yerel silme ile sunucuda saklama arasındaki ayrım netleştirildi. Bunlar mevcut isteğe bağlı iş akışlarıdır; yerel düzenleme için yeni bir yükleme gereksinimi değildir.

**11 Ekim 2026:** emekliye ayrılan Vercel barındırma açıklaması, UpCloud uygulama ana bilgisayar adı envanteriyle değiştirildi, isteğe bağlı kimlik ve varlık sağlayıcıları ayrıştırıldı, içerik adresli teslimat ve tutulan MCP indirme modu anlatıldı. Bu değişiklikle hiçbir üçüncü taraf CDN etkinleştirilmedi. Günlük saklama, belirtilmiş bir Vercel plan varsayılanı yerine yönetici tarafından denetlenir.

**22 Ekim 2026:** mevcut davranışın açıklaması düzeltildi. Tarayıcı uzantısı bölümü artık her istek için onay penceresini, her seferinde tek site için istenen site erişimini ve bir web sitesi okumasının stil sayfası ile simge getirmelerini kapsıyor. Ayrıca düzeltildi: Google Drive'a gönderme ve Meeting Planner satırları, SEAL notu (hiçbir Lolly uygulaması SEAL anahtarlarını DNS'te aramaz), kuruluş hizmetinin varsayılan kullanım telemetrisi düzeyi, MCP görsel araçları ve herkese açık hizmetlerin uygulama günlüğü. Yazılımın kendisi değişmedi.

**23 Ekim 2026:** politika, her isteği neyin başlattığına göre yeniden düzenlendi ve daha önce kapsamadığı mevcut davranış anlatıldı: yerel ağ adreslerini taşıyan özel collab davetleri, masaüstü uygulamasında Nearby, Allow AI control, bir web sitesinden tasarım sistemi okuma, emoji setleri, Meeting Planner'ın şehir aramalarının cihazdaki önbelleği, Çöp Kutusu ve Settings → Storage'ın listelediği diğer kayıtlar. İki ifade düzeltildi: Bluesky ve Discord yalnızca masaüstüne özgü değildir ve bir kişinin gönderim için seçtiği her sunucu hem web hem masaüstü uygulamalarında işletmenin onayını gerektirir; bir IP adresinin hız sınırlama özeti anonim değil takma adlıdır. Yazılımın kendisi değişmedi.

## Kim sorumlu ve bize nasıl ulaşılır

lolly.tools için **veri sorumlusu**:

> SUSE Software Solutions Germany GmbH
> Frankenstraße 146
> 90461 Nürnberg
> Almanya

SUSE bir **Veri Koruma Görevlisi** atamıştır; [privacy@suse.com](mailto:privacy@suse.com) adresinden ulaşılabilir. Yukarıdaki "Haklarınız" kapsamındaki her resmî talep için bu adresi kullan.

Lolly'nin kendisiyle ilgili her şey için, örneğin nasıl çalıştığı, bir şeyin neden öyle olduğu veya bu belgede bir düzeltme için **Andy Fitzsimon** ile iletişime geç: [fitzy@suse.com](mailto:fitzy@suse.com).

Kendi sunucusunda barındırılan veya kurumsal bir Lolly örneği için bunun yerine onu işleten kişiyle iletişime geç: işletmen kendi dağıtımının sorumlusudur. SUSE ve Lolly açık kaynak projesi, işletmedikleri dağıtımlar için hiçbir veri tutmaz.
