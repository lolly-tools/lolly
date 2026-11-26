# Eksport fail

Tekan **Export**, separuh kiri pil **Export | Save**, pilih format di sebelah nama fail dan tekan **Download**. Fail dibuat pada peranti anda.

Fail mengandungi apa yang anda lihat pada kanvas. Menu format hanya menyenaraikan apa yang boleh dibuat alat ini dalam pelayar ini.

Kebanyakan tugas memerlukan salah satu daripada tiga format:

| Untuk | Pilih | Sebab |
|---|---|---|
| Skrin, mesej atau slaid | **PNG** | Setiap apl boleh membukanya, dan ia mengekalkan latar belakang lutsinar apabila alat menawarkannya |
| Halaman siap, atau apa-apa yang dicetak | **PDF** | Saiz halaman sebenar yang tercetak seperti rupanya; **Print PDF**, apabila alat menawarkannya, ialah versi CMYK untuk mesin cetak |
| Karya seni yang mesti kekal tajam pada sebarang saiz | **SVG** | Bentuk vektor |

::: check Semak fail pada saiz yang akan digunakan
Sebelum anda menghantar fail, buka pada skrin yang menjadi tujuannya atau cetak pada saiz sebenarnya.
:::

::: details Kelulusan dan penghantaran dengan Lolly Work (pilihan)
[Organisasi yang menjalankan Lolly Work](/info/organisation.html) boleh memilih format dan tetapan eksport yang dilihat ahlinya. Apabila kelulusan diperlukan, **Request approval** menggantikan **Download**. Ikuti dasar yang ditunjukkan instans anda.

Lolly Work juga boleh menghantar fail ke destinasi S3, WebDAV dan HTTP yang dikonfigurasi, dengan langkah kelulusan, resit penghantaran dan rekod audit. Penghantaran itu menghantar fail ke perkhidmatan organisasi. Muat turun biasa kekal pada peranti anda. Destinasi Send peribadi dan penghantaran organisasi dikonfigurasi secara berasingan.

