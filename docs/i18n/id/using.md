# Menggunakan Lolly

Buka alat, ubah bagian yang diizinkan, simpan hasilnya dan bagikan sebagai tautan atau file.

Semuanya berjalan di perangkat Anda tanpa akun, dan berfungsi offline setelah alat serta aset yang diperlukan selesai diunduh. Untuk mulai berjalan, aplikasi memerlukan browser atau aplikasi dengan WebGPU. [Lingkungan yang didukung](/info/supported-environments.html) mencantumkan lingkungan yang telah diuji.

**Siklusnya**, dalam empat langkah:

::: steps
- <!--i:eti-home--> **[Buka alat](#find-your-way-around)** Klik kartu di layar beranda. Kontrol berada di samping pratinjau langsung.
- <!--i:eti-sliders--> **[Ubah input](#change-what-the-tool-lets-you-change)** Hanya input yang dibiarkan terbuka oleh pembuatnya. Klik desain untuk menemukan kontrolnya.
- <!--i:eti-folder-plus--> **[Simpan pekerjaan Anda](#saving-continuing)** **Save** menyimpannya di My library, dan Projects membukanya kembali.
- <!--i:eti-link--> **[Bagikan desain](#sharing-your-work)** Tautan yang memuat setiap input, atau satu file `.lolly`.
:::

<!--i:eti-home-->
## Kenali navigasinya

::: figure using-app-map
Layar beranda: empat tab di bagian atas dan bilah di bagian bawah. Alat yang terbuka menampilkan kontrol di samping pratinjau langsung.
:::

Ada empat tab di bagian atas layar beranda: **Tools**, **Utilities**, **Assets** dan **Projects**. Tools digunakan untuk membuat. Utilities mengonversi, memeriksa atau membersihkan file. Assets adalah pustaka Anda. Projects menampung pekerjaan yang Anda simpan.

Bilah di bagian bawah memuat **Open**, **Settings**, field pencarian, pintasan **Verify** ke Lolly Verify dan **Docs**, yang membuka panduan ini. Bilah tampil di Tools, Utilities, Assets, Projects, Settings dan panduan dalam aplikasi, lalu tersembunyi saat alat terbuka. [Lolly Search](/info/search.html) menemukan alat, pekerjaan tersimpan, aset dan pengaturan Anda dari field tersebut. [Ask Lolly](/info/ask.html) menjawab pertanyaan yang Anda ketik dengan bagian yang sesuai dari panduan ini.

Klik kartu untuk mulai membuat karya baru di alat tersebut. Buka kembali pekerjaan tersimpan dari **Projects**. Pada kunjungan pertama, bilah sapaan di bagian atas galeri menawarkan satu tindakan untuk memulai: **Start making** pada Lolly Demo, atau **Make it yours** untuk menyiapkan design system sendiri.

![Kartu galeri dengan navigasi contoh dan tindakan New](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&localize=1&dark=1&cropSelector=.gtile%5Bdata-tool-id%3D%22design%22%5D&filename=gallery&try=1)

Tampilan setiap alat terbagi dua: **kontrol** di satu sisi dan **pratinjau** langsung di sisi lainnya. Pratinjau diperbarui saat Anda mengubah kontrol, dan hasil ekspor sama dengan yang Anda lihat.

![Tampilan terbagi alat - tumpukan kontrol di kiri, dan grafik batang berkelompok langsung yang digambarnya di kanan](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26t%3DExample%2520data%26st%3DSample%2520values%252C%2520not%2520a%2520real%2520dataset%26d%3DMonth%252CSeries%2520A%252CSeries%2520B%252CSeries%2520C%250AJan%252C12%252C9%252C5%250AFeb%252C18%252C14%252C7%250AMar%252C24%252C17%252C11%250AApr%252C29%252C23%252C15%26lg%3D1&width=1440&height=900&dpi=192&waitMs=2500&walker=1&format=svg&dark=1&filename=vt-tool-split-view)

**Lolly Design** berbeda: kanvas bebas berisi kotak yang dapat diseret, diubah ukurannya dan diisi teks, dengan bilah atas, garis waktu dan kontrol deck sendiri. Panduannya adalah [Lolly Design: kanvas bebas](/info/design.html).

<!--i:eti-sliders-->
## Ubah bagian yang diizinkan alat

Alat hanya menampilkan input yang dirancang untuk diubah. Pembuatnya menetapkan warna, tata letak, tipografi dan logika agar pekerjaan Anda mengikuti aturannya. Input meliputi teks, penggeser, pemilih warna, dropdown, tanggal, pemilih gambar dan grup baris berulang. Sebagian berada di bagian yang dapat dilipat.

![Tumpukan kontrol alat - field teks, pemicu warna dan penggeser, tanpa bagian lain yang dipilih pembuatnya untuk dikunci](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=%23tool-inputs&walker=1&format=svg&dark=1&filename=use-tool-inputs)

**Klik desain untuk menemukan kontrolnya.** Klik elemen dalam pratinjau dan kontrolnya bergulir hingga terlihat serta mendapat fokus. Dalam grup baris berulang, baris yang diklik akan terbuka.

**Clear changes**, di atas kontrol, mengembalikan semua input ke nilai default.

**Pilihan design system.** Saat design system menyediakan beberapa colourway, tampilan terang dan gelap atau pilihan tema lain, semuanya ada di bagian **Design system** di bawah kontrol. Pilihan hanya ditampilkan jika memengaruhi alat ini, sehingga utilitas file tidak menampilkan bagian tersebut. Setiap colourway berupa titik dengan warnanya sendiri, terang dan gelap berupa dua tombol dan pilihan lainnya berupa daftar.

Pilihan berlaku untuk karya ini. Pilihan ikut dalam tautan dan sesi yang disimpan. Setiap warna yang terhubung ke design system mengikuti pilihan tersebut, sedangkan warna aplikasi tetap seperti semula. Pilihan yang sama tersedia di tab **Canvas** pada Inspector Lolly Design. Alat yang menjadikan warna sebagai kontennya dapat tetap menggunakan colourway kanonis dan tidak menampilkan titik colourway. [Penggunaan Lolly Demo](/info/lolly-demo-in-use.html#colourways-on-real-work) memperlihatkan colourway pada karya nyata. Untuk menggunakan satu colourway bagi aplikasi dan setiap karya baru, pilih di **Settings → Appearance** ([Jadikan colourway pilihan Anda](/info/colourways.html#make-a-colourway-your-own)).

### Zoom dan geser pratinjau

- **Zoom:** Cmd/Ctrl-gulir atau cubit di trackpad, dengan penunjuk sebagai pusat. Pada keyboard, `0` atau `Shift+1` menyesuaikan semua konten, `1` atau `Shift+0` mengatur 100% dan `Shift+2` menyesuaikan pilihan. `+` / `−` melakukan zoom di sekitar penunjuk saat penunjuk berada di atas panggung, atau di sekitar pusat jika tidak.
- **Geser:** tahan **Space** sambil menyeret, atau seret dengan tombol tengah mouse. Klik biasa tetap dapat digunakan untuk mengeklik bagian desain.
- **Sentuh:** cubit untuk zoom, seret untuk menggeser dan ketuk dua kali untuk menyesuaikan.
- **Zoom HUD:** tekan dan tahan pusaran Lolly di sudut untuk menampilkan `−`, **Fit** dan `+`. Ketukan singkat pada pusaran tetap membuka menu profil.

Di Lolly Design, **Fit all** meliputi artboard dan lapisan lepas. Zoom manual dapat turun di bawah 20% hingga halaman mengisi separuh tampilan. Batas mutlaknya adalah nilai yang lebih kecil antara 5% dari skala Fit biasa dan zoom absolut 2%.

Mengubah ukuran keluaran selalu menyesuaikan kembali tampilan agar seluruh keluaran terlihat.

![Zoom HUD terbuka dari pusaran di sudut kanvas - minus, Fit, plus, lalu sakelar tema dan suara serta pegangan untuk menggesernya](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=.stage-nav%7Bopacity%3A1!important%7D&drive=drag%3A.stage-nav-profile%7Cdx%3D1%7Chold%3Bwait%3A700&cropSelector=.stage-nav&walker=1&format=svg&dark=1&filename=use-zoom-hud)

### Undo dan redo

**Cmd/Ctrl-Z** mundur satu langkah dan **Cmd/Ctrl-Shift-Z** (atau **Cmd/Ctrl-Y**) maju satu langkah. Tombol **Undo** dan **Redo** berada di atas kontrol, atau di bilah atas pada Lolly Design. Setiap tombol menjadi abu-abu saat tidak ada langkah yang tersisa. Pesan menyebutkan input yang dipulihkan setiap kali undo, disertai tombol **Redo**.

- **Satu seretan dihitung satu langkah.** Perubahan berulang pada kontrol yang sama dalam setengah detik disatukan menjadi satu langkah.
- **100 langkah terakhir tetap tersimpan.** Suntingan baru sesudah undo menghapus tumpukan langkah maju.
- **Di dalam kotak teks**, Cmd/Ctrl-Z berlaku untuk field tersebut, karakter demi karakter. Lolly mengambil alih pada penggeser, dropdown, warna dan sakelar.
- **Memilih file** pada input file tidak dihitung sebagai langkah, karena byte tersebut hanya disimpan untuk sesi ini.

Dalam [kolaborasi](/info/collaborate.html) langsung, perubahan dari perangkat lain tidak pernah masuk ke tumpukan undo Anda. Undo tersedia hingga Anda meninggalkan alat atau memuat ulang. Untuk perubahan yang lebih lama, alat yang menyimpan selama Anda bekerja mempertahankan versi terdahulu di **History** ([Kembali ke versi sebelumnya](/info/find-your-work.html#go-back-to-an-earlier-version)).

### Kamera langsung

Efek alat **Filter** (Halftone, Scanline, Posterize, Voronoi, Duotone, Stretch, Misprint, Dither, ASCII art dan Glitch) menampilkan tombol **Go live** jika kamera tersedia. Aktifkan agar efek mengikuti webcam Anda bingkai demi bingkai. Ekspor gerak merekam hasilnya sebagai GIF, WebM atau MP4. Bingkai diproses di perangkat Anda. Kamera dilepas begitu Anda berhenti atau keluar dari alat. Setiap pemilih gambar juga menyediakan **Take a photo** untuk mengambil satu bingkai.

<!--i:eti-folder-plus-->
## Menyimpan & melanjutkan

Untuk menyimpan pekerjaan Anda, tekan **Save**, tanda centang di sebelah **Export** pada pil render. Pekerjaan baru masuk ke **My library**, pekerjaan yang pernah Anda simpan diperbarui di tempatnya dan tidak ada file yang diunduh. Tombol **Save** yang sama juga ada di panel ekspor.

Untuk menentukan tempat penyimpanannya, tekan **Save as** di sebelah **Download** pada panel ekspor. Di bawah **Save to a project**, biarkan **My library** terpilih atau pilih proyek (**＋ New project…** membuat proyek baru), lalu tekan **Save**. **Save as a template** menyimpan desain sebagai [templat](/info/templates.html), titik awal untuk dokumen baru. Di Lolly Design, **Save as** ada di menu Lolly. Di ponsel, tekan **•••**, lalu **File menu**, lalu **Save as**.

![Pil render dengan dua bagian: Export, dengan panah ke atas yang membuka panel ekspor, dan Save, dengan tanda centang yang menyimpan di tempat](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=%23tool-inputs%7Bdisplay%3Anone%7D&cropSelector=.render-pill&walker=1&format=svg&dark=1&filename=use-render-pill)

::: timeline
- <!--i:check--> Tekan **Save** pada pil render, atau **Save as** untuk memilih proyek.
- <!--i:folder--> Item masuk ke **My library**, atau ke proyek yang Anda pilih.
- <!--i:home--> Saat ingin melanjutkan, tekan **Home** di kiri atas dan buka tab **Projects**.
- <!--i:document--> Buka item tersebut. Semua pengaturan kembali, siap diubah dan diekspor lagi.
:::

Item memakai nama file yang Anda ketik di panel ekspor, atau nama alatnya jika tidak ada, misalnya **QR Code**. File dari **Download** adalah salinan jadi. Untuk mengubahnya nanti, buka item tersimpan di Projects.

::: note Simpanan tetap di perangkat ini
Simpanan pribadi tetap di perangkat ini, dalam browser atau aplikasi tempat Anda menyimpannya, kecuali Anda mengaktifkan [Sync](/info/sync.html).
:::

Jika sesuatu tidak ada di tempat yang Anda harapkan, [Menemukan dan memulihkan pekerjaan Anda](/info/find-your-work.html) membahas setiap kasus, mulai dari tab yang ditutup hingga data browser yang dihapus.

::: details Proyek tim dengan Lolly Work (opsional)
Jika [organisasi Anda menggunakan Lolly Work](/info/organisation.html), masuk ke instansnya dan buka **Projects → Team projects** untuk melihat sesi yang dibagikan kepada Anda. Organisasi menetapkan akses dan retensi, dan layanan Lolly Work miliknya menyimpan sesi tersebut. Jika organisasi Anda mengizinkan penyuntingan langsung, sesi bersama akan bergabung ke kolaborasi langsungnya saat dibuka. [Bekerja bersama](/info/collaborate.html#collabs-through-lolly-work-optional) menjelaskan langkah-langkahnya.

Pustaka pribadi Anda tetap terpisah. Masuk di perangkat lain memberi Anda akses ke pekerjaan tim. Simpanan pribadi tetap memerlukan Sync atau cadangan untuk dipindahkan.
:::

<!--i:eti-link-->
## Berbagi pekerjaan Anda

Bagikan desain sebagai tautan atau file. **Share** pada kontrol ekspor membuka dialog yang menawarkan keduanya. **Share link** pada sesi tersimpan di Projects membuka dialog yang sama untuk sesi itu. Setelah Anda mengirim file ke Google Drive, Nextcloud, bucket S3, Dropbox atau OneDrive, dialog tersebut juga dapat membuat tautan melalui layanan itu ([Ekspor file](/info/exporting.html#how-export-works)).

::: cols
## Tautan

- Membawa setiap input dalam alamat, sehingga tautan mereproduksi desain.
- Tidak menyertakan gambar dan file yang Anda tambahkan dari perangkat ini, teks yang sangat panjang dan daftar yang sangat besar.
- Terbuka di browser mana pun, sehingga Anda dapat menyimpan tautan sebagai bookmark, menempelkannya atau memasukkannya dalam commit.

## File .lolly

- Membawa sesi tersimpan beserta gambar dan file di perangkat ini, serta dapat membawa alat dan design system juga.
- Tidak menyertakan karya katalog berlisensi kecuali Anda memilih untuk menyertakan file-nya.
- Terbuka di Lolly: klik dua kali, gunakan **Open** atau jatuhkan di aplikasi.
:::

### Tautan

Tautan berada di bagian atas dialog, bersama **Copy** dan tombol **QR** yang membuka tautan tersebut di alat QR Code. Di bawah tautan, **Link options** memuat:

- **Open in the installed app** mengubah tautan menjadi alamat `lolly://` untuk Shortcuts, peluncur dan otomatisasi, dengan semua parameter tetap sama.
- **Shortest link** mengemas desain yang panjang menjadi token ringkas dan menunjukkan jumlah karakter yang dihemat. Bentuk yang dapat dibaca tetap tersedia.
- **Password-protect this link** mengenkripsi tautan di perangkat Anda dengan AES-256. Kata sandi tidak pernah menjadi bagian dari tautan.
- **Pin this tool version** menambahkan flag `_v`, sehingga pembaruan alat di kemudian hari tidak dapat mengubah hasil render tautan.
- **When the recipient opens the link…** memilih layar penuh, panel ekspor yang sudah terbuka, unduhan saat dibuka (`&export`) atau salinan ke clipboard (`&copy`).
- **Copy credit** menyalin keterangan "Dibuat dengan Lolly" beserta tautannya, untuk postingan atau slide.

Jika alat memuat field pribadi, seperti nama Anda, **Review personal fields** mengecualikan setiap field dari tautan sampai Anda mencentangnya. [Mode URL](/info/url-mode.html) membahas semua yang dapat dibawa tautan.

**Dialog menjelaskan apa yang tidak dapat dibawa tautan.** Saat membuat tautan, Lolly menghitung apa pun yang tidak muat dalam alamat. Jika ada yang tidak disertakan, dialog mencantumkannya dan mengarahkan Anda ke opsi file. Tautan yang hanya terlalu panjang mendapat catatan yang lebih ringan dengan jumlah karakternya.

**Beberapa alat menjadikan tautan sebagai keseluruhan produknya.** Jump Page mengumpulkan tautan Anda dalam satu halaman untuk dibagikan: tautan bio, presentasi atau etalase toko. Halaman itu adalah tautannya, sehingga tidak ada yang dihosting dan tidak ada akun di balik halaman tersebut. Pengunjung melihat halaman selebar layar, satu tautan per adegan saat menggulir.

![Jump Page di editor: adegan judul di bagian atas halaman, dengan adegan tautan di bawahnya](/t/url-shot?url=%2F%23%2Ftool%2Fjump%3Ffull%26heading%3DFind%2520us%2520everywhere%26subheading%3DOne%2520link%2520for%2520everything.%26links%3DURL%252CName%252CEmoji%257Ehttps%25253A%25252F%25252Fexample.com%252CWebsite%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fnews%252CNewsletter%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fhello%252CSay%252520hello%252C&width=900&height=1300&dpi=96&waitMs=2000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=use-jump-page)

::: details Tautan yang dikelola organisasi dengan Lolly Work
Untuk berbagi yang memerlukan masa berlaku, pencabutan atau kata sandi, Lolly Work menawarkan tautan terkelola ke sesi bersama, alat dan aset katalog. Tautan ini diakses melalui layanan organisasi dan mengikuti aturan aksesnya. Tautan ini terpisah dari tautan mandiri di atas. Mencabut tautan tidak dapat menarik kembali file yang sudah diunduh seseorang. [Render dan berbagi](/info/manage/sharing.html) mencantumkan jenis tautan dan izinnya.
:::

### File .lolly

**Download .lolly**, di bagian **Editable file** pada dialog Share, menulis desain saat ini sebagai satu file. Karya katalog biasa ikut disertakan bersama gambar dan file dari perangkat ini. File yang sudah kedaluwarsa atau tidak tersedia tetap disertakan sebagai referensi eksternal. Sebelum menyimpan, dialog menunjukkan ukuran file, jumlah file yang disematkan, jumlah file yang dirujuk dan apakah alatnya disertakan. Jika perangkat Anda memiliki panel berbagi, **Send to…** menyerahkan file ke panel berbagi (AirDrop, berbagi di Android).

**Download project (.lolly)**, di menu folder dalam **Projects**, menulis seluruh folder, sehingga orang lain dapat melanjutkan setiap sesi di dalamnya. Sesi batch tidak disertakan, dan pemberitahuan menyebutkan jumlahnya. **Download originals**, di menu yang sama, menulis zip biasa dengan setiap item sebagai file tersendiri.

Sebelum file dikirim, Anda menentukan tiga hal:

- **Apakah nama Anda disertakan.** Nama, email dan organisasi Anda hanya ditulis jika **Use my details to create** aktif di [profil Anda](/info/profile.html). Jika nonaktif, file hanya mencatat bahwa file dibuat dengan Lolly dan kapan pembuatannya.
- **Apakah karya yang dikecualikan disertakan.** Karya berlisensi dan karya yang dikunci untuk merek tertentu tidak disertakan secara default, begitu pula karya katalog yang catatan lisensinya belum dapat dibaca Lolly. Jika desain menggunakan karya tersebut, dialog menyebutkan jumlahnya dan menawarkan *Download without them* atau *Include and download*. Menyertakannya memberikan file tersebut kepada siapa pun yang membuka `.lolly`. Karya katalog tanpa catatan hak apa pun ikut disertakan, dan dialog mencantumkan setiap karya agar Anda dapat memeriksanya sebelum mengirim. `CREDITS.txt` dalam file mencantumkan apa yang disertakan dan yang tidak, beserta alasannya. [Hak kreatif dan kredit](/info/creative-rights.html) menjelaskan aturannya.
- **Apakah alat disertakan.** **Include the tool** mengemas file milik alat tersebut, sehingga desain terbuka di perangkat yang tidak memiliki alat itu. Opsi ini dicentang secara default untuk alat khusus, seperti fork, dan tidak dicentang untuk alat yang tercantum dalam katalog bertanda tangan. Pada build tanpa katalog bertanda tangan, setiap alat dianggap khusus.

**Membuka file.** Di aplikasi desktop dan seluler, klik dua kali atau ketuk `.lolly`, pilih **Open with Lolly** atau kirim ke Lolly dari panel berbagi. Di aplikasi web, tekan **Open** atau jatuhkan file di Lolly. Setiap cara membaca manifes file terlebih dahulu dan menampilkan ukuran, isi serta apa yang akan terjadi, sebelum apa pun ditulis.

::: warning Memasang alat menjalankan kodenya
Jika file membawa alat yang belum Anda miliki, **Trust this tool?** menampilkan alat beserta pembuatnya, dan menyatakan bahwa membukanya akan menjalankan kode alat tersebut di perangkat Anda. **Trust & install** melanjutkan pemasangan.
:::

Jika Anda menolak, pekerjaan tetap disimpan di Projects dan menunggu hingga Anda menambahkan alatnya. Alat yang kodenya didistribusikan sebagai modul belum dapat dipasang dengan cara ini, dan ditolak dengan cara yang sama.

::: details Isi .lolly dan cara membukanya
`.lolly` adalah ekstensi bundel Lolly, dan `format` dalam `manifest.json` menjelaskan isinya:

- **Desain bersama** (`lolly-share`) memuat satu sesi tersimpan, file yang disematkan dan tanda terima untuk apa pun yang masih diakses melalui referensi. File ini juga dapat membawa alat dan design system. Membukanya menambahkan Project baru dan tidak pernah menimpa sesi.
- **Proyek bersama** (`lolly-share`, jenis `project`) memuat folder dari Projects: subfoldernya, setiap sesi di dalamnya beserta ubinnya dan gambar yang disimpan di sana. Membukanya menambahkan salinan folder. Setiap sesi disertakan sebagai `sessions/<key>.json` dengan ubinnya di `thumbs/`. Versi Lolly sebelum adanya file proyek meminta Anda memperbarui aplikasi.
- **Paket design system** (`lolly-brand`) memuat token dan dapat memuat font, logo, versi yang diterbitkan dan sumber daya yang dipertahankan. Membuka paket menambahkan design system terpisah dengan nama tersendiri dan mengaktifkannya.
- **Paket ruang kerja atau instans** adalah `lolly-brand` dengan alat dan aset katalog yang dideklarasikan, serta alamat instans jika ada. Memuatnya mengganti satu-satunya lapisan ruang kerja yang dimuat sebelumnya, dan pratinjau mencantumkan dampaknya pada seluruh perangkat.

Cadangan lengkap perangkat bukan `.lolly`. Cadangan tetap berupa `LollyTools-….zip` (format `lolly-backup`) dan dipulihkan melalui **Settings → Storage → Import data…**. Folder alat yang dikompresi juga tetap berupa `.zip`. [Transfer data](/info/data-transfer.html) adalah referensi formatnya.

`.lolly` adalah zip biasa. Ubah namanya menjadi `.zip` untuk melihat isinya. Gambar Anda sendiri berada di `assets/uploads/` dan karya katalog di `assets/catalog/`. `manifest.json` mencantumkan setiap file, dan README menjelaskan file tersebut.

macOS, Windows, Linux, iOS dan Android semuanya mendaftarkan format ini. Pengelola file desktop menampilkan file sebagai dokumen Lolly, dan GNOME Files dapat menampilkan thumbnail milik sesi tersimpan. Membukanya dari Lolly Design System Setup merekomendasikan tindakan design system jika desain bersama membawa design system, tetapi tidak pernah menyembunyikan **Open shared design**.

Di iOS atau Android, dokumen yang diterima dari aplikasi lain dibatasi hingga 48 MB, dan aplikasi menyatakan batas tersebut. Proses penyerahan menyalin byte-nya melintasi batas aplikasi. **Open** di dalam Lolly tidak memiliki batas itu, jadi gunakan untuk bundel yang lebih besar.

Setelah Anda mengonfirmasi, Lolly mendekompresi dan memverifikasi bundel satu kali. Aset masuk ke pustaka Anda, dicocokkan berdasarkan checksum agar file yang sudah ada di perangkat digunakan kembali. Sesi masuk ke Projects dengan ID baru, sehingga file yang sama dapat dibuka dua kali. Sesi yang alatnya belum tersedia menunggu di sana. File di atas 100 MB ditandai sebagai besar, dan pratinjau memperingatkan jika penyimpanan browser melaporkan ruang kosong yang lebih sedikit daripada kebutuhan file. Setiap bagian yang tercakup dalam pemeriksaan integritas diperiksa sebelum apa pun disimpan secara permanen, dan salinan yang rusak ditolak tanpa meninggalkan apa pun.
:::

Tautan dan file sama-sama menyerahkan salinan keadaan saat itu. Untuk penyuntingan langsung, [Bekerja bersama](/info/collaborate.html) membahas kolaborasi pribadi antara dua perangkat dan kolaborasi kerja opsional melalui Lolly Work.

<!--i:eti-images-->
## Assets - pustaka Anda

**Lolly Assets** (`#/a`) berisi bahan yang dapat digunakan alat Anda: logo merek, gambar, audio dan gerak yang dikelompokkan menurut jenisnya, serta file Anda sendiri. Unggahan disimpan di perangkat Anda. Organisasi yang menggunakan Lolly Work juga dapat menyediakan katalog bersama dengan aturan aksesnya sendiri ([Menggunakan Lolly di organisasi Anda](/info/organisation.html)).

![Assets, dengan swatch dan font merek serta unggahan Anda sendiri](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches%2Cfonts&width=1440&height=900&dpi=96&waitMs=2400&css=.plat-swatch-grid~%2A%7Bdisplay%3Anone%7D&walker=1&format=svg&localize=1&dark=1&filename=assets)

- <!--i:upload--> **Masukkan file Anda.** Jatuhkan gambar, SVG, klip audio, video, Lottie, PDF atau deck PowerPoint di area unggah, atau klik untuk memilih. File langsung muncul di Assets dan di pemilih aset setiap alat. PDF multihalaman atau `.pptx` menanyakan halaman atau slide yang ingin disimpan, dan masing-masing menjadi aset SVG. Gambar yang Anda tambahkan di dalam alat disimpan tanpa perubahan di **My images**, sehingga Content Credential pada gambar tetap dapat diverifikasi. Hanya file yang sangat besar yang menanyakan apakah ukurannya perlu diubah. **Settings → Storage** menunjukkan jumlah yang disimpan **My images**. Tidak ada batas selain kapasitas penyimpanan perangkat Anda. Untuk menghapus data EXIF dan GPS saat mengunggah, aktifkan **Strip metadata from uploads** di **Settings → Feature flags**. Content Credentials tetap dipertahankan dalam kedua kondisi.
- <!--i:star--> **Favoritkan yang sering Anda pakai.** Beri bintang pada aset atau swatch merek untuk menyematkannya di bagian atas setiap pemilih.
- <!--i:folder--> **Rapikan.** Pindahkan aset ke grup lain, sembunyikan aset merek bersama yang tidak Anda gunakan (**Show hidden** memunculkannya kembali) atau hapus unggahan Anda sendiri. Bilah pilihan yang sama seperti di Projects dapat menangani seluruh pilihan.
- <!--i:layers--> **Pisahkan video dari latar belakangnya.** Buka detail video, atau klik kanan kartunya di pemilih aset, lalu pilih **Remove background…**. **On-device model** memisahkan subjek dari adegan yang ramai. **Colour key** menghapus latar dengan pencahayaan merata seperti layar hijau dan tidak memerlukan unduhan. **Tolerance**, **Softness** dan **Spill removal** menyesuaikan tepinya. **Resolution** (360, 480, 720 atau 1080p, tidak pernah melebihi sumber) menyeimbangkan detail dan kecepatan. Hasil potongan berupa WebP atau PNG animasi dengan transparansi, disimpan di sebelah aslinya. Content Credential sumber ikut dalam hasil potongan sebagai bahan penyusun. [Dihasilkan sekali, dirender sama](/info/ai-features.html) menjelaskan mengapa ini tetap merupakan suntingan biasa.

### Bawa palet dan font Anda ke mana saja

Panel **Swatches** di Assets menampilkan warna merek Anda: warna merek, warna yang Anda tambahkan, deret gradasi dan spektrumnya. Warna peran yang disimpan Lolly untuk antarmuka (teks, permukaan, tepi, warna utama colourway dan salinan warna merek dengan nama lain) berada di balik kartu abu-abu **Show colour roles** di bagian bawah panel.

Setiap warna berupa kartu seperti aset lainnya. Klik satu kartu untuk membuka detailnya, pilih beberapa untuk mengunduh warna tersebut atau unduh seluruh palet dalam format yang dapat dibaca alat Anda yang lain:

- <!--i:code--> **Design tokens (JSON)**, **CSS variables** atau **CSS classes**, untuk stylesheet atau build. Warna dengan gamut lebih luas dari sRGB mempertahankan nilainya yang luas: CSS menetapkannya setelah hex, dan JSON menyimpan hex bersama warna gamut luas, komposisi CMYK dan tinta spot.
- <!--i:palette--> **Adobe Swatch Exchange (.ase)**, untuk Illustrator atau Photoshop. Warna yang dikunci ke komposisi CMYK hadir sebagai swatch CMYK tersebut, tinta spot sebagai swatch spot bernama dan warna dengan gamut lebih luas dari sRGB sebagai Lab.
- <!--i:pentool--> **GIMP palette (.gpl)**, untuk GIMP atau Inkscape, dan **SCSS variables**, keduanya dalam sRGB.

![Panel Swatches - lima tombol unduh palet di bagian atas, lalu setiap warna merek sebagai chip yang membuka detailnya](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches&width=1440&height=900&dpi=96&waitMs=1800&css=.cat-group%3Anot%28%5Bdata-group%3Dswatches%5D%29%7Bdisplay%3Anone%7D&cropSelector=%5Bdata-group%3Dswatches%5D&walker=1&format=svg&dark=1&filename=use-swatch-downloads)

::: details Pilih beberapa warna, atau buka detail satu warna
Pilih warna dengan titik pada setiap kartu: klik titik kedua sambil menahan Shift untuk memilih semua di antaranya, seret kotak melalui celah atau tekan Cmd/Ctrl+A saat kartu mendapat fokus. Bilah menawarkan **Download as…** dalam enam format yang sama, **Copy hex** dan **Favourite**. Sebelum Anda memilih format, menu mencantumkan warna yang tidak dapat dimuat format mana pun (Transparent tidak memiliki warna), format yang menyimpan warna gamut luas sebagai warna sRGB cadangannya (SCSS dan GIMP) dan format yang membawa nilai CMYK serta spot (JSON dan .ase). Klik kanan kartu untuk tindakan yang sama pada satu warna.

Detail warna mengisi pratinjau dengan warna tersebut dan membuka **Linked values** (komposisi CMYK atau tinta spot, nilai yang dibuat untuk ruang warna atau mesin cetak tertentu dan token desainnya), **Every notation** (hex, OKLCH, Display-P3 dan lainnya, masing-masing dengan tombol salin), **Plotted on a colour space**, **Tones** dan **Readability**. Tombol panah berpindah melalui palet, **Copy link** membagikan warna dan **Open in Colour Lab** membuka warna untuk dikerjakan lebih lanjut.
:::

Panel **Fonts** mencantumkan jenis huruf merek Anda dengan **download** untuk masing-masing, agar dapat dipasang secara lokal atau diserahkan ke percetakan.

<!--i:eti-grid-->
## Sesuaikan grid Anda

- <!--i:star--> **Favoritkan yang Anda gunakan.** Klik kanan kartu dan pilih **Add to favourites**. Alat mendapat ubin besar dalam strip di atas grid. [Favorit Anda](/info/favourites.html) membahas strip tersebut.
- <!--i:eyeoff--> **Sembunyikan alat yang tidak pernah Anda gunakan.** Klik kanan kartu, atau pilih beberapa, lalu pilih **Hide tool**. Alat menghilang dari grid dan dari hasil pencarian saat Anda mengetik di grid. Alat keluar dari grid dan tidak lagi muncul sebagai hasil saat Anda mengetik di grid. Ubin abu-abu **Show hidden tools (N)** di bagian akhir menampilkan kembali alat tersembunyi dalam keadaan redup, masing-masing dengan **Unhide tool** di menunya. Menyembunyikan hanya mengubah grid Anda: alat tetap terbuka dari tautan atau bookmark.
- <!--i:clock--> **Alat Anda lebih dulu.** Setelah Anda menyimpan pekerjaan dari tiga alat berbeda, baris chip **Yours** di atas grid menampilkan favorit dan alat terbaru Anda lebih dulu.
- <!--i:sliders--> **Atur sesuai keinginan.** **View options** mengatur tata letak (**Grid**, **Card** atau **List**), ukuran dan kepadatan kartu, urutan pengurutan dan filter kategori.

![Bagian akhir grid Tools dengan alat tersembunyi ditampilkan: kartu Wordmark yang diredupkan, dan di sebelahnya ubin abu-abu yang memunculkannya kembali, kini bertuliskan Hide hidden tools](/t/url-shot?url=%2F%23%2F&width=1440&height=680&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A.gtile--hiddenbox%3Bpress%3AEnd%3Bwait%3A800%3Bhover%3A.gtile--hiddenbox%3Bwait%3A300&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&rasterDpi=96&dark=1&filename=misc-hidden-tools)
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

**Terapkan tindakan pada beberapa kartu sekaligus.** Centang kotak centang setiap kartu, seret kotak pilihan di ruang kosong atau klik sambil menahan Shift/Cmd, dan bilah muncul dengan tindakan yang diizinkan tampilan tersebut:

- **Tools dan Utilities:** Favourite, Hide, Available offline, **View sessions** (Projects, hanya menampilkan sesi yang dibuat dengan alat tersebut) dan Copy link untuk satu kartu.
- **Assets:** Favourite dan Hide untuk pilihan apa pun. Duplicate, Download dan Delete hanya muncul jika setiap item terpilih merupakan unggahan Anda sendiri, karena aset design system bersama adalah kontrak permanen.
- **Projects:** lihat [Menemukan dan memulihkan pekerjaan Anda](/info/find-your-work.html#find-something-you-saved).

![Bilah pilihan galeri untuk dua alat, menawarkan Available offline, View sessions, Favourite dan Hide](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%21important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-select%3D%22gradient%22%5D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=misc-bulkbar-gallery&cropSelector=.gallery-bulkbar)
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

**View sessions** hanya muncul saat ada yang dipilih. Klik kanan satu kartu yang tidak terpilih untuk membuka **N saved sessions**: daftar sesi tersimpan dari alat tersebut, tempat penghapusan memindahkan sesi ke Trash.

<!--i:eti-layers-->
## Di ponsel

Di layar sempit, tata letak berubah menjadi satu kolom:

- **Kontrol menjadi panel** di bagian atas dengan pegangan seret di tepi bawahnya. Seret pegangan untuk berpindah ke **peek**, **half** atau **full**, atau ketuk untuk melipat dan membukanya. Pratinjau mengisi ruang di bawahnya dan tetap terlihat selama Anda menyunting.
- Tombol **Export** mengambang membuka panel ekspor: format, ukuran, salin, simpan dan unduh. Ketuk latar di belakang panel untuk menutupnya.

![Alat pada layar selebar ponsel - kontrol berupa panel di atas, palet yang dihasilkan mengisi pratinjau di bawah dan pil render mengambang di tengah bawah](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3Df97316%26harmony%3Dadjacent-3%26steps%3D9&width=430&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=vt-phone-palette)

<!--i:eti-copy-->
## Perangkat lipat dan iPhone Duo

Di perangkat lipat, iPhone Duo atau layar sentuh yang hampir persegi, Lolly menata alat dalam dua panel:

- **Kontrol di satu sisi, kanvas di sisi lain.** Kontrol ditempatkan jauh dari tangan yang Anda gunakan untuk menggambar. Pilih **Dominant hand** di **Settings → Accessibility**, atau tekan **Swap sides** di bagian atas kontrol. Dalam bahasa kanan-ke-kiri, kedua sisi bertukar tempat.
- **Pemisah mengikuti engsel.** Jika perangkat melaporkan lipatannya, kedua panel bertemu di lipatan, sehingga tidak ada kontrol atau karya di atas garis lipatan. Pada layar tanpa lipatan, seret pemisah ke sepertiga, setengah atau dua pertiga lebar layar. Lolly mengingat pilihan Anda untuk setiap tampilan di perangkat ini.
- **Di atas meja.** Saat perangkat setengah terbuka dengan lipatan melintang di layar, kanvas mengisi separuh atas dan kontrol berada di bawah lipatan. Saat Anda mempresentasikan, slide berada di atas, dengan catatan, slide berikutnya serta **Back** dan **Next** di bawah. Di Sequence, pratinjau berada di atas dan garis waktu di bawah.
- **Lolly Design, Design System Setup dan Assets.** Di Lolly Design, Inspector, lapisan dan panel ekspor menjadi tab di sebelah kanvas. Alat berjajar di sepanjang tepi luar kanvas, di bawah tangan Anda saat menggambar. Jika alat tidak muat, kolom dapat digulir dan efek pudar dengan panah menunjukkan arah alat lainnya. Di atas meja, alat berjajar di bagian bawah kanvas. Lolly Design System Setup menempatkan Board di satu sisi dan ruang yang Anda buka di sisi lain. Di Assets, detail aset terbuka di sebelah pustaka, sehingga ketukan berikutnya menampilkan aset berikutnya di tempat yang sama.
- **Tidak ada yang berada di garis lipatan.** Jika lipatan dilaporkan, dialog terbuka di halaman yang memuat kontrol. Kotak pencarian di bagian bawah layar beranda dan hasilnya juga demikian. Pada layar datar, semuanya tetap di tengah.
- **Melipat tidak menghilangkan apa pun.** Melipat, membuka lipatan atau memutar perangkat mempertahankan dokumen, pilihan, zoom dan field yang sedang Anda ketik, dengan kursor tetap di tempatnya.

Layar luar perangkat lipat tetap menggunakan tata letak ponsel di atas, begitu pula jendela Lolly yang menempati separuh layar terbagi.

<!--i:eti-smile-->
## Pengaturan, suara dan kenyamanan

**Settings**, di bagian bawah layar beranda, memuat detail Anda, design system, aksesibilitas, penyimpanan dan unduhan offline. [Pengaturan Lolly](/info/dashboard.html) menjelaskan setiap tab.

- **Detail dan foto profil Anda** mengisi alat yang dibuat untuk menggunakannya, seperti tanda tangan email atau lencana. [Profil](/info/profile.html) membahasnya.
- **Accessibility** memiliki empat sakelar kenyamanan: **Reduce motion**, **Hide colourful previews**, **High contrast** dan **Large text**. Sakelar ini mengubah aplikasi di sekitar pekerjaan Anda, tidak pernah kanvas alat atau ekspor. Di sebelahnya, **Dominant hand** menentukan sisi kontrol dalam tata letak dua panel.
- **Sound** memutar suara bantuan yang lembut untuk tindakan Anda, dan **Neurospicy Mode** memutar musik fokus yang tenang. Keduanya nonaktif sampai Anda mengaktifkannya di **Settings → Accessibility** atau menu profil. Penggeser **Sound shape** di bawah sakelar Sound mengubah suara dari tetesan lembut dan bulat (Bouba) menjadi ketukan dan goresan kering (Kiki), dengan denting Lolly di tengah. Musik Neurospicy mencakup stasiun yang dihasilkan Lolly: **Lolly Sings** beserta genrenya, dan tiga **Lofi stations**. Stasiun menghasilkan musik tanpa akhir saat diputar. Masing-masing memiliki kontrol drum dan tekstur (serta suasana pada Lofi), tautan untuk membagikan musik yang Anda dengar dan tombol untuk menyimpan musik ke aset Anda. [Musik yang dihasilkan](/info/generated-music.html) menjelaskan cara musik dibuat. **Music generator** di Utilities (`#/music`) memungkinkan Anda membentuknya.
- **Available offline** mengunduh bagian aplikasi yang belum tersedia, alat Anda, katalog dan panduan sebelum koneksi terputus. Untuk memasang Lolly sebagai aplikasi web, gunakan tombol pasang di browser Anda, atau *Add to Home Screen* di ponsel. Aplikasi yang terpasang berjalan dalam layar penuh dan memperbarui dirinya saat Anda kembali online.
- **Performance UI**, di **Settings → Feature flags**, memberi aplikasi tampilan lebih sederhana yang memerlukan lebih sedikit sumber daya untuk digambar. Kanvas alat dan ekspor tetap sama. Di perangkat lambat, Lolly mengaktifkan tampilan ini secara otomatis dan menjelaskan alasannya, dengan **Undo** dan **Keep** ([Performance UI](/info/configuration.html#curating-what-people-see)).
- **Storage** menunjukkan apa yang disimpan Lolly di perangkat ini. [Jika Anda menghapus data browser](/info/find-your-work.html#if-you-clear-your-browser-data) menjelaskan apa yang ikut terhapus, dan [Kebijakan Privasi](/info/privacy.html) mencantumkan semua yang diambil atau dikirim aplikasi.

::: note Jika tampilan gagal dimuat setelah pembaruan
Panel kosong atau pesan "failed to fetch" tepat setelah pembaruan biasanya teratasi dengan memuat ulang sekali. Pekerjaan tersimpan, sesi dan design system Anda tidak terpengaruh, karena disimpan di perangkat Anda. Hanya gambar yang ditambahkan tetapi belum pernah disimpan yang mungkin perlu ditambahkan lagi.
:::

<!--i:eti-map-pin-->
## Ke mana selanjutnya

- **[Lolly Design: kanvas bebas](/info/design.html)**: kanvas, bentuk, garis waktu dan mempresentasikan deck.
- **[Batch dan Lolly Multi-edit](/info/batch.html)**: banyak versi dari satu desain, atau beberapa desain tersimpan yang disunting bersama.
- **[Ekspor file](/info/exporting.html)**: memilih format, ukuran, satuan cetak, transparansi dan video.
- **[Impor desain](/info/design-import.html)**: masukkan file Figma, Penpot, Illustrator, InDesign, Affinity atau DXF ke Lolly Design dan lanjutkan menyunting.
- **[Templat](/info/templates.html)**: titik awal tersimpan untuk alat.
- **[Warna Gamut Luas dan HDR](/info/hdr-editing.html)**: pertahankan presisi gambar asli di Lolly Design dan Lolly Darkroom.
- **[Menemukan dan memulihkan pekerjaan Anda](/info/find-your-work.html)**: tempat semua pekerjaan berada dan cara memindahkannya ke perangkat lain.
