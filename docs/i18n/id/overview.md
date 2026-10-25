# Arsitektur Lolly

![Ikon Lolly - Permen lolipop hijau dan putih berukuran besar](/info/icon.svg)

Halaman ini untuk orang yang mengubah kode Lolly: bagaimana engine, shell, dan paket alat saling terpasang, di mana masing-masing berada dalam repositori, dan komitmen yang membatasi setiap perubahan. Jika Anda ingin tahu apa yang dilakukan Lolly dan siapa yang memakainya, baca [How Lolly works](/info/how-lolly-works.html) lebih dulu.

Dua pendamping membahas lebih dalam. [`engine/README.md`](../engine/README.md) adalah peta engine modul demi modul, dihasilkan dari kode. [Threat Model & Trust Boundaries](/info/threat-model.html) membaca arsitektur yang sama sebagai batas kepercayaan, dan merupakan halaman untuk pertanyaan apa pun tentang apa yang dianggap engine tidak tepercaya.

## Gambaran besar

Alat adalah data di bagian atas. Engine di tengah tidak tahu apa pun tentang platform mana pun. Shell di bagian bawah mengimplementasikan satu kontrak, dan katalog menyediakan kontennya.

![Alat menyediakan manifes, templat, dan hook kepada engine bersama. Shell web, Tauri, dan terminal mengimplementasikan capability bridge HostV1 dan membaca alat serta aset dari katalog.](/info/diagrams/concepts/platform-layers.svg)

Jika dapat dijelaskan dalam data murni dan Handlebars, itu milik **engine**. Jika menyentuh DOM, filesystem, jaringan, atau API browser atau sistem operasi mana pun, itu milik **host**, sisi shell dari bridge. Engine adalah sumber terbuka, dan tidak ada yang mengenal brand atau platform tertentu yang masuk ke engine.

## Tata letak repositori

Lolly adalah satu repositori. Setiap direktori di bawah adalah direktori biasa di dalamnya, kecuali `brands/suse`, submodule git **privat** yang menyimpan paket alat dan katalog SUSE, yang tidak diambil klon publik. Paket mana yang dibaca build adalah profil konten (`profiles.json`), diselesaikan per proses, bukan diganti secara global. [Build Guide](/info/build-guide.html) memuat perintah klon dan cara perubahan di dalam paket privat di-commit.

| Direktori | Isinya |
|---|---|
| `engine/` | Inti lintas platform: loader, runtime, input, templat, mode URL, satuan, dan modul format |
| `shells/` | Aplikasi web, aplikasi desktop dan seluler Tauri, CLI, TUI, dan ekstensi browser |
| `packages/` | SDK penulis alat (`@lolly-tools/core`), bagian shell Node bersama, dan perender dokumen, di antara lainnya |
| `community/` | Alat yang tidak terikat brand, ditambah paket emoji bersama |
| `brands/` | Paket brand: `lolly-demo` (Lolly Demo, design system yang dijalankan lolly.tools), `lolly-start` (starter kosong), dan `suse` yang privat |
| `services/` | Layanan MCP, sertifikat, dan Penpot yang opsional, dan kode server yang mereka bagi |
| `schemas/` | JSON Schema untuk manifes alat, entri aset, dan referensi aset |
| `scripts/`, `tests/`, `docs/`, `api/` | Skrip build dan katalog, rangkaian tes engine, dokumen ini, dan bundel serverless yang dihasilkan |

::: details File engine dan shell yang pertama kali Anda temui
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

Tidak ada direktori `tools/` atau `catalog/` di akar repositori. `packages/node-shell/src/content-roots.ts` menjawab "di mana alat `<id>` berada" dan "di mana katalog berada" dari `profiles.json` saat ditanya. Pasangan `tools/` dan `catalog/` yang sungguhan hanya ditulis ke keluaran build, seperti `dist/`, payload RPM, atau image kontainer, karena browser mengambil kedua path itu lewat HTTP.

## Di mana Lolly berjalan

Setiap permukaan memakai engine yang sama dan file alat yang sama.

