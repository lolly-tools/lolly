# Pemindahan data: bundle `lolly-backup`

Lolly menyimpan pustaka peribadi anda pada peranti. Bundle sandaran ialah cara pustaka itu berpindah: eksport pada satu pemasangan, bawa fail dengan apa cara pun (USB, AirDrop, e-mel kepada diri sendiri atau kongsi rangkaian) dan import pada yang lain. Mengeksport dan mengimport tidak memerlukan pelayan, dan sasaran boleh luar talian.

Halaman ini ialah spesifikasi format, untuk orang yang membina shell, alat atau skrip di sekeliling sandaran: apa yang ada dalam zip, bagaimana versi dipagar, bagaimana import bergabung dan apa yang disemak. Panduan untuk orang yang memindahkan kerja mereka sendiri ialah [Move your work to another device](/info/find-your-work.html#move-your-work-to-another-device).

![Dua butang yang memindahkan seluruh pemasangan: Export my data menulis satu zip, Import data membacanya semula](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-move%3Ediv%3Anth-of-type%282%29%2C.store-move%3Ep%3Alast-of-type%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dmove%5D%3Esummary&walker=1&format=svg&cropSelector=%5Bdata-store-group%3Dmove%5D&dark=1&filename=pd-transfer-controls)

> **Skop.** Bundle membawa *data pengguna*, bukan alat katalog. Alat katalog dan aset katalog disegerakkan secara berasingan dan diandaikan sudah ada pada sasaran, paling teruk pada versi lebih tinggi. Alat yang dibuat pengguna sendiri dibawa dalam `profile.json`. Mengimport tidak pernah memasang atau menaik taraf alat katalog.

## Matlamat

- <!--i:box--> **Satu format, setiap shell.** Apl web, apl desktop dan mudah alih serta shell masa depan berkongsi sampul dan skema bahagian yang sama. Bahagian pilihan bergantung pada keupayaan setiap shell, dan bahagian yang tidak disokong dilaporkan. Setiap jambatan keupayaan membekalkan penyesuai storannya.
- <!--i:shieldcheck--> **Bertahan dalam perjalanan.** Bundle yang rosak atau terpotong dalam penghantaran gagal dengan jelas semasa import dan tidak pernah dipulihkan separuh.
- <!--i:clock--> **Melangkaui versi ini.** Apl lama masih boleh mengimport bahagian bundle lebih baharu yang dikenalinya. Format yang benar-benar memecahkan ditolak dengan bersih.
- <!--i:check--> **Selamat untuk digabung.** Mengimport ke pemasangan yang sudah digunakan tidak pernah memadam apa-apa yang tiada dalam bundle.

## Sampul

Bundle ialah `.zip` biasa, jadi ia bertahan utuh melalui sebarang pengangkutan dan mana-mana alat nyahzip boleh memeriksa kandungannya.

Muat turun dinamakan mengikut orang yang memilikinya: `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip`, contohnya `LollyTools-Ada-Lovelace-2026-06-26-1.zip`, supaya folder Downloads berisi sandaran kekal boleh dibaca. Nama pertama dan akhir datang daripada profil dan ditinggalkan apabila tidak ditetapkan: tiada profil memberi `LollyTools-2026-06-26-1.zip`, dan nama pertama sahaja memberi `LollyTools-Ada-2026-06-26-1.zip`. Setiap nama dikurangkan kepada token selamat nama fail (huruf dan digit Unicode dikekalkan, ruang dan tanda baca dilucutkan, paling banyak 32 aksara). `<n>` ialah jujukan bagi setiap hari, bagi setiap peranti, jadi eksport berulang pada satu hari tidak berlanggar dan kekal tertib. `backupFilename()` dalam `data-transfer.ts` membina nama, dan kandungan zip adalah sama apa pun namanya.

| Laluan | Diperlukan | Kandungan |
|---|---|---|
| `manifest.json` | ya | Id format, versi, kiraan dan integriti bagi setiap bahagian. Perkara pertama yang dilihat pembaca. |
| `profile.json` | apabila ditetapkan | Seluruh rekod `me` pengguna: nama, hubungan, rujukan dan bendera gambar kepala, serta folder, Trash, pelan projek, templat pengguna dan alat buatan pengguna, kegemaran, alat tersembunyi, bahasa dan pilihan emoji. Dibaca melalui `host.profile`. |
| `sessions.json` | ya | Setiap sesi tersimpan: slot, id dan versi alat, label, lakaran kecil (URL data) dan data input penuh. Dibaca melalui `host.state`. |
| `assets.json` | ya | Metadata bagi setiap aset yang dimuat naik (imej, fon, token jenama, logo, salinan tersimpan muat turun), masing-masing menunjuk kepada baitnya di bawah `assets/blobs/`. |
| `assets/blobs/<n>.<ext>` | bagi setiap aset | Bait aset mentah, disimpan tanpa mampatan kerana kebanyakannya sudah format termampat. Sambungan hanyalah hiasan; jenis MIME dalam `assets.json` yang berwibawa. |
| `assets/blobs/<n>.c2pa` | apabila ada | Content Credentials yang diekstrak sebagai bait binari tepat, dirujuk oleh `_credentialFile` dalam rekod aset. Ini bukan kunci tandatangan peranti. |
| `design-systems.json` | apabila ada | Sistem reka bentuk yang dibuat atau ditambah pada pemasangan ini, sebagai `{ active, records }`. Lihat [Import rules](#import-rules). |
| `file-history.json` | pilihan | Syot kilat aset berversi, laporan operasi fail yang selesai dan manifes kelompok lengkap, dengan versi sendiri. Disediakan oleh penyesuai sandaran `fileHistory` dalaman shell. |
| `revision-history.json` | pilihan, sandaran manual | ID ciptaan stabil, titik semak yang disimpan, lakaran kecil dan draf pemulihan bergulir. Disediakan oleh `host.state.history.backup` di mana disokong. |
| `file-history/versions/` | bagi setiap syot kilat | Bait aset terdahulu dan kredensial yang diekstrak, sama ada aset semasa masih wujud atau tidak. |
| `file-history/results/` | bagi setiap operasi selesai | Bait output tepat. Tiada fail asal yang dipilih untuk penukaran disimpan atau disertakan. |
| `prefs.json` | ya | Pilihan setempat milik pengguna: `theme`, `sidebarWidth` dan kiraan aktiviti `ct-metrics`. |
| `lolly.txt` | ya | Ringkasan boleh baca bundle (kiraan, profil, nama fail) untuk sesiapa yang membuka zip tanpa Lolly. Dijana semula pada setiap eksport dan dikenali semasa import, jadi ia tidak pernah dikira sebagai bahagian yang dilangkau. Ia ditulis selepas peta integriti, jadi peta tidak meliputi fail ini. |

::: details Cara eksport menulis zip
Eksport menulis zip satu bahagian pada satu masa (`shells/web/src/lib/zip-stream.ts`). Muat naik, hasil tersimpan dan versi aset tersimpan dibaca dalam kepingan 4 MiB, tidak pernah keseluruhan, dan hasil serta versi tersimpan disemak dahulu terhadap SHA-256 yang direkodkan. Setiap fail kemudian dibaca untuk checksum dan digest integritinya, dan zip merujuknya di tempat ia berada.

Tiada apa-apa dikod semula, jadi fail yang membawa Content Credentials mengekalkan bait tepat yang diliputi tandatangannya, dan setiap bahagian mengekalkan bait dan digest tepatnya. Untuk bahagian dan masa yang sama zip adalah serupa dengan penulis dalam memori terdahulu, kecuali fail sejarah melebihi 16 MiB dimampatkan dalam kepingan. `tests/backup-streaming.test.ts` menyemak ini terhadap digest rujukan yang direkodkan.

Pada pustaka sintetik 192 MiB, diukur dalam Node, menyiapkan sandaran mengambil kira-kira 125 hingga 150 MiB di atas pustaka, berbanding kira-kira 850 MiB untuk penulis dalam memori (`node scripts/bench-backup-finalise.ts`). Import masih membaca keseluruhan zip ke dalam memori.
:::

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
| `format` | Sentiasa `lolly-backup`. Fail tanpanya ditolak sebagai "not a Lolly backup". |
| `formatVersion` | Susun atur yang digunakan untuk **menulis** bundle ini. Dinaikkan pada sebarang perubahan kepada set atau bentuk bahagian. Pembaca **tidak** memagar pada medan ini. |
| `minReader` | Versi pembaca minimum yang boleh mengimport bundle ini dengan **selamat**. Ini ialah medan yang dipagari pembaca. |
| `app` | Id apl penghasil, untuk diagnostik. |
| `exportedAt` | Cap masa ISO bundle dicipta. |
| `counts` | Apa yang dimasukkan penulis, untuk paparan dan semakan kewarasan. |
| `integrity` | Pilihan. Memetakan setiap bahagian kecuali `manifest.json` kepada digest `sha256-<base64>` gaya SRI bagi bait **tidak dimampatkan**nya. |

## Dasar versi

Dua nombor versi membolehkan format berkembang tanpa meninggalkan pemasangan lama.

![Perubahan pada format bundle sama ada bersifat tambahan, yang boleh diabaikan pembaca lama, atau memecahkan, di mana import yang salah merosakkan. Tambahan menaikkan formatVersion dan mengekalkan minReader; memecahkan menaikkan formatVersion dan menaikkan minReader. Pembaca mengimport apabila minReader paling banyak versinya sendiri.](/info/diagrams/concepts/backup-version-gate.svg)

- Pembaca mengimport bundle apabila `manifest.minReader` paling banyak versi pembacanya sendiri. Ia menolak, dengan "needs a newer version of the app", hanya apabila bundle menuntut pembaca lebih baharu.
- Perubahan **tambahan**, seperti bahagian pilihan baharu atau medan manifes pilihan baharu, menaikkan `formatVersion` dan membiarkan `minReader`. Apl lama masih mengimport setiap bahagian yang dikenalinya, dan bahagian yang tidak dikenali dilaporkan sebagai dilangkau, tidak digugurkan secara senyap.
- Perubahan **memecahkan**, di mana import bahagian yang salah merosakkan data atau bahagian pilihan menjadi wajib, menaikkan `minReader`. Apl lama kemudian menolak dengan bersih dan bukan mengimport sesuatu yang tidak dapat dikendalikannya.
- Jika bundle masa depan menetapkan `formatVersion` tetapi tidak menyertakan `minReader`, pembaca kembali memagar pada `formatVersion` dan menganggap perubahan sebagai memecahkan.

> **Petua ringkas untuk pengarang:** jika setiap pembaca sedia ada masih melakukan perkara yang betul dengan mengabaikan tambahan anda, perubahan itu bersifat tambahan: naikkan `formatVersion` dan biarkan `minReader`. Jika tidak naikkan `minReader`.

## Integriti

Apabila `manifest.integrity` ada, pembaca menyemak SHA-256 setiap bahagian yang disenaraikan **sebelum menulis apa-apa**. Ketidakpadanan ("failed its integrity check") atau bahagian yang hilang ("incomplete") menghentikan seluruh import, jadi tiada pemulihan separa. Ini menangkap kerosakan yang boleh dilakukan pengangkutan fail: AirDrop terpotong, get laluan e-mel yang mengekod semula lampiran, sektor USB yang rosak.

Integriti adalah usaha terbaik. Ia ditulis hanya di mana Web Crypto tersedia (setiap konteks pelayar selamat dan Node moden), dan disemak hanya apabila kedua-dua peta dan Web Crypto ada. Bundle tanpa peta, seperti satu daripada sebelum integriti wujud, diimport tanpa perubahan: "cannot verify" tidak pernah dikira sebagai "corrupt".

Manifes tidak menyenaraikan dirinya mahupun `lolly.txt` yang dijana semula. Digest meliputi bahagian yang dijamin manifes.

## Peraturan import

Import berjalan dalam salah satu daripada dua mod.

- **Merge** ialah apa yang dilakukan **Import data…**, dan apa yang dilakukan penyertaan pertama sync, **Bring it to this device**. Data pada sasaran kekal, dan tiada apa-apa yang tiada dalam bundle disentuh: sesi yang ada pada sasaran dan tiada dalam bundle bertahan daripada import.
- **Replace** ialah apa yang digunakan sync peranti untuk memastikan peranti seiring: ia mengambil rekod profil salinan yang disegerakkan, pilihan, sesi, imej dan pilihan sistem reka bentuk aktif, dan hanya membuang item yang dipadam peranti lain sejak sync terakhir. Memulihkan salinan terdahulu melangkah lebih jauh dan menjadikan peranti sepadan dengan salinan itu, membuang segala yang tidak dipegang salinan, selepas menyimpan peranti terlebih dahulu. [Sync your devices](/info/sync.html) meliputi apa yang dilihat seseorang.

Dalam penggabungan, apa-apa yang hanya pada sasaran dikekalkan, dan setiap jenis data dalam bundle bertemu sasaran seperti ini:

| Data | Sudah ada pada sasaran | Hanya dalam bundle |
|---|---|---|
| Sesi (mengikut slot) dan imej yang dimuat naik (mengikut id) | Salinan yang disimpan lebih baharu dikekalkan, jadi sandaran lebih lama tidak pernah menulis ganti kerja lebih baharu. Masa sama atau tidak diketahui mengekalkan salinan sasaran. | Ditambah |
| Folder | Nama dan induk sasaran dikekalkan, dan folder mendapat ahli bundle yang tiada padanya. Sesi yang difailkan dalam folder pada sasaran kekal difailkan di situ. | Ditambah |
| Kegemaran (alat, aset katalog dan item Projects) | Digabungkan | Ditambah |
| Templat, templat Projects dan alat pengguna (mengikut id) | Rekod sasaran dikekalkan. | Ditambah |
| Entri Trash | Entri sasaran dikekalkan. | Ditambah, supaya item yang boleh dipulihkan pada mana-mana pemasangan masih boleh. Entri yang foldernya kembali digunakan pada sasaran, atau yang slot Trash-nya sudah digunakan sasaran, ditinggalkan. |
| Medan profil lain (nama, butiran hubungan, bahasa, bendera ciri, alat tersembunyi dan tetapan lain) | Nilai sasaran dikekalkan. | Diambil di mana medan sasaran kosong |
| Pilihan (`prefs.json`) | Nilai sasaran dikekalkan. | Ditulis di mana sasaran tiada |
| Sistem reka bentuk (mengikut id) | Rekod bundle menggantikan rekod sasaran. | Ditambah. Pilihan aktif bundle digunakan hanya apabila sasaran tiada sistem reka bentuk sendiri. |
| Sejarah ciptaan | Salinan yang disimpan lebih baharu kekal semasa, dan yang lain dikekalkan sebagai draf dilindungi. | Ditambah |

**Sesi tersimpan memaut semula ke imej mereka secara automatik.** Rujukan aset disimpan mengikut id, dan jambatan menyelesaikannya semula selepas imej dipulihkan, yang memang perlu dilakukannya kerana URL `blob:` tidak bertahan selepas muat semula.

**Rekod sejarah tidak pernah berubah selepas ditulis.** Import berulang versi aset dan ID operasi tidak menambah apa-apa, dan ID yang sudah menamakan bait atau sejarah berbeza ditolak, tidak ditulis ganti. Mengimport semula aset semasa yang serupa mengekalkan versinya, dan aset semasa yang berubah mesti membawa versi berbeza.

**Sejarah ciptaan mempunyai beberapa peraturan lagi.** Ciptaan yang slotnya digunakan sasaran untuk ciptaan berbeza ditambah sebagai ciptaan berasingan, dan ciptaan dalam Trash sasaran kekal di situ. Id titik semak yang menamakan kandungan berbeza pada sasaran mengekalkan milik sasaran. Arkib yang gagal semakannya sendiri menghentikan import sebelum sebarang profil, sesi, aset atau pilihan berubah, dan import berulang yang serupa tidak menambah storan.

**Ringkasan melaporkan apa yang berlaku.** Setiap import memulangkan `profile`, `sessions`, `userAssets`, `prefs`, `skipped` dan `failedAssets`.

- `failedAssets` mengira aset yang dimuat naik yang tidak dapat dipulihkan, contohnya kerana storan peranti penuh.
- `skipped` mengira bahagian daripada penulis lebih baharu yang tidak dikenali binaan ini. Apl menunjukkannya ("… · N newer items skipped"), jadi pemulihan menyatakan apa yang ditinggalkannya.
- Dengan sejarah fail, ringkasan menambah `assetVersions`, `fileOperations`, `fileBatches` dan `failedHistory`. Kehabisan storan atau konflik ID tidak berubah boleh menyebabkan pemulihan separa, dan apl kemudian memberitahu orang itu supaya menyimpan sandaran sumber.
- Dengan sejarah ciptaan, ia menambah `revisions` dan `recoveryDrafts`, hanya mengira apa yang ditambah import ini, dan `added`, `kept`, `replaced`, `copies` dan `hidden` untuk cara setiap ciptaan digabungkan. `skippedCheckpoints` mengira titik semak yang idnya menamakan kandungan berbeza pada sasaran, dan `historyLeftOut` mengira titik semak dan draf lebih lama yang tidak muat dalam ruang sejarah peranti.
- Import replace menambah `removed` dan `failedRemovals`.

Pemulihan bukan satu transaksi merentasi stor profil, sesi, aset dan sejarah. Sync awan **tidak** memajukan semakan yang digunakannya selepas pemulihan separa atau tidak disokong, jadi salinan kekal tersedia untuk dicuba semula.

## Apa yang tidak berpindah

- **Cache katalog** (metadata dan blob aset yang dimuat turun, indeks alat), yang disegerakkan semula oleh sasaran secara percuma.
- **Alat katalog dan aset katalog**, yang berada di luar skop dan diandaikan ada pada sasaran. Token jenama, fon dan logo yang ditambah pengguna ialah aset pengguna, jadi ia dibawa.
- **URL `blob:` dan objek**, yang dijana semula jambatan semasa muat.
- **Asal penukaran, pajakan pelaksanaan langsung dan rahsia akses atau penandatanganan khusus mesin.** Ini bukan sejarah mudah alih. Hasil tersimpan ialah salinan, bukan janji bahawa sumber asal disandarkan.
- **Pembilang jujukan eksport**, pembilang penamaan muat turun harian dalam `localStorage` (`lolly-export-seq`). Ia dikekalkan di luar `PREF_KEYS`, jadi ia tidak pernah menaiki bundle.

Meter storan menunjukkan pembahagian yang sama. Saved sessions, My images dan File results & versions masuk ke dalam bundle. Cache aset, pratonton alat dan semat luar talian di bawahnya semuanya boleh dibina semula, jadi ia ditinggalkan.

![Meter storan memecahkan data peranti ini kepada kategori bernama, dengan Saved sessions dan My images dijejak secara berasingan daripada Asset cache, di sini pada pemasangan baharu di mana setiap kategori masih kosong](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&dark=1&filename=ce-storage-categories)

## Data organisasi dengan Lolly Work

Bundle ini menyandarkan pustaka peribadi peranti. Ia bukan sandaran instans **Lolly Work**: akaun organisasi, dasar akses, projek dikongsi, versi katalog, kelulusan, tugasan render dan rekod audit dipegang oleh perkhidmatan itu. Sambung semula dan log masuk untuk mendapatkan semula akses kepada kerja dikongsi; mengimport bundle peribadi tidak memberikan akses itu.

Pengendali menyandarkan, mengekalkan dan memadam data pelayan dengan panduan Lolly Work sendiri: [Backup and restore](/info/work-operations.html#backup-and-restore) dan [Work storage and data lifecycle](/info/work-data-lifecycle.html). Mengosongkan atau mengeksport peranti tidak melakukan mana-mana operasi pelayan itu.

## Merentasi shell

`data-transfer.ts` membaca dan menulis hanya melalui jambatan keupayaan (`host.profile`, `host.state`, `host.assets`) dan pilihan `localStorage` dikongsi. Modul yang sama membaca dan menulis sampul biasa pada web dan dalam apl desktop dan mudah alih, melalui IndexedDB atau storan sistem fail. Bahagian sejarah pilihan muncul hanya di mana penyesuainya tersedia, dan bahagian yang tidak disokong dilaporkan sebagai dilangkau semasa import. Suite tanpa kepala melatih bahagian biasa terhadap jambatan dalam memori, dan transaksi sejarah juga mempunyai ujian pelayar sebenar.

Dua shell berada di luar jaminan itu, atas sebab yang berbeza:

- **CLI sekali jalan** tiada apa-apa untuk dibawa: keadaannya dalam memori dan bertahan satu pemanggilan.
- **TUI** menyimpan keadaan dalam `~/.lolly` (sesi, folder, profil), dan paparan Profile-nya boleh menyandarkannya, tetapi ia menulis arkib lebih ringkas sendiri: `saved-state/<slot>.json` bagi setiap sesi serta `profile.json` dan `folders.json`, tanpa manifes, tanpa `formatVersion` atau `minReader` dan tanpa peta integriti. Format ini tidak dapat mengimportnya (pembaca menolaknya sebagai "not a Lolly backup"), dan namanya mengelirukan serupa (`lolly-backup-<stamp>.zip`). Menyatukan kedua-duanya ialah jurang yang diketahui.

## Belum mudah alih

Sampul ialah manifes ditambah bahagian bernama, jadi jenis data mudah alih baharu boleh menyertai kemudian sebagai bahagian tambahan (`formatVersion` baharu, `minReader` yang sama), dan pembaca hari ini melangkau apa yang tidak dikenali. Sistem reka bentuk sudah berpindah dengan cara ini, sebagai `design-systems.json` serta aset penggunanya.

Dua nama dikhaskan untuk data yang belum berpindah:

- **`tokens.json`** akan membawa seluruh dokumen token reka bentuk [W3C DTCG](https://tr.designtokens.org/format/) dengan kumpulan, set dan temanya, format yang [diimport dan dieksport Penpot](https://help.penpot.app/user-guide/design-systems/design-tokens/). Token jenama pengguna sendiri sudah berpindah sebagai aset `user/tokens/brand` dalam `assets.json`, dan token sistem reka bentuk berpindah bersama rekodnya.
- **`penpot/`** dikhaskan untuk fail Penpot yang diingest, atau subset berkaitan Lolly daripadanya, dipaparkan sebagai alat.

Pembaca hari ini tidak mengenali kedua-dua nama itu lagi. Seperti apa-apa lain di luar bahagian di atas, setiap satu ialah bahagian tidak diketahui bagi mereka: dibiarkan tidak disentuh dan dikira dalam `skipped`.

## Bahagian sejarah

Dua bahagian sejarah adalah pilihan dan mempunyai versi sendiri. Kebanyakan pembaca boleh melangkau bahagian ini.

::: details Sejarah ciptaan (v3)
Sandaran manual daripada pemasangan web dengan sejarah ciptaan termasuk `revision-history.json`, dengan skema `{ version: 1, documents, revisions, recoveries }` sendiri. Ia membawa ID yang disimpan, syot kilat input kanonik, cap versi, pratonton raster dan draf penulis berasingan. Penyesuai sejarah menangkap sesi semasa dan kepalanya dalam satu transaksi baca, dan `sessions.json` menggunakan syot kilat semasa yang sama untuk pembaca lebih lama.

Pemulihan menyemak SHA-256 muatan dan kiraan bait, identiti unik, hubungan dokumen dan kepala, salasilah, cap masa, jenis pratonton dan had sebelum mengomit arkib dalam satu transaksi. Rujukan induk yang dipadatkan mungkin hilang. Kerja semasa sedia ada tidak pernah digantikan secara senyap: apabila ciptaan ada di kedua-dua belah, belah yang tidak dikekalkan semasa menjadi draf dilindungi.

Had pemindahan 384 MiB arkib disemak secara jelas, dan had storan dikuatkuasakan tanpa memotong titik semak yang disimpan. Eksport menulis `revision-history.json` dan `sessions.json` dalam ketulan, dengan bait yang sama seperti yang diberikan satu `JSON.stringify`, jadi teks fail tidak pernah dipegang keseluruhan. Fail sejarah yang akan melepasi had digugurkan sebaik ia melepasinya dan hanya dikira dari situ. Arkib kemudian dibuat semula tanpa titik semak automatik tertuanya, dan ringkasan eksport mengira itu sebagai `checkpointsLeftOut`, atau arkib ditolak keseluruhannya.

Shell tanpa keupayaan ini memulihkan sesi biasa dan melaporkan bahagian sejarah sebagai dilangkau. Sejarah sistem fail natif kekal tidak disokong sehingga penyesuainya membekalkan transaksi sejarah tahan lama. Tetamu dalam collab peribadi tiada sejarah tahan lama atau arkib pemulihan.

Sync syot kilat peribadi tidak menyertakan sejarah ciptaan. Menggunakan syot kilat pada dokumen setempat dengan sejarah mengekalkan keadaan kerja sebelumnya sebagai draf pemulihan berasingan dan membatalkan token tulis mana-mana penyunting terbuka. Titik semak tidak berubahnya kekal pada peranti. Ini melindungi sejarah setempat semasa penggantian syot kilat; ia tidak menggabungkan sejarah peranti serentak.

Rujukan aset bersejarah dikekalkan, manakala perenderan masih menyelesaikan aset melalui pustaka sedia ada destinasi. Arkib ini belum menjamin bait aset lama yang tepat atau render alat lama. Bait versi aset dan hasil fail dibawa dalam bahagian sandaran sendiri.
:::

::: details Versi tersimpan dan hasil fail (v2)
Bahagian sejarah pilihan memegang `{ version: 2, assetVersions: [...], operations: [...], batches: [...] }`, dan pembaca juga menerima bentuk history-v1 terdahulu tanpa kelompok. Setiap syot kilat memberikan ID aset stabil dan versi tepat, masa simpannya, panjang bait dan SHA-256 heksnya, serta rekod aset yang `_file` dan `_credentialFile` pilihannya menunjuk kepada bahagian binari. Operasi membawa fakta fail asal, permintaan, laporan, cap masa dan `_file` hasil pilihan. Nama bahagian belakang storan, pemegang OPFS dan pajakan pelaksanaan tidak berpindah. Pembaca yang hanya mengetahui history v1 menolak versi sejarah baharu sebelum mengimport, dan bukan menggugurkan keahlian kelompok secara senyap.

Manifes kelompok merekodkan setiap sumber yang dipilih sebelum pemprosesan, termasuk fail yang tidak pernah dibaca, ahli yang dibatalkan, kegagalan menempah ruang hasil dan kerja yang terganggu. Setiap ahli mempunyai ID operasi stabil, rujukan dan fakta sumber, nama output yang diminta dan laporan akhir. Sumber yang tidak dibaca mempunyai fakta yang diisytiharkan, bukan digest rekaan. Import mengesahkan identiti ahli dan konsistensi dengan sebarang laporan operasi yang dibawa. Laporan kelompok kekal tersedia apabila hasil individu telah dibuang, tetapi resit tidak bermakna bait outputnya masih disimpan.

- **Pengesahan dahulu.** Setiap rekod sejarah yang diketahui, laporan dan fail yang dirujuk disahkan sebelum sebarang import profil atau aset menulis. Bait yang hilang dan SHA-256 yang tidak sepadan gagal walaupun sampul tiada peta integriti. Kredensial yang diekstrak kekal tatasusunan bait, termasuk import daripada penulis lebih lama yang menyirikannya sebagai objek kunci berangka.
- **Kerja berjalan.** Operasi yang berjalan menjadi rekod terganggu dalam sandaran, dengan laporan kegagalan penerang dan tanpa hasil. Pemulihan tidak pernah memulakan semula kerja latar belakang atau mengimport pajakan aktif. Mencuba semula bermakna memilih fail asal sekali lagi, disemak terhadap SHA-256 yang direkodkan apabila tersedia.
- **Storan.** Hasil yang dipulihkan mengomit bait dan metadatanya bersama dalam IndexedDB. Hasil baharu biasa menggunakan OPFS di mana tersedia, dengan sandaran IndexedDB. Operasi langsung sedia ada tidak pernah digantikan oleh import.
- **Had sandaran.** Eksport menstrim bait ini ke dalam arkib, tetapi pemulihan masih menyahzip keseluruhan sandaran dalam memori, jadi had kekal: **256 MiB muatan sejarah**, **4 MiB metadata sejarah**, paling banyak **100 operasi**, **100 kelompok** dan **2,000 syot kilat**. Eksport menolak sejarah terlalu besar atau tidak lengkap secara jelas dan tidak pernah meninggalkannya secara senyap. Muat turun versi dan hasil penting satu demi satu sebelum membuang salinan setempat lebih lama. Had ini bukan jaminan memori puncak yang diukur untuk telefon.
- **Belanjawan setempat.** Sejarah hasil setempat mempunyai belanjawan 512 MiB dan had 100 rekod. Syot kilat aset mempunyai belanjawan 512 MiB berasingan dan paling banyak 20 versi bersejarah bagi setiap aset, dan bait kredensial yang diekstrak dikira dalam belanjawan itu. Pemulihan menghormati had ini dan tidak pernah menyingkirkan data pengguna sedia ada secara senyap.
- **Metadata kelompok.** Metadata kelompok setempat mempunyai belanjawan 4 MiB berasingan, paling banyak 100 manifes dan 20 ahli bagi setiap kelompok. Ahli tertunggak menempah kapasiti metadata, dengan siling laporan 32 KiB bagi setiap ahli. Ini belanjawan logik, bukan jaminan ruang cakera pelayar: kegagalan kuota sebenar ditunjukkan, dan laporan dalam memori kekal boleh dimuat turun. Mencuba semula ahli kelompok mencipta kelompok baharu tanpa menulis ganti laporan lama. Membuang rekod kelompok tidak membuang bait hasil individu atau aset pustaka.
- **Hasil dalam pustaka.** Hasil yang ditukar boleh ditambah ke pustaka tanpa normalisasi atau pengekodan semula, dengan cincangan sumber dan output serta hubungan operasi dilampirkan. Penambahan berulang menggunakan semula salinan tidak berubah, dan salinan yang disunting tidak pernah ditulis ganti. Imej raster boleh memulakan dokumen Design baharu, yang menggunakan ID aset pustaka semasa; menguatkuasakan penyematan versi tepat merentasi masa jalan dan laluan URL Design ialah kerja berasingan. Hasil SVG, HTML, PDF dan ZIP disimpan sebagai aset fail legap, tidak dinaikkan menjadi kandungan interaktif atau vektor yang dipercayai.
- **Di mana orang melihatnya.** **Convert → Recent file operations** menunjukkan penggunaan sejarah, laporan, muat turun dan pengurus versi, yang juga menemui versi terdahulu aset pustaka yang dipadam. Memulihkan syot kilat mencipta versi semasa baharu dan mengekalkan syot kilat yang dipilih. **Settings → Preferences → Storage** mengira hasil dan versi secara berasingan daripada cache pakai buang.
- **Pembersihan.** Pembersihan fail sementara yang jelas hanya membuang bait milik operasi yang tidak dirujuk. Rekod semasa melindungi failnya, dan fail OPFS terkini mempunyai tempoh bertolak ansur satu jam. Hasil tersimpan dan syot kilat aset tidak dikosongkan secara automatik.

Pembaca lama masih menerima sampul v2 (`minReader: 1`) dan memulihkan bahagian yang diketahuinya, mengira bahagian sejarah yang tidak disokong sebagai dilangkau. Pemulihan sejarah penuh memerlukan shell dengan penyesuai `fileHistory`, jahitan di dalam shell dan bukan keupayaan `HostV1` baharu yang menghadap alat. Pemulihan dua peranti sebenar diliputi pintu Chromium setempat; pemulihan pada apl desktop, iOS dan Android yang dipasang masih perlu diterima secara berasingan.
:::

## Rujukan

- Modul: `shells/web/src/data-transfer.ts` (`exportBackup`, `importBackup`, `BACKUP_FORMAT`, `BACKUP_FORMAT_VERSION`, `BACKUP_READER_VERSION`; penama `backupFilename()` adalah dalaman).
- Ujian kontrak: `tests/data-transfer.test.ts`, meliputi pergi-balik, gabung, integriti, keserasian ke hadapan dan pagar pembaca.
- Ujian kontrak sejarah: `tests/file-history-backup.test.ts`, `tests/file-batch-history.test.ts` dan `tests/file-result-library.test.ts`. Penerimaan pelayar: `tests/file-history.browser.test.ts`, `tests/file-batch-history.browser.test.ts` dan `tests/file-result-reuse.browser.test.ts`.
- Permukaan jambatan yang digunakan: `host.profile`, `host.state` dan `host.assets`; lihat [Host API](/info/host-api.html).
