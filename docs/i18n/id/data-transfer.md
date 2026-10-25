# Transfer data: bundel `lolly-backup`

Lolly menyimpan pustaka pribadi Anda di perangkat. Bundel cadangan adalah cara pustaka itu berpindah: ekspor di satu instalasi, bawa file dengan cara apa pun (USB, AirDrop, email ke diri sendiri, atau berbagi jaringan) dan impor di instalasi lain. Mengekspor dan mengimpor tidak memerlukan server, dan targetnya dapat offline.

Halaman ini adalah spesifikasi format, untuk orang yang membangun shell, alat, atau skrip di sekitar cadangan: apa isi zip, bagaimana versi dijaga, bagaimana impor menggabungkan, dan apa yang diperiksa. Panduan untuk orang yang memindahkan karyanya sendiri adalah [Move your work to another device](/info/find-your-work.html#move-your-work-to-another-device).

![Dua tombol yang memindahkan seluruh instalasi: Export my data menulis satu zip, Import data membacanya kembali](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-move%3Ediv%3Anth-of-type%282%29%2C.store-move%3Ep%3Alast-of-type%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dmove%5D%3Esummary&walker=1&format=svg&cropSelector=%5Bdata-store-group%3Dmove%5D&dark=1&filename=pd-transfer-controls)

> **Cakupan.** Bundel membawa *data pengguna*, bukan alat katalog. Alat katalog dan aset katalog disinkronkan secara terpisah dan diasumsikan sudah ada di target, paling buruk pada versi yang lebih tinggi. Alat yang dibuat pengguna sendiri ikut di dalam `profile.json`. Mengimpor tidak pernah memasang atau meningkatkan alat katalog.

## Tujuan

- <!--i:box--> **Satu format, setiap shell.** Aplikasi web, aplikasi desktop dan seluler, serta shell masa depan berbagi envelope dan skema bagian yang sama. Bagian opsional bergantung pada kemampuan tiap shell, dan bagian yang tidak didukung dilaporkan. Setiap capability bridge menyediakan adapter penyimpanannya.
- <!--i:shieldcheck--> **Selamat dalam perjalanan.** Bundel yang rusak atau terpotong dalam transit gagal dengan jelas saat impor dan tidak pernah dipulihkan setengah-setengah.
- <!--i:clock--> **Bertahan melampaui versi ini.** Aplikasi yang lebih lama masih dapat mengimpor bagian bundel yang lebih baru yang dikenalinya. Format yang benar-benar tidak kompatibel ditolak dengan bersih.
- <!--i:check--> **Aman digabung.** Mengimpor ke instalasi yang sudah dipakai tidak pernah menghapus apa pun yang tidak ada di bundel.

## Amplop

Bundel adalah `.zip` biasa, sehingga selamat di transport apa pun dan alat unzip mana pun dapat memeriksa isinya.

Unduhan dinamai menurut orang pemiliknya: `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip`, misalnya `LollyTools-Ada-Lovelace-2026-06-26-1.zip`, sehingga folder Downloads berisi cadangan tetap terbaca. Nama depan dan belakang berasal dari profil dan dibuang bila tidak diatur: tanpa profil menghasilkan `LollyTools-2026-06-26-1.zip`, dan nama depan saja menghasilkan `LollyTools-Ada-2026-06-26-1.zip`. Setiap nama dipadatkan menjadi token aman untuk nama file (huruf dan angka Unicode dipertahankan, spasi dan tanda baca dibuang, paling banyak 32 karakter). `<n>` adalah urutan per hari per perangkat, jadi ekspor berulang pada satu hari tidak bertabrakan dan tetap berurutan. `backupFilename()` di `data-transfer.ts` membangun namanya, dan isi zip sama apa pun namanya.

| Path | Wajib | Isi |
|---|---|---|
| `manifest.json` | ya | Id format, versi, jumlah, dan integritas per bagian. Hal pertama yang dilihat pembaca. |
| `profile.json` | bila diatur | Seluruh catatan `me` pengguna: nama, kontak, ref foto profil dan flag, ditambah folder, Trash, cetak biru proyek, templat pengguna dan alat buatan pengguna, favorit, alat tersembunyi, bahasa, dan pilihan emoji. Dibaca melalui `host.profile`. |
| `sessions.json` | ya | Setiap sesi tersimpan: slot, id dan versi alat, label, thumbnail (data URL), dan data input lengkap. Dibaca melalui `host.state`. |
| `assets.json` | ya | Metadata untuk setiap aset yang diunggah (gambar, font, token brand, logo, salinan tersimpan dari unduhan), masing-masing menunjuk ke byte-nya di bawah `assets/blobs/`. |
| `assets/blobs/<n>.<ext>` | per aset | Byte aset mentah, disimpan tanpa kompresi karena sebagian besar sudah berformat terkompresi. Ekstensinya kosmetik; tipe MIME di `assets.json` yang otoritatif. |
| `assets/blobs/<n>.c2pa` | bila ada | Content Credentials yang diekstrak sebagai byte biner persis, dirujuk oleh `_credentialFile` dalam catatan aset. Ini bukan kunci penandatanganan perangkat. |
| `design-systems.json` | bila ada | Design system yang dibuat atau ditambahkan di instalasi ini, sebagai `{ active, records }`. Lihat [Import rules](#import-rules). |
| `file-history.json` | opsional | Snapshot aset berversi, laporan operasi file yang selesai, dan manifes batch lengkap, dengan versinya sendiri. Disediakan oleh adapter cadangan internal `fileHistory` milik shell. |
| `revision-history.json` | opsional, cadangan manual | ID pembuatan stabil, checkpoint yang disimpan, thumbnail, dan draf pemulihan bergulir. Disediakan oleh `host.state.history.backup` bila didukung. |
| `file-history/versions/` | per snapshot | Byte aset sebelumnya dan kredensial yang diekstrak, baik aset saat ini masih ada maupun tidak. |
| `file-history/results/` | per operasi selesai | Byte keluaran persis. Tidak ada file asli yang dipilih untuk konversi yang disimpan atau disertakan. |
| `prefs.json` | ya | Preferensi lokal milik pengguna: `theme`, `sidebarWidth`, dan hitungan aktivitas `ct-metrics`. |
| `lolly.txt` | ya | Ringkasan terbaca dari bundel (jumlah, profil, nama file) untuk siapa pun yang membuka zip tanpa Lolly. Dibuat ulang pada setiap ekspor dan dikenali saat impor, jadi tidak pernah dihitung sebagai bagian yang dilewati. Ditulis setelah peta integritas, jadi peta tidak mencakup file ini. |

::: details Bagaimana ekspor menulis zip
Ekspor menulis zip satu bagian pada satu waktu (`shells/web/src/lib/zip-stream.ts`). Unggahan, hasil tersimpan, dan versi aset tersimpan dibaca dalam potongan 4 MiB, tidak pernah utuh, dan hasil serta versi tersimpan lebih dulu diperiksa terhadap SHA-256 yang dicatat. Setiap file kemudian dibaca untuk checksum dan digest integritasnya, dan zip merujuknya di tempatnya berada.

Tidak ada yang dienkode ulang, jadi file yang membawa Content Credentials mempertahankan byte persis yang dicakup tanda tangannya, dan setiap bagian mempertahankan byte dan digest persisnya. Untuk bagian dan waktu yang sama zip identik dengan penulis dalam memori sebelumnya, kecuali file riwayat di atas 16 MiB dikompres dalam potongan. `tests/backup-streaming.test.ts` memeriksa ini terhadap digest referensi yang dicatat.

Pada pustaka sintetis 192 MiB, yang diukur di Node, menyelesaikan cadangan memakan sekitar 125 hingga 150 MiB di atas pustaka, dibandingkan sekitar 850 MiB untuk penulis dalam memori (`node scripts/bench-backup-finalise.ts`). Impor masih membaca seluruh zip ke memori.
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

| Field | Arti |
|---|---|
| `format` | Selalu `lolly-backup`. File tanpanya ditolak sebagai "not a Lolly backup". |
| `formatVersion` | Tata letak yang dipakai bundel ini saat **ditulis**. Dinaikkan pada setiap perubahan set atau bentuk bagian. Pembaca **tidak** menjaga berdasarkan field ini. |
| `minReader` | Versi pembaca minimum yang dapat mengimpor bundel ini dengan **aman**. Inilah field yang dijaga pembaca. |
| `app` | Id aplikasi pembuat, untuk diagnostik. |
| `exportedAt` | Stempel waktu ISO saat bundel dibuat. |
| `counts` | Apa yang dimasukkan penulis, untuk tampilan dan pemeriksaan kewajaran. |
| `integrity` | Opsional. Memetakan setiap bagian kecuali `manifest.json` ke digest `sha256-<base64>` gaya SRI dari byte-nya yang **tidak terkompresi**. |

## Kebijakan versi

Dua nomor versi memungkinkan format tumbuh tanpa menelantarkan instalasi yang lebih lama.

![Perubahan pada format bundel bersifat aditif, yang dapat diabaikan pembaca lama, atau mematahkan, yang jika diimpor salah akan merusak. Aditif menaikkan formatVersion dan mempertahankan minReader; mematahkan menaikkan formatVersion dan menaikkan minReader. Pembaca mengimpor bila minReader paling tinggi sama dengan versinya sendiri.](/info/diagrams/concepts/backup-version-gate.svg)

- Pembaca mengimpor bundel bila `manifest.minReader` paling tinggi sama dengan versi pembacanya sendiri. Ia menolak, dengan "needs a newer version of the app", hanya bila bundel menuntut pembaca yang lebih baru.
- Perubahan **aditif**, seperti bagian opsional baru atau field manifes opsional baru, menaikkan `formatVersion` dan membiarkan `minReader`. Aplikasi lama tetap mengimpor setiap bagian yang dikenalinya, dan bagian yang tidak dikenali dilaporkan sebagai dilewati, tidak dibuang diam-diam.
- Perubahan **mematahkan**, yaitu impor bagian yang salah merusak data atau bagian opsional menjadi wajib, menaikkan `minReader`. Aplikasi lama kemudian menolak dengan bersih alih-alih mengimpor sesuatu yang tidak dapat ditanganinya.
- Jika bundel masa depan menetapkan `formatVersion` tetapi tidak menyertakan `minReader`, pembaca beralih menjaga berdasarkan `formatVersion` dan menganggap perubahan itu mematahkan.

> **Aturan praktis untuk penulis:** jika setiap pembaca yang ada tetap melakukan hal yang benar dengan mengabaikan tambahan Anda, perubahan itu aditif: naikkan `formatVersion` dan biarkan `minReader`. Jika tidak, naikkan `minReader`.

## Integritas

Bila `manifest.integrity` ada, pembaca memeriksa SHA-256 setiap bagian yang tercantum **sebelum menulis apa pun**. Ketidakcocokan ("failed its integrity check") atau bagian yang hilang ("incomplete") menghentikan seluruh impor, jadi tidak ada pemulihan parsial. Ini menangkap kerusakan yang dapat ditimbulkan transport file: AirDrop terpotong, gateway email yang mengenkode ulang lampiran, sektor USB yang buruk.

Integritas bersifat upaya terbaik. Ia ditulis hanya bila Web Crypto tersedia (setiap konteks browser aman dan Node modern), dan diperiksa hanya bila peta dan Web Crypto sama-sama ada. Bundel tanpa peta, seperti dari sebelum integritas ada, diimpor tanpa perubahan: "cannot verify" tidak pernah dihitung sebagai "corrupt".

Manifes tidak mencantumkan dirinya sendiri maupun `lolly.txt` yang dibuat ulang. Digest mencakup bagian yang dijamin manifes.

## Aturan impor

Impor berjalan dalam salah satu dari dua mode.

- **Merge** adalah yang dilakukan **Import data…**, dan yang dilakukan bergabung pertama sinkronisasi, **Bring it to this device**. Data di target tetap, dan tidak ada yang tidak ada di bundel yang disentuh: sesi yang dimiliki target dan tidak dimiliki bundel selamat dari impor.
- **Replace** adalah yang dipakai sinkronisasi perangkat untuk menjaga perangkat tetap selaras: ia mengambil catatan profil, preferensi, sesi, gambar, dan pilihan design system aktif dari salinan tersinkron, dan hanya menghapus item yang dihapus perangkat lain sejak sinkronisasi terakhir. Memulihkan salinan sebelumnya lebih jauh dan membuat perangkat cocok dengan salinan itu, menghapus semua yang tidak dimuat salinan, setelah menyimpan perangkat lebih dulu. [Sync your devices](/info/sync.html) membahas apa yang dilihat orang.

Dalam merge, apa pun yang hanya ada di target dipertahankan, dan setiap jenis data di bundel bertemu target seperti ini:

| Data | Sudah ada di target | Hanya di bundel |
|---|---|---|
| Sesi (menurut slot) dan gambar yang diunggah (menurut id) | Salinan yang disimpan lebih baru dipertahankan, jadi cadangan lama tidak pernah menimpa pekerjaan yang lebih baru. Waktu yang sama atau tidak diketahui mempertahankan salinan target. | Ditambahkan |
| Folder | Nama dan induk target dipertahankan, dan folder mendapat anggota bundel yang belum dimilikinya. Sesi yang disimpan dalam folder di target tetap tersimpan di sana. | Ditambahkan |
| Favorit (alat, aset katalog, dan item Projects) | Digabung | Ditambahkan |
| Templat, templat Projects, dan alat pengguna (menurut id) | Catatan target dipertahankan. | Ditambahkan |
| Entri Trash | Entri target dipertahankan. | Ditambahkan, jadi item yang dapat dipulihkan di salah satu instalasi tetap dapat. Entri yang foldernya kembali dipakai di target, atau yang slot Trash-nya sudah dipakai target, tidak disertakan. |
| Field profil lain (nama, detail kontak, bahasa, feature flag, alat tersembunyi, dan pengaturan lain) | Nilai target dipertahankan. | Diambil bila field target kosong |
| Preferensi (`prefs.json`) | Nilai target dipertahankan. | Ditulis bila target tidak memilikinya |
| Design system (menurut id) | Catatan bundel menggantikan catatan target. | Ditambahkan. Pilihan aktif bundel berlaku hanya bila target tidak memiliki design system sendiri. |
| Riwayat pembuatan | Salinan yang disimpan lebih baru tetap menjadi yang terkini, dan yang lain disimpan sebagai draf terlindungi. | Ditambahkan |

**Sesi tersimpan terhubung kembali ke gambarnya secara otomatis.** Referensi aset disimpan menurut id, dan bridge menyelesaikannya ulang setelah gambar dipulihkan, yang memang harus dilakukannya karena URL `blob:` tidak bertahan setelah muat ulang.

**Catatan riwayat tidak pernah berubah setelah ditulis.** Impor ulang versi aset dan ID operasi tidak menambahkan apa pun, dan ID yang sudah menamai byte atau riwayat berbeda ditolak, tidak ditimpa. Mengimpor ulang aset saat ini yang identik mempertahankan versinya, dan aset saat ini yang berubah harus membawa versi berbeda.

**Riwayat pembuatan memiliki beberapa aturan lagi.** Karya yang slotnya dipakai target untuk karya berbeda ditambahkan sebagai karya terpisah, dan karya di Trash target tetap di sana. Id checkpoint yang menamai konten berbeda di target mempertahankan milik target. Arsip yang gagal pemeriksaannya sendiri menghentikan impor sebelum profil, sesi, aset, atau preferensi berubah, dan impor ulang yang identik tidak menambah penyimpanan.

**Ringkasan melaporkan apa yang terjadi.** Setiap impor mengembalikan `profile`, `sessions`, `userAssets`, `prefs`, `skipped`, dan `failedAssets`.

- `failedAssets` menghitung aset yang diunggah yang tidak dapat dipulihkan, misalnya karena penyimpanan perangkat penuh.
- `skipped` menghitung bagian dari penulis yang lebih baru yang tidak dikenali build ini. Aplikasi menampilkannya ("… · N newer items skipped"), jadi pemulihan menyatakan apa yang ditinggalkannya.
- Dengan riwayat file, ringkasan menambahkan `assetVersions`, `fileOperations`, `fileBatches`, dan `failedHistory`. Penyimpanan habis atau konflik ID yang tidak dapat diubah dapat menyebabkan pemulihan parsial, dan aplikasi kemudian meminta orang itu menyimpan cadangan sumber.
- Dengan riwayat pembuatan, ringkasan menambahkan `revisions` dan `recoveryDrafts`, hanya menghitung apa yang ditambahkan impor ini, serta `added`, `kept`, `replaced`, `copies`, dan `hidden` untuk bagaimana tiap karya digabung. `skippedCheckpoints` menghitung checkpoint yang id-nya menamai konten berbeda di target, dan `historyLeftOut` menghitung checkpoint dan draf lebih lama yang tidak muat di ruang riwayat perangkat.
- Impor replace menambahkan `removed` dan `failedRemovals`.

Pemulihan bukan satu transaksi lintas penyimpanan profil, sesi, aset, dan riwayat. Sinkronisasi cloud **tidak** memajukan revisi yang diterapkannya setelah pemulihan parsial atau tidak didukung, sehingga salinan tetap tersedia untuk dicoba lagi.

## Apa yang tidak ikut berpindah

- **Cache katalog** (metadata dan blob aset yang diunduh, indeks alat), yang disinkronkan ulang target tanpa biaya.
- **Alat katalog dan aset katalog**, yang berada di luar cakupan dan diasumsikan sudah ada di target. Token brand, font, dan logo yang ditambahkan pengguna adalah aset pengguna, jadi ikut.
- **URL `blob:` dan objek**, yang dibuat ulang bridge saat dimuat.
- **Asli konversi, lease eksekusi aktif, dan rahasia akses atau penandatanganan lokal mesin.** Ini bukan riwayat yang portabel. Hasil tersimpan adalah salinan, bukan janji bahwa sumber aslinya dicadangkan.
- **Penghitung urutan ekspor**, penghitung penamaan unduhan per hari di `localStorage` (`lolly-export-seq`). Ia dijauhkan dari `PREF_KEYS`, jadi tidak pernah ikut dalam bundel.

Pengukur penyimpanan menampilkan pemisahan yang sama. Saved sessions, My images, dan File results & versions masuk ke bundel. Cache aset, pratinjau alat, dan pin offline di bawahnya semuanya dapat dibangun ulang, jadi tertinggal.

![Pengukur penyimpanan memecah data perangkat ini menjadi kategori bernama, dengan Saved sessions dan My images dilacak terpisah dari Asset cache, di sini pada instalasi baru tempat setiap kategori masih kosong](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&dark=1&filename=ce-storage-categories)

## Data organisasi dengan Lolly Work

Bundel ini mencadangkan pustaka pribadi perangkat. Ini bukan cadangan instans **Lolly Work**: akun organisasi, kebijakan akses, proyek bersama, versi katalog, persetujuan, pekerjaan render, dan catatan audit disimpan oleh layanan itu. Sambungkan kembali dan login untuk mendapatkan kembali akses ke pekerjaan bersama; mengimpor bundel pribadi tidak memberi akses itu.

Operator mencadangkan, menyimpan, dan menghapus data server dengan panduan Lolly Work sendiri: [Backup and restore](/info/work-operations.html#backup-and-restore) dan [Work storage and data lifecycle](/info/work-data-lifecycle.html). Membersihkan atau mengekspor perangkat tidak melakukan operasi server mana pun.

## Lintas shell

`data-transfer.ts` membaca dan menulis hanya melalui capability bridge (`host.profile`, `host.state`, `host.assets`) dan preferensi `localStorage` bersama. Modul yang sama membaca dan menulis envelope umum di web dan di aplikasi desktop dan seluler, melalui penyimpanan IndexedDB atau filesystem. Bagian riwayat opsional muncul hanya bila adapternya tersedia, dan bagian yang tidak didukung dilaporkan sebagai dilewati saat impor. Rangkaian tes tanpa antarmuka menjalankan bagian umum terhadap bridge dalam memori, dan transaksi riwayat juga memiliki tes browser sungguhan.

Dua shell berada di luar jaminan itu, karena alasan yang berbeda:

- **CLI sekali jalan** tidak punya apa pun untuk dibawa: statusnya di memori dan hanya bertahan satu pemanggilan.
- **TUI** menyimpan status di `~/.lolly` (sesi, folder, profil), dan tampilan Profile-nya dapat mencadangkannya, tetapi menulis arsip yang lebih sederhana miliknya sendiri: `saved-state/<slot>.json` per sesi ditambah `profile.json` dan `folders.json`, tanpa manifes, tanpa `formatVersion` atau `minReader`, dan tanpa peta integritas. Format ini tidak dapat mengimpornya (pembaca menolaknya sebagai "not a Lolly backup"), dan namanya membingungkan karena mirip (`lolly-backup-<stamp>.zip`). Menyatukan keduanya adalah celah yang diketahui.

## Belum portabel

Envelope adalah manifes ditambah bagian bernama, jadi jenis data portabel baru dapat bergabung kemudian sebagai bagian aditif (`formatVersion` baru, `minReader` yang sama), dan pembaca saat ini melewati apa yang tidak dikenalinya. Design system sudah ikut dengan cara ini, sebagai `design-systems.json` ditambah aset penggunanya.

Dua nama dicadangkan untuk data yang belum ikut:

- **`tokens.json`** akan membawa seluruh dokumen token desain [W3C DTCG](https://tr.designtokens.org/format/) dengan grup, set, dan temanya, format yang [diimpor dan diekspor Penpot](https://help.penpot.app/user-guide/design-systems/design-tokens/). Token brand pengguna sendiri sudah ikut sebagai aset `user/tokens/brand` di `assets.json`, dan token design system ikut bersama catatannya.
- **`penpot/`** dicadangkan untuk file Penpot yang diserap, atau subset yang relevan bagi Lolly, yang dimunculkan sebagai alat.

Pembaca saat ini belum mengenal kedua nama itu. Seperti apa pun di luar bagian di atas, masing-masing adalah bagian tak dikenal bagi mereka: dibiarkan tak tersentuh dan dihitung di `skipped`.

## Bagian riwayat

Dua bagian riwayat bersifat opsional dan memiliki versinya sendiri. Sebagian besar pembaca dapat melewati bagian ini.

::: details Riwayat pembuatan (v3)
Cadangan manual dari instalasi web dengan riwayat pembuatan menyertakan `revision-history.json`, dengan skema `{ version: 1, documents, revisions, recoveries }` sendiri. Ia membawa ID yang disimpan, snapshot input kanonis, stempel versi, pratinjau raster, dan draf penulis terpisah. Adapter riwayat menangkap sesi saat ini dan head-nya dalam satu transaksi baca, dan `sessions.json` memakai snapshot terkini yang sama untuk pembaca lama.

Pemulihan memeriksa SHA-256 payload dan jumlah byte, identitas unik, hubungan dokumen dan head, silsilah, stempel waktu, tipe pratinjau, dan batas sebelum meng-commit arsip dalam satu transaksi. Referensi induk yang dipadatkan mungkin hilang. Pekerjaan terkini yang ada tidak pernah diganti diam-diam: bila karya ada di kedua sisi, sisi yang tidak dipertahankan sebagai terkini menjadi draf terlindungi.

Batas transfer arsip 384 MiB diperiksa secara eksplisit, dan batas penyimpanan ditegakkan tanpa memotong checkpoint yang disimpan. Ekspor menulis `revision-history.json` dan `sessions.json` dalam potongan, dengan byte yang sama seperti satu `JSON.stringify`, jadi teks file tidak pernah ditahan utuh. File riwayat yang akan melewati batas dibuang saat melewatinya dan hanya dihitung sejak itu. Arsip kemudian dibuat lagi tanpa checkpoint otomatis tertuanya, dan ringkasan ekspor menghitungnya sebagai `checkpointsLeftOut`, atau arsip ditolak seluruhnya.

Shell tanpa kemampuan ini memulihkan sesi biasa dan melaporkan bagian riwayat sebagai dilewati. Riwayat filesystem native tetap tidak didukung sampai adapternya menyediakan transaksi riwayat tahan lama. Tamu dalam collab privat tidak memiliki arsip riwayat atau pemulihan yang tahan lama.

Sinkronisasi snapshot pribadi tidak menyertakan riwayat pembuatan. Menerapkan snapshot pada dokumen lokal dengan riwayat mempertahankan status kerja sebelumnya sebagai draf pemulihan terpisah dan membatalkan token tulis editor yang terbuka. Checkpoint tidak dapat diubahnya tetap di perangkat. Ini melindungi riwayat lokal selama penggantian snapshot; ia tidak menggabungkan riwayat perangkat yang bersamaan.

Referensi aset historis dipertahankan, sementara rendering masih menyelesaikan aset melalui pustaka yang ada di tujuan. Arsip ini belum menjamin byte aset lama yang persis atau render alat lama. Byte versi aset dan hasil file ikut dalam bagian cadangan tersendiri.
:::

::: details Versi tersimpan dan hasil file (v2)
Bagian riwayat opsional menyimpan `{ version: 2, assetVersions: [...], operations: [...], batches: [...] }`, dan pembaca juga menerima bentuk history-v1 sebelumnya tanpa batch. Setiap snapshot memberi ID aset yang stabil dan versi persis, waktu simpan, panjang byte, dan SHA-256 heksa, ditambah catatan aset yang `_file` dan `_credentialFile` opsionalnya menunjuk ke bagian biner. Operasi membawa fakta file asli, permintaan, laporan, stempel waktu, dan `_file` hasil opsional. Nama backend penyimpanan, handle OPFS, dan lease eksekusi tidak ikut. Pembaca yang hanya mengenal history v1 menolak versi riwayat baru sebelum mengimpor, alih-alih diam-diam membuang keanggotaan batch.

Manifes batch mencatat setiap sumber terpilih sebelum pemrosesan, termasuk file yang tidak pernah dibaca, anggota yang dibatalkan, kegagalan mencadangkan ruang hasil, dan pekerjaan yang terputus. Setiap anggota memiliki ID operasi stabil, referensi dan fakta sumber, nama keluaran yang diminta, dan laporan akhir. Sumber yang belum dibaca memiliki fakta yang dideklarasikan, bukan digest karangan. Impor memvalidasi identitas anggota dan konsistensi dengan laporan operasi yang dibawa. Laporan batch tetap tersedia saat hasil individual telah dihapus, tetapi tanda terima tidak berarti byte keluarannya masih tersimpan.

- **Validasi lebih dulu.** Setiap catatan riwayat, laporan, dan file yang dirujuk yang dikenal divalidasi sebelum impor profil atau aset menulis apa pun. Byte yang hilang dan SHA-256 yang tidak cocok gagal bahkan bila envelope tidak memiliki peta integritas. Kredensial yang diekstrak tetap berupa array byte, termasuk impor dari penulis lama yang menserialisasikannya sebagai objek berkunci numerik.
- **Pekerjaan berjalan.** Operasi yang berjalan menjadi catatan terputus di cadangan, dengan laporan kegagalan penjelasan dan tanpa hasil. Memulihkan tidak pernah memulai ulang pekerjaan latar belakang atau mengimpor lease aktif. Mencoba lagi berarti memilih file asli lagi, diperiksa terhadap SHA-256 yang dicatat bila tersedia.
- **Penyimpanan.** Hasil yang dipulihkan meng-commit byte dan metadatanya bersama di IndexedDB. Hasil baru biasa memakai OPFS bila tersedia, dengan fallback IndexedDB. Operasi langsung yang ada tidak pernah diganti oleh impor.
- **Batas cadangan.** Ekspor mengalirkan byte ini ke arsip, tetapi pemulihan masih membuka seluruh cadangan di memori, jadi batasnya tetap: **256 MiB payload riwayat**, **4 MiB metadata riwayat**, paling banyak **100 operasi**, **100 batch**, dan **2.000 snapshot**. Ekspor menolak riwayat yang terlalu besar atau tidak lengkap secara eksplisit dan tidak pernah diam-diam membuangnya. Unduh versi dan hasil penting satu per satu sebelum menghapus salinan lokal yang lebih lama. Batas ini bukan jaminan puncak memori yang terukur untuk ponsel.
- **Anggaran lokal.** Riwayat hasil lokal memiliki anggaran 512 MiB dan batas 100 catatan. Snapshot aset memiliki anggaran terpisah 512 MiB dan paling banyak 20 versi historis per aset, dan byte kredensial yang diekstrak dihitung dalam anggaran itu. Pemulihan menghormati batas ini dan tidak pernah diam-diam menyingkirkan data pengguna yang ada.
- **Metadata batch.** Metadata batch lokal memiliki anggaran terpisah 4 MiB, paling banyak 100 manifes dan 20 anggota per batch. Anggota tertunda mencadangkan kapasitas metadata, dengan batas laporan 32 KiB per anggota. Ini anggaran logis, bukan jaminan ruang disk browser: kegagalan kuota nyata ditampilkan, dan laporan dalam memori tetap dapat diunduh. Mencoba ulang anggota batch membuat batch baru tanpa menimpa laporan lama. Menghapus catatan batch tidak menghapus byte hasil individual atau aset pustaka.
- **Hasil di pustaka.** Hasil konversi dapat ditambahkan ke pustaka tanpa normalisasi atau pengenkodean ulang, dengan hash sumber dan keluaran serta relasi operasi terlampir. Penambahan berulang memakai ulang salinan yang tidak berubah, dan salinan yang disunting tidak pernah ditimpa. Gambar raster dapat memulai dokumen Design baru, yang memakai ID aset pustaka saat ini; menegakkan pin versi persis di seluruh runtime dan jalur URL Design adalah pekerjaan terpisah. Hasil SVG, HTML, PDF, dan ZIP disimpan sebagai aset file buram, tidak dipromosikan menjadi konten interaktif atau vektor tepercaya.
- **Di mana orang melihat ini.** **Convert → Recent file operations** menampilkan penggunaan riwayat, laporan, unduhan, dan pengelola versi, yang juga menemukan versi lebih awal dari aset pustaka yang dihapus. Memulihkan snapshot membuat versi saat ini yang baru dan mempertahankan snapshot terpilih. **Settings → Preferences → Storage** menghitung hasil dan versi secara terpisah dari cache yang dapat dibuang.
- **Pembersihan.** Pembersihan file sementara eksplisit hanya menghapus byte milik operasi yang tidak dirujuk. Catatan saat ini melindungi file-nya, dan file OPFS terbaru memiliki masa tenggang satu jam. Hasil tersimpan dan snapshot aset tidak dibersihkan otomatis.

Pembaca lama masih menerima envelope v2 (`minReader: 1`) dan memulihkan bagian yang dikenalnya, menghitung bagian riwayat yang tidak didukung sebagai dilewati. Pemulihan riwayat penuh memerlukan shell dengan adapter `fileHistory`, sambungan di dalam shell, bukan kemampuan `HostV1` baru yang menghadap alat. Pemulihan dua perangkat nyata dicakup gerbang Chromium lokal; pemulihan di aplikasi desktop, iOS, dan Android yang terpasang masih harus diterima secara terpisah.
:::

## Referensi

- Modul: `shells/web/src/data-transfer.ts` (`exportBackup`, `importBackup`, `BACKUP_FORMAT`, `BACKUP_FORMAT_VERSION`, `BACKUP_READER_VERSION`; penama `backupFilename()` bersifat internal).
- Tes kontrak: `tests/data-transfer.test.ts`, mencakup bolak-balik, merge, integritas, kompatibilitas ke depan, dan gerbang pembaca.
- Tes kontrak riwayat: `tests/file-history-backup.test.ts`, `tests/file-batch-history.test.ts`, dan `tests/file-result-library.test.ts`. Penerimaan browser: `tests/file-history.browser.test.ts`, `tests/file-batch-history.browser.test.ts`, dan `tests/file-result-reuse.browser.test.ts`.
- Permukaan bridge yang dipakai: `host.profile`, `host.state`, dan `host.assets`; lihat [Host API](/info/host-api.html).
