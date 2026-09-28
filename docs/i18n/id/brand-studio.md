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
- **Export** - menulis seluruh sistem desain sebagai satu `LollyBrand-….lolly`.
- **Tokens (.json)** - dokumen design-tokens polos secara terpisah, untuk repo, langkah build atau tool token lain.
- **Restore brand settings** - kembali ke sebuah checkpoint yang disimpan sebelum sebuah impor atau penggantian pengaturan brand.
- **Versions** - publikasikan, aktifkan dan pulihkan salinan bernama dari sistem desain. Tersembunyi sampai ada sesuatu milik Anda sendiri untuk dipublikasikan (atau tautan `?area=versions` memintanya dengan nama).

![Rel ruang studio - Overview, Colours, Type, Logos, Tokens dan Files](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-rail&waitSelector=.ds-rail&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

## Overview

Overview adalah ruang pertama, dan punya dua wajah.

Dengan **belum ada apa pun yang dipilih** ia menampilkan **Make it yours**. **Start from a reference** membuka picker sumber untuk sebuah logo, tangkapan layar, halaman web atau design file. **Pick a colour**, **Choose a face** dan **Add a logo** langsung membuka kontrol masing-masing yang sudah ada. Setiap jalur dimulai dengan sebuah pilihan; membuka satu tidak menulis apa pun. **Explore the tools** tersedia seketika.

Setelah ada apa pun yang menjadi milik Anda, ruang yang sama menampilkan **apa yang Anda miliki**, dengan hitungan yang Anda buat memimpin. Colours membaca jumlah warna yang dibawa sistem desain, dan menambahkan `· N starter` yang redup hanya jika ada warna warisan yang ditampilkan; strip di sampingnya menaruh warna yang Anda pilih lebih dulu, lalu sebuah garis tipis dan warna starter yang pudar. Type membaca berdasarkan peran (*Inter untuk heading*, dengan *Starter untuk sisanya · SUSE, SUSE Mono* di bawahnya). Logos membaca berapa banyak slot yang terisi, atau **Not set**. Tokens membawa radius sudut, ditandai *starter* sampai Anda memindahkannya. Files menyatakan **Nothing yet** selama pustakanya kosong. Setiap blok adalah pintu ke ruangnya. Di sini hanya ada hitungan, tidak pernah ada progress bar dan tidak pernah ada kartu selesai - tidak ada apa pun di studio ini yang berutang.

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

Ruang ini berkembang seiring sistem desain. Tidak ada yang belum Anda perlukan di halaman itu, sehingga kunjungan pertama hanyalah satu keputusan dan sisanya datang seiring palet berkembang.

### Warna pertama

Sebuah sistem desain tanpa warna sendiri terbuka pada satu kolom yang dipusatkan: **Start with one colour**, sebuah chip live besar, sebuah field, dan sebaris tenang yang menyatakan bahwa roles, shades dan pengaturan cetak akan datang seiring sistem berkembang.

- **The chip is the picker.** Tekan chip itu dan kartu OKLCH milik studio sendiri terbuka di atasnya, disemai dengan apa pun yang sedang dipegang field itu: sebuah nama, roda warna, empat dial, alpha dan **Stored as**, dengan **Cancel** dan **Add colour** di bagian bawah. Menyeret sebuah dial mewarnai chip dan menulis ulang field itu sambil Anda melakukannya, dan tidak ada yang sampai ke sistem desain sampai Anda menekan **Add colour**.
- **The field takes any notation** - `#e0452b`, `rgb(224 69 43)`, `oklch(58% .19 32)` atau sebuah nama warna biasa - dan seluruh *daftar* warna menjadi satu baris chip yang Anda tambahkan satu per satu.
- **Two more doors sit beside it.** Eyedropper (di browser yang memilikinya) mengambil warna dari layar, dan **From an image** membaca tangkapan layar atau foto di perangkat ini dan menawarkan warna yang ditemukannya.
- **Add is never disabled.** Dengan tidak ada yang bisa dibaca di field itu, tombol ini membuka picker, yang biasanya memang dimaksudkan oleh sebuah tekanan kosong; teks yang tidak dapat diuraikannya mendapat sebaris di bawah field yang menyatakan hal itu, bukan tombol yang mati.

Warna pertama menjadi **primary**, dan chip yang menjawab penambahan itu menyatakan hal itu - *"Primary is now Vivid Violet"* - dengan **Fine-tune** di sampingnya.

![Ruang Colours dengan belum ada apa pun yang dipilih - satu chip live besar, satu field dan sebaris tentang apa yang akan datang](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

### Starter

**Starter** adalah kata untuk apa pun yang datang bersama aplikasi dan bukan hasil pilihan. Instalasi baru sama sekali tidak membawa warna: yang dimilikinya adalah satu ramp neutral, tinta menembus kertas, sehingga permukaan, teks dan garis tipis dapat dirender sebelum siapa pun memutuskan apa pun. Warna neutral itu adalah perancah, sehingga tidak dihitung sebagai warna dan tidak digambar di panel palet. Warna itu berada di ruang [Tokens](#tokens) sebagai **Neutrals · starter · 9**, dengan sebuah **Open** yang menampilkannya di panel Colours sebagai satu kelompok bertanda yang terlipat (`#/start?area=color&group=neutral`).

Kata yang sama berlaku di setiap ruang: sebuah peran yang berdiri di atas warna starter berbunyi *"Starter Paper stands in"* dan picker-nya menawarkan **Choose…**; sebuah wajah starter mengenakan tag **Starter** dan tanpa tint; sebuah radius sudut starter ditandai di Overview. Materi warisan tidak pernah digambar dengan border putus-putus, karena border putus-putus berarti target drop di sini.

### Seiring palet berkembang

Warna Anda tetap di samping pratinjau **In context** pada layar lebar dan bertumpuk di atasnya pada layar lebih kecil. Pratinjau itu dapat menampilkan sebuah poster, chart atau kartu antarmuka memakai palet Anda. Warna starter tetap dalam kelompoknya sendiri yang dapat dilipat, terpisah dari warna yang Anda tambahkan.

Tambahkan warna satu per satu atau satu set shades, tetapkan peran masing-masing, dan buka bagian lanjutan saat Anda membutuhkannya. Bagan warna, gradien dan kontrol unduh tetap bersama palet.

![Ruang Colours setelah menambahkan satu warna, dengan paletnya dan pratinjau komposisi live](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

### Roles - apa yang dibaca tool

**Roles** adalah lapisan di atas swatch: warna mana yang memainkan setiap bagian di setiap tool dan ekspor. Roles bersifat opsional (sistem desain dengan tiga warna lepas tanpa roles adalah sistem yang sepenuhnya sah), swatch mana pun dapat mengambil satu roles dan pembacaan kontras diukur terhadap permukaan, APCA lebih dulu.

Sebuah baris terbaca dalam salah satu dari tiga register, sehingga strip itu tidak pernah mengklaim sebuah keputusan yang tidak dibuat siapa pun:

- sebuah warna sendiri yang melayani roles itu, pada kekuatan penuh;
- **Starter *Paper* stands in** - redup, dengan **Choose…** pada picker-nya;
- **↳ follows Primary** - roles itu diresolusi lewat primary, bukan ke warna miliknya sendiri.

Setelah palet memiliki shades, strip itu berkembang menjadi ketujuh slot yang dapat dibaca sebuah tool: Primary, Secondary, Surface, Text, Muted, Edge dan On primary. On primary diturunkan dari primary, terbaca sebagai **Derived** dan tidak membawa picker.

**Aksen aplikasi itu sendiri adalah preferensi, bukan token.** Secara bawaan antarmuka mengikuti sistem desain dan aksen chrome mengambil warna primary. Itu adalah sebuah pengaturan Appearance di [profil Anda](/info/profile.html) - **Interface follows the design system** - dan mematikannya membuat chrome tetap netral. Tool, kanvas dan ekspor tidak terpengaruh baik begitu, dan font serta radius sudut mengikuti sistem desain baik pengaturan itu aktif atau tidak.

### Sayap ahli

Empat bagian terlipat berada di bawah pratinjau komposisi dan roles warna. Buka yang Anda inginkan; masing-masing dapat di-deep-link sebagai `#/start?area=color&focus=<wing>`, yang membukanya apa pun yang sedang ditampilkan ruang itu:

- **Explore shades & harmonies** (`focus=generate`) - satu warna menjadi satu set shades yang lengkap. Dijelaskan di bawah.
- **Shade curves** (`focus=curves`) - bentuk ulang sebuah ramp titik demi titik. Lightness, chroma dan hue masing-masing punya kurvanya sendiri, dipilih dengan L / C / H, dan shades di bawahnya dipanggang ulang secara langsung saat Anda menyeret.
- **Contrast** (`focus=contrast`) - **Contrast-lock** menata ulang sebuah ramp untuk mencapai target APCA terhadap latar belakang yang Anda pilih, setiap langkah mempertahankan hue dan chroma-nya sendiri; **Rotate hue** memutar seluruh ramp secara utuh mengelilingi roda warna, setiap shade mempertahankan lightness dan chroma-nya.
- **Print** (`focus=print`) - apa yang menjadi primary di percetakan: nilai layar otomatisnya, atau sebuah build CMYK yang dipatok atau tinta spot bernama sebagai gantinya.

### Satu warna, satu palet lengkap

Di dalam **Explore shades & harmonies**, pilih sebuah **Starting colour**. Lolly menyarankan shades yang cocok memakai matematika warna perseptual yang sama (OKLCH) yang dipakai engine di tempat lain. Sesuaikan sarannya:

- **Scheme** - Mono, Complement, Analogous atau Triad - menentukan bagaimana warna secondary berhubungan dengan primary.
- **Shades** - sebuah slider dari 3 sampai 20 (bawaan 5) mengatur berapa banyak langkah yang dihasilkan setiap ramp.
- **Fine-tune** (terlipat) - **UI intensity** (Muted / Deep), **Contrast** (Comfort / High) dan **Text on brand** (Auto / Light / Dark).

Mengubah starting colour dan kontrol hanya mengubah sarannya. Klik sebuah shade untuk menambahkan warna itu, atau **Add 5 shades** untuk menambahkan sebuah kelompok (jumlahnya mengikuti pengaturan Shades Anda). Warna dan roles yang ada tetap di tempatnya. Undo menghapus penambahan itu.

Baris **Primary**, **Neutral** dan **Secondary** menampilkan shades yang disarankan. Buka **Theme preview** untuk memeriksa contoh terang dan gelap serta pembacaan kontrasnya. Pilih sebuah langkah Neutral atau Secondary di sana untuk menyesuaikan jangkar tema yang diusulkan. Membangun ulang seluruh palet tetap menjadi tindakan terpisah yang ditinjau di bawah.

![Tiga kelompok shade yang disarankan, dengan kontrol tambah masing-masing dan sebuah Theme preview terpisah](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

### Membangun palet (generator harmoni)

Di **Find matching colours**, generator harmoni menyarankan warna aksen yang cocok dari primary. Pilih sebuah **Harmony** - **Complementary**, **Adjacent**, **Triad**, **Tetrad** atau **Analogous** (yang membawa jumlah **Accents** sendiri, 2 sampai 5, dan sebuah **Angle** hue dari 10° sampai 45°) - dan setiap kandidat hadir dengan sebuah nama yang mudah dibaca yang dibuat otomatis serta tombol **+ Add**. Menambahkan satu langsung menaruh warna itu ke palet, satu tekan untuk satu token. **In context** menampilkan pratinjau warna yang Anda tambahkan pada komposisi contoh.

![Aksen yang dihasilkan, masing-masing dengan sebuah swatch, nama yang dibuat otomatis, kode heksnya, dan tombol Add](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&drive=click%3A.be-generate-detail%3Anot%28%5Bdata-be-rebuild%5D%29%20%3E%20summary%3Bwait%3A500&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### Menerapkan palet yang dihasilkan

Menambahkan sebuah warna atau kelompok shade yang disarankan mempertahankan sisa palet Anda. Untuk sebuah penggantian lengkap, buka **Rebuild the whole palette…** dan tekan **Preview full rebuild**. Tinjauan itu menjelaskan perubahannya: berapa banyak roles tetap seperti yang Anda tetapkan, berapa banyak warna yang Anda tambahkan sendiri dipertahankan, berapa banyak shade curves diikat ulang, berapa banyak kunci cetak dipasang ulang, berapa banyak shades tersembunyi tetap tersembunyi, berapa banyak stop gradien mempertahankan warnanya.

**Apply rebuilt palette** pada kartu itu menerapkannya; **Cancel** membatalkan tanpa mengubah apa pun. Setelah berjalan, kartu itu menawarkan **Undo** dengan fokus yang sudah ada di sana - dan sebuah checkpoint dari seluruh sistem desain diambil *sebelum* pertukaran, sehingga "mengembalikannya seperti semula" adalah pemulihan, bukan sore hari yang hilang.

### Palet, bagan, dan setiap swatch

Palet itu mencantumkan warna sistem desain dalam kelompok yang dapat dilipat, masing-masing dengan kontrol **+ Add** miliknya sendiri. Buat dan ganti nama kelompok untuk mengatur pekerjaan Anda. Sebuah roles tidak pernah membuat ubin kedua: satu token adalah satu ubin, dan sebuah ubin yang ditunjuk sebuah roles memakai tanda sudut kecil sebagai gantinya (**P**, **S**, **Su**, **T**). Di bawah ubin-ubin itu, **Colour chart** terlipat terbuka pada dua tampilan dari swatch yang sama: **Wheel** (roda OKLCH - seret sebuah titik untuk mengubah warnanya, klik sebuah titik untuk mengeditnya atau klik ruang kosong untuk menjatuhkan swatch baru) dan bagan **Gamut**, yang menunjukkan di mana rentang yang dapat ditampilkan sebenarnya berakhir. `#/start?area=color&focus=chart` membuka kartu itu secara langsung, seperti yang selalu dilakukan `?wheel`.

![Panel palet, setiap kelompok dapat dilipat, dengan pil unduh terparkir di tepi bawahnya](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![Roda OKLCH - sudut adalah hue, jarak keluar adalah chroma, dan abu-abu berjalan di sepanjang rel lightness di sisinya](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

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

### Bekerja dengan banyak swatch

Setiap swatch punya drag handle-nya sendiri. Seret untuk menyusun ulang warna dalam kelompoknya, atau fokuskan, tekan Space, pakai tombol panah, dan tekan Space lagi untuk melepaskannya. Escape membatalkan. Urutannya bertahan saat studio dibuka ulang dan dapat dibatalkan. Untuk memindahkan warna antar kelompok, pakai kontrol **Group** pada editor swatch atau pilih beberapa warna dan pakai **Move**. Nama token dan referensi roles tetap utuh.

Seleksi di panel palet adalah sebuah gestur, bukan sebuah mode. Tidak ada tombol yang perlu ditekan lebih dulu, dan bilahnya muncul bersama ubin pertama yang terpilih dan menghilang bersama yang terakhir.

- **Seret pada ruang kosong panel itu** untuk menggambar sebuah persegi panjang: setiap ubin yang tersentuh bergabung ke seleksi, melintasi batas kelompok. Sebuah bagian terlipat tidak menyumbang apa pun, dan sebuah seretan yang tidak pernah bergerak mengosongkan seleksi.
- **Shift-click** mengambil rentang itu menurut urutan baca; **Cmd/Ctrl-click** mengalihkan satu ubin; klik biasa tetap membuka editor ubin itu.
- Setiap header kelompok membawa **Select all**, dan **Cmd-A** dengan sebuah ubin terfokus mengambil setiap warna yang dimiliki sistem desain - tidak pernah warna starter.
- Kisi itu punya satu tab stop. Panah menjelajahinya, Shift-panah memperluas seleksi, Space mengalihkan sebuah ubin, Delete menghapus seleksi dan Escape mengosongkannya. (Panah hanya menggerakkan fokus: untuk menggeser sebuah channel, tekan `l`, `c` atau `h` dulu, seperti yang dinyatakan pembacaan itu.)
- Di layar sentuh tidak ada persegi panjang. Tekan dan tahan sebuah ubin untuk memulai seleksi, lalu ketuk untuk menambah; **Select all** per kelompok membawa sisanya.

Bilah itu sendiri berbunyi **{n} selected**, lalu **Move to** (sebuah kelompok yang sudah ada, atau yang baru yang Anda beri nama di dalam menu), **Give a role** (setiap warna terpilih mengambil roles berikutnya secara bergiliran, sehingga empat ubin mengisi keempat roles dalam satu tekanan), **Download** (seleksi itu dalam salah satu dari enam format palet), **Copy values** (satu baris per warna dalam notasi tersimpannya) dan **Delete**. Move to dan Give a role muncul begitu palet punya shades untuk dipindah-pindah. Satu Ctrl/Cmd-Z membatalkan seluruh sebuah aksi massal - sebuah pemindahan empat puluh, sebuah putaran roles, sebuah penghapusan - dan sebuah penghapusan menyatakan apa yang dipertahankannya, karena sebuah seleksi menjangkau ubin yang tidak dihapus ruang ini.

### Gradien

Sebuah panel opsional **Gradients** membangun token blend dari palet untuk latar belakang dan aksen. Lewati sepenuhnya jika sistem desain itu tidak menggunakan gradien. Setiap gradien memiliki sebuah pratinjau, stop bernama (2–8) dan sebuah sudut. Perilaku kuncinya: **sebuah stop mereferensikan swatch**, jadi ubah warna swatch itu dan gradien akan mengikuti. Interpolasi berjalan dalam OKLCH untuk blend yang bersih. Hapus sebuah stop untuk memangkas rangkaiannya.

### Bawa palet ke tempat lain

Pil mengambang yang terparkir di tepi bawah panel palet mengunduh seluruh palet sebagai **Design tokens (JSON)**, **CSS variables**, **CSS classes**, **SCSS variables**, sebuah **GIMP palette (.gpl)** atau sebuah **Adobe Swatch Exchange (.ase)** - sehingga sistem desain itu langsung masuk ke Illustrator, Figma, GIMP atau stylesheet. Pil ini berada di luar area scroll panel, sehingga tetap di tempatnya sejauh apa pun palet digulir, dan muncul begitu palet punya shades. (Anda juga dapat mengunduh palet dari tampilan [Aset](/info/using.html#assets-your-library).)

## Type

Ruang ini berkembang dengan cara yang sama. Tanpa wajahnya sendiri, ruang ini hanyalah satu kartu dan satu keputusan: **Primary**, disetel pada ukuran baca dalam wajah yang melayaninya hari ini, sebuah tag **Starter** di samping namanya, sebuah **Choose a face** yang terisi dan baris *"Nothing installs until you choose one."* Di bawah kartu itu ada *"Headings, code and italic follow the primary until you choose them"*, dengan **Choose them separately** menyingkap tiga kartu lain untuk sisa kunjungan itu.

![Ruang Type dengan belum ada wajah yang dipilih - satu kartu pada ukuran baca, sebuah tag Starter di atasnya, dan satu Choose a face yang terisi](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

Pilih satu wajah dan ruang itu terbuka lebar menjadi **empat kartu peran**, daftar Fonts dan spesimen live. Empat wajah itu adalah yang benar-benar dibaca aplikasi, tool Anda dan setiap ekspor:

- **Primary** - teks isi, tombol, dan setiap tool.
- **Headings** - wajah tampilan untuk `h1`/`h2`.
- **Code** - wajah monospace untuk kode dan data.
- **Italic** - pendamping italic sejati untuk penekanan, kutipan, dan sisipan.

Headings, code, dan italic masing-masing kembali ke primary sampai Anda menetapkannya, sehingga sistem desain dengan satu wajah sama sekali tidak memerlukan keputusan apa pun di sini.

**Sebuah tint berarti Anda yang memilihnya.** Sebuah kartu hanya diberi tint di tempat Anda memasang wajah itu. Sebuah wajah starter memakai tag **Starter** yang sama seperti yang dipakai kelompok warisan palet, dalam register redup dan tanpa tint, dan sebuah peran yang belum dipilih siapa pun berbunyi **↳ follows Primary** alih-alih mengulang nama primary seolah-olah sudah dipilih. Tombolnya berbunyi **Change** pada sebuah wajah milik Anda sendiri dan **Choose a face** di tempat lain. Tidak ada apa pun pada sebuah kartu yang menerapkan apa pun: tombol itu membuka **compare stage** yang dibatasi pada peran itu.

![Empat kartu peran tersingkap - masing-masing disetel dalam wajah yang melayaninya, dengan tag Starter di mana tidak ada yang memilih satu dan Italic mengikuti primary](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

### Compare stage

![Compare stage terbuka di bawah kartunya, dengan baris pencarian, keluarga yang disematkan dan kartu-kartu terlipat menjadi satu strip sebaris](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

Stage itu terbuka **inline di dalam ruang**, bukan dalam sebuah dialog, dan tepat di bawah kartu yang Anda tekan. Selagi terbuka, kartu-kartu melipat menjadi satu strip sebaris peran dan wajah, sehingga stage itu ada di layar pertama bahkan di ponsel. Escape membatalkan dan mengembalikan keyboard ke kartu tempat Anda membukanya.

Memilih satu wajah adalah tiga tekanan:

1. **Choose a face** pada kartu itu.
2. Ketik sebuah nama keluarga dan tekan **Preview** - atau tekan salah satu dari enam keluarga **Pinned** di bawah field itu, satu tekanan masing-masing. Kartu itu tampak sudah memuat, dengan sebuah skeleton bar tempat spesimen itu akan berada, alih-alih wajah antarmuka yang menjadi pengganti sementara untuk sebuah wajah yang belum pernah Anda lihat.
3. **Use this face**.

**Persetujuan diminta sekali saja, pada tekanan yang Anda buat.** Pertama kali sebuah pratinjau menjangkau Google Fonts, sebuah dialog menyatakan apa yang terjadi: *Google mempelajari nama keluarga itu dan alamat IP Anda. Berkas itu lalu disimpan di perangkat ini dan dipakai offline. Ini adalah satu-satunya langkah di studio yang menjangkau pihak ketiga.* **Fetch from Google** melanjutkan dan diingat. **Cancel** membuat kartu itu menyatakan *"Not fetched. Nothing was sent to Google."* dengan **Fetch from Google** live-nya sendiri, sehingga mengubah pikiran Anda adalah satu tekanan pada kartu itu sendiri. Tidak ada kartu yang pernah menampilkan tombol mati: apa pun kondisinya, satu primary-nya menyatakan apa langkah berikutnya.

**Jatuhkan sebuah file font ke stage itu** dan langsung dipratinjau - **TTF**, **OTF** atau **WOFF** dari mesin Anda sendiri, yang merupakan jalur untuk sebuah typeface korporat berlisensi yang sudah Anda miliki. Drop zone itu adalah satu-satunya pintu file di ruang ini.

Bagaimanapun caranya, wajah font ini tetap di perangkat ini, dirender di aplikasi, di tool Anda dan di setiap ekspor, offline selamanya, dan ikut dalam file sistem desain - tidak ada yang diambil saat waktu render. Semua yang ada di Google Fonts dirilis di bawah lisensi terbuka (OFL/Apache/UFL).

### Font di perangkat ini

Panel **Fonts** mencantumkan setiap wajah yang dimiliki perangkat ini dan peran yang dilayaninya. Wajah yang Anda tambahkan memimpin di bawah **In the design system**, masing-masing dengan roles dan tombol hapusnya, dan yang melayani Primary membawa badge itu. Wajah starter mengikuti dalam satu baris terlipat - *Starter · SUSE, SUSE Mono · serving Primary and Code until you choose* - redup, tanpa hapus dan tidak ada yang bisa dipromosikan, karena keduanya bukan keputusan yang dibuat siapa pun. **Add a face** membuka compare stage yang sama tanpa batasan.

Panel **Type roles** di bagian bawah menampilkan sebuah spesimen live dari setiap peran - body dan UI dalam primary, sebuah wajah tampilan opsional untuk heading teratas, sebuah italic untuk penekanan, sebuah mono untuk kode dan data - dengan keluarga dan statusnya di samping masing-masing (*Inter*, *SUSE · starter*, *SUSE · follows Primary*), sehingga keseluruhan set dapat dibaca sekaligus.

## Tokens

Sisa dari sistem desain, dapat diedit tanpa menyentuh kode:

![Ruang Tokens - slider corner-radius ditambah spacing, sizing, shadows, dan sisa sistem lainnya](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **Rounded corners** - satu slider radius (0–1.5rem) yang diikuti oleh kartu, tombol, dan panel di seluruh aplikasi.
- **Neutrals** - ramp tinta-menembus-kertas yang dibawa sebuah instalasi baru, terdaftar sebagai **Neutrals · starter · 9** dengan sembilan langkahnya dan sebuah **Open** ke panel Colours. Inilah satu-satunya tempat neutral starter itu dikelola, dan tag *starter* itu hilang begitu ramp itu dihasilkan, bukan diwariskan.
- **More tokens** - tambah dan edit **spacing**, **sizing**, **stroke width**, **opacity**, **rotation**, **numbers** biasa, dan **shadows**. Pilih jenisnya, beri nama (*Gutter, Card shadow…*) dan atur nilainya. Ini disimpan sebagai [design tokens](/info/design-tokens.html) (DTCG) standar dan ikut bersama sistem desain itu.

## Files

Jatuhkan file yang disimpan brand Anda - selain logo - di sini: aset **vector**, **image**, **audio**, dan **motion** (video, Lottie, animasi). File-file ini masuk ke [Aset](/info/using.html#assets-your-library), disortir ke dalam bagian-bagian dan siap di asset picker setiap tool. Semuanya tetap di perangkat ini. (Rail memberi label ruang ini **Files**; kunci URL tetap `catalogue`, karena kunci panel adalah kontrak permanen.)

## Bawa brand masuk

**Add from…** di bagian bawah rail membuka picker dua tahap. Tahap pertama menanyakan apa yang Anda *miliki*, bukan format apa itu:

- **Design tokens or a design file** - JSON DTCG atau Tokens Studio, proyek Penpot, **zip berisi set token**, paket sistem desain Lolly, atau SVG.
- **PDF** - deck atau file pedoman, dibaca di perangkat ini untuk warna, tanda, dan typeface yang tertanam di dalamnya.
- **Logo or screenshot** - sebuah gambar menjadi sebuah palet yang disarankan, dibaca di perangkat ini. Tidak ada yang diunggah. Ini membaca warna, bukan typeface atau layout dalam gambar itu.
- **Saved web page** - pilih satu file HTML dan file CSS-nya, atau tempel HTML atau CSS. Hingga 20 file dan 2 MB total. Hanya teks yang disediakan yang dibaca; sumber daya tertaut tidak diambil dan skrip tidak berjalan. Jalur ini juga berfungsi tanpa ekstensi atau aplikasi desktop.
- **Font file** - TTF, OTF atau WOFF. Membuka ruang Type, tempat wajah font terpasang.
- **Website** - satu halaman, dibaca untuk warna dan tipenya. Ubin ini hanya muncul di perangkat yang benar-benar dapat membaca halaman, karena ubin yang dinonaktifkan yang mengiklankan sesuatu yang tidak dapat ditekan siapa pun lebih buruk daripada tidak ada ubin sama sekali. Di tempat ubin ini muncul, ia menyebutkan pembacanya dengan jelas: diambil oleh aplikasi di perangkat ini, atau dibaca melalui ekstensi browser di tab latar belakang, masuk sebagai Anda. Menyebutkan URL hanya *mengisi terlebih dahulu* kolomnya - tombol fetch adalah persetujuannya, sehingga tautan yang dikirimkan seseorang tidak akan pernah bisa memulai pembacaan.

Pilih sumber design-file dan tahap kedua adalah kartu di bawah ini: format yang diterima tampil sebagai ubin ikon dalam urutan preferensi, dan seluruh kartu adalah satu target drop - klik di mana saja pada kartu atau seret file ke atasnya. Anda juga dapat menjatuhkan file langsung ke studio.

![Kartu impor - format yang diterima tampil sebagai ubin ikon, dan seluruh kartu adalah satu target drop](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

Apa yang diberikan setiap design file kepada Anda:

- sebuah **paket sistem desain Lolly** (`.lolly`; `.zip` lawas masih diterima) - terpasang dalam satu langkah;
- sebuah ekspor **Penpot** (`.penpot`) - menarik design token-nya;
- sebuah file **Design Tokens** (`.json`) - W3C DTCG;
- sebuah file **Tokens Studio** (`.json`) - Tokens Studio;
- sebuah **SVG polos** (`.svg`) - Lolly memindai warnanya dan membiarkan Anda memilih mana yang disimpan, yang pertama menjadi warna primary Anda.

Sebuah logo/tangkapan layar, situs web atau halaman tersimpan membuka **Your suggested design system**. Lihat sebuah contoh memakai warna yang diusulkan, pilih **Main colour** yang berbeda jika perlu, dan beri nama sistem itu. **Use this design system** menerapkan palet terang dan gelap yang dihasilkan dan kembali ke Overview. Font yang ada tetap di tempatnya. Ini mengganti warna sistem aktif dan pengaturan token lainnya. Sebuah checkpoint harus berhasil lebih dulu; **Restore brand settings** memulihkan pengaturan sebelumnya.

**Source details and individual choices** menampilkan apa yang dibaca, nama font yang terdeteksi, dan kontras teks/aksi pratinjau itu. Ini juga menawarkan **Choose individual items in the tray** dan **Download design context**. Laporan JSON itu membawa observasi, token yang diusulkan, dan informasi sumber; HTML/CSS tersimpan menyertakan sebuah SHA-256 dari teks yang disediakan. Laporan ini tidak berisi teks halaman mentah dan bukan sebuah Content Credential yang ditandatangani. Nama font adalah saran: Type tetap menjadi tempat untuk memilih dan memasang font.

Impor PDF dan design file lainnya mempertahankan kontrol tinjauan yang sudah ada. Item yang disimpan di **Tray** tidak mengubah apa pun sampai ditambahkan lewat ruang yang memiliki jenis materi itu.

`#/start?source=<kind>` membuka picker pada sumber tertentu (`file`, `pdf`, `image`, `font`, `url`, `page`), dan `?import` membukanya pada daftar polos.

## Memindahkan brand antar perangkat

**Export** di bagian bawah rail menulis satu **`LollyBrand-….lolly`** - token, font, logo, dan preferensi tema Anda, dengan manifest integritas yang diverifikasi saat kembali diimpor. Rilis web sebelum 1.0.7 menamai payload yang sama `.zip`; ejaan lawas itu masih diterima. Di sampingnya, **Tokens (.json)** menulis dokumen design-tokens polos sendirian: tanpa font, tanpa logo, hanya token, yang justru dibaca oleh repo, langkah CI, atau tool token lain.

Membawanya kembali adalah **Add from… → Design tokens or a design file** (di atas), atau drag-and-drop ke studio. Beginilah cara seorang kolega menyerahkan brand kepada Anda, atau cara Anda membawanya ke instalasi kedua - tanpa akun, tanpa cloud. Untuk membawa masuk brand dari command line, lihat [`ingest:brand`](/info/configuration.html#brand-packs).

## Pulihkan pengaturan sebelumnya

Pilih **Restore brand settings** di bagian bawah rail, pilih sebuah checkpoint bertanggal, lalu tekan **Restore**. Ini memulihkan warna, pengaturan tipe, dan token brand lainnya untuk brand aktif. File font dan gambar tetap seperti apa adanya.

Lolly menyimpan pengaturan Anda saat ini sebagai **Before restore** sebelum menerapkan checkpoint itu. Pilih checkpoint itu untuk membalikkan pemulihan tersebut, termasuk setelah menutup dan membuka ulang browser. 20 checkpoint terbaru disimpan di perangkat ini. Jika penyimpanan tidak dapat dibaca atau pengaturan saat ini tidak dapat disimpan, dialog itu melaporkan masalahnya sehingga Anda bisa mencoba lagi.

## Versi

**Versions** di kaki rail adalah tempat sebuah design system berhenti menjadi target yang bergerak. Publikasikan satu dan Anda mendapatkan **salinan permanen bernama** yang disimpan di perangkat ini: ia tidak pernah berubah setelahnya, jadi sebuah alat yang menyematkannya akan terus menggambar hal yang sama. Panel ini tetap tersembunyi sampai ada sesuatu milik Anda sendiri untuk dipublikasikan, jadi sebuah studio yang tidak pernah mempublikasikan tidak akan pernah melihat kontrol-kontrol ini.

Tiga hal yang perlu diketahui sebelum Anda menekan apa pun, dan panel ini menyatakan ketiganya sebelum penekanan, bukan sesudahnya:

- **Sebuah versi bersifat permanen.** Belum ada fitur hapus, jadi panel menyatakan apa yang telah disimpan dan bahwa itu tetap tersimpan, bukan menawarkan tombol yang berbohong.
- **Penghapusan memimpin kartu kompatibilitas.** Token yang ditambahkan dan diubah adalah berita; sebuah token yang *dihapus* adalah hal yang merusak sebuah alat, jadi ia disebutkan pertama dan disebut apa adanya.
- **Publikasi tidak bisa dibatalkan; restore bisa.** *Restore latest from this version* adalah edit biasa pada head, jadi ia masuk ke undo stack studio dan panel langsung menawarkan Anda **Undo**.

Anda dapat **Publish only**, atau **Publish and make active** - bedanya adalah apakah alat dan aplikasi mengikuti versi tersebut mulai sekarang atau tetap mengikuti pengeditan terbaru Anda. **Follow the latest again** membuat setiap pengeditan langsung aktif begitu dibuat. `#/start?area=versions` membuka panel secara langsung.

## Ketika brand tetap

Beberapa build dikirim dengan sebuah **sistem desain terkunci**, seperti SUSE Brand. Membukanya menampilkan sebuah catatan baca-saja dengan **Make an editable copy** dan **Switch**. Warna, font, dan token aslinya tetap utuh. Sistem lokal Anda sendiri tetap dapat disunting, bahkan saat sistem terkunci itu adalah yang pertama di perangkat ini. Di Profile, **Open** memilih sebuah sistem dan membuka studionya; **Make a new one** membuat sebuah sistem lokal dan membukanya di `#/start` dengan field namanya terfokus.

## Ke mana selanjutnya

- **[Menggunakan Lolly](/info/using.html)** - kanvas, penyimpanan, proyek, dan Aset.
- **[Token Desain](/info/design-tokens.html)** - model token tempat brand Anda diekspresikan.
- **[Ekspor & Format](/info/exporting.html)** - unit cetak, CMYK, dan format tempat brand Anda dirender.


## Temukan dan bandingkan sebuah look

Buka **Find a look** dari Overview atau daftar sistem desain di Profile. Jelajahi sistem yang tersimpan di perangkat ini dan beberapa contoh Lolly yang dapat dipakai ulang. Cari berdasarkan nama, tag warna atau font yang dideklarasikan. **Closest to my current palette** mengurutkan berdasarkan kemiripan warna yang diukur, dengan keluarga font yang cocok memutus seri; ini bukan skor kualitas.

Pilih satu look untuk meninjaunya, atau dua untuk membandingkan. Tombol tinjauan itu tetap tersedia di layar kecil. Memilih sebuah look tidak mengubah apa pun. **Use this saved system** beralih melalui registry sistem desain yang ada. **Use these colours** menerapkan sebuah contoh lewat alur checkpoint dan instalasi biasa, mempertahankan font saat ini. **Restore brand settings** dapat memulihkan look sebelumnya.

Di bawah **Details and design context**, sistem tersimpan memiliki **Search tags** yang dapat disunting dan sebuah unduhan konteks. Contoh memakai resep warna Lolly yang asli; tidak ada koleksi inspirasi hasil scraping jarak jauh atau akun yang diwajibkan.

![Bandingkan Sunroom dan Orchard berdampingan sebelum menerapkan salah satu sistem warna.](/t/url-shot?url=%2F%23%2Fstart&width=1280&height=900&dpi=96&waitMs=3000&format=svg&filename=brand-compare-looks&try=1&drive=click%3A%5Bdata-ds-door%3D%22looks%22%5D%3Bwait%3A500%3Bclick%3A%5Bdata-look-select%3D%22example%3Asunroom%22%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Aorchard%22%5D%3Bclick%3A%5Bdata-looks-review%5D%3Bwait%3A500&cropSelector=.ds-looks-comparison&waitSelector=%5Bdata-ds-door%3D%22looks%22%5D&walker=1&rasterDpi=96)

Perbandingan itu membuat kedua palet tetap terlihat bersama. Meninjau sebuah look tidak mengubah apa pun sampai Anda memilih **Use these colours** atau **Use this saved system**.

## Baca bukti sumber

Detail opsional dari tinjauan sumber menampilkan tipografi, gap, padding, dan nilai sudut di mana teramati. Bacaan HTML/CSS tersimpan dan website native melaporkan deklarasi, yang mungkin tidak dipakai oleh halaman yang dirender. Ekstensi browser dapat melaporkan gaya terukur dari sampel terbatas elemen yang terlihat, beserta viewport dan preferensi warna browsernya. Ekstensi lama masih berfungsi dengan gaya yang dideklarasikan. Field yang hilang berbunyi **Not observed**.

Ini adalah observasi, bukan pengaturan gaya otomatis. File font tidak diambil atau dipasang oleh sebuah pemindaian referensi, dan spacing sumber tidak diam-diam menggantikan spacing Anda sendiri. Hitungan menjelaskan kemunculan dalam sampel itu, bukan kepercayaan atau kualitas.

## Periksa sebuah komposisi terhadap sistem desain

Di Design, buka **Export**, lalu **Before you export**. Pemeriksaan itu memakai versi sistem desain efektif yang sama dengan render tersebut. Ia membandingkan warna yang dikarang, alias token, pilihan font, dan ID aset gambar. Nilai kustom mungkin disengaja; sebuah gambar di luar aset brand yang dideklarasikan adalah item tinjauan, bukan gambar yang dilarang.

Di mana sebuah saran warna atau font yang konkret tersedia, tombolnya mengubah satu layer itu. **Undo** biasa memulihkan nilai aslinya. Layer yang terkunci atau diubah tidak ditimpa oleh sebuah saran lama. Bukti sumber yang hilang tetap terpisah dari sebuah kecocokan. Kontras yang dirender dan tata letak teks diperiksa oleh pemeriksaan yang sudah terpasang. Gradien, efek, konten tool bersarang, hak, dan kualitas subjektif tidak dinilai oleh perbandingan brand. Pemeriksaan tidak memblokir Download.

## Pakai konteks desain secara lokal

**Download design context** mencakup dokumen token, warna yang diresolusi, keluarga font yang dideklarasikan, ID aset, bukti sumber di mana tercatat, cakupan, dan aturan eksplisit. Ini tidak mencakup file font atau bukti kepemilikan. Tinjauan referensi itu juga mencakup token yang diusulkan dan observasinya.

CLI dapat membaca kedua unduhan itu tanpa sebuah server:

```bash
lolly system import ./lolly-design-context.json
lolly system context --output=design-context.json
lolly system check ./design-inputs.json --file=design-context.json
```

`system check` menerima input Design dengan sebuah array `boxes` atau sebuah dokumen Design yang telah dikompilasi. Ia melaporkan perbaikan yang diusulkan tanpa mengubah komposisi itu. Ia tidak dapat mengukur tata letak browser atau kontras yang dirender. Resource MCP yang sudah ada **lolly://design-context** mengekspos konteks sistem efektif itu lewat proses MCP lokal yang dikonfigurasi; tidak diperlukan layanan hosted baru atau API key.
