# Genel Bakış

![Lolly Simgesi - Büyük yeşil ve beyaz lolipop şeker](/info/icon.svg)

Bu belge, Lolly platformunun amacını, yapısını ve mimari kararlarını kayıt altına alır. Hem ürün vizyonunu hem de kod tabanının mevcut durumunu yansıtır.

> **Durum:** Lolly, **tamamlanmamış kapalı bir pilot** aşamasındaki bir dahili prototiptir. Motor deterministik ve dahili olarak tutarlıdır, ancak ürün henüz erken aşamadadır - SUSE bir numaralı müşteridir - ve kriptografi ile dosya ayrıştırma motorları şu anda SUSE'nin katı altyapı sağlamlaştırma sürecinden geçmektedir, kurumsal ölçeğe hazırlanmaktadır (bu konuda gerçekten iyiyiz). Aşağıdaki mimariyi bitmiş, sertifikalı bir ürün olarak değil, test altındaki tasarım niyeti olarak oku. Pilotun nasıl yürütüldüğü ve ölçüldüğü için bkz. [Benimseme ve Yönetişim](/info/adoption-governance.html#status).

> **Bu sayfa nasıl okunur.** İki tür içerik taşır, sırayla. İlk yarısı
> **bunun neden var olduğu**dur: sorun, konumlandırma ve tek bir varlığın geçtiği yaşam döngüsü.
> [Büyük resim](#the-big-picture-how-the-layers-fit) bölümünden itibaren ise
> **katmanların nasıl bir araya geldiği**dir: motor/kabuk/paket ayrımını, depo düzenini, teslimat
> hedeflerini ve platforma yapılan her değişikliği kısıtlayan taahhütleri kapsayan, katkıda
> bulunanlar için mimari belgedir. Eğer buraya ürünü anlamak için değil de kod tabanını
> değiştirmek için geldiysen, büyük resimden başla.
>
> Bu sayfadan daha derine giden iki tamamlayıcı belge var. Depodaki
> [`engine/README.md`](../engine/README.md), motorun modül modül haritasıdır; her modülün ne
> ayrıştırdığı veya yazdığını gösteren üretilmiş bir tablo içerir. [Tehdit Modeli ve Güven Sınırları](/info/threat-model.html)
> aynı mimarinin güven sınırları olarak okunmuş halidir ve motorun neyi güvenilmez saydığına dair
> her sorunun doğru sayfasıdır.

---

## Bunun neden var olduğu

Ekipler tekrar eden bir sorunla karşılaşır: her seferinde yetenekli ellere ihtiyaç duyulmayacak kadar öngörülebilir, ama korkuluklar olmadan devredilemeyecek kadar kalite hassasiyeti yüksek, tekrarlanabilir yaratıcı ve içerik işleri. Sonuç ya yavaş verimdir (uzman darboğazı), ya tutarsızlıktır (insanların ellerindeki her aracı kullanması) ya da satıcı bağımlılığıdır (şablonlarını kontrol eden bir SaaS DAM).

Bu platform bunun doğrudan cevabıdır:

> **Ölçekte programatik yaratıcılık ve içerik** - kuralların merkezi kontrol altında olduğu, çalışanlar, tedarikçiler ve iş ortakları için sıfır emekle varlık üretimi.

Lolly bir tasarım sisteminin icat edildiği yer değil - üretildiği yerdir. Onu tasarım için bir otomat gibi düşün: bir seçim yap, bir sonuç al. Her seferinde. Motor, önündeki donanımın her biçimde üretebileceği en yüksek kaliteyi hedefler ve aynı motor, dağıtıldığı her yüzeyde aynı dosyayı üretir.

Sonuç **bolluktur**: her etkinliğin doğru tabelası vardır, her CVE uyarısı kurumsal stille eşleşir, her etiket temiz basılır, her e-posta imzası günceldir - hepsi bir tasarım talebi olmadan. Platform, tekrar eden, operasyonelleştirilmiş yaratıcı işleri yönetir. Bilinçli olarak özel bir yaratıcı araç değildir - tasarımcılar amiral gemisi işleri hâlâ kendi ellerinde tutar.

### Olasılıksal olarak yenilik yap, deterministik olarak ölçeklendir

Yaratıcı bir iş akışında yapay zeka hakkındaki her tartışma aynı soruda tıkanır: bunun hangi kısmı makinenin işi? Bu, cevabı çoktan verilmiş eski bir sorudur. Yazıcılar ve tezhipçiler zaten iki araç arasında çalışıyordu - hiçbir şeyin sabit olmadığı, her şeyin denenebildiği gevşek eskiz ve tam da bir taahhütte bulunduğu için ürkütücü olan baskı makinesi. Sanat, eskizlerde gerçekleşiyordu. Baskı ise onu herkese ulaştıran araçtı. Kimse ikisini birbirine karıştırmadı ve ikisi de ilerlemeye devam etti - yeni mürekkepler, yeni yazı karakterleri, yeni baskı makineleri - her biri, hizmet ettiği zanaat ve niyetle uyum içinde gelişerek.

Lolly aynı çizgiyi çizer. Olasılıksal olarak keşfet: bir model, bir tasarımcı, kaba bir fikir, kimsenin planlamadığı bir yere giden bir prompt. Sonra deterministik olarak ölçeklendir - on bin çıktıya ulaşan şey bir *araçtır* ve bir araç, okuyabildiğin girdilerden her seferinde aynı şekilde render edilir. Keşif özgür kalır, çünkü aşağı akıştaki hiçbir şey onun iki kez aynı şekilde sonuçlanmasına bağlı değildir. Çıktı güven kazanır, çünkü bir tahmin değildir. Yapay zeka deneyselliğini öngörülebilir, yeniden üretilebilir sonuçlara dönüştürmek yeni bir disiplin değildir; basılı işi baştan güvenilir kılan iş bölümünün ta kendisidir.

> Yaratıcı sürece güven, titizlikle ölçeklendir.

### Alternatiflere karşı

::: figure positioning-comparison
Ağustos 2026'da araştırılan, günümüzün yaratıcı araçları arasındaki yetenek eksiksizliği. Puanlama: 0 yok, 25 iş bitirici düzey, 50 gerçek ama kısıtlı veya kısmi, 75 çekincelerle güçlü, 100 temel yetkinlik.
:::

Aradaki fark açık: bugün piyasaya sürülen hiçbir şey bize kısıtlar öncelikli, çevrimdışı çalışabilen, düşük beceri gerektiren, dahili olarak erişilebilir bir çıktı vermiyor. Lolly, renklerin, tipografinin ve varlıkların marka geneline uyduğu açık bir tuval bile içerir - **Design** - böylece serbest düzenleme kısıtlar öncelikli kalır. **Olmadığı** şey kısıtsız bir tasarım paketidir: tasarımcılar özel amiral gemisi işleri için Illustrator ve Figma kullanmaya devam eder. Permütasyonlar bu araçla bir araya getirilebilir.

![Kütüphanedeki her araç birer kart olarak, kategoriye göre gruplanmış, böylece bir üretici birini seçip başlayabilir](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%2C.brand-tips%7Bdisplay%3Anone!important%7D&tolerance=0.03&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=aud-gallery-landscape)

**Şunun için kullan:** Operasyonelleştirilmiş yaratıcı varlıkların hızlı üretimi - etkinlik döşemeleri, isim kartları, imzalar, CVE uyarıları, QR kodları, sosyal medya kartları, sevkiyat etiketleri, yapılandırılmış raporlar.

**Şunun için kullanma:** Özel amiral gemisi içerik.

---

## Bir kampanyanın yaşam döngüsü

Lolly'nin ne olduğunu görmenin en net yolu bir özellik listesi değil - tek bir varlığın elden ele geçişini takip etmektir. Yerelleştirilmiş bir kampanya kartının kuruluş içinde nasıl ilerlediğini izle:

1. **Yaratıcı kuralları belirler.** Bir tasarımcı, markanın tipografi ve renk değişkenlerini sabit kodlayarak Design aracında temel şablonu oluşturur. Tek bir kart yapmıyorlar - bunu bir daha asla elle yerelleştirmek zorunda kalmamak için *bir kez* temel işi yapıyorlar.
2. **Geliştirici onu ölçeklendirir.** Aynı şablon, CLI aracılığıyla gece çalışan bir hatta bağlanır, böylece yeni bir grafik veya yeni bir dil varyantı otomatik olarak üretilir - hiçbir tasarımcı dosyayı yeniden açmaz.
3. **Üretici onu sadece kullanır.** Bir uçakta çevrimdışı olan bir satış temsilcisi aynı aracı açar ve bir müşteri toplantısı için markaya tamamen uygun bir sunum üretir. Tasarım becerisi yok, ağ bağlantısı yok, bekleme yok.

İkinci adımdaki "yeni grafik", kimsenin bir tasarım dosyası açmadan, bir veri dizesi ve bir avuç parametreden üretilen, tam olarak buna benzer bir render'dır:

![Başlıklı yığılmış bir alan grafiği; üç serisi soğuk bir palette bantlanmış, eksenler, açıklama ve başlık hepsi elle değil şablon tarafından yerleştirilmiş](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3FchartType%3Darea%26stackMode%3Dstacked%26palette%3Dcool%26heading%3DProduct%2520mix%2520by%2520quarter%26full&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-lifecycle-chart)

Mesele Lolly'nin tasarımcılar için iyi *ve* geliştiriciler için iyi *ve* satış için iyi olması değil, her biri kendi başına. Bu bir **bayrak yarışı**: yaratıcının ilk işi geliştirici tarafından ölçeklendirilir, bu da üreticiyi güçlendirir. Uçaktaki teknik olmayan temsilci için zahmetsiz deneyim, ancak tasarımcının belirlediği ve geliştiricinin devreye aldığı titizlik sayesinde *mümkündür*.

İşte güç çarpanı bu. Lolly, ayrı roller için ayrı araçların bulunduğu bir çekmece değildir - her rolün dokunduğu tek bir deterministik varlık yaşam döngüsüdür ve geçtiği her el, bir öncekinin değerini katlar.

---

## Bir onay, on bin varlık

Onay dosyada değil araçta yaşadığı için (bkz. [Lolly nasıl karşılaştırılır](/info/positioning.html)), ölçek bir inceleme sorunu olmaktan çıkar. Yerelleştirilmiş bir sosyal medya kartı aracını bir kez onayla, ardından bir e-tablodan **12 dilde 10.000 varlık** üret - ve hiçbiri hukuk veya markadan yeni bir uyum kontrolü gerektirmez, çünkü hepsinin geldiği şablon zaten onaylanmıştı.

Aynı deterministik araç bu ölçeğe üç yoldan ulaşır, hepsi aynı, önceden onaylanmış çıktıyı üretir:

- <!--i:people--> **Uygulamada bir kişi.** `/pro` toplu ızgarası: satırları yapıştır veya içe aktar, satır başına bir bitmiş varlık al, zip'i indir. Tasarım becerisi yok, talep yok, bekleme yok.
- <!--i:code--> **Komut satırından bir geliştirici.** CLI, *aynı* motoru ve *aynı* render yolunu başsız çalıştırır, böylece araç bir betikte veya gece çalışan bir hatta 10.000 satırın tamamı üzerinde sıralanabilir. Bir döngüde bir `lolly <tool> --field=…` çağrısı bütün entegrasyondur.
- <!--i:cpu--> **MCP üzerinden bir sistem veya bir yapay zeka ajanı.** Aynı araç, aynı doğrulukla ve daha da büyük ölçekte programatik olarak çalıştırılır - çünkü binlerce dosya gelirken bir makine sıkılmaz.

![Yeni bir kurulumda toplu mod: bir araç bekleyen boş bir satır, henüz hiçbir veri gelmeden yerinde duran tüm hesap tablosu yüzeyi ve Render düğmesiyle birlikte](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=ov2-batch-grid)

Bir tasarımcı tarafından bir kez sabitlenmiş tek bir marka kısıtları kümesi; aynı önceden onaylanmış çıktıya giden üç yol - ve makine yolu hepsinden daha uzağa ölçeklenir, çünkü dosyalar gelirken hiç yorulmaz.

---

## Büyük resim: katmanlar nasıl bir araya gelir

Buradan aşağısı tamamen mimaridir. Diyagram, tüm sistemi tek bir görünümde gösterir: en üstte
veri olan araçlar, ortada hiçbir platform hakkında bir şey bilmeyen motor, onun altında tek bir
sözleşmeyi uygulayan kabuklar ve içeriği sağlayan kataloglar.

```
                ┌─────────────────────────────────────────────┐
                │              Tools (data, not code)         │
                │   tool.json + template.html + hooks.js?     │
                └─────────────────────────────────────────────┘
                                    ▲
                                    │ talks to via Capability Bridge v1
                                    ▼
                ┌─────────────────────────────────────────────┐
                │                  Engine                     │
                │   loader · validator · runtime · template   │
                │   inputs · url-mode                         │
                │   PLATFORM AGNOSTIC. Knows nothing of DOM,  │
                │   filesystem, or You.                       │
                └─────────────────────────────────────────────┘
                                    ▲
                                    │ implements HostV1
                                    ▼
        ┌──────────────┬──────────────┬──────────────┬──────────────┐
        │  Web Shell   │ Tauri Desktop│ Tauri Mobile │  CLI Shell   │
        │   (PWA)      │              │              │              │
        └──────────────┴──────────────┴──────────────┴──────────────┘
                                    ▲
                                    │ fetches from
                                    ▼
                ┌─────────────────────────────────────────────┐
                │              Catalogs                       │
                │   catalog/tools/index.json + tool dirs      │
                │   catalog/assets/index.json + asset files   │
                └─────────────────────────────────────────────┘
```

### Depo düzeni

İçerik paketler olarak bağlanır: `community/`, `docs/`, her `shells/*`, her ikisi de `services/*` ve `brands/suse` her biri kendi deposudur, bu deponun git alt modülleri olarak checkout edilir. Üst depo `engine/`, `schemas/`, `scripts/`, `tests/`, `api/`, `brands/lolly-start/` ve `profiles.json`'a sahiptir. Checkout komutu ve depolar arası iş akışı için bkz. [Build Guide » Kaynağı Alma](/info/build-guide.html).

```
lolly/
├── engine/           # Platform-agnostic core. Open source (MPL-2.0).
│   └── src/
│       ├── index.ts          # public surface - loader, runtime, template, inputs, url-mode
│       ├── loader.ts         # fetches and validates tool files
│       ├── runtime.ts        # orchestrates the 5-step lifecycle
│       ├── template.ts       # Handlebars hydration + annotateTemplate
│       ├── inputs.ts         # manifest → runtime input model
│       ├── url-mode.ts       # URL ↔ input state round-trip
│       ├── validate.ts       # JSON Schema validation of manifests
│       ├── compose.ts        # resolve nested tool renders (composes)
│       ├── embed.ts          # parse portable lolly.tools embed URLs
│       └── bridge/
│           └── host-v1.ts    # type re-export of the @lolly-tools/core contract
│
├── shells/
│   ├── web/          # PWA - hosted online; primary distribution
│   │   └── src/
│   │       ├── main.ts           # boot, routing
│   │       ├── theme.ts          # theme apply/persist (FOUC prevention)
│   │       ├── bridge/           # web implementations of HostV1 APIs
│   │       │   ├── index.ts      # compose all bridge pieces
│   │       │   ├── db.ts         # IndexedDB setup
│   │       │   ├── state.ts      # host.state - saved edits
│   │       │   ├── profile.ts    # host.profile - user details
│   │       │   ├── assets.ts     # host.assets - catalog + user uploads
│   │       │   ├── clipboard.ts  # host.clipboard
│   │       │   ├── export.ts     # host.export - rasterise/serialize
│   │       │   ├── net.ts        # host.net - allowlisted fetch
│   │       │   └── media.ts      # host.media - live camera frames (onFrame)
│   │       ├── catalog/
│   │       │   └── sync.ts       # boot-time catalog sync + offline cache
│   │       ├── styles/           # app-wide CSS (app.css, picker.css, tokens.css)
│   │       └── views/
│   │           ├── gallery.ts    # tool library listing + saved-state cards
│   │           ├── tool.ts       # mounts one tool (inputs + canvas + actions)
│   │           ├── picker.ts     # asset picker UI (invoked by host.assets)
│   │           ├── profile.ts    # user details editor
│   │           ├── projects.ts   # /p - folders of saved sessions (nested; folder/selection export)
│   │           └── free-canvas.ts # free-canvas editor overlay for render.layout:"editor" tools
│   │
│   ├── cli/          # Node.js CLI - same engine, headless jsdom
│   │   ├── bin/lolly.ts
│   │   └── src/
│   │       ├── run.ts    # loadTool → createRuntime → export → write file
│   │       └── bridge.ts # CLI implementation of HostV1
│   │
│   ├── tui/          # Interactive terminal shell (Ink) - reuses the CLI bridge
│   │   └── src/
│   │       ├── main.tsx  # full-screen app: Gallery / Projects / Profile / ToolView
│   │       └── bridge.ts # CLI bridge + on-disk state under ~/.lolly
│   │
│   ├── tauri-desktop/ # downloadable desktop app
│   └── tauri-mobile/  # iOS/Android app
│
├── tools/            # profile VIEW (gitignored) - data, not code. Merged from packs:
│                     #   community/ (public, brand-agnostic, MPL) + brands/<active>/tools (brand-owned).
│                     #   A SELECTION follows - the mounted set depends on the profile.
│   ├── qr-code/
│   ├── quotes/
│   ├── email-signature/
│   ├── snippet/
│   ├── countdown-timer/
│   ├── color-palette/
│   ├── color-block/           # typed/heterogeneous blocks (addMenu discriminator)
│   ├── dynamic-layout/
│   ├── tool-logo/         # "Logo" - auto-switching brand logo
│   ├── street-map/        # offline vector city-block maps
│   ├── url-shot/          # "URL Screenshot" (capture capability)
│   ├── strip-data/        # on-device metadata strip - JPEG/PNG/SVG/PDF (file in → clean file out)
│   ├── compress-pdf/      # on-device PDF compressor - recompresses images (file in → smaller file out)
│   ├── brand-lockup/      # "Brand Lockup" - SUSE logo lockups; HarfBuzz text-to-path (wasm)
│   ├── chart-creator/     # SVG charts from structured data
│   ├── filter/            # photo effects in one tool - halftone/scanline/posterize/voronoi (vector), duotone/pixel-stretch/imperfections (raster)
│   ├── meeting-planner/   # global timezone meeting scheduler
│   ├── calendar-ics/      # event → .ics calendar file plus a card
│   ├── digi-ad/           # "Animated Ad" - looping banner from scenes
│   ├── event-name-badge/  # conference badges - composes qr-code as an SVG
│   ├── wayfinding-signage/ # event signage; directions blocks auto-fit label text
│   ├── text-helper/       # on-device text workbench (format/decode/hash/de-identify)
│   ├── design/     # "Design" - freeform WYSIWYG editor canvas (render.layout: editor)
│   ├── multi-page-pdf/    # multi-page PDF document - cover, flowing content blocks, back page
│   ├── diagram-builder/   # org / layercake / process / cycle / pyramid diagrams
│   ├── logo-wall/         # many logos → auto-packed grid
│   ├── logo-lockup-partner/ # SUSE + partner co-brand lockup
│   ├── icon/          # favicon .ico / png / svg from text + colours
│   ├── lottie-digi-ad/    # animated Lottie ad banners
│   └── pose-geeko/        # pose the SUSE Geeko mascot - print-ready stills
│
├── catalog/
│   ├── tools/index.json        # tool registry
│   └── assets/
│       ├── index.json          # asset registry
│       └── suse/...            # logo, palette, etc.
│
├── schemas/          # JSON Schema for tool.json, asset entries, AssetRef
├── scripts/          # build-catalog-index.ts, checksum-assets.ts, validate-catalog.ts
├── tests/            # engine tests
└── docs/             # this file + authoring guides + positioning
```

---

## Platform teslimat modeli

Platform, birden çok yüzeyde çalışır - web PWA, Tauri masaüstü/mobil, betiklenebilir CLI ve etkileşimli TUI. Hepsi aynı motoru ve aynı araç dosyalarını kullanır.

### Web (PWA) - birincil dağıtım
SUSE kontrolündeki bir URL'de barındırılır. Service worker araçları ve varlıkları önbelleğe aldıktan sonra çevrimdışı çalışır. Çoğu çalışan, tedarikçi ve iş ortağının platformu kullanacağı yer burasıdır. Hesap gerekmez - durum, cihaz başına IndexedDB'de saklanır.

Web kabuğu tek bir düzenden duyarlıdır. Masaüstünde bir araç, imleç etrafında yakınlaştırmak için trackpad-yerel tuval gezinmesine (Cmd/Ctrl-tekerlek veya sıkıştırma, kaydırmak için Boşluk veya orta tuşla sürükleme, `0`/`1`/`+`/`−` tuşları ve bir Fit/% HUD'u) sahip bir önizleme sahnesinin yanında yeniden boyutlandırılabilir bir kontroller kenar çubuğudur. Mobilde (≤640px) kontroller, statik tam ekran bir önizlemenin üzerinde peek/half/full arasında yerleşen (dokunma değiştirir) bir sürükleme tutamacına sahip üstten sabitlenmiş bir sayfaya dönüşür ve yüzen bir **Render** düğmesi, alt sayfa açılır penceresinde **Export** kontrollerini açar. Dokunma, önizlemede sıkıştırarak yakınlaştırma ve sürükleyerek kaydırma alır. Render yolu ve dışa aktarma kontrolleri her ikisinde de aynıdır - yalnızca arayüz kabuğu yeniden akar.

![Masaüstü bölünmüş görünüm - solda manifestten oluşturulan kontroller, sağda canlı tuval](/t/url-shot?url=%2F%23%2Ftool%2Fchart-creator&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=aud-web-split)

Aynı araç telefon genişliğinde, korunması gereken ikinci bir düzen olmadan: kontroller üstte bir sayfaya dönüşür, önizleme tüm ekranı kaplar ve render hapı üzerinde yüzer.

![430 piksel genişliğinde bir ekranda bir audiogram - üstte kontrol sayfası, altta bitmiş kare grafik ve yüzen render hapı](/t/url-shot?url=%2F%23%2Ftool%2Faudiogram%3Faudio%3Dlolly%2Floops%2Ffireplace-loop%26title%3DField%2520notes%26subtitle%3DEpisode%252012%26style%3Dwave&width=430&height=900&dpi=192&waitMs=3200&css=%23ag-wave%7Bdisplay%3Anone!important%7D.ag-ph%7Bdisplay%3Ablock!important%7D&walker=1&format=svg&rasterDpi=110&dark=1&filename=ov2-phone-audiogram)

**Toplu mod (`/pro`).** Web kabuğu ayrıca bir veya birçok araç genelinde tek seferde birçok satır render eden, tablo tarzı bir toplu ızgara da (`shells/web/src/pro/`) sunar. CSV/TSV gidiş-dönüşü ve tablodan yapıştırma, satır başına şablon/format/boyut/birim/dpi, canlı önizlemeli bir bloklar-editörü yan paneli, daraltılabilir dışa aktarma sütunları, satır başına bir "ilgililik" etiket çubuğu, soldan sürükle-tutamaçlı satır yeniden sıralama, iki adımlı silme onayı, kaydedilmiş toplu iş oturumları ve bir `.zip` indirmesi sunar. "Kitlesel içerik üretimi" konumlandırmasının arkasındaki bire-çok yüzey budur.

### Tauri masaüstü / mobil
Paketlenmiş yerel uygulama (Tauri sayesinde küçük ayak izi). Tam çevrimdışı kullanılabilirlik, CLI'ye bağımlı araçlar (PDF Smasher, Font Outliner) için dosya sistemi erişimi ve kamera erişimi sağlar. 2026 ortası için araç geliştirmesi planlanıyor.

### CLI
`lolly <tool-id> [--input=value ...] --output=file.png`

Masaüstü kullanıcıları birçok aracı terminalden çalıştırabilir. CLI kabuğu aynı motoru yükler, bir jsdom DOM'u oluşturur, aynı render yolunu çalıştırır ve dosyayı yazar. URL modu taşıma katmanıdır - CLI ayrı bir uygulama değildir. Bu, CLI ve GUI çıktılarının aynı olmasını garanti eder.

```bash
lolly qr-code --url=https://suse.com --output=qr.svg
lolly quotes --quote="Ship it." --output=quote.png
lolly                        # lists available tools
lolly qr-code                # lists inputs for that tool
```

### TUI
`npm run tui`

CLI'nin etkileşimli karşılığı: araçlara göz atmak, girdileri doldurmak, projeleri kaydetmek ve dışa aktarmak için - hepsi bir GUI olmadan - tam ekran, klavye öncelikli bir terminal uygulaması (Ink üzerine kurulu). Host köprüsü, DOM'suz formatlar (SVG/EMF/EPS/HTML + metin/veri) için **CLI'nin uygulamasını yeniden kullanır** ve `~/.lolly` altında disk üzerinde durum ile isteğe bağlı satır içi önizleme ekler. Bunun ötesinde bir **tarayıcı render katmanı**na sahiptir: talep üzerine raster/PDF/video ve canlı-URL yakalama üreten, kapsamlandırılmış bir başsız Chromium (MCP sunucusunun kurduğuyla aynısı) - çıktının aynı olması için web kabuğunun derlenmiş bir kopyasını çalıştırır ve yalnızca böyle bir formatı ilk dışa aktardığında başlar. Böylece `url-shot` (kırpma + yeniden renklendirme + vektör PDF/SVG ile) ve her raster/pdf aracı terminalde de çalışır. Bkz. [TUI kılavuzu](/info/tui.html).

Hangi yüzeyde olursan ol, panonun Yetenekler sekmesi, platformun yapabileceğini beyan ettiği her şeyin tek bir aracı bile açmadan okunabilir, gruplanmış tam haritasıdır.

---

## Araç kategorileri

Araçlar, galeri gruplaması için manifestlerinde bir `category` ile etiketlenir.

Satırlar galeri bölüm sırasına göre listelenir. `utility` bölümü her zaman **en son** render edilir (gelecektekiler dahil diğer her kategoriden sonra) - bu, cihaz üzerinde çalışan "Çevrimdışı Yardımcı Programlar" çekmecesidir.

| Kategori | Örnekler | Planlanan |
|---|---|---|
| `everyone` | QR Code Generator, Quote Card, Email Signature, Logo, Wordmark, Audiogram, Battlecards, Sequence Studio, Record | Employee Image Stationery |
| `designer` | Brand Lockup, Design, Chart, Darkroom, Filter, Pose Geeko, Multi-Page PDF | Font Outliner |
| `event` | Meeting Planner, Event Name Badge, Wayfinding Signage, Calendar ICS, Booth Studio | Event Stationery, Bulk Name Badges, Room Agenda Cards |
| `product` | - | CVE Alert, Product Release Announcement, Blog OG Image |
| `utility` | Strip Hidden Data, Text Helper, Compress PDF, Convert Image, Convert Font, Redact, Run Web Code, Screen Capture, URL Screenshot | Birim/format dönüştürücüleri, cihaz üzerinde daha fazla gizlilik aracı |

Bu hücreler **örneklerdir, envanter değil**. Hangi araçların var olduğu bu sayfanın değil, mount ettiğin profilin bir özelliğidir: bir marka paketi kendi araçlarını ekler ve göndermek istemediği bir topluluk aracını hariç tutabilir. `catalog/tools/index.json` - manifestlerden üretilen ve galerinin fiilen okuduğu kayıt defteri - yetkili listedir; bir profilin ne mount ettiğini saymak için, burada yazılı bir sayıya güvenmek yerine manifestleri say (`ls community/*/tool.json brands/*/tools/*/tool.json`). (İki pakette bulunan bir araç id'si, kazanan paketten bir kez mount edilir.)

Araçlar ayrıca duruma göre sınıflandırılır: `official` (marka onaylı, filigransız), `community` (dış katkı), `experimental` (filigranlı dışa aktarımlar). Kütüphanenin çoğu `official`dır; daha yeni stüdyolar ve yakalama araçları otururken `community` veya `experimental` durumunda kalma eğilimindedir. Her yüzey rozeti gösterir, böylece okuyucu bir şeyi açmadan önce neyi aldığını bilir - ve yukarıdaki kategori hücreleri gibi, duruma göre üyelik de burada saymak için çok hızlı değişir. Bunu galeriden veya üretilen dizinden oku.

**Design**, `render.layout: "editor"` serbest tuval modu üzerine kurulan ilk araçtır - metin, şekil ve görsel kutularını sürükleyip boyutlandırdığın, döndürdüğün ve hizaladığın çerçevesiz, doğrudan-manipülasyonlu bir yüzey; ardından diğer her araçla aynı render yolundan dışa aktarır.

**Strip Hidden Data**, ilk **cihaz üzerinde çalışan yardımcı program**dır (`privacy: "on-device"`): *senin* sağladığın bir dosyayı tamamen tarayıcıda işleyip temiz bir kopyasını geri veren bir içerik dönüştürme aracı - asla yüklenmez, asla filigranlanmaz, hiçbir köken damgalanmaz. **Text Helper** ikincisidir - günlük siteye-yapıştır işleri için cihaz üzerinde bir çalışma tezgahı (JSON format, JWT çözme, Base64, URL kodlama/çözme, SHA hashleme). **Compress PDF** üçüncüsüdür - bir PDF'i görsellerini yeniden sıkıştırarak küçültür, yine tamamen cihaz üzerinde. İşaretçi ve rozet metni "Cihazında çalışır - hiçbir şey yüklenmez" artık tüm dönüştürme setini kapsıyor: Strip Hidden Data, Text Helper, Compress PDF, **Convert Image** (HEIC/TIFF/AVIF → WebP/JPG/PNG), **Convert Font**, **Redact** (bir görselin, SVG'nin veya PDF'in bölgelerini yok et), **Prompt to Image** ve profilin mount ettiği yerde **Rebrand a Deck** (bir `.pptx`'i yerinde yeniden temalandır). Bu, gizli dosyaları tek amaçlı sitelere teslim etmenin yerini alan bir gizlilik-yardımcı-program kategorisidir.

![Utilities çekmecesi, her kartın zaten sahip olduğun bir dosyayı dönüştüren bir araç olduğu yer](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%2C.brand-tips%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=aud-utilities)

> Not: `category` ve `status`, her `tool.json`dan `catalog/tools/index.json`a (galerinin okuduğu kayıt defteri) denormalize edilir. Manifest tek doğru kaynaktır - dizin `npm run build:catalog` ile **üretilir** ve commit edilmiş dizin manifestlerden saparsa `npm run validate:catalog` CI'yi başarısız kılar.

---

## Mimari taahhütler

Bu kararlar netleşmiştir. Herhangi birini değiştirmek büyük bir girişimdir - bunlar kod tabanındaki her diğer kararı şekillendirir.

### 1. Deklaratif araçlar, buyurgan bir kaçış kapısıyla

Bir araç bir manifest (`tool.json`) + bir şablon (`template.html`) + isteğe bağlı `hooks.js`dir.

**Manifest girdileri bildirir.** Şablon değil. Girdiler Handlebars token'larından çıkarılmaz. Manifest sözleşmedir; şablon adlandırılmış değişkenleri `{{id}}` ile tüketir.

![Street Map'in kontrol yığını - bir şehir açılır menüsü, bir tema seçimi, kalınlık kaydırıcıları ve renk tetikleyicileri, her biri bir manifest satırından çizilmiş](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-street-map-controls)

**Hook'lar isteğe bağlıdır.** Çoğu araç saf deklaratiftir - manifest + şablon yeterlidir. Hesaplanmış değerlere ihtiyaç duyan araçlar (QR kodlama, grafik verisi şekillendirme) adlandırılmış yaşam döngüsü fonksiyonları sunan bir `hooks.js` sağlar (`onInit`, `onInput`, `onFrame` - hareket-tepkili araçlar için kare başına canlı kamera hook'u - `onLevel`, `beforeExport`, `afterExport`, `exportFile` - Strip Hidden Data gibi cihaz üzerinde çalışan yardımcı programların kullandığı dosya-girer/dosya-çıkar dönüştürme yolu - ve kendi derin raster'ına sahip bir araç için `exportStill`). Host, hook'ları kapsam olarak enjekte edilen yetenek köprüsüyle `new Function('host', …)` üzerinden yükler. Bu bir **taşınabilirlik sözleşmesidir, güvenlik korumalı alanı değil**: hook'lar hâlâ sayfa gerçekliğinde çalışır ve bir tarayıcı kabuğunda `window`/`fetch`/`document`'a *ulaşabilir* - `host.*` desteklenen, taşınabilir yüzeydir, uygulanan bir sınır değil. Eşzamansız hook sonuçları zaman sınırlıdır (`onInit` 5s, `onInput` 2s, `beforeExport`/`afterExport` 5s, `exportFile`/`exportStill` 10s) ve geç sonuçlar atılır; kaçak bir *eşzamanlı* hook önlenemez. Bu yüzden güvenilmeyen üçüncü taraf hook kodu, Worker izolasyonu gelene kadar çalıştırmak için güvenli değildir.

Bunun önemi şu: deklaratif araçlar geliştirici olmayanlar tarafından yazılabilir. Eğer her araç bir web uygulaması olsaydı, "iş atı şablonları oluşturacak/sürdürecek sınırlı beceri" risk notu kalıcı bir darboğaz haline gelirdi.

### 2. Araçlar ve varlıklar veridir, paketlenmiş kod değil

Web ve Tauri uygulamaları, önyüklemede bilinen bir URL'den araç ve varlık kataloglarını getirir, yerel olarak önbelleğe alır ve orada ne varsa onunla çalışır. **Yeni bir etkinlik karosu veya mevsimlik varlık eklemek bir uygulama sürümü gerektirmez.**

Varlık baytları, CDN zehirlenmesini önlemek için SHA-256 ile sağlama toplamı alınır. Varlık `id` + `version`, önbellek geçersiz kılmayı yönlendirir.

### 3. Yetenek Köprüsü, araçların gördüğü tek API'dir

Araçlar şablon alanları dışında DOM'a asla dokunmaz, `fetch`'i asla doğrudan çağırmaz, dosya sistemini asla okumaz. Sürümlenmiş `host.*` metotlarını çağırırlar. Sözleşmenin kanonik tanımı `packages/core/src/host-v1.ts`dir - araç-yazarı SDK'sı `@lolly-tools/core`, böylece bir üçüncü taraf motora bağımlı olmadan buna karşı geliştirme yapabilir; `engine/src/bridge/host-v1.ts` bunun bir tip yeniden dışa aktarımıdır ve motor/kabuk kodu bu yoldan içe aktarmaya değişmeden devam eder:

| Köprü API'si | Ne yapar |
|---|---|
| `host.profile` | Kullanıcının adı, e-postası, vesikalık fotoğrafı, şehri vb. `bindToProfile` ile girdileri önceden doldurur. |
| `host.assets` | Katalog sorguları, varlık çözümleme, host tarafından sağlanan seçici arayüzü. |
| `host.state` | Girdi yuvalarını kaydet / yükle. Webde IndexedDB, Tauri'de dosya sistemi, CLI'de bellek. |
| `host.clipboard` | Panoya metin veya görsel yaz (platform yedekleriyle). |
| `host.export` | Render hedefini raster'a çevirir veya serileştirir. Deneysel araçlar için filigran uygular. |
| `host.net` | İzin listesine alınmış fetch - yalnızca araç `"network"` yeteneğini beyan ettiyse kullanılabilir. (Şu anda kullanılan hiçbir araç bunu kullanmıyor.) |

İsteğe bağlı, eklenebilir yüzeyler yalnızca bir kabuk onları sağladığında görünür. Bazıları **yeteneğe bağlıdır** - yalnızca araç eşleşen bayrağı beyan ettiğinde açığa çıkar: `host.compose` (başka bir aracın render'ını göm - `compose`), `host.capture` (URL Screenshot için sayfa yakalama - `capture`) ve `host.recorder` (kayıt araçları için mikrofon/kamera/ekran yakalama - `microphone` / `camera` / `screen`). Geri kalanı **özellik-algılamalıdır** - kabuk bunları sağlayabildiği her yerde mevcuttur, araç ise sağlayamayan kabuklar için bir yedek tutar.

Kapsadığını göstermek için birkaç önemli yüzey - [Host API](/info/host-api.html) her birini belgeler ve `packages/core/src/host-v1.ts` sözleşmenin kendisidir:

| Yüzey | Sürümden beri | Ne ekler |
|---|---|---|
| `host.tokens` | 1.0 | DTCG tasarım tokenları - markanın kendi ilkel öğeleri |
| `host.text` | 1.0 | HarfBuzz WASM üzerinden metinden yola dönüşüm (`wasm` yetenek bayrağı buna dayanan araçları işaretler) |
| `host.media` | 1.4 | `onFrame` hook'unu tetikleyen canlı kamera kareleri. Kademeli iyileştirme, kasıtlı olarak `camera` bayrağına bağlı *değildir* - böyle bir araç yine de sıradan bir sabit görsel aracı gibi çalışır |
| `host.color` | 1.40 | Algısal renk matematiği: ΔEOK, WCAG + APCA kontrastı, OKLab rampaları, sınıf kesimleri, kategorik paletler, uyum şemaları (1.60), CSS Color 4 karıştırma ve gradyan pişirme (1.68). Saf ve senkron - kabuklar herhangi bir şey uygulamak yerine motorun `makeColorApi()`'sini ekler, böylece sapma olamaz |
| `host.images` | 1.60 | Cihazda bayt kodunu çözme / yeniden boyutlandırma / yeniden kodlama - dönüştürme yolu (HEIC → JPEG, WebP'ye sıkıştırma, küçültme). Web kabuğunda tembel bir cephe olarak sunulur, böylece HEIC kod çözücü asla başlangıç paketine girmez |
| `host.geom` | 1.64 | Kesin vektör geometrisi: yol boole işlemleri, ofsetleme, kontur-doldurmaya dönüştürme, spline düşürme, basitleştirme, çarpışma testi. Ayrıca saf, senkron ve motordan eklenir (`makeGeomApi()`); hatalar asla fırlatılmaz, *döndürülür* |

Geri kalanı aynı kuralları izler ve onların yanında belgelenir: cihaz üzerinde belge ameliyatı için `pdf` (1.8) ve `pptx` (1.58), klip analizi ve cihaz üzerinde TTS/transkripsiyon için `audio` (1.71) ve `speech` (1.96), MilkDrop yer tutucu sözleşmesi için `viz` (1.72), derin-bit ve katmanlı-bitmap çıktısı için `codec` (1.100) ve `layers` (1.102), cihaz üzerinde modeller için `upscale` (1.101) ve `matte` (1.103), kendi piksel işini yapan hook'lar için `raster` (1.105), dışa aktarıma dayanıklı oklar için `connectors` (1.106) ve bitmiş baytları imzalamak için `c2pa` (1.85). Sayı büyüyor; kurallar büyümüyor.

Beyan edilebilir yetenekler şunlardır: `network`, `filesystem`, `clipboard`, `camera`, `microphone`, `screen`, `ffmpeg`, `wasm`, `capture`, `compose`. (1.54'te eklenen `screen`, `host.recorder` üzerinden ekran yakalamadır - kullanıcı tarayıcı-yerel arayüzde bir ekran/pencere/sekme seçer; aracın kendisinin adlandırdığı bir URL'yi raster'a çeviren `capture`'dan farklıdır.)

Aynı araç tarayıcıda, Tauri'de ve başsız CLI'de çalışır çünkü her kabuk bu arayüzü uygular - araç hangisinde olduğunu asla bilmez.

Köprü sürümlenmiştir. Metot eklemek küçük bir sürümdür. Kaldırmak veya imzaları değiştirmek büyük bir sürüm sıçramasıdır. v2 gönderildiğinde, v1 çalışmaya devam etmelidir.

### 4. Varlık ID'leri sonsuzadır

`suse/logo/primary` bir sözleşmedir. Yayınlandıktan sonra:
- ID asla değişmez, asla yeniden kullanılmaz.
- Bayt değişiklikleri → manifestte `version`i artır.
- Yeni bir varlıkla değiştirildiyse → `deprecated: true` ayarla ve isteğe bağlı olarak `replacedBy`.
- Mevcut referanslar her zaman çözümlenir.

Bu, kaydedilmiş araç durumlarını ve URL ile paylaşılan bağlantıları yıllar boyunca kalıcı kılar.

### 5. URL modu birinci sınıftır

Her girdi bir URL parametresi olarak ifade edilebilmelidir:

```
lolly.tools/#/tool/qr-code?url=https://suse.com&ecl=H
```

![Başka hiçbir şey içermeyen o bağlantının tek başına kendisi, bitmiş varlıktır](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Fsuse.com%26ecl%3DH%26full&width=760&height=760&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-url-mode-qr)

CLI modu farklı bir taşıma katmanı altında URL modudur - CLI kabuğu argv'den bir URL-durum nesnesi kurar ve **aynı** motor ardışık düzenini çalıştırır. Tek bir render yolu vardır. CLI, ayrı bir uygulama olmadığı için GUI'den sapamaz.

`url-mode.ts` gidiş-dönüşü (ayrıştırma ve serileştirme) yönetir. Bir dizi **ayrılmış parametre**, girdi olarak araca asla iletilmez: çıktı kontrolleri (`format`, `export`, `copy`, `filename`, `width`/`w`, `height`/`h`, `unit`, `dpi`), baskı ve köken kadranları (`bleed`, `marks`, `profile`, `password`, `c2pa`, `imprint`, `durable`, `meta`, `hdr`, `depth`, `cuts`) ve durum taşıyıcıları (`template`, "En kısa bağlantı" paketlenmiş token'ı olan `z` - ve aynısının bir parola altında şifrelenmişi olan `zx`). `engine/src/url-mode.ts` içindeki `RESERVED` seti yetkili kaynaktır ve bir testle sabitlenmiştir; [URL Mode](/info/url-mode.html) burada listelenmeyen birkaçı dahil hepsini belgeler. URL modundaki varlık girdileri `id`leriyle serileştirilir; runtime bunları hidrasyondan önce `host.assets.get()` üzerinden çözer. `width`/`height`, `unit` cinsinden değerlerdir (varsayılan `px`, ayrıca `mm`/`cm`/`in`/`pt`/`pc`); fiziksel bir birimle `dpi` raster çözünürlüğünü ayarlar. Bunlar tuval belge boyutunu belirler ve dışa aktarma boyutları panelini önceden doldurur.

Her girdi bağlantıda taşındığından, bir parametre değişikliği farklı bir bitmiş varlık demektir. Bu paletin tamamı tek bir tohum rengi, bir uyum ve bir adım sayısıdır:

![Bağlantıdaki tek bir tohum renkten türeyen, dört renk tonunda dokuz adım](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3De0521a%26harmony%3Dtetrad-4%26steps%3D9%26full&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-url-palette)

### 6. Depolama doğrudan değil, köprü üzerinden yapılır

Web kabuğu: IndexedDB. Tauri: dosya sistemi. CLI: bellek içi. Araçlar yalnızca `host.state.save(slot, data)` ve `host.state.load(slot)` görür. `localStorage` kullanılmaz - hem çok küçük hem de blob tutamıyor.

Kullanıcılar araç başına birden çok adlandırılmış düzenleme yuvası kaydedebilir ve her oturuma sonradan dönebilir. Hesap oluşturmaya gerek yoktur; durum cihaz başınadır. Köprü tek dikiş noktası olduğundan, bu cihaz başına durum aynı zamanda *taşınabilir*: `shells/web/src/data-transfer.ts`, `host.profile`/`host.state`/`host.assets` üzerinden her şeyi geri okuyarak tek bir `lolly-backup` zip dosyasına aktarır ve bu dosya başka herhangi bir kuruluma sunucu gerektirmeden içe aktarılabilir - "yeni bir cihaza geçme" sorusunun çevrimdışı yanıtı budur (tam özellik: `docs/data-transfer.md`). SUSE ID entegrasyonu (çoklu cihaz senkronizasyonu) bunun üzerine kurulacak gelecekteki bir kilometre taşıdır.

### 7. Olgunluk etiketleri "marka onaylı" riskini tasarım yoluyla yanıtlar

Her araç, manifestosunda `status: official | community | experimental` beyan eder. Galeri, duruma göre sıralanır. Deneysel araçlar dışa aktarımlarını otomatik olarak filigranlar - filigran, araç tarafından değil `host.export.render` tarafından uygulanır, bu yüzden resmi olmayan bir araç yazarı bunu devre dışı bırakamaz.

Bu, herhangi bir aracın kullanılmasının marka onayı anlamına geldiği algı riskine yönelik yapısal bir yanıttır. Süreç yanıtları (bir inceleme kuyruğu, SUSE ID sınırlaması) bunun üzerine eklenir.

### 8. Araç girdileri, varlıklar dahil, manifesto üzerinden tiplenir

Girdiler bir `type` beyan eder: `text`, `longtext`, `number`, `boolean`, `color`, `select`, `asset`, `date`, `time`, `datetime-local`, `url`, `blocks`, `vector`, `table` ve `file`. Host, manifestodan tipe göre genel bir kontrol oluşturur - araçlar sıfır kontrol kodu yazar. (Kullanıcının profilinden ön doldurma bir tip değildir - herhangi bir girdi `bindToProfile` taşıyabilir.) Üçü diğerlerinden daha fazla ağırlık taşır:

- **`asset`** (`filter` ve `allowUpload` ile) genel varlık sistemine köprüdür; `allowUpload: false`, yalnızca kütüphane varlıklarına izin verilen sponsorluk kutucuğu logoları gibi durumlar için markanın uygulanabilirliğini sağlayan koldur. Kullanıcı yüklemeleri, kütüphane varlıklarıyla aynı `AssetRef` biçimini kullanır, bu yüzden araçlar bunları özdeş şekilde işler.
- **`blocks`**, tekrarlanan bir alan grubudur - bir yan panelde düzenlenen, tipli/ayrımlı bir ekleme menüsü ve blok başına varlık alanları olan tek bir girdi içinde mini bir tablo. Tuvaldeki oluşturulmuş bir bloka tıklamak o blokun satırına odaklanır. `meeting-planner`, `chart-creator`, `event-name-badge`, `wayfinding-signage`, `color-block` ve `digi-ad` tarafından kullanılır.
- **`vector`**, sabit bir sayı kümesini (ör. bir dönüşüm) tek bir bileşik kontrolde gruplar; **`file`** ise kullanıcının kendi dosyasını cihaz üzerinde dönüştürme araçları (ör. `strip-data` ve `compress-pdf`) için bellekte bayt olarak tutar.

### 9. Şablonlar mantıksızdır (EJS değil, Handlebars)

Handlebars, EJS yerine bilinçli olarak seçildi:
- Mantıksız. Şablonlar geliştirici olmayan kişiler tarafından yazılabilir.
- Varsayılan olarak güvenli. `{{x}}` HTML kaçışı uygular; `{{{x}}}` ham içerik için isteğe bağlıdır.
- Şablonlarda keyfi JS bulunmaması, şablon başına XSS denetimi yüzeyi olmaması anlamına gelir.

Mantık, açık ve incelenebilir olduğu `hooks.js` içinde yaşar. Kullanılabilir Handlebars yardımcıları: `{{default}}`, `{{upper}}`, `{{lower}}`, `{{eq}}`, `{{markdown}}`, `{{asset ref}}`, `{{asset ref "property"}}` (ayrıca kardeş `.ics`/`.vcf`/`.csv` şablonlarının kullandığı `icsStamp`/`rfcText`/`csvCell` veri biçimi yardımcıları).

### 10. Araçlar araçları bileştirir

Bir araç, araçtan araca içe aktarım olmadan **başka** bir aracın çıktısını gömebilir - bileşim motor tarafından çözülür, hiçbir zaman araç kodu tarafından değil. İki yüzey vardır:

- **Bildirimsel manifesto** - `composes: [{ id, tool, inputs, format?, width?, height? }]`. Motor, adlandırılan alt öğeyi oluşturur ve sonucu mantıksız şablona `{{asset <id>}}` olarak yerleştirir. `event-name-badge`, bugün `qr-code`'u bir SVG olarak bileştirir.
- **Taşınabilir gömme URL'si** - `<img src="https://lolly.tools/tool/<id>.<ext>?<inputs>">`. Kabuk, bu alt öğeyi **yerel olarak** oluşturur (yerel oluşturma tamamlanana kadar bir yer tutucu piksel gösterilir); hiçbir şey asla `lolly.tools`'tan getirilmez.

Herhangi bir aracın çıktısını bileştir: bir **SVG** alt öğe, üst öğe SVG veya PDF'ye dışa aktarıldığında gerçek bir vektör olarak kalır ve PNG için keskin şekilde rasterleştirilir; **PNG/JPG/WEBP** alt öğeleri görüntü olarak gömülür. `compose` yeteneğini gerektirir. Bileştirilmiş alt öğeler ara ürünlerdir - asla filigranlanmaz veya provenans damgası taşımaz - ve bileşim zarifçe bozulur: bir alt öğeyi oluşturamayan bir kabuk yalnızca o yuvayı atlar ve üst öğe yine de oluşturulur.

---

## Bilinçli olarak yapmamayı seçtiğimiz şeyler

- **Şablonlarda EJS yok / rastgele JS yok.** XSS yüzeyi sıfırdır. Mantık `hooks.js` içinde yaşar.
- **Zorunlu bir varlık CMS'i yok.** Bireyler kendi yaratıcı dosyalarını uygulama içinde doğrudan kataloglarına aktarır ([Katalog](/info/using.html) görünümü ve Brand Studio) - sunucu yok, yönetim konsolu yok. Çalışma bir **oturum** olarak devredilir: bir paylaşım bağlantısı tüm durumu taşır ve aynı oturum bir yedeklemede ya da bir iş birliği oturumu üzerinden yolculuk eder. Dağıtımı kim kontrol ediyorsa, paylaşılan bir oturumu bir **şablon** olarak kilitleyebilir - bağlantıyı aç, değerlerini marka paketindeki o aracın dizininde bir şablon girdisi olarak kaydet ve commit'le - bundan sonra aracın "New from template" seçicisinde görünür ve `?template=<id>` olarak derin bağlantı verilebilir. Git, oluşturanın değil dağıtım sahibinin kilitleme adımıdır. *Paylaşılan, yönetilen* bir katalog için bir kuruluş varlık dizinini aynı şekilde **yönetebilir** ve güncellemeleri PR incelemesinden geçirebilir - bu, uygulamanın bir zorunluluğu değil, mevcut bir yönetişim modelidir.
- **Zorunlu RBAC yok.** Açık uygulama varsayılan olarak herkese açık erişimlidir; marka riski olgunluk etiketleri ve filigranlarla yönetilir. Daha sıkı kontrol isteyen bir kuruluş, kendi kimlik doğrulamasını ve yukarıdaki git ile incelenen kataloğu üzerine katman olarak ekler.
- **Merkezi veritabanı yok.** Tüm kullanıcı durumu cihaz başınadır. SUSE ID entegrasyonu yol haritasında var ama bir lansman engelleyicisi değil.
- **Paylaşılan araçlar/motor kod yolu yok.** Motor açık kaynaktır, `community/` içindeki markadan bağımsız araçlar da öyle; özel `brands/suse/` gibi bir marka paketi kendi araçlarını ve kataloğunu kendi koşulları altında taşır. Her iki durumda da ayrım zorlanır (`engine/`'den araç içeriğine çapraz içe aktarma yok), böylece bölünme temiz kalır.

---

## Yaşam döngüsü, baştan sona

Bir kullanıcı `lolly.tools/#/tool/qr-code?url=https://suse.com&ecl=H` adresini açar:

1. **Başlatma.** Web kabuğu IndexedDB'yi açar, yetenek köprüsünü oluşturur, araç ve varlık kataloglarını senkronize eder (veya çevrimdışıyken önbellekten yükler).
2. **Yönlendirme.** URL hash'i → `tool` görünümü, `qr-code` ve URL parametreleri ayıklanarak.
3. **Yükleme.** `loadTool('qr-code', fetchFile)`, `tool.json`'u getirir, JSON Schema'ya karşı doğrular, `template.html`, `styles.css` ve `hooks.js` kaynağını getirir.
4. **URL durumunu ayrıştırma.** `parseUrlState`, URL parametrelerini başlangıç girdi değerlerine çevirir. Varlık referansları (`?logo=suse/logo/primary`), hafif `{ id, _unresolved: true }` nesneleri olarak ayrıştırılır.
5. **Çalışma zamanı.** `createRuntime(tool, host, initialValues)`, girdi modelini oluşturur (profil verisini, varsayılanları ve başlangıç değerlerini birleştirerek), `host.assets.get()` üzerinden varlık referanslarını çözer, kancaları yükler (kapsamı belirlenmiş `host`, izole edilmemiş), `hooks.onInit`'i çağırır.
6. **Oluşturma.** Kabuk, çalışma zamanına abone olur; her durum değişikliğinde `{ model, hydrated }` alır. Modelden girdi kontrollerini oluşturur ve hidratlanmış şablon HTML'sini `#tool-canvas`'a yazar.
7. **Etkileşim.** Kullanıcı bir girdiye yazar → `runtime.setInput(id, value)` → kısıtlamalar uygulanır → `hooks.onInput` çağrılır → yeniden hidrat → yeniden oluşturma. Tuval canlı olarak güncellenir.
8. **Dışa aktarma.** Kullanıcı İndir (PNG) düğmesine tıklar → `runtime.export(canvasNode, 'png')` → `host.export.render` (dom-to-image-more üzerinden rasterleştirir; SVG/PDF özel DOM dolaşan vektörleştiricilerden geçer) → blob → `host.export.download`. Bir aracın seçebileceği biçim aralığı geniştir ve `schemas/tool.schema.json` içindeki `render.formats` numaralandırması bu konuda yetkilidir - rasterler ve kayan noktalı rasterler, vektörler ve kesim dosyaları, baskı/CMYK, hareket, düzenlenebilir belgeler (`pptx`, `docx`, `odt`), palet ve veri/metin çıktıları, ses ve font dosyaları. [URL Modu](/info/url-mode.html) her kimliği ve ne ürettiğini adlandırır. Ses, diğer her şey gibi bu numaralandırmadadır (`wav`, `mp3`, `m4a`, `opus`, audiogram ve kayıt araçları tarafından beyan edilir); ayrı olarak, bir kayıt aracının `render.capture` modu `host.recorder`'ı yönlendirir ve alınan kayıt, tarayıcının kaydettiği hangi konteynerdeyse o şekilde bitmiş bir Blob olarak gelir. (`render.export: false` ayarlayan araçlar - ör. Color Palette, Countdown Timer, Strip Hidden Data, Text Helper, Compress PDF - indirme/biçim/boyut kontrollerini gizler.) Fiziksel birimler burada biçim başına dönüştürülür (PDF → gerçek sayfa puntoları, raster → DPI'de piksel, bir `pHYs` yığınıyla). Yazarlık/provenans meta verisi (yazar, araç, kaynak - `engine/src/metadata.ts` tarafından oluşturulur) biçim başına gömülür: PNG iTXt, JPEG EXIF, PDF bilgi sözlüğü, SVG `<metadata>`, GIF yorumu. Deneysel araçlara, araç tarafından değil host tarafından eklenen bir filigran uygulanır.

![`?options`'ın açtığı dışa aktarma paneli: dosya adı ve biçim çifti, çıktı boyutu ve dosyayı yazan kontroller](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=aud-export-popup)

Tauri'de aynı yaşam döngüsü. CLI'de aynı yaşam döngüsü - jsdom başsız DOM'u sağlar; çıktı bir dosyaya veya stdout'a gider.

---

## Açık kaynak durumu

**Kod MPL-2.0'dır.** `engine/`, `shells/*`, `services/*`, `schemas/` ve `docs/`, marka araçları için satıcıdan bağımsız bir iskele platformu olarak **MPL-2.0** altında açık kaynaktır; her dağıtılabilir birim [github.com/lolly-tools](https://github.com/lolly-tools) altında kendi deposundadır.

**Araç içeriği marka paketleri olarak dağıtılır**, her biri kendi koşullarıyla (paketin `NOTICE.md` dosyasına bak). `community/`, herkese açık [`lolly-tools`](https://github.com/lolly-tools/lolly-tools) deposudur ve markadan bağımsız araçları da MPL-2.0'dır. `brands/suse/`, özel `suse-lolly` paketidir: SUSE araçları ve SUSE kataloğu, lisanslı PremiumBeat müziği dahil, **SUSE'ye özeldir**. `brands/lolly-start/`, bu deponun sahip olduğu boş başlangıç markasıdır. Yazı tipleri bir paket içinde **SIL Open Font License 1.1** altında dağıtılır - SUSE paketi SUSE ve SUSE Mono yazı tiplerini taşır.

Depo kökündeki `tools/` ve `catalog/`, gitignore'lanmış *görünümlerdir*: bir profil bunları `community/` ve etkin marka paketinden bir araya getirir; bu yüzden her betik ve kabuk bu iki yolu okur, hiçbir zaman bir paketi doğrudan okumaz.

Bu ayrım zorlanır - `engine/`'den araç içeriğine çapraz içe aktarma yoktur - böylece platform/içerik sınırı temiz kalır.

---

## Motorun bittiği ve hostun başladığı yer

Eğer bunu saf veri + Handlebars ile tanımlayabiliyorsan → **motor**.
Eğer DOM'a, dosya sistemine, ağa veya herhangi bir tarayıcı/işletim sistemi API'sine dokunuyorsa → **host**.

Bu sınır bilinçli olarak keskindir. Motor açık kaynaklı kısımdır. SUSE'yi, belirli platformları veya çalışma zamanı ortamlarını bilen her şey bunun dışında kalır.

Bir sonraki ayrıntı düzeyi için [`engine/README.md`](../engine/README.md), her motor modülünü ve neyden sorumlu olduğunu sayar, ve [Tehdit Modeli ve Güven Sınırları](/info/threat-model.html) aynı sınırın aynı zamanda bir güven sınırı olarak nerede işlediğini kaydeder.
