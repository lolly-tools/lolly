# Arsitektur Lolly

![Ikon Lolly - Permen lolipop besar berwarna hijau dan putih](/info/icon.svg)

Halaman ini ditujukan bagi orang yang mengubah kode Lolly: bagaimana engine, shell dan paket alat saling terhubung, letak masing-masing dalam repositori dan komitmen yang membatasi setiap perubahan. Untuk mengetahui apa yang dilakukan Lolly dan siapa yang menggunakan Lolly, baca [Cara kerja Lolly](/info/how-lolly-works.html) terlebih dahulu.

[`engine/README.md`](https://github.com/lolly-tools/lolly/blob/main/engine/README.md) memetakan engine modul demi modul dan dihasilkan dari kode. [Model Ancaman & Batas Kepercayaan](/info/threat-model.html) membahas arsitektur yang sama sebagai batas kepercayaan dan menjelaskan apa yang dianggap tidak tepercaya oleh engine.

<!--i:eti-layers-->
## Gambaran besar

Alat adalah data di lapisan atas. Engine di tengah tidak mengenal platform apa pun. Shell di lapisan bawah menerapkan satu kontrak, dan katalog menyediakan kontennya.

![Alat menyediakan manifes, templat dan hook ke engine bersama. Shell web, Tauri dan terminal menerapkan jembatan kapabilitas HostV1 serta membaca alat dan aset dari katalog.](/info/diagrams/concepts/platform-layers.svg)

Apa pun yang dapat Anda gambarkan dengan data murni dan Handlebars menjadi bagian dari **engine**. Apa pun yang menyentuh DOM, sistem file, jaringan atau API browser maupun sistem operasi menjadi bagian dari **host**, sisi shell dari jembatan. Engine bersifat open source. Tidak ada apa pun yang mengenal merek tertentu di dalam engine.

<!--i:eti-folder-shared-->
## Struktur repositori

Lolly berada dalam satu repositori. Setiap direktori di bawah ini adalah direktori biasa, kecuali `brands/suse`: submodul git **privat** berisi paket alat dan katalog SUSE, yang tidak diambil oleh klona publik. Profil konten (`profiles.json`) menentukan paket mana yang dibaca oleh build. Setiap proses menentukan profilnya sendiri, dan tidak ada sakelar global. [Panduan Build](/info/build-guide.html) memuat perintah klona dan cara membuat commit perubahan di dalam paket privat.

| Direktori | Isinya |
|---|---|
| `engine/` | Inti yang tidak terikat platform: loader, runtime, input, templat, mode URL, satuan dan modul format |
| `shells/` | Aplikasi web, aplikasi desktop dan seluler Tauri, CLI, TUI dan ekstensi browser |
| `packages/` | SDK pembuat alat (`@lolly-tools/core`), komponen shell Node bersama dan perender dokumentasi, di antaranya |
| `community/` | Alat yang tidak terikat merek, beserta paket emoji bersama |
| `brands/` | Paket merek: `lolly-demo` (Lolly Demo, design system yang digunakan lolly.tools), `lolly-start` (paket awal kosong) dan `suse` yang privat |
| `services/` | Layanan MCP, sertifikat dan Penpot opsional, serta kode server yang digunakan bersama |
| `schemas/` | JSON Schema untuk manifes alat, entri aset dan referensi aset |
| `scripts/`, `tests/`, `docs/`, `api/` | Skrip build dan katalog, rangkaian pengujian engine, dokumentasi ini dan bundel serverless yang dihasilkan |

::: details File engine dan shell yang pertama Anda temui
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

::: note Tidak ada direktori `tools/` atau `catalog/` di akar repositori
`packages/node-shell/src/content-roots.ts` menjawab "di mana alat `<id>` berada" dan "di mana katalog berada" berdasarkan `profiles.json`. Pasangan `tools/` dan `catalog/` yang sebenarnya hanya ditulis ke keluaran build, seperti `dist/`, muatan RPM atau image container, karena browser mengambil kedua path itu melalui HTTP.
:::

<!--i:eti-monitor-->
## Tempat Lolly berjalan

Setiap antarmuka menggunakan engine dan file alat yang sama.

- **Aplikasi web.** Aplikasi web progresif. Aplikasi ini berfungsi offline setelah service worker menyimpan alat dan aset dalam cache. Aplikasi tidak memerlukan akun, dan status disimpan di IndexedDB pada setiap perangkat. Satu tata letak responsif melayani desktop dan ponsel. Di ponsel, kontrol menjadi panel dan kontrol ekspor dibuka dari pil mengambang.
- **Aplikasi desktop dan seluler.** Paket Tauri dari aplikasi web yang sama, dengan dialog file native, penyimpanan status di sistem file dan penggunaan offline penuh.
- **CLI.** `lolly <tool-id> --input=value --output=file.png` memuat engine yang sama dalam DOM headless dan menulis file. Ini adalah mode URL melalui transport yang berbeda. Lihat [CLI](/info/cli.html).
- **TUI.** Aplikasi terminal layar penuh yang mengutamakan keyboard. Aplikasi ini menggunakan kembali jembatan CLI dan menyimpan sesi di disk: dalam folder aplikasi desktop jika aplikasi terpasang, atau di bawah `~/.lolly` jika tidak. Aplikasi hanya memulai browser headless dengan cakupan terbatas jika suatu format memerlukannya. Lihat [TUI](/info/tui.html).

![Tampilan terbagi di desktop: kontrol yang dihasilkan dari manifes di kiri, kanvas langsung di kanan](/t/url-shot?url=%2F%23%2Ftool%2Fchart&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&filename=aud-web-split)

Pada lebar layar ponsel, panel kontrol berada di atas dan pratinjau memenuhi layar.

![Audiogram di layar selebar 430px: panel kontrol di atas, karya persegi yang sudah jadi di bawah dan pil ekspor mengambang](/t/url-shot?url=%2F%23%2Ftool%2Faudiogram%3Faudio%3Dzzfxm%3A7%3Alofi%26title%3DField%2520notes%26subtitle%3DEpisode%252012%26style%3Dwave&width=430&height=900&dpi=192&waitMs=3200&css=%23ag-wave%7Bdisplay%3Anone!important%7D.ag-ph%7Bdisplay%3Ablock!important%7D&walker=1&format=svg&rasterDpi=110&dark=1&filename=ov2-phone-audiogram)

Aplikasi web juga menyertakan **Batch** (`#/batch`, `shells/web/src/pro/`), grid bergaya spreadsheet yang merender banyak baris sekaligus menggunakan satu atau beberapa alat. Lihat [Batch dan Lolly Multi-edit](/info/batch.html#make-many-versions-of-one-design). **Settings → Capabilities** mencantumkan semua kemampuan yang dinyatakan oleh platform.

![Batch pada instalasi baru: satu baris kosong menunggu alat, dengan area spreadsheet dan tombol Render yang sudah tersedia sebelum data apa pun masuk](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=ov2-batch-grid)

<!--i:eti-lock-->
## Komitmen arsitektur

Keputusan ini sudah ditetapkan. Setiap keputusan lain dalam basis kode bergantung padanya, jadi mengubah salah satunya merupakan pekerjaan besar.

### 1. Alat deklaratif, dengan jalur alternatif imperatif

Sebuah alat terdiri dari manifes (`tool.json`), templat (`template.html`) dan `hooks.js` opsional. **Manifes mendeklarasikan input**. Input tidak pernah disimpulkan dari token Handlebars dalam templat. Sebagian besar alat hanya terdiri dari manifes dan templat, sehingga orang yang bukan pengembang pun dapat membuatnya.

![Tumpukan kontrol Street Map: dropdown kota, pemilih tema, penggeser ketebalan dan pemicu warna, semuanya dihasilkan dari baris manifes](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-street-map-controls)

Alat yang menghitung nilai, seperti enkode QR atau pembentukan grafik, menambahkan hook: fungsi bernama dalam siklus hidup yang dipanggil runtime dengan jembatan kapabilitas yang disuntikkan. Hook adalah kontrak portabilitas, bukan sandbox keamanan. Hook berjalan dalam batas waktu. Alat dengan hook yang terbukti tidak menggunakan variabel global halaman memiliki `isolate: true` dan berjalan dalam Worker. [Hook alat](/info/tool-hooks.html) memuat siklus hidup dan batas waktunya. [Model Ancaman](/info/threat-model.html) menjelaskan apa yang dibatasi dan tidak dibatasi oleh eksekutor dalam halaman.

### 2. Alat dan aset adalah data, bukan kode yang dibundel

Aplikasi web dan Tauri mengambil katalog alat dan aset saat dimulai, menyimpannya dalam cache dan menggunakan apa yang ada di cache. Alat atau aset baru tidak memerlukan rilis aplikasi. Byte aset diperiksa dengan checksum SHA-256. `id` dan `version` aset menentukan invalidasi cache.

### 3. Jembatan kapabilitas adalah satu-satunya API yang terlihat oleh alat

Alat tidak pernah menyentuh DOM di luar templatnya, tidak pernah memanggil `fetch` secara langsung dan tidak pernah membaca sistem file. Alat memanggil metode `host.*` yang berversi. Kontraknya ditetapkan dalam `packages/core/src/host-v1.ts`, di SDK pembuat alat `@lolly-tools/core`. Pihak ketiga dapat mengembangkan dengan SDK tanpa bergantung pada engine. `engine/src/bridge/host-v1.ts` mengekspor ulang tipenya.

| API wajib | Fungsinya |
|---|---|
| `host.profile` | Detail pengguna; mengisi input di awal melalui `bindToProfile` |
| `host.assets` | Kueri katalog, resolusi aset dan pemilih milik host |
| `host.state` | Menyimpan dan memuat slot input: IndexedDB di web, sistem file di Tauri, memori di CLI |
| `host.clipboard` | Menulis teks atau gambar ke clipboard, dengan mekanisme cadangan sesuai platform |
| `host.export` | Merasterisasi atau menserialisasi target render, serta jalur transformasi file di perangkat |
| `host.log` | Pencatatan log dengan tingkat keparahan ke host |

Setiap API lain bersifat opsional dan menambah kemampuan: `tokens`, `text`, `color`, `geom`, `pdf`, `compose`, `media`, `recorder` dan banyak lagi. `requires` dalam manifes mencantumkan API opsional yang dipanggil hook tanpa pemeriksaan terlebih dahulu. Host yang tidak memiliki salah satunya menolak memasang alat. Hook mendeteksi ketersediaan fitur untuk API lainnya. Beberapa, seperti `recorder`, juga memerlukan kemampuan perangkat yang dideklarasikan alat. `packages/core/src/host-v1/apis.ts` mencantumkan semuanya dan [Host API](/info/host-api.html) mendokumentasikan masing-masing. Penambahan metode menghasilkan versi minor. Penghapusan atau perubahan metode menghasilkan versi mayor, dan v1 tetap berfungsi saat v2 dirilis.

### 4. ID aset berlaku selamanya

`lolly/logo/primary` adalah kontrak. Setelah diterbitkan, id tidak pernah berubah dan tidak pernah digunakan ulang. Perubahan byte menaikkan `version` dalam entri aset. Penggantian menetapkan `deprecated: true` dan, secara opsional, `replacedBy`. Referensi yang ada selalu dapat diresolusikan, sehingga sesi tersimpan dan tautan yang dibagikan tetap berfungsi selama bertahun-tahun.

### 5. Mode URL mendapat dukungan penuh

Setiap input dapat dinyatakan sebagai parameter URL, jadi tautan adalah file jadi:

```
https://lolly.tools/t/qr-code?url=https://example.com&ecl=H
```

![Tautan itu saja, tanpa apa pun selainnya, adalah file jadi](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Fexample.com%26ecl%3DH%26full&width=760&height=760&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-url-mode-qr)

Ubah sebuah parameter dan Anda mendapatkan file yang berbeda. Palet ini terdiri dari satu warna awal, harmoni dan jumlah langkah:

![Sembilan langkah dalam empat rona, semuanya berasal dari satu warna awal yang dibawa dalam tautan](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3De0521a%26harmony%3Dtetrad-4%26steps%3D9%26full&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-url-palette)

CLI membentuk status URL yang sama dari argumennya dan menjalankan jalur pemrosesan yang sama, sehingga CLI tidak dapat menyimpang dari aplikasi. `engine/src/url-mode.ts` mengurai dan menserialisasi status URL. Nama yang dicadangkan (`format`, `width`, `dpi`, `c2pa`, `z` dan lainnya) tidak pernah diteruskan ke alat. [Parameter URL yang dicadangkan](/info/url-parameters.html) mencantumkan semuanya. Input aset dibawa melalui `id` dan diresolusikan melalui `host.assets.get()` sebelum templat diisi.

### 6. Penyimpanan melalui jembatan

Aplikasi web menggunakan IndexedDB, Tauri menggunakan sistem file dan CLI menggunakan memori. Alat hanya melihat `host.state.save(slot, data)` dan `host.state.load(slot)`, tidak pernah `localStorage`. Orang dapat menyimpan beberapa sesi bernama per alat tanpa akun. Karena jembatan adalah satu-satunya titik penghubung, status itu juga portabel. `shells/web/src/data-transfer.ts` mengekspor status sebagai satu file `lolly-backup` yang dapat diimpor ke instalasi lain mana pun ([Transfer data](/info/data-transfer.html)). [Sync](/info/sync.html) mengirim bundel yang sama ke penyimpanan yang dipilih orang tersebut.

### 7. Tag kematangan menunjukkan status alat

Setiap alat mendeklarasikan `status: official | community | experimental`. Galeri mengurutkan berdasarkan status. Alat eksperimental memberi watermark pada ekspornya secara default: runtime mengaktifkan watermark kecuali pemanggil meneruskan `watermark: false`. Alat yang berjalan di perangkat dikecualikan. Proses katalog milik tim sendiri diterapkan di atas tag ini.

### 8. Tipe input ditetapkan dalam manifes

Input mendeklarasikan `type`: `text`, `longtext`, `number`, `boolean`, `color`, `select`, `asset`, `date`, `time`, `datetime-local`, `url`, `blocks`, `vector`, `table` atau `file`. Host merender kontrol untuk setiap tipe, sehingga alat tidak perlu menulis kode kontrol. Input apa pun dapat memiliki `bindToProfile`. Tiga tipe yang paling penting:

- **`asset`**, dengan `filter` dan `allowUpload`, adalah jembatan ke sistem aset. `allowUpload: false` membatasi slot pada aset pustaka. Unggahan pengguna menggunakan struktur `AssetRef` yang sama dengan pustaka.
- **`blocks`** adalah grup field berulang yang disunting di panel samping, digunakan oleh Meeting Planner, Wayfinding, Diagrams dan lainnya. Mengeklik blok yang dirender memfokuskan barisnya.
- **`file`** menyimpan file milik pengguna dalam memori untuk utilitas di perangkat seperti Lolly Strip Hidden Data dan Compress, dan **`vector`** mengelompokkan sekumpulan angka tetap ke dalam satu kontrol.

### 9. Templat tidak memuat logika

Templat menggunakan Handlebars, sehingga orang yang bukan pengembang dapat menulisnya. `{{x}}` melakukan escape, dan `{{{x}}}` harus dipilih secara eksplisit. Logika berada dalam `hooks.js`, tempat logika dapat ditinjau. Banyak templat menggunakan `{{{` untuk markup yang dihitung oleh hook, jadi setiap hook harus melakukan escape pada apa yang diserahkannya. Helper yang tersedia adalah `default`, `upper`, `lower`, `eq`, `markdown`, `asset`, `framing` dan `media`, serta `icsStamp`, `rfcText`, `csvCell` dan `arrow` untuk templat pendamping `.ics`, `.vcf` dan `.csv`. [Templat dan rendering](/info/tool-rendering.html) membahasnya.

### 10. Alat menggabungkan alat lain

Sebuah alat dapat menyematkan render alat lain tanpa impor antaralat. Engine menangani komposisinya. Manifes dapat mendeklarasikan `composes: [{ id, tool, inputs }]` dan menempatkan elemen anak dengan `{{asset <id>}}`. URL penyematan portabel (`https://lolly.tools/tool/<id>.svg?…`) merender elemen anak secara lokal; Lolly Design menempatkan kode QR atau grafik langsung dengan cara ini. Elemen anak SVG tetap berupa vektor dalam induk SVG atau PDF. Elemen anak merupakan hasil perantara dan tidak pernah diberi watermark atau cap. Shell yang tidak dapat merender elemen anak membiarkan slotnya kosong, dan induknya tetap dirender. [Komposisi dan overlay merek](/info/tool-composition.html) memuat detailnya.

<!--i:eti-scissors-->
## Hal yang kami pilih untuk tidak dilakukan

- **Tidak ada JavaScript sembarang dalam templat.** Logika berada dalam `hooks.js`.
- **Tidak ada server aset wajib.** Orang menambahkan file sendiri ke Assets di aplikasi dan menyerahkan pekerjaan sebagai sesi: tautan berbagi untuk input dan pengaturan, file `.lolly` jika unggahan ikut dibawa. Sesi yang dibagikan dapat menjadi templat dalam pemilih alat. Organisasi yang menginginkan katalog terkelola dapat menggunakan katalog, persetujuan dan kebijakan Lolly Work, atau mengelola paket merek di git dan meninjau perubahan di sana.
- **Tidak ada kontrol akses yang dipaksakan.** Aplikasi terbuka bersifat publik secara default. Tag kematangan dan watermark menandai risiko terhadap merek. Login organisasi, peran dan kebijakan disediakan oleh Lolly Work jika tim menginginkannya.
- **Tidak ada basis data pusat.** Status pengguna berada di setiap perangkat, dan Sync opsional menyalinnya ke penyimpanan yang dipilih orang tersebut, tidak pernah ke basis data Lolly.
- **Tidak ada jalur kode bersama antara alat dan engine.** Engine dan alat komunitas bersifat open source. Paket merek seperti `brands/suse/` yang privat membawa alat dan katalognya sendiri dengan ketentuannya sendiri. Tidak ada alat yang mengimpor dari `engine/`, sehingga pemisahan tetap jelas.

<!--i:eti-refresh-->
## Siklus hidup satu render

Seseorang membuka `https://lolly.tools/t/qr-code?url=https://example.com&ecl=H`:

1. **Mulai.** Aplikasi web membuka IndexedDB, membangun jembatan kapabilitas dan menyinkronkan katalog alat dan aset, atau memuatnya dari cache saat offline.
2. **Tentukan rute.** Path memilih tampilan alat untuk `qr-code`, dengan kueri sebagai nilai awalnya.
3. **Muat.** `loadTool` mengambil `tool.json`, memvalidasinya terhadap skema dan mengambil templat, gaya dan hook.
4. **Urai tautan.** `parseUrlState` mengubah parameter menjadi nilai input. Referensi aset seperti `?logo=lolly/logo/primary` menjadi `{ id }` yang belum diresolusikan.
5. **Mulai runtime.** `createRuntime(tool, host, initialValues)` membangun model input dari data profil, nilai default dan tautan, meresolusikan referensi aset, memuat hook dan memanggil `onInit`.
6. **Render.** Shell berlangganan ke runtime, menggambar kontrol dari model dan menulis templat yang telah diisi ke dalam `#tool-canvas`.
7. **Berinteraksi.** Mengetik memanggil `runtime.setInput`, yang menerapkan batasan, memanggil `onInput`, mengisi kembali templat dan menggambar ulang.
8. **Ekspor.** **Download** memanggil `runtime.export(node, format)`, dan `host.export` milik shell menghasilkan file: raster, vektor dari penelusur DOM, PDF, dokumen atau salah satu format lain dalam `schemas/tool.schema.json`. Satuan fisik dikonversi sesuai format. Metadata dan Content Credentials disematkan jika format dapat menampungnya. Alat eksperimental mendapatkan watermark dari host, bukan dari alat. [Templat dan rendering](/info/tool-rendering.html) dan [Ekspor file](/info/exporting.html) membahas langkah ekspor.

![Panel ekspor yang dibuka oleh ?options: pasangan nama file dan format, ukuran keluaran dan kontrol yang menulis file](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=aud-export-popup)

Siklus hidup yang sama berjalan di Tauri dan di CLI dengan DOM headless, tempat keluaran dikirim ke file atau stdout.

<!--i:eti-stamp-->
## Lisensi

Kode, termasuk `engine/`, `shells/`, `services/`, `schemas/` dan generator dokumentasi, berlisensi MPL-2.0, dalam satu repositori publik, [`lolly-tools/lolly`](https://github.com/lolly-tools/lolly). Prosa dokumentasi berlisensi CC BY-SA 4.0. Paket merek memiliki ketentuannya sendiri dalam `NOTICE.md` setiap paket: alat komunitas berlisensi MPL-2.0, dan paket SUSE yang privat bersifat proprieter milik SUSE. [Tentang](/info/about.html) memuat catatan lisensi lengkap.
