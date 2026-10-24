# Lolly mimarisi

![Lolly Simgesi - Büyük yeşil ve beyaz lolipop şeker](/info/icon.svg)

Bu sayfa Lolly'nin kodunu değiştiren kişiler içindir: motorun, kabukların ve araç paketlerinin nasıl bir araya geldiği, her birinin depoda nerede durduğu ve her değişikliği kısıtlayan taahhütler. Lolly'nin ne yaptığını ve onu kimlerin kullandığını bilmek istiyorsan önce [How Lolly works](/info/how-lolly-works.html) sayfasını oku.

İki yardımcı kaynak daha derine iner. [`engine/README.md`](../engine/README.md), koddan üretilen, modül modül motor haritasıdır. [Threat Model & Trust Boundaries](/info/threat-model.html) aynı mimariyi güven sınırları olarak okur ve motorun neyi güvenilmez saydığıyla ilgili her soru için doğru sayfadır.

## Genel resim

Araçlar en üstte veridir. Ortadaki motor hiçbir platform hakkında bir şey bilmez. En alttaki kabuklar tek bir sözleşmeyi uygular ve kataloglar içeriği sağlar.

![Araçlar paylaşılan motora bir bildirim, bir şablon ve kancalar sağlar. Web, Tauri ve terminal kabukları HostV1 yetenek köprüsünü uygular ve araçları ile varlıkları kataloglardan okur.](/info/diagrams/concepts/platform-layers.svg)

Onu saf veri ve Handlebars ile tarif edebiliyorsan **motora** aittir. DOM'a, dosya sistemine, ağa ya da herhangi bir tarayıcı veya işletim sistemi API'sine dokunuyorsa **ana bilgisayara (host)**, yani köprünün kabuk tarafına aittir. Motor açık kaynaktır ve belirli bir markayı veya platformu bilen hiçbir şey motora girmez.

## Depo yapısı

Lolly tek bir depodur. Aşağıdaki her dizin, SUSE araç paketini ve kataloğunu tutan, herkese açık bir klonun getirmediği **özel** bir git alt modülü olan `brands/suse` dışında, içinde düz bir dizindir. Bir derlemenin hangi paketleri okuduğu bir içerik profilidir (`profiles.json`) ve küresel olarak değiştirilmek yerine süreç başına çözülür. [Build Guide](/info/build-guide.html) klonlama komutunu ve özel paket içindeki bir değişikliğin nasıl işlendiğini içerir.

