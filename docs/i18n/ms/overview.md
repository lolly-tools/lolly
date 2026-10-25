# Seni bina Lolly

![Ikon Lolly - Gula-gula lollipop hijau dan putih yang besar](/info/icon.svg)

Halaman ini untuk orang yang mengubah kod Lolly: bagaimana enjin, shell dan pek alat berpadu, di mana setiap satu berada dalam repositori, dan komitmen yang mengekang setiap perubahan. Jika anda mahu tahu apa yang Lolly lakukan dan siapa yang menggunakannya, baca [How Lolly works](/info/how-lolly-works.html) dahulu.

Dua pendamping masuk lebih dalam. [`engine/README.md`](../engine/README.md) ialah peta modul demi modul enjin, dijana daripada kod. [Threat Model & Trust Boundaries](/info/threat-model.html) membaca seni bina yang sama sebagai sempadan kepercayaan, dan ia ialah halaman untuk sebarang soalan tentang apa yang dianggap enjin sebagai tidak dipercayai.

## Gambaran besar

Alat ialah data di bahagian atas. Enjin di tengah tidak tahu apa-apa tentang sebarang platform. Shell di bahagian bawah melaksanakan satu kontrak, dan katalog membekalkan kandungan.

![Alat membekalkan manifes, templat dan hook kepada enjin dikongsi. Shell web, Tauri dan terminal melaksanakan jambatan keupayaan HostV1 dan membaca alat serta aset daripada katalog.](/info/diagrams/concepts/platform-layers.svg)

Jika anda boleh menerangkannya dalam data tulen dan Handlebars, ia milik **enjin**. Jika ia menyentuh DOM, sistem fail, rangkaian atau mana-mana API pelayar atau sistem pengendalian, ia milik **hos**, sisi shell pada jambatan. Enjin ialah sumber terbuka, dan tiada apa-apa yang mengetahui tentang jenama atau platform tertentu masuk ke dalam enjin.

## Susun atur repositori

Lolly ialah satu repositori. Setiap direktori di bawah ialah direktori biasa di dalamnya, kecuali `brands/suse`, submodul git **persendirian** yang memegang pek alat dan katalog SUSE, yang tidak diambil oleh klon awam. Pek mana yang dibaca binaan ialah profil kandungan (`profiles.json`), diselesaikan bagi setiap proses dan bukan ditukar secara global. [Build Guide](/info/build-guide.html) mempunyai perintah klon dan cara perubahan dalam pek persendirian dikomit.

| Direktori | Apa yang dipegangnya |
|---|---|
| `engine/` | Teras tidak bergantung platform: pemuat, masa jalan, input, templat, mod URL, unit dan modul format |
| `shells/` | Apl web, apl desktop dan mudah alih Tauri, CLI, TUI dan sambungan pelayar |
| `packages/` | SDK pengarang alat (`@lolly-tools/core`), bahagian shell Node dikongsi dan perender dokumen, antara lain |
| `community/` | Alat tanpa jenama, serta pek emoji dikongsi |
| `brands/` | Pek jenama: `lolly-demo` (Lolly Demo, sistem reka bentuk yang dijalankan lolly.tools), `lolly-start` (permulaan kosong) dan `suse` persendirian |
| `services/` | Perkhidmatan MCP, sijil dan Penpot pilihan, dan kod pelayan yang dikongsinya |
| `schemas/` | JSON Schema untuk manifes alat, entri aset dan rujukan aset |
| `scripts/`, `tests/`, `docs/`, `api/` | Skrip binaan dan katalog, suite ujian enjin, dokumen ini dan bundle tanpa pelayan yang dijana |

::: details Fail enjin dan shell yang anda temui dahulu
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

Tiada direktori `tools/` atau `catalog/` pada akar repositori. `packages/node-shell/src/content-roots.ts` menjawab "di mana alat `<id>` berada" dan "di mana katalog" daripada `profiles.json` apabila ditanya. Pasangan `tools/` dan `catalog/` sebenar ditulis hanya ke dalam output binaan, seperti `dist/`, muatan RPM atau imej kontena, kerana pelayar mengambil dua laluan itu melalui HTTP.

## Di mana Lolly berjalan

Setiap permukaan menggunakan enjin yang sama dan fail alat yang sama.

