# Transfer data: bundel `lolly-backup`

Bundel cadangan memindahkan pustaka pribadi yang disimpan Lolly di perangkat: ekspor dari satu instalasi, bawa file (USB, AirDrop, email ke diri sendiri atau berbagi melalui jaringan) dan impor ke instalasi lain. Ekspor dan impor tidak memerlukan server, dan perangkat tujuan dapat offline.

Ini adalah spesifikasi format untuk orang yang membangun shell, alat atau skrip seputar cadangan. Untuk memindahkan pekerjaan Anda sendiri, baca [Pindahkan pekerjaan Anda ke perangkat lain](/info/find-your-work.html#move-your-work-to-another-device).

![Dua tombol untuk memindahkan seluruh instalasi: Export my data menulis satu zip, Import data membacanya kembali](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-move%3Ediv%3Anth-of-type%282%29%2C.store-move%3Ep%3Alast-of-type%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dmove%5D%3Esummary&walker=1&format=svg&cropSelector=%5Bdata-store-group%3Dmove%5D&dark=1&filename=pd-transfer-controls)

::: note Cakupan
Bundel membawa *data pengguna*, bukan alat katalog. Alat dan aset katalog disinkronkan secara terpisah dan diasumsikan ada di perangkat tujuan, paling jauh dengan versi yang lebih tinggi. Alat buatan pengguna ikut di dalam `profile.json`. Impor tidak pernah memasang atau meningkatkan versi alat katalog.
:::

<!--i:eti-badge-check-->
## Tujuan

- <!--i:box--> **Satu format, setiap shell.** Aplikasi web, aplikasi desktop dan seluler serta shell mendatang menggunakan skema pembungkus dan bagian yang sama. Bagian opsional bergantung pada kemampuan setiap shell, dan bagian yang tidak didukung dilaporkan. Setiap jembatan kapabilitas menyediakan adaptor penyimpanannya.
- <!--i:shieldcheck--> **Tahan selama pemindahan.** Bundel yang rusak atau terpotong saat dipindahkan gagal diimpor dengan pesan kesalahan dan tidak pernah dipulihkan setengah jalan.
- <!--i:clock--> **Tetap berguna setelah versi ini.** Aplikasi lama mengimpor bagian bundel yang lebih baru yang dikenalinya. Format yang memutus kompatibilitas ditolak dengan baik.
- <!--i:check--> **Aman digabung.** Impor ke instalasi yang sudah digunakan tidak pernah menghapus apa pun yang tidak ada dalam bundel.

<!--i:eti-package-->
## Pembungkus

Bundel adalah `.zip` biasa. Bundel tetap utuh melalui cara pemindahan apa pun, dan alat unzip apa pun dapat memeriksa isinya.

Unduhan diberi nama sesuai pemiliknya: `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip`, misalnya `LollyTools-Ada-Lovelace-2026-06-26-1.zip`. Nama depan dan belakang berasal dari profil dan tidak disertakan bila belum diisi: tanpa profil menghasilkan `LollyTools-2026-06-26-1.zip`, dan hanya nama depan menghasilkan `LollyTools-Ada-2026-06-26-1.zip`. Setiap nama menjadi token yang aman untuk nama file (huruf dan digit Unicode dipertahankan, spasi dan tanda baca dihapus, paling banyak 32 karakter). `<n>` adalah urutan per hari dan per perangkat, sehingga ekspor berulang dalam satu hari tidak berbenturan dan tetap berurutan. `backupFilename()` dalam `data-transfer.ts` membentuk nama. Nama tidak mengubah isi zip.

| Path | Wajib | Isi |
|---|---|---|
| `manifest.json` | ya | Id format, versi, jumlah dan integritas per bagian. Pembaca membaca file ini terlebih dahulu. |
| `profile.json` | bila diatur | Catatan `me` pengguna: nama, kontak, referensi foto wajah dan flag, ditambah folder, Trash, cetak biru proyek, templat pengguna dan alat buatan pengguna, favorit, alat tersembunyi, bahasa dan pilihan emoji. Dibaca melalui `host.profile`. |
| `sessions.json` | ya | Setiap sesi tersimpan: slot, id dan versi alat, label, thumbnail (URL data) dan data input lengkap. Dibaca melalui `host.state`. |
| `assets.json` | ya | Metadata untuk setiap aset yang diunggah (gambar, font, token merek, logo, salinan unduhan tersimpan), masing-masing menunjuk ke byte-nya di bawah `assets/blobs/`. |
| `assets/blobs/<n>.<ext>` | per aset | Byte mentah aset, disimpan tanpa kompresi karena sebagian besar sudah berformat terkompresi. Ekstensi hanya untuk tampilan; jenis MIME dalam `assets.json` menjadi acuan resmi. |
| `assets/blobs/<n>.c2pa` | bila ada | Content Credentials yang diekstrak sebagai byte biner persis, dirujuk oleh `_credentialFile` dalam catatan aset. Ini bukan kunci penandatanganan perangkat. |
| `design-systems.json` | bila ada | Design system yang dibuat atau ditambahkan pada instalasi ini, sebagai `{ active, records }`. Lihat [Aturan impor](#import-rules). |
| `file-history.json` | opsional | Snapshot aset berversi, laporan operasi file yang selesai dan manifes batch lengkap, dengan versi tersendiri. Disediakan oleh adaptor cadangan `fileHistory` internal shell. |
| `revision-history.json` | opsional, cadangan manual | ID karya yang stabil, checkpoint yang dipertahankan, thumbnail dan draf pemulihan bergulir. Disediakan oleh `host.state.history.backup` bila didukung. |
| `file-history/versions/` | per snapshot | Byte aset sebelumnya dan kredensial yang diekstrak, baik aset saat ini masih ada maupun tidak. |
| `file-history/results/` | per operasi selesai | Byte keluaran persis. Tidak ada file asli yang dipilih untuk konversi yang disimpan atau disertakan. |
| `prefs.json` | ya | Preferensi lokal milik pengguna: `theme`, `sidebarWidth` dan hitungan aktivitas `ct-metrics`. |
| `lolly.txt` | ya | Ringkasan bundel yang dapat dibaca (jumlah, profil, nama file) untuk siapa pun yang membuka zip tanpa Lolly. Dibuat ulang pada setiap ekspor dan dikenali saat impor, sehingga tidak pernah dihitung sebagai bagian yang dilewati. Ditulis setelah peta integritas, sehingga peta tidak mencakup file ini. |

::: details Cara ekspor menulis zip
Ekspor menulis zip satu bagian setiap kali (`shells/web/src/lib/zip-stream.ts`). Unggahan, hasil tersimpan dan versi aset tersimpan dibaca dalam potongan 4 MiB, tidak pernah sekaligus utuh. Hasil dan versi tersimpan terlebih dahulu diperiksa terhadap SHA-256 yang dicatat. Setiap file lalu dibaca untuk checksum dan digest integritasnya, dan zip merujuk file di tempatnya.

Tidak ada yang dikodekan ulang. Setiap bagian mempertahankan byte persis dan digest-nya, sehingga file yang membawa Content Credentials mempertahankan byte yang dicakup tanda tangannya. Untuk bagian dan waktu yang sama, zip identik dengan keluaran penulis dalam memori sebelumnya, kecuali file riwayat di atas 16 MiB dikompresi dalam potongan. `tests/backup-streaming.test.ts` memeriksanya terhadap digest referensi yang dicatat.

Pada pustaka sintetis 192 MiB, diukur dalam Node, penyelesaian cadangan memerlukan sekitar 125 hingga 150 MiB di luar pustaka, dibandingkan sekitar 850 MiB untuk penulis dalam memori (`node scripts/bench-backup-finalise.ts`). Impor masih membaca seluruh zip ke memori.
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

| Field | Arti |
|---|---|
| `format` | Selalu `lolly-backup`. File tanpanya ditolak sebagai "bukan cadangan Lolly". |
| `formatVersion` | Tata letak yang digunakan untuk **menulis** bundel ini. Dinaikkan setiap kali kumpulan atau bentuk bagian berubah. Pembaca **tidak** menggunakan field ini sebagai syarat penerimaan. |
| `minReader` | Versi pembaca minimum yang dapat mengimpor bundel ini **dengan aman**. Inilah field yang digunakan pembaca sebagai syarat penerimaan. |
| `app` | Id aplikasi pembuat, untuk diagnostik. |
| `exportedAt` | Stempel waktu ISO saat bundel dibuat. |
| `counts` | Yang dimasukkan penulis, untuk tampilan dan pemeriksaan kewajaran. |
| `integrity` | Opsional. Memetakan setiap bagian kecuali `manifest.json` ke digest `sha256-<base64>` bergaya SRI dari byte **tanpa kompresi**-nya. |

<!--i:eti-tag-->
## Kebijakan versi

Dua nomor versi memungkinkan format berkembang tanpa meninggalkan instalasi lama.

![Perubahan format bundel bersifat aditif, yang dapat diabaikan pembaca lama, atau memutus kompatibilitas, ketika impor yang salah menyebabkan kerusakan. Perubahan aditif menaikkan formatVersion dan mempertahankan minReader; perubahan yang memutus kompatibilitas menaikkan formatVersion dan minReader. Pembaca mengimpor ketika minReader tidak melebihi versinya sendiri.](/info/diagrams/concepts/backup-version-gate.svg)

- Pembaca mengimpor bundel ketika `manifest.minReader` tidak melebihi versi pembacanya sendiri. Pembaca menolak, dengan "memerlukan versi aplikasi yang lebih baru", hanya ketika bundel memerlukan pembaca yang lebih baru.
- Perubahan **aditif**, seperti bagian opsional baru atau field manifes opsional baru, menaikkan `formatVersion` dan membiarkan `minReader` tetap. Aplikasi lama masih mengimpor setiap bagian yang dikenalinya, dan bagian yang tidak dikenali dilaporkan sebagai dilewati, bukan dibuang diam-diam.
- Perubahan **yang memutus kompatibilitas**, ketika impor bagian yang salah merusak data atau bagian opsional menjadi wajib, menaikkan `minReader`. Aplikasi lama lalu menolak dengan baik alih-alih mengimpor sesuatu yang tidak dapat ditanganinya. Aplikasi lama lalu menolak bundel dengan baik.
- Jika bundel mendatang menetapkan `formatVersion` tetapi tidak menyertakan `minReader`, pembaca kembali menggunakan `formatVersion` sebagai syarat penerimaan dan memperlakukan perubahan sebagai pemutus kompatibilitas.

::: note Pedoman praktis untuk penulis
Jika setiap pembaca yang ada tetap berfungsi dengan benar saat mengabaikan tambahan Anda, perubahan bersifat aditif: naikkan `formatVersion` dan biarkan `minReader` tetap. Jika tidak, naikkan `minReader`.
:::

<!--i:eti-shield-check-->
## Integritas

Bila `manifest.integrity` ada, pembaca memeriksa SHA-256 setiap bagian yang tercantum **sebelum menulis apa pun**. Ketidakcocokan ("gagal dalam pemeriksaan integritas") atau bagian yang hilang ("tidak lengkap") menghentikan impor, sehingga tidak ada pemulihan sebagian. Ini mendeteksi kerusakan saat pemindahan: AirDrop yang terpotong, gateway email yang mengodekan ulang lampiran, sektor USB yang rusak.

Integritas diupayakan semaksimal mungkin. Integritas hanya ditulis bila Web Crypto tersedia (setiap konteks browser aman dan Node modern), dan hanya diperiksa bila peta serta Web Crypto sama-sama ada. Bundel tanpa peta, seperti bundel dari masa sebelum integritas tersedia, diimpor tanpa perubahan: "tidak dapat memverifikasi" tidak pernah dianggap "rusak".

Manifes tidak mencantumkan dirinya sendiri maupun `lolly.txt` yang dibuat ulang.

<!--i:eti-download-->
## Aturan impor

Impor berjalan dalam salah satu dari dua mode.

- **Merge** adalah yang dilakukan **Import data…** dan penggabungan pertama ke sinkronisasi, **Bring it to this device**. Data di perangkat tujuan tetap ada, dan tidak ada yang disentuh di luar bundel.
- **Replace** digunakan sinkronisasi perangkat untuk menjaga perangkat tetap selaras. Mode ini mengambil catatan profil, preferensi, sesi, gambar dan pilihan design system aktif dari salinan tersinkron. Mode ini hanya menghapus item yang dihapus perangkat lain sejak sinkronisasi terakhir. Pemulihan salinan sebelumnya terlebih dahulu menyimpan perangkat, lalu menyamakan perangkat dengan salinan itu dan menghapus semua yang tidak dimuat salinan. [Sinkronkan perangkat Anda](/info/sync.html) membahas apa yang dilihat pengguna.

Penggabungan memperlakukan setiap jenis data seperti ini:

| Data | Sudah ada di perangkat tujuan | Hanya dalam bundel |
|---|---|---|
| Sesi (berdasarkan slot) dan gambar yang diunggah (berdasarkan id) | Salinan yang disimpan lebih baru dipertahankan, sehingga cadangan lama tidak pernah menimpa pekerjaan yang lebih baru. Waktu yang sama atau tidak diketahui mempertahankan salinan perangkat tujuan. | Ditambahkan |
| Folder | Nama dan induk di perangkat tujuan dipertahankan, dan folder mendapat anggota dari bundel yang belum dimilikinya. Sesi yang disimpan dalam folder di perangkat tujuan tetap berada di sana. | Ditambahkan |
| Favorit (alat, aset katalog dan item Projects) | Digabung | Ditambahkan |
| Templat, templat Projects dan alat pengguna (berdasarkan id) | Catatan perangkat tujuan dipertahankan. | Ditambahkan |
| Entri Trash | Entri perangkat tujuan dipertahankan. | Ditambahkan, sehingga item yang dapat dipulihkan pada salah satu instalasi tetap dapat dipulihkan. Entri yang foldernya kembali digunakan di perangkat tujuan, atau yang slot Trash-nya sudah digunakan perangkat tujuan, tidak disertakan. |
| Field profil lain (nama, detail kontak, bahasa, flag fitur, alat tersembunyi dan pengaturan lainnya) | Nilai perangkat tujuan dipertahankan. | Diambil bila field perangkat tujuan kosong |
| Preferensi (`prefs.json`) | Nilai perangkat tujuan dipertahankan. | Ditulis bila perangkat tujuan belum memilikinya |
| Design system (berdasarkan id) | Catatan bundel menggantikan catatan perangkat tujuan. | Ditambahkan. Pilihan aktif bundel berlaku hanya bila perangkat tujuan tidak memiliki design system sendiri. |
| Riwayat karya | Salinan yang disimpan lebih baru tetap menjadi versi saat ini, dan salinan lain disimpan sebagai draf terlindungi. | Ditambahkan |

**Sesi tersimpan ditautkan kembali ke gambarnya secara otomatis.** Referensi aset dipertahankan berdasarkan id. Jembatan menyelesaikan kembali referensi setelah gambar dipulihkan, karena URL `blob:` tidak bertahan setelah pemuatan ulang.

**Catatan riwayat tidak pernah berubah setelah ditulis.** Impor ulang versi aset dan ID operasi tidak menambahkan apa pun, dan ID yang sudah merujuk byte atau riwayat berbeda ditolak, bukan ditimpa. Mengimpor ulang aset saat ini yang identik mempertahankan versinya, dan aset saat ini yang berubah harus membawa versi berbeda.

**Riwayat karya memiliki beberapa aturan tambahan.** Karya yang slotnya digunakan perangkat tujuan untuk karya lain ditambahkan sebagai karya terpisah, dan karya dalam Trash perangkat tujuan tetap di sana. Id checkpoint yang merujuk konten berbeda di perangkat tujuan mempertahankan checkpoint perangkat tujuan. Arsip yang gagal dalam pemeriksaannya sendiri menghentikan impor sebelum perubahan profil, sesi, aset atau preferensi, dan impor ulang yang identik tidak menambah penggunaan penyimpanan.

**Ringkasan melaporkan apa yang terjadi.** Setiap impor mengembalikan `profile`, `sessions`, `userAssets`, `prefs`, `skipped` dan `failedAssets`.

- `failedAssets` menghitung aset unggahan yang tidak dapat dipulihkan, misalnya karena penyimpanan perangkat penuh.
- `skipped` menghitung bagian dari penulis yang lebih baru yang tidak dikenali build ini. Aplikasi menampilkan jumlahnya ("… · N item lebih baru dilewati").
- Dengan riwayat file, ringkasan menambahkan `assetVersions`, `fileOperations`, `fileBatches` dan `failedHistory`. Penyimpanan yang habis atau konflik ID yang tidak dapat diubah dapat menyebabkan pemulihan sebagian, dan aplikasi lalu memberi tahu pengguna agar menyimpan cadangan sumber.
- Dengan riwayat karya, ringkasan menambahkan `revisions` dan `recoveryDrafts`, hanya menghitung yang ditambahkan impor ini, serta `added`, `kept`, `replaced`, `copies` dan `hidden` untuk cara setiap karya digabung. `skippedCheckpoints` menghitung checkpoint yang id-nya merujuk konten berbeda di perangkat tujuan, dan `historyLeftOut` menghitung checkpoint serta draf lama yang tidak muat dalam ruang riwayat perangkat.
- Impor penggantian menambahkan `removed` dan `failedRemovals`.

Pemulihan bukan satu transaksi yang mencakup penyimpanan profil, sesi, aset dan riwayat. Sinkronisasi cloud **tidak** memajukan revisi yang diterapkannya setelah pemulihan sebagian atau yang tidak didukung, sehingga salinannya tetap tersedia untuk dicoba kembali.

<!--i:eti-unlink-->
## Yang tidak ikut dipindahkan

- **Cache katalog** (metadata dan blob aset yang diunduh, indeks alat), yang disinkronkan ulang oleh perangkat tujuan.
- **Alat katalog dan aset katalog**, yang diasumsikan sudah ada di perangkat tujuan. Token merek, font dan logo yang ditambahkan pengguna adalah aset pengguna dan ikut dipindahkan.
- **URL `blob:` dan objek**, yang dibuat ulang oleh bridge saat dimuat.
- **File asli konversi, sewa eksekusi aktif dan rahasia akses atau penandatanganan yang lokal di mesin.** Semua ini bukan riwayat portabel. Hasil tersimpan adalah salinan. Itu tidak berarti sumber aslinya telah dicadangkan.
- **Penghitung urutan ekspor**, penghitung harian untuk penamaan unduhan di `localStorage` (`lolly-export-seq`). Penghitung ini tidak dimasukkan ke `PREF_KEYS`, sehingga tidak pernah ikut dalam bundel.

Indikator penyimpanan menunjukkan pembagian yang sama. Saved sessions, My images dan File results & versions masuk ke bundel. Cache aset, pratinjau alat dan item yang disematkan untuk penggunaan offline dapat dibuat ulang dan tidak ikut dipindahkan.

![Indikator penyimpanan yang membagi data perangkat ini ke dalam kategori bernama, dengan Saved sessions dan My images dicatat terpisah dari Asset cache, di sini pada instalasi baru dengan setiap kategori masih kosong](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&dark=1&filename=ce-storage-categories)

<!--i:eti-building-->
## Data organisasi dengan Lolly Work

Bundel ini mencadangkan pustaka pribadi perangkat. Bundel bukan cadangan instans **Lolly Work**. Akun organisasi, kebijakan akses, proyek bersama, versi katalog, persetujuan, tugas render dan catatan audit disimpan oleh layanan tersebut. Sambungkan kembali dan masuk untuk mendapatkan kembali akses ke pekerjaan bersama. Mengimpor bundel pribadi tidak memberikan akses tersebut.

Operator mencadangkan, menyimpan dan menghapus data server dengan panduan Lolly Work sendiri: [Pencadangan dan pemulihan](/info/work-operations.html#backup-and-restore) dan [Penyimpanan dan siklus hidup data Lolly Work](/info/work-data-lifecycle.html). Mengosongkan atau mengekspor perangkat tidak menjalankan satu pun operasi server tersebut.

<!--i:eti-monitor-->
## Lintas shell

`data-transfer.ts` membaca dan menulis hanya melalui bridge kapabilitas (`host.profile`, `host.state`, `host.assets`) dan preferensi `localStorage` bersama. Modul yang sama membaca dan menulis format pembungkus bersama di web serta di aplikasi desktop dan seluler, melalui IndexedDB atau penyimpanan sistem file. Bagian riwayat opsional hanya muncul jika adapternya tersedia. Impor melaporkan bagian yang tidak didukung sebagai dilewati. Rangkaian pengujian headless menguji bagian bersama dengan bridge dalam memori, dan transaksi riwayat juga memiliki pengujian di browser nyata.

Dua shell berada di luar jaminan tersebut:

- **CLI sekali jalan** tidak memiliki apa pun untuk dibawa: statusnya berada di memori dan hanya bertahan selama satu pemanggilan.
- **TUI** menyimpan status di `~/.lolly` (sesi, folder, profil). Tampilan Profile-nya menulis arsip cadangan sendiri yang lebih sederhana: `saved-state/<slot>.json` per sesi ditambah `profile.json` dan `folders.json`, tanpa manifes, tanpa `formatVersion` atau `minReader` dan tanpa peta integritas. Pembaca format ini menolak arsip tersebut sebagai "bukan cadangan Lolly", meskipun namanya mirip (`lolly-backup-<stamp>.zip`). Penyatuan keduanya adalah kekurangan yang sudah diketahui.

<!--i:eti-clock-->
## Belum portabel

Jenis data portabel baru dapat ditambahkan nanti sebagai bagian tambahan (`formatVersion` baru, `minReader` yang sama). Design system sudah ikut dipindahkan dengan cara ini, sebagai `design-systems.json` beserta aset penggunanya.

Dua nama dicadangkan untuk data yang belum ikut dipindahkan:

- **`tokens.json`** akan membawa dokumen token desain [W3C DTCG](https://tr.designtokens.org/format/) beserta grup, set dan temanya, format yang [diimpor dan diekspor Penpot](https://help.penpot.app/user-guide/design-systems/design-tokens/). Token merek milik pengguna sudah ikut dipindahkan sebagai aset `user/tokens/brand` di `assets.json`, dan token design system ikut bersama rekamannya.
- **`penpot/`** dicadangkan untuk file Penpot yang telah dimasukkan, atau subsetnya yang relevan bagi Lolly, yang ditampilkan sebagai alat.

<!--i:eti-history-->
## Bagian riwayat

Kedua bagian riwayat bersifat opsional dan memiliki versinya sendiri.

::: details Riwayat pembuatan (v3)
Cadangan manual dari instalasi web dengan riwayat pembuatan menyertakan `revision-history.json`, dengan skema `{ version: 1, documents, revisions, recoveries }` sendiri. Bagian ini membawa ID yang dipertahankan, snapshot input kanonis, penanda versi, pratinjau raster dan draf penulis terpisah. Adapter riwayat mengambil sesi saat ini beserta revisi terkininya dalam satu transaksi baca, dan `sessions.json` menggunakan snapshot terkini yang sama untuk pembaca lama.

Pemulihan memeriksa SHA-256 payload dan jumlah byte, keunikan identitas, hubungan dokumen dengan revisi terkini, silsilah revisi, stempel waktu, jenis pratinjau dan batas sebelum menyimpan arsip dalam satu transaksi. Referensi induk yang telah dipadatkan mungkin tidak ada. Pekerjaan saat ini yang sudah ada tidak pernah diganti diam-diam: ketika sebuah karya ada di kedua sisi, sisi yang tidak dipertahankan sebagai versi saat ini menjadi draf yang dilindungi.

Arsip memiliki batas transfer 384 MiB. Batas penyimpanan diberlakukan tanpa memangkas checkpoint yang dipertahankan. Ekspor menulis `revision-history.json` dan `sessions.json` dalam potongan, dengan byte yang sama seperti hasil satu `JSON.stringify`, sehingga teks file tidak pernah ditampung secara utuh. File riwayat yang akan melampaui batas langsung dikeluarkan saat batas terlewati dan setelah itu hanya dihitung ukurannya. Arsip lalu dibuat ulang tanpa checkpoint otomatis tertuanya, dan ringkasan ekspor menghitungnya sebagai `checkpointsLeftOut`, atau arsip ditolak.

Shell tanpa kapabilitas ini memulihkan sesi biasa dan melaporkan bagian riwayat sebagai dilewati. Riwayat pada sistem file native tetap tidak didukung sampai adapternya menyediakan transaksi riwayat yang persisten. Tamu dalam kolaborasi privat tidak memiliki riwayat persisten atau arsip pemulihan.

Sinkronisasi snapshot pribadi tidak menyertakan riwayat pembuatan. Menerapkan snapshot ke dokumen lokal yang memiliki riwayat mempertahankan status kerja sebelumnya sebagai draf pemulihan terpisah dan membatalkan token tulis editor mana pun yang terbuka. Checkpoint-nya yang tidak dapat diubah tetap berada di perangkat. Ini melindungi riwayat lokal saat penggantian snapshot. Ini tidak menggabungkan riwayat perangkat yang berlangsung bersamaan.

Referensi aset historis dipertahankan, sementara render tetap mengakses aset melalui pustaka yang sudah ada di tujuan. Arsip ini belum menjamin byte aset lama atau hasil render alat lama yang persis sama. Byte versi aset dan hasil file ikut dipindahkan dalam bagian cadangannya sendiri.
:::

::: details Versi tersimpan dan hasil file (v2)
Bagian riwayat opsional memuat `{ version: 2, assetVersions: [...], operations: [...], batches: [...] }`, dan pembaca juga menerima bentuk history-v1 sebelumnya tanpa batch. Setiap snapshot memberikan ID aset yang stabil dan versi persisnya, waktu penyimpanan, panjang byte dan SHA-256 heksadesimalnya, ditambah rekaman aset dengan `_file` dan `_credentialFile` opsional yang menunjuk ke bagian biner. Operasi membawa fakta file asli, permintaan, laporan, stempel waktu dan `_file` hasil opsional. Nama backend penyimpanan, handle OPFS dan sewa eksekusi tidak ikut dipindahkan. Pembaca yang hanya mengenal history v1 menolak versi riwayat baru sebelum mengimpor, sehingga keanggotaan batch tidak pernah dihapus diam-diam.

Manifes batch mencatat setiap sumber yang dipilih sebelum pemrosesan, termasuk file yang tidak pernah dibaca, anggota yang dibatalkan, kegagalan mencadangkan ruang hasil dan pekerjaan yang terhenti. Setiap anggota memiliki ID operasi yang stabil, referensi dan fakta sumber, nama keluaran yang diminta dan laporan akhir. Sumber yang belum dibaca memiliki fakta yang dinyatakan, bukan digest yang direkayasa. Impor memvalidasi identitas anggota dan konsistensinya dengan laporan operasi yang ikut dibawa. Laporan Lolly Batch tetap tersedia saat hasil individual telah dihapus, tetapi tanda terima tidak berarti byte keluarannya masih disimpan.

- **Validasi lebih dulu.** Setiap rekaman riwayat, laporan dan file yang dirujuk yang dikenali divalidasi sebelum impor profil atau aset menulis apa pun. Byte yang hilang dan SHA-256 yang tidak cocok menyebabkan kegagalan meskipun pembungkus tidak memiliki peta integritas. Kredensial yang diekstrak tetap berupa array byte, termasuk impor dari penulis lama yang menserialisasikannya sebagai objek dengan kunci numerik.
- **Pekerjaan yang berjalan.** Operasi yang berjalan menjadi rekaman terhenti dalam cadangan, dengan laporan kegagalan dan tanpa hasil. Pemulihan tidak pernah memulai ulang pekerjaan latar belakang atau mengimpor sewa aktif. Mencoba kembali berarti memilih file asli lagi, yang diperiksa terhadap SHA-256 tercatatnya jika tersedia.
- **Penyimpanan.** Hasil yang dipulihkan menyimpan byte dan metadatanya bersama-sama di IndexedDB. Hasil baru biasa menggunakan OPFS jika tersedia, dengan IndexedDB sebagai cadangan. Operasi aktif yang sudah ada tidak pernah diganti oleh impor.
- **Batas cadangan.** Ekspor mengalirkan byte ini ke arsip, tetapi pemulihan masih mengekstrak seluruh cadangan dalam memori, sehingga batasnya tetap: **256 MiB payload riwayat**, **4 MiB metadata riwayat**, paling banyak **100 operasi**, **100 batch** dan **2.000 snapshot**. Ekspor menolak riwayat yang terlalu besar atau tidak lengkap secara eksplisit dan tidak pernah menghilangkannya diam-diam. Unduh versi dan hasil penting satu per satu sebelum menghapus salinan lokal yang lebih lama. Batas ini bukan jaminan penggunaan memori puncak yang telah diukur untuk ponsel.
- **Alokasi lokal.** Riwayat hasil lokal memiliki alokasi 512 MiB dan batas 100 rekaman. Snapshot aset memiliki alokasi terpisah sebesar 512 MiB dan paling banyak 20 versi historis per aset, dan byte kredensial yang diekstrak ikut dihitung dalam alokasi tersebut. Pemulihan mematuhi batas ini dan tidak pernah menghapus data pengguna yang sudah ada diam-diam.
- **Metadata batch.** Metadata batch lokal memiliki alokasi terpisah sebesar 4 MiB, paling banyak 100 manifes dan 20 anggota per batch. Anggota yang tertunda mencadangkan kapasitas metadata, dengan batas laporan 32 KiB per anggota. Ini adalah alokasi logis, bukan jaminan ruang disk browser: kegagalan kuota nyata ditampilkan, dan laporan dalam memori tetap dapat diunduh. Mencoba kembali anggota batch membuat batch baru tanpa menimpa laporan lama. Menghapus rekaman batch tidak menghapus byte hasil individual atau aset pustaka.
- **Hasil di pustaka.** Hasil konversi dapat ditambahkan ke pustaka tanpa normalisasi atau pengodean ulang, dengan hash sumber dan keluaran serta hubungan operasinya dilampirkan. Penambahan berulang menggunakan kembali salinan yang tidak berubah, dan salinan yang telah disunting tidak pernah ditimpa. Gambar raster dapat memulai dokumen Lolly Design baru, yang menggunakan ID aset pustaka saat ini. Penerapan penguncian versi secara tepat di seluruh runtime dan jalur URL Lolly Design adalah pekerjaan terpisah. Hasil SVG, HTML, PDF dan ZIP disimpan sebagai aset file opak, bukan dinaikkan menjadi konten interaktif atau vektor tepercaya.
- **Tempat pengguna melihatnya.** **Convert → Recent file operations** menampilkan penggunaan riwayat, laporan, unduhan dan pengelola versi, yang juga menemukan versi terdahulu dari aset pustaka yang dihapus. Memulihkan snapshot membuat versi saat ini yang baru dan mempertahankan snapshot yang dipilih. **Settings → Preferences → Storage** menghitung hasil dan versi secara terpisah dari cache yang dapat dibuang.
- **Pembersihan.** Pembersihan file sementara secara eksplisit hanya menghapus byte milik operasi yang tidak dirujuk. Rekaman saat ini melindungi filenya, dan file OPFS terbaru memiliki masa tenggang satu jam. Hasil tersimpan dan snapshot aset tidak dihapus otomatis.

Pembaca lama tetap menerima pembungkus v2 (`minReader: 1`) dan memulihkan bagian yang mereka kenali, dengan menghitung bagian riwayat yang tidak didukung sebagai dilewati. Pemulihan riwayat penuh memerlukan shell dengan adapter `fileHistory`, titik integrasi di dalam shell, bukan kapabilitas `HostV1` yang diakses alat. Pemulihan nyata pada dua perangkat dicakup oleh pemeriksaan penerimaan Chromium lokal. Pemulihan pada aplikasi desktop, iOS dan Android yang terinstal masih perlu melalui uji penerimaan terpisah.
:::

<!--i:eti-code-->
## Referensi

- Modul: `shells/web/src/data-transfer.ts` (`exportBackup`, `importBackup`, `BACKUP_FORMAT`, `BACKUP_FORMAT_VERSION`, `BACKUP_READER_VERSION`; fungsi penamaan `backupFilename()` bersifat internal).
- Pengujian kontrak: `tests/data-transfer.test.ts`, mencakup ekspor-impor ulang, penggabungan, integritas, kompatibilitas ke depan dan pemeriksaan versi pembaca.
- Pengujian kontrak riwayat: `tests/file-history-backup.test.ts`, `tests/file-batch-history.test.ts` dan `tests/file-result-library.test.ts`. Uji penerimaan browser: `tests/file-history.browser.test.ts`, `tests/file-batch-history.browser.test.ts` dan `tests/file-result-reuse.browser.test.ts`.
- Antarmuka bridge yang digunakan: `host.profile`, `host.state` dan `host.assets`; lihat [Host API](/info/host-api.html).