Pengendali menyediakan ini dengan [panduan penghantaran organisasi](/info/work-delivery.html). Untuk render pelayan dan kelompok yang beratur, lihat [Kelompok dan automasi CLI](/info/cli-automation.html#organisation-jobs-with-lolly-work).
:::

<!--i:eti-cpu-->
## Cara eksport berfungsi

Tiga laluan menghasilkan fail. Kebanyakan alat **merender kanvas**. Format teks dan data (HTML, Markdown, TXT, JSON, CSV, ICS, VCF) **dijana daripada kandungan alat**. Utiliti privasi seperti *Lolly Strip Hidden Data* **mengubah fail yang anda pilih** pada peranti anda. Hasilnya tiada kanvas, tera air atau metadata tambahan.

![Tiga laluan eksport bertemu pada fail siap: render kanvas, jana teks atau data daripada kandungan, atau ubah fail pilihan pada peranti.](/info/diagrams/concepts/three-export-paths.svg)

Pengarang alat memilih tindakan yang ditawarkan panel eksport. Set lalai ialah Copy, Download dan Save.

- <!--i:download--> **Download** menyimpan fail. Jika anda tidak menjumpainya selepas itu, lihat [Cari fail yang anda muat turun](/info/find-your-work.html#find-a-file-you-downloaded).
- <!--i:photos--> **Copy** meletakkan imej pada papan keratan anda. Apabila pelayar tidak boleh menyalin imej, Copy memuat turun fail sebaliknya dan memberitahu anda.
- <!--i:folder--> **Save** menyimpan reka bentuk semasa dalam Projects dan tidak pernah memuat turun fail. **Save as**, di sebelah **Download**, bertanya tempatnya (lihat [Menyimpan dan menyambung](/info/using.html#saving-continuing)).
- <!--i:link--> **Share** membuka dialog Share: pautan yang menghasilkan semula reka bentuk, togol semasa lawatan (skrin penuh, panel eksport, muat turun atau salin semasa dibuka) dan **Shortest link** pilihan yang memuatkan keadaan ke dalam token padat (lihat [Mod URL](/info/url-mode.html)).

**Send to**, kad dalam panel eksport, menghantar fail ke perkhidmatan yang anda sambungkan. Selepas penghantaran ke Google Drive, Nextcloud, bucket S3, Dropbox atau OneDrive, **Create a share link** boleh membuat pautan di sana tanpa muat naik kedua. Bahagian **Share through your cloud** dalam dialog Share menghantar fail `.lolly` dan membuat pautannya dalam satu langkah. Panel pautan menunjukkan siapa yang boleh membuka pautan, tempat fail disimpan dan masa pautan tamat tempoh. **Links you've shared**, dalam dialog Share, membolehkan anda berhenti berkongsi. Pautan Nextcloud boleh mempunyai kata laluan dan tarikh tamat tempoh. Pautan S3 bertahan 1 hingga 7 hari dan tidak boleh dihentikan lebih awal. Lolly tidak menyimpan salinan fail atau token daftar masuk pada pelayan. [Privasi](/info/privacy.html#every-network-request-the-app-can-make) menyenaraikan perkara yang diterima setiap perkhidmatan.

![Panel eksport - format, saiz dan tindakan Copy / Download / Save / Share](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&walker=1&dark=1&filename=export-panel)

Apabila reka bentuk membenamkan render alat lain, seperti kotak imej Lolly Design yang memegang pautan QR Code, eksport induk melukis render bersarang itu. Ia kekal vektor dalam SVG dan PDF dan dirasterkan dalam PNG, JPG dan WebP. Render terbenam tidak mendapat tera air atau asal-usul sendiri; hanya fail siap yang mendapatnya. Eksport HTML, Markdown dan TXT tidak boleh memegang render tergubah.

<!--i:eti-file-->
## Pilih format

Nama fail dan menu format terletak bersama sebagai satu pasangan `name.format`, di bawah **Download**.

![Medan nama fail bergabung dengan pemilih format, jadi eksport dibaca sebagai satu pasangan name.format](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.filename-extension&walker=1&dark=1&filename=exp-format-picker)

Mulakan dari tempat fail itu akan pergi. Setiap kad menyenaraikan format yang sesuai untuk destinasi itu.

::: figure exporting-format-chooser
Enam destinasi dan format yang sesuai untuk setiap satu.
:::

Logotaip yang ditetapkan dalam muka taip sistem reka bentuk anda dieksport sebagai SVG dengan setiap huruf sebagai laluan bergaris luar. Fail kekal tajam pada sebarang saiz.

Teks dalam bahasa lain bergantung pada fon yang anda ada. Apabila fon dalam sistem reka bentuk anda mempunyai huruf itu, SVG dan PDF melukisnya sebagai garis luar, dibentuk dan mengikut susunan bacaan, termasuk baris kanan ke kiri. Apabila tiada satu pun yang mempunyainya, Lolly menggunakan [fon sandaran](/info/fallback-fonts.html), dan kad eksport menunjukkan fon itu. Teks yang tidak diliputi mana-mana fon sandaran kekal sebagai teks langsung dalam SVG, dilukis oleh fon pemapar sendiri. Dalam PDF, EPS atau WMF, dan dalam EMF dengan **Outline fonts** hidup, teks itu menjadi gambar. Perkataan itu kelihatan seperti pada halaman tetapi tidak boleh dipilih atau dicari. Kad eksport menyenaraikan tulisan itu. Tambah fon dengan huruf tersebut untuk mengekalkannya sebagai teks vektor.

![Logotaip garis halus dengan jarak huruf lebar berbunyi Aurora, jenis karya vektor tulen yang dimaksudkan oleh baris SVG dalam jadual](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DAurora%26weight%3D200%26tracking%3D16%26size%3D200%26full&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=%23tool-canvas&walker=1&format=svg&filename=vt-wordmark-vector)

::: details Setiap format dan kegunaannya
| Anda mahu | Gunakan | Sebab |
|---|---|---|
| Logo tajam atau karya seni yang boleh diskalakan | **SVG** | Vektor: boleh diskala, kecil dan boleh disunting; kesan yang tidak dapat dilukis oleh eksport vektor dibenamkan sebagai imej |
| Vektor untuk apl Office dan Windows | **EMF** | Ditampal sebagai vektor boleh sunting ke dalam PowerPoint dan Word, dengan teks langsung; Google Drive membukanya dalam Google Drawings |
| Vektor untuk apl cetakan dan reka bentuk | **EPS**, atau **EPS (CMYK)** | Vektor PostScript untuk Illustrator dan aliran kerja mesin cetak |
| Vektor untuk mesin pemotong | **DXF** | Pemotong laser, plotter vinil dan CNC: laluan garis luar dalam milimeter |
| Dek slaid boleh sunting | **PowerPoint** (PPTX) | Teks dan bentuk boleh sunting asli, dengan imej dan vektor kekal boleh diekstrak |
| Dokumen teks boleh sunting | **Word** (DOCX) atau **OpenDocument** (ODT) | Perenggan dan tajuk yang boleh terus disunting oleh pemproses perkataan (Lolly Doc Studio) |
| Reka letak untuk InDesign | **InDesign IDML (static subset)** | Teks, segi empat, bujur dan imej, satu hamparan bagi setiap artboard (Lolly Design) |
| Dokumen Penpot boleh sunting | **Penpot** | Papan, bentuk, teks dan token berpaut |
| Foto atau imej serba guna | **PNG** (tanpa kehilangan) atau **JPG** (lebih kecil) | Raster sejagat |
| Imej moden yang lebih kecil | **WebP** atau **AVIF** | Mampatan lebih baik, dengan ketelusan |
| Cetakan | **PDF**, atau **Print PDF** (CMYK) | Saiz halaman sebenar; CMYK untuk mesin cetak |
| Raster cetakan untuk mesin cetak | **Print TIFF** (CMYK) | Piksel DeviceCMYK untuk RIP |
| Beranimasi untuk web | **GIF** | Dimainkan di mana-mana; fail lebih besar |
| Beranimasi dengan warna penuh dan ketelusan sebenar | **APNG** | PNG beranimasi: tiada had palet |
| Beranimasi, fail terkecil | **Animated WebP** | Warna penuh dan ketelusan, lebih kecil daripada GIF atau APNG |
| Vektor beranimasi yang boleh diskalakan | **Animated SVG** | Serba lengkap; berulang dalam pelayar atau `<img>`, pada sebarang saiz (Lottie Ad) |
| Animasi yang kekal boleh disunting | **dotLottie** | Bentuk, laluan dan kunci transformasi luar daripada garis masa Lolly Design |
| Penyerahan kepada Premiere | **Premiere XML + media** | Klip bermasa dan media asal untuk Premiere (Lolly Design) |
| Video untuk media sosial dan perkongsian | **MP4** atau **WebM** | Kualiti terbaik untuk saiz fail (lihat [Video](#video)) |
| Kapsyen | **SRT** atau **VTT** | Teks bermasa untuk pemain video (Captions, Audiogram dan Record) |
| Kapsyen siaran | **TTML** atau **SCC** | Teks bermasa IMSC1.1, atau kapsyen pop-on CEA-608 (Captions; lihat [Kapsyen siaran](#broadcast-captions)) |
| Kursus latihan | **SCORM (LMS)** | Laman web, pakej SCORM atau xAPI yang mempunyai versi (lihat [SCORM](#scorm-course-packages)) |
| Teks kaya atau tandatangan e-mel | **HTML** | Ditampal dengan pemformatan ke dalam klien e-mel |
| Animasi yang dimainkan dalam pelayar | **HTML** | Pemain dalam satu fail, daripada garis masa Lolly Design atau Snippet (lihat [Video](#video)) |
| Kandungan biasa | **MD** atau **TXT** | Teks sahaja |
| Acara kalendar | **ICS** | Diimport ke dalam mana-mana apl kalendar |
| Kad kenalan | **VCF** | Diimport ke dalam buku alamat |
| Data berstruktur untuk diimport semula | **JSON** atau **CSV** | Mengeksport dan mengimport semula kandungan alat |
| Favicon | **ICO** | Ikon laman pelbagai saiz; **ZIP** menghimpunkan beberapa format |
:::

### Ketelusan

Alat yang menyokongnya menawarkan togol latar belakang lutsinar, seperti **No BG**. PNG, WebP, AVIF, SVG, APNG dan Animated WebP mengekalkan ketelusan, dan GIF mengekalkan tepi tegas. JPG dan PDF sentiasa legap. TIFF meratakan imej pada warna putih, atau pada warna hitam dalam laluan [HDR](#hdr-bright-colours).

<!--i:eti-crop-->
## Saiz dan unit cetakan

Eksport menggunakan saiz piksel asli alat melainkan alat menawarkan **dimensi**. Kemudian anda menetapkan lebar, tinggi dan **unit**:

- **px** (lalai) ialah piksel tepat.
- **mm, cm, in, pt** dan **pc** ialah saiz fizikal. Dengan unit fizikal, anda juga menetapkan **DPI** (300 secara lalai). **PDF** menjadi halaman sebenar pada saiz itu. **Raster** mendapat bilangan piksel untuk DPI itu dan merekodkan resolusinya. **SVG** mengekalkan unit fizikal dengan viewBox piksel.

Untuk raster beresolusi lebih tinggi, masukkan lebar dan tinggi yang lebih besar, atau pilih unit fizikal dan naikkan DPI (piksel = saiz × DPI). Lebar `210`, tinggi `297` dan unit `mm` menghasilkan halaman A4.

![Baris dimensi ditetapkan kepada 210 kali 297 mm, dengan medan DPI ditunjukkan kerana unitnya fizikal](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26w%3D210%26h%3D297%26unit%3Dmm%26format%3Dpdf%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-dims&walker=1&dark=1&filename=exp-export-dims)

<!--i:eti-images-->
## Imej pegun daripada komposisi bermasa

Daripada komposisi bermasa, seperti garis masa [Sequence](/info/sequence-editor.html) dalam Lolly Design, eksport imej pegun mengambil **bingkai pada penunjuk main**. Letakkan penunjuk main pada tempat gambar yang anda mahu dan eksport.

Untuk lebih daripada satu detik, gunakan medan **Frames** di sebelah saiz output. Ia muncul hanya untuk komposisi bermasa dan format imej pegun (PNG, JPG, WebP, SVG atau PDF). `1` memberikan bingkai pada penunjuk main. Nombor lebih tinggi memberikan sebanyak itu imej pegun, diagihkan secara sekata sepanjang jujukan:

- PNG, JPG, WebP dan SVG dikembalikan sebagai satu ZIP: `<name>-01.png`, `-02.png` dan seterusnya.
- PDF dikembalikan sebagai satu dokumen dengan bilangan halaman tersebut.

Setiap imej pegun diambil dari tengah bahagiannya dalam garis masa, jadi yang pertama tidak pernah menunjukkan kemunculan yang masih separuh pudar dan yang terakhir tidak pernah menunjukkan detik kosong selepas klip tamat.

::: figure exporting-contact-sheet
Frames: 4 membahagikan jujukan kepada empat bahagian sama panjang dan mengambil bahagian tengah setiap satu.
:::

Gunakan Frames untuk papan cerita, helaian imej kecil untuk semakan atau karusel media sosial yang diambil daripada suntingan video. Bilangan dihadkan kepada 64. Apa-apa nilai lain yang ditaip ke dalam medan kembali kepada `1`. Setiap bingkai ialah imej pegun biasa, jadi bukti kelayakan, Imprint, unit fizikal dan DPI berfungsi seperti untuk satu eksport. Pautan eksport, CLI dan MCP meminta helaian yang sama dengan `cuts=` (lihat [Helaian imej kecil](/info/url-export.html#contact-sheets)).

<!--i:eti-copy-->
## Banyak fail serentak

Lolly mempunyai tiga cara untuk bekerja dalam jumlah besar:

::: cols
## Jadual menjadi satu dokumen
Alat yang dibina untuk membahagikan input jadual kepada halaman menukar setiap baris menjadi halaman. Tampal jadual daripada hamparan anda untuk mendapatkan satu PDF. Untuk membetulkan baris, sunting hamparan dan tampal semula. Battlecards ialah alat rujukannya. Ia berada dalam folder sumber terbuka `community` dan tidak disenaraikan pada lolly.tools.
## CSV menjadi satu fail setiap baris
**Batch** (`#/batch`) menerima CSV dan merender satu eksport untuk setiap baris, seperti lencana nama atau sijil, dihantar dalam ZIP. Lihat [Lolly Batch](/info/batch.html#make-many-versions-of-one-design).
## Beberapa reka bentuk menerima satu suntingan
**Lolly Multi-edit** membuka beberapa sesi tersimpan bersebelahan untuk membuat perubahan yang sama dalam setiap satu. Lihat [Lolly Multi-edit](/info/batch.html#edit-several-saved-designs-together).
:::

Alat dengan beberapa halaman, seperti Booklet, Print Sheet, Lolly Doc Studio atau Lolly Markdown Slides, mengeksport PNG, JPG, WebP, SVG dan format imej tunggal lain sebagai satu fail setiap halaman, dalam ZIP apabila terdapat beberapa fail. Print Sheet mengekalkan helaian penuhnya dan tanda potong pada DPI yang dipilih.

Daripada **Projects**, **Render folder** mengeksport setiap sesi tersimpan dalam folder dan subfoldernya sebagai satu ZIP bersarang. **Render selection** melakukan perkara yang sama untuk pilihan berbilang. Satu sesi tersimpan dirender kepada failnya sendiri. Projects juga boleh berkongsi semula sesi tersimpan sebagai pautan alat yang membuka semula sesi dengan tetapan yang sama.

<!--i:eti-pen-->
## Fail yang kekal boleh disunting di tempat lain

Sesetengah format menyerahkan kerja anda kepada aplikasi lain sebagai kandungan boleh sunting dan bukannya gambar.

### PowerPoint (PPTX)

Lolly Design, Lolly Markdown Slides, Booklet, Lolly Doc Studio, Lolly Chart, Diagrams, Flow Chart dan Agenda mengeksport dek PowerPoint, satu slaid setiap halaman. Setiap halaman dipecahkan kepada objek asli yang boleh disunting dan diekstrak oleh rakan sekerja:

- <!--i:font--> **Teks** menjadi kotak teks PowerPoint boleh sunting dengan saiz fon, warna, berat, italik dan penjajaran reka letak. Dek Lolly Design menetapkan muka taip jenama pada setiap rentetan teks, walaupun tanpa induk slaid.
- <!--i:pentool--> **Vektor** seperti logo dan ikon dibenamkan sebagai gambar SVG, dan PowerPoint boleh menjalankan *Convert to Shape* padanya.
- <!--i:photos--> **Imej** dipindahkan sebagai gambar berasingan pada resolusi asli. Imej utama yang dipangkas mengekalkan imej penuh di sebalik pangkasan. Sebarang penapis atau adunan pada imej diterapkan secara kekal.
- <!--i:layers--> **Latar belakang, sempadan dan garisan** menjadi bentuk segi empat dan garis. Bulatan, elips dan pil daripada Lolly Design kekal sebagai bentuk asli yang boleh disunting.

![Panel eksport dengan PowerPoint dipilih: satu slaid setiap halaman, teks dan bentuk dikekalkan boleh sunting](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio%3Foptions&width=1440&height=900&dpi=192&waitMs=2500&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22pptx%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-pptx)

Reka letak ialah anggaran. Apa-apa yang tidak dapat diwakili secara asli oleh walker, seperti kawasan berpenapis atau bertopeng yang kompleks, dibenamkan sebagai gambar. Dek mempunyai satu saiz slaid, diambil daripada halaman pertama.

PowerPoint juga ialah laluan masuk: [Jenamakan semula dek](/info/rebrand.html) memindahkan dek ke sistem reka bentuk anda, dan [Import reka bentuk](/info/design-import.html) membukanya dalam Lolly Design.

### Penpot

Kebanyakan alat yang mengeksport SVG turut mengeksport **fail Penpot** (`.penpot`).

| Apa yang anda buat | Dalam Penpot |
|---|---|
| Teks | Objek teks boleh sunting |
| Bentuk, laluan, kecerunan dan imej | Bentuk vektor boleh sunting |
| Warna atau fon daripada token sistem reka bentuk | Pautan token langsung: sunting token dan setiap bentuk yang mewarisinya mengikutinya |
| Keseluruhan reka bentuk | Komponen boleh guna semula dalam panel Assets |
| Ilustrasi kompleks atau kanvas langsung | Imej terbenam; kandungan di sekelilingnya kekal boleh disunting |

Daripada Lolly Design, setiap bingkai menjadi papan Penpot. Warna dan tipografi sistem reka bentuk masuk ke panel Assets dan set token penuhnya ke panel Tokens. Penpot menyimpan salinannya sendiri. Token yang disunting dalam Penpot kembali melalui import dalam [Lolly Design System Setup](/info/brand-studio.html).

![Panel eksport dengan Penpot dipilih: fail .penpot, dan Send to Penpot di sebelah muat turun](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22penpot%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-penpot)

Untuk membuka fail, mulakan Penpot, pilih projek dan pilih **Import**. Jika anda mendaftar masuk ke Penpot daripada panel eksport, **Send to Penpot** mengimport fail untuk anda.

### Word, OpenDocument dan InDesign

**Lolly Doc Studio** mengeksport **Word** (DOCX) dan **OpenDocument** (ODT) dengan perenggan dan tajuk boleh sunting. Fail Word menetapkan fon dan warna teks jenama melalui gaya dokumen, mengikut saiz halaman yang anda pilih dan menambah PNG di samping logo SVG untuk apl yang tidak boleh melukis SVG.

**Lolly Design** mengeksport **InDesign IDML (static subset)**: teks, segi empat, bujur dan imej PNG atau JPEG, satu hamparan bagi setiap artboard. Pemformatan sebaris yang disokong kekal boleh disunting, imej disertakan dalam `Links` dan koordinat menjadi poin InDesign. Pemautan semula, penggantian fon dan pembalutan teks yang berubah mungkin memerlukan perhatian. Kesan, animasi, rangkaian teks tergubah dan geometri yang tidak disokong menghentikan eksport dengan laporan yang menyenaraikannya. IDML tidak mengekalkan dokumen asal. Hantar PDF untuk karya seni siap.

### Garis masa: dotLottie dan Premiere

Daripada garis masa Lolly Design, **dotLottie** menulis animasi yang kekal boleh disunting dalam alat Lottie; [Animasi Lottie](/info/sequence-editor.html#lottie-animations) menyenaraikan perkara yang dikekalkannya. **Premiere XML + media** membungkus klip bermasa dan media asalnya untuk Premiere; lihat [Pertukaran Premiere XML](/info/sequence-editor.html#premiere-xml-exchange).

### SCORM (pakej kursus)

Eksport kursus dimatikan sehingga anda menghidupkan **Training and courses** di bawah Settings → Preferences → Feature flags.

Kemudian pilih **Export course** daripada alat yang disokong, folder projek atau pilihan. Dalam Lolly Design, memilih **SCORM (LMS)** dan **Download** membuka aliran kerja kursus yang sama. Lolly menyimpan kerja, menunjukkan kandungan dan susunan kursus untuk semakan, kemudian membuka modul dan dialog eksportnya.

- <!--i:layers--> Pilih bentuk penyampaian bagi setiap sumber: halaman pegun, gerakan sebagai video, audio atau sumber yang boleh dimuat turun. Tambah teks pelajaran dan alternatif bacaan dalam modul.
- <!--i:clock--> Pratonton pemain pelajar dan semak penerangan serta kapsyen. Gerakan, termasuk animasi senyap, disertakan sebagai video.
- <!--i:document--> Pilih Website, SCORM 1.2, SCORM 2004 4th Edition atau sasaran xAPI percubaan. Semak kandungan dan saiz ZIP, kemudian simpan dan muat turun versi yang disemak.
- <!--i:check--> Penyelesaian memerlukan pengesahan bagi setiap pelajaran wajib dan pemilihan Finish.

![Panel eksport pada dek Lolly Design dengan SCORM (LMS) dipilih](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour%26format%3Dscorm%26options&width=1440&height=900&dpi=192&waitMs=3500&css=.fc-insp%7Bdisplay%3Anone!important%7D.edge-dock-slot--fill%7Bflex%3A1%201%20auto!important%3Bheight%3Aauto!important%3Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D.export-popup.is-floating%7Bheight%3Aauto!important%7D.export-popup-body%7Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D&drive=click:.edge-dock-tab%3Ahas-text%28%22Export%22%29;wait:600&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-scorm)

Pakej mengandungi kandungan siapnya dan tidak memerlukan akaun Lolly. Letakkan ZIP Website pada hos HTTP(S); import ZIP LMS tanpa perubahan. Uji destinasi sebelum anda berkongsi kursus. Untuk kursus yang dibina daripada beberapa karya tersimpan, lihat [Buat kursus latihan](/info/training-creators.html).

### Kapsyen siaran

Alat Captions juga boleh mengeksport **TTML** dan **SCC**. Kedua-duanya ditulis daripada senarai kiu yang sama seperti fail SRT dan VTT, jadi perkataan dan masanya sepadan.

- **TTML** ialah IMSC1.1 Text Profile, dengan waktu jam berdasarkan masa media dan satu kawasan di tengah bawah. Ia tidak membawa warna, fon atau kedudukan bagi setiap kapsyen, kerana kapsyen Lolly hanya mengandungi masa mula, masa tamat dan teks.
- **SCC** membawa kapsyen pop-on CEA-608 pada saluran 1 dengan 29.97 bingkai sesaat serta kod masa drop-frame. Ia menyokong aksara asas Amerika Utara serta aksara khas dan lanjutan. Jika kapsyen mempunyai aksara yang tiada dalam set itu, eksport berhenti dan menyatakan aksara tersebut. Setiap kapsyen dibalut kepada 32 lajur dan paling banyak 15 baris. Kapsyen yang tidak dapat dimuatkan sebelum masa mulanya dilewatkan beberapa bingkai.
- Kapsyen roll-up dan paint-on tidak ditulis.

::: note SCC belum disemak dalam alat siaran
Ia juga belum dicuba pada penyahkod perkakasan. Uji fail dalam aliran pemprosesan anda sendiri sebelum penghantaran.
:::

### DXF (fail pemotongan)

Lolly Asset Export, Diagrams, Growth, Lolly Logo Wall, QR Code, Street Map, Wayfinding dan Wordmark mengeksport **DXF**, format pertukaran AutoCAD R12 yang dibaca oleh pemotong laser, plotter vinil dan perisian CNC. Geometri ditulis sebagai laluan garis luar dalam milimeter dan teks dijadikan garis luar. Warna dipetakan kepada AutoCAD Color Index terdekat, yang biasanya menentukan operasi pemotong. DXF hanya untuk seni garisan: kawasan fotografi atau berpenapis tiada laluan pemotongan dan digugurkan dengan amaran. Gunakan SVG atau PDF untuk mengekalkan kandungan raster. Teks yang tidak diliputi mana-mana fon, termasuk [fon sandaran](/info/fallback-fonts.html), menghentikan eksport dengan mesej yang memetik teks itu.

Reka bentuk Street Map terdiri sepenuhnya daripada lejang, jadi setiap jalan dan terusan menjadi laluan pemotongan.

::: showcase
![Render Street Map Paris dalam dakwat pada latar krim - seni garisan tulen, jadi setiap lejang dikekalkan apabila dihantar ke pemotong](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Dparis%26roadColor%3D1a1a2e%26waterColor%3D93c5fd%26background%3Dfaf7f2%26full&width=1440&height=900&dpi=96&waitMs=3200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-street-map-cut)

Skrol, dan kamera bergerak ke belakang melalui geometri: tujuh laluan dan tiada piksel. Pemotong membaca fail yang sama.
:::

<!--i:eti-stamp-->
## Cetakan

**Print PDF** menulis CMYK berdasarkan keadaan mesin cetak bernama, **Coated FOGRA39** secara lalai. Sampel warna jenama dengan nilai dakwat yang diukur mengekalkan nilai itu. Warna lain ditukar melalui profil mesin cetak: profil Coated FOGRA39 Lolly sendiri secara lalai, atau profil anda sendiri apabila anda memilih baris **Embed**nya. Kelabu dan hitam kekal pada plat hitam sahaja, jadi teks kecil tidak boleh tersasar penjajarannya. FOGRA51, SWOP dan GRACoL menggunakan penukaran peranti standard. Teks hitam juga mencetak tindih warna di bawahnya, jadi mesin cetak yang sedikit tersasar penjajarannya tidak meninggalkan tepi putih di sekeliling huruf. **Print TIFF** menulis piksel DeviceCMYK untuk RIP. Kawalan Colour profile mengawal kedua-duanya ([Profil warna](#colour-profiles)). Print TIFF dan **EPS (CMYK)** memisahkan warna melalui profil mesin cetak yang sama seperti Print PDF.

**Print marks & bleed** mempunyai kadnya sendiri pada format cetakan: bleed dalam milimeter serta Crop, Registration, Bleed, Colour bars dan Stamp details. Stamp details mencetak tarikh, alat dan nama anda pada jidar. Nama atau nama alat dalam huruf yang tiada dalam fon jidar, seperti Arab, Cina, Cyrillic atau emoji, dilukis sebagai gambar dalam warna kelabu yang sama. Kad eksport menyenaraikan tulisan itu.

Sesetengah alat, seperti *Booklet*, membina **PDF berbilang halaman**: kulit, kandungan yang mengalir ke seberapa banyak halaman yang diperlukan dan halaman belakang. Setiap halaman ialah halaman PDF potret sebenar dalam A4, US Letter atau A5. Anda boleh memaksa mana-mana blok ke halaman baharu. Ini ialah dokumen RGB tanpa tanda pangkas atau bleed; tanda itu milik Print PDF satu halaman. PDF Lolly Design juga boleh menjadi **Notes handout**: halaman potret bagi setiap slaid dengan nota pembentangnya di bawah.

**Sebelum anda mengeksport.** Kad **Before you export** di bahagian bawah panel menunjukkan apa yang akan dilihat kedai cetak: format, saiz dan bleed, kawasan potong dan bleed, liputan dakwat, bilangan plat dan halaman, dengan keputusan di sebelah tajuknya. Kad tidak pernah menyekat eksport. Lolly Design sentiasa menunjukkan kad dengan semakannya sendiri, termasuk peraturan organisasi sistem reka bentuk lapisan demi lapisan dan isyarat penulisan untuk teks dokumen ([Sebelum anda mengeksport](/info/design.html#before-you-export)). Lolly Design menambah semakan cetakan ini apabila **Print preflight** hidup. Dalam alat lain, hidupkan **Print preflight** di bawah Settings → Preferences → Feature flags. Ia dimatikan secara lalai, dan penempatan Lolly Work boleh menghidupkannya untuk ahlinya.

**Selepas anda mengeksport.** Lolly membaca semula fail siap dan membandingkannya dengan pilihan anda: format, saiz piksel atau halaman, panjang klip, latar belakang lutsinar, warna CMYK, HDR, Content Credentials dan kata laluan PDF atau ZIP. Apa-apa yang berbeza ditulis pada kad eksport. Setiap ukuran datang daripada fail, bukan sekali-kali daripada tetapan. Sifat yang tidak dapat dipastikan daripada fail tidak dikira sebagai padanan. Baris perintah menulis perbandingan penuh dengan `--export-report` (lihat [Render dengan CLI](/info/cli-rendering.html)).

::: details Semakan kebolehcapaian PDF dari baris perintah
**Semakan kebolehcapaian PDF.** Untuk PDF, baris perintah juga menyenaraikan 32 semakan kebolehcapaian dalam fail `--export-report`, di bawah `pdfAccessibility`. Setiap semakan mempunyai id, penerangan ringkas, hasil dan lokasi masalah yang ditemuinya dalam fail:

- **Passed**: semakan meneliti sesuatu dan tidak menemui kesalahan.
- **Failed**: semakan menemui masalah. Nombor halaman atau tagnya disenaraikan.
- **Not applicable**: fail tiada perkara jenis itu untuk diteliti, seperti semakan jadual dalam fail tanpa jadual. Ini tidak menyatakan apa-apa tentang fail.
- **Needs a person**: enam semakan tidak boleh dinilai oleh program (susunan bacaan, kontras warna, kelipan, skrip, had masa dan pautan berulang).

Senarai itu bukan keputusan. Ia tidak menyatakan bahawa PDF memenuhi PDF/UA atau bahawa orang yang menggunakan teknologi bantuan boleh menggunakan PDF itu. Seseorang masih perlu menyemak fail dengan pembaca skrin. PDF Lolly sendiri gagal dalam semakan pengetagan pada masa ini, kerana pengeksport belum menulis tag. Semakan membaca fail pada peranti anda dan tidak mengubah apa-apa. Fail yang memerlukan kata laluan dinyatakan sebagai belum disemak, bukan lulus. Untuk menyemak PDF yang dihantar kepada anda, seretnya ke [Lolly Strip Hidden Data](/info/utilities.html), yang menunjukkan senarai sama di bawah **PDF accessibility checks**.
:::

Semakan Inspector Lolly Design dan perbandingan jenama dalam Lolly Design System Setup meneliti reka bentuk. Kedua-dua kad ini meneliti fail.

::: details Kos daripada kad kadar
Di bawah semakan pracetak, kad kos menukar bilangan yang sama kepada wang, walaupun kad semakan pracetak dimatikan. Ia memerlukan dua perkara: kerja yang boleh ditentukan harganya oleh senarai harga (plat, helaian, keluasan, halaman, baris varian atau fail output, jadi PNG logo biasa tidak pernah menunjukkan kad) dan **kad kadar**, senarai harga JSON daripada pencetak anda. Binaan lalai tidak membawa kad kadar dan tiada cara memuatkannya dalam apl. Kad kadar tiba sebagai aset katalog yang disertakan dalam penempatan, atau melalui sambungan kad kadar pilihan yang dihidupkan oleh pengendali hos sendiri atau satah kawalan. Tanpa kad kadar, tiada apa-apa ditunjukkan.

Setiap angka ialah kadar yang anda bekalkan didarab dengan kuantiti yang dikira Lolly, seperti `4 plate × €35.00`. Jumlah menunjukkan sumbernya: pengeluar pada kad dan tarikh kadarnya. Tiada mata wang lalai dan tiada harga pemegang tempat. Apa yang dinyatakan fail tentang dirinya kekal sebagai kenyataan yang dilaporkan: *"Fail menyatakan: … Lolly belum mengesahkan ini."*

Apabila angka tidak dapat dikira, jadual dikeluarkan dan bukannya diisi:

- Baris yang tidak diberi harga oleh kad bermakna **tiada jumlah langsung**, hanya tajuk yang menyatakan bilangan tanpa harga.
- Kuantiti yang merupakan had maksimum membawa **"sehingga"** ke dalam jumlah kecilnya.
- Kadar yang sudah melepasi tarikh sahnya menunjukkan **bilangan sahaja** sehingga anda menekan *Use these rates anyway*; tarikh tamat tempoh kemudian kekal bersama angka.
- Apabila dibuka melalui **pautan**, wang kekal tersembunyi sehingga anda memintanya pada peranti ini. CLI menerima `--rate-card=<file.json>` sebagai fail setempat dan tidak sekali-kali sebagai parameter pautan.

Kad dibuang daripada setiap peringkat eksport dan tidak pernah mengubah fail. Ia ialah pengiraan, bukan sebut harga. Hanya pencetak anda boleh memberikan sebut harga.
:::

<!--i:eti-film-->
## Gerakan dan bunyi

### Video

Alat beranimasi mengeksport **MP4** dan **WebM**. Pautan `?format=` yang dikongsi dan meminta bekas yang tidak dapat dibuat pelayar ini beralih kepada bekas satu lagi, dengan nama fail yang sepadan. **Start after** mengekalkan kanvas pegun supaya animasi dan fon stabil sebelum rakaman. **Duration** menetapkan panjang klip siap. **Motion blur** (Off, Draft quality, Standard atau High, dengan **Shutter angle**) mengaburkan gerakan pantas dan melambatkan render. Apabila pelayar menyokongnya, **Record live** merakam pratonton pada skrin dalam masa nyata melalui perkongsian skrin.

![Tetapan masa untuk eksport beranimasi: Start after, Duration, Motion blur dengan Shutter anglenya dan Record live](/t/url-shot?url=%2F%23%2Ftool%2Flottie-digi-ad%3Fformat%3Dmp4%26options&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=.video-params&walker=1&format=svg&dark=1&filename=exp-video-settings)

**Quality** memilih Smaller file, Balanced atau Best quality. **Advanced** membuka **Codec**, **Frame rate**, **Rate mode** dan **Hardware acceleration**. Apabila alat mempunyai kapsyen, **Captions** memilih **Embedded track** atau **Sidecar .vtt + .srt** di samping video. Pautan membawa kualiti, codec, kadar bingkai, tempoh dan kelewatan mula sebagai `vq`, `codec`, `fps`, `seconds` dan `wait` ([Parameter URL](/info/url-parameters.html)).

Eksport video mengekalkan bunyinya. Alat boleh meletakkan **muzik latar** di bawah klip: aset audio yang diulang atau dipangkas mengikut panjang klip, dengan pemudaran, kelantangan dan perendahan kelantangan di bawah bunyi rakaman itu sendiri. Alat rakaman membawa audio langsungnya ke dalam fail.

Dek Lolly Design yang dikawal dengan klik juga boleh dieksport sebagai video. **Export slides as video** dalam menu Present membuka helaian eksport pada MP4. Setiap slaid dimainkan selama tempoh paparannya sendiri, atau selama Duration pada helaian eksport jika tiada tempoh sendiri. Peralihan slaid dek dimainkan antara slaid sebagai pelarutan. Dokumen tidak berubah.

**HTML** daripada dokumen Lolly Design bermasa, atau daripada Snippet, ialah pemain dalam satu fail: kawalan main, carian kedudukan dan bunyi di atas animasi, dengan fon, imej dan bunyi yang disokongnya dibenamkan. Fail dimainkan luar talian. Filem Lolly Design dengan adegan menambah menu adegannya. Jujukan yang mengandungi klip video, Lottie atau 3D belum boleh dieksport sebagai HTML; eksport jujukan sebagai video.

### Imej beranimasi

**GIF** dimainkan di mana-mana dan sesuai untuk sembang serta e-mel; ia lebih besar dan mempunyai lebih sedikit warna berbanding video. **APNG** dan **Animated WebP** mengekalkan warna penuh dan ketelusan. **Lottie Ad** juga mengeksport **Animated SVG**: bingkai vektor dengan bingkai utama CSS terbenam yang boleh diskalakan kepada sebarang saiz dan berulang dalam tab pelayar atau `<img>` tanpa codec. Teksnya dijadikan garis luar. Ia menggunakan kadar bingkai lalai lebih rendah kerana setiap bingkai lebih berat daripada bitmap. Semua ini senyap.

### Audio

Sesetengah alat mengeksport bunyi sahaja. **Lolly Voice Recorder** menangkap rakaman mikrofon dengan meter aras langsung dan menyimpannya sebagai **MP3**, **WAV**, **M4A (AAC)** atau **Opus (WebM)**, dikodkan pada peranti anda. `wav`, `mp3`, `m4a` dan `opus` ialah id format biasa, jadi eksport audio boleh dikongsi dan dikawal melalui skrip seperti PNG.

Pemilih aset menerima banyak format audio untuk muzik latar, daripada MP3 dan FLAC hingga MIDI dan modul tracker; [Format](/info/formats.html) menyenaraikannya. [Lagu Lolly Rondocode](/info/rondocode.html) dimainkan selama tempoh yang diminta klipnya.

<!--i:eti-palette-->
## Warna dan HDR

Lolly membaca setiap warna CSS moden, melakukan pengiraan warnanya berdasarkan persepsi dan menulis setiap fail dalam ruang warna yang boleh dibuka pembaca: sRGB untuk skrin, CMYK untuk cetakan dan Rec.2100 PQ untuk HDR ([Warna dalam enjin](/info/colour-engine.html)). Dokumen Lolly Design yang ditetapkan kepada **Wide colour / HDR** mengikut peraturannya sendiri: lihat [Penyuntingan warna luas dan HDR](/info/hdr-editing.html).

### Profil warna

Eksport ditag dengan profil warna, jadi apl yang mengurus warna seperti apl kedai cetak, Photoshop dan pelayar membaca warna seperti yang anda lihat. Imej kecil dan pratonton tidak menyertakan tag supaya kekal kecil.

- **PNG dan JPG** membawa profil ICC **sRGB** terbenam, ruang warna yang digunakan untuk melukis pratonton. Piksel ditag, bukan dikodkan semula.
- **Print PDF (CMYK)** mengisytiharkan keadaan mesin cetaknya dalam *OutputIntent*, memberitahu kedai cetak cara dakwat CMYKnya dimaksudkan untuk dibaca.
- **Print TIFF (CMYK)** menulis piksel DeviceCMYK tanpa tag dan merekodkan keadaan mesin cetak dalam metadata TIFFnya. TIFF tidak boleh membenamkan profil mesin cetak, jadi baris **Embed** hanya merekodkan nama profil itu.
- **TIFF (RGB)** ialah versi sRGB tanpa mampatan untuk arkib atau eksport dan import semula melalui penyunting. Kedua-dua TIFF hanya untuk desktop, kerana pelayar tidak boleh mempratonton TIFF.
- **SVG**, **EMF**, **EPS** dan **DXF** ialah vektor tanpa profil terbenam: warna SVG ialah sRGB, EMF dan EPS menggunakan RGB peranti, **EPS (CMYK)** menulis DeviceCMYK dan DXF menggunakan AutoCAD Color Index. SVG, EPS dan DXF menukar teks kepada laluan garis luar. EMF mengekalkan teks langsung dan boleh sunting dalam Office dan Google Slides dan hanya menjadikan rentetan teks yang tidak dapat diwakili format itu sebagai garis luar. Pilihan **Outline fonts** pada panel eksport memaksa penggunaan laluan di mana-mana, seperti `_text=outline` dalam pautan dan `--text=outline` pada baris perintah. SVG juga menghasilkan semula bayang kotak CSS, di dalam dan di luar.

::: details PDF/X-4 dan profil mesin cetak anda sendiri
Lolly menyertakan satu profil CMYK, dipadankan dengan data pencirian FOGRA39 daripada Fogra dan dikeluarkan di bawah CC0, dan menukar warna melaluinya untuk keadaan mesin cetak lalai. Profil tidak dibenamkan, kerana ia ialah ICC versi 4.3 dan PDF/X-4 menerima versi sehingga 4.2. Oleh itu, keadaan mesin cetak bernama menulis tujuan output tanpa mendakwa pematuhan PDF/X-4.

Muatkan profil CMYK anda sendiri dan pilih baris **Embed**nya dalam kawalan Colour profile. Ia dibenamkan sebagai *DestOutputProfile* fail, dan PDF mendakwa pematuhan PDF/X-4 apabila bahagian fail yang lain membenarkannya. Keadaan mesin cetak yang diisytiharkannya dibaca daripada profil itu: nama berdaftar apabila profil membuktikannya, atau `Custom` di bawah nama profil itu sendiri.

Tiga perkara menghalang dakwaan itu sambil mengekalkan tujuan output: karya seni RGB yang tidak dapat ditukar oleh laluan pemprosesan CMYK, teks kredit pada jidar pruf `prov` (dilukis dalam fon standard yang tidak dibenamkan) dan kata laluan **Strong**, kerana PDF/X-4 melarang penyulitan. Setiap PDF juga membawa metadata PDF/X-4: kotak halaman, XMP, ID dokumen dan tujuan output sRGB dengan profilnya.
:::

### Dakwat khas sebagai warna proses

Sistem reka bentuk boleh memberikan dakwat khas kepada sesuatu warna, seperti warna Pantone atau HLC. **Print PDF** kemudian mencetak warna itu pada platnya sendiri. Lolly Demo memberikan dakwat khas kepada setiap warna kecuali warna putihnya, Sugar dan Daylight, serta warna hitamnya, Void. Print PDF yang dibuat dalam Lolly Demo mencetak kebanyakan warna pada plat khas dan hitam pada plat hitam.

Untuk fail empat warna biasa, tandakan **Print spot inks as process** dalam kad Profile pada panel eksport. Setiap dakwat khas kemudian dicetak dengan sian, magenta, kuning dan hitam, menggunakan campuran CMYK yang diberikan oleh sistem reka bentuk kepada warna itu. Warna tanpa campurannya sendiri menggunakan penukaran profil mesin cetak, seperti setiap warna lain dalam karya seni itu. Fail itu kemudian hanya mempunyai empat plat proses. Pilihan ini dimatikan secara lalai. Panel menunjukkan kotak itu untuk **Print PDF** sahaja, dan hanya apabila sistem reka bentuk memberikan dakwat khas kepada sesuatu warna.

Kemasan bukan dakwat. Kerajang, timbul, lekuk, varnis setempat, sentuhan lembut, potongan acuan, garis lipatan dan tebukan mengekalkan plat bernama masing-masing apabila kotak itu ditandakan, kerana kemasan yang dicetak dalam warna proses akan meletakkan topeng hitamnya pada halaman.

Kad **Before you export** dan `lolly preflight` mengira plat yang akan ada dalam fail. Apabila kotak ditandakan, kedua-duanya mengira empat plat proses dan sebarang plat kemasan serta menyatakan bahawa dakwat khas dicetak sebagai warna proses dan tidak menambah plat. Apabila kotak tidak ditandakan, kedua-duanya mengira sehingga satu plat khas untuk setiap dakwat khas yang diberikan oleh sistem reka bentuk. Kad kadar menetapkan harga berdasarkan kiraan itu, jadi ia tidak pernah mengenakan harga bagi plat khas yang tidak akan ada dalam fail.

**Print TIFF** dan **EPS (CMYK)** tidak mempunyai plat bernama, jadi kedua-duanya mencetak setiap dakwat dalam warna proses sama ada pilihan itu dihidupkan atau tidak. Untuk dua format itu, kad dan `lolly preflight` mengira empat plat proses dan tidak pernah mengira plat khas atau kemasan. Kemasan dimasukkan ke dalamnya sebagai topeng hitam pada plat hitam, dan kad melaporkannya sebagai ralat.

Pautan meminta fail yang sama dengan `_spots=process`, baris perintah dengan `--spots=process`, [pelayan MCP](/info/mcp.html) dengan `spots: "process"` dan apl terminal dengan baris **Spot inks**. Tiada maklumat tentang pilihan itu dimasukkan ke dalam fail: hanya dakwat yang berubah.

### HDR (warna terang)

Kad **HDR** pada panel eksport mencerahkan karya seni biasa untuk skrin HDR. Untuk mengekalkan bahan asal HDR sepanjang penyuntingan, lihat [Penyuntingan gamut warna luas dan HDR](/info/hdr-editing.html).

Eksport biasa ialah sRGB: warna jenama tepu seterang putih biasa skrin. Paparan HDR boleh menjadi lebih terang. Kad **HDR** meningkatkan warna jenama anda dan teks putih ke arah kecerahan puncak. Kawasan gelap kekal gelap.

![Kad HDR pada panel eksport, dihidupkan, dengan dail White / Reach / Dark lift / Focus ditunjukkan di bawahnya](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26hdr%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-hdr&walker=1&dark=1&filename=exp-hdr-card)

- **Format.** PNG, JPG, AVIF dan TIFF. WebP ialah 8 bit tanpa laluan penyahkodan HDR yang berfungsi, dan vektor serta PDF tiada model HDR.
- **Dimatikan secara lalai**, kerana ia mengubah piksel. Tandakan kad, atau hantar `hdr=1` dalam pautan kongsi.
- **Dail.** **White** (had kecerahan puncak, 400 hingga 2000 nit), **Reach** (sejauh mana cahaya merebak ke tona yang lebih gelap), **Dark lift** (sebanyak mana bahagian gelap dicerahkan; `0` mengekalkannya gelap) dan **Focus** (sebanyak mana kekayaan warna dikekalkan oleh peningkatan itu). Semuanya dibawa sebagai satu nilai: `hdr=1600-60-0-50` ialah White 1600, Reach 60, Dark lift 0 dan Focus 50.
- **Apa yang ditulis.** PNG mendapat Rec.2100 PQ 16 bit dengan cebisan `cICP`. JPG ialah JPEG peta gandaan ISO 21496-1: gambar SDR biasa dengan peta gandaan ditambah di hujung. AVIF mendapat kotak `colr` yang ditulis semula. TIFF mendapat piksel PQ dengan profil ICC v4 terjana yang membawa tag `cicp`. TIFF diratakan pada hitam, kerana putih ialah kod 10,000 nit dalam PQ dan akan meletakkan lingkaran cahaya di sekeliling setiap tepi. Peningkatan mengikut kecerahan persepsi (OKLab) dan mengekalkan rona, jadi hijau jenama menjadi lebih terang, bukan hijau pudina.
- **Tempat cahaya kelihatan.** Pemapar dengan pengurusan warna pada paparan HDR: Preview, Quick Look dan Safari pada peranti Apple, atau Chrome pada monitor HDR. Skrin SDR menunjukkan imej biasa.
- **Daripada terminal.** `--hdr=1` dengan `--export=png` atau `--export=jpg` menulis PNG dan JPEG peta gandaan yang sama pada [CLI](/info/cli.html) daripada pengekod enjin yang sama, tanpa pelayar. Buat masa ini, AVIF dan TIFF hanya tersedia sebagai eksport web.

::: warning Banyak platform membuang isyarat HDR
Platform yang mengekod semula muat naik boleh menyebabkan imej menjadi gelap atau pudar. Gunakan HDR apabila anda mengawal destinasi, seperti laman anda sendiri, dinding video atau dek pada panel terang.
:::

<!--i:eti-badge-check-->
## Apa yang dibawa bersama fail anda

Fail siap boleh mempunyai beberapa rekod. Ada yang berada di luar piksel dan hilang apabila fail disimpan semula, ditangkap skrinnya atau dibuang metadatanya. Dua tanda berada dalam piksel.

::: figure exporting-what-travels
Tempat setiap rekod berada, sama ada ia dihidupkan secara lalai dan parameter pautan yang mengawal setiap satunya.
:::

Panel eksport meletakkan **Licence**, **Source credits**, **Password**, **C2PA Credentials**, **Lolly Imprint** dan **Durable credential** dalam satu kumpulan **Content protection** yang hanya menunjukkan kad yang boleh digunakan oleh format pilihan. Kumpulan itu terbuka sendiri apabila pautan atau dokumen sudah mengisytiharkan lesen, atau apabila sumber memerlukan keputusan anda. Kad **Design system** kekal di luar kumpulan, kelihatan pada setiap eksport.

![Kumpulan Content protection dibuka pada eksport PNG, hanya menunjukkan kad yang berkaitan dengannya](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26imprint%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-protection&dark=1&filename=exp-content-protection)

### Asal-usul & tera air

Apabila format mempunyai medan yang sesuai, eksport membawa **metadata asal-usul**: perisian, sumber, nama alat dan baris kredit profil anda, ditulis ke dalam PNG iTXt, JPEG EXIF, maklumat PDF, SVG `<metadata>` atau komen GIF. Ia hanya merekodkan kepengarangan. Tiada apa-apa dimuat naik. Alat **Experimental** juga mengecap tera air yang kelihatan. Hos menerapkan tera air, jadi menyunting alat tidak boleh membuang tanda itu.

**Lolly Imprint** ialah tera air piksel tidak kelihatan, **dihidupkan secara lalai**. Ia bertahan selepas pemampatan semula, jadi salinan masih boleh dikenal pasti sebagai buatan Lolly. Ia petunjuk, bukan jaminan kriptografi, dan tidak membawa data peribadi. Ia ditulis dalam JPEG XL, PNG, JPG, WebP, AVIF, TIFF dan BMP, serta dalam raster yang Lolly render ke dalam PDF atau PPTX, tidak pernah dalam imej yang anda benamkan. Nyahtandakan **Lolly Imprint** atau hantar `imprint=0` untuk mengecualikan Imprint. Ketahanan AVIF selepas pengekodan semula belum ditentukur. [Lolly Verify](/#/verify) mengesan Imprint pada peranti anda; lihat [Lolly Imprint](/info/what-verify-checks.html#the-lolly-imprint).

**Durable credential** menulis id Lolly ke dalam piksel dengan model neural pada peranti dalam format TrustMark, jadi pautan "dibuat dengan Lolly" bertahan selepas metadata dibuang dan pengekodan semula serta boleh dibaca oleh alat yang menyokong TrustMark. Ia **dimatikan secara lalai**, kerana ia memerlukan satu laluan pemprosesan neural bagi setiap eksport dan muat turun model sekali sahaja. Ia meliputi PNG, JPG, WebP, AVIF dan TIFF. Tandakan dalam panel atau hantar `durable=1`. Apl desktop dan mudah alih menyembunyikan kad itu, kerana ia tiada asal untuk mendapatkan model semasa luar talian.

**Licence.** Pilih cara orang lain boleh menggunakan kerja anda: *None (all rights reserved)* secara lalai, CC0 1.0, Public Domain Mark 1.0 atau lesen Creative Commons 4.0 (BY, BY-SA, BY-NC, BY-NC-SA, BY-ND, BY-NC-ND). Nama lesen dan pautan kepada surat ikatannya dimasukkan ke dalam metadata lesen fail (EXIF, XMP dan RIFF apabila format mempunyainya) serta Content Credentialnya. Pilihan disimpan bersama dokumen dan dibawa dalam pautan sebagai `licence=`. Lolly menulis lesen yang anda pilih. Lolly tidak menyemak atau menguatkuasakan syaratnya. Alat dengan medan lesennya sendiri, seperti Claim, mengekalkan medan itu sebaliknya.

### Rekod sistem reka bentuk

Eksport merekodkan sistem reka bentuk yang membuat fail: namanya, versi terbitan yang digunakan untuk melukisnya (apabila itu bukan versi kerja) dan [colourway](/info/colourways.html) yang digunakan untuk melukisnya. Sebarang pilihan tema lain yang diisytiharkan oleh sistem reka bentuk, seperti ketumpatan, direkodkan dengan cara yang sama. Pilihan cerah atau gelap tidak dimasukkan, kerana gambar sudah menunjukkan yang mana digunakan.

**Anda melihat rekod sebelum apa-apa ditulis.** Kad **Design system**, ditandakan secara lalai, menunjukkan perkataan tepat yang akan dibawa oleh fail, seperti *Records: Acme · Colourway: Beach*, serta perihalan. Nama sistem reka bentuk ialah apa sahaja yang ditaip oleh pemiliknya, dan kad menunjukkan nama seperti yang ditulis. Nyahtandakan kad untuk mengecualikan rekod daripada eksport itu. Panel dokumen Lolly Design menyenaraikan perkataan yang sama di bawah *Embedded in exports*.

**Perihalan memberikan colourway di sebelah alat.** Dengan kad ditandakan, *"Made with https://lolly.tools : Chart"* menjadi *"Made with https://lolly.tools : Chart (Beach colourway)"*. Nama sistem reka bentuk sendiri kekal dalam rekod, bukan perihalan. Perihalan tanpa nama alat, atau yang ditulis oleh alat daripada inputnya sendiri, tidak berubah. Alat yang mengabaikan colourway melalui `tokenAxes` tidak merekodkan apa-apa colourway, dan kredit pruf PDF (tanda cetak `prov`) mengikut peraturan yang sama.

::: details Kemahiran jenama, halaman jenama dan syarikat rakan kongsi dalam rekod
**Kemahiran jenama yang membimbing ejen.** Apabila ejen membuat karya dan menamakan [kemahiran jenama](/info/brand-skills.html) yang dibaca dan diikutinya, rekod juga menyenaraikan setiap kemahiran dengan semakannya, seperti *Guided by: acme-brand 1.0*. Perkataan itu bermakna kemahiran tersebut membimbing kerja. Lolly tidak menguji karya terhadap sesuatu kemahiran. Hanya pernyataan ejen sendiri menambah senarai itu. Pada masa ini, itu ialah argumen `brandSkills` bagi `lolly_render` pada [pelayan MCP](/info/mcp.html), jadi karya yang dibuat dalam apl atau daripada pautan kongsi tidak membawa apa-apa senarai. Content Credential menyimpan senarai sebagai `brandSkills`, satu nilai JSON dengan id, nama, semakan dan cincangan SHA-256 setiap kemahiran. Paket XMP dan metadata SVG menyimpan nilai yang sama sebagai `lolly:BrandSkills`. PDF yang ditulis daripada rekod mendapat satu kata kunci bagi setiap kemahiran. Perihalan tidak berubah. Teks kemahiran dalaman tidak pernah direkodkan. Suis yang sama mengecualikan senarai bersama baki rekod: kad **Design system**, `_madewith=0`, `--no-madewith` dan `madeWith: false`. Apabila pelayan MCP melukis fail dalam pelayar (PDF, JPEG dan format lain yang tidak boleh ditulis oleh laluan tanpa pelayarnya), metadata fail sendiri tidak menyimpan senarai. Hanya Content Credential boleh menyimpan senarai di situ. Hantar `c2pa` untuk mengekalkan rekod. Tanpa kelayakan, render memberi amaran bahawa kemahiran jenama tidak direkodkan.

**Halaman jenama, apabila penerbitnya memilih untuk menyertakannya.** Penerbit sistem reka bentuk boleh memilih untuk merekodkan alamat [halaman jenama](/info/brand-page.html#lead-back-from-your-files) pada eksport. Tetapan itu berasingan bagi setiap sistem reka bentuk dan dimatikan secara lalai. Kad kemudian menambah alamat pada baris yang sama, seperti *Records: Acme · Colourway: Beach · Brand page: https://acme.example/brand/acme/*. Menyahtandakan kad membuang alamat bersama yang lain. Rekod menyimpan alamat dan tiada maklumat lain tentang halaman itu. Tiada apa-apa lagi dalam fail berubah. Sistem reka bentuk tanpa alamat menulis fail yang sama seperti sebelumnya.

**Alamat tidak dibawa bersama pek.** Rekod dalam fail bertandatangan dianggap milik penandatangannya sendiri. Alamat tidak boleh dihidupkan sendiri untuk seseorang yang tidak memilih alamat itu, dan pek tidak boleh menghalakan fail orang lain ke halaman pilihannya sendiri. Pek `.lolly`, salinan atau cabang sistem reka bentuk, **Try these colours**, sandaran yang dipulihkan dan fail token yang diberikan untuk satu larian semuanya tiba dengan tetapan dimatikan. Anda boleh menghidupkan tetapan itu sendiri, dengan alamat yang anda taip. Sistem reka bentuk terurus ialah satu-satunya pengecualian: ia mengekalkan alamat yang ditetapkan oleh pengurusnya dalam token sumber. [Pautkan kembali daripada fail anda](/info/brand-page.html#lead-back-from-your-files) mempunyai butirannya.

**Syarikat rakan kongsi, dalam program rakan kongsi Lolly Work.** Karya yang dibuat untuk syarikat rakan kongsi merekodkan syarikat dan programnya pada baris yang sama, seperti *Records: Acme · Colourway: Beach · Partner: Northwind IT (Resellers, EMEA)*, dengan semakan butiran syarikat dalam fail. Rekod tidak menyimpan nama orang, butiran hubungan, alamat atau mata wang. Dengan kit rakan kongsi syarikat dilampirkan, baris menambah semakan kit, seperti *, kit revision 2*, dan kelayakan menyimpan id dan semakan kit, tidak pernah warna atau peraturannya. Menyahtandakan kad membuang rakan kongsi bersama baki rekod. PDF mendapat kata kunci *Partner: Northwind IT*, dan [Lolly Verify](/info/what-verify-checks.html#partner) menunjukkan rekod sebagai **Partner** ([Rekod rakan kongsi dalam fail](/info/manage/partner-programmes.html#the-partner-record-in-files)).
:::

**Membaca semula rekod.** [Lolly Verify](/#/verify) menyenaraikan rekod sebagai **Design system** dalam butiran kelayakan fail dan sebarang kemahiran jenama sebagai **Guided by**. Halaman jenama muncul sendiri, sebagai [rekod alamat oleh penandatangan](/info/what-verify-checks.html#brand-page). *Recreate with these settings* membuka semula alat dalam versi dan colourway yang direkodkan. Pautan terbuka dengan sistem reka bentuk yang direkodkan apabila peranti ini menyimpan sistem dengan id dan nama yang sama; jika tidak, ia terbuka dengan sistem reka bentuk aktif anda.

::: details Apa yang ditulis di mana, dan larian yang mengecualikan rekod
| Tempat | Apa yang ditulis |
|---|---|
| Content Credential | `designSystem` (id), `designSystemLabel`, `designVersion` dan `themes` dalam pernyataan `tools.lolly.export`, setiap satunya nilai teks biasa; `themes` ialah senarai JSON bagi pilihan. `brandPage` apabila penerbit memilih untuk menyertakannya |
| PNG, JPEG, WebP dan JXL | Nilai yang sama sebagai sifat `lolly:` dalam paket XMP fail, dalam ruang nama `https://lolly.tools/ns/export/1.0/`. `lolly:BrandPage` apabila penerbit memilih untuk menyertakannya |
| SVG | Sifat `lolly:` yang sama di dalam blok `<metadata>` |
| PDF | Kata kunci seperti *Design system: Acme*, *Colourway: Beach* dan, apabila penerbit memilih untuk menyertakannya, *Brand page: https://acme.example/brand/acme/* |
| Setiap format dengan medan perihalan | Perihalan, dengan colourway di sebelah alat |

Kad hanya muncul apabila ada sesuatu untuk direkodkan dan format boleh menyimpan rekod. CSV, JSON, fail kalendar dan format teks atau data lain tidak menyimpan metadata, dan EPS, EMF, DXF serta BMP tiada medan untuk rekod. HTML, Markdown dan CSS menyimpan rekod hanya dalam Content Credentialnya, jadi bagi format itu kad tidak menunjukkan baris perihalan dan disembunyikan semasa **C2PA Credentials** dimatikan. Medan yang tidak diberikan oleh sistem reka bentuk tidak dimasukkan ke dalam fail.

Pautan kongsi mematikan rekod dengan `_madewith=0` ([Parameter URL](/info/url-parameters.html)). Baris perintah menerima `--no-madewith`, `lolly_render` pada [pelayan MCP](/info/mcp.html) menerima `madeWith: false` dan panel eksport apl terminal mempunyai baris **Design system**. Baris perintah mencetak perkataan yang dibawa oleh fail siap pada ralat piawai, untuk render alat dan setiap fail yang dieksport oleh `lolly run` daripada sesi Lolly Design tersimpan. Render MCP mencetak perkataan di sebelah fail. Kedua-duanya membaca semula perkataan daripada fail. PNG yang dilukis oleh baris perintah tanpa pelayar tidak membawa metadata fail, jadi rekodnya dibawa dalam kelayakan sahaja. Utiliti pada peranti tidak menambah metadata.

Larian tanpa kad **Design system** mengecualikan rekod: larian Lolly Batch, folder yang dieksport daripada Projects dan eksport koleksi 3D, serta dalam apl terminal, kelompok CSV, eksport folder atau pilihan Projects dan paparan render semua. Eksport satu fail daripada alat untuk merekodkan sistem reka bentuk.
:::

### Content Credentials (C2PA)

Eksport boleh membawa **Content Credentials**: manifes [C2PA](https://c2pa.org) bertandatangan yang merekodkan apa yang membuat fail, bila dan di mana, diikat pada cincangan bait fail supaya sebarang suntingan kemudian boleh dikesan. Lolly menulis manifes piawai yang boleh diperiksa oleh mana-mana pembaca C2PA.

![Kad C2PA Credentials, ditandakan, dengan tempoh hayat kelayakan di sebelah kotak semak](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26c2pa%3D30%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-c2pa%5Bdata-c2pa-only%5D&walker=1&dark=1&filename=exp-c2pa-card)

- **Dihidupkan secara lalai.** Kad **C2PA Credentials** ditandakan untuk hampir setiap alat. Nyahtandakannya untuk satu eksport, atau hantar `c2pa=off` dalam pautan. Fail itu kemudian tiada kelayakan, dan SVG yang memasukkan karya seni berkelayakan secara sebaris, seperti logo katalog, turut kehilangan kelayakan karya seni itu. Lolly Imprint dan metadata lain fail kekal. Alat boleh memilih untuk tidak menyertakannya dalam manifesnya.
- **Format.** PDF (RGB dan Print), PNG dan APNG, JPG, GIF, SVG dan SVGZ, TIFF (RGB dan Print), WebP (pegun dan beranimasi), AVIF, MP4, WebM, HTML, Markdown, CSS serta bekas audio MP3, WAV, M4A, OGG/Opus dan FLAC. ZIP mengecap setiap ahli yang disokong, dan begitulah Animated SVG mendapat kelayakan. MP4, AVIF dan M4A menggunakan pengikatan BMFF piawai dan MP3 menggunakan pemetaan ID3v2, jadi `c2patool` dan pembaca lain mengesahkannya. WebM dan OGG/Opus belum mempunyai pemetaan piawai, jadi Lolly membawa manifes sebagai lampiran Matroska dan medan OpusTags, yang disemak oleh pengesah Lolly sendiri. SVGZ ialah SVG termampat. Spesifikasi C2PA tidak mentakrifkan bentuk termampat, jadi kelayakan ditulis ke dalam SVG sebelum pemampatan. Pengesah Lolly membaca fail seperti sedia ada; `c2patool` membaca kelayakan yang sama setelah fail dinyahmampatkan (`gunzip`). ICO, EPS, EMF, DXF, BMP, PPTX, format Office serta format teks dan data lain tiada bekas C2PA.
- **Apa yang direkodkan.** Alat dan apl yang membuat fail, masa penandatanganan dan shell yang mengeksport fail. Untuk halaman Lolly Design yang dieksport sebagai imej, SVG atau PDF, perender yang melukis halaman (`route` dalam pernyataan `tools.lolly.export`: `gpu` untuk perender halaman GPU, `operations` untuk operasi lukisan yang ditulis sebagai vektor, `compatibility` untuk perender pelayar sendiri) dan versi perender itu (`renderer`: resipi GPU, `design-draw-v` dan versinya, atau `dom-to-image` dan `dom-walker`). [Sistem reka bentuk dan colourway](#the-design-system-record) semasa kad **Design system** ditandakan. Tetapan aktif: pilihan menu, nombor, suis dan warna seperti sedia ada, serta apa-apa yang ditaip (tajuk, nama, nota, pautan dan tarikh) hanya sebagai cap jari, jadi perkataannya tiada dalam fail. Medan yang terikat pada profil, kawalan tidak aktif, versi pelayar dan butiran sistem pengendalian tidak disertakan. Nama dan e-mel anda muncul sebagai pengarang hanya apabila **Use my details to create** dihidupkan di bawah Settings → Preferences → Your details. Sumber yang diletakkan oleh eksport dibawa sebagai bahan. Setiap gambar pada halaman yang membawa Content Credentialnya sendiri direkodkan sebagai komponen halaman, dengan kelayakan itu dan sebarang jenis sumber AI yang diisytiharkannya. Ini berlaku dalam PNG, JPEG, WebP, AVIF, TIFF, SVG atau PDF, serta dalam GIF, APNG, WebP beranimasi, MP4 atau WebM apabila gambar dilukis dalam sekurang-kurangnya satu bingkai julat yang dieksport. Satu gambar yang diubah oleh alat seperti Darkroom, Filter atau Asset Export direkodkan sebagai induk fail sebaliknya, dibuka dahulu dan diikuti oleh apa yang dilakukan alat terhadap gambar. Bahan lain ialah [karya yang diberi kredit](#source-credits) seperti emoji, [lagu Lolly Rondocode](/info/rondocode.html#songs-in-the-credential) dalam eksport video atau audio dan [lagu tersimpan](/info/generated-music.html#what-a-track-records) dalam eksport video atau audio. Setiap lagu tersimpan mempunyai namanya, lesen apabila lagu merekodkan lesen, SHA-256 resipinya, versi enjin dan media algoritma. Pembuat lagu tersimpan (nama profil semasa ia disimpan) ditambah hanya semasa **Use my details to create** dihidupkan, seperti nama anda sendiri. Hanya ketika itu panel eksport menunjukkan pembuat sebelum anda mengeksport.
- **Kelulusan, apabila ia direkodkan.** Fail yang diluluskan melalui [Lolly Work](/info/work-approvals.html#review-an-exported-file) boleh membawa rekod bertandatangan kedua yang meliputi kelayakan ini: id kelulusan, tarikh keputusan dan ringkasan cincangan fail yang disemak. Ia tiada nama, e-mel, kumpulan, komen atau nama rantaian. Ia ditandakan secara lalai dalam dialog permintaan dan boleh dinyahtandakan untuk satu permintaan atau dimatikan untuk sesuatu instans. Ia merekodkan bahawa penandatangan menyatakan keputusan. Ia tidak menyatakan bahawa kerja itu memenuhi sebarang piawaian.
- **Apa yang diminta untuk dilakukan, bagi fail yang dibuat daripada [niat](/info/visual-intent.html#what-goes-in-the-file).** Tujuan, permukaan, alat, bahasa, versi peraturan dan kosa kata serta ringkasan cincangan niat. Acara, khalayak, rantau dan prom hanyalah cap jari, melainkan orang atau ejen yang menjalankan render itu meminta perkataan prom direkodkan. Hanya render yang bermula daripada niat membawa rekod ini. Larian menyatakan apa yang direkodkannya, dan rekod boleh dikecualikan.
- **Apa yang dilihat penerima.** Alat C2PA seperti apl Adobe, `c2patool` dan contentcredentials.org/verify membaca manifes dan menunjukkan dakwaan. Lolly menandatangani dengan kunci yang dibuat pada peranti anda, bukan sijil daripada senarai amanah, jadi pemapar melaporkan kelayakan *tidak disahkan*. Struktur dan bukti pengusikan adalah sah, tetapi tiada siapa menjamin penandatangan. Untuk mengubahnya, daftarkan **identiti yang disahkan** di bawah Settings → Preferences → Content Credentials; lihat [Identiti Content Credentials](/info/content-credentials-identity.html).
- **Menyemak fail.** Lepaskan sebarang fail pada [Lolly Verify](/#/verify), atau jalankan `lolly validate <file>`, untuk laporan pada peranti yang dimulakan dengan sama ada Lolly membuat fail itu dan sama ada ia telah berubah sejak itu. Lolly Verify juga melihat lebih daripada kelayakan; lihat [Apa yang disemak Lolly Verify](/info/what-verify-checks.html).
- **Privasi.** Kunci penandatanganan dibuat untuk eksport dan tidak pernah meninggalkan peranti anda. Dakwaan hanya menyimpan apa yang sudah dibawa oleh metadata asal-usul. Utiliti privasi yang mengubah fail anda sendiri tidak menambah kelayakan, dan *Lolly Strip Hidden Data* membuang manifes C2PA seperti metadata lain. Utiliti Rondocode membuat audio baharu, jadi ia menandatangani apa yang ditulisnya ([Lagu Lolly Rondocode](/info/rondocode.html#files-from-the-rondocode-utility)). Penjana muzik menandatangani setiap muat turun WAV atau M4A. Kelayakan merekodkan bahawa penjana muzik Lolly membuat trek dan lesen yang meliputi muzik itu, CC BY 4.0, bersama kreditnya ([Apa yang direkodkan oleh trek](/info/generated-music.html#what-a-track-records)).
- **Interaksi.** PDF yang dilindungi kata laluan tidak boleh membawa Content Credentials, pada mana-mana peringkat. Kelayakan ditambah terakhir, meliputi bait siap, selepas DPI, EXIF, profil warna, metadata PDF/X dan tanda cetak.

### Kredit sumber

Eksport yang meletakkan karya orang lain merekodkan sumber itu dalam kelayakan. Kes biasa ialah emoji daripada set emoji pilihan: karya, penciptanya, lesen, tempat asal bait tepat dan apa yang berubah semuanya dibawa bersama fail. Teks dalam alat yang templatnya SVG mengekalkan emoji sistem sendiri, jadi tiada apa-apa diberi kredit di situ. Sebelum anda memuat turun, baris **Source credits** menyatakan apa yang dikehendaki oleh sumber bagi penghantaran. Selepas muat turun, baris membaca semula bait yang dihantar sebelum menyatakan bahawa kredit ada dalam fail. Lesen yang meminta anda membuat pilihan, seperti glif CC BY-SA yang diwarnakan semula dan bakal anda kongsi, mendapat kad dengan pilihan. Muat turun tidak pernah disekat. [Hak kreatif dan kredit](/info/creative-rights.html) mempunyai ungkapan, lesen yang disemak dan apa yang kekal milik anda.

<!--i:eti-lock-->
## Perlindungan kata laluan

Lolly membuat dua jenis kunci, kedua-duanya pada peranti anda. Kad **Password** pada panel eksport menetapkan kedua-duanya.

![Kad Password dikembangkan pada eksport PDF, dengan medan kata laluan dan dua peringkat kunci](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpdf%26password%3Ddemo%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-pdfpass&dark=1&filename=exp-pdf-password)

**Kata laluan untuk membuka PDF** mempunyai dua peringkat setelah anda menaip kata laluan:

- **Weak**: RC4 40 bit, untuk `pdf` RGB tanpa tanda cetak atau bleed dan kata laluan ASCII biasa. Kata laluan dengan aksara lain beralih ke Strong, kerana pembaca tidak boleh membuka fail yang dikunci begitu pada peringkat ini. Hanya 32 aksara pertama diambil kira.
- **Strong**: AES-256 (PDF 2.0). Ia juga digunakan untuk Print PDF dan setiap PDF dalam ZIP kelompok. Print PDF yang dikunci dengan Strong mengekalkan CMYK, tanda dan niat outputnya tetapi menggugurkan dakwaan PDF/X-4.

::: warning Weak ialah penghalang, bukan perlindungan
Gunakan **Strong** untuk fail sulit.
:::

**ZIP berkunci** meliputi eksport ZIP, muat turun folder daripada Projects atau kelompok, dengan satu kata laluan pada dua peringkat: **Weak** (ZipCrypto, penghalang) atau **Strong** (AES-256). Kata laluan melindungi setiap ahli. Sebarang PDF di dalamnya juga dikunci dengan AES-256 secara berasingan, jadi PDF kekal berkunci selepas ZIP dinyahpek. Prom muncul apabila muat turun bermula. Kata laluan kosong bermakna tiada kunci.

**Kata laluan yang ditaip tidak dimasukkan ke dalam pautan pada kedua-dua peringkat.** Jika fail tiba melalui pautan `?password=`, Lolly membaca nilai dan membuangnya daripada alamat serta-merta. Pautan yang meminta kunci yang tidak boleh disimpan oleh failnya tidak menulis fail dan menyatakan sebabnya (lihat [`password`](/info/url-parameters.html)).

**Pautan kongsi yang dilindungi kata laluan** meminta kata laluan daripada penerima sebelum dibuka. Keadaan pautan disulitkan dengan AES-256 menggunakan kunci yang diterbitkan daripada kata laluan (PBKDF2). Hanya teks sifer dibawa, dan penyahsulitan berlaku dalam pelayar penerima. Pelayan yang menyajikan pautan tidak pernah melihat kata laluan atau reka bentuk. Hidupkannya dalam dialog **Share**. Pautan disulitkan hanya dibuka dalam Lolly, tidak pernah sebagai imej terbenam. Lihat [Mod URL](/info/url-mode.html).

<!--i:eti-monitor-->
## Pada telefon

Kawalan eksport terletak di sebalik butang terapung **Export**, yang membuka helaian **Export**: format, saiz, salin, muat turun dan kongsi yang sama, dengan saiz sesuai untuk sentuhan.

<!--i:eti-code-->
## Id format untuk pautan dan CLI

Ini ialah nilai untuk parameter URL `format=` dan bendera CLI `--export=` (lihat [Parameter URL](/info/url-parameters.html) dan [CLI](/info/cli.html)). Menu alat hanya menunjukkan format yang boleh dibuat oleh alat itu.

| Jenis | Id |
|---|---|
| Raster | `png` · `jpg`/`jpeg` · `webp` · `avif` · `jxl` · `jxl-lossless` · `tiff` (RGB TIFF) · `cmyk-tiff` (Print TIFF) · `bmp` · `ico` |
| Vektor | `svg` · `svgz` (SVG dimampatkan dengan gzip) · `emf` · `wmf` · `eps` · `eps-cmyk` (EPS CMYK) · `dxf` (fail potongan) |
| Halaman dan dokumen | `pdf` · `pdf-cmyk` (Print PDF) · `pptx` (PowerPoint) · `docx` (Word) · `odt` (OpenDocument Text) · `idml` (InDesign) · `penpot` (fail reka bentuk Penpot) · `scorm` (pakej kursus, ZIP) |
| Gerakan | `gif` · `apng` (Animated PNG) · `webp-anim` (Animated WebP) · `svg-anim` (Animated SVG) · `webm` · `mp4` · `lottie` (dotLottie) · `premiere-xml` (Premiere XML + media) |
| Audio | `wav` · `mp3` · `m4a` · `aac` · `opus` · `ogg` · `flac` · `mid` (not MIDI, daripada Lolly Rondocode) |
| Teks dan data | `html` · `md` · `txt` · `json` · `csv` · `ics` · `vcf` · `srt` · `vtt` · `ttml` · `scc` · `css` · `scss` · `gpl` (palet GIMP) |
| Himpunan dan pakej | `zip` · `rpm` dan `tar.gz` (render dimeterai ke dalam pakej Linux) |

Beberapa id datang daripada kod eksport alat sendiri: `ase` (Adobe Swatch Exchange, daripada Lolly Palette Lab) serta `exr` dan `hdr` (raster julat dinamik tinggi, daripada Lolly Darkroom). **Convert Font** menulis `ttf`, `otf` dan `woff` daripada fail fon yang anda bekalkan, jadi pautan kosong tidak memberikan apa-apa kepada alat untuk dirender.
