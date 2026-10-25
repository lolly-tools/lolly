# Eksport fail

Anda telah membuat sesuatu dan ia perlu meninggalkan Lolly: PNG untuk sembang, PDF untuk pencetak, dek yang rakan sekerja akan terus sunting. Tekan **Export**, separuh kiri pil **Export | Save**. Pilih format di sebelah nama fail, kemudian tekan **Download**. Fail dibuat pada peranti anda.

Apa yang anda lihat pada kanvas ialah apa yang fail mengandungi. Menu format hanya menyenaraikan apa yang boleh dibuat alat ini dalam pelayar ini.

Untuk kebanyakan tugas, salah satu daripada tiga format sesuai:

| For | Choose | Because |
|---|---|---|
| Skrin, mesej atau slaid | **PNG** | Setiap aplikasi boleh membukanya, dan ia mengekalkan latar belakang lutsinar apabila alat itu menawarkannya |
| Halaman siap, atau apa jua yang dicetak | **PDF** | Saiz halaman sebenar yang tercetak seperti rupanya; **Print PDF**, jika ditawarkan oleh sesuatu alat, ialah versi CMYK untuk akhbar cetak |
| Karya seni yang perlu kekal tajam pada sebarang saiz | **SVG** | Bentuk vektor, tajam daripada lencana hingga sepanduk |

::: check Semak fail itu pada saiz yang akan digunakan
Sebelum anda menghantarnya, buka pada skrin yang menjadi tujuannya, atau cetak pada saiz sebenarnya.
:::

::: details Kelulusan dan penghantaran dengan Lolly Work (pilihan)
[Organisasi yang menjalankan Lolly Work](/info/organisation.html) boleh mentadbir format dan tetapan eksport yang dilihat ahlinya. Di mana kelulusan diperlukan, **Request approval** menggantikan **Download**. Ikuti dasar yang ditunjukkan instans anda.

Lolly Work juga boleh menghantar fail ke destinasi S3, WebDAV dan HTTP yang dikonfigurasi, dengan langkah kelulusan, resit penghantaran dan rekod audit. Menyerahkan fail untuk aliran kerja itu menghantarnya ke perkhidmatan organisasi; muat turun biasa kekal pada peranti anda. Destinasi Send peribadi dan penghantaran organisasi dikonfigurasi secara berasingan.

