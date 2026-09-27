# Veri Aktarımı - `lolly-backup` demeti

Bir Lolly kullanıcısının biriktirdiği her şey **cihazında** yaşar - hesap yok, bulut yok. Veri aktarımı demeti bu değerin nasıl taşındığıdır: bir kurulumda dışa aktar, dosyayı herhangi bir yolla taşı (USB, AirDrop, kendine e-posta, bir ağ paylaşımı) ve başka bir kurulumda içe aktar. Aktarım araç *dosyanın kendisidir*. Hedef çevrimdışı veya çevrimiçi olabilir. Hiçbir fark yaratmaz, çünkü hiçbir zaman bir sunucuyla konuşulmaz.

![Bütün bir kurulumu taşıyan iki düğme: Export my data tek bir zip yazar, Import data onu geri okur](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=%23storage-section%20.storage-subsection&dark=1&filename=pd-transfer-controls)

Bu sayfa biçim spesifikasyonudur. Son kullanıcı için adım adım anlatım için bkz. [Çalışmanı bul ve kurtar → Çalışmanı başka bir cihaza taşı](/info/find-your-work.html#move-your-work-to-another-device). Uygulama [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts) dosyasındadır ve [`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) gidiş-dönüş sözleşmesini sabitler.

> **Kapsam.** Bir demet *kullanıcı verisini* taşır, katalog araçlarını değil. Katalog araçları ve katalog varlıkları ayrı senkronize edilir ve hedefte zaten mevcut olduğu varsayılır (en kötü durumda daha yüksek bir sürümde); kullanıcının kendi yaptığı araçlar `profile.json` içinde taşınır. İçe aktarma asla bir katalog aracını kurmaz veya yükseltmez.

## Hedefler

- <!--i:box--> **Tek biçim, her kabuk.** Web PWA, Tauri masaüstü/mobil uygulamaları ve gelecekteki kabuklar aynı zarfı ve desteklenen parça şemalarını paylaşır. İsteğe bağlı parçalar her kabuğun yeteneklerine bağlıdır; desteklenmeyen parçalar bildirilir. Her yetenek köprüsü kendi depolama uyarlayıcısını sağlar.
- <!--i:shieldcheck--> **Yolculuğu atlatır.** Taşıma sırasında bozulmuş veya kesilmiş bir demet, içe aktarımda gürültülü bir şekilde başarısız olur, asla yarı yarıya geri yüklemez.
- <!--i:clock--> **Bu sürümden daha uzun ömürlü.** Daha eski bir uygulama, daha yeni bir demetin tanıdığı kısımlarını yine de içe aktarabilir. Gerçekten bozucu bir biçim temiz bir şekilde reddedilir.
- <!--i:check--> **Birleştirmek için güvenli.** Zaten kullanımda olan bir kuruluma içe aktarmak, demette olmayan hiçbir şeyi asla silmez.

## Zarf

Paket, düz bir `.zip` dosyasıdır. İndirme, ait olduğu kişinin adına göre adlandırılır - `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` (örneğin `LollyTools-Ada-Lovelace-2026-06-26-1.zip`) - böylece bir İndirilenler klasöründeki yedekler okunaklı kalır. Ad ve soyad kısımları profilden gelir ve ayarlanmamışsa atlanır. Profil yoksa `LollyTools-2026-06-26-1.zip` elde edilir, yalnızca ad varsa `LollyTools-Ada-2026-06-26-1.zip` elde edilir. Her kısım dosya adına uygun bir jetona göre temizlenir (Unicode harfler/rakamlar korunur, boşluklar/noktalama işaretleri kaldırılır, 32 karakterle sınırlandırılır). `<n>`, güne ve cihaza özgü bir sıra numarasıdır, böylece aynı gün yapılan tekrar dışa aktarımlar çakışmaz ve sırasını korur. [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts) içindeki `backupFilename()` fonksiyonu adı oluşturur. Zip'in içeriği, ada bakılmaksızın aynıdır. İçinde:

| Yol | Gerekli | İçerik |
|---|---|---|
| `manifest.json` | evet | Biçim kimliği, sürümler, sayılar ve parça başına bütünlük. Bir okuyucunun ilk baktığı şey. |
| `profile.json` | ayarlıysa | Kullanıcının tüm `me` kaydı: ad, iletişim, profil fotoğrafı referansı ve bayraklar, artı klasörler, çöp kutusu, proje şablonları, kullanıcı şablonları ve kullanıcı tarafından yapılan araçlar, favoriler, gizli araçlar, dil ve emoji seçimi. `host.profile` üzerinden okunur. |
| `sessions.json` | evet | Kaydedilmiş her oturum: yuva, araç kimliği/sürümü, etiket, küçük resim (veri-URL) ve tam girdi verisi. `host.state` üzerinden okunur. |
| `assets.json` | evet | Yüklenen her varlığın (görseller, yazı tipleri, marka jetonları, logolar, indirmelerin kaydedilmiş kopyaları) meta verisi, her biri `assets/blobs/` altındaki baytlarına işaret eder. |
| `assets/blobs/<n>.<ext>` | varlık başına | Ham varlık baytları (görsel ve yazı tipi dosyaları). Sıkıştırılmadan saklanır (biçimler zaten sıkıştırılmıştır). Uzantı kozmetiktir. `assets.json` içindeki MIME yetkilidir. |
| `assets/blobs/<n>.c2pa` | mevcutsa | Varlık kaydındaki `_credentialFile` tarafından referans verilen, tam ikili baytlar olarak ayıklanmış Content Credentials. Bunlar cihaz imzalama anahtarları değildir. |
| `design-systems.json` | mevcutsa | Bu kurulumda oluşturulan veya eklenen tasarım sistemleri, `{ active, records }` olarak. İçe aktarımda kimliğe göre birleştirilir; demetin aktif seçimi yalnızca hedefin kendi tasarım sistemi olmadığında uygulanır. |
| `file-history.json` | isteğe bağlı | Sürümlenmiş varlık anlık görüntüleri, sonlanmış dosya işlemi raporları ve eksiksiz toplu iş manifestoları. Geçmiş parçasının kendi sürümü vardır; kabuğun dahili `fileHistory` yedek uyarlayıcısı tarafından sağlanır. |
| `revision-history.json` | isteğe bağlı, elle yedekler | Kararlı oluşum kimlikleri, tutulan kontrol noktaları, küçük resimler ve kayan kurtarma taslakları. Desteklendiği yerde `host.state.history.backup` tarafından sağlanır. |
| `file-history/versions/` | anlık görüntü başına | Geçerli varlık hâlâ var olsun ya da olmasın, önceki varlık baytları ve ayıklanmış kimlik bilgileri. |
| `file-history/results/` | tamamlanan işlem başına | Tam çıktı baytları. Dönüştürme için seçilmiş hiçbir orijinal dosya tutulmaz veya dahil edilmez. |
| `prefs.json` | evet | Kullanıcıya ait yerel tercihler: `theme`, `sidebarWidth` ve `ct-metrics` etkinlik sayacı. |
| `lolly.txt` | evet | Demeti Lolly olmadan açan herkes için demetin okunabilir bir özeti (sayılar, profil, dosya adı). Her dışa aktarımda yeniden üretilir ve içe aktarımda tanınır, bu yüzden asla atlanan bir parça olarak sayılmaz. Bütünlük haritasından *sonra* yazılır, bu yüzden onun dışında kalır. |

Demet bilerek düz bir zip'tir: herhangi bir taşımayı bozulmadan atlatır ve herhangi bir unzip aracı onu inceleyebilir.

`profile.json` en küçük parçadır ve bir okuyucunun uygulamada ilk gördüğü parçadır: bir üreticinin bir kez doldurduğu bilgiler, artı araçların bunları kullanmasına izin veren tercih.

![profile.json'a dönüşen Profil bilgileri formu - ad, iletişim, profil fotoğrafı ve yanlarındaki tercih](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1800&format=svg&cropSelector=.profile-details-grid&walker=1&dark=1&filename=ce-profile-record)

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
| `format` | Her zaman `lolly-backup`. Bu olmayan bir dosya "bir Lolly yedeği değil" diye reddedilir. |
| `formatVersion` | Bu demetin **yazıldığı** düzen. Parça kümesindeki veya biçimlerindeki herhangi bir değişiklikte artırılır. Okuyucular bunu **kapı** olarak kullanmaz. |
| `minReader` | Bu demeti **güvenle** içe aktarmak için gereken en düşük okuyucu sürümü. Okuyucuların kapı olarak kullandığı alan budur. |
| `app` | Üreten uygulama kimliği, tanılama için. |
| `exportedAt` | Demetin oluşturulduğu ISO zaman damgası. |
| `counts` | Yazarın neyi koyduğu, görüntüleme ve mantık denetimi için. |
| `integrity` | İsteğe bağlı. `manifest.json` dışındaki her parçayı, **sıkıştırılmamış** baytlarının SRI tarzı bir `sha256-<base64>` özetine eşler. |

## Sürüm politikası (ileriye dönük uyumluluk)

`formatVersion` ile `minReader` arasındaki ayrım, biçimin daha eski kurulumları sahipsiz bırakmadan büyümesini sağlayan şeydir:

- Bir okuyucu, `manifest.minReader ≤` kendi okuyucu sürümü olduğunda bir demeti içe aktarır. Yalnızca demet açıkça daha yeni bir okuyucu talep ettiğinde ("uygulamanın daha yeni bir sürümünü gerektiriyor" diyerek) reddeder.
- **Katkısal** bir değişiklik - yeni bir *isteğe bağlı* parça veya yeni bir isteğe bağlı manifesto alanı - `formatVersion`'ı artırır ama `minReader`'ı değiştirmez. Daha eski uygulamalar tanıdıkları her parçayı yine de içe aktarır. Tanımadıkları parçalar (aşağıya bak) atlanır, sessizce düşürülmez.
- **Bozucu** bir değişiklik - bir parçanın yanlış içe aktarımının veriyi bozduğu veya daha önce isteğe bağlı bir parçanın zorunlu hale geldiği - `minReader`'ı yükseltir. Daha eski uygulamalar bu durumda idare edemeyecekleri bir şeyi içe aktarmak yerine temiz bir şekilde reddeder.
- Gelecekteki bir demet `formatVersion`'ı ayarlayıp `minReader`'ı atlarsa, okuyucular tedbirli davranarak `formatVersion` üzerinden kapı kontrolüne geri döner (değişikliği bozucu sayar).

> **Yazarlar için pratik kural:** var olan her okuyucu, eklediğini görmezden gelerek yine de doğru şeyi yapacaksa, bu katkısaldır - `formatVersion`'ı artır, `minReader`'ı bırak. Aksi halde `minReader`'ı yükselt.

## Bütünlük

`manifest.integrity` mevcut olduğunda, bir okuyucu listelenen her parçanın SHA-256'sını **hiçbir şey yazmadan önce** doğrular. Bir uyumsuzluk ("bütünlük kontrolünde başarısız oldu") veya eksik bir parça ("eksik") tüm içe aktarımı durdurur - kısmi bir geri yükleme yoktur. Bu, bir dosya taşımanın yol açabileceği bozulmayı yakalar (kesilmiş bir AirDrop, eki yeniden kodlayan bir e-posta ağ geçidi, kötü bir USB sektörü).

Bütünlük, tasarım gereği en iyi çaba temellidir: yalnızca Web Crypto mevcut olduğunda yazılır (her güvenli tarayıcı bağlamı ve modern Node), ve yalnızca hem harita hem de Web Crypto mevcut olduğunda doğrulanır. Haritası olmayan bir demet - örneğin bütünlük özelliğinden önceki bir demet - değişmeden içe aktarılır. "Doğrulanamıyor" asla "bozuk" olarak ele alınmaz.

Manifesto ne kendisini ne de yeniden üretilen `lolly.txt` README'sini listeler. Özetler manifestonun teyit ettiği parçaları kapsar.

## İçe aktarma anlambilimi

İçe aktarma **birleştir-üzerine yaz** yöntemidir, asla tümünü değiştir değil:

- Hedefteki mevcut veri olduğu yerde bırakılır.
- Çakışan herhangi bir anahtar - profil, bir oturum yuvası, yüklenen bir görsel kimliği - içe aktarılan kopyayla değiştirilir.
- Profil tek bir kayıttır, bu yüzden bütünüyle değiştirilir: hedefin klasörleri, çöp kutusu, şablonları, favorileri ve gizli araçları demetinkiler olur. Hedefin sahip olduğu ama demetin sahip olmadığı bir oturum, Projeler'in en üst düzeyinde, dosyalanmamış olarak korunur.
- Geçmiş varlık sürümleri ve işlem kimlikleri değişmez istisnalardır: tekrarlanan bir içe aktarma bir örnektir (idempotent); zaten farklı baytlar/geçmiş adlandıran bir kimlik üzerine yazılmaz, reddedilir. Aynı geçerli varlığı yeniden içe aktarmak sürümünü korur. Değişen bir geçerli varlık farklı bir sürüm taşımalıdır.
- Oluşum geçmişi de bir istisnadır: çakışan bir geçerli belge ya da revizyon kimliği, profil, varlık veya tercih değişikliklerinden önce kendi geri yüklemesini durdurur. Aynı tekrarlanan bir içe aktarma hiçbir depolama eklemez. Çakışan bir arşivi incelemek ve oluşumlarını kopyalamak için ayrı bir kurulumda geri yükle.
- Demette olmayan hiçbir şeye dokunulmaz. Hedefin sahip olduğu ama demetin sahip olmadığı bir oturum, içe aktarımı atlatır.

Kaydedilmiş oturumlar görsellerine otomatik olarak yeniden bağlanır: varlık referansları kimliğe göre tutulur ve köprü, yüklenen görseller geri yüklendikten sonra bunları yeniden çözer (zaten öyle yapmak zorundadır, çünkü `blob:` URL'ler bir yeniden yüklemeyi atlatmaz).

İçe aktarma özeti `{ profile, sessions, userAssets, prefs, skipped, failedAssets }` bildirir. `failedAssets`, geri yüklenemeyen yüklenmiş varlıkları sayar (cihaz depolaması dolu, mesela). Bu, ileriye dönük uyumlu daha yeni bir yazarın parçalarını bu derlemenin tanımadığını sayan `skipped`'den farklıdır. Arayüz `skipped`'i gösterir ("… · N daha yeni öge atlandı"), böylece geri yükleme neyi geride bıraktığı konusunda dürüst olur.

Dosya geçmişi mevcut olduğunda, özet ayrıca `assetVersions`, `fileOperations` ve `failedHistory`'yi de taşır. Depolama tükenmesi veya değişmez kimlik çakışmaları kısmi bir geri yüklemeye neden olabilir; arayüz kullanıcıya kaynak yedeği saklamasını söyler. Bulut senkronizasyonu, kısmi veya desteklenmeyen bir geri yüklemeden sonra uygulanan revizyonunu **ilerletmez**, bu yüzden anlık görüntü yeniden denemek için kullanılabilir kalır. Geri yükleme, tüm profil/oturum/varlık/geçmiş depoları boyunca tek bir işlem değildir.

## Oluşum geçmişi (v3)

Geçmiş özelliğine sahip bir web sunucusundan gelen elle yedekler, kendi `{ version: 1, documents, revisions, recoveries }` şemasına sahip `revision-history.json`'ı içerir. Tutulan kimlikleri, standart girdi anlık görüntülerini, sürüm damgalarını, raster önizlemeleri ve ayrı yazar taslaklarını taşır. Geçmiş uyarlayıcısı, geçerli oturumları ve başlarını tek bir okuma işleminde yakalar; `sessions.json`, eski okuyucular için aynı geçerli anlık görüntüleri kullanır.

Geri yükleme, arşivi tek bir işlemde onaylamadan önce yükün SHA-256'sını ve bayt sayılarını, benzersiz kimlikleri, belge/baş ilişkilerini, soyu, zaman damgalarını, önizleme türlerini ve sınırları denetler. Sıkıştırılmış üst referanslar bulunmayabilir. Var olan geçerli çalışma, içe aktarılan belgeyle eşleşmelidir; çakışmalar sessizce değiştirilmek yerine reddedilir. Arşivin 384 MiB'lik aktarım sınırı açıkça denetlenir ve depolama sınırları, tutulan kontrol noktalarını kısaltmadan uygulanır. Genel yedek hâlâ bellek içi bir ZIP uygulaması kullanır ve akış tabanlı bir arşiv değildir.

Özet, `revisions` ve `recoveryDrafts`'ı ekler. Bu yeteneğe sahip olmayan bir kabuk, sıradan oturumları geri yükler ve geçmiş parçasını atlandı olarak bildirir. Yerel dosya sistemi geçmişi, uyarlayıcısı kalıcı geçmiş işlemleri sağlayana kadar desteklenmeden kalır. P2P misafir durumunun kalıcı bir geçmişi veya kurtarma arşivi yoktur.

Kişisel anlık görüntü senkronizasyonu, oluşum geçmişini açıkça hariç tutar. Bir anlık görüntüyü geçmişi olan yerel bir belgeye uygulamak, önceki çalışma durumunu ayrı bir kurtarma taslağı olarak korur ve açık herhangi bir düzenleyicinin yazma jetonunu geçersiz kılar. Değişmez kontrol noktaları cihazda kalır. Bu, anlık görüntü değişimi sırasında yerel geçmişi korur; eşzamanlı cihaz geçmişlerini birleştirmez.

Geçmiş varlık referansları tutulur, ancak render işlemi varlıkları hâlâ hedefin var olan kütüphanesi üzerinden çözer. Bu arşiv henüz tam eski varlık baytlarını veya eski araç render'larını garanti etmez. Varlık sürümü ve dosya sonucu baytları, kendi var olan ayrı yedek parçaları üzerinden yolculuğa devam eder.

## Kaydedilmiş sürümler ve dosya sonuçları (v2)

İsteğe bağlı geçmiş parçası `{ version: 2, assetVersions: [...], operations: [...], batches: [...] }`'i içerir; okuyucular ayrıca toplu işler olmadan daha eski history-v1 biçimini de kabul eder. Her anlık görüntü, kararlı varlık kimliğini ve tam sürümü, kaydedilme zamanını, bayt uzunluğunu ve onaltılık SHA-256'yı, artı `_file`'ı ve isteğe bağlı `_credentialFile`'ı ikili parçalara işaret eden bir varlık kaydını tanımlar. İşlemler orijinal dosya bilgilerini, isteği, raporu, zaman damgalarını ve isteğe bağlı sonuç `_file`'ını taşır; depolama arka ucu adları, OPFS tanıtıcıları ve yürütme kiraları taşınmaz. Yalnızca history-v1'i tanıyan eski okuyucular, toplu iş üyeliğini sessizce düşürmek yerine, içe aktarmadan önce yeni geçmiş sürümünü reddeder.

Toplu iş manifestoları, hiç okunmamış dosyalar, iptal edilen üyeler, sonuç alanı ayırma başarısızlıkları ve yarıda kalan çalışmalar dahil olmak üzere, işlemeden önce seçilen her kaynağı kaydeder. Her üyenin kararlı bir işlem kimliği, kaynak referansı/bilgileri, istenen çıktı adı ve sonlanma raporu vardır. Okunmamış bir kaynağın bildirilen bilgileri vardır, uydurulmuş bir özeti değil. İçe aktarma, üye kimliğini ve taşınan herhangi bir işlem raporuyla tutarlılığını doğrular. Bireysel sonuçlar açıkça kaldırıldığında bile toplu iş raporları kullanılabilir kalır, ama bir makbuz çıktı baytlarının hâlâ saklandığı anlamına gelmez.

- Bilinen her geçmiş kaydı, rapor ve referans verilen dosya, herhangi bir profil veya varlık içe aktarma yazımından önce doğrulanır. Eksik baytlar ve uyuşmayan SHA-256, zarfın bütünlük haritası olmasa bile başarısız olur. Ayıklanmış kimlik bilgileri, onları sayısal anahtarlı nesneler olarak JSON'a seri hale getiren eski yazarlardan gelen içe aktarmalar dahil, bayt dizisi olarak kalır.
- Çalışan işlemler, yedekte açıklayıcı bir başarısızlık raporuyla ve sonuçsuz olarak yarıda kalmış kayıtlara dönüşür. Geri yükleme, arka plan çalışmasını asla yeniden başlatmaz veya etkin bir kirayı içe aktarmaz. Yeniden denemek, mevcut olduğunda kayıtlı SHA-256'sına karşı denetlenen orijinal dosyanın seçilmesini gerektirir.
- Geri yüklenen sonuçlar, baytlarını ve meta verilerini birlikte IndexedDB'ye işler. Sıradan yeni sonuçlar, mevcut olduğunda OPFS'i, IndexedDB yedeğiyle birlikte kullanır. Var olan canlı bir işlem asla bir içe aktarmayla değiştirilmez.
- Geçmiş ZIP'inin bir araya getirilmesi hâlâ bellekte yapılır: geçerli sınır **256 MiB geçmiş yükü**, **4 MiB geçmiş meta verisi**, en fazla **100 işlem**, **100 toplu iş** ve **2.000 anlık görüntüdür**. Dışa aktarma, aşırı büyük veya eksik geçmişi açıkça reddeder; onu asla sessizce atlamaz. Eski yerel kopyaları kaldırmadan önce önemli sürümleri/sonuçları tek tek indir. Bu sınırlar telefonlar için ölçülmüş bir tepe bellek garantisi değildir.
- Yerel sonuç geçmişinin 512 MiB'lik bir bütçesi ve 100 kayıtlık bir sınırı vardır. Varlık anlık görüntülerinin ayrı bir 512 MiB bütçesi ve varlık başına en fazla 20 geçmiş sürümü vardır; ayıklanmış kimlik bilgisi baytları bu anlık görüntü bütçesine sayılır. Geri yükleme bu sınırlara uyar ve var olan kullanıcı verisini asla sessizce tahliye etmez.
- Yerel toplu iş meta verisinin ayrı bir 4 MiB bütçesi, en fazla 100 manifesto ve toplu iş başına 20 üyesi vardır. Bekleyen üyeler, üye başına 32 KiB'lik bir rapor tavanıyla meta veri kapasitesi ayırır. Bu mantıksal bir bütçedir, bir tarayıcı disk alanı garantisi değildir; gerçek bir kota hatası yüzeye çıkarılır ve bellek içi rapor indirilebilir kalır. Bir toplu iş üyesini yeniden denemek, eski raporun üzerine yazmadan yeni bir toplu iş oluşturur. Bir toplu iş kaydını kaldırmak, bireysel sonuç baytlarını veya kütüphane varlıklarını kaldırmaz.
- Dönüştürülen sonuçlar, normalleştirme veya yeniden kodlama olmadan açıkça kütüphaneye eklenebilir. Kaynak/çıktı özetleri ve işlem ilişkisi varlığa eşlik eder. Tekrarlanan eklemeler değişmemiş bir kopyayı yeniden kullanır; düzenlenmiş bir kopyanın üzerine asla yazılmaz. Raster görseller yeni bir Design belgesi başlatabilir. O belge geçerli kütüphane varlık kimliğini kullanır: Design'ın çalışma zamanı ve URL yolu boyunca tam sürüm sabitlemelerini zorlamak hâlâ ayrı bir iştir. SVG/HTML/PDF/ZIP sonuçları bu devirle opak dosya varlıkları olarak tutulur, güvenilir etkileşimli/vektör içeriğe yükseltilmez.
- **Convert → Recent file operations**, geçmiş kullanımını, raporları, indirmeleri ve sürüm yöneticisini gösterir. Yönetici ayrıca silinmiş kütüphane varlıklarının önceki sürümlerini de bulur. Bir anlık görüntüyü geri yüklemek, seçili anlık görüntüyü olduğu gibi bırakarak yeni bir geçerli sürüm oluşturur. **Ayarlar → Depolama**, sonuçları ve sürümleri tek kullanımlık önbelleklerden ayrı olarak hesaba katar.
- Açık geçici dosya temizliği, yalnızca işleme ait, referans verilmeyen baytları kaldırır. Geçerli kayıtlar dosyalarını korur; son OPFS dosyalarının bir saatlik bir ek süresi vardır. Kaydedilmiş sonuçlar ve varlık anlık görüntüleri otomatik olarak temizlenmez.

Eski okuyucular hâlâ v2 zarfını (`minReader: 1`) kabul eder ve tanıdık parçaları geri yükler, desteklenmeyen geçmiş parçalarını atlandı olarak sayar. Tam geçmiş kurtarma, `fileHistory` uyarlayıcısına sahip bir kabuk gerektirir; bu, araca yönelik yeni bir `HostV1` yeteneği değil, kabuk içi bir dikiştir. Gerçek iki cihazlı geri yükleme yerel Chromium kapısı tarafından kapsanır; kurulu Tauri/iOS/Android kurtarma kabulü ayrı kalır.

## Neler taşınmaz

- **Katalog önbellekleri** (indirilen varlık meta verisi ve blob'ları, araç dizini) - hedefte ücretsiz yeniden senkronize edilir.
- **Katalog araçları ve katalog varlıkları** - kapsam dışı, hedefte zaten mevcut olduğu varsayılır. Kullanıcının eklediği marka jetonları, yazı tipleri ve logolar kullanıcı varlıklarıdır, bu yüzden onlar taşınır.
- **`blob:` / nesne URL'leri** - yüklemede köprü tarafından yeniden üretilir.
- **Dönüştürme orijinalleri, canlı yürütme kiraları ve makineye özgü erişim/imzalama sırları** - taşınabilir geçmiş yükü değildir. Kaydedilmiş bir sonuç bir kopyadır, orijinal kaynağın yedeklendiğine dair bir söz değildir.
- **Dışa aktarma sıra sayacı** - günlük, indirme adlandırma sayacı (`localStorage` anahtarı `lolly-export-seq`) yerel bir adlandırma kolaylığıdır. `PREF_KEYS` dışında tutulur, bu yüzden asla bir demette yolculuk etmez.

Depolama ölçer aynı ayrımı kalemleştirir. Kaydedilmiş oturumlar, Görsellerim ve File results & versions bir demette yolculuk eder. Varlık önbelleği, Araç önizlemeleri ve altındaki çevrimdışı sabitlemeler hepsi yeniden türetilebilir, bu yüzden geride kalırlar.

![Bu cihazın verisini adlandırılmış kategorilere ayıran depolama ölçer, Kaydedilmiş oturumlar ve Görsellerim'in Varlık önbelleğinden ayrı takip edildiği, her kategorinin hâlâ boş olduğu yeni bir kurulumda](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=.store-manages%2C.storage-subsection%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&walker=1&dark=1&filename=ce-storage-categories)

## Kabuklar arası garanti

`data-transfer.ts`, yalnızca yetenek köprüsü (`host.profile`, `host.state`, `host.assets`) ve paylaşılan `localStorage` tercihleri üzerinden okur ve yazar. Aynı modül, IndexedDB veya dosya sistemi depolaması üzerinden, web'de ve Tauri'de ortak zarfı okur ve yazar. İsteğe bağlı geçmiş parçaları yalnızca ilgili uyarlayıcının bulunduğu yerde görünür; desteklenmeyen bir parça içe aktarımda atlandı olarak bildirilir. Headless test paketi, ortak parçaları bellek içi bir köprüye karşı çalıştırırken, geçmiş işlemlerinin de gerçek tarayıcı testleri vardır.

İki kabuk, farklı nedenlerle bu garantinin dışında kalır:

- **Tek seferlik CLI**'nin taşıyacak bir şeyi yok - durumu her çağrı için bellek içinde ve geçicidir.
- **TUI** durumu gerçekten kalıcı kılar (`~/.lolly`: oturumlar, klasörler, profil) ve Profile görünümü bunu yedekleyebilir, ama kendine ait *daha basit* bir arşiv yazar: oturum başına `saved-state/<slot>.json` artı `profile.json` ve `folders.json`, manifest olmadan, `formatVersion`/`minReader` olmadan ve bütünlük eşlemesi olmadan. Bu formatla **içe aktarılamaz** - bir okuyucu bunu "Lolly yedeği değil" diye reddeder - ve kafa karıştırıcı biçimde benzer bir ad kullanır (`lolly-backup-<stamp>.zip`). İkisini birleştirmek bilinen bir eksiktir.

## Ayrılmış genişletme noktaları

Zarf, tasarım gereği bir manifest artı adlandırılmış parçalar kümesidir; böylece taşınabilir yeni veri türleri **kırıcı bir değişiklik olmadan** daha sonra bu yapıya binebilir. Ek parçalar olarak eklenirler (yeni `formatVersion`, aynı `minReader`) ve bugünkü okuyucu tanımadığı şeyi atlar. Bunlar henüz uygulanmadı. Adlar, bu format geldiğinde tutarlı kalsın diye burada ayrılmıştır.

- **`tokens.json` - tasarım belirteçleri.** Bir [W3C DTCG](https://tr.designtokens.org/format/) tasarım belirteci belgesi ([Penpot'un içe/dışa aktardığı](https://help.penpot.app/user-guide/design-systems/design-tokens/) format - `$value`/`$type`/`$description` içeren, gruplara, kümelere ve temalara ayrılmış belirteçler). Pakette bir belirteç kümesi bulunması, kullanıcının marka ilkellerini oturumlarıyla birlikte kurulumlar arasında taşımasını sağlar. (Bir kullanıcının kendi marka belirteçleri bugün zaten `assets.json` içindeki `user/tokens/brand` varlığı olarak taşınır; bu parça sette ve temalarıyla birlikte tam bir DTCG belgesi taşırdı.) Uzun vadede, içe aktarılan bir belirteç kümesi, araçların ve palet varlıklarının karşısında çözümlendiği birinci sınıf bir kaynak hâline gelir.
- **`penpot/` - içe aktarılmış Penpot dosyaları.** *Bir araç olarak* içe aktarılan ve gösterilen bir Penpot dosyası (veya onun ayıklanmış, Lolly ile ilgili alt kümesi) için ayrılmış bir dizin. Paket, içe aktarılan tanımı taşıyacak; böylece kullanıcının diğer verileriyle birlikte yolculuk eder.

Bu ayrılmış adların ve yukarıdaki parçaların dışındaki her şey, bir okuyucu için bilinmeyen bir parçadır: dokunulmadan bırakılır ve `skipped` içinde sayılır.

## Referans

- Modül: [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts) (`exportBackup`, `importBackup`, `BACKUP_FORMAT`, `BACKUP_FORMAT_VERSION`, `BACKUP_READER_VERSION` - `backupFilename()` adlandırıcısı içseldir).
- Sözleşme testi: [`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) - gidiş-dönüş, birleştirme, bütünlük, ileri uyumluluk ve okuyucu-kapısı senaryoları.
- Geçmiş sözleşme testleri: [`tests/file-history-backup.test.ts`](../tests/file-history-backup.test.ts), [`tests/file-batch-history.test.ts`](../tests/file-batch-history.test.ts) ve [`tests/file-result-library.test.ts`](../tests/file-result-library.test.ts). Tarayıcı kabulü: [`tests/file-history.browser.test.ts`](../tests/file-history.browser.test.ts), [`tests/file-batch-history.browser.test.ts`](../tests/file-batch-history.browser.test.ts) ve [`tests/file-result-reuse.browser.test.ts`](../tests/file-result-reuse.browser.test.ts).
- Kullanılan köprü yüzeyi: `host.profile`, `host.state`, `host.assets` - bkz. [Host API](/info/host-api.html).
