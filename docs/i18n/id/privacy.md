# Kebijakan Privasi

*Terakhir diperbarui: 23 Oktober 2026*

**Membuat sesuatu di Lolly terjadi di perangkat Anda.** Membuka alat, mengetik, melihat pratinjau, mengekspor, dan memeriksa file semuanya berjalan di dalam aplikasi pada ponsel, komputer, atau browser Anda. Anda tidak memerlukan akun, dan aplikasi tidak menyetel cookie untuk semua itu.

**Hasil karya Anda meninggalkan perangkat hanya saat Anda memintanya.** Menambahkan Google Font, mengirim file ke Drive atau Dropbox, mengaktifkan Sync, memutar radio, atau mengunduh model AI di perangkat, masing-masing membuat permintaan yang Anda mulai sendiri. Aplikasi juga mengambil alat dan pembaruannya dari alamatnya sendiri, dan permintaan itu tidak membawa apa pun yang Anda buat. [Setiap permintaan jaringan yang dapat dibuat aplikasi](#every-network-request-the-app-can-make) mendaftarkannya, host demi host.

**Beberapa layanan Lolly berjalan di server.** Tautan render, pengambil gambar, endpoint agen AI, dan layanan identitas terverifikasi hanya menerima apa yang Anda kirim, dan menyimpannya tidak lebih lama dari yang dinyatakan halaman ini.

**Instans Lolly Work organisasi Anda berbeda.** Instans itu menyimpan pekerjaan bersama yang Anda taruh di sana, dan kebijakan operatornya berlaku untuk data tersebut, bukan kebijakan ini.

::: figure privacy-where-data-goes
Ke mana data Anda pergi: data tetap di perangkat Anda kecuali Anda memulai suatu permintaan, dan setiap jenis permintaan memiliki tujuannya sendiri.
:::

## Cakupan kebijakan ini

Lolly adalah perangkat lunak sumber terbuka yang dapat dijalankan siapa saja: sebuah engine, shell aplikasi untuk web, desktop, seluler, dan terminal, serta ekstensi browser. Kebijakan ini terdiri dari dua bagian:

- <!--i:code--> **Perangkat lunaknya sendiri**: apa yang dilakukan dan tidak dilakukannya dengan data Anda, di mana pun ia berjalan. Ini adalah sifat kodenya, jadi berlaku untuk setiap deployment Lolly, milik kami maupun milik orang lain.
- <!--i:server--> **lolly.tools**, deployment referensi yang dioperasikan SUSE: pilihan yang diambil dalam menjalankan bagian servernya yang opsional, seperti apa yang dicatat dalam log, berapa lama, dan oleh siapa.

Pada instans Lolly yang di-host sendiri atau instans enterprise, perilaku perangkat lunak di bawah ini tetap berlaku, tetapi *operator* instans itu, bukan SUSE, yang bertanggung jawab atas apa pun di server mereka: endpoint render, server MCP, layanan sertifikat, dan instans Lolly Work mereka. Tanyakan kebijakan mereka sendiri kepada mereka. [Adoption & Governance](/info/adoption-governance.html) menjelaskan apa saja yang tercakup dalam mengoperasikan Lolly.

## Apa yang tetap di perangkat Anda

Aplikasi web, desktop, dan seluler Lolly menjalankan seluruh engine render di perangkat. Setelah alat, aset, dan encoder yang Anda gunakan ada di perangkat, merender dan mengunduh tidak memerlukan server.

**Penggunaan aplikasi mandiri tidak menyetel cookie.** Login organisasi dan pendaftaran identitas terverifikasi yang opsional memiliki cookie sendiri, yang dijelaskan di bagiannya masing-masing. Aplikasi menyimpan catatan berikut di perangkat:

- <!--i:sliders--> **Preferensi antarmuka**: tema, bahasa, pengaturan suara, ukuran sidebar dan zoom, pilihan urutan dan tampilan, serta tips mana yang sudah Anda lihat, di `localStorage`, agar siap sebelum aplikasi selesai dimulai.
- <!--i:download--> **Cache offline untuk katalog alat dan pratinjau aset**, agar galeri berfungsi tanpa koneksi.
- <!--i:hash--> **Penghitung penggunaan lokal** untuk statistik kartu profil Anda, seperti jumlah ekspor dan alat mana yang dipakai: catatan kecil yang dibatasi di `localStorage`, tidak pernah kami baca dan tidak pernah dikirim ke mana pun.
- <!--i:folder--> **Pekerjaan Anda sendiri**: dokumen, sesi tersimpan beserta riwayatnya, gambar dan font yang diunggah, hasil file dan versi sebelumnya, serta Tempat Sampah, yang menyimpan item terhapus selama 30 hari. Semua ini berada di IndexedDB di perangkat dan tetap di sana kecuali Anda memilih Sync atau berbagi.
- <!--i:globe--> **Pencarian kota Meeting Planner**, di `localStorage`, agar setiap kota hanya dicari sekali.
- <!--i:cpu--> **Model yang diunduh dan alat yang disematkan**: model AI di perangkat yang Anda setujui untuk diunduh dan alat yang Anda sematkan untuk penggunaan offline.

**Settings → Storage** menampilkan seberapa banyak ruang yang dipakai Lolly di perangkat, dengan pekerjaan Anda, Tempat Sampah, model yang diunduh, salinan offline, dan cache tercantum satu per satu. **Clear all my data** di sana menghapus salinan lokal, dan mematikan Sync terlebih dahulu; menghapus penyimpanan situs di browser Anda memberi hasil yang sama. Penyimpanan yang benar-benar diperlukan untuk layanan yang Anda minta tidak memerlukan persetujuan menurut Direktif ePrivacy (Art. 5(3)), hanya transparansi, dan itulah yang diberikan dokumen ini dan pemberitahuan di dalam aplikasi.

![Bagian penyimpanan di Settings pada layar selebar ponsel: setiap kategori data di perangkat disebutkan, dengan tombol Clear all my data di samping daftar](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-selbar%2C.profile-row-value%2C.profile-group-value%2C%23store-hero-num%2C%23store-headroom%7Bdisplay%3Anone%7D&format=svg&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

**Export my data** menghasilkan file `lolly-backup` yang Anda simpan dan kendalikan. File itu tidak pernah menyentuh server kami kecuali Anda sendiri mengirimkannya ke suatu tempat. Lihat [Data transfer](/info/data-transfer.html).

### Utilitas yang berjalan di perangkat Anda

Beberapa alat, seperti **Strip Hidden Data**, **Compress**, dan lainnya yang memiliki lencana **Runs on your device**, bekerja pada file yang Anda berikan. File dibaca ke memori, ditransformasi di perangkat, dan ditawarkan kembali sebagai unduhan. File tidak pernah diunggah, karena tidak ada server di jalurnya. Utilitas ini berfungsi offline, dan hasilnya tidak membawa watermark atau metadata dari kami.

**Rondocode** adalah satu-satunya pengecualian, karena ia membuat audio baru dari lagu Anda, bukan mentransformasi file milik Anda. Setiap file audio yang ditulisnya membawa Content Credentials yang mencatat lagu tersebut dan menyatakan setiap nyanyian buatan AI. Panel Export menyatakan hal ini sebelum Anda mengekspor, dan [Rondocode songs](/info/rondocode.html#files-from-the-rondocode-utility) mencantumkan persis apa yang dicatat.

![Lencana yang dibawa alat-alat ini: Runs on your device - nothing is uploaded](/t/url-shot?url=%2F%23%2Ftool%2Ftext-helper&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%5Bdata-privacy%5D&dark=1&filename=pv-ondevice-badge)

**Prepare for sharing** dan **Compare** bekerja di memori pada perangkat dan tidak mengirim apa pun ke server, dan Prepare tidak menambahkan apa pun ke riwayat, tautan, cadangan, atau Sync sampai Anda menyimpan hasilnya.

::: details Bagaimana Prepare for sharing dan Compare menangani file Anda
**Prepare for sharing** menyimpan input kerja, temuan privat, dan peta penggantian di memori, tanpa menambahkannya ke riwayat, tautan, cadangan, atau Sync. Inspeksi dan penggantian tidak mengirim isi file ke server mana pun dan tidak memeriksa kredensial secara online. Anda memilih apakah akan menyalin, mengunduh, mengirim, atau menyimpan hasil ke pustaka Anda; hasil yang tersimpan kemudian mengikuti pengaturan cadangan dan Sync pustaka Anda. File resep tidak menyertakan konten sebelumnya dan pemetaan literal, dan laporan ringkasan berisi jumlah, ID cakupan, dan hash file. CLI menyimpan file tinjauan privat dengan nilai aslinya hanya bila diminta dengan `--review-file`. Meninggalkan tampilan persiapan melepaskan status kerjanya, dan ini bukan janji penghapusan forensik dari memori browser atau sistem operasi.

Salinan yang telah disiapkan dan operasi file yang selesai berbagi kontrol Compare. Nilai yang dihapus awalnya diciutkan, dan laporan perbandingan tidak menyertakan nama sumber, path, dan nilai kecuali Anda memilih untuk menyertakannya. Riwayat file menyimpan salinannya, jadi membandingkan setelah memuat ulang berarti memilih file asli lagi, yang dicocokkan melalui SHA-256 yang tercatat. Memilihnya tidak menyimpan atau mengunggah file.
:::

Strip Hidden Data dan Prepare for sharing juga memeriksa file DOCX, PPTX, dan XLSX di perangkat. Pada file DOCX yang didukung, properti terpilih dapat dihapus dalam salinan baru; konten Office lainnya hanya dapat diperiksa, dan pratinjau privat tetap berada di balik kontrol untuk menampilkannya.

::: details Apa yang dibaca dan dihapus inspeksi Office
| Format Office | Isi paket yang diperiksa | Penghapusan yang didukung |
|---|---|---|
| DOCX | Properti inti, aplikasi, dan kustom; komentar dan penulis; penanda dan pratinjau pelacakan perubahan; run teks tersembunyi; relasi eksternal; objek tersemat | Penulis terpilih, terakhir disimpan oleh, tanggal dibuat/diubah/terakhir dicetak, judul, subjek, deskripsi, kata kunci, properti kustom, Company, Manager, Template, basis hyperlink, nama dan versi aplikasi, serta statistik (total waktu penyuntingan dan jumlah halaman, kata, karakter, baris, dan paragraf) |
| PPTX | Properti; komentar dan catatan penulis; catatan pembicara; penanda slide tersembunyi; relasi eksternal; objek tersemat dan workbook bersarang yang didukung | Tidak ada |
| XLSX | Properti; komentar dan catatan; penanda sheet, baris, dan kolom tersembunyi; nama terdefinisi; relasi eksternal dan koneksi; permukaan tautan eksternal dan cache pivot; objek tersemat | Tidak ada |

**Batasan.** Sensus tidak memeriksa sepenuhnya teks yang terlihat, rumus, dependensi, tampilan hasil render, atau bagian biner sembarang. Sensus mendukung hingga 300 bagian paket, 64 MiB total ekspansi yang dideklarasikan, 2 MiB per bagian XML, dan dua tingkat paket tersemat bersarang; Prepare membagi anggaran bagian dan ekspansi di seluruh pekerjaan. Konten yang terpotong, rusak, terenkripsi, dan tidak didukung dilaporkan dan dipertahankan. Konten makro diidentifikasi dan tidak pernah dijalankan, format Office biner lama dan XLSB tidak diperiksa, dan referensi eksternal tidak pernah diambil.

**Apa yang dipertahankan pembersihan DOCX.** Pembersihan mendukung format paket DOCX transisional dengan bagian properti inti, kustom, dan yang diperluas yang kanonis. Dari properti yang diperluas, Company, Manager, Template, HyperlinkBase, Application, AppVersion, serta statistik TotalTime, Pages, Words, Characters, CharactersWithSpaces, Lines, dan Paragraphs dapat dihapus. DocSecurity, judul heading dan bagian, penanda tautan, dan properti aplikasi lainnya dipertahankan. Menghapus Template membiarkan tautan templat terlampir apa pun di pengaturan dokumen, tempat sensus melaporkannya sebagai relasi eksternal.

Beberapa pembaca menentukan cara menggambar bagan dan gambar dari nama dan versi aplikasi; LibreOffice, misalnya, menampilkan bagan dari file Word 2007 secara berbeda tanpa keduanya. Keduanya dipertahankan bila file berisi bagan, gambar, bentuk, atau objek tersemat, dan inspeksi mencantumkannya sebagai dipertahankan. Properti yang ditampilkan oleh field Word (TEMPLATE, EDITTIME, NUMPAGES, NUMWORDS, atau NUMCHARS) dipertahankan, dan field tautan serta tautan eksternal relatif mempertahankan HyperlinkBase, karena targetnya diselesaikan terhadap alamat dasar tersebut.

**Apa yang tetap hanya-periksa.** Data tanda tangan digital yang diperluas mencegah pembersihan. Paket Office yang ditandatangani, berkemampuan makro, terenkripsi, rusak, diganti namanya, atau bersarang tetap hanya-periksa. Demikian pula file dengan field Word lain yang bergantung pada properti, seperti DOCPROPERTY atau AUTHOR, atau dengan kontrol konten terikat XML, karena menghapus properti dapat mengubah dokumen saat Word memperbarui ikatan tersebut, dan teks field yang tersimpan di cache tidak dapat menunjukkan bahwa tampilan berikutnya akan sama. Bagian XML dengan ekstensi nama file yang tidak biasa, target relasi XML Word yang tidak dapat diperiksa dengan aman, bagian header atau footer yang dideklarasikan keliru, dan bagian SVG yang dideklarasikan sebagai XML dengan ekstensi `.svg` juga tetap hanya-periksa dalam rilis pembersihan pertama ini.

**Bagaimana pembersihan memeriksa hasil kerjanya.** Bagian properti, deklarasinya, anggota paket yang tidak terkait, komentar XML, dan komentar ZIP dipertahankan. Pembersihan menerapkan batasan sensus dan memeriksa integritas setiap anggota sebelum menulis, lalu memeriksa kembali properti yang dihasilkan. Compare menampilkan perbedaan properti yang didukung dengan nilai yang diciutkan; ia tidak membandingkan teks yang terlihat atau tampilan hasil render. Nilai menggunakan pratinjau hingga 2048 karakter, jadi perbedaan di luar pratinjau mungkin tidak tampak, dan tinjauan parsial tidak dapat memastikan bahwa dua file sama. `prepare --strip-hidden-data` pada CLI menghapus properti DOCX yang didukung, dan envelope tinjauan privat dapat memilih properti satu per satu. Penjaga pembersihan yang gagal mempertahankan file dan melaporkan operasi yang gagal.
:::

## Setiap permintaan jaringan yang dapat dibuat aplikasi

Sebagian besar permintaan membawa alat, font, atau model ke perangkat Anda. Aksi Send mengirimkan file yang Anda pilih, Sync mengirimkan cadangan ke penyimpanan yang Anda pilih, dan layanan organisasi mengirimkan konten atau detail yang diperlukan untuk pekerjaan bersama. Setiap grup di bawah ini mencantumkan apa yang meninggalkan perangkat Anda, kapan, dan apa yang terjadi jika operator memblokir permintaan itu. Penyedia identitas dan aset yang dikonfigurasi operator dapat menambahkan tujuan pada deployment tersebut. [Every fixed host, in one table](#every-fixed-host-in-one-table) mencantumkan host yang dapat dihubungi aplikasi web.

::: details Hal-hal yang diambil ke perangkat Anda
- <!--i:download--> **Katalog alat.** Tidak ada yang bersifat pribadi: permintaan atas indeks alat dan aset publik milik Lolly sendiri, ke alamat aplikasi itu sendiri, saat mulai dan kemudian di-cache untuk offline. Jika diblokir, aplikasi berjalan dengan alat yang ada di cache dan berhenti menemukan alat baru.
- <!--i:sparkle--> **Set emoji.** Set yang Anda pilih diunduh dari alamat aplikasi itu sendiri saat pertama kali Anda memakai set tersebut. Tidak ada yang bersifat pribadi yang dikirim. Animasi Lottie dibaca di perangkat dan tidak menghubungi siapa pun.
- <!--i:document--> **Google Fonts.** Nama keluarga font yang dipilih dan alamat IP Anda dikirim ke server font Google (`fonts.googleapis.com` untuk stylesheet, `fonts.gstatic.com` untuk file font). Ini terjadi hanya saat Anda menambahkan Google Font di Design System Setup, dan hanya setelah Anda menyetujui dialog yang menyatakan persis hal ini. Setiap keluarga font diambil sekali, lalu disimpan di perangkat dan dipakai offline. Jika diblokir, pemilih gagal dengan aman; unggah file font sebagai gantinya.
- <!--i:cpu--> **Model AI di perangkat.** Tidak ada yang bersifat pribadi: unduhan file model, lalu disimpan di perangkat. Build web memakai alamat aplikasi itu sendiri secara default; sebuah build dapat menyebut host model lain, seperti host rilis Lolly `lolli.li` untuk aplikasi yang dikemas. Host menerima permintaan dan alamat IP Anda, tanpa akun dan tanpa input model. Ini terjadi hanya saat Anda memakai fitur yang membutuhkan model (deep scan Verify, peningkatan skala gambar, ucapan, dan sejenisnya) atau memilih mengunduh model untuk penggunaan offline. Jika diblokir, fitur itu menunggu dan yang lainnya tetap berfungsi.
- <!--i:sliders--> **Profil cetak ICC.** Tidak ada yang bersifat pribadi: permintaan profil kondisi pencetakan standar ke registri publik ICC (`registry.color.org`, `www.color.org`), hanya saat Anda mengeklik preset ICC di pengelola profil cetak, sekali per profil. Jika diblokir, preset gagal; sediakan profil `.icc` Anda sendiri.
- <!--i:globe--> **Radio internet.** Tidak ada yang bersifat pribadi: permintaan playlist dan aliran audio dari stasiun (`api.somafm.com` dan server aliran yang ditunjuknya, `*.somafm.com`), hanya selama Anda memutar radio opsional di pemutar suara. Jika diblokir, radio gagal dan setiap fitur suara lainnya tetap berfungsi.
:::

::: details Alat yang membutuhkan data langsung
- <!--i:globe--> **Pencarian kota Meeting Planner.** Saat ini ini satu-satunya alat yang mengambil data langsung. Alat ini meminta `geocoding-api.open-meteo.com` untuk mengubah setiap nama kota (kota tuan rumah dan kota setiap anggota tim) menjadi koordinat dan zona waktu, tanpa akun, tanpa kunci, dan tanpa pengenal selain permintaan itu sendiri. Input Host city menjelaskan hal ini, dan setiap jawaban disimpan di perangkat sehingga sebuah kota hanya dicari sekali. Ini berjalan hanya selama alat terbuka. Jika diblokir, pencarian gagal dan tidak ada hal lain yang terpengaruh.
:::

::: details File yang Anda kirim
Masing-masing hanya mengirim satu file yang Anda pilih, saat Anda menekan tombol Send-nya, setelah login yang Anda selesaikan di jendela milik layanan itu sendiri. Kata sandi aplikasi Bluesky, alamat webhook Discord, kata sandi aplikasi Nextcloud, dan kunci S3 disimpan hanya di perangkat ini, tidak pernah dalam cadangan, dan **Disconnect** menghapusnya.

- <!--i:upload--> **Google Drive.** File, dalam format apa pun, dikirim ke API Drive Google (`www.googleapis.com`). Akses Lolly dibatasi pada file yang dibuatnya sendiri (scope `drive.file`), sehingga tidak pernah dapat membaca sisa Drive Anda. Di aplikasi web, token login disimpan di memori selama sesi dan tidak pernah disimpan; di aplikasi lain, refresh token disimpan hanya di perangkat ini jika Anda mencentang **Stay connected**. Tombol ini hanya ada pada build tempat operator mengonfigurasi client id Google. Jika diblokir, tombol tidak pernah muncul; unduh file dan unggah sendiri.
- <!--i:upload--> **Dropbox.** File dikirim ke API Dropbox (`api.dropboxapi.com` untuk login dan metadata, `content.dropboxapi.com` untuk file). Aksesnya hanya folder aplikasi, jadi Lolly melihat `Apps/` dan foldernya sendiri di sana dan tidak ada yang lain. Tautan **Open** yang ditampilkannya adalah tautan privat berumur pendek, dan tidak ada berbagi publik yang dibuat. Refresh token disimpan hanya jika Anda mencentang **Stay connected**. Tombol ini hanya ada bila operator telah mengonfigurasi client id Dropbox.
- <!--i:upload--> **OneDrive.** File dikirim ke layanan identitas dan Graph Microsoft (`login.microsoftonline.com` untuk login, `graph.microsoft.com` untuk unggahan); file besar diunggah dalam potongan ke `api.onedrive.com` atau origin penyimpanan yang dikonfigurasi operator. Akses dibatasi pada folder Lolly sendiri di bawah `Apps/`, ditambah nama tampilan Anda untuk label akun. Refresh token disimpan hanya jika Anda mencentang **Stay connected**. Tombol ini hanya ada bila operator telah mengonfigurasi client id Microsoft.
- <!--i:upload--> **LinkedIn**, **hanya di aplikasi desktop**. File, dengan namanya sebagai teks postingan, dikirim ke LinkedIn (`www.linkedin.com` untuk login di browser Anda sendiri, `api.linkedin.com` untuk unggahan dan postingan) sebagai postingan publik di feed Anda sendiri. Lolly dapat memposting sebagai Anda dan membaca nama Anda untuk label akun, tidak lebih. Login disimpan hanya jika Anda mencentang **Stay connected**, dan token LinkedIn berlaku 60 hari serta tidak dapat diperpanjang secara diam-diam, sehingga akan kedaluwarsa sendiri. Host-host itu tidak ada dalam kebijakan koneksi aplikasi web. Tombol ini hanya ada pada build dengan aplikasi LinkedIn yang dikonfigurasi.
- <!--i:upload--> **Penpot.** Token akses pribadi Penpot Anda, yang Anda tempel ke aplikasi, dan arsip `.penpot` dari desain dikirim ke API Penpot (`design.penpot.app`) melalui pass-through kecil di alamat aplikasi itu sendiri (`/api/penpot`), karena API Penpot tidak akan menjawab browser secara langsung. Pass-through itu meneruskan dan melupakan; aplikasi desktop berbicara langsung dengan Penpot. Ini terjadi hanya saat Anda menekan **Send to Penpot** di alat Design dan mengonfirmasi sebuah proyek. Jika diblokir, pengiriman gagal dengan aman; ekspor file `.penpot` dan impor sendiri.
- <!--i:upload--> **Bluesky.** Gambar, namanya sebagai teks postingan dan teks alt, serta handle dan kata sandi aplikasi Anda (dibuat di Bluesky → Settings → App passwords, bukan kata sandi akun Anda) dikirim ke server Bluesky yang Anda sebutkan, `bsky.social` kecuali Anda memilih yang lain. Anda menghubungkan akun lebih dulu di **Settings → Connected services**.
- <!--i:upload--> **Discord.** File dikirim sebagai lampiran ke alamat webhook kanal yang Anda tempel, di discord.com. Siapa pun yang memegang alamat webhook dapat memposting ke kanal itu, itulah sebabnya alamat tersebut tetap di perangkat.
- <!--i:upload--> **Mastodon.** File, dengan namanya sebagai teks postingan, dikirim ke server Mastodon atau yang kompatibel yang Anda sebutkan, setelah login di jendela milik server itu sendiri. Menghubungkan mendaftarkan aplikasi kecil untuk perangkat ini di server tersebut, dan login disimpan hanya jika Anda mencentang **Stay connected**.
- <!--i:upload--> **Nextcloud atau WebDAV.** File dikirim ke server Anda sendiri dalam satu unggahan terautentikasi, dengan alamat server, nama pengguna, dan kata sandi aplikasi yang Anda masukkan (Nextcloud → Settings → Security → Devices & sessions; bukan kata sandi akun Anda).
- <!--i:upload--> **Penyimpanan kompatibel S3.** File dikirim ke bucket Anda sendiri (AWS S3, MinIO, R2, B2, Garage, atau endpoint SigV4 mana pun), ditandatangani di perangkat dengan pasangan kunci yang Anda masukkan.

**Host yang Anda pilih memerlukan persetujuan operator.** Host Bluesky, Discord, Mastodon, Nextcloud, dan S3 tidak ada dalam daftar tetap Lolly, karena Anda yang memilihnya. Aplikasi tidak mengirim apa pun ke salah satunya sampai operator menyetujui host HTTPS yang persis sama: di web, dalam Content Security Policy deployment; di aplikasi desktop, saat aplikasi dibangun. Hal yang sama berlaku untuk host unggahan penyimpanan kustom dan SharePoint. Di web, server juga harus mengizinkan panggilan browser dari aplikasi (CORS), dan pengalihan gagal dengan aman, jadi gunakan alamat yang tidak mengalihkan. Aplikasi desktop memeriksa setiap pengalihan terhadap daftar yang disetujui.

Daftar ini membatasi host mana yang dapat dijangkau aplikasi. Daftar ini tidak membedakan akun atau tenant di Google atau Microsoft, dan izin milik penyedia sendiri yang menentukan akun dan aksi mana yang diizinkan. Daftar ini juga tidak mencakup jendela login, tipe sumber daya lain, atau fitur native, yang memiliki aturannya sendiri. Perubahan memerlukan build desktop baru atau header respons web baru; simpan pekerjaan Anda sebelum membuka kembali aplikasi untuk menerapkannya. [Connector origins](/info/connector-origins.html) menjelaskan konfigurasinya.
:::

::: details Sync di seluruh perangkat Anda
- <!--i:folder--> **Apa yang keluar.** Salinan dari apa yang Anda buat di perangkat ini (sesi dan proyek tersimpan, design system Anda beserta font dan logonya, gambar yang diunggah, profil dan preferensi Anda) sebagai satu file, ke satu penyimpanan yang Anda pilih: folder aplikasi Lolly di Dropbox Anda (`api.dropboxapi.com`, `content.dropboxapi.com`), file yang dibuat Lolly di Google Drive Anda (`www.googleapis.com`), folder aplikasi Lolly di OneDrive Anda (`graph.microsoft.com`, dengan file lebih besar diunggah ke `api.onedrive.com` atau origin penyimpanan yang dikonfigurasi operator, dan unduhan dari origin penyimpanan persis yang dikonfigurasi operator), atau Nextcloud, server WebDAV, atau bucket S3 Anda sendiri. Penyimpanan yang sama menyimpan hingga tujuh salinan harian dan satu salinan dari sebelum penerapan terakhir Anda.
- <!--i:shieldcheck--> **Tidak ada yang masuk ke Lolly.** Tidak ada server Lolly, relay, atau server Lolly Work di jalurnya, dan aplikasi tidak memerlukan situs web Lolly untuk ini, bahkan untuk login. Salinan dienkripsi di perangkat terlebih dahulu hanya jika Anda menetapkan frasa sandi. Login, kunci, kata sandi aplikasi, frasa sandi, dan pengaturan Sync tetap di perangkat dan tidak pernah ada dalam salinan. Di web, koneksi Google Drive yang diingat hanya menyimpan nama akun Anda (dan client id Anda sendiri, jika Anda memberikannya), dan login Google berlaku satu kunjungan. Di aplikasi Android, login Google Drive melalui Google Play services di ponsel, yang dijalankan Google.
- <!--i:sliders--> **Kapan.** Hanya setelah Anda mengaktifkan **Sync across my devices** atau menekan **Sync now**: pengunggahan sesaat setelah setiap perubahan dan saat Anda meninggalkan aplikasi, serta pemeriksaan salinan yang lebih baru saat aplikasi dimulai. Jika diblokir, Sync gagal dan menyebutkan alasannya, dan pekerjaan Anda tetap di perangkat. Anda dapat mengekspor data ke file dan memindahkannya sendiri sebagai gantinya. [Sync your devices](/info/sync.html) membahas fiturnya.
:::

::: details Halaman web, tangkapan, dan gambar dari situs lain
- <!--i:monitor--> **URL yang Anda minta untuk ditangkap oleh alat.** Alat URL screenshot meminta alamat persis yang Anda ketik, hanya saat Anda memulai penangkapan. Karena Anda memilih alamat pada saat itu, alamat tersebut tidak ada dalam kebijakan koneksi, dan operator tidak dapat mengizinkan atau memblokirnya per host; untuk menghapusnya, hapus alatnya.
- <!--i:globe--> **Halaman web di dalam kotak Design.** Halaman diminta, dengan alamat IP Anda, dari situs asalnya, bersama apa pun yang diminta halaman itu sendiri. Bila browser mendukungnya, frame dikirim tanpa cookie dan tanpa alamat selain origin aplikasi itu sendiri, sehingga dokumen Anda dan tautannya tidak pernah ikut dalam permintaan. Di aplikasi web hanya pemutar berikut yang dapat dibingkai: `www.youtube-nocookie.com`, `player.vimeo.com`, `www.loom.com`, `www.google.com` (peta) dan `www.figma.com`, ditambah halaman referensi di `wikipedia.org` dan `*.wikipedia.org`, `commons.wikimedia.org`, `upload.wikimedia.org`, `www.wikidata.org`, `www.mediawiki.org` dan `www.openstreetmap.org`. **Allow pages from any site**, di bawah **Settings → Trusted sites**, memuat ulang Lolly di perangkat Anda dengan kebijakan yang dapat membingkai halaman `https:` mana pun, dan aturan yang sama tentang kepercayaan dan bertanya tetap berlaku. Halaman dimuat hanya untuk situs di Trusted sites Anda, termasuk default referensi yang dapat dihapus, atau setelah Anda menyetujui kotak itu di inspektornya; deck yang dikirim seseorang kepada Anda menampilkan gambar setiap halaman sampai saat itu. Sebelum Anda mempresentasikan, daftar menawarkan **Just this time** dan **Always trust** untuk setiap situs, dan tidak ada yang ditanyakan saat Anda mempresentasikan. Jika diblokir, kotak menampilkan gambarnya dengan tautan untuk membuka halaman di tab baru. Alat Lolly dan demo Sandbox di dalam kotak berjalan di alamat aplikasi itu sendiri dan tidak menghubungi siapa pun.
- <!--i:sliders--> **Mengubah halaman yang Anda tampilkan.** Aksi **Use page** pada kotak halaman web memungkinkan Anda menolak cookie atau menutup banner di dalam halaman. Untuk halaman Lolly yang dapat diakses, **Hide cookie banners** menyembunyikan overlay yang dikenal, termasuk OneTrust, tanpa menerima cookie atau mengubah pilihan persetujuan situs. **Page CSS** mengubah halaman langsung dan presentasi kotak itu; ekspor tetap memakai poster yang dipilih. Aturannya tidak dapat mengimpor sumber daya atau font, dan browser mencegah Lolly mengubah CSS situs lain. Pratinjau Sandbox memiliki editor CSS sendiri di bawah **Edit in Sandbox**.
- <!--i:code--> **Sumber daya web demo Sandbox.** Setiap stylesheet, skrip, font, atau gambar yang ditautkan kode demo diminta, dengan alamat IP Anda dan tanpa cookie, dari situs yang menghostingnya; file yang disebutkan stylesheet yang diambil, seperti file font Google Fonts, dihitung sebagai situs terpisah. Ini terjadi hanya setelah Anda mengeklik **Fetch & inline**, atau untuk situs di Trusted sites Anda; **Always trust** di samping sebuah file menambahkan situsnya ke daftar itu. Jika diblokir, demo berjalan tanpa file-file tersebut, dan Sandbox mencantumkan setiap file yang tidak dapat diambil beserta alasannya.
- <!--i:download--> **Menambahkan gambar dari URL.** **Add from URL** di pemilih aset atau Assets meminta alamat gambar persis yang Anda tempel. Kebijakan aplikasi web sendiri mencegah browser mengambil dari situs lain secara langsung, jadi pass-through kecil di alamat aplikasi itu sendiri (`/api/fetch-image`) mengambil gambar dan hanya mengembalikan byte-nya; ia tidak menyimpan apa pun, melupakan alamatnya, dan menolak apa pun yang bukan alamat gambar publik. Aplikasi desktop mengambil alamat itu secara langsung. Tautan Lolly yang Anda tempel tidak diambil sama sekali: tautan itu dirender di perangkat. Jika operator mematikan pass-through (`LOLLY_DISABLE_IMAGE_PROXY=1`), hanya tautan Lolly, gambar `data:`, dan gambar same-origin yang dapat ditambahkan di aplikasi web, dan aplikasi desktop tidak terpengaruh.
- <!--i:palette--> **Design system dari sebuah situs web.** Design System Setup dapat membaca satu halaman dari situs yang Anda sebutkan, melalui [ekstensi browser](#the-browser-extension) atau pengambilan milik aplikasi desktop sendiri, tidak pernah melalui server Lolly. Tidak ada yang diambil sebelum Anda menekan, dan tautan di halaman tidak diikuti.
:::

::: details Bekerja dengan orang lain dan agen
- <!--i:link--> **Collab privat.** Dua perangkat terhubung langsung, tanpa server di tengah. Undangan dan balasan membawa alamat yang dapat dilihat setiap perangkat di jaringannya sendiri, dan build ini tidak mengonfigurasi server penemuan alamat dari luar, jadi berikan hanya kepada orang yang bekerja bersama Anda. Lihat [Working together](/info/collaborate.html).
- <!--i:monitor--> **Nearby**, di aplikasi desktop. Selama Anda terlihat, yaitu sepuluh menit saat Anda memulai undangan collab atau, jika Anda mengaktifkannya, kapan pun aplikasi berjalan, aplikasi mengumumkan nama acak, nama tampilan yang Anda pilih, dan jenis perangkat di jaringan lokal. Aplikasi tidak mengumumkan alamat email, akun, atau pengenal yang bertahan lama.
- <!--i:link--> **Invite an agent.** Status dokumen yang diundang, pratinjau yang diminta agen, identitas agen, dan suntingannya melewati relay langsung yang dikonfigurasi (`lolly.ing` di lolly.tools) ke agen yang Anda undang. Plugin hosted yang terpasang juga meneruskan panggilan melalui konektor lolly.tools ke relay yang dipilih undangan; konektor tidak menyimpan undangan atau dokumen di antara panggilan. Relay menyimpan undangan dan permintaan tertunda di memori sampai Anda memutus koneksi atau kedaluwarsa: sepuluh menit untuk undangan yang tidak dipakai dan tiga puluh menit tanpa aktivitas untuk undangan yang sudah bergabung. Penyedia agen Anda menangani data yang diterimanya berdasarkan kebijakannya sendiri. Ini terjadi hanya setelah Anda membuat undangan di Share dan memberikan instruksinya kepada agen Anda; akses baca mengizinkan inspeksi dan akses edit juga mengizinkan perubahan. Pause menghentikan perubahan, dan Disconnect atau mencabut undangan mengakhiri akses. Jika diblokir, agen tidak dapat bergabung atau melanjutkan, dan Anda tetap bisa menyunting.
- <!--i:cpu--> **Allow AI control**, di aplikasi desktop. Agen yang berjalan di komputer ini dapat membaca dan menyunting dokumen Design yang terbuka melalui koneksi yang tetap berada di komputer. Fitur ini mati sampai Anda menyalakannya. Lolly tidak mengirim apa pun ke server untuk itu; penyedia agen menangani apa yang dibaca agen berdasarkan kebijakannya sendiri. [Threat Model & Trust Boundaries](/info/threat-model.html) mencantumkan apa yang dapat dan tidak dapat dilakukan agen semacam itu.
- <!--i:server--> **Instans jarak jauh.** Saat Anda mengarahkan aplikasi ke deployment Lolly lain, aplikasi menerima apa pun yang dilayani instans itu kembali, melalui sinkronisasi katalog yang sama, ditambah tag versi pada permintaan ke instans itu (jenis aplikasi dan versi engine, informasi yang sama dengan yang dibawa user agent), sehingga operatornya dapat melihat versi Lolly mana yang digunakan. Pada instans terkelola, selama Anda masuk, tag itu juga membawa id instalasi untuk perangkat ini, agar daftar perangkat operator dapat membedakan instalasi; keluar menghapus id tersebut, dan perangkat yang terhubung kembali nanti menyajikan id baru. Anda yang memilih host, jadi host itu tidak ada dalam kebijakan koneksi. Jika diblokir, peralihan gagal dan instans lokal Anda tidak terpengaruh.
- <!--i:people--> **Instans Lolly Work organisasi Anda.** Identitas login dan informasi perangkat, permintaan kebijakan, sesi bersama, suntingan kolaborasi, unggahan, pengajuan persetujuan, dan file pengiriman yang Anda gunakan, serta label peristiwa penggunaan yang diizinkan bila dikonfigurasi, dikirim ke instans organisasi Anda, dengan login melalui penyedia identitasnya. Penyegaran kebijakan dan telemetri yang diaktifkan dapat berjalan selama penggunaan; pekerjaan bersama, collab, tinjauan, dan pengiriman mengirim konten sebagai bagian dari alur kerja tersebut. Jika diblokir, fitur organisasi itu tidak dapat diselesaikan, dan pekerjaan pribadi Anda tetap terpisah. Lihat [Organisation services with Lolly Work](#organisation-services-with-lolly-work).
:::

### Setiap host tetap, dalam satu tabel

Content Security Policy aplikasi web-lah yang mencegah skrip menjangkau host yang tidak terdaftar. Selain alamat aplikasi itu sendiri, tabel ini memuat setiap host yang tercantum dalam kebijakan itu, ditambah dua host LinkedIn yang ditambahkan aplikasi desktop, yang ditandai hanya-desktop. Tes CI memeriksa tabel ini terhadap kebijakan yang diterapkan, sehingga satu host tidak dapat ditambahkan ke salah satunya tanpa yang lain.

| Apa | Apa yang sebenarnya meninggalkan perangkat Anda | Host |
|---|---|---|
| Model di perangkat pada aplikasi yang dikemas, dan file rilis | Permintaan untuk file publik, dengan alamat IP Anda | `lolli.li` |
| Google Fonts | Nama keluarga font dan alamat IP Anda | `fonts.googleapis.com`, `fonts.gstatic.com` |
| Send to dan Sync dengan Google Drive | File atau cadangan yang Anda pilih | `www.googleapis.com` |
| Send to dan Sync dengan Dropbox | File atau cadangan yang Anda pilih | `api.dropboxapi.com`, `content.dropboxapi.com` |
| Send to dan Sync dengan OneDrive | File atau cadangan yang Anda pilih, dan nama tampilan Anda untuk label akun | `login.microsoftonline.com`, `graph.microsoft.com`, `api.onedrive.com` |
| Pencarian kota Meeting Planner | Setiap nama kota | `geocoding-api.open-meteo.com` |
| Profil cetak ICC | Permintaan untuk profil publik | `registry.color.org`, `www.color.org` |
| Radio internet | Permintaan playlist dan aliran audio | `api.somafm.com`, `*.somafm.com` |
| Invite an agent, dan ruang kerja lolly.ing | Status dokumen yang diundang, pratinjau dan suntingan, serta permintaan ruang kerja yang Anda buat | `lolly.ing` |
| Pemutar di kotak web Design | Permintaan untuk halaman, dengan alamat IP Anda | `www.youtube-nocookie.com`, `player.vimeo.com`, `www.loom.com`, `www.google.com`, `www.figma.com` |
| Halaman referensi di kotak web Design | Permintaan untuk halaman, dengan alamat IP Anda | `wikipedia.org`, `*.wikipedia.org`, `commons.wikimedia.org`, `upload.wikimedia.org`, `www.wikidata.org`, `www.mediawiki.org`, `www.openstreetmap.org` |
| Send to LinkedIn, hanya di aplikasi desktop | File, dengan namanya sebagai postingan publik | `www.linkedin.com`, `api.linkedin.com` |

Daftar milik aplikasi desktop sendiri juga mencakup endpoint token Google untuk login Drive. Host lain mana pun, seperti server Mastodon atau Nextcloud yang Anda sebutkan, memerlukan persetujuan operator, seperti dijelaskan di bagian File yang Anda kirim. Host yang Anda pilih pada saat penggunaan, seperti URL yang Anda tangkap atau instans jarak jauh yang Anda sebutkan, tidak muncul di daftar mana pun.


**Tanda tangan SEAL tidak membuat permintaan.** Verify dapat memeriksa tanda tangan SEAL, skema yang kunci penandatanganannya dapat dipublikasikan di DNS. Browser tidak dapat melakukan kueri DNS, jadi pencarian lewat web harus melalui resolver DNS-over-HTTPS pihak ketiga, yang akan melihat domain yang diperiksa dan alamat IP Anda. Lolly dulu memakai resolver Cloudflare; sekarang tidak lagi, dan belum ada yang menggantikan Cloudflare. Tidak ada aplikasi Lolly yang mencari kunci SEAL saat ini: aplikasi desktop dan seluler menjalankan tampilan Verify yang sama, dan `lolly validate` di baris perintah tidak memeriksa SEAL. File yang catatan SEAL-nya membawa kuncinya secara inline diperiksa offline, dan Verify menyebut tanda tangan itu konsisten secara internal tanpa mengonfirmasi domainnya. File yang kuncinya hanya ada di DNS menampilkan **SEAL signature did not verify**, dengan alasan "no key resolver and no inline key".

![Layar Verify: sebuah area lepas file dan tidak ada yang lain - file diperiksa di tempatnya berada, tanpa unggahan dan tanpa akun](/t/url-shot?url=%2F%23%2Fverify&width=1440&height=900&dpi=192&waitMs=1400&walker=1&format=svg&cropSelector=.valid-layout&dark=1&filename=cc-verify-drop)

Anda dapat memeriksa ini dan setiap klaim lain di halaman ini sendiri: [Verify It Yourself](/info/verify-yourself.html) memberikan perintah dan keluaran yang diharapkan.

## Layanan yang dijalankan lolly.tools

Layanan ini berjalan di lolly.tools untuk semua orang. Masing-masing hanya menerima apa yang Anda kirim. [Server Surface](/info/server-surface.html) menjelaskan komponen yang sama sebagaimana cara kerjanya pada deployment mana pun.

### Tautan render

Setiap URL `https://lolly.tools/tool/<tool-id>.<ext>?<inputs>` dirender sungguhan, dan inputnya dibawa di URL, sehingga tautan Lolly yang dibagikan dapat tampil sebagai gambar langsung di README, wiki, atau dasbor. Mengambil satu tautan meminta server merender **data alat dan katalog publik** dengan input yang tertulis di alamat.

- <!--i:usercheck--> **Tanpa akun, tanpa cookie, tanpa status.** Rute ini tidak meminta login, dan tidak ada yang dibaca dari perangkat Anda. Dokumen, sesi, dan unggahan Anda tidak pernah meninggalkan browser Anda dan tidak dapat muncul di tautan ini.
- <!--i:document--> **URL itu sendiri dicatat.** Query string sebuah URL adalah bagian dari permintaan, jadi muncul di log akses biasa platform hosting seperti path yang diminta lainnya. Jika input sebuah tautan berisi nama atau alamat email seseorang, seperti pada tanda pengenal atau tanda tangan email, **teks itu berada di log tersebut**. Berikan pada tautan render hanya apa yang akan Anda taruh di halaman publik.
- <!--i:globe--> **Inputnya tetap publik.** Input adalah apa pun yang diketik pembuat tautan ke dalam URL, dapat dibaca oleh siapa pun yang dijangkau tautan itu. Jangan menaruh rahasia di tautan yang dibagikan; Lolly menawarkan enkripsi tautan untuk konten sensitif.
- <!--i:eyeoff--> **Di-cache, dibatasi, dan tidak diindeks.** Respons di-cache dan dibatasi lajunya seperti gambar publik mana pun, serta ditandai `noindex` agar mesin pencari tidak memasukkan hasil render Anda.

Deployment yang di-host sendiri yang tidak menginginkan rute render publik mengatur `LOLLY_DISABLE_RENDER_GET=1`, dan setiap URL ini mengembalikan 404.

### Pengambil gambar dan pass-through Penpot

**Add from URL** di aplikasi web dan **Send to Penpot** memakai dua pass-through kecil di lolly.tools, yang dijelaskan di bawah [Setiap permintaan jaringan yang dapat dibuat aplikasi](#every-network-request-the-app-can-make). Pengambil gambar tidak menyimpan apa pun dan melupakan alamatnya. Pass-through Penpot meneruskan token dan arsip Anda ke Penpot dan tidak menyimpan keduanya; ia mencatat nama perintah dan status respons Penpot.

### Server MCP, untuk agen AI

Agen AI dapat menjangkau Lolly melalui Model Context Protocol, lewat endpoint yang dijalankan operator. lolly.tools menjalankan satu, dan siapa pun dapat menjalankan miliknya sendiri, termasuk sepenuhnya offline.

- <!--i:cpu--> **File yang dikirim agen.** Alat yang menerima file (`lolly_transform`, `lolly_verify`, `lolly_redact`, `lolly_read`, `lolly_check`, `lolly_package`, `lolly_compose`, `lolly_rebrand` dan alat gambar `lolly_look`, `lolly_sample_color` dan `lolly_trace_edges`) memprosesnya di memori dan mengembalikan hasilnya dalam panggilan yang sama. File tidak pernah ditulis ke disk dan tidak disimpan setelah permintaan selesai. `lolly_inspect` juga menerima file, dan pemeriksaan video serta produksi cetaknya menulis salinan kerja sementara yang dihapus saat panggilan kembali. Setiap alat lain bekerja dari parameter dalam panggilan: teks, angka, warna, URL, id aset katalog, atau dokumen yang diberikan pemanggil.
- <!--i:cpu--> **Rebrand menyatakan ke mana deck pergi.** Tahap pertama `lolly_rebrand`, `capabilities`, menyatakan dengan kata-kata ke mana byte Anda akan pergi sebelum Anda mengirim apa pun: pada server lokal yang di-host sendiri, deck tidak pernah meninggalkan mesin itu, dan pada server hosted, memanggil `lolly_rebrand` mengirim deck ke sana, hingga batas ukuran dan slide yang diberikan tahap itu.
- <!--i:lock--> **Endpoint terbuka.** Di lolly.tools, `lolly.tools/api/mcp` terbuka untuk siapa pun tanpa token. Panggilan dibatasi per alamat dan oleh anggaran harian. Alamat menjadi digest pseudonim di penyimpanan kontrol penyalahgunaan, seperti pada endpoint login di bawah, dan anggaran hanya menghitung waktu CPU dan byte yang dikirim, tanpa alamat. Bearer token endpoint terbatas tidak pernah ditulis ke log atau URL render.
- <!--i:link--> **Tautan unduhan untuk hasil besar.** lolly.tools mengembalikan hasil secara inline dan tidak pernah menerbitkan tautan ini. Operator dapat mengaktifkannya untuk gateway terautentikasi mereka sendiri, tempat hasil disimpan paling lama lima menit dan hanya bearer token milik pemanggil sendiri yang dapat mengambilnya; lihat [MCP Server](/info/mcp.html#private-download-links-for-large-results). Endpoint terbatas yang direncanakan di `mcp.lolly.tools` akan menerima bearer token yang diterbitkan operator kepada klien tepercaya, atau OAuth 2.1 dengan token bertanda tangan berumur pendek yang diperiksa terhadap rahasia bersama; aktivasinya masih tertunda, dan tercantum di [Delivery hosts and processors](#delivery-hosts-and-processors).

### Identitas terverifikasi: login yang Anda mulai sendiri

Lolly dapat menyegel **Content Credential** ke dalam ekspor Anda, sehingga siapa pun dapat memeriksa secara offline bahwa file tidak berubah sejak meninggalkan Lolly. Itu **aktif secara default dan sepenuhnya lokal**: kunci penandatanganan dibuat di perangkat Anda dan penandatanganan terjadi offline. Tanpa pendaftaran, kunci itu sekali pakai, pasangan kunci baru dibuat untuk setiap ekspor dan dibuang sesudahnya. Setelah Anda mendaftar, kunci bertahan dan dibuat **non-extractable**, sehingga bahkan kode Lolly sendiri tidak dapat membacanya, hanya meminta untuk menandatangani. Dengan cara apa pun kunci tidak pernah meninggalkan perangkat Anda.

[Exporting](/info/exporting.html#content-credentials-c2pa) mencantumkan apa yang dicatat sebuah credential: alat, waktu, permukaan ekspor kasar, nama Anda hanya bila Anda mengaktifkan *Use my details*, karya berkredit yang ditempatkan sebuah ekspor, dan setiap lagu Rondocode yang diputar ekspor video atau audio (namanya, hash sumbernya, dan bagaimana sandbox Lolly merender lagu itu). Panel ekspor mencantumkan lagu-lagu itu sebelum Anda mengekspor.

Credential dan metadata file juga mencatat [design system dan colourway](/info/exporting.html#the-design-system-record) yang menggambar ekspor: id dan nama design system, versi terbitnya, dan colourway. Nama design system adalah teks yang diketik pemiliknya dan dapat berupa nama klien, jadi kartu **Design system** di panel ekspor menampilkan kata-kata persisnya sebelum Anda mengekspor. Hapus centang kartu itu, atau berikan `_madewith=0` atau `--no-madewith`, untuk tidak menyertakannya.

Satu langkah *opsional* di atas itu adalah mendaftarkan identitas terverifikasi, agar ekspor Anda berbunyi "Verified - signed by \<your email\>" dan bukan menyebut kunci anonim. **Jika Anda melewati pendaftaran, layanan sertifikat tidak menerima data pendaftaran dari Anda.**

![Kartu Verified identity di Settings, selebar ponsel: pemilih masa berlaku sertifikat dan langkah pendaftaran di bawahnya, tidak aktif sampai Anda memulainya sendiri](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

Jika Anda mendaftar, inilah yang terjadi persisnya:

::: timeline
- <!--i:usercheck--> **Anda memilih metode login**: GitHub, Google, SUSE (id.suse.com), atau tautan yang dikirim lewat email. Untuk ketiga penyedia OIDC, Anda menuju halaman login milik penyedia itu, di bawah kebijakan privasi mereka, bukan kami, dan layanan sertifikat hanya menerima kembali alamat email terverifikasi dan nama penyedia. Untuk tautan email, alamat yang Anda ketik dikirim ke **Resend**, layanan email transaksional, hanya untuk mengantarkan satu tautan itu.
- <!--i:lock--> **Cookie berumur pendek melindungi pengalihan.** Layanan sertifikat menyetel `lolly_ca_state`, `HttpOnly`, dengan cakupan `/api/ca` dan kedaluwarsa dalam sepuluh menit. Cookie itu membawa nilai acak, bukan pengenal pelacakan, ada hanya untuk mencegah pengalihan login dipalsukan, dan dihapus begitu login selesai.
- <!--i:eyeoff--> **Alamat IP Anda dipakai sebentar untuk mencegah penyalahgunaan** endpoint login, agar satu skrip tidak dapat membanjiri kotak masuk atau menghabiskan kuota email. Lolly mengubahnya menjadi digest SHA-256 sebelum mencapai penyimpanan kontrol penyalahgunaan berumur pendek, jadi alamat mentah tidak dikirim ke sana. Digest itu pseudonim, bukan anonim: seseorang yang memegang penyimpanan dapat memulihkan alamat IPv4 dengan mencoba semua kemungkinan. Bucket kedaluwarsa setelah sekitar satu menit dan tidak dipakai untuk hal lain. Log akses hosting biasa terpisah dan dijelaskan di bawah.
- <!--i:seal--> **Layanan menerbitkan sertifikat** yang mengikat alamat email terverifikasi Anda ke kunci publik perangkat Anda. Kunci privat tetap di perangkat: klien mengirim permintaan sertifikat dengan bukti kepemilikan terikat, dan tidak ada kunci privat perangkat yang dikirim ke salah satu mode penerbit.
- <!--i:check--> **Penandatanganan tetap lokal.** Dengan penerbit lama, ekspor tidak memerlukan permintaan ke layanan sertifikat. Identitas terkelola juga memerlukan daftar pencabutan yang segar dan bertanda tangan dari penerbitnya; klien dapat memakai daftar yang di-cache dalam jendela kesegaran yang dikonfigurasi, dan menyegarkannya dapat menghubungi layanan sertifikat selama ekspor. Status yang hilang, kedaluwarsa, atau tidak valid menghentikan identitas terkelola dari penggunaan.
:::

::: details Retensi dan penarikan di setiap mode penerbit
**Penerbitan hosted lama** menawarkan 7, 30, 90, atau 365 hari, dibatasi operator. Ia tidak menyimpan inventaris identitas dan tidak ada log penerbitan, jadi tidak dapat mencari siapa yang memperoleh sertifikat atau mencabut sertifikat orang itu; masa berlaku adalah penarikannya.

**Penerbitan organisasi terkelola** memakai masa berlaku default paling lama 24 jam dan maksimum tujuh hari, dengan root dan kebijakan kepercayaan penerbitnya sendiri, dan penandatanganan menuju penerbit Vault yang dikonfigurasi operatornya. Aplikasi pendaftarannya memakai penyimpanan admisi sekali pakai bersama yang hanya menyimpan pengenal autentikasi berkunci dan digest permintaan, paling lama sepuluh menit, dan tidak menyimpan inventaris identitas atau cache respons sertifikat. Penyedia PKI, perangkat auditnya, gateway, dan cadangan memiliki aliran data sendiri. Bahkan dengan penyimpanan penerbitan biasa dimatikan, pencabutan berbasis sertifikat dapat menyimpan sertifikat, termasuk identitas emailnya, dan serial pencabutan serta pengenal audit dapat tetap terhubung; kebijakan operator Anda yang menentukan inventaris itu, siapa yang dapat mengaksesnya, dan berapa lama disimpan.

Perangkat terkelola dapat meminta pencabutan sertifikatnya sendiri, dengan bukti perangkat yang terautentikasi, dan tidak ada API yang meminta kunci privat perangkat. Operator dapat menarik penerbit melalui kebijakan kepercayaannya. Lolly tidak menyimpan pemetaan dari orang ke sertifikat, jadi mencabut sertifikat seseorang saat mereka pergi bergantung pada catatan yang disimpan operator, dan catatan PKI, catatan audit, penerima, dan cadangan mengikuti kebijakan operator. [Desain layanan sertifikat](https://github.com/lolly-tools/lolly/blob/main/services/ca/README.md) membahas kustodi penerbit, retensi penyedia, dan kualifikasi.
:::

## Layanan organisasi dengan Lolly Work

**Lolly Work** adalah layanan organisasi opsional dari proyek Lolly, yang di-deploy secara terpisah oleh setiap organisasi yang menjalankan sebuah instans. Terhubung ke instans menambahkan data yang disimpan di server itu di samping penyuntingan lokal Anda. Operatornya bertanggung jawab atas kebijakan privasi, kontrol akses, penerima, retensi, dan cadangan deployment tersebut.

| Alur kerja | Data yang ditangani layanan organisasi |
|---|---|
| Login dan penyediaan akun | Klaim penyedia identitas, keanggotaan akun dan grup, sesi login, dan informasi perangkat. OIDC menangani login; administrator dapat menyediakan dan menonaktifkan akun melalui SCIM |
| Katalog dan proyek bersama | Aset, metadata, dan versi yang diunggah; proyek dan sesi bersama; konten yang diambil dari penyedia pustaka yang dikonfigurasi |
| Collab kerja | Status sesi bersama, suntingan langsung, dan kehadiran peserta yang dikirim melalui instans; status tersimpan bertahan sesuai kebijakan penyimpanannya |
| Tautan berbagi terkelola | Target tautan dan pengaturan akses, seperti masa berlaku dan perlindungan kata sandi opsional; permintaan diselesaikan melalui instans dan dapat dicabut |
| Tinjauan dan pengiriman | Konten yang diajukan, keputusan persetujuan, tujuan terpilih, file yang di-staging, dan tanda terima pengiriman |
| Render dan batch di server | Input alat yang diajukan, permintaan render, status, dan file keluaran yang dipertahankan. Pekerjaan ini berjalan di server, bukan di perangkat Anda |
| Pelaporan penggunaan | Label peristiwa dalam daftar izin seperti id alat, format, dan id aset, sesuai kebijakan telemetri di bawah |
| Audit | Catatan pelaku dan aksi untuk operasi yang diatur, disimpan terpisah dari telemetri penggunaan |

Layanan ini memakai cookie autentikasi, termasuk `lw_session` untuk anggota yang login dan `lw_guest` untuk akses tamu bila diaktifkan, terpisah dari cookie layanan sertifikat. Penyegaran kebijakan dan pelaporan penggunaan yang diaktifkan dapat membuat permintaan selama aplikasi dipakai, tanpa klik terpisah untuk masing-masing. Ini adalah lalu lintas ke instans yang dikonfigurasi, bukan laporan ke proyek Lolly tentang deployment yang tidak dijalankannya.

**Telemetri penggunaan memiliki tiga tingkat.** `off` tidak menyimpan peristiwa penggunaan, `aggregate` membuang id pengguna, dan `standard` dapat mengaitkan peristiwa. Tingkat default adalah `standard`, jadi instans menyimpan peristiwa penggunaan yang diterimanya kecuali operatornya memilih `off`. Kebijakan atribusi default adalah `opt-in`, yang memerlukan persetujuan Anda sebelum id pengguna disimpan; operator dapat sebagai gantinya mengonfigurasi pelaporan beratribusi dengan `telemetryAttribution: default`. Atribut yang diizinkan adalah label, bukan nilai input alat. Lihat [Work telemetry](/info/work-telemetry.html).

**Audit terpisah.** Aksi yang diatur dapat menyimpan catatan audit teridentifikasi apa pun persetujuan telemetri Anda. Mematikan telemetri tidak mematikan penyimpanan sesi bersama, catatan persetujuan, penyimpanan pekerjaan render, atau audit. Operator mengendalikan retensi dan penghapusan, termasuk pseudonimisasi log audit; lihat [Work storage and data lifecycle](/info/work-data-lifecycle.html).

| | Perangkat Anda | Instans organisasi Anda |
|---|---|---|
| Apa yang disimpan | Pekerjaan pribadi, preferensi, dan cache Anda | Pekerjaan bersama, akun, unggahan, persetujuan, render, audit, dan telemetri yang dikonfigurasi |
| Siapa yang menghapus | Anda, dengan **Clear all my data** atau data situs browser Anda | Operator, melalui kontrol instans itu sendiri |
| Kepada siapa bertanya | Tidak ada: catatan ada di perangkat Anda | Operator instans, untuk akses, ekspor, atau penghapusan |

**Penghapusan lokal bukan penghapusan di server.** Meninggalkan instans atau membersihkan browser Anda menghapus status lokal, bukan catatan atau cadangan yang disimpan organisasi. [Sync](/info/sync.html) pribadi dan **Export my data** mencadangkan perangkat Anda, bukan layanan organisasi. Demo publik [lolly.work](https://lolly.work) menyimpan statusnya hanya di memori dan bukan penyimpanan tahan lama untuk pekerjaan Anda.

## Ekstensi peramban

Ekstensi browser **Lolly URL Screenshot** tidak mengumpulkan data pribadi untuk kami. Ekstensi ini tidak memiliki analitik, pelacakan, atau server sendiri. Halaman [Browser extension](/info/extension.html) menjelaskan cara kerjanya.

**Apa yang dilakukannya.** Aplikasi web Lolly dapat memintanya untuk tangkapan layar halaman web, atau isi halaman untuk memulai design system dari sebuah situs web. Setiap permintaan membuka jendela persetujuan di ekstensi yang menampilkan situs peminta, apakah ia menginginkan tangkapan layar atau isi halaman, dan alamat halaman. Hanya setelah Anda menekan **Approve once** ekstensi membuka halaman itu di tab latar belakang sementara, mengambil tangkapan layar atau membaca halaman, menyerahkan hasilnya ke tab Lolly yang meminta, dan menutup tab. Setiap permintaan memerlukan persetujuannya sendiri.

**Data.**

- <!--i:shieldcheck--> **Kami tidak mengumpulkan apa pun.** Hasil hanya diberikan ke halaman Lolly yang meminta, di browser yang sama. Ekstensi tidak menyimpan isi halaman dan tidak menambahkan penerima lain.
- <!--i:globe--> **Permintaan jaringan.** Halaman yang Anda setujui dimuat seperti di tab mana pun, beserta apa pun yang diminta halaman itu sendiri. Membaca isi halaman juga mengambil stylesheet halaman itu dan beberapa gambar ikon serta logonya, dari dalam halaman, dan pengambilan itu tidak mengirim cookie ke situs lain. Ekstensi tidak membuat permintaan lain, dan tidak ada yang menuju server Lolly.
- <!--i:lock--> **Sesi browser Anda.** Halaman dimuat dengan sesi browser Anda, seolah Anda membukanya sendiri, jadi halaman tempat Anda login dapat menaruh informasi pribadi di dalam hasilnya.
- <!--i:link--> **Alamat yang Anda setujui** dipakai hanya untuk memuat satu halaman itu untuk satu permintaan itu. Alamat tidak dicatat dalam log atau dibagikan.

**Izin.**

- <!--i:wrench--> **`debugger`**: untuk mengambil tangkapan layar melalui DevTools Protocol, mekanisme yang sama yang dipakai aplikasi desktop Lolly.
- <!--i:monitor--> **`tabs`**: untuk membuka dan menutup tab sementara, dan memeriksa bahwa baik halaman Lolly maupun halaman target belum berpindah sejak Anda menyetujui.
- <!--i:code--> **`scripting`**: untuk membaca isi halaman di tab sementara, setelah Anda menyetujui permintaan itu.
- <!--i:database--> **`storage`**: untuk mencatat id tab sementaranya di session storage, agar tab tetap tertutup bila browser menghentikan ekstensi selama permintaan. Tidak ada isi halaman yang disimpan.
- <!--i:check--> **Akses situs opsional (`http://*/*`, `https://*/*`)**: tidak diberikan saat instalasi. Saat Anda menekan **Approve once**, ekstensi meminta Chrome akses ke satu situs dalam permintaan itu, dan Chrome menanyakan Anda pertama kali untuk setiap situs. Situs yang pernah Anda izinkan tetap memerlukan persetujuan baru untuk setiap permintaan.

Tidak satu pun dari ini dipakai untuk membaca, memantau, atau mengirimkan aktivitas penjelajahan Anda di luar satu permintaan yang Anda setujui.

## Host pengiriman dan pemroses

File katalog publik, alat, dan rendisi tampilan berasal dari alamat aplikasi itu sendiri secara default. Nama yang beralamat konten mengubah dari mana file diambil, bukan siapa yang menerima permintaan. Tidak ada CDN pihak ketiga yang diaktifkan oleh fitur pengiriman ini. CDN yang mengakhiri TLS akan menerima detail permintaan, termasuk alamat IP dan cookie atau kredensial bearer apa pun yang diteruskan kepadanya, bahkan di bawah nama host browser yang sama, jadi operator yang menambahkannya menanggung pemroses baru.

**Sebelum menambahkan CDN atau host model eksternal apa pun**, administrator harus menerbitkan nama pemroses, nama host, yurisdiksi, metadata yang diterima, retensi, dan pengaturan transfer. [Delivery deployment](/info/deploy-delivery.html) mencantumkan apa yang perlu diungkapkan. Respons ruang kerja privat melewati cache bersama: hasil pribadi, penolakan akses, dan kesalahan memakai `private, no-store`, dan respons privat yang diizinkan dapat divalidasi ulang di browser Anda tanpa menjadi publik.

Layanan referensi memakai hosting di bawah ini. Ini adalah daftar nama host, bukan klaim bahwa instans organisasi lain memakai wilayah yang sama.

| Nama host atau layanan | Fungsi dan penerima | Wilayah dan penanganan data |
|---|---|---|
| lolly.tools | Aplikasi publik, katalog, rendering, dan layanan sertifikat; hosting UpCloud | Frankfurt, Jerman. Detail permintaan dapat muncul di log infrastruktur; penyuntingan lokal biasa tetap di perangkat |
| lolly.ing | Layanan ruang kerja terkelola dan agen dokumen; hosting UpCloud | Frankfurt, Jerman. Database privat dan penyimpanan file berada di host yang sama. Akun, konten bersama, dan catatan layanan mengikuti kebijakan administrator instans |
| mcp.lolly.tools | Gateway MCP terautentikasi opsional yang direncanakan dan unduhan hasil privat; hosting UpCloud | Frankfurt, Jerman, dengan pemroses hosting yang sama. Aktivasi tertunda. Gateway akan menerima detail permintaan dan parameter atau file yang dikirim pemanggilnya |
| lolli.li | File rilis dan model publik; UpCloud Managed Object Storage, terpisah dari klaster aplikasi | Frankfurt, Jerman, di wilayah penyimpanan objek europe-2 UpCloud. Unduhan mengirim detail permintaan, bukan input yang kemudian diproses model |
| Penyedia identitas yang dikonfigurasi | Google, GitHub, atau penyedia OIDC milik operator | Login mengikuti kebijakan penyedia itu. Tanyakan kepada operator instans untuk nama host, wilayah, dan pengaturan transfer |
| Penyedia aset yang dikonfigurasi | Brandfolder atau pustaka lain yang dipilih operator | Penyedia menerima permintaan pustaka yang diizinkan. Izin sumbernya dan kebijakan instans mengatur akses; tanyakan kepada operator untuk nama host dan wilayahnya |
| Pendaftaran email, bila dikonfigurasi | Resend mengirimkan tautan login yang diminta | Menerima alamat email tujuan untuk pesan itu; ketentuan pemrosesannya sendiri berlaku |

Aplikasi referensi tidak memakai hosting, database, atau penyedia kontrol penyalahgunaan lain. Operator dapat memilih penyedia lain untuk instans yang berbeda, dan penyedia hosting, identitas, aset, dan email masing-masing memerlukan pengungkapan sendiri. [Wilayah penyimpanan objek](https://upcloud.com/docs/products/managed-object-storage/availability/) host model diverifikasi terpisah dari wilayah aplikasi.

**Tautan unduhan MCP opsional yang terikat pada prinsipal.** Operator dapat mengaktifkan tautan unduhan untuk hasil besar pada gateway terautentikasi berreplika tunggal. Tautan ini mati secara default. Gateway anonim di `lolly.tools/api/mcp` mengembalikan hasil secara inline dan tidak pernah menerbitkan tautan ini. Nama host terbatas yang direncanakan adalah `mcp.lolly.tools`, pada pemroses UpCloud yang sama di Frankfurt; aktivasi tertunda, dan halaman ini tidak mengklaim adanya layanan tautan unduhan yang aktif. Tautan tidak menambahkan CDN pihak ketiga.

Hanya pemanggil terautentikasi dengan scope file yang dapat menerima tautan, dan bearer pemanggil yang sama diperlukan untuk mengambilnya: gunakan bearer tervalidasi dari panggilan render, bukan token lain untuk akun yang sama. Pemberian akses kedaluwarsa dalam 300 detik. Kepemilikan dan pencarian hasil tetap di memori gateway, dan byte keluaran masuk ke file sementara privat, dipangkas setelah kedaluwarsa atau dihapus saat shutdown yang bersih. Restart gateway membatalkan tautan yang ada. Hasil yang ditahan dibatasi 64 MiB per bearer, 256 MiB di seluruh gateway, dan 200 file tertunda atau ditahan. Anggaran CPU harian dan byte terdekode menghitung hasil saat ditahan dan saat diunduh. Respons memakai `private, no-store` dan `Referrer-Policy: no-referrer`. Token tautan saja tidak memungkinkan orang atau agen lain membaca hasilnya.

## Log infrastruktur

Bagian ini menjelaskan deployment publik lolly.tools. Platform hostingnya mencatat detail permintaan biasa: alamat IP, path yang diminta, stempel waktu, dan user agent. Suntingan lokal tidak mencapai host itu. Query string tautan render dapat berisi teks yang diberikan pemanggilnya, seperti dijelaskan di atas. Alat file MCP memproses byte yang diberikan di memori. Instans Lolly Work juga menyimpan catatan yang dijelaskan di atas, di bawah kebijakan logging operatornya.

**Layanan publik menjaga logging aplikasi seminimal mungkin.** Server MCP mencatat start-up, konfigurasi, dan peringatan rendering; ia tidak menyimpan log permintaan sendiri dan tidak mencatat token atau alamat pemanggil. Pass-through Penpot mencatat nama setiap perintah dan status respons Penpot, tidak pernah header, token, atau file. Layanan sertifikat mencatat pengaturan start-up dan peringatan konfigurasinya, ditambah dua baris yang dibersihkan saat gagal: kode status kegagalan pengiriman tanpa alamat penerima, dan baris kegagalan tetap tanpa teks kesalahan, stack trace, atau URL, karena kesalahan penyedia dapat membawa nilai identitas atau kredensial. Semua yang lain di log berasal dari platform hosting.

Untuk lolly.tools, administrator instans mengendalikan logging permintaan, rotasi, dan retensi di UpCloud. Halaman ini tidak menyatakan periode retensi log maksimum yang belum diverifikasi. Hubungi pengendali di bawah untuk jadwal terkini dan untuk permintaan apa pun tentang log yang disimpan server. Untuk instans lain, pengaturan operatornya berlaku, termasuk ekspor log atau pemroses lain.

## Dasar hukum, retensi dan penerima

Tabel ini mencakup deployment referensi **lolly.tools**. Tabel ini tidak menyatakan dasar hukum atau periode retensi instans Lolly Work organisasi Anda; operatornya menyediakannya dalam kebijakannya sendiri.

| Pemrosesan | Dasar hukum (GDPR Art. 6) | Disimpan selama |
|---|---|---|
| Semua yang ada di perangkat Anda (dokumen, preferensi, cache, penghitung) | **Bukan pemrosesan kami sama sekali**: tidak pernah sampai kepada kami. Penyimpanan di perangkat Anda benar-benar diperlukan untuk layanan yang Anda minta (ePrivacy Art. 5(3)), jadi tidak memerlukan persetujuan | Sampai Anda menghapusnya |
| Alamat email Anda selama pendaftaran Content Credentials hosted lama | **Art. 6(1)(b)**, pelaksanaan layanan yang Anda minta secara eksplisit | Tidak ada inventaris identitas atau log penerbitan di layanan lama; email dipakai selama permintaan dan disertakan dalam sertifikat Anda. Retensi PKI, audit, dan pencabutan organisasi terkelola mengikuti kebijakan operatornya |
| Digest SHA-256 pseudonim yang dibuat dari alamat IP Anda, untuk pembatasan laju endpoint login dan endpoint render, gambar, dan MCP publik | **Art. 6(1)(f)**, kepentingan sah kami dalam mencegah penyalahgunaan layanan gratis dan kuota email pihak ketiga. Kami menilai ini lolos uji keseimbangan karena alamat mentah tidak dikirim ke pembatas, digest hanya dipakai untuk kontrol penyalahgunaan, dan kedaluwarsa dengan sendirinya | Sekitar satu menit di penyimpanan kontrol penyalahgunaan; tidak disimpan sesudahnya |
| Log akses hosting (IP, path, stempel waktu, user agent) | **Art. 6(1)(f)**, kepentingan sah kami dalam keamanan layanan, pencegahan penyalahgunaan, dan diagnosis gangguan | Rotasi dan retensi yang dikonfigurasi administrator; hubungi pengendali untuk jadwal terkini |

**Penerima.** Kategori penerima adalah penyedia hosting kami (UpCloud), yang menghosting database aplikasi dan penyimpanan kontrol penyalahgunaan, dan, hanya jika Anda memakai opsi login email, penyedia email transaksional (Resend). Penyimpanan kontrol penyalahgunaan hanya menerima digest berumur pendek, tidak pernah alamat IP mentah. Jika Anda login dengan GitHub, Google, atau SUSE (id.suse.com), Anda berurusan langsung dengan penyedia itu di bawah kebijakan privasi mereka sendiri, dan mereka memberi tahu kami alamat email terverifikasi dan tidak ada yang lain. Kami tidak membagikan data pribadi kepada pihak lain mana pun, dan kami tidak menjual data, menjalankan iklan, atau membuat profil pengguna.

**Transfer ke luar EEA.** Hosting, database, dan penyimpanan file aplikasi referensi berada di Frankfurt. Penyedia identitas, email, dan aset yang opsional memiliki lokasi pemrosesan dan ketentuan sendiri, yang dapat mencakup akses dari luar EEA, dan wilayah server saja tidak menetapkan yurisdiksi setiap penerima. Hubungi pengendali untuk perjanjian penyedia dan pengaturan transfer yang berlaku; untuk instans lain, tanyakan kepada operatornya. [Standard Contractual Clauses](https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/standard-contractual-clauses-scc_en) Komisi Eropa adalah salah satu pengamanan yang tersedia untuk transfer semacam itu; halaman ini tidak mengklaim bahwa perjanjian penyedia yang belum diverifikasi memakainya.

**Pengambilan keputusan otomatis.** Tidak ada. Tidak ada pembuatan profil dan tidak ada keputusan otomatis dengan akibat hukum atau akibat signifikan serupa (Art. 22).

## Privasi anak

Penggunaan aplikasi lokal biasa tidak mengirim konten pribadi ke lolly.tools. Pendaftaran Content Credentials opsionalnya menerima alamat email dan tidak ditujukan atau dimaksudkan untuk anak-anak. Layanan organisasi memiliki akun dan penanganan data sendiri, di bawah kebijakan operatornya.

## Hak Anda

Untuk catatan yang hanya disimpan di perangkat Anda, Anda dapat mengakses, mengoreksi, menghapus, dan memindahkan data sendiri. Data berada di penyimpanan browser atau aplikasi Anda, dalam bentuk yang dapat Anda periksa, ekspor (**Export my data**, di atas) atau hapus (**Clear all my data**, atau data situs browser Anda).

Secara formal, menurut Pasal 15-22 GDPR Anda berhak untuk **mengakses** data pribadi Anda, **memperbaikinya**, **menghapusnya**, **membatasi** atau **menolak** pemrosesannya (termasuk apa pun yang kami dasarkan pada kepentingan sah), atas **portabilitas data** dan, bila pemrosesan bersandar pada persetujuan, untuk **menarik persetujuan itu kapan saja**, tanpa memengaruhi keabsahan apa yang terjadi sebelum Anda menarik persetujuan.

Layanan sertifikat publik tidak menyimpan log penerbitan. Log infrastruktur dapat berisi detail permintaan, jadi kebijakan ini tidak menjanjikan bahwa lingkungan hosting tidak menyimpan data pribadi. Hubungi pengendali untuk akses, penghapusan, atau permintaan lain tentang catatan tersebut; kami akan menjelaskan catatan apa yang ada dan apa yang dapat dilakukan. Untuk pekerjaan, identitas, telemetri, dan catatan audit yang disimpan organisasi, hubungi operator Lolly Work Anda, karena kontrol ekspor dan penghapusan lokal tidak menjangkau salinan tersebut.

**Anda berhak mengajukan keluhan.** Jika Anda menilai kami menangani data Anda secara tidak patut, Anda dapat mengajukan keluhan kepada otoritas pengawas perlindungan data: di UE, otoritas di negara tempat tinggal Anda, tempat kerja, atau tempat Anda yakin pelanggaran terjadi (Art. 77). Otoritas pengawas utama kami adalah *Bayerisches Landesamt für Datenschutzaufsicht* (BayLDA) di Ansbach, Jerman. Anda tidak perlu menghubungi kami terlebih dahulu, meskipun kami ingin diberi kesempatan memperbaiki masalahnya.

## Perubahan pada kebijakan ini

Tanggal di bagian atas berubah setiap kali dokumen ini berubah. Perubahan yang mengubah apa yang meninggalkan perangkat Anda atau apa yang disimpan mendapat barisnya sendiri di sini, bukan suntingan diam-diam. Untuk melihat apa yang berubah, tanyakan (di bawah) atau bandingkan dengan [sumber publik](https://github.com/lolly-tools/lolly/commits/main/docs/privacy.md).

**29 September 2026:** memperjelas layanan lolly.work yang opsional, konten yang disimpan organisasi, cookie autentikasi, telemetri penggunaan dan catatan audit, serta pemisahan antara penghapusan lokal dan retensi di server. Ini adalah alur kerja opsional yang sudah ada, bukan kewajiban unggah baru untuk penyuntingan lokal.

**11 Oktober 2026:** mengganti deskripsi hosting Vercel yang telah dihentikan dengan inventaris nama host aplikasi UpCloud, membedakan penyedia identitas dan aset yang opsional, serta menjelaskan pengiriman beralamat konten dan mode unduhan MCP yang ditahan. Tidak ada CDN pihak ketiga yang diaktifkan oleh perubahan ini. Retensi log dikendalikan administrator, bukan default paket Vercel yang dinyatakan.

**22 Oktober 2026:** mengoreksi deskripsi perilaku yang sudah ada. Bagian ekstensi browser kini mencakup jendela persetujuan untuk setiap permintaan, akses situs yang diminta satu situs per satu waktu, dan pengambilan stylesheet serta ikon saat membaca situs web. Dikoreksi juga: baris Send to Google Drive dan Meeting Planner, catatan SEAL (tidak ada aplikasi Lolly yang mencari kunci SEAL di DNS), tingkat telemetri penggunaan default layanan organisasi, alat gambar MCP, dan logging aplikasi layanan publik. Perangkat lunaknya sendiri tidak berubah.

**23 Oktober 2026:** menata ulang kebijakan menurut apa yang memulai setiap permintaan, dan menjelaskan perilaku yang sudah ada yang sebelumnya belum tercakup: undangan collab privat yang membawa alamat jaringan lokal, Nearby di aplikasi desktop, Allow AI control, membaca design system dari sebuah situs web, set emoji, cache di perangkat untuk pencarian kota Meeting Planner, Tempat Sampah, dan catatan lain yang dicantumkan Settings → Storage. Dikoreksi dua pernyataan: Bluesky dan Discord tidak hanya untuk desktop, dan setiap host yang dipilih seseorang untuk pengiriman memerlukan persetujuan operator di aplikasi web maupun desktop; digest alamat IP untuk pembatasan laju bersifat pseudonim, bukan anonim. Perangkat lunaknya sendiri tidak berubah.

## Siapa yang bertanggung jawab, dan cara menghubungi kami

**Pengendali data** untuk lolly.tools adalah:

> SUSE Software Solutions Germany GmbH
> Frankenstraße 146
> 90461 Nürnberg
> Germany

SUSE telah menunjuk seorang **Data Protection Officer**, yang dapat dihubungi di [privacy@suse.com](mailto:privacy@suse.com). Gunakan alamat itu untuk permintaan formal apa pun berdasarkan "Hak Anda" di atas.

Untuk apa pun tentang Lolly itu sendiri, seperti cara kerjanya, mengapa sesuatu seperti adanya, atau koreksi untuk dokumen ini, hubungi **Andy Fitzsimon**, [fitzy@suse.com](mailto:fitzy@suse.com).

Untuk instans Lolly yang di-host sendiri atau enterprise, hubungi siapa pun yang mengoperasikannya: operator adalah pengendali untuk deployment mereka sendiri. SUSE dan proyek sumber terbuka Lolly tidak menyimpan data untuk deployment yang tidak mereka jalankan.
