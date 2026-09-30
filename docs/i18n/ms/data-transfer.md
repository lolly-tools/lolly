# Pemindahan Data - bundel `lolly-backup`

Segala yang terkumpul oleh pengguna Lolly berada **pada peranti mereka** - tiada akaun, tiada awan. Bundel pemindahan data adalah cara nilai itu berpindah: eksportkannya pada satu pemasangan, bawa fail itu dengan apa cara sekalipun (USB, AirDrop, e-mel-kepada-diri-sendiri, perkongsian rangkaian) dan import pada yang lain. Fail itu *ialah* pengangkutan tersebut. Sasaran boleh berada dalam talian atau luar talian. Tiada bezanya, kerana tiada apa pun yang pernah berhubung dengan pelayan.

![The two buttons that move a whole install: Export my data writes one zip, Import data reads it back](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-move%3Ediv%3Anth-of-type%282%29%2C.store-move%3Ep%3Alast-of-type%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dmove%5D%3Esummary&walker=1&format=svg&cropSelector=%5Bdata-store-group%3Dmove%5D&dark=1&filename=pd-transfer-controls)

Halaman ini adalah spesifikasi format. Untuk panduan pengguna akhir lihat [Cari dan pulihkan hasil kerja anda → Pindahkan kerja anda ke peranti lain](/info/find-your-work.html#move-your-work-to-another-device). Pelaksanaannya ialah [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts), dan [`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) mengunci kontrak pergi-balik itu.

> **Skop.** Bundel membawa *data pengguna*, bukan alat katalog. Alat katalog dan aset katalog disegerakkan secara berasingan dan diandaikan sudah wujud pada sasaran (paling teruk pada versi yang lebih tinggi); alat yang dibuat sendiri oleh pengguna berpindah di dalam `profile.json`. Import tidak sekali-kali memasang atau menaik taraf sesuatu alat katalog.

## Matlamat

- <!--i:box--> **Satu format, setiap shell.** PWA web, aplikasi desktop/mudah alih Tauri dan mana-mana shell akan datang berkongsi sampul dan skema bahagian yang disokong yang sama. Bahagian pilihan bergantung pada keupayaan setiap shell; bahagian yang tidak disokong dilaporkan. Setiap jambatan keupayaan membekalkan penyesuai storannya sendiri.
- <!--i:shieldcheck--> **Selamat sampai destinasi.** Bundel yang rosak atau terputus semasa penghantaran akan gagal secara nyata semasa import, tidak sekali-kali separuh dipulihkan.
- <!--i:clock--> **Bertahan melangkaui versi ini.** Aplikasi yang lebih lama masih boleh mengimport bahagian yang dikenali daripada bundel yang lebih baharu. Format yang benar-benar memutuskan keserasian ditolak dengan bersih.
- <!--i:check--> **Selamat untuk digabung.** Mengimport ke pemasangan yang sudah digunakan tidak sekali-kali memadam apa-apa yang tiada dalam bundel itu.

## Sampul

Bundel adalah `.zip` biasa. Muat turun itu dinamakan sempena orang yang memilikinya - `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` (contohnya `LollyTools-Ada-Lovelace-2026-06-26-1.zip`) - supaya folder Downloads penuh sandaran kekal mudah difahami. Bahagian nama pertama dan akhir datang daripada profil dan ditinggalkan apabila tidak ditetapkan. Tiada profil menghasilkan `LollyTools-2026-06-26-1.zip`, dan hanya nama pertama menghasilkan `LollyTools-Ada-2026-06-26-1.zip`. Setiap bahagian disanitasi kepada token selamat-nama-fail (huruf/angka Unicode dikekalkan, ruang/tanda baca dibuang, dihadkan pada 32 aksara). `<n>` adalah jujukan per-hari, per-peranti, jadi eksport berulang pada hari yang sama tidak berlanggar dan kekal tersusun. `backupFilename()` dalam [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts) membina nama itu. Kandungan zip itu sama tanpa mengira nama. Di dalamnya:

| Laluan | Diperlukan | Kandungan |
|---|---|---|
| `manifest.json` | ya | Id format, versi, kiraan dan integriti per-bahagian. Perkara pertama yang dilihat oleh pembaca. |
| `profile.json` | apabila ditetapkan | Rekod `me` pengguna yang lengkap: nama, hubungan, rujukan gambar kepala dan bendera, ditambah folder, Trash, pelan projek, templat pengguna dan alat buatan pengguna, kegemaran, alat tersembunyi, pilihan bahasa dan emoji. Dibaca melalui `host.profile`. |
| `sessions.json` | ya | Setiap sesi tersimpan: slot, id/versi alat, label, lakaran kecil (data-URL) dan data input penuh. Dibaca melalui `host.state`. |
| `assets.json` | ya | Metadata bagi setiap aset yang dimuat naik (imej, fon, token jenama, logo, salinan tersimpan muat turun), setiap satu menunjuk kepada baitnya di bawah `assets/blobs/`. |
| `assets/blobs/<n>.<ext>` | setiap aset | Bait aset mentah (fail imej dan fon). Disimpan tanpa mampatan (format yang sudah dimampatkan). Sambungan itu bersifat kosmetik sahaja. MIME dalam `assets.json` yang muktamad. |
| `assets/blobs/<n>.c2pa` | apabila hadir | Content Credentials yang diekstrak sebagai bait binari yang tepat, dirujuk oleh `_credentialFile` dalam rekod aset. Ini bukan kunci penandatanganan peranti. |
| `design-systems.json` | apabila hadir | Sistem reka bentuk yang dibuat atau ditambah pada pemasangan ini, sebagai `{ active, records }`. Digabung mengikut id semasa import; pilihan aktif bundel itu terpakai hanya apabila sasaran tiada sistem reka bentuk sendiri. |
| `file-history.json` | pilihan | Snapshot aset berversi, laporan operasi fail terminal dan manifes batch lengkap. Bahagian sejarah ini mempunyai versinya sendiri; dibekalkan oleh penyesuai sandaran `fileHistory` dalaman milik shell. |
| `revision-history.json` | pilihan, sandaran manual | ID ciptaan yang stabil, checkpoint yang dikekalkan, lakaran kecil dan draf pemulihan berputar. Dibekalkan oleh `host.state.history.backup` jika disokong. |
| `file-history/versions/` | setiap snapshot | Bait aset terdahulu dan credential yang diekstrak, tidak bergantung pada sama ada aset semasa masih wujud. |
| `file-history/results/` | setiap operasi selesai | Bait output yang tepat. Tiada fail asal yang dipilih-untuk-penukaran dikekalkan atau disertakan. |
| `prefs.json` | ya | Keutamaan tempatan milik pengguna: `theme`, `sidebarWidth` dan kiraan aktiviti `ct-metrics`. |
| `lolly.txt` | ya | Ringkasan bundel yang boleh dibaca manusia (kiraan, profil, nama fail) untuk sesiapa yang membuka zip itu tanpa Lolly. Dijana semula pada setiap eksport dan dikenali semasa import, jadi ia tidak sekali-kali dikira sebagai bahagian yang dilangkau. Ia ditulis *selepas* peta integriti, jadi ia kekal di luar peta itu. |

Bundel itu sengaja dijadikan zip biasa: ia bertahan pada mana-mana pengangkutan tanpa rosak, dan mana-mana alat unzip boleh memeriksanya.

`profile.json` adalah bahagian terkecil dan yang pertama dilihat oleh pembaca dalam aplikasi: butiran yang diisi sekali oleh pengeluar, ditambah opt-in yang membenarkan alat menggunakannya.

![Borang butiran Profil yang menjadi profile.json: nama, butiran hubungan dan foto profil](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddetails-section&width=1440&height=1100&dpi=192&waitMs=1800&format=svg&cropSelector=.profile-details-grid&walker=1&dark=1&filename=ce-profile-record)

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

Import ialah satu **gabungan**, tidak sekali-kali ganti-semua:

- Data sedia ada pada sasaran dibiarkan seperti sedia ada.
- Apabila slot sesi atau id imej yang dimuat naik terdapat pada kedua-duanya, salinan yang disimpan lebih baru dikekalkan, supaya sandaran yang lebih lama tidak sekali-kali menulis ganti kerja yang lebih baru pada sasaran. Masa yang sama atau tidak diketahui mengekalkan salinan sasaran. Pada pemasangan web dengan sejarah ciptaan, peraturan yang sama menentukan salinan ciptaan yang manakah kekal semasa, dan salinan yang satu lagi dikekalkan sebagai draf terlindung (lihat di bawah).
- Rekod profil digabungkan, bukan digantikan. Setiap folder pada sasaran kekal dengan kandungannya; folder daripada bundel yang tiada pada sasaran ditambah, dan folder pada kedua-duanya mengekalkan nama dan induk sasaran serta memperoleh ahli bundel yang tiada padanya. Sesi yang difailkan dalam folder pada sasaran kekal difailkan di situ.
- Kegemaran (alat, aset katalog dan item Projek) digabungkan. Templat, templat Projek dan alat pengguna daripada bundel ditambah apabila sasaran tiada rekod dengan id tersebut. Entri Tong Sampah daripada kedua-duanya dikekalkan, supaya item yang boleh dipulihkan pada mana-mana pemasangan masih boleh dipulihkan.
- Setiap medan profil lain (nama, butiran hubungan, bahasa, bendera ciri, alat tersembunyi dan tetapan lain) mengekalkan nilai sasaran. Medan yang kosong pada sasaran mengambil nilai bundel. Perkara yang sama berlaku untuk `prefs.json`: satu keutamaan hanya ditulis di mana sasaran tiada satu pun.
- Aplikasi biasa segerak peranti adalah pengecualian: bagi mengekalkan peranti selari, ia mengambil rekod profil, keutamaan, sesi dan imej salinan yang diselaraskan. Memulihkan salinan terdahulu melakukan perkara yang sama, kerana ia sengaja kembali ke masa lalu. Penyertaan pertama, **Bring it to this device**, bergabung seperti satu import.
- Versi aset sejarah dan ID operasi adalah pengecualian yang tidak boleh diubah: import berulang bersifat idempoten, dan ID yang sudah menamakan bait/sejarah berbeza ditolak, bukan ditulis ganti. Mengimport semula satu aset semasa yang sama persis mengekalkan versinya. Satu aset semasa yang berubah mesti membawa versi yang berbeza.
- Sejarah ciptaan turut digabungkan. Satu ciptaan pada kedua-dua belah mengekalkan salinan yang disimpan lebih baru sebagai semasa dan salinan yang satu lagi sebagai draf terlindung; satu ciptaan yang slotnya digunakan sasaran untuk ciptaan lain ditambah di sebelahnya; satu ciptaan dalam Tong Sampah sasaran kekal di situ. Satu id checkpoint yang menamakan kandungan berbeza pada sasaran mengekalkan milik sasaran. Satu arkib yang gagal semakannya sendiri menghentikan import sebelum sebarang perubahan profil, sesi, aset atau keutamaan. Import berulang yang sama persis tidak menambah storan.
- Apa-apa yang tiada dalam bundel tidak disentuh. Satu sesi yang dimiliki sasaran tetapi tiada dalam bundel terus wujud selepas import.

Sesi tersimpan menyambung semula kepada imejnya secara automatik: rujukan aset dikekalkan mengikut id, dan jambatan itu menyelesaikannya semula selepas imej yang dimuat naik dipulihkan (ia memang mesti berbuat demikian, kerana URL `blob:` tidak bertahan selepas muat semula halaman).

Ringkasan import melaporkan `{ profile, sessions, userAssets, prefs, skipped, failedAssets }`. `failedAssets` mengira aset yang dimuat naik yang tidak dapat dipulihkan (storan peranti penuh, contohnya). Ia berbeza daripada `skipped`, yang mengira bahagian daripada penulis lebih baharu serasi-hadapan yang tidak dikenali oleh binaan ini. UI memaparkan `skipped` ("… · N newer items skipped"), jadi pemulihan itu jujur tentang apa yang ditinggalkannya.

Apabila sejarah fail hadir, ringkasan itu turut membawa `assetVersions`, `fileOperations` dan `failedHistory`. Kehabisan storan atau konflik ID yang tidak boleh diubah boleh menyebabkan pemulihan separa; UI memberitahu pengguna untuk mengekalkan sandaran sumber. Segerak awan **tidak** memajukan revision yang telah dilaksanakannya selepas pemulihan separa atau yang tidak disokong, jadi snapshot itu kekal tersedia untuk dicuba semula. Pemulihan bukan satu transaksi tunggal merentasi semua storan profil/sesi/aset/sejarah.

## Sejarah ciptaan (v3)

Sandaran manual daripada satu hos web yang menyokong sejarah menyertakan `revision-history.json` dengan skema `{ version: 1, documents, revisions, recoveries }` miliknya sendiri. Ia membawa ID yang dikekalkan, snapshot input kanonik, cap versi, pratonton raster dan draf penulis berasingan. Penyesuai sejarah menangkap sesi semasa dan head-nya dalam satu transaksi baca; `sessions.json` menggunakan snapshot semasa yang sama itu untuk pembaca yang lebih lama.

Pemulihan menyemak SHA-256 muatan dan kiraan bait, identiti unik, perhubungan document/head, keturunan (ancestry), cap masa, jenis pratonton dan had sebelum melakukan commit arkib dalam satu transaksi. Rujukan induk yang dipadatkan mungkin tiada. Kerja semasa sedia ada tidak sekali-kali digantikan secara senyap: apabila satu ciptaan berada pada kedua-dua belah, pihak yang tidak dikekalkan sebagai semasa menjadi draf terlindung. Had pemindahan 384 MiB milik arkib disemak secara eksplisit, dan had storan dikuatkuasakan tanpa memotong checkpoint yang dikekalkan. Sandaran keseluruhan masih menggunakan pelaksanaan ZIP dalam-memori dan bukan arkib strim.

Ringkasan menambah `revisions` dan `recoveryDrafts`, mengira hanya apa yang ditambah oleh import ini, serta `added`, `kept`, `replaced`, `copies` dan `hidden` bagi cara setiap ciptaan digabungkan. Satu shell tanpa keupayaan ini memulihkan sesi biasa dan melaporkan bahagian sejarah sebagai dilangkau. Sejarah sistem fail native kekal tidak disokong sehingga penyesuainya membekalkan transaksi sejarah yang tahan lasak. Keadaan tetamu P2P tiada sejarah atau arkib pemulihan yang tahan lasak.

Segerak snapshot peribadi secara eksplisit mengecualikan sejarah ciptaan. Menggunakan satu snapshot pada dokumen tempatan yang membawa sejarah mengekalkan keadaan kerja sebelumnya sebagai satu draf pemulihan berasingan dan membatalkan token tulis mana-mana penyunting yang sedang terbuka. Checkpoint yang tidak boleh diubah kekal pada peranti. Ini melindungi sejarah tempatan semasa penggantian snapshot; ia tidak menggabungkan sejarah peranti serentak.

Rujukan aset sejarah dikekalkan, manakala rendering masih menyelesaikan aset melalui pustaka sedia ada destinasi. Arkib ini belum lagi menjamin bait aset lama atau render alat lama yang tepat. Bait versi-aset dan hasil-fail terus berpindah melalui bahagian sandaran berasingan yang sudah ada.

## Versi tersimpan dan hasil fail (v2)

Bahagian sejarah pilihan mengandungi `{ version: 2, assetVersions: [...], operations: [...], batches: [...] }`; pembaca turut menerima bentuk history-v1 terdahulu tanpa batches. Setiap snapshot mengenal pasti ID aset yang stabil dan versi tepatnya, masa simpannya, panjang bait dan SHA-256 hex, ditambah satu rekod aset yang `_file` dan `_credentialFile` pilihannya menunjuk kepada bahagian binari. Operasi membawa fakta fail asal, permintaan, laporan, cap masa dan `_file` hasil pilihan; nama backend storan, pemegang OPFS dan pajakan pelaksanaan tidak turut berpindah. Pembaca history-v1-sahaja yang lebih lama menolak versi sejarah baharu sebelum mengimport, dan bukannya secara senyap menggugurkan keahlian batch.

Manifes batch merekod setiap sumber yang dipilih sebelum diproses, termasuk fail yang tidak pernah dibaca, ahli yang dibatalkan, kegagalan menempah ruang hasil dan kerja yang terputus. Setiap ahli mempunyai ID operasi yang stabil, rujukan/fakta sumber, nama output yang diminta dan laporan terminal. Satu sumber yang tidak dibaca mempunyai fakta yang diisytiharkan, bukan digest rekaan. Import mengesahkan identiti ahli dan ketekalan dengan mana-mana laporan operasi yang dibawa. Laporan batch kekal tersedia apabila hasil individu telah dibuang secara eksplisit, tetapi satu resit tidak bermakna bait outputnya masih disimpan.

- Setiap rekod sejarah, laporan dan fail yang dirujuk yang diketahui disahkan sebelum sebarang penulisan import profil atau aset. Bait yang hilang dan SHA-256 yang tidak sepadan gagal walaupun sampul itu tiada peta integriti. Credential yang diekstrak kekal sebagai array bait, termasuk import daripada penulis lama yang men-JSON-serialize-kannya sebagai objek kunci-berangka.
- Operasi yang sedang berjalan menjadi rekod terputus dalam sandaran, dengan laporan kegagalan yang menerangkan dan tiada hasil. Pemulihan tidak pernah memulakan semula kerja latar belakang atau mengimport satu pajakan aktif. Mencuba semula memerlukan pemilihan fail asal, disemak terhadap SHA-256 rekodnya jika tersedia.
- Hasil yang dipulihkan melakukan commit bait dan metadatanya bersama-sama dalam IndexedDB. Hasil baharu biasa menggunakan OPFS jika tersedia, dengan fallback IndexedDB. Satu operasi langsung yang sedia ada tidak sekali-kali digantikan oleh satu import.
- Penyusunan ZIP sejarah masih dalam memori: had semasa ialah **256 MiB muatan sejarah**, **4 MiB metadata sejarah**, paling banyak **100 operasi**, **100 batch** dan **2,000 snapshot**. Eksport menolak sejarah yang terlalu besar atau tidak lengkap secara eksplisit; ia tidak sekali-kali menggugurkannya secara senyap. Muat turun versi/hasil penting satu demi satu sebelum membuang salinan tempatan yang lebih lama. Had ini bukan jaminan memori-puncak yang diukur untuk telefon.
- Sejarah hasil tempatan mempunyai bajet 512 MiB dan had 100 rekod. Snapshot aset mempunyai bajet 512 MiB berasingan dan paling banyak 20 versi sejarah setiap aset; bait credential yang diekstrak dikira ke dalam bajet snapshot itu. Pemulihan menghormati had ini dan tidak sekali-kali mengeluarkan data pengguna sedia ada secara senyap.
- Metadata batch tempatan mempunyai bajet 4 MiB berasingan, paling banyak 100 manifes dan 20 ahli setiap batch. Ahli yang tertangguh menempah kapasiti metadata, dengan siling laporan 32 KiB setiap ahli. Ini adalah bajet logik, bukan jaminan ruang cakera pelayar; kegagalan kuota sebenar dipaparkan dan laporan dalam-memori kekal boleh dimuat turun. Mencuba semula satu ahli batch mencipta satu batch baharu tanpa menulis ganti laporan lama. Membuang satu rekod batch tidak membuang bait hasil individu atau aset pustaka.
- Hasil yang ditukar boleh ditambah secara eksplisit ke pustaka tanpa normalisasi atau pengekodan semula. Hash sumber/output dan perhubungan operasi menyertai aset itu. Penambahan berulang menggunakan semula salinan yang tidak berubah; satu salinan yang telah disunting tidak sekali-kali ditulis ganti. Imej raster boleh memulakan satu dokumen Design baharu. Dokumen itu menggunakan ID aset pustaka semasa: menguatkuasakan pin versi tepat merentasi runtime dan laluan URL Design masih kerja berasingan. Hasil SVG/HTML/PDF/ZIP dikekalkan sebagai aset fail legap oleh serah tugas ini, tidak dinaik taraf kepada kandungan interaktif/vektor yang dipercayai.
- **Convert → Recent file operations** memaparkan penggunaan sejarah, laporan, muat turun dan pengurus versi. Pengurus itu turut mencari versi terdahulu bagi aset pustaka yang telah dipadam. Memulihkan satu snapshot mencipta satu versi semasa baharu sambil mengekalkan snapshot yang dipilih tetap utuh. **Tetapan → Storan** mengira hasil dan versi secara berasingan daripada cache yang boleh dibuang.
- Pembersihan fail sementara eksplisit hanya membuang bait milik-operasi yang tidak dirujuk. Rekod semasa melindungi failnya; fail OPFS terkini mempunyai tempoh tangguh satu jam. Hasil tersimpan dan snapshot aset tidak dibersihkan secara automatik.

Pembaca lama masih menerima sampul v2 (`minReader: 1`) dan memulihkan bahagian yang dikenali, mengira bahagian sejarah yang tidak disokong sebagai dilangkau. Pemulihan sejarah penuh memerlukan satu shell dengan penyesuai `fileHistory`; ini ialah seam dalaman-shell, bukan keupayaan `HostV1` baharu yang menghadap alat. Pemulihan dua-peranti sebenar dilindungi oleh get tempatan Chromium; penerimaan pemulihan Tauri/iOS/Android yang dipasang kekal berasingan.

## Apa yang tidak berpindah

- **Cache katalog** (metadata dan blob aset yang dimuat turun, indeks alat) - disegerakkan semula secara percuma pada sasaran.
- **Alat katalog dan aset katalog** - di luar skop, dan diandaikan sudah wujud pada sasaran. Token jenama, fon dan logo yang ditambah pengguna adalah aset pengguna, jadi ia tetap berpindah.
- **URL `blob:` / objek** - dijana semula oleh jambatan semasa dimuatkan.
- **Fail asal penukaran, pajakan pelaksanaan langsung dan rahsia akses/penandatanganan tempatan-mesin** - bukan muatan sejarah yang mudah alih. Satu hasil tersimpan ialah satu salinan, bukan satu janji bahawa sumber asalnya telah disandarkan.
- **Pengira jujukan eksport** - pengira penamaan muat turun per-hari (kunci `localStorage` `lolly-export-seq`) adalah kemudahan penamaan tempatan. Ia dikekalkan di luar `PREF_KEYS`, jadi ia tidak sekali-kali dibawa dalam bundel.

Meter storan memerincikan pemisahan yang sama. Sesi tersimpan, My images dan File results & versions dibawa dalam bundel. Cache aset, pratonton alat dan sematan luar talian di bawahnya semuanya boleh diterbitkan semula, jadi ia kekal ditinggalkan.

![Meter storan memecahkan data peranti ini kepada kategori bernama, dengan Saved sessions dan My images dijejaki berasingan daripada Asset cache, di sini pada pemasangan baharu di mana setiap kategori masih kosong](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&dark=1&filename=ce-storage-categories)

## Jaminan merentas shell

`data-transfer.ts` membaca dan menulis secara eksklusif melalui jambatan keupayaan (`host.profile`, `host.state`, `host.assets`) dan keutamaan `localStorage` yang dikongsi. Modul yang sama membaca dan menulis sampul sepunya pada web dan Tauri, melalui storan IndexedDB atau sistem fail. Bahagian sejarah pilihan muncul hanya di tempat penyesuai berkaitannya tersedia; satu bahagian yang tidak disokong dilaporkan sebagai dilangkau semasa import. Suit headless menjalankan bahagian sepunya terhadap satu jambatan dalam-memori, manakala transaksi sejarah turut mempunyai ujian pelayar-sebenar.

Dua shell berada di luar jaminan itu, atas sebab yang berbeza:

- **CLI one-shot** tiada apa untuk dibawa - keadaannya dalam-memori dan sementara bagi setiap panggilan.
- **TUI** memang mengekalkan keadaan (`~/.lolly`: sesi, folder, profil) dan paparan Profil-nya boleh membuat sandaran, tetapi ia menulis arkib yang *lebih ringkas* miliknya sendiri: `saved-state/<slot>.json` bagi setiap sesi ditambah `profile.json` dan `folders.json`, tanpa manifes, tanpa `formatVersion`/`minReader` dan tanpa peta integriti. Ia **tidak** boleh diimport oleh format ini - pembaca menolaknya sebagai "bukan sandaran Lolly" - dan mengelirukan kerana ia menggunakan nama yang serupa (`lolly-backup-<stamp>.zip`). Menyatukan kedua-duanya adalah jurang yang diketahui.

## Titik lanjutan terpelihara

Envelope itu direka sebagai manifes ditambah satu set bahagian bernama, supaya jenis data mudah alih yang baharu boleh menumpang kemudian **tanpa perubahan yang memecahkan (breaking change)**. Ia disisipkan sebagai bahagian tambahan (`formatVersion` baharu, `minReader` yang sama), dan pembaca hari ini melangkau apa yang tidak dikenalinya. Ini belum dibina. Nama-namanya diperuntukkan di sini supaya format kekal koheren apabila ia tiba kelak.

- **`tokens.json` - token reka bentuk.** Dokumen token reka bentuk [W3C DTCG](https://tr.designtokens.org/format/) (format yang [diimport dan dieksport oleh Penpot](https://help.penpot.app/user-guide/design-systems/design-tokens/) - token dengan `$value`/`$type`/`$description`, disusun ke dalam kumpulan, set dan tema). Satu set token dalam bundle membolehkan pengguna memindahkan primitif jenama mereka antara pemasangan bersama sesi mereka. (Token jenama milik pengguna sendiri sudah berpindah hari ini sebagai aset `user/tokens/brand` dalam `assets.json`; bahagian ini akan membawa keseluruhan dokumen DTCG berserta set dan temanya.) Dalam jangka panjang, set token yang diingest menjadi sumber tulen yang menjadi rujukan resolusi oleh alat dan aset palet.
- **`penpot/` - fail Penpot yang diingest.** Direktori terpelihara untuk fail Penpot (atau subset yang diekstrak dan relevan kepada Lolly) yang diimport dan dipaparkan *sebagai alat*. Bundle akan membawa definisi yang diingest itu, supaya ia bergerak bersama data pengguna yang lain.

Apa-apa di luar nama terpelihara ini dan bahagian di atas adalah, bagi pembaca, bahagian yang tidak diketahui: dibiarkan tanpa disentuh dan dikira dalam `skipped`.

## Rujukan

- Modul: [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts) (`exportBackup`, `importBackup`, `BACKUP_FORMAT`, `BACKUP_FORMAT_VERSION`, `BACKUP_READER_VERSION` - penama `backupFilename()` bersifat dalaman).
- Ujian kontrak: [`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) - kes round-trip, gabungan, integriti, forward-compat dan reader-gate.
- Ujian kontrak sejarah: [`tests/file-history-backup.test.ts`](../tests/file-history-backup.test.ts), [`tests/file-batch-history.test.ts`](../tests/file-batch-history.test.ts) dan [`tests/file-result-library.test.ts`](../tests/file-result-library.test.ts). Penerimaan pelayar: [`tests/file-history.browser.test.ts`](../tests/file-history.browser.test.ts), [`tests/file-batch-history.browser.test.ts`](../tests/file-batch-history.browser.test.ts) dan [`tests/file-result-reuse.browser.test.ts`](../tests/file-result-reuse.browser.test.ts).
- Permukaan bridge yang digunakan: `host.profile`, `host.state`, `host.assets` - lihat [Host API](/info/host-api.html).