Pengendali menyediakan ini dengan [organisation delivery guide](/info/work-delivery.html). Untuk render pelayan dan kelompok yang beratur, lihat [CLI batch and automation](/info/cli-automation.html#organisation-jobs-with-lolly-work).
:::

## Cara Eksport Berfungsi

Apabila anda mengeksport, kanvas alat dirender kepada format yang anda pilih dan diserahkan kepada anda sebagai muat turun, atau diletakkan pada papan keratan.

Tiga laluan menghasilkan fail. Kebanyakan alat **merender kanvas**. Format teks dan data (HTML, Markdown, TXT, JSON, CSV, ICS, VCF) **dijana daripada kandungan alat** dan bukan dilukis daripada gambar. Utiliti privasi seperti *Strip Hidden Data* **mengubah fail yang anda pilih**, pada peranti anda, dan menyerahkannya kembali tanpa kanvas, tera air atau metadata tambahan, kerana ia sudah menjadi fail anda sendiri.

![Tiga laluan eksport bertemu pada fail siap: render kanvas, jana teks atau data daripada kandungan, atau ubah fail pilihan pada peranti.](/info/diagrams/concepts/three-export-paths.svg)

Panel eksport menawarkan tindakan ini. Pengarang alat memilih yang mana muncul; set lalai ialah Copy, Download dan Save.

- <!--i:download--> **Download** menyimpan fail. Jika anda tidak menjumpainya selepas itu, lihat [Find a file you downloaded](/info/find-your-work.html#find-a-file-you-downloaded).
- <!--i:photos--> **Copy** meletakkan imej pada papan keratan anda, sedia ditampal ke dalam sembang, e-mel atau dokumen. Di mana pelayar tidak boleh menyalin imej, ia memuat turun sebaliknya dan memberitahu anda.
- <!--i:folder--> **Save** menyimpan reka bentuk semasa dalam Projects dengan satu klik dan tidak pernah memuat turun fail. **Save as**, di sebelah **Download**, bertanya di mana (lihat [Saving and continuing](/info/using.html#saving-continuing)).
- <!--i:link--> **Share** membuka dialog Share: pautan yang menghasilkan semula reka bentuk, togol semasa lawatan (skrin penuh, panel eksport, muat turun atau salin semasa dibuka) dan **Shortest link** pilihan yang memadatkan seluruh keadaan ke dalam token padat (lihat [URL Mode](/info/url-mode.html)).

![Panel eksport - format, saiz dan tindakan Copy / Download / Save / Share](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&walker=1&dark=1&filename=export-panel)

Apabila reka bentuk membenamkan render alat lain, seperti kotak imej Design yang memegang pautan QR Code, render bersarang dilukis ke dalam eksport induk. Ia kekal vektor sebenar dalam SVG dan PDF dan dirasterkan dengan tajam dalam PNG, JPG dan WebP. Render terbenam tidak mendapat tera air dan tiada asal-usul sendiri; hanya fail siap yang mendapatnya. Eksport HTML, Markdown dan TXT tidak boleh memegang render tergubah.

## Pilih format

Nama fail dan menu format terletak bersama sebagai satu pasangan `name.format`, di bawah **Muat turun**.

![Medan nama fail bergabung dengan pemilih format, jadi eksport dibaca sebagai satu pasangan name.format](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.filename-extension&walker=1&dark=1&filename=exp-format-picker)

Mulakan dari tempat fail itu akan pergi. Setiap kad menyenaraikan format yang sesuai untuk destinasi itu; alat hanya menunjukkan yang boleh dibuatnya.

::: figure exporting-format-chooser
Enam destinasi dan format yang sesuai untuk setiap satu.
:::

Logotaip yang ditetapkan dalam muka sistem reka bentuk anda dieksport sebagai SVG dengan setiap huruf sebagai laluan bergaris luar, jadi satu fail kekal tajam pada saiz kad perniagaan dan pada saiz pembungkus bangunan.

![Logotaip jarak lebar garis halus berbunyi Aurora, jenis karya vektor tulen yang menjadi perkara baris SVG dalam jadual](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DAurora%26weight%3D200%26tracking%3D16%26size%3D200%26full&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=%23tool-canvas&walker=1&format=svg&filename=vt-wordmark-vector)

::: details Setiap format dan untuk apa
| Anda mahu | Gunakan | Sebab |
|---|---|---|
| Logo atau karya tajam yang diskalakan | **SVG** | Vektor: boleh diskala, kecil dan boleh disunting; kesan yang tidak dapat dilukis eksport vektor dibenamkan sebagai imej |
| Vektor untuk apl Office dan Windows | **EMF** | Ditampal sebagai vektor boleh sunting ke dalam PowerPoint dan Word, dengan teks langsung; Google Drive membukanya dalam Google Drawings |
| Vektor untuk cetakan dan apl reka bentuk | **EPS**, atau **EPS (CMYK)** | Vektor PostScript untuk Illustrator dan aliran kerja mesin cetak |
| Vektor untuk mesin pemotong | **DXF** | Pemotong laser, plotter vinil dan CNC: laluan garis luar dalam milimeter |
| Dek slaid boleh sunting | **PowerPoint** (PPTX) | Teks dan bentuk boleh sunting asli, dengan imej dan vektor kekal boleh diekstrak |
| Dokumen teks boleh sunting | **Word** (DOCX) atau **OpenDocument** (ODT) | Perenggan dan tajuk sebenar yang boleh terus disunting pemproses perkataan (Doc Studio) |
| Reka letak untuk InDesign | **InDesign IDML (static subset)** | Teks, segi empat, bujur dan imej, satu hamparan bagi setiap artboard (Design) |
| Dokumen Penpot boleh sunting | **Penpot** | Papan, bentuk, teks dan token berpaut |
| Foto atau imej serba guna | **PNG** (tanpa kehilangan) atau **JPG** (lebih kecil) | Raster sejagat |
| Imej moden lebih kecil | **WebP** atau **AVIF** | Mampatan lebih baik, dengan ketelusan |
| Cetakan | **PDF**, atau **Print PDF** (CMYK) | Saiz halaman sebenar; CMYK untuk mesin cetak |
| Raster cetakan untuk mesin cetak | **Print TIFF** (CMYK) | Piksel DeviceCMYK untuk RIP |
| Beranimasi untuk web | **GIF** | Dimainkan di mana-mana; fail lebih besar |
| Beranimasi dengan warna penuh dan ketelusan sebenar | **APNG** | PNG beranimasi: tiada had palet |
| Beranimasi, fail terkecil | **Animated WebP** | Warna penuh dan ketelusan, lebih kecil daripada GIF atau APNG |
| Vektor beranimasi yang diskalakan | **Animated SVG** | Serba lengkap; berulang dalam pelayar atau `<img>`, pada sebarang saiz (Lottie Ad) |
| Animasi yang kekal boleh disunting | **dotLottie** | Bentuk, laluan dan kunci transformasi luar daripada garis masa Design |
| Penyerahan Premiere | **Premiere XML + media** | Klip bermasa dan media asal untuk Premiere (Design) |
| Video untuk sosial dan perkongsian | **MP4** atau **WebM** | Kualiti terbaik untuk saiz fail (lihat [Video](#video)) |
| Kapsyen | **SRT** atau **VTT** | Teks bermasa untuk pemain video (Captions, Audiogram dan Record) |
| Kursus latihan | **SCORM (LMS)** | Laman web berversi, pakej SCORM atau xAPI (lihat [SCORM](#scorm-course-packages)) |
| Teks kaya atau tandatangan e-mel | **HTML** | Ditampal berformat ke dalam klien mel |
| Kandungan biasa | **MD** atau **TXT** | Teks sahaja |
| Acara kalendar | **ICS** | Diimport ke mana-mana apl kalendar |
| Kad hubungan | **VCF** | Diimport ke buku alamat |
| Data berstruktur untuk diimport semula | **JSON** atau **CSV** | Pergi-balik kandungan alat |
| Favicon | **ICO** | Ikon tapak berbilang saiz; **ZIP** membungkus beberapa format |
:::

### Ketelusan

Alat yang menyokongnya menawarkan togol latar telus, seperti **No BG**. PNG, WebP, AVIF, SVG, APNG dan Animated WebP mengekalkan ketelusan, dan GIF mengekalkan tepi keras. JPG dan PDF sentiasa legap. TIFF diratakan ke atas putih, atau ke atas hitam pada laluan HDR yang diterangkan di bawah [HDR](#hdr-bright-colours).

## Saiz dan unit cetakan

Eksport menggunakan saiz piksel asli alat melainkan alat menawarkan **dimensions**. Kemudian anda menetapkan lebar, tinggi dan **unit**:

- **px** (lalai) ialah piksel tepat.
- **mm, cm, in, pt** dan **pc** ialah saiz fizikal. Dengan unit fizikal anda juga menetapkan **DPI** (300 secara lalai). **PDF** menjadi halaman sebenar pada saiz itu, **raster** mendapat bilangan piksel untuk DPI itu dan merekodkan resolusi, dan **SVG** mengekalkan unit fizikal dengan viewBox piksel.

Untuk raster resolusi lebih tinggi, masukkan lebar dan tinggi lebih besar, atau pilih unit fizikal dan naikkan DPI (piksel = saiz × DPI). Lebar `210`, tinggi `297` dan unit `mm` membuat halaman A4.

![Baris dimensi ditetapkan kepada 210 kali 297 mm, dengan medan DPI didedahkan kerana unit adalah fizikal](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26w%3D210%26h%3D297%26unit%3Dmm%26format%3Dpdf%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-dims&walker=1&dark=1&filename=exp-export-dims)

## Gambar Diam Daripada Komposisi Bermasa

Gubahan bermasa, seperti garis masa [Sequence](/info/sequence-editor.html) dalam Design, bergerak, jadi eksport pegun mesti memilih satu saat: **bingkai pada kepala main**. Letakkan kepala main di tempat anda mahu gambar dan eksport.

Untuk lebih daripada satu saat, medan **Frames** muncul di sebelah saiz output. Ia hanya ditunjukkan untuk gubahan bermasa dan format pegun (PNG, JPG, WebP, SVG atau PDF). Biarkan pada `1` untuk bingkai kepala main. Naikkan dan anda mendapat sebanyak itu gambar pegun, tersebar sekata merentasi seluruh jujukan:

- PNG, JPG, WebP dan SVG kembali sebagai satu ZIP: `<name>-01.png`, `-02.png` dan seterusnya.
- PDF kembali sebagai satu dokumen dengan sebanyak itu halaman.

Setiap gambar pegun datang dari tengah kepingannya pada garis masa, jadi bingkai pertama tidak pernah kemasukan separuh pudar dan yang terakhir tidak pernah saat kosong selepas setiap klip tamat.

::: figure exporting-contact-sheet
Frames: 4 memotong jujukan kepada empat keping sama dan mengambil tengah setiap satu.
:::

Gunakannya untuk papan cerita, helaian sentuh semakan atau karusel sosial yang dipotong daripada suntingan video. Kiraan dihadkan pada 64, dan apa-apa lain yang ditaip ke dalam medan kembali kepada `1`. Setiap bingkai ialah gambar pegun biasa, jadi kredensial, Imprint, unit fizikal dan DPI berkelakuan seperti untuk satu eksport. Pautan eksport, CLI dan MCP meminta helaian yang sama dengan `cuts=` (lihat [Contact sheets](/info/url-export.html#contact-sheets)).

## Banyak fail sekali gus

Lolly mempunyai tiga cara bekerja dalam kuantiti, masing-masing untuk tugas berbeza:

::: cols
## Jadual menjadi satu dokumen
Alat dengan input jadual, seperti **Battlecards**, menukar setiap baris menjadi halaman. Tampal jadual daripada hamparan anda dan dapatkan satu PDF. Baiki baris dalam hamparan dan tampal semula.
## CSV menjadi satu fail bagi setiap baris
**Batch** (`#/batch`) mengambil CSV dan merender satu eksport bagi setiap baris: lencana nama atau sijil, satu fail setiap satu, dihantar dalam ZIP. Lihat [Batch](/info/batch.html#make-many-versions-of-one-design).
## Beberapa reka bentuk mendapat satu suntingan
**Multi-edit** membuka beberapa sesi tersimpan bersebelahan untuk sentuhan akhir yang sama merentasi reka bentuk berbeza. Lihat [Multi-edit](/info/batch.html#edit-several-saved-designs-together).
:::

Daripada **Projects**, **Render folder** mengeksport setiap sesi tersimpan dalam folder dan sub-foldernya sebagai satu ZIP bersarang, dan **Render selection** melakukan perkara yang sama untuk sebarang pilihan berbilang; satu sesi tersimpan dirender ke failnya sendiri. Sesi tersimpan juga boleh dikongsi semula sebagai pautan alat daripada Projects, yang membukanya semula dengan tetapan yang sama.

## Fail yang kekal boleh disunting di tempat lain

Sesetengah format menyerahkan kerja anda kepada aplikasi lain sebagai kandungan boleh sunting dan bukan gambar.

### PowerPoint (PPTX)

Design, Markdown Slides, Booklet, Doc Studio, Chart, Diagrams, Flow Chart dan Agenda mengeksport dek PowerPoint, satu slaid bagi setiap halaman. Setiap halaman dipisahkan menjadi objek asli, supaya rakan sekerja boleh menyunting dek dan mengambil aset daripadanya:

- <!--i:font--> **Teks** menjadi kotak teks PowerPoint boleh sunting dengan saiz fon, warna, berat, italik dan penjajaran reka letak.
- <!--i:pentool--> **Vektor** seperti logo dan ikon dibenamkan sebagai gambar SVG; ia kekal tajam, dan PowerPoint boleh *Convert to Shape* padanya.
- <!--i:photos--> **Imej** datang pada resolusi asli sebagai gambar tersendiri. Hero yang dipotong mengekalkan imej penuh di belakang potongan, dan sebarang penapis atau adunan padanya dibakar masuk.
- <!--i:layers--> **Latar, sempadan dan garis** menjadi bentuk segi empat dan garisan.

![Panel eksport dengan PowerPoint dipilih: satu slaid setiap halaman, teks dan bentuk kekal boleh disunting](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio%3Foptions&width=1440&height=900&dpi=192&waitMs=2500&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22pptx%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-pptx)

Reka letak adalah anggaran; matlamatnya ialah kandungan boleh guna semula. Apa-apa yang tidak dapat diungkapkan pejalan secara asli, seperti kawasan bertapis atau bertopeng yang kompleks, dibenamkan sebagai gambar supaya tiada apa-apa hilang. Dek mempunyai satu saiz slaid, diambil daripada halaman pertama.

PowerPoint juga jalan masuk: [Rebrand a deck](/info/rebrand.html) memindahkan dek ke sistem reka bentuk anda, dan [Import a design](/info/design-import.html) membukanya dalam Design.

### Penpot

Kebanyakan alat yang mengeksport SVG juga mengeksport **fail Penpot** (`.penpot`), sedia untuk terus disunting dalam Penpot.

| Apa yang anda buat | Dalam Penpot |
|---|---|
| Teks | Objek teks boleh sunting: baiki salah taip atau ubah gaya |
| Bentuk, laluan, kecerunan dan imej | Bentuk vektor boleh sunting tersendiri |
| Warna atau fon daripada token sistem reka bentuk | Pautan token langsung: sunting token dan setiap bentuk yang mewarisinya mengikut |
| Keseluruhan reka bentuk | Komponen boleh guna semula dalam panel Assets |
| Ilustrasi kompleks atau kanvas langsung | Dibenamkan sendiri sebagai imej, kandungan boleh sunting di sekelilingnya tidak disentuh |

Daripada Design, setiap bingkai menjadi papan Penpot. Warna dan tipografi sistem reka bentuk mendarat dalam panel Assets dan set token penuhnya dalam panel Tokens. Penpot menyimpan salinannya sendiri dari situ: token yang disunting dalam Penpot kembali melalui import dalam [Design System Setup](/info/brand-studio.html).

![Panel eksport dengan Penpot dipilih: fail .penpot, dan Send to Penpot di sebelah muat turun](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22penpot%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-penpot)

Untuk membuka fail, mulakan Penpot, pilih projek dan pilih **Import**. Apabila log masuk ke Penpot daripada panel eksport, **Send to Penpot** melakukan langkah itu untuk anda.

### Word, OpenDocument dan InDesign

**Doc Studio** mengeksport **Word** (DOCX) dan **OpenDocument** (ODT) dengan perenggan dan tajuk sebenar.

**Design** mengeksport **InDesign IDML (static subset)**: teks, segi empat, bujur dan imej PNG atau JPEG, satu hamparan bagi setiap artboard. Pemformatan sebaris yang disokong kekal boleh sunting, imej dibawa dalam `Links` dan koordinat menjadi titik InDesign. Pemautan semula, penggantian fon dan pembungkusan yang berubah mungkin memerlukan perhatian. Kesan, animasi, cerita tergubah dan geometri yang tidak disokong menghentikan eksport dengan laporan yang menyenaraikannya. IDML tidak mengekalkan dokumen asal, jadi hantar PDF untuk karya siap.

### Garis masa: dotLottie dan Premiere

Daripada garis masa Design, **dotLottie** menulis animasi yang kekal boleh disunting dalam alat Lottie; [Lottie animations](/info/sequence-editor.html#lottie-animations) menyenaraikan apa yang dikekalkannya. **Premiere XML + media** membungkus klip bermasa dan media asalnya untuk Premiere; lihat [Premiere XML exchange](/info/sequence-editor.html#premiere-xml-exchange).

### SCORM (pakej kursus)

Eksport kursus mati sehingga anda menghidupkan **Training and courses** di bawah Settings → Preferences → Feature flags.

Kemudian pilih **Export course** daripada alat yang disokong, folder projek atau pilihan. Dalam Design, memilih **SCORM (LMS)** dan **Download** membuka aliran kerja kursus yang sama. Lolly menyimpan kerja, membolehkan anda menyemak kandungan dan susunan kursus, kemudian membuka modul dan dialog eksportnya.

- <!--i:layers--> Pilih rendisi bagi setiap sumber: halaman pegun, gerakan sebagai video, audio atau sumber boleh muat turun. Tambah teks pelajaran dan alternatif bacaan dalam modul.
- <!--i:clock--> Pratonton pemain pelajar dan semak keterangan serta kapsyen. Gerakan disertakan sebagai video, termasuk animasi senyap.
- <!--i:document--> Pilih Website, SCORM 1.2, SCORM 2004 4th Edition atau sasaran xAPI eksperimen. Semak kandungan dan saiz ZIP, kemudian simpan dan muat turun versi yang disemak.
- <!--i:check--> Penyiapan memerlukan pengakuan setiap pelajaran wajib dan memilih Finish.

![Panel eksport pada satu dek Design dengan SCORM (LMS) dipilih](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour%26format%3Dscorm%26options&width=1440&height=900&dpi=192&waitMs=3500&css=.fc-insp%7Bdisplay%3Anone!important%7D.edge-dock-slot--fill%7Bflex%3A1%201%20auto!important%3Bheight%3Aauto!important%3Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D.export-popup.is-floating%7Bheight%3Aauto!important%7D.export-popup-body%7Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D&drive=click:.edge-dock-tab%3Ahas-text%28%22Export%22%29;wait:600&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-scorm)

Pakej memegang kandungan siapnya dan tidak memerlukan akaun Lolly. Letakkan ZIP Website pada hos HTTP(S); import ZIP LMS tanpa perubahan. Uji destinasi sebelum anda berkongsi kursus. Untuk kursus yang dibina daripada beberapa ciptaan tersimpan, lihat [Create a training course](/info/training-creators.html).

### DXF (fail potong)

Asset Export, Diagrams, Growth, Logo Wall, QR Code, Street Map, Wayfinding dan Wordmark mengeksport **DXF**, format pertukaran AutoCAD R12 yang dibaca pemotong laser, plotter vinil dan perisian CNC. Geometri ditulis sebagai laluan garis luar dalam milimeter, teks digariskan luar dan warna dipetakan kepada AutoCAD Color Index terdekat, yang biasanya memacu operasi pemotong. DXF hanyalah seni garis: kawasan fotografi atau bertapis tiada laluan potong dan digugurkan, dengan amaran. Gunakan SVG atau PDF untuk mengekalkan kandungan raster.

Street Map ialah kes yang paling jelas. Seluruh reka bentuk sudah berupa lejang, jadi setiap jalan dan terusan menjadi laluan potong.

::: showcase
![Render Street Map bagi Paris dalam dakwat pada krim - seni garis tulen, jadi setiap lejang terselamat dalam perjalanan ke pemotong](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Dparis%26roadColor%3D1a1a2e%26waterColor%3D93c5fd%26background%3Dfaf7f2%26full&width=1440&height=900&dpi=96&waitMs=3200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-street-map-cut)

Tatal, dan kamera menarik diri kembali melalui geometri sebenar: tujuh laluan, tiada piksel di mana-mana, setiap lejang setajam rerambut pada sebarang zum. Itulah fail yang sama yang dibaca oleh pemotong.
:::

## Cetakan

**Print PDF** menulis CMYK terhadap keadaan mesin cetak bernama, **Coated FOGRA39** secara lalai. Swatch jenama dengan nilai dakwat yang diukur ditukar dengan tepat; warna lain menggunakan penukaran peranti piawai. **Print TIFF** menulis piksel DeviceCMYK untuk RIP dan merekodkan keadaan mesin cetak yang sama dalam metadata TIFF-nya. Kawalan Colour profile memacu kedua-duanya; [Colour profiles](#colour-profiles) mempunyai butirannya.

**Print marks & bleed** mempunyai kadnya sendiri pada format cetakan: bleed dalam milimeter serta Crop, Registration, Bleed, Colour bars dan Stamp details.

Sesetengah alat membina **PDF berbilang halaman**: muka depan, kandungan yang mengalir ke sebanyak mana halaman yang diperlukan dan halaman belakang, seperti dalam alat *Booklet*. Setiap halaman ialah halaman PDF potret sebenar dalam A4, US Letter atau A5, dan anda boleh memaksa mana-mana blok ke halaman baharu. Ini ialah dokumen RGB tanpa tanda potong atau bleed, yang milik Print PDF satu halaman. PDF Design juga boleh menjadi **Notes handout**: halaman potret bagi setiap slaid dengan nota penuturnya di bawah.

**Before you export.** Kad **Before you export** di kaki panel menyatakan apa yang kedai cetak akan lihat: format, saiz dan bleed, kawasan trim dan bleed, litupan dakwat, bilangan plat dan bilangan halaman, dengan keputusan di sebelah tajuknya. Ia tidak pernah menyekat eksport. Design sentiasa menunjukkan kad dengan semakannya sendiri, termasuk peraturan dalaman sistem reka bentuk lapisan demi lapisan dan isyarat penulisan bagi teks dokumen ([Before you export](/info/design.html#before-you-export)), dan menambah semakan cetakan ini apabila **Print preflight** hidup. Dalam alat lain, hidupkan **Print preflight** di bawah Settings → Preferences → Feature flags; ia mati secara lalai, dan penempatan Lolly Work boleh menghidupkannya untuk ahlinya.

**After you export.** Setelah fail sedia, Lolly membacanya semula dan membandingkannya dengan apa yang anda pilih: format, saiz piksel atau halaman, panjang klip, latar telus, warna CMYK, HDR, Content Credentials dan kata laluan PDF atau ZIP. Apa-apa yang berbeza ditulis pada kad eksport. Setiap ukuran datang daripada fail, tidak pernah daripada tetapan, dan sifat yang tidak dapat dijawab fail tidak dikira sebagai padanan. Baris perintah menulis perbandingan penuh dengan `--export-report` (lihat [Render with the CLI](/info/cli-rendering.html)).

Semakan inspektor Design dan perbandingan jenama dalam Design System Setup ialah semakan berasingan: ia melihat reka bentuk, manakala dua kad ini melihat fail.

::: details Kos daripada kad kadar
Di bawah preflight, kad kos menukar kiraan yang sama kepada wang, menggunakan hanya harga yang dibekalkan seseorang. Ia membaca kiraan itu walaupun kad preflight sendiri mati. Ia memerlukan dua perkara: tugas yang boleh dihargakan senarai harga (plat, helaian, kawasan, halaman, baris varian atau fail output, jadi PNG logo biasa tidak pernah menunjukkannya) dan **kad kadar**, senarai harga JSON daripada pencetak anda. Binaan lalai tidak membawa satu dan tiada cara dalam apl untuk memuatkannya. Kad kadar tiba sebagai aset katalog yang dihantar penempatan, atau melalui sambungan kad kadar pilihan yang dihidupkan oleh orang yang menghos sendiri atau satah kawalan. Tanpa kad kadar, tiada apa-apa ditunjukkan.

Setiap angka ialah kadar yang anda bekalkan didarab kuantiti yang dikira Lolly, seperti `4 plate × €35.00`, dan jumlah membawa sumbernya: pengeluar pada kad dan tarikh kadarnya. Tiada mata wang lalai dan tiada harga pemegang tempat. Apa yang dinyatakan fail tentang dirinya kekal sebagai pertuturan dilaporkan: *"The file says: … Lolly has not verified this."*

Apabila angka tidak dapat dikira, jadual ditarik balik dan bukan diisi:

- Baris yang tidak dihargakan kad bermakna **tiada jumlah langsung**, hanya tajuk yang menyatakan berapa banyak tidak berharga.
- Kuantiti yang merupakan siling membawa **"up to"** ke subjumlahnya.
- Kadar melepasi tarikh sah-hingga menunjukkan **kiraan sahaja** sehingga anda menekan *Use these rates anyway*; tarikh tamat kemudian menyertai angka.
- Dibuka melalui **pautan**, wang kekal tersembunyi sehingga anda memintanya pada peranti ini. CLI mengambil `--rate-card=<file.json>` sebagai fail setempat dan tidak pernah sebagai parameter pautan.

Kad dilucutkan daripada setiap peringkat eksport, jadi ia tidak pernah mengubah fail. Ia aritmetik, bukan sebut harga; hanya pencetak anda boleh memberi sebut harga.
:::

## Gerakan dan bunyi

### Video

Alat beranimasi mengeksport **MP4** dan **WebM**. Pemilih hanya menunjukkan bekas yang boleh dibuat pelayar ini, dan pautan `?format=` dikongsi yang meminta satu yang tidak boleh dibuat kembali kepada yang lain, dengan nama fail yang sepadan. Alat beranimasi juga menawarkan **Start after**, yang menahan kanvas pegun seketika supaya animasi dan fon mantap sebelum merakam, dan **Duration**, panjang klip siap. **Motion blur** (Off, Draft quality, Standard atau High, dengan **Shutter angle**) mengaburkan gerakan pantas dengan kos masa render. Di mana pelayar menyokongnya, **Record live** merakam pratonton pada skrin dalam masa nyata melalui kongsi skrin sebaliknya.

![Tetapan masa untuk eksport beranimasi: Start after, Duration, Motion blur dengan Shutter angle-nya, dan Record live](/t/url-shot?url=%2F%23%2Ftool%2Flottie-digi-ad%3Fformat%3Dmp4%26options&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=.video-params&walker=1&format=svg&dark=1&filename=exp-video-settings)

**Quality** memilih Smaller file, Balanced atau Best quality. **Advanced** membuka **Codec**, **Frame rate**, **Rate mode** dan **Hardware acceleration**. Di mana alat mempunyai kapsyen, **Captions** memilih **Embedded track** atau **Sidecar .vtt + .srt** di sebelah video. Pautan membawa kualiti, kodek, kadar bingkai, tempoh dan kelewatan mula sebagai `vq`, `codec`, `fps`, `seconds` dan `wait` ([URL parameters](/info/url-parameters.html)).

Eksport video mengekalkan bunyinya. Alat boleh meletakkan **lapik muzik** di bawah klip: aset audio yang diulang atau dipangkas kepada panjang klip, dengan pudar, kelantangan dan ducking di bawah bunyi rakaman sendiri. Alat rakaman membawa audio langsungnya ke dalam fail.

Dek Design yang kekal dek klik masih boleh keluar sebagai video. **Export slides as video** dalam menu Present membuka helaian eksport pada MP4. Setiap slaid dimainkan untuk dwell sendiri, atau untuk Duration helaian eksport apabila ia tiada, dan peralihan slaid dek dimainkan antaranya sebagai larut. Dokumen itu sendiri tidak berubah.

### Imej beranimasi

**GIF** dimainkan di mana-mana dan sesuai untuk sembang dan e-mel; ia lebih besar dan mempunyai lebih sedikit warna daripada video. **APNG** dan **Animated WebP** mengekalkan warna penuh dan ketelusan. **Lottie Ad** juga mengeksport **Animated SVG**: bingkai vektor dengan bingkai kunci CSS terbenam, jadi ia diskalakan kepada sebarang saiz dan berulang dalam tab pelayar atau `<img>` tanpa kodek. Teksnya digariskan luar, dan ia menggunakan kadar bingkai lalai lebih rendah kerana setiap bingkai lebih berat daripada bitmap. Semua ini senyap.

### Audio

Sesetengah alat mengeksport bunyi sahaja. **Voice Recorder** merakam ambilan mikrofon dengan meter paras langsung dan menyimpannya sebagai **MP3**, **WAV**, **M4A (AAC)** atau **Opus (WebM)**, dikodkan pada peranti anda. `wav`, `mp3`, `m4a` dan `opus` ialah id format biasa, jadi eksport audio sama boleh dikongsi dan diskrip seperti PNG.

Pemilih aset menerima pelbagai audio untuk lapik muzik, daripada MP3 dan FLAC hingga MIDI dan modul tracker; [Formats](/info/formats.html) menyenaraikannya. [Lagu Rondocode](/info/rondocode.html) dimainkan pada panjang apa pun yang diminta kliipnya.

## Warna dan HDR

Lolly membaca setiap warna CSS moden, melakukan matematik warna secara persepsi dan menulis setiap fail dalam ruang yang boleh dibuka pembaca: sRGB untuk skrin, CMYK untuk cetakan dan Rec.2100 PQ untuk HDR. [Colour in the engine](/info/colour-engine.html) menerangkan caranya. Dokumen Design yang ditetapkan kepada **Wide colour / HDR** mengikut peraturannya sendiri, diterangkan dalam [Wide colour and HDR editing](/info/hdr-editing.html).

### Profil warna

Eksport ditandakan dengan profil warna, supaya apl terurus warna seperti kedai cetak, Photoshop dan pelayar membaca warna seperti yang anda lihat. Ini berlaku secara automatik; lakaran kecil dan pratonton melangkau teg untuk kekal kecil.

- **PNG dan JPG** membawa profil ICC **sRGB** terbenam, ruang tempat pratonton dilukis. Piksel ditandakan, tidak dikod semula.
- **Print PDF (CMYK)** mengisytiharkan keadaan mesin cetaknya dalam *OutputIntent*, memberitahu kedai cetak bagaimana dakwat CMYK-nya dimaksudkan untuk dibaca.
- **Print TIFF (CMYK)** menulis piksel DeviceCMYK tanpa teg dan merekodkan keadaan mesin cetak dalam metadata TIFF. TIFF tidak boleh membenamkan profil mesin cetak, jadi baris **Embed** hanya merekodkan nama profil itu.
- **TIFF (RGB)** ialah adik sRGB tanpa mampatan untuk arkib atau pergi-balik penyunting. Ia meratakan ketelusan ke atas putih. Kedua-dua TIFF hanya untuk desktop, kerana pelayar tidak boleh membuat pratonton TIFF.
- **SVG**, **EMF**, **EPS** dan **DXF** ialah vektor tanpa profil terbenam: warna SVG ialah sRGB, EMF dan EPS menggunakan RGB peranti, **EPS (CMYK)** menulis DeviceCMYK dan DXF menggunakan AutoCAD Color Index. SVG, EPS dan DXF menggariskan luar teks kepada laluan. EMF mengekalkan teks langsung dan boleh disunting dalam Office dan Google Slides, kembali kepada garis luar hanya untuk larian yang tidak dapat diungkapkan format; pilihan **Outline fonts** panel eksport memaksa laluan di mana-mana. SVG juga menghasilkan semula bayang kotak CSS, dalam dan luar.

::: details PDF/X-4 dan profil mesin cetak anda sendiri
Tiada profil CMYK dihantar bersama Lolly. Keadaan mesin cetak bernama menulis niat output tanpa mendakwa pematuhan PDF/X-4, kerana PDF/X-4 mahu profil dibenamkan.

Muatkan profil CMYK anda sendiri dan pilih baris **Embed**-nya dalam kawalan Colour profile. Ia dibenamkan sebagai *DestOutputProfile* fail, dan PDF mendakwa PDF/X-4 apabila selebihnya fail membenarkan. Keadaan mesin cetak yang diisytiharkannya dibaca daripada profil itu: nama berdaftar di mana profil membuktikan satu, atau `Custom` di bawah nama profil sendiri.

Tiga perkara menahan dakwaan sambil mengekalkan niat output: karya RGB yang tidak dapat ditukar oleh laluan CMYK, teks kredit margin bukti `prov` (dilukis dalam fon piawai yang tidak dibenamkan) dan kata laluan **Strong**, kerana PDF/X-4 melarang penyulitan. Setiap PDF juga membawa metadata PDF/X-4: kotak halaman, XMP, ID dokumen dan niat output sRGB dengan profilnya.
:::

### HDR (warna terang)

Ini ialah kad **HDR** panel eksport, yang menerangkan karya biasa untuk skrin HDR. Mengekalkan asal HDR melalui penyuntingan ialah ciri berbeza: [Wide colour and HDR editing](/info/hdr-editing.html).

Eksport biasa ialah sRGB: warna jenama tepu seterang putih biasa skrin. Paparan HDR mempunyai ruang di atas itu. Kad **HDR** meningkatkan warna jenama dan teks putih anda ke arah kecerahan puncak, manakala kawasan gelap kekal gelap dan memberi pancaran kontrasnya.

![Kad HDR dalam panel eksport, dihidupkan, dengan dail White / Reach / Dark lift / Focus didedahkan di bawahnya](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26hdr%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-hdr&walker=1&dark=1&filename=exp-hdr-card)

- **Format.** PNG, JPG, AVIF dan TIFF. WebP ialah 8-bit tanpa laluan nyahkod HDR yang berfungsi, dan vektor serta PDF tidak mempunyai model HDR.
- **Mati secara lalai**, kerana ia mengubah piksel. Tanda kad, atau hantar `hdr=1` dalam pautan kongsi.
- **Dail.** **White** (siling kecerahan puncak, 400 hingga 2000 nit), **Reach** (sejauh mana pancaran tersebar ke bawah nada), **Dark lift** (berapa banyak kawasan gelap bertambah cerah; `0` mengekalkannya gelap) dan **Focus** (berapa banyak kekayaan warna dikekalkan peningkatan). Ia dibawa sebagai satu nilai: `hdr=1600-60-0-50` ialah White 1600, Reach 60, Dark lift 0 dan Focus 50.
- **Apa yang ditulis.** PNG mendapat Rec.2100 PQ 16-bit dengan ketulan `cICP`. JPG ialah JPEG peta gandaan ISO 21496-1: gambar SDR biasa ditambah peta gandaan yang dilampirkan. AVIF mendapat kotak `colr` yang ditulis semula. TIFF mendapat piksel PQ dengan profil ICC v4 yang dijana membawa teg `cicp`, dan diratakan ke atas hitam, kerana putih ialah kod 10,000 nit dalam PQ dan akan mengitari setiap tepi dengan halo. Peningkatan mengikut kecerahan persepsi (OKLab) dan mengekalkan rona, jadi hijau jenama menjadi lebih terang, bukan berwarna pudina.
- **Di mana pancaran kelihatan.** Pemapar terurus warna pada paparan HDR: Preview, Quick Look dan Safari pada peranti Apple, atau Chrome pada monitor HDR. Skrin SDR menunjukkan imej biasa.
- **Sebelum anda menghantar.** Banyak platform mengekod semula muat naik dan membuang isyarat HDR, yang boleh meninggalkan imej gelap atau pudar. Gunakan HDR di mana anda mengawal destinasi, seperti tapak anda sendiri, dinding video atau dek pada panel terang.
- **Daripada terminal.** `--hdr=1` dengan `--export=png` atau `--export=jpg` menulis PNG dan JPEG peta gandaan yang sama pada [CLI](/info/cli.html), daripada pengekod enjin yang sama, tanpa pelayar dalam laluan. AVIF dan TIFF kekal eksport web buat masa ini.

## Apa yang dibawa bersama fail anda

Fail siap boleh membawa beberapa rekod di samping gambar. Sesetengah mengiringi piksel dan hilang apabila fail disimpan semula atau dilucutkan; dua tanda hidup dalam piksel itu sendiri.

::: figure exporting-what-travels
Di mana setiap rekod berada, sama ada ia hidup secara lalai dan parameter pautan mana mengawal setiap satu.
:::

Panel eksport melipat **Licence**, **Source credits**, *Password protect*, **C2PA Credentials**, **Lolly Imprint** dan **Durable credential** ke dalam satu kumpulan **Content protection** yang hanya menunjukkan kad yang boleh digunakan format yang dipilih. Ia terbuka sendiri apabila pautan atau dokumen sudah mengisytiharkan lesen, atau apabila sumber memerlukan keputusan daripada anda. Kad **Design system** kekal di luar kumpulan, kelihatan pada setiap eksport.

![Kumpulan Content protection dibuka pada eksport PNG, menunjukkan hanya kad yang terpakai kepadanya](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26imprint%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-protection&dark=1&filename=exp-content-protection)

### Asal-usul & tera air

Di mana format mempunyai medan, eksport membawa **metadata asal-usul**: perisian, sumber, nama alat dan baris kredit profil anda, ditulis ke dalam PNG iTXt, JPEG EXIF, maklumat PDF, SVG `<metadata>` atau komen GIF. Ia hanya merekodkan kepengarangan, dan tiada apa-apa dimuat naik. Alat **Experimental** juga mencap tera air yang kelihatan, dikenakan oleh hos supaya menyunting alat tidak boleh membuang tanda itu.

**Lolly Imprint** ialah tera air piksel tidak kelihatan, **hidup secara lalai**. Kredensial dan metadata mengiringi piksel dan hilang apabila disimpan semula, ditangkap skrin atau metadata dilucutkan. Imprint hidup dalam piksel dan bertahan melalui pemampatan semula, jadi salinan masih boleh dikenali sebagai buatan Lolly. Ia petunjuk dan bukan jaminan kriptografi, dan ia tidak membawa data peribadi. Ia dibawa dalam JPEG XL, PNG, JPG, WebP, AVIF, TIFF dan BMP, dan dalam raster yang dirender Lolly ke dalam PDF atau PPTX, tidak pernah dalam imej yang anda benamkan. Nyahtanda **Lolly Imprint** atau hantar `imprint=0` untuk tidak menyertakan Imprint. Kebertahanan AVIF melalui pengekodan semula belum ditentukur. [Verify](/verify) mengesannya pada peranti anda; lihat [The Lolly Imprint](/info/what-verify-checks.html#the-lolly-imprint).

**Durable credential** menulis id Lolly ke dalam piksel dengan model saraf pada peranti dalam format TrustMark, supaya pautan "dibuat dengan Lolly" bertahan melalui pelucutan metadata dan pengekodan semula dan boleh dibaca oleh alat yang mengenali TrustMark. Ia **mati secara lalai**, kerana ia memerlukan satu laluan saraf bagi setiap eksport dan muat turun model sekali sahaja. Ia meliputi PNG, JPG, WebP, AVIF dan TIFF; tandakannya dalam panel atau hantar `durable=1`. Apl desktop dan mudah alih menyembunyikan kad, kerana ia tidak mempunyai asal untuk mengambil model secara luar talian.

**Licence.** Pilih bagaimana orang lain boleh menggunakan kerja anda: *None (all rights reserved)* secara lalai, CC0 1.0, Public Domain Mark 1.0, atau lesen Creative Commons 4.0 (BY, BY-SA, BY-NC, BY-NC-SA, BY-ND, BY-NC-ND). Nama lesen dan pautan ke deed-nya masuk ke dalam metadata lesen fail (EXIF, XMP dan RIFF di mana format mempunyainya) dan Content Credential-nya. Pilihan disimpan bersama dokumen dan dibawa dalam pautan sebagai `licence=`. Lolly menulis lesen yang anda pilih; ia tidak menyemak atau menguatkuasakan terma. Alat dengan medan lesennya sendiri, seperti Claim, mengekalkan medan itu sebaliknya.

### Rekod sistem reka bentuk

Eksport merekodkan sistem reka bentuk yang membuat fail: namanya, versi diterbitkan tempat ia dilukis (apabila itu bukan versi kerja) dan [colourway](/info/colourways.html) tempat ia dilukis. Mana-mana pilihan tema lain yang diisytiharkan sistem reka bentuk, seperti ketumpatan, direkodkan dengan cara yang sama. Pilihan cerah atau gelap ditinggalkan, kerana gambar sudah menunjukkan yang mana digunakan.

**Anda melihat rekod sebelum apa-apa ditulis.** Kad **Design system**, ditanda secara lalai, menunjukkan perkataan tepat yang akan dibawa fail, seperti *Records: Acme · Colourway: Beach*, dan keterangan seperti yang akan dibaca. Nama sistem reka bentuk ialah apa sahaja yang ditaip pemiliknya, jadi kad menunjukkannya seperti yang ditulis. Nyahtanda kad untuk tidak menyertakan rekod daripada eksport itu. Panel dokumen Design menyenaraikan perkataan yang sama di bawah *Embedded in exports*.

**Keterangan memberi colourway di sebelah alat.** Dengan kad ditanda, *"Made with https://lolly.tools : Chart"* menjadi *"Made with https://lolly.tools : Chart (Beach colourway)"*. Nama sistem reka bentuk sendiri kekal dalam rekod, bukan keterangan. Keterangan tanpa nama alat, atau yang ditulis alat daripada inputnya sendiri, dibiarkan seperti sedia ada. Alat yang mengabaikan colourway melalui `tokenAxes` tidak merekodkan apa-apa, dan kredit bukti PDF (tanda cetak `prov`) mengikut peraturan yang sama.

**Kemahiran jenama yang membimbing ejen.** Apabila ejen membuat karya dan menamakan [brand skills](/info/brand-skills.html) yang dibaca dan diikutinya, rekod juga menyenaraikan setiap kemahiran dengan semakannya, seperti *Guided by: acme-brand 1.0*. Perkataan itu bermakna kemahiran membimbing kerja. Ia bukan semakan: Lolly tidak menguji karya terhadap kemahiran. Hanya kenyataan ejen sendiri menambah senarai, yang hari ini bermakna hujah `brandSkills` bagi `lolly_render` [pelayan MCP](/info/mcp.html), jadi karya yang dibuat dalam apl atau daripada pautan kongsi tidak membawa mana-mana. Content Credential memegang senarai sebagai `brandSkills`, satu nilai JSON dengan id, nama, semakan dan cincangan SHA-256 setiap kemahiran. Paket XMP dan metadata SVG memegang nilai yang sama sebagai `lolly:BrandSkills`, PDF yang ditulis daripada rekod mendapat satu kata kunci bagi setiap kemahiran dan keterangan kekal seperti sedia ada. Kemahiran dalaman direkodkan mengikut id, nama, semakan dan cincangannya, tidak pernah mengikut teksnya. Suis yang sama tidak menyertakan senarai bersama baki rekod: kad **Design system**, `_madewith=0`, `--no-madewith` dan `madeWith: false`. Apabila pelayan MCP melukis fail dalam pelayar (PDF, JPEG dan format lain yang tidak boleh ditulis laluan tanpa pelayarnya), metadata fail sendiri tidak memegang senarai dan hanya Content Credential boleh memegangnya. Hantar `c2pa` untuk mengekalkan rekod; tanpa kredensial render memberi amaran bahawa kemahiran jenama tidak direkodkan.

**Membaca rekod semula.** [Verify](/verify) menyenaraikan rekod sebagai **Design system** dalam butiran kredensial fail dan sebarang kemahiran jenama sebagai **Guided by**. *Recreate with these settings* membuka semula alat dalam versi dan colourway yang direkodkan. Pautan dibuka dengan sistem reka bentuk yang direkodkan apabila peranti ini memegang satu dengan id dan nama yang sama; jika tidak ia dibuka dengan sistem reka bentuk aktif anda.

::: details Apa ditulis di mana, dan larian mana tidak menyertakan rekod
| Di mana | Apa yang ditulis |
|---|---|
| Content Credential | `designSystem` (id), `designSystemLabel`, `designVersion` dan `themes` dalam penegasan `tools.lolly.export`, masing-masing nilai teks biasa; `themes` ialah senarai JSON pilihan |
| PNG, JPEG, WebP dan JXL | Empat nilai yang sama sebagai sifat `lolly:` paket XMP fail, dalam ruang nama `https://lolly.tools/ns/export/1.0/` |
| SVG | Sifat `lolly:` yang sama dalam blok `<metadata>` |
| PDF | Kata kunci seperti *Design system: Acme* dan *Colourway: Beach* |
| Setiap format dengan medan keterangan | Keterangan, dengan colourway di sebelah alat |

Kad muncul hanya apabila ada sesuatu untuk direkodkan dan format boleh memegang rekod. CSV, JSON, fail kalendar dan format teks atau data lain tidak memegang metadata, dan EPS, EMF, DXF dan BMP tidak mempunyai medan untuk rekod. HTML, Markdown dan CSS memegang rekod hanya dalam Content Credential mereka, jadi bagi mereka kad tidak menunjukkan baris keterangan dan bersembunyi semasa **C2PA Credentials** mati. Medan yang tidak diberikan sistem reka bentuk kekal di luar fail.

Pautan kongsi mematikan rekod dengan `_madewith=0` ([URL parameters](/info/url-parameters.html)); baris perintah menerima `--no-madewith`, `lolly_render` [pelayan MCP](/info/mcp.html) menerima `madeWith: false`, dan panel eksport apl terminal mempunyai baris **Design system**. Baris perintah mencetak perkataan yang dibawa fail siap pada ralat piawai, bagi render alat dan bagi setiap fail yang dieksport `lolly run` daripada sesi Design tersimpan, dan render MCP mencetaknya di sebelah fail, kedua-duanya dibaca semula daripada fail. PNG yang dilukis baris perintah tanpa pelayar tidak membawa metadata fail, jadi rekodnya dibawa dalam kredensial sahaja. Utiliti pada peranti tidak menambah metadata langsung.

Larian tanpa kad **Design system** tidak menyertakan rekod: larian Batch, folder yang dieksport daripada Projects dan eksport koleksi 3D, dan dalam apl terminal kelompok CSV, eksport folder atau pilihan Projects dan paparan render-everything. Eksport satu fail daripada alat untuk merekodkan sistem reka bentuk.
:::

### Content Credentials (C2PA)

Eksport boleh membawa **Content Credentials**: manifes [C2PA](https://c2pa.org) bertandatangan yang merekodkan apa yang membuat fail, bila dan di mana, terikat kepada cincangan bait fail supaya sebarang suntingan kemudian dapat dikesan. Spesifikasi diterbitkan oleh C2PA, dan Lolly menulis manifes piawai yang boleh diperiksa oleh mana-mana pembaca C2PA.

![Kad C2PA Credentials, ditanda, dengan hayat kredensial di sebelah kotak semak](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26c2pa%3D30%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-c2pa%5Bdata-c2pa-only%5D&walker=1&dark=1&filename=exp-c2pa-card)

- **Hidup secara lalai.** Kad **C2PA Credentials** dipilih awal untuk hampir setiap alat. Nyahtanda untuk satu eksport, atau hantar `c2pa=off` dalam pautan. Alat boleh memilih keluar dalam manifesnya.
- **Format.** PDF (RGB dan Print), PNG dan APNG, JPG, GIF, SVG, TIFF (RGB dan Print), WebP (pegun dan beranimasi), AVIF, MP4, WebM, bekas audio MP3, WAV, M4A, OGG/Opus dan FLAC, serta HTML, Markdown dan CSS. ZIP mencap setiap ahli yang disokong, itulah cara Animated SVG mendapat satu. MP4, AVIF dan M4A menggunakan pengikatan BMFF piawai dan MP3 pemetaan ID3v2-nya, jadi `c2patool` dan pembaca lain mengesahkannya. WebM dan OGG/Opus belum mempunyai pemetaan piawai, jadi Lolly membawa manifes sebagai lampiran Matroska dan medan OpusTags, yang disemak oleh pengesah Lolly sendiri. ICO, EPS, EMF, DXF, BMP, PPTX, format Office dan format teks serta data lain tidak mempunyai bekas C2PA.
- **Apa yang direkodkan.** Alat dan apl yang membuat fail, masa penandatanganan, shell yang mengeksportnya, [sistem reka bentuk dan colourway](#the-design-system-record) semasa kad **Design system** ditanda, dan cap jari input aktif. Teks input, medan terikat profil, kawalan tidak aktif, versi pelayar dan butiran sistem pengendalian ditinggalkan. Nama dan e-mel anda muncul sebagai pengarang hanya apabila **Use my details to create** hidup di bawah Settings → Preferences → Your details. Sumber yang diletakkan eksport dibawa sebagai ramuan: [karya yang dikreditkan](#source-credits) seperti emoji, dan [lagu Rondocode](/info/rondocode.html#songs-in-the-credential) dalam eksport video atau audio.
- **Apa yang dilihat penerima.** Alat C2PA seperti apl Adobe, `c2patool` dan contentcredentials.org/verify membaca manifes dan menunjukkan tuntutan. Lolly menandatangani dengan kunci yang dibuat pada peranti anda, bukan sijil daripada senarai kepercayaan, jadi pemapar melaporkan kredensial *unverified*: struktur dan bukti pengusikan adalah sebenar, penandatangan tidak dijamin. Untuk mengubahnya, daftar **verified identity** di bawah Settings → Preferences → Content Credentials; lihat [Content Credentials Identity](/info/content-credentials-identity.html).
- **Menyemak fail.** Letakkan mana-mana fail pada [Verify](/verify), atau jalankan `lolly validate <file>`, untuk laporan pada peranti yang bermula dengan sama ada Lolly membuat fail dan sama ada ia berubah sejak itu. Verify juga melihat di luar kredensial; lihat [What Verify checks](/info/what-verify-checks.html).
- **Privasi.** Kunci penandatanganan dibuat untuk eksport dan tidak pernah meninggalkan peranti anda, dan tuntutan hanya memegang apa yang sudah dibawa metadata asal-usul. Utiliti privasi yang mengubah fail anda sendiri tidak menambah kredensial, dan *Strip Hidden Data* membuang manifes C2PA seperti metadata lain. Utiliti Rondocode membuat audio baharu, jadi ia menandatangani apa yang ditulisnya ([Rondocode songs](/info/rondocode.html#files-from-the-rondocode-utility)).
- **Interaksi.** PDF berkata laluan tidak boleh membawa Content Credentials, pada kedua-dua peringkat. Kredensial ditambah terakhir, di atas bait siap, selepas DPI, EXIF, profil warna, metadata PDF/X dan tanda cetak.

### Kredit sumber

Eksport yang meletakkan kerja orang lain merekodkan sumber itu dalam kredensial. Emoji yang dilukis daripada set emoji pilihan ialah kes harian: karya, penciptanya, lesen, dari mana bait tepat datang dan apa yang berubah semuanya dibawa bersama fail. Teks dalam alat yang templatnya SVG mengekalkan emoji sistem sendiri, jadi tiada apa-apa dikreditkan di situ. Baris **Source credits** menyatakan apa yang diminta sumber daripada penghantaran sebelum anda memuat turun, dan selepas muat turun ia membaca semula bait yang dihantar sebelum menyatakan kredit ada dalam fail. Lesen yang meminta anda memilih, seperti glif CC BY-SA yang diwarnakan semula yang akan anda kongsi, mendapat kad dengan pilihan; muat turun tidak pernah disekat. [Creative rights and credits](/info/creative-rights.html) mempunyai perkataan, lesen yang disemak dan apa yang kekal milik anda.

## Perlindungan kata laluan

Dua jenis kunci, kedua-duanya dibuat pada peranti anda. Kad *Password protect* panel eksport memacu kedua-duanya.

![Kad Password protect dikembangkan pada eksport PDF, dengan medan kata laluan dan dua peringkat kunci](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpdf%26password%3Ddemo%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-pdfpass&dark=1&filename=exp-pdf-password)

**Kata laluan buka PDF** mempunyai dua peringkat sebaik anda menaip kata laluan:

- **Weak**: RC4 40-bit, penghalang dan bukan perlindungan. Kata laluannya boleh dibawa dalam pautan kongsi, dalam teks jelas. `pdf` RGB sahaja.
- **Strong**: AES-256 (PDF 2.0). Ditaip semasa eksport dan tidak pernah diletakkan dalam pautan. Ia juga digunakan pada Print PDF dan pada setiap PDF dalam ZIP kelompok. Print PDF berkunci Strong mengekalkan CMYK, tanda dan niat outputnya tetapi menggugurkan dakwaan PDF/X-4.

**ZIP berkunci** meliputi eksport ZIP, muat turun folder daripada Projects atau kelompok, dengan satu kata laluan pada dua peringkat: **Weak** (ZipCrypto, penghalang; ia boleh dibawa dalam pautan `?password=`) atau **Strong** (AES-256, ditaip semasa eksport, tidak pernah dalam pautan). Kata laluan melindungi setiap ahli, dan sebarang PDF di dalamnya juga dikunci dengan AES-256 sendiri, jadi ia kekal berkunci selepas ZIP dibuka. Gesaan muncul apabila muat turun bermula; kata laluan kosong bermakna tiada kunci.

**Pautan kongsi berpagar kata laluan** meminta kata laluan penerima sebelum ia dibuka. Seluruh keadaan pautan disulitkan dengan AES-256 di bawah kunci yang diperoleh daripada kata laluan (PBKDF2), jadi hanya teks sifir dibawa dan penyahsulitan berlaku dalam pelayar penerima. Pelayan yang menghidangkan pautan tidak pernah melihat kata laluan atau reka bentuk. Hidupkan dalam dialog **Share**. Pautan tersulit dibuka hanya dalam Lolly, tidak pernah sebagai imej terbenam. Lihat [URL Mode](/info/url-mode.html).

## Pada telefon

Kawalan eksport berada di sebalik butang **Export** terapung, yang membuka helaian **Export**: format, saiz, salin, muat turun dan kongsi yang sama, bersaiz untuk sentuhan.

## Id format untuk pautan dan CLI

Ini ialah nilai untuk parameter URL `format=` dan bendera CLI `--export=` (lihat [URL parameters](/info/url-parameters.html) dan [CLI](/info/cli.html)). Menu alat hanya menunjukkan format yang boleh dibuat alat itu, jadi ia sentiasa lebih pendek daripada senarai ini.

| Jenis | Id |
|---|---|
| Raster | `png` · `jpg`/`jpeg` · `webp` · `avif` · `jxl` · `jxl-lossless` · `tiff` (RGB TIFF) · `cmyk-tiff` (Print TIFF) · `bmp` · `ico` |
| Vektor | `svg` · `svgz` (SVG digzip) · `emf` · `wmf` · `eps` · `eps-cmyk` (EPS CMYK) · `dxf` (fail potong) |
| Halaman dan dokumen | `pdf` · `pdf-cmyk` (Print PDF) · `pptx` (PowerPoint) · `docx` (Word) · `odt` (OpenDocument Text) · `idml` (InDesign) · `penpot` (fail reka bentuk Penpot) · `scorm` (pakej kursus, ZIP) |
| Gerakan | `gif` · `apng` (Animated PNG) · `webp-anim` (Animated WebP) · `svg-anim` (Animated SVG) · `webm` · `mp4` · `lottie` (dotLottie) · `premiere-xml` (Premiere XML + media) |
| Audio | `wav` · `mp3` · `m4a` · `aac` · `opus` · `ogg` · `flac` |
| Teks dan data | `html` · `md` · `txt` · `json` · `csv` · `ics` · `vcf` · `srt` · `vtt` · `css` · `scss` · `gpl` (palet GIMP) |
| Bundle dan pakej | `zip` · `rpm` dan `tar.gz` (render dimeteraikan ke dalam pakej Linux) |

Beberapa id datang daripada kod eksport alat sendiri: `ase` (Adobe Swatch Exchange, daripada Palette Lab) dan `exr` serta `hdr` (raster julat dinamik tinggi, daripada Darkroom). **Convert Font** menulis `ttf`, `otf` dan `woff` daripada fail fon yang anda bekalkan, jadi pautan kosong tiada apa-apa untuk dirender.
