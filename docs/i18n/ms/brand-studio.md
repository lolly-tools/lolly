# Design System Setup

Logo, warna dan muka taip anda berada di satu tempat, supaya setiap alat, halaman dan eksport melukis dengannya. Tempat itu ialah **Design System Setup**, di `#/start`, dan taglinenya menyatakan untuk apa ia: *Make it yours*.

Mulakan dengan apa sahaja yang anda ada. Letakkan logo dan Lolly membaca warnanya. Pilih muka taip, atau letakkan fail fon yang dilesenkan syarikat anda. Setiap perubahan ditunjukkan merentasi keseluruhan apl serta-merta. Logo, fon dan token anda kekal pada peranti ini. Memilih Google Font ialah satu-satunya langkah yang menjangkau keluar: Lolly bertanya dahulu, kemudian mengambil keluarga itu sekali.

Apabila ia kelihatan betul, namakan sistem reka bentuk dan tekan **Export**. Anda mendapat satu fail `.lolly` untuk disimpan, dibuka pada peranti lain atau diserahkan kepada rakan sekerja. [Settings](/info/dashboard.html#design-system) menunjukkan sistem aktif baca sahaja, dan kulitnya memaut kembali ke sini untuk penyuntingan.

## Jadikan milik anda dalam lima minit

::: timeline
- <!--i:upload--> **Letakkan logo anda** pada zon letak dalam **Logos**. Lolly membaca bentuk dan warnanya.
- <!--i:palette--> **Gunakan warna ini.** Warna utama logo menjadi warna primer anda, dan neutral gelap daripada logo menjadi warna teks anda.
- <!--i:font--> **Pilih muka** dalam **Type**: Google Font, atau fail fon yang anda miliki.
- <!--i:pentool--> **Namakan sistem.** Suntingan pertama anda membuat sistem reka bentuk anda sendiri, dan Lolly bertanya sekali untuk namanya.
- <!--i:download--> **Export** menulis keseluruhan sistem sebagai satu fail `LollyBrand-….lolly`.
:::

Pengepala menunjukkan sistem reka bentuk mana yang sedang anda **Editing**, dan namanya ialah medan yang boleh anda ubah pada bila-bila masa. Apabila suntingan pertama anda bertanya **What is this design system called?**, perkataan daripada logo anda diisi jika logo mengeja perkataan itu. **Save name** menyimpan nama; **Not now** mengekalkan pemegang tempat sehingga anda menaipnya dalam pengepala. Nama melabelkan sistem dalam Settings dan semasa anda menukar, dan ia menjadi nama fail yang ditulis **Export**.

## Bilik-bilik

Studio ialah set bilik dalam rel di sisi, tanpa susunan tetap: tiada apa-apa bernombor dan tiada apa-apa menunggu yang lain. Pada telefon rel menjadi jalur cip di bawah pengepala.

![Rel bilik studio: Overview, Colours, Type, Logos, Tokens, Files dan Usage & rules](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-rail&waitSelector=.ds-rail&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

| Bilik | Apa yang anda lakukan di situ | Kunci pautan |
|---|---|---|
| **Overview** | Lihat apa yang dipegang sistem, dengan pintu ke setiap bilik | `overview` |
| **Colours** | Tambah warna, beri peranan, bina teduhan dan palet | `color` |
| **Type** | Pilih empat muka yang dibaca apl, alat dan setiap eksport | `type` |
| **Logos** | Letakkan lambang anda dalam setiap orientasi dan rawatan | `logos` |
| **Tokens** | Sudut, jarak, bayang dan setiap nilai bernama lain | `tokens` |
| **Files** | Fail imej, audio dan gerakan yang disimpan jenama anda | `catalogue` |
| **Usage & rules** | Peraturan yang digunakan jenama anda, disemak pada contoh sebenar | `usage` |

Pautkan ke bilik dengan `#/start?area=<key>`. Bilik Files mengekalkan kunci `catalogue`, kerana kunci bilik ialah kontrak kekal, dan `?tab=` masih berfungsi sebagai alias lama. Kunci tidak diketahui membuka Overview.

**Kaki rel** memegang tindakan untuk keseluruhan sistem dan bukan satu bilik. **Add from…** membawa jenama masuk ([Bring a brand in](#bring-a-brand-in)), dan **Tray** memegang apa yang ditemui imbasan yang belum anda tambah. **Export**, **Tokens (.json)**, **Fonts for Linux (.rpm)**, **Versions** dan **Restore brand settings** menyimpan dan memindahkan sistem ([Keep and move your design system](#keep-and-move-your-design-system)). Setiap satu muncul sebaik ada sesuatu untuk ia bertindak.

## Overview

Tanpa apa-apa dipilih lagi, Overview menawarkan empat cara untuk bermula. **Start from a reference** membuka pemilih sumber untuk logo, tangkapan skrin, halaman web atau fail reka bentuk, dan **Pick a colour**, **Choose a face** dan **Add a logo** membuka kawalan itu secara terus. Membuka satu tidak menulis apa-apa, dan **Explore the tools** ada dari awal.

Setelah apa-apa menjadi milik anda, Overview menunjukkan apa yang anda ada, dengan kiraan anda sendiri di hadapan. Colours memberikan bilangan warna, dengan `· N starter` malap di mana warna warisan ditunjukkan; jalurnya meletakkan warna anda dahulu, kemudian garis halus, kemudian warna starter yang pudar. Type dibaca mengikut peranan (*Inter for headings*, dengan *Starter for the rest* pada baris di bawah). Logos menyatakan berapa banyak slot diisi (atau **Not set**), Tokens menunjukkan jejari sudut dan Files menyatakan **Nothing yet** semasa pustaka kosong. Setiap blok membuka biliknya.

### Starter dan milik anda

**Starter** ialah perkataan untuk apa-apa yang datang bersama apl dan bukan dipilih. Pemasangan baharu tidak membawa warna langsung, hanya satu ramp neutral daripada dakwat ke kertas, supaya permukaan, teks dan garis halus boleh dirender sebelum sesiapa memutuskan apa-apa. Perkataan yang sama menandakan bahan warisan dalam setiap bilik.

::: cols
## Starter

- Datang bersama apl: neutral dakwat-ke-kertas, muka starter, jejari sudut lalai.
- Malap, dengan teg **Starter** dan tanpa warna.
- Tidak dikira sebagai warna anda. Neutral berada dalam **Tokens** sebagai **Neutrals · starter · 9**, dan **Open** menunjukkannya dalam Colours sebagai satu kumpulan terlipat (`#/start?area=color&group=neutral`).
- Peranan yang bertumpu pada warna starter berbunyi *"Starter Paper stands in"*, dengan **Choose…** pada pemilihnya.

## Milik anda

- Dipilih atau dipasang oleh anda.
- Kekuatan penuh, dan kad berwarna di mana anda memasang muka.
- Dikira pada Overview dan dalam Tokens.
- Peranan yang mengikut yang lain berbunyi **↳ follows Primary** dan bukan mengulang nama primer.
:::

Bahan warisan tidak pernah dilukis dengan sempadan putus-putus, kerana di sini sempadan putus-putus bermakna sasaran letak.

## Logos

Kosongkan folder lambang anda ke dalam zon letak di bahagian atas: **"Drop marks here, or choose several at once"** menerima sebanyak mana fail yang anda ada. Setiap fail dibaca untuk bentuk dan dakwatnya, kemudian menunggu di bawah **Waiting for a slot** sebagai cip yang menyatakan rupanya, seperti *"Looks like the Horizontal primary"*, dengan ukuran yang digunakannya dan butang **Place** (**Replace** di mana slot diisi). Di mana ia tidak pasti, cip menyatakannya dan menawarkan **Change slot**, menyenaraikan kesemua lapan. Tiada apa-apa diletakkan sehingga anda menekan sesuatu.

Lambang dengan lebihan margin kosong mendapat tawaran pangkas dahulu; jawab atau tekan Escape dan yang asal masuk tanpa disentuh. Di mana lambang boleh mengisi slot adik-beradik kosong, bilik menawarkan versi **mono** atau **reverse** terbitan sebagai cip yang ditandakan *Generated*.

Setiap lambang berakhir dalam grid lapan slot pilihan, satu bagi setiap **orientation** dan **treatment**:

- **Orientations:** Horizontal (logotaip dan simbol dalam satu baris) dan Vertical (bertindan, untuk ruang persegi dan tinggi).
- **Treatments:** Primary, Primary reverse (untuk latar gelap), Mono (satu warna) dan Mono reverse.

Kumpulan tanpa lambang lagi dilipat menjadi satu baris; buka untuk melihat slotnya. Klik slot untuk menambah PNG, SVG, JPEG atau WebP, atau klik slot terisi untuk menggantikan lambang. Segala-galanya kekal pada peranti ini.

![Slot logo dengan Horizontal dan Vertical dibuka: setiap rawatan ialah slotnya sendiri, dan setiap slot adalah pilihan](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&width=1440&height=1600&dpi=192&waitMs=1600&drive=click%3A.be-logo-identity%3Edetails%3Anth-of-type%281%29%3Esummary%3Bclick%3A.be-logo-identity%3Edetails%3Anth-of-type%282%29%3Esummary%3Bwait%3A600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Custom marks** ialah lambang yang dipanggil jenama anda dengan namanya sendiri, seperti ikon, jata atau favicon.
- **More identities.** Sub-jenama, produk atau acara boleh mempunyai set penuh sendiri: **+ Add another logo** dan beri nama kepada set itu. Set utama anda ialah "Your logo". [Brand architectures](/info/brand-architectures.html) menunjukkan bila identiti logo ialah blok yang betul.
- **Lolly membaca warna logo.** Kad di bawah zon letak, dan sekali lagi di bahagian atas Colours, menyenaraikan warna logo dan bertanya **Which is the main colour?**, dengan warna paling kuat sudah dipilih (tidak pernah putih yang menjadi latar eksportnya). **Use these colours** menambahnya ke palet anda, menjadikan warna utama sebagai primer anda dan, apabila logo mempunyai neutral gelap yang boleh dibaca pada kertas, menjadikannya warna teks. **Not now** meninggalkannya dalam Tray. Pada pemasangan baharu jawapan paling mungkin digunakan serta-merta, dan kad menawarkan **Undo** atau warna utama lain. SVG memberi warna tepat; PNG, JPEG atau WebP memberi warna yang meliputi bahagian sebenar lambang.

## Colours

Bilik membesar bersama sistem reka bentuk: lawatan pertama ialah satu keputusan, dan selebihnya tiba semasa palet bertambah.

### Warna pertama

Sistem tanpa warna sendiri dibuka pada satu cip besar dan satu medan, dengan baris yang menyatakan bahawa peranan, teduhan dan tetapan cetakan tiba semasa sistem membesar.

- **Cip ialah pemilih.** Tekan **Pick a colour** dan kad OKLCH studio dibuka, dibenihkan dengan apa yang dipegang medan: nama, roda, empat dail, alfa dan **Stored as**, dengan **Cancel** dan **Add colour** di kaki. Tiada apa-apa sampai ke sistem sehingga anda menekan **Add colour**.
- **Medan menerima sebarang notasi**: `#e0452b`, `rgb(224 69 43)`, `oklch(58% .19 32)` atau nama warna. Tampal senarai dan ia menjadi baris cip untuk ditambah satu demi satu atau dengan **Add all**.
- **Dua lagi cara masuk.** **Pick a colour from the screen** menggunakan penitis mata di mana pelayar mempunyainya, dan **Take colours from an image** membaca tangkapan skrin atau foto pada peranti ini.
- **Add tidak pernah dilumpuhkan.** Dengan medan kosong ia membuka pemilih; teks yang tidak boleh dibacanya mendapat baris di bawah medan yang menyatakannya.

Warna pertama anda menjadi **primary**, dan cip mengesahkannya, seperti *"Primary is now Vivid Violet"*, dengan **Fine-tune** untuk melaras warna.


### Seiring palet berkembang

Warna anda berada di sebelah pratonton **In context** pada skrin lebar, dan di atasnya pada skrin lebih kecil. Pratonton menunjukkan poster, carta atau kad antara muka dalam palet anda. Warna starter kekal dalam kumpulan terlipat sendiri.

![Bilik Colours pada Lolly Demo: palet dalam kumpulan terlipat, setiap warna dengan nama dan hex, dan pil muat turun di kaki](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

![Bilik Colours selepas menambah satu warna, dengan paletnya dan satu pratonton komposisi langsung](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

### Peranan: apa yang dibaca alat

**Roles** menyatakan warna mana memainkan setiap bahagian dalam setiap alat dan eksport. Ia pilihan (tiga warna longgar tanpa peranan ialah sistem yang baik sempurna), mana-mana warna boleh mengambil satu dan bacaan kontras diukur terhadap permukaan, APCA dahulu. Setiap baris peranan menunjukkan warna sendiri pada kekuatan penuh, warna starter yang bertumpu atau **↳ follows Primary**.

Setelah palet mempunyai teduhan, jalur menunjukkan ketujuh-tujuh peranan yang boleh dibaca alat: Primary, Secondary, Surface, Text, Muted, Edge dan On primary. On primary diperoleh daripada primer, berbunyi **Derived** dan tidak mempunyai pemilih.

Aksen apl sendiri mengikut sistem reka bentuk secara lalai. Itulah tetapan **Interface follows the design system** dalam **Settings → Appearance**; mematikan tetapan membiarkan chrome apl neutral, manakala alat, kanvas dan eksport mengikut sistem reka bentuk dalam kedua-dua keadaan.

**Colourways.** Sistem reka bentuk boleh memegang beberapa warna utama, masing-masing dipilih bagi setiap karya. Lolly menyimpan setiap colourway, tetapi bilik ini belum boleh mengarang satu: colourway ditulis dalam fail token. Pada sistem dengan colourway, setiap colourway memerlukan primer dan sekunder sendiri, dan permukaan sendiri apabila colourway mewarnai latar, jadi peranan itu kekal ditetapkan dalam penyunting swatch. [Lolly Demo in use](/info/lolly-demo-in-use.html#colourways-on-real-work) menunjukkan colourway pada kerja sebenar, dan [Add colourways to a design system](/info/colourways.html#add-colourways-to-a-design-system) mempunyai formatnya.

### Cari lebih banyak warna

Tiga alat dibina atas warna primer anda. Dua yang pertama hanya mencadangkan, dan yang ketiga menggantikan palet selepas anda menyemak perubahan.

::: cols
## Explore shades & harmonies

Pilih **Starting colour**, **Scheme** (Mono, Complement, Analogous atau Triad) dan berapa banyak **Shades** (3 hingga 20, lalai 5). **Fine-tune** menetapkan keamatan UI, kontras dan teks pada jenama. Klik teduhan untuk menambahnya, atau **Add 5 shades** untuk satu kumpulan. Warna dan peranan anda kekal.

## Cari warna yang sepadan

Pilih **Harmony**: Complementary, Adjacent, Triad, Tetrad atau Analogous (dengan **Accents** dari 2 hingga 5 dan **Angle** dari 10° hingga 45°). Setiap calon mempunyai nama yang dijana dan **+ Add**, satu tekanan bagi setiap warna.

## Bina semula keseluruhan palet

Menggantikan palet daripada satu warna permulaan, selepas semakan apa yang berubah dan apa yang kekal. Titik semak diambil dahulu, dan **Undo** ditawarkan selepas itu.
:::

Ketiga-tiganya menggunakan matematik warna persepsi (OKLCH) yang sama seperti enjin. Dalam **Explore shades & harmonies**, baris **Primary**, **Neutral** dan **Secondary** menunjukkan teduhan yang dicadangkan, dan **Theme preview** menunjukkan contoh cerah dan gelap dengan bacaan kontrasnya.

![Tiga kumpulan shade yang dicadangkan, dengan kawalan tambah individu dan satu Theme preview berasingan](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

![Aksen yang dijana, setiap satu dengan satu swatch, nama yang dijana secara automatik, kod heksnya dan satu butang Add](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&drive=click%3A.be-generate-detail%3Anot%28%5Bdata-be-rebuild%5D%29%20%3E%20summary%3Bwait%3A500&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### Mengesahkan palet yang dijana

Buka **Rebuild the whole palette…** dan tekan **Preview full rebuild**. Semakan mengira berapa banyak peranan kekal seperti yang anda tetapkan, berapa banyak warna anda sendiri dikekalkan dan berapa banyak lengkung teduhan, kunci cetakan, teduhan tersembunyi dan hentian kecerunan dilabuhkan semula atau dikekalkan. **Apply rebuilt palette** mengomit; **Cancel** tidak mengubah apa-apa. Selepas itu kad menawarkan **Undo** dengan fokus padanya, dan titik semak yang diambil sebelum penukaran memulihkan seluruh sistem.

Sistem dengan colourway mengekalkan setiap colourway melalui pembinaan semula. Colourway kanonik mengikut warna permulaan baharu, dan setiap colourway lain mengekalkan warna, nama, susunan dan tetapannya sendiri. Semakan menyenaraikan colourway mana yang mengikut dan mana yang mengekalkan warnanya. Lolly tidak membina semula sistem yang mengekod colourwaynya dengan cara yang tidak dapat disuntingnya; kad menyatakan sebabnya, dan tiada apa-apa berubah.

### Bahagian pakar

Empat bahagian terlipat berada di bawah pratonton dan peranan. Setiap satu dibuka terus dengan `#/start?area=color&focus=<name>`:

- **Explore shades & harmonies** (`focus=generate`), diterangkan di atas.
- **Shade curves** (`focus=curves`) membentuk semula ramp titik demi titik, dengan lengkung kecerahan, kroma dan rona yang berasingan (L / C / H) dan teduhan dilukis semula semasa anda menyeret.
- **Contrast** (`focus=contrast`): **Contrast-lock** menyetem semula ramp untuk mencapai sasaran APCA terhadap latar yang anda pilih, dan **Rotate hue** memutar seluruh ramp mengelilingi roda.
- **Print** (`focus=print`) menetapkan apa yang menjadi warna primer pada mesin cetak: nilai automatiknya, binaan CMYK yang disemat atau dakwat spot bernama.

### Palet dan setiap swatch

Palet menyenaraikan warna anda dalam kumpulan terlipat, masing-masing dengan **+ Add** sendiri. Cipta dan namakan semula kumpulan sesuka hati. Peranan tidak pernah membuat jubin kedua: jubin yang ditunjuk peranan memakai tanda kecil sebaliknya (**P**, **S**, **Su**, **T**). **Colour chart** di bawah jubin menunjukkan warna yang sama pada **Wheel** OKLCH (seret titik untuk mewarnakan semula, klik ruang kosong untuk menambah swatch) dan carta **Gamut**, yang menunjukkan di mana julat boleh dipaparkan berakhir. `#/start?area=color&focus=chart` membuka carta terus.

![Anak tetingkap palet, setiap kumpulan boleh dilipat, dengan pil muat turun diletakkan di tepi bawahnya](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![Roda OKLCH - sudut ialah hue, jarak keluar ialah chroma dan warna kelabu bergerak mengikut landasan lightness di tepi](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

Klik swatch untuk membuka penyuntingnya:

- **Rename** swatch.
- **Tetapkan warna** pada peluncur OKLCH, atau dalam **Hex**, **HSL**, **RGB** atau **CMYK**. Medan nilai membaca dan menulis dalam ruang aktif. CMYK di sini menetapkan warna skrin melalui penukaran; untuk menyemat dakwat tepat, gunakan **Print substitutes**.
- **Stored as** memilih cara swatch disimpan: **LCH** (lalai, persepsi dan gamut luas), Hex, RGB atau HSL.
- **Use as** memberi swatch peranan secara terus. Tekan peranan yang diserlahkan sekali lagi untuk mengosongkan peranan.
- **Print substitutes** (terlipat): kunci **CMYK** daripada **Auto** kepada nilai dakwat tepat, atau tetapkan **Spot colour** dengan **Name** (seperti `PANTONE 186 C`), **Book** pilihan dan **Finish** untuk foil, emboss, deboss, varnis spot, soft touch atau die cut, crease atau perforation. Mesin cetak menggunakan kunci ini apabila anda mengeksport PDF atau TIFF CMYK; lihat [Colour profiles](/info/exporting.html#colour-profiles).
- **In other spaces** (terlipat): satu nilai bagi setiap ruang warna, diperoleh atau dikarang oleh anda, dan yang dikarang menang semasa eksport.

**Memadam swatch** adalah selamat. Teduhan terbitan dan peranan tema disembunyikan, jadi tiada apa-apa yang membacanya rosak, manakala warna yang anda tambah dibuang.

::: details Bekerja dengan banyak swatch
Setiap swatch mempunyai pemegang seret. Seret untuk menyusun semula dalam kumpulan, atau fokuskan pemegang, tekan Space, gunakan kekunci anak panah dan tekan Space sekali lagi untuk melepas; Escape membatalkan. Untuk memindahkan warna antara kumpulan, gunakan kawalan **Group** penyunting atau pilih beberapa dan gunakan **Move to**.

Pemilihan tidak memerlukan mod. Bar muncul dengan jubin pertama yang dipilih dan pergi bersama yang terakhir.

- **Seret pada ruang kosong** untuk melukis segi empat tepat; setiap jubin yang disentuhnya menyertai pilihan, merentasi kumpulan. Bahagian terlipat tidak menambah apa-apa.
- **Shift-klik** mengambil julat mengikut susunan bacaan, **Cmd/Ctrl-klik** menogol satu jubin, dan klik biasa membuka penyunting.
- Setiap pengepala kumpulan mempunyai **Select all**, dan **Cmd-A** dengan jubin difokuskan mengambil setiap warna yang anda miliki, tidak pernah yang starter.
- Grid mempunyai satu perhentian tab: anak panah bergerak, Shift-anak panah memanjangkan, Space menogol, Delete membuang dan Escape mengosongkan. Untuk menggerakkan saluran, tekan `l`, `c` atau `h` dahulu.
- Pada skrin sentuh, tekan dan tahan jubin untuk memulakan pilihan, kemudian ketik untuk menambah.

Bar berbunyi **{n} selected**, kemudian **Move to**, **Give a role** (setiap warna mengambil peranan seterusnya mengikut giliran), **Download** (pilihan dalam mana-mana enam format palet), **Duplicate** (salinan setiap satu, diletakkan selepas yang asal), **Copy values** dan **Delete**. Satu salinan dibuka terus dalam penyunting; beberapa kekal dipilih. Satu Cmd/Ctrl-Z membatalkan seluruh tindakan pukal.
:::

### Gradien

Panel **Gradients** pilihan membina token adunan daripada palet. Setiap kecerunan mempunyai pratonton, 2 hingga 8 hentian bernama dan sudut. Hentian menunjuk kepada swatch, jadi warnakan semula swatch dan kecerunan mengikut. Adunan dijalankan dalam OKLCH.

Muat turun palet (token reka bentuk, CSS, SCSS, GIMP dan Adobe Swatch Exchange) berada dalam pil di kaki palet setelah ada teduhan. [Take your palette and fonts anywhere](/info/using.html#take-your-palette-and-fonts-anywhere) menerangkan setiap format.

## Type

Tanpa muka sendiri, bilik ialah satu kad: **Primary**, ditetapkan pada saiz bacaan dalam muka yang melayaninya hari ini, dengan teg **Starter**, butang **Choose a face** dan baris *"Nothing installs until you choose one."* Headings, code dan italic mengikut primer sehingga anda memilihnya; **Choose them separately** menunjukkan kad mereka.

![Bilik Type dengan belum ada muka taip yang dipilih - satu kad pada saiz bacaan, satu tag Starter di atasnya, dan satu Choose a face yang terisi](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

Pilih satu muka dan bilik terbuka menjadi empat kad peranan, senarai Fonts dan spesimen langsung:

- **Primary**: teks badan, butang dan setiap alat.
- **Headings**: muka paparan untuk `h1` dan `h2`.
- **Code**: muka monospace untuk kod dan data.
- **Italic**: italik sebenar untuk penekanan, petikan dan kenyataan sampingan.

Kad hanya diwarnakan di mana anda memasang muka itu, dan butangnya berbunyi **Change** pada muka milik anda dan **Choose a face** di tempat lain. Tiada apa-apa pada kad mengomit apa-apa: butang membuka pentas banding untuk peranan itu.

![Empat kad peranan didedahkan - setiap satu ditetapkan dalam muka taip yang berkhidmat untuknya, dengan satu tag Starter di mana tiada sesiapa memilih satu dan Italic mengikuti primary](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

### Peringkat perbandingan

Pentas dibuka di dalam bilik, di bawah kad yang anda tekan, dan kad dilipat menjadi jalur satu baris supaya pentas kelihatan pada skrin pertama telefon. Escape membatalkan dan memulangkan fokus kepada kad.

1. Tekan **Choose a face** pada kad.
2. Taip nama keluarga dan tekan **Preview**, atau tekan salah satu daripada enam keluarga **Pinned** di bawah medan.
3. Tekan **Use this face**.

![Peringkat perbandingan terbuka di bawah kadnya, dengan baris carian, keluarga yang disemat dan kad-kad dilipat menjadi satu jalur sebaris](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

**Persetujuan ditanya sekali.** Kali pertama pratonton sampai ke Google Fonts, dialog menerangkan: *Google learns the family name and your IP address. The file is then kept on this device and used offline. This is the one step in the studio that reaches a third party.* **Fetch from Google** meneruskan dan diingati. **Cancel** meninggalkan kad berbunyi *"Not fetched. Nothing was sent to Google."*, dengan **Fetch from Google** sendiri.

**Letakkan fail fon pada pentas** (TTF, OTF atau WOFF) untuk pratonton muka taip berlesen yang sudah anda miliki. Dalam kedua-dua cara muka kekal pada peranti ini, dirender luar talian dalam apl, alat dan setiap eksport, dan dibawa dalam fail sistem reka bentuk. Segala-galanya di Google Fonts dihantar di bawah lesen terbuka (OFL, Apache atau UFL).

### Fon pada peranti ini

Panel **Fonts** menyenaraikan setiap muka pada peranti ini dan peranan yang dilayaninya. Muka yang anda tambah mendahului di bawah **In the design system**, masing-masing dengan peranannya dan pemadaman. Muka starter mengikut dalam satu baris malap terlipat. **Add a face** membuka pentas banding untuk mana-mana peranan. Panel **Type roles** menunjukkan spesimen langsung setiap peranan dengan keluarga dan keadaannya, seperti *Inter* atau *Inter · follows Primary*.

## Tokens

Token ialah nilai bernama di sebalik sistem reka bentuk: warna, muka taip, logo, sudut dan jarak. Alat membacanya mengikut nama, jadi perubahan di sini sampai ke setiap alat sekali gus.

![Bilik Tokens: kepala dengan contoh daripada sistem dan tindakan fail, jubin yang mengira setiap jenis token, kemudian pasangan warna dengan bacaan kontrasnya](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **Kepala** memberikan contoh daripada sistem anda sendiri (*Primary is Spearmint, #033633*) dan tindakan fail: **Download** (keseluruhan sistem sebagai token reka bentuk, atau palet dalam lima format lain), **Copy CSS** dan **Add from…** untuk membaca semula fail JSON.
- **Jubin** mengira setiap jenis token dan melompat ke bahagiannya: Colours, Type, Logos, Shape and spacing, More dan All tokens. Ia mengira apa yang milik anda, seperti Overview. Pada telefon jubin menatal ke sisi.
- **Colours** bermula dengan pasangan yang diletakkan alat bersama (teks pada permukaan, pada primer, muted pada permukaan) dengan bacaan APCA dalam cerah dan gelap, dan menandakan **Weak contrast** di mana pasangan kurang. Kemudian setiap kumpulan warna: ramp sebagai satu baris cip, warna lain dengan nilai dan rujukan yang digunakan alat, seperti `{color.brand.spearmint}`. Tekan rujukan untuk menyalin rujukan. **Edit in Colours** membuka kumpulan dalam bilik Colours.
- **Type** dan **Logos** menyenaraikan muka bagi setiap peranan dan setiap slot logo, dengan **Edit in Type** dan **Edit in Logos** setelah anda mempunyai milik sendiri.
- **Shape and spacing** memegang **Rounded corners** (`shape.radius`) dan **Spacing rhythm** (`space.base`). Masing-masing berbunyi *Lolly default* sehingga anda menggerakkan peluncur dan *Yours* selepas itu, menyimpan serta-merta dan boleh dibatalkan.
- **More tokens** menambah jarak, saiz, lebar lejang, kelegapan, putaran, nombor biasa dan bayang, disimpan sebagai [token reka bentuk](/info/design-tokens.html) piawai.
- **App appearance (advanced)** menyenaraikan warna, saiz dan bayang yang digunakan skrin Lolly sendiri, dan **Inspect every token (advanced)** mencari dan menyunting mana-mana nilai tersimpan, menunjukkan setiap perubahan untuk disemak dahulu.

Bahagian tanpa apa-apa di dalamnya menawarkan cara mengisi jurang: **Pick a colour**, **Choose a face** atau **Add a logo**.

## Files

Letakkan fail yang disimpan jenama anda, selain logo: fail **vector**, **image**, **audio** dan **motion** (video, Lottie dan animasi). Ia muncul dalam [Assets](/info/using.html#assets-your-library), disusun ke dalam bahagian dan sedia dalam pemilih aset setiap alat, dan ia kekal pada peranti ini.

## Usage & rules

**Usage & rules** meletakkan pilihan jenama anda untuk bekerja: apa yang boleh diubah orang, apa yang kekal tetap dan apa yang boleh disemak Lolly.

![Usage & rules pada Lolly Demo: kad Brand rules kosong dengan Add your first rule, kemudian Try your brand in use dengan contohnya sedia untuk dirender](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dusage&width=1440&height=1200&dpi=192&waitMs=2400&cropSelector=%23start-panel-usage&format=svg&walker=1&dark=1&filename=bs-usage-rules)

**Brand rules** menyenaraikan peraturan anda. **Add rule** (atau **Add your first rule**) membuka borang ringkas:

- **Rule name** dalam perkataan anda sendiri, seperti *Beacon accents*;
- **Check**: **Colour choices**, **Font choices**, **Fixed artwork** atau **Text length**, dengan peranan jenama yang digunakannya, di bawah nama anda sendiri bagi peranan itu;
- **Example** yang digunakannya (Poster, Title slide, Content slide atau Chart), **Mode** dan sama ada ia **Required** atau **Advisory**;
- **Reviewed by**, kemudian **Save draft** atau **Approve & save**.

Kelulusan merekodkan keputusan anda sendiri pada peranti ini. Peraturan wajib yang diluluskan mengekang poster boleh guna semula, dan semakan hanya meliputi PNG contoh; ia tidak mengubah alat lain.

Peraturan yang dibawa sistem reka bentuk dalam fail tokennya, seperti pasangan warna yang diluluskan, berat dan penjajaran teks atau logo bagi setiap permukaan, disenaraikan di sini sebagai **Checked in Design**. Design menyemaknya lapisan demi lapisan dalam kad **Before you export** panel eksport, dan `lolly check` melakukan perkara yang sama untuk dokumen Design tersimpan ([Before you export](/info/design.html#before-you-export)). Peraturan yang tiada penyemaknya dalam binaan ini disimpan seperti yang dibekalkan dan ditandakan **Unchecked**.

**Try your brand in use** merender empat contoh daripada semakan semasa dengan **Render & check examples**. Pilih **Brand mode** dan **Try your own text** untuk tajuk, teks sokongan dan teks slaid. Setiap contoh melaporkan apa yang diukur, dengan **See checks & sources** dan **Download check report**, dan **Make reusable poster** memuat turun `.lolly` yang susun atur tetap dan pilihan input yang diluluskan dibawa bersama fail. Contoh adalah setempat: tiada apa-apa diterbitkan atau diluluskan dengan menjalankan semakan.

Binaan yang dihantar dengan jenama tetap menunjukkan peraturan dan contoh yang sama baca sahaja, di bawah *This brand is set*.

## Bawa masuk satu jenama

**Add from…** di kaki rel membuka pemilih yang bertanya apa yang anda ada, bukan apa formatnya:

- **Design tokens or a design file**: JSON DTCG atau Tokens Studio, projek Penpot, zip set token, pek sistem reka bentuk Lolly atau SVG.
- **PDF**: dek atau fail garis panduan, dibaca pada peranti ini untuk warna, lambang dan muka taip terbenamnya.
- **Logo or screenshot**: imej menjadi palet yang dicadangkan, dibaca pada peranti ini. Ia membaca warna, bukan muka taip atau reka letak.
- **Saved web page**: satu fail HTML dan fail CSS-nya, atau HTML atau CSS yang ditampal, sehingga 20 fail dan 2 MB. Hanya teks yang anda bekalkan dibaca: sumber yang dipaut tidak diambil dan skrip tidak dijalankan.
- **Font file**: TTF, OTF atau WOFF. Membuka bilik Type, tempat muka dipasang.
- **Website**: satu halaman, dibaca untuk warna dan tipografinya. Jubin ini muncul hanya pada peranti yang boleh membaca halaman, dan menyatakan pembaca mana yang digunakan: apl pada peranti ini, atau sambungan pelayar dalam tab latar belakang, log masuk sebagai anda. Menamakan URL hanya mengisi medan; menekan fetch ialah persetujuan.

Pilih sumber fail reka bentuk dan kad seterusnya menyenaraikan format yang diterima sebagai jubin ikon, dengan seluruh kad sebagai satu sasaran letak. Anda juga boleh meletakkan fail terus ke studio.

![Kad import - format yang diterima mendahului sebagai jubin ikon, dan keseluruhan kad adalah satu sasaran jatuhan](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

- **Pek sistem reka bentuk Lolly** (`.lolly`, atau `.zip` legasi) dipasang dalam satu langkah.
- Eksport **Penpot** (`.penpot`) membawa token reka bentuknya.
- Fail **Design Tokens** (W3C DTCG) atau **Tokens Studio** (`.json`) membawa tokennya.
- **SVG biasa** diimbas untuk warna yang anda pilih, yang pertama menjadi primer anda.

### Semak rujukan

Logo, tangkapan skrin, laman web atau halaman tersimpan membuka **Try these colours**: contoh dalam warna yang dicadangkan, **Main colour** yang boleh anda ubah dan nama untuk sistem baharu. Kotak menerangkan apa yang dilakukan penggunaan: ia **menggantikan** tetapan token aktif dengan palet yang dijana dan gaya lalai, **mengekalkan** fon dan fail pustaka anda dan sistem sebelumnya boleh **dipulihkan**. **Apply suggested settings** menggunakan palet cerah dan gelap, selepas titik semak, dan **Restore brand settings** boleh mengembalikan tetapan lama. **Change reference** memilih sumber lain.

**Palette, source details and individual choices** menunjukkan apa yang dibaca, sebarang nama fon yang ditemui dan kontras pratonton. Nama fon hanya cadangan; Type masih tempat anda memasang muka. Butiran sumber boleh termasuk tipografi, jurang, pelapik dan nilai sudut di mana diperhatikan, dilabelkan **Not observed** jika tidak. Halaman tersimpan atau bacaan laman web natif melaporkan gaya yang diisytiharkan, yang mungkin tidak digunakan halaman, dan sambungan pelayar boleh melaporkan gaya yang diukur daripada sampel elemen kelihatan. Ini ialah pemerhatian: tiada apa-apa dipasang, dan jarak sumber tidak pernah menggantikan milik anda. **Choose individual items in the tray** mengekalkan item tunggal, dan **Download design context** menyimpan laporan JSON pemerhatian, token yang dicadangkan dan maklumat sumber (dengan SHA-256 bagi sebarang HTML atau CSS yang dibekalkan). Laporan tidak memegang teks halaman mentah dan bukan Content Credential bertandatangan.

Import PDF dan fail reka bentuk mengekalkan kawalan semakan sendiri. Item dalam **Tray** tidak mengubah apa-apa sehingga anda menambahnya dalam bilik yang memiliki jenis bahan itu. `#/start?source=<kind>` membuka pemilih pada sumber (`file`, `pdf`, `image`, `font`, `url`, `page`), dan `?import` membuka senarai biasa.

### Cari dan banding rupa

Buka **Find a look** daripada Overview atau daripada senarai sistem reka bentuk dalam Settings. Layari sistem yang disimpan pada peranti ini dan beberapa contoh Lolly boleh guna semula, dan cari mengikut nama, teg warna atau fon yang diisytiharkan. **Closest to my current palette** mengisih mengikut persamaan warna yang diukur, dengan fon yang sepadan memutuskan seri; ia bukan skor kualiti.

Pilih satu rupa untuk menyemaknya, atau dua untuk dibandingkan bersebelahan. Memilih tidak mengubah apa-apa. **Use this saved system** bertukar kepadanya, dan **Use these colours** menggunakan warna contoh melalui titik semak biasa, mengekalkan fon anda. **Restore brand settings** memulihkan rupa sebelumnya. Sistem tersimpan mempunyai **Search tags** boleh sunting di bawah **Details and design context**. Contoh ialah resipi warna Lolly asli, tanpa koleksi yang diraut dan tanpa akaun.

![Bandingkan Sunroom dan Orchard bersebelahan sebelum menggunakan mana-mana satu sistem warna.](/t/url-shot?url=%2F%23%2Fstart&width=1280&height=900&dpi=96&waitMs=3000&format=svg&filename=brand-compare-looks&try=1&drive=click%3A%5Bdata-ds-door%3D%22looks%22%5D%3Bwait%3A500%3Bclick%3A%5Bdata-look-select%3D%22example%3Asunroom%22%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Aorchard%22%5D%3Bclick%3A%5Bdata-looks-review%5D%3Bwait%3A500&cropSelector=.ds-looks-comparison&waitSelector=%5Bdata-ds-door%3D%22looks%22%5D&walker=1&rasterDpi=96)

## Simpan dan pindahkan sistem reka bentuk anda

### Pindahkan jenama antara peranti

**Export** menulis satu fail **`LollyBrand-….lolly`**: token, fon, logo dan pilihan tema anda, dengan manifes integriti yang disemak semasa kembali masuk. Keluaran web sebelum 1.0.7 menamakan fail yang sama `.zip`, dan ejaan itu masih diterima. **Tokens (.json)** menulis dokumen token reka bentuk biasa sahaja, tanpa fon atau logo, untuk repositori, langkah binaan atau alat token lain.

Untuk membawa satu kembali, gunakan **Add from… → Design tokens or a design file**, atau letakkan fail pada studio. Begitulah rakan sekerja menyerahkan jenama kepada anda, atau cara anda membawa satu ke pemasangan kedua, tanpa akaun dan tanpa awan. Untuk membawa jenama masuk daripada baris perintah, lihat [`ingest:brand`](/info/configuration.html#brand-packs).

**Fonts for Linux (.rpm)** membungkus fon yang anda tambah ke dalam RPM boleh pasang. Jika anda memuat naik mana-mana daripadanya sendiri, Lolly meminta anda mengesahkan bahawa anda boleh mengedarkannya semula dahulu.

### Pulihkan tetapan terdahulu

Pilih **Restore brand settings**, pilih titik semak bertarikh dan tekan **Restore**. Ia memulihkan warna, tetapan taip dan token lain untuk jenama aktif; fail fon dan imej kekal seperti sedia ada. Lolly menyimpan tetapan semasa anda sebagai **Before restore** dahulu, supaya anda boleh membalikkan pemulihan walaupun selepas menutup pelayar. 20 titik semak terkini disimpan pada peranti ini.

### Versions

Versi yang diterbitkan ialah **salinan kekal yang bernama** yang disimpan pada peranti ini. Ia tidak pernah berubah, jadi alat atau pautan yang menyematnya (dengan `designv`) terus melukis perkara yang sama. Sistem dengan sesuatu milik anda menunjukkan pautan **Versions & publishing** yang tenang di kaki rel; selepas penerbitan pertama anda ia menjadi entri **Versions**. `#/start?area=versions` membukanya terus.

- **Versi adalah kekal.** Belum ada pemadaman, dan panel menyatakannya.
- **Pembuangan mendahului kad keserasian**, kerana token yang dibuang ialah apa yang merosakkan alat.
- **Penerbitan tidak boleh dibatalkan; pemulihan boleh.** *Restore latest from this version* ialah suntingan biasa, dengan **Undo** ditawarkan serta-merta.

**Publish only** menyimpan versi tanpa mengubah apa yang diikuti alat; **Publish and make active** menjadikan alat dan apl mengikut versi itu. **Follow the latest again** menjadikan setiap suntingan aktif sebaik anda membuat suntingan itu.

## Urus sistem reka bentuk anda

Buka **Settings → Preferences → Design systems** untuk menukar, menambah atau membuang sistem. **Open** memilih sistem dan membukanya di sini; **Make a new one** mencipta sistem setempat dan membukanya dengan medan namanya sedia. Satu sistem aktif pada satu masa, untuk seluruh peranti. [Brand architectures](/info/brand-architectures.html) membantu memutuskan bila jenama memerlukan sistem reka bentuk sendiri.

**Dari mana sistem datang.** Sistem yang dibekalkan katalog penempatan berbunyi **Came with this app**, atau **From this instance** dalam apl yang disambungkan kepada satu. Kembangkan **Catalogue source** untuk melihat siapa yang membekalkannya, aset token dan ruang namanya serta versi atau checksum yang diketahui; jika penyegaran gagal, bahan yang dicache dilabelkan.

**Sistem terurus adalah baca sahaja.** Sistem berbunyi **Managed by this instance** (atau **Managed by this app** dalam apl desktop tanpa instans) apabila katalognya mengunci sistem. Anda boleh menggunakan dan memuat turunnya, dan membukanya di sini menunjukkan nota baca sahaja dengan **Make an editable copy** dan **Switch**. Sistem setempat anda sendiri kekal boleh sunting, walaupun yang terurus datang dahulu. Binaan dengan satu jenama tetap membuka Design System Setup pada *This brand is set*, dengan token dan peraturan penggunaan jenama untuk dibaca.

**Setiap sistem lain yang dibekalkan adalah milik anda** untuk disembunyi, disunting dan ditetapkan semula, termasuk Lolly Demo dan Lolly Starter pada lolly.tools. Menyunting satu mengekalkan namanya dan menandakan baris **Edited here**, dan **Reset to original** dalam menunya membuang perubahan yang dibuat pada peranti ini. Starter kosong ialah pengecualian: perubahan pertama di situ memulakan sistem reka bentuk anda sendiri, jadi Lolly bertanya sekali apa nama sistem baharu. [Lolly Demo in use](/info/lolly-demo-in-use.html#switch-to-your-own) menunjukkan apa yang digantikan sistem anda sendiri.

### Membuang sistem reka bentuk

Pilih **Remove** daripada menu sistem; pengesahan menyatakan sistem mana yang aktif selepas itu. Sesi tersimpan, muat naik dan bahan yang dikongsi dengan sistem lain kekal.

Membuang sistem yang dibekalkan hanya menyembunyikannya: aset katalognya kekal, **Bring back** menunjukkannya semula dan ia kembali dengan sendirinya jika anda membuang yang lain. Membuang salinan yang diimport atau disunting tidak membuang sistem yang dibekalkan, logo atau fontnya, dan jika salinan itu aktif, sistem yang dibekalkan menjadi aktif semula. Membuang salinan terhos yang aktif hanya mengosongkan sambungan salinan itu; instans yang dipilih secara berasingan kekal dipilih.

Mengubah apa yang dibekalkan pelayan ialah tugas pentadbir: pengendalinya mengubah katalog sumber dan menempatkan semula, atau pentadbir Lolly Work menyemak dan menggunakan perubahan pelayan. Suntingan di sini kekal setempat. Lihat [Removing a catalogue design system](/info/configuration.html#removing-a-catalogue-design-system) dan [Configuration](/info/configuration.html#supplied-and-local-design-systems).

## Gunakan konteks reka bentuk di luar apl

**Download design context** menyimpan dokumen token, warna yang diselesaikan, keluarga fon yang diisytiharkan, id aset, bukti sumber di mana direkodkan, liputan dan peraturan eksplisit, tanpa fail fon dan tanpa bukti pemilikan. Baris perintah membaca fail tanpa pelayan: `lolly system import` menjadikannya sistem reka bentuk terminal dan `lolly system check` menyemak input Design terhadap konteks tersimpan. [Bring your design system](/info/cli.html#bring-your-design-system) meliputi import dan [Which design system a command uses](/info/cli-decks.html#which-design-system-a-command-uses) meliputi semakan, dan klien MCP membaca ringkasan yang sama daripada `lolly://design-context` ([MCP Server](/info/mcp.html)).

## Ke mana seterusnya

- **[Using Lolly](/info/using.html)**: alat, penyimpanan, perkongsian dan Assets.
- **[Brand architectures](/info/brand-architectures.html)**: bagaimana bahagian, produk, jenama yang disokong, pelanggan dan musim dipetakan kepada sistem reka bentuk, colourway dan identiti logo.
- **[Design Tokens](/info/design-tokens.html)**: model token tempat jenama anda ditulis.
- **[Export a file](/info/exporting.html)**: unit cetakan, CMYK dan format yang dirender jenama anda.
