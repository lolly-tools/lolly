# Ekspor file

Anda sudah membuat sesuatu dan ia perlu meninggalkan Lolly: PNG untuk chat, PDF untuk percetakan, deck yang akan terus disunting rekan. Tekan **Export**, bagian kiri pil **Export | Save**. Pilih format di samping nama file, lalu tekan **Download**. File dibuat di perangkat Anda.

Apa yang Anda lihat di kanvas adalah isi file. Menu format hanya mencantumkan apa yang dapat dibuat alat ini di browser ini.

Untuk sebagian besar pekerjaan, salah satu dari tiga format tepat:

| For | Choose | Because |
|---|---|---|
| Layar, pesan, atau slide | **PNG** | Semua aplikasi dapat membukanya, dan tetap mempertahankan latar belakang transparan jika tool menyediakannya |
| Halaman jadi, atau apa pun yang dicetak | **PDF** | Ukuran halaman sebenarnya yang tercetak persis seperti tampilannya; **Print PDF**, jika disediakan sebuah tool, adalah versi CMYK untuk percetakan |
| Karya seni yang harus tetap tajam pada ukuran berapa pun | **SVG** | Bentuk vektor, tajam mulai dari lencana hingga spanduk |

::: check Periksa file pada ukuran yang akan digunakan
Sebelum Anda mengirimkannya, buka di layar yang menjadi tujuannya, atau cetak pada ukuran aslinya.
:::

::: details Persetujuan dan pengiriman dengan Lolly Work (opsional)
[Organisasi yang menjalankan Lolly Work](/info/organisation.html) dapat mengatur format dan pengaturan ekspor mana yang dilihat anggotanya. Bila persetujuan diperlukan, **Request approval** menggantikan **Download**. Ikuti kebijakan yang ditampilkan instans Anda.

Lolly Work juga dapat mengirim file ke tujuan S3, WebDAV, dan HTTP yang dikonfigurasi, dengan langkah persetujuan, tanda terima pengiriman, dan catatan audit. Mengajukan file untuk alur kerja itu mengirimnya ke layanan organisasi; unduhan biasa tetap di perangkat Anda. Tujuan Send pribadi dan pengiriman organisasi dikonfigurasi secara terpisah.

