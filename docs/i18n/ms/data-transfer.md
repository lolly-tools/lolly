# Pemindahan Data - bundel `lolly-backup`

Segala yang terkumpul oleh pengguna Lolly berada **pada peranti mereka** - tiada akaun, tiada awan. Bundel pemindahan data adalah cara nilai itu berpindah: eksportkannya pada satu pemasangan, bawa fail itu dengan apa cara sekalipun (USB, AirDrop, e-mel-kepada-diri-sendiri, perkongsian rangkaian) dan import pada yang lain. Fail itu *ialah* pengangkutan tersebut. Sasaran boleh berada dalam talian atau luar talian. Tiada bezanya, kerana tiada apa pun yang pernah berhubung dengan pelayan.

![Dua butang yang memindahkan keseluruhan pemasangan: Export my data menulis satu zip, Import data membacanya semula](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.storage-subsection&dark=1&filename=pd-transfer-controls)

Halaman ini adalah spesifikasi format. Untuk panduan pengguna akhir lihat [Using Lolly → Moving to another device](/info/using.html). Pelaksanaannya ialah [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts), dan [`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) mengunci kontrak pergi-balik itu.

> **Skop.** Bundel membawa *data pengguna*, bukan alat. Alat dan aset katalog disegerakkan secara berasingan dan diandaikan sudah wujud pada sasaran (paling teruk pada versi yang lebih tinggi). Import tidak sekali-kali memasang atau menaik taraf sesuatu alat.

## Matlamat

- <!--i:box--> **Satu format, setiap shell.** Bait yang sama dihasilkan dan digunakan oleh PWA web, aplikasi desktop/mudah alih Tauri dan mana-mana shell akan datang. Bundel itulah kontraknya. Jambatan keupayaan setiap shell adalah penyesuai per-platform di sebaliknya.
- <!--i:shieldcheck--> **Selamat sampai destinasi.** Bundel yang rosak atau terputus semasa penghantaran akan gagal secara nyata semasa import, tidak sekali-kali separuh dipulihkan.
- <!--i:clock--> **Bertahan melangkaui versi ini.** Aplikasi yang lebih lama masih boleh mengimport bahagian yang dikenali daripada bundel yang lebih baharu. Format yang benar-benar memutuskan keserasian ditolak dengan bersih.
- <!--i:check--> **Selamat untuk digabung.** Mengimport ke pemasangan yang sudah digunakan tidak sekali-kali memadam apa-apa yang tiada dalam bundel itu.

## Sampul

Bundel adalah `.zip` biasa. Muat turun itu dinamakan sempena orang yang memilikinya - `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` (contohnya `LollyTools-Ada-Lovelace-2026-06-26-1.zip`) - supaya folder Downloads penuh sandaran kekal mudah difahami. Bahagian nama pertama dan akhir datang daripada profil dan ditinggalkan apabila tidak ditetapkan. Tiada profil menghasilkan `LollyTools-2026-06-26-1.zip`, dan hanya nama pertama menghasilkan `LollyTools-Ada-2026-06-26-1.zip`. Setiap bahagian disanitasi kepada token selamat-nama-fail (huruf/angka Unicode dikekalkan, ruang/tanda baca dibuang, dihadkan pada 32 aksara). `<n>` adalah jujukan per-hari, per-peranti, jadi eksport berulang pada hari yang sama tidak berlanggar dan kekal tersusun. `backupFilename()` dalam [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts) membina nama itu. Kandungan zip itu sama tanpa mengira nama. Di dalamnya:

| Laluan | Diperlukan | Kandungan |
|---|---|---|
| `manifest.json` | ya | Id format, versi, kiraan dan integriti per-bahagian. Perkara pertama yang dilihat oleh pembaca. |
| `profile.json` | apabila ditetapkan | Rekod `me` pengguna (nama, hubungan, rujukan gambar kepala, bendera). Dibaca melalui `host.profile`. |
| `sessions.json` | ya | Setiap sesi tersimpan: slot, id/versi alat, label, lakaran kecil (data-URL) dan data input penuh. Dibaca melalui `host.state`. |
| `assets.json` | ya | Metadata bagi setiap aset yang dimuat naik (imej, fon, token jenama), setiap satu menunjuk kepada baitnya di bawah `assets/blobs/`. |
| `assets/blobs/<n>.<ext>` | setiap aset | Bait aset mentah (fail imej dan fon). Disimpan tanpa mampatan (format yang sudah dimampatkan). Sambungan itu bersifat kosmetik sahaja. MIME dalam `assets.json` yang muktamad. |
| `prefs.json` | ya | Keutamaan tempatan milik pengguna: `theme`, `sidebarWidth` dan kiraan aktiviti `ct-metrics`. |
| `lolly.txt` | ya | Ringkasan bundel yang boleh dibaca manusia (kiraan, profil, nama fail) untuk sesiapa yang membuka zip itu tanpa Lolly. Dijana semula pada setiap eksport dan dikenali semasa import, jadi ia tidak sekali-kali dikira sebagai bahagian yang dilangkau. Ia ditulis *selepas* peta integriti, jadi ia kekal di luar peta itu. |

Bundel itu sengaja dijadikan zip biasa: ia bertahan pada mana-mana pengangkutan tanpa rosak, dan mana-mana alat unzip boleh memeriksanya.

`profile.json` adalah bahagian terkecil dan yang pertama dilihat oleh pembaca dalam aplikasi: butiran yang diisi sekali oleh pengeluar, ditambah opt-in yang membenarkan alat menggunakannya.

![Borang butiran Profile yang menjadi profile.json - nama, hubungan, gambar kepala dan opt-in di sebelahnya](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1800&format=svg&cropSelector=.profile-details-grid&walker=1&dark=1&filename=ce-profile-record)

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

| Medan | Maksud |
|---|---|
| `format` | Sentiasa `lolly-backup`. Fail tanpanya ditolak sebagai "bukan sandaran Lolly". |
| `formatVersion` | Susun atur yang **ditulis** dengan bundel ini. Dinaikkan pada apa-apa perubahan set atau bentuk bahagian. Pembaca **tidak** menjadikannya syarat pengesahan. |
| `minReader` | Versi pembaca minimum yang diperlukan untuk mengimport bundel ini **dengan selamat**. Inilah medan yang dijadikan syarat oleh pembaca. |
| `app` | Id aplikasi yang menghasilkan, untuk diagnostik. |
| `exportedAt` | Cap masa ISO bila bundel itu dicipta. |
| `counts` | Apa yang dimasukkan oleh penulis, untuk paparan dan semakan kewarasan. |
| `integrity` | Pilihan. Memetakan setiap bahagian kecuali `manifest.json` kepada digest gaya-SRI `sha256-<base64>` bagi baitnya yang **tidak dimampatkan**. |

## Dasar versi (keserasian ke hadapan)

Pemisahan antara `formatVersion` dan `minReader` itulah yang membenarkan format ini berkembang tanpa mengabaikan pemasangan yang lebih lama:

- Pembaca mengimport bundel apabila `manifest.minReader ≤` versi pembacanya sendiri. Ia hanya menolak (dengan "needs a newer version of the app") apabila bundel itu secara eksplisit menuntut pembaca yang lebih baharu.
- Perubahan **tambahan** - bahagian *pilihan* yang baharu, atau medan manifes pilihan yang baharu - menaikkan `formatVersion` tetapi meninggalkan `minReader` tidak berubah. Aplikasi lama masih mengimport setiap bahagian yang dikenalinya. Bahagian yang tidak dikenalinya dilangkau (lihat di bawah), bukan digugurkan secara senyap.
- Perubahan **memutuskan keserasian** - satu di mana import yang salah bagi sesuatu bahagian merosakkan data, atau di mana bahagian yang dahulunya pilihan menjadi wajib - menaikkan `minReader`. Aplikasi lama kemudiannya menolak dengan bersih dan bukannya mengimport sesuatu yang tidak dapat ditanganinya.
- Jika bundel akan datang menetapkan `formatVersion` tetapi menggugurkan `minReader`, pembaca secara berhemat kembali menjadikan syarat pengesahan pada `formatVersion` (menganggap perubahan itu sebagai memutuskan keserasian).

> **Petua umum untuk pengarang:** jika setiap pembaca sedia ada masih akan bertindak dengan betul dengan mengabaikan tambahan anda, ia adalah tambahan - naikkan `formatVersion`, tinggalkan `minReader`. Jika tidak, naikkan `minReader`.

## Integriti

Apabila `manifest.integrity` hadir, pembaca mengesahkan SHA-256 setiap bahagian yang disenaraikan **sebelum menulis apa-apa**. Ketidakpadanan ("failed its integrity check") atau bahagian yang hilang ("incomplete") membatalkan keseluruhan import - tiada pemulihan separa. Ini menangkap kerosakan yang boleh diakibatkan oleh pengangkutan fail (AirDrop yang terputus, get laluan e-mel yang mengekod semula lampiran, sektor USB yang rosak).

Integriti direka secara usaha-terbaik: ia hanya ditulis di mana Web Crypto tersedia (setiap konteks pelayar selamat dan Node moden), dan hanya disahkan apabila kedua-dua peta dan Web Crypto hadir. Bundel tanpa peta itu - contohnya dari sebelum integriti wujud - diimport tanpa perubahan. "Tidak dapat disahkan" tidak sekali-kali dianggap sebagai "rosak".

Manifes itu tidak menyenaraikan dirinya sendiri mahupun README `lolly.txt` yang dijana semula. Digest itu meliputi bahagian yang dijamin oleh manifes.

## Semantik import

Import adalah **gabung-tulis-ganti**, tidak sekali-kali ganti-semua:

- Data sedia ada pada sasaran dibiarkan seperti sedia ada.
- Mana-mana kunci yang berlanggar - profil, slot sesi, id imej yang dimuat naik - digantikan dengan salinan yang diimport.
- Apa-apa yang tiada dalam bundel tidak disentuh. Sesi yang dimiliki oleh sasaran tetapi tiada dalam bundel akan terus wujud selepas import.

Sesi tersimpan menyambung semula kepada imejnya secara automatik: rujukan aset dikekalkan mengikut id, dan jambatan itu menyelesaikannya semula selepas imej yang dimuat naik dipulihkan (ia memang mesti berbuat demikian, kerana URL `blob:` tidak bertahan selepas muat semula halaman).

Ringkasan import melaporkan `{ profile, sessions, userAssets, prefs, skipped, failedAssets }`. `failedAssets` mengira aset yang dimuat naik yang tidak dapat dipulihkan (storan peranti penuh, contohnya). Ia berbeza daripada `skipped`, yang mengira bahagian daripada penulis lebih baharu serasi-hadapan yang tidak dikenali oleh binaan ini. UI memaparkan `skipped` ("… · N newer items skipped"), jadi pemulihan itu jujur tentang apa yang ditinggalkannya.

## Apa yang tidak berpindah

- **Cache katalog** (metadata dan blob aset yang dimuat turun, indeks alat) - disegerakkan semula secara percuma pada sasaran.
- **Alat dan aset jenama** - di luar skop, dan diandaikan sudah wujud pada sasaran.
- **URL `blob:` / objek** - dijana semula oleh jambatan semasa dimuatkan.
- **Pengira jujukan eksport** - pengira penamaan muat turun per-hari (kunci `localStorage` `lolly-export-seq`) adalah kemudahan penamaan tempatan. Ia dikekalkan di luar `PREF_KEYS`, jadi ia tidak sekali-kali dibawa dalam bundel.

Meter storan memerincikan pemisahan yang sama. Sesi tersimpan dan My images dibawa dalam bundel. Cache aset, pratonton alat dan sematan luar talian di bawahnya semuanya boleh diterbitkan semula, jadi ia kekal ditinggalkan.

![Meter storan memecahkan data peranti ini kepada kategori bernama, dengan Saved sessions dan My images dijejaki berasingan daripada Asset cache, di sini pada pemasangan baharu di mana setiap kategori masih kosong](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=.store-manages%2C.storage-subsection%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&walker=1&dark=1&filename=ce-storage-categories)

## Jaminan merentas shell

`data-transfer.ts` membaca dan menulis secara eksklusif melalui capability bridge (`host.profile`, `host.state`, `host.assets`) dan `localStorage` prefs yang dikongsi. Oleh kerana bridge itu satu-satunya seam, modul yang *sama* menghasilkan bundle yang serupa bait demi bait pada setiap shell walaupun storan di bawahnya berbeza - IndexedDB pada web, sistem fail pada Tauri. Shell Tauri menggunakan semula modul ini tanpa perubahan. Hanya pelaksanaan `host.state` mereka yang berbeza. Ujian headless menjalankan round-trip penuh terhadap bridge dalam-memori, itulah sebabnya ia mewakili kesemuanya.

Dua shell berada di luar jaminan itu, atas sebab yang berbeza:

- **CLI one-shot** tiada apa untuk dibawa - keadaannya dalam-memori dan sementara bagi setiap panggilan.
- **TUI** memang mengekalkan keadaan (`~/.lolly`: sesi, folder, profil) dan paparan Profil-nya boleh membuat sandaran, tetapi ia menulis arkib yang *lebih ringkas* miliknya sendiri: `sessions/<slot>.json` bagi setiap sesi ditambah `profile.json` dan `folders.json`, tanpa manifes, tanpa `formatVersion`/`minReader` dan tanpa peta integriti. Ia **tidak** boleh diimport oleh format ini - pembaca menolaknya sebagai "bukan sandaran Lolly" - dan mengelirukan kerana ia menggunakan nama yang serupa (`lolly-backup-<stamp>.zip`). Menyatukan kedua-duanya adalah jurang yang diketahui.

## Titik lanjutan terpelihara

Envelope itu direka sebagai manifes ditambah satu set bahagian bernama, supaya jenis data mudah alih yang baharu boleh menumpang kemudian **tanpa perubahan yang memecahkan (breaking change)**. Ia disisipkan sebagai bahagian tambahan (`formatVersion` baharu, `minReader` yang sama), dan pembaca hari ini melangkau apa yang tidak dikenalinya. Ini berada pada [roadmap](/info/overview.html#roadmap), belum lagi dilaksanakan. Nama-namanya diperuntukkan di sini supaya format kekal koheren apabila ia tiba kelak.

- **`tokens.json` - token reka bentuk.** Dokumen token reka bentuk [W3C DTCG](https://tr.designtokens.org/format/) (format yang [diimport dan dieksport oleh Penpot](https://help.penpot.app/user-guide/design-systems/design-tokens/) - token dengan `$value`/`$type`/`$description`, disusun ke dalam kumpulan, set dan tema). Satu set token dalam bundle membolehkan pengguna memindahkan primitif jenama mereka antara pemasangan bersama sesi mereka. Dalam jangka panjang, set token yang diingest menjadi sumber tulen yang menjadi rujukan resolusi oleh alat dan aset palet.
- **`penpot/` - fail Penpot yang diingest.** Direktori terpelihara untuk fail Penpot (atau subset yang diekstrak dan relevan kepada Lolly) yang diimport dan dipaparkan *sebagai alat*. Bundle akan membawa definisi yang diingest itu, supaya ia bergerak bersama data pengguna yang lain.

Apa-apa di luar nama terpelihara ini dan bahagian di atas adalah, bagi pembaca, bahagian yang tidak diketahui: dibiarkan tanpa disentuh dan dikira dalam `skipped`.

## Rujukan

- Modul: [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts) (`exportBackup`, `importBackup`, `BACKUP_FORMAT`, `BACKUP_FORMAT_VERSION`, `BACKUP_READER_VERSION` - penama `backupFilename()` bersifat dalaman).
- Ujian kontrak: [`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) - kes round-trip, gabungan, integriti, forward-compat dan reader-gate.
- Permukaan bridge yang digunakan: `host.profile`, `host.state`, `host.assets` - lihat [Host API](/info/host-api.html).
