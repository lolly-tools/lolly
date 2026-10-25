# Veri aktarımı: `lolly-backup` paketi

Lolly kişisel kitaplığını cihazda tutar. Bir yedek paketi bu kitaplığın nasıl taşındığıdır: bir kurulumda dışa aktar, dosyayı istediğin gibi taşı (USB, AirDrop, kendine e-posta veya bir ağ paylaşımı) ve başka birinde içe aktar. Dışa ve içe aktarma sunucu gerektirmez ve hedef çevrimdışı olabilir.

Bu sayfa, yedeklerin etrafında kabuklar, araçlar veya betikler kuran kişiler için biçim şartnamesidir: zip içinde ne olduğu, sürümlerin nasıl kapılandığı, bir içe aktarmanın nasıl birleştiği ve nelerin denetlendiği. Kendi işini taşıyan kişiler için anlatım [Move your work to another device](/info/find-your-work.html#move-your-work-to-another-device) sayfasındadır.

![Bütün bir kurulumu taşıyan iki düğme: Export my data tek bir zip yazar, Import data onu geri okur](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-move%3Ediv%3Anth-of-type%282%29%2C.store-move%3Ep%3Alast-of-type%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dmove%5D%3Esummary&walker=1&format=svg&cropSelector=%5Bdata-store-group%3Dmove%5D&dark=1&filename=pd-transfer-controls)

> **Kapsam.** Bir paket *kullanıcı verisi* taşır, katalog araçlarını değil. Katalog araçları ve katalog varlıkları ayrı eşitlenir ve hedefte en kötü ihtimalle daha yüksek bir sürümde zaten var oldukları varsayılır. Kullanıcıların kendi yaptıkları araçlar `profile.json` içinde gider. İçe aktarma asla bir katalog aracını kurmaz veya yükseltmez.

## Hedefler

- <!--i:box--> **Tek biçim, her kabuk.** Web uygulaması, masaüstü ve mobil uygulamalar ve gelecekteki kabuklar aynı zarfı ve parça şemalarını paylaşır. İsteğe bağlı parçalar her kabuğun yeteneklerine bağlıdır ve desteklenmeyen parçalar bildirilir. Her yetenek köprüsü kendi depolama bağdaştırıcısını sağlar.
- <!--i:shieldcheck--> **Yolculuktan sağ çıkar.** Aktarım sırasında bozulmuş veya kesilmiş bir paket içe aktarmada yüksek sesle başarısız olur ve asla yarım geri yüklenmez.
- <!--i:clock--> **Bu sürümden uzun yaşar.** Daha eski bir uygulama, daha yeni bir paketin tanıdığı parçalarını yine içe aktarabilir. Gerçekten kırıcı bir biçim temiz biçimde reddedilir.
- <!--i:check--> **Birleştirmek güvenlidir.** Zaten kullanımda olan bir kuruluma içe aktarmak, pakette olmayan hiçbir şeyi asla silmez.

## Zarf

Bir paket düz bir `.zip` dosyasıdır; bu yüzden her taşıma yolunda sağlam kalır ve herhangi bir açma aracı içeriğini inceleyebilir.

İndirme, ait olduğu kişinin adını taşır: `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip`, örneğin `LollyTools-Ada-Lovelace-2026-06-26-1.zip`; böylece yedeklerle dolu bir Downloads klasörü okunabilir kalır. Ad ve soyad profilden gelir ve ayarlı değilse dışarıda bırakılır: profil yoksa `LollyTools-2026-06-26-1.zip`, yalnızca ad varsa `LollyTools-Ada-2026-06-26-1.zip` olur. Her ad dosya adına uygun bir belirtece indirgenir (Unicode harfler ve rakamlar korunur, boşluklar ve noktalama atılır, en fazla 32 karakter). `<n>` gün başına, cihaz başına bir dizidir; bu yüzden bir günde tekrarlanan dışa aktarmalar çakışmaz ve sıralı kalır. `data-transfer.ts` içindeki `backupFilename()` adı kurar ve zip'in içeriği adı ne olursa olsun aynıdır.

| Yol | Gerekli | İçerik |
|---|---|---|
| `manifest.json` | evet | Biçim kimliği, sürümler, sayılar ve parça başına bütünlük. Bir okuyucunun baktığı ilk şey. |
| `profile.json` | ayarlıysa | Kullanıcının tüm `me` kaydı: ad, iletişim, profil fotoğrafı başvurusu ve bayrakları, ayrıca klasörler, Trash, proje taslakları, kullanıcı şablonları ve kullanıcı yapımı araçlar, favoriler, gizli araçlar, dil ve emoji seçimi. `host.profile` ile okunur. |
| `sessions.json` | evet | Her kayıtlı oturum: yuva, araç kimliği ve sürümü, etiket, küçük resim (veri URL'si) ve tam girdi verisi. `host.state` ile okunur. |
| `assets.json` | evet | Yüklenen her varlığın (görseller, yazı tipleri, marka token'ları, logolar, indirmelerin kayıtlı kopyaları) meta verisi; her biri `assets/blobs/` altındaki baytlarına işaret eder. |
| `assets/blobs/<n>.<ext>` | varlık başına | Ham varlık baytları; çoğu zaten sıkıştırılmış biçimler olduğu için sıkıştırılmamış saklanır. Uzantı kozmetiktir; `assets.json` içindeki MIME türü yetkilidir. |
| `assets/blobs/<n>.c2pa` | varsa | Tam ikili baytlar olarak çıkarılmış Content Credentials; varlık kaydındaki `_credentialFile` tarafından başvurulur. Bunlar cihaz imzalama anahtarları değildir. |
| `design-systems.json` | varsa | Bu kurulumda yapılan veya eklenen tasarım sistemleri, `{ active, records }` olarak. Bkz. [Import rules](#import-rules). |
| `file-history.json` | isteğe bağlı | Sürümlü varlık anlık görüntüleri, tamamlanmış dosya işlemi raporları ve eksiksiz toplu iş bildirimleri; kendi sürümüyle. Kabuğun dahili `fileHistory` yedek bağdaştırıcısı tarafından sağlanır. |
| `revision-history.json` | isteğe bağlı, elle yedekler | Kararlı yaratım kimlikleri, tutulan kontrol noktaları, küçük resimler ve devam eden kurtarma taslakları. Desteklenen yerde `host.state.history.backup` tarafından sağlanır. |
| `file-history/versions/` | anlık görüntü başına | Önceki varlık baytları ve çıkarılan kimlik bilgileri; mevcut varlık hâlâ var olsa da olmasa da. |
| `file-history/results/` | tamamlanan işlem başına | Tam çıktı baytları. Dönüştürme için seçilen hiçbir özgün dosya tutulmaz veya dahil edilmez. |
| `prefs.json` | evet | Kullanıcıya ait yerel tercihler: `theme`, `sidebarWidth` ve `ct-metrics` etkinlik sayacı. |
| `lolly.txt` | evet | Lolly olmadan zip'i açan herkes için paketin okunabilir bir özeti (sayılar, profil, dosya adı). Her dışa aktarmada yeniden üretilir ve içe aktarmada tanınır; bu yüzden asla atlanmış bir parça sayılmaz. Bütünlük haritasından sonra yazılır; bu yüzden harita bu dosyayı kapsamaz. |

::: details Dışa aktarma zip'i nasıl yazar
Dışa aktarma zip'i bir seferde bir parça yazar (`shells/web/src/lib/zip-stream.ts`). Yüklemeler, kayıtlı sonuçlar ve kayıtlı varlık sürümleri hiçbir zaman bütün olarak değil, 4 MiB'lik dilimler halinde okunur ve kayıtlı sonuçlar ile sürümler önce kaydedilen SHA-256 değerlerine karşı denetlenir. Sonra her dosya sağlama toplamı ve bütünlük özeti için okunur ve zip ona olduğu yerde başvurur.

Hiçbir şey yeniden kodlanmaz; bu yüzden Content Credentials taşıyan bir dosya, imzasının kapsadığı tam baytları korur ve her parça tam baytlarını ve özetini korur. Aynı parçalar ve zaman için zip, 16 MiB'ı aşan bir geçmiş dosyasının parçalar halinde sıkıştırılması dışında, önceki bellek içi yazıcınınkiyle aynıdır. `tests/backup-streaming.test.ts` bunu kayıtlı başvuru özetlerine karşı denetler.

192 MiB'lık sentetik bir kitaplıkta, Node'da ölçüldüğünde, yedeği bitirmek kitaplığın üstüne yaklaşık 125 ila 150 MiB, bellek içi yazıcı için ise yaklaşık 850 MiB tuttu (`node scripts/bench-backup-finalise.ts`). İçe aktarma hâlâ tüm zip'i belleğe okur.
:::

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

| Alan | Anlam |
|---|---|
| `format` | Her zaman `lolly-backup`. Onsuz bir dosya "not a Lolly backup" olarak reddedilir. |
| `formatVersion` | Bu paketin **yazıldığı** düzen. Parça kümesinde veya şekillerde herhangi bir değişiklikte artırılır. Okuyucular bu alanı **kapılamaz**. |
| `minReader` | Bu paketi **güvenle** içe aktarabilen en düşük okuyucu sürümü. Okuyucuların kapıladığı alan budur. |
| `app` | Üreten uygulama kimliği, tanılama için. |
| `exportedAt` | Paketin oluşturulduğu ISO zaman damgası. |
| `counts` | Yazıcının içine koyduğu, gösterim ve akıl sağlığı denetimleri için. |
| `integrity` | İsteğe bağlı. `manifest.json` dışındaki her parçayı, **sıkıştırılmamış** baytlarının SRI tarzı `sha256-<base64>` özetine eşler. |

## Sürüm politikası

İki sürüm numarası, biçimin eski kurulumları açmaz bırakmadan büyümesine izin verir.

![Paket biçiminde bir değişiklik ya eklemelidir, eski okuyucuların yok sayabileceği biçimde, ya da kırıcıdır, yanlış bir içe aktarmanın bozulmaya yol açtığı biçimde. Eklemeli olan formatVersion değerini artırır ve minReader değerini korur; kırıcı olan formatVersion değerini artırır ve minReader değerini yükseltir. Bir okuyucu, minReader kendi sürümünü aşmadığında içe aktarır.](/info/diagrams/concepts/backup-version-gate.svg)

- Bir okuyucu, `manifest.minReader` kendi okuyucu sürümünü aşmadığında bir paketi içe aktarır. Yalnızca paket daha yeni bir okuyucu talep ettiğinde "needs a newer version of the app" diyerek reddeder.
- Yeni bir isteğe bağlı parça veya yeni bir isteğe bağlı bildirim alanı gibi **eklemeli** bir değişiklik `formatVersion` değerini artırır ve `minReader` değerine dokunmaz. Eski uygulamalar tanıdıkları her parçayı yine içe aktarır ve tanımadıkları parçalar sessizce bırakılmaz, atlanmış olarak bildirilir.
- Bir parçanın yanlış içe aktarılmasının veriyi bozduğu ya da isteğe bağlı bir parçanın zorunlu hale geldiği **kırıcı** bir değişiklik `minReader` değerini yükseltir. Eski uygulamalar o zaman işleyemeyecekleri bir şeyi içe aktarmak yerine temiz biçimde reddeder.
- Gelecekteki bir paket `formatVersion` ayarlayıp `minReader` değerini dışarıda bırakırsa okuyucular `formatVersion` üzerinden kapılamaya döner ve değişikliği kırıcı sayar.

> **Yazarlar için pratik kural:** mevcut her okuyucu eklemeni yok sayarak yine doğru şeyi yapacaksa değişiklik eklemelidir: `formatVersion` değerini artır ve `minReader` değerini bırak. Aksi hâlde `minReader` değerini yükselt.

## Bütünlük

`manifest.integrity` mevcut olduğunda bir okuyucu, **herhangi bir şey yazmadan önce** listelenen her parçanın SHA-256 değerini denetler. Bir uyuşmazlık ("failed its integrity check") veya eksik bir parça ("incomplete") tüm içe aktarmayı durdurur; bu yüzden kısmi geri yükleme yoktur. Bu, bir dosya aktarımının yapabileceği hasarı yakalar: kesilmiş bir AirDrop, eki yeniden kodlayan bir e-posta ağ geçidi, kötü bir USB sektörü.

Bütünlük elinden gelenin en iyisidir. Yalnızca Web Crypto'nun bulunduğu yerde (her güvenli tarayıcı bağlamı ve modern Node) yazılır ve yalnızca hem harita hem Web Crypto mevcut olduğunda denetlenir. Haritası olmayan bir paket, örneğin bütünlükten önceki biri, değişmeden içe aktarılır: "cannot verify" asla "corrupt" sayılmaz.

Bildirim ne kendisini ne de yeniden üretilen `lolly.txt` dosyasını listeler. Özetler, bildirimin kefil olduğu parçaları kapsar.

## İçe aktarma kuralları

Bir içe aktarma iki moddan birinde çalışır.

- **Merge**, **Import data…** işleminin ve eşitlemenin ilk katılımı olan **Bring it to this device** işleminin yaptığıdır. Hedefteki veri kalır ve pakette olmayan hiçbir şeye dokunulmaz: hedefin sahip olduğu ve paketin sahip olmadığı bir oturum içe aktarmadan sağ çıkar.
- **Replace**, cihaz eşitlemesinin cihazları uyumlu tutmak için kullandığıdır: eşitlenen kopyanın profil kaydını, tercihlerini, oturumlarını, görsellerini ve etkin tasarım sistemi seçimini alır ve yalnızca son eşitlemeden beri başka bir cihazın sildiği öğeleri kaldırır. Daha önceki bir kopyayı geri yüklemek daha da ileri gider ve önce cihazı kaydettikten sonra cihazı o kopyayla eşleştirir, kopyanın tutmadığı her şeyi kaldırır. Bir kişinin ne gördüğünü [Sync your devices](/info/sync.html) kapsar.

Bir birleştirmede yalnızca hedefte olan her şey korunur ve paketteki her veri türü hedefle şöyle buluşur:

| Veri | Hedefte zaten var | Yalnızca pakette |
|---|---|---|
| Oturumlar (yuvaya göre) ve yüklenen görseller (kimliğe göre) | Daha yakın zamanda kaydedilen kopya korunur; böylece eski bir yedek yeni işin üzerine asla yazmaz. Eşit veya bilinmeyen zamanlar hedefin kopyasını korur. | Eklenir |
| Klasörler | Hedefin adı ve üst klasörü korunur ve klasör, eksik olduğu paket üyelerini kazanır. Hedefte bir klasöre dosyalanmış oturum orada dosyalı kalır. | Eklenir |
| Favoriler (araçlar, katalog varlıkları ve Projects öğeleri) | Birleştirilir | Eklenir |
| Şablonlar, Projects şablonları ve kullanıcı araçları (kimliğe göre) | Hedefin kaydı korunur. | Eklenir |
| Trash girdileri | Hedefin girdisi korunur. | Eklenir; böylece iki kurulumdan birinde geri yüklenebilecek bir öğe yine geri yüklenebilir. Klasörü hedefte yeniden kullanımda olan ya da Trash yuvasını hedefin zaten kullandığı bir girdi dışarıda bırakılır. |
| Diğer profil alanları (ad, iletişim ayrıntıları, dil, özellik bayrakları, gizli araçlar ve diğer ayarlar) | Hedefin değeri korunur. | Hedefin alanı boşsa alınır |
| Tercihler (`prefs.json`) | Hedefin değeri korunur. | Hedefte yoksa yazılır |
| Tasarım sistemleri (kimliğe göre) | Paketin kaydı hedefinkinin yerini alır. | Eklenir. Paketin etkin seçimi yalnızca hedefin kendi tasarım sistemi yoksa uygulanır. |
| Yaratım geçmişi | Daha yakın zamanda kaydedilen kopya güncel kalır ve diğeri korumalı bir taslak olarak tutulur. | Eklenir |

**Kayıtlı oturumlar görsellerine otomatik olarak yeniden bağlanır.** Varlık başvuruları kimlikle tutulur ve köprü, görseller geri yüklendikten sonra bunları yeniden çözer; `blob:` URL'leri bir yenilemeden sağ çıkmadığı için zaten yapması gerekir.

**Geçmiş kayıtları yazıldıktan sonra asla değişmez.** Varlık sürümlerinin ve işlem kimliklerinin tekrarlanan içe aktarması hiçbir şey eklemez ve zaten farklı baytları veya geçmişi adlandıran bir kimlik, üzerine yazılmak yerine reddedilir. Aynı güncel varlığı yeniden içe aktarmak sürümünü korur ve değişmiş bir güncel varlık farklı bir sürüm taşımalıdır.

**Yaratım geçmişinin birkaç kuralı daha vardır.** Yuvası hedefte farklı bir yaratım için kullanılan bir yaratım ayrı bir yaratım olarak eklenir ve hedefin Trash'indeki bir yaratım orada kalır. Hedefte farklı içeriği adlandıran bir kontrol noktası kimliği hedefinkini korur. Kendi denetimlerinde başarısız olan bir arşiv, herhangi bir profil, oturum, varlık veya tercih değişmeden önce içe aktarmayı durdurur ve aynı içe aktarmanın tekrarı depolama eklemez.

**Özet ne olduğunu bildirir.** Her içe aktarma `profile`, `sessions`, `userAssets`, `prefs`, `skipped` ve `failedAssets` döndürür.

- `failedAssets`, örneğin cihaz depolaması dolu olduğu için geri yüklenemeyen yüklenmiş varlıkları sayar.
- `skipped`, bu derlemenin tanımadığı daha yeni bir yazıcıdan gelen parçaları sayar. Uygulama bunu gösterir ("… · N newer items skipped"); böylece bir geri yükleme geride bıraktığını belirtir.
- Dosya geçmişiyle özet `assetVersions`, `fileOperations`, `fileBatches` ve `failedHistory` ekler. Depolama tükenmesi veya değişmez kimlik çakışması kısmi bir geri yüklemeye yol açabilir ve uygulama kişiye kaynak yedeği saklamasını söyler.
- Yaratım geçmişiyle yalnızca bu içe aktarmanın eklediklerini sayan `revisions` ve `recoveryDrafts` ile her yaratımın nasıl birleştirildiğini gösteren `added`, `kept`, `replaced`, `copies` ve `hidden` ekler. `skippedCheckpoints`, kimliği hedefte farklı içeriği adlandıran kontrol noktalarını sayar ve `historyLeftOut`, cihazın geçmiş alanına sığmayan eski kontrol noktalarını ve taslakları sayar.
- Bir replace içe aktarması `removed` ve `failedRemovals` ekler.

Geri yükleme; profil, oturum, varlık ve geçmiş depoları arasında tek bir işlem değildir. Bulut eşitlemesi, kısmi veya desteklenmeyen bir geri yüklemeden sonra uygulanan düzeltmesini **ilerletmez**; böylece kopya yeniden denemek için kullanılabilir kalır.

## Neler taşınmaz

- **Katalog önbellekleri** (indirilen varlık meta verileri ve blob'lar, araç dizini); hedef bunları ücretsiz yeniden eşitler.
- **Katalog araçları ve katalog varlıkları**, kapsam dışıdır ve hedefte var oldukları varsayılır. Kullanıcının eklediği marka token'ları, yazı tipleri ve logolar kullanıcı varlıklarıdır; bu yüzden taşınırlar.
- **`blob:` ve nesne URL'leri**, köprünün yüklemede yeniden ürettiği.
- **Dönüştürme özgünleri, canlı yürütme kiralamaları ve makineye özgü erişim veya imza sırları.** Bunlar taşınabilir geçmiş değildir. Kayıtlı bir sonuç bir kopyadır, özgün kaynağın yedeklendiğinin sözü değildir.
- **Dışa aktarma dizi sayacı**, `localStorage` içindeki gün başına indirme adlandırma sayacı (`lolly-export-seq`). `PREF_KEYS` dışında tutulur; bu yüzden bir pakette asla gitmez.

Depolama göstergesi aynı ayrımı gösterir. Saved sessions, My images ve File results & versions bir pakete girer. Altlarındaki varlık önbelleği, araç önizlemeleri ve çevrimdışı sabitlemelerin hepsi yeniden kurulabilir; bu yüzden geride kalırlar.

![Bu cihazın verisini adlandırılmış kategorilere ayıran depolama göstergesi; Saved sessions ve My images, Asset cache'ten ayrı izlenir; burada her kategorinin hâlâ boş olduğu yeni bir kurulumda](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&dark=1&filename=ce-storage-categories)

## Lolly Work ile kuruluş verisi

Bu paket cihazın kişisel kitaplığını yedekler. Bir **Lolly Work** örneğinin yedeği değildir: kuruluş hesapları, erişim politikaları, paylaşılan projeler, katalog sürümleri, onaylar, render işleri ve denetim kayıtları o hizmet tarafından tutulur. Paylaşılan işe erişimi geri kazanmak için yeniden bağlan ve giriş yap; kişisel bir paketi içe aktarmak o erişimi vermez.

İşletmeler sunucu verisini Lolly Work'ün kendi kılavuzlarıyla yedekler, saklar ve siler: [Backup and restore](/info/work-operations.html#backup-and-restore) ve [Work storage and data lifecycle](/info/work-data-lifecycle.html). Bir cihazı temizlemek veya dışa aktarmak bu sunucu işlemlerinden hiçbirini yapmaz.

## Kabuklar arasında

`data-transfer.ts` yalnızca yetenek köprüsü (`host.profile`, `host.state`, `host.assets`) ve paylaşılan `localStorage` tercihleri aracılığıyla okur ve yazar. Aynı modül ortak zarfı web'de ve masaüstü ile mobil uygulamalarda IndexedDB veya dosya sistemi depolaması üzerinden okur ve yazar. İsteğe bağlı geçmiş parçaları yalnızca bağdaştırıcıları mevcut olduğunda görünür ve desteklenmeyen bir parça içe aktarmada atlanmış olarak bildirilir. Arayüzsüz paket ortak parçaları bellek içi bir köprüye karşı sınar ve geçmiş işlemlerinin gerçek tarayıcı testleri de vardır.

İki kabuk, farklı nedenlerle bu garantinin dışında kalır:

- **Tek seferlik CLI**'nin taşıyacak bir şeyi yoktur: durumu bellektedir ve bir çağrı sürer.
- **TUI** durumu `~/.lolly` içinde tutar (oturumlar, klasörler, profil) ve Profile görünümü onu yedekleyebilir, ancak kendi daha basit arşivini yazar: oturum başına `saved-state/<slot>.json` artı `profile.json` ve `folders.json`; bildirim, `formatVersion` veya `minReader` ve bütünlük haritası yoktur. Bu biçim onu içe aktaramaz (bir okuyucu onu "not a Lolly backup" olarak reddeder) ve adı kafa karıştırıcı derecede benzerdir (`lolly-backup-<stamp>.zip`). İkisini birleştirmek bilinen bir eksiktir.

## Henüz taşınabilir değil

Zarf bir bildirim artı adlandırılmış parçalardır; bu yüzden yeni taşınabilir veri türleri sonradan eklemeli parçalar olarak katılabilir (yeni bir `formatVersion`, aynı `minReader`) ve bugünkü okuyucular tanımadıklarını atlar. Tasarım sistemleri zaten bu şekilde, `design-systems.json` artı kullanıcı varlıkları olarak taşınır.

Henüz taşınmayan veri için iki ad ayrılmıştır:

- **`tokens.json`**, gruplarıyla, kümeleriyle ve temalarıyla tam bir [W3C DTCG](https://tr.designtokens.org/format/) tasarım token'ları belgesi, [Penpot'un içe ve dışa aktardığı](https://help.penpot.app/user-guide/design-systems/design-tokens/) biçimi taşırdı. Bir kullanıcının kendi marka token'ları zaten `assets.json` içindeki `user/tokens/brand` varlığı olarak ve bir tasarım sisteminin token'ları kaydıyla taşınır.
- **`penpot/`**, içe alınmış bir Penpot dosyası veya Lolly ile ilgili alt kümesi için ayrılmıştır; bir araç olarak sunulur.

Bugünkü okuyucular iki adı da henüz bilmez. Yukarıdaki parçaların dışındaki her şey gibi, her biri onlar için bilinmeyen bir parçadır: dokunulmadan bırakılır ve `skipped` içinde sayılır.

## Geçmiş parçaları

İki geçmiş parçası isteğe bağlıdır ve kendi sürümleri vardır. Çoğu okuyucu bu bölümü atlayabilir.

::: details Yaratım geçmişi (v3)
Yaratım geçmişi olan bir web kurulumundan elle yapılan yedekler, kendi `{ version: 1, documents, revisions, recoveries }` şemasıyla `revision-history.json` içerir. Tutulan kimlikleri, kurallı girdi anlık görüntülerini, sürüm damgalarını, raster önizlemeleri ve ayrı yazar taslaklarını taşır. Geçmiş bağdaştırıcısı güncel oturumları ve başlarını tek bir okuma işleminde yakalar ve `sessions.json` eski okuyucular için aynı güncel anlık görüntüleri kullanır.

Geri yükleme, arşivi tek bir işlemde uygulamadan önce yük SHA-256 değerini ve bayt sayılarını, benzersiz kimlikleri, belge ve baş ilişkilerini, soy ağacını, zaman damgalarını, önizleme türlerini ve sınırları denetler. Sıkıştırılmış üst başvuruları eksik olabilir. Mevcut güncel iş sessizce asla değiştirilmez: bir yaratım iki tarafta da olduğunda güncel tutulmayan taraf korumalı bir taslak olur.

Arşivin 384 MiB aktarım sınırı açıkça denetlenir ve kontrol noktaları kesilmeden depolama sınırları uygulanır. Dışa aktarma `revision-history.json` ve `sessions.json` dosyalarını tek bir `JSON.stringify` ile aynı baytlarla parçalar halinde yazar; böylece dosya metni asla bütün olarak tutulmaz. Sınırı aşacak bir geçmiş dosyası aştığı anda bırakılır ve oradan itibaren yalnızca sayılır. Arşiv sonra en eski otomatik kontrol noktaları olmadan yeniden yapılır ve dışa aktarma özeti bunları `checkpointsLeftOut` olarak sayar ya da arşiv bütünüyle reddedilir.

Bu yeteneği olmayan bir kabuk sıradan oturumları geri yükler ve geçmiş parçasını atlanmış olarak bildirir. Yerel dosya sistemi geçmişi, bağdaştırıcısı dayanıklı geçmiş işlemleri sağlayana kadar desteklenmez. Özel bir collab içindeki konukların dayanıklı geçmişi veya kurtarma arşivi yoktur.

Kişisel anlık görüntü eşitlemesi yaratım geçmişini dışarıda bırakır. Bir anlık görüntüyü geçmişi olan yerel bir belgeye uygulamak, önceki çalışma durumunu ayrı bir kurtarma taslağı olarak korur ve açık bir düzenleyicinin yazma belirtecini geçersiz kılar. Değişmez kontrol noktaları cihazda kalır. Bu, bir anlık görüntü değişimi sırasında yerel geçmişi korur; eşzamanlı cihaz geçmişlerini birleştirmez.

Tarihsel varlık başvuruları korunur; render ise varlıkları hedefin mevcut kitaplığı üzerinden çözmeye devam eder. Bu arşiv henüz tam eski varlık baytlarını veya eski araç render'larını garanti etmez. Varlık sürümü ve dosya sonucu baytları kendi yedek parçalarında gider.
:::

::: details Kayıtlı sürümler ve dosya sonuçları (v2)
İsteğe bağlı geçmiş parçası `{ version: 2, assetVersions: [...], operations: [...], batches: [...] }` tutar ve okuyucular toplu işleri olmayan önceki history-v1 biçimini de kabul eder. Her anlık görüntü kararlı varlık kimliğini ve tam sürümü, kayıt zamanını, bayt uzunluğunu ve onaltılı SHA-256 değerini ve `_file` ve isteğe bağlı `_credentialFile` değerleri ikili parçalara işaret eden bir varlık kaydını verir. İşlemler özgün dosya bilgilerini, isteği, raporu, zaman damgalarını ve isteğe bağlı sonuç `_file` değerini taşır. Depolama arka ucu adları, OPFS tutamakları ve yürütme kiralamaları taşınmaz. Yalnızca history v1 bilen okuyucular, toplu iş üyeliğini sessizce düşürmek yerine içe aktarmadan önce yeni geçmiş sürümünü reddeder.

Toplu iş bildirimleri, hiç okunmayan dosyalar, iptal edilen üyeler, sonuç alanı ayırma hataları ve yarıda kalan iş dahil, işlemeden önce seçilen her kaynağı kaydeder. Her üyenin kararlı bir işlem kimliği, kaynak başvurusu ve bilgileri, istenen çıktı adı ve son raporu vardır. Okunmamış bir kaynağın uydurulmuş bir özeti değil, bildirilmiş bilgileri vardır. İçe aktarma, üye kimliğini ve taşınan herhangi bir işlem raporuyla tutarlılığı doğrular. Tekil sonuçlar kaldırıldığında bile toplu iş raporları kullanılabilir kalır, ancak bir makbuz çıktı baytlarının hâlâ saklandığı anlamına gelmez.

- **Önce doğrulama.** Bilinen her geçmiş kaydı, raporu ve başvurulan dosya, herhangi bir profil veya varlık içe aktarması yazmadan önce doğrulanır. Eksik baytlar ve eşleşmeyen SHA-256 değerleri, zarfta bütünlük haritası olmasa bile başarısız olur. Çıkarılan kimlik bilgileri bayt dizisi olarak kalır; onları sayısal anahtarlı nesneler olarak serileştiren eski yazıcılardan içe aktarmalar dahil.
- **Çalışan iş.** Çalışan işlemler yedekte açıklayıcı bir hata raporu ve sonuçsuz kesintiye uğramış kayıtlar olur. Geri yükleme arka plan işini asla yeniden başlatmaz veya etkin bir kiralamayı içe aktarmaz. Yeniden denemek özgün dosyayı yeniden seçmek demektir; varsa kayıtlı SHA-256 değerine karşı denetlenir.
- **Depolama.** Geri yüklenen sonuçlar baytlarını ve meta verilerini IndexedDB içinde birlikte işler. Sıradan yeni sonuçlar mümkünse OPFS, yedek olarak IndexedDB kullanır. Mevcut canlı bir işlem içe aktarmayla asla değiştirilmez.
- **Yedek sınırları.** Dışa aktarma bu baytları arşive akıtır; ancak geri yükleme bir yedeğin tamamını hâlâ bellekte açar; bu yüzden sınırlar kalır: **256 MiB geçmiş yükü**, **4 MiB geçmiş meta verisi**, en fazla **100 işlem**, **100 toplu iş** ve **2.000 anlık görüntü**. Dışa aktarma aşırı büyük veya eksik geçmişi açıkça reddeder ve asla sessizce dışarıda bırakmaz. Eski yerel kopyaları kaldırmadan önce önemli sürümleri ve sonuçları tek tek indir. Bu sınırlar telefonlar için ölçülmüş bir tepe bellek garantisi değildir.
- **Yerel bütçeler.** Yerel sonuç geçmişinin 512 MiB bütçesi ve 100 kayıtlık üst sınırı vardır. Varlık anlık görüntülerinin ayrı bir 512 MiB bütçesi ve varlık başına en fazla 20 tarihsel sürümü vardır ve çıkarılan kimlik bilgisi baytları bu bütçeye sayılır. Geri yükleme bu sınırlara uyar ve mevcut kullanıcı verisini asla sessizce çıkarmaz.
- **Toplu iş meta verisi.** Yerel toplu iş meta verisinin ayrı bir 4 MiB bütçesi, en fazla 100 bildirimi ve toplu iş başına 20 üyesi vardır. Bekleyen üyeler, üye başına 32 KiB rapor üst sınırıyla meta veri kapasitesi ayırır. Bu mantıksal bir bütçedir, bir tarayıcı disk alanı garantisi değildir: gerçek bir kota hatası gösterilir ve bellek içi rapor indirilebilir kalır. Bir toplu iş üyesini yeniden denemek eski raporun üzerine yazmadan yeni bir toplu iş oluşturur. Bir toplu iş kaydını kaldırmak tekil sonuç baytlarını veya kitaplık varlıklarını kaldırmaz.
- **Kitaplıktaki sonuçlar.** Dönüştürülmüş sonuçlar normalleştirme veya yeniden kodlama olmadan, kaynak ve çıktı karmaları ile işlem ilişkisi eklenerek kitaplığa eklenebilir. Tekrarlanan eklemeler değişmemiş bir kopyayı yeniden kullanır ve düzenlenmiş bir kopyanın üzerine asla yazılmaz. Raster görseller, geçerli kitaplık varlık kimliğini kullanan yeni bir Design belgesi başlatabilir; tam sürüm sabitlemelerini Design'ın çalışma zamanı ve URL yolu boyunca zorlamak ayrı bir iştir. SVG, HTML, PDF ve ZIP sonuçları güvenilir etkileşimli veya vektör içeriğe yükseltilmeden opak dosya varlıkları olarak tutulur.
- **İnsanların bunu gördüğü yer.** **Convert → Recent file operations** geçmiş kullanımını, raporları, indirmeleri ve silinmiş kitaplık varlıklarının eski sürümlerini de bulan sürüm yöneticisini gösterir. Bir anlık görüntüyü geri yüklemek yeni bir güncel sürüm oluşturur ve seçilen anlık görüntüyü korur. **Settings → Preferences → Storage** sonuçları ve sürümleri atılabilir önbelleklerden ayrı sayar.
- **Temizlik.** Açık geçici dosya temizliği yalnızca işleme ait, başvurulmayan baytları kaldırır. Güncel kayıtlar dosyalarını korur ve yakın tarihli OPFS dosyalarının bir saatlik tolerans süresi vardır. Kayıtlı sonuçlar ve varlık anlık görüntüleri otomatik temizlenmez.

Eski okuyucular v2 zarfını (`minReader: 1`) yine kabul eder ve bildikleri parçaları geri yükler, desteklenmeyen geçmiş parçalarını atlanmış sayar. Tam geçmiş kurtarma, `fileHistory` bağdaştırıcısı olan bir kabuk gerektirir; bu, araca dönük yeni bir `HostV1` yeteneği değil, kabuğun içinde bir dikiş yeridir. Gerçek iki cihazlı geri yükleme yerel Chromium kapısı tarafından kapsanır; kurulu masaüstü, iOS ve Android uygulamalarında kurtarma ise ayrıca kabul edilecektir.
:::

## Referans

- Modül: `shells/web/src/data-transfer.ts` (`exportBackup`, `importBackup`, `BACKUP_FORMAT`, `BACKUP_FORMAT_VERSION`, `BACKUP_READER_VERSION`; `backupFilename()` adlandırıcısı dahilidir).
- Sözleşme testi: `tests/data-transfer.test.ts`; gidiş dönüş, birleştirme, bütünlük, ileriye dönük uyumluluk ve okuyucu kapısını kapsar.
- Geçmiş sözleşme testleri: `tests/file-history-backup.test.ts`, `tests/file-batch-history.test.ts` ve `tests/file-result-library.test.ts`. Tarayıcı kabulü: `tests/file-history.browser.test.ts`, `tests/file-batch-history.browser.test.ts` ve `tests/file-result-reuse.browser.test.ts`.
- Kullanılan köprü yüzeyi: `host.profile`, `host.state` ve `host.assets`; bkz. [Host API](/info/host-api.html).
