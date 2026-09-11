# Transfer Data - bundel `lolly-backup`

Semua yang terkumpul dari pengguna Lolly berada **di perangkatnya** - tanpa akun, tanpa cloud. Bundel transfer data adalah cara nilai itu berpindah: ekspor di satu instalasi, bawa file dengan cara apa pun (USB, AirDrop, email ke diri sendiri, berbagi jaringan) dan impor di instalasi lain. File itu *adalah* transportnya. Target bisa offline atau online. Tidak ada bedanya, karena tidak ada yang pernah berbicara dengan server.

![Dua tombol yang memindahkan seluruh instalasi: Export my data menulis satu zip, Import data membacanya kembali](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.storage-subsection&dark=1&filename=pd-transfer-controls)

Halaman ini adalah spesifikasi formatnya. Untuk panduan langkah demi langkah bagi pengguna akhir lihat [Using Lolly → Moving to another device](/info/using.html). Implementasinya ada di [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts), dan [`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) mengunci kontrak bolak-balik (round-trip).

> **Cakupan.** Sebuah bundel membawa *data pengguna*, bukan tool. Tool dan aset katalog disinkronkan secara terpisah dan diasumsikan sudah ada di target (dalam kasus terburuk pada versi yang lebih tinggi). Mengimpor tidak pernah menginstal atau meningkatkan tool.

## Tujuan

- <!--i:box--> **Satu format, setiap shell.** Byte yang sama dihasilkan dan dikonsumsi oleh PWA web, aplikasi desktop/mobile Tauri dan shell mana pun di masa depan. Bundel adalah kontraknya. Bridge kemampuan setiap shell adalah adapter khusus platform di baliknya.
- <!--i:shieldcheck--> **Selamat dalam perjalanan.** Bundel yang rusak atau terpotong saat transit gagal secara jelas saat diimpor, tidak pernah memulihkan sebagian.
- <!--i:clock--> **Bertahan melampaui versi ini.** Aplikasi yang lebih lama tetap bisa mengimpor bagian yang dikenalinya dari bundel yang lebih baru. Format yang benar-benar tidak kompatibel ditolak secara bersih.
- <!--i:check--> **Aman untuk digabung.** Mengimpor ke instalasi yang sudah dipakai tidak pernah menghapus apa pun yang tidak ada dalam bundel.

## Amplop

Sebuah bundel adalah `.zip` biasa. Unduhan diberi nama sesuai orang yang memilikinya - `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` (misalnya `LollyTools-Ada-Lovelace-2026-06-26-1.zip`) - sehingga folder Downloads berisi cadangan tetap mudah dibaca. Bagian nama depan dan belakang berasal dari profil dan dihilangkan jika tidak diatur. Tanpa profil menghasilkan `LollyTools-2026-06-26-1.zip`, dan hanya nama depan menghasilkan `LollyTools-Ada-2026-06-26-1.zip`. Setiap bagian dibersihkan menjadi token yang aman untuk nama berkas (huruf/angka Unicode dipertahankan, spasi/tanda baca dihapus, dibatasi hingga 32 karakter). `<n>` adalah urutan per hari, per perangkat, sehingga ekspor berulang di hari yang sama tidak bertabrakan dan tetap berurutan. `backupFilename()` di [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts) membuat nama tersebut. Isi zip identik terlepas dari namanya. Di dalamnya:

| Path | Wajib | Isi |
|---|---|---|
| `manifest.json` | ya | Id format, versi, jumlah dan integritas per bagian. Hal pertama yang dilihat pembaca. |
| `profile.json` | jika diatur | Rekaman `me` milik pengguna (nama, kontak, ref headshot, flag). Dibaca lewat `host.profile`. |
| `sessions.json` | ya | Setiap sesi tersimpan: slot, id/versi tool, label, thumbnail (data-URL) dan data input lengkap. Dibaca lewat `host.state`. |
| `assets.json` | ya | Metadata untuk setiap aset yang diunggah (gambar, font, token brand), masing-masing menunjuk ke byte-nya di bawah `assets/blobs/`. |
| `assets/blobs/<n>.<ext>` | per aset | Byte aset mentah (file gambar dan font). Disimpan tanpa kompresi (format yang sudah terkompresi). Ekstensinya bersifat kosmetik. MIME di `assets.json` adalah yang otoritatif. |
| `prefs.json` | ya | Preferensi lokal milik pengguna: `theme`, `sidebarWidth` dan tally aktivitas `ct-metrics`. |
| `lolly.txt` | ya | Ringkasan bundel yang dapat dibaca manusia (jumlah, profil, nama file) bagi siapa pun yang membuka zip tanpa Lolly. Dibuat ulang setiap ekspor dan dikenali saat impor, jadi tidak pernah dihitung sebagai bagian yang dilewati. Ditulis *setelah* peta integritas, jadi tetap berada di luar peta itu. |

Bundel sengaja berupa zip biasa: ia bertahan utuh di transport mana pun, dan alat unzip apa pun bisa memeriksanya.

`profile.json` adalah bagian terkecil dan yang pertama kali dilihat pembaca di aplikasi: detail yang diisi sekali oleh pembuat, plus opsi ikut serta yang memungkinkan tool memakainya.

![Formulir detail Profile yang menjadi profile.json - nama, kontak, headshot dan opsi ikut serta di sampingnya](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1800&format=svg&cropSelector=.profile-details-grid&walker=1&dark=1&filename=ce-profile-record)

## `manifest.json`

```json
{
  "format": "lolly-backup",
  "formatVersion": 1,
  "minReader": 1,
  "app": "lolly",
  "exportedAt": "2026-06-22T09:30:00.000Z",
  "counts": { "profile": true, "sessions": 2, "userAssets": 4, "prefs": 3 },
  "integrity": {
    "profile.json": "sha256-…",
    "sessions.json": "sha256-…",
    "assets.json": "sha256-…",
    "assets/blobs/0.webp": "sha256-…",
    "prefs.json": "sha256-…"
  }
}
```

| Bidang | Makna |
|---|---|
| `format` | Selalu `lolly-backup`. File tanpa ini ditolak sebagai "bukan backup Lolly". |
| `formatVersion` | Tata letak tempat bundel ini **ditulis**. Dinaikkan pada perubahan apa pun terhadap kumpulan atau bentuk bagian. Pembaca **tidak** menjadikan ini gerbang. |
| `minReader` | Versi pembaca minimum yang diperlukan untuk mengimpor bundel ini **dengan aman**. Ini adalah bidang yang dijadikan gerbang oleh pembaca. |
| `app` | Id aplikasi pembuat, untuk diagnostik. |
| `exportedAt` | Timestamp ISO saat bundel dibuat. |
| `counts` | Apa yang dimasukkan penulis, untuk tampilan dan pemeriksaan kewarasan. |
| `integrity` | Opsional. Memetakan setiap bagian kecuali `manifest.json` ke digest bergaya SRI `sha256-<base64>` dari byte **tanpa kompresinya**. |

## Kebijakan versi (kompatibilitas maju)

Pemisahan antara `formatVersion` dan `minReader` adalah yang memungkinkan format ini berkembang tanpa meninggalkan instalasi yang lebih lama:

- Pembaca mengimpor bundel ketika `manifest.minReader ≤` versi pembacanya sendiri. Ia menolak (dengan "membutuhkan versi aplikasi yang lebih baru") hanya ketika bundel secara eksplisit menuntut pembaca yang lebih baru.
- Perubahan yang **aditif** - bagian *opsional* baru, atau bidang manifes opsional baru - menaikkan `formatVersion` tetapi membiarkan `minReader` tidak berubah. Aplikasi lama tetap mengimpor setiap bagian yang dikenalinya. Bagian yang tidak dikenali dilewati (lihat di bawah), bukan dibuang diam-diam.
- Perubahan yang **merusak** - satu di mana impor bagian yang salah merusak data, atau di mana bagian yang tadinya opsional menjadi wajib - menaikkan `minReader`. Aplikasi lama kemudian menolak secara bersih alih-alih mengimpor sesuatu yang tidak bisa ditanganinya.
- Jika bundel di masa depan mengatur `formatVersion` tetapi menghilangkan `minReader`, pembaca secara konservatif kembali menjadikan `formatVersion` sebagai gerbang (memperlakukan perubahan sebagai merusak).

> **Aturan praktis untuk penulis:** jika setiap pembaca yang ada akan tetap berperilaku benar dengan mengabaikan penambahan Anda, itu aditif - naikkan `formatVersion`, biarkan `minReader`. Jika tidak, naikkan `minReader`.

## Integritas

Ketika `manifest.integrity` ada, pembaca memverifikasi SHA-256 setiap bagian yang tercantum **sebelum menulis apa pun**. Ketidakcocokan ("gagal pemeriksaan integritasnya") atau bagian yang hilang ("tidak lengkap") membatalkan seluruh impor - tidak ada pemulihan sebagian. Ini menangkap korupsi yang bisa ditimbulkan oleh transport file (AirDrop yang terpotong, gateway email yang meng-encode ulang lampiran, sektor USB yang buruk).

Integritas sengaja dirancang sebagai upaya terbaik: hanya ditulis ketika Web Crypto tersedia (setiap konteks peramban aman dan Node modern), dan hanya diverifikasi ketika baik peta maupun Web Crypto tersedia. Bundel tanpa peta - misalnya dari sebelum integritas ada - diimpor tanpa perubahan. "Tidak bisa diverifikasi" tidak pernah diperlakukan sebagai "rusak".

Manifes tidak mencantumkan dirinya sendiri maupun README `lolly.txt` yang dibuat ulang. Digest mencakup bagian-bagian yang dijamin oleh manifes.

## Semantik impor

Impor bersifat **gabung-timpa** (merge-overwrite), tidak pernah ganti-semua:

- Data yang ada di target dibiarkan apa adanya.
- Kunci mana pun yang bertabrakan - profil, slot sesi, id gambar yang diunggah - digantikan oleh salinan yang diimpor.
- Apa pun yang tidak ada dalam bundel tidak disentuh. Sesi yang dimiliki target tetapi tidak ada di bundel tetap bertahan setelah impor.

Sesi tersimpan menautkan ulang ke gambarnya secara otomatis: referensi aset dipertahankan berdasarkan id, dan bridge menyelesaikannya ulang setelah gambar yang diunggah dipulihkan (memang harus begitu, karena URL `blob:` tidak bertahan setelah reload).

Ringkasan impor melaporkan `{ profile, sessions, userAssets, prefs, skipped, failedAssets }`. `failedAssets` menghitung aset yang diunggah yang gagal dipulihkan (misalnya penyimpanan perangkat penuh). Ini berbeda dari `skipped`, yang menghitung bagian dari penulis yang lebih baru dan kompatibel-maju yang tidak dikenali oleh build ini. UI menampilkan `skipped` ("… · N item lebih baru dilewati"), sehingga pemulihan jujur soal apa yang ditinggalkannya.

## Apa yang tidak ikut berpindah

- **Cache katalog** (metadata dan blob aset yang diunduh, indeks tool) - disinkronkan ulang secara gratis di target.
- **Tool dan aset brand** - di luar cakupan, dan diasumsikan sudah ada di target.
- **URL `blob:` / object** - dibuat ulang oleh bridge saat dimuat.
- **Penghitung urutan ekspor** - penghitung penamaan unduhan per hari (kunci `localStorage` `lolly-export-seq`) adalah kemudahan penamaan lokal. Ini disengaja tetap di luar `PREF_KEYS`, jadi tidak pernah ikut dalam bundel.

Meteran penyimpanan merinci pemisahan yang sama. Sesi tersimpan dan My images ikut dalam bundel. Cache aset, pratinjau tool dan pin offline di bawahnya semuanya dapat diturunkan ulang, jadi tetap tinggal.

![Meteran penyimpanan memecah data perangkat ini ke dalam kategori bernama, dengan Saved sessions dan My images dilacak terpisah dari Asset cache, di sini pada instalasi baru di mana setiap kategori masih kosong](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=.store-manages%2C.storage-subsection%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&walker=1&dark=1&filename=ce-storage-categories)

## Jaminan lintas shell

`data-transfer.ts` membaca dan menulis secara eksklusif melalui capability bridge (`host.profile`, `host.state`, `host.assets`) dan preferensi `localStorage` bersama. Karena bridge adalah satu-satunya titik sambung, modul yang *sama* menghasilkan bundel yang identik byte-per-byte di setiap shell meskipun penyimpanan di baliknya berbeda - IndexedDB di web, sistem berkas di Tauri. Shell Tauri menggunakan kembali modul ini tanpa perubahan. Hanya implementasi `host.state` mereka yang berbeda. Uji headless menjalankan round-trip penuh terhadap bridge in-memory, itulah sebabnya uji ini mewakili semuanya.

Dua shell berada di luar jaminan itu, karena alasan yang berbeda:

- **CLI one-shot** tidak memiliki apa pun untuk dibawa - statusnya in-memory dan bersifat sementara per pemanggilan.
- **TUI** memang menyimpan status (`~/.lolly`: sesi, folder, profil) dan tampilan Profile-nya bisa mencadangkannya, tetapi ia menulis arsip yang *lebih sederhana* miliknya sendiri: `sessions/<slot>.json` per sesi ditambah `profile.json` dan `folders.json`, tanpa manifes, tanpa `formatVersion`/`minReader`, dan tanpa peta integritas. Arsip ini **tidak** bisa diimpor oleh format ini - pembaca akan menolaknya sebagai "bukan cadangan Lolly" - dan membingungkan karena menggunakan nama yang mirip (`lolly-backup-<stamp>.zip`). Menyatukan keduanya adalah kesenjangan yang sudah diketahui.

## Titik ekstensi yang dicadangkan

Amplop ini sengaja dirancang sebagai manifes plus sekumpulan bagian bernama, sehingga jenis data portabel baru bisa menumpang di kemudian hari **tanpa perubahan yang merusak**. Bagian-bagian ini masuk sebagai bagian aditif (`formatVersion` baru, `minReader` yang sama), dan pembaca saat ini melewati apa pun yang tidak dikenalinya. Ini ada di [roadmap](/info/overview.html#roadmap), belum diimplementasikan. Nama-namanya dicadangkan di sini agar format tetap koheren saat bagian tersebut hadir.

- **`tokens.json` - token desain.** Sebuah dokumen token desain [W3C DTCG](https://tr.designtokens.org/format/) (format yang [diimpor dan diekspor Penpot](https://help.penpot.app/user-guide/design-systems/design-tokens/) - token dengan `$value`/`$type`/`$description`, diorganisasikan ke dalam grup, set dan tema). Sekumpulan token dalam bundel memungkinkan pengguna memindahkan primitif brand mereka antar instalasi bersama sesi mereka. Dalam jangka panjang, sekumpulan token yang telah diserap menjadi sumber kelas satu yang dijadikan rujukan oleh tool dan aset palet.
- **`penpot/` - berkas Penpot yang diserap.** Direktori yang dicadangkan untuk berkas Penpot (atau subset yang relevan dengan Lolly yang diekstrak darinya) yang diimpor dan ditampilkan *sebagai tool*. Bundel akan membawa definisi yang diserap, sehingga ikut berpindah bersama data pengguna lainnya.

Apa pun di luar nama yang dicadangkan dan bagian-bagian di atas, bagi pembaca, adalah bagian yang tidak dikenal: dibiarkan tanpa diubah dan dihitung dalam `skipped`.

## Referensi

- Modul: [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts) (`exportBackup`, `importBackup`, `BACKUP_FORMAT`, `BACKUP_FORMAT_VERSION`, `BACKUP_READER_VERSION` - pemberi nama `backupFilename()` bersifat internal).
- Uji kontrak: [`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) - kasus round-trip, penggabungan, integritas, kompatibilitas maju dan gerbang pembaca.
- Permukaan bridge yang digunakan: `host.profile`, `host.state`, `host.assets` - lihat [Host API](/info/host-api.html).
