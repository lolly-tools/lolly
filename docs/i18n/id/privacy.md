# Kebijakan Privasi

*Terakhir diperbarui: 11 Agustus 2026*

> **Versi singkatnya.** Dokumen, gambar, video dan file yang Anda buat di Lolly tetap
> berada di perangkat Anda. Tidak ada akun untuk penggunaan biasa, tidak ada cookie dari
> aplikasi itu sendiri dan tidak ada analitik atau pelacak di mana pun dalam kodebase - ini
> bukan "kami tidak menggunakan data," tetapi memang benar-benar tidak ada dalam source.
> Ada daftar singkat dan lengkap tentang pengecualian di mana software ini berbicara
> dengan jaringan sama sekali, dan tiap pengecualian dijelaskan secara rinci di bawah:
> apa yang keluar, kepada siapa dan kapan. Satu-satunya pengecualian yang melibatkan
> sesuatu yang bersifat pribadi adalah proses masuk yang harus Anda mulai secara
> eksplisit. Jika tidak tercantum dalam dokumen ini, itu tidak terjadi.

## Cakupan kebijakan ini

Lolly adalah perangkat lunak sumber terbuka - sebuah engine, beberapa app shell (web, desktop,
mobile, CLI) dan ekstensi peramban - yang dapat dijalankan oleh siapa saja. Kebijakan ini memiliki dua
bagian:

- <!--i:code--> **Perangkat lunak itu sendiri**: apa yang dilakukan dan tidak dilakukan dengan data Anda, di mana pun ia
  dijalankan. Ini adalah properti dari kode, jadi berlaku untuk setiap deployment Lolly,
  milik kami maupun milik orang lain.
- <!--i:server--> **lolly.tools**, deployment referensi yang dioperasikan SUSE: pilihan-pilihan spesifik
  dalam menjalankan bagian sisi-server opsionalnya (apa yang dicatat, berapa lama, oleh
  siapa).

Jika Anda menggunakan instans Lolly self-hosted atau enterprise, perilaku perangkat lunak
di bawah tetap berlaku, tetapi *operator* instans tersebut - bukan SUSE - yang
bertanggung jawab atas apa pun yang bersifat sisi-server: render endpoint mereka, MCP server mereka,
certificate authority Content Credentials mereka, jika mereka menjalankan salah satu. Tanyakan kepada mereka
kebijakan mereka sendiri. Lihat [Adoption & Governance](/info/adoption-governance.html) untuk
apa saja yang terlibat dalam mengoperasikan Lolly.

## Aplikasi: apa yang tetap ada di perangkat Anda

Web, desktop dan mobile shell Lolly menjalankan seluruh render engine di sisi klien.
Membuka tool, mengisi input, melakukan pratinjau dan mengekspor semuanya terjadi di
perangkat Anda - tidak ada server yang terlibat, dan aplikasi bekerja secara offline setelah dimuat.

**Aplikasi tidak menetapkan cookie apa pun.** Untuk berfungsi, aplikasi menyimpan sejumlah kecil data **hanya di
perangkat Anda**, tidak pernah dikirimkan:

- <!--i:sliders--> **Preferensi antarmuka** - tema, bahasa, pengaturan suara, ukuran sidebar/zoom,
  pilihan urutan dan tampilan, tip onboarding mana yang sudah Anda lihat - di
  `localStorage`, sehingga tersedia sebelum aplikasi selesai booting.
- <!--i:download--> **Cache offline dari katalog tool dan pratinjau aset**, sehingga galeri
  bekerja tanpa koneksi.
- <!--i:hash--> **Penghitung penggunaan lokal** untuk statistik kartu profil Anda (berapa banyak ekspor, tool
  mana) - blob kecil berbatas di `localStorage`, tidak pernah dibaca oleh kami, tidak pernah dikirim
  ke mana pun.
- <!--i:folder--> **Dokumen Anda sendiri, sesi tersimpan, aset dan font yang diunggah** - disimpan di
  IndexedDB di perangkat Anda, tidak pernah diunggah, tidak pernah dibaca oleh siapa pun selain Anda.

Tak satu pun dari ini dibagikan, dijual, atau digunakan untuk mengidentifikasi atau melacak Anda. Tidak ada
yang perlu disetujui, karena tidak ada pengumpulan data yang terjadi - hanya pemberitahuan ini, agar Anda
tahu apa yang disimpan dan di mana. Hapus semuanya kapan saja dengan **Profile → Clear all
my data**, atau dengan menghapus penyimpanan situs di peramban Anda. (Berdasarkan ePrivacy
Directive Art. 5(3), penyimpanan yang benar-benar diperlukan untuk layanan yang Anda minta
tidak memerlukan persetujuan - hanya transparansi, yang merupakan tujuan dari dokumen ini dan
pemberitahuan dalam aplikasi.)

