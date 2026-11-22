# Lolly mimarisi

![Lolly simgesi - Büyük yeşil ve beyaz lolipop şeker](/info/icon.svg)

Bu sayfa Lolly'nin kodunu değiştirenler içindir: motorun, kabukların ve araç paketlerinin nasıl bir araya geldiği, her birinin depoda nerede bulunduğu ve her değişikliği sınırlayan taahhütler. Lolly'nin ne yaptığını ve kimlerin Lolly'yi kullandığını öğrenmek için önce [Lolly nasıl çalışır](/info/how-lolly-works.html) sayfasını oku.

[`engine/README.md`](https://github.com/lolly-tools/lolly/blob/main/engine/README.md) motoru modül modül gösterir ve koddan üretilir. [Tehdit modeli & güven sınırları](/info/threat-model.html) aynı mimariyi güven sınırları açısından ele alır ve motorun neleri güvenilmeyen olarak değerlendirdiğini söyler.

<!--i:eti-layers-->
## Genel görünüm

En üstte araçlar veridir. Ortadaki motor hiçbir platform hakkında bilgi sahibi değildir. Alttaki kabuklar tek bir sözleşmeyi uygular ve kataloglar içeriği sağlar.

![Araçlar ortak motora bir bildirim dosyası, şablon ve kancalar sağlar. Web, Tauri ve terminal kabukları HostV1 yetenek köprüsünü uygular ve araçlar ile varlıkları kataloglardan okur.](/info/diagrams/concepts/platform-layers.svg)

Yalnızca veri ve Handlebars ile tanımlayabildiğin her şey **motora** aittir. DOM'a, dosya sistemine, ağa veya herhangi bir tarayıcı ya da işletim sistemi API'sine dokunan her şey, köprünün kabuk tarafı olan **ana makineye** aittir. Motor açık kaynaklıdır. Belirli bir markayı tanıyan hiçbir şey motora girmez.

<!--i:eti-folder-shared-->
## Depo düzeni

Lolly tek bir depodur. Aşağıdaki her dizin, `brands/suse` dışında normal bir dizindir: bu, herkese açık depoyu klonladığında getirilmeyen, SUSE araç paketini ve kataloğunu içeren **özel** bir git alt modülüdür. Bir içerik profili (`profiles.json`), derlemenin hangi paketleri okuyacağını belirler. Her süreç kendi profilini çözümler ve genel bir anahtar yoktur. [Derleme kılavuzu](/info/build-guide.html), klonlama komutunu ve özel paket içindeki bir değişikliğin nasıl commit edileceğini içerir.

| Dizin | İçeriği |
|---|---|
| `engine/` | Platformdan bağımsız çekirdek: yükleyici, çalışma zamanı, girdiler, şablonlar, URL modu, birimler ve biçim modülleri |
| `shells/` | Web uygulaması, Tauri masaüstü ve mobil uygulamaları, CLI, TUI ve tarayıcı uzantısı |
| `packages/` | Araç yazarları için SDK (`@lolly-tools/core`), ortak Node kabuk parçaları ve belge render aracı gibi bileşenler |
| `community/` | Markadan bağımsız araçlar ve ortak emoji paketleri |
| `brands/` | Marka paketleri: `lolly-demo` (lolly.tools'un kullandığı tasarım sistemi Lolly Demo), `lolly-start` (boş başlangıç paketi) ve özel `suse` |
| `services/` | İsteğe bağlı MCP, sertifika ve Penpot hizmetleri ve paylaştıkları sunucu kodu |
| `schemas/` | Araç bildirim dosyaları, varlık kayıtları ve varlık başvuruları için JSON Schema |
| `scripts/`, `tests/`, `docs/`, `api/` | Derleme ve katalog betikleri, motor test paketi, bu belgeler ve üretilen sunucusuz paketler |

::: details İlk karşılaşacağın motor ve kabuk dosyaları
```
engine/src/
  index.ts          public surface: loader, runtime, template, inputs, url-mode
  loader.ts         fetches and validates tool files
  runtime.ts        orchestrates one mounted tool, from load to export
  template.ts       Handlebars hydration and annotateTemplate
  inputs.ts         manifest to runtime input model
  url-mode.ts       URL to input state and back
  validate.ts       JSON Schema validation of manifests
  compose.ts        nested tool renders (composes)
  embed.ts          portable lolly.tools embed URLs
  bridge/host-v1.ts type re-export of the @lolly-tools/core contract

shells/web/src/
  main.ts           boot and routing
  bridge/           the web implementations of the host APIs
  catalog/sync.ts   boot-time catalog sync and offline cache
  views/            the gallery, tool, projects, free canvas and the other views
  pro/              Batch (#/batch)

shells/cli/         bin/lolly.ts (entry), src/run.ts (headless render), src/bridge.ts
shells/tui/         src/main.tsx (the full-screen app), src/bridge.ts
```
:::

::: note Depo kökünde `tools/` veya `catalog/` dizini yoktur
`packages/node-shell/src/content-roots.ts`, "`<id>` aracı nerede bulunur" ve "katalog nerede" sorularını `profiles.json` üzerinden yanıtlar. Gerçek bir `tools/` ve `catalog/` çifti yalnızca `dist/`, bir RPM paketinin içeriği veya bir konteyner imajı gibi derleme çıktılarına yazılır; çünkü tarayıcı bu iki yolu HTTP üzerinden getirir.
:::

<!--i:eti-monitor-->
## Lolly nerede çalışır

Her arayüz aynı motoru ve aynı araç dosyalarını kullanır.

- **Web uygulaması.** Aşamalı bir web uygulaması. Service worker'ı araçları ve varlıkları önbelleğe aldıktan sonra çevrimdışı çalışır. Hesap gerektirmez ve durum her cihazda IndexedDB'de tutulur. Tek bir duyarlı düzen hem masaüstüne hem telefona hizmet eder. Telefonda denetimler bir panele dönüşür ve dışa aktarma denetimleri yüzen bir haptan açılır.
- **Masaüstü ve mobil uygulamalar.** Aynı web uygulamasının yerel dosya iletişim kutuları, dosya sisteminde tutulan durum ve tam çevrimdışı kullanım sunan Tauri paketleri.
- **CLI.** `lolly <tool-id> --input=value --output=file.png`, aynı motoru başsız bir DOM'da yükler ve dosyayı yazar. Bu, farklı bir taşıma katmanı üzerinden çalışan URL modudur. Bkz. [CLI](/info/cli.html).
- **TUI.** Tam ekran, klavye odaklı bir terminal uygulaması. CLI'nin köprüsünü yeniden kullanır ve kayıtlı oturumları diskte tutar: masaüstü uygulaması kuruluysa onun klasöründe, değilse `~/.lolly` altında. Yalnızca bir biçim gerektirdiğinde, kapsamı sınırlı bir başsız tarayıcı başlatır. Bkz. [TUI](/info/tui.html).

![Masaüstündeki bölünmüş görünüm: solda bildirim dosyasından üretilen denetimler, sağda canlı tuval](/t/url-shot?url=%2F%23%2Ftool%2Fchart&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&filename=aud-web-split)

Telefon genişliğinde denetim paneli üsttedir ve önizleme ekranı doldurur.

![430px genişliğindeki bir ekranda odyogram: üstte denetim paneli, altta bitmiş kare çalışma ve yüzen dışa aktarma hapı](/t/url-shot?url=%2F%23%2Ftool%2Faudiogram%3Faudio%3Dzzfxm%3A7%3Alofi%26title%3DField%2520notes%26subtitle%3DEpisode%252012%26style%3Dwave&width=430&height=900&dpi=192&waitMs=3200&css=%23ag-wave%7Bdisplay%3Anone!important%7D.ag-ph%7Bdisplay%3Ablock!important%7D&walker=1&format=svg&rasterDpi=110&dark=1&filename=ov2-phone-audiogram)

Web uygulaması ayrıca, bir veya birden çok araçta birçok satırı aynı anda render eden elektronik tablo benzeri bir ızgara olan **Batch** (`#/batch`, `shells/web/src/pro/`) ile gelir. Bkz. [Batch ve Lolly Multi-edit](/info/batch.html#make-many-versions-of-one-design). **Settings → Capabilities**, platformun yapabildiğini bildirdiği her şeyi listeler.

![Yeni bir kurulumda Batch: bir araç bekleyen tek boş satır, henüz veri gelmeden yerini almış elektronik tablo arayüzü ve Render düğmesi](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=ov2-batch-grid)

<!--i:eti-lock-->
## Mimari taahhütler

Bu kararlar kesindir. Kod tabanındaki diğer tüm kararlar bunlara bağlıdır, bu yüzden birini değiştirmek büyük bir iştir.

### 1. Gerektiğinde emirsel kod kullanma olanağıyla bildirimsel araçlar

Bir araç, bir bildirim dosyası (`tool.json`), bir şablon (`template.html`) ve isteğe bağlı `hooks.js` dosyasından oluşur. **Bildirim dosyası girdileri tanımlar**. Girdiler hiçbir zaman şablonun Handlebars token'larından çıkarılmaz. Çoğu araç yalnızca bir bildirim dosyası ve bir şablondan oluşur, böylece geliştirici olmayanlar da araç yazabilir.

![Street Map'in denetim yığını: bir şehir açılır menüsü, bir tema seçimi, kalınlık sürgüleri ve renk düğmeleri, her biri bir bildirim satırından çizilir](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-street-map-controls)

QR kodlama veya grafik oluşturma gibi değer hesaplayan araçlar kancalar ekler: çalışma zamanının yetenek köprüsünü enjekte ederek çağırdığı adlandırılmış yaşam döngüsü işlevleri. Kancalar bir taşınabilirlik sözleşmesidir, güvenlik korumalı alanı değildir. Bir süre bütçesi içinde çalışırlar. Kancalarının sayfa genel değişkenlerinden bağımsız olduğu kanıtlanan araçlar `isolate: true` taşır ve bir Worker'da çalışır. [Araç kancaları](/info/tool-hooks.html), yaşam döngüsünü ve bütçeleri içerir. [Tehdit modeli](/info/threat-model.html), sayfa içi yürütücünün neleri sınırlandırdığını ve neleri sınırlandıramadığını söyler.

### 2. Araçlar ve varlıklar paketlenmiş kod değil, veridir

Web ve Tauri uygulamaları başlangıçta araç ve varlık kataloglarını getirir, önbelleğe alır ve önbellektekilerle çalışır. Yeni bir araç veya varlık için uygulama sürümü yayımlamak gerekmez. Varlık baytları SHA-256 sağlama toplamıyla doğrulanır. Bir varlığın `id` ve `version` değerleri önbelleğin geçersiz kılınmasını belirler.

### 3. Araçların gördüğü tek API yetenek köprüsüdür

Araçlar şablonlarının dışındaki DOM'a asla dokunmaz, doğrudan `fetch` çağırmaz ve dosya sistemini okumaz. Sürümlendirilmiş `host.*` yöntemlerini çağırırlar. Sözleşme, araç yazarları için SDK olan `@lolly-tools/core` içindeki `packages/core/src/host-v1.ts` dosyasında tanımlanır. Üçüncü taraflar motora bağımlı olmadan SDK'yı kullanarak geliştirme yapabilir. `engine/src/bridge/host-v1.ts`, SDK'nın türlerini yeniden dışa aktarır.

| Gerekli API | Ne yapar |
|---|---|
| `host.profile` | Kullanıcının bilgileri; `bindToProfile` üzerinden girdileri önceden doldurur |
| `host.assets` | Katalog sorguları, varlık çözümleme ve ana makinenin seçicisi |
| `host.state` | Girdi yuvalarını kaydetme ve yükleme: web'de IndexedDB, Tauri'de dosya sistemi, CLI'de bellek |
| `host.clipboard` | Platforma özgü alternatiflerle panoya metin veya görsel yazma |
| `host.export` | Render hedefini rasterleştirme veya serileştirme ve cihazdaki dosya dönüştürme yolu |
| `host.log` | Ana makineye düzeylere göre günlük kaydı |

Diğer tüm API'ler isteğe bağlıdır ve mevcut işlevlere eklenir: `tokens`, `text`, `color`, `geom`, `pdf`, `compose`, `media`, `recorder` ve daha pek çoğu. Bildirim dosyasındaki `requires`, kancaların önceden kontrol etmeden çağırdığı isteğe bağlı API'leri listeler. Bunlardan biri eksik olan ana makine, aracı bağlamayı reddeder. Kancalar geri kalanların kullanılabilirliğini kontrol eder. `recorder` gibi bazıları ayrıca aracın bildirdiği bir cihaz yeteneğini gerektirir. `packages/core/src/host-v1/apis.ts` hepsini listeler ve [Host API](/info/host-api.html) her birini belgeler. Bir yöntem eklemek küçük sürüm değişikliğidir. Birini kaldırmak veya değiştirmek büyük sürüm değişikliğidir ve v2 yayımlandığında v1 çalışmaya devam eder.

### 4. Varlık kimlikleri kalıcıdır

`lolly/logo/primary` bir sözleşmedir. Yayımlandıktan sonra bir kimlik asla değişmez ve yeniden kullanılmaz. Baytlardaki bir değişiklik, varlık kaydındaki `version` değerini artırır. Yerine yenisi getirilen varlıkta `deprecated: true` ve isteğe bağlı olarak `replacedBy` ayarlanır. Mevcut başvurular her zaman çözümlenir, böylece kayıtlı oturumlar ve paylaşılan bağlantılar yıllarca çalışmaya devam eder.

### 5. URL modu temel bir özelliktir

Her girdi bir URL parametresi olarak ifade edilebilir, bu yüzden bir bağlantı bitmiş bir dosyadır:

```
https://lolly.tools/t/qr-code?url=https://example.com&ecl=H
```

![Bu bağlantı, içinde başka hiçbir şey olmadan tek başına bitmiş dosyadır](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Fexample.com%26ecl%3DH%26full&width=760&height=760&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-url-mode-qr)

Bir parametreyi değiştir, farklı bir dosya elde edersin. Bu palet bir başlangıç rengi, bir uyum ve bir adım sayısından oluşur:

![Dört renk tonu boyunca dokuz adım, hepsi bağlantıda taşınan tek başlangıç renginden türetilmiş](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3De0521a%26harmony%3Dtetrad-4%26steps%3D9%26full&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-url-palette)

CLI, argümanlarından aynı URL durumunu oluşturur ve aynı işlem hattını çalıştırır, böylece CLI uygulamadan farklı davranamaz. `engine/src/url-mode.ts`, URL durumunu ayrıştırır ve serileştirir. Ayrılmış adlar (`format`, `width`, `dpi`, `c2pa`, `z` ve diğerleri) hiçbir zaman araca iletilmez. [Ayrılmış URL parametreleri](/info/url-parameters.html) hepsini listeler. Varlık girdileri `id` ile taşınır ve şablon doldurulmadan önce `host.assets.get()` üzerinden çözümlenir.

### 6. Depolama köprü üzerinden yapılır

Web uygulaması IndexedDB'yi, Tauri dosya sistemini, CLI ise belleği kullanır. Araçlar yalnızca `host.state.save(slot, data)` ve `host.state.load(slot)` görür, asla `localStorage` görmez. Kullanıcılar hesap olmadan araç başına birden fazla adlandırılmış oturum tutabilir. Tek bağlantı noktası köprü olduğu için bu durum da taşınabilirdir. `shells/web/src/data-transfer.ts`, durumu başka herhangi bir kuruluma içe aktarılabilen tek bir `lolly-backup` dosyası olarak dışa aktarır ([Veri aktarımı](/info/data-transfer.html)). [Sync](/info/sync.html), aynı paketi kişinin seçtiği depolama alanına gönderir.

### 7. Olgunluk etiketleri aracın durumunu belirtir

Her araç `status: official | community | experimental` bildirir. Galeri duruma göre sıralar. Deneysel araçlar varsayılan olarak dışa aktarmalarına filigran ekler: çağıran taraf `watermark: false` iletmedikçe çalışma zamanı filigranı açar. Cihazda çalışan araçlar bundan muaftır. Ekibin kendi katalog süreci bu etiketlerin üzerine kurulur.

### 8. Girdilerin türleri bildirim dosyasında belirtilir

Bir girdi bir `type` bildirir: `text`, `longtext`, `number`, `boolean`, `color`, `select`, `asset`, `date`, `time`, `datetime-local`, `url`, `blocks`, `vector`, `table` veya `file`. Ana makine her tür için bir denetim çizer, bu yüzden araçlar denetim kodu yazmaz. Her girdi `bindToProfile` taşıyabilir. Üç tür özellikle önemlidir:

- **`asset`**, `filter` ve `allowUpload` ile varlık sistemine açılan köprüdür. `allowUpload: false`, bir yuvayı kitaplık varlıklarıyla sınırlar. Kullanıcı yüklemeleri kitaplığın `AssetRef` yapısını paylaşır.
- **`blocks`**, yan panelde düzenlenen yinelenen bir alan grubudur; Meeting Planner, Wayfinding, Diagrams ve diğer araçlarda kullanılır. Render edilmiş bir bloğa tıklamak, onun satırına odaklanır.
- **`file`**, Lolly Strip Hidden Data ve Compress gibi cihazda çalışan yardımcı araçlar için kullanıcının kendi dosyasını bellekte tutar ve **`vector`**, sabit bir sayı kümesini tek bir denetimde gruplar.

### 9. Şablonlar mantık içermez

Şablonlar Handlebars kullanır, böylece geliştirici olmayanlar da yazabilir. `{{x}}` kaçış uygular ve `{{{x}}}` açıkça tercih edilmelidir. Mantık, incelenebileceği `hooks.js` dosyasında bulunur. Birçok şablon, bir kancanın hesapladığı işaretleme için `{{{` kullanır; bu yüzden her kanca aktardığı içeriğe kaçış uygulamalıdır. Yardımcılar `default`, `upper`, `lower`, `eq`, `markdown`, `asset`, `framing` ve `media` ile eşlik eden `.ics`, `.vcf` ve `.csv` şablonları için `icsStamp`, `rfcText`, `csvCell` ve `arrow` öğeleridir. [Şablonlar ve render](/info/tool-rendering.html) bunları ele alır.

### 10. Araçlar başka araçları birleştirir

Bir araç, araçlar arasında içe aktarım yapmadan başka bir aracın render'ını gömebilir. Birleşimi motor çözümler. Bir bildirim dosyası `composes: [{ id, tool, inputs }]` bildirebilir ve alt öğeyi `{{asset <id>}}` ile yerleştirebilir. Taşınabilir bir gömme URL'si (`https://lolly.tools/tool/<id>.svg?…`) alt öğeyi yerel olarak render eder; Lolly Design canlı bir QR kodunu veya grafiği bu şekilde yerleştirir. SVG alt öğesi, SVG veya PDF üst öğesinde vektör olarak kalır. Alt öğeler ara çıktılardır ve asla filigran veya damga almaz. Bir alt öğeyi render edemeyen kabuk yuvayı boş bırakır ve üst öğe yine render edilir. [Birleştirme ve marka katmanları](/info/tool-composition.html) ayrıntıları içerir.

<!--i:eti-scissors-->
## Yapmamayı seçtiklerimiz

- **Şablonlarda keyfî JavaScript yok.** Mantık `hooks.js` dosyasında bulunur.
- **Zorunlu varlık sunucusu yok.** Kullanıcılar kendi dosyalarını uygulamadaki Assets'e ekler ve işi bir oturum olarak devreder: girdiler ve ayarlar için bir paylaşım bağlantısı, yüklemeler de taşınacaksa bir `.lolly` dosyası. Paylaşılan bir oturum, aracın seçicisinde şablona dönüşebilir. Yönetilen bir katalog isteyen kuruluş, Lolly Work'ün kataloğunu, onaylarını ve politikalarını kullanabilir ya da marka paketini git içinde yönetip değişiklikleri orada inceleyebilir.
- **Zorunlu erişim kontrolü yok.** Açık uygulama varsayılan olarak herkese açıktır. Marka riskini olgunluk etiketleri ve filigranlar yansıtır. Kuruluş oturum açma işlevi, roller ve politika, ekip bunları istediğinde Lolly Work'ten gelir.
- **Merkezî veritabanı yok.** Kullanıcı durumu her cihazda tutulur ve isteğe bağlı Sync bunu kişinin seçtiği depolama alanına kopyalar, asla bir Lolly veritabanına kopyalamaz.
- **Araçlar ile motor arasında ortak kod yolu yok.** Motor ve topluluk araçları açık kaynaklıdır. Özel `brands/suse/` gibi bir marka paketi, kendi araçlarını ve kataloğunu kendi koşulları altında taşır. Hiçbir araç `engine/` içinden içe aktarım yapmaz, böylece ayrım net kalır.

<!--i:eti-refresh-->
## Bir render'ın yaşam döngüsü

Biri `https://lolly.tools/t/qr-code?url=https://example.com&ecl=H` adresini açar:

1. **Başlatma.** Web uygulaması IndexedDB'yi açar, yetenek köprüsünü oluşturur ve araç ile varlık kataloglarını eşitler ya da çevrimdışıyken bunları önbellekten yükler.
2. **Yönlendirme.** Yol, başlangıç değerleri olarak sorguyu kullanarak `qr-code` için araç görünümünü seçer.
3. **Yükleme.** `loadTool`, `tool.json` dosyasını getirir, şemaya göre doğrular ve şablonu, stilleri ve kancaları getirir.
4. **Bağlantıyı ayrıştırma.** `parseUrlState`, parametreleri girdi değerlerine dönüştürür. `?logo=lolly/logo/primary` gibi bir varlık başvurusu, çözümlenmemiş bir `{ id }` olur.
5. **Çalışma zamanını başlatma.** `createRuntime(tool, host, initialValues)`, profil verilerinden, varsayılanlardan ve bağlantıdan girdi modelini oluşturur, varlık başvurularını çözümler, kancaları yükler ve `onInit` çağırır.
6. **Render.** Kabuk çalışma zamanına abone olur, modelden denetimleri çizer ve doldurulmuş şablonu `#tool-canvas` içine yazar.
7. **Etkileşim.** Yazmak, kısıtları uygulayan, `onInput` çağıran, şablonu yeniden dolduran ve yeniden çizen `runtime.setInput` yöntemini çağırır.
8. **Dışa aktarma.** **Download**, `runtime.export(node, format)` çağırır ve kabuğun `host.export` yöntemi dosyayı üretir: raster, DOM gezgininden bir vektör, PDF, belge veya `schemas/tool.schema.json` içindeki diğer biçimlerden biri. Fiziksel birimler biçime göre dönüştürülür. Biçimin desteklediği yerlerde meta veriler ve Content Credentials gömülür. Deneysel araçlar filigranlarını araçtan değil, ana makineden alır. [Şablonlar ve render](/info/tool-rendering.html) ve [Dosya dışa aktar](/info/exporting.html), dışa aktarma adımını ele alır.

![?options ile açılan dışa aktarma paneli: dosya adı ve biçim çifti, çıktı boyutu ve dosyayı yazan denetimler](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=aud-export-popup)

Aynı yaşam döngüsü Tauri'de ve başsız bir DOM ile CLI'de çalışır; CLI'de çıktı bir dosyaya veya stdout'a gider.

<!--i:eti-stamp-->
## Lisanslar

`engine/`, `shells/`, `services/`, `schemas/` ve belge üreticisi dahil kod, tek bir herkese açık depo olan [`lolly-tools/lolly`](https://github.com/lolly-tools/lolly) içinde MPL-2.0 lisanslıdır. Belge metinleri CC BY-SA 4.0 lisanslıdır. Marka paketleri kendi koşullarını her paketin `NOTICE.md` dosyasında taşır: topluluk araçları MPL-2.0 lisanslıdır ve özel SUSE paketi SUSE'ye ait tescilli yazılımdır. [Hakkında](/info/about.html) sayfası lisans notunun tamamını içerir.
