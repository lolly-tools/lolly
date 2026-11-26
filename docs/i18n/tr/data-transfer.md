# Veri aktarımı: `lolly-backup` paketi

Yedekleme paketi, Lolly'nin cihazda tuttuğu kişisel kitaplığı taşır: bir kurulumda dışa aktar, dosyayı taşı (USB, AirDrop, kendine e-posta veya ağ paylaşımı) ve başka bir kurulumda içe aktar. Dışa ve içe aktarma sunucu gerektirmez ve hedef çevrimdışı olabilir.

Bu, yedeklerle çalışan kabuklar, araçlar veya betikler geliştirenler için biçim belirtimidir. Kendi işini taşımak için [İşini başka bir cihaza taşı](/info/find-your-work.html#move-your-work-to-another-device) sayfasını oku.

![Tüm kurulumu taşıyan iki düğme: Export my data tek bir zip yazar, Import data onu geri okur](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-move%3Ediv%3Anth-of-type%282%29%2C.store-move%3Ep%3Alast-of-type%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dmove%5D%3Esummary&walker=1&format=svg&cropSelector=%5Bdata-store-group%3Dmove%5D&dark=1&filename=pd-transfer-controls)

::: note Kapsam
Paket, katalog araçlarını değil *kullanıcı verilerini* taşır. Katalog araçları ve katalog varlıkları ayrı eşitlenir ve hedefte, en kötü ihtimalle daha yüksek bir sürümde, bulundukları varsayılır. Kullanıcının oluşturduğu araçlar `profile.json` içinde taşınır. İçe aktarma hiçbir zaman bir katalog aracını kurmaz veya yükseltmez.
:::

<!--i:eti-badge-check-->
## Hedefler

- <!--i:box--> **Tek biçim, her kabuk.** Web uygulaması, masaüstü ve mobil uygulamalar ve gelecekteki kabuklar aynı kapsayıcı ve parça şemalarını paylaşır. İsteğe bağlı parçalar her kabuğun yeteneklerine bağlıdır ve desteklenmeyen parçalar bildirilir. Her yetenek köprüsü kendi depolama bağdaştırıcısını sağlar.
- <!--i:shieldcheck--> **Yolculuğa dayanır.** Aktarım sırasında hasar gören veya kesilen bir paket, içe aktarmada hatayla başarısız olur ve hiçbir zaman yarım geri yüklenmez.
- <!--i:clock--> **Bu sürümden daha uzun ömürlüdür.** Eski bir uygulama, daha yeni bir paketin tanıdığı parçalarını içe aktarır. Uyumluluğu bozan bir biçim sorunsuzca reddedilir.
- <!--i:check--> **Güvenle birleştirilir.** Kullanılmakta olan bir kuruluma içe aktarma, pakette olmayan hiçbir şeyi silmez.

<!--i:eti-package-->
## Kapsayıcı

Paket, sıradan bir `.zip` dosyasıdır. Her türlü aktarımda bozulmadan kalır ve herhangi bir zip açma aracı içeriğini inceleyebilir.

İndirilen dosya sahibine göre adlandırılır: `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip`, örneğin `LollyTools-Ada-Lovelace-2026-06-26-1.zip`. Ad ve soyad profilden alınır ve belirtilmemişse dışarıda bırakılır: profil yoksa `LollyTools-2026-06-26-1.zip`, yalnızca ad varsa `LollyTools-Ada-2026-06-26-1.zip` olur. Her ad, dosya adına uygun bir token'a dönüşür (Unicode harfler ve rakamlar korunur, boşluklar ve noktalama işaretleri kaldırılır, en fazla 32 karakter). `<n>`, gün ve cihaz başına bir sıra numarasıdır; böylece aynı gün yinelenen dışa aktarmalar çakışmaz ve sıralarını korur. Adı, `data-transfer.ts` içindeki `backupFilename()` oluşturur. Ad, zip'in içeriğini değiştirmez.

| Yol | Gerekli | İçerik |
|---|---|---|
| `manifest.json` | evet | Biçim kimliği, sürümler, sayılar ve parça başına bütünlük. Okuyucu önce bu dosyayı okur. |
| `profile.json` | ayarlandığında | Kullanıcının `me` kaydı: ad, iletişim, portre referansı ve bayraklar; ayrıca klasörler, Trash, proje planları, kullanıcı şablonları ve kullanıcının oluşturduğu araçlar, favoriler, gizli araçlar, dil ve emoji seçimi. `host.profile` üzerinden okunur. |
| `sessions.json` | evet | Kaydedilen her oturum: yuva, araç kimliği ve sürümü, etiket, küçük resim (veri URL'si) ve tüm girdi verileri. `host.state` üzerinden okunur. |
| `assets.json` | evet | Yüklenen her varlığın meta verileri (görseller, yazı tipleri, marka token'ları, logolar, indirmelerin kaydedilmiş kopyaları); her biri `assets/blobs/` altındaki baytlarına işaret eder. |
| `assets/blobs/<n>.<ext>` | varlık başına | Çoğu zaten sıkıştırılmış biçimde olduğu için sıkıştırılmadan saklanan ham varlık baytları. Uzantı yalnızca görünüm içindir; `assets.json` içindeki MIME türü belirleyicidir. |
| `assets/blobs/<n>.c2pa` | varsa | Varlık kaydındaki `_credentialFile` ile referans verilen, ikili baytları birebir korunmuş çıkarılmış Content Credentials. Bunlar cihazın imzalama anahtarları değildir. |
| `design-systems.json` | varsa | Bu kurulumda oluşturulan veya eklenen tasarım sistemleri, `{ active, records }` olarak. Bkz. [İçe aktarma kuralları](#import-rules). |
| `file-history.json` | isteğe bağlı | Kendi sürümü olan, sürümlenmiş varlık anlık görüntüleri, tamamlanmış dosya işlemi raporları ve eksiksiz toplu iş bildirimleri. Kabuğun dahili `fileHistory` yedekleme bağdaştırıcısı tarafından sağlanır. |
| `revision-history.json` | isteğe bağlı, elle alınan yedekler | Kalıcı çalışma kimlikleri, saklanan kontrol noktaları, küçük resimler ve sürekli güncellenen kurtarma taslakları. Desteklendiğinde `host.state.history.backup` tarafından sağlanır. |
| `file-history/versions/` | anlık görüntü başına | Geçerli varlık hâlâ mevcut olsa da olmasa da önceki varlık baytları ve çıkarılmış kimlik bilgileri. |
| `file-history/results/` | tamamlanmış işlem başına | Çıktı baytlarının birebir kopyası. Dönüştürme için seçilen hiçbir özgün dosya saklanmaz veya dahil edilmez. |
| `prefs.json` | evet | Kullanıcıya ait yerel tercihler: `theme`, `sidebarWidth` ve `ct-metrics` etkinlik sayacı. |
| `lolly.txt` | evet | Zip'i Lolly olmadan açan herkes için paketin okunabilir özeti (sayılar, profil, dosya adı). Her dışa aktarmada yeniden oluşturulur ve içe aktarmada tanınır; bu yüzden hiçbir zaman atlanan parça sayılmaz. Bütünlük haritasından sonra yazılır; bu yüzden harita bu dosyayı kapsamaz. |

::: details Dışa aktarma zip'i nasıl yazar
Dışa aktarma zip'i parça parça yazar (`shells/web/src/lib/zip-stream.ts`). Yüklenen dosyalar, kayıtlı sonuçlar ve kayıtlı varlık sürümleri 4 MiB dilimler halinde okunur, asla bütün olarak okunmaz. Kayıtlı sonuçlar ve sürümler önce kayıtlı SHA-256 özetleriyle denetlenir. Ardından her dosya, sağlama toplamı ve bütünlük özeti için okunur ve zip dosyaya bulunduğu yerde referans verir.

Hiçbir şey yeniden kodlanmaz. Her parça baytlarını ve özetini birebir korur; böylece Content Credentials taşıyan bir dosya, imzasının kapsadığı baytları korur. Aynı parçalar ve zaman için zip, önceki bellek içi yazıcının ürettiğiyle aynıdır; tek fark, 16 MiB üzerindeki bir geçmiş dosyasının parçalar halinde sıkıştırılmasıdır. `tests/backup-streaming.test.ts`, bunu kayıtlı referans özetleriyle denetler.

Node'da ölçülen 192 MiB'lık sentetik bir kitaplıkta, yedeği tamamlamak kitaplığın üzerine yaklaşık 125 ila 150 MiB gerektirdi; bellek içi yazıcı için bu yaklaşık 850 MiB idi (`node scripts/bench-backup-finalise.ts`). İçe aktarma hâlâ zip'in tamamını belleğe okur.
:::

<!--i:eti-file-->
## `manifest.json`

```json
{
  "format": "lolly-backup",
  "formatVersion": 3,
  "minReader": 1,
  "app": "lolly",
  "exportedAt": "2026-06-22T09:30:00.000Z",
  "counts": { "profile": true, "sessions": 2, "userAssets": 4, "prefs": 3, "assetVersions": 1, "fileOperations": 1 },
  "integrity": {
    "profile.json": "sha256-…",
    "sessions.json": "sha256-…",
    "assets.json": "sha256-…",
    "assets/blobs/0.bin": "sha256-…",
    "file-history.json": "sha256-…",
    "file-history/versions/0.bin": "sha256-…",
    "file-history/results/0.bin": "sha256-…",
    "prefs.json": "sha256-…"
  }
}
```

| Alan | Anlamı |
|---|---|
| `format` | Her zaman `lolly-backup`. Bunu içermeyen dosya, "Lolly yedeği değil" diye reddedilir. |
| `formatVersion` | Bu paketin **yazıldığı** düzen. Parça kümesi veya yapılarındaki her değişiklikte artırılır. Okuyucular kabul kararını bu alana göre **vermez**. |
| `minReader` | Bu paketi **güvenle** içe aktarabilecek en düşük okuyucu sürümü. Okuyucuların kabul kararını verdiği alan budur. |
| `app` | Tanılama için, üreten uygulamanın kimliği. |
| `exportedAt` | Paketin oluşturulduğu ISO zaman damgası. |
| `counts` | Gösterim ve tutarlılık denetimleri için yazıcının ekledikleri. |
| `integrity` | İsteğe bağlı. `manifest.json` dışındaki her parçayı, **sıkıştırılmamış** baytlarının SRI tarzı `sha256-<base64>` özetine eşler. |

<!--i:eti-tag-->
## Sürüm politikası

İki sürüm numarası, eski kurulumları geride bırakmadan biçimin gelişmesini sağlar.

![Paket biçimindeki bir değişiklik ya eski okuyucuların yok sayabileceği eklemeli bir değişikliktir ya da yanlış içe aktarmanın veriyi bozduğu, uyumluluğu bozan bir değişikliktir. Eklemeli değişiklik formatVersion'ı artırır ve minReader'ı korur; uyumluluğu bozan değişiklik formatVersion'ı ve minReader'ı artırır. Okuyucu, minReader en fazla kendi sürümü kadarsa içe aktarır.](/info/diagrams/concepts/backup-version-gate.svg)

- Bir okuyucu, `manifest.minReader` en fazla kendi okuyucu sürümü kadarsa paketi içe aktarır. Yalnızca paket daha yeni bir okuyucu gerektirdiğinde "uygulamanın daha yeni bir sürümü gerekiyor" diyerek reddeder.
- Yeni bir isteğe bağlı parça veya yeni bir isteğe bağlı bildirim alanı gibi **eklemeli** değişiklik, `formatVersion` değerini artırır ve `minReader` değerini olduğu gibi bırakır. Eski uygulamalar tanıdıkları her parçayı yine içe aktarır; tanımadıkları parçalar sessizce atılmaz, atlandı olarak bildirilir.
- Bir parçanın yanlış içe aktarılmasının veriyi bozduğu veya isteğe bağlı bir parçanın zorunlu hale geldiği **uyumluluğu bozan** değişiklik, `minReader` değerini artırır. Eski uygulamalar bu durumda işleyemeyecekleri bir şeyi içe aktarmak yerine sorunsuzca reddeder. Eski uygulamalar bu durumda paketi sorunsuzca reddeder.
- Gelecekteki bir paket `formatVersion` değerini ayarlayıp `minReader` değerini dışarıda bırakırsa okuyucular kabul kararını `formatVersion` üzerinden vermeye döner ve değişikliği uyumluluğu bozan olarak değerlendirir.

::: note Yazarlar için pratik kural
Mevcut okuyucuların tümü eklediğin şeyi yok sayarak hâlâ doğru davranacaksa değişiklik eklemelidir: `formatVersion` değerini artır ve `minReader` değerini olduğu gibi bırak. Aksi halde `minReader` değerini artır.
:::

<!--i:eti-shield-check-->
## Bütünlük

`manifest.integrity` varsa okuyucu, **herhangi bir şey yazmadan önce** listelenen her parçanın SHA-256 özetini denetler. Bir uyumsuzluk ("bütünlük denetimi başarısız") veya eksik parça ("eksik") içe aktarmayı durdurur; böylece kısmi geri yükleme olmaz. Bu, aktarım hasarını yakalar: yarıda kesilen bir AirDrop, eki yeniden kodlayan bir e-posta ağ geçidi, bozuk bir USB sektörü.

Bütünlük mümkün olduğu ölçüde sağlanır. Yalnızca Web Crypto'nun bulunduğu yerlerde (her güvenli tarayıcı bağlamı ve modern Node) yazılır ve yalnızca hem harita hem Web Crypto varsa denetlenir. Bütünlük özelliği eklenmeden önce oluşturulmuş bir paket gibi haritası olmayan bir paket, değişiklik olmadan içe aktarılır: "doğrulanamıyor" hiçbir zaman "bozuk" sayılmaz.

Bildirim ne kendisini ne de yeniden oluşturulan `lolly.txt` dosyasını listeler.

<!--i:eti-download-->
## İçe aktarma kuralları

İçe aktarma iki moddan birinde çalışır.

- **Merge**, **Import data…** ve eşitlemeye ilk katılımdaki **Bring it to this device** işlemlerinin yaptığıdır. Hedefteki veriler kalır ve paketin dışındaki hiçbir şeye dokunulmaz.
- **Replace**, cihaz eşitlemesinin cihazları aynı durumda tutmak için kullandığı moddur. Eşitlenen kopyanın profil kaydını, tercihlerini, oturumlarını, görsellerini ve etkin tasarım sistemi seçimini alır. Yalnızca son eşitlemeden bu yana başka bir cihazın sildiği öğeleri kaldırır. Önceki bir kopyayı geri yüklemek önce cihazı kaydeder, ardından cihazı o kopyayla eşleştirir ve kopyanın içermediği her şeyi kaldırır. [Cihazlarını eşitle](/info/sync.html), kullanıcının gördüklerini açıklar.

Birleştirme her veri türünü şöyle işler:

| Veri | Hedefte zaten varsa | Yalnızca pakette varsa |
|---|---|---|
| Oturumlar (yuvaya göre) ve yüklenen görseller (kimliğe göre) | Daha yakın zamanda kaydedilmiş kopya korunur; böylece eski bir yedek daha yeni çalışmanın üzerine asla yazmaz. Zamanlar eşitse veya bilinmiyorsa hedefin kopyası korunur. | Eklenir |
| Klasörler | Hedefin adı ve üst klasörü korunur; klasöre pakette bulunan ve kendisinde eksik olan üyeler eklenir. Hedefte bir klasöre yerleştirilmiş oturum orada kalır. | Eklenir |
| Favoriler (araçlar, katalog varlıkları ve Projects öğeleri) | Birleştirilir | Eklenir |
| Şablonlar, Projects şablonları ve kullanıcı araçları (kimliğe göre) | Hedefin kaydı korunur. | Eklenir |
| Trash girdileri | Hedefin girdisi korunur. | Eklenir; böylece iki kurulumdan herhangi birinde geri yüklenebilen bir öğe yine geri yüklenebilir. Klasörü hedefte yeniden kullanımda olan veya Trash yuvasını hedefin zaten kullandığı bir girdi dışarıda bırakılır. |
| Diğer profil alanları (ad, iletişim bilgileri, dil, özellik bayrakları, gizli araçlar ve diğer ayarlar) | Hedefin değeri korunur. | Hedefin alanı boşsa alınır |
| Tercihler (`prefs.json`) | Hedefin değeri korunur. | Hedefte yoksa yazılır |
| Tasarım sistemleri (kimliğe göre) | Paketin kaydı hedefinkinin yerini alır. | Eklenir. Paketin etkin seçimi yalnızca hedefin kendi tasarım sistemi yoksa uygulanır. |
| Çalışma geçmişi | Daha yakın zamanda kaydedilen kopya güncel kalır, diğeri korumalı taslak olarak saklanır. | Eklenir |

**Kayıtlı oturumlar görsellerine otomatik olarak yeniden bağlanır.** Varlık referansları kimliğe göre tutulur. Köprü, görseller geri yüklendikten sonra bunları yeniden çözümler; çünkü `blob:` URL'leri yeniden yüklemede korunmaz.

**Geçmiş kayıtları yazıldıktan sonra asla değişmez.** Varlık sürümlerini ve işlem kimliklerini tekrar içe aktarmak hiçbir şey eklemez; zaten farklı baytları veya geçmişi tanımlayan bir kimliğin üzerine yazılmaz, kimlik reddedilir. Aynı geçerli varlığı yeniden içe aktarmak sürümünü korur; değiştirilmiş bir geçerli varlık ise farklı bir sürüm taşımalıdır.

**Çalışma geçmişinin birkaç kuralı daha vardır.** Hedefin yuvasını başka bir çalışma için kullandığı çalışma, ayrı bir çalışma olarak eklenir; hedefin Trash bölümündeki bir çalışma ise orada kalır. Hedefte farklı içeriği tanımlayan bir kontrol noktası kimliği varsa hedefteki korunur. Kendi denetimlerinden geçemeyen bir arşiv, profil, oturum, varlık veya tercihlerde herhangi bir değişiklik yapılmadan içe aktarmayı durdurur ve aynı içeriği tekrar içe aktarmak ek depolama alanı kullanmaz.

**Özet, olanları bildirir.** Her içe aktarma `profile`, `sessions`, `userAssets`, `prefs`, `skipped` ve `failedAssets` döndürür.

- `failedAssets`, örneğin cihaz depolaması dolu olduğu için geri yüklenemeyen yüklenmiş varlıkları sayar.
- `skipped`, bu derlemenin tanımadığı, daha yeni bir yazıcıdan gelen parçaları sayar. Uygulama sayıyı gösterir ("… · N daha yeni öğe atlandı").
- Dosya geçmişiyle birlikte özet, `assetVersions`, `fileOperations`, `fileBatches` ve `failedHistory` ekler. Depolama alanının tükenmesi veya değişmez kimlik çakışması kısmi geri yüklemeye neden olabilir; uygulama bu durumda kişiye kaynak yedeği saklamasını söyler.
- Çalışma geçmişiyle birlikte, yalnızca bu içe aktarmanın eklediklerini sayan `revisions` ve `recoveryDrafts` ile her çalışmanın nasıl birleştirildiğini gösteren `added`, `kept`, `replaced`, `copies` ve `hidden` ekler. `skippedCheckpoints`, kimliği hedefte farklı içeriği tanımlayan kontrol noktalarını sayar; `historyLeftOut` ise cihazın geçmiş alanına sığmayan eski kontrol noktalarını ve taslakları sayar.
- Yerine koyma modunda içe aktarma, `removed` ve `failedRemovals` ekler.

Geri yükleme; profil, oturum, varlık ve geçmiş depolarını kapsayan tek bir işlem değildir. Bulut eşitlemesi, kısmi veya desteklenmeyen bir geri yüklemenin ardından uyguladığı revizyonu **ilerletmez**, böylece kopya yeniden denemek için kullanılabilir kalır.

<!--i:eti-unlink-->
## Neler taşınmaz

- **Katalog önbellekleri** (indirilen varlık meta verileri ve blob'lar, araç dizini), hedef bunları yeniden eşitler.
- **Katalog araçları ve katalog varlıkları**, hedefte bulundukları varsayılır. Kullanıcının eklediği marka token'ları, yazı tipleri ve logolar kullanıcı varlıklarıdır ve taşınır.
- **`blob:` ve nesne URL'leri**, köprü bunları yükleme sırasında yeniden oluşturur.
- **Dönüştürme işlemlerinin özgün dosyaları, etkin yürütme kiraları ve makineye özgü erişim veya imzalama sırları.** Bunlar taşınabilir geçmiş değildir. Kaydedilmiş bir sonuç bir kopyadır. Özgün kaynağın yedeklendiği anlamına gelmez.
- **Dışa aktarma sıra sayacı**, `localStorage` içindeki günlük indirme adlandırma sayacı (`lolly-export-seq`). `PREF_KEYS` dışında tutulur, bu yüzden bir paket içinde asla taşınmaz.

Depolama göstergesi de aynı ayrımı gösterir. Saved sessions, My images ve File results & versions bir pakete girer. Varlık önbelleği, araç önizlemeleri ve çevrimdışı sabitlenenler yeniden oluşturulabilir ve geride kalır.

![Bu cihazın verilerini adlandırılmış kategorilere ayıran depolama göstergesi; Saved sessions ve My images, Asset cache'den ayrı izleniyor. Burada her kategorinin hâlâ boş olduğu yeni bir kurulum gösteriliyor](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&dark=1&filename=ce-storage-categories)

<!--i:eti-building-->
## Lolly Work ile kuruluş verileri

Bu paket, cihazın kişisel kitaplığını yedekler. Bir paket, bir **Lolly Work** kurulumunun yedeği değildir. Kuruluş hesapları, erişim politikaları, paylaşılan projeler, katalog sürümleri, onaylar, render işleri ve denetim kayıtları o hizmette tutulur. Paylaşılan işlere yeniden erişmek için tekrar bağlan ve oturum aç. Kişisel bir paketi içeri aktarmak bu erişimi sağlamaz.

İşletmenler, sunucu verilerini Lolly Work'ün kendi kılavuzlarıyla yedekler, saklar ve siler: [Yedekleme ve geri yükleme](/info/work-operations.html#backup-and-restore) ve [Lolly Work depolama ve veri yaşam döngüsü](/info/work-data-lifecycle.html). Bir cihazı temizlemek veya dışa aktarmak bu sunucu işlemlerinin hiçbirini yapmaz.

<!--i:eti-monitor-->
## Kabuklar arasında

`data-transfer.ts` yalnızca yetenek köprüsü (`host.profile`, `host.state`, `host.assets`) ve paylaşılan `localStorage` tercihleri üzerinden okur ve yazar. Aynı modül; web'de, masaüstü ve mobil uygulamalarda ortak zarfı IndexedDB veya dosya sistemi depolaması üzerinden okur ve yazar. İsteğe bağlı geçmiş bölümleri yalnızca adaptörleri kullanılabildiğinde görünür. İçeri aktarma, desteklenmeyen bir bölümü atlanmış olarak bildirir. Arayüzsüz test paketi, ortak bölümleri bellek içi bir köprüyle sınar ve geçmiş işlemlerinin gerçek tarayıcı testleri de vardır.

İki kabuk bu güvencenin dışındadır:

- **Tek seferlik CLI** taşıyacak bir şey içermez: durumu bellektedir ve tek bir çağrı boyunca sürer.
- **TUI**, durumu `~/.lolly` içinde tutar (oturumlar, klasörler, profil). Profile görünümü kendine ait daha basit bir yedek arşivi yazar: oturum başına `saved-state/<slot>.json`, ayrıca `profile.json` ve `folders.json`; bildirim, `formatVersion`, `minReader` veya bütünlük haritası yoktur. Bu biçimin okuyucusu, adlar benzer olsa da (`lolly-backup-<stamp>.zip`) o arşivi "Lolly yedeği değil" diye reddeder. İkisini birleştirmek bilinen bir eksikliktir.

<!--i:eti-clock-->
## Henüz taşınabilir değil

Yeni taşınabilir veri türleri daha sonra ek bölümler olarak katılabilir (yeni bir `formatVersion`, aynı `minReader`). Tasarım sistemleri, `design-systems.json` ve kullanıcı varlıkları olarak zaten bu şekilde taşınır.

Henüz taşınmayan veriler için iki ad ayrılmıştır:

- **`tokens.json`**, grupları, kümeleri ve temalarıyla bir [W3C DTCG](https://tr.designtokens.org/format/) tasarım token'ları belgesi taşıyacaktır; bu, [Penpot'un içeri ve dışa aktardığı](https://help.penpot.app/user-guide/design-systems/design-tokens/) biçimdir. Kullanıcının kendi marka token'ları zaten `assets.json` içindeki `user/tokens/brand` varlığı olarak, bir tasarım sisteminin token'ları da o sistemin kaydıyla taşınır.
- **`penpot/`**, araç olarak sunulan, içeri alınmış bir Penpot dosyası veya onun Lolly ile ilgili alt kümesi için ayrılmıştır.

<!--i:eti-history-->
## Geçmiş bölümleri

İki geçmiş bölümü isteğe bağlıdır ve kendi sürümleri vardır.

::: details Oluşturma geçmişi (v3)
Oluşturma geçmişi olan bir web kurulumundan elle alınan yedekler, kendine ait `{ version: 1, documents, revisions, recoveries }` şemasıyla `revision-history.json` içerir. Saklanan kimlikleri, kanonik girdi anlık görüntülerini, sürüm damgalarını, raster önizlemeleri ve ayrı yazıcı taslaklarını taşır. Geçmiş adaptörü, geçerli oturumları ve bunların en güncel revizyonlarını tek bir okuma işleminde yakalar ve `sessions.json`, eski okuyucular için aynı geçerli anlık görüntüleri kullanır.

Geri yükleme, arşivi tek bir işlemde kalıcı olarak kaydetmeden önce yükün SHA-256 değerini ve bayt sayılarını, benzersiz kimlikleri, belge ve en güncel revizyon ilişkilerini, soy zincirini, zaman damgalarını, önizleme türlerini ve sınırları denetler. Sıkıştırılmış üst revizyon başvuruları eksik olabilir. Mevcut güncel iş asla sessizce değiştirilmez: bir çalışma her iki tarafta da varsa güncel tutulmayan taraf korumalı bir taslağa dönüşür.

Arşivin aktarım sınırı 384 MiB'dir. Depolama sınırları, saklanan kontrol noktaları kırpılmadan uygulanır. Dışa aktarma, `revision-history.json` ve `sessions.json` dosyalarını parçalar hâlinde, tek bir `JSON.stringify` çağrısının ürettiği baytlarla yazar; böylece dosya metninin tamamı hiçbir zaman bellekte tutulmaz. Sınırı aşacak bir geçmiş dosyası, aştığı anda çıkarılır ve sonrasında yalnızca boyutu sayılır. Ardından arşiv, en eski otomatik kontrol noktaları olmadan yeniden oluşturulur ve dışa aktarma özeti bunları `checkpointsLeftOut` olarak sayar veya arşiv reddedilir.

Bu yeteneği olmayan bir kabuk, normal oturumları geri yükler ve geçmiş bölümünü atlanmış olarak bildirir. Yerel dosya sistemi geçmişi, adaptörü kalıcı geçmiş işlemleri sağlayana kadar desteklenmez. Özel bir işbirliğindeki konukların kalıcı geçmişi veya kurtarma arşivi yoktur.

Kişisel anlık görüntü eşitlemesi, oluşturma geçmişini dışarıda bırakır. Geçmişi olan yerel bir belgeye anlık görüntü uygulamak, önceki çalışma durumunu ayrı bir kurtarma taslağı olarak saklar ve açık düzenleyicilerin yazma token'larını geçersiz kılar. Değişmez kontrol noktaları cihazda kalır. Bu, anlık görüntü değiştirilirken yerel geçmişi korur. Eşzamanlı cihaz geçmişlerini birleştirmez.

Geçmiş varlık başvuruları saklanır, ancak render işlemi varlıkları yine hedefin mevcut kitaplığı üzerinden çözümler. Bu arşiv, eski varlık baytlarının veya eski araç render'larının birebir aynı olmasını henüz garanti etmez. Varlık sürümlerinin ve dosya sonuçlarının baytları kendi yedek bölümlerinde taşınır.
:::

::: details Kaydedilmiş sürümler ve dosya sonuçları (v2)
İsteğe bağlı geçmiş bölümü `{ version: 2, assetVersions: [...], operations: [...], batches: [...] }` içerir ve okuyucular, toplu işlemler içermeyen önceki history-v1 yapısını da kabul eder. Her anlık görüntü; sabit varlık kimliğini ve tam sürümü, kaydedilme zamanını, bayt uzunluğunu ve onaltılık SHA-256 değerini, ayrıca `_file` ve isteğe bağlı `_credentialFile` alanları ikili bölümlere işaret eden bir varlık kaydını verir. İşlemler; özgün dosya bilgilerini, isteği, raporu, zaman damgalarını ve isteğe bağlı sonuç `_file` alanını taşır. Depolama arka ucu adları, OPFS tanıtıcıları ve yürütme kiraları taşınmaz. Yalnızca geçmiş v1'i tanıyan okuyucular, içeri aktarmadan önce yeni geçmiş sürümünü reddeder; böylece toplu işlem üyeliği asla sessizce düşürülmez.

Toplu işlem bildirimleri; hiç okunmayan dosyalar, iptal edilen üyeler, sonuç alanı ayırma hataları ve kesintiye uğrayan işler dahil, seçilen her kaynağı işlenmeden önce kaydeder. Her üyenin sabit bir işlem kimliği, kaynak başvurusu ve bilgileri, istenen çıktı adı ve son raporu vardır. Okunmamış bir kaynağın uydurulmuş bir özeti değil, beyan edilmiş bilgileri vardır. İçeri aktarma, üye kimliğini ve taşınan işlem raporlarıyla tutarlılığını doğrular. Tek tek sonuçlar kaldırıldığında Lolly Batch raporları kullanılabilir kalır, ancak bir alındı, çıktı baytlarının hâlâ saklandığı anlamına gelmez.

- **Önce doğrulama.** Bilinen her geçmiş kaydı, rapor ve başvurulan dosya, profil veya varlık içeri aktarması herhangi bir veri yazmadan önce doğrulanır. Zarfta bütünlük haritası olmasa bile eksik baytlar ve uyuşmayan SHA-256 hata verir. Çıkarılan kimlik bilgileri, bunları sayısal anahtarlı nesneler olarak serileştiren eski yazıcılardan gelen içeri aktarmalar dahil, bayt dizisi olarak kalır.
- **Çalışan işler.** Çalışan işlemler, yedekte hata raporu olan ve sonucu olmayan kesintiye uğramış kayıtlara dönüşür. Geri yükleme asla arka plan işlerini yeniden başlatmaz veya etkin bir kirayı içeri aktarmaz. Yeniden denemek, özgün dosyayı yeniden seçmek demektir; varsa kayıtlı SHA-256 değeriyle denetlenir.
- **Depolama.** Geri yüklenen sonuçlar, baytlarını ve meta verilerini IndexedDB'ye birlikte kaydeder. Normal yeni sonuçlar, kullanılabildiğinde OPFS'yi, yedek seçenek olarak IndexedDB'yi kullanır. Mevcut etkin bir işlem, içeri aktarmayla asla değiştirilmez.
- **Yedek sınırları.** Dışa aktarma bu baytları akış hâlinde arşive yazar, ancak geri yükleme hâlâ tüm yedeği bellekte açar, bu yüzden sınırlar geçerlidir: **256 MiB geçmiş yükü**, **4 MiB geçmiş meta verisi**, en fazla **100 işlem**, **100 toplu işlem** ve **2.000 anlık görüntü**. Dışa aktarma, fazla büyük veya eksik geçmişi açıkça reddeder ve asla sessizce dışarıda bırakmaz. Eski yerel kopyaları kaldırmadan önce önemli sürümleri ve sonuçları tek tek indir. Bu sınırlar, telefonlar için ölçülmüş bir tepe bellek kullanımı garantisi değildir.
- **Yerel bütçeler.** Yerel sonuç geçmişinin 512 MiB bütçesi ve 100 kayıt sınırı vardır. Varlık anlık görüntülerinin ayrı bir 512 MiB bütçesi ve varlık başına en fazla 20 geçmiş sürüm sınırı vardır; çıkarılan kimlik bilgisi baytları da bu bütçeye dahildir. Geri yükleme bu sınırlara uyar ve mevcut kullanıcı verilerini asla sessizce çıkarmaz.
- **Toplu işlem meta verileri.** Yerel toplu işlem meta verilerinin ayrı bir 4 MiB bütçesi, en fazla 100 bildirim ve toplu işlem başına 20 üye sınırı vardır. Bekleyen üyeler, üye başına 32 KiB rapor üst sınırıyla meta veri kapasitesi ayırır. Bu, tarayıcı disk alanı garantisi değil, mantıksal bir bütçedir: gerçek bir kota hatası gösterilir ve bellekteki rapor indirilebilir kalır. Bir toplu işlem üyesini yeniden denemek, eski raporun üzerine yazmadan yeni bir toplu işlem oluşturur. Bir toplu işlem kaydını kaldırmak, tek tek sonuç baytlarını veya kitaplık varlıklarını kaldırmaz.
- **Kitaplıktaki sonuçlar.** Dönüştürülen sonuçlar; kaynak ve çıktı özetleri ve işlem ilişkisi eklenerek, normalleştirme veya yeniden kodlama yapılmadan kitaplığa eklenebilir. Tekrarlanan eklemeler, değişmemiş kopyayı yeniden kullanır ve düzenlenmiş bir kopyanın üzerine asla yazılmaz. Raster görseller, geçerli kitaplık varlık kimliğini kullanan yeni bir Lolly Design belgesi başlatabilir. Lolly Design'ın çalışma zamanı ve URL yolu boyunca tam sürüm sabitlemelerini uygulamak ayrı bir iştir. SVG, HTML, PDF ve ZIP sonuçları, güvenilir etkileşimli veya vektör içerik statüsüne yükseltilmeden, içeriği yorumlanmayan dosya varlıkları olarak tutulur.
- **Bunların görüldüğü yerler.** **Convert → Recent file operations**, geçmiş kullanımını, raporları, indirmeleri ve silinmiş kitaplık varlıklarının önceki sürümlerini de bulan sürüm yöneticisini gösterir. Bir anlık görüntüyü geri yüklemek, yeni bir geçerli sürüm oluşturur ve seçilen anlık görüntüyü saklar. **Settings → Preferences → Storage**, sonuçları ve sürümleri silinebilir önbelleklerden ayrı sayar.
- **Temizleme.** Açıkça başlatılan geçici dosya temizliği, yalnızca işlemlere ait ve başvurulmayan baytları kaldırır. Geçerli kayıtlar dosyalarını korur ve yeni OPFS dosyaları için bir saatlik bekleme süresi vardır. Kaydedilmiş sonuçlar ve varlık anlık görüntüleri otomatik olarak temizlenmez.

Eski okuyucular v2 zarfını (`minReader: 1`) kabul etmeye ve bildikleri bölümleri geri yüklemeye devam eder; desteklenmeyen geçmiş bölümlerini atlanmış olarak sayar. Geçmişi tamamen kurtarmak için `fileHistory` adaptörü olan bir kabuk gerekir; bu, araçlara sunulan bir `HostV1` yeteneği değil, kabuğun içindeki bir bağlantı noktasıdır. Gerçek iki cihazlı geri yükleme, yerel Chromium kabul denetiminin kapsamındadır. Yüklü masaüstü, iOS ve Android uygulamalarında kurtarmanın kabulü hâlâ ayrıca yapılmalıdır.
:::

<!--i:eti-code-->
## Başvuru

- Modül: `shells/web/src/data-transfer.ts` (`exportBackup`, `importBackup`, `BACKUP_FORMAT`, `BACKUP_FORMAT_VERSION`, `BACKUP_READER_VERSION`; `backupFilename()` adlandırıcısı dahilidir).
- Sözleşme testi: `tests/data-transfer.test.ts`; gidiş dönüş, birleştirme, bütünlük, ileriye dönük uyumluluk ve okuyucu denetimini kapsar.
- Geçmiş sözleşme testleri: `tests/file-history-backup.test.ts`, `tests/file-batch-history.test.ts` ve `tests/file-result-library.test.ts`. Tarayıcı kabul testleri: `tests/file-history.browser.test.ts`, `tests/file-batch-history.browser.test.ts` ve `tests/file-result-reuse.browser.test.ts`.
- Kullanılan köprü arayüzü: `host.profile`, `host.state` ve `host.assets`; bkz. [Host API](/info/host-api.html).