- **Aplikasi web.** Aplikasi web progresif yang berfungsi offline setelah service worker-nya meng-cache alat dan aset. Tidak memerlukan akun; status berada di IndexedDB pada tiap perangkat. Satu tata letak responsif melayani desktop dan ponsel: di ponsel kontrol menjadi sheet dan kontrol ekspor terbuka dari pil mengambang.
- **Aplikasi desktop dan seluler.** Paket Tauri dari aplikasi web yang sama, dengan dialog file native, status filesystem, dan penggunaan offline penuh.
- **CLI.** `lolly <tool-id> --input=value --output=file.png` memuat engine yang sama di DOM tanpa antarmuka dan menulis file. Ini adalah mode URL melalui transport berbeda, bukan implementasi terpisah. Lihat [CLI](/info/cli.html).
- **TUI.** Aplikasi terminal layar penuh yang mengutamakan keyboard, memakai ulang bridge CLI, menyimpan sesi tersimpan di disk (di folder aplikasi desktop sendiri bila aplikasi terpasang, jika tidak di bawah `~/.lolly`) dan memulai browser tanpa antarmuka yang terbatas hanya bila format memerlukannya. Lihat [TUI](/info/tui.html).

![Tampilan terbagi desktop: kontrol yang dihasilkan dari manifes di kiri, kanvas langsung di kanan](/t/url-shot?url=%2F%23%2Ftool%2Fchart&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&filename=aud-web-split)

Alat yang sama pada lebar ponsel tidak memerlukan tata letak kedua: kontrol menjadi sheet di bagian atas dan pratinjau memegang layar.

![Audiogram pada layar selebar 430px: sheet kontrol di atas, karya persegi jadi di bawah, dan pil ekspor mengambang](/t/url-shot?url=%2F%23%2Ftool%2Faudiogram%3Faudio%3Dlolly%2Floops%2Ffireplace-loop%26title%3DField%2520notes%26subtitle%3DEpisode%252012%26style%3Dwave&width=430&height=900&dpi=192&waitMs=3200&css=%23ag-wave%7Bdisplay%3Anone!important%7D.ag-ph%7Bdisplay%3Ablock!important%7D&walker=1&format=svg&rasterDpi=110&dark=1&filename=ov2-phone-audiogram)

