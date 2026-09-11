# Brand Studio

**Brand Studio** di `#/start` ialah satu-satunya tempat anda membentuk jenama anda - logonya, warnanya, jenis hurufnya, token-token lain anda dan fail yang disimpannya. Tetapkan di sini sekali sahaja dan setiap alat, halaman dan eksport akan mengikutinya *melalui pembinaan*, bukan melalui semakan.

Perubahan dipratonton **secara langsung merentasi seluruh aplikasi** semasa anda membuatnya, supaya anda dapat melihat warna atau fon itu terpakai di mana-mana sebelum anda mengesahkannya. Semuanya berlaku pada peranti: fail dan token jenama anda tidak pernah meninggalkan mesin anda (memilih Google Font mengambil satu keluarga fon itu daripada Google, sekali sahaja, selepas dialog persetujuan), dan jenama itu berpindah dalam satu fail [pek jenama](#move-a-brand-between-devices).

> **Inilah editornya. Dashboard adalah cerminnya.** Tab **Design system** pada Dashboard (`#/d`) *memaparkan* jenama anda dalam mod baca sahaja; anda *mengedit*nya di sini di `#/start`. Jika anda ingin menukar warna kemudian, kembali ke Brand Studio.

## Bilik-bilik

Studio ini adalah satu set **bilik** yang disenaraikan dalam satu rel di sisi - bukan langkah-langkah. Tiada apa yang bernombor, tiada apa yang bergantung kepada yang lain dan tiba di mana-mana satu daripadanya adalah sah:

- **Overview** - hab. Apa yang wujud sekarang, sepintas lalu, dengan satu pintu ke setiap bilik.
- **Colours** - tambah warna satu demi satu, tetapkan peranan atau jana keseluruhan palet daripada satu warna.
- **Type** - empat muka taip yang dibaca oleh aplikasi, alat anda dan setiap eksport.
- **Logos** - tanda anda, dalam setiap orientasi dan olahan.
- **Tokens** - jejari sudut, jarak, bayang dan selebihnya sistem.
- **Files** - fail imej, audio dan gerakan yang disimpan oleh jenama anda.

Pada telefon, senarai yang sama menjadi jalur cip mendatar yang disematkan di bawah pengepala. Menukar bilik tidak pernah memuat semula apa-apa - editor mengekalkan semua panelnya terpasang dan hanya memaparkan yang anda minta.

**Pautan terus ke satu bilik** dengan `#/start?area=<key>`. Kuncinya ialah `overview`, `color` *(perhatikan ejaan gaya AS dalam URL)*, `type`, `logos`, `tokens`, `catalogue` (bilik Files - kunci panel adalah kontrak kekal, jadi URL mengekalkan nama lamanya) dan `versions`. `?tab=` ialah alias lama untuk perkara yang sama dan masih berfungsi, jadi pautan dan penanda halaman lama terus berfungsi; apa-apa yang tidak dikenali akan membuka Overview dan bukannya jalan buntu.

Disematkan di **kaki rel** adalah tindakan yang tergolong kepada keseluruhan sistem reka bentuk dan bukan kepada satu bilik sahaja:

- **Add from…** - pemilih sumber, untuk membawa masuk jenama daripada fail, PDF, imej, fon atau laman web. Lihat [Bring a brand in](#bring-a-brand-in) di bawah.
- **Tray** - calon yang ditemui oleh satu imbasan tetapi belum disahkan. Ia kekal tersembunyi sehingga satu imbasan benar-benar menyimpan sesuatu, dan membawa satu kiraan apabila ia berbuat demikian; tiada apa di dalamnya mengubah jenama anda sehingga anda menekan Add pada baris itu.
- **Export** - menulis keseluruhan jenama sebagai satu `LollyBrand-…zip`.
- **Tokens (.json)** - dokumen token reka bentuk yang biasa dengan sendirinya, untuk repo, satu langkah binaan atau alat token yang lain.
- **Versions** - terbitkan, aktifkan dan pulihkan salinan bernama sistem reka bentuk. Tersembunyi sehingga ada sesuatu milik anda sendiri untuk diterbitkan (atau satu pautan `?area=versions` memintanya mengikut nama).

![Rel bilik studio - Overview, Colours, Type, Logos, Tokens dan Files](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-rail&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

## Overview

Overview ialah bilik tempat anda mendarat, dan ia mempunyai dua wajah.

Dengan **belum ada apa-apa yang disediakan lagi** ia menawarkan dua pintu - **Start from a file** (token reka bentuk, projek Penpot, pek sistem reka bentuk atau SVG) dan **Start from scratch** (tambah satu warna, kemudian teruskan bila-bila masa anda suka) - dan satu keluar senyap **Explore the tools** di bawahnya, kerana meninggalkan juga satu jawapan yang sah.

Setelah satu sistem reka bentuk wujud, bilik yang sama memaparkan **apa yang anda ada**: palet dan kiraan warnanya, keluarga taip yang berkuat kuasa, berapa banyak slot logo yang diisi, berapa banyak token yang ada dan bilik Files. Setiap blok adalah satu pintu ke biliknya. Di sini hanya ada kiraan, tidak pernah bar kemajuan dan tidak pernah kad selesai - tiada apa-apa dalam studio ini yang terhutang.

## Logos

Mulakan dengan mengosongkan folder tanda anda ke dalam zon lepas di bahagian atas: **"Drop marks here, or choose several at once"** menerima seberapa banyak fail yang anda ada dalam satu kali. Setiap fail dibaca untuk bentuk dan dakwatnya, kemudian dibariskan di bawah **Waiting for a slot** sebagai satu cip yang menyatakan apa yang ia fikirkan - *"Looks like the Horizontal primary"*, berserta ukuran yang menjadi asasnya, dan satu butang **Place** (**Replace**, jika slot itu sudah diisi). Jika ia tidak pasti, cip itu menyatakannya dengan jelas dan sebaliknya menawarkan **Change slot**, yang menyenaraikan kesemua lapan. Tiada apa yang diletakkan sehingga anda menekan sesuatu.

Dua perkara berlaku di sekeliling barisan itu. Satu tanda dengan jidar kosong berlebihan mendapat satu **tawaran pangkas** dahulu - jawab tawaran itu atau tekan Escape dan fail asal dimasukkan tanpa diubah. Dan jika satu tanda boleh memenuhi satu slot berkembar yang kosong, bilik itu menawarkan versi **mono** atau **reverse** terbitan sebagai cipnya sendiri, ditandakan *Generated*, yang akan hilang semula jika anda mengisi slot itu dengan cara lain.

Di bawahnya terletak grid tempat setiap tanda akhirnya berada - slot **orientation × treatment**:

- **Orientations:** Horizontal (wordmark + simbol dalam satu baris) dan Vertical (bertindan, untuk ruang segi empat sama dan tinggi).
- **Treatments:** Primary, Primary reverse (untuk latar belakang gelap), Mono (satu warna) dan Mono reverse.

Itulah lapan slot pilihan. Klik satu slot untuk menambah PNG, SVG, JPEG atau WebP; klik satu slot yang telah diisi untuk menggantikannya. Setiap slot adalah pilihan dan segala-galanya kekal pada peranti ini.

![Matriks logo - setiap orientasi merentasi bahagian atas, setiap olahan sebagai slot bergaris putus-putus tersendiri, kesemuanya pilihan](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&width=1440&height=1600&dpi=192&waitMs=1600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Custom marks** - tambah tanda yang dinamakan jenama anda dengan caranya sendiri (satu ikon, satu lambang, satu favicon) di bawah **Custom marks**; namakannya dan pilih satu fail.
- **More identities** - satu sub-jenama, produk atau acara boleh mempunyai set logo penuhnya sendiri. Gunakan **+ Add another logo** dan namakannya; set utama anda hanyalah "Your logo".
- **Upload an SVG and Lolly reads its colours.** Pada satu pemasangan baharu, ia secara senyap menetapkan warna primer anda daripada logo dan menyatakannya. Pada satu jenama sedia ada, ia sebaliknya menawarkan warna itu sebagai cadangan - *"Found in the logo: #…"* dengan satu butang **Use as primary** di sebelahnya - di bilik Colours, tempat anda boleh menerimanya atau mengabaikannya.

## Colours

![The Colours room after one colour - the two panes back, the generate offer, roles reading in three registers and the pane at one colour](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

Bilik yang paling kaya, dalam dua panel. Sebelah kiri ialah tempat anda bekerja; sebelah kanan ialah **palet langsung** anda. Seret pembahagi antara kedua-duanya untuk mengubah saiz (Enter padanya melipat palet ke tepi).

![Bilik Colours - satu warna primer menerbitkan ramp, kad spesimen dengan nisbah kontras dan satu palet langsung](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

### Tambah satu warna, kemudian berikannya satu peranan

**Add a colour** adalah keseluruhan laluan mudah itu: tampal atau pilih satu warna dalam apa-apa tatatanda dan ia menjadi tepat satu token. Tiada apa diterbitkan daripadanya, tiada apa dicadangkan ke dalamnya, tiada apa-apa lagi dituntut. Tampal satu *senarai* warna penuh dan setiap satu menjadi satu cip yang boleh anda tambah dengan sendirinya.

**Roles** ialah lapisan di atasnya - warna mana yang memainkan setiap peranan. Roles adalah pilihan (satu sistem reka bentuk dengan tiga warna longgar dan tiada peranan adalah satu sistem yang sempurna baik), mana-mana swatch boleh mengambil satu peranan dan bacaan kontras diukur berbanding permukaan, APCA dahulu.

### Sayap pakar

Empat bahagian terlipat terletak di bawah kedua-dua itu. Buka mana yang anda mahu; setiap satu boleh dipautkan terus sebagai `#/start?area=color&focus=<wing>`:

- **Generate a starter palette** (`focus=generate`) - satu warna menjadi satu set penuh warna gelap-terang. Diterangkan di bawah.
- **Shade curves** (`focus=curves`) - bentuk semula satu ramp titik demi titik. Kecerahan, kroma dan rona masing-masing mendapat lengkungnya sendiri, ditukar dengan L / C / H, dan warna gelap-terang di bawah dibakar semula secara langsung semasa anda menyeret.
- **Contrast** (`focus=contrast`) - **Contrast-lock** menala semula satu ramp untuk mencapai sasaran APCA berbanding satu latar belakang yang anda pilih, setiap langkah mengekalkan rona dan kroma tersendiri; **Rotate hue** memusingkan keseluruhan ramp itu secara menyeluruh mengelilingi roda, setiap warna gelap-terang mengekalkan kecerahan dan kroma masing-masing.
- **Print** (`focus=print`) - apa yang menjadi warna primer pada percetakan: nilai skrin automatiknya, atau satu binaan CMYK yang disematkan atau satu dakwat spot bernama sebagai gantinya.

### Satu warna, satu palet penuh

Di dalam **Generate a starter palette**, pilih satu **Primary colour** dan Lolly akan mengira satu palet lengkap - permukaan terang dan gelap, teks, aksen dan ramp tint/shade penuh - menggunakan matematik warna perseptual yang sama (OKLCH) yang digunakan oleh enjin di mana-mana sahaja. Tala terbitan itu:

- **Scheme** - Mono, Complement, Analogous atau Triad - menetapkan bagaimana warna sekunder berkait dengan warna primer anda.
- **Shades** - satu penggelangsar dari 3 hingga 20 (lalai 5) mengawal berapa banyak langkah yang dijana oleh setiap ramp.
- **Fine-tune** (terlipat) - **UI intensity** (Muted / Deep), **Contrast** (Comfort / High) dan **Text on brand** (Auto / Light / Dark).

Tiada apa-apa dalam sayap ini menulis apa-apa kepada jenama anda. Ia adalah satu pratonton, langsung merentasi aplikasi supaya anda boleh menilainya, sehinggalah anda menekan **Replace palette** (di bawah).

Di bawah warna primer anda akan melihat ramp **Primary / Neutral / Secondary / Blend** langsung serta kad spesimen Light dan Dark, setiap satu membawa bacaan kontras tersendiri - nisbah WCAG berserta angka APCA `Lc` di sebelahnya. **Klik satu langkah dalam ramp Neutral atau Secondary** untuk menambatkan warna gelap-terang itu selain daripada lalai terbitan.

![Empat rangkaian gred disusun di atas kad spesimen terang dan gelap, setiap kad membawa nisbah kontras WCAG tersendiri](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

### Bina palet anda (penjana harmoni)

Masih dalam sayap yang sama, **Build your palette** menjana warna aksen yang sepadan daripada warna utama anda. Pilih satu **Harmony** - **Complementary**, **Adjacent**, **Triad**, **Tetrad** atau **Analogous** (yang membawa bilangan **Accents** tersendiri, 2 hingga 5, dan **Angle** rona dari 10° hingga 45°) - dan setiap calon tiba dengan nama boleh baca yang dijana secara automatik serta butang **+ Add**. Menambah satu terus meletakkan warna itu dalam palet anda, satu tekan untuk satu token. *"Your palette, applied"* mempratonton keseluruhan set pada grafik sebenar.

![Aksen yang dijana, setiap satu dengan swatch, nama yang dijana secara automatik, kod heksnya dan butang Add](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### Mengesahkan palet yang dijana

**Replace palette** ialah satu-satunya kawalan dalam sayap ini yang menulis apa-apa, dan ia tidak pernah menulis serta-merta. Tekan ia dan satu kad semakan dibuka dahulu, berjudul **"Replace the palette?"**, menyenaraikan dengan tepat apa yang akan berlaku: berapa banyak peranan kekal seperti yang anda tetapkan, berapa banyak warna yang anda tambah sendiri dikekalkan, berapa banyak lengkung warna dijangkarkan semula, berapa banyak kunci cetak disemat semula, berapa banyak warna tersembunyi kekal tersembunyi, berapa banyak noktah gradien mengekalkan warnanya.

**Replace palette** pada kad itu mengesahkannya; **Cancel** berundur dan tidak mengubah apa-apa. Setelah ia berjalan, kad itu menjadi **"Palette replaced."** dengan satu **Undo** yang sudah difokuskan - dan satu titik semak bagi keseluruhan sistem reka bentuk diambil *sebelum* pertukaran itu, jadi "kembalikan seperti asal" adalah satu pemulihan, bukan satu petang yang hilang.

### Palet, carta dan setiap swatch

Anak tetingkap kanan menyenaraikan setiap warna yang dibawa jenama anda, dikumpulkan (Primary, Neutral, Secondary, Spectrum, Custom, Roles), setiap kumpulan boleh dilipat dengan **+ Add** tersendiri. Di bawahnya, **Colour chart** membuka kepada dua paparan swatch yang sama: **Wheel** (roda OKLCH - seret satu titik untuk menukar warnanya, klik satu titik untuk menyuntingnya atau klik ruang kosong untuk menjatuhkan swatch baharu) dan carta **Gamut**, yang menunjukkan di mana julat yang boleh dipaparkan sebenarnya berakhir. `#/start?area=color&focus=chart` membuka kad itu terus, sepertimana `?wheel` sentiasa lakukan.

![Anak tetingkap palet, setiap kumpulan boleh dilipat, dengan pil muat turun diletakkan di tepi bawahnya](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A500%3Bclick%3A%5Bdata-be-generate-cta-go%5D%3Bwait%3A900%3Bclick%3A%5Bdata-be-replace-palette%5D%3Bwait%3A800%3Bclick%3A%5Bdata-be-review-go%5D%3Bwait%3A1400&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![Roda OKLCH - sudut ialah rona, jarak keluar ialah kroma dan warna kelabu bergerak mengikut landasan kecerahan di tepi](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A500%3Bclick%3A%5Bdata-be-generate-cta-go%5D%3Bwait%3A900%3Bclick%3A%5Bdata-be-replace-palette%5D%3Bwait%3A800%3Bclick%3A%5Bdata-be-review-go%5D%3Bwait%3A1400%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

Klik mana-mana swatch untuk membuka penyuntingnya:

- **Rename** ia.
- **Set the colour** - pemilih dibuka pada gelongsor **OKLCH** persepsi, dengan mod untuk **Hex**, **HSL**, **RGB** dan **CMYK**; medan nilai membaca *dan* menulis dalam ruang mana pun yang aktif, jadi anda boleh tampal kod heks atau menaip peratusan dakwat. Perhatikan bahawa memasukkan CMYK menetapkan warna *skrin* melalui penukaran - untuk menyemat dakwat yang tepat, gunakan kunci cetak di bawah.
- **Stored as** - pilih cara swatch itu disimpan: **LCH** (lalai - persepsi, gamut lebar, pilihan terbaik untuk penyuntingan), Hex, RGB atau HSL. Ubahnya apabila anda perlu menyemat kod heks warisan yang tepat atau memadankan nilai sRGB.
- **Use as** - serahkan swatch ini kepada salah satu peranan jenama secara terus, tanpa kembali ke panel Roles. (Jubin peranan itu sendiri tidak menawarkannya - satu peranan tidak boleh mengambil satu peranan.)
- **Print substitutes** (dilipat) - kunci kelakuan cetak warna itu:
  - **CMYK** - tukar daripada **Auto** kepada **Locked** untuk mengatasi penukaran sRGB→CMYK automatik dengan nilai dakwat yang tepat (C/M/Y/K, 0–100).
  - **Spot colour** - tukar daripada **None** kepada **Set** untuk mengunci swatch itu kepada warna spot; berikan ia satu **Name** (cth. `PANTONE 186 C`), satu **Book** pilihan dan satu **Finish** pilihan (Ordinary ink secara lalai) untuk masa dakwat itu bukan dakwat langsung - kerajang, emboss atau deboss, varnish spot, sentuhan lembut atau die cut, lipatan atau perforasi.
- **In other spaces** (dilipat) - idea yang sama diperluas: setiap baris ialah satu ruang yang boleh dinyatakan oleh swatch ini, sama ada diterbitkan daripada nilai kanonik atau dikarang oleh anda, dan yang dikarang mengatasi semasa eksport.

Kunci cetak ini adalah apa yang digunakan oleh sebuah percetakan apabila anda mengeksport PDF atau TIFF CMYK - lihat [Eksport](/info/exporting.html#colour-profiles).

**Deleting a swatch** adalah selamat: langkah gred terbitan dan peranan tema *disembunyikan* (token asas terus diselesaikan, jadi tiada apa yang rosak di hiliran), manakala warna yang anda tambah sendiri dialih keluar terus.

### Gradien

Panel **Gradients** pilihan membina token campuran daripada palet anda untuk latar belakang dan aksen. Langkau sepenuhnya jika jenama anda tidak menggunakan gradien. Setiap gradien mempunyai pratonton, noktah bernama (2–8) dan satu sudut. Kelakuan utamanya: **satu noktah merujuk kepada satu swatch**, jadi tukar warna swatch itu dan gradien turut berubah. Interpolasi berjalan dalam OKLCH untuk campuran yang bersih. Padam satu noktah untuk memendekkan turutan.

### Bawa palet ke tempat lain

Pil terapung yang diletakkan di tepi bawah anak tetingkap palet memuat turun keseluruhan palet sebagai **Design tokens (JSON)**, **CSS variables**, **CSS classes**, **SCSS variables**, satu **GIMP palette (.gpl)** atau satu **Adobe Swatch Exchange (.ase)** - jadi jenama itu terus masuk ke dalam Illustrator, Figma, GIMP atau helaian gaya. Ia berada di luar penatal anak tetingkap itu, jadi ia kekal di tempatnya tidak kira sejauh mana palet ditatal. (Anda juga boleh memuat turun palet daripada paparan [Catalogue](/info/using.html).)

## Type

![The compare stage open under its card, with the search row, the pinned families and the cards folded to a one-line strip](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

Bilik ini bermula dengan **empat kad peranan** - empat muka taip yang sebenarnya dibaca oleh aplikasi, alat anda dan setiap eksport. Setiap kad menunjukkan apa yang berkhidmat untuk peranan itu sekarang, ditetapkan dalam muka taip itu, dengan satu baris teks sebenar di bawahnya:

- **Primary** - teks badan, butang dan setiap alat.
- **Headings** - muka taip paparan untuk `h1`/`h2`.
- **Code** - muka taip monospace untuk kod dan data.
- **Italic** - pasangan italic sebenar untuk penekanan, petikan dan sampingan.

Headings, code dan italic masing-masing kembali kepada primary sehingga anda menetapkannya, jadi jenama satu fon tidak memerlukan sebarang keputusan di sini. Tiada apa-apa pada kad yang mengesahkan apa-apa: **Change** (atau **Choose a face** pada peranan kosong) membuka **peringkat perbandingan** yang terhad kepada peranan itu.

![Bilik Type - kad peranan dan spesimen langsung setiap muka taip menjalankan tugasnya](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

### Peringkat perbandingan

Peringkat ini dibuka **secara inline dalam bilik**, bukan dalam dialog, jadi kad yang anda datang daripadanya kekal pada skrin. Cari satu keluarga Google Fonts (Inter, Fraunces, Space Grotesk…) atau jatuhkan satu fail fon, tekan **Add to the comparison** dan calon-calon berdiri bersebelahan dalam perkataan yang sama sebelum mana-mana daripadanya dipasang. Escape membatalkan dan menyerahkan papan kekunci kembali kepada kad yang anda buka daripadanya.

Itulah satu-satunya pintu masuk, itulah sebabnya tiada apa-apa yang memasuki jenama anda tanpa dilihat. Di bawah stage terdapat dua panel pengurusan:

- **Fonts on this device** - setiap keluarga yang dipasang, peranan yang dikhidmatinya dan satu padam. **Add a face** di sini membuka peringkat perbandingan yang sama tanpa had.
- **Your fonts** - muat naik satu **TTF**, **OTF** atau **WOFF** daripada mesin anda sendiri. Itulah laluan untuk muka taip korporat berlesen yang sudah anda miliki.

Walau apa pun caranya, muka taip itu kekal pada peranti ini, terpapar dalam aplikasi, dalam alat anda dan dalam setiap eksport, luar talian selama-lamanya dan turut serta dalam pek jenama anda - tiada apa yang diambil semasa masa paparan. Segalanya pada Google Fonts dihantar di bawah lesen terbuka (OFL/Apache/UFL).

Panel **Type roles** di bahagian bawah menunjukkan spesimen langsung setiap peranan - badan dan UI dalam primary, muka taip paparan pilihan untuk tajuk atas, satu italic untuk penekanan, satu mono untuk kod dan data - jadi anda boleh melihat keseluruhan set berfungsi bersama.

![Spesimen Type roles - tajuk, badan, italic dan kod, setiap satu ditetapkan dalam muka taip yang diselesaikan oleh peranan itu, dengan nama muka taip di sebelahnya](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

## Tokens

Selebihnya sistem reka bentuk, boleh disunting tanpa menyentuh kod:

![Bilik Tokens - gelongsor jejari sudut ditambah jarak, saiz, bayang dan selebihnya sistem](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **Rounded corners** - satu gelongsor jejari tunggal (0–1.5rem) yang diikuti oleh kad, butang dan panel di seluruh aplikasi.
- **More tokens** - tambah dan sunting **spacing**, **sizing**, **stroke width**, **opacity**, **rotation**, **numbers** biasa dan **shadows**. Pilih satu jenis, namakannya (*Gutter, Card shadow…*) dan tetapkan nilainya. Ini disimpan sebagai [token reka bentuk](/info/design-tokens.html) (DTCG) standard dan turut serta dengan jenama anda.

## Files

Jatuhkan fail yang disimpan jenama anda - selain logo - di sini: aset **vector**, **image**, **audio** dan **motion** (video, Lottie, animasi). Ia mendarat dalam [Catalogue](/info/using.html) anda, disusun ke dalam bahagian dan sedia dalam pemilih aset setiap alat. Segalanya kekal pada peranti ini. (Rel melabelkan bilik itu **Files**; kunci URL kekal `catalogue`, kerana kunci panel adalah kontrak kekal.)

## Bawa masuk satu jenama

**Add from…** di bahagian bawah rel membuka pemilih dua peringkat. Peringkat pertama bertanya apa yang anda *ada*, bukan apa formatnya:

- **Design tokens or a design file** - DTCG atau Tokens Studio JSON, satu projek Penpot, satu **zip set token**, satu pek sistem reka bentuk Lolly atau satu SVG.
- **PDF** - satu dek atau fail garis panduan, dibaca pada peranti ini untuk warnanya, tandanya dan muka taip terbenamnya.
- **Image** - satu tangkapan skrin atau foto; warnanya dibaca pada peranti ini dan tiada apa yang dimuat naik.
- **Font file** - TTF, OTF atau WOFF. Membuka bilik Type, tempat muka taip itu dipasang.
- **Website** - satu halaman, dibaca untuk warna dan taipnya. Jubin ini hanya muncul pada peranti yang benar-benar boleh membaca satu halaman, kerana satu jubin yang dilumpuhkan mengiklankan sesuatu yang tiada siapa boleh tekan adalah lebih teruk daripada tiada jubin langsung. Di mana ia muncul, ia menamakan pembacanya dengan jelas: diambil oleh aplikasi pada peranti ini, atau dibaca melalui sambungan pelayar dalam tab latar belakang, dilog masuk sebagai anda. Menamakan satu URL hanya *pra-isi* medan itu - butang ambil adalah persetujuannya, jadi satu pautan yang dihantar seseorang kepada anda tidak boleh memulakan satu bacaan.

Pilih sumber fail reka bentuk dan peringkat kedua ialah kad di bawah: format yang diterima mendahului sebagai jubin ikon mengikut susunan keutamaan, dan keseluruhan kad adalah satu sasaran jatuhan - klik di mana-mana di atasnya atau seret satu fail ke atasnya. Anda juga boleh menjatuhkan satu fail terus ke atas studio.

![Kad import - format yang diterima mendahului sebagai jubin ikon, dan keseluruhan kad adalah satu sasaran jatuhan](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

Apa yang diberikan oleh setiap fail reka bentuk kepada anda:

- satu pek **LollyBrand** (`.zip`) - dipasang dalam satu langkah;
- satu eksport **Penpot** (`.penpot`) - menarik masuk token reka bentuknya;
- satu fail **Design Tokens** (`.json`) - W3C DTCG;
- satu fail **Tokens Studio** (`.json`) - Tokens Studio;
- satu **SVG biasa** (`.svg`) - Lolly mengimbas warnanya dan membenarkan anda memilih mana yang hendak dikekalkan, yang pertama menjadi primary anda.

Satu pemasangan sumber mengambil **checkpoint dahulu**, jadi "kembali kepada sebelum import" adalah satu pemulihan. Dan apa yang ditemui oleh satu imbasan tidak terus masuk: calon-calon mendarat dalam **Tray**, di mana setiap satu ditambah melalui tekanan tersendiri, melalui bilik yang memiliki jenis bahan itu.

`#/start?source=<kind>` membuka pemilih pada satu sumber yang diberikan (`file`, `pdf`, `image`, `font`, `url`), dan `?import` membukanya pada senarai biasa.

## Pindahkan satu jenama antara peranti

**Export** di bahagian bawah rel menulis satu **`LollyBrand-…zip`** tunggal - token, fon, logo dan pilihan tema anda, dengan satu manifes integriti yang disahkannya semasa dibawa masuk semula. Di sebelahnya, **Tokens (.json)** menulis dokumen token reka bentuk biasa dengan sendirinya: tiada fon, tiada logo, hanya token, iaitu apa yang sebenarnya dibaca oleh satu repo, satu langkah CI atau satu alat token lain.

Membawa satu semula ke dalam adalah **Add from… → Design tokens or a design file** (di atas), atau satu seret-dan-lepas ke atas studio. Beginilah cara seorang rakan sekerja menyerahkan satu jenama kepada anda, atau cara anda membawa satu ke pemasangan kedua - tiada akaun, tiada awan. Untuk membawa masuk satu jenama daripada baris arahan sebaliknya, lihat [`ingest:brand`](/info/configuration.html#brand-packs).

## Versi

**Versions** di kaki rel ialah tempat sesuatu design system berhenti menjadi sasaran yang sentiasa bergerak. Terbitkan satu dan anda mendapat **salinan kekal bernama** yang disimpan pada peranti ini: ia tidak pernah berubah selepas itu, jadi sesuatu alat yang menyematkannya akan terus melukis perkara yang sama. Panel ini kekal tersembunyi sehingga ada sesuatu milik anda sendiri untuk diterbitkan, jadi sesebuah studio yang tidak pernah menerbitkan tidak akan sekali-kali melihat kawalan-kawalan ini.

Tiga perkara yang perlu diketahui sebelum anda menekan apa-apa, dan panel ini menyatakan ketiga-tiganya sebelum penekanan dan bukan selepasnya:

- **Sesuatu versi bersifat kekal.** Belum ada ciri padam, jadi panel itu menyatakan apa yang telah disimpan dan bahawa ia kekal tersimpan, bukannya menawarkan butang yang berbohong.
- **Pengalihan keluar diutamakan pada kad keserasian.** Token yang ditambah dan diubah adalah berita; satu token yang *dialih keluar* ialah perkara yang merosakkan sesuatu alat, jadi ia dinamakan terlebih dahulu dan disebut sebagaimana adanya.
- **Penerbitan tidak boleh dibuat asal; pemulihan boleh.** *Restore latest from this version* ialah suntingan biasa pada head, jadi ia masuk ke dalam tindanan buat asal studio itu dan panel itu terus menawarkan anda **Undo**.

Anda boleh **Publish only**, atau **Publish and make active** - perbezaannya ialah sama ada alat dan aplikasi mengikut versi tersebut mulai sekarang atau terus mengikut suntingan terkini anda. **Follow the latest again** menjadikan setiap suntingan langsung sebaik sahaja ia dibuat. `#/start?area=versions` membuka panel tersebut secara terus.

## Apabila Jenama Ditetapkan

Sesetengah binaan menghantar **jenama terkunci** - warna, fon dan tokennya adalah apa yang digunakan oleh setiap alat dan eksport, dan tiada apa yang boleh diubah. Dalam kes ini, studio digantikan dengan nota ringkas yang menerangkan bahawa binaan ini menghantar jenama tetap dan penyuntingan dimatikan. Ini adalah disengajakan: begitulah cara sesebuah organisasi menjamin segala-galanya kekal mengikut jenama.

## Ke mana seterusnya

- **[Using Lolly](/info/using.html)** - kanvas, penyimpanan, projek dan katalog.
- **[Design Tokens](/info/design-tokens.html)** - model token tempat jenama anda dinyatakan.
- **[Exporting & formats](/info/exporting.html)** - unit cetak, CMYK dan format yang menjadi hasil render jenama anda.