Operator menyiapkan ini dengan [organisation delivery guide](/info/work-delivery.html). Untuk render dan batch server yang diantre, lihat [CLI batch and automation](/info/cli-automation.html#organisation-jobs-with-lolly-work).
:::

## Cara kerja ekspor

Saat Anda mengekspor, kanvas alat dirender ke format yang Anda pilih dan diserahkan kepada Anda sebagai unduhan, atau ditaruh di clipboard.

Tiga jalur menghasilkan file. Sebagian besar alat **merender kanvas**. Format teks dan data (HTML, Markdown, TXT, JSON, CSV, ICS, VCF) **dihasilkan dari konten alat**, bukan digambar dari gambar. Utilitas privasi seperti *Strip Hidden Data* **mentransformasi file yang Anda pilih**, di perangkat Anda, dan mengembalikannya tanpa kanvas, watermark, atau metadata tambahan, karena sudah merupakan file Anda sendiri.

![Tiga jalur ekspor bertemu pada file jadi: render kanvas, hasilkan teks atau data dari konten, atau transformasi file terpilih di perangkat.](/info/diagrams/concepts/three-export-paths.svg)

Panel ekspor menawarkan aksi-aksi ini. Pembuat alat memilih mana yang muncul; set default adalah Copy, Download, dan Save.

- <!--i:download--> **Download** menyimpan file. Jika Anda tidak dapat menemukannya sesudahnya, lihat [Find a file you downloaded](/info/find-your-work.html#find-a-file-you-downloaded).
- <!--i:photos--> **Copy** menaruh gambar di clipboard Anda, siap ditempel ke chat, email, atau dokumen. Bila browser tidak dapat menyalin gambar, ia mengunduh sebagai gantinya dan memberi tahu Anda.
- <!--i:folder--> **Save** menyimpan desain saat ini di Projects dengan satu klik dan tidak pernah mengunduh file. **Save as**, di samping **Download**, menanyakan tujuannya (lihat [Saving and continuing](/info/using.html#saving-continuing)).
- <!--i:link--> **Share** membuka dialog Share: tautan yang mereproduksi desain, sakelar saat kunjungan (layar penuh, panel ekspor, unduh atau salin saat dibuka), dan **Shortest link** opsional yang memadatkan seluruh status menjadi token ringkas (lihat [URL Mode](/info/url-mode.html)).

![Panel ekspor - format, ukuran, dan aksi Copy / Download / Save / Share](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&walker=1&dark=1&filename=export-panel)

Bila desain menyematkan render alat lain, seperti kotak gambar Design yang memuat tautan QR Code, render bersarang itu digambar ke dalam ekspor induk. Ia tetap vektor sejati di SVG dan PDF dan dirasterisasi dengan tajam di PNG, JPG, dan WebP. Render yang disematkan tidak mendapat watermark dan tidak ada provenansi sendiri; hanya file jadi yang mendapatkannya. Ekspor HTML, Markdown, dan TXT tidak dapat memuat render gabungan.

## Pilih format

Nama file dan menu format berada bersama sebagai satu pasangan `name.format`, di bawah **Unduh**.

![Bidang nama file menyatu dengan pemilih format, sehingga ekspor terbaca sebagai satu pasangan name.format](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.filename-extension&walker=1&dark=1&filename=exp-format-picker)

Mulai dari ke mana file akan pergi. Setiap kartu mencantumkan format yang cocok untuk tujuan itu; alat hanya menampilkan yang dapat dibuatnya.

::: figure exporting-format-chooser
Enam tujuan dan format yang cocok untuk masing-masing.
:::

Wordmark yang diset dengan huruf design system Anda diekspor sebagai SVG dengan setiap huruf sebagai path kontur, sehingga satu file tetap tajam pada ukuran kartu nama dan pada ukuran pembungkus gedung.

![Wordmark bertebar lebar setipis rambut bertuliskan Aurora, jenis karya vektor murni yang dibahas baris SVG pada tabel](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DAurora%26weight%3D200%26tracking%3D16%26size%3D200%26full&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=%23tool-canvas&walker=1&format=svg&filename=vt-wordmark-vector)

::: details Setiap format dan kegunaannya
| Anda ingin | Gunakan | Mengapa |
|---|---|---|
| Logo atau karya tajam yang dapat diskalakan | **SVG** | Vektor: dapat diskalakan, kecil, dan dapat disunting; efek yang tidak dapat digambar ekspor vektor disematkan sebagai gambar |
| Vektor untuk aplikasi Office dan Windows | **EMF** | Ditempel sebagai vektor yang dapat disunting ke PowerPoint dan Word, dengan teks hidup; Google Drive membukanya di Google Drawings |
| Vektor untuk cetak dan aplikasi desain | **EPS**, atau **EPS (CMYK)** | Vektor PostScript untuk Illustrator dan alur kerja percetakan |
| Vektor untuk mesin potong | **DXF** | Pemotong laser, plotter vinil, dan CNC: path kontur dalam milimeter |
| Deck slide yang dapat disunting | **PowerPoint** (PPTX) | Teks dan bentuk native yang dapat disunting, dengan gambar dan vektor tetap dapat diekstrak |
| Dokumen teks yang dapat disunting | **Word** (DOCX) atau **OpenDocument** (ODT) | Paragraf dan judul nyata yang dapat terus disunting pengolah kata (Doc Studio) |
| Tata letak untuk InDesign | **InDesign IDML (static subset)** | Teks, persegi panjang, oval, dan gambar, satu spread per artboard (Design) |
| Dokumen Penpot yang dapat disunting | **Penpot** | Board, bentuk, teks, dan token tertaut |
| Foto atau gambar serbaguna | **PNG** (lossless) atau **JPG** (lebih kecil) | Raster universal |
| Gambar modern yang lebih kecil | **WebP** atau **AVIF** | Kompresi lebih baik, dengan transparansi |
| Cetak | **PDF**, atau **Print PDF** (CMYK) | Ukuran halaman sebenarnya; CMYK untuk mesin cetak |
| Raster cetak untuk mesin cetak | **Print TIFF** (CMYK) | Piksel DeviceCMYK untuk RIP |
| Animasi untuk web | **GIF** | Diputar di mana-mana; file lebih besar |
| Animasi dengan warna penuh dan transparansi nyata | **APNG** | PNG animasi: tanpa batas palet |
| Animasi, file terkecil | **Animated WebP** | Warna penuh dan transparansi, lebih kecil dari GIF atau APNG |
| Vektor animasi yang dapat diskalakan | **Animated SVG** | Mandiri; berulang di browser atau `<img>`, pada ukuran apa pun (Lottie Ad) |
| Animasi yang tetap dapat disunting | **dotLottie** | Bentuk, path, dan kunci transformasi luar dari garis waktu Design |
| Serah terima Premiere | **Premiere XML + media** | Klip bertempo dan media asli untuk Premiere (Design) |
| Video untuk sosial dan berbagi | **MP4** atau **WebM** | Kualitas terbaik untuk ukuran file (lihat [Video](#video)) |
| Teks keterangan | **SRT** atau **VTT** | Teks bertempo untuk pemutar video (Captions, Audiogram, dan Record) |
| Kursus pelatihan | **SCORM (LMS)** | Situs web berversi, paket SCORM atau xAPI (lihat [SCORM](#scorm-course-packages)) |
| Teks kaya atau tanda tangan email | **HTML** | Ditempel berformat ke klien email |
| Konten polos | **MD** atau **TXT** | Hanya teks |
| Acara kalender | **ICS** | Diimpor ke aplikasi kalender mana pun |
| Kartu kontak | **VCF** | Diimpor ke buku alamat |
| Data terstruktur untuk diimpor ulang | **JSON** atau **CSV** | Bolak-balik konten alat |
| Favicon | **ICO** | Ikon situs multi-ukuran; **ZIP** mengemas beberapa format |
:::

### Transparansi

Alat yang mendukungnya menawarkan sakelar latar transparan, seperti **No BG**. PNG, WebP, AVIF, SVG, APNG, dan Animated WebP mempertahankan transparansi, dan GIF mempertahankan tepi keras. JPG dan PDF selalu buram. TIFF diratakan ke putih, atau ke hitam pada jalur HDR yang dijelaskan di bawah [HDR](#hdr-bright-colours).

## Ukuran dan satuan cetak

Ekspor memakai ukuran piksel asli alat kecuali alat menawarkan **dimensions**. Maka Anda menetapkan lebar, tinggi, dan **unit**:

- **px** (default) adalah piksel persis.
- **mm, cm, in, pt**, dan **pc** adalah ukuran fisik. Dengan satuan fisik Anda juga menetapkan **DPI** (default 300). **PDF** menjadi halaman sebenarnya pada ukuran itu, **raster** mendapat jumlah piksel untuk DPI tersebut dan mencatat resolusinya, dan **SVG** mempertahankan satuan fisik dengan viewBox piksel.

Untuk raster beresolusi lebih tinggi, masukkan lebar dan tinggi yang lebih besar, atau pilih satuan fisik dan naikkan DPI (piksel = ukuran × DPI). Lebar `210`, tinggi `297`, dan satuan `mm` menghasilkan halaman A4.

![Baris dimensi diatur ke 210 kali 297 mm, dengan bidang DPI terlihat karena unitnya fisik](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26w%3D210%26h%3D297%26unit%3Dmm%26format%3Dpdf%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-dims&walker=1&dark=1&filename=exp-export-dims)

## Gambar diam dari komposisi berwaktu

Komposisi bertempo, seperti garis waktu [Sequence](/info/sequence-editor.html) di Design, bergerak, jadi ekspor diam harus memilih satu momen: **bingkai pada playhead**. Letakkan playhead di tempat Anda menginginkan gambar dan ekspor.

Untuk lebih dari satu momen, field **Frames** muncul di samping ukuran keluaran. Ia hanya tampil untuk komposisi bertempo dan format diam (PNG, JPG, WebP, SVG, atau PDF). Biarkan `1` untuk bingkai playhead. Naikkan dan Anda mendapatkan sebanyak itu gambar diam, tersebar merata di seluruh sekuens:

- PNG, JPG, WebP, dan SVG kembali sebagai satu ZIP: `<name>-01.png`, `-02.png`, dan seterusnya.
- PDF kembali sebagai satu dokumen dengan sebanyak itu halaman.

Setiap gambar diam diambil dari tengah potongan garis waktunya, jadi bingkai pertama tidak pernah berupa pemunculan yang setengah memudar dan yang terakhir tidak pernah momen kosong setelah semua klip berakhir.

::: figure exporting-contact-sheet
Frames: 4 memotong sekuens menjadi empat bagian sama dan mengambil bagian tengah tiap bagian.
:::

Gunakan untuk storyboard, contact sheet tinjauan, atau karusel sosial yang dipotong dari suntingan video. Jumlahnya dibatasi 64, dan apa pun lain yang diketik di field kembali ke `1`. Setiap bingkai adalah gambar diam biasa, jadi kredensial, Imprint, satuan fisik, dan DPI berperilaku seperti pada satu ekspor. Tautan ekspor, CLI, dan MCP meminta lembar yang sama dengan `cuts=` (lihat [Contact sheets](/info/url-export.html#contact-sheets)).

## Banyak file sekaligus

Lolly memiliki tiga cara bekerja dalam volume, masing-masing untuk pekerjaan berbeda:

::: cols
## Tabel menjadi satu dokumen
Alat dengan input tabel, seperti **Battlecards**, mengubah setiap baris menjadi halaman. Tempel tabel dari spreadsheet Anda dan dapatkan satu PDF. Perbaiki baris di spreadsheet dan tempel lagi.
## CSV menjadi satu file per baris
**Batch** (`#/batch`) menerima CSV dan merender satu ekspor untuk setiap baris: tanda pengenal atau sertifikat, satu file masing-masing, dikirim dalam ZIP. Lihat [Batch](/info/batch.html#make-many-versions-of-one-design).
## Beberapa desain mendapat satu suntingan
**Multi-edit** membuka beberapa sesi tersimpan berdampingan untuk sentuhan akhir yang sama di berbagai desain. Lihat [Multi-edit](/info/batch.html#edit-several-saved-designs-together).
:::

Dari **Projects**, **Render folder** mengekspor setiap sesi tersimpan dalam folder dan sub-foldernya sebagai satu ZIP bersarang, dan **Render selection** melakukan hal yang sama untuk multi-pilihan mana pun; satu sesi tersimpan dirender ke file-nya sendiri. Sesi tersimpan juga dapat dibagikan lagi sebagai tautan alat dari Projects, yang membukanya kembali dengan pengaturan yang sama.

## File yang tetap dapat disunting di tempat lain

Beberapa format menyerahkan karya Anda ke aplikasi lain sebagai konten yang dapat disunting, bukan gambar.

### PowerPoint (PPTX)

Design, Markdown Slides, Booklet, Doc Studio, Chart, Diagrams, Flow Chart, dan Agenda mengekspor deck PowerPoint, satu slide per halaman. Setiap halaman dibongkar menjadi objek native, sehingga rekan dapat menyunting deck dan mengambil aset darinya:

- <!--i:font--> **Teks** menjadi kotak teks PowerPoint yang dapat disunting dengan ukuran font, warna, ketebalan, italic, dan perataan tata letak.
- <!--i:pentool--> **Vektor** seperti logo dan ikon disematkan sebagai gambar SVG; tetap tajam, dan PowerPoint dapat *Convert to Shape* padanya.
- <!--i:photos--> **Gambar** datang dengan resolusi asli sebagai gambar tersendiri. Hero yang dipotong mempertahankan gambar penuh di balik potongan, dan filter atau blend padanya dipanggang masuk.
- <!--i:layers--> **Latar, batas, dan garis** menjadi bentuk persegi panjang dan garis.

![Panel ekspor dengan PowerPoint dipilih: satu slide per halaman, teks dan bentuk tetap dapat diedit](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio%3Foptions&width=1440&height=900&dpi=192&waitMs=2500&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22pptx%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-pptx)

Tata letak bersifat perkiraan; tujuannya konten yang dapat dipakai ulang. Apa pun yang tidak dapat dinyatakan walker secara native, seperti area berfilter atau bermasker yang rumit, disematkan sebagai gambar agar tidak ada yang hilang. Deck memiliki satu ukuran slide, diambil dari halaman pertama.

PowerPoint juga jalan masuk: [Rebrand a deck](/info/rebrand.html) memindahkan deck ke design system Anda, dan [Import a design](/info/design-import.html) membukanya di Design.

### Penpot

Sebagian besar alat yang mengekspor SVG juga mengekspor **file Penpot** (`.penpot`), siap disunting terus di Penpot.

| Yang Anda buat | Di Penpot |
|---|---|
| Teks | Objek teks yang dapat disunting: perbaiki salah ketik atau ubah gayanya |
| Bentuk, path, gradien, dan gambar | Bentuk vektor yang dapat disunting masing-masing |
| Warna atau font dari token design system | Tautan token hidup: sunting token dan setiap bentuk yang mewarisinya mengikuti |
| Seluruh desain | Komponen yang dapat dipakai ulang di panel Assets |
| Ilustrasi rumit atau kanvas hidup | Disematkan sendiri sebagai gambar, konten yang dapat disunting di sekitarnya tidak tersentuh |

Dari Design, setiap bingkai menjadi board Penpot. Warna dan tipografi design system masuk ke panel Assets dan set tokennya yang lengkap ke panel Tokens. Penpot menyimpan salinannya sendiri dari sana: token yang disunting di Penpot kembali melalui impor di [Design System Setup](/info/brand-studio.html).

![Panel ekspor dengan Penpot dipilih: file .penpot, dan Send to Penpot di samping unduhan](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22penpot%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-penpot)

Untuk membuka file, mulai Penpot, pilih proyek, dan pilih **Import**. Bila login ke Penpot dari panel ekspor, **Send to Penpot** melakukan langkah itu untuk Anda.

### Word, OpenDocument, dan InDesign

**Doc Studio** mengekspor **Word** (DOCX) dan **OpenDocument** (ODT) dengan paragraf dan judul nyata.

**Design** mengekspor **InDesign IDML (static subset)**: teks, persegi panjang, oval, dan gambar PNG atau JPEG, satu spread per artboard. Pemformatan inline yang didukung tetap dapat disunting, gambar ikut dalam `Links`, dan koordinat menjadi poin InDesign. Penautan ulang, penggantian font, dan pembungkusan yang berubah mungkin perlu diperhatikan. Efek, animasi, cerita gabungan, dan geometri yang tidak didukung menghentikan ekspor dengan laporan yang mencantumkannya. IDML tidak mempertahankan dokumen asli, jadi kirim PDF untuk karya jadi.

### Garis waktu: dotLottie dan Premiere

Dari garis waktu Design, **dotLottie** menulis animasi yang tetap dapat disunting di alat Lottie; [Lottie animations](/info/sequence-editor.html#lottie-animations) mencantumkan apa yang dipertahankannya. **Premiere XML + media** mengemas klip bertempo dan media aslinya untuk Premiere; lihat [Premiere XML exchange](/info/sequence-editor.html#premiere-xml-exchange).

### SCORM (paket kursus)

Ekspor kursus mati sampai Anda mengaktifkan **Training and courses** di Settings → Preferences → Feature flags.

Lalu pilih **Export course** dari alat yang didukung, folder proyek, atau pilihan. Di Design, memilih **SCORM (LMS)** dan **Download** membuka alur kerja kursus yang sama. Lolly menyimpan pekerjaan, memungkinkan Anda meninjau konten dan urutan kursus, lalu membuka modul dan dialog ekspornya.

- <!--i:layers--> Pilih rendisi untuk setiap sumber: halaman diam, gerak sebagai video, audio, atau sumber daya yang dapat diunduh. Tambahkan teks pelajaran dan alternatif bacaan di modul.
- <!--i:clock--> Pratinjau pemutar pelajar dan tinjau deskripsi serta teks keterangan. Gerak disertakan sebagai video, termasuk animasi senyap.
- <!--i:document--> Pilih target Website, SCORM 1.2, SCORM 2004 4th Edition, atau xAPI eksperimental. Periksa konten dan ukuran ZIP, lalu simpan dan unduh versi yang telah diperiksa.
- <!--i:check--> Penyelesaian mensyaratkan pengakuan atas setiap pelajaran wajib dan memilih Finish.

![Panel ekspor pada sebuah deck Design dengan SCORM (LMS) dipilih](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour%26format%3Dscorm%26options&width=1440&height=900&dpi=192&waitMs=3500&css=.fc-insp%7Bdisplay%3Anone!important%7D.edge-dock-slot--fill%7Bflex%3A1%201%20auto!important%3Bheight%3Aauto!important%3Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D.export-popup.is-floating%7Bheight%3Aauto!important%7D.export-popup-body%7Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D&drive=click:.edge-dock-tab%3Ahas-text%28%22Export%22%29;wait:600&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-scorm)

Paket menyimpan konten jadinya dan tidak memerlukan akun Lolly. Taruh ZIP Website di host HTTP(S); impor ZIP LMS tanpa diubah. Uji tujuan sebelum membagikan kursus. Untuk kursus yang dibangun dari beberapa karya tersimpan, lihat [Create a training course](/info/training-creators.html).

### DXF (file potong)

Asset Export, Diagrams, Growth, Logo Wall, QR Code, Street Map, Wayfinding, dan Wordmark mengekspor **DXF**, format pertukaran AutoCAD R12 yang dibaca pemotong laser, plotter vinil, dan perangkat lunak CNC. Geometri ditulis sebagai path kontur dalam milimeter, teks dikonturkan, dan warna dipetakan ke AutoCAD Color Index terdekat, yang biasanya menentukan operasi pemotong. DXF hanya seni garis: area fotografis atau berfilter tidak memiliki path potong dan dibuang, dengan peringatan. Gunakan SVG atau PDF untuk mempertahankan konten raster.

Street Map adalah kasus paling jelas. Seluruh desainnya sudah berupa goresan, jadi setiap jalan dan kanal menjadi path potong.

::: showcase
![Render Street Map Paris dalam tinta di atas krem - line art murni, sehingga setiap stroke selamat sampai ke mesin pemotong](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Dparis%26roadColor%3D1a1a2e%26waterColor%3D93c5fd%26background%3Dfaf7f2%26full&width=1440&height=900&dpi=96&waitMs=3200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-street-map-cut)

Gulir, dan kamera mundur menembus geometri sebenarnya: tujuh path, tidak ada piksel di mana pun, setiap stroke tetap tajam sehalus rambut pada zoom berapa pun. Itulah file yang sama yang dibaca oleh mesin pemotong.
:::

## Cetak

**Print PDF** menulis CMYK terhadap kondisi cetak bernama, **Coated FOGRA39** secara default. Swatch brand dengan nilai tinta terukur dikonversi persis; warna lain memakai konversi perangkat standar. **Print TIFF** menulis piksel DeviceCMYK untuk RIP dan mencatat kondisi cetak yang sama dalam metadata TIFF-nya. Kontrol Colour profile menggerakkan keduanya; [Colour profiles](#colour-profiles) memuat detailnya.

**Print marks & bleed** memiliki kartu sendiri pada format cetak: bleed dalam milimeter ditambah detail Crop, Registration, Bleed, Colour bars, dan Stamp.

Beberapa alat membangun **PDF multi-halaman**: sampul, konten yang mengalir ke sebanyak halaman yang dibutuhkan, dan halaman belakang, seperti pada alat *Booklet*. Setiap halaman adalah halaman PDF potret sejati dalam A4, US Letter, atau A5, dan Anda dapat memaksa blok mana pun ke halaman baru. Ini adalah dokumen RGB tanpa tanda potong atau bleed, yang merupakan milik Print PDF satu halaman. PDF Design juga dapat berupa **Notes handout**: halaman potret untuk setiap slide dengan catatan pembicaranya di bawah.

**Before you export.** Kartu **Before you export** di dasar panel menyatakan apa yang akan dilihat percetakan: format, ukuran dan bleed, area trim dan bleed, cakupan tinta, jumlah plat, dan jumlah halaman, dengan vonis di samping judulnya. Ia tidak pernah memblokir ekspor. Design selalu menampilkan kartu dengan pemeriksaannya sendiri, termasuk aturan baku design system layer demi layer dan sinyal tulisan untuk teks dokumen ([Before you export](/info/design.html#before-you-export)), dan menambahkan pemeriksaan cetak ini bila **Print preflight** aktif. Pada alat lain, aktifkan **Print preflight** di Settings → Preferences → Feature flags; ia mati secara default, dan deployment Lolly Work dapat mengaktifkannya untuk anggotanya.

**After you export.** Setelah file siap, Lolly membacanya kembali dan membandingkannya dengan pilihan Anda: format, ukuran piksel atau halaman, panjang klip, latar transparan, warna CMYK, HDR, Content Credentials, dan kata sandi PDF atau ZIP. Apa pun yang berbeda ditulis di kartu ekspor. Setiap pengukuran berasal dari file, tidak pernah dari pengaturan, dan properti yang tidak dapat dijawab file tidak dihitung sebagai cocok. Baris perintah menulis perbandingan lengkap dengan `--export-report` (lihat [Render with the CLI](/info/cli-rendering.html)).

Pemeriksaan inspector Design dan perbandingan brand di Design System Setup adalah pemeriksaan terpisah: mereka melihat desain, sementara kedua kartu ini melihat file.

::: details Biaya dari kartu tarif
Di bawah preflight, kartu biaya mengubah hitungan yang sama menjadi uang, hanya dengan harga yang diberikan seseorang. Ia membaca hitungan itu bahkan saat kartu preflight sendiri mati. Ia memerlukan dua hal: pekerjaan yang dapat dihargai daftar harga (plat, lembar, luas, halaman, baris varian, atau file keluaran, jadi PNG logo biasa tidak pernah menampilkannya) dan **rate card**, daftar harga JSON dari percetakan Anda. Build default tidak membawa satu pun dan tidak ada cara memuatnya di aplikasi. Rate card tiba sebagai aset katalog yang dikirim deployment, atau melalui ekstensi rate-card opsional yang dinyalakan pengelola sendiri atau control plane. Tanpa rate card, tidak ada yang ditampilkan.

Setiap angka adalah tarif yang Anda berikan dikali kuantitas yang dihitung Lolly, seperti `4 plate × €35.00`, dan totalnya membawa sumbernya: penerbit pada kartu dan tanggal tarif itu berasal. Tidak ada mata uang default dan tidak ada harga placeholder. Apa yang dikatakan file tentang dirinya sendiri tetap berupa kutipan tidak langsung: *"The file says: … Lolly has not verified this."*

Bila angka tidak dapat dihitung, tabel ditarik alih-alih diisi:

- Baris yang tidak dihargai kartu berarti **tidak ada total sama sekali**, hanya judul yang menyatakan berapa yang belum berharga.
- Kuantitas yang merupakan batas atas membawa **"up to"** ke subtotalnya.
- Tarif yang melewati tanggal berlakunya hanya menampilkan **counts only** sampai Anda menekan *Use these rates anyway*; tanggal kedaluwarsa kemudian ikut bersama angka.
- Bila dibuka melalui **tautan**, uang tetap tersembunyi sampai Anda memintanya di perangkat ini. CLI menerima `--rate-card=<file.json>` sebagai file lokal dan tidak pernah sebagai parameter tautan.

Kartu dibuang dari setiap tahap ekspor, jadi tidak pernah mengubah file. Ini aritmetika, bukan penawaran; hanya percetakan Anda yang dapat menawarkan.
:::

## Gerak dan suara

### Video

Alat beranimasi mengekspor **MP4** dan **WebM**. Pemilih hanya menampilkan kontainer yang dapat dibuat browser ini, dan tautan `?format=` bersama yang meminta kontainer yang tidak dapat dibuat beralih ke yang lain, dengan nama file yang sesuai. Alat beranimasi juga menawarkan **Start after**, yang menahan kanvas diam sesaat agar animasi dan font stabil sebelum merekam, dan **Duration**, panjang klip jadi. **Motion blur** (Off, Draft quality, Standard, atau High, dengan **Shutter angle**) mengaburkan gerakan cepat dengan biaya waktu render. Bila browser mendukungnya, **Record live** merekam pratinjau di layar secara waktu nyata melalui berbagi layar sebagai gantinya.

![Pengaturan waktu untuk ekspor beranimasi: Start after, Duration, Motion blur dengan Shutter angle-nya, dan Record live](/t/url-shot?url=%2F%23%2Ftool%2Flottie-digi-ad%3Fformat%3Dmp4%26options&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=.video-params&walker=1&format=svg&dark=1&filename=exp-video-settings)

**Quality** memilih Smaller file, Balanced, atau Best quality. **Advanced** membuka **Codec**, **Frame rate**, **Rate mode**, dan **Hardware acceleration**. Bila alat memiliki teks keterangan, **Captions** memilih **Embedded track** atau **Sidecar .vtt + .srt** di samping video. Tautan membawa kualitas, codec, frame rate, durasi, dan jeda mulai sebagai `vq`, `codec`, `fps`, `seconds`, dan `wait` ([URL parameters](/info/url-parameters.html)).

Ekspor video mempertahankan suaranya. Alat dapat menaruh **music bed** di bawah klip: aset audio yang diulang atau dipotong sepanjang klip, dengan fade, volume, dan ducking di bawah suara rekaman itu sendiri. Alat perekam membawa audio langsungnya ke file.

Deck Design yang tetap berupa deck klik masih dapat keluar sebagai video. **Export slides as video** di menu Present membuka lembar ekspor pada MP4. Setiap slide diputar selama dwell-nya sendiri, atau selama Duration lembar ekspor bila tidak punya, dan transisi slide deck diputar di antaranya sebagai dissolve. Dokumennya sendiri tidak berubah.

### Gambar animasi

**GIF** diputar di mana-mana dan cocok untuk chat dan email; ukurannya lebih besar dan warnanya lebih sedikit daripada video. **APNG** dan **Animated WebP** mempertahankan warna penuh dan transparansi. **Lottie Ad** juga mengekspor **Animated SVG**: bingkai vektor dengan keyframe CSS tersemat, sehingga dapat diskalakan ke ukuran apa pun dan berulang di tab browser atau `<img>` tanpa codec. Teksnya dikonturkan, dan memakai frame rate default yang lebih rendah karena setiap bingkai lebih berat daripada bitmap. Semuanya senyap.

### Audio

Beberapa alat mengekspor suara saja. **Voice Recorder** merekam rekaman mikrofon dengan pengukur level langsung dan menyimpannya sebagai **MP3**, **WAV**, **M4A (AAC)**, atau **Opus (WebM)**, dienkode di perangkat Anda. `wav`, `mp3`, `m4a`, dan `opus` adalah id format biasa, jadi ekspor audio sama mudah dibagikan dan diskrip seperti PNG.

Pemilih aset menerima beragam audio untuk music bed, dari MP3 dan FLAC hingga MIDI dan modul tracker; [Formats](/info/formats.html) mencantumkannya. [Lagu Rondocode](/info/rondocode.html) diputar pada panjang berapa pun yang diminta kliknya.

## Warna dan HDR

Lolly membaca setiap warna CSS modern, melakukan matematika warna secara perseptual, dan menulis setiap file dalam ruang yang dapat dibuka pembaca: sRGB untuk layar, CMYK untuk cetak, dan Rec.2100 PQ untuk HDR. [Colour in the engine](/info/colour-engine.html) menjelaskan caranya. Dokumen Design yang diatur ke **Wide colour / HDR** mengikuti aturannya sendiri, dijelaskan di [Wide colour and HDR editing](/info/hdr-editing.html).

### Profil warna

Ekspor ditandai dengan profil warna, sehingga aplikasi yang terkelola warna seperti percetakan, Photoshop, dan browser membaca warna seperti yang Anda lihat. Ini terjadi otomatis; thumbnail dan pratinjau melewati tag agar tetap kecil.

- **PNG dan JPG** membawa profil ICC **sRGB** tersemat, ruang tempat pratinjau digambar. Piksel ditandai, bukan dienkode ulang.
- **Print PDF (CMYK)** mendeklarasikan kondisi cetaknya di *OutputIntent*, memberi tahu percetakan bagaimana tinta CMYK-nya dimaksudkan untuk dibaca.
- **Print TIFF (CMYK)** menulis piksel DeviceCMYK tanpa tag dan mencatat kondisi cetak di metadata TIFF-nya. TIFF tidak dapat menyematkan profil cetak, jadi baris **Embed** hanya mencatat nama profil itu.
- **TIFF (RGB)** adalah saudara sRGB tanpa kompresi untuk arsip atau bolak-balik editor. Ia meratakan transparansi ke putih. Kedua TIFF hanya untuk desktop, karena browser tidak dapat mempratinjau TIFF.
- **SVG**, **EMF**, **EPS**, dan **DXF** adalah vektor tanpa profil tersemat: warna SVG adalah sRGB, EMF dan EPS memakai RGB perangkat, **EPS (CMYK)** menulis DeviceCMYK, dan DXF memakai AutoCAD Color Index. SVG, EPS, dan DXF mengonturkan teks menjadi path. EMF mempertahankan teks hidup dan dapat disunting di Office dan Google Slides, kembali ke kontur hanya untuk run yang tidak dapat dinyatakan format; opsi **Outline fonts** pada panel ekspor memaksa path di mana-mana. SVG juga mereproduksi bayangan kotak CSS, di dalam dan di luar.

::: details PDF/X-4 dan profil cetak Anda sendiri
Tidak ada profil CMYK yang dikirim bersama Lolly. Kondisi cetak bernama menulis output intent tanpa mengklaim kesesuaian PDF/X-4, karena PDF/X-4 menghendaki profil disematkan.

Muat profil CMYK Anda sendiri dan pilih baris **Embed**-nya di kontrol Colour profile. Ia disematkan sebagai *DestOutputProfile* file, dan PDF mengklaim PDF/X-4 selama sisa file mengizinkan. Kondisi cetak yang dideklarasikannya dibaca dari profil itu: nama terdaftar bila profil membuktikannya, atau `Custom` di bawah nama profil sendiri.

Tiga hal menahan klaim sambil mempertahankan output intent: karya RGB yang tidak dapat dikonversi oleh proses CMYK, teks kredit proof-margin `prov` (digambar dalam font standar yang tidak disematkan), dan kata sandi **Strong**, karena PDF/X-4 melarang enkripsi. Setiap PDF juga membawa metadata PDF/X-4: kotak halaman, XMP, ID dokumen, dan output intent sRGB beserta profilnya.
:::

### HDR (warna cerah)

Ini adalah kartu **HDR** panel ekspor, yang mencerahkan karya biasa untuk layar HDR. Mempertahankan aslinya yang HDR selama penyuntingan adalah fitur lain: [Wide colour and HDR editing](/info/hdr-editing.html).

Ekspor biasa adalah sRGB: warna brand yang jenuh secerah putih normal layar. Layar HDR memiliki ruang di atas itu. Kartu **HDR** mendorong warna brand dan teks putih Anda menuju kecerahan puncak, sementara area gelap tetap gelap dan memberi kontras pada cahayanya.

![Kartu HDR di panel ekspor, dinyalakan, dengan dial White / Reach / Dark lift / Focus terungkap di bawahnya](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26hdr%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-hdr&walker=1&dark=1&filename=exp-hdr-card)

- **Format.** PNG, JPG, AVIF, dan TIFF. WebP adalah 8-bit tanpa jalur dekode HDR yang berfungsi, dan vektor serta PDF tidak memiliki model HDR.
- **Mati secara default**, karena mengubah piksel. Centang kartu, atau berikan `hdr=1` di tautan berbagi.
- **Dial.** **White** (batas kecerahan puncak, 400 hingga 2000 nit), **Reach** (seberapa jauh ke bawah nada cahaya menyebar), **Dark lift** (seberapa banyak bagian gelap dicerahkan; `0` mempertahankannya gelap), dan **Focus** (seberapa banyak kekayaan warna yang dipertahankan dorongan). Semuanya ikut sebagai satu nilai: `hdr=1600-60-0-50` adalah White 1600, Reach 60, Dark lift 0, dan Focus 50.
- **Apa yang ditulis.** PNG mendapat Rec.2100 PQ 16-bit dengan chunk `cICP`. JPG adalah JPEG gain-map ISO 21496-1: gambar SDR biasa ditambah gain map yang ditambahkan. AVIF mendapat kotak `colr` yang ditulis ulang. TIFF mendapat piksel PQ dengan profil ICC v4 yang dihasilkan membawa tag `cicp`, dan diratakan ke hitam, karena putih adalah kode 10.000 nit dalam PQ dan akan membuat halo di setiap tepi. Dorongan mengikuti kecerahan perseptual (OKLab) dan mempertahankan hue, jadi hijau brand menjadi lebih cerah, bukan seperti mint.
- **Di mana cahayanya tampak.** Penampil terkelola warna pada layar HDR: Preview, Quick Look, dan Safari di perangkat Apple, atau Chrome di monitor HDR. Layar SDR menampilkan gambar normal.
- **Sebelum Anda mengirim.** Banyak platform mengenkode ulang unggahan dan membuang sinyal HDR, yang dapat membuat gambar gelap atau pucat. Gunakan HDR di tempat Anda mengendalikan tujuannya, seperti situs Anda sendiri, video wall, atau deck pada panel terang.
- **Dari terminal.** `--hdr=1` dengan `--export=png` atau `--export=jpg` menulis PNG dan JPEG gain-map yang sama di [CLI](/info/cli.html), dari encoder engine yang sama, tanpa browser di jalurnya. AVIF dan TIFF tetap ekspor web untuk saat ini.

## Apa yang ikut dengan file Anda

File jadi dapat membawa beberapa catatan di samping gambar. Sebagian berada di samping piksel dan hilang saat file disimpan ulang atau dilucuti; dua tanda hidup di dalam piksel itu sendiri.

::: figure exporting-what-travels
Di mana setiap catatan berada, apakah aktif secara default, dan parameter tautan mana yang mengendalikan masing-masing.
:::

Panel ekspor melipat **Licence**, **Source credits**, *Password protect*, **C2PA Credentials**, **Lolly Imprint**, dan **Durable credential** ke dalam satu grup **Content protection** yang hanya menampilkan kartu yang dapat dipakai format terpilih. Ia terbuka sendiri bila tautan atau dokumen sudah mendeklarasikan lisensi, atau bila sumber memerlukan keputusan dari Anda. Kartu **Design system** tetap di luar grup, terlihat pada setiap ekspor.

![Grup Content protection dibuka pada ekspor PNG, menampilkan hanya kartu yang berlaku untuknya](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26imprint%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-protection&dark=1&filename=exp-content-protection)

### Provenansi & watermark

Bila format memiliki fieldnya, ekspor membawa **metadata provenansi**: perangkat lunak, sumber, nama alat, dan baris kredit profil Anda, ditulis ke PNG iTXt, JPEG EXIF, info PDF, `<metadata>` SVG, atau komentar GIF. Ia hanya mencatat kepenulisan, dan tidak ada yang diunggah. Alat **Experimental** juga menstempel watermark yang terlihat, diterapkan oleh host sehingga menyunting alat tidak dapat menghapus tandanya.

**Lolly Imprint** adalah watermark piksel tak terlihat, **aktif secara default**. Kredensial dan metadata ikut di samping piksel dan hilang saat disimpan ulang, ditangkap layar, atau metadata dilucuti. Imprint hidup di piksel dan bertahan melewati kompresi ulang, sehingga salinan masih dapat dikenali sebagai buatan Lolly. Ini petunjuk, bukan jaminan kriptografis, dan tidak membawa data pribadi. Ia ikut dalam JPEG XL, PNG, JPG, WebP, AVIF, TIFF, dan BMP, dan dalam raster yang dirender Lolly ke PDF atau PPTX, tidak pernah dalam gambar yang Anda sematkan. Hapus centang **Lolly Imprint** atau berikan `imprint=0` untuk tidak menyertakan Imprint. Ketahanan AVIF melewati pengenkodean ulang belum dikalibrasi. [Verify](/verify) mendeteksinya di perangkat Anda; lihat [The Lolly Imprint](/info/what-verify-checks.html#the-lolly-imprint).

**Durable credential** menulis id Lolly ke dalam piksel dengan model neural di perangkat dalam format TrustMark, sehingga tautan "made with Lolly" bertahan melewati pelucutan metadata dan pengenkodean ulang dan dapat dibaca alat yang mengenal TrustMark. Ia **mati secara default**, karena memakan satu lintasan neural per ekspor dan unduhan model satu kali. Ia mencakup PNG, JPG, WebP, AVIF, dan TIFF; centang di panel atau berikan `durable=1`. Aplikasi desktop dan seluler menyembunyikan kartunya, karena tidak memiliki origin untuk mengambil model secara offline.

**Licence.** Pilih bagaimana orang lain boleh memakai karya Anda: *None (all rights reserved)* secara default, CC0 1.0, Public Domain Mark 1.0, atau lisensi Creative Commons 4.0 (BY, BY-SA, BY-NC, BY-NC-SA, BY-ND, BY-NC-ND). Nama lisensi dan tautan ke deed-nya masuk ke metadata lisensi file (EXIF, XMP, dan RIFF bila format memilikinya) dan Content Credential-nya. Pilihan disimpan bersama dokumen dan ikut dalam tautan sebagai `licence=`. Lolly menulis lisensi yang Anda pilih; ia tidak memeriksa atau menegakkan ketentuannya. Alat dengan field lisensi sendiri, seperti Claim, mempertahankan field itu.

### Catatan design system

Ekspor mencatat design system yang membuat file: namanya, versi terbit tempat file digambar (bila bukan versi kerja), dan [colourway](/info/colourways.html) tempat file digambar. Pilihan tema lain yang dideklarasikan design system, seperti kepadatan, dicatat dengan cara yang sama. Pilihan terang atau gelap tidak disertakan, karena gambar sudah menunjukkan yang mana yang dipakai.

**Anda melihat catatan sebelum apa pun ditulis.** Kartu **Design system**, tercentang secara default, menampilkan kata-kata persis yang akan dibawa file, seperti *Records: Acme · Colourway: Beach*, dan deskripsi sebagaimana akan terbaca. Nama design system adalah apa pun yang diketik pemiliknya, jadi kartu menampilkannya sebagaimana ditulis. Hapus centang kartu untuk tidak menyertakan catatan dalam ekspor itu. Panel dokumen Design mencantumkan kata-kata yang sama di bawah *Embedded in exports*.

**Deskripsi menyebut colourway di samping alat.** Dengan kartu tercentang, *"Made with https://lolly.tools : Chart"* menjadi *"Made with https://lolly.tools : Chart (Beach colourway)"*. Nama design system sendiri tetap di catatan, bukan di deskripsi. Deskripsi tanpa nama alat, atau yang ditulis alat dari inputnya sendiri, dibiarkan apa adanya. Alat yang mengabaikan colourway melalui `tokenAxes` tidak mencatat satu pun, dan kredit proof PDF (tanda cetak `prov`) mengikuti aturan yang sama.

**Brand skill yang memandu agen.** Bila agen membuat karya dan menyebut [brand skills](/info/brand-skills.html) yang dibaca dan diikutinya, catatan juga mencantumkan setiap skill beserta revisinya, seperti *Guided by: acme-brand 1.0*. Kata-kata itu berarti skill memandu pekerjaan. Itu bukan pemeriksaan: Lolly tidak menguji karya terhadap skill. Hanya pernyataan agen sendiri yang menambahkan daftar, yang saat ini berarti argumen `brandSkills` pada `lolly_render` milik [server MCP](/info/mcp.html), jadi karya yang dibuat di aplikasi atau dari tautan berbagi tidak membawa satu pun. Content Credential menyimpan daftar sebagai `brandSkills`, satu nilai JSON dengan id, nama, revisi, dan hash SHA-256 tiap skill. Paket XMP dan metadata SVG menyimpan nilai yang sama sebagai `lolly:BrandSkills`, PDF yang ditulis dari catatan mendapat satu kata kunci per skill, dan deskripsi tetap seperti semula. Skill internal dicatat menurut id, nama, revisi, dan hash-nya, tidak pernah menurut teksnya. Sakelar yang sama membuang daftar bersama sisa catatan: kartu **Design system**, `_madewith=0`, `--no-madewith`, dan `madeWith: false`. Bila server MCP menggambar file di browser (PDF, JPEG, dan format lain yang tidak dapat ditulis jalur tanpa browsernya), metadata file sendiri tidak menyimpan daftar dan hanya Content Credential yang dapat. Berikan `c2pa` untuk mempertahankan catatan; tanpa kredensial render memperingatkan bahwa brand skill tidak dicatat.

**Membaca catatan kembali.** [Verify](/verify) mencantumkan catatan sebagai **Design system** dalam detail kredensial file dan brand skill apa pun sebagai **Guided by**. *Recreate with these settings* membuka kembali alat pada versi dan colourway yang dicatat. Tautan terbuka dengan design system yang dicatat bila perangkat ini memiliki satu dengan id dan nama yang sama; jika tidak, terbuka dengan design system aktif Anda.

::: details Apa yang ditulis di mana, dan proses mana yang tidak menyertakan catatan
| Di mana | Apa yang ditulis |
|---|---|
| Content Credential | `designSystem` (id), `designSystemLabel`, `designVersion`, dan `themes` dalam assertion `tools.lolly.export`, masing-masing nilai teks biasa; `themes` adalah daftar JSON dari pilihan |
| PNG, JPEG, WebP, dan JXL | Empat nilai yang sama sebagai properti `lolly:` pada paket XMP file, dalam namespace `https://lolly.tools/ns/export/1.0/` |
| SVG | Properti `lolly:` yang sama di dalam blok `<metadata>` |
| PDF | Kata kunci seperti *Design system: Acme* dan *Colourway: Beach* |
| Setiap format dengan field deskripsi | Deskripsi, dengan colourway di samping alat |

Kartu muncul hanya bila ada yang dicatat dan format dapat memuat catatan. CSV, JSON, file kalender, dan format teks atau data lain tidak memuat metadata, dan EPS, EMF, DXF, dan BMP tidak memiliki field untuk catatan. HTML, Markdown, dan CSS memuat catatan hanya di Content Credential-nya, jadi untuk mereka kartu tidak menampilkan baris deskripsi dan bersembunyi saat **C2PA Credentials** mati. Field yang tidak diberikan design system tidak masuk ke file.

Tautan berbagi mematikan catatan dengan `_madewith=0` ([URL parameters](/info/url-parameters.html)); baris perintah menerima `--no-madewith`, `lolly_render` milik [server MCP](/info/mcp.html) menerima `madeWith: false`, dan panel ekspor aplikasi terminal memiliki baris **Design system**. Baris perintah mencetak kata-kata yang dibawa file jadi ke standard error, untuk render alat dan untuk setiap file yang diekspor `lolly run` dari sesi Design tersimpan, dan render MCP mencetaknya di samping file, keduanya dibaca kembali dari file. PNG yang digambar baris perintah tanpa browser tidak membawa metadata file, jadi catatannya ikut hanya dalam kredensial. Utilitas di perangkat tidak menambahkan metadata sama sekali.

Proses tanpa kartu **Design system** tidak menyertakan catatan: proses Batch, folder yang diekspor dari Projects, dan ekspor koleksi 3D, dan di aplikasi terminal ekspor batch CSV, folder atau pilihan Projects, dan tampilan render-everything. Ekspor satu file dari alat untuk mencatat design system.
:::

### Content Credentials (C2PA)

Ekspor dapat membawa **Content Credentials**: manifes [C2PA](https://c2pa.org) bertanda tangan yang mencatat apa yang membuat file, kapan, dan di mana, terikat pada hash byte file sehingga setiap suntingan sesudahnya dapat terdeteksi. Spesifikasinya diterbitkan oleh C2PA, dan Lolly menulis manifes standar yang dapat diperiksa pembaca C2PA mana pun.

![Kartu C2PA Credentials, tercentang, dengan masa berlaku kredensial di samping kotak centang](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26c2pa%3D30%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-c2pa%5Bdata-c2pa-only%5D&walker=1&dark=1&filename=exp-c2pa-card)

- **Aktif secara default.** Kartu **C2PA Credentials** sudah terpilih untuk hampir setiap alat. Hapus centang untuk satu ekspor, atau berikan `c2pa=off` di tautan. Alat dapat menolak di manifesnya.
- **Format.** PDF (RGB dan Print), PNG dan APNG, JPG, GIF, SVG, TIFF (RGB dan Print), WebP (diam dan animasi), AVIF, MP4, WebM, kontainer audio MP3, WAV, M4A, OGG/Opus, dan FLAC, serta HTML, Markdown, dan CSS. ZIP menstempel setiap anggota yang didukung, begitulah Animated SVG mendapatkannya. MP4, AVIF, dan M4A memakai pengikatan BMFF standar dan MP3 pemetaan ID3v2-nya, sehingga `c2patool` dan pembaca lain memverifikasinya. WebM dan OGG/Opus belum memiliki pemetaan standar, jadi Lolly membawa manifes sebagai lampiran Matroska dan field OpusTags, yang diperiksa verifier Lolly sendiri. ICO, EPS, EMF, DXF, BMP, PPTX, format Office, dan format teks atau data lain tidak memiliki kontainer C2PA.
- **Apa yang dicatat.** Alat dan aplikasi yang membuat file, waktu penandatanganan, shell yang mengekspornya, [design system dan colourway](#the-design-system-record) selama kartu **Design system** tercentang, dan sidik jari input aktif. Teks input, field terikat profil, kontrol tidak aktif, versi browser, dan detail sistem operasi tidak disertakan. Nama dan email Anda muncul sebagai pembuat hanya bila **Use my details to create** aktif di Settings → Preferences → Your details. Sumber yang ditempatkan ekspor ikut sebagai ingredient: [karya berkredit](#source-credits) seperti emoji, dan [lagu Rondocode](/info/rondocode.html#songs-in-the-credential) dalam ekspor video atau audio.
- **Apa yang dilihat penerima.** Alat C2PA seperti aplikasi Adobe, `c2patool`, dan contentcredentials.org/verify membaca manifes dan menampilkan klaimnya. Lolly menandatangani dengan kunci yang dibuat di perangkat Anda, bukan sertifikat dari daftar kepercayaan, sehingga penampil melaporkan kredensial *unverified*: struktur dan bukti perusakan nyata, penandatangannya tidak dijamin. Untuk mengubahnya, daftarkan **verified identity** di Settings → Preferences → Content Credentials; lihat [Content Credentials Identity](/info/content-credentials-identity.html).
- **Memeriksa file.** Letakkan file apa pun di [Verify](/verify), atau jalankan `lolly validate <file>`, untuk laporan di perangkat yang membuka dengan apakah Lolly yang membuat file dan apakah file berubah sejak itu. Verify juga melihat di luar kredensial; lihat [What Verify checks](/info/what-verify-checks.html).
- **Privasi.** Kunci penandatanganan dibuat untuk ekspor dan tidak pernah meninggalkan perangkat Anda, dan klaim hanya memuat apa yang sudah dibawa metadata provenansi. Utilitas privasi yang mentransformasi file Anda sendiri tidak menambahkan kredensial, dan *Strip Hidden Data* menghapus manifes C2PA seperti metadata lain. Utilitas Rondocode membuat audio baru, jadi ia menandatangani apa yang ditulisnya ([Rondocode songs](/info/rondocode.html#files-from-the-rondocode-utility)).
- **Interaksi.** PDF berkata sandi tidak dapat membawa Content Credentials, pada kedua tingkat. Kredensial ditambahkan terakhir, di atas byte jadi, setelah DPI, EXIF, profil warna, metadata PDF/X, dan tanda cetak.

### Source credits

Ekspor yang menempatkan karya orang lain mencatat sumber itu dalam kredensial. Emoji yang digambar dari set emoji terpilih adalah kasus sehari-hari: karya, pembuatnya, lisensi, asal byte persisnya, dan apa yang berubah semuanya ikut bersama file. Teks pada alat yang templatnya SVG mempertahankan emoji sistem sendiri, jadi tidak ada yang dikreditkan di sana. Baris **Source credits** menyatakan apa yang diminta sumber dari pengiriman sebelum Anda mengunduh, dan setelah unduhan ia membaca kembali byte yang dikirim sebelum menyatakan bahwa kredit ada dalam file. Lisensi yang meminta Anda memilih, seperti glyph CC BY-SA yang diwarnai ulang yang akan Anda bagikan, mendapat kartu dengan opsi; unduhan tidak pernah diblokir. [Creative rights and credits](/info/creative-rights.html) memuat kata-katanya, lisensi yang ditinjau, dan apa yang tetap milik Anda.

## Perlindungan kata sandi

Dua jenis kunci, keduanya dibuat di perangkat Anda. Kartu *Password protect* pada panel ekspor menggerakkan keduanya.

![Kartu Password protect yang diperluas pada ekspor PDF, dengan bidang kata sandi dan dua tingkat kunci](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpdf%26password%3Ddemo%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-pdfpass&dark=1&filename=exp-pdf-password)

**Kata sandi buka PDF** memiliki dua tingkat begitu Anda mengetik kata sandi:

- **Weak**: RC4 40-bit, penangkal, bukan perlindungan. Kata sandinya dapat ikut dalam tautan berbagi, sebagai teks biasa. Hanya `pdf` RGB.
- **Strong**: AES-256 (PDF 2.0). Diketik saat ekspor dan tidak pernah ditaruh di tautan. Berlaku juga untuk Print PDF dan setiap PDF dalam ZIP batch. Print PDF yang dikunci Strong mempertahankan CMYK, tanda, dan output intent tetapi membuang klaim PDF/X-4.

**ZIP terkunci** mencakup ekspor ZIP, unduhan folder dari Projects, atau batch, dengan satu kata sandi pada dua tingkat: **Weak** (ZipCrypto, penangkal; dapat ikut dalam tautan `?password=`) atau **Strong** (AES-256, diketik saat ekspor, tidak pernah di tautan). Kata sandi melindungi setiap anggota, dan PDF di dalamnya juga dikunci dengan AES-256 sendiri, sehingga tetap terkunci setelah ZIP dibuka. Perintah muncul saat unduhan dimulai; kata sandi kosong berarti tanpa kunci.

**Tautan berbagi dengan gerbang kata sandi** meminta penerima memasukkan kata sandi sebelum terbuka. Seluruh status tautan dienkripsi dengan AES-256 di bawah kunci yang diturunkan dari kata sandi (PBKDF2), sehingga hanya ciphertext yang ikut dan dekripsi terjadi di browser penerima. Server yang melayani tautan tidak pernah melihat kata sandi atau desain. Aktifkan di dialog **Share**. Tautan terenkripsi hanya terbuka di Lolly, tidak pernah sebagai gambar tersemat. Lihat [URL Mode](/info/url-mode.html).

## Di ponsel

Kontrol ekspor berada di balik tombol **Export** mengambang, yang membuka sheet **Export**: format, ukuran, salin, unduh, dan berbagi yang sama, berukuran untuk sentuhan.

## Id format untuk tautan dan CLI

Ini adalah nilai untuk parameter URL `format=` dan flag CLI `--export=` (lihat [URL parameters](/info/url-parameters.html) dan [CLI](/info/cli.html)). Menu alat hanya menampilkan format yang dapat dibuat alat itu, jadi selalu lebih pendek dari daftar ini.

| Jenis | Id |
|---|---|
| Raster | `png` · `jpg`/`jpeg` · `webp` · `avif` · `jxl` · `jxl-lossless` · `tiff` (RGB TIFF) · `cmyk-tiff` (Print TIFF) · `bmp` · `ico` |
| Vektor | `svg` · `svgz` (SVG gzip) · `emf` · `wmf` · `eps` · `eps-cmyk` (EPS CMYK) · `dxf` (file potong) |
| Halaman dan dokumen | `pdf` · `pdf-cmyk` (Print PDF) · `pptx` (PowerPoint) · `docx` (Word) · `odt` (OpenDocument Text) · `idml` (InDesign) · `penpot` (file desain Penpot) · `scorm` (paket kursus, sebuah ZIP) |
| Gerak | `gif` · `apng` (Animated PNG) · `webp-anim` (Animated WebP) · `svg-anim` (Animated SVG) · `webm` · `mp4` · `lottie` (dotLottie) · `premiere-xml` (Premiere XML + media) |
| Audio | `wav` · `mp3` · `m4a` · `aac` · `opus` · `ogg` · `flac` |
| Teks dan data | `html` · `md` · `txt` · `json` · `csv` · `ics` · `vcf` · `srt` · `vtt` · `css` · `scss` · `gpl` (palet GIMP) |
| Bundel dan paket | `zip` · `rpm` dan `tar.gz` (render disegel ke paket Linux) |

Beberapa id berasal dari kode ekspor alat sendiri: `ase` (Adobe Swatch Exchange, dari Palette Lab) serta `exr` dan `hdr` (raster rentang dinamis tinggi, dari Darkroom). **Convert Font** menulis `ttf`, `otf`, dan `woff` dari file font yang Anda berikan, jadi tautan kosong tidak memiliki apa pun untuk dirender.
