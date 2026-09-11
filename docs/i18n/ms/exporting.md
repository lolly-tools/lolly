# Eksport & Format

Cara mendapatkan fail siap daripada sesuatu alat - memilih format yang betul, menetapkan saiz output dan apa yang dilakukan oleh setiap pilihan. Seperti semua perkara lain, **eksport berlaku pada peranti anda**; tiada apa yang dimuat naik.

## Cara Eksport Berfungsi

Pratonton *ialah* fail itu sendiri. Apabila anda mengeksport, host akan merender kanvas tersebut kepada format yang anda pilih dan menyerahkan muat turun kepada anda (atau meletakkannya pada papan klip anda). Sesuatu alat hanya menawarkan format yang diisytiharkan oleh pembuatnya, dan pemilih menyembunyikan mana-mana format yang tidak boleh dihasilkan oleh pelayar anda (lihat [Video](#video)).

Tiga laluan menghasilkan fail. Kebanyakan alat **merender kanvas** kepada format yang dipilih. Format teks dan data (HTML, MD, TXT, JSON, CSV, ICS, VCF) pula **dijana daripada kandungan alat**, bukan dirasterkan daripada gambar. Dan utiliti privasi (contohnya *Strip Hidden Data*) menggunakan laluan ketiga: fail yang *anda* pilih diubah bait demi bait pada peranti dan diserahkan semula terus - tiada kanvas, tiada tera air dan tiada metadata provenans ditambah, kerana ia sudah pun fail anda sendiri.

Tindakan dalam kawalan eksport:

- <!--i:download--> **Download** - simpan fail (tindakan utama).
- <!--i:photos--> **Copy** - letakkan imej pada papan klip anda untuk ditampal terus ke dalam Slack, e-mel, atau dokumen. Jika pelayar tidak dapat menyalin imej, ia akan memuat turun sebaliknya dan memberitahu anda.
- <!--i:folder--> **Save** - simpan reka bentuk semasa sebagai sesi alat yang tersimpan dalam pustaka anda.
- <!--i:link--> **Share** - membuka **Share dialog**: pautan yang boleh disalin yang menghasilkan semula reka bentuk, togol semasa lawatan (skrin penuh, panel eksport, muat turun- atau salin-semasa-buka) dan **Shortest link** pilihan yang memampatkan seluruh keadaan ke dalam token yang padat (lihat [URL Mode](/info/url-mode.html)).

(Pembuat alat memilih yang mana antara ini dipaparkan; set lalai ialah Copy, Download dan Save.)

![Panel eksport - format, saiz dan tindakan Copy / Download / Save / Share](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&walker=1&dark=1&filename=export-panel)

Share dibuka di atas alat, dengan pautan yang telah dibina dan togol semasa lawatan di bawahnya.

### Merender Banyak Sekali Gus

Satu eksport ialah satu fail, tetapi anda boleh merender **banyak** dalam satu larian - setiap satu diserahkan sebagai satu `.zip`:

- <!--i:folder--> **Projects → Render folder** mengeksport setiap sesi tersimpan dalam satu folder (dan sub-foldernya) sebagai satu zip bersarang; **Render selection** melakukan perkara yang sama untuk mana-mana pilihan pelbagai; satu sesi tersimpan tunggal terus dirender kepada failnya sendiri. Batch/Pro tidak diperlukan - lihat [Using Lolly → Projects](/info/using.html).
- <!--i:layers--> **Batch (Pro)** merender grid set input - setiap varian satu templat sekali gus.

Sesi tersimpan juga boleh dikongsi semula sebagai pautan alat daripada Projects (ia membina semula URL alat daripada input yang disimpan), jadi pautan itu akan membukanya semula dengan tetapan yang sama tepat.

## Memilih Format

Nama fail dan pemilih format terletak di bahagian atas panel sebagai satu pasangan `name.format`, dan pemilih itu hanya menyenaraikan format yang diisytiharkan oleh pembuat alat ini.

![Medan nama fail bergabung dengan pemilih format, jadi eksport dibaca sebagai satu pasangan name.format](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.filename-extension&walker=1&dark=1&filename=exp-format-picker)

| Anda mahukan… | Guna | Sebab |
|---|---|---|
| Logo / karya seni tajam yang boleh diskalakan | **SVG** | Vektor - boleh diskalakan tanpa had, kecil, boleh disunting |
| Vektor untuk aplikasi Office / Windows | **EMF** | Ditampal sebagai vektor boleh disunting ke dalam PowerPoint / Word; teks kekal langsung dan boleh disunting, dan Google Drive membukanya dalam Google Drawings untuk Slides |
| Vektor untuk cetakan / aplikasi reka bentuk | **EPS**, atau **EPS (CMYK)** | Vektor PostScript untuk aliran kerja Illustrator / akhbar cetak |
| Vektor untuk mesin pemotong / CAD | **DXF** | Pemotong laser, plotter vinil, CNC - laluan garis luar dalam milimeter |
| Dek slaid yang boleh disunting | **PowerPoint** (PPTX) | Teks + bentuk boleh disunting secara asli, dengan imej dan vektor kekal boleh diekstrak |
| Kursus yang boleh diimport oleh LMS | **SCORM** (LMS) | Fail zip dengan manifest, halaman pelancaran, slaid dan filem naratif dengan kapsyen - daripada dek Design |
| Dokumen teks yang boleh disunting | **Word** (DOCX) atau **OpenDocument** (ODT) | Perenggan dan tajuk sebenar yang boleh terus disunting oleh pemproses kata (Doc Studio) |
| Foto atau imej serba guna | **PNG** (tanpa kehilangan) atau **JPG** (lebih kecil) | Raster sejagat |
| Imej moden yang lebih kecil | **WebP** / **AVIF** | Mampatan lebih baik, alfa |
| Cetakan | **PDF**, atau **Print PDF** (CMYK) | Saiz halaman sebenar; CMYK untuk akhbar cetak |
| Raster cetakan untuk akhbar cetak | **Print TIFF** (CMYK) | Piksel DeviceCMYK untuk RIP |
| Animasi untuk web | **GIF** | Berfungsi di mana-mana, fail lebih besar |
| Animasi dengan warna penuh + alfa sebenar | **APNG** | PNG beranimasi - tiada had palet, ketelusan sebenar |
| Animasi, fail paling kecil | **Animated WebP** | Warna penuh + alfa, mampatan lebih baik daripada GIF atau APNG |
| Vektor beranimasi yang boleh diskalakan | **Animated SVG** | Berdikari; bergelung dalam pelayar atau `<img>`, tiada kodek, sebarang saiz |
| Video untuk media sosial / perkongsian | **MP4** atau **WebM** | Kualiti-setiap-bait terbaik (lihat di bawah) |
| Teks kaya / tandatangan e-mel | **HTML** | Ditampal berformat ke dalam klien e-mel |
| Kandungan biasa | **MD** / **TXT** | Teks sahaja |
| Acara kalendar | **ICS** | Diimport ke dalam mana-mana aplikasi kalendar |
| Kad kenalan | **VCF** | Diimport ke dalam Kenalan / buku alamat |
| Data berstruktur untuk diimport semula | **JSON** / **CSV** | Pusing-ulang kandungan alat |
| Favicon | **ICO** | Ikon laman pelbagai saiz (**ZIP** menggabungkan beberapa format) |

Baris pertama ialah kes yang paling biasa. Wordmark yang ditaip dalam fon jenama anda dieksport sebagai SVG, di mana setiap huruf ialah laluan bergaris luar dan bukannya piksel, jadi ia kekal tajam pada saiz kad perniagaan dan pada saiz pembalut bangunan daripada fail yang sama.

![Wordmark bergaris nipis berjarak luas berbunyi Aurora, jenis artwork vektor tulen yang menjadi maksud baris SVG dalam jadual](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DAurora%26weight%3D200%26tracking%3D16%26size%3D200%26full&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-wordmark-vector)

## Saiz & Unit Cetak

Secara lalai, eksport menggunakan saiz piksel asli alat tersebut. Jika sesuatu alat mendedahkan **dimensi**, anda boleh menetapkan lebar × tinggi dan **unit**:

- **px** (lalai) - piksel tepat.
- **mm · cm · in · pt · pc** - saiz fizikal/cetak. Dengan unit fizikal, anda juga menetapkan **DPI** (lalai **300** untuk cetakan); enjin menukar dengan betul mengikut format - **PDF** menjadi halaman sebenar pada saiz tersebut, **raster** dirender pada bilangan piksel yang betul untuk DPI tersebut (dan membenamkan resolusi), **SVG** mengekalkan unit fizikal dengan viewBox px.

Untuk mendapatkan raster beresolusi lebih tinggi, masukkan lebar/tinggi yang lebih besar, atau pilih unit fizikal dan naikkan DPI (piksel = saiz × DPI). Tiada togol skala satu-klik.

Contoh: lebar `210`, tinggi `297`, unit `mm` → satu halaman A4.

![Baris dimensi ditetapkan kepada 210 kali 297 mm, dengan medan DPI didedahkan kerana unit adalah fizikal](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26w%3D210%26h%3D297%26unit%3Dmm%26format%3Dpdf%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-dims&walker=1&dark=1&filename=exp-export-dims)

## Gambar Diam Daripada Komposisi Bermasa

**Komposisi berwaktu** - garis masa [Sequence](/info/using.html#timeline-sequence) dalam Design, atau mana-mana artboard dipacu garis masa - ialah sesuatu yang bergerak, jadi eksport statik perlu menjawab "detik yang mana?". Peraturannya seperti yang dijangka: **bingkai pada kepala main**. Letakkan kepala main di tempat anda mahukan gambar itu dan eksport; apa yang anda lihat itulah yang terhasil.

Apabila anda mahukan lebih daripada satu detik, medan **Frames** akan muncul di sebelah saiz output (hanya untuk komposisi bermasa, dan hanya untuk format gambar diam - PNG, JPG, WebP, SVG atau PDF). Biarkannya pada `1` untuk bingkai playhead. Naikkannya dan anda akan mendapat sebanyak itu gambar diam yang disampel pada selang sama rata sepanjang keseluruhan urutan:

- **Raster and SVG** dikembalikan sebagai satu **zip** - `<name>-01.png`, `-02.png` dan seterusnya.
- **PDF** dikembalikan sebagai **satu dokumen dengan bilangan halaman sebanyak itu**.

Berguna untuk papan cerita, helaian lakaran kecil, helaian kenalan untuk semakan atau karusel media sosial yang dipotong terus daripada suntingan video.

Persampelan diambil pada **titik tengah** setiap selang dan bukan pada tepinya, kerana detik pertama sesuatu urutan selalunya ialah peralihan masuk yang belum pudar masuk lagi dan detik terakhir ialah keadaan selepas setiap klip berakhir - persampelan pada titik hujung akan membazirkan dua daripada bingkai anda pada bingkai yang hampir kosong. Bilangannya dihadkan pada **64** (helaian kenalan adalah untuk dibaca oleh manusia), dan sebarang input yang tidak masuk akal ditaip ke dalam medan tersebut akan kembali kepada `1` dan bukannya menggagalkan eksport. Setiap bingkai ialah gambar diam biasa, jadi Content Credentials, imprint, unit fizikal dan DPI semuanya berkelakuan sama seperti untuk satu eksport tunggal.

Medan **Frames** ialah cara untuk mendapatkan helaian pada masa ini. Enjin mengekalkan parameter URL `cuts` yang sepadan, tetapi tiada shell yang membacanya daripada pautan lagi, jadi pautan yang dikongsi sentiasa dibuka semula pada bingkai playhead - lihat [URL Mode](/info/url-mode.html#contact-sheets-cuts).

## PDF Berbilang Halaman

Sesetengah alat membina **dokumen PDF berbilang halaman** dan bukannya satu karya seni tunggal - kulit depan, kandungan yang mengalir ke seberapa banyak halaman yang diperlukan dan halaman belakang, semuanya dalam satu fail (lihat alat *Booklet*). Setiap halaman ialah **halaman PDF sebenar** yang bersaiz mengikut kotak halaman tersebut, jadi pembaca dan pencetak mendapat halaman sebenar, bukan satu imej panjang.

- **Pages from content.** Tambah blok teks dan imej; halaman baharu dicipta secara automatik apabila blok itu dipenuhkan, dan anda boleh memaksa mana-mana blok untuk memulakan halaman baharu.
- **Real page sizes.** Pilih A4, US Letter atau A5 (potret - susun atur dua lajur dibina untuknya) - setiap halaman, dan PDF yang dieksport, dirender pada saiz tersebut dengan tepat.

PDF berbilang halaman ialah dokumen RGB dan tidak membawa tanda potong/limpah - itu kepunyaan laluan **Print PDF** satu halaman di atas. Ia tetap membawa **metadata PDF/X-4** yang sama seperti setiap eksport PDF (kotak halaman, XMP, ID dokumen, hasrat output sRGB dengan profil terbenam), dan ia menawarkan **Content Credentials** (di bawah) - pada alat *Booklet* pilihan ini sudah dipratanda.

## Menghasilkan Banyak Perkara Sekali Gus

Lolly mempunyai tiga cara berbeza untuk bekerja secara pukal, dan ia menyelesaikan tugas yang berbeza - penyuntingan berkelompok ialah keupayaan kelas pertama platform ini, bukan sesuatu yang dicipta semula oleh setiap alat:

- <!--i:document--> **One design × a table of rows → one multi-page document.** Alat dengan input `table` (seperti *Battlecards*) menukar setiap baris menjadi satu halaman secara automatik - tampal jadual daripada hamparan anda, dapatkan PDF bersaiz dek. Penyunting berkelompok sebenar anda kekal sebagai hamparan itu: betulkan sepuluh baris di sana, tampal semula. Alat itu sendiri tidak pernah menguruskan halaman.
- <!--i:layers--> **One design × a data file → many separate files.** Grid berkelompok `/pro` mengambil CSV dan merender satu eksport *bagi setiap baris* - lencana nama, sijil, satu fail bagi setiap satu.
- <!--i:sliders--> **Many different assets, edited side by side.** *Multi-edit* membuka beberapa sesi tersimpan dalam satu paparan untuk suntingan sentuhan-akhir yang diselaraskan merentasi reka bentuk yang berlainan.

Petua umum: baris reka bentuk yang sama yang tergolong dalam **satu dokumen** → alat dipacu jadual; baris yang mesti dihantar sebagai **fail berasingan** → `/pro`; **reka bentuk berlainan** yang memerlukan pelarasan yang sama → multi-edit. (Satu pilihan render "combine media" yang dirancang akan menghubungkan dua yang pertama - menggabungkan eksport format sama menjadi satu PDF, satu video atau satu helaian kenalan pruf.)

## PowerPoint (PPTX)

Design, Markdown Slides, Booklet, Doc Studio, Chart dan Diagrams boleh mengeksport **dek PowerPoint** - satu slaid setiap halaman. Intinya bukan tangkapan skrin sepiksel-sempurna; sebaliknya untuk memberikan rakan sekerja dek yang benar-benar boleh mereka **sunting dan keluarkan aset daripadanya**. Justeru setiap halaman diuraikan kepada objek asli:

- <!--i:font--> **Teks** menjadi kotak teks **PowerPoint sebenar yang boleh disunting** - dengan saiz fon, warna, ketebalan, italik dan penjajaran daripada susun atur - jadi anda boleh membetulkan taip salah atau menggaya semula dalam PowerPoint.
- <!--i:pentool--> **Vektor** (logo, ikon, tanda SUSE) dibenamkan sebagai **gambar SVG sebenar** - kekal tajam pada sebarang saiz, dan PowerPoint malah boleh *Convert to Shape* ke atasnya.
- <!--i:photos--> **Imej** dibawa masuk pada resolusi asalnya sebagai gambar boleh diekstrak tersendiri (hero yang dipotong `cover` mengekalkan imej penuh di sebalik potongan, jadi anda boleh membingkai semula), dengan sebarang olahan pada imej (penapis, campuran) dibakar dengan setia.
- <!--i:layers--> **Latar belakang, sempadan dan garisan** menjadi bentuk segi empat/garis sebenar.

![Panel eksport dengan PowerPoint dipilih: satu slaid setiap halaman, teks dan bentuk kekal boleh disunting](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio%3Foptions&width=1440&height=900&dpi=192&waitMs=2500&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22pptx%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-pptx)

Susun atur adalah anggaran mengikut reka bentuk - matlamatnya ialah **kandungan** yang setia dan boleh diguna semula, bukan tangkapan skrin yang terkunci. Apa-apa yang tidak dapat dinyatakan secara asli oleh walker (kawasan bertapis atau bertopeng kompleks) dibenamkan sebagai gambar supaya tiada apa hilang. Satu dek mempunyai satu saiz slaid, diambil daripada halaman pertama.

PowerPoint juga merupakan satu cara **masuk**. Jatuhkan fail `.pptx` pada mana-mana permukaan muat naik dan pilih slaid yang anda mahukan - setiap satu menjadi aset untuk diletakkan, digred atau dibina semula. **Markdown Slides** menulis dek baharu daripada Markdown (dan turut memberikan templat `.pptx` berjenama), manakala utiliti **Rebrand** menukar tema dek sedia ada di tempatnya - palet tema, warna dan fon yang dikodkan keras - tanpa menyentuh carta, SmartArt atau animasinya, lalu mengembalikan fail `.pptx`. Lihat [Import reka bentuk → Dek dan dokumen](/info/design-import.html#decks-and-documents).

## Penpot

Mana-mana alat yang boleh mengeksport SVG turut boleh mengeksport **fail Penpot** (`.penpot`) - dokumen itu, sedia untuk terus disunting dalam Penpot dan bukan sekadar untuk dilihat.

- <!--i:layout--> Daripada **Design**, setiap bingkai menjadi **board** Penpot, setiap kotak di dalamnya dibawa masuk sebagai bentuknya sendiri yang boleh disunting - segi empat tepat, elips, teks, imej atau laluan - dan hasilnya tiba sebagai **komponen** boleh guna semula dalam panel Assets, sedia untuk diseret keluar semula.
- <!--i:pentool--> Daripada alat yang penjanaannya berupa **geometri biasa** - alat vektor seperti QR Code, Street Map, Wordmark dan Palette Lab - setiap laluan, segi empat tepat, larian teks dan gradien dibawa masuk dengan cara yang sama, sebagai bentuknya sendiri yang boleh disunting.
- <!--i:font--> Daripada alat yang menyusun penjanaannya dalam **HTML**, **teks kekal sebagai teks** - satu objek teks Penpot yang boleh disunting bagi setiap baris, bukan garis luar dan bukan gambar rata. Sekeping karya seni yang Penpot tiada binaan untuknya - ilustrasi kompleks, kanvas langsung - turut serta secara berasingan sebagai imej, jadi ia tidak sekali-kali meratakan teks dan kotak di sekelilingnya. Seluruh susun atur yang Penpot tidak dapat pisahkan dengan setia pun masih boleh terhasil sebagai satu gambar dengan kesetiaan penuh, jadi tiada apa yang tercicir.
- <!--i:palette--> Warna atau fon yang diwarisi bentuk daripada **token jenama** kekal **terpaut** kepada token itu dalam fail: ubah token dalam panel Tokens Penpot dan setiap bentuk yang mewarisinya turut mengecat semula bersama, manakala warna literal sekali sahaja kekal betul-betul di tempatnya. Warna dan tipografi jenama turut mendarat dalam panel **Assets** serta set token reka bentuk penuhnya dalam panel **Tokens** - set token DTCG yang sama yang digunakan oleh palet Lolly sendiri. Penpot menyimpan salinannya sendiri daripada situ: suntingan yang dibuat dalam panel Tokens-nya kembali ke jenama melalui [import Brand Studio](/info/design-import.html), bukan dengan sendirinya.

| Apa yang anda hasilkan | Dalam Penpot |
|---|---|
| Teks | Objek teks boleh disunting - betulkan kesilapan taip atau ubah gaya |
| Bentuk, laluan, gradien, imej | Bentuk vektor mereka sendiri yang boleh disunting |
| Warna atau fon daripada token jenama | Pautan token langsung - sunting token, setiap bentuk yang mewarisinya turut mengikut |
| Keseluruhan reka bentuk | Komponen boleh guna semula dalam panel Assets |
| Ilustrasi kompleks atau kanvas langsung | Dibenamkan secara berasingan sebagai imej, kandungan boleh disunting di sekelilingnya tidak tersentuh |

![Panel eksport dengan Penpot dipilih: fail .penpot, dan Send to Penpot di sebelah muat turun](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22penpot%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-penpot)

Untuk membukanya, mulakan Penpot, pilih projek dan pilih **Import**. Apabila log masuk ke Penpot daripada panel eksport, **Send to Penpot** melakukan langkah itu untuk anda - pilih projek di sana dan fail terus masuk ke dalamnya.

## SCORM (pakej kursus)

Dek Design boleh keluar sebagai **pakej SCORM** - fail zip yang diimport oleh sistem pengurusan pembelajaran, sama ada Moodle, Canvas, Blackboard atau LMS korporat. Pilih **SCORM (LMS)** dalam pemilih format dan eksport menulis:

- <!--i:layout--> **Slaid**, satu imej setiap artboard, sebagai vektor di mana artboard membenarkannya dan sebagai piksel hanya di mana ia tidak membenarkannya.
- <!--i:play--> **Filem naratif** dengan trek kapsyennya - nota penceramah dibacakan oleh suara pada peranti, tepat seperti yang dimainkan oleh [Presenting](/info/create/using.html#presenting).
- <!--i:file--> **Halaman pelancaran** yang melangkah melalui slaid, memainkan filem dan melaporkan penyelesaian kembali kepada LMS melalui masa jalan SCORM 1.2, versi yang diterima oleh setiap LMS.
- <!--i:font--> Fon yang digunakan oleh dek, supaya halaman pelancaran terjana sama semasa luar talian.

![Panel eksport pada dek Design dengan SCORM (LMS) dipilih](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour%26format%3Dscorm%26options&width=1440&height=900&dpi=192&waitMs=3500&css=.fc-insp%7Bdisplay%3Anone!important%7D.edge-dock-slot--fill%7Bflex%3A1%201%20auto!important%3Bheight%3Aauto!important%3Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D.export-popup.is-floating%7Bheight%3Aauto!important%7D.export-popup-body%7Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-scorm)

Tiada apa-apa dalam pakej itu yang menghubungi pelayan luar: ia hanyalah fail dalam zip, dan ia berjalan di dalam LMS tanpa pemasang bundle, tanpa CDN dan tanpa akaun. Aplikasi web dan desktop membinanya; CLI tidak, kerana memotret artboard dan mengekod filem memerlukan pelayar.

## DXF (fail potong)

Alat vektor (Brand Lockup, QR Code, Street Map, Wayfinding Signage, Pose Geeko, logo lockup, Diagram Builder) boleh mengeksport **DXF** - format pertukaran AutoCAD R12 yang dibaca oleh pemotong laser, plotter vinil dan perisian CNC/CAD. Geometri ditulis sebagai laluan outline **dalam milimeter** (lengkung diratakan kepada toleransi halus), teks di-outline menjadi laluan dan warna dipetakan kepada AutoCAD Color Index yang terdekat (yang biasanya menentukan alat/operasi pada sesuatu pemotong). DXF hanya untuk line-art - kawasan fotografik atau yang ditapis tiada bentuk cut-path dan akan digugurkan (Lolly memberi amaran), jadi gunakan SVG/PDF apabila anda perlu mengekalkan kandungan raster.

Street Map adalah kes paling jelas: keseluruhan reka bentuk sudah pun berupa lejang, jadi setiap jalan dan terusan menjadi laluan potong tanpa apa-apa untuk digugurkan.

::: showcase
![Render Street Map bagi Paris dalam dakwat pada krim - seni garis tulen, jadi setiap lejang terselamat dalam perjalanan ke pemotong](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Dparis%26roadColor%3D1a1a2e%26waterColor%3D93c5fd%26background%3Dfaf7f2%26full&width=1440&height=900&dpi=96&waitMs=3200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-street-map-cut)

Tatal, dan kamera menarik diri kembali melalui geometri sebenar: tujuh laluan, tiada piksel di mana-mana, setiap lejang setajam rerambut pada sebarang zum. Itulah fail yang sama yang dibaca oleh pemotong.
:::

## SVG Beranimasi

Alat gerakan (Animated Ad, Lottie Ad) boleh mengeksport **SVG Beranimasi** - animasi *vektor* yang lengkap dengan sendirinya. Tidak seperti GIF/APNG/WebP (yang mensampel setiap bingkai kepada piksel), SVG beranimasi menyusun tangkapan vektor bertindan dengan keyframe CSS terbenam, jadi ia **berskala kepada sebarang saiz tanpa kodek dan tanpa masa jalan luaran** - ia mengulang dalam tab pelayar atau `<img>`. Teks kekal bergaris supaya ia dipaparkan di mana-mana. Ia berkongsi kawalan **Duration**/kadar bingkai formats beranimasi, dan (kerana lebih berat per bingkai berbanding bitmap) menggunakan kadar bingkai lalai yang lebih rendah.

## Ketelusan

Alat yang menyokongnya menawarkan togol **latar belakang telus** (cth. *No BG*). Ketelusan dikekalkan oleh PNG, WebP, AVIF, SVG (statik dan beranimasi), APNG dan Animated WebP. JPG dan PDF sentiasa legap, dan TIFF diratakan pada putih (pada hitam pada laluan HDR - lihat di bawah).

## Ruang warna

Dua soalan berbeza, wajar dikekalkan berasingan: ruang warna yang Lolly boleh **baca dan fikirkan**, dan yang mana ia **tulis**.

**Membaca.** Di mana-mana warna ditulis - helaian gaya alat, cat SVG yang diimport, nilai token reka bentuk, bayang atau kecerunan di dalam ringkasan CSS - Lolly membaca keseluruhan kosa kata **CSS Color 4**: `#hex`, `rgb()`, `hsl()`, `hwb()`, `lab()`, `lch()`, `oklab()`, `oklch()`, warna bernama CSS dan `color()` dalam ruang yang ditakrifkan terlebih dahulu - `srgb`, `srgb-linear`, `display-p3`, `a98-rgb`, `prophoto-rgb`, `rec2020`, `xyz-d50`, `xyz-d65` - termasuk komponen yang ditulis sebagai kata kunci `none`. Satu penghurai melakukan ini untuk keseluruhan platform, jadi pelayar dan setiap walker eksport bersetuju tentang maksud rentetan warna.

Itu penting lebih daripada bunyinya, kerana pelayar menyelesaikan CSS moden kepada CSS moden. Tulis `color-mix(in oklab, …)` dan Chrome mengira `oklab(…)`; guna token jenama yang disimpan sebagai `oklch()` dan itulah nilai literal yang dilihat oleh walker eksport. Warna dalam bentuk-bentuk itu dibaca dengan betul dan bukannya digugurkan - itulah yang dilakukan oleh walker yang hanya memahami `rgb()`, mengeksport teks berwarna jenama sebagai hitam, kehilangan panel bertona dan garisan jadual serta membaca `oklch(0.7 0.1 200) 0px 2px 4px` sebagai anjakan bayang 0.7 dengan 0.1.

**Pemikiran.** Matematik warna berlaku secara perseptual dan bukannya pada saluran mentah. Terbitan palet, ramp, harmoni dan kontras berjalan dalam **OKLCH/OKLab**, dan warna out-of-gamut dibawa ke dalam julat oleh algoritma gamut-mapping milik CSS Color 4 sendiri - pengurangan chroma dengan semakan jarak perseptual - dan bukannya dengan clipping saluran, supaya warna terang mendarat pada warna terdekat yang benar-benar akan anda terima dan bukannya warna yang diratakan. Gradient diinterpolasi dalam ruang yang anda pilih (OKLab secara lalai, atau `oklch`, `lab`, `lch`, `srgb`, `srgb-linear`, `hsl`, dengan arah hue-travel bagi yang polar), dan pencampuran bersifat **premultiplied**, jadi satu fade ke lutsinar kekal pada warna yang betul dan bukannya menggelap ke arah hitam di tengah jalan. Satu interpolator melayani kedua-dua walker pratonton dan eksport - itulah yang menghalang sesuatu gradient conic daripada dicampur satu cara pada skrin dan cara lain dalam fail yang dieksport.

**Menulis.** Output sengaja dibuat lebih sempit daripada input, kerana fail perlu dapat dibaca oleh apa jua yang membukanya, dan ruang hanya *diisytiharkan* pada output apabila nombor benar-benar ditukar ke dalamnya. Format skrin dan web ditulis sebagai **sRGB** dan diberi tag sedemikian; format cetak ditulis sebagai **CMYK** terhadap syarat akhbar bernama (di bawah); dan laluan HDR ialah **Rec.2100 PQ** (di atas). Warna julat-luas yang sampai ke eksport dipetakan ke dalam sRGB dan bukannya disalah-labelkan - membawa `color(display-p3 …)` terus ke dalam fail vektor adalah lanjutan yang dirancang, bukan sesuatu yang didakwa dilakukan oleh eksport hari ini. Kecerunan yang dicipta dalam OKLab *dibakar* menjadi hentian sRGB biasa semasa keluar, dengan hentian tambahan dimasukkan hanya di mana sRGB akan jelas menyimpang daripada lengkung perseptual, kerana `<linearGradient>` SVG dan pembayangan aksial PDF tiada tetapan ruang-interpolasi untuk membawa niat itu. Satu nilai yang dicipta, tiga penerap, tiada lencongan.

## Profil warna

Supaya warna dihasilkan semula dengan setia dalam aplikasi terurus-warna (kedai cetak, Photoshop, pelayar), eksport **ditag dengan profil warna**:

- **PNG / JPG** membawa profil ICC **sRGB** terbenam - ruang warna yang mana pratonton sebenarnya dirender - supaya tiada apa yang perlu diteka. (Sekadar tag; piksel tidak dikod semula.)
- **PDF Cetak (CMYK)** mengisytiharkan **syarat akhbar** sasaran dalam *OutputIntent*-nya (lalai *Coated FOGRA39*), memberitahu RIP/kedai cetak bagaimana dakwat CMYK-nya sepatutnya dibaca. Swatch jenama dengan nilai dakwat yang diukur ditukar dengan tepat; warna lain menggunakan penukaran peranti standard. Isytihar itu ialah *nama*: tiada profil CMYK yang dihantar bersama Lolly, dan PDF/X-4 mahukan profil terbenam, jadi syarat bernama menulis niat output tanpa mendakwa pematuhan PDF/X-4. Muatkan profil CMYK anda sendiri dan pilih baris **Embed**-nya dalam kawalan Profil warna dan ia dibenamkan sebagai *DestOutputProfile* fail itu - pada ketika itu PDF benar-benar boleh menjadi PDF/X-4, dan mendakwanya bila-bila sahaja selebihnya fail membenarkan. Tiga perkara menahan dakwaan itu sambil mengekalkan niat output (RIP masih mahukannya): seni RGB yang tidak dapat ditukar oleh laluan CMYK, teks kredit margin-bukti `prov` (dilukis dalam fon standard yang tidak dibenamkan, dan X-4 tidak mengecualikannya) dan kata laluan **Strong**, kerana X-4 melarang penyulitan. Syarat yang diisytiharkan kemudian dibaca daripada profil itu: nama berdaftar apabila profil membuktikan satu, `Custom` di bawah nama profil itu sendiri apabila tidak, supaya fail tidak boleh menamakan satu syarat akhbar sambil membawa ukuran syarat lain.
- **TIFF Cetak (CMYK)** menulis piksel **DeviceCMYK** tanpa tag dan merekodkan syarat akhbar yang sama sebagai provenans dalam metadata TIFF-nya (*ImageDescription*) dan bukannya membenamkan profil. Kawalan Profil-warna yang sama memacu kedua-dua format CMYK - TIFF langsung tidak boleh membenamkan profil akhbar, jadi baris **Embed** merekodkan nama profil itu sendiri di situ dan tidak lebih.
- **TIFF (RGB)** ialah rakan sRGB biasa, tidak dimampat - raster tanpa kehilangan pada DPI pilihan untuk arkib atau pergi-balik penyunting, dengan provenans direkod dalam metadata TIFF yang sama. Sebarang ketelusan diratakan pada putih (profil ini tidak membawa alfa). Seperti TIFF CMYK, ia hanya untuk desktop, kerana pelayar tidak dapat pratonton TIFF dan muat turun mudah alih terhenti.
- **SVG**, **EMF**, **EPS** dan **DXF** ialah vektor tak bergantung resolusi dan profil tanpa profil terbenam - warna SVG ialah sRGB biasa, EMF dan EPS ialah RGB peranti (dan **EPS (CMYK)** menulis DeviceCMYK naif) dan **DXF** membawa AutoCAD Color Index yang terhampir. (SVG, EPS dan DXF, seperti PDF, menggariskan sebarang teks kepada laluan vektor, jadi hasilnya dirender walaupun fon tidak dipasang. EMF sebaliknya mengekalkan teks LIVE secara lalai - rekod teks metafail sebenar yang kekal boleh dipilih dan disunting dalam Office dan Google Slides, kembali kepada garisan hanya untuk lejang yang tidak dapat dinyatakan oleh format itu; pilihan "Outline fonts" panel eksport memaksa laluan di mana-mana.) **SVG** juga menghasilkan semula `box-shadow` CSS daripada HTML - setiap bayang luar dilukis di belakang kotak, anjakan/sebaran dan kabur-Gaussian sepadan dengan pelayar, dan bayang inset dilukis di dalamnya dengan cara yang sama.

Ini automatik - tiada tetapan untuk diusik. Lakaran kecil dan pratonton melangkau tag itu supaya kekal kecil. Satu profil *memang* satu pilihan, kerana ia menukar piksel dan bukan sekadar melabelkannya - lihat **HDR** di bawah.

## HDR (warna terang)

Eksport biasa adalah sRGB: putih adalah putih, dan warna jenama tepu secerah putih biasa skrin. Pada paparan berkeupayaan HDR ada banyak ruang di atas itu, dan kad **HDR** dalam panel eksport menggunakannya - warna jenama anda dan teks putih dinaikkan ke arah kecerahan puncak supaya benar-benar *bersinar*, sementara kawasan gelap kekal gelap dan memberi kontras kepada sinaran itu.

![Kad HDR dalam panel eksport, dihidupkan, dengan dail White / Reach / Dark lift / Focus didedahkan di bawahnya](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26hdr%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-hdr&walker=1&dark=1&filename=exp-hdr-card)

- **Format.** Format raster yang mempunyai ruang untuk membawa isyarat: **PNG**, **JPG**, **AVIF** dan **TIFF**. (Bukan WebP - ia 8-bit tanpa laluan nyahkod HDR yang berfungsi, jadi WebP PQ akan kelihatan gelap sahaja. Vektor dan PDF langsung tiada model HDR.)
- **Dimatikan secara lalai**, tidak seperti penandaan warna - ia mengubah piksel, jadi ia bersifat sertai-sendiri. Tanda kad itu, atau hantar `hdr=1` dalam pautan perkongsian.
- **Apa yang sebenarnya ditulis.** Piksel dikod semula kepada **Rec.2100 PQ** - warna primer BT.2020 dengan lengkung pemindahan SMPTE ST 2084 (PQ) - dan bekas itu membawa isyarat yang sepadan supaya aplikasi terurus warna tahu untuk membacanya begitu: **profil ICC v4 dengan tag `cicp`** yang dijana (JPG, TIFF), **cebisan `cICP`** (PNG) atau kotak `colr` yang ditulis semula (AVIF). Peningkatan ini dikawal berdasarkan **kecerahan persepsi (OKLab)**, jadi warna pertengahan-ke-atas ditingkatkan ke puncak dan warna gelap ditenangkan dan bukannya terlebih dedah, dan ia mengekalkan hue - hijau jenama menjadi lebih terang, bukan bertukar warna pudina.
- **Kawalan.** Empat, didedahkan apabila kad dihidupkan: **White** (siling kecerahan puncak, 400–2000 nit), **Reach** (sejauh mana ke bawah nada cahaya itu merebak), **Dark lift** (sebanyak mana kawasan gelap dicerahkan - `0` mengekalkannya gelap) dan **Focus** (sebanyak mana kekayaan warna yang dikekalkan oleh peningkatan itu). Ia menaiki param yang sama sebagai nilai terlaras padat - `hdr=1600-60-0-50` ialah White 1600, Reach 60, Dark lift 0, Focus 50 - jadi rupa terlaras boleh dihasilkan semula daripada pautan.
- **Di mana anda akan melihatnya.** Pemapar terurus warna pada paparan HDR: Preview / Quick Look / Safari pada peranti Apple, Chrome pada monitor HDR. Pada skrin SDR biasa, fail itu masih dipaparkan sebagai imej biasa.
- **Ketahui sebelum anda menghantarnya.** Banyak platform **mengekod semula** apa yang anda muat naik dan membuang isyarat HDR - rangkaian sosial, aplikasi pemesejan, sesetengah CMS - yang boleh menyebabkan imej kelihatan gelap atau pudar. Gunakan HDR di tempat anda mengawal destinasi (laman yang anda bina, dinding video, dek pada panel terang), bukan sebagai lalai untuk semua benda.
- **Ketelusan.** PNG dan AVIF mengekalkan alfa mereka; JPG legap seperti biasa. Laluan **TIFF** meratakan ke atas **hitam**, bukan putih seperti laluan SDR - dalam PQ, putih ialah kod 10,000 nit, jadi meratakan ke atasnya akan mengelilingi setiap tepi dengan halo yang menyilaukan.
- **Bait yang sama daripada terminal.** `--hdr=1` bersama `--export=png` atau `--export=jpg` turut menulis PNG Rec.2100 PQ 16-bit dan JPEG peta gandaan ISO 21496-1 pada [CLI](/info/cli.html), daripada pengekod enjin yang sama dan bukannya pelayar - jadi alat asli `<svg>` menghasilkan fail HDR tanpa sebarang Chromium di mana-mana dalam laluan itu, dan PNG itu sama bait dengan PNG cengkerang web. AVIF dan TIFF kekal sebagai eksport cengkerang web buat masa ini.

## Video

Alat beranimasi mengeksport gerakan sebagai **MP4**, **WebM** atau **GIF** - dan, di mana ditawarkan, **APNG**, **Animated WebP** atau **Animated SVG** vektor (di atas). Bekas video mana yang anda lihat bergantung pada pelayar anda - pemilih hanya menunjukkan apa yang benar-benar boleh direkodnya:

| Pelayar | Menunjukkan |
|---|---|
| Safari / iOS | **MP4** |
| Firefox | **WebM** |
| Chrome / Edge 126+ / Android | **MP4 dan WebM** |
| Chrome lebih lama | **WebM** |

GIF berfungsi di mana-mana (bagus untuk sembang/e-mel; lebih besar dan warna lebih rendah daripada video). Alat beranimasi juga mendedahkan **Wait** (saat untuk membenarkan animasi menetap sebelum merekod) dan **Duration** (panjang klip).

> Pautan `?format=…` yang dikongsi yang meminta bekas yang tidak dapat direkod oleh pelayar anda kembali dengan lancar kepada yang satu lagi dan menamakan fail itu sewajarnya.

**Bunyi.** Eksport video tidak senyap. Alat boleh meletakkan **latar muzik** di bawah klip - aset audio daripada katalog, diulang atau dipotong kepada panjang klip, dengan fade-in/out, kelantangan dan pengurangan automatik di bawah bunyi rakaman sendiri - dan alat rakaman membawa audio langsung rakaman mereka terus ke dalam fail. **MP4** dan **WebM** mengekalkan trek bercampur; GIF dan format imej beranimasi (APNG, Animated WebP, Animated SVG) senyap secara semula jadi.

## Audio

Sesetengah alat mengeksport **audio dengan sendirinya**, bukan sekadar sebagai trek video. **Voice Recorder** menangkap rakaman mikrofon dengan meter aras langsung dan bimbingan lembut, kemudian menyimpannya sebagai **MP3** (lalai, ditranskod dalam pelayar anda) atau dalam bekas asalnya - **M4A** (AAC), **OGG** atau **WebM** (Opus), yang mana sahaja direkod oleh pelayar anda. Seperti segala-galanya yang lain, pengekodan berlaku pada peranti anda - tiada apa dimuat naik.

Audio yang anda *bawa masuk* sama luasnya. Pemilih aset menerima **MP3**, **WAV**, **OGG**/**Opus**, **M4A**/**AAC** dan **FLAC** (dikekalkan bait-demi-bait dan dinyahkod pada peranti), **MIDI** (`.mid` - ditukar semasa import kepada trek sintesizer kecil pada peranti) dan **modul tracker** - **MOD**, **XM**, **IT**, **S3M**, **STM**, **MTM** (dinyahkod pada peranti oleh pemain terbina, beberapa kilobait data lagu). Mana-mana daripada ini boleh menjadi **latar muzik** di bawah eksport video, atau dimainkan dalam pemain ambien Neurospicy Mode.

Audio *memang* sebahagian daripada saluran paip `format=` / `--export=` di bawah: `wav`, `mp3`, `m4a` dan `opus` ialah id format biasa, jadi eksport audio-sahaja boleh dikongsi dan diskrip sama seperti PNG. Apa yang keluar hanyalah bunyi sahaja, tiada gambar.

## Provenans & tera air

Di mana format menyokongnya, eksport membawa **metadata provenans** - perisian, sumber, nama alat dan baris kredit profil anda - terbenam secara asli (PNG iTXt, JPEG EXIF, maklumat PDF, `<metadata>` SVG, komen GIF). Ia hanya kepengarangan; tiada apa dimuat naik. Alat **Experimental** turut mencap tera air kelihatan, digunakan oleh hos supaya tidak boleh dibuang dengan menyunting alat itu.

**Lolly Imprint.** Eksport raster juga membawa **tera air piksel tidak kelihatan** Lolly sendiri - *Lolly Imprint* - **dihidupkan secara lalai**, sama seperti Content Credentials. Di mana kredensial dan metadata provenans mengembara *bersebelahan* dengan piksel dan hilang apabila disimpan semula, ditangkap skrin atau metadata ditanggalkan, Imprint hidup *di dalam* piksel dan terselamat daripada mampatan semula - jadi salinan imej masih boleh dikenali sebagai buatan-Lolly kemudian. Ia petunjuk tahan lama, bukan jaminan kriptografi, dan ia hanya-kehadiran (tidak membawa sebarang data peribadi). Ia menumpang **PNG, JPG, WebP, AVIF, TIFF dan BMP**, dan dalam raster terenderkan-Lolly yang digubah ke dalam **PDF atau PPTX** - tidak pernah dalam imej yang *anda* benamkan, hanya dalam apa yang Lolly sendiri render. Nyahtanda kad **Lolly Imprint** dalam panel eksport untuk melangkauinya, atau lalukan `imprint=0` dalam pautan kongsi. (Ketahanan AVIF melalui pengekodan semula belum ditentukur; pengesanan PDF/PPTX meliputi raster Lolly yang dibenamkan.) [/verify](/verify) mengesannya pada peranti - lihat [Content Credentials Identity](/info/content-credentials-identity.html#the-lolly-imprint).

**Kredensial tahan lama.** Tanda kedua, lebih berat, terletak di sebelah Imprint: **Durable credential**, yang menggunakan model neural pada peranti (format TrustMark) untuk menulis id Lolly *ke dalam* piksel supaya pautan "dibuat dengan Lolly" terselamat daripada penanggalan metadata, pengekodan semula dan pembacaan semula oleh alat yang menyedari TrustMark serta alat Lolly sendiri. Ia **dimatikan secara lalai** - tidak seperti Imprint JavaScript tulen, ia mengambil kos laluan neural bagi setiap eksport ditambah muat turun model sekali sahaja, jadi ia pilih-masuk yang disengajakan dan bukan cukai senyap. Raster sahaja (**PNG, JPG, WebP, AVIF, TIFF**), ditandakan dalam panel eksport atau dilalukan sebagai `durable=1` dalam pautan kongsi. Pada aplikasi desktop dan mudah alih kad itu disembunyikan terus dan bukan ditunjukkan sebagai tiada-operasi, kerana tiada asal untuk mengambil model itu secara luar talian.

**Perlindungan kandungan.** Dalam panel eksport, *Password protect*, **C2PA Credentials**, **Lolly Imprint** dan **Durable credential** dilipat menjadi satu kumpulan **Content protection** yang runtuh dan sedar-format, supaya opsyen provenans dan perlindungan fail hidup di satu tempat - kumpulan itu hanya menunjukkan kad yang terpakai untuk format yang dipilih, dan menyembunyikan diri sepenuhnya apabila tiada satu pun terpakai. Tanda cetak sengaja *tidak* di dalamnya: ia geometri pengeluaran cetak dan bukan perlindungan, jadi **Print marks & bleed** - ukuran bleed dalam milimeter ditambah Crop, Registration, Bleed, Colour bars dan Stamp details - mengekalkan kad peringkat atasnya sendiri pada format cetak.

![Kumpulan Content protection dibuka pada eksport PNG, menunjukkan hanya kad yang terpakai kepadanya](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26imprint%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-protection&dark=1&filename=exp-content-protection)

**Sebelum anda eksport (praterbang cetak).** Hidupkan **Print preflight** (`export-preflight`) dalam bendera ciri Profil anda - ia **dimatikan secara lalai**, jadi individu yang mengeksport PNG untuk mesej sembang tidak pernah diserang tiba-tiba oleh dapatan pracetak, dan bidang kawalan penggunaan ([lolly.work](https://lolly.work)) boleh menetapkannya lalai hidup untuk ahlinya - dan kad **Before you export** muncul di kaki panel, sejurus di atas butang, apabila peraturan cetak mempunyai sesuatu yang benar untuk dikatakan tentang kerja itu: format, saiz dan bleed, kemudian kawasan trim dan bleed, liputan dakwat, kiraan plat dan kiraan halaman, dengan keputusan di sebelah tajuknya. Ia terletak di bawah setiap tetapan kerana ia satu kenyataan *tentang* tetapan itu dan bukan satu lagi daripadanya - dan ia tidak pernah menyekat eksport. Ia memberitahu anda apa yang bakal dilihat oleh kedai cetak.

**Kos, dikira daripada kad kadar anda.** Di bawah praterbang - paling akhir, masih di atas butang - terletak kad yang menukar kiraan yang sama itu menjadi wang, dan hanya sekali daripada harga yang seseorang berikan kepadanya. Ia membaca apa jua yang dikira oleh laluan praterbang, sama ada kad praterbang itu sendiri dihidupkan atau tidak, dan ia memerlukan dua perkara supaya benar: kerja itu mempunyai sesuatu yang senarai harga boleh harga langsung (plat, helaian, luas, halaman, baris varian atau fail output - jadi logo PNG biasa tidak akan menunjukkannya), **dan** **kad kadar** hadir. Kad kadar ialah senarai harga JSON daripada pencetak anda. Binaan lalai tidak membawa satu pun dan tiada cara dalam-apl untuk memuatkannya: ia tiba sama ada sebagai aset katalog yang dihantar oleh penggunaan, atau melalui sambungan kad-kadar pilihan yang dihidupkan oleh penghos-sendiri atau bidang kawalan. Tanpa kad kadar, tiada apa ditunjukkan - bukan gesaan, bukan jadual kosong.

Peraturan yang membina keseluruhan perkara ini ialah **ia tidak pernah mencipta wang**. Setiap angka ialah kadar yang anda berikan didarab dengan kuantiti yang dikira Lolly - `4 plat × €35.00` - dan jumlah itu menamakan sumbernya sendiri dalam ayat yang sama dengan angka itu: pengeluar yang dinamakan kad, dan tarikh yang kata kad itu kadarnya dari. Tiada mata wang lalai, tiada pemegang tempat dan tiada sifar berdiri untuk harga yang hilang. Apa yang dikatakan fail tentang dirinya kekal sebagai pertuturan yang dilaporkan: *"Fail berkata: … Lolly belum mengesahkan ini."*

Dan apabila ia tidak dapat mengira dengan jujur, jadual kerja **hilang** dan bukannya merosot menjadi angka kelabu atau yang diisi:

- Baris yang tidak diberi harga oleh kad bermaksud **tiada jumlah langsung** - hanya tajuk utama yang menyatakan berapa banyak yang tidak diberi harga. Jumlah separa bukanlah jawapan yang lebih kecil, ia jawapan yang salah.
- Kuantiti yang merupakan siling dan bukan kiraan tepat membawa **"up to"** terus ke dalam jumlah kecilnya, jadi sempadan tidak pernah dibersihkan menjadi angka rata.
- Kadar yang lepas tarikh sah-hinggnya menunjukkan **kiraan sahaja**, sehingga anda menekan *Use these rates anyway* - dan kemudian tarikh tamat tempoh menumpang bersama angka itu, supaya jumlah yang luput tidak boleh dibaca sebagai jumlah semasa.
- Dibuka melalui **pautan**, wang kekal tersembunyi sehingga anda memintanya pada peranti ini. Kad itu mahupun pendedahan itu tidak pernah mengembara dalam URL - sebab yang sama CLI menerima `--rate-card=<file.json>` sebagai bendera fail tempatan dan tidak pernah sebagai parameter pautan.

Kad itu adalah krom, bukan sesekali kandungan: ia ditanggalkan daripada setiap peringkat eksport, jadi ia tidak boleh menggerakkan satu piksel pun fail yang anda muat turun. Dan ia aritmetik, bukan sebut harga - hanya pencetak anda boleh memberi anda satu.

**Render tergubah.** Apabila satu alat membenamkan output alat lain (cth. *Event Name Badge* membenamkan *QR Code*), render bersarang itu disebarkan ke dalam eksport induk - ia kekal sebagai **vektor sebenar** dalam SVG dan PDF dan raster dengan tajam dalam PNG/JPG/WebP. Anak yang dibenamkan itu adalah perantaraan: ia *tidak* mendapat tera air dan *tidak* mendapat provenans tersendiri; hanya aset induk yang siap yang mendapatnya. (Komposisi meliputi SVG dan format raster; HTML/MD/TXT tidak boleh digubah.)

## Perlindungan kata laluan

Dua jenis kunci yang berasingan, kedua-duanya sepenuhnya di peranti.

**Kata laluan buka PDF** - kad *Password protect* pada panel eksport menawarkan dua peringkat:

![Kad Password protect dikembangkan pada eksport PDF, dengan medan kata laluan dan dua peringkat kunci](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpdf%26password%3Ddemo%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-pdfpass&dark=1&filename=exp-pdf-password)

- **Standard** - kunci asas 40-bit (RC4). Ia terbuka pada *mana-mana* aplikasi PDF, dan - kerana ia hanya penghalang ringan, bukan perlindungan sebenar - ia boleh dibawa dalam pautan kongsi (teks jelas, secara sengaja). Hanya `pdf` RGB.
- **Strong** - AES-256 (PDF 2.0). Kata laluannya ditaip semasa eksport dan **tidak sekali-kali** diletakkan dalam pautan; ia hanya terbuka pada aplikasi PDF yang lebih baharu (Acrobat / Preview ~2018 ke atas), dan aplikasi lama mungkin melaporkan fail sebagai rosak. Strong juga terpakai pada **PDF Print / CMYK** dan pada **setiap PDF di dalam zip kelompok** (kotak dialog pengesahan kelompok mengumpul kata laluan itu). Kerana PDF/X-4 melarang penyulitan, PDF Print yang dikunci Strong mengekalkan CMYK, tanda dan niat outputnya tetapi menggugurkan tuntutan pematuhan PDF/X-4.

Kedua-dua peringkat itu saling eksklusif dengan Content Credentials (PDF yang disulitkan tidak boleh membawa kelayakan itu).

**Muat turun yang dikunci (keseluruhan zip + pertahanan berlapis)** - eksport **ZIP** (format *ZIP* pada panel eksport, yang menggabungkan beberapa format sesuatu alat), muat turun **folder** (Projects → Download) atau **grid kelompok** boleh mengunci keseluruhan zip dengan satu kata laluan, pada dua peringkat:

- **Standard** - **ZipCrypto** tradisional: terbuka pada *mana-mana* alat unzip termasuk fungsi extract terbina-dalam Windows Explorer, tetapi lemah (hanya penghalang). Kata laluannya boleh dibawa dalam pautan kongsi `?password=`.
- **Strong** - **AES-256** (WinZip AE-2): kukuh, tetapi **tidak** terbuka pada fungsi extract terbina-dalam Windows Explorer - penerima memerlukan 7-Zip / WinZip / Keka / macOS. Ditaip semasa eksport, tidak sekali-kali diletakkan dalam pautan.

Kad *Password protect* yang sama pada panel eksport menggerakkan kedua-dua kunci PDF dan ZIP, dan menukar kata-katanya mengikut format yang dipilih. Satu kata laluan itu melindungi **setiap** ahli - imej, SVG, semuanya, termasuk PDF (hanya bekas zip boleh melindungi fail bukan PDF, yang tiada kunci tersendiri). Dan ia **pertahanan berlapis**: mana-mana PDF di dalamnya *juga* dikunci AES-256 secara berasingan dengan kata laluan yang sama, jadi PDF itu kekal terkunci walaupun selepas zip dibuka. Gesaan itu muncul apabila anda memulakan muat turun; kata laluan kosong bermakna tiada kunci.

**Pautan kongsi berkunci kata laluan** - mana-mana pautan kongsi boleh disulitkan supaya membukanya meminta kata laluan daripada penerima. Keseluruhan keadaan pautan itu disulitkan AES-256 di bawah kunci yang diterbitkan daripada kata laluan (PBKDF2); hanya teks sifer yang dibawa, jadi **kata laluan tidak sekali-kali berada dalam pautan** dan penyahsulitan berlaku **di dalam pelayar penerima** - pelayan yang menyajikan pautan itu hanya melihat teks sifer dalam URL, tidak sekali-kali kata laluan dan tidak sekali-kali reka bentuk yang telah dinyahsulit. Hidupkannya dalam kotak dialog **Share**. Pautan yang disulitkan hanya boleh *dibuka* dalam Lolly (ia tidak boleh dibenamkan sebagai imej, kerana laluan itu tidak boleh menggesa). Lihat [URL Mode → Encrypted links](/info/url-mode.html).

## Content Credentials (C2PA)

Eksport boleh membawa **Content Credentials** - manifes [C2PA](https://c2pa.org) bertandatangan yang dibenamkan dalam fail, merekodkan, secara terbukti-usik, bahawa fail itu dibuat dengan Lolly dan tidak diubah sejak itu. Ia adalah versi piawaian bagi metadata provenans di atas: tuntutan kriptografi (apa yang membuat fail itu, bila, oleh siapa dan di mana) yang diikat kepada cincang bait fail itu, jadi apa-apa suntingan kemudian dapat dikesan oleh pemapar yang mesra-C2PA. Piawaian ini dikendalikan oleh [Content Authenticity Initiative](https://contentauthenticity.org) (Adobe, BBC, Microsoft, Nikon dan lain-lain), jadi kelayakan yang sama yang ditulis oleh Lolly adalah kelayakan yang sedang digunapakai oleh kamera, bilik berita dan suite kreatif.

![Kad C2PA Credentials, sudah ditanda, dengan jangka hayat kelayakan di sebelahnya](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26c2pa%3D30%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-c2pa%5Bdata-c2pa-only%5D&walker=1&dark=1&filename=exp-c2pa-card)

- **Format.** Setiap bekas dengan pembenaman C2PA: **PDF** (RGB dan Print), **PNG / Animated PNG**, **JPG**, **GIF**, **SVG**, **TIFF** (RGB dan Print), **WebP** (statik dan animasi), **AVIF**, **MP4**, **WebM** dan bekas audio **MP3**, **WAV**, **M4A** dan **OGG/Opus** - jadi klip suara yang dirakam atau disintesis dihantar dengan kelayakan yang sama seperti sesebuah gambar. Bundel **ZIP** mencap setiap ahli yang disokong secara berasingan, dan di situlah juga **Animated SVG** memperoleh miliknya (ia hanyalah dokumen SVG biasa di bawahnya; eksport Animated SVG langsung tidak menawarkan kad tersendiri). MP4, AVIF dan M4A menggunakan pengikatan BMFF spesifikasi itu dan MP3 pula pemetaan ID3v2-nya, jadi `c2patool` dan pemapar mesra-C2PA yang lain dapat mengesahkannya; **WebM** dan **OGG/Opus** belum mempunyai pemetaan C2PA piawai lagi, jadi Lolly membawa manifes itu sebagai lampiran Matroska dan medan OpusTags masing-masing, yang disemak oleh pengesah Lolly sendiri (dan CLI). (`ico`, `eps`, `emf`, `dxf`, `bmp`, `pptx`, format Office dan format teks/data tiada bekas C2PA.)
- **Hidup secara lalai.** Kad **C2PA Credentials** dalam panel eksport sudah dipratanda untuk hampir setiap alat - nyahtanda untuk melangkau kelayakan itu pada satu-satu eksport (atau lulus `c2pa=off` dalam pautan kongsi). Sesebuah alat boleh menarik diri sepenuhnya dalam manifesnya.
- **Apa yang direkodkan.** Alat dan aplikasi yang membuat fail itu, masa penandatanganan, permukaan eksport (keluarga enjin pelayar + keluarga OS - kasar secara sengaja, tidak sekali-kali cap jari) dan - hanya apabila *Profile → Use my details* dihidupkan - nama dan e-mel anda sebagai pengarang karya itu.
- **Apa yang dilihat oleh penerima.** Alat pemeriksa content-credentials (aplikasi Adobe, `c2patool`, contentcredentials.org/verify) akan membaca manifes itu dan memaparkan tuntutan tersebut. Kerana Lolly menandatangani dengan kunci yang dijana **pada peranti anda** - bukan sijil daripada senarai amanah - pemapar melaporkannya sebagai kelayakan yang *tidak disahkan*. Struktur dan bukti-usiknya adalah sebenar; identiti penandatangan sahaja yang tidak dijamin oleh mana-mana pihak berkuasa. Untuk menaik taraf itu, anda boleh mendaftarkan **identiti tersahih** (Profile → Content Credentials): sijil berjangka pendek daripada Lolly CA mengikat e-mel anda kepada eksport anda sementara kunci penandatanganan itu tetap tidak sekali-kali meninggalkan peranti anda - lihat [Content Credentials Identity](/info/content-credentials-identity.html).
- **Menyemak sesuatu fail.** Lolly turut mengesahkan kelayakannya sendiri: jatuhkan mana-mana fail pada [/verify](/verify) (atau jalankan `lolly validate <file>` dalam CLI) untuk laporan di peranti - diketuai oleh sama ada fail itu sememangnya dibuat dengan Lolly dan tidak berubah sejak itu. Paparan Verify web membaca jauh melebihi kelayakan itu: ia menandakan **kandungan janaan AI**, mengesan **Lolly Imprint**, menyemak tandatangan **SEAL** dan (opt-in) tera air piksel pihak ketiga serta mendedahkan **data tersembunyi** - kesemuanya di peranti, tiada apa yang dimuat naik. Lihat [Content Credentials Identity → Beyond the credential](/info/content-credentials-identity.html#beyond-the-credential-what-else-verify-shows).
- **Privasi.** Semuanya berlaku pada peranti anda: kunci penandatanganan dicipta untuk eksport itu dan tidak sekali-kali meninggalkan pelayar, tiada apa dimuat naik dan tuntutan itu hanya mengandungi apa yang metadata provenans sudah bawa. Utiliti privasi (transformasi di peranti bagi fail anda *sendiri*) tidak sekali-kali menambah kelayakan, dan *Strip Hidden Data* akan mengeluarkan manifes C2PA seperti mana-mana metadata terbenam yang lain.
- **Interaksi.** Bagi PDF, Content Credentials dan **perlindungan kata laluan** (mana-mana peringkat - lihat di atas) saling eksklusif (PDF yang disulitkan tidak boleh membawa lampiran kelayakan itu). Kelayakan itu ditambah sebagai langkah terakhir ke atas bait yang telah siap - selepas cap DPI/EXIF/profil warna, metadata PDF/X dan tanda cetak.

## Pada telefon

Kawalan eksport berada di sebalik butang terapung **Render**, yang membuka helaian **Export** - format, saiz, salin, muat turun dan kongsi yang sama, disaiz untuk sentuhan.

## Rujukan format

Setiap id yang boleh dipaparkan oleh hos, dikumpulkan. Ini juga nilai untuk parameter URL `format=` dan bendera CLI `--export=` - lihat [URL Mode](/info/url-mode.html) dan [CLI](/info/cli.html). Sesebuah alat hanya menawarkan subset yang diisytiharkan oleh pengarangnya, jadi pemilih sentiasa lebih pendek daripada senarai ini.

| Jenis | Id |
|---|---|
| Raster | `png` · `jpg`/`jpeg` · `webp` · `avif` · `tiff` (RGB TIFF) · `cmyk-tiff` (Print TIFF) · `bmp` · `ico` |
| Vektor | `svg` · `svgz` (SVG digzip) · `emf` · `wmf` · `eps` · `eps-cmyk` (EPS CMYK) · `dxf` (fail potong) |
| Halaman & dokumen | `pdf` · `pdf-cmyk` (Print PDF) · `pptx` (PowerPoint) · `scorm` (pakej kursus SCORM, fail zip) · `penpot` (fail reka bentuk Penpot) · `docx` (Word) · `odt` (OpenDocument Text) |
| Gerakan | `gif` · `apng` (Animated PNG) · `webp-anim` (Animated WebP) · `svg-anim` (Animated SVG) · `webm` · `mp4` |
| Audio | `wav` · `mp3` · `m4a` · `opus` |
| Teks & data | `html` · `md` · `txt` · `json` · `csv` · `ics` · `vcf` · `css` · `scss` · `gpl` (palet GIMP) |
| Gabungan | `zip` |

Beberapa id lagi datang daripada **cangkuk eksport alat itu sendiri** dan bukan laluan render kongsi: `ase` (Adobe Swatch Exchange, daripada Palette Lab), `exr` dan `hdr` (raster julat dinamik tinggi Darkroom) dan `ttf` / `otf` / `woff` (Font Convert). Ia memilih format dengan cara yang sama - pemilih, `format=`, `--export=` - hanya bait itu yang dibina oleh alat itu sendiri. Font Convert adalah satu-satunya pengecualian: ia mentransformasikan fail fon yang *anda* sendiri bekalkan, jadi tiada apa untuk URL kosong papar.
