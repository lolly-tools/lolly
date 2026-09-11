# Veri Aktarımı - `lolly-backup` demeti

Bir Lolly kullanıcısının biriktirdiği her şey **cihazında** yaşar - hesap yok, bulut yok. Veri aktarımı demeti bu değerin nasıl taşındığıdır: bir kurulumda dışa aktar, dosyayı herhangi bir yolla taşı (USB, AirDrop, kendine e-posta, bir ağ paylaşımı) ve başka bir kurulumda içe aktar. Aktarım araç *dosyanın kendisidir*. Hedef çevrimdışı veya çevrimiçi olabilir. Hiçbir fark yaratmaz, çünkü hiçbir zaman bir sunucuyla konuşulmaz.

![Bütün bir kurulumu taşıyan iki düğme: Export my data tek bir zip yazar, Import data onu geri okur](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.storage-subsection&dark=1&filename=pd-transfer-controls)

Bu sayfa biçim spesifikasyonudur. Son kullanıcı için adım adım anlatım için bkz. [Lolly'yi Kullanmak → Başka bir cihaza taşınmak](/info/using.html). Uygulama [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts) dosyasındadır ve [`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) gidiş-dönüş sözleşmesini sabitler.

> **Kapsam.** Bir demet *kullanıcı verisini* taşır, araçları değil. Araçlar ve katalog varlıkları ayrı senkronize edilir ve hedefte zaten mevcut olduğu varsayılır (en kötü durumda daha yüksek bir sürümde). İçe aktarma asla bir aracı kurmaz veya yükseltmez.

## Hedefler

- <!--i:box--> **Tek biçim, her kabuk.** Aynı baytlar web PWA, Tauri masaüstü/mobil uygulamaları ve gelecekteki her kabuk tarafından üretilir ve tüketilir. Demet sözleşmedir. Her kabuğun yetenek köprüsü, arkasındaki platforma özgü uyarlayıcıdır.
- <!--i:shieldcheck--> **Yolculuğu atlatır.** Taşıma sırasında bozulmuş veya kesilmiş bir demet, içe aktarımda gürültülü bir şekilde başarısız olur, asla yarı yarıya geri yüklemez.
- <!--i:clock--> **Bu sürümden daha uzun ömürlü.** Daha eski bir uygulama, daha yeni bir demetin tanıdığı kısımlarını yine de içe aktarabilir. Gerçekten bozucu bir biçim temiz bir şekilde reddedilir.
- <!--i:check--> **Birleştirmek için güvenli.** Zaten kullanımda olan bir kuruluma içe aktarmak, demette olmayan hiçbir şeyi asla silmez.

## Zarf

Paket, düz bir `.zip` dosyasıdır. İndirme, ait olduğu kişinin adına göre adlandırılır - `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` (örneğin `LollyTools-Ada-Lovelace-2026-06-26-1.zip`) - böylece bir İndirilenler klasöründeki yedekler okunaklı kalır. Ad ve soyad kısımları profilden gelir ve ayarlanmamışsa atlanır. Profil yoksa `LollyTools-2026-06-26-1.zip` elde edilir, yalnızca ad varsa `LollyTools-Ada-2026-06-26-1.zip` elde edilir. Her kısım dosya adına uygun bir jetona göre temizlenir (Unicode harfler/rakamlar korunur, boşluklar/noktalama işaretleri kaldırılır, 32 karakterle sınırlandırılır). `<n>`, güne ve cihaza özgü bir sıra numarasıdır, böylece aynı gün yapılan tekrar dışa aktarımlar çakışmaz ve sırasını korur. [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts) içindeki `backupFilename()` fonksiyonu adı oluşturur. Zip'in içeriği, ada bakılmaksızın aynıdır. İçinde:

| Yol | Gerekli | İçerik |
|---|---|---|
| `manifest.json` | evet | Biçim kimliği, sürümler, sayılar ve parça başına bütünlük. Bir okuyucunun ilk baktığı şey. |
| `profile.json` | ayarlıysa | Kullanıcının `me` kaydı (ad, iletişim, profil fotoğrafı referansı, bayraklar). `host.profile` üzerinden okunur. |
| `sessions.json` | evet | Kaydedilmiş her oturum: yuva, araç kimliği/sürümü, etiket, küçük resim (veri-URL) ve tam girdi verisi. `host.state` üzerinden okunur. |
| `assets.json` | evet | Yüklenen her varlığın (görseller, yazı tipleri, marka jetonları) meta verisi, her biri `assets/blobs/` altındaki baytlarına işaret eder. |
| `assets/blobs/<n>.<ext>` | varlık başına | Ham varlık baytları (görsel ve yazı tipi dosyaları). Sıkıştırılmadan saklanır (biçimler zaten sıkıştırılmıştır). Uzantı kozmetiktir. `assets.json` içindeki MIME yetkilidir. |
| `prefs.json` | evet | Kullanıcıya ait yerel tercihler: `theme`, `sidebarWidth` ve `ct-metrics` etkinlik sayacı. |
| `lolly.txt` | evet | Demeti Lolly olmadan açan herkes için demetin okunabilir bir özeti (sayılar, profil, dosya adı). Her dışa aktarımda yeniden üretilir ve içe aktarımda tanınır, bu yüzden asla atlanan bir parça olarak sayılmaz. Bütünlük haritasından *sonra* yazılır, bu yüzden onun dışında kalır. |

Demet bilerek düz bir zip'tir: herhangi bir taşımayı bozulmadan atlatır ve herhangi bir unzip aracı onu inceleyebilir.

`profile.json` en küçük parçadır ve bir okuyucunun uygulamada ilk gördüğü parçadır: bir üreticinin bir kez doldurduğu bilgiler, artı araçların bunları kullanmasına izin veren tercih.

![profile.json'a dönüşen Profil bilgileri formu - ad, iletişim, profil fotoğrafı ve yanlarındaki tercih](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1800&format=svg&cropSelector=.profile-details-grid&walker=1&dark=1&filename=ce-profile-record)

## `manifest.json`

```json
{
  "format": "lolly-backup",
  "formatVersion": 1,
  "minReader": 1,
  "app": "lolly",
  "exportedAt": "2026-06-22T09:30:00.000Z",
  "counts": { "profile": true, "sessions": 2, "userAssets": 4, "prefs": 3 },
  "integrity": {
    "profile.json": "sha256-…",
    "sessions.json": "sha256-…",
    "assets.json": "sha256-…",
    "assets/blobs/0.webp": "sha256-…",
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
- Demette olmayan hiçbir şeye dokunulmaz. Hedefin sahip olduğu ama demetin sahip olmadığı bir oturum, içe aktarımı atlatır.

Kaydedilmiş oturumlar görsellerine otomatik olarak yeniden bağlanır: varlık referansları kimliğe göre tutulur ve köprü, yüklenen görseller geri yüklendikten sonra bunları yeniden çözer (zaten öyle yapmak zorundadır, çünkü `blob:` URL'ler bir yeniden yüklemeyi atlatmaz).

İçe aktarma özeti `{ profile, sessions, userAssets, prefs, skipped, failedAssets }` bildirir. `failedAssets`, geri yüklenemeyen yüklenmiş varlıkları sayar (cihaz depolaması dolu, mesela). Bu, ileriye dönük uyumlu daha yeni bir yazarın parçalarını bu derlemenin tanımadığını sayan `skipped`'den farklıdır. Arayüz `skipped`'i gösterir ("… · N daha yeni öge atlandı"), böylece geri yükleme neyi geride bıraktığı konusunda dürüst olur.

## Neler taşınmaz

- **Katalog önbellekleri** (indirilen varlık meta verisi ve blob'ları, araç dizini) - hedefte ücretsiz yeniden senkronize edilir.
- **Araçlar ve marka varlıkları** - kapsam dışı, hedefte zaten mevcut olduğu varsayılır.
- **`blob:` / nesne URL'leri** - yüklemede köprü tarafından yeniden üretilir.
- **Dışa aktarma sıra sayacı** - günlük, indirme adlandırma sayacı (`localStorage` anahtarı `lolly-export-seq`) yerel bir adlandırma kolaylığıdır. `PREF_KEYS` dışında tutulur, bu yüzden asla bir demette yolculuk etmez.

Depolama ölçer aynı ayrımı kalemleştirir. Kaydedilmiş oturumlar ve Görsellerim bir demette yolculuk eder. Varlık önbelleği, araç önizlemeleri ve altındaki çevrimdışı sabitlemeler hepsi yeniden türetilebilir, bu yüzden geride kalırlar.

![Bu cihazın verisini adlandırılmış kategorilere ayıran depolama ölçer, Kaydedilmiş oturumlar ve Görsellerim'in Varlık önbelleğinden ayrı takip edildiği, her kategorinin hâlâ boş olduğu yeni bir kurulumda](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=.store-manages%2C.storage-subsection%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&walker=1&dark=1&filename=ce-storage-categories)

## Kabuklar arası garanti

`data-transfer.ts` yalnızca yetenek köprüsü (`host.profile`, `host.state`, `host.assets`) ve paylaşılan `localStorage` tercihleri üzerinden okur ve yazar. Köprü tek geçiş noktası olduğundan, altındaki depolama farklı olsa bile - web'de IndexedDB, Tauri'de dosya sistemi - *aynı* modül her kabukta bayt bayt özdeş bir paket üretir. Tauri kabukları bu modülü değiştirmeden yeniden kullanır. Yalnızca `host.state` uygulamaları farklıdır. Headless test, bellek içi bir köprüye karşı tam gidiş-dönüşü çalıştırır; bu yüzden hepsinin yerine geçer.

İki kabuk, farklı nedenlerle bu garantinin dışında kalır:

- **Tek seferlik CLI**'nin taşıyacak bir şeyi yok - durumu her çağrı için bellek içinde ve geçicidir.
- **TUI** durumu gerçekten kalıcı kılar (`~/.lolly`: oturumlar, klasörler, profil) ve Profil görünümü bunu yedekleyebilir, ama kendine ait *daha basit* bir arşiv yazar: oturum başına `sessions/<slot>.json` artı `profile.json` ve `folders.json`, manifest olmadan, `formatVersion`/`minReader` olmadan ve bütünlük eşlemesi olmadan. Bu formatla **içe aktarılamaz** - bir okuyucu bunu "Lolly yedeği değil" diye reddeder - ve kafa karıştırıcı biçimde benzer bir ad kullanır (`lolly-backup-<stamp>.zip`). İkisini birleştirmek bilinen bir eksiktir.

## Ayrılmış genişletme noktaları

Zarf, tasarım gereği bir manifest artı adlandırılmış parçalar kümesidir; böylece taşınabilir yeni veri türleri **kırıcı bir değişiklik olmadan** daha sonra bu yapıya binebilir. Ek parçalar olarak eklenirler (yeni `formatVersion`, aynı `minReader`) ve bugünkü okuyucu tanımadığı şeyi atlar. Bunlar [yol haritasında](/info/overview.html#roadmap) yer alır, henüz uygulanmadılar. Adlar, bu format geldiğinde tutarlı kalsın diye burada ayrılmıştır.

- **`tokens.json` - tasarım belirteçleri (design tokens).** Bir [W3C DTCG](https://tr.designtokens.org/format/) tasarım belirteci belgesi ([Penpot'un içe/dışa aktardığı](https://help.penpot.app/user-guide/design-systems/design-tokens/) format - `$value`/`$type`/`$description` içeren, gruplara, kümelere ve temalara ayrılmış belirteçler). Pakette bir belirteç kümesi bulunması, kullanıcının marka ilkellerini oturumlarıyla birlikte kurulumlar arasında taşımasını sağlar. Uzun vadede, içe aktarılan bir belirteç kümesi, araçların ve palet varlıklarının karşısında çözümlendiği birinci sınıf bir kaynak hâline gelir.
- **`penpot/` - içe aktarılmış Penpot dosyaları.** *Bir araç olarak* içe aktarılan ve gösterilen bir Penpot dosyası (veya onun ayıklanmış, Lolly ile ilgili alt kümesi) için ayrılmış bir dizin. Paket, içe aktarılan tanımı taşıyacak; böylece kullanıcının diğer verileriyle birlikte yolculuk eder.

Bu ayrılmış adların ve yukarıdaki parçaların dışındaki her şey, bir okuyucu için bilinmeyen bir parçadır: dokunulmadan bırakılır ve `skipped` içinde sayılır.

## Referans

- Modül: [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts) (`exportBackup`, `importBackup`, `BACKUP_FORMAT`, `BACKUP_FORMAT_VERSION`, `BACKUP_READER_VERSION` - `backupFilename()` adlandırıcısı içseldir).
- Sözleşme testi: [`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) - gidiş-dönüş, birleştirme, bütünlük, ileri uyumluluk ve okuyucu-kapısı senaryoları.
- Kullanılan köprü yüzeyi: `host.profile`, `host.state`, `host.assets` - bkz. [Host API](/info/host-api.html).
