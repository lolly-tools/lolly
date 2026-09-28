# Transfer Data - bundel `lolly-backup`

Semua yang terkumpul dari pengguna Lolly berada **di perangkatnya** - tanpa akun, tanpa cloud. Bundel transfer data adalah cara nilai itu berpindah: ekspor di satu instalasi, bawa file dengan cara apa pun (USB, AirDrop, email ke diri sendiri, berbagi jaringan) dan impor di instalasi lain. File itu *adalah* transportnya. Target bisa offline atau online. Tidak ada bedanya, karena tidak ada yang pernah berbicara dengan server.

![The two buttons that move a whole install: Export my data writes one zip, Import data reads it back](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=%23storage-section%20.storage-subsection&dark=1&filename=pd-transfer-controls)

Halaman ini adalah spesifikasi formatnya. Untuk panduan langkah demi langkah bagi pengguna akhir lihat [Temukan dan pulihkan karya Anda → Pindahkan karya Anda ke perangkat lain](/info/find-your-work.html#move-your-work-to-another-device). Implementasinya ada di [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts), dan [`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) mengunci kontrak bolak-balik (round-trip).

> **Cakupan.** Sebuah bundel membawa *data pengguna*, bukan tool katalog. Tool katalog dan aset katalog disinkronkan secara terpisah dan diasumsikan sudah ada di target (dalam kasus terburuk pada versi yang lebih tinggi); tool yang dibuat sendiri oleh pengguna berpindah di dalam `profile.json`. Mengimpor tidak pernah menginstal atau meningkatkan tool katalog.

## Tujuan

- <!--i:box--> **Satu format, setiap shell.** PWA web, aplikasi desktop/mobile Tauri dan shell mana pun di masa depan berbagi amplop dan skema bagian yang didukung yang sama. Bagian opsional bergantung pada kemampuan tiap shell; bagian yang tidak didukung dilaporkan. Setiap capability bridge menyediakan adapter penyimpanannya sendiri.
- <!--i:shieldcheck--> **Selamat dalam perjalanan.** Bundel yang rusak atau terpotong saat transit gagal secara jelas saat diimpor, tidak pernah memulihkan sebagian.
- <!--i:clock--> **Bertahan melampaui versi ini.** Aplikasi yang lebih lama tetap bisa mengimpor bagian yang dikenalinya dari bundel yang lebih baru. Format yang benar-benar tidak kompatibel ditolak secara bersih.
- <!--i:check--> **Aman untuk digabung.** Mengimpor ke instalasi yang sudah dipakai tidak pernah menghapus apa pun yang tidak ada dalam bundel.

## Amplop

Sebuah bundel adalah `.zip` biasa. Unduhan diberi nama sesuai orang yang memilikinya - `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` (misalnya `LollyTools-Ada-Lovelace-2026-06-26-1.zip`) - sehingga folder Downloads berisi cadangan tetap mudah dibaca. Bagian nama depan dan belakang berasal dari profil dan dihilangkan jika tidak diatur. Tanpa profil menghasilkan `LollyTools-2026-06-26-1.zip`, dan hanya nama depan menghasilkan `LollyTools-Ada-2026-06-26-1.zip`. Setiap bagian dibersihkan menjadi token yang aman untuk nama berkas (huruf/angka Unicode dipertahankan, spasi/tanda baca dihapus, dibatasi hingga 32 karakter). `<n>` adalah urutan per hari, per perangkat, sehingga ekspor berulang di hari yang sama tidak bertabrakan dan tetap berurutan. `backupFilename()` di [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts) membuat nama tersebut. Isi zip identik terlepas dari namanya. Di dalamnya:

| Path | Wajib | Isi |
|---|---|---|
| `manifest.json` | ya | Id format, versi, jumlah dan integritas per bagian. Hal pertama yang dilihat pembaca. |
| `profile.json` | jika diatur | Rekaman `me` lengkap milik pengguna: nama, kontak, ref headshot dan flag, plus folder, Trash, blueprint proyek, template pengguna dan tool buatan pengguna, favorit, tool tersembunyi, pilihan bahasa dan emoji. Dibaca lewat `host.profile`. |
| `sessions.json` | ya | Setiap sesi tersimpan: slot, id/versi tool, label, thumbnail (data-URL) dan data input lengkap. Dibaca lewat `host.state`. |
| `assets.json` | ya | Metadata untuk setiap aset yang diunggah (gambar, font, token brand, logo, salinan tersimpan dari unduhan), masing-masing menunjuk ke byte-nya di bawah `assets/blobs/`. |
| `assets/blobs/<n>.<ext>` | per aset | Byte aset mentah (file gambar dan font). Disimpan tanpa kompresi (format yang sudah terkompresi). Ekstensinya bersifat kosmetik. MIME di `assets.json` adalah yang otoritatif. |
| `assets/blobs/<n>.c2pa` | jika ada | Content Credentials yang diekstrak sebagai byte biner persis, dirujuk oleh `_credentialFile` dalam rekaman aset. Ini bukan kunci penandatanganan perangkat. |
| `design-systems.json` | jika ada | Design system yang dibuat atau ditambahkan pada instalasi ini, sebagai `{ active, records }`. Digabung berdasarkan id saat impor; pilihan aktif bundel berlaku hanya ketika target belum memiliki design system sendiri. |
| `file-history.json` | opsional | Snapshot aset berversi, laporan operasi file terminal dan manifest batch lengkap. Bagian history memiliki versinya sendiri; disediakan oleh adapter backup `fileHistory` internal milik shell. |
| `revision-history.json` | opsional, backup manual | ID creation yang stabil, checkpoint yang dipertahankan, thumbnail dan draf recovery yang berputar. Disediakan oleh `host.state.history.backup` jika didukung. |
| `file-history/versions/` | per snapshot | Byte aset sebelumnya dan credential yang diekstrak, tidak bergantung pada apakah aset saat ini masih ada. |
| `file-history/results/` | per operasi selesai | Byte output persis. Tidak ada file asli yang dipilih-untuk-konversi yang dipertahankan atau disertakan. |
| `prefs.json` | ya | Preferensi lokal milik pengguna: `theme`, `sidebarWidth` dan tally aktivitas `ct-metrics`. |
| `lolly.txt` | ya | Ringkasan bundel yang dapat dibaca manusia (jumlah, profil, nama file) bagi siapa pun yang membuka zip tanpa Lolly. Dibuat ulang setiap ekspor dan dikenali saat impor, jadi tidak pernah dihitung sebagai bagian yang dilewati. Ditulis *setelah* peta integritas, jadi tetap berada di luar peta itu. |

Bundel sengaja berupa zip biasa: ia bertahan utuh di transport mana pun, dan alat unzip apa pun bisa memeriksanya.

`profile.json` adalah bagian terkecil dan yang pertama kali dilihat pembaca di aplikasi: detail yang diisi sekali oleh pembuat, plus opsi ikut serta yang memungkinkan tool memakainya.

![Formulir detail Profil yang menjadi profile.json: nama, detail kontak dan headshot](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddetails-section&width=1440&height=1100&dpi=192&waitMs=1800&format=svg&cropSelector=.profile-details-grid&walker=1&dark=1&filename=ce-profile-record)

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

Impor adalah sebuah **penggabungan**, tidak pernah ganti-semua:

- Data yang ada di target dibiarkan apa adanya.
- Ketika slot sesi atau id gambar yang diunggah ada di keduanya, salinan yang disimpan lebih baru dipertahankan, sehingga backup yang lebih lama tidak pernah menimpa karya yang lebih baru di target. Waktu yang sama atau tidak diketahui mempertahankan salinan target. Pada instalasi web dengan riwayat kreasi, aturan yang sama menentukan salinan kreasi mana yang tetap menjadi versi saat ini, dan salinan lainnya dipertahankan sebagai draf terlindungi (lihat di bawah).
- Rekaman profil digabungkan, bukan diganti. Setiap folder di target tetap dengan isinya; folder dari bundel yang tidak dimiliki target ditambahkan, dan folder yang ada di keduanya mempertahankan nama dan induk milik target serta mendapatkan anggota bundel yang belum dimilikinya. Sesi yang disimpan dalam folder di target tetap tersimpan di sana.
- Favorit (tool, aset katalog dan item Projects) digabungkan. Template, template Projects dan tool pengguna dari bundel ditambahkan ketika target tidak memiliki rekaman dengan id tersebut. Entri Trash dari keduanya dipertahankan, sehingga item yang bisa dipulihkan di salah satu instalasi tetap bisa dipulihkan.
- Setiap field profil lainnya (nama, detail kontak, bahasa, feature flag, tool tersembunyi dan pengaturan lainnya) mempertahankan nilai target. Field yang kosong di target mengambil nilai bundel. Hal yang sama berlaku untuk `prefs.json`: sebuah preferensi hanya ditulis di tempat target belum memilikinya.
- Penerapan biasa device sync adalah pengecualiannya: untuk menjaga perangkat tetap selaras, ia mengambil rekaman profil, preferensi, sesi dan gambar dari salinan yang disinkronkan. Memulihkan salinan sebelumnya melakukan hal yang sama, karena memang sengaja kembali ke waktu sebelumnya. Penggabungan pertama, **Bring it to this device**, bergabung seperti sebuah impor.
- Versi aset historis dan ID operasi adalah pengecualian yang tidak dapat diubah: impor berulang bersifat idempoten, dan sebuah ID yang sudah menamai byte/riwayat berbeda ditolak, bukan ditimpa. Mengimpor ulang aset saat ini yang identik mempertahankan versinya. Aset saat ini yang berubah harus membawa versi yang berbeda.
- Riwayat kreasi juga digabungkan. Sebuah kreasi di kedua sisi mempertahankan salinan yang disimpan lebih baru sebagai versi saat ini dan salinan lainnya sebagai draf terlindungi; sebuah kreasi yang slotnya dipakai target untuk kreasi lain ditambahkan di sampingnya; sebuah kreasi di Trash milik target tetap di sana. Sebuah id checkpoint yang menamai konten berbeda di target mempertahankan milik target. Sebuah arsip yang gagal pemeriksaannya sendiri menghentikan impor sebelum ada perubahan profil, sesi, aset atau preferensi apa pun. Impor berulang yang identik tidak menambah penyimpanan.
- Apa pun yang tidak ada dalam bundel tidak disentuh. Sesi yang dimiliki target tetapi tidak ada di bundel tetap bertahan setelah impor.

Sesi tersimpan menautkan ulang ke gambarnya secara otomatis: referensi aset dipertahankan berdasarkan id, dan bridge menyelesaikannya ulang setelah gambar yang diunggah dipulihkan (memang harus begitu, karena URL `blob:` tidak bertahan setelah reload).

Ringkasan impor melaporkan `{ profile, sessions, userAssets, prefs, skipped, failedAssets }`. `failedAssets` menghitung aset yang diunggah yang gagal dipulihkan (misalnya penyimpanan perangkat penuh). Ini berbeda dari `skipped`, yang menghitung bagian dari penulis yang lebih baru dan kompatibel-maju yang tidak dikenali oleh build ini. UI menampilkan `skipped` ("… · N item lebih baru dilewati"), sehingga pemulihan jujur soal apa yang ditinggalkannya.

Ketika file history ada, ringkasan juga membawa `assetVersions`, `fileOperations` dan `failedHistory`. Penyimpanan yang habis atau konflik ID yang tidak dapat diubah dapat menyebabkan pemulihan sebagian; UI memberi tahu pengguna untuk mempertahankan backup sumbernya. Cloud sync **tidak** memajukan revision yang diterapkannya setelah pemulihan sebagian atau yang tidak didukung, sehingga snapshot tetap tersedia untuk dicoba lagi. Restore bukan satu transaksi tunggal di seluruh penyimpanan profil/sesi/aset/history.

## Riwayat creation (v3)

Backup manual dari sebuah web host yang mendukung history menyertakan `revision-history.json` dengan skema `{ version: 1, documents, revisions, recoveries }` miliknya sendiri. Ia membawa ID yang dipertahankan, snapshot input kanonis, stempel versi, pratinjau raster dan draf writer terpisah. Adapter history menangkap sesi saat ini dan head-nya dalam satu transaksi baca; `sessions.json` menggunakan snapshot saat ini yang sama untuk pembaca yang lebih lama.

Restore memeriksa SHA-256 payload dan jumlah byte, identitas unik, relasi document/head, ancestry, timestamp, tipe pratinjau dan batas sebelum melakukan commit arsip dalam satu transaksi. Referensi parent yang telah dipadatkan mungkin tidak ada. Karya saat ini yang ada tidak pernah diganti secara diam-diam: ketika sebuah kreasi ada di kedua sisi, sisi yang tidak dipertahankan sebagai versi saat ini menjadi draf terlindungi. Batas transfer 384 MiB milik arsip diperiksa secara eksplisit, dan batas penyimpanan ditegakkan tanpa memotong checkpoint yang dipertahankan. Backup keseluruhan masih menggunakan implementasi ZIP in-memory dan bukan arsip streaming.

Ringkasan menambahkan `revisions` dan `recoveryDrafts`, hanya menghitung apa yang ditambahkan impor ini, serta `added`, `kept`, `replaced`, `copies` dan `hidden` untuk cara setiap kreasi digabungkan. Sebuah shell tanpa kemampuan ini memulihkan sesi biasa dan melaporkan bagian history sebagai dilewati. History filesystem native tetap tidak didukung sampai adapter-nya menyediakan transaksi history yang durable. State guest P2P tidak memiliki history atau arsip recovery yang durable.

Sync snapshot personal secara eksplisit mengecualikan riwayat creation. Menerapkan sebuah snapshot pada dokumen lokal yang memiliki history mempertahankan state kerja sebelumnya sebagai sebuah draf recovery terpisah dan membatalkan write token editor mana pun yang sedang terbuka. Checkpoint yang tidak dapat diubah tetap ada di perangkat. Ini melindungi history lokal selama penggantian snapshot; ini tidak menggabungkan history perangkat yang konkuren.

Referensi aset historis dipertahankan, sementara rendering tetap menyelesaikan aset lewat pustaka yang sudah ada di destinasi. Arsip ini belum menjamin byte aset lama atau render tool lama yang persis. Byte asset-version dan file-result tetap berpindah lewat bagian backup terpisah yang sudah ada.

## Versi tersimpan dan hasil file (v2)

Bagian history opsional berisi `{ version: 2, assetVersions: [...], operations: [...], batches: [...] }`; pembaca juga menerima bentuk history-v1 yang lebih lama tanpa batches. Setiap snapshot mengidentifikasi ID aset yang stabil dan versi persisnya, waktu penyimpanannya, panjang byte dan SHA-256 hex, plus sebuah rekaman aset yang `_file` dan `_credentialFile` opsionalnya menunjuk ke bagian biner. Operasi membawa fakta file asli, request, laporan, timestamp dan `_file` hasil opsional; nama storage backend, handle OPFS dan execution lease tidak ikut berpindah. Pembaca history-v1-only yang lebih lama menolak versi history baru sebelum mengimpor, alih-alih diam-diam membuang keanggotaan batch.

Manifest batch mencatat setiap sumber yang dipilih sebelum diproses, termasuk file yang tidak pernah dibaca, anggota yang dibatalkan, kegagalan mereservasi ruang hasil dan pekerjaan yang terputus. Setiap anggota memiliki ID operasi yang stabil, referensi/fakta sumber, nama output yang diminta dan laporan terminal. Sebuah sumber yang tidak dibaca memiliki fakta yang dideklarasikan, bukan digest rekaan. Impor memvalidasi identitas anggota dan konsistensi dengan laporan operasi yang dibawa mana pun. Laporan batch tetap tersedia ketika hasil individual telah dihapus secara eksplisit, tetapi sebuah receipt tidak berarti byte outputnya masih tersimpan.

- Setiap rekaman history, laporan dan file yang dirujuk yang diketahui divalidasi sebelum penulisan impor profil atau aset apa pun. Byte yang hilang dan SHA-256 yang tidak cocok gagal bahkan jika amplop tidak memiliki peta integritas. Credential yang diekstrak tetap berupa array byte, termasuk impor dari penulis lama yang men-JSON-serialize-nya sebagai objek numeric-key.
- Operasi yang sedang berjalan menjadi rekaman terputus di dalam backup, dengan laporan kegagalan yang menjelaskan dan tanpa hasil. Restore tidak pernah memulai ulang pekerjaan background atau mengimpor sebuah execution lease yang aktif. Mencoba lagi memerlukan pemilihan file asli, diperiksa terhadap SHA-256 tercatatnya jika tersedia.
- Hasil yang dipulihkan meng-commit byte dan metadata-nya bersamaan di IndexedDB. Hasil baru yang biasa menggunakan OPFS jika tersedia, dengan fallback IndexedDB. Sebuah operasi live yang sudah ada tidak pernah digantikan oleh sebuah impor.
- Penyusunan ZIP history masih di memori: batas saat ini adalah **256 MiB payload history**, **4 MiB metadata history**, paling banyak **100 operasi**, **100 batch** dan **2.000 snapshot**. Ekspor menolak history yang terlalu besar atau tidak lengkap secara eksplisit; ekspor tidak pernah diam-diam menghilangkannya. Unduh versi/hasil penting satu per satu sebelum menghapus salinan lokal yang lebih lama. Batas ini bukan jaminan peak-memory yang terukur untuk ponsel.
- History hasil lokal memiliki budget 512 MiB dan batas 100 rekaman. Snapshot aset memiliki budget 512 MiB terpisah dan paling banyak 20 versi historis per aset; byte credential yang diekstrak dihitung ke dalam budget snapshot itu. Restore menghormati batas ini dan tidak pernah diam-diam mengeluarkan data pengguna yang sudah ada.
- Metadata batch lokal memiliki budget 4 MiB terpisah, paling banyak 100 manifest dan 20 anggota per batch. Anggota yang pending mereservasi kapasitas metadata, dengan plafon laporan 32 KiB per anggota. Ini adalah budget logis, bukan jaminan ruang disk browser; kegagalan quota yang sungguhan ditampilkan dan laporan in-memory tetap dapat diunduh. Mencoba ulang sebuah anggota batch membuat batch baru tanpa menimpa laporan lama. Menghapus sebuah rekaman batch tidak menghapus byte hasil individual atau aset pustaka.
- Hasil yang dikonversi dapat ditambahkan secara eksplisit ke pustaka tanpa normalisasi atau re-encoding. Hash sumber/output dan relasi operasi menyertai aset itu. Penambahan berulang menggunakan ulang salinan yang tidak berubah; sebuah salinan yang telah diedit tidak pernah ditimpa. Gambar raster dapat memulai sebuah dokumen Design baru. Dokumen itu menggunakan ID aset pustaka saat ini: menegakkan pin versi persis di seluruh runtime dan URL path Design masih pekerjaan terpisah. Hasil SVG/HTML/PDF/ZIP dipertahankan sebagai aset file opak oleh handoff ini, tidak dipromosikan menjadi konten interaktif/vektor yang tepercaya.
- **Convert → Recent file operations** menampilkan penggunaan history, laporan, unduhan dan version manager. Manager itu juga menemukan versi lebih lama dari aset pustaka yang telah dihapus. Memulihkan sebuah snapshot membuat sebuah versi saat ini yang baru sambil mempertahankan snapshot yang dipilih tetap utuh. **Pengaturan → Penyimpanan** menghitung hasil dan versi secara terpisah dari cache yang dapat dibuang.
- Pembersihan file sementara eksplisit hanya menghapus byte milik-operasi yang tidak dirujuk. Rekaman saat ini melindungi file-nya; file OPFS terbaru memiliki masa tenggang satu jam. Hasil tersimpan dan snapshot aset tidak dihapus secara otomatis.

Pembaca lama tetap menerima amplop v2 (`minReader: 1`) dan memulihkan bagian yang dikenal, menghitung bagian history yang tidak didukung sebagai dilewati. Pemulihan history penuh memerlukan sebuah shell dengan adapter `fileHistory`; ini adalah seam internal-shell, bukan kemampuan `HostV1` baru yang menghadap tool. Restore dua-perangkat yang sungguhan dicakup oleh gate Chromium lokal; penerimaan pemulihan Tauri/iOS/Android yang terinstal tetap terpisah.

## Apa yang tidak ikut berpindah

- **Cache katalog** (metadata dan blob aset yang diunduh, indeks tool) - disinkronkan ulang secara gratis di target.
- **Tool katalog dan aset katalog** - di luar cakupan, dan diasumsikan sudah ada di target. Token brand, font dan logo yang ditambahkan pengguna adalah aset pengguna, sehingga tetap ikut berpindah.
- **URL `blob:` / object** - dibuat ulang oleh bridge saat dimuat.
- **File asli konversi, execution lease live dan rahasia akses/signing lokal-mesin** - bukan payload history yang portabel. Sebuah hasil tersimpan adalah sebuah salinan, bukan sebuah janji bahwa sumber aslinya telah di-backup.
- **Penghitung urutan ekspor** - penghitung penamaan unduhan per hari (kunci `localStorage` `lolly-export-seq`) adalah kemudahan penamaan lokal. Ini disengaja tetap di luar `PREF_KEYS`, jadi tidak pernah ikut dalam bundel.

Meteran penyimpanan merinci pemisahan yang sama. Sesi tersimpan, My images dan File results & versions ikut dalam bundel. Cache aset, pratinjau tool dan pin offline di bawahnya semuanya dapat diturunkan ulang, jadi tetap tinggal.

![Meteran penyimpanan memecah data perangkat ini ke dalam kategori bernama, dengan Saved sessions dan My images dilacak terpisah dari Asset cache, di sini pada instalasi baru di mana setiap kategori masih kosong](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=.store-manages%2C.storage-subsection%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&walker=1&dark=1&filename=ce-storage-categories)

## Jaminan lintas shell

`data-transfer.ts` membaca dan menulis secara eksklusif lewat capability bridge (`host.profile`, `host.state`, `host.assets`) dan preferensi `localStorage` bersama. Modul yang sama membaca dan menulis amplop umum di web dan Tauri, lewat penyimpanan IndexedDB atau filesystem. Bagian history opsional muncul hanya di tempat adapter terkaitnya tersedia; sebuah bagian yang tidak didukung dilaporkan sebagai dilewati saat impor. Suite headless menjalankan bagian umum terhadap sebuah bridge in-memory, sementara transaksi history juga memiliki test real-browser.

Dua shell berada di luar jaminan itu, karena alasan yang berbeda:

- **CLI one-shot** tidak memiliki apa pun untuk dibawa - statusnya in-memory dan bersifat sementara per pemanggilan.
- **TUI** memang menyimpan status (`~/.lolly`: sesi, folder, profil) dan tampilan Profile-nya bisa mencadangkannya, tetapi ia menulis arsip yang *lebih sederhana* miliknya sendiri: `saved-state/<slot>.json` per sesi ditambah `profile.json` dan `folders.json`, tanpa manifes, tanpa `formatVersion`/`minReader`, dan tanpa peta integritas. Arsip ini **tidak** bisa diimpor oleh format ini - pembaca akan menolaknya sebagai "bukan cadangan Lolly" - dan membingungkan karena menggunakan nama yang mirip (`lolly-backup-<stamp>.zip`). Menyatukan keduanya adalah kesenjangan yang sudah diketahui.

## Titik ekstensi yang dicadangkan

Amplop ini sengaja dirancang sebagai manifes plus sekumpulan bagian bernama, sehingga jenis data portabel baru bisa menumpang di kemudian hari **tanpa perubahan yang merusak**. Bagian-bagian ini masuk sebagai bagian aditif (`formatVersion` baru, `minReader` yang sama), dan pembaca saat ini melewati apa pun yang tidak dikenalinya. Ini belum dibangun. Nama-namanya dicadangkan di sini agar format tetap koheren saat bagian tersebut hadir.

- **`tokens.json` - token desain.** Sebuah dokumen token desain [W3C DTCG](https://tr.designtokens.org/format/) (format yang [diimpor dan diekspor Penpot](https://help.penpot.app/user-guide/design-systems/design-tokens/) - token dengan `$value`/`$type`/`$description`, diorganisasikan ke dalam grup, set dan tema). Sekumpulan token dalam bundel memungkinkan pengguna memindahkan primitif brand mereka antar instalasi bersama sesi mereka. (Token brand milik pengguna sendiri sudah berpindah hari ini sebagai aset `user/tokens/brand` di `assets.json`; bagian ini akan membawa seluruh dokumen DTCG beserta set dan temanya.) Dalam jangka panjang, sekumpulan token yang telah diserap menjadi sumber kelas satu yang dijadikan rujukan oleh tool dan aset palet.
- **`penpot/` - berkas Penpot yang diserap.** Direktori yang dicadangkan untuk berkas Penpot (atau subset yang relevan dengan Lolly yang diekstrak darinya) yang diimpor dan ditampilkan *sebagai tool*. Bundel akan membawa definisi yang diserap, sehingga ikut berpindah bersama data pengguna lainnya.

Apa pun di luar nama yang dicadangkan dan bagian-bagian di atas, bagi pembaca, adalah bagian yang tidak dikenal: dibiarkan tanpa diubah dan dihitung dalam `skipped`.

## Referensi

- Modul: [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts) (`exportBackup`, `importBackup`, `BACKUP_FORMAT`, `BACKUP_FORMAT_VERSION`, `BACKUP_READER_VERSION` - pemberi nama `backupFilename()` bersifat internal).
- Uji kontrak: [`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) - kasus round-trip, penggabungan, integritas, kompatibilitas maju dan gerbang pembaca.
- Uji kontrak history: [`tests/file-history-backup.test.ts`](../tests/file-history-backup.test.ts), [`tests/file-batch-history.test.ts`](../tests/file-batch-history.test.ts) dan [`tests/file-result-library.test.ts`](../tests/file-result-library.test.ts). Penerimaan browser: [`tests/file-history.browser.test.ts`](../tests/file-history.browser.test.ts), [`tests/file-batch-history.browser.test.ts`](../tests/file-batch-history.browser.test.ts) dan [`tests/file-result-reuse.browser.test.ts`](../tests/file-result-reuse.browser.test.ts).
- Permukaan bridge yang digunakan: `host.profile`, `host.state`, `host.assets` - lihat [Host API](/info/host-api.html).