- **Apl web.** Apl web progresif yang berfungsi luar talian setelah pekerja perkhidmatannya mencache alat dan aset. Ia tidak memerlukan akaun; keadaan berada dalam IndexedDB pada setiap peranti. Satu reka letak responsif melayani desktop dan telefon: pada telefon kawalan menjadi helaian dan kawalan eksport dibuka daripada pil terapung.
- **Apl desktop dan mudah alih.** Pakej Tauri bagi apl web yang sama, dengan dialog fail natif, keadaan sistem fail dan penggunaan luar talian penuh.
- **CLI.** `lolly <tool-id> --input=value --output=file.png` memuatkan enjin yang sama dalam DOM tanpa kepala dan menulis fail. Ia ialah mod URL melalui pengangkutan berbeza, bukan pelaksanaan berasingan. Lihat [CLI](/info/cli.html).
- **TUI.** Apl terminal skrin penuh yang mengutamakan papan kekunci yang menggunakan semula jambatan CLI, menyimpan sesi tersimpan pada cakera (dalam folder apl desktop sendiri apabila apl dipasang, jika tidak di bawah `~/.lolly`) dan memulakan pelayar tanpa kepala terskop hanya apabila format memerlukannya. Lihat [TUI](/info/tui.html).

![Paparan terbahagi desktop: kawalan dijana daripada manifes di kiri, kanvas langsung di kanan](/t/url-shot?url=%2F%23%2Ftool%2Fchart&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&filename=aud-web-split)

Alat yang sama pada lebar telefon tidak memerlukan reka letak kedua: kawalan menjadi helaian di bahagian atas dan pratonton memegang skrin.

![Audiogram pada skrin selebar 430px: helaian kawalan di atas, karya persegi siap di bawah dan pil eksport terapung](/t/url-shot?url=%2F%23%2Ftool%2Faudiogram%3Faudio%3Dlolly%2Floops%2Ffireplace-loop%26title%3DField%2520notes%26subtitle%3DEpisode%252012%26style%3Dwave&width=430&height=900&dpi=192&waitMs=3200&css=%23ag-wave%7Bdisplay%3Anone!important%7D.ag-ph%7Bdisplay%3Ablock!important%7D&walker=1&format=svg&rasterDpi=110&dark=1&filename=ov2-phone-audiogram)

