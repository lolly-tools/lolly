# Ekspor & Format

Cara mengeluarkan file jadi dari sebuah alat - memilih format yang tepat, mengatur ukuran output, dan apa yang dilakukan setiap opsi. Seperti hal lainnya, **ekspor terjadi di perangkat Anda**; tidak ada yang diunggah.

## Cara kerja ekspor

Pratinjau *adalah* file itu sendiri. Saat Anda mengekspor, host merender kanvas tersebut ke format yang Anda pilih dan memberikan Anda unduhan (atau menaruhnya di clipboard Anda). Sebuah alat hanya menawarkan format yang dideklarasikan oleh pembuatnya, dan pemilih format menyembunyikan format apa pun yang tidak dapat dihasilkan browser Anda (lihat [Video](#video)).

Ada tiga jalur yang menghasilkan file. Sebagian besar alat **merender kanvas** ke format yang dipilih. Format teks dan data (HTML, MD, TXT, JSON, CSV, ICS, VCF) sebaliknya **dihasilkan dari konten alat**, bukan dirasterisasi dari gambar. Dan utilitas privasi (misalnya *Strip Hidden Data*) menggunakan jalur ketiga: file yang *Anda* pilih ditransformasikan byte demi byte di perangkat dan langsung dikembalikan - tanpa kanvas, tanpa watermark, dan tanpa metadata provenans yang ditambahkan, karena itu memang sudah file Anda sendiri.

Aksi-aksi pada kontrol ekspor:

- <!--i:download--> **Download** - simpan file (aksi utama).
- <!--i:photos--> **Copy** - taruh gambar di clipboard Anda untuk ditempel langsung ke Slack, email, atau dokumen. Jika browser tidak dapat menyalin gambar, ia akan mengunduh sebagai gantinya dan memberi tahu Anda.
- <!--i:folder--> **Save** - simpan desain saat ini sebagai sesi alat tersimpan di pustaka Anda.
- <!--i:link--> **Share** - membuka **Share dialog**: tautan yang dapat disalin yang mereproduksi desain, sakelar saat kunjungan (layar penuh, panel ekspor, unduh- atau salin-saat-dibuka) dan **Shortest link** opsional yang memadatkan seluruh state ke dalam token ringkas (lihat [URL Mode](/info/url-mode.html)).

(Pembuat alat memilih mana dari opsi ini yang muncul; set default-nya adalah Copy, Download, dan Save.)

![Panel ekspor - format, ukuran, dan aksi Copy / Download / Save / Share](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&walker=1&dark=1&filename=export-panel)

Share terbuka di atas alat, dengan tautan yang sudah dibuat dan sakelar saat kunjungan di bawahnya.

### Merender banyak sekaligus

Satu ekspor menghasilkan satu file, tetapi Anda dapat merender **banyak** sekaligus dalam satu proses - masing-masing dikirimkan sebagai satu `.zip`:

- <!--i:folder--> **Projects → Render folder** mengekspor setiap sesi tersimpan dalam sebuah folder (dan sub-foldernya) sebagai satu zip bersarang; **Render selection** melakukan hal yang sama untuk seleksi ganda apa pun; satu sesi tersimpan tunggal langsung dirender ke filenya sendiri. Tidak perlu Batch/Pro - lihat [Menggunakan Lolly → Projects](/info/using.html).
- <!--i:layers--> **Batch (Pro)** merender grid dari sekumpulan input - setiap varian dari satu template sekaligus.

Sesi tersimpan juga dapat dibagikan ulang sebagai tautan alat dari Projects (ia merekonstruksi URL alat dari input yang tersimpan), sehingga tautan tersebut membuka kembali dengan pengaturan yang persis sama.

## Memilih format

Nama file dan pemilih format berada di bagian atas panel sebagai satu pasangan `name.format`, dan pemilih hanya menampilkan format yang dideklarasikan oleh pembuat alat ini.

![Bidang nama file menyatu dengan pemilih format, sehingga ekspor terbaca sebagai satu pasangan name.format](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.filename-extension&walker=1&dark=1&filename=exp-format-picker)

| Anda menginginkan… | Gunakan | Alasan |
|---|---|---|
| Logo / karya seni tajam yang dapat diskalakan | **SVG** | Vektor - dapat diskalakan tanpa batas, kecil, dapat diedit |
| Vektor untuk aplikasi Office / Windows | **EMF** | Ditempel sebagai vektor yang dapat diedit ke PowerPoint / Word; teks tetap hidup dan dapat diedit, dan Google Drive membukanya di Google Drawings untuk Slides |
| Vektor untuk cetak / aplikasi desain | **EPS**, atau **EPS (CMYK)** | Vektor PostScript untuk Illustrator / alur kerja percetakan |
| Vektor untuk mesin potong / CAD | **DXF** | Pemotong laser, plotter vinil, CNC - jalur garis luar dalam milimeter |
| Slide deck yang dapat diedit | **PowerPoint** (PPTX) | Teks + bentuk yang dapat diedit secara native, dengan gambar dan vektor tetap dapat diekstraksi |
| Kursus yang dapat diimpor LMS | **SCORM** (LMS) | Zip berisi manifest, halaman peluncuran, slide dan film bernarasi dengan teks tertutup - dari deck Design |
| Dokumen teks yang dapat diedit | **Word** (DOCX) atau **OpenDocument** (ODT) | Paragraf dan judul asli yang dapat terus diedit oleh pengolah kata (Doc Studio) |
| Foto atau gambar serbaguna | **PNG** (lossless) atau **JPG** (lebih kecil) | Raster universal |
| Gambar modern yang lebih kecil | **WebP** / **AVIF** | Kompresi lebih baik, alpha |
| Cetak | **PDF**, atau **Print PDF** (CMYK) | Ukuran halaman sebenarnya; CMYK untuk percetakan |
| Raster cetak untuk percetakan | **Print TIFF** (CMYK) | Piksel DeviceCMYK untuk RIP |
| Animasi untuk web | **GIF** | Bekerja di mana saja, file lebih besar |
| Animasi dengan warna penuh + alpha nyata | **APNG** | PNG animasi - tanpa batas palet, transparansi sejati |
| Animasi, ukuran file terkecil | **Animated WebP** | Warna penuh + alpha, kompresi lebih baik daripada GIF atau APNG |
| Vektor animasi yang dapat diskalakan | **Animated SVG** | Mandiri; berulang di browser atau `<img>`, tanpa codec, ukuran berapa pun |
| Video untuk sosial / berbagi | **MP4** atau **WebM** | Kualitas per-byte terbaik (lihat di bawah) |
| Teks kaya / tanda tangan email | **HTML** | Ditempel terformat ke klien email |
| Konten polos | **MD** / **TXT** | Teks saja |
| Acara kalender | **ICS** | Diimpor ke aplikasi kalender mana pun |
| Kartu kontak | **VCF** | Diimpor ke Contacts / buku alamat |
| Data terstruktur untuk diimpor ulang | **JSON** / **CSV** | Bolak-balik konten alat |
| Favicon | **ICO** | Ikon situs multi-ukuran (**ZIP** menggabungkan beberapa format) |

Baris pertama adalah kasus yang paling umum. Wordmark yang disusun dalam font brand Anda diekspor sebagai SVG, di mana setiap huruf adalah jalur bergaris luar, bukan piksel, sehingga tetap tajam pada ukuran kartu nama maupun pada ukuran pembungkus gedung dari file yang sama.

![Wordmark hairline dengan tracking lebar bertuliskan Aurora, jenis karya seni vektor murni yang dibahas pada baris SVG di tabel](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DAurora%26weight%3D200%26tracking%3D16%26size%3D200%26full&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-wordmark-vector)

## Ukuran & unit cetak

Secara default ekspor menggunakan ukuran piksel native alat. Jika sebuah alat menyediakan **dimensions**, Anda dapat mengatur lebar × tinggi dan sebuah **unit**:

- **px** (default) - piksel eksak.
- **mm · cm · in · pt · pc** - ukuran fisik/cetak. Dengan unit fisik Anda juga mengatur **DPI** (default **300** untuk cetak); engine mengonversi dengan benar per format - **PDF** menjadi halaman sebenarnya pada ukuran tersebut, **raster** dirender pada jumlah piksel yang tepat untuk DPI tersebut (dan menyematkan resolusinya), **SVG** mempertahankan unit fisik dengan viewBox px.

Untuk mendapatkan raster beresolusi lebih tinggi, masukkan lebar/tinggi yang lebih besar, atau pilih unit fisik dan naikkan DPI (piksel = ukuran × DPI). Tidak ada sakelar skala satu klik.

Contoh: lebar `210`, tinggi `297`, unit `mm` → halaman A4.

![Baris dimensi diatur ke 210 kali 297 mm, dengan bidang DPI terlihat karena unitnya fisik](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26w%3D210%26h%3D297%26unit%3Dmm%26format%3Dpdf%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-dims&walker=1&dark=1&filename=exp-export-dims)

## Gambar diam dari komposisi berwaktu

**Komposisi berwaktu** - timeline [Sequence](/info/using.html#timeline-sequence) di Design, atau artboard mana pun yang digerakkan timeline - adalah hal yang bergerak, sehingga ekspor diam harus menjawab "momen yang mana?". Aturannya seperti yang Anda duga: **bingkai pada playhead**. Tempatkan playhead di momen yang Anda inginkan lalu ekspor; apa yang Anda lihat itulah yang dihasilkan.

Ketika Anda menginginkan lebih dari satu momen, bidang **Frames** muncul di samping ukuran output (hanya untuk komposisi berwaktu, dan hanya untuk format diam - PNG, JPG, WebP, SVG, atau PDF). Biarkan pada `1` untuk frame playhead. Naikkan nilainya dan Anda mendapatkan sejumlah gambar diam yang diambil sampel pada interval yang sama di seluruh sequence:

- **Raster and SVG** kembali sebagai satu **zip** - `<name>-01.png`, `-02.png`, dan seterusnya.
- **PDF** kembali sebagai **satu dokumen dengan sejumlah halaman tersebut**.

Berguna untuk storyboard, lembar thumbnail, contact sheet untuk peninjauan, atau carousel media sosial yang dipotong langsung dari editan video.

Sampel diambil pada **titik tengah** setiap interval, bukan pada tepinya, karena momen pertama sebuah sequence sering kali adalah transisi masuk yang belum selesai memudar dan momen terakhir adalah keadaan setelah setiap klip berakhir - sampel pada titik ujung akan menghabiskan dua frame Anda untuk frame yang hampir kosong. Jumlahnya dibatasi hingga **64** (contact sheet dibuat untuk dibaca manusia), dan apa pun yang tidak masuk akal yang diketik ke dalam bidang tersebut kembali ke `1` alih-alih menggagalkan ekspor. Setiap frame adalah gambar diam biasa, sehingga Content Credentials, imprint, unit fisik, dan DPI semuanya berperilaku persis seperti pada ekspor tunggal.

Bidang **Frames** adalah cara untuk mendapatkan lembar itu saat ini. Engine mencadangkan parameter URL `cuts` yang sesuai, tetapi belum ada shell yang membacanya dari tautan, sehingga tautan yang dibagikan selalu terbuka kembali pada frame playhead - lihat [URL Mode](/info/url-mode.html#contact-sheets-cuts).

## PDF multi-halaman

Beberapa alat membangun **dokumen PDF multi-halaman**, bukan satu karya tunggal - sampul, konten yang mengalir ke sebanyak mungkin halaman yang dibutuhkan, dan halaman belakang, semuanya dalam satu file (lihat alat *Booklet*). Setiap halaman adalah **halaman PDF sejati** yang berukuran sesuai kotak halaman tersebut, sehingga pembaca dan pencetak mendapat halaman nyata, bukan satu gambar panjang.

- **Pages from content.** Tambahkan blok teks dan gambar; halaman baru dibuat secara otomatis seiring blok terisi, dan Anda dapat memaksa blok mana pun untuk memulai halaman baru.
- **Real page sizes.** Pilih A4, US Letter, atau A5 (potret - tata letak dua kolom dibuat untuk ini) - setiap halaman, dan PDF yang diekspor, dirender pada ukuran itu persis.

PDF multi-halaman adalah dokumen RGB dan tidak membawa tanda potong/bleed - itu milik jalur **Print PDF** satu halaman di atas. Namun mereka membawa **metadata PDF/X-4** yang sama seperti setiap ekspor PDF (kotak halaman, XMP, ID dokumen, output intent sRGB dengan profil tertanam), dan menawarkan **Content Credentials** (di bawah) - pada alat *Booklet* opsi ini sudah terpilih sejak awal.

## Membuat banyak hal sekaligus

Lolly memiliki tiga cara berbeda untuk bekerja dalam volume besar, dan masing-masing menyelesaikan pekerjaan yang berbeda - penyuntingan batch adalah kemampuan kelas satu dari platform, bukan sesuatu yang diciptakan ulang oleh setiap alat:

- <!--i:document--> **One design × a table of rows → one multi-page document.** Alat dengan input `table` (seperti *Battlecards*) mengubah setiap baris menjadi halaman secara otomatis - tempel tabel dari spreadsheet Anda, dapatkan PDF sebesar deck. Editor batch Anda yang sesungguhnya tetaplah spreadsheet: perbaiki sepuluh baris di sana, tempel lagi. Alat itu sendiri tidak pernah mengelola halaman.
- <!--i:layers--> **One design × a data file → many separate files.** Grid batch `/pro` mengambil CSV dan merender satu ekspor *per baris* - lencana nama, sertifikat, masing-masing satu file.
- <!--i:sliders--> **Many different assets, edited side by side.** *Multi-edit* membuka beberapa sesi tersimpan dalam satu tampilan untuk penyesuaian terkoordinasi di berbagai desain yang berbeda.

Aturan praktis: baris dari desain yang sama yang termasuk dalam **satu dokumen** → alat berbasis tabel; baris yang harus dikirim sebagai **file terpisah** → `/pro`; **desain yang berbeda** yang membutuhkan penyesuaian yang sama → multi-edit. (Opsi render "combine media" yang direncanakan akan menjembatani dua yang pertama - menggabungkan ekspor berformat sama menjadi satu PDF, satu video, atau contact sheet untuk proofing.)

## PowerPoint (PPTX)

Design, Markdown Slides, Booklet, Doc Studio, Chart dan Diagrams dapat mengekspor **deck PowerPoint** - satu slide per halaman. Intinya bukan tangkapan layar yang sempurna piksel; melainkan memberi rekan kerja deck yang benar-benar dapat **diedit dan diambil asetnya**. Jadi setiap halaman diurai menjadi objek native:

- <!--i:font--> **Teks** menjadi **kotak teks PowerPoint yang benar-benar dapat diedit** - dengan ukuran font, warna, ketebalan, kemiringan dan perataan dari tata letak - sehingga Anda dapat memperbaiki typo atau mengubah gaya di PowerPoint.
- <!--i:pentool--> **Vektor** (logo, ikon, tanda SUSE) disematkan sebagai **gambar SVG asli** - tetap tajam pada ukuran berapa pun, dan PowerPoint bahkan bisa *Convert to Shape* pada gambar tersebut.
- <!--i:photos--> **Gambar** dibawa masuk pada resolusi aslinya sebagai gambar yang dapat diekstraksi sendiri (hero yang dipotong `cover` menyimpan gambar penuh di balik potongan tersebut, sehingga Anda dapat membingkai ulang), dengan setiap perlakuan pada gambar (filter, blend) dipanggang secara akurat.
- <!--i:layers--> **Latar belakang, garis tepi dan garis** menjadi bentuk persegi/garis yang benar-benar ada.

![Panel ekspor dengan PowerPoint dipilih: satu slide per halaman, teks dan bentuk tetap dapat diedit](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio%3Foptions&width=1440&height=900&dpi=192&waitMs=2500&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22pptx%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-pptx)

Tata letak memang dibuat perkiraan - tujuannya adalah **konten** yang setia dan dapat digunakan kembali, bukan tangkapan layar yang terkunci. Apa pun yang tidak dapat diekspresikan secara native oleh walker (area dengan filter atau mask kompleks) disematkan sebagai gambar sehingga tidak ada yang hilang. Satu dek memiliki satu ukuran slide, diambil dari halaman pertama.

PowerPoint juga menjadi jalan **masuk**. Jatuhkan `.pptx` ke permukaan unggah mana pun dan pilih slide yang Anda inginkan - masing-masing menjadi aset untuk ditempatkan, digradasi, atau dikembangkan lebih lanjut. **Markdown Slides** menulis deck baru dari Markdown (dan menyediakan templat `.pptx` bermerek), dan utilitas **Rebrand** mengubah tema deck yang sudah ada di tempat - palet tema, warna dan font yang di-hardcode - tanpa menyentuh chart, SmartArt, atau animasinya, lalu mengembalikan `.pptx`. Lihat [Impor desain → Deck dan dokumen](/info/design-import.html#decks-and-documents).

## Penpot

Alat mana pun yang dapat mengekspor SVG juga dapat mengekspor **file Penpot** (`.penpot`) - dokumennya, siap untuk terus diedit di Penpot, bukan sekadar dilihat.

- <!--i:layout--> Dari **Design**, setiap bingkai menjadi **board** Penpot, setiap kotak di dalamnya ikut terbawa sebagai bentuknya sendiri yang dapat diedit - persegi, elips, teks, gambar, atau jalur - dan hasilnya muncul sebagai **komponen** yang dapat digunakan kembali di panel Assets, siap diseret keluar lagi.
- <!--i:pentool--> Dari alat yang hasil render-nya berupa **geometri murni** - alat vektor seperti QR Code, Street Map, Wordmark dan Palette Lab - setiap jalur, persegi, baris teks dan gradien ikut terbawa dengan cara yang sama, sebagai bentuknya sendiri yang dapat diedit.
- <!--i:font--> Dari alat yang menyusun render-nya dalam **HTML**, **teks tetap menjadi teks** - satu objek teks Penpot yang dapat diedit per baris, bukan garis luar dan bukan gambar datar. Karya seni yang tidak memiliki konstruk di Penpot - ilustrasi kompleks, kanvas langsung - ikut serta sendiri sebagai gambar, sehingga teks dan kotak di sekitarnya tidak pernah diratakan. Keseluruhan tata letak yang tidak dapat dipisahkan Penpot secara setia tetap bisa muncul sebagai satu gambar dengan fidelitas penuh, sehingga tidak ada yang pernah hilang.
- <!--i:palette--> Warna atau font yang oleh sebuah bentuk **diwarisi dari token merek** tetap **tertaut** ke token itu di dalam file: ubah token di panel Tokens Penpot dan setiap bentuk yang mewarisinya ikut dicat ulang bersama, sementara warna literal satu kali tetap persis di tempatnya. Warna dan tipografi merek juga masuk ke panel **Assets**, dan seluruh set token desainnya masuk ke panel **Tokens** - set token DTCG yang sama yang digunakan palet Lolly sendiri. Penpot menyimpan salinannya sendiri dari sana: perubahan yang dibuat di panel Tokens-nya kembali ke merek melalui [impor Brand Studio](/info/design-import.html), bukan dengan sendirinya.

| Yang Anda buat | Di Penpot |
|---|---|
| Teks | Objek teks yang dapat diedit - perbaiki salah ketik atau gaya ulang |
| Bentuk, jalur, gradien, gambar | Bentuk vektornya sendiri yang dapat diedit |
| Warna atau font dari token merek | Tautan token langsung - edit tokennya, setiap bentuk yang mewarisinya ikut menyesuaikan |
| Seluruh desain | Komponen yang dapat digunakan kembali di panel Assets |
| Ilustrasi kompleks atau kanvas langsung | Disematkan sendiri sebagai gambar, konten yang dapat diedit di sekitarnya tidak tersentuh |

![Panel ekspor dengan Penpot dipilih: file .penpot, dan Send to Penpot di samping unduhan](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22penpot%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-penpot)

Untuk membukanya, jalankan Penpot, pilih sebuah proyek dan pilih **Import**. Setelah masuk ke Penpot dari panel ekspor, **Send to Penpot** melakukan langkah itu untuk Anda - pilih proyek di sana dan file langsung masuk ke dalamnya.

## SCORM (paket kursus)

Deck Design dapat keluar sebagai **paket SCORM** - zip yang diimpor oleh learning management system, entah itu Moodle, Canvas, Blackboard, atau LMS korporat. Pilih **SCORM (LMS)** di pemilih format dan ekspor akan menulis:

- <!--i:layout--> **Slide-slide**, satu gambar per artboard, sebagai vektor di mana artboard memungkinkannya dan sebagai piksel hanya di mana tidak memungkinkan.
- <!--i:play--> **Film bernarasi** dengan trek teksnya - catatan pembicara yang dibacakan oleh suara di perangkat, persis seperti cara [Presenting](/info/create/using.html#presenting) memutarnya.
- <!--i:file--> **Halaman peluncuran** yang melangkah melalui slide, memutar film dan melaporkan penyelesaian kembali ke LMS melalui runtime SCORM 1.2, versi yang diterima oleh semua LMS.
- <!--i:font--> Font yang digunakan deck, sehingga halaman peluncuran tetap tampil sama secara luring.

![Panel ekspor pada deck Design dengan SCORM (LMS) dipilih](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour%26format%3Dscorm%26options&width=1440&height=900&dpi=192&waitMs=3500&css=.fc-insp%7Bdisplay%3Anone!important%7D.edge-dock-slot--fill%7Bflex%3A1%201%20auto!important%3Bheight%3Aauto!important%3Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D.export-popup.is-floating%7Bheight%3Aauto!important%7D.export-popup-body%7Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-scorm)

Tidak ada apa pun dalam paket ini yang menghubungi rumah: hanya file dalam zip, dan berjalan di dalam LMS tanpa bundler, tanpa CDN dan tanpa akun. Aplikasi web dan desktop membangunnya; CLI tidak, karena memotret artboard dan mengkodekan film membutuhkan browser.

## DXF (file potong)

Alat vektor (Brand Lockup, QR Code, Street Map, Wayfinding Signage, Pose Geeko, logo lockup, Diagram Builder) dapat mengekspor **DXF** - format interchange AutoCAD R12 yang dibaca oleh laser cutter, vinyl plotter dan software CNC/CAD. Geometri ditulis sebagai outline **path dalam milimeter** (kurva diratakan hingga toleransi halus), teks di-outline menjadi path dan warna dipetakan ke AutoCAD Color Index terdekat (yang biasanya menentukan alat/operasi pada sebuah cutter). DXF hanya untuk line-art - sebuah area fotografis atau yang difilter tidak memiliki bentuk cut-path dan akan dihilangkan (Lolly memperingatkan), jadi gunakan SVG/PDF saat Anda perlu mempertahankan konten raster.

Street Map adalah kasus paling jelas: seluruh desain sudah berupa stroke, sehingga setiap jalan dan kanal menjadi cut path tanpa ada yang perlu dibuang.

::: showcase
![Render Street Map Paris dalam tinta di atas krem - line art murni, sehingga setiap stroke selamat sampai ke mesin pemotong](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Dparis%26roadColor%3D1a1a2e%26waterColor%3D93c5fd%26background%3Dfaf7f2%26full&width=1440&height=900&dpi=96&waitMs=3200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-street-map-cut)

Gulir, dan kamera mundur menembus geometri sebenarnya: tujuh path, tidak ada piksel di mana pun, setiap stroke tetap tajam sehalus rambut pada zoom berapa pun. Itulah file yang sama yang dibaca oleh mesin pemotong.
:::

## SVG Animasi

Alat gerak (Animated Ad, Lottie Ad) dapat mengekspor **SVG Animasi** - animasi *vektor* yang mandiri. Berbeda dengan GIF/APNG/WebP (yang mengambil sampel setiap frame menjadi piksel), SVG animasi menumpuk snapshot vektor dengan keyframe CSS yang disematkan, sehingga **berskala ke ukuran berapa pun tanpa codec dan tanpa runtime eksternal** - animasi ini berputar di tab browser atau `<img>`. Teks tetap di-outline sehingga dapat dirender di mana saja. Format ini berbagi kontrol **Durasi** / frame rate dengan format animasi lainnya, dan (karena lebih berat per frame dibanding bitmap) menggunakan frame rate default yang lebih rendah.

## Transparansi

Alat yang mendukungnya menawarkan toggle **latar belakang transparan** (misalnya *No BG*). Transparansi dipertahankan oleh PNG, WebP, AVIF, SVG (diam dan animasi), APNG dan Animated WebP. JPG dan PDF selalu buram, dan TIFF diratakan ke putih (ke hitam pada jalur HDR - lihat di bawah).

## Ruang warna

Dua pertanyaan berbeda, yang perlu dipisahkan: ruang warna mana yang dapat **dibaca dan dipahami** Lolly, dan ruang warna mana yang **ditulisnya**.

**Membaca.** Di mana pun warna ditulis - stylesheet sebuah alat, paint SVG yang diimpor, nilai design token, shadow atau gradient di dalam CSS shorthand - Lolly membaca kosakata **CSS Color 4** secara penuh: `#hex`, `rgb()`, `hsl()`, `hwb()`, `lab()`, `lch()`, `oklab()`, `oklch()`, nama warna CSS dan `color()` dalam ruang yang telah ditentukan - `srgb`, `srgb-linear`, `display-p3`, `a98-rgb`, `prophoto-rgb`, `rec2020`, `xyz-d50`, `xyz-d65` - termasuk komponen yang ditulis sebagai kata kunci `none`. Satu parser melakukan ini untuk seluruh platform, sehingga browser dan setiap walker ekspor sepakat tentang arti sebuah string warna.

Itu lebih penting dari kedengarannya, karena browser mengubah CSS modern menjadi CSS modern. Tulis `color-mix(in oklab, …)` dan Chrome menghitung `oklab(…)`; gunakan brand token yang disimpan sebagai `oklch()` dan itulah nilai literal yang dilihat walker ekspor. Warna dalam bentuk-bentuk itu dibaca dengan benar, bukan dibuang - yang mana itulah yang dilakukan walker yang hanya memahami `rgb()`, mengekspor teks berwarna brand sebagai hitam, kehilangan panel yang bertint dan garis tabel serta membaca `oklch(0.7 0.1 200) 0px 2px 4px` sebagai offset shadow 0.7 kali 0.1.

**Pemikiran.** Matematika warna terjadi secara perseptual, bukan pada channel mentah. Derivasi palet, ramp, harmoni dan kontras berjalan dalam **OKLCH/OKLab**, dan warna out-of-gamut dibawa ke dalam rentang oleh algoritme gamut-mapping milik CSS Color 4 sendiri - reduksi chroma dengan pemeriksaan jarak perseptual - bukan dengan clipping channel, sehingga warna cerah mendarat pada warna terdekat yang benar-benar akan Anda terima, bukan warna yang diratakan. Gradient diinterpolasi dalam ruang yang Anda pilih (OKLab secara default, atau `oklch`, `lab`, `lch`, `srgb`, `srgb-linear`, `hsl`, dengan arah hue-travel untuk yang polar), dan pencampuran bersifat **premultiplied**, jadi sebuah fade ke transparan tetap pada warna yang benar, bukan menggelap ke arah hitam di tengah jalan. Satu interpolator melayani baik walker preview maupun ekspor - itulah yang mencegah sebuah gradient conic ter-blend dengan satu cara di layar dan cara lain di file yang diekspor.

**Menulis.** Output secara sengaja lebih sempit daripada input, karena file harus dapat dibaca oleh apa pun yang membukanya, dan sebuah ruang hanya *dideklarasikan* pada output ketika angkanya benar-benar dikonversi ke dalamnya. Format layar dan web ditulis sebagai **sRGB** dan ditandai demikian; format cetak ditulis sebagai **CMYK** terhadap kondisi press bernama (di bawah); dan jalur HDR adalah **Rec.2100 PQ** (di atas). Warna wide-gamut yang mencapai ekspor dipetakan ke sRGB, bukan diberi label salah - membawa `color(display-p3 …)` ke dalam file vektor adalah ekstensi yang direncanakan, bukan sesuatu yang diklaim dilakukan oleh ekspor saat ini. Gradient yang dibuat dalam OKLab *dipanggang* menjadi stop sRGB biasa saat keluar, dengan stop tambahan disisipkan hanya di tempat sRGB akan terlihat menyimpang dari kurva perseptual, karena `<linearGradient>` SVG dan shading axial PDF tidak memiliki pengaturan ruang interpolasi untuk membawa maksud tersebut. Satu nilai yang dibuat, tiga renderer, tanpa penyimpangan.

## Profil warna

Agar warna direproduksi secara akurat di aplikasi yang mengelola warna (percetakan, Photoshop, browser), ekspor **ditandai dengan profil warna**:

- **PNG / JPG** membawa profil ICC **sRGB** yang disematkan - ruang warna tempat pratinjau sebenarnya dirender - sehingga tidak ada yang perlu ditebak. (Hanya penandaan; piksel tidak dikodekan ulang.)
- **PDF Cetak (CMYK)** mendeklarasikan **kondisi press** target dalam *OutputIntent*-nya (default *Coated FOGRA39*), memberi tahu RIP/percetakan bagaimana tinta CMYK-nya harus dibaca. Swatch brand dengan nilai tinta terukur dikonversi secara tepat; warna lain menggunakan konversi perangkat standar. Deklarasi itu adalah sebuah *nama*: tidak ada profil CMYK yang dikirimkan bersama Lolly, dan PDF/X-4 menginginkan profil disematkan, sehingga kondisi bernama menulis output intent tanpa mengklaim kesesuaian PDF/X-4. Muat profil CMYK Anda sendiri dan pilih baris **Embed**-nya pada kontrol Profil warna, dan profil itu disematkan sebagai *DestOutputProfile* file - pada titik itu PDF dapat benar-benar menjadi PDF/X-4, dan mengklaimnya kapan pun sisa file mengizinkan. Tiga hal menahan klaim tersebut sambil tetap mempertahankan output intent (RIP tetap menginginkannya): artwork RGB yang tidak dapat dikonversi oleh proses CMYK, teks kredit margin bukti `prov` (digambar dalam font standar yang tidak disematkan, dan X-4 tidak membuat pengecualian untuk itu) dan kata sandi **Strong**, karena X-4 melarang enkripsi. Kondisi yang dideklarasikannya kemudian dibaca dari profil tersebut: nama terdaftar di mana profil membuktikan satu, `Custom` dengan nama profil itu sendiri di mana tidak, sehingga file tidak akan pernah menyebut satu kondisi press sambil membawa pengukuran kondisi lain.
- **TIFF Cetak (CMYK)** menulis piksel **DeviceCMYK** tanpa tanda dan mencatat kondisi press yang sama sebagai provenans dalam metadata TIFF-nya (*ImageDescription*) alih-alih menyematkan profil. Kontrol Profil warna yang sama menggerakkan kedua format CMYK - TIFF sama sekali tidak dapat menyematkan profil press, sehingga baris **Embed** hanya mencatat nama profil itu sendiri di sana dan tidak lebih.
- **TIFF (RGB)** adalah saudara sRGB yang polos dan tidak terkompresi - raster lossless pada DPI yang dipilih untuk pengarsipan atau bolak-balik dengan editor, dengan provenans dicatat di metadata TIFF yang sama. Transparansi apa pun diratakan ke putih (profil ini tidak membawa alpha). Seperti TIFF CMYK, ini hanya untuk desktop, karena browser tidak dapat mempratinjau TIFF dan unduhan mobile menemui jalan buntu.
- **SVG**, **EMF**, **EPS** dan **DXF** adalah vektor yang independen dari resolusi dan profil tanpa profil yang disematkan - warna SVG adalah sRGB polos, EMF dan EPS adalah device RGB (dan **EPS (CMYK)** menulis DeviceCMYK apa adanya) dan **DXF** membawa AutoCAD Color Index terdekat. (SVG, EPS dan DXF, seperti PDF, meng-outline teks apa pun menjadi path vektor, sehingga hasilnya tetap dirender bahkan ketika font tidak terpasang. EMF sebaliknya menjaga teks tetap LIVE secara default - rekaman teks metafile asli yang tetap dapat dipilih dan diedit di Office dan Google Slides, hanya kembali ke outline untuk baris yang tidak dapat diekspresikan format tersebut; opsi "Outline fonts" pada panel ekspor memaksa path di mana pun.) **SVG** juga mereproduksi `box-shadow` CSS dari HTML - setiap shadow luar digambar di belakang kotak, offset/spread dan Gaussian-blur agar sesuai dengan browser, dan inset shadow digambar di dalamnya dengan cara yang sama.

Ini otomatis - tidak ada pengaturan untuk diutak-atik. Thumbnail dan pratinjau melewati tanda ini agar tetap kecil. Satu profil *memang* menjadi pilihan, karena ia mengubah piksel, bukan sekadar melabelinya - lihat **HDR** di bawah.

## HDR (warna terang)

Ekspor biasa adalah sRGB: putih adalah putih, dan warna brand yang jenuh sama terangnya dengan putih normal layar. Pada tampilan yang mendukung HDR terdapat banyak ruang lebih di atas itu, dan kartu **HDR** pada panel ekspor menggunakannya - warna brand Anda dan teks putih ditingkatkan menuju kecerahan puncak sehingga benar-benar *bersinar*, sementara area gelap tetap gelap dan memberi kontras pada kilau tersebut.

![Kartu HDR di panel ekspor, dinyalakan, dengan dial White / Reach / Dark lift / Focus terungkap di bawahnya](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26hdr%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-hdr&walker=1&dark=1&filename=exp-hdr-card)

- **Format.** Format raster yang punya tempat untuk membawa sinyal: **PNG**, **JPG**, **AVIF** dan **TIFF**. (Bukan WebP - formatnya 8-bit tanpa jalur decode HDR yang berfungsi, jadi WebP PQ hanya akan terlihat gelap. Vektor dan PDF sama sekali tidak punya model HDR.)
- **Mati secara default**, berbeda dari penandaan warna - ia mengubah piksel, jadi sifatnya opt-in. Centang kartu, atau sertakan `hdr=1` di tautan berbagi.
- **Apa yang sebenarnya ditulis.** Piksel dikodekan ulang ke **Rec.2100 PQ** - primer BT.2020 dengan kurva transfer SMPTE ST 2084 (PQ) - dan kontainer membawa sinyal yang sesuai sehingga aplikasi yang mengelola warna tahu cara membacanya: profil **ICC v4 dengan tag `cicp`** yang dihasilkan (JPG, TIFF), sebuah **chunk `cICP`** (PNG), atau kotak `colr` yang ditulis ulang (AVIF). Peningkatan ini digerbangi oleh **kecerahan perseptual (OKLab)**, sehingga warna menengah ke atas dipacu ke puncak dan warna gelap ditenangkan alih-alih dibuat pecah, dan bersifat mempertahankan corak - hijau merek jadi lebih terang, bukan seperti mint.
- **Kenop pengatur.** Empat, terungkap saat kartu diaktifkan: **White** (batas kecerahan puncak, 400-2000 nit), **Reach** (seberapa jauh cahaya menyebar ke nada bawah), **Dark lift** (seberapa banyak warna gelap dicerahkan - `0` mempertahankan kegelapannya) dan **Focus** (seberapa banyak kekayaan warna yang dipertahankan peningkatan ini). Semuanya dibawa dalam parameter yang sama sebagai nilai terkalibrasi ringkas - `hdr=1600-60-0-50` berarti White 1600, Reach 60, Dark lift 0, Focus 50 - sehingga tampilan yang dikalibrasi dapat direproduksi dari tautannya.
- **Di mana Anda akan melihatnya.** Penampil yang mengelola warna di layar HDR: Preview / Quick Look / Safari di perangkat Apple, Chrome di monitor HDR. Di layar SDR biasa, file tetap tampil sebagai gambar normal.
- **Ketahui sebelum Anda kirim.** Banyak platform **mengkodekan ulang** apa yang Anda unggah dan menghapus sinyal HDR - jejaring sosial, aplikasi pesan, beberapa CMS - yang dapat membuat gambar terlihat gelap atau pudar. Gunakan HDR di tempat Anda mengendalikan tujuannya (situs yang Anda bangun, video wall, deck di panel terang), bukan sebagai default untuk semuanya.
- **Transparansi.** PNG dan AVIF mempertahankan alpha-nya; JPG selalu opak. Jalur **TIFF** diratakan ke atas **hitam**, bukan putih seperti jalur SDR - dalam PQ, putih adalah kode 10.000-nit, sehingga meratakan ke atasnya akan membuat setiap tepi berhalo menyilaukan.
- **Byte yang sama dari terminal.** `--hdr=1` dengan `--export=png` atau `--export=jpg` menulis PNG Rec.2100 PQ 16-bit dan JPEG gain-map ISO 21496-1 di [CLI](/info/cli.html) juga, dari encoder engine yang sama, bukan dari browser - sehingga alat yang native `<svg>` menghasilkan file HDR tanpa Chromium sama sekali di jalurnya, dan PNG-nya identik byte demi byte dengan milik shell web. AVIF dan TIFF untuk saat ini tetap menjadi ekspor shell web.

## Video

Alat animasi mengekspor gerakan sebagai **MP4**, **WebM** atau **GIF** - dan, jika tersedia, **APNG**, **Animated WebP** atau **SVG Animasi** vektor (di atas). Kontainer video mana yang Anda lihat bergantung pada browser Anda - pemilih hanya menampilkan apa yang benar-benar dapat direkamnya:

| Browser | Menampilkan |
|---|---|
| Safari / iOS | **MP4** |
| Firefox | **WebM** |
| Chrome / Edge 126+ / Android | **MP4 dan WebM** |
| Chrome lama | **WebM** |

GIF berfungsi di mana saja (bagus untuk chat/email; lebih besar dan warnanya lebih sedikit dibanding video). Alat animasi juga menampilkan **Wait** (detik untuk membiarkan animasi mengendap sebelum perekaman) dan **Duration** (panjang klip).

> Tautan `?format=…` yang dibagikan dan meminta kontainer yang tidak dapat direkam browser Anda akan mundur dengan baik ke kontainer lain dan menamai file sesuai dengan itu.

**Suara.** Ekspor video tidak bisu. Sebuah alat dapat meletakkan **musik latar** di bawah klip - aset audio dari katalog, diulang atau dipotong sesuai panjang klip, dengan fade-in/out, volume dan ducking otomatis di bawah suara asli rekaman - dan alat perekaman membawa audio langsung rekamannya langsung ke dalam file. **MP4** dan **WebM** mempertahankan trek yang telah dicampur; GIF dan format gambar animasi (APNG, Animated WebP, SVG Animasi) secara alami bisu.

## Audio

Beberapa alat mengekspor **audio saja**, bukan hanya sebagai trek video. **Voice Recorder** merekam pengambilan mic dengan meter level langsung dan panduan yang lembut, lalu menyimpannya sebagai **MP3** (default, ditranskode di browser Anda) atau dalam kontainer aslinya - **M4A** (AAC), **OGG** atau **WebM** (Opus), tergantung mana yang direkam browser Anda. Seperti hal lainnya, pengodean terjadi di perangkat Anda - tidak ada yang diunggah.

Audio yang Anda *bawa masuk* juga sama luasnya. Pemilih aset menerima **MP3**, **WAV**, **OGG**/**Opus**, **M4A**/**AAC** dan **FLAC** (disimpan byte-demi-byte dan didekode di perangkat), **MIDI** (`.mid` - dikonversi saat impor menjadi trek synth kecil di perangkat) dan **modul tracker** - **MOD**, **XM**, **IT**, **S3M**, **STM**, **MTM** (didekode di perangkat oleh pemutar bawaan, hanya beberapa kilobyte data lagu). Semua ini dapat menjadi **musik latar** di bawah ekspor video, atau diputar di pemutar ambient Neurospicy Mode.

Audio *memang* menjadi bagian dari pipeline `format=` / `--export=` di bawah: `wav`, `mp3`, `m4a` dan `opus` adalah id format biasa, sehingga ekspor khusus audio sama mudah dibagikan dan discript-kan seperti PNG. Yang keluar hanyalah suara saja, tanpa gambar.

## Provenans & watermark

Di mana format mendukungnya, ekspor membawa **metadata provenans** - perangkat lunak, sumber, nama alat dan baris kredit profil Anda - disematkan secara native (PNG iTXt, JPEG EXIF, info PDF, `<metadata>` SVG, komentar GIF). Ini hanya kepenulisan; tidak ada yang diunggah. Alat **Experimental** juga menambahkan watermark yang terlihat, diterapkan oleh host sehingga tidak dapat dihapus dengan mengedit alat.

**Lolly Imprint.** Ekspor raster juga membawa **watermark piksel tak terlihat** milik Lolly sendiri - *Lolly Imprint* - **aktif secara default**, sama seperti Content Credentials. Di mana kredensial dan metadata provenans berjalan *bersama* piksel dan hilang saat penyimpanan ulang, tangkapan layar atau penghapusan metadata, Imprint hidup *di dalam* piksel dan bertahan dari kompresi ulang - sehingga salinan gambar masih dapat dikenali sebagai buatan Lolly nanti. Ini adalah petunjuk yang tahan lama, bukan jaminan kriptografis, dan hanya bersifat kehadiran (tidak membawa data pribadi apa pun). Ia hadir di **PNG, JPG, WebP, AVIF, TIFF dan BMP**, dan di raster yang dirender Lolly yang disusun ke dalam **PDF atau PPTX** - tidak pernah pada gambar yang *Anda* sematkan, hanya pada apa yang dirender Lolly sendiri. Hapus centang kartu **Lolly Imprint** di panel ekspor untuk melewatinya, atau sertakan `imprint=0` pada tautan berbagi. (Ketahanan AVIF melalui pengodean ulang belum dikalibrasi; deteksi PDF/PPTX mencakup raster Lolly yang disematkan.) [/verify](/verify) mendeteksinya di perangkat - lihat [Identitas Content Credentials](/info/content-credentials-identity.html#the-lolly-imprint).

**Kredensial tahan lama.** Tanda kedua yang lebih berat berdampingan dengan Imprint: **Durable credential**, yang menggunakan model neural di perangkat (format TrustMark) untuk menulis id Lolly *ke dalam* piksel sehingga tautan "made with Lolly" bertahan dari penghapusan metadata, pengodean ulang dan pembacaan ulang oleh alat yang mengenal TrustMark maupun oleh Lolly sendiri. Ini **nonaktif secara default** - tidak seperti Imprint murni-JavaScript, ini membutuhkan proses neural per ekspor ditambah unduhan model satu kali, sehingga ini adalah opt-in yang disengaja, bukan pajak diam-diam. Hanya raster (**PNG, JPG, WebP, AVIF, TIFF**), dicentang di panel ekspor atau disertakan sebagai `durable=1` pada tautan berbagi. Pada aplikasi desktop dan mobile, kartu ini disembunyikan sepenuhnya alih-alih ditampilkan sebagai tidak berfungsi, karena tidak ada origin untuk mengambil model secara offline.

**Perlindungan konten.** Di panel ekspor, *Password protect*, **C2PA Credentials**, **Lolly Imprint** dan **Durable credential** dilipat menjadi satu grup **Content protection** yang diciutkan dan menyesuaikan format, sehingga opsi provenans dan perlindungan file berada di satu tempat - grup ini hanya menampilkan kartu yang berlaku untuk format yang dipilih, dan menyembunyikan dirinya sepenuhnya ketika tidak satu pun berlaku. Tanda cetak dengan sengaja *tidak* ada di dalamnya: itu adalah geometri produksi cetak, bukan perlindungan, sehingga **Print marks & bleed** - pengukuran bleed dalam milimeter ditambah Crop, Registration, Bleed, Colour bars dan Stamp details - mempertahankan kartu tingkat atasnya sendiri pada format cetak.

![Grup Content protection dibuka pada ekspor PNG, menampilkan hanya kartu yang berlaku untuknya](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26imprint%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-protection&dark=1&filename=exp-content-protection)

**Sebelum Anda mengekspor (preflight cetak).** Aktifkan **Print preflight** (`export-preflight`) di feature flag Profil Anda - ini **nonaktif secara default**, sehingga individu yang mengekspor PNG untuk pesan chat tidak pernah dikejutkan oleh temuan prepress, dan control plane sebuah deployment ([lolly.work](https://lolly.work)) dapat mengaktifkannya secara default untuk anggotanya - dan kartu **Before you export** muncul di bagian bawah panel, tepat di atas tombol, kapan pun aturan cetak memiliki sesuatu yang benar untuk disampaikan tentang pekerjaan tersebut: format, ukuran dan bleed, lalu area trim dan bleed, cakupan tinta, jumlah plate dan jumlah halaman, dengan verdict di samping judulnya. Kartu ini berada di bawah setiap pengaturan karena ini adalah pernyataan *tentang* pengaturan tersebut, bukan pengaturan lain - dan tidak pernah memblokir ekspor. Kartu ini memberi tahu Anda apa yang akan segera dilihat oleh percetakan.

**Biaya, dihitung dari rate card Anda.** Di bawah preflight - paling akhir, masih di atas tombol - terdapat kartu yang mengubah hitungan yang sama menjadi uang, dan hanya dari harga yang benar-benar diberikan seseorang kepadanya. Kartu ini membaca apa pun yang dihitung oleh proses preflight, baik kartu preflight sendiri diaktifkan atau tidak, dan membutuhkan dua hal agar benar: pekerjaan tersebut memiliki sesuatu yang dapat diberi harga oleh daftar harga (plate, lembar, luas, halaman, baris varian atau file output - sehingga PNG logo biasa tidak akan pernah menampilkannya), **dan** sebuah **rate card** tersedia. Rate card adalah daftar harga JSON dari percetakan Anda. Build default tidak membawa satu pun dan tidak memiliki cara di dalam aplikasi untuk memuatnya: rate card hadir baik sebagai aset katalog yang dikirimkan sebuah deployment, atau melalui ekstensi rate card opsional yang diaktifkan oleh self-hoster atau control plane. Tanpa rate card, tidak ada yang ditampilkan - bukan prompt, bukan tabel kosong.

Aturan yang menjadi dasar seluruh hal ini adalah bahwa ini **tidak pernah mengarang uang**. Setiap angka adalah tarif yang Anda berikan dikalikan kuantitas yang dihitung Lolly - `4 plate × €35.00` - dan totalnya menyebutkan sumbernya sendiri dalam kalimat yang sama dengan angkanya: penerbit yang disebutkan kartu, dan tanggal yang menurut kartu tersebut merupakan asal tarifnya. Tidak ada mata uang default, tidak ada placeholder dan tidak ada nol yang mewakili harga yang hilang. Apa yang dikatakan file tentang dirinya sendiri tetap menjadi ucapan yang dilaporkan: *"File tersebut mengatakan: … Lolly belum memverifikasi ini."*

Dan ketika tidak dapat menghitung secara jujur, tabel kerja **menghilang** alih-alih terdegradasi menjadi angka yang diabukan atau diisi begitu saja:

- Baris yang tidak diberi harga oleh kartu berarti **tidak ada total sama sekali** - hanya judul yang menyatakan berapa banyak baris yang tidak diberi harga. Jumlah parsial bukanlah jawaban yang lebih kecil, itu adalah jawaban yang salah.
- Kuantitas yang merupakan batas atas alih-alih jumlah pasti membawa **"hingga"** ke dalam subtotalnya, sehingga sebuah batas tidak pernah dicuci menjadi angka pasti.
- Tarif yang telah melewati tanggal valid-until-nya hanya menampilkan **jumlah saja**, sampai Anda menekan *Use these rates anyway* - dan kemudian tanggal kedaluwarsa menyertai angka tersebut, sehingga total yang sudah kedaluwarsa tidak dapat dibaca sebagai yang berlaku saat ini.
- Dibuka melalui **tautan**, uang tetap tersembunyi sampai Anda memintanya di perangkat ini. Baik kartu maupun pengungkapan itu tidak pernah berjalan dalam URL - alasan yang sama mengapa CLI mengambil `--rate-card=<file.json>` sebagai flag file lokal dan tidak pernah sebagai parameter tautan.

Kartu ini adalah chrome, bukan konten: kartu ini dihapus dari setiap tahap ekspor, sehingga tidak dapat menggerakkan satu piksel pun dari file yang Anda unduh. Dan ini adalah perhitungan, bukan penawaran - hanya percetakan Anda yang dapat memberikannya kepada Anda.

**Render tersusun.** Ketika sebuah alat menyematkan output alat lain (misalnya *Event Name Badge* menyematkan *QR Code*), render yang bersarang disatukan ke dalam ekspor induknya - tetap menjadi **vektor sejati** dalam SVG dan PDF dan dirasterisasi secara tajam dalam PNG/JPG/WebP. Anak yang disematkan adalah perantara: ia *tidak* mendapat watermark dan *tidak* mendapat provenans miliknya sendiri; hanya aset induk yang selesai yang mendapatkannya. (Komposisi mencakup SVG dan format raster; HTML/MD/TXT tidak dapat disusun.)

## Perlindungan kata sandi

Dua jenis kunci independen, keduanya sepenuhnya on-device.

**Kata sandi buka PDF** - kartu *Password protect* di panel ekspor menawarkan dua tingkat:

![Kartu Password protect yang diperluas pada ekspor PDF, dengan bidang kata sandi dan dua tingkat kunci](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpdf%26password%3Ddemo%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-pdfpass&dark=1&filename=exp-pdf-password)

- **Standard** - kunci 40-bit dasar (RC4). Terbuka di *aplikasi PDF apa pun*, dan - karena hanya penghalang ringan, bukan perlindungan sungguhan - kata sandinya bisa ikut dalam tautan berbagi (teks polos, memang disengaja). Hanya `pdf` RGB.
- **Strong** - AES-256 (PDF 2.0). Kata sandinya diketik saat ekspor dan **tidak pernah** dimasukkan ke tautan; hanya terbuka di aplikasi PDF yang lebih baru (Acrobat / Preview ~2018 ke atas), dan aplikasi lama mungkin melaporkan file sebagai rusak. Strong juga berlaku untuk **PDF Print / CMYK** dan untuk **setiap PDF di dalam zip batch** (dialog konfirmasi batch mengumpulkan kata sandinya). Karena PDF/X-4 melarang enkripsi, PDF Print yang dikunci Strong tetap mempertahankan CMYK, tanda cetak dan output-intent-nya tetapi kehilangan klaim kesesuaian PDF/X-4.

Kedua tingkat saling eksklusif dengan Content Credentials (PDF terenkripsi tidak bisa membawa kredensial).

**Unduhan terkunci (seluruh-zip + defense-in-depth)** - ekspor **ZIP** (format *ZIP* di panel ekspor, yang menggabungkan beberapa format tool sekaligus), unduhan **folder** (Projects → Download) atau **grid batch** dapat mengunci seluruh zip dengan satu kata sandi, pada dua tingkat:

- **Standard** - **ZipCrypto** tradisional: terbuka di *alat unzip apa pun* termasuk fitur ekstrak bawaan Windows Explorer, tapi lemah (sekadar penghalang). Kata sandinya bisa ikut dalam tautan berbagi `?password=`.
- **Strong** - **AES-256** (WinZip AE-2): kuat, tapi **tidak** terbuka di fitur ekstrak bawaan Windows Explorer - penerima memerlukan 7-Zip / WinZip / Keka / macOS. Diketik saat ekspor, tidak pernah dimasukkan ke tautan.

Kartu *Password protect* yang sama di panel ekspor menggerakkan kedua kunci PDF dan ZIP, dan menyesuaikan penyebutannya sesuai format yang dipilih. Satu kata sandi melindungi **setiap** anggota - gambar, SVG, semuanya, termasuk PDF (hanya kontainer zip yang dapat melindungi file non-PDF, yang tidak punya kunci sendiri). Dan ini **defense-in-depth**: PDF apa pun di dalamnya *juga* dikunci AES-256 secara individual dengan kata sandi yang sama, sehingga PDF tetap terkunci bahkan setelah zip dibongkar. Prompt muncul saat Anda memulai unduhan; kata sandi kosong berarti tanpa kunci.

**Tautan berbagi berpagar kata sandi** - tautan berbagi apa pun dapat dienkripsi sehingga membukanya meminta kata sandi dari penerima. Seluruh state tautan dienkripsi AES-256 dengan kunci yang diturunkan dari kata sandi (PBKDF2); hanya ciphertext yang berpindah, jadi **kata sandi tidak pernah ada di tautan** dan dekripsi terjadi **di peramban penerima** - server yang menyajikan tautan hanya melihat ciphertext di URL, tidak pernah kata sandi dan tidak pernah desain yang sudah didekripsi. Aktifkan di dialog **Share**. Tautan terenkripsi hanya bisa *dibuka* di Lolly (tidak bisa disematkan sebagai gambar, karena jalur itu tidak bisa meminta kata sandi). Lihat [URL Mode → Encrypted links](/info/url-mode.html).

## Content Credentials (C2PA)

Ekspor dapat membawa **Content Credentials** - manifes [C2PA](https://c2pa.org) yang ditandatangani dan disematkan dalam file, yang mencatat, dengan cara yang tahan perubahan, bahwa file tersebut dibuat dengan Lolly dan belum diubah sejak itu. Ini adalah versi standar dari metadata provenans di atas: klaim kriptografis (apa yang membuat file, kapan, oleh siapa dan di mana) yang terikat pada hash byte file, sehingga perubahan berikutnya dapat dideteksi oleh penampil yang mendukung C2PA. Standar ini dikelola oleh [Content Authenticity Initiative](https://contentauthenticity.org) (Adobe, BBC, Microsoft, Nikon dan lainnya), jadi kredensial yang ditulis Lolly sama dengan yang mulai diadopsi kamera, ruang redaksi dan suite kreatif.

![Kartu C2PA Credentials, sudah tercentang, dengan masa berlaku kredensial di sampingnya](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26c2pa%3D30%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-c2pa%5Bdata-c2pa-only%5D&walker=1&dark=1&filename=exp-c2pa-card)

- **Format.** Setiap kontainer dengan penyematan C2PA: **PDF** (RGB dan Print), **PNG / Animated PNG**, **JPG**, **GIF**, **SVG**, **TIFF** (RGB dan Print), **WebP** (diam dan animasi), **AVIF**, **MP4**, **WebM** dan kontainer audio **MP3**, **WAV**, **M4A** dan **OGG/Opus** - jadi klip suara rekaman atau sintesis dikirim dengan kredensial yang sama seperti gambar. Bundel **ZIP** menstempel setiap anggota yang didukung secara individual, yang juga menjadi cara **Animated SVG** mendapatkannya (di baliknya ini hanyalah dokumen SVG biasa; ekspor Animated SVG langsung tidak menawarkan kartunya sendiri). MP4, AVIF dan M4A menggunakan pengikatan BMFF dari spesifikasi dan MP3 memakai pemetaan ID3v2-nya, sehingga `c2patool` dan penampil lain yang mendukung C2PA dapat memverifikasinya; **WebM** dan **OGG/Opus** belum punya pemetaan C2PA baku, jadi Lolly membawa manifesnya sebagai lampiran Matroska dan bidang OpusTags secara berturutan, yang diperiksa oleh verifier Lolly sendiri (dan CLI). (`ico`, `eps`, `emf`, `dxf`, `bmp`, `pptx`, format Office serta format teks/data tidak memiliki kontainer C2PA.)
- **Aktif secara default.** Kartu **C2PA Credentials** di panel ekspor sudah terpilih untuk hampir semua tool - hilangkan centangnya untuk melewati kredensial pada satu ekspor (atau sertakan `c2pa=off` di tautan berbagi). Sebuah tool bisa memilih keluar sepenuhnya di manifesnya.
- **Apa yang dicatat.** Tool dan aplikasi yang membuat file, waktu penandatanganan, permukaan ekspor (keluarga mesin peramban + keluarga OS - sengaja kasar, tidak pernah menjadi sidik jari) dan - hanya ketika *Profile → Use my details* aktif - nama dan email Anda sebagai pembuat karya.
- **Apa yang dilihat penerima.** Tool pemeriksa content credentials (aplikasi Adobe, `c2patool`, contentcredentials.org/verify) akan membaca manifes dan menampilkan klaimnya. Karena Lolly menandatangani dengan kunci yang dibuat **di perangkat Anda** - bukan sertifikat dari daftar tepercaya - penampil melaporkannya sebagai kredensial *tidak terverifikasi*. Struktur dan bukti anti-rusaknya nyata; hanya identitas penanda tangan yang tidak dijamin oleh otoritas mana pun. Untuk meningkatkannya, Anda dapat mendaftarkan **identitas terverifikasi** (Profile → Content Credentials): sertifikat berumur pendek dari Lolly CA mengikat email Anda ke ekspor Anda sementara kunci penandatanganan tetap tidak pernah meninggalkan perangkat Anda - lihat [Content Credentials Identity](/info/content-credentials-identity.html).
- **Memeriksa file.** Lolly juga memverifikasi kredensialnya sendiri: jatuhkan file apa pun di [/verify](/verify) (atau jalankan `lolly validate <file>` di CLI) untuk laporan on-device - berjudul apakah file benar-benar dibuat dengan Lolly dan tidak berubah sejak itu. Tampilan Verify web membaca jauh melampaui kredensial: menandai **konten hasil AI**, mendeteksi **Lolly Imprint**, memeriksa tanda tangan **SEAL** dan (opsional) watermark piksel pihak ketiga serta menampilkan **data tersembunyi** - semua on-device, tidak ada yang diunggah. Lihat [Content Credentials Identity → Beyond the credential](/info/content-credentials-identity.html#beyond-the-credential-what-else-verify-shows).
- **Privasi.** Semuanya terjadi di perangkat Anda: kunci penandatanganan dibuat untuk ekspor tersebut dan tidak pernah meninggalkan peramban, tidak ada yang diunggah dan klaimnya hanya berisi apa yang sudah dibawa metadata provenans. Utilitas privasi (transformasi on-device pada file Anda *sendiri*) tidak pernah menambahkan kredensial, dan *Strip Hidden Data* akan menghapus manifes C2PA seperti metadata tersemat lainnya.
- **Interaksi.** Untuk PDF, Content Credentials dan **perlindungan kata sandi** (tingkat mana pun - lihat di atas) saling eksklusif (PDF terenkripsi tidak bisa membawa lampiran kredensial). Kredensial ditambahkan sebagai langkah terakhir di atas byte final - setelah penandaan DPI/EXIF/profil warna, metadata PDF/X dan tanda cetak.

## Di ponsel

Kontrol ekspor berada di balik tombol mengambang **Render**, yang membuka lembar **Export** - format, ukuran, salin, unduh dan berbagi yang sama, dibuat pas untuk sentuhan.

## Referensi format

Setiap id yang bisa dirender host, dikelompokkan. Ini juga menjadi nilai untuk parameter URL `format=` dan flag CLI `--export=` - lihat [URL Mode](/info/url-mode.html) dan [CLI](/info/cli.html). Sebuah tool hanya menawarkan subset yang dideklarasikan penulisnya, jadi pemilih selalu lebih pendek dari daftar ini.

| Jenis | Id |
|---|---|
| Raster | `png` · `jpg`/`jpeg` · `webp` · `avif` · `tiff` (RGB TIFF) · `cmyk-tiff` (Print TIFF) · `bmp` · `ico` |
| Vektor | `svg` · `svgz` (SVG ter-gzip) · `emf` · `wmf` · `eps` · `eps-cmyk` (EPS CMYK) · `dxf` (file potong) |
| Halaman & dokumen | `pdf` · `pdf-cmyk` (Print PDF) · `pptx` (PowerPoint) · `scorm` (paket kursus SCORM, sebuah zip) · `penpot` (file desain Penpot) · `docx` (Word) · `odt` (OpenDocument Text) |
| Gerak | `gif` · `apng` (PNG animasi) · `webp-anim` (WebP animasi) · `svg-anim` (SVG animasi) · `webm` · `mp4` |
| Audio | `wav` · `mp3` · `m4a` · `opus` |
| Teks & data | `html` · `md` · `txt` · `json` · `csv` · `ics` · `vcf` · `css` · `scss` · `gpl` (palet GIMP) |
| Bundel | `zip` |

Ada beberapa id lagi yang berasal dari **hook ekspor milik tool itu sendiri**, bukan dari jalur render bersama: `ase` (Adobe Swatch Exchange, dari Palette Lab), `exr` dan `hdr` (raster high-dynamic-range milik Darkroom) dan `ttf` / `otf` / `woff` (Font Convert). Cara memilih formatnya sama - pemilih, `format=`, `--export=` - hanya byte-nya yang dibuat oleh tool tersebut. Font Convert adalah satu-satunya pengecualian: ia mengubah file font yang Anda pasok sendiri, jadi tidak ada yang bisa dirender oleh URL polos.