Aplikasi web juga menyertakan **Batch** (`#/batch`, `shells/web/src/pro/`), grid bergaya spreadsheet yang merender banyak baris sekaligus di satu atau banyak alat; [Batch and Multi-edit](/info/batch.html#make-many-versions-of-one-design) membahas Batch. **Settings → Capabilities** memetakan semua yang dinyatakan platform dapat dilakukannya.

![Batch pada instalasi baru: satu baris kosong menunggu alat, dengan permukaan spreadsheet dan tombol Render-nya sudah ada sebelum data tiba](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=ov2-batch-grid)

## Komitmen arsitektural

Keputusan ini sudah mantap. Mengubah salah satunya adalah pekerjaan besar, karena membentuk setiap keputusan lain dalam basis kode.

### 1. Tool deklaratif, dengan jalan keluar imperatif

Alat adalah manifes (`tool.json`), templat (`template.html`), dan `hooks.js` opsional. **Manifes mendeklarasikan input**, bukan templat: input tidak disimpulkan dari token Handlebars. Sebagian besar alat hanya manifes dan templat, itulah yang memungkinkan non-pengembang menulisnya.

![Tumpukan kontrol Street Map: dropdown kota, pilihan tema, penggeser bobot, dan pemicu warna, masing-masing digambar dari satu baris manifes](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-street-map-controls)

Alat yang menghitung nilai, seperti pengodean QR atau pembentukan bagan, menambahkan hook: fungsi siklus hidup bernama yang dipanggil runtime dengan capability bridge disuntikkan. Hook adalah kontrak portabilitas, bukan sandbox keamanan, dan berjalan dalam anggaran waktu. Alat yang hook-nya terbukti bebas dari global halaman membawa `isolate: true` dan berjalan di Worker. [Tool hooks](/info/tool-hooks.html) memuat siklus hidup dan anggarannya, dan [Threat Model](/info/threat-model.html) menyatakan apa yang dapat dan tidak dapat ditampung eksekutor dalam halaman.

### 2. Tool dan asset adalah data, bukan kode yang dibundel

Aplikasi web dan Tauri mengambil katalog alat dan aset saat boot, men-cache-nya dan bekerja dengan apa pun yang ada, jadi alat atau aset baru tidak memerlukan rilis aplikasi. Byte aset diberi checksum SHA-256, dan `id` serta `version` aset menggerakkan pembatalan cache.

### 3. Capability bridge adalah satu-satunya API yang dilihat alat

Alat tidak pernah menyentuh DOM di luar templatnya, tidak pernah memanggil `fetch` secara langsung, dan tidak pernah membaca filesystem. Mereka memanggil metode `host.*` berversi. Definisi kanonis kontrak ada di `packages/core/src/host-v1.ts`, SDK penulis alat `@lolly-tools/core`, sehingga pihak ketiga dapat membangun terhadapnya tanpa bergantung pada engine; `engine/src/bridge/host-v1.ts` mengekspor ulang tipenya.

| API wajib | Fungsinya |
|---|---|
| `host.profile` | Detail pengguna; mengisi input otomatis melalui `bindToProfile` |
| `host.assets` | Kueri katalog, resolusi aset, dan pemilih milik host |
| `host.state` | Menyimpan dan memuat slot input: IndexedDB di web, filesystem di Tauri, memori di CLI |
| `host.clipboard` | Menulis teks atau gambar ke clipboard, dengan fallback per platform |
| `host.export` | Merasterisasi atau menserialisasi target render, serta jalur transformasi file di perangkat |
| `host.log` | Logging bertingkat ke host |

Setiap API lain bersifat opsional dan aditif: `tokens`, `text`, `color`, `geom`, `pdf`, `compose`, `media`, `recorder`, dan banyak lagi. Manifes alat mencantumkan di bawah `requires` API opsional yang dipanggil hook-nya tanpa memeriksa lebih dulu, dan host yang tidak memilikinya menolak memasang alat; hook mendeteksi fitur untuk sisanya. Beberapa, seperti `recorder`, juga memerlukan kemampuan perangkat yang dideklarasikan alat. `packages/core/src/host-v1/apis.ts` mencantumkan semuanya dan [Host API](/info/host-api.html) mendokumentasikan masing-masing. Menambah metode adalah versi minor; menghapus atau mengubahnya adalah versi mayor, dan v1 tetap berfungsi saat v2 dirilis.

### 4. Id aset berlaku selamanya

`lolly/logo/primary` adalah kontrak. Setelah diterbitkan, id tidak pernah berubah dan tidak pernah dipakai ulang. Perubahan byte menaikkan `version` pada entri aset, dan penggantian menetapkan `deprecated: true` dan, opsional, `replacedBy`, sehingga referensi yang ada selalu terselesaikan. Itulah yang menjaga sesi tersimpan dan tautan berbagi tetap berfungsi bertahun-tahun.

### 5. URL mode bersifat first-class

Setiap input dapat dinyatakan sebagai parameter URL, jadi tautan adalah file jadi:

```
https://lolly.tools/t/qr-code?url=https://example.com&ecl=H
```

![Tautan itu sendiri, tanpa yang lain di dalamnya, adalah file jadi](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Fexample.com%26ecl%3DH%26full&width=760&height=760&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-url-mode-qr)

Ubah satu parameter dan Anda mendapat file berbeda. Seluruh palet ini hanyalah satu warna benih, satu harmoni, dan jumlah langkah:

![Sembilan langkah dalam empat corak warna, semuanya tumbuh dari satu warna benih yang dibawa dalam tautan](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3De0521a%26harmony%3Dtetrad-4%26steps%3D9%26full&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-url-palette)

CLI membangun status URL yang sama dari argumennya dan menjalankan pipeline yang sama, sehingga CLI tidak dapat menyimpang dari aplikasi. `engine/src/url-mode.ts` mengurai dan menserialisasi; sekumpulan nama yang dicadangkan (`format`, `width`, `dpi`, `c2pa`, `z`, dan lainnya) tidak pernah diteruskan ke alat, dan [Reserved URL parameters](/info/url-parameters.html) mencantumkan semuanya. Input aset dibawa menurut `id` dan diselesaikan melalui `host.assets.get()` sebelum templat terisi.

### 6. Penyimpanan melalui bridge

Aplikasi web memakai IndexedDB, Tauri memakai filesystem, dan CLI memakai memori. Alat hanya melihat `host.state.save(slot, data)` dan `host.state.load(slot)`, tidak pernah `localStorage`. Orang dapat menyimpan beberapa sesi bernama per alat tanpa akun. Karena bridge adalah satu-satunya sambungan, status itu juga portabel: `shells/web/src/data-transfer.ts` membacanya kembali ke satu file `lolly-backup` yang dapat diimpor di instalasi lain mana pun ([Data transfer](/info/data-transfer.html)), dan [Sync](/info/sync.html) mengirim bundel yang sama ke penyimpanan yang dipilih orang itu.

### 7. Tag maturity menyatakan apa itu sebuah tool

Setiap alat mendeklarasikan `status: official | community | experimental`. Galeri mengurutkan berdasarkan status, dan alat eksperimental memberi watermark pada ekspornya secara default: runtime menyalakan watermark kecuali pemanggil memberi `watermark: false`, dan alat di perangkat dikecualikan. Proses apa pun yang ditaruh tim di sekitar katalog berada di atas ini.

### 8. Input diketik dalam manifes

Input mendeklarasikan `type`: `text`, `longtext`, `number`, `boolean`, `color`, `select`, `asset`, `date`, `time`, `datetime-local`, `url`, `blocks`, `vector`, `table`, atau `file`. Host merender satu kontrol per tipe, jadi alat tidak menulis kode kontrol, dan input apa pun dapat membawa `bindToProfile`. Tiga yang paling berbobot:

- **`asset`**, dengan `filter` dan `allowUpload`, adalah jembatan ke sistem aset. `allowUpload: false` membatasi slot pada aset pustaka, dan unggahan pengguna berbagi bentuk `AssetRef` pustaka.
- **`blocks`** adalah grup field berulang yang disunting di panel samping, dipakai oleh Meeting Planner, Wayfinding, Diagrams, dan lainnya. Mengeklik blok yang dirender memfokuskan barisnya.
- **`file`** menyimpan file pengguna di memori untuk utilitas di perangkat seperti Strip Hidden Data dan Compress, dan **`vector`** mengelompokkan sekumpulan angka tetap menjadi satu kontrol.

### 9. Templat tanpa logika

Templat adalah Handlebars, dipilih agar non-pengembang dapat menulisnya: `{{x}}` melakukan escape, dan `{{{x}}}` adalah pilihan eksplisit. Logika berada di `hooks.js`, tempat ia eksplisit dan dapat ditinjau. Banyak templat memakai `{{{` untuk markup yang dihitung hook, jadi setiap hook harus meng-escape apa yang diserahkannya. Helper-nya adalah `default`, `upper`, `lower`, `eq`, `markdown`, `asset`, `framing`, dan `media`, ditambah `icsStamp`, `rfcText`, `csvCell`, dan `arrow` untuk templat `.ics`, `.vcf`, dan `.csv` pendamping. [Templates and rendering](/info/tool-rendering.html) membahasnya.

### 10. Tool menyusun tool

Alat dapat menyematkan render alat lain tanpa impor antar alat; engine menyelesaikan komposisinya. Manifes dapat mendeklarasikan `composes: [{ id, tool, inputs }]` dan menempatkan anak dengan `{{asset <id>}}`, dan URL sematan portabel (`https://lolly.tools/tool/<id>.svg?…`) merender anak secara lokal, begitulah Design menempatkan kode QR atau bagan langsung. Anak SVG tetap vektor dalam induk SVG atau PDF. Anak adalah perantara, tidak pernah diberi watermark atau stempel, dan shell yang tidak dapat merender satu membiarkan slot kosong sementara induk tetap dirender. [Composition and brand overlays](/info/tool-composition.html) memuat detailnya.

## Apa yang kami pilih untuk tidak dilakukan

- **Tidak ada JavaScript sembarang di templat.** Logika berada di `hooks.js`.
- **Tidak ada server aset wajib.** Orang menambahkan file sendiri ke Assets di aplikasi dan menyerahkan karya sebagai sesi: tautan berbagi untuk input dan pengaturan, file `.lolly` bila unggahan ikut. Sesi bersama dapat menjadi templat di pemilih sebuah alat. Organisasi yang menginginkan katalog yang diatur dapat memakai katalog, persetujuan, dan kebijakan Lolly Work, atau mengelola paket brand di git dan meninjau perubahan di sana.
- **Tidak ada kontrol akses paksa.** Aplikasi terbuka bersifat publik secara default, dan tag kematangan serta watermark menanggung risiko brand. Login organisasi, peran, dan kebijakan datang dari Lolly Work bila tim menginginkannya.
- **Tidak ada database pusat.** Status pengguna berada di setiap perangkat, dan Sync opsional menyalinnya ke penyimpanan yang dipilih orang itu, tidak pernah ke database Lolly.
- **Tidak ada jalur kode bersama antara alat dan engine.** Engine dan alat komunitas adalah sumber terbuka, dan paket brand seperti `brands/suse/` yang privat membawa alat dan katalognya sendiri dengan ketentuannya sendiri. Tidak ada alat yang mengimpor dari `engine/`, sehingga pemisahannya tetap bersih.

## Siklus hidup satu render

Seseorang membuka `https://lolly.tools/t/qr-code?url=https://example.com&ecl=H`:

1. **Boot.** Aplikasi web membuka IndexedDB, membangun capability bridge, dan menyinkronkan katalog alat dan aset, atau memuatnya dari cache saat offline.
2. **Rute.** Path memilih tampilan alat untuk `qr-code`, dengan query sebagai nilai awalnya.
3. **Muat.** `loadTool` mengambil `tool.json`, memvalidasinya terhadap skema, dan mengambil templat, gaya, dan hook.
4. **Urai tautan.** `parseUrlState` mengubah parameter menjadi nilai input. Referensi aset seperti `?logo=lolly/logo/primary` menjadi `{ id }` yang belum terselesaikan.
5. **Mulai runtime.** `createRuntime(tool, host, initialValues)` membangun model input dari data profil, default, dan tautan, menyelesaikan referensi aset, memuat hook, dan memanggil `onInit`.
6. **Render.** Shell berlangganan ke runtime, menggambar kontrol dari model, dan menulis templat yang terisi ke `#tool-canvas`.
7. **Interaksi.** Mengetik memanggil `runtime.setInput`, yang menerapkan batasan, memanggil `onInput`, mengisi templat lagi, dan menggambar ulang.
8. **Ekspor.** **Download** memanggil `runtime.export(node, format)`, dan `host.export` milik shell menghasilkan file: raster, vektor dari DOM walker, PDF, dokumen, atau format lain di `schemas/tool.schema.json`. Satuan fisik dikonversi per format, dan metadata serta Content Credentials disematkan bila format dapat menampungnya. Alat eksperimental mendapat watermark dari host, bukan alat. [Templates and rendering](/info/tool-rendering.html) dan [Export a file](/info/exporting.html) membahas langkah ekspor.

![Panel ekspor yang dibuka ?options: pasangan nama file dan format, ukuran keluaran, dan kontrol yang menulis file](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=aud-export-popup)

Siklus hidup yang sama berjalan di Tauri, dan di CLI dengan DOM tanpa antarmuka, tempat keluaran menuju file atau stdout.

## Lisensi

Kode, termasuk `engine/`, `shells/`, `services/`, `schemas/`, dan pembangkit dokumentasi, berlisensi MPL-2.0, dalam satu repositori publik, [`lolly-tools/lolly`](https://github.com/lolly-tools/lolly). Prosa dokumentasi berlisensi CC BY-SA 4.0. Paket brand membawa ketentuannya sendiri di `NOTICE.md` tiap paket: alat komunitas berlisensi MPL-2.0, dan paket SUSE yang privat bersifat proprietari milik SUSE. [About](/info/about.html) memuat catatan lisensi lengkap.