Apl web juga menghantar **Batch** (`#/batch`, `shells/web/src/pro/`), grid gaya hamparan yang merender banyak baris sekali gus merentasi satu atau banyak alat; [Batch and Multi-edit](/info/batch.html#make-many-versions-of-one-design) meliputi Batch. **Settings → Capabilities** memetakan segala yang diisytiharkan platform boleh dilakukan.

![Batch pada pemasangan baharu: satu baris kosong menunggu alat, dengan permukaan hamparan dan butang Render sedia sebelum sebarang data tiba](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=ov2-batch-grid)

## Komitmen seni bina

Keputusan ini sudah muktamad. Mengubah mana-mana daripadanya ialah usaha besar, kerana ia membentuk setiap keputusan lain dalam pangkalan kod.

### 1. Alat deklaratif, dengan pintu keluar kecemasan imperatif

Alat ialah manifes (`tool.json`), templat (`template.html`) dan `hooks.js` pilihan. **Manifes mengisytiharkan input**, tidak pernah templat: input tidak disimpulkan daripada token Handlebars. Kebanyakan alat hanyalah manifes dan templat, itulah yang membolehkan bukan pembangun mengarangnya.

![Susunan kawalan Street Map: senarai juntai bawah bandar, pilihan tema, gelangsar berat dan pencetus warna, setiap satu dilukis daripada satu baris manifes](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-street-map-controls)

Alat yang mengira nilai, seperti pengekodan QR atau pembentukan carta, menambah hook: fungsi kitar hayat bernama yang dipanggil masa jalan dengan jambatan keupayaan disuntik. Hook ialah kontrak kebolehpindahan, bukan kotak pasir keselamatan, dan ia berjalan dalam belanjawan masa. Alat yang hooknya terbukti bebas daripada global halaman membawa `isolate: true` dan berjalan dalam Worker. [Tool hooks](/info/tool-hooks.html) mempunyai kitar hayat dan belanjawan, dan [Threat Model](/info/threat-model.html) menyatakan apa yang dikandungi dan tidak dikandungi oleh pelaksana dalam halaman.

### 2. Alat dan aset adalah data, bukan kod berbungkus

Apl web dan Tauri mengambil katalog alat dan aset semasa boot, mencachenya dan bekerja dengan apa yang ada, jadi alat atau aset baharu tidak memerlukan keluaran apl. Bait aset disemak SHA-256, dan `id` serta `version` aset memacu pembatalan cache.

### 3. Jambatan keupayaan ialah satu-satunya API yang dilihat alat

Alat tidak pernah menyentuh DOM di luar templatnya, tidak pernah memanggil `fetch` secara terus dan tidak pernah membaca sistem fail. Ia memanggil kaedah `host.*` berversi. Takrifan kanonik kontrak ialah `packages/core/src/host-v1.ts`, SDK pengarang alat `@lolly-tools/core`, supaya pihak ketiga boleh membina terhadapnya tanpa bergantung pada enjin; `engine/src/bridge/host-v1.ts` mengeksport semula jenisnya.

| API diperlukan | Apa yang dilakukannya |
|---|---|
| `host.profile` | Butiran pengguna; mengisi awal input melalui `bindToProfile` |
| `host.assets` | Pertanyaan katalog, penyelesaian aset dan pemilih hos |
| `host.state` | Simpan dan muat slot input: IndexedDB pada web, sistem fail dalam Tauri, memori dalam CLI |
| `host.clipboard` | Tulis teks atau imej ke papan keratan, dengan sandaran platform |
| `host.export` | Rasterkan atau bersirikan sasaran render, dan laluan transformasi fail pada peranti |
| `host.log` | Pengelogan bertingkat kepada hos |

Setiap API lain adalah pilihan dan tambahan: `tokens`, `text`, `color`, `geom`, `pdf`, `compose`, `media`, `recorder` dan banyak lagi. Manifes alat menyenaraikan di bawah `requires` API pilihan yang dipanggil hooknya tanpa menyemak dahulu, dan hos yang tiada satu menolak untuk memasang alat; hook mengesan ciri bagi yang selebihnya. Beberapa, seperti `recorder`, juga memerlukan keupayaan peranti yang diisytiharkan alat. `packages/core/src/host-v1/apis.ts` menyenaraikan semuanya dan [Host API](/info/host-api.html) mendokumenkan setiap satu. Menambah kaedah ialah versi minor; membuang atau mengubah satu ialah versi major, dan v1 terus berfungsi apabila v2 dikeluarkan.

### 4. Id aset adalah selama-lamanya

`lolly/logo/primary` ialah kontrak. Setelah diterbitkan, id tidak pernah berubah dan tidak pernah digunakan semula. Perubahan bait menaikkan `version` dalam entri aset, dan penggantian menetapkan `deprecated: true` dan, pilihan, `replacedBy`, supaya rujukan sedia ada sentiasa diselesaikan. Itulah yang memastikan sesi tersimpan dan pautan dikongsi terus berfungsi bertahun-tahun.

### 5. Mod URL adalah kelas pertama

Setiap input boleh diungkapkan sebagai parameter URL, jadi pautan ialah fail siap:

```
https://lolly.tools/t/qr-code?url=https://example.com&ecl=H
```

![Pautan itu sendiri, tanpa apa-apa lagi di dalamnya, ialah fail siap](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Fexample.com%26ecl%3DH%26full&width=760&height=760&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-url-mode-qr)

Ubah parameter dan anda mendapat fail berbeza. Seluruh palet ini ialah satu warna benih, satu harmoni dan satu bilangan langkah:

![Sembilan langkah merentasi empat rona, semuanya tumbuh daripada warna benih tunggal yang dibawa dalam pautan](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3De0521a%26harmony%3Dtetrad-4%26steps%3D9%26full&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-url-palette)

CLI membina keadaan URL yang sama daripada hujahnya dan menjalankan saluran paip yang sama, jadi CLI tidak boleh menyimpang daripada apl. `engine/src/url-mode.ts` menghuraikan dan membersirikan; set nama terpelihara (`format`, `width`, `dpi`, `c2pa`, `z` dan lain-lain) tidak pernah dihantar kepada alat, dan [Reserved URL parameters](/info/url-parameters.html) menyenaraikan semuanya. Input aset dibawa melalui `id` dan diselesaikan melalui `host.assets.get()` sebelum templat diisi.

### 6. Storan melalui jambatan

Apl web menggunakan IndexedDB, Tauri sistem fail dan CLI memori. Alat hanya melihat `host.state.save(slot, data)` dan `host.state.load(slot)`, tidak pernah `localStorage`. Orang boleh menyimpan beberapa sesi bernama bagi setiap alat tanpa akaun. Oleh kerana jambatan ialah satu-satunya jahitan, keadaan itu juga mudah alih: `shells/web/src/data-transfer.ts` membacanya semula ke dalam satu fail `lolly-backup` yang diimport pada mana-mana pemasangan lain ([Data transfer](/info/data-transfer.html)), dan [Sync](/info/sync.html) menghantar bundle yang sama ke storan yang dipilih orang itu.

### 7. Tag kematangan menyatakan apa sesuatu alat itu

Setiap alat mengisytiharkan `status: official | community | experimental`. Galeri disusun mengikut status, dan alat eksperimen menera air eksportnya secara lalai: masa jalan menghidupkan tera air melainkan pemanggil menghantar `watermark: false`, dan alat pada peranti dikecualikan. Apa sahaja proses yang diletakkan pasukan di sekeliling katalog berada di atas ini.

### 8. Input ditaip dalam manifes

Input mengisytiharkan `type`: `text`, `longtext`, `number`, `boolean`, `color`, `select`, `asset`, `date`, `time`, `datetime-local`, `url`, `blocks`, `vector`, `table` atau `file`. Hos merender kawalan bagi setiap jenis, jadi alat tidak menulis kod kawalan, dan mana-mana input boleh membawa `bindToProfile`. Tiga membawa paling berat:

- **`asset`**, dengan `filter` dan `allowUpload`, ialah jambatan kepada sistem aset. `allowUpload: false` mengehadkan slot kepada aset pustaka, dan muat naik pengguna berkongsi bentuk `AssetRef` pustaka.
- **`blocks`** ialah kumpulan medan berulang yang disunting dalam panel sisi, digunakan oleh Meeting Planner, Wayfinding, Diagrams dan lain-lain. Mengklik blok yang dirender memfokuskan barisnya.
- **`file`** memegang fail pengguna sendiri dalam memori untuk utiliti pada peranti seperti Strip Hidden Data dan Compress, dan **`vector`** mengumpulkan set nombor tetap ke dalam satu kawalan.

### 9. Templat tanpa logik

Templat ialah Handlebars, dipilih supaya bukan pembangun boleh menulisnya: `{{x}}` melepaskan, dan `{{{x}}}` ialah ikut serta yang jelas. Logik berada dalam `hooks.js`, di mana ia jelas dan boleh disemak. Banyak templat menggunakan `{{{` untuk markup yang dikira hook, jadi setiap hook mesti melepaskan apa yang diserahkannya. Pembantu ialah `default`, `upper`, `lower`, `eq`, `markdown`, `asset`, `framing` dan `media`, serta `icsStamp`, `rfcText`, `csvCell` dan `arrow` untuk templat `.ics`, `.vcf` dan `.csv` adik-beradik. [Templates and rendering](/info/tool-rendering.html) meliputinya.

### 10. Alat menggubah alat

Alat boleh membenamkan render alat lain tanpa import alat-ke-alat; enjin menyelesaikan gubahan. Manifes boleh mengisytiharkan `composes: [{ id, tool, inputs }]` dan meletakkan anak dengan `{{asset <id>}}`, dan URL benam mudah alih (`https://lolly.tools/tool/<id>.svg?…`) merender anak secara setempat, itulah cara Design meletakkan kod QR atau carta langsung. Anak SVG kekal vektor dalam induk SVG atau PDF. Anak ialah perantaraan, tidak pernah ditera air atau dicap, dan shell yang tidak dapat merender satu membiarkan slot kosong manakala induk masih dirender. [Composition and brand overlays](/info/tool-composition.html) mempunyai butirannya.

## Apa yang kami pilih untuk tidak lakukan

- **Tiada JavaScript sewenang-wenangnya dalam templat.** Logik berada dalam `hooks.js`.
- **Tiada pelayan aset wajib.** Orang menambah fail mereka sendiri ke Assets dalam apl dan menyerahkan kerja sebagai sesi: pautan kongsi untuk input dan tetapan, fail `.lolly` apabila muat naik turut dibawa. Sesi dikongsi boleh menjadi templat dalam pemilih alat. Organisasi yang mahukan katalog ditadbir boleh menggunakan katalog, kelulusan dan dasar Lolly Work, atau mengurus pek jenama dalam git dan menyemak perubahan di sana.
- **Tiada kawalan akses paksa.** Apl terbuka adalah awam secara lalai, dan teg kematangan serta tera air membawa risiko jenama. Log masuk organisasi, peranan dan dasar datang daripada Lolly Work apabila pasukan mahukannya.
- **Tiada pangkalan data pusat.** Keadaan pengguna berada pada setiap peranti, dan Sync pilihan menyalinnya ke storan yang dipilih orang itu, tidak pernah ke pangkalan data Lolly.
- **Tiada laluan kod dikongsi antara alat dan enjin.** Enjin dan alat komuniti ialah sumber terbuka, dan pek jenama seperti `brands/suse/` persendirian membawa alat dan katalognya sendiri di bawah terma sendiri. Tiada alat mengimport daripada `engine/`, jadi pemisahan kekal bersih.

## Kitaran hayat satu render

Seseorang membuka `https://lolly.tools/t/qr-code?url=https://example.com&ecl=H`:

1. **Boot.** Apl web membuka IndexedDB, membina jambatan keupayaan dan menyegerakkan katalog alat dan aset, atau memuatkannya daripada cache apabila luar talian.
2. **Laluan.** Laluan memilih paparan alat untuk `qr-code`, dengan pertanyaan sebagai nilai awalnya.
3. **Muat.** `loadTool` mengambil `tool.json`, mengesahkannya terhadap skema dan mengambil templat, gaya dan hook.
4. **Huraikan pautan.** `parseUrlState` menukar parameter kepada nilai input. Rujukan aset seperti `?logo=lolly/logo/primary` menjadi `{ id }` yang belum diselesaikan.
5. **Mulakan masa jalan.** `createRuntime(tool, host, initialValues)` membina model input daripada data profil, lalai dan pautan, menyelesaikan rujukan aset, memuatkan hook dan memanggil `onInit`.
6. **Render.** Shell melanggan masa jalan, melukis kawalan daripada model dan menulis templat terisi ke dalam `#tool-canvas`.
7. **Berinteraksi.** Menaip memanggil `runtime.setInput`, yang menggunakan kekangan, memanggil `onInput`, mengisi templat semula dan melukis semula.
8. **Eksport.** **Download** memanggil `runtime.export(node, format)`, dan `host.export` shell menghasilkan fail: raster, vektor daripada pejalan DOM, PDF, dokumen atau salah satu format lain dalam `schemas/tool.schema.json`. Unit fizikal ditukar bagi setiap format, dan metadata serta Content Credentials dibenamkan di mana format boleh memegangnya. Alat eksperimen mendapat tera air daripada hos, bukan alat. [Templates and rendering](/info/tool-rendering.html) dan [Export a file](/info/exporting.html) meliputi langkah eksport.

![Panel eksport yang dibuka oleh ?options: pasangan nama fail dan format, saiz output dan kawalan yang menulis fail](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=aud-export-popup)

Kitar hayat yang sama berjalan dalam Tauri, dan dalam CLI dengan DOM tanpa kepala, di mana output pergi ke fail atau stdout.

## Lesen

Kod, termasuk `engine/`, `shells/`, `services/`, `schemas/` dan penjana dokumentasi, ialah MPL-2.0, dalam satu repositori awam, [`lolly-tools/lolly`](https://github.com/lolly-tools/lolly). Prosa dokumentasi ialah CC BY-SA 4.0. Pek jenama membawa terma sendiri dalam `NOTICE.md` setiap pek: alat komuniti ialah MPL-2.0, dan pek SUSE persendirian adalah proprietari kepada SUSE. [About](/info/about.html) mempunyai nota pelesenan penuh.
