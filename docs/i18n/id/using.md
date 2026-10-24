# Menggunakan Lolly

Lolly sudah terbuka dan Anda ingin membuat sesuatu, menyimpannya, dan mengirimkannya. Halaman ini menelusuri putaran itu: buka alat, ubah apa yang boleh Anda ubah, simpan hasilnya, dan bagikan sebagai tautan atau file.

Semua yang ada di sini berjalan di perangkat Anda, tanpa akun, dan tetap berfungsi offline setelah alat dan aset yang Anda perlukan diunduh. Aplikasi memerlukan browser atau aplikasi dengan WebGPU untuk dimulai; [Supported environments](/info/supported-environments.html) mencantumkan yang telah diuji.

## Mengenal sekeliling

::: figure using-app-map
Layar beranda: empat tab di sepanjang atas dan bilah di dasar. Alat yang sudah dibuka menampilkan kontrolnya di samping pratinjau langsung.
:::

Empat tab berjajar di bagian atas layar beranda: **Tools**, **Utilities**, **Assets**, dan **Projects**. Tools adalah yang Anda pakai untuk membuat, Utilities adalah meja kerja untuk tugas seperti mengonversi, memeriksa, atau membersihkan file, Assets adalah pustaka Anda, dan Projects menyimpan apa yang Anda simpan.

Bilah di dasar berisi **Open**, **Settings**, field pencarian, **Verify**, dan **What?**. Bilah ini tampil di Tools, Utilities, Assets, Projects, Settings, dan panduan yang Anda baca di aplikasi, lalu menyingkir begitu alat dibuka. [Search](/info/search.html) menjangkau alat, pekerjaan tersimpan, aset, dan pengaturan Anda dari field itu. [Ask Lolly](/info/ask.html) menjawab pertanyaan yang diketik dengan bagian panduan ini yang sesuai.

Klik kartu untuk memulai sesuatu yang baru di alat itu. Pekerjaan tersimpan dibuka kembali dari **Projects**.

![Kartu galeri dengan navigasi contoh dan sebuah aksi + Baru](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&localize=1&dark=1&cropSelector=.gtile%5Bdata-tool-id%3D%22design%22%5D&filename=gallery&try=1)

Setiap alat adalah tampilan terbagi: **kontrol** di satu sisi dan **pratinjau** langsung di sisi lain. Ubah kontrol dan pratinjau langsung mengikuti, dan apa yang Anda lihat itulah yang diekspor.

![Split view sebuah alat - tumpukan kontrol di kiri, dan bar chart live berkelompok yang digambarnya di kanan](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26t%3DExample%2520data%26st%3DSample%2520values%252C%2520not%2520a%2520real%2520dataset%26d%3DMonth%252CSeries%2520A%252CSeries%2520B%252CSeries%2520C%250AJan%252C12%252C9%252C5%250AFeb%252C18%252C14%252C7%250AMar%252C24%252C17%252C11%250AApr%252C29%252C23%252C15%26lg%3D1&width=1440&height=900&dpi=192&waitMs=2500&walker=1&format=svg&dark=1&filename=vt-tool-split-view)

**Design** adalah pengecualian. Ia terbuka sebagai kanvas bebas berisi kotak yang bisa Anda seret, ubah ukurannya, dan ketik di dalamnya, dengan bilah atas, garis waktu, dan kontrol deck sendiri. [Design: the free canvas](/info/design.html) adalah panduannya.

## Ubah apa yang boleh diubah alat

Alat hanya menampilkan input yang memang dimaksudkan untuk berubah. Pembuatnya sudah menetapkan warna, tata letak, tipografi, dan logikanya, sehingga apa pun yang Anda buat tetap mengikuti aturan mereka. Input mencakup teks, penggeser, pemilih warna, dropdown, tanggal, pemilih gambar, dan grup baris berulang, dan sebagian berada dalam bagian yang dapat dilipat.

![Tumpukan kontrol sebuah tool - satu kolom teks, pemicu warna dan satu penggeser, tanpa apa pun lagi yang dipilih penulisnya untuk dikunci](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=%23tool-inputs&walker=1&format=svg&dark=1&filename=use-tool-inputs)

**Klik desainnya untuk menemukan kontrolnya.** Klik elemen mana pun di pratinjau dan kontrol yang sesuai mendapat fokus lalu bergulir ke tampilan. Dalam grup baris berulang, baris persis yang Anda klik terbuka.

**Clear changes**, di atas kontrol, mengembalikan setiap input ke defaultnya.

**Pilihan design system.** Bila design system Anda menawarkan lebih dari satu colourway, tampilan terang dan gelap, atau pilihan tema lain, bagian **Design system** di bawah kontrol memuatnya. Pilihan hanya muncul bila mengubah alat ini, jadi utilitas file tidak menampilkan bagian itu sama sekali. Setiap colourway adalah titik dengan warnanya sendiri, terang dan gelap adalah dua tombol, dan pilihan lain berupa daftar.