| Dizin | Neyi tutar |
|---|---|
| `engine/` | Platformdan bağımsız çekirdek: yükleyici, çalışma zamanı, girdiler, şablonlar, URL modu, birimler ve biçim modülleri |
| `shells/` | Web uygulaması, Tauri masaüstü ve mobil uygulamaları, CLI, TUI ve tarayıcı uzantısı |
| `packages/` | Araç yazarı SDK'sı (`@lolly-tools/core`), paylaşılan Node kabuk parçaları ve belge oluşturucusu, diğerleri arasında |
| `community/` | Markadan bağımsız araçlar ve paylaşılan emoji paketleri |
| `brands/` | Marka paketleri: `lolly-demo` (Lolly Demo, lolly.tools'un çalıştırdığı tasarım sistemi), `lolly-start` (boş başlangıç) ve özel `suse` |
| `services/` | İsteğe bağlı MCP, sertifika ve Penpot hizmetleri ve paylaştıkları sunucu kodu |
| `schemas/` | Araç bildirimleri, varlık girişleri ve varlık başvuruları için JSON Schema |
| `scripts/`, `tests/`, `docs/`, `api/` | Derleme ve katalog betikleri, motor test paketi, bu belgeler ve üretilmiş sunucusuz paketler |

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

Depo kökünde `tools/` veya `catalog/` dizini yoktur. `packages/node-shell/src/content-roots.ts`, "`<id>` aracı nerede yaşıyor" ve "katalog nerede" sorularını, sorulduğunda `profiles.json` üzerinden yanıtlar. Gerçek bir `tools/` ve `catalog/` çifti yalnızca `dist/`, bir RPM yükü veya bir kapsayıcı imajı gibi bir derleme çıktısına yazılır; çünkü bir tarayıcı bu iki yolu HTTP üzerinden getirir.

## Lolly nerede çalışır

Her yüzey aynı motoru ve aynı araç dosyalarını kullanır.

- **Web uygulaması.** Hizmet çalışanı araçları ve varlıkları önbelleğe aldıktan sonra çevrimdışı çalışan bir aşamalı web uygulaması. Hesap gerektirmez; durum her cihazda IndexedDB içinde yaşar. Tek bir duyarlı düzen masaüstüne ve telefona hizmet eder: telefonda denetimler bir sayfa olur ve dışa aktarma denetimleri yüzen bir hapdan açılır.
- **Masaüstü ve mobil uygulamalar.** Aynı web uygulamasının, yerel dosya iletişim kutuları, dosya sistemi durumu ve tam çevrimdışı kullanımla Tauri paketleri.
- **CLI.** `lolly <tool-id> --input=value --output=file.png` aynı motoru arayüzsüz bir DOM'da yükler ve dosyayı yazar. Ayrı bir uygulama değil, farklı bir aktarım üzerinden URL modudur. Bkz. [CLI](/info/cli.html).
- **TUI.** CLI'nin köprüsünü yeniden kullanan, tam ekran, önce klavye odaklı bir terminal uygulaması; kayıtlı oturumları diskte tutar (uygulama kuruluysa masaüstü uygulamasının kendi klasöründe, aksi hâlde `~/.lolly` altında) ve arayüzsüz tarayıcıyı yalnızca bir biçim gerektirdiğinde sınırlı kapsamla başlatır. Bkz. [TUI](/info/tui.html).

![Masaüstü bölünmüş görünümü: solda bildirimden üretilen denetimler, sağda canlı tuval](/t/url-shot?url=%2F%23%2Ftool%2Fchart&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&filename=aud-web-split)

Aynı araç telefon genişliğinde ikinci bir düzen gerektirmez: denetimler üstte bir sayfa olur ve önizleme ekranı tutar.

![430 piksel genişliğinde bir ekranda bir audiogram: üstte denetim sayfası, altta bitmiş kare çalışma ve yüzen dışa aktarma hapı](/t/url-shot?url=%2F%23%2Ftool%2Faudiogram%3Faudio%3Dlolly%2Floops%2Ffireplace-loop%26title%3DField%2520notes%26subtitle%3DEpisode%252012%26style%3Dwave&width=430&height=900&dpi=192&waitMs=3200&css=%23ag-wave%7Bdisplay%3Anone!important%7D.ag-ph%7Bdisplay%3Ablock!important%7D&walker=1&format=svg&rasterDpi=110&dark=1&filename=ov2-phone-audiogram)

Web uygulaması ayrıca **Batch** ile (`#/batch`, `shells/web/src/pro/`) gelir; bir veya birçok araç boyunca aynı anda birçok satırı render eden elektronik tablo tarzı bir ızgara; Batch'i [Batch and Multi-edit](/info/batch.html#make-many-versions-of-one-design) kapsar. **Settings → Capabilities**, platformun yapabildiğini bildirdiği her şeyi haritalar.

![Yeni kurulumda Batch: bir araç bekleyen tek boş satır; veri gelmeden önce elektronik tablo yüzeyi ve Render düğmesi yerinde](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=ov2-batch-grid)

## Mimari taahhütler

Bu kararlar yerleşiktir. Herhangi birini değiştirmek büyük bir iştir, çünkü kod tabanındaki diğer her kararı şekillendirirler.

### 1. Deklaratif araçlar, buyurgan bir kaçış kapısıyla

Bir araç bir bildirim (`tool.json`), bir şablon (`template.html`) ve isteğe bağlı `hooks.js` dosyasıdır. **Girdileri bildirim bildirir**, asla şablon değil: girdiler Handlebars belirteçlerinden çıkarılmaz. Araçların çoğu yalnızca bildirim ve şablondur; geliştirici olmayanların onları yazabilmesini sağlayan budur.

![Street Map'in denetim yığını: bir şehir açılır menüsü, bir tema seçimi, ağırlık sürgüleri ve renk tetikleyicileri; hepsi bir bildirim satırından çizilir](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-street-map-controls)

QR kodlama veya grafik şekillendirme gibi değer hesaplayan araçlar kancalar ekler: çalışma zamanının yetenek köprüsü enjekte edilerek çağırdığı adlandırılmış yaşam döngüsü işlevleri. Kancalar bir taşınabilirlik sözleşmesidir, güvenlik sanal alanı değil ve bir zaman bütçesi içinde çalışırlar. Kancaları sayfa globallerinden arınmış olduğu kanıtlanan araçlar `isolate: true` taşır ve bir Worker içinde çalışır. [Tool hooks](/info/tool-hooks.html) yaşam döngüsünü ve bütçeleri içerir; [Threat Model](/info/threat-model.html) sayfa içi yürütücünün neyi içerip neyi içermediğini söyler.

### 2. Araçlar ve varlıklar veridir, paketlenmiş kod değil

Web ve Tauri uygulamaları araç ve varlık kataloglarını açılışta getirir, önbelleğe alır ve orada ne varsa onunla çalışır; bu yüzden yeni bir araç veya varlık için uygulama sürümü gerekmez. Varlık baytları SHA-256 sağlama toplamlıdır ve bir varlığın `id` ve `version` değerleri önbellek geçersiz kılmayı yönetir.

### 3. Araçların gördüğü tek API yetenek köprüsüdür

Araçlar şablonlarının dışında DOM'a asla dokunmaz, `fetch`'i doğrudan asla çağırmaz ve dosya sistemini asla okumaz. Sürümlü `host.*` yöntemlerini çağırırlar. Sözleşmenin kurallı tanımı, araç yazarı SDK'sı `@lolly-tools/core` içindeki `packages/core/src/host-v1.ts` dosyasıdır; böylece üçüncü bir taraf motora bağımlı olmadan onun üzerine kurabilir; `engine/src/bridge/host-v1.ts` türlerini yeniden dışa aktarır.

| Gerekli API | Ne yapar |
|---|---|
| `host.profile` | Kullanıcının ayrıntıları; `bindToProfile` ile girdileri önceden doldurur |
| `host.assets` | Katalog sorguları, varlık çözümleme ve ana bilgisayarın seçicisi |
| `host.state` | Girdi yuvalarını kaydet ve yükle: web'de IndexedDB, Tauri'de dosya sistemi, CLI'de bellek |
| `host.clipboard` | Panoya metin veya görsel yaz, platform yedekleriyle |
| `host.export` | Render hedefini rasterleştir veya serileştir ve cihaz üzerindeki dosya dönüştürme yolu |
| `host.log` | Ana bilgisayara düzeyli günlükleme |

Diğer her API isteğe bağlı ve ekleyicidir: `tokens`, `text`, `color`, `geom`, `pdf`, `compose`, `media`, `recorder` ve çok daha fazlası. Bir aracın bildirimi, kancalarının önce denetlemeden çağırdığı isteğe bağlı API'leri `requires` altında listeler ve birinden yoksun bir ana bilgisayar aracı bağlamayı reddeder; kancalar geri kalanı özellik algılamayla bulur. `recorder` gibi birkaçı ayrıca aracın bildirdiği bir cihaz yeteneği gerektirir. `packages/core/src/host-v1/apis.ts` hepsini listeler ve [Host API](/info/host-api.html) her birini belgelendirir. Bir yöntem eklemek küçük bir sürümdür; birini kaldırmak veya değiştirmek büyük bir sürümdür ve v2 yayımlandığında v1 çalışmaya devam eder.

### 4. Varlık kimlikleri sonsuza dek geçerlidir

`lolly/logo/primary` bir sözleşmedir. Yayımlandıktan sonra bir kimlik asla değişmez ve asla yeniden kullanılmaz. Bir bayt değişikliği varlık girişindeki `version` değerini artırır ve bir yedek `deprecated: true` ve isteğe bağlı olarak `replacedBy` ayarlar; böylece mevcut başvurular her zaman çözümlenir. Kayıtlı oturumları ve paylaşılan bağlantıları yıllarca çalışır tutan budur.

### 5. URL modu birinci sınıftır

Her girdi bir URL parametresi olarak ifade edilebilir, yani bir bağlantı bitmiş bir dosyadır:

```
https://lolly.tools/t/qr-code?url=https://example.com&ecl=H
```

![İçinde başka hiçbir şey olmayan o bağlantının kendisi bitmiş dosyadır](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Fexample.com%26ecl%3DH%26full&width=760&height=760&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-url-mode-qr)

Bir parametreyi değiştir ve farklı bir dosyan olur. Bu paletin tamamı bir tohum rengi, bir uyum ve bir adım sayısıdır:

![Bağlantıdaki tek bir tohum renkten türeyen, dört renk tonunda dokuz adım](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3De0521a%26harmony%3Dtetrad-4%26steps%3D9%26full&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-url-palette)

CLI aynı URL durumunu argümanlarından kurar ve aynı işlem hattını çalıştırır; bu yüzden CLI uygulamadan sapamaz. `engine/src/url-mode.ts` ayrıştırır ve serileştirir; ayrılmış adlar kümesi (`format`, `width`, `dpi`, `c2pa`, `z` ve diğerleri) bir araca asla geçirilmez ve [Reserved URL parameters](/info/url-parameters.html) hepsini listeler. Varlık girdileri `id` ile taşınır ve şablon dolmadan önce `host.assets.get()` ile çözülür.

### 6. Depolama köprüden geçer

Web uygulaması IndexedDB, Tauri dosya sistemi ve CLI bellek kullanır. Araçlar yalnızca `host.state.save(slot, data)` ve `host.state.load(slot)` görür, asla `localStorage` değil. İnsanlar hesap olmadan araç başına birkaç adlandırılmış oturum tutabilir. Köprü tek dikiş olduğu için o durum taşınabilirdir de: `shells/web/src/data-transfer.ts` onu başka her kurulumda içe aktarılan tek bir `lolly-backup` dosyasına geri okur ([Data transfer](/info/data-transfer.html)) ve [Sync](/info/sync.html) aynı paketi kişinin seçtiği depolamaya gönderir.

### 7. Olgunluk etiketleri bir aracın ne olduğunu söyler

Her araç `status: official | community | experimental` bildirir. Galeri duruma göre sıralar ve deneysel araçlar dışa aktarmalarını varsayılan olarak filigranlar: çağıran `watermark: false` vermedikçe çalışma zamanı filigranı açar ve cihaz üzerindeki araçlar muaftır. Bir ekibin kataloğun etrafına koyduğu her süreç bunun üstünde yer alır.

### 8. Girdiler bildirimde türlendirilir

Bir girdi bir `type` bildirir: `text`, `longtext`, `number`, `boolean`, `color`, `select`, `asset`, `date`, `time`, `datetime-local`, `url`, `blocks`, `vector`, `table` veya `file`. Ana bilgisayar tür başına bir denetim render eder, bu yüzden araçlar denetim kodu yazmaz ve her girdi `bindToProfile` taşıyabilir. Üçü en çok ağırlık taşır:

- **`asset`**, `filter` ve `allowUpload` ile, varlık sistemine açılan köprüdür. `allowUpload: false` bir yuvayı kitaplık varlıklarıyla sınırlar ve kullanıcı yüklemeleri kitaplığın `AssetRef` biçimini paylaşır.
- **`blocks`**, bir yan panelde düzenlenen, Meeting Planner, Wayfinding, Diagrams ve diğerleri tarafından kullanılan yinelenen bir alan grubudur. Render edilmiş bir bloğa tıklamak satırına odaklanır.
- **`file`**, Strip Hidden Data ve Compress gibi cihaz üzerindeki yardımcı araçlar için kullanıcının kendi dosyasını bellekte tutar ve **`vector`** sabit bir sayı kümesini tek bir denetimde gruplar.

### 9. Şablonlar mantıksızdır

Şablonlar, geliştirici olmayanların yazabilmesi için seçilmiş Handlebars'tır: `{{x}}` kaçırır ve `{{{x}}}` açık bir tercihtir. Mantık, açık ve gözden geçirilebilir olduğu `hooks.js` içinde yaşar. Birçok şablon bir kancanın hesapladığı işaretleme için `{{{` kullanır; bu yüzden her kanca teslim ettiğini kaçırmalıdır. Yardımcılar `default`, `upper`, `lower`, `eq`, `markdown`, `asset`, `framing` ve `media` ile kardeş `.ics`, `.vcf` ve `.csv` şablonları için `icsStamp`, `rfcText`, `csvCell` ve `arrow`'dur. [Templates and rendering](/info/tool-rendering.html) bunları kapsar.

### 10. Araçlar araçları bileştirir

Bir araç, araçtan araca içe aktarma olmadan başka bir aracın render'ını gömebilir; kompozisyonu motor çözer. Bir bildirim `composes: [{ id, tool, inputs }]` bildirebilir ve çocuğu `{{asset <id>}}` ile yerleştirebilir; taşınabilir bir gömme URL'si (`https://lolly.tools/tool/<id>.svg?…`) çocuğu yerelde render eder; Design'ın canlı bir QR kodu veya grafik yerleştirme biçimi budur. Bir SVG çocuğu, bir SVG veya PDF ebeveyninde vektör kalır. Çocuklar ara ürünlerdir, asla filigranlanmaz veya damgalanmaz ve birini render edemeyen bir kabuk, ebeveyn yine render edilirken yuvayı boş bırakır. [Composition and brand overlays](/info/tool-composition.html) ayrıntıları içerir.

## Yapmamayı seçtiklerimiz

- **Şablonlarda keyfi JavaScript yok.** Mantık `hooks.js` içinde yaşar.
- **Zorunlu varlık sunucusu yok.** İnsanlar uygulamadaki Assets'e kendi dosyalarını ekler ve işi bir oturum olarak devreder: girdiler ve ayarlar için bir paylaşım bağlantısı, yüklemeler de gittiğinde bir `.lolly` dosyası. Paylaşılan bir oturum, bir aracın seçicisinde şablon olabilir. Yönetilen bir katalog isteyen bir kuruluş Lolly Work'ün kataloğunu, onaylarını ve politikalarını kullanabilir ya da marka paketini git'te yönetip değişiklikleri orada inceleyebilir.
- **Zorunlu erişim denetimi yok.** Açık uygulama varsayılan olarak herkese açıktır ve olgunluk etiketleri ile filigranlar marka riskini taşır. Kuruluş girişi, roller ve politika, bir ekip istediğinde Lolly Work'ten gelir.
- **Merkezi veritabanı yok.** Kullanıcı durumu her cihazda yaşar ve isteğe bağlı Sync onu kişinin seçtiği depolamaya kopyalar, asla bir Lolly veritabanına değil.
- **Araçlar ve motor arasında paylaşılan kod yolu yok.** Motor ve topluluk araçları açık kaynaktır ve özel `brands/suse/` gibi bir marka paketi kendi araçlarını ve kataloğunu kendi koşulları altında taşır. Hiçbir araç `engine/` içinden içe aktarmaz, bu yüzden bölünme temiz kalır.

## Bir render'ın yaşam döngüsü

Biri `https://lolly.tools/t/qr-code?url=https://example.com&ecl=H` adresini açar:

1. **Önyükleme.** Web uygulaması IndexedDB'yi açar, yetenek köprüsünü kurar ve araç ile varlık kataloglarını eşitler ya da çevrimdışıyken önbellekten yükler.
2. **Rota.** Yol, `qr-code` için araç görünümünü seçer; sorgu ilk değerleridir.
3. **Yükle.** `loadTool` `tool.json` dosyasını getirir, şemaya göre doğrular ve şablonu, stilleri ve kancaları getirir.
4. **Bağlantıyı ayrıştır.** `parseUrlState` parametreleri girdi değerlerine çevirir. `?logo=lolly/logo/primary` gibi bir varlık başvurusu çözülmemiş bir `{ id }` olur.
5. **Çalışma zamanını başlat.** `createRuntime(tool, host, initialValues)` girdi modelini profil verisi, varsayılanlar ve bağlantıdan kurar, varlık başvurularını çözer, kancaları yükler ve `onInit` çağırır.
6. **Render.** Kabuk çalışma zamanına abone olur, denetimleri modelden çizer ve doldurulmuş şablonu `#tool-canvas` içine yazar.
7. **Etkileşim.** Yazmak `runtime.setInput` çağırır; o da kısıtları uygular, `onInput` çağırır, şablonu yeniden doldurur ve yeniden çizer.
8. **Dışa aktar.** **Download**, `runtime.export(node, format)` çağırır ve kabuğun `host.export` değeri dosyayı üretir: bir raster, DOM yürüteçten bir vektör, bir PDF, bir belge veya `schemas/tool.schema.json` içindeki diğer biçimlerden biri. Fiziksel birimler biçim başına dönüştürülür ve meta veriler ile Content Credentials, biçimin tutabildiği yerde gömülür. Deneysel araçlar filigranlarını araçtan değil ana bilgisayardan alır. Dışa aktarma adımını [Templates and rendering](/info/tool-rendering.html) ve [Export a file](/info/exporting.html) kapsar.

![?options'ın açtığı dışa aktarma paneli: dosya adı ve biçim çifti, çıktı boyutu ve dosyayı yazan denetimler](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=aud-export-popup)

Aynı yaşam döngüsü Tauri'de ve çıktının bir dosyaya veya stdout'a gittiği arayüzsüz bir DOM'lu CLI'de çalışır.

## Lisanslar

`engine/`, `shells/`, `services/`, `schemas/` ve belge oluşturucusu dahil kod, tek bir herkese açık depoda, [`lolly-tools/lolly`](https://github.com/lolly-tools/lolly), MPL-2.0'dır. Belgeleme metni CC BY-SA 4.0'dır. Marka paketleri kendi koşullarını her paketin `NOTICE.md` dosyasında taşır: topluluk araçları MPL-2.0'dır ve özel SUSE paketi SUSE'ye özgü mülkiyettedir. [About](/info/about.html) tam lisans notunu içerir.
