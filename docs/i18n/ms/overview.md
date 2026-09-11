# Gambaran Keseluruhan

![Ikon Lolly - Gula-gula lollipop hijau dan putih yang besar](/info/icon.svg)

Dokumen ini merakamkan tujuan, struktur dan keputusan seni bina bagi platform Lolly. Ia mencerminkan visi produk dan juga keadaan semasa pangkalan kod.

> **Status:** Lolly ialah prototaip dalaman dalam **pilot tertutup yang belum selesai**. Enjin ini deterministik dan konsisten secara dalaman, tetapi produk ini masih awal - SUSE ialah pelanggan nombor satu - dan enjin kriptografi serta penghuraian failnya kini sedang menjalani pengukuhan infrastruktur ketat SUSE, bersedia untuk skala perusahaan (kami sangat mahir dalam hal ini). Baca seni bina di bawah sebagai niat reka bentuk yang sedang diuji, bukan produk siap dan disahkan. Lihat [Adoption & Governance](/info/adoption-governance.html#status) untuk cara pilot ini dijalankan dan diukur.

> **Cara membaca halaman ini.** Ia membawa dua jenis bahan, secara berurutan. Separuh pertama ialah
> **sebab ini wujud**: masalah, kedudukan dan kitaran hayat yang dilalui oleh satu aset.
> Daripada [Gambaran besar](#the-big-picture-how-the-layers-fit) dan seterusnya ia ialah
> **cara lapisan-lapisan sepadan**: dokumen seni bina untuk penyumbang, merangkumi pemisahan
> engine/shell/pack, susun atur repositori, sasaran penghantaran dan komitmen yang mengekang setiap
> perubahan pada platform. Jika anda di sini untuk mengubah pangkalan kod dan bukan untuk memahami
> produk, mulakan di gambaran besar.
>
> Dua rakan menyelam lebih dalam daripada halaman ini. [`engine/README.md`](../engine/README.md) dalam
> repositori ialah peta modul-demi-modul bagi engine, dengan jadual yang dijana bagi setiap modul dan
> apa yang dihurai atau ditulisnya. [Threat Model & Trust Boundaries](/info/threat-model.html)
> ialah seni bina yang sama dibaca sebagai sempadan kepercayaan, dan ia halaman yang tepat untuk
> sebarang soalan tentang apa yang dianggap tidak dipercayai oleh engine.

---

## Sebab ini wujud

Pasukan menghadapi masalah berulang: kerja kreatif dan kandungan yang boleh diulang yang terlalu boleh diramal untuk mewajarkan tangan mahir setiap kali, tetapi terlalu sensitif kualiti untuk diserahkan tanpa garis panduan. Hasilnya ialah sama ada throughput yang perlahan (kesesakan pakar), ketidakkonsistenan (orang menggunakan apa sahaja alat yang ada) atau vendor lock-in (SaaS DAM yang mengawal templat anda).

Platform ini ialah jawapan langsung:

> **Kreatif dan kandungan berprogram pada skala** - penjanaan aset sifar-tenaga kerja, dengan peraturan di bawah kawalan pusat, untuk pekerja, vendor dan rakan kongsi.

Lolly bukan tempat sistem jenama dicipta - ia tempat sistem itu dihasilkan. Anggap ia seperti mesin layan diri untuk reka bentuk: buat pilihan, dapatkan hasil. Setiap kali. Enjin itu berusaha untuk kualiti tertinggi yang boleh dihasilkan oleh setiap format pada perkakasan yang ada di hadapan anda, dan enjin yang sama menghasilkan fail yang sama pada setiap permukaan yang menerimanya.

Hasilnya ialah **kelimpahan**: setiap acara mempunyai papan tanda yang betul, setiap amaran CVE sepadan dengan gaya rumah, setiap label dicetak bersih, setiap tandatangan e-mel terkini - semuanya tanpa tiket reka bentuk. Platform ini mengendalikan kerja kreatif berulang yang telah dioperasikan. Ia sengaja bukan alat kreatif tersuai - pereka masih memiliki kerja unggulan (flagship).

### Berinovasi secara kebarangkalian, berskala secara deterministik

Setiap hujah tentang AI dalam saluran kreatif tersekat pada soalan yang sama: bahagian manakah ini kerja mesin? Ia soalan lama dengan jawapan yang sudah selesai. Jurutulis dan pengilum sudah pun bekerja antara dua instrumen - lakaran longgar, di mana tiada apa yang tetap dan segalanya boleh dicuba, dan mesin cetak, yang menggerunkan tepat kerana ia mengikat. Lakaran itulah tempat seni berlaku. Mesin cetak itulah cara ia sampai kepada sesiapa sahaja. Tiada siapa mengelirukan kedua-duanya, dan kedua-duanya terus maju - dakwat baharu, muka taip baharu, mesin cetak baharu - setiap satu bertambah baik selaras dengan kraf dan niat yang dikhidmatinya.

Lolly melukis garis yang sama. Terokai secara kebarangkalian: model, pereka, idea kasar, prom yang pergi ke tempat yang tiada siapa rancang. Kemudian skala secara deterministik - benda yang mencapai sepuluh ribu output ialah *alat*, dan alat merender dengan cara yang sama setiap kali daripada input yang boleh anda baca. Penerokaan itu kekal bebas kerana tiada apa di hiliran bergantung pada ia mendarat dengan cara yang sama dua kali. Output itu memperoleh kepercayaan kerana ia bukan tekaan. Membawa eksperimentasi AI kepada hasil yang boleh diramal dan boleh dihasilkan semula bukanlah disiplin baharu; ia pembahagian kerja yang sama yang menjadikan kerja bercetak layak dipercayai sejak awal lagi.

> Percayai proses kreatif, skala dengan ketelitian.

### Berbanding alternatif

::: figure positioning-comparison
Kelengkapan keupayaan merentasi alat kreatif hari ini, dikaji pada Ogos 2026. Pemarkahan: 0 tiada, 25 gred jalan pintas, 50 nyata tetapi terhad atau separa, 75 kukuh dengan kaveat, 100 kecekapan teras.
:::

Jurang itu jelas: tiada apa yang dihantar hari ini memberi kita output keutamaan-kekangan, mampu luar talian, kemahiran rendah, boleh diakses secara dalaman. Lolly malah merangkumi kanvas terbuka - **Design** - di mana warna, jenis taip dan aset mematuhi globals jenama, jadi susunan bebas kekal keutamaan-kekangan. Apa yang ia **bukan** ialah suite reka bentuk tanpa kekangan: pereka terus menggunakan Illustrator dan Figma untuk kerja unggulan tersuai. Permutasi boleh disusun dengan alat ini.

![Setiap alat dalam pustaka sebagai kad, dikumpulkan mengikut kategori, supaya pengeluar memilih satu dan bermula](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%2C.brand-tips%7Bdisplay%3Anone!important%7D&tolerance=0.03&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=aud-gallery-landscape)

**Gunakan untuk:** Penjanaan pantas aset kreatif yang telah dioperasikan - jubin acara, lencana nama, tandatangan, amaran CVE, kod QR, kad sosial, label penghantaran, laporan berstruktur.

**Jangan gunakan untuk:** Kandungan hero tersuai.

---

## Kitaran hayat kempen

Cara paling jelas untuk melihat apa itu Lolly bukanlah senarai ciri - tetapi mengikuti satu aset ketika ia berpindah dari tangan ke tangan. Perhatikan satu kad kempen dilokalkan bergerak melalui organisasi:

1. **Pihak kreatif menetapkan peraturan.** Seorang pereka mencipta templat asas dalam alat Design, mengekod keras pembolehubah tipografi dan warna jenama. Mereka bukan membuat satu kad - mereka melakukan kerja asas *sekali sahaja* supaya mereka tidak perlu melokalkan secara manual lagi.
2. **Pembangun menskalakannya.** Templat yang sama itu disambungkan ke dalam saluran paip harian melalui CLI, supaya carta baharu atau varian bahasa baharu dijana secara automatik - tiada pereka membuka semula fail itu.
3. **Pengeluar hanya menggunakannya.** Seorang wakil jualan, luar talian di dalam kapal terbang, membuka alat yang sama dan menjana dek yang sepenuhnya mematuhi jenama untuk mesyuarat pelanggan. Tiada kemahiran reka bentuk, tiada rangkaian, tiada menunggu.

"Carta baharu" dalam langkah kedua ialah render seperti yang ini, dihasilkan daripada rentetan data dan segelintir parameter tanpa sesiapa membuka fail reka bentuk:

![Satu carta kawasan bertindan yang bertajuk, tiga siri-nya dijalur dalam palet sejuk dengan paksi, legenda dan tajuk kesemuanya diletakkan oleh templat dan bukannya secara manual](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3FchartType%3Darea%26stackMode%3Dstacked%26palette%3Dcool%26heading%3DProduct%2520mix%2520by%2520quarter%26full&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-lifecycle-chart)

Intinya bukanlah Lolly bagus untuk pereka *dan* bagus untuk pembangun *dan* bagus untuk jualan, setiap satu secara berasingan. Ia ialah **larian berganti-ganti (relay)**: kerja awal pihak kreatif diskalakan oleh pembangun, yang seterusnya memperkasakan pengeluar. Pengalaman tanpa usaha untuk wakil bukan-teknikal di dalam kapal terbang hanya *mungkin* kerana ketelitian yang ditetapkan oleh pereka dan digunakan oleh pembangun.

Itulah pengganda kuasa. Lolly bukan laci alat berasingan untuk peranan berasingan - ia satu kitaran hayat aset deterministik yang disentuh oleh setiap peranan, dan setiap tangan yang dilaluinya menggandakan nilai yang sebelumnya.

---

## Satu kelulusan, sepuluh ribu aset

Kerana kelulusan berada dalam alat dan bukan fail (lihat [Bagaimana Lolly berbanding](/info/positioning.html)), skala berhenti menjadi masalah semakan. Luluskan alat kad sosial dilokalkan sekali, kemudian jana **10,000 aset merentasi 12 bahasa** daripada hamparan - dan tiada satu pun daripadanya memerlukan semakan pematuhan baharu daripada undang-undang atau jenama, kerana templat yang menjadi sumber semuanya sudah diluluskan.

Alat deterministik yang sama mencapai skala itu dengan tiga cara, semuanya menghasilkan output yang serupa dan telah diluluskan terlebih dahulu:

- <!--i:people--> **Seorang manusia, dalam apl.** Grid kelompok `/pro`: tampal atau import baris, dapatkan satu aset siap bagi setiap baris, muat turun zip. Tiada kemahiran reka bentuk, tiada tiket, tiada menunggu.
- <!--i:code--> **Seorang pembangun, daripada baris arahan.** CLI menjalankan engine yang *sama* dan laluan render yang *sama* tanpa antara muka, supaya alat boleh dijujukkan merentasi kesemua 10,000 baris dalam skrip atau saluran paip harian. Panggilan `lolly <tool> --field=…` dalam gelung ialah keseluruhan integrasi.
- <!--i:cpu--> **Sistem atau ejen AI, melalui MCP.** Alat yang sama dikendalikan secara berprogram, pada kesetiaan yang sama dan skala yang lebih besar lagi - kerana mesin tidak akan bosan semasa beribu-ribu fail masuk.

![Mod Batch pada pemasangan baharu: satu baris kosong menunggu sesuatu alat, dengan keseluruhan permukaan hamparan dan butang Render-nya sudah tersedia sebelum sebarang data tiba](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=ov2-batch-grid)

Satu set kekangan jenama, ditetapkan sekali oleh pereka; tiga laluan kepada output yang serupa dan telah diluluskan - dan laluan mesin berskala paling jauh sekali, kerana ia tidak pernah penat semasa fail masuk.

---

## Gambaran besar: cara lapisan-lapisan sepadan

Segala-galanya dari sini ke bawah adalah seni bina. Rajah itu ialah keseluruhan sistem dalam satu
pandangan: alat ialah data di atas, engine di tengah tidak mengetahui apa-apa tentang mana-mana
platform, shells di bawahnya melaksanakan satu kontrak, dan catalogs membekalkan kandungan.

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

### Susun atur repositori

Kandungan dilekapkan sebagai pek: `community/`, `docs/`, setiap `shells/*`, kedua-dua `services/*` dan `brands/suse` masing-masing repositori tersendiri, dikeluarkan sebagai git submodules bagi repositori ini. Repositori induk memiliki `engine/`, `schemas/`, `scripts/`, `tests/`, `api/`, `brands/lolly-start/` dan `profiles.json`. Lihat [Panduan Binaan » Mendapatkan sumber](/info/build-guide.html) untuk arahan checkout dan aliran kerja rentas-repositori.

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

## Model penghantaran platform

Platform ini berjalan merentasi beberapa permukaan - web PWA, Tauri desktop/mudah alih, CLI boleh skrip dan TUI interaktif. Kesemuanya menggunakan engine yang sama dan fail alat yang sama.

### Web (PWA) - pengedaran utama
Dihoskan di URL yang dikawal SUSE. Berfungsi luar talian sebaik sahaja service worker telah cache alat dan aset. Di sinilah kebanyakan pekerja, vendor dan rakan kongsi akan menggunakan platform ini. Tiada akaun diperlukan - keadaan disimpan dalam IndexedDB bagi setiap peranti.

Web shell responsif daripada satu susun atur. Pada desktop, alat ialah sidebar kawalan yang boleh diubah saiz di sebelah pentas pratonton dengan navigasi kanvas asli-trackpad (Cmd/Ctrl-roda atau cubit untuk zum sekitar kursor, Space- atau seret-tengah untuk pan, kekunci `0`/`1`/`+`/`−` dan HUD Fit/%). Pada mudah alih (≤640px) kawalan menjadi helaian berlabuh-atas dengan pemegang seret yang klik ke peek/half/full (ketik untuk togol) di atas pratonton skrin-penuh statik, dan butang terapung **Render** membuka kawalan **Export** dalam popup helaian bawah. Sentuhan mendapat cubit-zum dan seret-pan pada pratonton. Laluan render dan kawalan eksport adalah serupa pada kedua-duanya - hanya chrome yang mengalir semula.

![Paparan pisah desktop - kawalan dijana daripada manifes di sebelah kiri, kanvas langsung di sebelah kanan](/t/url-shot?url=%2F%23%2Ftool%2Fchart-creator&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=aud-web-split)

Alat yang sama pada lebar telefon, tanpa susun atur kedua untuk diselenggara: kawalan menjadi helaian di bahagian atas, pratonton mengambil keseluruhan skrin dan pil render terapung di atasnya.

![Satu audiogram pada skrin selebar 430px - helaian kawalan di atas, karya seni segi empat siap di bawah dan pil render terapung](/t/url-shot?url=%2F%23%2Ftool%2Faudiogram%3Faudio%3Dlolly%2Floops%2Ffireplace-loop%26title%3DField%2520notes%26subtitle%3DEpisode%252012%26style%3Dwave&width=430&height=900&dpi=192&waitMs=3200&css=%23ag-wave%7Bdisplay%3Anone!important%7D.ag-ph%7Bdisplay%3Ablock!important%7D&walker=1&format=svg&rasterDpi=110&dark=1&filename=ov2-phone-audiogram)

**Mod kelompok (`/pro`).** Cangkerang web juga membawakan grid kelompok bergaya hamparan (`shells/web/src/pro/`) yang merender banyak baris sekali gus merentasi satu atau banyak alat. Ia melakukan pusing ulang CSV/TSV serta tampal hamparan, templat/format/saiz/unit/dpi setiap baris, panel sisi editor blok dengan pratonton langsung, lajur eksport yang boleh dikuncupkan, bar tag "relevance" setiap baris, susun semula baris melalui pemegang seret di sebelah kiri, pengesahan padam dua langkah, sesi kelompok yang disimpan dan muat turun `.zip`. Inilah permukaan satu-kepada-banyak di sebalik pemposisian "penjanaan kandungan pukal".

### Desktop / mudah alih Tauri
Apl asli berbungkus (jejak kecil melalui Tauri). Menyediakan ketersediaan luar talian sepenuhnya, akses sistem fail untuk alat bergantung CLI (PDF Smasher, Font Outliner) dan akses kamera. Dijadualkan untuk peningkatan perkakasan pertengahan 2026.

### CLI
`lolly <tool-id> [--input=value ...] --output=file.png`

Pengguna desktop boleh memanggil banyak alat daripada terminal. Cangkerang CLI memuatkan enjin yang sama, mencipta DOM jsdom, menjalankan laluan render yang sama dan menulis fail. Mod URL adalah pengangkutannya - CLI bukan pelaksanaan berasingan. Ini menjamin output CLI dan GUI adalah sama.

```bash
lolly qr-code --url=https://suse.com --output=qr.svg
lolly quotes --quote="Ship it." --output=quote.png
lolly                        # lists available tools
lolly qr-code                # lists inputs for that tool
```

### TUI
`npm run tui`

Rakan interaktif kepada CLI: apl terminal skrin penuh yang mengutamakan papan kekunci (dibina atas Ink) untuk meneroka alat, mengisi input, menyimpan projek dan mengeksport - semuanya tanpa GUI. Jambatan hosnya **menggunakan semula pelaksanaan CLI** untuk format bebas DOM (SVG/EMF/EPS/HTML + teks/data), dan menambah keadaan atas cakera di bawah `~/.lolly` serta pratonton dalam baris pilihan-masuk. Selain itu ia mempunyai **peringkat render pelayar**: Chromium tanpa kepala terhad (yang sama dipasang oleh pelayan MCP) yang menghasilkan raster/PDF/video dan tangkapan URL langsung mengikut permintaan - memacu salinan terbina cangkerang web supaya output adalah sama, dan hanya dilancarkan apabila anda mula-mula mengeksport format sedemikian. Jadi `url-shot` (dengan potong + tukar warna + PDF/SVG vektor) dan setiap alat raster/pdf turut berjalan dalam terminal. Lihat [panduan TUI](/info/tui.html).

Tidak kira permukaan mana anda berada, tab Capabilities pada papan pemuka adalah peta penuh apa yang platform ini isytiharkan boleh dilakukan, dikumpulkan dan boleh dibaca tanpa membuka mana-mana alat.

---

## Kategori alat

Alat ditanda dengan `category` dalam manifesnya untuk pengumpulan galeri.

Baris disenaraikan mengikut susunan bahagian galeri. Bahagian `utility` sentiasa dirender **terakhir** dalam galeri (selepas setiap kategori lain, termasuk yang akan datang) - ia adalah laci "Utiliti Luar Talian" pada peranti.

| Kategori | Contoh | Dirancang |
|---|---|---|
| `everyone` | QR Code Generator, Quote Card, Email Signature, Logo, Wordmark, Audiogram, Battlecards, Sequence Studio, Record | Employee Image Stationery |
| `designer` | Brand Lockup, Design, Chart, Darkroom, Filter, Pose Geeko, Multi-Page PDF | Font Outliner |
| `event` | Meeting Planner, Event Name Badge, Wayfinding Signage, Calendar ICS, Booth Studio | Event Stationery, Bulk Name Badges, Room Agenda Cards |
| `product` | - | CVE Alert, Product Release Announcement, Blog OG Image |
| `utility` | Strip Hidden Data, Text Helper, Compress PDF, Convert Image, Convert Font, Redact, Run Web Code, Screen Capture, URL Screenshot | Unit/format converters, more on-device privacy utilities |

Sel-sel itu adalah **contoh, bukan inventori**. Alat mana yang wujud adalah ciri profil yang anda pasang, bukan ciri halaman ini: pek jenama menambah miliknya sendiri, dan boleh mengecualikan alat komuniti yang tidak mahu dibawakannya. `catalog/tools/index.json` - dijana daripada manifes, dan daftar yang sebenarnya dibaca oleh galeri - adalah senarai yang berwibawa; untuk mengira apa yang dipasang oleh sesuatu profil, kira manifesnya (`ls community/*/tool.json brands/*/tools/*/tool.json`) dan bukan mempercayai nombor yang ditulis di sini. (Id alat yang hadir dalam dua pek dipasang sekali sahaja, daripada pek yang menang.)

Alat juga dikelaskan mengikut status: `official` (diluluskan jenama, tiada tera air), `community` (sumbangan luaran), `experimental` (eksport bertera air). Kebanyakan pustaka adalah `official`; studio yang lebih baharu dan alat tangkapan cenderung berada pada `community` atau `experimental` semasa ia matang. Setiap permukaan menunjukkan lencana, jadi pembaca tahu apa yang mereka ambil sebelum membukanya - dan, seperti sel kategori di atas, keahlian setiap status bergerak terlalu pantas untuk disenaraikan di sini. Bacanya daripada galeri atau indeks yang dijana.

**Design** adalah alat pertama yang dibina atas mod kanvas bebas `render.layout: "editor"` - permukaan tanpa chrome, manipulasi langsung di mana anda seret, saiz semula, putar dan lekat kotak teks, bentuk dan imej, kemudian eksport melalui laluan render yang sama seperti setiap alat lain.

**Strip Hidden Data** adalah **utiliti pada peranti** yang pertama (`privacy: "on-device"`): alat transformasi kandungan yang mengambil fail yang *anda* bekalkan, memprosesnya sepenuhnya dalam pelayar dan memulangkan salinan bersih - tidak pernah dimuat naik, tidak pernah bertera air, tiada asal usul dicap. **Text Helper** adalah yang kedua - bengkel pada peranti untuk kerja tampal-ke-laman-web harian (format JSON, nyahkod JWT, Base64, kod/nyahkod URL, cincangan SHA). **Compress PDF** adalah yang ketiga - ia mengecilkan PDF dengan memampat semula imejnya, sekali lagi sepenuhnya pada peranti. Penanda dan teks lencananya "Berjalan pada peranti anda - tiada apa dimuat naik" kini merangkumi keseluruhan set transformasi: Strip Hidden Data, Text Helper, Compress PDF, **Convert Image** (HEIC/TIFF/AVIF → WebP/JPG/PNG), **Convert Font**, **Redact** (musnahkan kawasan imej, SVG atau PDF), **Prompt to Image** dan **Rebrand a Deck** (tema semula `.pptx` di tempatnya) di mana profil memasangnya. Ini adalah kategori utiliti privasi yang menggantikan penyerahan fail sulit kepada laman web tujuan tunggal.

![Laci Utilities, di mana setiap kad adalah alat yang mentransformasikan fail yang sudah anda ada](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%2C.brand-tips%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=aud-utilities)

> Nota: `category` dan `status` dinyahnormalkan ke dalam `catalog/tools/index.json` (daftar yang dibaca oleh galeri) daripada setiap `tool.json`. Manifes adalah sumber kebenaran - indeks **dijana** oleh `npm run build:catalog` dan `npm run validate:catalog` gagal CI jika indeks yang dikomit terkeluar daripada manifes.

---

## Komitmen seni bina

Keputusan ini sudah muktamad. Menukar mana-mana satu daripadanya adalah usaha besar - ia membentuk setiap keputusan lain dalam kod pangkalan.

### 1. Alat deklaratif, dengan pintu keluar kecemasan imperatif

Alat adalah manifes (`tool.json`) + templat (`template.html`) + `hooks.js` pilihan.

**Manifes mengisytiharkan input.** Bukan templat. Input tidak disimpulkan daripada token Handlebars. Manifes adalah kontrak; templat menggunakan pemboleh ubah bernama melalui `{{id}}`.

![Susunan kawalan Street Map - dropdown bandar, pemilih tema, gelangsar berat dan pencetus warna, setiap satunya dilukis daripada satu baris manifes](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-street-map-controls)

**Hooks adalah pilihan.** Kebanyakan alat adalah deklaratif tulen - manifes + templat sudah memadai. Alat yang memerlukan nilai terkira (pengekodan QR, pembentukan data carta) menyediakan `hooks.js` yang mendedahkan fungsi kitaran hayat bernama (`onInit`, `onInput`, `onFrame` - hook kamera langsung setiap bingkai untuk alat responsif gerakan - `onLevel`, `beforeExport`, `afterExport`, `exportFile` - laluan transformasi fail-masuk/fail-keluar yang digunakan oleh utiliti pada peranti seperti Strip Hidden Data - dan `exportStill`, untuk alat yang memiliki raster mendalamnya sendiri). Hos memuatkan hooks melalui `new Function('host', …)` dengan jambatan keupayaan disuntik sebagai skop penutupan. Ini adalah **kontrak kemudahalihan, bukan kotak pasir keselamatan**: hooks masih berjalan dalam realm halaman dan *boleh* mencapai `window`/`fetch`/`document` dalam cangkerang pelayar - `host.*` adalah permukaan disokong dan mudah alih, bukan sempadan yang dikuatkuasakan. Keputusan hook tak segerak diberi had masa (`onInit` 5s, `onInput` 2s, `beforeExport`/`afterExport` 5s, `exportFile`/`exportStill` 10s) dan keputusan lewat dibuang; hook *segerak* yang larat tidak boleh dihentikan. Oleh itu kod hook pihak ketiga yang tidak dipercayai belum selamat dijalankan sehingga pengasingan Worker dilancarkan.

Ini penting kerana: alat deklaratif boleh diusahakan oleh bukan pembangun. Jika setiap alat adalah apl web, nota risiko "kemahiran terhad untuk mencipta/menyelenggara templat kuda tunggangan" menjadi kesesakan kekal.

### 2. Alat dan aset adalah data, bukan kod berbungkus

Apl web dan Tauri mengambil katalog alat dan aset daripada URL yang diketahui semasa but, cache secara setempat dan beroperasi atas apa yang ada di sana. **Menambah jubin acara baharu atau aset bermusim tidak memerlukan keluaran apl.**

Bait aset diberi checksum SHA-256 untuk mengelakkan peracunan CDN. `id` + `version` aset memacu pembatalan cache.

### 3. Jambatan Keupayaan adalah satu-satunya API yang dilihat alat

Alat tidak pernah menyentuh DOM di luar kawasan templatnya, tidak pernah memanggil `fetch` secara terus, tidak pernah membaca sistem fail. Ia memanggil kaedah `host.*` berversi. Definisi kanonik kontrak ini adalah `packages/core/src/host-v1.ts` - SDK pengarang-alat `@lolly-tools/core`, supaya pihak ketiga boleh membina berdasarkannya tanpa bergantung kepada enjin; `engine/src/bridge/host-v1.ts` adalah eksport semula jenis daripadanya, dan kod enjin/cangkerang terus mengimport daripada laluan itu tanpa berubah:

| API Jambatan | Apa yang dilakukannya |
|---|---|
| `host.profile` | Nama pertama, e-mel, gambar kepala, bandar pengguna, dsb. Pra-isi input melalui `bindToProfile`. |
| `host.assets` | Pertanyaan katalog, resolusi aset, UI pemilih yang disediakan hos. |
| `host.state` | Simpan / muat slot input. IndexedDB pada web, sistem fail pada Tauri, memori pada CLI. |
| `host.clipboard` | Tulis teks atau imej ke papan keratan (dengan sandaran platform). |
| `host.export` | Rasterkan atau siri sasaran render. Menggunakan tera air untuk alat eksperimental. |
| `host.net` | Fetch berdaftar-benar - hanya tersedia jika alat mengisytiharkan keupayaan `"network"`. (Tiada alat yang dibawakan kini menggunakannya.) |

Permukaan pilihan dan tambahan hanya muncul apabila cangkerang menyediakannya. Sesetengah adalah **berpagar-keupayaan** - hanya didedahkan apabila alat mengisytiharkan bendera yang sepadan: `host.compose` (benamkan render alat lain - `compose`), `host.capture` (tangkapan halaman untuk URL Screenshot - `capture`) dan `host.recorder` (tangkapan mikrofon/kamera/paparan untuk alat rakaman - `microphone` / `camera` / `screen`). Selebihnya **dikesan-ciri** - hadir apabila sahaja cangkerang boleh menyediakannya, dengan alat mengekalkan sandaran untuk cangkerang yang tidak boleh.

Beberapa permukaan utama, untuk menunjukkan skopnya - [Host API](/info/host-api.html) mendokumenkan setiap satu, dan `packages/core/src/host-v1.ts` adalah kontrak itu sendiri:

| Surface | Sejak | Apa yang ditambahnya |
|---|---|---|
| `host.tokens` | 1.0 | Token reka bentuk DTCG - primitif milik jenama sendiri |
| `host.text` | 1.0 | Text-to-path melalui HarfBuzz WASM (keupayaan `wasm` menandakan alat yang bergantung kepadanya) |
| `host.media` | 1.4 | Bingkai kamera langsung yang menggerakkan hook `onFrame`. Peningkatan progresif, sengaja *tidak* digating oleh flag `camera` - alat sedemikian masih berfungsi sebagai alat still-image biasa |
| `host.color` | 1.40 | Matematik warna perseptual: ΔEOK, kontras WCAG + APCA, ramp OKLab, class-break, palet kategori, skema harmoni (1.60), pencampuran CSS Color 4 dan gradient baking (1.68). Tulen dan segerak - shell menyambungkan `makeColorApi()` milik enjin dan bukannya melaksanakan apa-apa sendiri, jadi ia tidak boleh menyimpang |
| `host.images` | 1.60 | Nyahkod / saiz semula / kod semula byte pada peranti - laluan penukaran (HEIC → JPEG, mampatkan ke WebP, downscale). Dihantar dalam web shell sebagai lazy facade, jadi penyahkod HEIC tidak pernah masuk ke dalam boot chunk |
| `host.geom` | 1.64 | Geometri vektor tepat: boolean laluan, offsetting, stroke-to-fill, spline lowering, penyederhanaan, hit testing. Turut tulen, segerak dan disambungkan daripada enjin (`makeGeomApi()`); kegagalan *dikembalikan*, tidak pernah di-throw |

Selebihnya mengikut peraturan yang sama dan didokumenkan bersama: `pdf` (1.8) dan `pptx` (1.58) untuk pembedahan dokumen pada peranti, `audio` (1.71) dan `speech` (1.96) untuk analisis klip dan TTS/transkripsi pada peranti, `viz` (1.72) untuk kontrak pengganti MilkDrop, `codec` (1.100) dan `layers` (1.102) untuk output bit-dalam dan bitmap berlapis, `upscale` (1.101) dan `matte` (1.103) untuk model pada peranti, `raster` (1.105) untuk hooks yang melakukan kerja piksel sendiri, `connectors` (1.106) untuk anak panah selamat-eksport dan `c2pa` (1.85) untuk menandatangani bait siap. Bilangannya berkembang; peraturannya tidak.

Keupayaan yang boleh diisytiharkan ialah: `network`, `filesystem`, `clipboard`, `camera`, `microphone`, `screen`, `ffmpeg`, `wasm`, `capture`, `compose`. (`screen`, ditambah dalam 1.54, adalah tangkapan paparan melalui `host.recorder` - pengguna memilih skrin/tetingkap/tab dalam UI asli pelayar; berbeza daripada `capture`, yang merasterkan URL yang dinamakan oleh alat itu sendiri.)

Alat yang sama berjalan dalam pelayar, Tauri dan CLI tanpa kepala kerana setiap cangkerang melaksanakan antara muka ini - alat itu tidak pernah tahu di mana ia berada.

Jambatan ini berversi. Menambah kaedah adalah versi minor. Membuang atau menukar tandatangan adalah kenaikan versi major. Apabila v2 dilancarkan, v1 mesti terus berfungsi.

### 4. ID aset adalah kekal selamanya

`suse/logo/primary` adalah kontrak. Sebaik sahaja diterbitkan:
- ID tidak pernah berubah, tidak pernah digunakan semula.
- Perubahan bait → naikkan `version` dalam manifes.
- Digantikan dengan aset baharu → tetapkan `deprecated: true` dan secara pilihan `replacedBy`.
- Rujukan sedia ada sentiasa dapat diselesaikan.

Ini menjadikan keadaan alat yang disimpan dan pautan berkongsi-URL tahan lama merentasi tahun.

### 5. Mod URL adalah kelas pertama

Setiap input mesti boleh diungkapkan sebagai parameter URL:

```
lolly.tools/#/tool/qr-code?url=https://suse.com&ecl=H
```

![Pautan itu sendiri, tanpa apa-apa lagi di dalamnya, adalah aset yang siap](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Fsuse.com%26ecl%3DH%26full&width=760&height=760&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-url-mode-qr)

Mod CLI adalah mod URL di bawah pengangkutan berbeza - cangkerang CLI membina objek keadaan-URL daripada argv dan menjalankan paip enjin yang **sama**. Terdapat satu laluan render. CLI tidak boleh menyimpang daripada GUI kerana ia bukan pelaksanaan berasingan.

`url-mode.ts` mengendalikan pusing ulang (hurai dan siri). Satu set **parameter terperuntuk** tidak pernah dihantar kepada alat sebagai input: kawalan output (`format`, `export`, `copy`, `filename`, `width`/`w`, `height`/`h`, `unit`, `dpi`), dail cetakan dan asal usul (`bleed`, `marks`, `profile`, `password`, `c2pa`, `imprint`, `durable`, `meta`, `hdr`, `depth`, `cuts`) dan pembawa keadaan (`template`, `z` - token padat "Shortest link" - dan `zx`, yang sama disulitkan di bawah kata laluan). Set `RESERVED` dalam `engine/src/url-mode.ts` adalah pihak berkuasa dan disemat oleh satu ujian; [URL Mode](/info/url-mode.html) mendokumenkan setiap satu daripadanya, termasuk beberapa yang tidak disenaraikan di sini. Input aset dalam mod URL disirikan mengikut `id`-nya; masa jalan menyelesaikannya melalui `host.assets.get()` sebelum penghidratan. `width`/`height` adalah nilai dalam `unit` (lalai `px`, juga `mm`/`cm`/`in`/`pt`/`pc`); dengan unit fizikal, `dpi` menetapkan resolusi raster. Ia menetapkan saiz dokumen kanvas dan pra-isi panel dimensi eksport.

Kerana setiap input mengembara dalam pautan, perubahan parameter adalah aset siap yang berbeza. Keseluruhan palet ini adalah satu warna benih, satu harmoni dan satu kiraan langkah:

![Sembilan langkah merentasi empat rona, semuanya tumbuh daripada warna benih tunggal yang dibawa dalam pautan](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3De0521a%26harmony%3Dtetrad-4%26steps%3D9%26full&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-url-palette)

### 6. Storan melalui titi, bukan terus

Kelongsong web: IndexedDB. Tauri: sistem fail. CLI: dalam-memori. Alat hanya nampak `host.state.save(slot, data)` dan `host.state.load(slot)`. `localStorage` tidak digunakan - ia terlalu kecil dan tidak boleh menyimpan blob.

Pengguna boleh menyimpan pelbagai slot suntingan bernama bagi setiap alat dan kembali ke setiap sesi kemudian. Tiada penciptaan akaun diperlukan; keadaan adalah setiap peranti. Oleh kerana titi adalah satu-satunya sempadan, keadaan setiap peranti itu juga *mudah alih*: `shells/web/src/data-transfer.ts` membaca semula segala-galanya melalui `host.profile`/`host.state`/`host.assets` ke dalam satu zip `lolly-backup` yang diimport pada mana-mana pemasangan lain - jawapan luar talian kepada "pindah ke peranti baharu" yang tidak memerlukan pelayan (spesifikasi penuh: `docs/data-transfer.md`). Integrasi SUSE ID (penyegerakan pelbagai peranti) ialah pencapaian masa depan di atas ini.

### 7. Tag kematangan menjawab risiko "diluluskan jenama" mengikut reka bentuk

Setiap alat mengisytiharkan `status: official | community | experimental` dalam manifesnya. Galeri diisih mengikut status. Alat eksperimen menandatera eksport mereka secara automatik - tanda air dikenakan oleh `host.export.render`, bukan oleh alat, jadi ia tidak boleh dipilih keluar oleh pengarang alat bukan-rasmi.

Ini ialah jawapan struktural kepada risiko persepsi bahawa penggunaan mana-mana alat membayangkan kelulusan jenama. Jawapan proses (barisan semakan, gerbang SUSE ID) berlapis di atasnya.

### 8. Input alat ditaip melalui manifes, termasuk aset

Input mengisytiharkan `type`: `text`, `longtext`, `number`, `boolean`, `color`, `select`, `asset`, `date`, `time`, `datetime-local`, `url`, `blocks`, `vector`, `table` dan `file`. Hos merender kawalan generik bagi setiap jenis daripada manifes - alat menulis sifar kod kawalan. (Pra-isi daripada profil pengguna bukan satu jenis - mana-mana input boleh membawa `bindToProfile`.) Tiga membawa lebih banyak berat berbanding yang lain:

- **`asset`** (dengan `filter` dan `allowUpload`) ialah titi kepada sistem aset global; `allowUpload: false` ialah tuas penguatkuasaan jenama untuk perkara seperti logo jubin penajaan yang mana hanya aset pustaka dibenarkan. Muat naik pengguna menggunakan bentuk `AssetRef` yang sama seperti aset pustaka, jadi alat mengendalikannya secara sama.
- **`blocks`** ialah kumpulan medan berulang - jadual mini di dalam satu input, disunting dalam panel sisi, dengan menu tambah yang ditaip/dibezakan dan medan aset setiap blok. Klik pada blok yang dirender di atas kanvas memfokuskan baris blok itu. Digunakan oleh `meeting-planner`, `chart-creator`, `event-name-badge`, `wayfinding-signage`, `color-block` dan `digi-ad`.
- **`vector`** mengumpulkan set nombor tetap (contohnya transformasi) ke dalam satu kawalan sebatian; **`file`** menyimpan fail pengguna sendiri sebagai bait dalam memori untuk utiliti transformasi pada peranti (contohnya `strip-data` dan `compress-pdf`).

### 9. Templat tanpa logik (Handlebars, bukan EJS)

Handlebars dipilih berbanding EJS secara sengaja:
- Tanpa logik. Templat boleh dikarang oleh bukan pembangun.
- Selamat secara lalai. `{{x}}` melarikan diri HTML; `{{{x}}}` adalah mentah pilih-masuk.
- Tiada JS sembarangan dalam templat bermakna tiada permukaan audit XSS setiap templat.

Logik tinggal dalam `hooks.js` di mana ia eksplisit dan boleh disemak. Pembantu Handlebars yang tersedia: `{{default}}`, `{{upper}}`, `{{lower}}`, `{{eq}}`, `{{markdown}}`, `{{asset ref}}`, `{{asset ref "property"}}` (ditambah pembantu format-data `icsStamp`/`rfcText`/`csvCell` digunakan oleh templat `.ics`/`.vcf`/`.csv` yang berkaitan).

### 10. Alat menggubah alat

Satu alat boleh membenamkan render alat **lain** tanpa import alat-ke-alat - gubahan diselesaikan oleh enjin, bukan sekali-kali oleh kod alat. Terdapat dua permukaan:

- **Manifes deklaratif** - `composes: [{ id, tool, inputs, format?, width?, height? }]`. Enjin merender anak bernama dan meletakkan hasil dalam templat tanpa logik sebagai `{{asset <id>}}`. `event-name-badge` menggubah `qr-code` sebagai SVG hari ini.
- **URL benam mudah alih** - `<img src="https://lolly.tools/tool/<id>.<ext>?<inputs>">`. Kelongsong merender anak itu **secara tempatan** (piksel pemegang tempat dipaparkan sehingga render tempatan selesai); tiada apa yang pernah diambil daripada `lolly.tools`.

Gubah render mana-mana alat: anak **SVG** kekal sebagai vektor sebenar apabila induk mengeksport kepada SVG atau PDF dan merasterkan dengan tajam untuk PNG; anak **PNG/JPG/WEBP** dibenamkan sebagai imej. Memerlukan keupayaan `compose`. Anak gubahan adalah perantaraan - tidak pernah ditanda air atau distempel provenans - dan gubahan merosot dengan anggun: kelongsong yang tidak dapat merender anak hanya mengetepikan slot itu dan induk tetap dirender.

---

## Apa yang kami sengaja pilih untuk tidak dilakukan

- **Tiada EJS / tiada JS sewenang-wenangnya dalam templat.** Permukaan XSS adalah sifar. Logik berada dalam `hooks.js`.
- **Tiada CMS aset yang wajib.** Individu memasukkan fail kreatif mereka sendiri terus ke dalam katalog mereka di dalam aplikasi (paparan [Katalog](/info/using.html) dan Studio Jenama) - tiada pelayan, tiada konsol pentadbir. Kerja diserahkan sebagai satu **sesi**: pautan kongsi membawa seluruh keadaan, dan sesi yang sama turut serta dalam sandaran atau melalui sesi kerjasama. Sesiapa yang mengawal penggunaan itu kemudiannya boleh mengunci satu sesi kongsi sebagai satu **templat** - buka pautan itu, rekodkan nilainya sebagai entri templat dalam direktori alat itu di dalam pek jenama dan commit - selepas itu ia muncul dalam pemilih "New from template" alat itu dan boleh dipaut terus sebagai `?template=<id>`. Git ialah langkah kunci pemilik penggunaan, bukan sekali-kali langkah pencipta. Untuk katalog yang *dikongsi dan ditadbir*, sesebuah organisasi **boleh** menguruskan direktori aset dengan cara yang sama dan mengawal kemas kini melalui semakan PR - satu model tadbir urus yang tersedia, bukan satu keperluan aplikasi.
- **Tiada RBAC yang dipaksa.** Aplikasi terbuka bersifat akses awam secara lalai; risiko jenama diuruskan melalui tag kematangan + tera air. Organisasi yang mahukan kawalan lebih ketat melapiskan pengesahan miliknya sendiri di atas katalog yang disemak git di atas.
- **Tiada pangkalan data pusat.** Semua keadaan pengguna adalah bagi setiap peranti. Integrasi SUSE ID berada dalam pelan hala tuju tetapi bukan penghalang pelancaran.
- **Tiada laluan kod alat/enjin yang dikongsi.** Enjin itu bersumber terbuka dan begitu juga alat tanpa jenama dalam `community/`; satu pek jenama seperti `brands/suse/` yang persendirian membawa alat dan katalog miliknya sendiri di bawah terma tersendiri. Walau apa pun caranya, pemisahan itu dikuatkuasakan (tiada import silang daripada `engine/` ke dalam kandungan alat) supaya pemisahan itu kekal bersih.

---

## Kitaran hayat, hujung ke hujung

Seorang pengguna membuka `lolly.tools/#/tool/qr-code?url=https://suse.com&ecl=H`:

1. **Boot.** Kelongsong web membuka IndexedDB, membina titi keupayaan, menyegerakkan katalog alat dan aset (atau memuatkan daripada cache apabila luar talian).
2. **Laluan.** Hash URL → paparan `tool`, dengan `qr-code` dan parameter URL diekstrak.
3. **Muat.** `loadTool('qr-code', fetchFile)` mengambil `tool.json`, mengesahkan terhadap Skema JSON, mengambil sumber `template.html`, `styles.css` dan `hooks.js`.
4. **Huraikan keadaan URL.** `parseUrlState` menterjemah parameter URL kepada nilai input awal. Rujukan aset (`?logo=suse/logo/primary`) dihuraikan sebagai objek `{ id, _unresolved: true }` yang ringan.
5. **Masa jalan.** `createRuntime(tool, host, initialValues)` membina model input (menggabungkan data profil, lalai dan nilai awal), menyelesaikan rujukan aset melalui `host.assets.get()`, memuatkan hook (`host` bersfera-tutupan, tidak dikotakpasir), memanggil `hooks.onInit`.
6. **Render.** Kelongsong melanggan kepada masa jalan; pada setiap perubahan keadaan ia menerima `{ model, hydrated }`. Ia merender kawalan input daripada model dan menulis HTML templat terhidrat ke dalam `#tool-canvas`.
7. **Berinteraksi.** Pengguna menaip dalam input → `runtime.setInput(id, value)` → kekangan dikenakan → `hooks.onInput` dipanggil → hidrat semula → render semula. Kanvas dikemas kini secara langsung.
8. **Eksport.** Pengguna klik Muat Turun(PNG) → `runtime.export(canvasNode, 'png')` → `host.export.render` (merasterkan melalui dom-to-image-more; SVG/PDF melalui pemvektor berjalan-DOM khusus) → blob → `host.export.download`. Julat format yang boleh dipilih oleh alat adalah luas, dan enum `render.formats` dalam `schemas/tool.schema.json` ialah kuasa muktamad mengenainya - raster dan raster apung, vektor dan fail potong, cetak/CMYK, gerakan, dokumen boleh sunting (`pptx`, `docx`, `odt`), palet dan output data/teks, fail audio dan fon. [Mod URL](/info/url-mode.html) menamakan setiap id dan apa yang dihasilkannya. Audio berada dalam enum itu seperti mana-mana yang lain (`wav`, `mp3`, `m4a`, `opus`, diisytiharkan oleh audiogram dan alat rakaman); secara berasingan, mod `render.capture` alat rakaman menggerakkan `host.recorder`, yang mana rakamannya tiba sebagai Blob siap dalam apa jua bekas yang dirakam oleh pelayar. (Alat yang menetapkan `render.export: false` - contohnya Palet Warna, Pemasa Detik Kira, Buang Data Tersembunyi, Pembantu Teks, Mampat PDF - menyembunyikan kawalan muat turun/format/dimensi.) Unit fizikal ditukar mengikut format di sini (PDF → titik halaman sebenar, raster → piksel pada DPI dengan cebisan `pHYs`). Metadata pengarangan/provenans (pengarang, alat, sumber - dibina oleh `engine/src/metadata.ts`) dibenamkan mengikut format: PNG iTXt, JPEG EXIF, kamus maklumat PDF, SVG `<metadata>`, komen GIF. Alat eksperimen mendapat tanda air dimasukkan oleh hos, bukan alat.

![Panel eksport yang dibuka oleh `?options`: pasangan nama fail dan format, saiz output dan kawalan yang menulis fail](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=aud-export-popup)

Kitaran hayat sama dalam Tauri. Kitaran hayat sama dalam CLI - jsdom menyediakan DOM tanpa kepala; output pergi ke fail atau stdout.

---

## Status sumber terbuka

**Kod adalah MPL-2.0.** `engine/`, `shells/*`, `services/*`, `schemas/` dan `docs/` bersumber terbuka di bawah **MPL-2.0** - platform perancah neutral vendor untuk alat jenama, dengan setiap unit boleh hantar dalam repositori tersendiri di bawah [github.com/lolly-tools](https://github.com/lolly-tools).

**Kandungan alat dihantar sebagai pek jenama**, masing-masing dengan terma tersendiri (lihat `NOTICE.md` pek itu). `community/` ialah repositori awam [`lolly-tools`](https://github.com/lolly-tools/lolly-tools) dan alat tanpa jenamanya juga MPL-2.0. `brands/suse/` ialah pek `suse-lolly` yang persendirian: alat SUSE dan katalog SUSE, **hak milik SUSE**, termasuk muzik PremiumBeat berlesennya. `brands/lolly-start/` ialah jenama permulaan kosong yang dimiliki oleh repositori ini. Fon dihantar di dalam pek di bawah **SIL Open Font License 1.1** - pek SUSE membawa taip aksara SUSE dan SUSE Mono.

`tools/` dan `catalog/` pada root repo ialah *paparan* yang gitignored: satu profil menyusunnya daripada `community/` ditambah pek jenama aktif, itulah sebabnya setiap skrip dan shell membaca kedua-dua laluan itu dan tidak sekali-kali satu pek secara langsung.

Pemisahan itu dikuatkuasakan - tiada import silang daripada `engine/` ke dalam kandungan alat - supaya sempadan platform/kandungan kekal bersih.

---

## Di mana enjin berakhir dan hos bermula

Jika anda boleh menghuraikannya dalam data tulen + Handlebars → **enjin**.
Jika ia menyentuh DOM, sistem fail, rangkaian atau mana-mana API pelayar/OS → **hos**.

Garisan itu tajam dengan sengaja. Enjin ialah bahagian sumber terbuka. Segala yang mengetahui tentang SUSE, platform khusus atau persekitaran masa jalan kekal di luarnya.

Untuk peringkat butiran seterusnya, [`engine/README.md`](../engine/README.md) menyenaraikan setiap modul enjin dan apa yang menjadi tanggungjawabnya, dan [Model Ancaman & Sempadan Amanah](/info/threat-model.html) merekodkan di mana garisan yang sama itu turut menjadi sempadan amanah.