Pilihan ini milik karya ini. Ia ikut dalam tautan dan sesi tersimpan, setiap warna yang terhubung ke design system mengikutinya, dan warna aplikasi sendiri tetap seperti adanya. Design menampilkan pilihan yang sama di tab **Canvas** Inspector. Alat yang warnanya adalah isinya dapat tetap pada colourway kanonis, dan kemudian tidak menawarkan titik colourway. [Lolly Demo in use](/info/lolly-demo-in-use.html#colourways-on-real-work) menunjukkan colourway pada pekerjaan nyata.

### Zoom dan geser pratinjau

Pratinjau selalu menampilkan persis apa yang akan diekspor.

- **Zoom:** Cmd/Ctrl-gulir atau cubit di trackpad, berpusat pada penunjuk Anda. Di keyboard, `0` menyesuaikan dengan jendela, `1` adalah 100%, dan `+` / `−` memperbesar atau memperkecil.
- **Geser:** tahan **Space** dan seret, atau seret dengan tombol tengah mouse. Klik biasa tetap bebas untuk mengeklik bagian desain.
- **Sentuh:** cubit untuk zoom, seret untuk menggeser, dan ketuk dua kali untuk menyesuaikan.
- **Zoom HUD:** tekan dan tahan pusaran Lolly di sudut untuk membuka `−`, **Fit**, dan `+`. Ketukan singkat pada pusaran tetap membuka menu profil Anda.

Perubahan ukuran keluaran selalu mengembalikan tampilan ke penyesuaian yang rapi.

![Zoom HUD terbuka dari pusaran di sudut kanvas - minus, Fit, plus, lalu sakelar tema dan suara serta pegangan untuk memindahkannya](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=.stage-nav%7Bopacity%3A1!important%7D&drive=drag%3A.stage-nav-profile%7Cdx%3D1%7Chold%3Bwait%3A700&cropSelector=.stage-nav&walker=1&format=svg&dark=1&filename=use-zoom-hud)

### Undo dan redo

**Cmd/Ctrl-Z** mundur satu langkah dan **Cmd/Ctrl-Shift-Z** (atau **Cmd/Ctrl-Y**) maju satu langkah. Pasangan yang sama tersedia sebagai tombol **Undo** dan **Redo** di atas kontrol (di Design berada di bilah atas), dan masing-masing memudar bila tidak ada lagi yang bisa dibatalkan. Sebuah pesan menyebut input mana yang dipulihkan tiap undo, dengan tombol **Redo** di dalam pesan.

- **Satu seretan adalah satu langkah.** Perubahan berulang pada satu kontrol dalam setengah detik digabung, jadi menarik penggeser sepanjang rentangnya adalah satu undo.
- **100 langkah terakhir disimpan.** Suntingan baru setelah undo mengosongkan tumpukan maju.
- **Di kotak teks**, Cmd/Ctrl-Z milik field itu, karakter demi karakter. Lolly mengambil alih untuk penggeser, dropdown, warna, dan sakelar.
- **Memilih file** pada input file bukan sebuah langkah, karena byte itu hanya ditahan untuk sesi ini.

Dalam [kolaborasi](/info/collaborate.html) langsung, riwayat Anda tetap milik Anda: perubahan dari perangkat lain tidak pernah masuk ke tumpukan Anda. Undo bertahan sampai Anda meninggalkan alat atau memuat ulang. Untuk yang lebih lama, alat yang menyimpan saat Anda bekerja menyimpan versi sebelumnya di bawah **History**; lihat [Go back to an earlier version](/info/find-your-work.html#go-back-to-an-earlier-version).

### Kamera langsung

Efek alat **Filter** (Halftone, Scanline, Posterize, Voronoi, Duotone, Stretch, Misprint, Dither, ASCII art, dan Glitch) menampilkan tombol **Go live** bila kamera tersedia. Aktifkan dan efek mengikuti webcam Anda bingkai demi bingkai, dan ekspor gerak merekam hasilnya sebagai GIF, WebM, atau MP4. Bingkai diproses di perangkat Anda, dan kamera dilepas begitu Anda berhenti atau meninggalkan alat. Pemilih gambar mana pun juga memiliki **Take a photo** untuk satu bingkai.

## Menyimpan & melanjutkan

Untuk menyimpan pekerjaan Anda, tekan **Save**, tanda centang di samping **Export** pada pil render. Pekerjaan baru masuk ke **My library**, pekerjaan yang Anda simpan sebelumnya diperbarui di tempatnya, dan tidak ada yang diunduh. Panel ekspor memiliki tombol **Save** yang sama.

Untuk memilih tujuannya, tekan **Save as**, di samping **Download** di panel ekspor. Di bawah **Save to a project**, biarkan **My library** terpilih atau pilih proyek (**＋ New project…** membuat satu), lalu tekan **Save**; **Save as a template** menyimpan desain sebagai [templat](/info/templates.html), titik awal untuk dokumen baru. Di Design, **Save as** ada di menu Lolly; di ponsel, tekan **•••**, lalu **File menu**, lalu **Save as**.

![Pil render dua bagian: Export, dengan panah ke atas yang membuka panel ekspor, dan Save, dengan tanda centang yang menyimpan di tempat](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=%23tool-inputs%7Bdisplay%3Anone%7D&cropSelector=.render-pill&walker=1&format=svg&dark=1&filename=use-render-pill)

::: timeline
- <!--i:check--> Tekan **Save** pada pil render, atau **Save as** untuk memilih proyek.
- <!--i:folder--> Item masuk ke **My library**, atau ke proyek yang Anda pilih.
- <!--i:home--> Nanti, tekan **Home** di kiri atas dan buka tab **Projects**.
- <!--i:document--> Buka item. Setiap pengaturan kembali, siap diubah dan diekspor lagi.
:::

Item dinamai sesuai nama file yang Anda ketik di panel ekspor, atau sesuai alatnya, seperti **QR Code**. File yang Anda dapat dengan **Download** adalah salinan jadi; untuk mengubahnya nanti, buka item tersimpan di Projects.

Simpanan pribadi tetap di perangkat ini, di browser atau aplikasi tempat Anda menyimpan, kecuali Anda mengaktifkan [Sync](/info/sync.html). Jika sesuatu tidak ada di tempat yang Anda harapkan, [Find and recover your work](/info/find-your-work.html) membahas setiap kasus, dari tab yang tertutup hingga data browser yang dibersihkan.

::: details Proyek tim dengan Lolly Work (opsional)
Jika [organisasi Anda memakai Lolly Work](/info/organisation.html), login ke instansnya dan buka **Projects → Team projects** untuk sesi yang dibagikan kepada Anda. Organisasi menetapkan akses dan retensi, dan layanan Lolly Work-nya menyimpan sesi tersebut. Sesi bersama bergabung ke collab langsungnya saat dibuka bila organisasi Anda mengizinkan penyuntingan langsung; [Working together](/info/collaborate.html#work-collabs-with-lolly-work-optional) menjelaskan langkahnya.

Pustaka pribadi Anda tetap terpisah. Login di perangkat lain memberi Anda pekerjaan tim, sedangkan simpanan pribadi tetap memerlukan Sync atau cadangan untuk berpindah.
:::

## Membagikan karya Anda

Desain keluar sebagai tautan atau sebagai file. **Share** di kontrol ekspor membuka dialog yang menawarkan keduanya, dan **Share link** pada sesi tersimpan di Projects membuka dialog yang sama untuk sesi itu.

::: cols
## Tautan

- Membawa setiap input di alamat, sehingga tautan mereproduksi desain.
- Meninggalkan gambar dan file yang Anda tambahkan dari perangkat ini, teks yang sangat panjang, dan daftar yang sangat besar.
- Terbuka di browser mana pun, jadi Anda dapat menandai, menempel, atau meng-commit tautan itu.

## File .lolly

- Membawa sesi tersimpan beserta gambar dan file di perangkat ini, dan dapat membawa alat serta design system juga.
- Menahan karya katalog berlisensi kecuali Anda memilih menyertakan file-nya.
- Terbuka di Lolly: klik dua kali, gunakan **Open**, atau letakkan di aplikasi.
:::

### Tautannya

Tautan siap salin berada di bagian atas dialog, dengan **Copy** dan tombol **QR** yang membuka alat QR Code pada tautan itu. Di bawah tautan, **Link options** memuat:

- **Open in the installed app** mengubah tautan menjadi alamat `lolly://` untuk Shortcuts, peluncur, dan otomatisasi, dengan setiap parameter tidak berubah.
- **Shortest link** memadatkan desain panjang menjadi token ringkas dan menampilkan penghematan dalam karakter. Bentuk yang terbaca juga selalu tersedia.
- **Password-protect this link** mengenkripsi tautan di perangkat Anda dengan AES-256. Kata sandi tidak pernah menjadi bagian dari tautan.
- **Pin this tool version** menambahkan flag `_v`, sehingga pembaruan alat berikutnya tidak dapat mengubah apa yang dirender tautan.
- **When the recipient opens the link…** memilih layar penuh, panel ekspor yang sudah dibentangkan, unduhan saat dibuka (`&export`), atau salinan ke clipboard (`&copy`).
- **Copy credit** menyalin keterangan "Made with Lolly" bersama tautan, untuk postingan atau slide.

Bila alat memiliki field pribadi, seperti nama Anda, **Review personal fields** menjaga masing-masing tetap di luar tautan sampai Anda mencentang field itu. [URL mode](/info/url-mode.html) membahas semua yang dapat dibawa tautan.

**Dialog menyatakan apa yang tidak dapat dibawa tautan.** Gambar atau file yang Anda tambahkan dari perangkat ini, nilai teks yang sangat panjang, dan daftar yang sangat besar tidak muat di alamat. Masing-masing dihitung saat tautan dibuat. Jika ada yang harus dibuang, dialog mencantumkannya dan mengarahkan Anda ke opsi file, bukan menyerahkan tautan yang terbuka tanpa gambar. Tautan yang hanya panjang mendapat catatan yang lebih ringan dengan jumlah karakternya.

**Beberapa alat menjadikan tautan sebagai seluruh produk.** Jump Page mengumpulkan tautan Anda ke satu halaman untuk dibagikan: tautan bio, presentasi, etalase toko. Tidak ada yang di-host dan tidak ada akun di balik halaman, karena halaman itu adalah tautannya. Pengunjung mendapatkannya selebar penuh, satu tautan per adegan saat menggulir.

![Jump Page di editor: scene heading di bagian atas halaman, dengan scene link di bawahnya](/t/url-shot?url=%2F%23%2Ftool%2Fjump%3Ffull%26heading%3DFind%2520us%2520everywhere%26subheading%3DOne%2520link%2520for%2520everything.%26links%3DURL%252CName%252CEmoji%257Ehttps%25253A%25252F%25252Fexample.com%252CWebsite%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fnews%252CNewsletter%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fhello%252CSay%252520hello%252C&width=900&height=1300&dpi=96&waitMs=2000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=use-jump-page)

::: details Tautan yang dikelola organisasi dengan Lolly Work
Untuk berbagi yang memerlukan masa berlaku, pencabutan, atau kata sandi, Lolly Work menawarkan tautan terkelola ke sesi bersama, alat, dan aset katalog. Tautan diselesaikan melalui layanan organisasi dan mengikuti aturan aksesnya. Tautan ini terpisah dari tautan mandiri di atas, dan mencabutnya tidak dapat menarik kembali file yang sudah diunduh seseorang. [Rendering and sharing](/info/manage/sharing.html) mencantumkan jenis tautan dan izin.
:::

### Berkas .lolly

**Download .lolly**, di bagian **Editable file** dialog Share, menulis desain saat ini sebagai satu file. File membawa sesi tersimpan beserta gambar dan file di perangkat ini, dan karya katalog biasa ikut serta. File yang usang atau tidak tersedia tetap menjadi referensi eksternal, bukan menghilang. Sebelum menyimpan, dialog menampilkan ukuran file, berapa file yang disematkan, berapa yang dirujuk, dan apakah alatnya disertakan. Bila perangkat Anda memiliki share sheet, **Send to…** menyerahkan file langsung ke sana (AirDrop, berbagi Android).

**Download project (.lolly)**, di menu folder pada **Projects**, menulis satu folder utuh, sehingga orang lain dapat melanjutkan setiap sesi di folder itu. Sesi batch tertinggal, dan pemberitahuan menyebut jumlahnya. **Download originals**, di menu yang sama, menulis zip biasa berisi tiap item sebagai file tersendiri.

Ada tiga hal yang Anda putuskan sebelum file keluar:

- **Apakah nama Anda dimasukkan.** Nama, email, dan organisasi Anda ditulis hanya bila **Use my details to create** aktif di [profil Anda](/info/profile.html). Bila mati, file hanya mencatat bahwa ia dibuat dengan Lolly, dan kapan.
- **Apakah karya yang ditahan dimasukkan.** Karya berlisensi, karya terkunci brand, dan karya katalog yang lisensinya tidak pernah dicatat tetap di luar secara default. Jika desain memakai salah satunya, dialog menyebut berapa banyak dan menawarkan *Download without them* atau *Include and download*, karena menyertakannya menyerahkan file kepada siapa pun yang membuka `.lolly`. `CREDITS.txt` pada file mencantumkan apa yang ikut dan apa yang tidak, beserta alasannya; [Creative rights and credits](/info/creative-rights.html) menjelaskan aturannya.
- **Apakah alat dimasukkan.** **Include the tool** mengemas file alat itu sendiri, sehingga desain terbuka di perangkat tanpa alat tersebut. Awalnya tercentang untuk alat kustom, seperti fork, dan tidak tercentang untuk alat yang dicantumkan katalog bertanda tangan. Pada build tanpa katalog bertanda tangan, setiap alat dianggap kustom.

**Membukanya.** Di aplikasi desktop dan seluler, klik dua kali atau ketuk `.lolly`, pilih **Open with Lolly**, atau kirim ke Lolly dari share sheet. Di aplikasi web, tekan **Open** atau letakkan file di Lolly. Setiap jalur membaca manifes file lebih dulu dan menampilkan ukuran, isi, dan apa yang akan terjadi, sebelum apa pun ditulis.

Jika file membawa alat yang tidak Anda miliki, **Trust this tool?** menampilkan alat dan pembuatnya, dan menyatakan bahwa membukanya menjalankan kode milik alat itu di perangkat Anda. **Trust & install** melanjutkan. Jika ditolak, pekerjaan tetap disimpan ke Projects, menunggu hari Anda menambahkan alat itu. Alat yang kodenya dikirim sebagai modul belum dapat dipasang dengan cara ini, dan ditolak dengan cara yang sama.

::: details Apa isi sebuah .lolly, dan bagaimana membukanya bekerja
`.lolly` adalah ekstensi bundel Lolly, dan `format` dalam `manifest.json`-nya menyatakan isinya:

- **Desain bersama** (`lolly-share`) berisi satu sesi tersimpan, file yang disematkan, dan tanda terima untuk apa pun yang masih diselesaikan lewat referensi. Dapat juga membawa alat dan design system. Membukanya menambahkan Project baru dan tidak pernah menimpa sesi.
- **Proyek bersama** (`lolly-share`, jenis `project`) berisi folder dari Projects: sub-foldernya, setiap sesi di dalamnya beserta ubinnya, dan gambar yang disimpan di sana. Membukanya menambahkan salinan seluruh folder. Setiap sesi dibawa sebagai `sessions/<key>.json` dengan ubinnya di bawah `thumbs/`. Lolly dari sebelum file proyek ada akan meminta Anda memperbarui.
- **Paket design system** (`lolly-brand`) berisi token dan dapat berisi font, logo, versi terbit, dan sumber daya yang dipertahankan. Membuka paket menambahkan design system bernama terpisah dan menjadikannya aktif.
- **Paket ruang kerja atau instans** adalah `lolly-brand` dengan alat yang dideklarasikan, aset katalog, dan opsional alamat instans. Memuatnya menggantikan satu overlay ruang kerja yang dimuat sebelumnya, dan pratinjau mencantumkan efek di seluruh perangkat itu.

Cadangan perangkat penuh bukan `.lolly`. Ia tetap berupa `LollyTools-….zip` (format `lolly-backup`) dan dipulihkan melalui **Settings → Storage → Import data…**. Folder alat yang di-zip juga tetap `.zip`. [Data transfer](/info/data-transfer.html) adalah referensi formatnya.

`.lolly` adalah zip biasa. Ganti namanya menjadi `.zip` untuk melihat isinya: gambar Anda sendiri ada di `assets/uploads/`, karya katalog di `assets/catalog/`, `manifest.json` mencantumkan setiap file, dan README menjelaskan apa file itu.

macOS, Windows, Linux, iOS, dan Android semuanya mendaftarkan format ini, pengelola file desktop menampilkannya sebagai dokumen Lolly, dan GNOME Files dapat menampilkan thumbnail sesi tersimpan itu sendiri. Membuka dari Design System Setup merekomendasikan aksi design system bila desain bersama membawanya, tetapi tidak pernah menyembunyikan **Open shared design**.

Dokumen yang diserahkan dari aplikasi lain di iOS atau Android dibatasi 48 MB, karena serah terima menyalin byte-nya melintasi batas aplikasi, dan aplikasi menyatakannya. **Open** di dalam Lolly tidak memiliki batas itu, jadi gunakan untuk bundel yang lebih besar.

Setelah Anda mengonfirmasi, Lolly mengekstrak dan memverifikasi bundel sekali. Aset masuk ke pustaka Anda, dicocokkan dengan checksum sehingga file yang sudah ada di perangkat dipakai ulang. Sesi masuk ke Projects dengan id baru, sehingga file yang sama dapat dibuka dua kali; sesi yang alatnya hilang menunggu di sana. File di atas 100 MB ditandai besar, dan pratinjau memperingatkan bila penyimpanan browser melaporkan ruang kosong lebih sedikit dari yang dibutuhkan file. Setiap bagian yang tercakup integritas diperiksa sebelum apa pun di-commit, dan salinan yang rusak ditolak tanpa meninggalkan sisa.
:::

Tautan dan file sama-sama menyerahkan snapshot. Untuk penyuntingan langsung, [Working together](/info/collaborate.html) membahas collab privat antara dua perangkat dan work collab opsional melalui Lolly Work.

## Aset - pustaka Anda

**Assets** (`#/a`) mengumpulkan semua yang dapat dipakai alat Anda: logo brand, gambar, audio, dan gerak, dikelompokkan menurut jenis, bersama file Anda sendiri. Unggahan Anda disimpan di perangkat Anda. Organisasi yang memakai Lolly Work juga dapat menyediakan katalog bersama di bawah aturan aksesnya sendiri; lihat [Use Lolly at your organisation](/info/organisation.html).

![Aset - aset brand, swatch dan font, ditambah unggahan Anda sendiri](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches%2Cfonts&width=1440&height=900&dpi=96&waitMs=2400&css=.plat-swatch-grid~%2A%7Bdisplay%3Anone%7D&walker=1&format=svg&localize=1&dark=1&filename=assets)

- <!--i:upload--> **Bawa file Anda masuk.** Letakkan gambar, SVG, klip audio, video, Lottie, PDF, atau deck PowerPoint di area unggah, atau klik untuk memilih. File langsung tiba di Assets dan di pemilih aset setiap alat. PDF multi-halaman atau `.pptx` menanyakan halaman atau slide mana yang disimpan, dan masing-masing menjadi aset SVG. Gambar yang Anda tambahkan di dalam alat disimpan sebagaimana datangnya di **My images**, sehingga Content Credential padanya tetap terverifikasi, dan hanya file yang sangat besar yang menanyakan apakah ukurannya akan diubah. **Settings → Storage** menampilkan seberapa banyak isi **My images**. Tidak ada batas selain penyimpanan perangkat Anda. Untuk menghapus data EXIF dan GPS saat gambar masuk, aktifkan **Strip metadata from uploads** di bawah **Settings → Feature flags**; Content Credentials tetap dipertahankan dalam kedua kasus.
- <!--i:star--> **Favoritkan yang sering Anda pakai.** Beri bintang pada aset atau swatch brand dan ia tersemat di bagian atas setiap pemilih.
- <!--i:folder--> **Rapikan.** Pindahkan aset ke grup lain, sembunyikan aset brand bersama yang tidak Anda pakai (**Show hidden** mengembalikannya), atau hapus unggahan Anda sendiri. Bilah pilihan yang sama seperti Projects berlaku untuk seluruh pilihan.
- <!--i:layers--> **Angkat video dari latar belakangnya.** Buka detail video, atau klik kanan kartunya di pemilih aset, dan pilih **Remove background…**. **On-device model** memotong subjek dari adegan yang ramai; **Colour key** menghapus latar yang diterangi merata seperti green screen, dengan **Tolerance**, **Softness**, dan **Spill removal** untuk tepinya, dan tidak memerlukan unduhan. **Resolution** (360, 480, 720, atau 1080p, tidak pernah melebihi sumber) menukar detail dengan kecepatan. Hasil potongan, WebP atau PNG animasi dengan transparansi sungguhan, disimpan di samping aslinya, dan Content Credential sumber ikut sebagai ingredient. [Generated once, rendered the same](/info/ai-features.html) menjelaskan mengapa ini tetap penyuntingan biasa.

### Bawa palet dan font Anda ke mana saja

Panel **Swatches** di Assets menampilkan warna penyusun brand Anda: warna brand, warna yang Anda tambahkan, ramp, dan spektrumnya. Warna peran yang dipertahankan Lolly untuk antarmuka (teks, permukaan, tepi, pemimpin colourway, dan salinan warna brand dengan nama lain) menunggu di balik kartu abu-abu **Show colour roles** di dasar panel.

Setiap warna adalah kartu seperti aset lain. Klik satu untuk membuka detailnya, pilih beberapa untuk mengunduh hanya yang itu, atau unduh seluruh palet dalam format yang dibaca alat Anda yang lain:

- <!--i:code--> **Design tokens (JSON)**, **CSS variables**, atau **CSS classes**, untuk stylesheet atau build. Warna yang lebih lebar dari sRGB mempertahankan nilai lebarnya: CSS menyetelnya setelah hex, dan JSON menyimpan hex bersama warna lebar, racikan CMYK, dan tinta spot.
- <!--i:palette--> **Adobe Swatch Exchange (.ase)**, untuk Illustrator atau Photoshop. Warna yang dikunci pada racikan CMYK tiba sebagai swatch CMYK itu, tinta spot sebagai swatch spot bernama, dan warna yang lebih lebar dari sRGB sebagai Lab.
- <!--i:pentool--> **GIMP palette (.gpl)**, untuk GIMP atau Inkscape, dan **SCSS variables**, keduanya dalam sRGB.

![Panel Swatches - lima tombol unduh palet di bagian atas, lalu setiap warna brand sebagai chip yang membuka detailnya](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches&width=1440&height=900&dpi=96&waitMs=1800&css=.cat-group%3Anot%28%5Bdata-group%3Dswatches%5D%29%7Bdisplay%3Anone%7D&cropSelector=%5Bdata-group%3Dswatches%5D&walker=1&format=svg&dark=1&filename=use-swatch-downloads)

Pilih warna dengan titik pada setiap kartu: Shift-klik titik kedua untuk semua yang berada di antaranya, seret kotak melewati celah, atau tekan Cmd/Ctrl+A dengan kartu terfokus. Bilah menawarkan **Download as…** dalam enam format yang sama, **Copy hex**, dan **Favourite**. Sebelum Anda memilih format, menu mencantumkan warna yang tidak dapat ditampung format mana pun (Transparent tidak memiliki warna sama sekali), format mana yang menyimpan warna lebar sebagai fallback sRGB-nya (SCSS dan GIMP), dan mana yang membawa nilai CMYK dan spot (JSON dan .ase). Klik kanan kartu untuk aksi yang sama pada satu warna.

Detail warna mengisi pratinjau dengan warna itu dan membentangkan **Linked values** (racikan CMYK atau tinta spot, nilai apa pun yang dibuat untuk ruang warna atau mesin cetak tertentu, dan token desainnya), **Every notation** (hex, OKLCH, Display-P3, dan lainnya, masing-masing dengan tombol salin), **Plotted on a colour space**, **Tones**, dan **Readability**. Tombol panah menelusuri palet, **Copy link** membagikan warna itu sendiri, dan **Open in Colour Lab** membawanya lebih jauh.

Panel **Fonts** mencantumkan huruf brand Anda dengan **download** untuk masing-masing, untuk dipasang secara lokal atau diserahkan ke percetakan.

## Atur grid sesuai Anda

- <!--i:star--> **Favoritkan yang Anda pakai.** Klik kanan kartu dan pilih **Add to favourites**, dan ia mendapat ubin besar di strip di atas grid. [Your favourites](/info/favourites.html) membahas strip itu.
- <!--i:eyeoff--> **Sembunyikan alat yang tidak pernah Anda pakai.** Klik kanan kartu, atau pilih beberapa, dan pilih **Hide tool**. Ia hilang dari grid dan dari apa yang ditemukan saat mengetik di grid. Ubin abu-abu **Show hidden tools (N)** di akhir menampilkannya kembali, diredupkan, masing-masing dengan **Unhide tool** di menunya. Menyembunyikan hanya mengubah grid Anda: alat tetap terbuka dari tautan atau bookmark.
- <!--i:clock--> **Alat Anda, lebih dulu.** Setelah Anda menyimpan pekerjaan di tiga alat berbeda, baris chip **Yours** di atas grid memuat favorit dan alat terbaru Anda lebih dulu.
- <!--i:sliders--> **Susun sesuai cara Anda.** **View options** menetapkan tata letak (**Grid**, **Card**, atau **List**), ukuran dan kepadatan kartu, urutan, dan filter kategori.

![Akhir grid Tools dengan alat tersembunyi ditampilkan: kartu Wordmark yang diredupkan, dan di sampingnya ubin abu-abu yang mengembalikannya ke tampilan, kini bertuliskan Hide hidden tools](/t/url-shot?url=%2F%23%2F&width=1440&height=680&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A.gtile--hiddenbox%3Bpress%3AEnd%3Bwait%3A800%3Bhover%3A.gtile--hiddenbox%3Bwait%3A300&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&rasterDpi=96&dark=1&filename=misc-hidden-tools)
<!--
SHOT NOTE (misc-hidden-tools): the trailing `press:End` is required. The
hidden box and the revealed cards live at the very END of the grid, and
clicking the box runs applyView(), which re-lays the grid out and drops the
scroll back to the top - so without it the frame published the TOP of the
gallery under a caption about its bottom. `press:` with no `on=` goes to the
keyboard, and the End key with focus on the just-clicked box scrolls the
document; the walker then anchors the body walk to that band.
The tile reads "HIDE hidden tools" in the shot, not "Show" - it is a toggle and
the recipe has just pressed the tile. The alt says so rather than quoting the resting
label the prose above already gives.
The recipe hides nothing itself. The lolly-demo catalog the captures pin
ships Wordmark hidden (`defaultHiddenTools` in its assets index.json), so a
fresh profile already has one hidden tool and the recipe only clicks the grey
reveal tile (`.gtile--hiddenbox`, confirmed in gallery.ts). It used to tick
the QR Code card and press the bulk bar's Hide button first; under lolly-demo
that published Wordmark dimmed and QR Code not, under a caption naming QR
Code, so the steps were dropped rather than relied on. QR Code was hidden
in that run too: the End scroll had left the pointer over its card, and a
hovered hidden card lifts its dimming (gallery.css), so it read as a normal
tool. The closing `hover:` puts the pointer back on the reveal tile, which
keeps every revealed card dimmed.
-->

**Bertindak pada beberapa kartu sekaligus.** Centang kotak setiap kartu, seret kotak pilihan melintasi ruang kosong, atau Shift/Cmd-klik, dan sebuah bilah muncul dengan apa yang diizinkan tampilan itu:

- **Tools dan Utilities:** Favourite, Hide, Available offline, **View sessions** (Projects, hanya menampilkan sesi yang dibuat dengan alat-alat itu) dan Copy link untuk satu kartu.
- **Assets:** Favourite dan Hide untuk pilihan apa pun. Duplicate, Download, dan Delete muncul hanya bila setiap item terpilih adalah unggahan Anda sendiri, karena aset design system bersama adalah kontrak permanen.
- **Projects:** lihat [Find and recover your work](/info/find-your-work.html#find-something-you-saved).

![Bar seleksi galeri untuk dua tool, menawarkan Available offline, View sessions, Favourite dan Hide](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%21important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-select%3D%22gradient%22%5D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=misc-bulkbar-gallery&cropSelector=.gallery-bulkbar)
<!--
SHOT NOTE (misc-bulkbar-gallery): drive targets `[data-select="qr-code"]` /
`[data-select="gradient"]` - the `.tile-check[data-select="<ref>"]` checkbox button
confirmed directly in views/gallery.ts's card markup (the same attribute
cardMarkup gives every tile), so these two clicks tick both cards without
opening either tool.

SHOT NOTE (misc-sessions-by-tool, NOT PUBLISHED): the "View sessions" result
had a recipe of its own (`/#/p?tools=qr-code,d3`, views/projects.ts's
toolsBodyHtml()), dropped here because it has no `drive=` that can
manufacture its own content - a saved session isn't a click away, it has to
already exist, and build-docs-shots.ts gives every shot a fresh
`browser.newContext()`. It would publish an empty list. Same dependency the
`projects` shot (now on find-your-work.md) carries; revisit if the pipeline gains a
storage-seeding hook.
-->

**View sessions** muncul hanya setelah sesuatu dipilih. Klik kanan satu kartu yang tidak dipilih dan ia menawarkan **N saved sessions**, daftar sesi tersimpan alat itu tempat penghapusan memindahkan sesi ke Tempat Sampah.

## Di ponsel

Pada layar sempit, tata letak menjadi satu kolom:

- **Kontrol menjadi sheet** di bagian atas dengan pegangan seret di tepi bawahnya. Seret pegangan untuk menjepret ke **peek**, **half**, atau **full**, atau ketuk untuk menciutkan dan membentangkan. Pratinjau mengisi ruang di bawahnya dan tetap terlihat saat Anda menyunting.
- Tombol **Export** yang mengambang membuka sheet ekspor: format, ukuran, salin, simpan, dan unduh di satu tempat. Ketuk latar belakang untuk menutup sheet.

![Sebuah tool pada layar selebar ponsel - kontrol sebagai lembar di atas, palet hasil generasi mengisi pratinjau di bawah dan pil render mengambang di tengah bawah](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3Df97316%26harmony%3Dadjacent-3%26steps%3D9&width=430&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=vt-phone-palette)

## Settings, suara, dan kenyamanan

**Settings**, di dasar layar beranda, memuat detail Anda, design system, aksesibilitas, penyimpanan, dan unduhan offline. [Settings](/info/dashboard.html) memetakan setiap tab.

- **Detail dan foto profil Anda** mengisi alat apa pun yang dibuat untuk memakainya, seperti tanda tangan email atau tanda pengenal. [Profiles](/info/profile.html) membahasnya.
- **Accessibility** memiliki empat sakelar kenyamanan: **Reduce motion**, **Hide colourful previews**, **High contrast**, dan **Large text**. Sakelar ini mengubah aplikasi di sekitar pekerjaan Anda, tidak pernah kanvas alat atau ekspor.
- **Sound** memutar suara bantu yang lembut untuk apa yang Anda lakukan, dan **Neurospicy Mode** memutar trek fokus yang tenang. Keduanya mati sampai Anda menyalakannya, di **Settings → Accessibility** atau menu profil.
- **Available offline** mengunduh sisa aplikasi, alat Anda, katalog, dan panduan sebelum koneksi hilang. Lolly adalah aplikasi web yang dapat dipasang: gunakan tombol pasang di browser Anda, atau *Add to Home Screen* di ponsel, untuk aplikasi layar penuh yang memperbarui dirinya sendiri saat Anda kembali online.
- **Storage** menampilkan apa yang disimpan Lolly di perangkat ini. [If you clear your browser data](/info/find-your-work.html#if-you-clear-your-browser-data) menjelaskan apa yang dihapus oleh pembersihan, dan [Privacy Policy](/info/privacy.html) mencantumkan semua yang diambil atau dikirim aplikasi.

::: note Jika sebuah tampilan gagal dimuat setelah pembaruan
Panel kosong atau pesan "failed to fetch" tepat setelah pembaruan biasanya hilang dengan satu kali muat ulang. Pekerjaan tersimpan, sesi, dan design system Anda tidak tersentuh, karena disimpan di perangkat Anda. Hanya gambar yang Anda tambahkan dan tidak pernah disimpan yang mungkin perlu ditambahkan lagi.
:::

## Ke mana selanjutnya

- **[Design: the free canvas](/info/design.html)**: kanvas, bentuk, garis waktu, dan mempresentasikan deck.
- **[Batch and Multi-edit](/info/batch.html)**: banyak versi dari satu desain, atau beberapa desain tersimpan disunting bersama.
- **[Export a file](/info/exporting.html)**: memilih format, ukuran, satuan cetak, transparansi, dan video.
- **[Import a design](/info/design-import.html)**: bawa file Figma, Penpot, Illustrator, atau InDesign ke Design dan lanjutkan menyunting.
- **[Templates](/info/templates.html)**: titik awal tersimpan untuk sebuah alat.
- **[Wide Colour and HDR](/info/hdr-editing.html)**: pertahankan presisi gambar asli di Design dan Darkroom.
- **[Find and recover your work](/info/find-your-work.html)**: di mana semuanya berada, dan cara memindahkannya ke perangkat lain.