![Bagian penyimpanan pada halaman profil di layar lebar ponsel: setiap kategori data on-device disebutkan, dengan tombol Clear all my data tepat di sampingnya](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-manages%2C.storage-subsection%2C.store-selbar%2C.store-chip-val%2C%23store-hero-num%2C%23store-headroom%2C%23store-quota%2C%23store-reclaim%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

Backup data Anda sendiri - bundel `lolly-backup` yang dihasilkan oleh **Export my
data & render everything** - adalah file yang Anda simpan dan kendalikan sendiri. File itu tidak pernah menyentuh server kami
kecuali Anda sendiri memilih untuk mengirimkannya ke suatu tempat. Lihat [Data
Transfer](/info/data-transfer.html).

## Utilitas on-device

Beberapa tool - **Strip Hidden Data**, **Compress PDF** dan lainnya yang membawa
badge **"Runs on your device"** - beroperasi pada file yang Anda berikan. File dibaca
ke dalam memori di peramban Anda, ditransformasi secara lokal dan disediakan kembali sebagai unduhan.
File itu tidak pernah diunggah, karena tidak ada server dalam jalurnya untuk diunggah ke sana.
Utilitas ini bekerja secara offline, dan keluarannya tidak membawa watermark atau metadata
kami - tujuan sebagian besar tool ini adalah menghapus & melindungi data, bukan menambah risiko.

![Badge yang dibawa tool-tool ini: Runs on your device - tidak ada yang diunggah](/t/url-shot?url=%2F%23%2Ftool%2Fstrip-data&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=.on-device-badge&dark=1&filename=pv-ondevice-badge)

## Saat aplikasi berkomunikasi dengan jaringan, secara lengkap

Tabel di bawah adalah daftar lengkap segala sesuatu yang diambil atau dikirim aplikasi melalui
jaringan. Jika tidak ada di sini, aplikasi tidak melakukannya.

| Apa | Apa yang benar-benar meninggalkan perangkat Anda | Kapan (tindakan yang memicunya) | Jika operator memblokirnya |
|---|---|---|---|
| Sinkronisasi katalog alat | Tidak ada yang bersifat pribadi - permintaan untuk indeks alat dan aset publik milik Lolly sendiri, ke origin milik aplikasi itu sendiri | Saat startup, lalu di-cache untuk offline | Aplikasi berjalan dengan kumpulan alat yang di-cache. Aplikasi hanya berhenti menemukan alat baru |
| Alat yang memerlukan data langsung | Apa pun yang diminta oleh alat tersebut secara spesifik, ke host yang disebutkan dalam deskripsinya sendiri. Saat ini itu hanya pencarian kota di alat Meeting Planner, yang meminta `geocoding-api.open-meteo.com` untuk mengubah nama kota menjadi koordinat dan zona waktu - tanpa akun, tanpa kunci, dan tanpa identifier selain permintaan itu sendiri. Input menyatakannya tepat di tempat Anda mengetik, dan setiap jawaban disimpan di perangkat Anda sehingga sebuah kota hanya dicari sekali | Hanya saat menggunakan alat tersebut, dan hanya setelah Anda memasukkan sebuah lokasi | Pencarian tersebut gagal. Anda tetap bisa mengetik koordinat secara manual, dan tidak ada yang lain yang terpengaruh |
| Google Fonts | Nama keluarga font yang dipilih dan alamat IP Anda, ke server font Google (`fonts.googleapis.com` untuk stylesheet, `fonts.gstatic.com` untuk berkas font) | Hanya jika Anda menambahkan sebuah Google Font di editor brand, **dan hanya setelah Anda menyetujuinya dalam sebuah dialog yang menyatakan persis ini** - satu kali pengambilan per keluarga font, lalu tersimpan di perangkat Anda dan digunakan secara offline | Pemilih Google Fonts gagal secara tertutup (fail closed). Unggah berkas font Anda sendiri sebagai gantinya |
| Kirim ke Google Drive | Satu berkas yang Anda pilih untuk dikirim, ke Drive API milik Google (`www.googleapis.com`), setelah Anda menyelesaikan sign-in Google di jendela popup Google sendiri. Akses Lolly dibatasi pada berkas yang dibuatnya sendiri (scope `drive.file` - Lolly tidak pernah bisa membaca sisa Drive Anda), dan token sign-in disimpan di memori hanya untuk sesi tersebut, tidak pernah disimpan permanen | Hanya saat Anda menekan "Send to Google Drive" pada sebuah ekspor EMF, dan hanya pada build tempat operator telah mengonfigurasi sebuah client id Google - tanpa itu, tombolnya tidak ada | Tombolnya tidak pernah muncul. Unduh berkasnya dan unggah sendiri ke Drive |
| Kirim ke Dropbox | Satu berkas yang Anda pilih untuk dikirim, ke API Dropbox (`api.dropboxapi.com` untuk sign-in dan metadata, `content.dropboxapi.com` untuk berkas itu sendiri), setelah Anda menyelesaikan sign-in Dropbox di jendela Dropbox sendiri. Akses Lolly hanya sebatas app-folder (Lolly hanya bisa melihat `Apps/` dan foldernya sendiri di sana - tidak pernah sisa Dropbox Anda), tautan "Open" yang ditampilkan adalah tautan privat berumur pendek (tidak ada share publik yang dibuat), dan refresh token hanya disimpan jika Anda mencentang "stay connected" | Hanya saat Anda menekan "Send to Dropbox" pada sebuah berkas, dan hanya pada build tempat operator telah mengonfigurasi sebuah client id Dropbox - tanpa itu, tombolnya tidak ada | Tombolnya tidak pernah muncul. Unduh berkasnya dan unggah sendiri ke Dropbox |
| Kirim ke OneDrive | Satu berkas yang Anda pilih untuk dikirim, ke layanan identitas dan Graph milik Microsoft (`login.microsoftonline.com` untuk sign-in, `graph.microsoft.com` untuk unggahan; berkas besar diunggah dalam chunk ke alamat unggah milik Microsoft di `api.onedrive.com`, `*.up.1drv.com` atau `*.sharepoint.com`), setelah Anda menyelesaikan sign-in Microsoft di jendela Microsoft sendiri. Akses Lolly dibatasi pada foldernya sendiri di bawah `Apps/` (Lolly tidak pernah bisa membaca sisa OneDrive Anda) ditambah nama tampilan Anda untuk label akun, dan refresh token hanya disimpan jika Anda mencentang "stay connected" | Hanya saat Anda menekan "Send to OneDrive" pada sebuah berkas, dan hanya pada build tempat operator telah mengonfigurasi sebuah client id Microsoft - tanpa itu, tombolnya tidak ada | Tombolnya tidak pernah muncul. Unduh berkasnya dan unggah sendiri ke OneDrive |
| Kirim ke LinkedIn | Satu berkas yang Anda pilih untuk dikirim, beserta namanya sebagai teks postingan, ke LinkedIn (`www.linkedin.com` untuk sign-in, `api.linkedin.com` untuk unggahan dan postingan), setelah Anda menyelesaikan sign-in LinkedIn di browser Anda sendiri. Postingan tersebut masuk ke feed Anda sendiri sebagai sebuah postingan publik atas nama Anda. Lolly dapat memposting atas nama Anda dan membaca nama Anda untuk label akun, tidak ada yang lain di LinkedIn Anda, dan sign-in tersebut hanya disimpan di perangkat ini jika Anda mencentang "stay connected" - token LinkedIn berlaku 60 hari dan tidak dapat diperbarui secara diam-diam, sehingga akan kedaluwarsa dengan sendirinya | Hanya saat Anda menekan "Send to LinkedIn" pada sebuah berkas, hanya di aplikasi desktop, dan hanya pada build tempat sebuah aplikasi LinkedIn telah dikonfigurasi - tanpa itu, tombolnya tidak ada | Tidak ada yang perlu diblokir di aplikasi web: ini hanya ada di **aplikasi desktop**, sehingga kedua host tersebut secara sengaja TIDAK ada dalam Content-Security-Policy aplikasi web di bawah ini. Di aplikasi desktop, hapus aplikasi LinkedIn yang dikonfigurasi dan tombolnya tidak akan pernah muncul |
| Profil cetak ICC | Tidak ada yang bersifat pribadi - permintaan untuk sebuah profil kondisi-cetak standar, ke registri publik ICC (`registry.color.org`, `www.color.org`) | Hanya jika Anda mengklik sebuah preset ICC di pengelola profil cetak - satu kali pengambilan per profil, lalu tersimpan di perangkat Anda | Preset ICC gagal. Sediakan profil `.icc` Anda sendiri sebagai gantinya |
| Radio internet | Tidak ada yang bersifat pribadi - permintaan daftar putar dan stream audio, ke stasiun (`api.somafm.com` dan server icecast yang disebutkannya, `*.somafm.com`) | Hanya saat Anda memutar radio bawaan opsional di pemutar suara | Radio gagal. Semua fitur suara lainnya tetap berfungsi |
| URL yang Anda minta sebuah alat untuk menangkap | Sebuah permintaan ke alamat web persis yang Anda ketik, dari alat screenshot URL. Apa pun alamat itu. Host ini tidak ada dalam kebijakan di bawah, karena Anda memilihnya pada saat penggunaan | Hanya saat Anda memasukkan sebuah URL di alat tersebut dan memulai penangkapan | Operator tidak bisa mengizinkan ini berdasarkan host (allowlist). Untuk menghapusnya, hapus alatnya |
| Pemeriksaan tanda tangan SEAL | **Tidak ada.** Aplikasi web sama sekali tidak memiliki resolver DNS - lihat di bawah | Tidak pernah | Tidak ada yang perlu diblokir |
| Model AI di perangkat | Tidak ada yang bersifat pribadi - unduhan berkas model satu kali dari host model milik Lolly (`lolli.li`), lalu di-cache di perangkat Anda; tanpa akun, tanpa identifier, hanya permintaan dan alamat IP Anda | Hanya saat Anda menggunakan sebuah fitur yang memerlukan model (Verify deep scan, image upscale, speech, dan sejenisnya) | Fitur tersebut menunggu unduhan; semua yang lain tetap berfungsi |
| Instans jarak jauh | Apa pun yang dikembalikan oleh instans yang Anda sebutkan, melalui sinkronisasi katalog yang sama seperti dijelaskan di atas - ditambah sebuah tag versi pada permintaan ke instans tersebut (jenis shell dan versi engine, informasi yang sama seperti yang dibawa oleh user agent), sehingga operatornya dapat melihat versi Lolly mana saja yang ada di lapangan. Pada instans terkelola, selama Anda masuk (signed in), tag tersebut juga membawa sebuah id instalasi per perangkat sehingga daftar perangkat operator dapat membedakan instalasi ini. Tag itu hanya menumpang pada permintaan yang sudah dibuat oleh penggunaan Anda sendiri - tidak ada timer dan tidak ada yang menghubungi rumah (phone home) - dan meninggalkan instans tersebut menghapus id-nya, sehingga sebuah perangkat yang tersambung kembali nanti akan menampilkan id baru. Anda memilih host pada saat penggunaan, sehingga host ini tidak ada dalam kebijakan di bawah | Hanya jika Anda secara eksplisit mengarahkan shell ke deployment Lolly lain | Pergantian instans gagal. Instans lokal Anda tidak terpengaruh |

Setiap host tetap dalam tabel tersebut juga merupakan allowlist lengkap dalam Content-Security-Policy aplikasi, yang ditegakkan oleh browser. Jadi daftar ini bukan hanya deskripsi tentang apa yang dilakukan kode saat ini, melainkan batas yang dipertahankan browser terhadap aplikasi: sebuah perubahan di masa depan yang mencoba menghubungi host lain akan diblokir, bukan diizinkan secara diam-diam. Satu baris adalah pengecualian yang disengaja, dan selnya sendiri menyatakan demikian: Send to LinkedIn hanya ada di aplikasi desktop, sehingga kebijakan aplikasi web tidak menyebutkan salah satu dari kedua hostnya - aplikasi web tidak akan bisa menjangkaunya bahkan jika kodenya mencoba. Dua baris lagi tidak memiliki host tetap, karena Anda memilih alamatnya pada saat penggunaan: sebuah URL yang Anda minta sebuah alat untuk menangkap, dan sebuah instans jarak jauh yang Anda arahkan pada shell. Tidak satu pun ada dalam kebijakan, dan masing-masing hanya terjadi saat Anda mengetik sebuah alamat dan bertindak atasnya. Sebuah deployment yang tidak menginginkan satu pun dari yang opsional (misalnya sebuah instans enterprise dengan fontnya sendiri) menghapus host-host tersebut dari kebijakannya dan fitur-fiturnya gagal secara tertutup (fail closed) alih-alih menjangkau keluar.

Tak satu pun dari ini mengirim dokumen, proyek, sesi atau file yang Anda unggah ke mana pun.
Semua ini ada untuk membawa sesuatu *ke* perangkat Anda (tool, font, model), tidak pernah untuk mengirim
sesuatu *dari* perangkat Anda, dengan pengecualian yang disebutkan secara eksplisit di bagian-bagian di bawah.

**Catatan tentang apa yang kami hapus.** Verify dapat memeriksa tanda tangan SEAL, sebuah skema di mana
kunci penandatanganan sebuah file dipublikasikan di DNS. Peramban tidak dapat membuat query DNS, jadi implementasi
web apa pun harus merutekan pencarian melalui resolver DNS-over-HTTPS pihak ketiga -
yang akan memperlihatkan kepada operator itu domain yang diperiksa plus alamat IP Anda. Dulu kami
menggunakan milik Cloudflare. **Kami sudah tidak lagi menggunakannya, dan tidak ada
penggantinya**: aplikasi web sekarang tidak meneruskan resolver sama sekali, sehingga verifikasi SEAL
di sini tidak membuat permintaan jaringan sama sekali. File yang catatan SEAL-nya membawa kuncinya secara inline
tetap terverifikasi sepenuhnya secara offline. File yang kuncinya berada di DNS melaporkan "no key
resolver" sebagai gantinya, dan Anda dapat memeriksanya di aplikasi desktop atau command-line,
yang me-resolve DNS secara native melalui mesin Anda sendiri tanpa keterlibatan
pihak ketiga.

![Layar Verify: sebuah drop target dan tidak ada yang lain - file diperiksa di tempatnya sudah berada, tanpa unggahan dan tanpa akun](/t/url-shot?url=%2F%23%2Fverify&width=1440&height=900&dpi=192&waitMs=1400&walker=1&format=svg&cropSelector=.valid-layout&dark=1&filename=cc-verify-drop) Anda dapat memastikan sendiri: pemeriksaan yang dapat di-grep untuk ini dan setiap
klaim lain di halaman ini, dengan perintah persis dan keluaran yang diharapkan, ada di
[Verify It Yourself](/info/verify-yourself.html).

## URL render hot-linked

> **Aktif di lolly.tools.** Setiap
> URL `https://lolly.tools/tool/<tool-id>.<ext>?<inputs>` benar-benar merender,
> dan input-inputnya ikut dalam URL itu. Bagian di bawah menjelaskan apa artinya
> ini bagi Anda, dan seorang operator dapat mematikan fitur ini di instans
> miliknya sendiri.

Aplikasi itu sendiri tetap sepenuhnya di perangkat Anda. Secara terpisah, seorang operator dapat mengaktifkan
**URL render hot-link** - `/tool/<tool-id>.<ext>?<inputs>` - sehingga sebuah tautan Lolly yang dibagikan
dapat muncul sebagai gambar live di README, wiki atau dasbor. Mengambil salah satunya
meminta server merender **data tool dan katalog publik** dengan input yang
tertulis dalam URL.

- <!--i:usercheck--> **Tidak ada akun, tidak ada cookie, tidak ada state.** Endpoint ini anonim, dan tidak
  ada yang dibaca di perangkat Anda. Dokumen, sesi dan unggahan Anda tidak pernah
  keluar dari browser Anda - itu semua sama sekali tidak bisa muncul di link ini.
- <!--i:document--> **Tetapi URL itu sendiri tercatat.** Query string sebuah URL adalah bagian dari
  baris permintaan, jadi ia muncul di access log biasa milik platform hosting sama
  seperti setiap path yang diminta. Jika input sebuah link berisi nama atau email
  seseorang - sebuah name badge, sebuah signature email - maka **teks itu tersimpan di
  log tersebut**, dan tidak ada susunan kata kebijakan yang mengubahnya. Jadi URL hot-link
  adalah tempat yang salah untuk detail pribadi: berikan hanya apa yang akan Anda taruh di halaman publik.
- <!--i:globe--> **Input-input itu memang secara struktural bersifat publik** - apa pun isinya, penulis
  link itulah yang mengetiknya ke dalam URL, dan siapa pun yang menerima link itu
  dapat membacanya. Jangan taruh rahasia di link yang dibagikan. Lolly menawarkan
  enkripsi link untuk konten sensitif.
- <!--i:eyeoff--> Respons **di-cache dan dibatasi rate-nya** seperti gambar publik mana pun, dan
  ditandai `noindex` sehingga mesin pencari tidak mengindeks render Anda.

Self-hosting Lolly dan tidak ingin permukaan render publik? Setel
`LOLLY_DISABLE_RENDER_GET=1` dan setiap
URL ini mengembalikan 404.

## Server MCP (opsional, untuk agen AI)

Lolly juga dapat dijangkau oleh agen AI melalui Model Context Protocol - sebuah
endpoint yang dijalankan operator (lolly.tools menjalankan satu; siapa pun dapat self-host miliknya sendiri,
termasuk yang sepenuhnya air-gapped). Ini berbagi sikap tanpa-akun dari render path,
ditambah tiga tool yang secara inheren menangani byte file:

- <!--i:cpu--> **`lolly_transform`** (menjalankan utilitas on-device di sisi server, atas nama
  agen pemanggil), **`lolly_verify`** (memeriksa Content Credentials) dan **`lolly_redact`**
  (menghitamkan area sebuah gambar atau PDF) semuanya menerima
  byte file dari pemanggil. File-file ini diproses **in-process, di memori**,
  dan hasilnya dikembalikan dalam panggilan yang sama itu - file tidak pernah ditulis ke
  disk dan tidak pernah disimpan setelah permintaan selesai.
- <!--i:checklist--> Setiap tool lainnya - `lolly_render`, `lolly_build_url`, `lolly_list_tools`,
  `lolly_describe_tool` - bekerja hanya dari parameter (teks, angka, warna,
  URL, id aset katalog), input yang sama seperti yang diambil oleh URL render hot-link.
- <!--i:lock--> Akses berupa token bersama yang diterbitkan operator kepada klien yang mereka percayai, atau
  OAuth 2.1 tanpa state: token bertanda tangan berumur pendek yang diverifikasi terhadap sebuah
  secret bersama, tidak ada yang disimpan di sisi server dan token itu sendiri tidak pernah ditulis ke
  log atau URL render.

## Identitas Content Credentials (sebuah sign-in yang harus Anda mulai sendiri)

Lolly dapat menyegel **Content Credential** kriptografis ke dalam ekspor Anda sehingga siapa pun
dapat memverifikasi, secara offline, bahwa sebuah berkas tidak diubah sejak meninggalkan Lolly. Sejauh itu
**aktif secara default dan sepenuhnya lokal** - kunci penandatanganan dibuat di perangkat Anda
dan penandatanganan itu sendiri terjadi secara offline. Tanpa pendaftaran, kunci itu bersifat sekali pakai:
sepasang kunci baru dibuat untuk setiap ekspor dan dibuang bersamanya. Setelah Anda mendaftar,
kunci tersebut menjadi permanen dan dibuat **tidak dapat diekstrak** - bahkan kode Lolly
sendiri pun tidak dapat membacanya, hanya dapat memintanya untuk menandatangani. Bagaimanapun juga kunci itu tidak pernah
meninggalkan perangkat Anda. Bagian ini membahas satu langkah *opsional* di atas itu:
mendaftarkan identitas terverifikasi, sehingga ekspor Anda menampilkan "Verified - signed by
\<your email\>" alih-alih kunci anonim. **Jika Anda melewati pendaftaran, tidak ada yang dibahas di
bagian ini berlaku untuk Anda, dan tidak ada data pribadi yang pernah meninggalkan perangkat Anda.**

![Kartu identitas Verified pada halaman profil, lebar ponsel: pemilih masa berlaku sertifikat dan langkah pendaftaran di bawahnya, dorman sampai Anda memulainya sendiri](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

Jika Anda mendaftar, berikut yang persis terjadi:

1. **Anda memilih metode sign-in** - GitHub, Google, SUSE (id.suse.com) atau tautan
   yang dikirim lewat email. Untuk ketiga provider OIDC, Anda diarahkan ke halaman login
   provider itu sendiri, diatur oleh kebijakan privasi mereka, bukan kebijakan kami.
   Layanan sertifikat Lolly hanya menerima kembali alamat email terverifikasi dan
   nama provider. Untuk tautan email, alamat yang Anda ketik diteruskan ke
   **Resend**, sebuah API email transaksional, semata-mata untuk mengirimkan satu tautan itu.
2. **Sebuah cookie berumur pendek melindungi redirect.** Ini adalah satu-satunya cookie yang
   ditetapkan seluruh sistem Lolly: `lolly_ca_state`, `HttpOnly`, dibatasi ke `/api/ca`,
   kedaluwarsa dalam sepuluh menit. Cookie ini membawa nilai acak, bukan pengenal
   pelacakan, dan hanya ada untuk mencegah redirect OAuth dipalsukan. Cookie ini dihapus
   segera setelah sign-in selesai.
3. **Alamat IP Anda digunakan, sebentar, untuk mencegah penyalahgunaan** endpoint
   sign-in (sehingga satu skrip tidak dapat mem-spam sebuah kotak masuk atau menghabiskan kuota email) - disimpan
   hanya di memori server, untuk jendela geser sekitar satu menit, tidak pernah ditulis
   ke log atau disimpan permanen di mana pun.
4. **Layanan sertifikat menerbitkan sertifikat berumur pendek** (7, 30, 90 atau 365
   hari, pilihan Anda, dibatasi oleh kebijakan operator) yang mengikat email terverifikasi Anda
   dengan bagian publik dari keypair yang dihasilkan di perangkat Anda. Bagian privat
   tidak pernah meninggalkan peramban Anda.
5. **Tidak ada apa pun tentang penerbitan itu yang dicatat.** Layanan sertifikat tidak menyimpan log
   penerbitan: bukan email Anda, bukan provider, bukan nomor seri, bukan
   timestamp. Tidak ada database, tidak ada baris log, tidak ada webhook. Alamat email Anda ada dalam
   permintaan hanya cukup lama untuk ditulis ke dalam sertifikat yang diterima perangkat Anda sendiri,
   dan setelah itu hilang sepenuhnya dari sisi kami.
6. **Setelah itu, penandatanganan kembali offline** untuk seluruh masa berlaku sertifikat.
   Mengekspor file tidak pernah menghubungi layanan sertifikat - hanya pendaftaran yang melakukannya.

**Trade-off, dinyatakan secara jelas.** Versi sebelumnya dari layanan ini memang mencatat setiap
penerbitan, sehingga sertifikat yang salah diterbitkan atau disusupi dapat dilacak. Kami
menghapusnya, karena log itu adalah satu-satunya tempat di seluruh Lolly di mana data
pribadi berhenti di sebuah server, dan kami lebih memilih untuk tidak menyimpannya daripada menyimpannya dengan hati-hati. Yang kami korbankan adalah kemampuan telusur di sisi server: jika sebuah sertifikat
disalahgunakan, kami tidak dapat mencari siapa yang memperolehnya. Sertifikat memang berumur pendek secara
desain - 7 hingga 365 hari, pilihan Anda, dibatasi oleh operator - dan kedaluwarsa dengan
sendirinya, yang merupakan mitigasi yang kami andalkan sebagai gantinya. Self-hoster yang
kewajibannya sendiri mengharuskan log audit dapat menambahkan satu, dan menjadi controller
data itu dengan melakukannya.

## Ekstensi peramban

Ekstensi peramban **Lolly URL Screenshot** tidak mengumpulkan, menyimpan atau
mengirimkan data pribadi apa pun. Tidak ada analitik, tidak ada pelacakan, tidak ada server jarak jauh.

**Apa yang dilakukannya.** Saat Anda meminta aplikasi web Lolly untuk melakukan screenshot sebuah URL,
ekstensi membuka halaman itu di tab latar belakang sementara, menangkapnya di
peramban Anda menggunakan DevTools Protocol, menyerahkan gambar itu kembali ke aplikasi dan menutup
tab. Semuanya terjadi secara lokal, di perangkat dan jaringan Anda sendiri.

**Data.**

- <!--i:shieldcheck--> **Kami tidak mengumpulkan apa pun.** Ekstensi ini tidak memiliki server dan tidak membuat permintaan
  jaringan sendiri.
- <!--i:photos--> **Gambar yang ditangkap** langsung menuju aplikasi Lolly di peramban yang sama - tidak pernah
  diunggah oleh ekstensi.
- <!--i:link--> **URL yang Anda tangkap** hanya digunakan untuk memuat satu halaman itu untuk satu
  screenshot itu. URL tidak dicatat atau dibagikan.

**Izin.**

- <!--i:wrench--> **`debugger`** - untuk menangkap halaman yang dirender melalui DevTools Protocol (mekanisme
  yang sama yang digunakan aplikasi desktop Lolly).
- <!--i:monitor--> **`tabs`** - untuk membuka dan menutup tab sementara tempat halaman dimuat.
- <!--i:globe--> **Akses host (`<all_urls>`)** - karena halaman yang Anda pilih untuk ditangkap bisa
  berada di situs mana pun. Chrome menampilkan ini saat instalasi sebagai peringatan izin
  yang luas. Ekstensi hanya pernah mengunjungi URL yang Anda berikan.

Tak satu pun dari izin ini digunakan untuk membaca, memantau atau mengirimkan aktivitas menjelajah Anda di luar
satu penangkapan yang diminta itu.

## Log infrastruktur

Seperti situs web mana pun, server di balik lolly.tools - dan di balik deployment Lolly
mana pun - menghasilkan log akses server web standar setiap kali sebuah permintaan mencapainya
sama sekali: alamat IP, path yang diminta, timestamp, user agent. Itu adalah perilaku hosting
dasar, bukan sesuatu yang ditambahkan Lolly di atasnya, dan itu tidak pernah berisi
isi dokumen Anda, karena dokumen tersebut tidak pernah mencapai server sejak awal. Satu
pengecualian yang disengaja adalah file yang secara eksplisit Anda serahkan ke panggilan MCP
`lolly_transform`, `lolly_verify` atau `lolly_redact`, yang diproses di memori dan tidak pernah
ditulis ke disk atau log, seperti dijelaskan di atas.

**Kode Lolly sendiri tidak menulis apa pun ke log tersebut.** Server MCP sama sekali tidak berisi
pernyataan logging. Layanan sertifikat mengeluarkan tepat dua baris, keduanya
saat gagal dan keduanya sengaja dipangkas: sebuah kode status kegagalan pengiriman tanpa
alamat penerima, dan sebuah pesan error tanpa stack trace atau URL (sebuah stack bisa
membawa token pendaftaran). Semua yang lain dalam log itu milik platform hosting,
bukan milik kami.

Untuk lolly.tools, hosting menggunakan Vercel dan retensi log akses mengikuti default
platform Vercel sendiri untuk paket kami. Kami tidak mengonfigurasi log drain apa pun, tidak ada ekspor
log jangka panjang dan tidak ada produk analitik atau pemantauan di atasnya. Kami tidak menyimpan salinan
log ini sendiri, yang juga berarti kami tidak memiliki cara untuk mencarinya untuk Anda - lihat
[Your rights](#your-rights).

## Dasar hukum, retensi dan penerima

Hampir tidak ada di sini yang memerlukan dasar hukum, karena hampir tidak ada yang diproses. Demi
kelengkapan, berikut daftar lengkapnya:

| Pemrosesan | Dasar hukum (GDPR Art. 6) | Disimpan selama |
|---|---|---|
| Semua hal di perangkat Anda (dokumen, preferensi, cache, penghitung) | **Sama sekali bukan pemrosesan oleh kami** - data ini tidak pernah sampai ke kami. Penyimpanan di perangkat Anda benar-benar diperlukan untuk layanan yang Anda minta (ePrivacy Art. 5(3)), sehingga tidak memerlukan persetujuan | Sampai Anda menghapusnya |
| Alamat email Anda saat pendaftaran Content Credentials | **Art. 6(1)(b)**, pelaksanaan layanan yang Anda minta secara eksplisit | Tidak disimpan. Hanya ada di memori selama durasi permintaan |
| Alamat IP Anda pada endpoint masuk, untuk pembatasan laju | **Art. 6(1)(f)**, kepentingan sah kami dalam mencegah penyalahgunaan layanan gratis dan kuota email pihak ketiga. Kami menganggap ini lolos uji keseimbangan karena hanya ada di memori, tidak pernah dituliskan, dan dibuang dalam waktu sekitar satu menit | ~1 menit, di memori server, tidak pernah disimpan permanen |
| Log akses hosting (IP, jalur, stempel waktu, agen pengguna) | **Art. 6(1)(f)**, kepentingan sah kami dalam keamanan layanan, pencegahan penyalahgunaan dan diagnosis kesalahan | Default platform Vercel untuk paket kami. Kami tidak menambahkan pengurasan atau ekspor apa pun |

**Penerima.** Kategori penerima adalah: penyedia hosting kami (Vercel
Inc.), dan - hanya jika Anda menggunakan opsi masuk lewat email - penyedia
email transaksional (Resend). Jika Anda masuk dengan GitHub, Google atau SUSE (id.suse.com), Anda
berinteraksi langsung dengan penyedia tersebut di bawah kebijakan privasi mereka sendiri. Mereka memberi tahu
kami alamat email yang terverifikasi dan tidak ada yang lain. Kami tidak membagikan data pribadi dengan siapa
pun yang lain, dan kami tidak menjual data, menjalankan iklan atau memprofilkan pengguna.

**Transfer ke luar EEA.** Vercel dan Resend adalah perusahaan AS. Komputasi
fungsi untuk lolly.tools ditetapkan ke wilayah Frankfurt (`fra1`) milik Vercel sehingga
pemrosesan terjadi di UE, tetapi sebagai penyedia yang berkantor pusat di AS, mereka tetap dapat
mengakses data sebagai pemroses dari AS. Transfer tersebut mengandalkan Klausul
Kontrak Standar dari Komisi Eropa dan/atau Kerangka Kerja Perlindungan Data
UE-AS, sebagaimana diatur dalam perjanjian pemrosesan data masing-masing penyedia. Karena
data pribadi yang sampai ke salah satu penyedia sangat terbatas - sebuah alamat email yang diteruskan
untuk mengirim satu pesan, dan log akses biasa - paparannya
pun sekecil itu.

**Pengambilan keputusan otomatis.** Tidak ada. Tidak ada pembuatan profil dan tidak ada keputusan otomatis
yang menghasilkan efek hukum atau efek signifikan serupa (Art. 22).

## Privasi anak

Lolly tidak dengan sengaja mengumpulkan informasi pribadi dari siapa pun, di usia berapa pun, dalam
penggunaan aplikasi sehari-hari - tidak ada apa pun untuk dikumpulkan. Satu-satunya tempat
informasi pribadi (alamat email) pernah dikumpulkan adalah pendaftaran Content Credentials,
yang dijelaskan di atas, dan itu tidak ditujukan atau dimaksudkan untuk anak-anak.

## Hak Anda

Karena hampir semua yang disentuh Lolly hanya disimpan di perangkat Anda sendiri, sebagian besar
yang oleh hukum perlindungan data disebut "hak Anda" - akses, koreksi, penghapusan,
portabilitas - adalah hal yang sudah bisa Anda lakukan sendiri, seketika, tanpa meminta izin
siapa pun: data Anda tersimpan di penyimpanan peramban Anda, dalam bentuk yang bisa Anda periksa,
ekspor (**Export my data & render everything**, di atas) atau hapus (**Profile → Clear all
my data**).

Secara formal, berdasarkan Pasal 15-22 GDPR, Anda berhak untuk **mengakses** data
pribadi Anda, **memperbaikinya**, **menghapusnya**, **membatasi** atau **menolak**
pemrosesannya (termasuk menolak apa pun yang kami dasarkan pada kepentingan sah), untuk
**portabilitas data**, dan - jika pemrosesan bertumpu pada persetujuan - untuk
**menarik persetujuan itu kapan saja**, tanpa memengaruhi keabsahan apa yang
terjadi sebelum Anda menariknya.

Berikut posisi jujur soal menggunakan hak-hak itu terhadap kami. Karena kami tidak lagi
menyimpan log penerbitan, **kami tidak menyimpan data pribadi apa pun tentang Anda yang bisa kami
cari, koreksi, ekspor atau hapus.** Jika Anda menulis dan bertanya apa yang kami miliki tentang Anda,
jawaban yang jujur adalah tidak ada, dan kami akan mengatakan demikian. Satu-satunya kategori yang
benar-benar ada adalah log akses hosting yang terkait dengan alamat IP, disimpan oleh penyedia hosting
kami sesuai default retensi mereka. Kami tidak punya fasilitas untuk mencari atau menghapus
secara selektif log tersebut, dan kami akan mengatakan itu kepada Anda alih-alih berpura-pura sebaliknya. Semua yang
benar-benar *milik Anda* ada di perangkat Anda, tempat Anda sudah bisa membaca, mengekspor
dan menghapusnya tanpa meminta izin siapa pun.

**Anda berhak mengajukan keluhan.** Jika Anda merasa kami telah menangani data Anda
dengan tidak semestinya, Anda dapat mengajukan keluhan kepada otoritas pengawas
perlindungan data - di UE, otoritas di negara tempat tinggal Anda, tempat kerja
Anda atau tempat Anda meyakini pelanggaran itu terjadi (Art. 77). Otoritas pengawas
utama kami adalah *Bayerisches Landesamt für Datenschutzaufsicht* (BayLDA) di
Ansbach, Jerman. Anda tidak perlu menghubungi kami terlebih dahulu, meskipun kami ingin diberi
kesempatan untuk memperbaikinya.

Kami tidak menjual data. Kami tidak punya apa pun untuk dijual.

## Perubahan pada kebijakan ini

Tanggal di bagian atas berubah setiap kali dokumen ini berubah. Perubahan yang mengubah
apa yang keluar dari perangkat Anda atau apa yang disimpan mendapat baris tersendiri di sini, bukan
suntingan diam-diam - jika Anda ingin melihat apa yang berubah, tanyakan (di bawah) atau bandingkan dengan
[sumber publik](https://github.com/lolly-tools/lolly/commits/main/docs/privacy.md).

## Siapa yang bertanggung jawab, dan cara menghubungi kami

**Pengendali data** untuk lolly.tools adalah:

> SUSE Software Solutions Germany GmbH
> Frankenstraße 146
> 90461 Nürnberg
> Germany

SUSE telah menunjuk seorang **Data Protection Officer**, yang dapat dihubungi di
[privacy@suse.com](mailto:privacy@suse.com). Gunakan alamat itu untuk permintaan resmi apa pun
di bawah "Hak Anda" di atas.

Untuk hal apa pun tentang Lolly itu sendiri - cara kerjanya, mengapa sesuatu dibuat seperti itu atau
koreksi terhadap dokumen ini - hubungi **Andy Fitzsimon**,
[fitzy@suse.com](mailto:fitzy@suse.com).

Untuk instance Lolly yang di-self-host atau enterprise, hubungi pihak yang mengoperasikannya
sebagai gantinya: operator itulah pengendali untuk penerapan mereka sendiri. SUSE dan
proyek open source Lolly tidak menyimpan data untuk penerapan yang tidak mereka jalankan.
