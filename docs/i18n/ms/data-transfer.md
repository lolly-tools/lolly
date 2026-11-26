# Pemindahan data: himpunan `lolly-backup`

Himpunan sandaran memindahkan pustaka peribadi yang disimpan oleh Lolly pada peranti: eksport pada satu pemasangan, bawa fail (USB, AirDrop, e-mel kepada diri sendiri atau perkongsian rangkaian) dan import pada pemasangan lain. Eksport dan import tidak memerlukan pelayan, dan sasaran boleh berada di luar talian.

Ini ialah spesifikasi format untuk orang yang membina shell, alat atau skrip bagi sandaran. Untuk memindahkan kerja anda sendiri, baca [Pindahkan kerja anda ke peranti lain](/info/find-your-work.html#move-your-work-to-another-device).

![Dua butang yang memindahkan seluruh pemasangan: Export my data menulis satu zip, Import data membacanya semula](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-move%3Ediv%3Anth-of-type%282%29%2C.store-move%3Ep%3Alast-of-type%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dmove%5D%3Esummary&walker=1&format=svg&cropSelector=%5Bdata-store-group%3Dmove%5D&dark=1&filename=pd-transfer-controls)

::: note Skop
Himpunan membawa *data pengguna*, bukan alat katalog. Alat katalog dan aset katalog disegerakkan secara berasingan dan dianggap ada pada sasaran, dalam keadaan paling buruk pada versi lebih tinggi. Alat yang dibuat oleh pengguna dibawa di dalam `profile.json`. Import tidak pernah memasang atau menaik taraf alat katalog.
:::

<!--i:eti-badge-check-->
## Matlamat

- <!--i:box--> **Satu format, setiap shell.** Apl web, apl desktop dan mudah alih serta shell masa hadapan berkongsi skema sampul dan bahagian yang sama. Bahagian pilihan bergantung pada keupayaan setiap shell, dan bahagian yang tidak disokong dilaporkan. Setiap jambatan keupayaan membekalkan penyesuai storannya.
- <!--i:shieldcheck--> **Tahan sepanjang pemindahan.** Himpunan yang rosak atau terpotong semasa pemindahan gagal diimport dengan ralat dan tidak pernah dipulihkan separuh sahaja.
- <!--i:clock--> **Bertahan melampaui versi ini.** Apl lebih lama mengimport bahagian himpunan lebih baharu yang dikenalinya. Format yang memutuskan keserasian ditolak dengan teratur.
- <!--i:check--> **Selamat digabungkan.** Import ke pemasangan yang sudah digunakan tidak pernah memadamkan apa-apa yang tiada dalam himpunan.

<!--i:eti-package-->
## Sampul

Himpunan ialah `.zip` biasa. Ia kekal utuh melalui apa-apa cara pemindahan, dan sebarang alat nyahzip boleh memeriksa kandungannya.

Muat turun dinamakan mengikut pemiliknya: `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip`, contohnya `LollyTools-Ada-Lovelace-2026-06-26-1.zip`. Nama pertama dan nama akhir datang daripada profil dan dikecualikan apabila tidak ditetapkan: tanpa profil menghasilkan `LollyTools-2026-06-26-1.zip`, dan nama pertama sahaja menghasilkan `LollyTools-Ada-2026-06-26-1.zip`. Setiap nama menjadi token yang selamat untuk nama fail (huruf dan digit Unicode dikekalkan, ruang dan tanda baca dibuang, maksimum 32 aksara). `<n>` ialah urutan bagi setiap hari dan setiap peranti, jadi eksport berulang pada satu hari tidak bertembung dan kekal tersusun. `backupFilename()` dalam `data-transfer.ts` membina nama. Nama tidak mengubah kandungan zip.

| Laluan | Diperlukan | Kandungan |
|---|---|---|
| `manifest.json` | ya | Id format, versi, kiraan dan integriti setiap bahagian. Pembaca membaca fail ini dahulu. |
| `profile.json` | apabila ditetapkan | Rekod `me` pengguna: nama, maklumat hubungan, rujukan foto wajah dan bendera, serta folder, Trash, pelan tindakan projek, templat pengguna dan alat buatan pengguna, kegemaran, alat tersembunyi, bahasa dan pilihan emoji. Dibaca melalui `host.profile`. |
| `sessions.json` | ya | Setiap sesi tersimpan: slot, id dan versi alat, label, lakaran kenit (URL data) dan data input penuh. Dibaca melalui `host.state`. |
| `assets.json` | ya | Metadata bagi setiap aset yang dimuat naik (imej, fon, token jenama, logo, salinan muat turun tersimpan), setiap satu menunjuk kepada baitnya di bawah `assets/blobs/`. |
| `assets/blobs/<n>.<ext>` | bagi setiap aset | Bait aset mentah, disimpan tanpa pemampatan kerana kebanyakannya sudah dalam format termampat. Sambungan hanya untuk rupa; jenis MIME dalam `assets.json` ialah rujukan muktamad. |
| `assets/blobs/<n>.c2pa` | apabila ada | Content Credentials yang diekstrak sebagai bait binari tepat, dirujuk oleh `_credentialFile` dalam rekod aset. Ini bukan kunci penandatanganan peranti. |
| `design-systems.json` | apabila ada | Sistem reka bentuk yang dibuat atau ditambah pada pemasangan ini, sebagai `{ active, records }`. Lihat [Peraturan import](#import-rules). |
| `file-history.json` | pilihan | Petikan keadaan aset berversi, laporan operasi fail yang selesai dan manifes kelompok lengkap, dengan versinya sendiri. Disediakan oleh penyesuai sandaran dalaman `fileHistory` shell. |
| `revision-history.json` | pilihan, sandaran manual | ID ciptaan yang stabil, titik semak yang disimpan, lakaran kenit dan draf pemulihan bergilir. Disediakan oleh `host.state.history.backup` apabila disokong. |
| `file-history/versions/` | bagi setiap petikan keadaan | Bait aset terdahulu dan kelayakan yang diekstrak, sama ada aset semasa masih wujud atau tidak. |
| `file-history/results/` | bagi setiap operasi yang selesai | Bait output tepat. Tiada fail asal yang dipilih untuk penukaran disimpan atau disertakan. |
| `prefs.json` | ya | Keutamaan setempat milik pengguna: `theme`, `sidebarWidth` dan kiraan aktiviti `ct-metrics`. |
| `lolly.txt` | ya | Ringkasan himpunan yang boleh dibaca (kiraan, profil, nama fail) untuk sesiapa yang membuka zip tanpa Lolly. Dijana semula pada setiap eksport dan dikenal pasti semasa import, jadi ia tidak pernah dikira sebagai bahagian yang dilangkau. Ia ditulis selepas peta integriti, jadi peta tidak meliputi fail ini. |

::: details Cara eksport menulis zip
Eksport menulis zip satu bahagian pada satu masa (`shells/web/src/lib/zip-stream.ts`). Muat naik, hasil tersimpan dan versi aset tersimpan dibaca dalam potongan 4 MiB, tidak pernah secara keseluruhan. Hasil dan versi tersimpan disemak dahulu terhadap SHA-256 yang direkodkan. Setiap fail kemudian dibaca untuk hasil tambah semak dan ringkasan cincangan integritinya, dan zip merujuk fail di tempatnya.

Tiada apa-apa dikodkan semula. Setiap bahagian mengekalkan bait dan ringkasan cincangan tepatnya, jadi fail yang membawa Content Credentials mengekalkan bait yang diliputi oleh tandatangannya. Untuk bahagian dan masa yang sama, zip adalah serupa dengan hasil penulis dalam memori terdahulu, kecuali fail sejarah melebihi 16 MiB dimampatkan dalam cebisan. `tests/backup-streaming.test.ts` menyemak ini terhadap ringkasan cincangan rujukan yang direkodkan.

Pada pustaka sintetik 192 MiB, diukur dalam Node, penyelesaian sandaran memerlukan kira-kira 125 hingga 150 MiB selain pustaka itu, berbanding kira-kira 850 MiB bagi penulis dalam memori (`node scripts/bench-backup-finalise.ts`). Import masih membaca seluruh zip ke dalam memori.
:::

<!--i:eti-file-->
## `manifest.json`

```json
{
  "format": "lolly-backup",
  "formatVersion": 3,
  "minReader": 1,
  "app": "lolly",
  "exportedAt": "2026-06-22T09:30:00.000Z",
  "counts": { "profile": true, "sessions": 2, "userAssets": 4, "prefs": 3, "assetVersions": 1, "fileOperations": 1 },
  "integrity": {
    "profile.json": "sha256-…",
    "sessions.json": "sha256-…",
    "assets.json": "sha256-…",
    "assets/blobs/0.bin": "sha256-…",
    "file-history.json": "sha256-…",
    "file-history/versions/0.bin": "sha256-…",
    "file-history/results/0.bin": "sha256-…",
    "prefs.json": "sha256-…"
  }
}
```

| Medan | Maksud |
|---|---|
| `format` | Sentiasa `lolly-backup`. Fail tanpanya ditolak sebagai "bukan sandaran Lolly". |
| `formatVersion` | Reka letak yang digunakan untuk **menulis** himpunan ini. Dinaikkan pada sebarang perubahan pada set atau bentuk bahagian. Pembaca **tidak** menggunakan medan ini sebagai syarat penerimaan. |
| `minReader` | Versi pembaca minimum yang boleh mengimport himpunan ini **dengan selamat**. Inilah medan yang digunakan oleh pembaca sebagai syarat penerimaan. |
| `app` | Id apl yang menghasilkan himpunan, untuk diagnostik. |
| `exportedAt` | Cap masa ISO ketika himpunan dicipta. |
| `counts` | Apa yang dimasukkan oleh penulis, untuk paparan dan semakan kewajaran. |
| `integrity` | Pilihan. Memetakan setiap bahagian kecuali `manifest.json` kepada ringkasan cincangan `sha256-<base64>` gaya SRI bagi baitnya yang **tidak dimampatkan**. |

<!--i:eti-tag-->
## Dasar versi

Dua nombor versi membolehkan format berkembang tanpa meninggalkan pemasangan lama.

![Perubahan pada format himpunan sama ada bersifat tambahan, yang boleh diabaikan oleh pembaca lama, atau memutuskan keserasian, apabila import yang salah menyebabkan kerosakan. Perubahan tambahan menaikkan formatVersion dan mengekalkan minReader; perubahan yang memutuskan keserasian menaikkan formatVersion dan minReader. Pembaca mengimport apabila minReader tidak melebihi versinya sendiri.](/info/diagrams/concepts/backup-version-gate.svg)

- Pembaca mengimport himpunan apabila `manifest.minReader` tidak melebihi versi pembacanya sendiri. Ia menolak, dengan "memerlukan versi apl yang lebih baharu", hanya apabila himpunan memerlukan pembaca lebih baharu.
- Perubahan **tambahan**, seperti bahagian pilihan baharu atau medan manifes pilihan baharu, menaikkan `formatVersion` dan membiarkan `minReader` seperti sedia ada. Apl lama masih mengimport setiap bahagian yang dikenalinya, dan bahagian yang tidak dikenali dilaporkan sebagai dilangkau, bukan digugurkan tanpa pemberitahuan.
- Perubahan yang **memutuskan keserasian**, apabila import bahagian yang salah merosakkan data atau bahagian pilihan menjadi wajib, menaikkan `minReader`. Apl lama kemudian menolak dengan teratur dan bukannya mengimport sesuatu yang tidak boleh dikendalikannya. Apl lama kemudian menolak himpunan dengan teratur.
- Jika himpunan masa hadapan menetapkan `formatVersion` tetapi mengecualikan `minReader`, pembaca kembali menggunakan `formatVersion` sebagai syarat penerimaan dan menganggap perubahan itu memutuskan keserasian.

::: note Panduan umum untuk pengarang
Jika setiap pembaca sedia ada masih berfungsi dengan betul apabila mengabaikan tambahan anda, perubahan itu bersifat tambahan: naikkan `formatVersion` dan biarkan `minReader`. Jika tidak, naikkan `minReader`.
:::

<!--i:eti-shield-check-->
## Integriti

Apabila `manifest.integrity` ada, pembaca menyemak SHA-256 setiap bahagian yang disenaraikan **sebelum menulis apa-apa**. Ketidakpadanan ("gagal semakan integriti") atau bahagian yang tiada ("tidak lengkap") menghentikan import, jadi tiada pemulihan separa. Ini mengesan kerosakan semasa pemindahan: AirDrop yang terpotong, get laluan e-mel yang mengekod semula lampiran, sektor USB yang rosak.

Integriti dilaksanakan setakat yang termampu. Ia ditulis hanya apabila Web Crypto tersedia (setiap konteks pelayar selamat dan Node moden), dan disemak hanya apabila kedua-dua peta dan Web Crypto ada. Himpunan tanpa peta, seperti himpunan dari sebelum integriti wujud, diimport tanpa perubahan: "tidak dapat disahkan" tidak pernah dikira sebagai "rosak".

Manifes tidak menyenaraikan dirinya sendiri mahupun `lolly.txt` yang dijana semula.

<!--i:eti-download-->
## Peraturan import

Import berjalan dalam salah satu daripada dua mod.

- **Merge** ialah tindakan **Import data…** dan penyertaan pertama penyegerakan, **Bring it to this device**. Data pada sasaran kekal, dan tiada apa-apa di luar himpunan disentuh.
- **Replace** digunakan oleh penyegerakan peranti untuk memastikan peranti kekal sepadan. Ia mengambil rekod profil, keutamaan, sesi, imej dan pilihan sistem reka bentuk aktif daripada salinan yang disegerakkan. Ia hanya membuang item yang dipadamkan oleh peranti lain sejak penyegerakan terakhir. Pemulihan salinan terdahulu menyimpan peranti dahulu, kemudian menjadikan peranti sepadan dengan salinan itu dan membuang semua yang tidak disimpan dalam salinan. [Segerakkan peranti anda](/info/sync.html) meliputi apa yang dilihat seseorang.

Penggabungan mengendalikan setiap jenis data seperti ini:

| Data | Sudah ada pada sasaran | Hanya dalam himpunan |
|---|---|---|
| Sesi (mengikut slot) dan imej yang dimuat naik (mengikut id) | Salinan yang disimpan lebih baru dikekalkan, jadi sandaran lama tidak pernah menulis ganti kerja lebih baharu. Masa yang sama atau tidak diketahui mengekalkan salinan sasaran. | Ditambah |
| Folder | Nama dan induk sasaran dikekalkan, dan folder mendapat ahli himpunan yang belum dimilikinya. Sesi yang difailkan dalam folder pada sasaran kekal difailkan di situ. | Ditambah |
| Kegemaran (alat, aset katalog dan item Projects) | Digabungkan | Ditambah |
| Templat, templat Projects dan alat pengguna (mengikut id) | Rekod sasaran dikekalkan. | Ditambah |
| Entri Trash | Entri sasaran dikekalkan. | Ditambah, jadi item yang boleh dipulihkan pada mana-mana pemasangan masih boleh dipulihkan. Entri yang foldernya kembali digunakan pada sasaran, atau yang slot Trashnya sudah digunakan oleh sasaran, dikecualikan. |
| Medan profil lain (nama, butiran hubungan, bahasa, bendera ciri, alat tersembunyi dan tetapan lain) | Nilai sasaran dikekalkan. | Diambil apabila medan sasaran kosong |
| Keutamaan (`prefs.json`) | Nilai sasaran dikekalkan. | Ditulis apabila sasaran tiada nilainya |
| Sistem reka bentuk (mengikut id) | Rekod himpunan menggantikan rekod sasaran. | Ditambah. Pilihan aktif himpunan hanya terpakai apabila sasaran tiada sistem reka bentuknya sendiri. |
| Sejarah ciptaan | Salinan yang disimpan lebih baru kekal sebagai salinan semasa, dan yang lain disimpan sebagai draf terlindung. | Ditambah |

**Sesi tersimpan dipautkan semula kepada imejnya secara automatik.** Rujukan aset dikekalkan mengikut id. Jambatan menyelesaikan semula rujukan selepas imej dipulihkan, kerana URL `blob:` tidak bertahan selepas muat semula.

**Rekod sejarah tidak pernah berubah selepas ditulis.** Import berulang versi aset dan ID operasi tidak menambah apa-apa, dan ID yang sudah menamakan bait atau sejarah berbeza ditolak, bukan ditulis ganti. Import semula aset semasa yang serupa mengekalkan versinya, dan aset semasa yang berubah mesti membawa versi berbeza.

**Sejarah ciptaan mempunyai beberapa peraturan lagi.** Ciptaan yang slotnya digunakan oleh sasaran untuk ciptaan berbeza ditambah sebagai ciptaan berasingan, dan ciptaan dalam Trash sasaran kekal di situ. Id titik semak yang menamakan kandungan berbeza pada sasaran mengekalkan kandungan sasaran. Arkib yang gagal semakannya sendiri menghentikan import sebelum sebarang perubahan profil, sesi, aset atau keutamaan, dan import berulang yang serupa tidak menambah penggunaan storan.

**Ringkasan melaporkan apa yang berlaku.** Setiap import mengembalikan `profile`, `sessions`, `userAssets`, `prefs`, `skipped` dan `failedAssets`.

- `failedAssets` mengira aset dimuat naik yang tidak dapat dipulihkan, contohnya kerana storan peranti penuh.
- `skipped` mengira bahagian daripada penulis lebih baharu yang tidak dikenali oleh binaan ini. Apl menunjukkan kiraan ("… · N item lebih baharu dilangkau").
- Dengan sejarah fail, ringkasan menambah `assetVersions`, `fileOperations`, `fileBatches` dan `failedHistory`. Kehabisan storan atau konflik ID yang tidak boleh diubah boleh menyebabkan pemulihan separa, dan apl kemudian memberitahu orang itu supaya menyimpan sandaran sumber.
- Dengan sejarah ciptaan, ia menambah `revisions` dan `recoveryDrafts`, hanya mengira apa yang ditambah oleh import ini, serta `added`, `kept`, `replaced`, `copies` dan `hidden` untuk cara setiap ciptaan digabungkan. `skippedCheckpoints` mengira titik semak yang idnya menamakan kandungan berbeza pada sasaran, dan `historyLeftOut` mengira titik semak serta draf lama yang tidak muat dalam ruang sejarah peranti.
- Import penggantian menambah `removed` dan `failedRemovals`.

Pemulihan bukan satu transaksi merentas stor profil, sesi, aset dan sejarah. Penyegerakan awan **tidak** memajukan semakan yang telah diterapkannya selepas pemulihan separa atau yang tidak disokong, jadi salinan itu kekal tersedia untuk dicuba semula.

<!--i:eti-unlink-->
## Apa yang tidak dipindahkan

- **Cache katalog** (metadata dan blob aset yang dimuat turun, indeks alat), yang disegerakkan semula oleh sasaran.
- **Alat katalog dan aset katalog**, yang dianggap sudah ada pada sasaran. Token jenama, fon dan logo yang ditambah pengguna ialah aset pengguna dan turut dipindahkan.
- **URL `blob:` dan objek**, yang dijana semula oleh jambatan semasa dimuatkan.
- **Fail asal penukaran, pajakan pelaksanaan aktif dan rahsia akses atau tandatangan setempat mesin.** Ini bukan sejarah mudah alih. Hasil tersimpan ialah salinan. Ia tidak bermakna sumber asal telah disandarkan.
- **Pembilang urutan eksport**, pembilang penamaan muat turun harian dalam `localStorage` (`lolly-export-seq`). Ia tidak dimasukkan ke dalam `PREF_KEYS`, jadi ia tidak pernah dipindahkan dalam berkas.

Meter storan menunjukkan pembahagian yang sama. Saved sessions, My images dan File results & versions dimasukkan ke dalam berkas. Cache aset, pratonton alat dan pin luar talian boleh dibina semula dan tidak dipindahkan.

![Meter storan membahagikan data peranti ini kepada kategori bernama, dengan Saved sessions dan My images dijejak secara berasingan daripada Asset cache, di sini pada pemasangan baharu yang setiap kategorinya masih kosong](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&dark=1&filename=ce-storage-categories)

<!--i:eti-building-->
## Data organisasi dengan Lolly Work

Berkas ini menyandarkan pustaka peribadi peranti. Berkas bukan sandaran instans **Lolly Work**. Akaun organisasi, dasar akses, projek kongsi, versi katalog, kelulusan, tugas render dan rekod audit disimpan oleh perkhidmatan itu. Sambung semula dan daftar masuk untuk mendapatkan semula akses kepada kerja kongsi. Mengimport berkas peribadi tidak memberikan akses itu.

Pengendali menyandarkan, menyimpan dan memadamkan data pelayan mengikut panduan Lolly Work sendiri: [Sandaran dan pemulihan](/info/work-operations.html#backup-and-restore) dan [Storan dan kitar hayat data Lolly Work](/info/work-data-lifecycle.html). Mengosongkan atau mengeksport peranti tidak menjalankan mana-mana operasi pelayan itu.

<!--i:eti-monitor-->
## Merentas cangkerang

`data-transfer.ts` membaca dan menulis hanya melalui jambatan keupayaan (`host.profile`, `host.state`, `host.assets`) dan keutamaan `localStorage` yang dikongsi. Modul yang sama membaca dan menulis sampul sepunya di web serta dalam apl desktop dan mudah alih, melalui IndexedDB atau storan sistem fail. Bahagian sejarah pilihan hanya muncul apabila penyesuainya tersedia. Import melaporkan bahagian yang tidak disokong sebagai dilangkau. Suit tanpa antara muka menguji bahagian sepunya dengan jambatan dalam memori, dan transaksi sejarah juga mempunyai ujian dalam pelayar sebenar.

Dua cangkerang berada di luar jaminan itu:

- **CLI sekali jalan** tiada apa-apa untuk dibawa: keadaannya berada dalam memori dan bertahan untuk satu panggilan.
- **TUI** menyimpan keadaan dalam `~/.lolly` (sesi, folder, profil). Paparan Profile menulis arkib sandarannya sendiri yang lebih ringkas: `saved-state/<slot>.json` bagi setiap sesi serta `profile.json` dan `folders.json`, tanpa manifes, tanpa `formatVersion` atau `minReader` dan tanpa peta integriti. Pembaca format ini menolak arkib itu sebagai "bukan sandaran Lolly", walaupun namanya serupa (`lolly-backup-<stamp>.zip`). Penyatuan kedua-duanya ialah jurang yang diketahui.

<!--i:eti-clock-->
## Belum mudah alih

Jenis data mudah alih baharu boleh ditambah kemudian sebagai bahagian tambahan (`formatVersion` baharu, `minReader` yang sama). Sistem reka bentuk sudah dipindahkan dengan cara ini, sebagai `design-systems.json` bersama aset penggunanya.

Dua nama dikhaskan untuk data yang belum dipindahkan:

- **`tokens.json`** akan membawa dokumen token reka bentuk [W3C DTCG](https://tr.designtokens.org/format/) dengan kumpulan, set dan temanya, iaitu format yang [diimport dan dieksport oleh Penpot](https://help.penpot.app/user-guide/design-systems/design-tokens/). Token jenama milik pengguna sudah dipindahkan sebagai aset `user/tokens/brand` dalam `assets.json`, dan token sistem reka bentuk dipindahkan bersama rekodnya.
- **`penpot/`** dikhaskan untuk fail Penpot yang diserap masuk, atau subsetnya yang berkaitan dengan Lolly, yang dipaparkan sebagai alat.

<!--i:eti-history-->
## Bahagian sejarah

Kedua-dua bahagian sejarah adalah pilihan dan mempunyai versi sendiri.

::: details Sejarah penciptaan (v3)
Sandaran manual daripada pemasangan web dengan sejarah penciptaan merangkumi `revision-history.json`, dengan skema `{ version: 1, documents, revisions, recoveries }` sendiri. Ia membawa ID yang disimpan, petikan input kanonik, cap versi, pratonton raster dan draf penulis yang berasingan. Penyesuai sejarah menangkap sesi semasa dan semakan terkininya dalam satu transaksi baca, dan `sessions.json` menggunakan petikan semasa yang sama untuk pembaca lama.

Pemulihan menyemak SHA-256 muatan dan bilangan bait, identiti unik, hubungan dokumen dan semakan terkini, susur galur, cap masa, jenis pratonton dan had sebelum mengkomit arkib dalam satu transaksi. Rujukan induk yang dipadatkan mungkin tiada. Kerja semasa sedia ada tidak pernah diganti secara senyap: apabila sesuatu ciptaan berada di kedua-dua belah, pihak yang tidak dikekalkan sebagai semasa menjadi draf terlindung.

Arkib mempunyai had pemindahan 384 MiB. Had storan dikuatkuasakan tanpa memendekkan titik semak yang disimpan. Eksport menulis `revision-history.json` dan `sessions.json` dalam cebisan, dengan bait yang sama seperti yang dihasilkan oleh satu `JSON.stringify`, jadi teks fail tidak pernah dipegang seluruhnya. Fail sejarah yang akan melepasi had digugurkan sebaik sahaja ia berbuat demikian dan hanya dikira mulai saat itu. Arkib kemudian dibuat semula tanpa titik semak automatiknya yang paling lama, dan ringkasan eksport mengiranya sebagai `checkpointsLeftOut`, atau arkib ditolak.

Cangkerang tanpa keupayaan ini memulihkan sesi biasa dan melaporkan bahagian sejarah sebagai dilangkau. Sejarah sistem fail asli kekal tidak disokong sehingga penyesuainya menyediakan transaksi sejarah yang berkekalan. Tetamu dalam kolaborasi peribadi tidak mempunyai sejarah berkekalan atau arkib pemulihan.

Penyegerakan petikan peribadi tidak menyertakan sejarah penciptaan. Menerapkan petikan pada dokumen setempat yang mempunyai sejarah menyimpan keadaan kerja sebelumnya sebagai draf pemulihan berasingan dan membatalkan token tulis mana-mana penyunting yang terbuka. Titik semaknya yang tidak boleh diubah kekal pada peranti. Ini melindungi sejarah setempat semasa penggantian petikan. Ia tidak menggabungkan sejarah peranti yang serentak.

Rujukan aset dalam sejarah dikekalkan, sementara proses render masih menyelesaikan aset melalui pustaka sedia ada destinasi. Arkib ini belum menjamin bait aset lama yang tepat atau render alat lama. Bait versi aset dan hasil fail dipindahkan dalam bahagian sandarannya sendiri.
:::

::: details Versi tersimpan dan hasil fail (v2)
Bahagian sejarah pilihan menyimpan `{ version: 2, assetVersions: [...], operations: [...], batches: [...] }`, dan pembaca juga menerima bentuk history-v1 terdahulu tanpa kelompok. Setiap petikan memberikan ID aset stabil dan versi tepat, masa simpanannya, panjang bait dan SHA-256 heksadesimal, serta rekod aset yang `_file` dan `_credentialFile` pilihannya merujuk bahagian binari. Operasi membawa fakta fail asal, permintaan, laporan, cap masa dan `_file` hasil pilihan. Nama backend storan, pemegang OPFS dan pajakan pelaksanaan tidak dipindahkan. Pembaca yang hanya mengenali history v1 menolak versi sejarah baharu sebelum mengimport, jadi keahlian kelompok tidak pernah digugurkan secara senyap.

Manifes kelompok merekodkan setiap sumber yang dipilih sebelum pemprosesan, termasuk fail yang tidak pernah dibaca, ahli yang dibatalkan, kegagalan menempah ruang hasil dan kerja yang terganggu. Setiap ahli mempunyai ID operasi stabil, rujukan dan fakta sumber, nama output yang diminta dan laporan akhir. Sumber yang belum dibaca mempunyai fakta yang diisytiharkan, bukan cernaan yang direka-reka. Import mengesahkan identiti ahli dan keselarasan dengan mana-mana laporan operasi yang dibawa. Laporan Lolly Batch kekal tersedia apabila hasil individu telah dibuang, tetapi resit tidak bermakna bait outputnya masih disimpan.

- **Pengesahan dahulu.** Setiap rekod sejarah, laporan dan fail rujukan yang diketahui disahkan sebelum sebarang penulisan import profil atau aset. Bait yang tiada dan SHA-256 yang tidak sepadan menyebabkan kegagalan walaupun sampul tiada peta integriti. Bukti kelayakan yang diekstrak kekal sebagai tatasusunan bait, termasuk import daripada penulis lama yang menyerikannya sebagai objek berkunci angka.
- **Kerja yang sedang berjalan.** Operasi yang sedang berjalan menjadi rekod terganggu dalam sandaran, dengan laporan kegagalan dan tanpa hasil. Pemulihan tidak pernah memulakan semula kerja latar belakang atau mengimport pajakan aktif. Mencuba semula bermakna memilih fail asal sekali lagi, yang disemak dengan SHA-256 yang direkodkan apabila tersedia.
- **Storan.** Hasil yang dipulihkan mengkomit bait dan metadatanya bersama-sama dalam IndexedDB. Hasil baharu biasa menggunakan OPFS apabila tersedia, dengan IndexedDB sebagai sandaran. Operasi aktif sedia ada tidak pernah diganti oleh import.
- **Had sandaran.** Eksport menstrim bait ini ke dalam arkib, tetapi pemulihan masih menyahzip seluruh sandaran dalam memori, jadi hadnya kekal: **256 MiB muatan sejarah**, **4 MiB metadata sejarah**, paling banyak **100 operasi**, **100 kelompok** dan **2,000 petikan**. Eksport menolak sejarah yang terlalu besar atau tidak lengkap secara jelas dan tidak pernah meninggalkannya secara senyap. Muat turun versi dan hasil penting satu demi satu sebelum membuang salinan setempat yang lebih lama. Had ini bukan jaminan penggunaan memori puncak yang diukur untuk telefon.
- **Bajet setempat.** Sejarah hasil setempat mempunyai bajet 512 MiB dan had 100 rekod. Petikan aset mempunyai bajet 512 MiB yang berasingan dan paling banyak 20 versi terdahulu bagi setiap aset, dan bait bukti kelayakan yang diekstrak dikira dalam bajet itu. Pemulihan mematuhi had ini dan tidak pernah menyingkirkan data pengguna sedia ada secara senyap.
- **Metadata kelompok.** Metadata kelompok setempat mempunyai bajet 4 MiB yang berasingan, paling banyak 100 manifes dan 20 ahli bagi setiap kelompok. Ahli yang belum selesai menempah kapasiti metadata, dengan had laporan 32 KiB bagi setiap ahli. Ini ialah bajet logik, bukan jaminan ruang cakera pelayar: kegagalan kuota sebenar ditunjukkan, dan laporan dalam memori kekal boleh dimuat turun. Mencuba semula ahli kelompok mencipta kelompok baharu tanpa menulis ganti laporan lama. Membuang rekod kelompok tidak membuang bait hasil individu atau aset pustaka.
- **Hasil dalam pustaka.** Hasil penukaran boleh ditambah ke pustaka tanpa penormalan atau pengekodan semula, dengan cincangan sumber dan output serta hubungan operasi dilampirkan. Penambahan berulang menggunakan semula salinan yang tidak berubah, dan salinan yang disunting tidak pernah ditulis ganti. Imej raster boleh memulakan dokumen Lolly Design baharu, yang menggunakan ID aset pustaka semasa. Penguatkuasaan pin versi tepat di seluruh masa jalan dan laluan URL Lolly Design ialah kerja berasingan. Hasil SVG, HTML, PDF dan ZIP disimpan sebagai aset fail legap, bukan dinaik taraf menjadi kandungan interaktif atau vektor yang dipercayai.
- **Tempat orang melihatnya.** **Convert → Recent file operations** menunjukkan penggunaan sejarah, laporan, muat turun dan pengurus versi, yang juga mencari versi terdahulu aset pustaka yang dipadamkan. Memulihkan petikan mencipta versi semasa baharu dan mengekalkan petikan yang dipilih. **Settings → Preferences → Storage** mengira hasil dan versi secara berasingan daripada cache yang boleh dibuang.
- **Pembersihan.** Pembersihan fail sementara yang dilakukan secara jelas hanya membuang bait milik operasi yang tidak dirujuk. Rekod semasa melindungi failnya, dan fail OPFS terbaharu mempunyai tempoh kelonggaran satu jam. Hasil tersimpan dan petikan aset tidak dikosongkan secara automatik.

Pembaca lama masih menerima sampul v2 (`minReader: 1`) dan memulihkan bahagian yang dikenalinya, sambil mengira bahagian sejarah yang tidak disokong sebagai dilangkau. Pemulihan sejarah penuh memerlukan cangkerang dengan penyesuai `fileHistory`, titik sambungan di dalam cangkerang, bukan keupayaan `HostV1` yang tersedia kepada alat. Pemulihan sebenar antara dua peranti diliputi oleh ujian penerimaan Chromium setempat. Pemulihan pada apl desktop, iOS dan Android yang dipasang masih perlu diterima secara berasingan.
:::

<!--i:eti-code-->
## Rujukan

- Modul: `shells/web/src/data-transfer.ts` (`exportBackup`, `importBackup`, `BACKUP_FORMAT`, `BACKUP_FORMAT_VERSION`, `BACKUP_READER_VERSION`; penama `backupFilename()` adalah dalaman).
- Ujian kontrak: `tests/data-transfer.test.ts`, meliputi perjalanan pergi balik, penggabungan, integriti, keserasian ke hadapan dan sekatan pembaca.
- Ujian kontrak sejarah: `tests/file-history-backup.test.ts`, `tests/file-batch-history.test.ts` dan `tests/file-result-library.test.ts`. Penerimaan pelayar: `tests/file-history.browser.test.ts`, `tests/file-batch-history.browser.test.ts` dan `tests/file-result-reuse.browser.test.ts`.
- Permukaan jambatan yang digunakan: `host.profile`, `host.state` dan `host.assets`; lihat [Host API](/info/host-api.html).
