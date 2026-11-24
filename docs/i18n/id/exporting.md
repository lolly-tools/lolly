# Ekspor file

Tekan **Export**, bagian kiri pil **Export | Save**, pilih format di samping nama file dan tekan **Download**. File dibuat di perangkat Anda.

File berisi apa yang Anda lihat di kanvas. Menu format hanya mencantumkan apa yang dapat dibuat alat ini di browser ini.

Sebagian besar pekerjaan memerlukan salah satu dari tiga format:

| Untuk | Pilih | Karena |
|---|---|---|
| Layar, pesan atau slide | **PNG** | Semua aplikasi dapat membukanya, dan latar belakang transparan tetap terjaga jika alat menyediakannya |
| Halaman jadi, atau apa pun yang dicetak | **PDF** | Ukuran halaman sebenarnya yang tercetak sesuai tampilannya; **Print PDF**, jika disediakan alat, adalah versi CMYK untuk mesin cetak |
| Karya seni yang harus tetap tajam pada ukuran berapa pun | **SVG** | Bentuk vektor |

::: check Periksa file pada ukuran yang akan digunakan
Sebelum mengirim file, buka di layar yang menjadi tujuannya atau cetak pada ukuran aslinya.
:::

::: details Persetujuan dan pengiriman dengan Lolly Work (opsional)
Sebuah [organisasi yang menjalankan Lolly Work](/info/organisation.html) dapat memilih format dan pengaturan ekspor yang dilihat anggotanya. Bila persetujuan diperlukan, **Request approval** menggantikan **Download**. Ikuti kebijakan yang ditampilkan instans Anda.

Lolly Work juga dapat mengirim file ke tujuan S3, WebDAV dan HTTP yang dikonfigurasi, dengan langkah persetujuan, tanda terima pengiriman dan catatan audit. Pengiriman itu mengirim file ke layanan organisasi. Unduhan biasa tetap di perangkat Anda. Tujuan Send pribadi dan pengiriman organisasi dikonfigurasi secara terpisah.

