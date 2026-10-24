# Design System Setup

Logo, warna, dan huruf Anda berada di satu tempat, agar setiap alat, halaman, dan ekspor menggambar dengannya. Tempat itu adalah **Design System Setup**, di `#/start`, dan slogannya menyatakan fungsinya: *Make it yours*.

Mulai dengan apa pun yang Anda miliki. Letakkan logo dan Lolly membaca warnanya. Pilih huruf, atau letakkan file font yang dilisensikan perusahaan Anda. Setiap perubahan langsung tampak di seluruh aplikasi. Logo, font, dan token Anda tetap di perangkat ini. Memilih Google Font adalah satu-satunya langkah yang menjangkau keluar: Lolly bertanya dulu, lalu mengambil keluarga font itu sekali.

Saat sudah terlihat benar, beri nama design system dan tekan **Export**. Anda mendapat satu file `.lolly` untuk disimpan, dibuka di perangkat lain, atau diserahkan kepada rekan. [Settings](/info/dashboard.html#design-system) menampilkan sistem aktif hanya-baca, dan sampulnya menaut kembali ke sini untuk menyunting.

## Jadikan milik Anda dalam lima menit

::: timeline
- <!--i:upload--> **Letakkan logo Anda** di area lepas di **Logos**. Lolly membaca bentuk dan warnanya.
- <!--i:palette--> **Gunakan warna ini.** Warna utama logo menjadi primer Anda, dan netral gelap dari logo menjadi warna teks Anda.
- <!--i:font--> **Pilih huruf** di **Type**: Google Font, atau file font milik Anda.
- <!--i:pentool--> **Beri nama sistemnya.** Suntingan pertama Anda membuat design system milik Anda sendiri, dan Lolly menanyakan namanya sekali.
- <!--i:download--> **Export** menulis seluruh sistem sebagai satu file `LollyBrand-….lolly`.
:::

Header menunjukkan design system mana yang sedang Anda **Editing**, dan namanya adalah field yang dapat Anda ubah kapan saja. Saat suntingan pertama Anda menanyakan **What is this design system called?**, kata-kata dari logo Anda terisi bila logo mengejanya. **Save name** menyimpan nama; **Not now** mempertahankan placeholder sampai Anda mengetik satu di header. Nama itu melabeli sistem di Settings dan saat Anda berpindah, dan menjadi nama file yang ditulis **Export**.

## Ruang-ruangnya

Studio adalah sekumpulan ruangan dalam rel di sisi, tanpa urutan tetap: tidak ada yang bernomor dan tidak ada yang menunggu yang lain. Di ponsel rel menjadi strip chip di bawah header.

![Rel ruangan studio: Overview, Colours, Type, Logos, Tokens, Files, dan Usage & rules](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-rail&waitSelector=.ds-rail&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

| Ruangan | Yang Anda lakukan di sana | Kunci tautan |
|---|---|---|
| **Overview** | Lihat apa yang dimuat sistem, dengan pintu ke setiap ruangan | `overview` |
| **Colours** | Tambah warna, beri peran, bangun shade dan palet | `color` |
| **Type** | Pilih empat huruf yang dibaca aplikasi, alat, dan setiap ekspor | `type` |
| **Logos** | Tempatkan lambang Anda dalam setiap orientasi dan perlakuan | `logos` |
| **Tokens** | Sudut, jarak, bayangan, dan setiap nilai bernama lainnya | `tokens` |
| **Files** | File gambar, audio, dan gerak yang disimpan brand Anda | `catalogue` |
| **Usage & rules** | Aturan yang diterapkan brand Anda, diperiksa pada contoh nyata | `usage` |

Tautkan ke ruangan dengan `#/start?area=<key>`. Ruangan Files mempertahankan kunci `catalogue`, karena kunci ruangan adalah kontrak permanen, dan `?tab=` tetap berfungsi sebagai alias lama. Kunci yang tidak dikenal membuka Overview.

**Dasar rel** memuat aksi untuk seluruh sistem, bukan satu ruangan. **Add from…** membawa brand masuk ([Bring a brand in](#bring-a-brand-in)), dan **Tray** menyimpan apa yang ditemukan pemindaian yang belum Anda tambahkan. **Export**, **Tokens (.json)**, **Fonts for Linux (.rpm)**, **Versions**, dan **Restore brand settings** menyimpan dan memindahkan sistem ([Keep and move your design system](#keep-and-move-your-design-system)). Masing-masing muncul begitu ada yang bisa dikerjakannya.

## Overview

Tanpa pilihan apa pun, Overview menawarkan empat cara memulai. **Start from a reference** membuka pemilih sumber untuk logo, tangkapan layar, halaman web, atau file desain, dan **Pick a colour**, **Choose a face**, dan **Add a logo** membuka kontrol itu langsung. Membuka salah satunya tidak menulis apa pun, dan **Explore the tools** tersedia sejak awal.

Begitu ada yang menjadi milik Anda, Overview menampilkan apa yang Anda miliki, dengan jumlah milik Anda di depan. Colours memberi jumlah warna, dengan `· N starter` yang diredupkan bila warna warisan tampil; stripnya menaruh warna Anda lebih dulu, lalu garis tipis, lalu warna starter yang memudar. Type dibaca menurut peran (*Inter for headings*, dengan *Starter for the rest* di baris bawahnya). Logos menyatakan berapa slot terisi (atau **Not set**), Tokens menampilkan radius sudut, dan Files menyatakan **Nothing yet** selama pustaka kosong. Setiap blok membuka ruangannya.

### Starter dan milik Anda

**Starter** adalah kata untuk apa pun yang datang bersama aplikasi, bukan dipilih. Instalasi baru tidak membawa warna sama sekali, hanya satu ramp netral dari tinta ke kertas, sehingga permukaan, teks, dan garis tipis dapat dirender sebelum siapa pun memutuskan apa pun. Kata yang sama menandai materi warisan di setiap ruangan.

::: cols
## Starter

- Datang bersama aplikasi: netral tinta-ke-kertas, huruf starter, radius sudut default.
- Diredupkan, dengan tag **Starter** dan tanpa tint.
- Tidak dihitung sebagai warna Anda. Netral berada di **Tokens** sebagai **Neutrals · starter · 9**, dan **Open** menampilkannya di Colours sebagai satu grup terlipat (`#/start?area=color&group=neutral`).
- Peran yang bertumpu pada warna starter berbunyi *"Starter Paper stands in"*, dengan **Choose…** pada pemilihnya.

## Milik Anda

- Dipilih atau dipasang oleh Anda.
- Kekuatan penuh, dan kartu bertint tempat Anda memasang huruf.
- Dihitung di Overview dan di Tokens.
- Peran yang mengikuti peran lain berbunyi **↳ follows Primary** dan tidak mengulang nama primer.
:::

Materi warisan tidak pernah digambar dengan batas putus-putus, karena di sini batas putus-putus berarti target lepas.

## Logos

Kosongkan folder lambang Anda ke area lepas di atas: **"Drop marks here, or choose several at once"** menerima sebanyak file yang Anda punya. Setiap file dibaca untuk bentuk dan tintanya, lalu menunggu di bawah **Waiting for a slot** sebagai chip yang menyatakan tampilannya, seperti *"Looks like the Horizontal primary"*, dengan pengukuran yang dipakai dan tombol **Place** (**Replace** bila slot terisi). Bila tidak yakin, chip menyatakannya dan menawarkan **Change slot**, mencantumkan kedelapannya. Tidak ada yang ditempatkan sampai Anda menekan sesuatu.

Lambang dengan margin kosong berlebih mendapat tawaran pangkas lebih dulu; jawab atau tekan Escape dan aslinya masuk tanpa tersentuh. Bila lambang dapat mengisi slot saudara yang kosong, ruangan menawarkan versi **mono** atau **reverse** turunannya sebagai chip bertanda *Generated*.

Setiap lambang berakhir di grid delapan slot opsional, satu per **orientasi** dan **perlakuan**:

- **Orientasi:** Horizontal (wordmark dan simbol dalam satu baris) dan Vertical (bertumpuk, untuk ruang persegi dan tinggi).
- **Perlakuan:** Primary, Primary reverse (untuk latar gelap), Mono (satu warna), dan Mono reverse.

Grup yang belum memiliki lambang terlipat menjadi satu baris; buka untuk melihat slotnya. Klik slot untuk menambah PNG, SVG, JPEG, atau WebP, atau klik slot terisi untuk mengganti lambang. Semuanya tetap di perangkat ini.

![Slot logo dengan Horizontal dan Vertical terbuka: setiap perlakuan adalah slot sendiri, dan setiap slot opsional](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&width=1440&height=1600&dpi=192&waitMs=1600&drive=click%3A.be-logo-identity%3Edetails%3Anth-of-type%281%29%3Esummary%3Bclick%3A.be-logo-identity%3Edetails%3Anth-of-type%282%29%3Esummary%3Bwait%3A600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Lambang kustom** adalah lambang yang disebut brand Anda dengan namanya sendiri, seperti ikon, lencana, atau favicon.
- **Identitas lain.** Sub-brand, produk, atau acara dapat memiliki set lengkapnya sendiri: **+ Add another logo** dan beri nama set itu. Set utama Anda adalah "Your logo". [Brand architectures](/info/brand-architectures.html) menunjukkan kapan identitas logo adalah blok yang tepat.
- **Lolly membaca warna logo.** Kartu di bawah area lepas, dan lagi di bagian atas Colours, mencantumkan warna logo dan menanyakan **Which is the main colour?**, dengan warna terkuat sudah terpilih (tidak pernah putih tempat ia diekspor). **Use these colours** menambahkannya ke palet, menjadikan warna utama sebagai primer, dan, bila logo memiliki netral gelap yang terbaca di atas kertas, menjadikannya warna teks. **Not now** meninggalkannya di Tray. Pada instalasi yang benar-benar baru jawaban yang paling mungkin diterapkan langsung, dan kartu menawarkan **Undo** atau warna utama lain. SVG memberi warna persis; PNG, JPEG, atau WebP memberi warna yang menutupi bagian nyata dari lambang.

## Colours

Ruangan tumbuh bersama design system: kunjungan pertama adalah satu keputusan, dan sisanya tiba seiring palet.

### Warna pertama

Sistem tanpa warna sendiri terbuka pada satu chip besar dan satu field, dengan satu baris yang menyatakan bahwa peran, shade, dan pengaturan cetak tiba seiring sistem tumbuh.

- **Chip adalah pemilihnya.** Tekan **Pick a colour** dan kartu OKLCH studio terbuka, diisi dengan apa pun yang ada di field: nama, roda, empat dial, alpha, dan **Stored as**, dengan **Cancel** dan **Add colour** di dasar. Tidak ada yang mencapai sistem sampai Anda menekan **Add colour**.
- **Field menerima notasi apa pun**: `#e0452b`, `rgb(224 69 43)`, `oklch(58% .19 32)`, atau nama warna. Tempel daftar dan ia menjadi baris chip untuk ditambahkan satu per satu atau dengan **Add all**.
- **Dua jalan masuk lain.** **Pick a colour from the screen** memakai eyedropper bila browser memilikinya, dan **Take colours from an image** membaca tangkapan layar atau foto di perangkat ini.
- **Add tidak pernah dinonaktifkan.** Tanpa isi di field ia membuka pemilih; teks yang tidak dapat dibacanya mendapat baris di bawah field yang menyatakannya.

Warna pertama Anda menjadi **primary**, dan sebuah chip mengonfirmasinya, seperti *"Primary is now Vivid Violet"*, dengan **Fine-tune** untuk menyesuaikan warna.


### Seiring palet berkembang

Warna Anda berada di samping pratinjau **In context** pada layar lebar, dan di atasnya pada layar lebih kecil. Pratinjau menampilkan poster, bagan, atau kartu antarmuka dalam palet Anda. Warna starter tetap di grup lipatnya sendiri.

![Ruangan Colours pada Lolly Demo: palet dalam grup lipat, setiap warna dengan nama dan hex-nya, dan pil unduh di dasar](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

![Ruang Colours setelah menambahkan satu warna, dengan paletnya dan pratinjau komposisi live](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

### Peran: yang dibaca alat

**Roles** menyatakan warna mana yang memerankan setiap bagian di tiap alat dan ekspor. Peran bersifat opsional (tiga warna lepas tanpa peran adalah sistem yang sangat baik), warna apa pun dapat mengambil satu, dan pembacaan kontras diukur terhadap permukaan, APCA lebih dulu. Setiap baris peran menampilkan warna sendiri dengan kekuatan penuh, warna starter yang menggantikan, atau **↳ follows Primary**.

Begitu palet memiliki shade, strip menampilkan ketujuh peran yang dapat dibaca alat: Primary, Secondary, Surface, Text, Muted, Edge, dan On primary. On primary diturunkan dari primary, berbunyi **Derived**, dan tidak memiliki pemilih.

Aksen aplikasi sendiri mengikuti design system secara default. Itulah pengaturan **Interface follows the design system** di **Settings → Appearance**; mematikan pengaturan membiarkan chrome aplikasi netral, sementara alat, kanvas, dan ekspor mengikuti design system dalam kedua kasus.

**Colourways.** Design system dapat memuat beberapa warna utama, masing-masing dipilih per karya. Lolly mempertahankan setiap colourway, tetapi ruangan ini belum dapat menyusunnya: colourway ditulis di file token. Pada sistem dengan colourway, setiap colourway memerlukan primary dan secondary sendiri, dan surface sendiri bila colourway mewarnai latar, sehingga peran-peran itu tetap diatur di editor swatch. [Lolly Demo in use](/info/lolly-demo-in-use.html#colourways-on-real-work) menunjukkan colourway pada pekerjaan nyata, dan [Add colourways to a design system](/info/colourways.html#add-colourways-to-a-design-system) memuat formatnya.

### Temukan lebih banyak warna

Tiga alat dibangun di atas primary Anda. Dua yang pertama hanya menyarankan, dan yang ketiga menggantikan palet setelah Anda meninjau perubahan.

::: cols
## Explore shades & harmonies

Pilih **Starting colour**, **Scheme** (Mono, Complement, Analogous, atau Triad), dan berapa banyak **Shades** (3 hingga 20, default 5). **Fine-tune** mengatur intensitas UI, kontras, dan teks pada brand. Klik shade untuk menambahkannya, atau **Add 5 shades** untuk satu grup. Warna dan peran Anda tetap.

## Find matching colours

Pilih **Harmony**: Complementary, Adjacent, Triad, Tetrad, atau Analogous (dengan **Accents** dari 2 hingga 5 dan **Angle** dari 10° hingga 45°). Setiap kandidat memiliki nama yang dihasilkan dan **+ Add**, sekali tekan per warna.

## Rebuild the whole palette

Menggantikan palet dari satu warna awal, setelah tinjauan apa yang berubah dan apa yang tetap. Checkpoint dibuat lebih dulu, dan **Undo** ditawarkan sesudahnya.
:::

Ketiganya memakai matematika warna perseptual (OKLCH) yang sama dengan engine. Di **Explore shades & harmonies**, baris **Primary**, **Neutral**, dan **Secondary** menampilkan shade yang disarankan, dan **Theme preview** menampilkan contoh terang dan gelap beserta pembacaan kontrasnya.

![Tiga kelompok shade yang disarankan, dengan kontrol tambah masing-masing dan sebuah Theme preview terpisah](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

![Aksen yang dihasilkan, masing-masing dengan sebuah swatch, nama yang dibuat otomatis, kode heksnya, dan tombol Add](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&drive=click%3A.be-generate-detail%3Anot%28%5Bdata-be-rebuild%5D%29%20%3E%20summary%3Bwait%3A500&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### Menerapkan palet yang dihasilkan

Buka **Rebuild the whole palette…** dan tekan **Preview full rebuild**. Tinjauan menghitung berapa peran yang tetap seperti yang Anda tetapkan, berapa warna Anda sendiri yang dipertahankan, dan berapa kurva shade, kunci cetak, shade tersembunyi, dan stop gradien yang di-anchor ulang atau dipertahankan. **Apply rebuilt palette** meng-commit; **Cancel** tidak mengubah apa pun. Sesudahnya kartu menawarkan **Undo** dengan fokus padanya, dan checkpoint yang dibuat sebelum penukaran memulihkan seluruh sistem.

Sistem dengan colourway mempertahankan setiap colourway melalui pembangunan ulang. Colourway kanonis mengikuti warna awal yang baru, dan setiap colourway lain mempertahankan warna, nama, urutan, dan pengaturannya sendiri. Tinjauan mencantumkan colourway mana yang mengikuti dan mana yang mempertahankan warnanya. Lolly tidak membangun ulang sistem yang menyandikan colourway-nya dengan cara yang tidak dapat disuntingnya; kartu menyatakan alasannya, dan tidak ada yang berubah.

### Bagian pakar

Empat bagian terlipat berada di bawah pratinjau dan peran. Masing-masing terbuka langsung dengan `#/start?area=color&focus=<name>`:

- **Explore shades & harmonies** (`focus=generate`), dijelaskan di atas.
- **Shade curves** (`focus=curves`) membentuk ulang ramp titik demi titik, dengan kurva lightness, chroma, dan hue terpisah (L / C / H) dan shade tergambar ulang saat Anda menyeret.
- **Contrast** (`focus=contrast`): **Contrast-lock** menyetel ulang nada ramp untuk mencapai target APCA terhadap latar yang Anda pilih, dan **Rotate hue** memutar seluruh ramp mengelilingi roda.
- **Print** (`focus=print`) menetapkan menjadi apa primary di mesin cetak: nilai otomatisnya, racikan CMYK yang dikunci, atau tinta spot bernama.

### Palet dan setiap swatch

Palet mencantumkan warna Anda dalam grup lipat, masing-masing dengan **+ Add** sendiri. Buat dan ganti nama grup sesuka Anda. Peran tidak pernah membuat ubin kedua: ubin yang ditunjuk peran mengenakan tanda kecil sebagai gantinya (**P**, **S**, **Su**, **T**). **Colour chart** di bawah ubin menampilkan warna yang sama pada **Wheel** OKLCH (seret titik untuk mewarnai ulang, klik ruang kosong untuk menambah swatch) dan bagan **Gamut**, yang menunjukkan di mana rentang yang dapat ditampilkan berakhir. `#/start?area=color&focus=chart` membuka bagan langsung.

![Panel palet, setiap kelompok dapat dilipat, dengan pil unduh terparkir di tepi bawahnya](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![Roda OKLCH - sudut adalah hue, jarak keluar adalah chroma, dan abu-abu berjalan di sepanjang rel lightness di sisinya](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

Klik swatch untuk membuka editornya:

- **Rename** swatch.
- **Set the colour** pada penggeser OKLCH, atau dalam **Hex**, **HSL**, **RGB**, atau **CMYK**. Field nilai membaca dan menulis dalam ruang aktif. CMYK di sini mengatur warna layar lewat konversi; untuk mengunci tinta persis, gunakan **Print substitutes**.
- **Stored as** memilih bagaimana swatch disimpan: **LCH** (default, perseptual dan gamut lebar), Hex, RGB, atau HSL.
- **Use as** memberi swatch peran secara langsung. Tekan peran yang disorot lagi untuk menghapus peran.
- **Print substitutes** (terlipat): kunci **CMYK** dari **Auto** ke nilai tinta persis, atau atur **Spot colour** dengan **Name** (seperti `PANTONE 186 C`), **Book** opsional, dan **Finish** untuk foil, emboss, deboss, pernis spot, soft touch, atau die cut, crease, atau perforasi. Mesin cetak memakai kunci ini saat Anda mengekspor PDF atau TIFF CMYK; lihat [Colour profiles](/info/exporting.html#colour-profiles).
- **In other spaces** (terlipat): satu nilai per ruang warna, diturunkan atau dibuat oleh Anda, dan yang dibuat menang saat ekspor.

**Menghapus swatch** aman. Shade turunan dan peran tema disembunyikan, sehingga tidak ada yang membacanya rusak, sementara warna yang Anda tambahkan dihapus.

::: details Bekerja dengan banyak swatch
Setiap swatch memiliki handle seret. Seret untuk menyusun ulang dalam grup, atau fokuskan handle, tekan Space, gunakan tombol panah, dan tekan Space lagi untuk menjatuhkan; Escape membatalkan. Untuk memindahkan warna antar grup, gunakan kontrol **Group** editor atau pilih beberapa dan gunakan **Move to**.

Pemilihan tidak memerlukan mode. Bilah muncul bersama ubin terpilih pertama dan pergi bersama yang terakhir.

- **Seret di ruang kosong** untuk menggambar persegi panjang; setiap ubin yang disentuhnya bergabung ke pilihan, lintas grup. Bagian terlipat tidak menambahkan apa pun.
- **Shift-klik** mengambil rentang dalam urutan baca, **Cmd/Ctrl-klik** menyalakan satu ubin, dan klik biasa membuka editor.
- Setiap header grup memiliki **Select all**, dan **Cmd-A** dengan ubin terfokus mengambil setiap warna milik Anda, tidak pernah yang starter.
- Grid memiliki satu perhentian tab: panah bergerak, Shift-panah memperluas, Space menyalakan, Delete menghapus, dan Escape mengosongkan. Untuk menggeser satu kanal, tekan `l`, `c`, atau `h` lebih dulu.
- Di layar sentuh, tekan dan tahan ubin untuk memulai pilihan, lalu ketuk untuk menambah.

Bilah berbunyi **{n} selected**, lalu **Move to**, **Give a role** (setiap warna mengambil peran berikutnya secara bergiliran), **Download** (pilihan dalam enam format palet mana pun), **Duplicate** (salinan tiap warna, ditempatkan setelah aslinya), **Copy values**, dan **Delete**. Satu salinan terbuka langsung di editor; beberapa tetap terpilih. Satu Cmd/Ctrl-Z membatalkan seluruh aksi massal.
:::

### Gradien

Panel **Gradients** opsional membangun token campuran dari palet. Setiap gradien memiliki pratinjau, 2 hingga 8 stop bernama, dan sudut. Stop menunjuk ke swatch, jadi warnai ulang swatch dan gradien mengikuti. Campuran berjalan di OKLCH.

Unduhan palet (token desain, CSS, SCSS, GIMP, dan Adobe Swatch Exchange) berada dalam pil di dasar palet begitu ada shade. [Take your palette and fonts anywhere](/info/using.html#take-your-palette-and-fonts-anywhere) menjelaskan setiap format.

## Type

Tanpa huruf sendiri, ruangan hanya satu kartu: **Primary**, diset pada ukuran baca dalam huruf yang melayaninya hari ini, dengan tag **Starter**, tombol **Choose a face**, dan baris *"Nothing installs until you choose one."* Headings, code, dan italic mengikuti primary sampai Anda memilihnya; **Choose them separately** menampilkan kartunya.

![Ruang Type dengan belum ada wajah yang dipilih - satu kartu pada ukuran baca, sebuah tag Starter di atasnya, dan satu Choose a face yang terisi](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

Pilih satu huruf dan ruangan membuka menjadi empat kartu peran, daftar Fonts, dan spesimen langsung:

- **Primary**: teks isi, tombol, dan setiap alat.
- **Headings**: huruf tampilan untuk `h1` dan `h2`.
- **Code**: huruf monospace untuk kode dan data.
- **Italic**: italic sejati untuk penekanan, kutipan, dan catatan sampingan.

Kartu bertint hanya di tempat Anda memasang huruf itu, dan tombolnya berbunyi **Change** pada huruf milik Anda dan **Choose a face** di tempat lain. Tidak ada di kartu yang meng-commit apa pun: tombol membuka panggung perbandingan untuk peran itu.

![Empat kartu peran tersingkap - masing-masing disetel dalam wajah yang melayaninya, dengan tag Starter di mana tidak ada yang memilih satu dan Italic mengikuti primary](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

### Compare stage

Panggung terbuka di dalam ruangan, di bawah kartu yang Anda tekan, dan kartu terlipat menjadi strip satu baris agar panggung tampil di layar pertama ponsel. Escape membatalkan dan mengembalikan fokus ke kartu.

1. Tekan **Choose a face** pada kartu.
2. Ketik nama keluarga dan tekan **Preview**, atau tekan salah satu dari enam keluarga **Pinned** di bawah field.
3. Tekan **Use this face**.

![Compare stage terbuka di bawah kartunya, dengan baris pencarian, keluarga yang disematkan dan kartu-kartu terlipat menjadi satu strip sebaris](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

**Persetujuan ditanya sekali.** Pertama kali pratinjau menjangkau Google Fonts, dialog menjelaskan: *Google learns the family name and your IP address. The file is then kept on this device and used offline. This is the one step in the studio that reaches a third party.* **Fetch from Google** melanjutkan dan diingat. **Cancel** meninggalkan kartu berbunyi *"Not fetched. Nothing was sent to Google."*, dengan **Fetch from Google** miliknya sendiri.

**Letakkan file font di panggung** (TTF, OTF, atau WOFF) untuk melihat pratinjau huruf berlisensi yang sudah Anda miliki. Dengan cara apa pun huruf tetap di perangkat ini, dirender offline di aplikasi, alat, dan setiap ekspor, dan ikut dalam file design system. Semua di Google Fonts dikirim dengan lisensi terbuka (OFL, Apache, atau UFL).

### Font di perangkat ini

Panel **Fonts** mencantumkan setiap huruf di perangkat ini dan peran yang dilayaninya. Huruf yang Anda tambahkan memimpin di bawah **In the design system**, masing-masing dengan perannya dan tombol hapus. Huruf starter menyusul dalam satu baris terlipat yang diredupkan. **Add a face** membuka panggung perbandingan untuk peran mana pun. Panel **Type roles** menampilkan spesimen langsung tiap peran dengan keluarga dan statusnya, seperti *Inter* atau *Inter · follows Primary*.

## Tokens

Token adalah nilai bernama di balik design system: warna, huruf, logo, sudut, dan jarak. Alat membacanya menurut nama, jadi perubahan di sini mencapai setiap alat sekaligus.

![Ruangan Tokens: kepala dengan contoh dari sistem dan aksi file, ubin yang menghitung tiap jenis token, lalu pasangan warna beserta pembacaan kontrasnya](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **Kepala** memberi contoh dari sistem Anda sendiri (*Primary is Spearmint, #033633*) dan aksi file: **Download** (seluruh sistem sebagai token desain, atau palet dalam lima format lain), **Copy CSS**, dan **Add from…** untuk membaca file JSON kembali.
- **Ubin** menghitung tiap jenis token dan melompat ke bagiannya: Colours, Type, Logos, Shape and spacing, More, dan All tokens. Mereka menghitung apa yang menjadi milik Anda, seperti Overview. Di ponsel ubin menggulir ke samping.
- **Colours** dimulai dengan pasangan yang disandingkan alat (teks pada surface, pada primary, muted pada surface) dengan pembacaan APCA dalam terang dan gelap, dan menandai **Weak contrast** bila pasangan kurang. Lalu setiap grup warna: ramp sebagai satu baris chip, warna lain dengan nilainya dan referensi yang dipakai alat, seperti `{color.brand.spearmint}`. Tekan referensi untuk menyalin referensinya. **Edit in Colours** membuka grup di ruangan Colours.
- **Type** dan **Logos** mencantumkan huruf untuk tiap peran dan tiap slot logo, dengan **Edit in Type** dan **Edit in Logos** setelah Anda memiliki milik sendiri.
- **Shape and spacing** memuat **Rounded corners** (`shape.radius`) dan **Spacing rhythm** (`space.base`). Masing-masing berbunyi *Lolly default* sampai Anda menggeser penggeser dan *Yours* sesudahnya, menyimpan seketika, dan dapat dibatalkan.
- **More tokens** menambahkan jarak, ukuran, lebar garis, opasitas, rotasi, angka biasa, dan bayangan, disimpan sebagai [token desain](/info/design-tokens.html) standar.
- **App appearance (advanced)** mencantumkan warna, ukuran, dan bayangan yang dipakai layar Lolly sendiri, dan **Inspect every token (advanced)** mencari dan menyunting nilai tersimpan mana pun, menampilkan setiap perubahan untuk ditinjau lebih dulu.

Bagian yang kosong menawarkan cara mengisi celahnya: **Pick a colour**, **Choose a face**, atau **Add a logo**.

## Files

Letakkan file yang disimpan brand Anda, selain logo: file **vector**, **image**, **audio**, dan **motion** (video, Lottie, dan animasi). Mereka muncul di [Assets](/info/using.html#assets-your-library), diurutkan ke dalam bagian dan siap di pemilih aset setiap alat, dan tetap di perangkat ini.

## Usage & rules

**Usage & rules** menjalankan pilihan brand Anda: apa yang boleh diubah orang, apa yang tetap, dan apa yang dapat diperiksa Lolly.

![Usage & rules pada Lolly Demo: kartu Brand rules yang kosong dengan Add your first rule, lalu Try your brand in use dengan contoh yang siap dirender](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dusage&width=1440&height=1200&dpi=192&waitMs=2400&cropSelector=%23start-panel-usage&format=svg&walker=1&dark=1&filename=bs-usage-rules)

**Brand rules** mencantumkan aturan Anda. **Add rule** (atau **Add your first rule**) membuka formulir singkat:

- **Rule name** dengan kata-kata Anda sendiri, seperti *Beacon accents*;
- **Check**: **Colour choices**, **Font choices**, **Fixed artwork**, atau **Text length**, dengan peran brand yang dipakainya, di bawah nama peran Anda sendiri;
- **Example** yang diterapinya (Poster, Title slide, Content slide, atau Chart), **Mode**, dan apakah **Required** atau **Advisory**;
- **Reviewed by**, lalu **Save draft** atau **Approve & save**.

Persetujuan mencatat keputusan Anda sendiri di perangkat ini. Aturan wajib yang disetujui membatasi poster yang dapat dipakai ulang, dan pemeriksaan hanya mencakup PNG contoh; tidak mengubah alat lain.

Aturan yang dibawa design system dalam file tokennya, seperti pasangan warna yang disetujui, bobot dan perataan teks, atau logo per permukaan, dicantumkan di sini sebagai **Checked in Design**. Design memeriksanya layer demi layer di kartu **Before you export** panel ekspor, dan `lolly check` melakukan hal yang sama untuk dokumen Design tersimpan ([Before you export](/info/design.html#before-you-export)). Aturan yang tidak memiliki pemeriksa di build ini dipertahankan sebagaimana disediakan dan ditandai **Unchecked**.

**Try your brand in use** merender empat contoh dari revisi saat ini dengan **Render & check examples**. Pilih **Brand mode** dan **Try your own text** untuk judul, teks pendukung, dan teks slide. Setiap contoh melaporkan apa yang diukur, dengan **See checks & sources** dan **Download check report**, dan **Make reusable poster** mengunduh `.lolly` yang tata letak tetap dan pilihan input yang disetujuinya ikut bersama file. Contoh bersifat lokal: tidak ada yang diterbitkan atau disetujui dengan menjalankan pemeriksaan.

Build yang dikirim dengan brand tetap menampilkan aturan dan contoh yang sama secara hanya-baca, di bawah *This brand is set*.

## Bawa brand masuk

**Add from…** di dasar rel membuka pemilih yang menanyakan apa yang Anda miliki, bukan format apa itu:

- **Design tokens or a design file**: JSON DTCG atau Tokens Studio, proyek Penpot, zip set token, paket design system Lolly, atau SVG.
- **PDF**: deck atau file panduan, dibaca di perangkat ini untuk warna, lambang, dan huruf yang disematkan.
- **Logo or screenshot**: gambar menjadi palet yang disarankan, dibaca di perangkat ini. Ia membaca warna, bukan huruf atau tata letak.
- **Saved web page**: satu file HTML dan file CSS-nya, atau HTML atau CSS yang ditempel, hingga 20 file dan 2 MB. Hanya teks yang Anda berikan yang dibaca: sumber daya yang ditautkan tidak diambil dan skrip tidak berjalan.
- **Font file**: TTF, OTF, atau WOFF. Membuka ruangan Type, tempat huruf dipasang.
- **Website**: satu halaman, dibaca untuk warna dan hurufnya. Ubin ini muncul hanya pada perangkat yang dapat membaca halaman, dan menyatakan pembaca mana yang dipakai: aplikasi di perangkat ini, atau ekstensi browser di tab latar belakang, login sebagai Anda. Menyebut URL hanya mengisi field; menekan fetch adalah persetujuannya.

Pilih sumber file desain dan kartu berikutnya mencantumkan format yang diterima sebagai ubin ikon, dengan seluruh kartu sebagai satu target lepas. Anda juga dapat meletakkan file langsung ke studio.

![Kartu impor - format yang diterima tampil sebagai ubin ikon, dan seluruh kartu adalah satu target drop](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

- **Paket design system Lolly** (`.lolly`, atau `.zip` lama) terpasang dalam satu langkah.
- Ekspor **Penpot** (`.penpot`) membawa token desainnya.
- File **Design Tokens** (W3C DTCG) atau **Tokens Studio** (`.json`) membawa tokennya.
- **SVG biasa** dipindai untuk warna yang Anda pilih, yang pertama menjadi primer Anda.

### Tinjau referensi

Logo, tangkapan layar, situs web, atau halaman tersimpan membuka **Try these colours**: contoh dalam warna yang diusulkan, **Main colour** yang dapat Anda ubah, dan nama untuk sistem baru. Kotak menjabarkan apa yang dilakukan penerapan: ia **menggantikan** pengaturan token aktif dengan palet yang dihasilkan dan gaya default, **mempertahankan** font dan file pustaka Anda, dan sistem sebelumnya dapat **dipulihkan**. **Apply suggested settings** menerapkan palet terang dan gelap, setelah checkpoint, dan **Restore brand settings** dapat mengembalikan pengaturan lama. **Change reference** memilih sumber lain.

**Palette, source details and individual choices** menampilkan apa yang dibaca, nama font yang ditemukan, dan kontras pratinjau. Nama font hanya saran; Type tetap tempat Anda memasang huruf. Detail sumber dapat mencakup tipografi, celah, padding, dan nilai sudut bila teramati, diberi label **Not observed** bila tidak. Halaman tersimpan atau pembacaan situs web native melaporkan gaya yang dideklarasikan, yang mungkin tidak dipakai halaman, dan ekstensi browser dapat melaporkan gaya terukur dari sampel elemen yang terlihat. Ini adalah pengamatan: tidak ada yang dipasang, dan jarak sumber tidak pernah menggantikan jarak Anda sendiri. **Choose individual items in the tray** mempertahankan item tunggal, dan **Download design context** menyimpan laporan JSON berisi pengamatan, token yang diusulkan, dan informasi sumber (dengan SHA-256 dari HTML atau CSS yang diberikan). Laporan tidak memuat teks halaman mentah dan bukan Content Credential bertanda tangan.

Impor PDF dan file desain mempertahankan kontrol tinjauannya sendiri. Item di **Tray** tidak mengubah apa pun sampai Anda menambahkannya di ruangan yang memiliki jenis materi itu. `#/start?source=<kind>` membuka pemilih pada suatu sumber (`file`, `pdf`, `image`, `font`, `url`, `page`), dan `?import` membuka daftar polos.

### Temukan dan bandingkan tampilan

Buka **Find a look** dari Overview atau dari daftar design system di Settings. Jelajahi sistem yang tersimpan di perangkat ini dan beberapa contoh Lolly yang dapat dipakai ulang, dan cari menurut nama, tag warna, atau font yang dideklarasikan. **Closest to my current palette** mengurutkan menurut kemiripan warna terukur, dengan font yang cocok sebagai penentu seri; ini bukan skor kualitas.

Pilih satu tampilan untuk meninjaunya, atau dua untuk membandingkan berdampingan. Memilih tidak mengubah apa pun. **Use this saved system** beralih ke sana, dan **Use these colours** menerapkan warna contoh melalui checkpoint biasa, mempertahankan font Anda. **Restore brand settings** memulihkan tampilan sebelumnya. Sistem tersimpan memiliki **Search tags** yang dapat disunting di bawah **Details and design context**. Contohnya adalah resep warna asli Lolly, tanpa koleksi hasil scraping dan tanpa akun.

![Bandingkan Sunroom dan Orchard berdampingan sebelum menerapkan salah satu sistem warna.](/t/url-shot?url=%2F%23%2Fstart&width=1280&height=900&dpi=96&waitMs=3000&format=svg&filename=brand-compare-looks&try=1&drive=click%3A%5Bdata-ds-door%3D%22looks%22%5D%3Bwait%3A500%3Bclick%3A%5Bdata-look-select%3D%22example%3Asunroom%22%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Aorchard%22%5D%3Bclick%3A%5Bdata-looks-review%5D%3Bwait%3A500&cropSelector=.ds-looks-comparison&waitSelector=%5Bdata-ds-door%3D%22looks%22%5D&walker=1&rasterDpi=96)

## Simpan dan pindahkan design system Anda

### Pindahkan brand antar perangkat

**Export** menulis satu file **`LollyBrand-….lolly`**: token, font, logo, dan preferensi tema Anda, dengan manifes integritas yang diperiksa saat dimasukkan kembali. Rilis web sebelum 1.0.7 menamai file yang sama `.zip`, dan ejaan itu masih diterima. **Tokens (.json)** menulis dokumen token desain polos sendiri, tanpa font atau logo, untuk repositori, langkah build, atau alat token lain.

Untuk memasukkannya kembali, gunakan **Add from… → Design tokens or a design file**, atau letakkan file di studio. Begitulah rekan menyerahkan brand kepada Anda, atau Anda membawanya ke instalasi kedua, tanpa akun dan tanpa cloud. Untuk memasukkan brand dari baris perintah, lihat [`ingest:brand`](/info/configuration.html#brand-packs).

**Fonts for Linux (.rpm)** mengemas font yang Anda tambahkan ke RPM yang dapat dipasang. Jika Anda sendiri yang mengunggah sebagian, Lolly meminta Anda mengonfirmasi bahwa Anda boleh mendistribusikannya lebih dulu.

### Pulihkan pengaturan sebelumnya

Pilih **Restore brand settings**, pilih checkpoint bertanggal, dan tekan **Restore**. Ia memulihkan warna, pengaturan huruf, dan token lain untuk brand aktif; file font dan gambar tetap seperti adanya. Lolly menyimpan pengaturan Anda saat ini sebagai **Before restore** lebih dulu, sehingga Anda dapat membalik pemulihan bahkan setelah menutup browser. 20 checkpoint terbaru disimpan di perangkat ini.

### Versions

Versi terbit adalah **salinan bernama yang permanen** yang disimpan di perangkat ini. Ia tidak pernah berubah, jadi alat atau tautan yang menyematkannya (dengan `designv`) terus menggambar hal yang sama. Sistem yang memiliki sesuatu milik Anda menampilkan tautan **Versions & publishing** yang tenang di dasar rel; setelah terbitan pertama Anda ia menjadi entri **Versions**. `#/start?area=versions` membukanya langsung.

- **Versi bersifat permanen.** Belum ada penghapusan, dan panel menyatakannya.
- **Penghapusan memimpin kartu kompatibilitas**, karena token yang dihapus adalah yang merusak alat.
- **Menerbitkan tidak dapat dibatalkan; memulihkan bisa.** *Restore latest from this version* adalah suntingan biasa, dengan **Undo** ditawarkan seketika.

**Publish only** menyimpan versi tanpa mengubah apa yang diikuti alat; **Publish and make active** membuat alat dan aplikasi mengikuti versi itu. **Follow the latest again** membuat setiap suntingan langsung aktif begitu Anda membuatnya.

## Kelola design system Anda

Buka **Settings → Preferences → Design systems** untuk beralih, menambah, atau menghapus sistem. **Open** memilih sistem dan membukanya di sini; **Make a new one** membuat sistem lokal dan membukanya dengan field namanya siap. Satu sistem aktif pada satu waktu, untuk seluruh perangkat. [Brand architectures](/info/brand-architectures.html) membantu memutuskan kapan brand memerlukan design system sendiri.

**Dari mana sistem berasal.** Sistem yang disediakan katalog deployment berbunyi **Came with this app**, atau **From this instance** di aplikasi yang terhubung ke instans. Bentangkan **Catalogue source** untuk melihat siapa yang menyediakannya, aset token dan namespace-nya, serta versi atau checksum yang diketahui; bila penyegaran gagal, materi yang di-cache diberi label.

**Sistem terkelola bersifat hanya-baca.** Sistem berbunyi **Managed by this instance** (atau **Managed by this app** di aplikasi desktop tanpa instans) bila katalognya mengunci sistem itu. Anda dapat memakai dan mengunduhnya, dan membukanya di sini menampilkan catatan hanya-baca dengan **Make an editable copy** dan **Switch**. Sistem lokal milik Anda sendiri tetap dapat disunting, bahkan bila yang terkelola datang lebih dulu. Build dengan satu brand tetap membuka Design System Setup pada *This brand is set*, dengan token dan aturan penggunaan brand untuk dibaca.

**Setiap sistem lain yang disediakan adalah milik Anda** untuk disembunyikan, disunting, dan direset, termasuk Lolly Demo dan Lolly Starter di lolly.tools. Menyunting satu mempertahankan namanya dan menandai barisnya **Edited here**, dan **Reset to original** di menunya membuang perubahan yang dibuat di perangkat ini. Starter kosong adalah pengecualian: perubahan pertama di sana memulai design system milik Anda sendiri, jadi Lolly menanyakan sekali apa nama sistem baru itu. [Lolly Demo in use](/info/lolly-demo-in-use.html#switch-to-your-own) menunjukkan apa yang digantikan sistem Anda sendiri.

### Menghapus design system

Pilih **Remove** dari menu sistem; konfirmasi menyatakan sistem mana yang akan aktif sesudahnya. Sesi tersimpan, unggahan, dan materi yang dibagi dengan sistem lain tetap ada.

Menghapus sistem yang disediakan hanya menyembunyikannya: aset katalognya tetap, **Bring back** menampilkannya lagi, dan ia kembali sendiri bila Anda menghapus semua yang lain. Menghapus salinan yang diimpor atau disunting tidak menghapus sistem yang disediakan, logo, atau fontnya, dan bila salinan itu aktif, sistem yang disediakan menjadi aktif kembali. Menghapus salinan hosted yang aktif hanya membersihkan koneksi salinan itu; instans yang dipilih secara terpisah tetap terpilih.

Mengubah apa yang disediakan server adalah tugas administrator: operatornya mengubah katalog sumber dan men-deploy ulang, atau administrator Lolly Work meninjau dan menerapkan perubahan server. Suntingan di sini tetap lokal. Lihat [Removing a catalogue design system](/info/configuration.html#removing-a-catalogue-design-system) dan [Configuration](/info/configuration.html#supplied-and-local-design-systems).

## Pakai konteks desain di luar aplikasi

**Download design context** menyimpan dokumen token, warna yang diselesaikan, keluarga font yang dideklarasikan, id aset, bukti sumber bila dicatat, cakupan, dan aturan eksplisit, tanpa file font dan tanpa bukti kepemilikan. Baris perintah membaca file tanpa server: `lolly system import` menjadikannya design system terminal dan `lolly system check` memeriksa input Design terhadap konteks tersimpan. [Bring your design system](/info/cli.html#bring-your-design-system) membahas impor dan [Which design system a command uses](/info/cli-decks.html#which-design-system-a-command-uses) membahas pemeriksaan, dan klien MCP membaca ringkasan yang sama dari `lolly://design-context` ([MCP Server](/info/mcp.html)).

## Ke mana selanjutnya

- **[Using Lolly](/info/using.html)**: alat, penyimpanan, berbagi, dan Assets.
- **[Brand architectures](/info/brand-architectures.html)**: bagaimana divisi, produk, brand yang didukung, klien, dan musim dipetakan ke design system, colourway, dan identitas logo.
- **[Design Tokens](/info/design-tokens.html)**: model token tempat brand Anda ditulis.
- **[Export a file](/info/exporting.html)**: satuan cetak, CMYK, dan format tempat brand Anda dirender.
