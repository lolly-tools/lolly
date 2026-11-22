# Seni bina Lolly

![Ikon Lolly - Gula-gula lolipop besar berwarna hijau dan putih](/info/icon.svg)

Halaman ini untuk mereka yang mengubah kod Lolly: cara enjin, shell dan pek alat digabungkan, lokasi setiap satunya dalam repositori dan komitmen yang mengehadkan setiap perubahan. Untuk mengetahui apa yang Lolly lakukan dan siapa yang menggunakannya, baca [Cara Lolly berfungsi](/info/how-lolly-works.html) dahulu.

[`engine/README.md`](https://github.com/lolly-tools/lolly/blob/main/engine/README.md) memetakan enjin mengikut modul dan dijana daripada kod. [Model Ancaman & Sempadan Kepercayaan](/info/threat-model.html) melihat seni bina yang sama sebagai sempadan kepercayaan dan menyatakan apa yang dianggap tidak dipercayai oleh enjin.

<!--i:eti-layers-->
## Gambaran keseluruhan

Alat ialah data di bahagian atas. Enjin di tengah tidak mengetahui apa-apa tentang mana-mana platform. Shell di bahagian bawah melaksanakan satu kontrak, dan katalog membekalkan kandungan.

![Alat membekalkan manifes, templat dan hook kepada enjin bersama. Shell web, Tauri dan terminal melaksanakan jambatan keupayaan HostV1 dan membaca alat serta aset daripada katalog.](/info/diagrams/concepts/platform-layers.svg)

Apa-apa yang boleh anda huraikan dengan data tulen dan Handlebars tergolong dalam **enjin**. Apa-apa yang menyentuh DOM, sistem fail, rangkaian atau mana-mana API pelayar atau sistem pengendalian tergolong dalam **hos**, bahagian shell pada jambatan itu. Enjin ialah sumber terbuka. Tiada apa-apa yang mengetahui tentang jenama tertentu dimasukkan ke dalam enjin.

<!--i:eti-folder-shared-->
## Susun atur repositori

Lolly ialah satu repositori. Setiap direktori di bawah ialah direktori biasa, kecuali `brands/suse`: submodul git **peribadi** dengan pek alat dan katalog SUSE, yang tidak diambil oleh klon awam. Profil kandungan (`profiles.json`) menetapkan pek yang dibaca oleh sesuatu binaan. Setiap proses menentukan profilnya sendiri, dan tiada suis global. [Panduan Binaan](/info/build-guide.html) mempunyai arahan klon dan cara mengkomit perubahan dalam pek peribadi.

| Direktori | Kandungannya |
|---|---|
| `engine/` | Teras yang bebas platform: pemuat, runtime, input, templat, mod URL, unit dan modul format |
| `shells/` | Apl web, apl desktop dan mudah alih Tauri, CLI, TUI dan sambungan pelayar |
| `packages/` | SDK pengarang alat (`@lolly-tools/core`), komponen shell Node bersama dan perender dokumentasi, antara lainnya |
| `community/` | Alat yang bebas jenama, serta pek emoji bersama |
| `brands/` | Pek jenama: `lolly-demo` (Lolly Demo, sistem reka bentuk yang digunakan lolly.tools), `lolly-start` (pek permulaan kosong) dan `suse` peribadi |
| `services/` | Perkhidmatan MCP, sijil dan Penpot pilihan, serta kod pelayan yang dikongsi bersama |
| `schemas/` | JSON Schema untuk manifes alat, entri aset dan rujukan aset |
| `scripts/`, `tests/`, `docs/`, `api/` | Skrip binaan dan katalog, suit ujian enjin, dokumentasi ini dan pakej tanpa pelayan yang dijana |

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

::: note Tiada direktori `tools/` atau `catalog/` di akar repositori
`packages/node-shell/src/content-roots.ts` menjawab "di manakah alat `<id>` berada" dan "di manakah katalog" berdasarkan `profiles.json`. Pasangan `tools/` dan `catalog/` sebenar hanya ditulis ke dalam output binaan, seperti `dist/`, muatan RPM atau imej bekas, kerana pelayar mengambil kedua-dua laluan itu melalui HTTP.
:::

<!--i:eti-monitor-->
## Tempat Lolly berjalan

Setiap antara muka menggunakan enjin dan fail alat yang sama.

- **Apl web.** Apl web progresif. Ia berfungsi luar talian selepas service worker menyimpan alat dan aset dalam cache. Ia tidak memerlukan akaun, dan keadaan disimpan dalam IndexedDB pada setiap peranti. Satu reka letak responsif digunakan pada desktop dan telefon. Pada telefon, kawalan menjadi panel dan kawalan eksport dibuka daripada pil terapung.
- **Apl desktop dan mudah alih.** Pakej Tauri bagi apl web yang sama, dengan dialog fail asli, keadaan dalam sistem fail dan penggunaan luar talian sepenuhnya.
- **CLI.** `lolly <tool-id> --input=value --output=file.png` memuatkan enjin yang sama dalam DOM tanpa paparan dan menulis fail. Ia ialah mod URL melalui pengangkutan yang berbeza. Lihat [CLI](/info/cli.html).
- **TUI.** Apl terminal skrin penuh yang mengutamakan papan kekunci. Ia menggunakan semula jambatan CLI dan menyimpan sesi tersimpan pada cakera: dalam folder apl desktop apabila apl dipasang, jika tidak di bawah `~/.lolly`. Ia memulakan pelayar tanpa paparan dengan skop terhad hanya apabila sesuatu format memerlukannya. Lihat [TUI](/info/tui.html).

![Paparan pisah desktop: kawalan yang dijana daripada manifes di sebelah kiri, kanvas langsung di sebelah kanan](/t/url-shot?url=%2F%23%2Ftool%2Fchart&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&filename=aud-web-split)

Pada lebar telefon, panel kawalan berada di bahagian atas dan pratonton memenuhi skrin.

![Audiogram pada skrin selebar 430px: panel kawalan di atas, karya seni segi empat sama yang siap di bawah dan pil eksport terapung](/t/url-shot?url=%2F%23%2Ftool%2Faudiogram%3Faudio%3Dzzfxm%3A7%3Alofi%26title%3DField%2520notes%26subtitle%3DEpisode%252012%26style%3Dwave&width=430&height=900&dpi=192&waitMs=3200&css=%23ag-wave%7Bdisplay%3Anone!important%7D.ag-ph%7Bdisplay%3Ablock!important%7D&walker=1&format=svg&rasterDpi=110&dark=1&filename=ov2-phone-audiogram)

Apl web juga menyertakan **Batch** (`#/batch`, `shells/web/src/pro/`), grid gaya hamparan yang merender banyak baris serentak merentas satu atau banyak alat. Lihat [Batch dan Lolly Multi-edit](/info/batch.html#make-many-versions-of-one-design). **Settings → Capabilities** menyenaraikan semua yang diisytiharkan oleh platform sebagai keupayaannya.

![Batch pada pemasangan baharu: satu baris kosong menunggu alat, dengan paparan hamparan dan butang Render tersedia sebelum sebarang data tiba](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=ov2-batch-grid)

<!--i:eti-lock-->
## Komitmen seni bina

Keputusan ini telah dimuktamadkan. Setiap keputusan lain dalam pangkalan kod bergantung padanya, jadi mengubah satu daripadanya memerlukan usaha besar.

### 1. Alat deklaratif, dengan pilihan untuk menggunakan kod imperatif

Sesuatu alat terdiri daripada manifes (`tool.json`), templat (`template.html`) dan `hooks.js` pilihan. **Manifes mengisytiharkan input**. Input tidak pernah disimpulkan daripada token Handlebars dalam templat. Kebanyakan alat hanya terdiri daripada manifes dan templat, jadi mereka yang bukan pembangun boleh mengarangnya.

![Susunan kawalan Street Map: senarai juntai bawah bandar, pemilih tema, gelangsar ketebalan dan pencetus warna, setiap satunya diambil daripada baris manifes](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-street-map-controls)

Alat yang mengira nilai, seperti pengekodan QR atau pembentukan carta, menambah hook: fungsi kitar hayat bernama yang dipanggil runtime dengan jambatan keupayaan disuntikkan. Hook ialah kontrak kebolehalihan, bukan kotak pasir keselamatan. Ia berjalan dalam had masa. Alat dengan hook yang terbukti bebas daripada pemboleh ubah global halaman membawa `isolate: true` dan berjalan dalam Worker. [Hook alat](/info/tool-hooks.html) mempunyai kitar hayat dan had masa. [Model Ancaman](/info/threat-model.html) menyatakan apa yang dibendung dan tidak dibendung oleh pelaksana dalam halaman.

### 2. Alat dan aset ialah data, bukan kod yang dipakejkan

Apl web dan Tauri mengambil katalog alat dan aset semasa bermula, menyimpannya dalam cache dan menggunakan apa yang dicache. Alat atau aset baharu tidak memerlukan keluaran apl. Bait aset disemak dengan jumlah semak SHA-256. `id` dan `version` aset menentukan pembatalan cache.

### 3. Jambatan keupayaan ialah satu-satunya API yang dilihat alat

Alat tidak pernah menyentuh DOM di luar templatnya, tidak pernah memanggil `fetch` secara langsung dan tidak pernah membaca sistem fail. Alat memanggil kaedah `host.*` berversi. Kontrak ditakrifkan dalam `packages/core/src/host-v1.ts`, dalam SDK pengarang alat `@lolly-tools/core`. Pihak ketiga boleh membina dengan SDK tanpa bergantung pada enjin. `engine/src/bridge/host-v1.ts` mengeksport semula jenisnya.

| API wajib | Fungsinya |
|---|---|
| `host.profile` | Butiran pengguna; mengisi input terlebih dahulu melalui `bindToProfile` |
| `host.assets` | Pertanyaan katalog, penyelesaian rujukan aset dan pemilih hos |
| `host.state` | Menyimpan dan memuatkan slot input: IndexedDB pada web, sistem fail dalam Tauri, memori dalam CLI |
| `host.clipboard` | Menulis teks atau imej ke papan keratan, dengan kaedah sandaran mengikut platform |
| `host.export` | Merasterkan atau menserialkan sasaran render, serta laluan transformasi fail pada peranti |
| `host.log` | Pengelogan mengikut aras kepada hos |

Setiap API lain adalah pilihan dan tambahan: `tokens`, `text`, `color`, `geom`, `pdf`, `compose`, `media`, `recorder` dan banyak lagi. `requires` dalam manifes menyenaraikan API pilihan yang dipanggil hook tanpa menyemak terlebih dahulu. Hos yang tiada salah satunya enggan memuatkan alat itu. Hook mengesan ketersediaan ciri bagi yang selebihnya. Beberapa API, seperti `recorder`, juga memerlukan keupayaan peranti yang diisytiharkan oleh alat. `packages/core/src/host-v1/apis.ts` menyenaraikan semuanya dan [API Hos](/info/host-api.html) mendokumenkan setiap satunya. Menambah kaedah menghasilkan versi minor. Membuang atau mengubah kaedah menghasilkan versi major, dan v1 terus berfungsi apabila v2 dikeluarkan.

### 4. Id aset kekal selama-lamanya

`lolly/logo/primary` ialah kontrak. Setelah diterbitkan, id tidak pernah berubah dan tidak pernah digunakan semula. Perubahan bait menaikkan `version` dalam entri aset. Penggantian menetapkan `deprecated: true` dan, secara pilihan, `replacedBy`. Rujukan sedia ada sentiasa dapat diselesaikan, jadi sesi tersimpan dan pautan dikongsi terus berfungsi bertahun-tahun.

### 5. Mod URL mendapat sokongan utama

Setiap input boleh dinyatakan sebagai parameter URL, jadi pautan ialah fail siap:

```
https://lolly.tools/t/qr-code?url=https://example.com&ecl=H
```

![Pautan itu sahaja, tanpa apa-apa lagi di dalamnya, ialah fail siap](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Fexample.com%26ecl%3DH%26full&width=760&height=760&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-url-mode-qr)

Ubah parameter dan anda mendapat fail yang berbeza. Palet ini terdiri daripada satu warna asas, satu harmoni dan bilangan langkah:

![Sembilan langkah merentas empat rona, semuanya terhasil daripada satu warna asas yang dibawa dalam pautan](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3De0521a%26harmony%3Dtetrad-4%26steps%3D9%26full&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-url-palette)

CLI membina keadaan URL yang sama daripada argumennya dan menjalankan saluran pemprosesan yang sama, jadi CLI tidak boleh menyimpang daripada apl. `engine/src/url-mode.ts` menghuraikan dan menserialkan keadaan URL. Nama terpelihara (`format`, `width`, `dpi`, `c2pa`, `z` dan lain-lain) tidak pernah dihantar kepada alat. [Parameter URL terpelihara](/info/url-parameters.html) menyenaraikan semuanya. Input aset dibawa melalui `id` dan rujukannya diselesaikan melalui `host.assets.get()` sebelum templat diisi.

### 6. Storan melalui jambatan

Apl web menggunakan IndexedDB, Tauri menggunakan sistem fail dan CLI menggunakan memori. Alat hanya melihat `host.state.save(slot, data)` dan `host.state.load(slot)`, tidak pernah `localStorage`. Pengguna boleh menyimpan beberapa sesi bernama bagi setiap alat tanpa akaun. Oleh sebab jambatan ialah satu-satunya titik sambungan, keadaan itu juga boleh dipindahkan. `shells/web/src/data-transfer.ts` mengeksport keadaan sebagai satu fail `lolly-backup` yang boleh diimport pada mana-mana pemasangan lain ([Pemindahan data](/info/data-transfer.html)). [Sync](/info/sync.html) menghantar pakej yang sama ke storan pilihan pengguna.

### 7. Tag kematangan menyatakan taraf sesuatu alat

Setiap alat mengisytiharkan `status: official | community | experimental`. Galeri mengisih mengikut status. Alat eksperimen meletakkan tera air pada eksportnya secara lalai: runtime menghidupkan tera air melainkan pemanggil menghantar `watermark: false`. Alat pada peranti dikecualikan. Proses katalog pasukan sendiri melengkapi tag ini.

### 8. Jenis input ditetapkan dalam manifes

Sesuatu input mengisytiharkan `type`: `text`, `longtext`, `number`, `boolean`, `color`, `select`, `asset`, `date`, `time`, `datetime-local`, `url`, `blocks`, `vector`, `table` atau `file`. Hos merender kawalan bagi setiap jenis, jadi alat tidak menulis kod kawalan. Mana-mana input boleh membawa `bindToProfile`. Tiga jenis paling penting:

- **`asset`**, dengan `filter` dan `allowUpload`, ialah jambatan ke sistem aset. `allowUpload: false` mengehadkan slot kepada aset pustaka. Muat naik pengguna berkongsi bentuk `AssetRef` pustaka.
- **`blocks`** ialah kumpulan medan berulang yang disunting dalam panel sisi, digunakan oleh Meeting Planner, Wayfinding, Diagrams dan lain-lain. Mengklik blok yang dirender memfokuskan barisnya.
- **`file`** menyimpan fail pengguna sendiri dalam memori untuk utiliti pada peranti seperti Lolly Strip Hidden Data dan Compress, dan **`vector`** mengumpulkan set nombor tetap ke dalam satu kawalan.

### 9. Templat tidak mengandungi logik

Templat menggunakan Handlebars, jadi mereka yang bukan pembangun boleh menulisnya. `{{x}}` mengeskap aksara, dan `{{{x}}}` ialah pilihan yang diaktifkan secara jelas. Logik berada dalam `hooks.js`, tempat ia boleh disemak. Banyak templat menggunakan `{{{` untuk penanda yang dikira oleh hook, jadi setiap hook mesti mengeskap apa yang diserahkannya. Pembantunya ialah `default`, `upper`, `lower`, `eq`, `markdown`, `asset`, `framing` dan `media`, serta `icsStamp`, `rfcText`, `csvCell` dan `arrow` untuk templat seiring `.ics`, `.vcf` dan `.csv`. [Templat dan perenderan](/info/tool-rendering.html) meliputinya.

### 10. Alat menggubah alat

Sesuatu alat boleh membenamkan render alat lain tanpa import antara alat. Enjin menyelesaikan gubahan itu. Manifes boleh mengisytiharkan `composes: [{ id, tool, inputs }]` dan meletakkan anak dengan `{{asset <id>}}`. URL benaman mudah alih (`https://lolly.tools/tool/<id>.svg?…`) merender anak secara setempat; Lolly Design meletakkan kod QR atau carta langsung dengan cara ini. Anak SVG kekal sebagai vektor dalam induk SVG atau PDF. Anak ialah hasil perantaraan dan tidak pernah diberi tera air atau cap. Shell yang tidak dapat merender anak membiarkan slot kosong, dan induk masih dirender. [Gubahan dan tindanan jenama](/info/tool-composition.html) mempunyai butirannya.

<!--i:eti-scissors-->
## Apa yang kami pilih untuk tidak lakukan

- **Tiada JavaScript sewenang-wenangnya dalam templat.** Logik berada dalam `hooks.js`.
- **Tiada pelayan aset wajib.** Pengguna menambah fail sendiri ke Assets dalam apl dan menyerahkan kerja sebagai sesi: pautan kongsi untuk input dan tetapan, fail `.lolly` apabila muat naik turut dibawa. Sesi yang dikongsi boleh menjadi templat dalam pemilih alat. Organisasi yang mahukan katalog yang ditadbir boleh menggunakan katalog, kelulusan dan dasar Lolly Work, atau mengurus pek jenama dalam git dan menyemak perubahan di situ.
- **Tiada kawalan akses yang dipaksa.** Apl terbuka ini bersifat awam secara lalai. Tag kematangan dan tera air menangani risiko jenama. Log masuk organisasi, peranan dan dasar datang daripada Lolly Work apabila pasukan mahukannya.
- **Tiada pangkalan data pusat.** Keadaan pengguna disimpan pada setiap peranti, dan Sync pilihan menyalinnya ke storan yang dipilih pengguna, tidak pernah ke pangkalan data Lolly.
- **Tiada laluan kod bersama antara alat dengan enjin.** Enjin dan alat komuniti ialah sumber terbuka. Pek jenama seperti `brands/suse/` peribadi membawa alat dan katalognya sendiri di bawah syaratnya sendiri. Tiada alat mengimport daripada `engine/`, jadi pemisahan kekal jelas.

<!--i:eti-refresh-->
## Kitar hayat satu render

Seseorang membuka `https://lolly.tools/t/qr-code?url=https://example.com&ecl=H`:

1. **But.** Apl web membuka IndexedDB, membina jambatan keupayaan dan menyegerakkan katalog alat dan aset, atau memuatkannya daripada cache ketika luar talian.
2. **Penghalaan.** Laluan memilih paparan alat untuk `qr-code`, dengan pertanyaan sebagai nilai awalnya.
3. **Muatkan.** `loadTool` mengambil `tool.json`, mengesahkannya berdasarkan skema dan mengambil templat, gaya dan hook.
4. **Huraikan pautan.** `parseUrlState` menukar parameter kepada nilai input. Rujukan aset seperti `?logo=lolly/logo/primary` menjadi `{ id }` yang belum diselesaikan.
5. **Mulakan runtime.** `createRuntime(tool, host, initialValues)` membina model input daripada data profil, nilai lalai dan pautan, menyelesaikan rujukan aset, memuatkan hook dan memanggil `onInit`.
6. **Render.** Shell melanggan runtime, melukis kawalan daripada model dan menulis templat yang telah diisi ke dalam `#tool-canvas`.
7. **Berinteraksi.** Menaip memanggil `runtime.setInput`, yang mengenakan kekangan, memanggil `onInput`, mengisi templat sekali lagi dan melukis semula.
8. **Eksport.** **Download** memanggil `runtime.export(node, format)`, dan `host.export` shell menghasilkan fail: raster, vektor daripada penelusur DOM, PDF, dokumen atau salah satu format lain dalam `schemas/tool.schema.json`. Unit fizikal ditukar mengikut format. Metadata dan Content Credentials dibenamkan apabila format dapat memuatkannya. Alat eksperimen mendapat tera air daripada hos, bukan alat. [Templat dan perenderan](/info/tool-rendering.html) dan [Eksport fail](/info/exporting.html) meliputi langkah eksport.

![Panel eksport yang dibuka oleh ?options: pasangan nama fail dan format, saiz output dan kawalan yang menulis fail](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=aud-export-popup)

Kitar hayat yang sama berjalan dalam Tauri, dan dalam CLI dengan DOM tanpa paparan, tempat output dihantar ke fail atau stdout.

<!--i:eti-stamp-->
## Lesen

Kod, termasuk `engine/`, `shells/`, `services/`, `schemas/` dan penjana dokumentasi, dilesenkan di bawah MPL-2.0, dalam satu repositori awam, [`lolly-tools/lolly`](https://github.com/lolly-tools/lolly). Prosa dokumentasi dilesenkan di bawah CC BY-SA 4.0. Pek jenama membawa syaratnya sendiri dalam `NOTICE.md` setiap pek: alat komuniti dilesenkan di bawah MPL-2.0, dan pek SUSE peribadi ialah hak milik SUSE. [Perihal](/info/about.html) mempunyai nota pelesenan penuh.