Operator menyiapkan ini dengan [panduan pengiriman organisasi](/info/work-delivery.html). Untuk render dan batch server yang diantre, lihat [Batch dan otomatisasi CLI](/info/cli-automation.html#organisation-jobs-with-lolly-work).
:::

<!--i:eti-cpu-->
## Cara kerja ekspor

Tiga jalur menghasilkan file. Sebagian besar alat **merender kanvas**. Format teks dan data (HTML, Markdown, TXT, JSON, CSV, ICS, VCF) **dihasilkan dari konten alat**. Utilitas privasi seperti *Lolly Strip Hidden Data* **mentransformasi file yang Anda pilih** di perangkat Anda. Hasilnya tidak memiliki kanvas, watermark atau metadata tambahan.

![Tiga jalur ekspor bertemu pada file jadi: render kanvas, hasilkan teks atau data dari konten, atau transformasi file terpilih di perangkat.](/info/diagrams/concepts/three-export-paths.svg)

Pembuat alat memilih aksi yang ditawarkan panel ekspor. Set default adalah Copy, Download dan Save.

- <!--i:download--> **Download** menyimpan file. Jika Anda tidak dapat menemukannya sesudahnya, lihat [Temukan file yang Anda unduh](/info/find-your-work.html#find-a-file-you-downloaded).
- <!--i:photos--> **Copy** menaruh gambar di clipboard Anda. Bila browser tidak dapat menyalin gambar, Copy mengunduh file sebagai gantinya dan memberi tahu Anda.
- <!--i:folder--> **Save** menyimpan desain saat ini di Projects dan tidak pernah mengunduh file. **Save as**, di samping **Download**, menanyakan tujuannya (lihat [Menyimpan dan melanjutkan](/info/using.html#saving-continuing)).
- <!--i:link--> **Share** membuka dialog Share: tautan yang mereproduksi desain, sakelar saat kunjungan (layar penuh, panel ekspor, unduh atau salin saat dibuka) dan **Shortest link** opsional yang memadatkan status menjadi token ringkas (lihat [Mode URL](/info/url-mode.html)).

**Send to**, kartu di panel ekspor, mengirim file ke layanan yang Anda hubungkan. Setelah pengiriman ke Google Drive, Nextcloud, bucket S3, Dropbox atau OneDrive, **Create a share link** dapat membuat tautan di sana tanpa unggahan kedua. Bagian **Share through your cloud** pada dialog Share mengirim file `.lolly` dan membuat tautannya dalam satu langkah. Panel tautan menampilkan siapa yang dapat membuka tautan, tempat file disimpan dan kapan tautan kedaluwarsa. **Links you've shared**, di dialog Share, memungkinkan Anda berhenti berbagi. Tautan Nextcloud dapat memiliki kata sandi dan tanggal kedaluwarsa. Tautan S3 berlaku 1 hingga 7 hari dan tidak dapat dihentikan lebih awal. Lolly tidak menyimpan salinan file atau token masuk di server. [Privasi](/info/privacy.html#every-network-request-the-app-can-make) mencantumkan apa yang diterima setiap layanan.

![Panel ekspor - format, ukuran dan aksi Copy / Download / Save / Share](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&walker=1&dark=1&filename=export-panel)

Bila desain menyematkan render alat lain, seperti kotak gambar Lolly Design yang memuat tautan QR Code, ekspor induk menggambar render bersarang tersebut. Hasilnya tetap vektor dalam SVG dan PDF dan dirasterisasi dalam PNG, JPG dan WebP. Render yang disematkan tidak mendapat watermark atau provenansi sendiri; hanya file jadi yang mendapatkannya. Ekspor HTML, Markdown dan TXT tidak dapat memuat render gabungan.

<!--i:eti-file-->
## Pilih format

Nama file dan menu format berada bersama sebagai satu pasangan `name.format`, di bawah **Download**.

![Field nama file menyatu dengan pemilih format, sehingga ekspor terbaca sebagai satu pasangan name.format](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.filename-extension&walker=1&dark=1&filename=exp-format-picker)

Mulai dari ke mana file akan pergi. Setiap kartu mencantumkan format yang cocok untuk tujuan itu.

::: figure exporting-format-chooser
Enam tujuan dan format yang cocok untuk masing-masing.
:::

Wordmark yang diset dengan jenis huruf design system Anda diekspor sebagai SVG dengan setiap huruf sebagai path kontur. File tetap tajam pada ukuran berapa pun.

Teks dalam bahasa lain bergantung pada font yang Anda miliki. Bila font dalam design system Anda memiliki hurufnya, SVG dan PDF menggambarnya sebagai kontur, terbentuk dan dalam urutan baca, termasuk baris kanan-ke-kiri. Bila tidak ada yang memilikinya, Lolly menggunakan [font cadangan](/info/fallback-fonts.html), dan kartu ekspor menampilkan font tersebut. Teks yang tidak tercakup font cadangan mana pun tetap menjadi teks live dalam SVG, digambar oleh font milik penampil. Dalam PDF, EPS atau WMF, dan dalam EMF dengan **Outline fonts** aktif, teks itu menjadi gambar. Kata-kata tersebut tampak seperti di halaman tetapi tidak dapat dipilih atau dicari. Kartu ekspor mencantumkan aksara tersebut. Tambahkan font dengan huruf itu agar tetap menjadi teks vektor.

![Wordmark setipis rambut dengan jarak antarhuruf lebar bertuliskan Aurora, jenis karya vektor murni yang dibahas baris SVG pada tabel](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DAurora%26weight%3D200%26tracking%3D16%26size%3D200%26full&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=%23tool-canvas&walker=1&format=svg&filename=vt-wordmark-vector)

::: details Setiap format dan kegunaannya
| Anda ingin | Gunakan | Mengapa |
|---|---|---|
| Logo tajam atau karya seni yang dapat diskalakan | **SVG** | Vektor: dapat diskalakan, kecil dan dapat disunting; efek yang tidak dapat digambar ekspor vektor disematkan sebagai gambar |
| Vektor untuk aplikasi Office dan Windows | **EMF** | Ditempel sebagai vektor yang dapat disunting ke PowerPoint dan Word, dengan teks live; Google Drive membukanya di Google Drawings |
| Vektor untuk cetak dan aplikasi desain | **EPS**, atau **EPS (CMYK)** | Vektor PostScript untuk Illustrator dan alur kerja percetakan |
| Vektor untuk mesin potong | **DXF** | Pemotong laser, plotter vinil dan CNC: path kontur dalam milimeter |
| Deck slide yang dapat disunting | **PowerPoint** (PPTX) | Teks dan bentuk native yang dapat disunting, dengan gambar dan vektor tetap dapat diekstrak |
| Dokumen teks yang dapat disunting | **Word** (DOCX) atau **OpenDocument** (ODT) | Paragraf dan judul yang dapat terus disunting pengolah kata (Lolly Doc Studio) |
| Tata letak untuk InDesign | **InDesign IDML (static subset)** | Teks, persegi panjang, oval dan gambar, satu spread per artboard (Lolly Design) |
| Dokumen Penpot yang dapat disunting | **Penpot** | Board, bentuk, teks dan token tertaut |
| Foto atau gambar serbaguna | **PNG** (lossless) atau **JPG** (lebih kecil) | Raster universal |
| Gambar modern yang lebih kecil | **WebP** atau **AVIF** | Kompresi lebih baik, dengan transparansi |
| Cetak | **PDF**, atau **Print PDF** (CMYK) | Ukuran halaman sebenarnya; CMYK untuk mesin cetak |
| Raster cetak untuk mesin cetak | **Print TIFF** (CMYK) | Piksel DeviceCMYK untuk RIP |
| Animasi untuk web | **GIF** | Diputar di mana-mana; file lebih besar |
| Animasi dengan warna penuh dan transparansi nyata | **APNG** | PNG animasi: tanpa batas palet |
| Animasi, file terkecil | **Animated WebP** | Warna penuh dan transparansi, lebih kecil dari GIF atau APNG |
| Vektor animasi yang dapat diskalakan | **Animated SVG** | Mandiri; berulang di browser atau `<img>`, pada ukuran apa pun (Lottie Ad) |
| Animasi yang tetap dapat disunting | **dotLottie** | Bentuk, path dan kunci transformasi luar dari garis waktu Lolly Design |
| Serah terima Premiere | **Premiere XML + media** | Klip bertempo dan media asli untuk Premiere (Lolly Design) |
| Video untuk media sosial dan berbagi | **MP4** atau **WebM** | Kualitas terbaik untuk ukuran file (lihat [Video](#video)) |
| Takarir | **SRT** atau **VTT** | Teks bertempo untuk pemutar video (Captions, Audiogram dan Record) |
| Takarir siaran | **TTML** atau **SCC** | Teks bertempo IMSC1.1, atau takarir pop-on CEA-608 (Captions; lihat [Takarir siaran](#broadcast-captions)) |
| Kursus pelatihan | **SCORM (LMS)** | Situs web, paket SCORM atau xAPI berversi (lihat [SCORM](#scorm-course-packages)) |
| Teks berformat atau tanda tangan email | **HTML** | Ditempel dengan format ke aplikasi email |
| Animasi yang diputar di browser | **HTML** | Pemutar dalam satu file, dari garis waktu Lolly Design atau Snippet (lihat [Video](#video)) |
| Konten polos | **MD** atau **TXT** | Hanya teks |
| Acara kalender | **ICS** | Diimpor ke aplikasi kalender mana pun |
| Kartu kontak | **VCF** | Diimpor ke buku alamat |
| Data terstruktur untuk diimpor kembali | **JSON** atau **CSV** | Memungkinkan konten alat diekspor dan diimpor kembali |
| Favicon | **ICO** | Ikon situs dalam beberapa ukuran; **ZIP** mengemas beberapa format |
:::

### Transparansi

Alat yang mendukungnya menawarkan sakelar latar belakang transparan, seperti **No BG**. PNG, WebP, AVIF, SVG, APNG dan Animated WebP mempertahankan transparansi, dan GIF mempertahankan tepi tegas. JPG dan PDF selalu opak. TIFF diratakan pada latar putih, atau pada latar hitam di jalur [HDR](#hdr-bright-colours).

<!--i:eti-crop-->
## Ukuran dan satuan cetak

Ekspor menggunakan ukuran piksel asli alat kecuali alat menawarkan **dimensi**. Dalam hal itu, Anda mengatur lebar, tinggi dan **satuan**:

- **px** (default) adalah jumlah piksel yang tepat.
- **mm, cm, in, pt** dan **pc** adalah ukuran fisik. Dengan satuan fisik, Anda juga mengatur **DPI** (default 300). **PDF** menjadi halaman sebenarnya pada ukuran tersebut. **Raster** mendapat jumlah piksel untuk DPI itu dan mencatat resolusinya. **SVG** mempertahankan satuan fisik dengan viewBox piksel.

Untuk raster beresolusi lebih tinggi, masukkan lebar dan tinggi yang lebih besar, atau pilih satuan fisik dan naikkan DPI (piksel = ukuran × DPI). Lebar `210`, tinggi `297` dan satuan `mm` menghasilkan halaman A4.

![Baris dimensi diatur ke 210 kali 297 mm, dengan field DPI ditampilkan karena satuannya fisik](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26w%3D210%26h%3D297%26unit%3Dmm%26format%3Dpdf%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-dims&walker=1&dark=1&filename=exp-export-dims)

<!--i:eti-images-->
## Gambar diam dari komposisi bertempo

Dari komposisi bertempo, seperti garis waktu [Sequence](/info/sequence-editor.html) di Lolly Design, ekspor gambar diam mengambil **bingkai pada playhead**. Tempatkan playhead pada posisi gambar yang Anda inginkan, lalu ekspor.

Untuk lebih dari satu momen, gunakan field **Frames** di samping ukuran keluaran. Field ini hanya muncul untuk komposisi bertempo dan format gambar diam (PNG, JPG, WebP, SVG atau PDF). `1` memberikan bingkai pada playhead. Angka yang lebih tinggi memberikan gambar diam sebanyak angka itu, tersebar merata di sepanjang sekuens:

- PNG, JPG, WebP dan SVG dihasilkan sebagai satu ZIP: `<name>-01.png`, `-02.png` dan seterusnya.
- PDF dihasilkan sebagai satu dokumen dengan jumlah halaman sebanyak itu.

Setiap gambar diam diambil dari tengah bagiannya di garis waktu, sehingga gambar pertama tidak pernah berupa kemunculan yang baru setengah memudar masuk dan gambar terakhir tidak pernah berupa momen kosong setelah klip berakhir.

::: figure exporting-contact-sheet
Frames: 4 membagi sekuens menjadi empat bagian yang sama dan mengambil bagian tengah masing-masing.
:::

Gunakan Frames untuk storyboard, lembar kontak tinjauan atau carousel media sosial yang diambil dari hasil penyuntingan video. Jumlahnya dibatasi hingga 64. Nilai lain yang diketik di field kembali ke `1`. Setiap bingkai adalah gambar diam biasa, sehingga kredensial, Imprint, satuan fisik dan DPI berperilaku seperti pada satu ekspor. Tautan ekspor, CLI dan MCP meminta lembar yang sama dengan `cuts=` (lihat [Lembar kontak](/info/url-export.html#contact-sheets)).

<!--i:eti-copy-->
## Banyak file sekaligus

Lolly memiliki tiga cara untuk bekerja dalam jumlah besar:

::: cols
## Tabel menjadi satu dokumen
Alat yang dibuat untuk membagi input tabel ke halaman mengubah setiap baris menjadi satu halaman. Tempel tabel dari spreadsheet Anda untuk mendapatkan satu PDF. Untuk memperbaiki baris, sunting spreadsheet dan tempel lagi. Battlecards adalah alat acuannya. Alat ini berada di folder sumber terbuka `community` dan tidak tercantum di lolly.tools.
## CSV menjadi satu file per baris
**Batch** (`#/batch`) menerima CSV dan merender satu ekspor untuk setiap baris, seperti lencana nama atau sertifikat, yang dikirim dalam ZIP. Lihat [Lolly Batch](/info/batch.html#make-many-versions-of-one-design).
## Beberapa desain mendapat satu suntingan
**Lolly Multi-edit** membuka beberapa sesi tersimpan berdampingan untuk membuat perubahan yang sama pada masing-masing sesi. Lihat [Lolly Multi-edit](/info/batch.html#edit-several-saved-designs-together).
:::

Alat dengan beberapa halaman, seperti Booklet, Print Sheet, Lolly Doc Studio atau Lolly Markdown Slides, mengekspor PNG, JPG, WebP, SVG dan format gambar tunggal lainnya sebagai satu file per halaman, dalam ZIP jika ada beberapa. Print Sheet mempertahankan lembar penuh dan tanda potongnya pada DPI yang dipilih.

Dari **Projects**, **Render folder** mengekspor setiap sesi tersimpan dalam folder dan subfoldernya sebagai satu ZIP bersarang. **Render selection** melakukan hal yang sama untuk pilihan beberapa item. Satu sesi tersimpan dirender menjadi filenya sendiri. Projects juga dapat membagikan kembali sesi tersimpan sebagai tautan alat yang membuka kembali sesi dengan pengaturan yang sama.

<!--i:eti-pen-->
## File yang tetap dapat disunting di tempat lain

Beberapa format menyerahkan pekerjaan Anda ke aplikasi lain sebagai konten yang dapat disunting, bukan gambar.

### PowerPoint (PPTX)

Lolly Design, Lolly Markdown Slides, Booklet, Lolly Doc Studio, Lolly Chart, Diagrams, Flow Chart dan Agenda mengekspor deck PowerPoint, satu slide per halaman. Setiap halaman dipisah menjadi objek native yang dapat disunting dan diekstrak rekan:

- <!--i:font--> **Teks** menjadi kotak teks PowerPoint yang dapat disunting dengan ukuran font, warna, ketebalan, cetak miring dan perataan tata letak tersebut. Deck Lolly Design menetapkan jenis huruf merek pada setiap segmen teks, bahkan tanpa master slide.
- <!--i:pentool--> **Vektor** seperti logo dan ikon disematkan sebagai gambar SVG, dan PowerPoint dapat menjalankan *Convert to Shape* pada gambar tersebut.
- <!--i:photos--> **Gambar** masuk sebagai gambar terpisah pada resolusi asli. Gambar utama yang dipangkas tetap menyimpan gambar penuh di balik pangkasan. Filter atau perpaduan apa pun pada gambar diterapkan secara permanen.
- <!--i:layers--> **Latar belakang, batas dan garis pemisah** menjadi bentuk persegi panjang dan garis. Lingkaran, elips dan pil dari Lolly Design tetap menjadi bentuk native yang dapat disunting.

![Panel ekspor dengan PowerPoint dipilih: satu slide per halaman, teks dan bentuk tetap dapat disunting](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio%3Foptions&width=1440&height=900&dpi=192&waitMs=2500&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22pptx%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-pptx)

Tata letak bersifat perkiraan. Apa pun yang tidak dapat direpresentasikan walker secara native, seperti area kompleks dengan filter atau mask, disematkan sebagai gambar. Deck memiliki satu ukuran slide, diambil dari halaman pertama.

PowerPoint juga menjadi jalur masuk: [Terapkan merek baru pada deck](/info/rebrand.html) memindahkan deck ke design system Anda, dan [Impor desain](/info/design-import.html) membukanya di Lolly Design.

### Penpot

Sebagian besar alat yang mengekspor SVG juga mengekspor **file Penpot** (`.penpot`).

| Yang Anda buat | Di Penpot |
|---|---|
| Teks | Objek teks yang dapat disunting |
| Bentuk, path, gradien dan gambar | Bentuk vektor yang dapat disunting |
| Warna atau font dari token design system | Tautan token live: sunting token dan setiap bentuk yang mewarisinya mengikuti |
| Seluruh desain | Komponen yang dapat digunakan kembali di panel Assets |
| Ilustrasi kompleks atau kanvas live | Gambar yang disematkan; konten di sekitarnya tetap dapat disunting |

Dari Lolly Design, setiap bingkai menjadi board Penpot. Warna dan tipografi design system masuk ke panel Assets dan seluruh set tokennya ke panel Tokens. Penpot menyimpan salinannya sendiri. Token yang disunting di Penpot kembali melalui impor di [Lolly Design System Setup](/info/brand-studio.html).

![Panel ekspor dengan Penpot dipilih: file .penpot dan Send to Penpot di samping unduhan](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22penpot%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-penpot)

Untuk membuka file, jalankan Penpot, pilih proyek dan pilih **Import**. Jika Anda masuk ke Penpot dari panel ekspor, **Send to Penpot** mengimpor file untuk Anda.

### Word, OpenDocument dan InDesign

**Lolly Doc Studio** mengekspor **Word** (DOCX) dan **OpenDocument** (ODT) dengan paragraf dan judul yang dapat disunting. File Word mengatur font dan warna teks merek melalui gaya dokumen, mengikuti ukuran halaman yang Anda pilih dan menambahkan PNG di samping logo SVG untuk aplikasi yang tidak dapat menggambar SVG.

**Lolly Design** mengekspor **InDesign IDML (static subset)**: teks, persegi panjang, oval dan gambar PNG atau JPEG, satu spread per artboard. Pemformatan inline yang didukung tetap dapat disunting, gambar ikut dalam `Links` dan koordinat menjadi poin InDesign. Penautan ulang, penggantian font dan perubahan pembungkusan teks mungkin perlu diperhatikan. Efek, animasi, alur teks yang disusun dan geometri yang tidak didukung menghentikan ekspor dengan laporan yang mencantumkannya. IDML tidak mempertahankan dokumen asli. Kirim PDF untuk karya seni jadi.

### Garis waktu: dotLottie dan Premiere

Dari garis waktu Lolly Design, **dotLottie** menulis animasi yang tetap dapat disunting di alat Lottie; [Animasi Lottie](/info/sequence-editor.html#lottie-animations) mencantumkan apa yang dipertahankannya. **Premiere XML + media** mengemas klip bertempo dan media aslinya untuk Premiere; lihat [Pertukaran XML Premiere](/info/sequence-editor.html#premiere-xml-exchange).

### SCORM (paket kursus)

Ekspor kursus nonaktif sampai Anda mengaktifkan **Training and courses** di bawah Settings → Preferences → Feature flags.

Lalu pilih **Export course** dari alat yang didukung, folder proyek atau pilihan. Di Lolly Design, memilih **SCORM (LMS)** dan **Download** membuka alur kerja kursus yang sama. Lolly menyimpan pekerjaan, menampilkan konten dan urutan kursus untuk ditinjau, lalu membuka modul dan dialog ekspornya.

- <!--i:layers--> Pilih bentuk penyajian untuk setiap sumber: halaman diam, gerak sebagai video, audio atau sumber daya yang dapat diunduh. Tambahkan teks pelajaran dan alternatif bacaan di modul.
- <!--i:clock--> Pratinjau pemutar untuk peserta dan tinjau deskripsi serta takarir. Gerak, termasuk animasi tanpa suara, disertakan sebagai video.
- <!--i:document--> Pilih Website, SCORM 1.2, SCORM 2004 4th Edition atau tujuan xAPI eksperimental. Periksa konten dan ukuran ZIP, lalu simpan dan unduh versi yang telah diperiksa.
- <!--i:check--> Penyelesaian mengharuskan konfirmasi setiap pelajaran wajib dan pemilihan Finish.

![Panel ekspor pada deck Lolly Design dengan SCORM (LMS) dipilih](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour%26format%3Dscorm%26options&width=1440&height=900&dpi=192&waitMs=3500&css=.fc-insp%7Bdisplay%3Anone!important%7D.edge-dock-slot--fill%7Bflex%3A1%201%20auto!important%3Bheight%3Aauto!important%3Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D.export-popup.is-floating%7Bheight%3Aauto!important%7D.export-popup-body%7Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D&drive=click:.edge-dock-tab%3Ahas-text%28%22Export%22%29;wait:600&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-scorm)

Paket memuat konten jadinya dan tidak memerlukan akun Lolly. Taruh ZIP Website di host HTTP(S); impor ZIP LMS tanpa perubahan. Uji tujuan sebelum membagikan kursus. Untuk kursus yang dibuat dari beberapa karya tersimpan, lihat [Buat kursus pelatihan](/info/training-creators.html).

### Takarir siaran

Alat Captions juga dapat mengekspor **TTML** dan **SCC**. Keduanya ditulis dari daftar cue yang sama dengan file SRT dan VTT, sehingga kata-kata dan waktunya cocok.

- **TTML** adalah IMSC1.1 Text Profile, dengan waktu jam berbasis waktu media dan satu area tengah bawah. Format ini tidak membawa warna, font atau posisi per takarir, karena takarir Lolly hanya memuat waktu mulai, waktu akhir dan teks.
- **SCC** membawa takarir pop-on CEA-608 pada kanal 1 dengan 29.97 bingkai per detik dan timecode drop-frame. Format ini mendukung karakter dasar Amerika Utara serta karakter khusus dan perluasannya. Jika takarir memiliki karakter yang tidak ada dalam set tersebut, ekspor berhenti dan menyebutkan karakternya. Setiap takarir dibungkus menjadi 32 kolom dan paling banyak 15 baris. Takarir yang tidak dapat dimuat sebelum waktu mulainya ditunda beberapa bingkai.
- Takarir roll-up dan paint-on tidak ditulis.

::: note SCC belum diperiksa di alat siaran
Format ini juga belum dicoba pada dekoder perangkat keras. Uji file dalam alur pemrosesan Anda sendiri sebelum pengiriman.
:::

### DXF (file potong)

Lolly Asset Export, Diagrams, Growth, Lolly Logo Wall, QR Code, Street Map, Wayfinding dan Wordmark mengekspor **DXF**, format pertukaran AutoCAD R12 yang dibaca pemotong laser, plotter vinil dan perangkat lunak CNC. Geometri ditulis sebagai path kontur dalam milimeter dan teks dijadikan kontur. Warna dipetakan ke AutoCAD Color Index terdekat, yang biasanya mengendalikan operasi pemotong. DXF hanya memuat seni garis: area foto atau berfilter tidak memiliki path potong dan dibuang dengan peringatan. Gunakan SVG atau PDF untuk mempertahankan konten raster. Teks yang tidak tercakup font mana pun, bahkan [font cadangan](/info/fallback-fonts.html), menghentikan ekspor dengan pesan yang mengutip teks tersebut.

Desain Street Map seluruhnya berupa garis, sehingga setiap jalan dan kanal menjadi path potong.

::: showcase
![Render Street Map Paris dalam tinta di atas warna krem - seni garis murni, sehingga setiap garis tetap utuh saat diteruskan ke pemotong](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Dparis%26roadColor%3D1a1a2e%26waterColor%3D93c5fd%26background%3Dfaf7f2%26full&width=1440&height=900&dpi=96&waitMs=3200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-street-map-cut)

Gulir, dan kamera mundur melewati geometri: tujuh path dan tanpa piksel. Pemotong membaca file yang sama.
:::

<!--i:eti-stamp-->
## Cetak

**Print PDF** menulis CMYK berdasarkan kondisi cetak bernama, dengan **Coated FOGRA39** sebagai default. Sampel warna merek dengan nilai tinta terukur mempertahankan nilai tersebut. Warna lain dikonversi melalui profil cetak: profil Coated FOGRA39 milik Lolly sebagai default, atau profil Anda sendiri saat Anda memilih baris **Embed**-nya. Abu-abu dan hitam tetap hanya pada pelat hitam, sehingga huruf kecil tidak dapat mengalami kesalahan registrasi. FOGRA51, SWOP dan GRACoL menggunakan konversi perangkat standar. Teks hitam juga mencetak tindih warna di bawahnya, sehingga mesin cetak yang sedikit meleset tidak meninggalkan tepi putih di sekeliling huruf. **Print TIFF** menulis piksel DeviceCMYK untuk RIP. Kontrol Colour profile mengatur keduanya ([Profil warna](#colour-profiles)). Print TIFF dan **EPS (CMYK)** memisahkan warna melalui profil cetak yang sama dengan Print PDF.

**Print marks & bleed** memiliki kartu sendiri pada format cetak: bleed dalam milimeter serta Crop, Registration, Bleed, Colour bars dan Stamp details. Stamp details mencetak tanggal, alat dan nama Anda di margin. Nama atau nama alat dengan huruf yang tidak dimiliki font margin, seperti Arab, Tionghoa, Sirilik atau emoji, digambar sebagai gambar dalam warna abu-abu yang sama. Kartu ekspor mencantumkan aksara tersebut.

Beberapa alat, seperti *Booklet*, membuat **PDF beberapa halaman**: sampul, konten yang mengalir ke sebanyak mungkin halaman yang diperlukan dan halaman belakang. Setiap halaman adalah halaman PDF potret sebenarnya dalam A4, US Letter atau A5. Anda dapat memaksa blok mana pun ke halaman baru. Ini adalah dokumen RGB tanpa tanda potong atau bleed; tanda tersebut milik Print PDF satu halaman. PDF Lolly Design juga dapat berupa **Notes handout**: satu halaman potret untuk setiap slide dengan catatan pembicaranya di bawah.

**Sebelum mengekspor.** Kartu **Before you export** di bagian bawah panel menampilkan apa yang akan dilihat percetakan: format, ukuran dan bleed, area potong dan bleed, cakupan tinta, jumlah pelat dan jumlah halaman, dengan penilaian di samping judulnya. Kartu tidak pernah memblokir ekspor. Lolly Design selalu menampilkan kartu dengan pemeriksaannya sendiri, termasuk aturan organisasi design system lapisan demi lapisan dan sinyal penulisan untuk teks dokumen ([Sebelum mengekspor](/info/design.html#before-you-export)). Lolly Design menambahkan pemeriksaan cetak ini saat **Print preflight** aktif. Di alat lain, aktifkan **Print preflight** di bawah Settings → Preferences → Feature flags. Secara default fitur ini nonaktif, dan penerapan Lolly Work dapat mengaktifkannya untuk para anggotanya.

**Setelah mengekspor.** Lolly membaca kembali file jadi dan membandingkannya dengan pilihan Anda: format, ukuran piksel atau halaman, panjang klip, latar belakang transparan, warna CMYK, HDR, Content Credentials dan kata sandi PDF atau ZIP. Apa pun yang berbeda ditulis di kartu ekspor. Setiap pengukuran berasal dari file, tidak pernah dari pengaturan. Properti yang tidak dapat dijawab file tidak dihitung sebagai kecocokan. Baris perintah menulis perbandingan lengkap dengan `--export-report` (lihat [Render dengan CLI](/info/cli-rendering.html)).

::: details Pemeriksaan aksesibilitas PDF dari baris perintah
**Pemeriksaan aksesibilitas PDF.** Untuk PDF, baris perintah juga mencantumkan 32 pemeriksaan aksesibilitas di file `--export-report`, di bawah `pdfAccessibility`. Setiap pemeriksaan memiliki id, deskripsi sederhana, hasil dan lokasi masalah yang ditemukan di dalam file:

- **Passed**: pemeriksaan meninjau sesuatu dan tidak menemukan kesalahan.
- **Failed**: pemeriksaan menemukan masalah. Nomor halaman atau tagnya dicantumkan.
- **Not applicable**: file tidak memiliki hal sejenis untuk ditinjau, seperti pemeriksaan tabel pada file tanpa tabel. Ini tidak menyatakan apa pun tentang file tersebut.
- **Needs a person**: enam pemeriksaan tidak dapat dinilai oleh program (urutan baca, kontras warna, kedipan, skrip, batas waktu dan tautan berulang).

Daftar ini bukan penilaian akhir. Daftar ini tidak menyatakan bahwa PDF memenuhi PDF/UA atau bahwa pengguna teknologi bantu dapat menggunakan PDF tersebut. Seseorang tetap perlu memeriksa file dengan pembaca layar. PDF buatan Lolly sendiri saat ini gagal dalam pemeriksaan tag, karena pengekspornya belum menulis tag. Pemeriksaan membaca file di perangkat Anda dan tidak mengubah apa pun. File yang memerlukan kata sandi ditandai sebagai belum diperiksa, bukan lulus. Untuk memeriksa PDF yang dikirim kepada Anda, seret ke [Lolly Strip Hidden Data](/info/utilities.html), yang menampilkan daftar yang sama di bawah **PDF accessibility checks**.
:::

Pemeriksaan Inspector Lolly Design dan perbandingan merek di Lolly Design System Setup meninjau desain. Kedua kartu ini meninjau file.

::: details Biaya dari kartu tarif
Di bawah preflight, kartu biaya mengubah hitungan yang sama menjadi nilai uang, bahkan saat kartu preflight nonaktif. Kartu ini memerlukan dua hal: pekerjaan yang harganya dapat dihitung dengan daftar harga (pelat, lembar, luas, halaman, baris varian atau file keluaran, sehingga PNG logo biasa tidak pernah menampilkan kartu) dan **kartu tarif**, daftar harga JSON dari percetakan Anda. Build default tidak membawa kartu tarif dan tidak memiliki cara untuk memuatnya di aplikasi. Kartu tarif hadir sebagai aset katalog yang disertakan dalam penerapan, atau melalui ekstensi kartu tarif opsional yang diaktifkan pengelola hosting mandiri atau bidang kendali. Tanpa kartu tarif, tidak ada yang ditampilkan.

Setiap angka adalah tarif yang Anda berikan dikalikan jumlah yang dihitung Lolly, seperti `4 plate × €35.00`. Total menampilkan sumbernya: penerbit pada kartu dan tanggal tarifnya. Tidak ada mata uang default dan tidak ada harga placeholder. Pernyataan file tentang dirinya sendiri tetap dilaporkan sebagai pernyataan file: *"File menyatakan: … Lolly belum memverifikasi ini."*

Bila angka tidak dapat dihitung, tabel ditarik, bukan diisi:

- Baris yang tidak diberi harga oleh kartu berarti **tidak ada total sama sekali**, hanya judul yang menyebutkan berapa banyak yang belum diberi harga.
- Jumlah yang merupakan batas atas menyertakan **"hingga"** pada subtotalnya.
- Tarif yang melewati tanggal berlaku hanya menampilkan **hitungan** sampai Anda menekan *Use these rates anyway*; tanggal kedaluwarsa kemudian tetap menyertai angkanya.
- Jika dibuka melalui **tautan**, nilai uang tetap tersembunyi sampai Anda memintanya di perangkat ini. CLI menerima `--rate-card=<file.json>` sebagai file lokal dan tidak pernah sebagai parameter tautan.

Kartu dihapus dari setiap tahap ekspor dan tidak pernah mengubah file. Ini perhitungan aritmetika, bukan penawaran harga. Hanya percetakan Anda yang dapat memberi penawaran harga.
:::

<!--i:eti-film-->
## Gerak dan suara

### Video

Alat animasi mengekspor **MP4** dan **WebM**. Tautan `?format=` yang dibagikan dan meminta kontainer yang tidak dapat dibuat browser ini beralih ke kontainer lainnya, dengan nama file yang sesuai. **Start after** menahan kanvas tetap diam agar animasi dan font stabil sebelum perekaman. **Duration** mengatur panjang klip jadi. **Motion blur** (Off, Draft quality, Standard atau High, dengan **Shutter angle**) memburamkan gerakan cepat dan memperlambat render. Bila browser mendukungnya, **Record live** merekam pratinjau di layar secara langsung melalui berbagi layar.

![Pengaturan waktu untuk ekspor animasi: Start after, Duration, Motion blur dengan Shutter angle-nya dan Record live](/t/url-shot?url=%2F%23%2Ftool%2Flottie-digi-ad%3Fformat%3Dmp4%26options&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=.video-params&walker=1&format=svg&dark=1&filename=exp-video-settings)

**Quality** memilih Smaller file, Balanced atau Best quality. **Advanced** membuka **Codec**, **Frame rate**, **Rate mode** dan **Hardware acceleration**. Bila alat memiliki takarir, **Captions** memilih **Embedded track** atau **Sidecar .vtt + .srt** di samping video. Tautan membawa kualitas, codec, laju bingkai, durasi dan jeda mulai sebagai `vq`, `codec`, `fps`, `seconds` dan `wait` ([Parameter URL](/info/url-parameters.html)).

Ekspor video mempertahankan suaranya. Alat dapat menempatkan **musik latar** di bawah klip: aset audio yang diulang atau dipangkas sesuai panjang klip, dengan pemudaran, volume dan penurunan volume saat suara rekaman terdengar. Alat perekam membawa audio langsungnya ke dalam file.

Deck klik Lolly Design juga dapat diekspor sebagai video. **Export slides as video** di menu Present membuka lembar ekspor pada MP4. Setiap slide diputar selama durasi tampilnya sendiri, atau selama Duration pada lembar ekspor jika tidak memilikinya. Transisi slide deck diputar di antara slide sebagai dissolve. Dokumen tidak berubah.

**HTML** dari dokumen Lolly Design bertempo, atau dari Snippet, adalah pemutar dalam satu file: kontrol putar, pencarian posisi dan suara di atas animasi, dengan font yang didukung, gambar dan suara disematkan. File diputar offline. Film Lolly Design yang memiliki adegan menambahkan menu adegannya. Sekuens yang memuat klip video, Lottie atau 3D belum dapat diekspor sebagai HTML; ekspor sekuens sebagai video.

### Gambar animasi

**GIF** diputar di mana-mana dan cocok untuk chat dan email; ukurannya lebih besar dan warnanya lebih sedikit daripada video. **APNG** dan **Animated WebP** mempertahankan warna penuh dan transparansi. **Lottie Ad** juga mengekspor **Animated SVG**: bingkai vektor dengan keyframe CSS yang disematkan, yang dapat diskalakan ke ukuran apa pun dan diputar berulang di tab browser atau `<img>` tanpa codec. Teksnya dijadikan kontur. Format ini menggunakan laju bingkai default lebih rendah karena setiap bingkai lebih berat daripada bitmap. Semuanya tanpa suara.

### Audio

Beberapa alat mengekspor suara saja. **Lolly Voice Recorder** merekam satu pengambilan mikrofon dengan pengukur level langsung dan menyimpannya sebagai **MP3**, **WAV**, **M4A (AAC)** atau **Opus (WebM)**, yang dienkode di perangkat Anda. `wav`, `mp3`, `m4a` dan `opus` adalah id format biasa, sehingga ekspor audio dapat dibagikan dan diotomatisasi dengan skrip seperti PNG.

Pemilih aset menerima banyak format audio untuk musik latar, dari MP3 dan FLAC hingga MIDI dan modul tracker; [Format](/info/formats.html) mencantumkannya. [Lagu Lolly Rondocode](/info/rondocode.html) diputar selama durasi yang diminta klipnya.

<!--i:eti-palette-->
## Warna dan HDR

Lolly membaca setiap warna CSS modern, menghitung warna secara perseptual dan menulis setiap file dalam ruang warna yang dapat dibuka pembaca: sRGB untuk layar, CMYK untuk cetak dan Rec.2100 PQ untuk HDR ([Warna dalam mesin](/info/colour-engine.html)). Dokumen Lolly Design yang diatur ke **Wide colour / HDR** mengikuti aturannya sendiri: lihat [Penyuntingan warna luas dan HDR](/info/hdr-editing.html).

### Profil warna

Ekspor diberi tag profil warna, sehingga aplikasi dengan pengelolaan warna seperti aplikasi percetakan, Photoshop dan browser membaca warna seperti yang Anda lihat. Thumbnail dan pratinjau tidak menyertakan tag agar tetap kecil.

- **PNG dan JPG** membawa profil ICC **sRGB** yang disematkan, ruang warna tempat pratinjau digambar. Piksel diberi tag, tidak dienkode ulang.
- **Print PDF (CMYK)** menyatakan kondisi cetaknya dalam *OutputIntent*, memberi tahu percetakan cara membaca tinta CMYK-nya.
- **Print TIFF (CMYK)** menulis piksel DeviceCMYK tanpa tag dan mencatat kondisi cetak dalam metadata TIFF-nya. TIFF tidak dapat menyematkan profil cetak, jadi baris **Embed** hanya mencatat nama profil tersebut.
- **TIFF (RGB)** adalah versi sRGB tanpa kompresi untuk arsip atau penyuntingan di editor lalu dikembalikan. Kedua TIFF hanya tersedia di desktop, karena browser tidak dapat menampilkan pratinjau TIFF.
- **SVG**, **EMF**, **EPS** dan **DXF** adalah vektor tanpa profil yang disematkan: warna SVG adalah sRGB, EMF dan EPS menggunakan RGB perangkat, **EPS (CMYK)** menulis DeviceCMYK dan DXF menggunakan AutoCAD Color Index. SVG, EPS dan DXF mengubah teks menjadi path kontur. EMF mempertahankan teks live yang dapat disunting di Office dan Google Slides dan hanya menjadikan kontur segmen yang tidak dapat direpresentasikan format tersebut. Opsi **Outline fonts** pada panel ekspor memaksa penggunaan path di semua bagian, seperti `_text=outline` dalam tautan dan `--text=outline` pada baris perintah. SVG juga mereproduksi bayangan kotak CSS, di dalam dan di luar.

::: details PDF/X-4 dan profil cetak Anda sendiri
Lolly menyertakan satu profil CMYK, yang disesuaikan dengan data karakterisasi FOGRA39 milik Fogra dan dirilis di bawah CC0, dan mengonversi warna melaluinya untuk kondisi cetak default. Profil tidak disematkan, karena menggunakan ICC versi 4.3 dan PDF/X-4 menerima versi hingga 4.2. Karena itu, kondisi cetak bernama menulis output intent tanpa mengklaim kesesuaian PDF/X-4.

Muat profil CMYK Anda sendiri dan pilih baris **Embed**-nya di kontrol Colour profile. Profil disematkan sebagai *DestOutputProfile* file, dan PDF mengklaim PDF/X-4 setiap kali bagian file lainnya memungkinkan. Kondisi cetak yang dinyatakannya dibaca dari profil tersebut: nama terdaftar jika profil membuktikannya, atau `Custom` di bawah nama profil itu sendiri.

Tiga hal menahan klaim tersebut sambil mempertahankan output intent: karya RGB yang tidak dapat dikonversi pada tahap CMYK, teks kredit margin pruf `prov` (digambar dengan font standar yang tidak disematkan) dan kata sandi **Strong**, karena PDF/X-4 melarang enkripsi. Setiap PDF juga membawa metadata PDF/X-4: kotak halaman, XMP, ID dokumen dan output intent sRGB dengan profilnya.
:::

### Tinta spot sebagai warna proses

Design system dapat menetapkan tinta spot untuk sebuah warna, seperti warna Pantone atau HLC. **Print PDF** lalu mencetak warna itu pada pelat tersendiri. Lolly Demo memberi setiap warna tinta spot kecuali warna putihnya, Sugar dan Daylight, serta warna hitamnya, Void. Print PDF yang dibuat dengan Lolly Demo mencetak sebagian besar warna pada pelat spot dan hitam pada pelat hitam.

Untuk file empat warna biasa, centang **Print spot inks as process** di kartu Profile pada panel ekspor. Setiap tinta spot lalu dicetak dengan cyan, magenta, kuning dan hitam, menggunakan komposisi CMYK yang diberikan design system untuk warna itu. Warna tanpa komposisi sendiri menggunakan konversi profil mesin cetak, seperti setiap warna lain dalam karya. File itu lalu hanya memiliki empat pelat proses. Pilihan ini mati secara default. Panel menampilkan kotak centang hanya untuk **Print PDF**, dan hanya jika design system memberi sebuah warna tinta spot.

Finishing bukan tinta. Foil, emboss, deboss, spot varnish, soft touch, die cut, crease dan perforasi tetap memiliki pelat bernama sendiri saat kotak dicentang, karena finishing yang dicetak sebagai warna proses akan menempatkan mask hitamnya pada halaman.

Kartu **Before you export** dan `lolly preflight` menghitung pelat yang akan dimiliki file. Saat kotak dicentang, keduanya menghitung empat pelat proses beserta pelat finishing dan menyatakan bahwa tinta spot dicetak sebagai warna proses tanpa menambah pelat. Saat kotak tidak dicentang, keduanya menghitung hingga satu pelat spot untuk setiap tinta spot yang diberikan design system. Daftar tarif menentukan harga berdasarkan jumlah itu, sehingga tidak pernah mengenakan biaya untuk pelat spot yang tidak akan ada dalam file.

**Print TIFF** dan **EPS (CMYK)** tidak memiliki pelat bernama, sehingga keduanya mencetak setiap tinta sebagai warna proses baik pilihan ini aktif maupun tidak. Untuk kedua format itu, kartu dan `lolly preflight` menghitung empat pelat proses dan tidak pernah menghitung pelat spot atau finishing. Finishing masuk ke dalamnya sebagai mask hitam pada pelat hitam, dan kartu melaporkannya sebagai kesalahan.

Tautan meminta file yang sama dengan `_spots=process`, baris perintah dengan `--spots=process`, [server MCP](/info/mcp.html) dengan `spots: "process"` dan aplikasi terminal dengan baris **Spot inks**. Tidak ada informasi tentang pilihan ini yang masuk ke file: hanya tintanya yang berubah.

### HDR (warna cerah)

Kartu **HDR** pada panel ekspor mencerahkan karya biasa untuk layar HDR. Untuk mempertahankan sumber asli HDR selama penyuntingan, lihat [Penyuntingan warna luas dan HDR](/info/hdr-editing.html).

Ekspor biasa menggunakan sRGB: warna merek yang jenuh sama terangnya dengan putih normal layar. Layar HDR dapat lebih terang lagi. Kartu **HDR** meningkatkan warna merek dan teks putih Anda menuju kecerahan puncak. Area gelap tetap gelap.

![Kartu HDR pada panel ekspor, dalam keadaan aktif, dengan kontrol putar White / Reach / Dark lift / Focus terlihat di bawahnya](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26hdr%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-hdr&walker=1&dark=1&filename=exp-hdr-card)

- **Format.** PNG, JPG, AVIF dan TIFF. WebP menggunakan 8-bit tanpa jalur dekode HDR yang berfungsi, dan vektor serta PDF tidak memiliki model HDR.
- **Mati secara default**, karena mengubah piksel. Centang kartu, atau sertakan `hdr=1` dalam tautan berbagi.
- **Kontrol putar.** **White** (batas kecerahan puncak, 400 hingga 2000 nit), **Reach** (seberapa jauh cahaya menyebar ke rona yang lebih gelap), **Dark lift** (seberapa besar area gelap dicerahkan; `0` mempertahankannya tetap gelap) dan **Focus** (seberapa banyak kekayaan warna dipertahankan saat ditingkatkan). Semuanya dibawa sebagai satu nilai: `hdr=1600-60-0-50` berarti White 1600, Reach 60, Dark lift 0 dan Focus 50.
- **Yang ditulis.** PNG mendapat Rec.2100 PQ 16-bit dengan chunk `cICP`. JPG berupa JPEG gain map ISO 21496-1: gambar SDR biasa beserta gain map yang ditambahkan. AVIF mendapat kotak `colr` yang ditulis ulang. TIFF mendapat piksel PQ dengan profil ICC v4 yang dihasilkan dan memuat tag `cicp`. TIFF diratakan pada latar hitam, karena putih adalah kode 10.000 nit dalam PQ dan akan memberi lingkaran cahaya di setiap tepi. Peningkatan mengikuti kecerahan perseptual (OKLab) dan mempertahankan hue, sehingga hijau merek menjadi lebih terang, bukan berubah menjadi hijau mint.
- **Tempat cahaya terlihat.** Penampil dengan pengelolaan warna pada layar HDR: Preview, Quick Look dan Safari di perangkat Apple, atau Chrome pada monitor HDR. Layar SDR menampilkan gambar normal.
- **Dari terminal.** `--hdr=1` dengan `--export=png` atau `--export=jpg` menulis PNG dan JPEG gain map yang sama di [CLI](/info/cli.html) dari encoder mesin yang sama, tanpa browser. Saat ini AVIF dan TIFF hanya tersedia sebagai ekspor web.

::: warning Banyak platform menghapus sinyal HDR
Platform yang mengodekan ulang unggahan dapat membuat gambar gelap atau pudar. Gunakan HDR di tempat yang tujuannya Anda kendalikan, seperti situs Anda sendiri, dinding video atau deck pada panel terang.
:::

<!--i:eti-badge-check-->
## Yang ikut dalam file Anda

File jadi dapat memiliki beberapa catatan. Sebagian berada di luar piksel dan hilang saat file disimpan ulang, diambil tangkapan layarnya atau dibersihkan metadatanya. Dua tanda berada di dalam piksel.

::: figure exporting-what-travels
Tempat setiap catatan disimpan, apakah aktif secara default dan parameter tautan yang mengendalikan masing-masing.
:::

Panel ekspor menempatkan **Licence**, **Source credits**, **Password**, **C2PA Credentials**, **Lolly Imprint** dan **Durable credential** dalam satu grup **Content protection** yang hanya menampilkan kartu yang dapat digunakan format terpilih. Grup terbuka sendiri ketika tautan atau dokumen sudah menyatakan lisensi, atau ketika sebuah sumber membutuhkan keputusan Anda. Kartu **Design system** tetap di luar grup, terlihat pada setiap ekspor.

![Grup Content protection terbuka pada ekspor PNG, hanya menampilkan kartu yang berlaku untuk format itu](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26imprint%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-protection&dark=1&filename=exp-content-protection)

### Provenansi & watermark

Jika format menyediakan field-nya, ekspor membawa **metadata provenansi**: perangkat lunak, sumber, nama alat dan baris kredit profil Anda, ditulis ke PNG iTXt, JPEG EXIF, info PDF, `<metadata>` SVG atau komentar GIF. Metadata ini hanya mencatat kepengarangan. Tidak ada yang diunggah. Alat **Experimental** juga membubuhkan watermark yang terlihat. Host menerapkan watermark, sehingga menyunting alat tidak dapat menghapus tanda itu.

**Lolly Imprint** adalah watermark piksel tak terlihat, **aktif secara default**. Tanda ini bertahan setelah kompresi ulang, sehingga salinan masih dapat dikenali sebagai buatan Lolly. Ini petunjuk, bukan jaminan kriptografis, dan tidak membawa data pribadi. Tanda ini ditulis dalam JPEG XL, PNG, JPG, WebP, AVIF, TIFF dan BMP, serta dalam raster yang dirender Lolly ke PDF atau PPTX, tidak pernah dalam gambar yang Anda sematkan. Hapus centang **Lolly Imprint** atau sertakan `imprint=0` untuk menghilangkan Imprint. Ketahanan AVIF terhadap pengodean ulang belum dikalibrasi. [Lolly Verify](/#/verify) mendeteksi Imprint di perangkat Anda; lihat [Lolly Imprint](/info/what-verify-checks.html#the-lolly-imprint).

**Durable credential** menulis id Lolly ke piksel dengan model neural di perangkat dalam format TrustMark, sehingga tautan "dibuat dengan Lolly" bertahan setelah metadata dihapus dan file dikodekan ulang serta dapat dibaca oleh alat yang mendukung TrustMark. Fitur ini **mati secara default**, karena memerlukan satu proses neural per ekspor dan satu kali unduhan model. Fitur ini mencakup PNG, JPG, WebP, AVIF dan TIFF. Centang di panel atau sertakan `durable=1`. Aplikasi desktop dan seluler menyembunyikan kartu ini, karena tidak memiliki origin untuk mengambil model saat offline.

**Licence.** Pilih bagaimana orang lain boleh menggunakan karya Anda: *None (all rights reserved)* secara default, CC0 1.0, Public Domain Mark 1.0 atau lisensi Creative Commons 4.0 (BY, BY-SA, BY-NC, BY-NC-SA, BY-ND, BY-NC-ND). Nama lisensi dan tautan ke ringkasannya masuk ke metadata lisensi file (EXIF, XMP dan RIFF jika format memilikinya) serta Content Credential-nya. Pilihan disimpan bersama dokumen dan ikut dalam tautan sebagai `licence=`. Lolly menulis lisensi yang Anda pilih. Lolly tidak memeriksa atau menegakkan ketentuannya. Alat dengan field lisensi sendiri, seperti Claim, tetap menggunakan field itu.

### Catatan design system

Ekspor mencatat design system yang membuat file: namanya, versi terbitan yang menjadi sumbernya (bila bukan versi kerja) dan [colourway](/info/colourways.html) yang digunakan untuk menggambarnya. Pilihan tema lain yang dinyatakan design system, seperti kepadatan, dicatat dengan cara yang sama. Pilihan terang atau gelap tidak disertakan, karena gambar sudah menunjukkan pilihan yang digunakan.

**Anda melihat catatan sebelum apa pun ditulis.** Kartu **Design system**, yang dicentang secara default, menampilkan kata-kata persis yang akan dibawa file, seperti *Records: Acme · Colourway: Beach*, serta deskripsinya. Nama design system adalah apa pun yang diketik pemiliknya, dan kartu menampilkan nama sesuai yang ditulis. Hapus centang kartu untuk menghilangkan catatan dari ekspor itu. Panel dokumen Lolly Design mencantumkan kata-kata yang sama di bawah *Embedded in exports*.

**Deskripsi menyebutkan colourway di samping alat.** Saat kartu dicentang, *"Dibuat dengan https://lolly.tools : Chart"* menjadi *"Dibuat dengan https://lolly.tools : Chart (colourway Beach)"*. Nama design system sendiri tetap dalam catatan, bukan deskripsi. Deskripsi tanpa nama alat, atau yang ditulis alat dari inputnya sendiri, tidak berubah. Alat yang mengabaikan colourway melalui `tokenAxes` tidak mencatat colourway, dan kredit proof PDF (tanda cetak `prov`) mengikuti aturan yang sama.

::: details Skill merek, halaman merek dan perusahaan mitra dalam catatan
**Skill merek yang memandu agen.** Bila agen membuat karya dan menyebutkan [skill merek](/info/brand-skills.html) yang dibaca dan diikutinya, catatan juga mencantumkan setiap skill beserta revisinya, seperti *Dipandu oleh: acme-brand 1.0*. Kata-kata itu berarti skill tersebut memandu pekerjaan. Lolly tidak menguji karya terhadap skill. Hanya pernyataan agen sendiri yang menambahkan daftar itu. Saat ini pernyataan tersebut berupa argumen `brandSkills` pada `lolly_render` di [server MCP](/info/mcp.html), sehingga karya yang dibuat di aplikasi atau dari tautan berbagi tidak membawanya. Content Credential menyimpan daftar sebagai `brandSkills`, satu nilai JSON dengan id, nama, revisi dan hash SHA-256 setiap skill. Paket XMP dan metadata SVG menyimpan nilai yang sama sebagai `lolly:BrandSkills`. PDF yang ditulis dari catatan mendapat satu kata kunci per skill. Deskripsi tidak berubah. Teks skill internal tidak pernah dicatat. Sakelar yang sama menghilangkan daftar bersama bagian catatan lainnya: kartu **Design system**, `_madewith=0`, `--no-madewith` dan `madeWith: false`. Bila server MCP menggambar file di browser (PDF, JPEG dan format lain yang tidak dapat ditulis jalur tanpa browser), metadata file sendiri tidak menyimpan daftar. Hanya Content Credential yang dapat menyimpan daftar di sana. Sertakan `c2pa` untuk mempertahankan catatan. Tanpa kredensial, render memperingatkan bahwa skill merek tidak dicatat.

**Halaman merek, bila penerbitnya memilih untuk menyertakannya.** Penerbit design system dapat memilih untuk mencatat alamat [halaman merek](/info/brand-page.html#lead-back-from-your-files) pada ekspor. Pengaturan berlaku per design system dan mati secara default. Kartu lalu menambahkan alamat ke baris yang sama, seperti *Records: Acme · Colourway: Beach · Brand page: https://acme.example/brand/acme/*. Menghapus centang kartu menghilangkan alamat bersama bagian lainnya. Catatan menyimpan alamat dan tidak menyimpan hal lain tentang halaman itu. Tidak ada hal lain dalam file yang berubah. Design system tanpa alamat menulis file yang sama seperti sebelumnya.

**Alamat tidak ikut dalam paket.** Catatan dalam file bertanda tangan dianggap berasal dari penanda tangan sendiri. Alamat tidak boleh aktif sendiri untuk orang yang tidak memilih alamat itu, dan paket tidak boleh dapat mengarahkan file orang lain ke halaman pilihannya. Paket `.lolly`, salinan atau fork design system, **Try these colours**, cadangan yang dipulihkan dan file token yang diberikan untuk satu kali eksekusi semuanya hadir dengan pengaturan mati. Anda dapat mengaktifkan pengaturan sendiri, dengan alamat yang Anda ketik. Design system terkelola adalah satu-satunya pengecualian: alamat yang ditetapkan pengelolanya dalam token sumber tetap dipertahankan. [Arahkan kembali dari file Anda](/info/brand-page.html#lead-back-from-your-files) memuat detailnya.

**Perusahaan mitra, dalam program mitra Lolly Work.** Karya yang dibuat untuk perusahaan mitra mencatat perusahaan dan programnya pada baris yang sama, seperti *Records: Acme · Colourway: Beach · Partner: Northwind IT (Resellers, EMEA)*, dengan revisi detail perusahaan di dalam file. Catatan tidak memuat orang, detail kontak, alamat atau mata uang. Jika kit mitra perusahaan dilampirkan, baris itu menambahkan revisi kit, seperti *, revisi kit 2*, dan kredensial menyimpan id serta revisi kit, tidak pernah warna atau aturannya. Menghapus centang kartu menghilangkan mitra bersama bagian catatan lainnya. PDF mendapat kata kunci *Partner: Northwind IT*, dan [Lolly Verify](/info/what-verify-checks.html#partner) menampilkan catatan sebagai **Partner** ([Catatan mitra dalam file](/info/manage/partner-programmes.html#the-partner-record-in-files)).
:::

**Membaca kembali catatan.** [Lolly Verify](/#/verify) mencantumkan catatan sebagai **Design system** dalam detail kredensial file dan skill merek sebagai **Guided by**. Halaman merek tampil tersendiri, sebagai [catatan alamat dari penanda tangan](/info/what-verify-checks.html#brand-page). *Recreate with these settings* membuka kembali alat dengan versi dan colourway yang dicatat. Tautan terbuka dengan design system yang dicatat bila perangkat ini memiliki design system dengan id dan nama yang sama; jika tidak, tautan terbuka dengan design system aktif Anda.

::: details Apa yang ditulis di mana, dan eksekusi mana yang tidak menyertakan catatan
| Tempat | Yang ditulis |
|---|---|
| Content Credential | `designSystem` (id), `designSystemLabel`, `designVersion` dan `themes` dalam asersi `tools.lolly.export`, masing-masing berupa nilai teks biasa; `themes` adalah daftar JSON berisi pilihan. `brandPage` bila penerbit memilih untuk menyertakannya |
| PNG, JPEG, WebP dan JXL | Nilai yang sama sebagai properti `lolly:` pada paket XMP file, dalam namespace `https://lolly.tools/ns/export/1.0/`. `lolly:BrandPage` bila penerbit memilih untuk menyertakannya |
| SVG | Properti `lolly:` yang sama di dalam blok `<metadata>` |
| PDF | Kata kunci seperti *Design system: Acme*, *Colourway: Beach* dan, bila penerbit memilih untuk menyertakannya, *Brand page: https://acme.example/brand/acme/* |
| Setiap format dengan field deskripsi | Deskripsi, dengan colourway di samping alat |

Kartu hanya muncul bila ada sesuatu untuk dicatat dan format dapat menyimpan catatan. CSV, JSON, file kalender dan format teks atau data lainnya tidak menyimpan metadata, dan EPS, EMF, DXF serta BMP tidak memiliki field untuk catatan. HTML, Markdown dan CSS hanya menyimpan catatan dalam Content Credential, sehingga untuk format tersebut kartu tidak menampilkan baris deskripsi dan tersembunyi saat **C2PA Credentials** mati. Field yang tidak diberikan design system tidak dimasukkan ke file.

Tautan berbagi mematikan catatan dengan `_madewith=0` ([Parameter URL](/info/url-parameters.html)). Baris perintah menerima `--no-madewith`, `lolly_render` di [server MCP](/info/mcp.html) menerima `madeWith: false` dan panel ekspor aplikasi terminal memiliki baris **Design system**. Baris perintah mencetak kata-kata yang dibawa file jadi ke keluaran kesalahan standar, untuk render alat dan untuk setiap file yang diekspor `lolly run` dari sesi Lolly Design tersimpan. Render MCP mencetak kata-kata di samping file. Keduanya membaca kembali kata-kata dari file. PNG yang digambar baris perintah tanpa browser tidak membawa metadata file, sehingga catatannya hanya ikut dalam kredensial. Utilitas di perangkat tidak menambahkan metadata.

Eksekusi tanpa kartu **Design system** tidak menyertakan catatan: eksekusi Lolly Batch, folder yang diekspor dari Projects dan ekspor koleksi 3D, serta dalam aplikasi terminal batch CSV, ekspor folder atau pilihan Projects dan tampilan render semua. Ekspor satu file dari alat untuk mencatat design system.
:::

### Content Credentials (C2PA)

Ekspor dapat membawa **Content Credentials**: manifes [C2PA](https://c2pa.org) bertanda tangan yang mencatat apa yang membuat file, kapan dan di mana, terikat pada hash byte file sehingga penyuntingan berikutnya dapat dideteksi. Lolly menulis manifes standar yang dapat diperiksa pembaca C2PA mana pun.

![Kartu C2PA Credentials, dicentang, dengan masa berlaku kredensial di samping kotak centang](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26c2pa%3D30%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-c2pa%5Bdata-c2pa-only%5D&walker=1&dark=1&filename=exp-c2pa-card)

- **Aktif secara default.** Kartu **C2PA Credentials** dicentang untuk hampir setiap alat. Hapus centangnya untuk satu ekspor, atau sertakan `c2pa=off` dalam tautan. File lalu tidak memiliki kredensial, dan SVG yang menyematkan langsung karya berkredensial, seperti logo katalog, juga kehilangan kredensial karya itu. Lolly Imprint dan metadata lain file tetap ada. Alat dapat memilih untuk tidak menyertakannya dalam manifesnya.
- **Format.** PDF (RGB dan Print), PNG dan APNG, JPG, GIF, SVG dan SVGZ, TIFF (RGB dan Print), WebP (diam dan animasi), AVIF, MP4, WebM, HTML, Markdown, CSS serta kontainer audio MP3, WAV, M4A, OGG/Opus dan FLAC. ZIP membubuhkan kredensial pada setiap anggota yang didukung, dan dengan cara itulah Animated SVG mendapat kredensial. MP4, AVIF dan M4A menggunakan pengikatan BMFF standar dan MP3 menggunakan pemetaan ID3v2-nya, sehingga `c2patool` dan pembaca lain dapat memverifikasinya. WebM dan OGG/Opus belum memiliki pemetaan standar, sehingga Lolly membawa manifes sebagai lampiran Matroska dan field OpusTags, yang diperiksa pemverifikasi Lolly sendiri. SVGZ adalah SVG terkompresi. Spesifikasi C2PA tidak mendefinisikan bentuk terkompresi, sehingga kredensial ditulis ke SVG sebelum kompresi. Pemverifikasi Lolly membaca file apa adanya; `c2patool` membaca kredensial yang sama setelah file didekompresi (`gunzip`). ICO, EPS, EMF, DXF, BMP, PPTX, format Office serta format teks dan data lainnya tidak memiliki kontainer C2PA.
- **Yang dicatat.** Alat dan aplikasi yang membuat file, waktu penandatanganan dan shell yang mengekspor file. Untuk halaman Lolly Design yang diekspor sebagai gambar, SVG atau PDF, renderer yang menggambar halaman (`route` dalam asersi `tools.lolly.export`: `gpu` untuk renderer halaman GPU, `operations` untuk operasi gambar yang ditulis sebagai vektor, `compatibility` untuk renderer browser sendiri) serta versi renderer itu (`renderer`: resep GPU, `design-draw-v` beserta versinya, atau `dom-to-image` dan `dom-walker`). [Design system dan colourway](#the-design-system-record) selama kartu **Design system** dicentang. Pengaturan aktif: pilihan menu, angka, sakelar dan warna apa adanya, serta apa pun yang diketik (judul, nama, catatan, tautan dan tanggal) hanya sebagai sidik jari, sehingga kata-katanya tidak ada dalam file. Field yang terikat ke profil, kontrol tidak aktif, versi browser dan detail sistem operasi tidak disertakan. Nama dan email Anda tampil sebagai penulis hanya ketika **Use my details to create** aktif di Settings → Preferences → Your details. Sumber yang ditempatkan ekspor ikut sebagai bahan penyusun. Setiap gambar pada halaman yang membawa Content Credential sendiri dicatat sebagai komponen halaman, beserta kredensial itu dan jenis sumber AI yang dinyatakannya. Ini berlaku dalam PNG, JPEG, WebP, AVIF, TIFF, SVG atau PDF, serta dalam GIF, APNG, WebP animasi, MP4 atau WebM bila gambar digambar dalam setidaknya satu bingkai dari rentang yang diekspor. Satu gambar yang diubah oleh alat seperti Darkroom, Filter atau Asset Export justru dicatat sebagai induk file, dibuka terlebih dahulu lalu diikuti tindakan alat terhadap gambar. Bahan penyusun lainnya adalah [karya yang diberi kredit](#source-credits) seperti emoji, [lagu Lolly Rondocode](/info/rondocode.html#songs-in-the-credential) dalam ekspor video atau audio dan [lagu tersimpan](/info/generated-music.html#what-a-track-records) dalam ekspor video atau audio. Setiap lagu tersimpan memiliki nama, lisensi bila lagu mencatatnya, SHA-256 resepnya, versi mesin dan media algoritmis. Pembuat lagu tersimpan (nama profil saat lagu disimpan) ditambahkan hanya selama **Use my details to create** aktif, seperti nama Anda sendiri. Hanya pada saat itu panel ekspor menampilkan pembuatnya sebelum Anda mengekspor.
- **Persetujuan, bila telah dicatat.** File yang disetujui melalui [Lolly Work](/info/work-approvals.html#review-an-exported-file) dapat membawa catatan kedua bertanda tangan di atas kredensial ini: id persetujuan, tanggal keputusan dan digest file yang ditinjau. Catatan tidak memuat nama, email, grup, komentar atau nama rantai. Pilihan ini dicentang secara default di dialog permintaan dan centangnya dapat dihapus untuk satu permintaan atau dimatikan untuk satu instans. Catatan menyatakan bahwa penanda tangan menyampaikan sebuah keputusan. Catatan tidak menyatakan karya memenuhi standar apa pun.
- **Apa yang diminta untuk dilakukan, untuk file yang dibuat dari [intent](/info/visual-intent.html#what-goes-in-the-file).** Tujuan, media tujuan, alat, bahasa, aturan dan versi kosakata serta digest intent. Acara, audiens, wilayah dan prompt hanya berupa sidik jari, kecuali orang atau agen yang menjalankan render meminta agar kata-kata prompt dicatat. Hanya render yang dimulai dari intent yang membawa catatan ini. Eksekusi menyatakan apa yang dicatatnya, dan catatan dapat tidak disertakan.
- **Yang dilihat penerima.** Alat C2PA seperti aplikasi Adobe, `c2patool` dan contentcredentials.org/verify membaca manifes dan menampilkan klaim. Lolly menandatangani dengan kunci yang dibuat di perangkat Anda, bukan sertifikat dari daftar kepercayaan, sehingga penampil melaporkan kredensial *belum terverifikasi*. Struktur dan bukti perubahan sah, tetapi tidak ada pihak yang menjamin penanda tangan. Untuk mengubahnya, daftarkan **identitas terverifikasi** di Settings → Preferences → Content Credentials; lihat [Identitas Content Credentials](/info/content-credentials-identity.html).
- **Memeriksa file.** Jatuhkan file apa pun ke [Lolly Verify](/#/verify), atau jalankan `lolly validate <file>`, untuk mendapat laporan di perangkat yang diawali dengan apakah Lolly membuat file dan apakah file berubah sejak itu. Lolly Verify juga memeriksa hal di luar kredensial; lihat [Yang diperiksa Lolly Verify](/info/what-verify-checks.html).
- **Privasi.** Kunci penandatanganan dibuat untuk ekspor dan tidak pernah meninggalkan perangkat Anda. Klaim hanya memuat apa yang sudah dibawa metadata provenansi. Utilitas privasi yang mentransformasi file Anda sendiri tidak menambahkan kredensial, dan *Lolly Strip Hidden Data* menghapus manifes C2PA seperti metadata lainnya. Utilitas Rondocode membuat audio baru, sehingga menandatangani apa yang ditulisnya ([lagu Lolly Rondocode](/info/rondocode.html#files-from-the-rondocode-utility)). Generator musik menandatangani setiap unduhan WAV atau M4A. Kredensial mencatat bahwa generator musik Lolly membuat trek tersebut dan lisensi yang berlaku untuk musik itu, CC BY 4.0, beserta kreditnya ([Yang dicatat sebuah trek](/info/generated-music.html#what-a-track-records)).
- **Interaksi.** PDF yang dilindungi kata sandi tidak dapat membawa Content Credentials, pada kedua tingkat. Kredensial ditambahkan terakhir, pada byte yang sudah selesai, setelah DPI, EXIF, profil warna, metadata PDF/X dan tanda cetak.

### Kredit sumber

Ekspor yang menempatkan karya orang lain mencatat sumber itu dalam kredensial. Kasus yang umum adalah emoji dari set emoji terpilih: karya, pembuatnya, lisensi, asal byte persisnya dan apa yang berubah semuanya ikut dalam file. Teks dalam alat yang templatnya berupa SVG tetap menggunakan emoji sistem sendiri, sehingga tidak ada yang diberi kredit di sana. Sebelum Anda mengunduh, baris **Source credits** menyatakan persyaratan sumber untuk penyampaian karya. Setelah unduhan, baris membaca kembali byte yang disampaikan sebelum menyatakan kredit ada dalam file. Lisensi yang meminta Anda memilih, seperti glif CC BY-SA yang diwarnai ulang dan akan Anda bagikan, mendapat kartu berisi pilihan. Unduhan tidak pernah diblokir. [Hak kreatif dan kredit](/info/creative-rights.html) memuat redaksi, lisensi yang ditinjau dan apa yang tetap menjadi milik Anda.

<!--i:eti-lock-->
## Perlindungan kata sandi

Lolly membuat dua jenis kunci, keduanya di perangkat Anda. Kartu **Password** pada panel ekspor mengatur keduanya.

![Kartu Password dibentangkan pada ekspor PDF, dengan field kata sandi dan dua tingkat kunci](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpdf%26password%3Ddemo%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-pdfpass&dark=1&filename=exp-pdf-password)

**Kata sandi untuk membuka PDF** memiliki dua tingkat setelah Anda mengetik kata sandi:

- **Weak**: RC4 40-bit, untuk `pdf` RGB tanpa tanda cetak atau bleed dan kata sandi ASCII biasa. Kata sandi dengan karakter lain beralih ke Strong, karena pembaca tidak dapat membuka file yang dikunci seperti itu pada tingkat ini. Hanya 32 karakter pertama yang diperhitungkan.
- **Strong**: AES-256 (PDF 2.0). Ini juga berlaku untuk Print PDF dan setiap PDF di dalam ZIP batch. Print PDF yang dikunci dengan Strong mempertahankan CMYK, tanda dan output intent-nya tetapi menghapus klaim PDF/X-4.

::: warning Weak hanya penghalang, bukan perlindungan
Gunakan **Strong** untuk file rahasia.
:::

**ZIP terkunci** mencakup ekspor ZIP, unduhan folder dari Projects atau batch, dengan satu kata sandi pada dua tingkat: **Weak** (ZipCrypto, hanya penghalang) atau **Strong** (AES-256). Kata sandi melindungi setiap anggota. PDF di dalamnya juga dikunci tersendiri dengan AES-256, sehingga PDF tetap terkunci setelah ZIP diekstrak. Permintaan kata sandi muncul saat unduhan dimulai. Kata sandi kosong berarti tanpa kunci.

**Kata sandi yang diketik tidak masuk ke tautan pada kedua tingkat.** Jika file datang melalui tautan `?password=`, Lolly membaca nilainya dan segera menghapusnya dari alamat. Tautan yang meminta kunci yang tidak dapat dimuat file tidak menulis file dan menyatakan alasannya (lihat [`password`](/info/url-parameters.html)).

**Tautan berbagi dengan kata sandi** meminta kata sandi kepada penerima sebelum terbuka. Status tautan dienkripsi dengan AES-256 menggunakan kunci yang diturunkan dari kata sandi (PBKDF2). Hanya teks sandi yang dikirim, dan dekripsi berlangsung di browser penerima. Server yang menyajikan tautan tidak pernah melihat kata sandi atau desain. Aktifkan di dialog **Share**. Tautan terenkripsi hanya terbuka di Lolly, tidak pernah sebagai gambar tersemat. Lihat [Mode URL](/info/url-mode.html).

<!--i:eti-monitor-->
## Di ponsel

Kontrol ekspor berada di balik tombol **Export** mengambang, yang membuka panel **Export**: format, ukuran, salin, unduh dan bagikan yang sama, dengan ukuran untuk sentuhan.

<!--i:eti-code-->
## Id format untuk tautan dan CLI

Berikut nilai untuk parameter URL `format=` dan flag CLI `--export=` (lihat [Parameter URL](/info/url-parameters.html) dan [CLI](/info/cli.html)). Menu alat hanya menampilkan format yang dapat dibuat alat itu.

| Jenis | Id |
|---|---|
| Raster | `png` · `jpg`/`jpeg` · `webp` · `avif` · `jxl` · `jxl-lossless` · `tiff` (RGB TIFF) · `cmyk-tiff` (Print TIFF) · `bmp` · `ico` |
| Vektor | `svg` · `svgz` (SVG yang dikompresi dengan gzip) · `emf` · `wmf` · `eps` · `eps-cmyk` (EPS CMYK) · `dxf` (file potong) |
| Halaman dan dokumen | `pdf` · `pdf-cmyk` (Print PDF) · `pptx` (PowerPoint) · `docx` (Word) · `odt` (OpenDocument Text) · `idml` (InDesign) · `penpot` (file desain Penpot) · `scorm` (paket kursus, berupa ZIP) |
| Gerak | `gif` · `apng` (Animated PNG) · `webp-anim` (Animated WebP) · `svg-anim` (Animated SVG) · `webm` · `mp4` · `lottie` (dotLottie) · `premiere-xml` (Premiere XML + media) |
| Audio | `wav` · `mp3` · `m4a` · `aac` · `opus` · `ogg` · `flac` · `mid` (not MIDI, dari Lolly Rondocode) |
| Teks dan data | `html` · `md` · `txt` · `json` · `csv` · `ics` · `vcf` · `srt` · `vtt` · `ttml` · `scc` · `css` · `scss` · `gpl` (palet GIMP) |
| Bundel dan paket | `zip` · `rpm` dan `tar.gz` (render yang dikemas ke dalam paket Linux) |

Beberapa id berasal dari kode ekspor alat sendiri: `ase` (Adobe Swatch Exchange, dari Lolly Palette Lab) serta `exr` dan `hdr` (raster dengan rentang dinamis tinggi, dari Lolly Darkroom). **Convert Font** menulis `ttf`, `otf` dan `woff` dari file font yang Anda berikan, sehingga tautan saja tidak memberi alat apa pun untuk dirender.
