# Ikhtisar

![Ikon Lolly - Permen lolipop hijau dan putih berukuran besar](/info/icon.svg)

Dokumen ini mencatat tujuan, struktur dan keputusan arsitektur untuk platform Lolly. Ini mencerminkan baik visi produk maupun kondisi basis kode saat ini.

> **Status:** Lolly adalah prototipe internal dalam **uji coba tertutup yang belum selesai**. Mesinnya deterministik dan konsisten secara internal, tetapi produknya masih dini - SUSE adalah pelanggan nomor satu - dan mesin kriptografi serta penguraian filenya saat ini sedang menjalani pengerasan infrastruktur ketat milik SUSE, mempersiapkan skala enterprise (kami sangat mahir dalam hal ini). Bacalah arsitektur di bawah ini sebagai niat desain yang sedang diuji, bukan produk jadi yang tersertifikasi. Lihat [Adopsi & Tata Kelola](/info/adoption-governance.html#status) untuk cara uji coba ini dijalankan dan diukur.

> **Cara membaca halaman ini.** Halaman ini memuat dua jenis materi, secara berurutan. Separuh pertama adalah
> **mengapa ini ada**: masalahnya, positioning-nya dan siklus hidup yang dilalui satu aset. Mulai dari
> [Gambaran besar](#the-big-picture-how-the-layers-fit) dan seterusnya adalah
> **bagaimana lapisan-lapisannya menyatu**: dokumen arsitektur untuk kontributor, mencakup pemisahan
> engine/shell/pack, tata letak repositori, target pengiriman dan komitmen yang membatasi setiap
> perubahan pada platform. Jika Anda di sini untuk mengubah basis kode alih-alih memahami
> produknya, mulailah dari gambaran besar.
>
> Dua dokumen pendamping menyelami lebih dalam daripada halaman ini. [`engine/README.md`](../engine/README.md) di
> repositori adalah peta modul-demi-modul dari engine, dengan tabel yang dihasilkan otomatis dari setiap modul dan
> apa yang diuraikan atau ditulisnya. [Model Ancaman & Batas Kepercayaan](/info/threat-model.html)
> adalah arsitektur yang sama dibaca sebagai batas kepercayaan, dan itu adalah halaman yang tepat untuk pertanyaan apa pun tentang
> apa yang dianggap engine sebagai tidak tepercaya.

---

## Mengapa ini ada

Tim menghadapi masalah yang berulang: pekerjaan kreatif dan konten yang bisa diulang, terlalu dapat diprediksi untuk membenarkan tangan terampil setiap kali, tetapi terlalu sensitif terhadap kualitas untuk diserahkan tanpa pengaman. Hasilnya adalah salah satu dari: throughput lambat (bottleneck spesialis), inkonsistensi (orang memakai alat apa pun yang mereka punya) atau vendor lock-in (DAM SaaS yang mengendalikan template Anda).

Platform ini adalah jawaban langsungnya:

> **Kreatif dan konten programatik dalam skala besar** - pembuatan aset tanpa tenaga kerja, dengan aturan di bawah kendali terpusat, untuk karyawan, vendor dan mitra.

Lolly bukan tempat sebuah design system diciptakan - melainkan tempat design system itu diproduksi. Anggap seperti sebuah vending machine untuk desain: buat pilihan, dapatkan hasil. Setiap saat. Engine ini bekerja untuk kualitas tertinggi yang bisa dihasilkan setiap format pada perangkat keras di hadapan Anda, dan engine yang sama membuat berkas yang sama pada setiap platform tempatnya dirilis.

Hasilnya adalah **kelimpahan**: setiap acara memiliki signage yang benar, setiap peringatan CVE cocok dengan gaya perusahaan, setiap label tercetak bersih, setiap tanda tangan email selalu terkini - semua tanpa tiket desain. Platform ini menangani kreatif operasional yang berulang. Ini sengaja bukan alat kreatif custom - desainer tetap memegang kendali atas karya unggulan.

### Berinovasi secara probabilistik, berskala secara deterministik

Setiap perdebatan tentang AI dalam alur kerja kreatif terhenti pada pertanyaan yang sama: bagian mana dari ini yang menjadi tugas mesin? Ini pertanyaan lama dengan jawaban yang sudah mapan. Juru tulis dan pelukis manuskrip sudah bekerja di antara dua instrumen - sketsa bebas, di mana tidak ada yang tetap dan segalanya bisa dicoba, dan mesin cetak, yang menakutkan justru karena ia mengikat komitmen. Sketsa adalah tempat seni terjadi. Mesin cetak adalah cara seni itu menjangkau siapa pun. Tak seorang pun mencampuradukkan keduanya, dan keduanya terus maju - tinta baru, huruf baru, mesin cetak baru - masing-masing berkembang selaras dengan kerajinan dan maksud yang dilayaninya.

Lolly menarik garis yang sama. Jelajahi secara probabilistik: sebuah model, seorang desainer, ide kasar, sebuah prompt yang menuju ke arah yang tidak direncanakan siapa pun. Lalu berskalalah secara deterministik - hal yang menjangkau sepuluh ribu output adalah sebuah *alat*, dan alat merender dengan cara yang sama setiap kali dari input yang bisa Anda baca. Eksplorasi tetap bebas karena tidak ada apa pun di hilir yang bergantung pada hasil yang sama dua kali. Outputnya mendapatkan kepercayaan karena bukan tebakan. Membawa eksperimen AI ke hasil yang dapat diprediksi dan direproduksi bukanlah disiplin baru; itu adalah pembagian kerja yang sama yang membuat karya cetak layak dipercaya sejak awal.

> Percayai proses kreatif, berskala dengan kedisiplinan.

### Melawan alternatif

::: figure positioning-comparison
Kelengkapan kapabilitas di antara alat kreatif hari ini, diteliti Agustus 2026. Penilaian: 0 tidak ada, 25 tingkat akal-akalan, 50 nyata tetapi terbatas atau parsial, 75 kuat dengan catatan, 100 kompetensi inti.
:::

Kesenjangannya jelas: tidak ada yang tersedia hari ini yang memberi kami output constraints-first, mampu offline, keterampilan rendah, dan dapat diakses secara internal. Lolly bahkan menyertakan kanvas terbuka - **Design** - di mana warna, tipografi dan aset menaati brand global, sehingga penataan bebas tetap constraints-first. Yang **bukan** ini adalah suite desain tanpa batasan: desainer tetap memakai Illustrator dan Figma untuk karya unggulan custom. Permutasi dapat dirakit dengan alat ini.

![Setiap alat di pustaka sebagai kartu, dikelompokkan menurut kategori, sehingga seorang produser memilih satu dan langsung mulai](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%2C.brand-tips%7Bdisplay%3Anone!important%7D&tolerance=0.03&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=aud-gallery-landscape)

**Gunakan untuk:** Pembuatan cepat aset kreatif operasional - ubin acara, badge nama, tanda tangan, peringatan CVE, kode QR, kartu sosial, label konsinyasi, laporan terstruktur.

**Jangan gunakan untuk:** Konten unggulan custom.

---

## Siklus hidup sebuah kampanye

Cara paling jelas untuk melihat apa itu Lolly bukanlah daftar fitur - melainkan mengikuti satu aset saat berpindah dari tangan ke tangan. Amati satu kartu kampanye yang dilokalkan bergerak melalui organisasi:

1. **Sang kreatif menetapkan aturan.** Seorang desainer menyusun template dasar di alat Design, menetapkan tipografi dan variabel warna brand secara hard-coded. Mereka bukan membuat satu kartu - mereka melakukan pekerjaan fondasi *sekali* agar tidak pernah perlu melokalkan secara manual lagi.
2. **Sang developer menskalakannya.** Template yang sama dihubungkan ke pipeline malam hari lewat CLI, sehingga chart segar atau varian bahasa baru dihasilkan secara otomatis - tidak ada desainer yang membuka ulang file.
3. **Sang produser tinggal memakainya.** Seorang sales rep, offline di pesawat, membuka alat yang sama dan menghasilkan deck yang sepenuhnya on-brand untuk pertemuan klien. Tanpa keterampilan desain, tanpa jaringan, tanpa menunggu.

"Chart segar" pada langkah kedua adalah render seperti ini, dihasilkan dari sebuah string data dan segenggam parameter tanpa seorang pun membuka file desain:

![Sebuah stacked area chart berjudul, tiga seri-nya diberi pita dalam palet cool dengan axis, legend dan judul semuanya ditempatkan oleh templat, bukan secara manual](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3FchartType%3Darea%26stackMode%3Dstacked%26palette%3Dcool%26heading%3DProduct%2520mix%2520by%2520quarter%26full&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-lifecycle-chart)

Intinya bukan bahwa Lolly bagus untuk desainer *dan* bagus untuk developer *dan* bagus untuk sales, masing-masing dalam ruang hampa. Ini adalah **lomba estafet**: pekerjaan awal sang kreatif diskalakan oleh developer, yang pada gilirannya memberdayakan produser. Pengalaman tanpa hambatan bagi sales rep non-teknis di pesawat itu hanya *mungkin* karena kedisiplinan yang ditetapkan desainer dan diterapkan developer.

Itulah pengganda kekuatannya. Lolly bukan laci berisi alat-alat terpisah untuk peran-peran terpisah - ini satu siklus hidup aset deterministik yang disentuh setiap peran, dan setiap tangan yang dilaluinya melipatgandakan nilai tangan sebelumnya.

---

## Satu persetujuan, sepuluh ribu aset

Karena persetujuan berada di alat, bukan di file (lihat [Bagaimana Lolly dibandingkan](/info/positioning.html)), skala berhenti menjadi masalah peninjauan. Setujui alat kartu sosial yang dilokalkan sekali, lalu hasilkan **10.000 aset dalam 12 bahasa** dari sebuah spreadsheet - dan tidak satu pun dari aset itu memerlukan pemeriksaan kepatuhan baru dari legal atau brand, karena template asal semuanya sudah disetujui.

Alat deterministik yang sama mencapai skala itu dengan tiga cara, semuanya menghasilkan output identik yang sudah disetujui sebelumnya:

- <!--i:people--> **Seseorang, di dalam aplikasi.** Grid batch `/pro`: tempel atau impor barisnya, dapatkan satu aset jadi per baris, unduh zip-nya. Tanpa keterampilan desain, tanpa tiket, tanpa menunggu.
- <!--i:code--> **Seorang developer, dari baris perintah.** CLI menjalankan engine yang *sama* dan jalur render yang *sama* secara headless, sehingga alat itu bisa dijalankan berurutan di seluruh 10.000 baris dalam sebuah skrip atau pipeline malam hari. Panggilan `lolly <tool> --field=…` dalam sebuah loop adalah keseluruhan integrasinya.
- <!--i:cpu--> **Sebuah sistem atau agen AI, lewat MCP.** Alat yang sama dijalankan secara programatik, dengan fidelitas yang sama dan skala yang bahkan lebih besar - karena mesin tidak akan bosan sementara ribuan file terus masuk.

![Mode Batch pada instalasi baru: satu baris kosong menunggu sebuah alat, dengan seluruh permukaan spreadsheet dan tombol Render-nya sudah siap sebelum data apa pun tiba](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=ov2-batch-grid)

Satu set batasan brand, ditetapkan sekali oleh seorang desainer; tiga rute menuju output identik yang sudah disetujui sebelumnya - dan rute mesin berskala paling jauh dari semuanya, karena ia tidak pernah lelah selagi file terus mengalir masuk.

---

## Gambaran besar: bagaimana lapisan-lapisannya menyatu

Semua yang ada dari sini ke bawah adalah arsitektur. Diagramnya adalah seluruh sistem dalam satu pandangan: alat adalah
data di bagian atas, engine di tengah tidak mengetahui apa pun tentang platform mana pun, shell di bawahnya
mengimplementasikan satu kontrak, dan katalog memasok kontennya.

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

### Tata letak repositori

Konten dipasang sebagai pack: `community/`, `docs/`, setiap `shells/*`, kedua `services/*` dan `brands/suse` masing-masing adalah repositori tersendiri, di-checkout sebagai git submodule dari repositori ini. Induknya memiliki `engine/`, `schemas/`, `scripts/`, `tests/`, `api/`, `brands/lolly-start/` dan `profiles.json`. Lihat [Panduan Build » Mendapatkan sumbernya](/info/build-guide.html) untuk perintah checkout dan alur kerja lintas-repositori.

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

## Model pengiriman platform

Platform ini berjalan di berbagai permukaan - web PWA, Tauri desktop/mobile, CLI yang bisa diskrip dan TUI interaktif. Semuanya memakai engine yang sama dan file alat yang sama.

### Web (PWA) - distribusi utama
Di-hosting di URL yang dikendalikan SUSE. Bekerja secara offline setelah service worker menyimpan cache alat dan aset. Di sinilah sebagian besar karyawan, vendor dan mitra akan memakai platform ini. Tidak perlu akun - status disimpan di IndexedDB per perangkat.

Shell web bersifat responsif dari satu tata letak. Di desktop, sebuah alat adalah sidebar kontrol yang dapat diubah ukurannya di samping panggung pratinjau dengan navigasi kanvas asli-trackpad (roda Cmd/Ctrl atau cubit untuk zoom di sekitar kursor, seret Space atau tombol tengah untuk pan, tombol `0`/`1`/`+`/`−` dan HUD Fit/%). Di mobile (≤640px) kontrol menjadi sheet berlabuh di atas dengan grip seret yang mengunci ke peek/half/full (ketuk untuk beralih) di atas pratinjau layar penuh statis, dan tombol **Render** mengambang membuka kontrol **Export** di popup bottom-sheet. Sentuhan mendapat pinch-zoom dan drag-pan pada pratinjau. Jalur render dan kontrol ekspor identik di keduanya - hanya chrome-nya yang menyesuaikan.

![Tampilan split desktop - kontrol yang dihasilkan dari manifest di sebelah kiri, kanvas langsung di sebelah kanan](/t/url-shot?url=%2F%23%2Ftool%2Fchart-creator&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=aud-web-split)

Tool yang sama pada lebar ponsel, tanpa layout kedua yang perlu dipelihara: kontrol menjadi sheet di bagian atas, preview memenuhi seluruh layar dan pill render mengambang di atasnya.

![Sebuah audiogram di layar selebar 430px - lembar kontrol di atas, artwork persegi jadi di bawah dan pil render mengambang](/t/url-shot?url=%2F%23%2Ftool%2Faudiogram%3Faudio%3Dlolly%2Floops%2Ffireplace-loop%26title%3DField%2520notes%26subtitle%3DEpisode%252012%26style%3Dwave&width=430&height=900&dpi=192&waitMs=3200&css=%23ag-wave%7Bdisplay%3Anone!important%7D.ag-ph%7Bdisplay%3Ablock!important%7D&walker=1&format=svg&rasterDpi=110&dark=1&filename=ov2-phone-audiogram)

**Mode batch (`/pro`).** Web shell juga menyediakan grid batch bergaya spreadsheet (`shells/web/src/pro/`) yang me-render banyak baris sekaligus di satu atau banyak tool. Ia melakukan round-trip CSV/TSV plus tempel spreadsheet, template/format/ukuran/unit/dpi per baris, panel samping blocks-editor dengan preview langsung, kolom ekspor yang bisa dilipat, bar tag "relevance" per baris, susun ulang baris dengan drag-handle di kiri, konfirmasi hapus dua langkah, sesi batch tersimpan dan unduhan `.zip`. Inilah permukaan satu-ke-banyak di balik positioning "mass content generation".

### Tauri desktop / mobile
Aplikasi native yang dikemas (footprint kecil via Tauri). Menyediakan ketersediaan offline penuh, akses filesystem untuk tool yang bergantung pada CLI (PDF Smasher, Font Outliner) dan akses kamera. Dijadwalkan untuk peningkatan tooling pertengahan 2026.

### CLI
`lolly <tool-id> [--input=value ...] --output=file.png`

Pengguna desktop dapat menjalankan banyak tool dari terminal. CLI shell memuat engine yang sama, membuat DOM jsdom, menjalankan render path yang sama dan menulis file. URL mode adalah transportnya - CLI bukan implementasi terpisah. Ini menjamin output CLI dan GUI identik.

```bash
lolly qr-code --url=https://suse.com --output=qr.svg
lolly quotes --quote="Ship it." --output=quote.png
lolly                        # lists available tools
lolly qr-code                # lists inputs for that tool
```

### TUI
`npm run tui`

Rekan interaktif dari CLI: aplikasi terminal full-screen yang mengutamakan keyboard (dibangun di atas Ink) untuk menjelajahi tool, mengisi input, menyimpan proyek dan mengekspor - semua tanpa GUI. Host bridge-nya **menggunakan kembali implementasi CLI** untuk format bebas-DOM (SVG/EMF/EPS/HTML + text/data), dan menambahkan state on-disk di bawah `~/.lolly` plus preview inline opsional. Selain itu ia memiliki **tier render browser**: Chromium headless terbatas (yang sama dengan yang diinstal server MCP) yang menghasilkan raster/PDF/video dan capture URL langsung sesuai permintaan - menjalankan salinan web shell yang sudah dibuat sehingga output identik, dan hanya diluncurkan saat pertama kali Anda mengekspor format semacam itu. Jadi `url-shot` (dengan crop + recolor + vector PDF/SVG) dan setiap tool raster/pdf juga berjalan di terminal. Lihat [panduan TUI](/info/tui.html).

Di permukaan mana pun Anda berada, tab Capabilities pada dashboard adalah peta lengkap dari apa yang dinyatakan mampu dilakukan platform, dikelompokkan dan mudah dibaca tanpa membuka satu tool pun.

---

## Kategori tool

Tool diberi tag `category` di manifest-nya untuk pengelompokan galeri.

Baris didaftar sesuai urutan bagian galeri. Bagian `utility` selalu dirender **terakhir** di galeri (setelah setiap kategori lain, termasuk yang akan datang) - itulah laci "Offline Utilities" on-device.

| Kategori | Contoh | Direncanakan |
|---|---|---|
| `everyone` | QR Code Generator, Quote Card, Email Signature, Logo, Wordmark, Audiogram, Battlecards, Sequence Studio, Record | Employee Image Stationery |
| `designer` | Brand Lockup, Design, Chart, Darkroom, Filter, Pose Geeko, Multi-Page PDF | Font Outliner |
| `event` | Meeting Planner, Event Name Badge, Wayfinding Signage, Calendar ICS, Booth Studio | Event Stationery, Bulk Name Badges, Room Agenda Cards |
| `product` | - | CVE Alert, Product Release Announcement, Blog OG Image |
| `utility` | Strip Hidden Data, Text Helper, Compress PDF, Convert Image, Convert Font, Redact, Run Web Code, Screen Capture, URL Screenshot | Unit/format converters, more on-device privacy utilities |

Sel-sel tersebut adalah **contoh, bukan inventaris**. Tool apa saja yang ada adalah properti dari profil yang Anda pasang, bukan dari halaman ini: sebuah brand pack menambahkan miliknya sendiri, dan dapat mengecualikan tool community yang tidak ingin dikirimkannya. `catalog/tools/index.json` - dihasilkan dari manifest, dan registry yang sebenarnya dibaca galeri - adalah daftar otoritatif; untuk menghitung apa yang dipasang sebuah profil, hitung manifest-nya (`ls community/*/tool.json brands/*/tools/*/tool.json`) daripada mempercayai angka yang tertulis di sini. (Sebuah id tool yang ada di dua pack hanya terpasang sekali, dari pack yang menang.)

Tool juga diklasifikasikan menurut status: `official` (disetujui brand, tanpa watermark), `community` (kontribusi eksternal), `experimental` (ekspor berwatermark). Sebagian besar library berstatus `official`; studio yang lebih baru dan tool capture cenderung berada di `community` atau `experimental` selagi menetap. Setiap permukaan menampilkan badge, sehingga pembaca tahu apa yang mereka ambil sebelum membukanya - dan, seperti sel kategori di atas, keanggotaan per-status bergerak terlalu cepat untuk didaftar di sini. Baca dari galeri atau index yang dihasilkan.

**Design** adalah tool pertama yang dibangun di atas mode free-canvas `render.layout: "editor"` - permukaan direct-manipulation tanpa chrome tempat Anda menyeret, mengubah ukuran, memutar dan menempelkan (snap) kotak teks, bentuk dan gambar, lalu mengekspor melalui render path yang sama seperti setiap tool lainnya.

**Strip Hidden Data** adalah **utilitas on-device** pertama (`privacy: "on-device"`): tool transformasi konten yang mengambil file yang *Anda* berikan, memprosesnya sepenuhnya di browser dan mengembalikan salinan bersih - tidak pernah diunggah, tidak pernah diberi watermark, tidak ada provenance yang distempel. **Text Helper** adalah yang kedua - workbench on-device untuk pekerjaan tempel-ke-situs sehari-hari (format JSON, decode JWT, Base64, encode/decode URL, hashing SHA). **Compress PDF** adalah yang ketiga - ia mengecilkan PDF dengan mengompresi ulang gambar-gambarnya, juga sepenuhnya on-device. Penanda dan teks badge-nya "Runs on your device - nothing is uploaded" kini mencakup seluruh rangkaian transformasi: Strip Hidden Data, Text Helper, Compress PDF, **Convert Image** (HEIC/TIFF/AVIF → WebP/JPG/PNG), **Convert Font**, **Redact** (menghancurkan area pada gambar, SVG atau PDF), **Prompt to Image** dan **Rebrand a Deck** (mengubah tema `.pptx` di tempat) di mana profil memasangnya. Ini adalah kategori utilitas privasi yang menggantikan penyerahan file rahasia ke situs-situs bertujuan tunggal.

![Laci Utilities, tempat setiap kartu adalah tool yang mentransformasi file yang sudah Anda miliki](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%2C.brand-tips%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=aud-utilities)

> Catatan: `category` dan `status` didenormalisasi ke dalam `catalog/tools/index.json` (registry yang dibaca galeri) dari setiap `tool.json`. Manifest adalah source of truth - index **dihasilkan** oleh `npm run build:catalog` dan `npm run validate:catalog` akan gagal di CI jika index yang di-commit menyimpang dari manifest.

---

## Komitmen arsitektural

Keputusan-keputusan ini sudah final. Mengubah salah satunya adalah upaya besar - keputusan ini membentuk setiap keputusan lain dalam codebase.

### 1. Tool deklaratif, dengan jalan keluar imperatif

Sebuah tool adalah manifest (`tool.json`) + template (`template.html`) + `hooks.js` opsional.

**Manifest mendeklarasikan input.** Bukan template. Input tidak disimpulkan dari token Handlebars. Manifest adalah kontraknya; template mengonsumsi variabel bernama melalui `{{id}}`.

![Tumpukan kontrol Street Map - dropdown kota, pemilihan tema, slider ketebalan dan pemicu warna, masing-masing diambil dari satu baris manifest](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-street-map-controls)

**Hooks bersifat opsional.** Sebagian besar tool sepenuhnya deklaratif - manifest + template sudah cukup. Tool yang membutuhkan nilai terhitung (encoding QR, pembentukan data chart) menyediakan `hooks.js` yang mengekspos fungsi lifecycle bernama (`onInit`, `onInput`, `onFrame` - hook live-camera per-frame untuk tool motion-reactive - `onLevel`, `beforeExport`, `afterExport`, `exportFile` - jalur transformasi file-in/file-out yang digunakan utilitas on-device seperti Strip Hidden Data - dan `exportStill`, untuk tool yang memiliki raster mendalamnya sendiri). Host memuat hooks melalui `new Function('host', …)` dengan capability bridge disuntikkan sebagai closure scope. Ini adalah **kontrak portabilitas, bukan sandbox keamanan**: hooks tetap berjalan dalam realm halaman dan *dapat* menjangkau `window`/`fetch`/`document` di browser shell - `host.*` adalah permukaan portabel yang didukung, bukan batas yang dipaksakan. Hasil hook async dibatasi waktu (`onInit` 5s, `onInput` 2s, `beforeExport`/`afterExport` 5s, `exportFile`/`exportStill` 10s) dan hasil yang terlambat dibuang; hook *sinkron* yang lepas kendali tidak dapat dihentikan paksa. Karena itu, kode hook pihak ketiga yang tidak tepercaya belum aman dijalankan sampai isolasi Worker hadir.

Ini penting karena: tool deklaratif dapat dibuat oleh non-developer. Jika setiap tool adalah aplikasi web, catatan risiko "keterbatasan skill untuk membuat/memelihara template workhorse" menjadi bottleneck permanen.

### 2. Tool dan asset adalah data, bukan kode yang dibundel

Aplikasi web dan Tauri mengambil katalog tool dan asset dari URL yang diketahui saat boot, menyimpannya secara lokal (cache) dan beroperasi dengan apa pun yang ada di sana. **Menambahkan tile event baru atau asset musiman tidak memerlukan rilis aplikasi.**

Byte asset di-checksum dengan SHA-256 untuk mencegah CDN poisoning. `id` + `version` asset menggerakkan invalidasi cache.

### 3. Capability Bridge adalah satu-satunya API yang dilihat tool

Tool tidak pernah menyentuh DOM di luar area template-nya, tidak pernah memanggil `fetch` secara langsung, tidak pernah membaca filesystem. Mereka memanggil metode `host.*` yang berversi. Definisi kanonis kontraknya adalah `packages/core/src/host-v1.ts` - SDK tool-author `@lolly-tools/core`, sehingga pihak ketiga dapat membangun di atasnya tanpa bergantung pada engine; `engine/src/bridge/host-v1.ts` adalah re-export tipe darinya, dan kode engine/shell tetap mengimpor dari path tersebut tanpa perubahan:

| Bridge API | Apa yang dilakukannya |
|---|---|
| `host.profile` | Nama depan, email, headshot, kota pengguna, dll. Mengisi input di awal via `bindToProfile`. |
| `host.assets` | Query katalog, resolusi asset, UI picker yang disediakan host. |
| `host.state` | Simpan / muat slot input. IndexedDB di web, filesystem di Tauri, memory di CLI. |
| `host.clipboard` | Menulis teks atau gambar ke clipboard (dengan fallback platform). |
| `host.export` | Merasterisasi atau menserialisasi target render. Menerapkan watermark untuk tool experimental. |
| `host.net` | Fetch yang di-allowlist - hanya tersedia jika tool mendeklarasikan capability `"network"`. (Belum ada tool yang dirilis menggunakannya saat ini.) |

Permukaan opsional yang bersifat aditif hanya muncul saat shell menyediakannya. Sebagian bersifat **capability-gated** - hanya diekspos saat tool mendeklarasikan flag yang sesuai: `host.compose` (menyematkan render tool lain - `compose`), `host.capture` (capture halaman untuk URL Screenshot - `capture`) dan `host.recorder` (capture mic/kamera/display untuk tool recording - `microphone` / `camera` / `screen`). Sisanya bersifat **feature-detected** - hadir kapan pun shell dapat menyediakannya, dengan tool tetap memiliki fallback untuk shell yang tidak bisa.

Beberapa permukaan utama, untuk menunjukkan cakupannya - [Host API](/info/host-api.html) mendokumentasikan setiap satu, dan `packages/core/src/host-v1.ts` adalah kontraknya sendiri:

| Surface | Sejak | Apa yang ditambahkannya |
|---|---|---|
| `host.tokens` | 1.0 | Token desain DTCG - primitif milik brand sendiri |
| `host.text` | 1.0 | Text-to-path lewat HarfBuzz WASM (kapabilitas `wasm` menandai alat yang bergantung padanya) |
| `host.media` | 1.4 | Frame kamera live yang menggerakkan hook `onFrame`. Progressive enhancement, sengaja *tidak* di-gate oleh flag `camera` - alat semacam itu tetap berfungsi sebagai alat still-image biasa |
| `host.color` | 1.40 | Matematika warna perseptual: ΔEOK, kontras WCAG + APCA, ramp OKLab, class-break, palet kategorikal, skema harmoni (1.60), pencampuran CSS Color 4 dan gradient baking (1.68). Murni dan sinkron - shell menyambungkan `makeColorApi()` milik engine, bukan mengimplementasikan apa pun sendiri, jadi tidak bisa melenceng |
| `host.images` | 1.60 | Decode / resize / re-encode byte di perangkat - jalur konversi (HEIC → JPEG, kompres ke WebP, downscale). Dikirim di web shell sebagai lazy facade, jadi decoder HEIC tidak pernah masuk ke boot chunk |
| `host.geom` | 1.64 | Geometri vektor presisi: boolean path, offsetting, stroke-to-fill, spline lowering, penyederhanaan, hit testing. Juga murni, sinkron dan tersambung dari engine (`makeGeomApi()`); kegagalan *dikembalikan*, tidak pernah di-throw |

Sisanya mengikuti aturan yang sama dan didokumentasikan bersamanya: `pdf` (1.8) dan `pptx` (1.58) untuk operasi dokumen on-device, `audio` (1.71) dan `speech` (1.96) untuk analisis klip dan TTS/transkripsi on-device, `viz` (1.72) untuk kontrak placeholder MilkDrop, `codec` (1.100) dan `layers` (1.102) untuk output deep-bit dan layered-bitmap, `upscale` (1.101) dan `matte` (1.103) untuk model on-device, `raster` (1.105) untuk hook yang melakukan pekerjaan pixel sendiri, `connectors` (1.106) untuk panah yang aman diekspor dan `c2pa` (1.85) untuk menandatangani byte yang sudah jadi. Jumlahnya bertambah; aturannya tidak.

Capability yang dapat dideklarasikan adalah: `network`, `filesystem`, `clipboard`, `camera`, `microphone`, `screen`, `ffmpeg`, `wasm`, `capture`, `compose`. (`screen`, ditambahkan di 1.54, adalah capture display via `host.recorder` - pengguna memilih layar/window/tab di UI native browser; berbeda dari `capture`, yang merasterisasi URL yang ditentukan tool itu sendiri.)

Tool yang sama berjalan di browser, Tauri dan CLI headless karena setiap shell mengimplementasikan interface ini - tool tidak pernah tahu ia berada di mana.

Bridge ini berversi. Menambahkan metode adalah minor version. Menghapus atau mengubah signature adalah major version bump. Saat v2 dirilis, v1 harus tetap berfungsi.

### 4. ID asset berlaku selamanya

`suse/logo/primary` adalah kontrak. Setelah dipublikasikan:
- ID tidak pernah berubah, tidak pernah digunakan ulang.
- Perubahan byte → naikkan `version` di manifest.
- Digantikan oleh asset baru → set `deprecated: true` dan opsional `replacedBy`.
- Referensi yang sudah ada selalu ter-resolve.

Ini membuat state tool tersimpan dan link yang dibagikan via URL tahan lama selama bertahun-tahun.

### 5. URL mode bersifat first-class

Setiap input harus dapat diekspresikan sebagai parameter URL:

```
lolly.tools/#/tool/qr-code?url=https://suse.com&ecl=H
```

![Link itu sendiri, tanpa apa pun yang lain di dalamnya, adalah asset yang sudah jadi](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Fsuse.com%26ecl%3DH%26full&width=760&height=760&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-url-mode-qr)

Mode CLI adalah URL mode dengan transport yang berbeda - CLI shell membangun objek URL-state dari argv dan menjalankan pipeline engine yang **sama**. Hanya ada satu render path. CLI tidak bisa menyimpang dari GUI karena ia bukan implementasi terpisah.

`url-mode.ts` menangani round-trip (parse dan serialize). Sekumpulan **parameter reserved** tidak pernah diteruskan ke tool sebagai input: kontrol output (`format`, `export`, `copy`, `filename`, `width`/`w`, `height`/`h`, `unit`, `dpi`), dial print dan provenance (`bleed`, `marks`, `profile`, `password`, `c2pa`, `imprint`, `durable`, `meta`, `hdr`, `depth`, `cuts`) dan pembawa state (`template`, `z` - token terpaket "Shortest link" - dan `zx`, versi terenkripsi dengan password yang sama). Set `RESERVED` di `engine/src/url-mode.ts` adalah otoritasnya dan dipatok oleh sebuah test; [URL Mode](/info/url-mode.html) mendokumentasikan setiap satu darinya, termasuk beberapa yang tidak tercantum di sini. Input asset dalam URL mode diserialisasi menurut `id`-nya; runtime me-resolve-nya via `host.assets.get()` sebelum hidrasi. `width`/`height` adalah nilai dalam `unit` (default `px`, juga `mm`/`cm`/`in`/`pt`/`pc`); dengan unit fisik, `dpi` menetapkan resolusi raster. Keduanya menetapkan ukuran dokumen canvas dan mengisi di awal panel dimensi ekspor.

Karena setiap input berpindah dalam link, perubahan parameter berarti asset jadi yang berbeda. Seluruh palet ini adalah satu warna seed, satu harmoni dan satu jumlah step:

![Sembilan langkah dalam empat corak warna, semuanya tumbuh dari satu warna benih yang dibawa dalam tautan](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3De0521a%26harmony%3Dtetrad-4%26steps%3D9%26full&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-url-palette)

### 6. Penyimpanan lewat bridge, bukan langsung

Web shell: IndexedDB. Tauri: filesystem. CLI: in-memory. Tools hanya melihat `host.state.save(slot, data)` dan `host.state.load(slot)`. `localStorage` tidak digunakan - terlalu kecil dan tidak bisa menyimpan blob.

Pengguna dapat menyimpan beberapa slot edit bernama per tool dan kembali ke tiap sesi nanti. Tidak perlu membuat akun; state bersifat per perangkat. Karena bridge adalah satu-satunya titik sambung, state per perangkat itu juga *portabel*: `shells/web/src/data-transfer.ts` membaca kembali semuanya lewat `host.profile`/`host.state`/`host.assets` menjadi satu zip `lolly-backup` yang bisa diimpor di instalasi lain - jawaban offline untuk "pindah ke perangkat baru" yang tidak butuh server (spesifikasi lengkap: `docs/data-transfer.md`). Integrasi SUSE ID (sinkronisasi multi-perangkat) adalah milestone masa depan di atas mekanisme ini.

### 7. Tag kematangan menjawab risiko "disetujui brand" secara desain

Setiap tool mendeklarasikan `status: official | community | experimental` dalam manifesnya. Galeri diurutkan berdasarkan status. Tool experimental otomatis membubuhkan watermark pada ekspornya - watermark diterapkan oleh `host.export.render`, bukan oleh tool, sehingga tidak bisa dinonaktifkan oleh penulis tool non-official.

Ini adalah jawaban struktural atas risiko persepsi bahwa memakai tool apa pun berarti disetujui brand. Jawaban proses (antrean review, gating SUSE ID) melapis di atasnya.

### 8. Input tool ditipekan lewat manifes, termasuk aset

Input mendeklarasikan `type`: `text`, `longtext`, `number`, `boolean`, `color`, `select`, `asset`, `date`, `time`, `datetime-local`, `url`, `blocks`, `vector`, `table` dan `file`. Host merender kontrol generik per tipe dari manifes - tool tidak menulis kode kontrol sama sekali. (Pra-isi dari profil pengguna bukan tipe - input apa pun bisa membawa `bindToProfile`.) Tiga di antaranya membawa bobot lebih dari yang lain:

- **`asset`** (dengan `filter` dan `allowUpload`) adalah jembatan ke sistem aset global; `allowUpload: false` adalah tuas penegakan brand untuk hal seperti logo ubin sponsor yang hanya boleh berupa aset pustaka. Unggahan pengguna memakai bentuk `AssetRef` yang sama dengan aset pustaka, jadi tool memperlakukannya secara identik.
- **`blocks`** adalah grup field berulang - mini-tabel di dalam satu input, diedit di panel samping, dengan menu tambah yang bertipe/terdiskriminasi dan field aset per blok. Mengklik blok yang dirender di kanvas memfokuskan baris blok itu. Dipakai oleh `meeting-planner`, `chart-creator`, `event-name-badge`, `wayfinding-signage`, `color-block` dan `digi-ad`.
- **`vector`** mengelompokkan sekumpulan angka tetap (misalnya sebuah transform) menjadi satu kontrol majemuk; **`file`** menyimpan file milik pengguna sendiri sebagai byte di memori untuk utilitas transformasi on-device (misalnya `strip-data` dan `compress-pdf`).

### 9. Template tanpa logika (Handlebars, bukan EJS)

Handlebars dipilih dibanding EJS secara sengaja:
- Tanpa logika. Template bisa ditulis oleh non-developer.
- Aman secara default. `{{x}}` melakukan HTML-escape; `{{{x}}}` bersifat raw opt-in.
- Tidak ada JS bebas dalam template berarti tidak ada permukaan audit XSS per template.

Logika berada di `hooks.js` tempat ia eksplisit dan bisa direview. Helper Handlebars yang tersedia: `{{default}}`, `{{upper}}`, `{{lower}}`, `{{eq}}`, `{{markdown}}`, `{{asset ref}}`, `{{asset ref "property"}}` (ditambah helper format data `icsStamp`/`rfcText`/`csvCell` yang dipakai oleh template `.ics`/`.vcf`/`.csv` sejenis).

### 10. Tool menyusun tool

Satu tool bisa menyematkan render tool **lain** tanpa impor antar-tool - komposisi diselesaikan oleh engine, tidak pernah oleh kode tool. Ada dua permukaan:

- **Manifes deklaratif** - `composes: [{ id, tool, inputs, format?, width?, height? }]`. Engine merender anak yang disebutkan dan menempatkan hasilnya di template tanpa logika sebagai `{{asset <id>}}`. `event-name-badge` menyusun `qr-code` sebagai SVG saat ini.
- **URL sematan portabel** - `<img src="https://lolly.tools/tool/<id>.<ext>?<inputs>">`. Shell merender anak itu **secara lokal** (piksel placeholder tampil sampai render lokal selesai); tidak ada yang pernah diambil dari `lolly.tools`.

Menyusun render tool apa pun: anak **SVG** tetap menjadi vektor sejati saat induk diekspor ke SVG atau PDF, dan dirasterisasi dengan tajam untuk PNG; anak **PNG/JPG/WEBP** disematkan sebagai gambar. Memerlukan kapabilitas `compose`. Anak hasil komposisi adalah perantara - tidak pernah diberi watermark atau cap provenans - dan komposisi terdegradasi secara wajar: shell yang tidak bisa merender anak cukup mengosongkan slotnya dan induk tetap dirender.

---

## Apa yang secara sengaja tidak kami lakukan

- **Tanpa EJS / tanpa JS arbitrer dalam template.** Permukaan XSS-nya nol. Logika berada di `hooks.js`.
- **Tanpa CMS aset wajib.** Setiap individu mengingest berkas kreatif mereka sendiri langsung ke katalog mereka di dalam aplikasi (tampilan [Katalog](/info/using.html) dan Brand Studio) - tanpa server, tanpa konsol admin. Pekerjaan diteruskan sebagai sebuah **session**: sebuah tautan share membawa seluruh state, dan session yang sama berpindah dalam sebuah backup atau melalui sebuah sesi kolaborasi. Siapa pun yang mengontrol deployment kemudian dapat mengunci sebuah session bersama sebagai sebuah **template** - buka tautannya, catat nilai-nilainya sebagai sebuah entri template di direktori alat tersebut dalam brand pack, lalu commit - setelah itu template tersebut muncul di pemilih "New from template" pada alat itu dan dapat di-deep-link sebagai `?template=<id>`. Git adalah langkah penguncian milik pemilik deployment, bukan milik pembuatnya. Untuk sebuah katalog yang *dibagikan dan diatur (governed)*, sebuah organisasi **dapat** mengelola direktori aset dengan cara yang sama dan menjaga pembaruan melalui review PR - sebuah model governance yang tersedia, bukan sebuah keharusan dari aplikasi.
- **Tanpa RBAC yang dipaksakan.** Aplikasi terbuka ini bersifat public-access secara default; risiko brand dikelola melalui tag maturity + watermark. Sebuah organisasi yang menginginkan kontrol lebih ketat melapiskan auth-nya sendiri dan katalog yang di-review lewat git di atas.
- **Tanpa database terpusat.** Semua state pengguna bersifat per perangkat. Integrasi SUSE ID ada dalam roadmap tetapi bukan penghalang peluncuran.
- **Tanpa jalur kode tools/engine bersama.** Engine ini open source, begitu pula alat-alat brand-agnostic di `community/`; sebuah brand pack seperti `brands/suse/` yang privat membawa alat dan katalognya sendiri dengan persyaratannya sendiri. Bagaimanapun juga, pemisahan ini ditegakkan (tanpa cross-import dari `engine/` ke konten alat) sehingga pemisahannya tetap bersih.

---

## Siklus hidup, dari awal sampai akhir

Seorang pengguna membuka `lolly.tools/#/tool/qr-code?url=https://suse.com&ecl=H`:

1. **Boot.** Web shell membuka IndexedDB, membangun capability bridge, menyinkronkan katalog tool dan aset (atau memuat dari cache saat offline).
2. **Route.** Hash URL → tampilan `tool`, dengan `qr-code` dan parameter URL diekstrak.
3. **Load.** `loadTool('qr-code', fetchFile)` mengambil `tool.json`, memvalidasinya terhadap JSON Schema, mengambil `template.html`, `styles.css` dan kode sumber `hooks.js`.
4. **Parse URL state.** `parseUrlState` menerjemahkan parameter URL menjadi nilai input awal. Referensi aset (`?logo=suse/logo/primary`) diuraikan sebagai objek ringan `{ id, _unresolved: true }`.
5. **Runtime.** `createRuntime(tool, host, initialValues)` membangun model input (menggabungkan data profil, default dan nilai awal), menyelesaikan referensi aset lewat `host.assets.get()`, memuat hooks (`host` bercakupan closure, tidak di-sandbox), memanggil `hooks.onInit`.
6. **Render.** Shell berlangganan ke runtime; pada setiap perubahan state ia menerima `{ model, hydrated }`. Ia merender kontrol input dari model dan menulis HTML template yang sudah dihidrasi ke `#tool-canvas`.
7. **Interact.** Pengguna mengetik di sebuah input → `runtime.setInput(id, value)` → constraint diterapkan → `hooks.onInput` dipanggil → hidrasi ulang → render ulang. Kanvas diperbarui secara langsung.
8. **Export.** Pengguna mengklik Download(PNG) → `runtime.export(canvasNode, 'png')` → `host.export.render` (merasterisasi lewat dom-to-image-more; SVG/PDF melalui vektoriser penyusur DOM khusus) → blob → `host.export.download`. Rentang format yang bisa dipilih sebuah tool luas, dan enum `render.formats` di `schemas/tool.schema.json` adalah otoritas atasnya - raster dan float raster, vektor dan file potong, cetak/CMYK, motion, dokumen yang bisa diedit (`pptx`, `docx`, `odt`), palet dan keluaran data/teks, file audio dan font. [URL Mode](/info/url-mode.html) menyebutkan setiap id dan apa yang dihasilkannya. Audio berada dalam enum itu seperti yang lain (`wav`, `mp3`, `m4a`, `opus`, dideklarasikan oleh audiogram dan tool perekaman); secara terpisah, mode `render.capture` sebuah tool perekaman menggerakkan `host.recorder`, yang hasil rekamannya tiba sebagai Blob jadi dalam kontainer apa pun yang direkam browser. (Tool yang menyetel `render.export: false` - misalnya Color Palette, Countdown Timer, Strip Hidden Data, Text Helper, Compress PDF - menyembunyikan kontrol download/format/dimensi.) Satuan fisik dikonversi per format di sini (PDF → poin halaman sesungguhnya, raster → piksel pada DPI dengan chunk `pHYs`). Metadata kepenulisan/provenans (author, tool, source - dibangun oleh `engine/src/metadata.ts`) disematkan per format: PNG iTXt, JPEG EXIF, PDF info dict, SVG `<metadata>`, GIF comment. Tool experimental mendapat watermark yang disisipkan oleh host, bukan oleh tool.

![Panel ekspor yang dibuka `?options`: pasangan nama file dan format, ukuran keluaran dan kontrol yang menulis file](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=aud-export-popup)

Siklus hidup yang sama di Tauri. Siklus hidup yang sama di CLI - jsdom menyediakan DOM headless; keluaran menuju file atau stdout.

---

## Status open source

**Kode ini MPL-2.0.** `engine/`, `shells/*`, `services/*`, `schemas/`, dan `docs/` adalah open source di bawah **MPL-2.0** - sebuah platform scaffolding yang vendor-neutral untuk tooling brand, dengan setiap unit yang dirilis berada dalam repositorinya sendiri di bawah [github.com/lolly-tools](https://github.com/lolly-tools).

**Konten alat dirilis sebagai brand pack**, masing-masing dengan persyaratannya sendiri (lihat `NOTICE.md` milik pack tersebut). `community/` adalah repositori publik [`lolly-tools`](https://github.com/lolly-tools/lolly-tools) dan alat-alat brand-agnostic-nya juga MPL-2.0. `brands/suse/` adalah pack privat `suse-lolly`: alat-alat SUSE dan katalog SUSE, **milik eksklusif SUSE (proprietary)**, termasuk musik PremiumBeat berlisensinya. `brands/lolly-start/` adalah brand starter kosong yang dimiliki repositori ini. Font dirilis di dalam sebuah pack di bawah **SIL Open Font License 1.1** - pack SUSE membawa typeface SUSE dan SUSE Mono.

`tools/` dan `catalog/` di root repo adalah *view* yang di-gitignore: sebuah profile menyusunnya dari `community/` ditambah brand pack yang aktif, itulah sebabnya setiap script dan shell membaca kedua path tersebut dan tidak pernah membaca sebuah pack secara langsung.

Pemisahan ini ditegakkan - tidak ada cross-import dari `engine/` ke konten alat - sehingga batas antara platform dan konten tetap bersih.

---

## Di mana engine berakhir dan host dimulai

Jika bisa dideskripsikan dalam data murni + Handlebars → **engine**.
Jika menyentuh DOM, filesystem, jaringan atau API browser/OS apa pun → **host**.

Garis batas ini tajam dengan sengaja. Engine adalah bagian open source. Segala sesuatu yang mengetahui tentang SUSE, platform tertentu atau lingkungan runtime tetap di luarnya.

Untuk level detail berikutnya, [`engine/README.md`](../engine/README.md) mencantumkan setiap modul engine dan apa tanggung jawabnya, dan [Threat Model & Trust Boundaries](/info/threat-model.html) mencatat di mana garis yang sama itu sekaligus menjadi batas kepercayaan.
