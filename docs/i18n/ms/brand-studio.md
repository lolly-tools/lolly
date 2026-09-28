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
- **Export** - menulis keseluruhan sistem reka bentuk sebagai satu `LollyBrand-….lolly`.
- **Tokens (.json)** - dokumen token reka bentuk yang biasa dengan sendirinya, untuk repo, satu langkah binaan atau alat token yang lain.
- **Restore brand settings** - kembali kepada satu checkpoint yang disimpan sebelum satu import atau penggantian tetapan jenama.
- **Versions** - terbitkan, aktifkan dan pulihkan salinan bernama sistem reka bentuk. Tersembunyi sehingga ada sesuatu milik anda sendiri untuk diterbitkan (atau satu pautan `?area=versions` memintanya mengikut nama).

![Rel bilik studio - Overview, Colours, Type, Logos, Tokens dan Files](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-rail&waitSelector=.ds-rail&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

## Overview

Overview ialah bilik pertama, dan ia mempunyai dua wajah.

Dengan **belum ada apa-apa yang dipilih lagi** ia memaparkan **Make it yours**. **Start from a reference** membuka pemilih sumber untuk satu logo, tangkapan skrin, laman web atau fail reka bentuk. **Pick a colour**, **Choose a face** dan **Add a logo** membuka kawalan sedia ada masing-masing terus. Setiap laluan bermula dengan satu pilihan; membuka satu tidak menulis apa-apa. **Explore the tools** tersedia serta-merta.

Sebaik sahaja ada sesuatu milik anda sendiri, bilik yang sama memaparkan **apa yang anda ada**, dengan kiraan yang anda buat mendahului. Colours membaca bilangan warna yang dibawa oleh sistem reka bentuk, dan menambah satu `· N starter` malap hanya di mana ada warna warisan dipaparkan; jalur di sebelahnya meletakkan warna yang anda pilih dahulu, kemudian satu garis nipis dan warna starter yang pudar. Type membaca mengikut peranan (*Inter untuk tajuk*, dengan *Starter untuk selebihnya · SUSE, SUSE Mono* di bawahnya). Logos membaca berapa banyak slot yang diisi, atau **Not set**. Tokens membawa jejari sudut, ditag *starter* sehingga anda mengalihkannya. Files menyatakan **Nothing yet** semasa pustaka itu kosong. Setiap blok adalah satu pintu ke biliknya. Di sini hanya ada kiraan, tidak pernah satu bar kemajuan dan tidak pernah satu kad selesai - tiada apa-apa dalam studio ini yang terhutang.

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

Bilik ini berkembang seiring sistem reka bentuk. Tiada apa yang belum anda perlukan berada pada halaman itu, jadi lawatan pertama hanyalah satu keputusan dan selebihnya tiba seiring palet berkembang.

### Warna pertama

Satu sistem reka bentuk tanpa warna sendiri dibuka pada satu lajur berpusat: **Start with one colour**, satu cip langsung yang besar, satu medan, dan satu baris senyap menyatakan bahawa roles, shades dan tetapan cetak tiba seiring sistem itu berkembang.

- **The chip is the picker.** Tekan ia dan kad OKLCH milik studio sendiri terbuka pada cip itu, disemai dengan apa sahaja yang dipegang medan itu: satu nama, roda, empat dail, alfa dan **Stored as**, dengan **Cancel** dan **Add colour** di bahagian bawah. Menyeret satu dail mengecat cip itu dan menulis semula medan itu semasa anda berbuat demikian, dan tiada apa sampai ke sistem reka bentuk sehingga anda menekan **Add colour**.
- **The field takes any notation** - `#e0452b`, `rgb(224 69 43)`, `oklch(58% .19 32)` atau satu nama warna biasa - dan satu keseluruhan *senarai* warna menjadi satu barisan cip yang anda tambah satu demi satu.
- **Two more doors sit beside it.** Alat penitis warna (pada pelayar yang memilikinya) mengambil satu warna daripada skrin, dan **From an image** membaca satu tangkapan skrin atau satu foto pada peranti ini dan menawarkan warna yang ditemuinya.
- **Add is never disabled.** Dengan tiada apa yang boleh dibaca dalam medan itu, ia membuka pemilih, iaitu apa yang biasanya dimaksudkan oleh satu tekanan kosong; teks yang tidak dapat dihuraikannya mendapat satu baris di bawah medan itu menyatakan demikian, dan bukannya satu butang mati.

Warna pertama menjadi **primary**, dan cip yang menjawab penambahan itu menyatakan demikian - *"Primary is now Vivid Violet"* - dengan **Fine-tune** di sebelahnya.

![Bilik Colours dengan belum ada apa-apa yang dipilih - satu cip langsung yang besar, satu medan dan satu baris tentang apa yang tiba kemudian](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

### Starter

**Starter** ialah perkataan untuk apa sahaja yang datang bersama aplikasi dan bukannya dipilih. Satu pemasangan baharu tidak membawa sebarang warna langsung: yang ada padanya ialah satu ramp neutral, dakwat menerusi kertas, supaya permukaan, teks dan garis nipis dapat dirender sebelum sesiapa memutuskan apa-apa. Neutral itu adalah perancah, jadi ia tidak dikira sebagai warna dan ia tidak dilukis dalam anak tetingkap palet. Ia tinggal dalam bilik [Tokens](#tokens) sebagai **Neutrals · starter · 9**, dengan satu **Open** yang menunjukkannya dalam anak tetingkap Colours sebagai satu kumpulan bertag yang terlipat (`#/start?area=color&group=neutral`).

Perkataan yang sama berjalan menerusi setiap bilik: satu peranan yang berdiri di atas satu warna starter berbunyi *"Starter Paper stands in"* dan pemilihnya menawarkan **Choose…**; satu muka taip starter memakai satu tag **Starter** dan tiada tona; satu jejari sudut starter ditag pada Overview. Bahan warisan tidak pernah dilukis dengan sempadan bergaris putus-putus, kerana satu sempadan bergaris putus-putus bermaksud satu sasaran jatuhan di sini.

### Seiring palet berkembang

Warna anda kekal di sebelah satu pratonton **In context** pada skrin lebar dan bertindan di atasnya pada skrin lebih kecil. Pratonton itu boleh menunjukkan satu poster, carta atau kad antara muka menggunakan palet anda. Warna starter kekal dalam kumpulan boleh lipatnya sendiri, berasingan daripada warna yang anda tambah.

Tambah warna secara individu atau satu set shades, tetapkan peranan masing-masing, dan buka bahagian lanjutan apabila anda memerlukannya. Carta warna, gradien dan kawalan muat turun kekal bersama palet.

![Bilik Colours selepas menambah satu warna, dengan paletnya dan satu pratonton komposisi langsung](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

### Roles - apa yang dibaca oleh alat

**Roles** ialah lapisan di atas swatch: warna mana yang memainkan setiap bahagian dalam setiap alat dan eksport. Roles adalah pilihan (satu sistem reka bentuk dengan tiga warna longgar dan tiada roles adalah satu sistem yang sempurna baik), mana-mana swatch boleh mengambil satu roles dan bacaan kontras diukur berbanding permukaan, APCA dahulu.

Satu baris terbaca dalam salah satu daripada tiga register, jadi jalur itu tidak pernah menuntut satu keputusan yang tidak dibuat oleh sesiapa:

- satu warna sendiri yang berkhidmat untuk roles itu, pada kekuatan penuh;
- **Starter *Paper* stands in** - malap, dengan **Choose…** pada pemilihnya;
- **↳ follows Primary** - roles itu menyelesai menerusi primary dan bukannya kepada satu warna miliknya sendiri.

Sebaik sahaja palet mempunyai shades, jalur itu berkembang kepada ketujuh-tujuh slot yang boleh dibaca oleh satu alat: Primary, Secondary, Surface, Text, Muted, Edge dan On primary. On primary diterbitkan daripada primary, terbaca sebagai **Derived** dan tidak membawa sebarang pemilih.

**Aksen aplikasi itu sendiri adalah satu keutamaan, bukan satu token.** Secara lalai antara muka mengikuti sistem reka bentuk dan aksen chrome mengambil warna primary. Itu adalah satu tetapan Appearance pada [profil anda](/info/profile.html) - **Interface follows the design system** - dan mematikannya membiarkan chrome neutral. Alat, kanvas dan eksport tidak terjejas sama ada, dan fon serta jejari sudut mengikut sistem reka bentuk sama ada tetapan itu dihidupkan atau dimatikan.

### Sayap pakar

Empat bahagian terlipat terletak di bawah pratonton komposisi dan roles warna. Buka yang anda mahu; setiap satu boleh dipautkan terus sebagai `#/start?area=color&focus=<wing>`, yang membukanya walau apa sekalipun yang sedang dipaparkan oleh bilik itu:

- **Explore shades & harmonies** (`focus=generate`) - satu warna menjadi satu set shades yang lengkap. Diterangkan di bawah.
- **Shade curves** (`focus=curves`) - bentuk semula satu ramp titik demi titik. Lightness, chroma dan hue masing-masing mendapat lengkungnya sendiri, ditukar dengan L / C / H, dan shades di bawah dibakar semula secara langsung semasa anda menyeret.
- **Contrast** (`focus=contrast`) - **Contrast-lock** menala semula satu ramp untuk mencapai sasaran APCA berbanding satu latar belakang yang anda pilih, setiap langkah mengekalkan hue dan chroma tersendiri; **Rotate hue** memusingkan keseluruhan ramp itu secara menyeluruh mengelilingi roda, setiap shade mengekalkan lightness dan chroma masing-masing.
- **Print** (`focus=print`) - apa yang menjadi primary pada percetakan: nilai skrin automatiknya, atau satu binaan CMYK yang disematkan atau satu dakwat spot bernama sebagai gantinya.

### Satu warna, satu palet penuh

Di dalam **Explore shades & harmonies**, pilih satu **Starting colour**. Lolly mencadangkan shades sepadan menggunakan matematik warna perseptual yang sama (OKLCH) yang digunakan oleh enjin di tempat lain. Tala cadangan itu:

- **Scheme** - Mono, Complement, Analogous atau Triad - menetapkan bagaimana warna secondary berkait dengan primary.
- **Shades** - satu penggelangsar dari 3 hingga 20 (lalai 5) mengawal berapa banyak langkah yang dijana oleh setiap ramp.
- **Fine-tune** (terlipat) - **UI intensity** (Muted / Deep), **Contrast** (Comfort / High) dan **Text on brand** (Auto / Light / Dark).

Menukar starting colour dan kawalan hanya menukar cadangan itu. Klik satu shade untuk menambah warna itu, atau **Add 5 shades** untuk menambah satu kumpulan (kiraan itu mengikut tetapan Shades anda). Warna dan roles sedia ada kekal di tempatnya. Undo mengalih keluar penambahan itu.

Baris **Primary**, **Neutral** dan **Secondary** menunjukkan shades yang dicadangkan. Buka **Theme preview** untuk memeriksa contoh terang dan gelap serta bacaan kontrasnya. Pilih satu langkah Neutral atau Secondary di situ untuk melaraskan sauh tema yang dicadangkan. Membina semula keseluruhan palet kekal sebagai satu tindakan berasingan yang disemak di bawah.

![Tiga kumpulan shade yang dicadangkan, dengan kawalan tambah individu dan satu Theme preview berasingan](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

### Bina palet (penjana harmoni)

Dalam **Find matching colours**, penjana harmoni mencadangkan warna aksen sepadan daripada primary. Pilih satu **Harmony** - **Complementary**, **Adjacent**, **Triad**, **Tetrad** atau **Analogous** (yang membawa kiraan **Accents** tersendiri, 2 hingga 5, dan satu **Angle** hue dari 10° hingga 45°) - dan setiap calon tiba dengan satu nama boleh baca yang dijana secara automatik serta satu butang **+ Add**. Menambah satu terus meletakkan warna itu dalam palet, satu tekan untuk satu token. **In context** mempratonton warna yang anda tambah pada komposisi contoh.

![Aksen yang dijana, setiap satu dengan satu swatch, nama yang dijana secara automatik, kod heksnya dan satu butang Add](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&drive=click%3A.be-generate-detail%3Anot%28%5Bdata-be-rebuild%5D%29%20%3E%20summary%3Bwait%3A500&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### Mengesahkan palet yang dijana

Menambah satu warna atau kumpulan shade yang dicadangkan mengekalkan selebihnya palet anda. Untuk satu penggantian lengkap, buka **Rebuild the whole palette…** dan tekan **Preview full rebuild**. Semakan itu menerangkan perubahan: berapa banyak roles kekal seperti yang anda tetapkan, berapa banyak warna yang anda tambah sendiri dikekalkan, berapa banyak shade curves ditambatkan semula, berapa banyak kunci cetak disemat semula, berapa banyak shades tersembunyi kekal tersembunyi, berapa banyak noktah gradien mengekalkan warnanya.

**Apply rebuilt palette** pada kad itu mengesahkannya; **Cancel** berundur dan tidak mengubah apa-apa. Setelah ia berjalan, kad itu menawarkan **Undo** dengan fokus sudah berada padanya - dan satu checkpoint bagi keseluruhan sistem reka bentuk diambil *sebelum* pertukaran itu, jadi "kembalikan seperti asal" adalah satu pemulihan, bukan satu petang yang hilang.

### Palet, carta dan setiap swatch

Palet itu menyenaraikan warna sistem reka bentuk dalam kumpulan boleh lipat, setiap satu dengan kawalan **+ Add** tersendiri. Cipta dan namakan semula kumpulan untuk menyusun kerja anda. Satu roles tidak pernah mencipta jubin kedua: satu token adalah satu jubin, dan satu jubin yang ditunjuk oleh satu roles memakai satu tanda sudut kecil sebagai gantinya (**P**, **S**, **Su**, **T**). Di bawah jubin-jubin itu, **Colour chart** melipat terbuka kepada dua paparan swatch yang sama: **Wheel** (roda OKLCH - seret satu titik untuk menukar warnanya, klik satu titik untuk menyuntingnya atau klik ruang kosong untuk menjatuhkan swatch baharu) dan carta **Gamut**, yang menunjukkan di mana julat yang boleh dipaparkan sebenarnya berakhir. `#/start?area=color&focus=chart` membuka kad itu terus, sepertimana `?wheel` sentiasa lakukan.

![Anak tetingkap palet, setiap kumpulan boleh dilipat, dengan pil muat turun diletakkan di tepi bawahnya](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![Roda OKLCH - sudut ialah hue, jarak keluar ialah chroma dan warna kelabu bergerak mengikut landasan lightness di tepi](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

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

### Bekerja dengan banyak swatch

Setiap swatch mempunyai pemegang seret yang berasingan. Seret untuk menyusun semula warna dalam kumpulannya, atau fokuskannya, tekan Space, guna kekunci anak panah, dan tekan Space semula untuk melepaskannya. Escape membatalkan. Susunan itu bertahan apabila studio dibuka semula dan boleh dibuat asal. Untuk mengalihkan warna antara kumpulan, guna kawalan **Group** penyunting swatch atau pilih beberapa warna dan guna **Move**. Nama token dan rujukan roles kekal utuh.

Pemilihan dalam anak tetingkap palet adalah satu gerak isyarat, bukan satu mod. Tiada butang untuk ditekan dahulu, dan bar itu tiba bersama jubin pertama yang dipilih dan pergi bersama yang terakhir.

- **Seret pada ruang kosong anak tetingkap itu** untuk melukis satu segi empat tepat: setiap jubin yang disentuhnya menyertai pemilihan, merentasi sempadan kumpulan. Satu bahagian terlipat tidak menyumbang apa-apa, dan satu seretan yang tidak pernah bergerak mengosongkan pemilihan.
- **Shift-click** mengambil julat itu mengikut susunan bacaan; **Cmd/Ctrl-click** menogol satu jubin; satu klik biasa tetap membuka penyunting jubin itu.
- Setiap pengepala kumpulan membawa **Select all**, dan **Cmd-A** dengan satu jubin difokuskan mengambil setiap warna yang dimiliki sistem reka bentuk - tidak pernah satu warna starter.
- Grid itu mempunyai satu tab stop. Anak panah berjalan melaluinya, Shift-anak panah melanjutkan pemilihan, Space menogol satu jubin, Delete mengalih keluar pemilihan itu dan Escape mengosongkannya. (Anak panah hanya menggerakkan fokus: untuk menolak satu saluran, tekan `l`, `c` atau `h` dahulu, seperti yang dinyatakan oleh bacaan itu.)
- Pada satu skrin sentuh tiada segi empat tepat. Tekan dan tahan satu jubin untuk memulakan satu pemilihan, kemudian ketik untuk menambah; **Select all** setiap kumpulan membawa selebihnya.

Bar itu sendiri berbunyi **{n} selected**, kemudian **Move to** (satu kumpulan sedia ada, atau satu baharu yang anda namakan di dalam menu), **Give a role** (setiap warna terpilih mengambil roles seterusnya secara bergilir, jadi empat jubin mengisi keempat-empat roles dalam satu tekanan), **Download** (pemilihan itu dalam mana-mana daripada enam format palet), **Copy values** (satu baris bagi setiap warna dalam tatatandanya yang tersimpan) dan **Delete**. Move to dan Give a role muncul sebaik sahaja palet mempunyai shades untuk dialihkan. Satu Ctrl/Cmd-Z membuat asal keseluruhan satu tindakan pukal - satu pengalihan empat puluh, satu pusingan roles, satu pemadaman - dan satu pemadaman menyatakan apa yang dikekalkannya, kerana satu pemilihan menjangkau jubin yang tidak dialih keluar oleh bilik ini.

### Gradien

Satu panel **Gradients** pilihan membina token campuran daripada palet untuk latar belakang dan aksen. Langkau sepenuhnya jika sistem reka bentuk itu tidak menggunakan gradien. Setiap gradien mempunyai satu pratonton, noktah bernama (2–8) dan satu sudut. Kelakuan utamanya: **satu noktah merujuk kepada satu swatch**, jadi tukar warna swatch itu dan gradien turut berubah. Interpolasi berjalan dalam OKLCH untuk campuran yang bersih. Padam satu noktah untuk memendekkan turutan itu.

### Bawa palet ke tempat lain

Pil terapung yang diletakkan di tepi bawah anak tetingkap palet memuat turun keseluruhan palet sebagai **Design tokens (JSON)**, **CSS variables**, **CSS classes**, **SCSS variables**, satu **GIMP palette (.gpl)** atau satu **Adobe Swatch Exchange (.ase)** - jadi sistem reka bentuk itu terus masuk ke dalam Illustrator, Figma, GIMP atau helaian gaya. Ia berada di luar penatal anak tetingkap itu, jadi ia kekal di tempatnya tidak kira sejauh mana palet ditatal, dan ia muncul sebaik sahaja palet mempunyai shades. (Anda juga boleh memuat turun palet daripada paparan [Aset](/info/using.html#assets-your-library).)

## Type

Bilik ini berkembang dengan cara yang sama. Tanpa muka taipnya sendiri, ia hanyalah satu kad dan satu keputusan: **Primary**, ditetapkan pada saiz bacaan dalam muka taip yang berkhidmat untuknya hari ini, satu tag **Starter** di sebelah namanya, satu **Choose a face** yang terisi dan baris *"Nothing installs until you choose one."* Di bawah kad itu terletak *"Headings, code and italic follow the primary until you choose them"*, dengan **Choose them separately** mendedahkan tiga kad lain untuk selebihnya lawatan itu.

![Bilik Type dengan belum ada muka taip yang dipilih - satu kad pada saiz bacaan, satu tag Starter di atasnya, dan satu Choose a face yang terisi](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

Pilih satu muka taip dan bilik itu terbuka luas menjadi **empat kad peranan**, senarai Fonts dan spesimen langsung. Empat muka taip itu adalah yang sebenarnya dibaca oleh aplikasi, alat anda dan setiap eksport:

- **Primary** - teks badan, butang dan setiap alat.
- **Headings** - muka taip paparan untuk `h1`/`h2`.
- **Code** - muka taip monospace untuk kod dan data.
- **Italic** - pasangan italic sebenar untuk penekanan, petikan dan sampingan.

Headings, code dan italic masing-masing kembali kepada primary sehingga anda menetapkannya, jadi satu sistem reka bentuk bermuka taip tunggal tidak memerlukan sebarang keputusan di sini langsung.

**Satu tona bermaksud anda yang memilihnya.** Satu kad hanya bertona di mana anda memasang muka taip itu. Satu muka taip starter memakai tag **Starter** yang sama seperti yang dipakai oleh kumpulan warisan palet, dalam register malap dan tanpa tona, dan satu peranan yang tidak dipilih oleh sesiapa berbunyi **↳ follows Primary** dan bukannya mengulangi nama primary seolah-olah ia telah dipilih. Butang itu berbunyi **Change** pada satu muka taip milik anda sendiri dan **Choose a face** di tempat lain. Tiada apa-apa pada satu kad yang mengesahkan apa-apa: butang itu membuka **compare stage** yang terhad kepada peranan itu.

![Empat kad peranan didedahkan - setiap satu ditetapkan dalam muka taip yang berkhidmat untuknya, dengan satu tag Starter di mana tiada sesiapa memilih satu dan Italic mengikuti primary](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

### Peringkat perbandingan

![Peringkat perbandingan terbuka di bawah kadnya, dengan baris carian, keluarga yang disemat dan kad-kad dilipat menjadi satu jalur sebaris](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

Peringkat itu terbuka **secara inline dalam bilik**, bukan dalam satu dialog, dan terus di bawah kad yang anda tekan. Semasa ia terbuka, kad-kad itu melipat menjadi satu jalur sebaris peranan dan muka taip, jadi peringkat itu berada pada skrin pertama walaupun pada telefon. Escape membatalkan dan menyerahkan papan kekunci kembali kepada kad tempat anda membukanya.

Memilih satu muka taip adalah tiga tekanan:

1. **Choose a face** pada kad itu.
2. Taip satu nama keluarga dan tekan **Preview** - atau tekan salah satu daripada enam keluarga **Pinned** di bawah medan itu, satu tekanan setiap satu. Kad itu kelihatan sudah memuatkan, dengan satu bar rangka tempat spesimen itu akan berada, dan bukannya muka taip antara muka yang menjadi ganti sementara bagi satu muka taip yang belum pernah anda lihat.
3. **Use this face**.

**Persetujuan diminta sekali sahaja, pada tekanan yang anda buat.** Kali pertama satu pratonton mencapai Google Fonts, satu dialog menyatakan apa yang berlaku: *Google mempelajari nama keluarga itu dan alamat IP anda. Fail itu kemudian disimpan pada peranti ini dan digunakan luar talian. Ini adalah satu-satunya langkah dalam studio yang mencapai satu pihak ketiga.* **Fetch from Google** meneruskan dan diingati. **Cancel** meninggalkan kad itu menyatakan *"Not fetched. Nothing was sent to Google."* dengan **Fetch from Google** langsungnya sendiri, jadi menukar fikiran anda adalah satu tekanan pada kad itu sendiri. Tiada kad yang pernah menunjukkan satu butang mati: apa jua keadaannya, satu primary-nya menyatakan apa langkah seterusnya.

**Jatuhkan satu fail fon pada peringkat itu** dan ia mempratonton dengan serta-merta - **TTF**, **OTF** atau **WOFF** daripada mesin anda sendiri, iaitu laluan untuk satu muka taip korporat berlesen yang sudah anda miliki. Zon jatuhan itu adalah satu-satunya pintu fail dalam bilik ini.

Walau apa pun caranya, muka taip itu kekal pada peranti ini, dirender dalam aplikasi, dalam alat anda dan dalam setiap eksport, luar talian selama-lamanya dan turut serta dalam fail sistem reka bentuk - tiada apa yang diambil pada masa rendernya. Segalanya pada Google Fonts dihantar di bawah lesen terbuka (OFL/Apache/UFL).

### Fon pada peranti ini

Panel **Fonts** menyenaraikan setiap muka taip yang dimiliki peranti ini dan peranan yang dikhidmatinya. Muka taip yang anda tambah mendahului di bawah **In the design system**, setiap satu dengan roles dan satu padam miliknya, dan yang berkhidmat untuk Primary membawa lencana itu. Muka taip starter mengikut dalam satu baris terlipat - *Starter · SUSE, SUSE Mono · serving Primary and Code until you choose* - malap, tanpa padam dan tiada apa untuk dinaikkan taraf, kerana kedua-duanya bukan satu keputusan yang dibuat oleh sesiapa. **Add a face** membuka peringkat perbandingan yang sama tanpa had.

Panel **Type roles** di bahagian bawah menunjukkan satu spesimen langsung setiap peranan - badan dan UI dalam primary, satu muka taip paparan pilihan untuk tajuk atas, satu italic untuk penekanan, satu mono untuk kod dan data - dengan keluarga dan keadaannya di sebelah setiap satu (*Inter*, *SUSE · starter*, *SUSE · follows Primary*), jadi keseluruhan set itu boleh dibaca sekali gus.

## Tokens

Selebihnya sistem reka bentuk, boleh disunting tanpa menyentuh kod:

![Bilik Tokens - satu gelongsor jejari sudut ditambah jarak, saiz, bayang dan selebihnya sistem](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **Rounded corners** - satu gelongsor jejari tunggal (0–1.5rem) yang diikuti oleh kad, butang dan panel di seluruh aplikasi.
- **Neutrals** - ramp dakwat-menerusi-kertas yang dibawa oleh satu pemasangan baharu, disenaraikan sebagai **Neutrals · starter · 9** dengan sembilan langkahnya dan satu **Open** ke dalam anak tetingkap Colours. Inilah satu-satunya tempat neutral starter itu diuruskan, dan tag *starter* itu hilang sebaik sahaja ramp itu dijana dan bukannya diwarisi.
- **More tokens** - tambah dan sunting **spacing**, **sizing**, **stroke width**, **opacity**, **rotation**, **numbers** biasa dan **shadows**. Pilih satu jenis, namakannya (*Gutter, Card shadow…*) dan tetapkan nilainya. Ini disimpan sebagai [token reka bentuk](/info/design-tokens.html) (DTCG) standard dan turut serta dengan sistem reka bentuk itu.

## Files

Jatuhkan fail yang disimpan jenama anda - selain logo - di sini: aset **vector**, **image**, **audio** dan **motion** (video, Lottie, animasi). Ia mendarat dalam [Aset](/info/using.html#assets-your-library), disusun ke dalam bahagian dan sedia dalam pemilih aset setiap alat. Segalanya kekal pada peranti ini. (Rel melabelkan bilik itu **Files**; kunci URL kekal `catalogue`, kerana kunci panel adalah kontrak kekal.)

## Bawa masuk satu jenama

**Add from…** di bahagian bawah rel membuka pemilih dua peringkat. Peringkat pertama bertanya apa yang anda *ada*, bukan apa formatnya:

- **Design tokens or a design file** - DTCG atau Tokens Studio JSON, satu projek Penpot, satu **zip set token**, satu pek sistem reka bentuk Lolly atau satu SVG.
- **PDF** - satu dek atau fail garis panduan, dibaca pada peranti ini untuk warnanya, tandanya dan muka taip terbenamnya.
- **Logo or screenshot** - satu imej menjadi satu palet cadangan, dibaca pada peranti ini. Tiada apa yang dimuat naik. Ini membaca warna, bukan muka taip atau susun atur dalam gambar itu.
- **Saved web page** - pilih satu fail HTML dan fail CSS-nya, atau tampal HTML atau CSS. Sehingga 20 fail dan 2 MB kesemuanya. Hanya teks yang dibekalkan dibaca; sumber terpaut tidak diambil dan skrip tidak berjalan. Laluan ini turut berfungsi tanpa sambungan atau aplikasi desktop.
- **Font file** - TTF, OTF atau WOFF. Membuka bilik Type, tempat muka taip itu dipasang.
- **Website** - satu halaman, dibaca untuk warna dan taipnya. Jubin ini hanya muncul pada peranti yang benar-benar boleh membaca satu halaman, kerana satu jubin yang dilumpuhkan mengiklankan sesuatu yang tiada siapa boleh tekan adalah lebih teruk daripada tiada jubin langsung. Di mana ia muncul, ia menamakan pembacanya dengan jelas: diambil oleh aplikasi pada peranti ini, atau dibaca melalui sambungan pelayar dalam tab latar belakang, dilog masuk sebagai anda. Menamakan satu URL hanya *pra-isi* medan itu - butang ambil adalah persetujuannya, jadi satu pautan yang dihantar seseorang kepada anda tidak boleh memulakan satu bacaan.

Pilih sumber fail reka bentuk dan peringkat kedua ialah kad di bawah: format yang diterima mendahului sebagai jubin ikon mengikut susunan keutamaan, dan keseluruhan kad adalah satu sasaran jatuhan - klik di mana-mana di atasnya atau seret satu fail ke atasnya. Anda juga boleh menjatuhkan satu fail terus ke atas studio.

![Kad import - format yang diterima mendahului sebagai jubin ikon, dan keseluruhan kad adalah satu sasaran jatuhan](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

Apa yang diberikan oleh setiap fail reka bentuk kepada anda:

- satu **pek sistem reka bentuk Lolly** (`.lolly`; `.zip` warisan masih diterima) - dipasang dalam satu langkah;
- satu eksport **Penpot** (`.penpot`) - menarik masuk token reka bentuknya;
- satu fail **Design Tokens** (`.json`) - W3C DTCG;
- satu fail **Tokens Studio** (`.json`) - Tokens Studio;
- satu **SVG biasa** (`.svg`) - Lolly mengimbas warnanya dan membenarkan anda memilih mana yang hendak dikekalkan, yang pertama menjadi primary anda.

Satu logo/tangkapan skrin, website atau halaman tersimpan membuka **Your suggested design system**. Lihat satu contoh menggunakan warna yang dicadangkan, pilih satu **Main colour** yang berbeza jika perlu, dan namakan sistem itu. **Use this design system** menggunakan palet terang dan gelap yang dijana dan kembali ke Overview. Fon sedia ada kekal di tempatnya. Ini menggantikan warna sistem aktif dan tetapan token lain. Satu checkpoint mesti berjaya dahulu; **Restore brand settings** memulihkan tetapan sebelumnya.

**Source details and individual choices** menunjukkan apa yang dibaca, nama fon yang dikesan dan kontras teks/tindakan pratonton itu. Ia juga menawarkan **Choose individual items in the tray** dan **Download design context**. Laporan JSON itu membawa pemerhatian, token yang dicadangkan dan maklumat sumber; HTML/CSS tersimpan menyertakan satu SHA-256 bagi teks yang dibekalkan. Ia tidak mengandungi teks halaman mentah dan bukan satu Content Credential yang ditandatangani. Nama fon adalah cadangan: Type kekal sebagai tempat untuk memilih dan memasang fon.

Import PDF dan fail reka bentuk lain mengekalkan kawalan semakan sedia ada mereka. Item yang disimpan dalam **Tray** tidak mengubah apa-apa sehingga ditambah melalui bilik yang memiliki jenis bahan itu.

`#/start?source=<kind>` membuka pemilih pada satu sumber yang diberikan (`file`, `pdf`, `image`, `font`, `url`, `page`), dan `?import` membukanya pada senarai biasa.

## Pindahkan satu jenama antara peranti

**Export** di bahagian bawah rel menulis satu **`LollyBrand-….lolly`** tunggal - token, fon, logo dan pilihan tema anda, dengan satu manifes integriti yang disahkannya semasa dibawa masuk semula. Keluaran web sebelum 1.0.7 menamakan muatan yang sama `.zip`; ejaan warisan itu masih diterima. Di sebelahnya, **Tokens (.json)** menulis dokumen token reka bentuk biasa dengan sendirinya: tiada fon, tiada logo, hanya token, iaitu apa yang sebenarnya dibaca oleh satu repo, satu langkah CI atau satu alat token lain.

Membawa satu semula ke dalam adalah **Add from… → Design tokens or a design file** (di atas), atau satu seret-dan-lepas ke atas studio. Beginilah cara seorang rakan sekerja menyerahkan satu jenama kepada anda, atau cara anda membawa satu ke pemasangan kedua - tiada akaun, tiada awan. Untuk membawa masuk satu jenama daripada baris arahan sebaliknya, lihat [`ingest:brand`](/info/configuration.html#brand-packs).

## Pulihkan tetapan terdahulu

Pilih **Restore brand settings** di bahagian bawah rel, pilih satu checkpoint bertarikh, kemudian tekan **Restore**. Ia memulihkan warna, tetapan taip dan token jenama lain untuk jenama aktif. Fail fon dan imej kekal seperti sedia ada.

Lolly menyimpan tetapan semasa anda sebagai **Before restore** sebelum menggunakan checkpoint itu. Pilih checkpoint itu untuk membalikkan pemulihan tersebut, termasuk selepas menutup dan membuka semula pelayar. 20 checkpoint terkini disimpan pada peranti ini. Jika storan tidak dapat dibaca atau tetapan semasa tidak dapat disimpan, dialog itu melaporkan masalah itu supaya anda boleh mencuba semula.

## Versi

**Versions** di kaki rel ialah tempat sesuatu design system berhenti menjadi sasaran yang sentiasa bergerak. Terbitkan satu dan anda mendapat **salinan kekal bernama** yang disimpan pada peranti ini: ia tidak pernah berubah selepas itu, jadi sesuatu alat yang menyematkannya akan terus melukis perkara yang sama. Panel ini kekal tersembunyi sehingga ada sesuatu milik anda sendiri untuk diterbitkan, jadi sesebuah studio yang tidak pernah menerbitkan tidak akan sekali-kali melihat kawalan-kawalan ini.

Tiga perkara yang perlu diketahui sebelum anda menekan apa-apa, dan panel ini menyatakan ketiga-tiganya sebelum penekanan dan bukan selepasnya:

- **Sesuatu versi bersifat kekal.** Belum ada ciri padam, jadi panel itu menyatakan apa yang telah disimpan dan bahawa ia kekal tersimpan, bukannya menawarkan butang yang berbohong.
- **Pengalihan keluar diutamakan pada kad keserasian.** Token yang ditambah dan diubah adalah berita; satu token yang *dialih keluar* ialah perkara yang merosakkan sesuatu alat, jadi ia dinamakan terlebih dahulu dan disebut sebagaimana adanya.
- **Penerbitan tidak boleh dibuat asal; pemulihan boleh.** *Restore latest from this version* ialah suntingan biasa pada head, jadi ia masuk ke dalam tindanan buat asal studio itu dan panel itu terus menawarkan anda **Undo**.

Anda boleh **Publish only**, atau **Publish and make active** - perbezaannya ialah sama ada alat dan aplikasi mengikut versi tersebut mulai sekarang atau terus mengikut suntingan terkini anda. **Follow the latest again** menjadikan setiap suntingan langsung sebaik sahaja ia dibuat. `#/start?area=versions` membuka panel tersebut secara terus.

## Apabila Jenama Ditetapkan

Sesetengah binaan menghantar satu **sistem reka bentuk terkunci**, seperti SUSE Brand. Membukanya menunjukkan satu nota baca sahaja dengan **Make an editable copy** dan **Switch**. Warna, fon dan token asalnya kekal utuh. Sistem tempatan anda sendiri kekal boleh disunting, walaupun sistem terkunci itu adalah yang pertama pada peranti ini. Dalam Profile, **Open** memilih satu sistem dan membuka studionya; **Make a new one** mencipta satu sistem tempatan dan membukanya pada `#/start` dengan medan namanya difokuskan.

## Ke mana seterusnya

- **[Using Lolly](/info/using.html)** - kanvas, penyimpanan, projek dan Aset.
- **[Design Tokens](/info/design-tokens.html)** - model token tempat jenama anda dinyatakan.
- **[Exporting & formats](/info/exporting.html)** - unit cetak, CMYK dan format yang menjadi hasil render jenama anda.


## Cari dan bandingkan satu look

Buka **Find a look** daripada Overview atau senarai sistem reka bentuk pada Profile. Semak imbas sistem yang disimpan pada peranti ini dan beberapa contoh Lolly yang boleh digunakan semula. Cari mengikut nama, tag warna atau fon yang diisytiharkan. **Closest to my current palette** menyusun mengikut persamaan warna yang diukur, dengan keluarga fon sepadan memecahkan seri; ia bukan satu skor kualiti.

Pilih satu look untuk menyemaknya, atau dua untuk membandingkannya. Butang semakan itu kekal tersedia pada skrin kecil. Memilih satu look tidak mengubah apa-apa. **Use this saved system** menukar melalui daftar sistem reka bentuk sedia ada. **Use these colours** menggunakan satu contoh melalui aliran checkpoint dan pemasangan biasa, mengekalkan fon semasa. **Restore brand settings** boleh memulihkan look sebelumnya.

Di bawah **Details and design context**, sistem tersimpan mempunyai **Search tags** yang boleh disunting dan satu muat turun konteks. Contoh menggunakan resipi warna Lolly yang asli; tiada koleksi inspirasi yang dikikis dari jauh atau akaun yang diwajibkan.

![Bandingkan Sunroom dan Orchard bersebelahan sebelum menggunakan mana-mana satu sistem warna.](/t/url-shot?url=%2F%23%2Fstart&width=1280&height=900&dpi=96&waitMs=3000&format=svg&filename=brand-compare-looks&try=1&drive=click%3A%5Bdata-ds-door%3D%22looks%22%5D%3Bwait%3A500%3Bclick%3A%5Bdata-look-select%3D%22example%3Asunroom%22%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Aorchard%22%5D%3Bclick%3A%5Bdata-looks-review%5D%3Bwait%3A500&cropSelector=.ds-looks-comparison&waitSelector=%5Bdata-ds-door%3D%22looks%22%5D&walker=1&rasterDpi=96)

Perbandingan itu mengekalkan kedua-dua palet kelihatan bersama. Menyemak satu look tidak mengubah apa-apa sehingga anda memilih **Use these colours** atau **Use this saved system**.

## Baca bukti sumber

Butiran pilihan semakan sumber menunjukkan tipografi, jurang, padding dan nilai sudut di mana ia diperhatikan. Bacaan HTML/CSS tersimpan dan website asli melaporkan pengisytiharan, yang mungkin tidak digunakan oleh halaman yang dirender. Sambungan pelayar boleh melaporkan gaya yang diukur daripada satu sampel terhad elemen kelihatan, berserta viewport dan keutamaan warna pelayarnya. Sambungan lama masih berfungsi dengan gaya yang diisytiharkan. Medan yang hilang berbunyi **Not observed**.

Ini adalah pemerhatian, bukan tetapan gaya automatik. Fail fon tidak diambil atau dipasang oleh satu imbasan rujukan, dan jarak sumber tidak secara senyap menggantikan jarak anda sendiri. Kiraan menerangkan kejadian dalam sampel itu, bukan keyakinan atau kualiti.

## Semak satu komposisi berbanding sistem reka bentuk

Dalam Design, buka **Export**, kemudian **Before you export**. Semakan itu menggunakan versi sistem reka bentuk berkuat kuasa yang sama seperti render itu. Ia membandingkan warna yang dikarang, alias token, pilihan fon dan ID aset imej. Nilai tersuai mungkin disengajakan; satu imej di luar aset jenama yang diisytiharkan adalah satu item semakan, bukan satu imej yang dilarang.

Di mana satu cadangan warna atau fon yang konkrit tersedia, butangnya menukar satu lapisan itu. **Undo** biasa memulihkan nilai asal. Lapisan yang dikunci atau diubah tidak ditulis ganti oleh satu cadangan lama. Bukti sumber yang hilang kekal berasingan daripada satu padanan. Kontras yang dirender dan susun atur teks disemak oleh semakan sedia ada yang terpasang. Gradien, kesan, kandungan alat bersarang, hak dan kualiti subjektif tidak dinilai oleh perbandingan jenama. Semakan tidak menyekat Download.

## Guna konteks reka bentuk secara tempatan

**Download design context** merangkumi dokumen token, warna yang diselesaikan, keluarga fon yang diisytiharkan, ID aset, bukti sumber di mana ia direkodkan, liputan dan peraturan eksplisit. Ia tidak merangkumi fail fon atau bukti pemilikan. Semakan rujukan itu turut merangkumi token yang dicadangkan dan pemerhatiannya.

CLI boleh membaca mana-mana muat turun tanpa satu pelayan:

```bash
lolly system import ./lolly-design-context.json
lolly system context --output=design-context.json
lolly system check ./design-inputs.json --file=design-context.json
```

`system check` menerima input Design dengan satu array `boxes` atau satu dokumen Design yang disusun. Ia melaporkan pembaikan yang dicadangkan tanpa mengubah suai komposisi itu. Ia tidak dapat mengukur susun atur pelayar atau kontras yang dirender. Sumber MCP sedia ada **lolly://design-context** mendedahkan konteks sistem berkuat kuasa itu melalui proses MCP tempatan yang dikonfigurasikan; tiada perkhidmatan hos baharu atau kunci API diperlukan.
