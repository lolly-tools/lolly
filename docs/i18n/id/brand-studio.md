# Brand Studio

**Brand Studio** di `#/start` adalah satu-satunya tempat Anda membentuk brand Anda - logonya, warnanya, tipenya, sisa token Anda dan file yang disimpannya. Aturlah di sini sekali dan setiap tool, halaman dan ekspor mengikutinya *secara konstruksi*, bukan lewat peninjauan.

Perubahan dipratinjau **secara langsung di seluruh aplikasi** saat Anda membuatnya, sehingga Anda bisa melihat warna atau font muncul di mana-mana sebelum Anda mengonfirmasinya. Semuanya on-device: file dan token brand Anda tidak pernah meninggalkan perangkat Anda (memilih Google Font mengambil satu family itu dari Google, sekali, setelah dialog persetujuan), dan brand berpindah dalam satu file [brand pack](#move-a-brand-between-devices).

> **Ini editornya. Dashboard adalah cerminnya.** Tab **Design system** pada Dashboard (`#/d`) *menampilkan* brand Anda dalam mode baca saja; Anda *mengeditnya* di sini di `#/start`. Jika ingin mengubah warna nanti, kembalilah ke Brand Studio.

## Ruang-ruangnya

Studio ini adalah sekumpulan **ruang** yang terdaftar di rel samping - bukan langkah-langkah. Tidak ada yang bernomor, tidak ada yang terkunci pada yang lain, dan tiba di ruang mana pun sah-sah saja:

- **Overview** - pusatnya. Apa yang sudah ada saat ini, sekilas pandang, dengan pintu ke setiap ruang.
- **Colours** - tambahkan warna satu per satu, tetapkan peran atau hasilkan seluruh palet dari satu warna.
- **Type** - empat typeface yang dibaca aplikasi, tool Anda dan setiap ekspor.
- **Logos** - mark Anda, dalam setiap orientasi dan treatment.
- **Tokens** - radius sudut, spacing, shadow dan sisa sistemnya.
- **Files** - file gambar, audio dan motion yang disimpan brand Anda.

Di ponsel, daftar yang sama menjadi strip chip horizontal yang disematkan di bawah header. Berpindah ruang tidak pernah memuat ulang apa pun - editor tetap memasang semua panelnya dan hanya menampilkan yang Anda minta.

**Deep-link ke sebuah ruang** dengan `#/start?area=<key>`. Key-nya adalah `overview`, `color` *(perhatikan ejaan AS di URL)*, `type`, `logos`, `tokens`, `catalogue` (ruang Files - key panel ini adalah kontrak permanen, sehingga URL mempertahankan nama lamanya) dan `versions`. `?tab=` adalah alias lama untuk hal yang sama dan masih berfungsi, sehingga tautan dan bookmark lama tetap bekerja; apa pun yang tidak dikenali akan membuka Overview alih-alih buntu.

Disematkan di **kaki rel** adalah aksi-aksi yang menjadi milik keseluruhan sistem desain, bukan milik satu ruang:

- **Add from…** - pemilih sumber, untuk membawa masuk brand dari file, PDF, gambar, font atau situs web. Lihat [Bring a brand in](#bring-a-brand-in) di bawah.
- **Tray** - kandidat yang ditemukan pemindaian tapi belum dikomit. Tetap tersembunyi sampai pemindaian benar-benar menyimpan sesuatu, dan membawa hitungan saat itu terjadi; tidak ada apa pun di dalamnya yang mengubah brand Anda sampai Anda menekan Add pada baris tersebut.
- **Export** - menulis seluruh brand sebagai satu `LollyBrand-…zip`.
- **Tokens (.json)** - dokumen design-tokens polos secara terpisah, untuk repo, langkah build atau tool token lain.
- **Versions** - publikasikan, aktifkan dan pulihkan salinan bernama dari sistem desain. Tersembunyi sampai ada sesuatu milik Anda sendiri untuk dipublikasikan (atau tautan `?area=versions` memintanya dengan nama).

![Rel ruang studio - Overview, Colours, Type, Logos, Tokens dan Files](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-rail&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

## Overview

Overview adalah ruang tempat Anda mendarat, dan punya dua wajah.

Dengan **belum ada apa pun yang disiapkan** ia menawarkan dua pintu - **Start from a file** (design tokens, proyek Penpot, paket sistem desain atau SVG) dan **Start from scratch** (tambahkan satu warna, lalu lanjutkan kapan pun Anda mau) - dan jalan keluar diam-diam **Explore the tools** di bawahnya, karena pergi juga jawaban yang sah.

Setelah sistem desain ada, ruang yang sama menampilkan **apa yang Anda miliki**: palet dan jumlah warnanya, family type yang berlaku, berapa banyak slot logo terisi, berapa banyak token yang ada dan ruang Files. Setiap blok adalah pintu ke ruangnya. Ada hitungan di sini, tidak pernah ada progress bar dan tidak pernah ada kartu selesai - tidak ada apa pun di studio ini yang berutang.

## Logos

Mulailah dengan mengosongkan folder mark Anda ke drop zone di bagian atas: **"Drop marks here, or choose several at once"** menerima sebanyak apa pun file yang Anda miliki sekaligus. Setiap file dibaca untuk bentuk dan tintanya, lalu diantrekan di bawah **Waiting for a slot** sebagai chip yang menyatakan dugaannya - *"Looks like the Horizontal primary"*, dengan pengukuran yang mendasarinya, dan tombol **Place** (**Replace**, jika slot itu sudah terisi). Jika tidak yakin, chip menyatakannya dengan jelas dan menawarkan **Change slot** yang mendaftar kedelapannya. Tidak ada yang ditempatkan sampai Anda menekan sesuatu.

Dua hal terjadi di sekitar antrean itu. Mark dengan margin kosong berlebih mendapat **tawaran trim** terlebih dahulu - jawab atau tekan Escape dan file asli masuk apa adanya. Dan jika sebuah mark dapat mengisi slot sibling yang kosong, ruang ini menawarkan versi turunan **mono** atau **reverse** sebagai chip tersendiri, ditandai *Generated*, yang akan hilang lagi jika Anda mengisi slot itu dengan cara lain.

Di bawahnya ada grid tempat setiap mark akhirnya berada - slot **orientasi × treatment**:

- **Orientations:** Horizontal (wordmark + simbol dalam satu baris) dan Vertical (bertumpuk, untuk ruang persegi dan tinggi).
- **Treatments:** Primary, Primary reverse (untuk latar belakang gelap), Mono (satu warna) dan Mono reverse.

Itu delapan slot opsional. Klik sebuah slot untuk menambahkan PNG, SVG, JPEG atau WebP; klik slot yang terisi untuk menggantinya. Setiap slot bersifat opsional dan semuanya tetap berada di perangkat ini.

![Matriks logo - setiap orientasi di bagian atas, setiap treatment sebagai slot bergarisnya sendiri, semuanya opsional](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&width=1440&height=1600&dpi=192&waitMs=1600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Custom marks** - tambahkan mark yang brand Anda beri nama sendiri (ikon, lambang, favicon) di bawah **Custom marks**; beri nama dan pilih file.
- **More identities** - sebuah sub-brand, produk atau event dapat memiliki set logo lengkapnya sendiri. Gunakan **+ Add another logo** dan beri nama; set utama Anda cukup disebut "Your logo".
- **Upload an SVG and Lolly reads its colours.** Pada instalasi baru, secara diam-diam ia mengatur warna primer Anda dari logo dan menyatakannya. Pada brand yang sudah ada, ia menawarkan warna itu sebagai saran - *"Found in the logo: #…"* dengan tombol **Use as primary** di sampingnya - di ruang Colours, tempat Anda dapat menerimanya atau mengabaikannya.

## Colours

![The Colours room after one colour - the two panes back, the generate offer, roles reading in three registers and the pane at one colour](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

Ruang paling kaya, dalam dua panel. Yang kiri tempat Anda bekerja; yang kanan adalah **palet langsung** Anda. Seret pembatas di antara keduanya untuk mengubah ukuran (Enter di atasnya melipat palet menyingkir).

![Ruang Colours - warna primer menurunkan ramp, kartu spesimen dengan rasio kontras dan palet langsung](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

### Tambahkan warna, lalu beri tugas

**Add a colour** adalah keseluruhan jalur sederhana: tempel atau pilih warna dalam notasi apa pun dan ia menjadi tepat satu token. Tidak ada yang diturunkan darinya, tidak ada yang disarankan ke dalamnya, tidak ada lagi yang dituntut. Tempel seluruh *daftar* warna dan masing-masing menjadi chip yang bisa Anda tambahkan sendiri-sendiri.

**Roles** adalah lapisan di atasnya - warna mana yang memainkan peran apa. Roles bersifat opsional (sistem desain dengan tiga warna lepas tanpa peran adalah sistem yang sepenuhnya sah), swatch mana pun dapat mengambil satu peran dan pembacaan kontras diukur terhadap permukaan, APCA lebih dulu.

### Sayap ahli

Empat bagian terlipat berada di bawah keduanya itu. Buka yang Anda inginkan; masing-masing dapat di-deep-link sebagai `#/start?area=color&focus=<wing>`:

- **Generate a starter palette** (`focus=generate`) - satu warna menjadi satu set lengkap shade. Dijelaskan di bawah.
- **Shade curves** (`focus=curves`) - bentuk ulang ramp titik demi titik. Lightness, chroma dan hue masing-masing punya kurvanya sendiri, dipilih dengan L / C / H, dan shade di bawahnya dipanggang ulang secara langsung saat Anda menyeret.
- **Contrast** (`focus=contrast`) - **Contrast-lock** menata ulang ramp untuk mencapai target APCA terhadap latar belakang yang Anda pilih, setiap langkah mempertahankan hue dan chroma-nya sendiri; **Rotate hue** memutar seluruh ramp secara utuh mengelilingi roda warna, setiap shade mempertahankan lightness dan chroma-nya.
- **Print** (`focus=print`) - apa yang menjadi primer di percetakan: nilai layar otomatisnya, atau build CMYK yang dipatok atau tinta spot bernama sebagai gantinya.

### Satu warna, satu palet lengkap

Di dalam **Generate a starter palette**, pilih **Primary colour** dan Lolly menyusun palet lengkap - permukaan terang dan gelap, teks, aksen dan ramp tint/shade penuh - menggunakan matematika warna perseptual yang sama (OKLCH) yang digunakan engine di mana-mana. Sesuaikan penurunannya:

- **Scheme** - Mono, Complement, Analogous atau Triad - menentukan bagaimana warna sekunder berhubungan dengan warna primer Anda.
- **Shades** - slider dari 3 hingga 20 (default 5) mengatur berapa banyak langkah yang dihasilkan setiap ramp.
- **Fine-tune** (terlipat) - **UI intensity** (Muted / Deep), **Contrast** (Comfort / High) dan **Text on brand** (Auto / Light / Dark).

Tidak ada apa pun di sayap ini yang menulis apa pun ke brand Anda. Ini pratinjau, langsung di seluruh aplikasi sehingga Anda bisa menilainya, sampai Anda menekan **Replace palette** (di bawah).

Di bawah warna primer Anda akan melihat ramp **Primary / Neutral / Secondary / Blend** langsung serta kartu spesimen Light dan Dark, masing-masing membawa pembacaan kontrasnya sendiri - rasio WCAG dengan angka APCA `Lc` di sampingnya. **Klik sebuah langkah pada ramp Neutral atau Secondary** untuk menjangkarkan shade itu sebagai pengganti default turunan.

![Empat ramp bertumpuk di atas kartu spesimen terang dan gelap, masing-masing kartu membawa rasio kontras WCAG-nya sendiri](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

### Bangun palet Anda (generator harmoni)

Masih di sayap yang sama, **Build your palette** menghasilkan warna aksen yang cocok dari warna primer Anda. Pilih **Harmony** - **Complementary**, **Adjacent**, **Triad**, **Tetrad** atau **Analogous** (yang membawa jumlah **Accents** sendiri, 2 hingga 5, dan **Angle** hue dari 10° hingga 45°) - dan setiap kandidat hadir dengan nama yang mudah dibaca yang dibuat otomatis serta tombol **+ Add**. Menambahkan satu langsung memasukkan warna itu ke palet Anda, satu tekan untuk satu token. *"Your palette, applied"* menampilkan pratinjau seluruh set pada grafik nyata.

![Aksen yang dihasilkan, masing-masing dengan swatch, nama yang dibuat otomatis, kode hex-nya, dan tombol Add](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### Menerapkan palet yang dihasilkan

**Replace palette** adalah satu-satunya kontrol di sayap ini yang benar-benar menulis sesuatu, dan itu tidak pernah langsung menulis. Tekan tombol itu dan kartu tinjauan terbuka lebih dulu, berjudul **"Replace the palette?"**, merinci persis apa yang akan terjadi: berapa banyak peran yang tetap seperti yang Anda tetapkan, berapa banyak warna yang Anda tambahkan sendiri dipertahankan, berapa banyak kurva bayangan yang diikat ulang, berapa banyak kunci cetak yang dipasang ulang, berapa banyak bayangan tersembunyi yang tetap tersembunyi, berapa banyak stop gradien yang mempertahankan warnanya.

**Replace palette** pada kartu itu menerapkannya; **Cancel** membatalkan tanpa mengubah apa pun. Setelah berjalan, kartu itu berubah menjadi **"Palette replaced."** dengan satu tombol **Undo** yang sudah difokuskan - dan checkpoint dari seluruh sistem desain diambil *sebelum* pertukaran, sehingga "mengembalikannya seperti semula" adalah pemulihan, bukan sore hari yang hilang.

### Palet, bagan, dan setiap swatch

Panel kanan mencantumkan setiap warna yang dimiliki brand Anda, dikelompokkan (Primary, Neutral, Secondary, Spectrum, Custom, Roles), setiap kelompok dapat dilipat dengan **+ Add** miliknya sendiri. Di bawahnya, **Colour chart** terbuka pada dua tampilan dari swatch yang sama: **Wheel** (roda OKLCH - seret titik untuk mengubah warnanya, klik titik untuk mengeditnya atau klik ruang kosong untuk menjatuhkan swatch baru) dan bagan **Gamut**, yang menunjukkan di mana rentang yang dapat ditampilkan sebenarnya berakhir. `#/start?area=color&focus=chart` membuka kartu itu secara langsung, seperti yang selalu dilakukan `?wheel`.

![Panel palet, setiap kelompok dapat dilipat, dengan pil unduh terparkir di tepi bawahnya](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A500%3Bclick%3A%5Bdata-be-generate-cta-go%5D%3Bwait%3A900%3Bclick%3A%5Bdata-be-replace-palette%5D%3Bwait%3A800%3Bclick%3A%5Bdata-be-review-go%5D%3Bwait%3A1400&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![Roda OKLCH - sudut adalah hue, jarak keluar adalah chroma, dan abu-abu berjalan di sepanjang rel lightness di sisinya](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A500%3Bclick%3A%5Bdata-be-generate-cta-go%5D%3Bwait%3A900%3Bclick%3A%5Bdata-be-replace-palette%5D%3Bwait%3A800%3Bclick%3A%5Bdata-be-review-go%5D%3Bwait%3A1400%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

Klik swatch mana pun untuk membuka editornya:

- **Rename** untuk mengganti namanya.
- **Set the colour** - picker terbuka pada slider **OKLCH** perseptual, dengan mode untuk **Hex**, **HSL**, **RGB** dan **CMYK**; kolom nilai membaca *dan* menulis di ruang mana pun yang sedang aktif, sehingga Anda dapat menempelkan hex atau mengetik persentase tinta. Perhatikan bahwa memasukkan CMYK menetapkan warna *layar* melalui konversi - untuk mengunci tinta yang tepat, gunakan kunci cetak di bawah.
- **Stored as** - pilih bagaimana swatch disimpan: **LCH** (bawaan - perseptual, gamut lebar, pilihan terbaik untuk mengedit), Hex, RGB atau HSL. Timpa ini saat Anda perlu mengunci hex lawas yang tepat atau mencocokkan nilai sRGB.
- **Use as** - berikan swatch ini salah satu peran brand secara langsung, tanpa kembali ke panel Roles. (Ubin peran itu sendiri tidak menawarkannya - sebuah peran tidak bisa mengambil peran.)
- **Print substitutes** (dilipat) - kunci perilaku cetak warna:
  - **CMYK** - alihkan dari **Auto** ke **Locked** untuk mengganti konversi sRGB→CMYK otomatis dengan nilai tinta yang tepat (C/M/Y/K, 0–100).
  - **Spot colour** - alihkan dari **None** ke **Set** untuk mengunci swatch ke warna spot; beri **Name** (mis. `PANTONE 186 C`), **Book** opsional dan **Finish** opsional (Ordinary ink secara bawaan) untuk saat tintanya bukan tinta sama sekali - foil, emboss atau deboss, spot varnish, soft touch, atau die cut, crease atau perforation.
- **In other spaces** (dilipat) - ide yang sama diperluas: setiap baris adalah ruang tempat swatch ini dapat diekspresikan, baik diturunkan dari nilai kanonis maupun dibuat sendiri oleh Anda, dan yang dibuat sendiri menang saat ekspor.

Kunci cetak ini adalah yang digunakan mesin cetak saat Anda mengekspor PDF atau TIFF CMYK - lihat [Mengekspor](/info/exporting.html#colour-profiles).

**Deleting a swatch** aman: langkah ramp turunan dan peran tema *disembunyikan* (token yang mendasarinya tetap teresolusi, sehingga tidak ada yang rusak di hilir), sementara warna yang Anda tambahkan sendiri dihapus sepenuhnya.

### Gradien

Panel opsional **Gradients** membangun token blend dari palet Anda untuk latar belakang dan aksen. Lewati sepenuhnya jika brand Anda tidak menggunakan gradien. Setiap gradien memiliki pratinjau, stop bernama (2–8) dan sudut. Perilaku kuncinya: **sebuah stop mereferensikan swatch**, jadi ubah warna swatch itu dan gradien akan mengikuti. Interpolasi berjalan dalam OKLCH untuk blend yang bersih. Hapus stop untuk memangkas rangkaiannya.

### Bawa palet ke tempat lain

Pil mengambang yang terparkir di tepi bawah panel palet mengunduh seluruh palet sebagai **Design tokens (JSON)**, **CSS variables**, **CSS classes**, **SCSS variables**, **GIMP palette (.gpl)** atau **Adobe Swatch Exchange (.ase)** - sehingga brand langsung masuk ke Illustrator, Figma, GIMP atau stylesheet. Pil ini berada di luar area scroll panel, sehingga tetap di tempatnya sejauh apa pun palet digulir. (Anda juga dapat mengunduh palet dari tampilan [Catalogue](/info/using.html).)

## Type

![The compare stage open under its card, with the search row, the pinned families and the cards folded to a one-line strip](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

Ruang ini dibuka dengan **empat kartu peran** - empat wajah yang benar-benar dibaca oleh aplikasi, tools Anda, dan setiap ekspor. Setiap kartu menunjukkan apa yang saat ini melayani peran itu, disetel dalam wajah tersebut, dengan satu baris teks nyata di bawahnya:

- **Primary** - teks isi, tombol, dan setiap tool.
- **Headings** - wajah tampilan untuk `h1`/`h2`.
- **Code** - wajah monospace untuk kode dan data.
- **Italic** - pendamping italic sejati untuk penekanan, kutipan, dan sisipan.

Headings, code, dan italic masing-masing kembali ke primary sampai Anda menetapkannya, sehingga brand dengan satu font tidak memerlukan keputusan apa pun di sini. Tidak ada yang di kartu langsung menerapkan apa pun: **Change** (atau **Choose a face** pada peran yang kosong) membuka **compare stage** yang dibatasi pada peran itu.

![Ruang Type - kartu peran dan spesimen langsung dari setiap wajah yang menjalankan tugasnya](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

### Compare stage

Stage ini terbuka **inline di dalam ruang**, bukan dalam dialog, sehingga kartu tempat Anda datang tetap ada di layar. Cari keluarga Google Fonts (Inter, Fraunces, Space Grotesk…) atau jatuhkan file font, tekan **Add to the comparison** dan kandidat berdiri berdampingan dalam kata-kata yang sama sebelum salah satu di antaranya terpasang. Escape membatalkan dan mengembalikan keyboard ke kartu tempat Anda membukanya.

Itulah satu-satunya pintu masuk, itulah sebabnya tidak ada apa pun yang masuk ke brand Anda tanpa terlihat. Di bawah stage terdapat dua panel manajemen:

- **Fonts on this device** - setiap keluarga yang terpasang, peran yang dilayaninya, dan tombol hapus. **Add a face** di sini membuka compare stage yang sama tanpa batasan.
- **Your fonts** - unggah **TTF**, **OTF** atau **WOFF** dari mesin Anda sendiri. Itulah jalur untuk typeface korporat berlisensi yang sudah Anda miliki.

Bagaimanapun caranya, wajah font ini tetap di perangkat ini, dirender di aplikasi, di tools Anda dan di setiap ekspor, offline selamanya, dan ikut dalam brand pack Anda - tidak ada yang diambil saat waktu render. Semua yang ada di Google Fonts dirilis di bawah lisensi terbuka (OFL/Apache/UFL).

Panel **Type roles** di bagian bawah menampilkan spesimen langsung dari setiap peran - body dan UI dalam primary, wajah tampilan opsional untuk heading teratas, italic untuk penekanan, mono untuk kode dan data - sehingga Anda dapat melihat seluruh set bekerja bersama.

![Spesimen Type roles - heading, body, italic dan code, masing-masing disetel dalam wajah yang menjadi resolusi peran tersebut, dengan nama wajah di sampingnya](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

## Tokens

Sisa dari sistem desain, dapat diedit tanpa menyentuh kode:

![Ruang Tokens - slider corner-radius ditambah spacing, sizing, shadows, dan sisa sistem lainnya](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **Rounded corners** - satu slider radius (0–1.5rem) yang diikuti oleh kartu, tombol, dan panel di seluruh aplikasi.
- **More tokens** - tambah dan edit **spacing**, **sizing**, **stroke width**, **opacity**, **rotation**, **numbers** biasa, dan **shadows**. Pilih jenisnya, beri nama (*Gutter, Card shadow…*) dan atur nilainya. Ini disimpan sebagai [design tokens](/info/design-tokens.html) (DTCG) standar dan ikut bersama brand Anda.

## Files

Jatuhkan file yang disimpan brand Anda - selain logo - di sini: aset **vector**, **image**, **audio**, dan **motion** (video, Lottie, animasi). File-file ini masuk ke [Catalogue](/info/using.html) Anda, disortir ke dalam bagian-bagian dan siap di asset picker setiap tool. Semuanya tetap di perangkat ini. (Rail memberi label ruang ini **Files**; kunci URL tetap `catalogue`, karena kunci panel adalah kontrak permanen.)

## Bawa brand masuk

**Add from…** di bagian bawah rail membuka picker dua tahap. Tahap pertama menanyakan apa yang Anda *miliki*, bukan format apa itu:

- **Design tokens or a design file** - JSON DTCG atau Tokens Studio, proyek Penpot, **zip berisi set token**, paket sistem desain Lolly, atau SVG.
- **PDF** - deck atau file pedoman, dibaca di perangkat ini untuk warna, tanda, dan typeface yang tertanam di dalamnya.
- **Image** - tangkapan layar atau foto; warnanya dibaca di perangkat ini dan tidak ada yang diunggah.
- **Font file** - TTF, OTF atau WOFF. Membuka ruang Type, tempat wajah font terpasang.
- **Website** - satu halaman, dibaca untuk warna dan tipenya. Ubin ini hanya muncul di perangkat yang benar-benar dapat membaca halaman, karena ubin yang dinonaktifkan yang mengiklankan sesuatu yang tidak dapat ditekan siapa pun lebih buruk daripada tidak ada ubin sama sekali. Di tempat ubin ini muncul, ia menyebutkan pembacanya dengan jelas: diambil oleh aplikasi di perangkat ini, atau dibaca melalui ekstensi browser di tab latar belakang, masuk sebagai Anda. Menyebutkan URL hanya *mengisi terlebih dahulu* kolomnya - tombol fetch adalah persetujuannya, sehingga tautan yang dikirimkan seseorang tidak akan pernah bisa memulai pembacaan.

Pilih sumber design-file dan tahap kedua adalah kartu di bawah ini: format yang diterima tampil sebagai ubin ikon dalam urutan preferensi, dan seluruh kartu adalah satu target drop - klik di mana saja pada kartu atau seret file ke atasnya. Anda juga dapat menjatuhkan file langsung ke studio.

![Kartu impor - format yang diterima tampil sebagai ubin ikon, dan seluruh kartu adalah satu target drop](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

Apa yang diberikan setiap design file kepada Anda:

- paket **LollyBrand** (`.zip`) - terpasang dalam satu langkah;
- ekspor **Penpot** (`.penpot`) - menarik design token-nya;
- file **Design Tokens** (`.json`) - W3C DTCG;
- file **Tokens Studio** (`.json`) - Tokens Studio;
- **SVG polos** (`.svg`) - Lolly memindai warnanya dan membiarkan Anda memilih mana yang disimpan, yang pertama menjadi warna primary Anda.

Instalasi dari sumber mengambil **checkpoint terlebih dahulu**, sehingga "kembalikan ke sebelum impor" adalah satu kali pemulihan. Dan apa yang ditemukan pemindaian tidak langsung masuk: kandidat masuk ke **Tray**, tempat masing-masing ditambahkan dengan tekanannya sendiri, melalui ruang yang memiliki jenis materi tersebut.

`#/start?source=<kind>` membuka picker pada sumber tertentu (`file`, `pdf`, `image`, `font`, `url`), dan `?import` membukanya pada daftar polos.

## Memindahkan brand antar perangkat

**Export** di bagian bawah rail menulis satu **`LollyBrand-…zip`** - token, font, logo, dan preferensi tema Anda, dengan manifest integritas yang diverifikasi saat kembali diimpor. Di sampingnya, **Tokens (.json)** menulis dokumen design-tokens polos sendirian: tanpa font, tanpa logo, hanya token, yang justru dibaca oleh repo, langkah CI, atau tool token lain.

Membawanya kembali adalah **Add from… → Design tokens or a design file** (di atas), atau drag-and-drop ke studio. Beginilah cara seorang kolega menyerahkan brand kepada Anda, atau cara Anda membawanya ke instalasi kedua - tanpa akun, tanpa cloud. Untuk membawa masuk brand dari command line, lihat [`ingest:brand`](/info/configuration.html#brand-packs).

## Versi

**Versions** di kaki rail adalah tempat sebuah design system berhenti menjadi target yang bergerak. Publikasikan satu dan Anda mendapatkan **salinan permanen bernama** yang disimpan di perangkat ini: ia tidak pernah berubah setelahnya, jadi sebuah alat yang menyematkannya akan terus menggambar hal yang sama. Panel ini tetap tersembunyi sampai ada sesuatu milik Anda sendiri untuk dipublikasikan, jadi sebuah studio yang tidak pernah mempublikasikan tidak akan pernah melihat kontrol-kontrol ini.

Tiga hal yang perlu diketahui sebelum Anda menekan apa pun, dan panel ini menyatakan ketiganya sebelum penekanan, bukan sesudahnya:

- **Sebuah versi bersifat permanen.** Belum ada fitur hapus, jadi panel menyatakan apa yang telah disimpan dan bahwa itu tetap tersimpan, bukan menawarkan tombol yang berbohong.
- **Penghapusan memimpin kartu kompatibilitas.** Token yang ditambahkan dan diubah adalah berita; sebuah token yang *dihapus* adalah hal yang merusak sebuah alat, jadi ia disebutkan pertama dan disebut apa adanya.
- **Publikasi tidak bisa dibatalkan; restore bisa.** *Restore latest from this version* adalah edit biasa pada head, jadi ia masuk ke undo stack studio dan panel langsung menawarkan Anda **Undo**.

Anda dapat **Publish only**, atau **Publish and make active** - bedanya adalah apakah alat dan aplikasi mengikuti versi tersebut mulai sekarang atau tetap mengikuti pengeditan terbaru Anda. **Follow the latest again** membuat setiap pengeditan langsung aktif begitu dibuat. `#/start?area=versions` membuka panel secara langsung.

## Ketika brand tetap

Beberapa build dikirim dengan **brand terkunci** - warna, font, dan tokennya adalah yang digunakan oleh setiap alat dan ekspor, dan tidak ada yang bisa diubah. Dalam kasus ini studio digantikan dengan catatan singkat yang menjelaskan bahwa build ini dikirim dengan brand tetap dan pengeditan dinonaktifkan. Ini disengaja: begitulah cara sebuah organisasi menjamin semuanya tetap sesuai brand.

## Ke mana selanjutnya

- **[Menggunakan Lolly](/info/using.html)** - kanvas, penyimpanan, proyek, dan katalog.
- **[Token Desain](/info/design-tokens.html)** - model token tempat brand Anda diekspresikan.
- **[Ekspor & Format](/info/exporting.html)** - unit cetak, CMYK, dan format tempat brand Anda dirender.
