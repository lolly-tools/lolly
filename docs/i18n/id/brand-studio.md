# Lolly Design System Setup

<a id="design-system-setup"></a>

**Lolly Design System Setup**, di `#/start`, memuat logo, warna dan jenis huruf Anda. Setiap alat, halaman dan ekspor menggambar dengannya.

Letakkan logo dan Lolly membaca warnanya. Pilih jenis huruf, atau letakkan file font yang dilisensikan perusahaan Anda. Setiap perubahan langsung terlihat di seluruh aplikasi. Logo, font dan token Anda tetap di perangkat ini. Hanya pemilihan Google Font yang mengakses jaringan: Lolly meminta persetujuan lebih dulu, lalu mengambil keluarga font sekali.

Beri nama design system dan tekan **Export** untuk mendapatkan satu file `.lolly`. Simpan file, buka di perangkat lain atau serahkan kepada rekan kerja. [Lolly Settings](/info/dashboard.html#design-system) menampilkan design system aktif dalam mode hanya baca; sampulnya menautkan kembali ke sini untuk penyuntingan.

<!--i:eti-clock-->
## Jadikan milik Anda dalam lima menit

::: timeline
- <!--i:upload--> **Letakkan logo Anda** di zona lepas pada **Logos**. Lolly membaca bentuk dan warnanya.
- <!--i:palette--> **Use these colours.** Warna utama logo menjadi warna primer Anda, dan warna netral gelap dari logo menjadi warna teks Anda.
- <!--i:font--> **Choose a face** di **Type**: Google Font, atau file font yang Anda miliki.
- <!--i:pentool--> **Beri nama design system.** Suntingan pertama Anda membuat design system milik Anda sendiri, dan Lolly meminta namanya sekali.
- <!--i:download--> **Export** menulis seluruh design system sebagai satu file `LollyBrand-….lolly`.
:::

Bilah di bagian atas studio menampilkan nama design system sebagai field yang dapat disunting. **Enter** menyimpan nama baru dan **Escape** mengembalikan nama lama. Saat suntingan pertama Anda memunculkan pertanyaan **What is this design system called?**, Lolly mengisi kata-kata dari logo Anda, jika logo memuatnya. **Save name** menyimpan nama; **Not now** mempertahankan placeholder sampai Anda mengetik nama di bilah. Nama tersebut menjadi label design system di Settings dan saat Anda beralih, serta menjadi nama file yang ditulis **Export**.

<!--i:eti-grid-->
## Ruang-ruang

Studio adalah kumpulan ruang tanpa urutan tetap. Tidak ada ruang yang menunggu ruang lain. Di desktop, ruang-ruang berada dalam satu deretan di bawah bilah. Di ponsel, ruang-ruang berpindah ke bilah di sepanjang tepi bawah, dengan ruang yang terbuka digulir ke tampilan. Lembar palet dan baki muncul di atas bilah itu, dan bilah menyingkir saat Anda mengetik. Dengan keyboard, Tab mencapai deretan itu sekali, dan tombol panah, Home serta End berpindah antar-ruang.

![Bilah studio dan ruang-ruangnya: Board, Colours, Type, Logos, Tokens, Files, Sound, Rules dan Skills](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-top&waitSelector=.ds-room-nav&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

| Ruang | Yang Anda lakukan di sana | Kunci tautan |
|---|---|---|
| **Board** | Melihat isi design system, dengan pintu ke setiap ruang | `overview` |
| **Colours** | Menambahkan warna, memberinya peran, membuat shade dan palet | `color` |
| **Type** | Memilih empat jenis huruf yang dibaca aplikasi, alat dan setiap ekspor | `type` |
| **Logos** | Menempatkan tanda merek Anda dalam setiap orientasi dan perlakuan | `logos` |
| **Tokens** | Sudut, jarak, bayangan dan setiap nilai bernama lainnya | `tokens` |
| **Files** | File gambar, audio dan gerak yang disimpan merek Anda | `catalogue` |
| **Sound** | Membentuk identitas suara, musik untuk berbagai penggunaan dan hubungan dengan suara | `sound` |
| **Rules** | Aturan yang diterapkan merek Anda, diperiksa pada contoh nyata | `usage` |
| **Skills** | Standar tertulis merek untuk orang dan agen, untuk dibaca dan diunduh | `skills` |

Tautkan ke ruang dengan `#/start?area=<key>`. Kunci ruang bersifat permanen, jadi Files tetap menggunakan `catalogue`, Board tetap menggunakan `overview` dan Rules tetap menggunakan `usage`. `?tab=` masih berfungsi sebagai alias lama. Kunci yang tidak dikenal membuka Board.

**Bilah** memuat aksi untuk seluruh design system. **Add from…** memasukkan merek ([Memasukkan merek](#bring-a-brand-in)). **Tray** menampung hasil pemindaian yang belum Anda tambahkan. **Export** menulis design system sebagai satu file. **More** memuat **Tokens (.json)**, **Fonts for Linux (.rpm)**, **Versions & publishing**, **Restore brand settings** dan **Design systems**, yang membuka daftar di Settings tempat Anda beralih ([Menyimpan dan memindahkan design system Anda](#keep-and-move-your-design-system)). Setiap aksi muncul setelah ada sesuatu yang dapat ditindaklanjuti. Di ponsel, **Add from…** berpindah ke **More** dan **Export** tampil sebagai ikonnya.

Selama design system masih yang disertakan dengan aplikasi, bilah diawali **Make it yours**, menu berisi **Find a look**, **Add from…** dan **Pick a colour**. Setelah design system menjadi milik Anda sendiri, **Export** kembali menempati posisi itu.

<!--i:eti-clipboard-->
## Board

Saat belum ada yang dipilih, Board menawarkan empat cara untuk memulai. **Start from a reference** membuka pemilih sumber untuk logo, tangkapan layar, halaman web atau file desain. **Pick a colour**, **Choose a face** dan **Add a logo** membuka kontrol tersebut. Membuka salah satunya tidak menulis apa pun. Di bawahnya, **Find a look** menawarkan warna dan jenis huruf siap pakai untuk dicoba, dan **Explore the tools** ada sejak awal.

Setelah ada yang menjadi milik Anda sendiri, Board menampilkan apa yang Anda miliki, dengan jumlah milik Anda lebih dulu. Colours menampilkan jumlah warna, dengan `· N starter` yang diredupkan untuk warna bawaan. Deretannya menampilkan warna Anda, lalu garis tipis, lalu warna awal yang dipudarkan. Colourways menampilkan setiap colourway sebagai ubin kecil dengan warna utamanya. Type mencantumkan setiap peran dan menampilkan setiap keluarga font dengan jenis hurufnya sendiri (*Inter untuk judul*, dengan *Starter untuk sisanya* pada baris di bawah). Logos menyatakan berapa slot yang terisi (atau **Not set**), Tokens menampilkan radius sudut dan Files menyatakan **Nothing yet** saat pustaka kosong. Setiap blok membuka ruangnya.

Design system yang dapat disunting dan disertakan dengan aplikasi, seperti Lolly Demo, menampilkan warna, colourway, jenis huruf dan tanda mereknya di Board sejak awal, dengan tag **Came with this app** di samping judul. Di atasnya, **Start here** menawarkan **Find a look**, **Add from…** dan **Pick a colour**.

### Bawaan dan milik Anda

Di setiap ruang, **Starter** menandai apa pun yang disertakan dengan aplikasi dan belum dipilih siapa pun. Instalasi baru tidak membawa warna, hanya satu rentang netral dari tinta ke kertas, sehingga permukaan, teks dan garis tipis dapat dirender sebelum siapa pun memilih.

::: cols
## Starter

- Disertakan dengan aplikasi: warna netral dari tinta ke kertas, jenis huruf awal, radius sudut default.
- Diredupkan, dengan tag **Starter** dan tanpa tint.
- Tidak dihitung sebagai warna Anda. Warna netral berada di **Tokens** sebagai **Neutrals · starter · 9**, dan **Open** menampilkannya di Colours sebagai satu grup terlipat (`#/start?area=color&group=neutral`).
- Peran yang menggunakan warna awal bertuliskan *"Starter Paper stands in"*, dengan **Choose…** pada pemilihnya.

## Milik Anda

- Dipilih atau dipasang oleh Anda.
- Ditampilkan penuh, dan kartu diberi tint di tempat Anda memasang jenis huruf.
- Dihitung di Board dan Tokens.
- Peran yang mengikuti peran lain bertuliskan **↳ follows Primary**.
:::

Materi bawaan tidak pernah memiliki garis tepi putus-putus. Garis tepi putus-putus berarti target untuk melepas file.

<!--i:eti-shapes-->
## Logos

Zona lepas di bagian atas, **"Drop marks here, or choose several at once"**, menerima sebanyak apa pun file yang Anda miliki. Lolly membaca bentuk dan tinta setiap file. File lalu menunggu di bawah **Waiting for a slot** sebagai chip yang menyatakan bentuk yang menyerupainya, seperti *"Looks like the Horizontal primary"*, beserta pengukuran yang digunakan dan tombol **Place** (**Replace** jika slot terisi). Jika Lolly tidak yakin, chip menyatakannya dan menawarkan **Change slot**, yang mencantumkan kedelapan slot. Tidak ada yang ditempatkan sampai Anda menekan tombol.

Tanda merek dengan margin kosong berlebih mendapat tawaran pemangkasan lebih dulu. Tanggapi tawaran tersebut, atau tekan Escape untuk menempatkan aslinya tanpa perubahan. Jika tanda merek dapat mengisi slot terkait yang kosong, ruang menawarkan versi turunan **mono** atau **reverse** sebagai chip bertanda *Generated*.

Setiap tanda merek masuk ke grid berisi delapan slot opsional, satu per **orientasi** dan **perlakuan**:

- **Orientasi:** Horizontal (wordmark dan simbol dalam satu baris) dan Vertical (bertumpuk, untuk ruang persegi dan tinggi).
- **Perlakuan:** Primary, Primary reverse (untuk latar gelap), Mono (satu warna) dan Mono reverse.

Grup tanpa tanda merek terlipat menjadi satu baris; buka grup untuk melihat slotnya. Klik slot untuk menambahkan PNG, SVG, JPEG atau WebP, atau klik slot terisi untuk mengganti tanda merek. Slot kosong juga menerima file yang dilepas. Tanda merek horizontal berada pada ubin lebar dan yang vertikal pada ubin persegi, masing-masing di permukaan yang menjadi tujuannya, dengan ruang kosong seperempat tingginya. Semuanya tetap di perangkat ini.

![Slot logo dengan Horizontal dan Vertical terbuka: setiap perlakuan memiliki slot sendiri, dan setiap slot bersifat opsional](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&system=new-design-system&width=1440&height=1600&dpi=192&waitMs=1600&drive=click%3A.be-logo-identity%3Edetails.be-logo-group--fold%3Anot%28.be-logo-group--custom%29%3Esummary%3Bwait%3A600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Custom marks** adalah tanda merek yang disebut merek Anda dengan namanya sendiri, seperti ikon, lambang atau favicon.
- **Identitas lainnya.** Submerek, produk atau acara dapat memiliki set lengkapnya sendiri: tekan **+ Add another logo** dan beri nama set tersebut. Set utama Anda adalah "Your logo". [Arsitektur merek](/info/brand-architectures.html) menunjukkan kapan harus menggunakan identitas logo.
- **Lolly membaca warna logo.** Kartu di bawah zona lepas, dan di bagian atas Colours, mencantumkan warna logo dan menanyakan **Which is the main colour?**. Warna terkuat dipilih, bukan warna putih latar saat logo diekspor. **Use these colours** menambahkannya ke palet Anda dan menjadikan warna utama sebagai warna primer. Jika logo memiliki warna netral gelap yang terbaca di kertas, warna netral itu menjadi warna teks. **Not now** membiarkannya di Tray. Pada instalasi yang benar-benar baru, Lolly langsung menerapkan jawaban yang paling mungkin, dan kartu menawarkan **Undo** atau warna utama lain. SVG memberikan warna yang tepat; PNG, JPEG atau WebP memberikan warna yang mencakup bagian signifikan dari tanda merek.

<!--i:eti-palette-->
## Colours

Ruang berkembang bersama design system. Kunjungan pertama meminta satu keputusan; lebih banyak kontrol muncul seiring berkembangnya palet.

### Warna pertama

Design system tanpa warna milik sendiri menampilkan warna netral awal dalam grup terbuka tersendiri. Di bagian atas ruang ada field tempel dan lepas bergaris putus-putus: satu chip besar dan satu field. Letakkan gambar atau daftar warna di mana saja pada field, dan Lolly membaca warnanya.

- **Chip adalah pemilihnya.** **Pick a colour** membuka kartu OKLCH studio, dengan nilai awal dari isi field. Kartu menampilkan nama warna dan kode heksa lebih dulu. Ruang warna, roda, empat kenop dan alpha berada di bawah **Fine-tune**, dan **Cancel** serta **Add colour** di bagian bawah. Tidak ada yang masuk ke design system sampai Anda menekan **Add colour**.
- **Field menerima notasi apa pun**: `#e0452b`, `rgb(224 69 43)`, `oklch(58% .19 32)` atau nama warna. Daftar yang ditempel menjadi deretan chip untuk ditambahkan satu per satu atau dengan **Add all**.
- **Dua cara lain untuk memasukkan warna.** **Pick a colour from the screen** menggunakan pipet jika browser menyediakannya, dan **Take colours from an image** membaca tangkapan layar atau foto di perangkat ini.
- **Add tidak pernah dinonaktifkan.** Saat field kosong, tombol ini membuka pemilih; teks yang tidak dapat dibaca mendapat baris di bawah field yang menyatakannya.

Warna pertama Anda menjadi warna **primer**. Chip mengonfirmasi perubahan, seperti *"Primary is now Vivid Violet"*, dengan **Fine-tune** untuk menyesuaikan warna.


### Seiring berkembangnya palet

Warna Anda berada di samping pratinjau **In context** pada layar lebar, dan di atas pratinjau pada layar yang lebih kecil. Pratinjau menampilkan poster, bagan atau kartu antarmuka dalam palet Anda. Warna awal memiliki grup sendiri, yang terlipat setelah design system memiliki warna sendiri. Field tempel dan lepas menjadi satu baris ringkas. Bagian atas ruang tidak memiliki ekspor; gunakan **Export** pada bilah atau ruang Tokens.

![Ruang Colours pada Lolly Demo: chip peran serta field tempel dan lepas di bagian atas, lalu palet dalam grup yang dapat dilipat, setiap warna dengan nama dan kode heksanya](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-roles-fold%5D%3Esummary%3Bwait%3A500&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

![Ruang Colours pada Lolly Demo setelah menambahkan satu warna: tabel Colour roles, lalu chip warna baru yang menawarkan Use as Lead? dan Fine-tune, di samping pratinjau komposisi langsung](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

### Peran warna: nama yang diberikan pada warna

Design system memberi nama pada warnanya dan menyatakan kegunaan masing-masing, dan Lolly membaca keduanya. **Colour roles** berada di bagian atas ruang Colours. **In context** langsung menampilkan setiap perubahan.

![Tabel Colour roles pada Wefthouse, merek tekstil rekaan, dengan istilahnya sendiri: chip colourway Indigo, Madder dan Weld, lalu Main, Accent, Supporting dan Tertiary, masing-masing dengan warna terang dan gelap, dibaca sebagai warna utama, warna pasangan dan hanya berdasarkan nama, serta Background, Text, Quiet text dan Hairlines yang tercantum di bawah tabel sebagai pembacaan yang tidak diisi peran mana pun](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&system=wefthouse&width=2720&height=2000&dpi=192&waitMs=1800&cropSelector=%5Bdata-be-roles-fold%5D&format=svg&walker=1&dark=1&filename=bs-colour-roles)

Tabel memiliki empat kolom. Di ponsel, setiap baris menjadi kartu dengan terang dan gelap berdampingan:

| Kolom | Isinya |
|---|---|
| **Role** | Istilah design system sendiri, yang dapat Anda sunting langsung, dan baris yang menyatakan kegunaan warna |
| **Light** dan **Dark** | Warna pada tampilan tersebut untuk colourway yang dipilih, beserta nama atau nilainya serta kontrasnya |
| **Lolly reads this as** | Yang dilakukan alat dengan peran tersebut, dalam istilah Lolly sendiri |

**Cara Lolly menafsirkan peran.** Setiap pemaknaan ditempati satu peran. Memilih pemaknaan yang ditempati peran lain memindahkan pemaknaan itu ke peran ini. Lolly tidak pernah menyimpulkan makna dari sebuah kata.

| Pemaknaan | Penggunaannya |
|---|---|
| **Lead colour** | Bentuk besar, tombol, warna yang diutamakan alat |
| **Partner colour** | Warna kedua yang digunakan alat |
| **Background** | Berada di belakang semua elemen lain |
| **Text** | Judul dan teks isi |
| **Quiet text** | Keterangan dan teks kecil |
| **Hairlines** | Garis, batas dan pemisah |
| **By name only** | Tidak ada alat yang memilih peran ini secara otomatis. Peran ini tersedia di setiap field warna dan di Design, tempat pilihan tetap tertaut sehingga mengikuti colourway |

Pemaknaan yang tidak diisi peran mana pun tetap memakai definisi design system, dan ruang ini mencantumkan pemaknaan tersebut di bawah tabel. Peran yang memiliki id yang sama dengan id pemaknaan, misalnya peran bernama Primary, adalah pemaknaan itu sendiri dan tidak dapat dipindahkan.

**Dalam bagan.** Palet **Design system - colour roles first** di Lolly Chart memberi seri peran warna design system sesuai urutannya, lalu warna lain dalam paletnya. Peran yang dimaknai sebagai latar belakang, teks, teks redup atau garis tipis tidak disertakan, karena bagan menggambar latar dan teksnya dengan warna-warna itu. Tidak ada yang berubah sampai Anda memilih palet tersebut. Design system tanpa peran warna menggambar palet sebagai **Design system - ordered**.

**Nilai.** Tekan nilai untuk memilih warna peran tersebut bagi tampilan dan colourway yang dipilih. **Same as light** membuat nilai gelap mengikuti nilai terang sampai Anda memilih warna gelap. Chip **Aa** menampilkan teks yang dipilih Lolly untuk diletakkan di atas warna itu. Baris di bawah nilai menunjukkan keterbacaan teks pada setiap tampilan: **Text reads well**, **Large text only** atau **Hard to read as text**. Penilaian ini hanya menyangkut teks di atas warna tersebut; warnanya tetap dapat digunakan untuk bentuk dan area besar. Peran yang dimaknai berdasarkan nama saja menampilkan kata-kata yang sama tanpa warna peringatan, karena tidak ada alat yang secara otomatis meletakkan teks di atas peran itu. Tooltip dan pemilih menampilkan angkanya, APCA lebih dulu dan WCAG setelahnya. **Own text colour** menandai nilai yang filenya menyatakan warna teks; warna teks itu dipertahankan. **Copied** menandai nilai dari colourway lain atau dari warna pendamping yang belum dipilih siapa pun; **Keep this colour** di pemilih menetapkan nilai tersebut.

**Titik awal.** Design system tanpa peran sendiri menampilkan kata-kata yang berlaku saat ini: Primary, Secondary, Surface dan Text. Tidak ada yang ditulis sampai Anda mengubah salah satunya. **+ Add a role** menyarankan **Primary, Secondary** atau **Main, Accent, Supporting, Tertiary**, atau menerima kata apa pun yang Anda ketik, dan menampilkan pemaknaan yang akan didapat masing-masing. Dua kata pertama menjadi warna utama dan warna pendamping. Alat tetap menggambar warna yang sama. Pada sistem dengan satu warna utama, colourway pertama memakai nama warna tersebut.

**Mengganti nama, mengurutkan ulang, menghapus.** Mengganti nama hanya mengubah katanya; semua yang memakai peran tersebut tetap berfungsi. Seret peran dengan pegangannya, atau tekan Space pada pegangan, gunakan tombol panah lalu tekan Space untuk melepaskannya. **Remove** menunjukkan apa yang masih memakai peran tersebut. Jika alat membaca peran itu, **Remove and keep those colours** mempertahankan warna saat ini pada setiap pemaknaan. Aturan organisasi, grup panduan, field alat atau token lain yang memakai peran itu menahan peran tersebut sampai penggunaannya berubah. Dokumen Design tersimpan juga dapat memakai peran berdasarkan nama, dan Lolly tidak dapat mengetahuinya dari file token. Dokumen seperti itu melaporkan warna sebagai tidak terselesaikan.

::: details Peran dalam file token yang ditulis manual
**File yang ditulis manual.** Warna dalam file token yang tidak dinyatakan oleh peran mana pun tercantum di bawah **In this file, with no role yet**, masing-masing dengan field untuk kata dan **Make a role**. Dengan atau tanpa peran, warna tetap berfungsi berdasarkan nama. Token dengan angka dalam namanya tidak dapat menjadi peran; token tetap ada di file dan berfungsi melalui path-nya. Jika suatu rekaman dalam file tidak lolos validasi, tabel ditampilkan tanpa kontrol dan menjelaskan alasannya.
:::

**Bagian lain di ruang ini memakai kata-kata yang sama.** Chip, baris **Use as** pada sampel warna dan grup **Colour roles** pada palet semuanya memakai kata-kata design system. Ubin peran warna membuka nilainya. File yang diekspor tidak mencatat hal baru tentang peran; warna hasil render berubah karena tokennya berubah.

**Ke mana kata-kata itu dibawa.** Kata-kata dan deskripsi ikut bersama design system. Agen membacanya dalam brief desain, `lolly://tokens` dan `AGENTS.md` halaman merek. Terminal menampilkannya dalam `lolly system status`. Halaman merek mencantumkannya dalam `brand.json` dan mengukur pasangan kontras untuk setiap peran. File DTCG dan Tokens Studio menyimpan semuanya, `DESIGN.md` menyimpan kata-kata dan pemaknaannya, dan tema PowerPoint hanya menyimpan urutan merek. [Peran warna dalam format lain](/info/design-tokens.html#colour-roles-in-other-formats) memuat daftar lengkapnya. Kata-kata selalu dikutip sebagai data design system, tidak pernah dibaca sebagai instruksi.

**Tempat warna dipilih.** Setiap field warna di alat dan di Lolly Design mencantumkan peran design system lebih dulu, sesuai urutannya sendiri, beserta setiap kata dan tujuannya. **Aa** di samping peran memilih warna yang diletakkan di atas peran tersebut. Warna lain menyusul di bawah **Other colours**, tanpa salinan khusus colourway, warna yang diletakkan di atas warna lain dan pemaknaan yang sudah diisi peran. Pilihan tetap tertaut ke peran dan mengikuti colourway. Field menampilkan kata tersebut di setiap colourway, dan Settings serta Tokens juga memakai kata itu. Design system tanpa peran tetap memakai grid sampel warnanya.

### Setiap warna yang dibaca alat

Saat **Colour roles** ditutup, ruang ini dimulai dengan chip untuk keputusan awal. Setiap chip menampilkan warna peran dan namanya. Pada sistem tanpa kata-kata sendiri, chip tersebut adalah **Primary**, **Secondary**, **Surface** dan **Text**. Tekan chip untuk memilih warnanya dari sampel warna palet. **Every colour a tool reads**, di bagian bawah **Colour roles**, memuat deret lengkapnya.

Deret ini menampilkan tujuh warna yang dapat dibaca alat: Primary, Secondary, Surface, Text, Muted, Edge dan On primary, dengan kata-kata design system sendiri jika tersedia. Masing-masing menjalankan fungsi yang sama di setiap alat dan ekspor. Tidak ada yang wajib diatur, dan warna apa pun dapat mengisi salah satunya. Tiga warna terpisah dapat membentuk sistem yang baik. Hasil pengukuran menunjukkan keterbacaan teks di atas permukaan, dengan APCA lebih dulu. Setiap baris menampilkan warna Anda dengan intensitas penuh, warna awal sebagai pengganti atau **↳ follows Primary**.

On primary diturunkan dari warna primer, berlabel **Derived** dan tidak memiliki pemilih. Sakelar **Light** dan **Dark** di samping On primary, serta yang di samping **In context**, memilih tampilan yang ditunjukkan deret, palet dan pratinjau.

Aksen aplikasi secara default mengikuti design system, melalui pengaturan **Interface follows the design system** di **Settings → Appearance**. Jika pengaturan ini mati, bingkai antarmuka aplikasi tetap netral. Alat, kanvas dan ekspor tetap mengikuti design system dalam kedua keadaan.

**Colourway.** Design system dapat memuat beberapa warna utama, yang dipilih per karya. Baris **Colourways** di bagian atas **Colour roles** menampilkan satu chip per colourway, dengan **Default** pada colourway kanonis. **+ Add** memulai colourway baru dari warna palet. Pilih chip, lalu tabel, deret, palet dan pratinjau menampilkan colourway itu. Anda dapat mengganti nama, menduplikasi, menghapus atau menjadikan colourway terpilih sebagai default. Pada sistem dengan colourway, setiap colourway memerlukan warna primer dan sekunder sendiri, serta warna permukaan sendiri jika colourway mewarnai latar belakang. Peran-peran itu tetap terisi di editor sampel warna. [Tambahkan colourway ke design system](/info/colourways.html#add-colourways-to-a-design-system) memuat langkah dan format tokennya, dan [Lolly Demo saat digunakan](/info/lolly-demo-in-use.html#colourways-on-real-work) menunjukkan colourway pada pekerjaan nyata. Setiap orang dapat memilih colourway sendiri di **Settings → Appearance** ([Jadikan colourway milik Anda](/info/colourways.html#make-a-colourway-your-own)).

### Temukan lebih banyak warna

Tiga alat bertolak dari warna primer Anda. Dua alat pertama hanya memberi saran; alat ketiga mengganti palet.

::: cols
## Jelajahi nuansa & harmoni

Pilih **Starting colour**, **Scheme** (Mono, Complement, Analogous atau Triad) dan jumlah **Shades** (3 hingga 20, default 5). **Fine-tune** mengatur intensitas UI, kontras dan teks di atas warna merek. Klik nuansa warna untuk menambahkannya, atau **Add 5 shades** untuk satu grup. Warna dan peran Anda tetap ada.

## Temukan warna yang serasi

Pilih **Harmony**: Complementary, Adjacent, Triad, Tetrad atau Analogous (dengan **Accents** dari 2 hingga 5 dan **Angle** dari 10° hingga 45°). Setiap kandidat memiliki nama yang dihasilkan dan **+ Add**, satu tekanan per warna.

## Bangun ulang seluruh palet

Mengganti palet dari satu warna awal, setelah peninjauan atas apa yang berubah dan apa yang tetap.
:::

Ketiganya memakai perhitungan warna perseptual (OKLCH) yang sama dengan mesin. Di **Explore shades & harmonies**, baris **Primary**, **Neutral** dan **Secondary** menampilkan nuansa warna yang disarankan, dan **Theme preview** menampilkan contoh terang dan gelap beserta hasil pengukuran kontrasnya.

![Tiga grup nuansa warna yang disarankan, dengan kontrol penambahan per warna dan Theme preview terpisah](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

![Aksen yang dihasilkan, masing-masing dengan sampel warna, nama otomatis, nilai hex dan tombol Add](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&drive=click%3A.be-generate-detail%3Anot%28%5Bdata-be-rebuild%5D%29%20%3E%20summary%3Bwait%3A500&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### Menerapkan palet yang dihasilkan

Buka **Rebuild the whole palette…** dan tekan **Preview full rebuild**. Peninjauan menghitung jumlah peran yang tetap sesuai penetapan Anda, jumlah warna sendiri yang dipertahankan serta jumlah kurva gradasi, kunci cetak, nuansa tersembunyi dan titik gradasi yang ditautkan ulang atau dipertahankan. **Apply rebuilt palette** menerapkan perubahan; **Cancel** tidak mengubah apa pun. Setelahnya, kartu menawarkan **Undo** yang sudah mendapat fokus, dan checkpoint yang diambil sebelum penggantian memulihkan seluruh sistem.

Sistem dengan colourway mempertahankan setiap colourway saat dibangun ulang. Colourway kanonis mengikuti warna awal baru, dan setiap colourway lain mempertahankan warna, nama, urutan dan pengaturannya sendiri. Peninjauan mencantumkan colourway mana yang mengikuti dan mana yang mempertahankan warnanya. Lolly tidak membangun ulang sistem yang menyimpan colourway dengan cara yang tidak dapat dieditnya; kartu menjelaskan alasannya, dan tidak ada yang berubah.

### Bagian untuk pengguna ahli

Empat bagian terlipat berada di bawah pratinjau dan peran. Masing-masing dapat dibuka dengan `#/start?area=color&focus=<name>`:

- **Explore shades & harmonies** (`focus=generate`).
- **Shade curves** (`focus=curves`) membentuk ulang deret gradasi titik demi titik, dengan kurva kecerahan, kroma dan rona (L / C / H) terpisah serta nuansa warna yang digambar ulang saat Anda menyeret.
- **Contrast** (`focus=contrast`): **Contrast-lock** menyesuaikan warna deret gradasi agar mencapai target APCA terhadap latar belakang yang Anda pilih, dan **Rotate hue** memutar seluruh deret gradasi di sepanjang roda warna.
- **Print** (`focus=print`) mengatur hasil warna primer pada mesin cetak: nilai otomatisnya, komposisi CMYK yang dikunci atau tinta spot bernama.

### Palet dan setiap sampel warna

Palet mencantumkan warna Anda dalam grup yang dapat dilipat, masing-masing dengan **+ Add** sendiri. Anda dapat membuat dan mengganti nama grup. Peran tidak pernah membuat ubin kedua; ubin yang dirujuk peran menampilkan nama peran tersebut, misalnya **Primary**. **Colour chart** di bawah ubin menampilkan warna yang sama pada **Wheel** OKLCH (seret titik untuk mengubah warna, klik ruang kosong untuk menambahkan sampel warna) dan bagan **Gamut**, yang menunjukkan batas rentang yang dapat ditampilkan. `#/start?area=color&focus=chart` membuka bagan.

![Panel palet, setiap grup dapat dilipat](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-roles-fold%5D%3Esummary%3Bwait%3A500%3Bclick%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![Roda OKLCH - sudut menunjukkan rona, jarak dari pusat menunjukkan kroma dan warna abu-abu mengikuti rel kecerahan di sisi](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

Klik sampel warna untuk membuka editornya:

- **Rename** mengganti nama sampel warna.
- **Set the colour** mengatur warna dengan penggeser OKLCH, atau dalam **Hex**, **HSL**, **RGB** atau **CMYK**. Field nilai membaca dan menulis dalam ruang warna aktif. CMYK di sini mengatur warna layar melalui konversi; untuk mengunci tinta secara tepat, gunakan **Print substitutes**.
- **Stored as** memilih cara sampel warna disimpan: **LCH** (default, perseptual dan dengan gamut luas), Hex, RGB atau HSL.
- **Use as** memberi peran pada sampel warna, memakai kata-kata design system sendiri jika tersedia. Tekan lagi peran yang disorot untuk mengosongkan peran tersebut.
- **Print substitutes** (terlipat): kunci **CMYK** dari **Auto** ke nilai tinta yang tepat, atau atur **Spot colour** dengan **Name** (misalnya `PANTONE 186 C`), **Book** opsional dan **Finish** untuk foil, emboss, deboss, pernis spot, soft touch atau potong pola, garis lipatan atau perforasi. Mesin cetak memakai penguncian ini saat Anda mengekspor PDF atau TIFF CMYK; lihat [Profil warna](/info/exporting.html#colour-profiles). Tinta spot dicetak pada pelatnya sendiri dalam Print PDF; untuk mencetak setiap tinta spot sebagai warna proses dalam satu ekspor, lihat [Tinta spot sebagai warna proses](/info/exporting.html#spot-inks-as-process).
- **In other spaces** (terlipat): satu nilai per ruang warna, diturunkan atau ditetapkan oleh Anda, dan nilai yang Anda tetapkan diutamakan saat ekspor.

**Menghapus sampel warna** aman dilakukan. Nuansa turunan dan peran tema disembunyikan, sehingga semua yang membacanya tetap berfungsi. Warna yang Anda tambahkan dihapus.

::: details Bekerja dengan banyak sampel warna
Saat tidak digunakan, sampel warna menampilkan warna, nama dan hex-nya. Select menampilkan kotak centang dan pegangan seret setiap sampel warna pada layar apa pun, dan ubin dengan fokus keyboard juga menampilkan pegangannya. Seret pegangan untuk mengurutkan ulang dalam grup, atau fokuskan pegangan, tekan Space, gunakan tombol panah lalu tekan Space lagi untuk melepaskannya; Escape membatalkan. Di ponsel, palet menampilkan empat warna per baris. Untuk memindahkan warna antargrup, gunakan kontrol **Group** di editor atau pilih beberapa warna dan gunakan **Move to**.

Pemilihan tidak memerlukan sakelar terpisah: bilah dan kotak centang muncul saat ubin pertama dipilih dan hilang saat pilihan terakhir dikosongkan.

- **Seret di ruang kosong** untuk menggambar persegi panjang; setiap ubin yang disentuhnya ikut terpilih, melintasi grup. Bagian yang terlipat tidak menambahkan apa pun.
- **Shift-klik** memilih rentang menurut urutan baca, **Cmd/Ctrl-klik** mengaktifkan atau menonaktifkan pilihan satu ubin, dan klik biasa membuka editor.
- Setiap judul grup memiliki **Select all**, dan **Cmd-A** saat ubin mendapat fokus memilih setiap warna milik Anda, tidak pernah warna awal.
- Grid memiliki satu titik fokus Tab: tombol panah memindahkan fokus, Shift-panah memperluas pilihan, Space mengubah pilihan, Delete menghapus dan Escape mengosongkan pilihan. Untuk menggeser nilai kanal sedikit, tekan `l`, `c` atau `h` lebih dulu.
- Di layar sentuh, tekan dan tahan ubin untuk mulai memilih, lalu ketuk untuk menambahkan pilihan.

Bilah menampilkan **{n} selected**, lalu **Move to**, **Give a role** (setiap warna mendapat peran berikutnya secara bergiliran), **Download** (pilihan dalam salah satu dari enam format palet), **Duplicate** (salinan masing-masing, ditempatkan setelah aslinya), **Copy values** dan **Delete**. Satu salinan terbuka di editor; beberapa salinan tetap terpilih. Satu Cmd/Ctrl-Z membatalkan aksi massal.
:::

### Gradasi

Panel **Gradients** opsional membuat token campuran dari palet. Setiap gradasi memiliki pratinjau, 2 hingga 8 titik bernama dan sudut. Titik merujuk ke sampel warna, jadi saat Anda mengubah sampel warna, gradasi ikut berubah. Pencampuran berlangsung dalam OKLCH.

Unduhan palet (design tokens, CSS, SCSS, GIMP dan Adobe Swatch Exchange) berada di bagian atas palet. [Bawa palet dan font Anda ke mana saja](/info/using.html#take-your-palette-and-fonts-anywhere) menjelaskan setiap format.

<!--i:eti-type-->
## Tipografi

Jika belum memiliki font sendiri, ruang ini menampilkan satu kartu: **Primary**, dalam ukuran baca dengan font saat ini, dengan tag **Starter**, tombol **Choose for Primary** dan baris *"Tidak ada yang dipasang sampai Anda memilihnya."* Judul, kode dan huruf miring mengikuti font primer sampai Anda memilihnya; **Choose them separately** menampilkan kartu masing-masing.

![Ruang Type tanpa font yang dipilih - satu kartu dalam ukuran baca dengan tag Starter dan satu tombol Choose for Primary berisi warna](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&system=new-design-system&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

Pilih satu font dan ruang ini menampilkan empat kartu peran, daftar Fonts dan contoh langsung:

- **Primary**: teks isi, tombol dan setiap alat.
- **Headings**: font tampilan untuk `h1` dan `h2`.
- **Code**: font monospace untuk kode dan data.
- **Italic**: huruf miring asli untuk penekanan, kutipan dan catatan samping.

Kartu diberi warna hanya jika Anda memasang font tersebut. Tombolnya menampilkan peran: **Change Headings** pada font sendiri dan **Choose for Headings** pada yang lain. Baris contoh membungkus teks. Tidak ada aksi di kartu yang langsung menerapkan perubahan; tombol membuka area perbandingan untuk peran itu.

![Empat kartu peran yang ditampilkan - masing-masing memakai font yang mengisinya, dengan tag Starter jika belum dipilih dan Italic mengikuti font primer](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&system=new-design-system&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

### Area perbandingan

Area ini terbuka di bawah kartu yang Anda tekan. Kartu-kartu dilipat menjadi strip satu baris agar area ini terlihat pada layar pertama ponsel. Escape membatalkan dan mengembalikan fokus ke kartu.

1. Tekan **Choose for** beserta perannya pada kartu.
2. Ketik nama keluarga font dan tekan **Preview**, atau tekan salah satu dari enam keluarga font **Pinned** di bawah field.
3. Tekan **Use this face**.

![Area perbandingan terbuka di bawah kartunya, dengan baris pencarian, keluarga font yang disematkan dan kartu yang dilipat menjadi strip satu baris](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

**Persetujuan diminta sekali.** Saat pratinjau pertama kali mengakses Google Fonts, dialog menjelaskan: *Google mengetahui nama keluarga font dan alamat IP Anda. File lalu disimpan di perangkat ini dan digunakan offline. Inilah satu-satunya langkah di studio yang mengakses pihak ketiga.* **Fetch from Google** melanjutkan proses dan pilihannya diingat. **Cancel** membuat kartu menampilkan *"Belum diambil. Tidak ada yang dikirim ke Google."*, dengan **Fetch from Google** sendiri.

**Jatuhkan file font ke area ini** (TTF, OTF atau WOFF) untuk melihat pratinjau font berlisensi yang Anda miliki. Apa pun caranya, font tetap berada di perangkat ini, dirender offline di aplikasi, alat dan setiap ekspor, serta ikut dalam file design system. Semua yang ada di Google Fonts disediakan dengan lisensi terbuka (OFL, Apache atau UFL).

### Font di perangkat ini

Panel **Fonts** mencantumkan setiap font di perangkat ini dan peran yang diisinya. Font yang Anda tambahkan tampil lebih dulu, di bawah **In the design system**, masing-masing dengan peran dan tombol hapus. Font awal menyusul dalam satu baris redup yang terlipat. **Add a face** membuka area perbandingan untuk peran mana pun. Panel **Type roles** menampilkan contoh langsung setiap peran beserta keluarga dan statusnya, misalnya *Inter* atau *Inter · follows Primary*.

<!--i:eti-tag-->
## Token

Token adalah nilai bernama di balik design system: warna, font, logo, sudut dan jarak. Alat membacanya berdasarkan nama, sehingga perubahan di sini menjangkau setiap alat sekaligus.

![Ruang Tokens: bagian atas dengan contoh dari sistem dan aksi file, ubin yang menghitung setiap jenis token, lalu pasangan warna beserta hasil pengukuran kontrasnya](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **Bagian atas** memberi contoh dari sistem Anda sendiri (*Primary adalah Spearmint, #033633*) dan aksi file: **Download** (sistem sebagai design tokens, atau palet dalam lima format lain), **Copy CSS** dan **Add from…** untuk membaca kembali file JSON.
- **Ubin** menghitung setiap jenis token dan membuka bagiannya: Colours, Type, Logos, Shape and spacing, More dan All tokens. Bagian yang hanya memuat bawaan sistem awal kosong memakai tag **Starter**; sistem bawaan aplikasi menghitung materinya sendiri tanpa tag tersebut. Di ponsel, ubin tersusun menjadi dua baris berisi tiga.
- **Colours** dimulai dengan pasangan yang digunakan alat (teks di atas permukaan, teks di atas warna primer, teks redup di atas permukaan) beserta hasil pengukuran APCA dalam tampilan terang dan gelap, serta menandai **Weak contrast** jika pasangan tidak memenuhi syarat. Lalu setiap grup warna: deret gradasi sebagai satu baris chip, warna lain dengan nilai dan referensi yang digunakan alat, misalnya `{color.brand.spearmint}`. Tekan referensi untuk menyalinnya. **Edit in Colours** membuka grup di ruang Colours. Pada design system dengan [peran warna](#colour-roles-what-the-colours-are-called), **Colour roles** tampil lebih dulu, dengan setiap peran satu kali dalam kata-kata dan urutan sistem sendiri. Peran menyimpan warna untuk setiap colourway dan tampilan. Warna-warna itu dicantumkan bersama perannya, bukan sebagai warna terpisah; ubah di tabel Colour roles.
- **Type** dan **Logos** mencantumkan font untuk setiap peran dan setiap slot logo, dengan **Edit in Type** dan **Edit in Logos** setelah Anda memiliki font dan logo sendiri.
- **Shape and spacing** memuat **Rounded corners** (`shape.radius`) dan **Spacing rhythm** (`space.base`). Masing-masing menampilkan *Lolly default* sampai Anda menggerakkan penggeser dan *Yours* setelahnya, langsung disimpan dan dapat dibatalkan.
- **More tokens** menambahkan jarak, ukuran, lebar garis, opasitas, rotasi, angka biasa dan bayangan, yang disimpan sebagai [design tokens](/info/design-tokens.html) standar.
- **App appearance (advanced)** mencantumkan warna, ukuran dan bayangan yang dipakai layar Lolly sendiri, dan **Inspect every token (advanced)** mencari serta mengedit nilai tersimpan apa pun dan menampilkan setiap perubahan untuk ditinjau lebih dulu. Di sana, nilai peran warna dalam setiap colourway dicantumkan bersama perannya: pilih token peran untuk melihat satu baris per colourway, dengan tampilan terang dan gelap berdampingan. Baris jumlah menunjukkan berapa banyak nilai yang disimpan peran. Design system hanya-baca menampilkan daftar yang sama.

Bagian kosong menawarkan **Pick a colour**, **Choose a face** atau **Add a logo**.

<!--i:eti-images-->
## File

Jatuhkan file yang disimpan merek Anda, selain logo: file **vektor**, **gambar**, **audio** dan **gerak** (video, Lottie dan animasi). File muncul di [Assets](/info/using.html#assets-your-library), diurutkan ke dalam bagian, serta di pemilih aset setiap alat. File tetap berada di perangkat ini.

## Suara

**Sound** dipilih dengan mendengarkan. Ruang ini dibuka dengan tiga suara awal, **Calm**, **Steady** dan **Bright**, masing-masing berupa kartu dengan warna genrenya dan tombol putar. Putar salah satunya untuk mendengar cuplikan singkat; memulai yang lain menghentikan yang pertama. **Choose** menjadikan suara itu sebagai suara untuk setiap penggunaan. Kartu keempat, **Mixed**, memberi suara tersendiri pada setiap penggunaan: Calm untuk Explain, Steady untuk Demonstrate dan Bright untuk Play. Tombol putarnya memutar ketiganya secara bergiliran. Tidak ada yang disimpan sampai Anda memilih **Save sound**. Suara lalu menjadi bagian dari design system ini, dengan checkpoint dalam riwayat yang sama dengan yang dipakai ruang lain. Design system tanpa suara tetap berfungsi seperti sebelumnya.

Penggunaan adalah momen saat suara diputar: **Explain**, **Demonstrate** dan **Play** sebagai awal. Setiap penggunaan berupa chip dengan tombol putarnya sendiri. **Music** atau **With narration** di atas chip mengatur apakah chip memutar musik saja atau sebagai latar suara. Penggunaan yang Anda pilih menampilkan tujuan dan musiknya dengan kata-kata sederhana, misalnya "Hangat · 84 bpm · Rhodes, bas mengalun, drum kit bernuansa lawas". Setiap penggunaan memakai genre, tempo dan instrumen suara yang dipilih (atau, dengan Mixed, miliknya sendiri). Setiap penggunaan mempertahankan lagu dan keseimbangannya sendiri: Explain menjaga agar melodi tidak mengganggu suara, dan Play membiarkan melodi menonjol. Beralih antara Mixed dan satu suara mempertahankan keduanya. Penggunaan yang Anda tambahkan sendiri mempertahankan suaranya saat memakai Mixed. Design system mencatat pilihan Anda. **Add a use** menambahkan penggunaan dan memungkinkan Anda langsung mengetik namanya. **Make main** memilih penggunaan yang diputar saat tidak ada permintaan lain. **Another tune** memutar komposisi baru dengan pengaturan yang sama.

**Edit in the music generator** membuka [generator musik](/info/generated-music.html#the-music-generator) dengan pengaturan penggunaan tersebut, dengan baris di bagian atas yang menyatakan suara siapa yang sedang Anda edit. **Save to this use** membawa pengaturan kembali ke ruang ini; **Cancel** kembali tanpa perubahan. Pilihan yang belum disimpan di ruang ini menunggu selama Anda pergi. Jika seseorang menyimpan suara di tab lain sementara itu, hasil simpan terbaru tetap berlaku dan suntingan Anda tidak disertakan.

**Voice** memilih suara untuk penggunaan tersebut, kecepatan bicara dan tingkat volume musik di bawah suara; **Hear the voice with the music** memutar keduanya. Di bawah **More** terdapat penurunan volume saat suara berbicara, kata-kata untuk dicoba (tetap berada di ruang ini), catatan pelafalan (satu per baris, dalam bentuk tertulis = diucapkan) dan catatan tentang suara. Pratinjau memakai model ujaran lokal dan pencampuran yang sama dengan ekspor sekuens. Pratinjau memudar di akhir; akhir itu bukan penutup yang digubah.

**Notes and signature** memuat hal yang perlu didengarkan dalam penggunaan serta suara khas: pembuka atau penutup tetap yang disimpan sebagai file audio tersendiri. Tempatkan suara khas itu dalam sekuens Anda; musik yang dihasilkan tidak pernah menyertakannya. Persyaratan yang tidak dapat diperiksa oleh versi Lolly ini menghentikan pembuatan musik baru untuk penggunaan tersebut.

**Details** memuat karakter merek (kesan yang harus diberikan suara, hal yang tetap sama dan yang perlu dihindari) serta tinjauan hasil dengar. **Record a listening review** menyimpan nama peninjau, tanggal dan catatannya untuk versi suara yang tersimpan. Perubahan apa pun menjadikan suara sebagai draf lagi. Tinjauan mencakup versi tersebut, bukan setiap lagu yang dibuat dari suara itu kemudian: dengarkan setiap karya baru sebelum dirilis.

**Make a music project** membuka penggunaan di generator musik sebagai proyek yang menyimpan penggunaan, versi suara dan pengaturan persisnya. **New tune** di sana membuat komposisi baru dan mempertahankan suara. Jika Anda mengubah pengaturan, **Put the sound back** kembali ke suara tersebut, dan **Keep as my own** melanjutkan dengan lagu yang berdiri sendiri. Sampai Anda memilih, proyek tidak dapat disimpan atau diunduh sebagai karya yang dibuat dari suara tersebut. Tautan berbagi hanya membawa pengaturan musik. Proyek dan lagu tersimpan juga menyimpan catatan suara, yang tidak disertakan dalam tautan berbagi maupun kredensial publik file audio. Simpan rekaman hasil render jika audio persisnya harus tetap tersedia pada versi generator mendatang.

<!--i:eti-checklist-->
## Aturan

**Rules** mengatur apa yang dapat diubah orang, apa yang tetap dan apa yang dapat diperiksa Lolly.

![Rules pada Lolly Demo: empat aturan organisasi, masing-masing ditandai Checked in Design dan Required atau Advisory, lalu Try your design system in use dengan contoh yang siap dirender](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dusage&width=1440&height=1200&dpi=192&waitMs=2400&cropSelector=%23start-panel-usage&format=svg&walker=1&dark=1&filename=bs-usage-rules)

**Brand rules** mencantumkan aturan Anda. **Add rule** (atau **Add your first rule**) membuka formulir singkat:

- **Rule name** dengan kata-kata Anda sendiri, misalnya *Aksen Beacon*;
- **Check**: **Colour choices**, **Font choices**, **Fixed artwork** atau **Text length**, beserta peran merek yang dipakainya, dengan nama peran yang Anda berikan;
- **Example** yang dikenai aturan (Poster, Title slide, Content slide atau Lolly Chart), **Mode** dan apakah bersifat **Required** atau **Advisory**;
- **Reviewed by**, lalu **Save draft** atau **Approve & save**.

Persetujuan mencatat keputusan Anda sendiri di perangkat ini. Aturan wajib yang disetujui membatasi poster yang dapat digunakan ulang, dan pemeriksaan hanya mencakup PNG contoh; aturan tersebut tidak mengubah alat lain.

Aturan dalam file token design system, seperti pasangan warna yang disetujui, ketebalan dan perataan teks atau logo per permukaan, tercantum di sini sebagai **Checked in Design**. Lolly Design memeriksanya lapisan demi lapisan di kartu **Before you export** pada panel ekspor, dan `lolly check` melakukan hal yang sama untuk dokumen Lolly Design tersimpan ([Sebelum Anda mengekspor](/info/design.html#before-you-export)). Aturan yang belum memiliki pemeriksa dalam build ini dipertahankan sebagaimana diberikan dan ditandai **Unchecked**.

Lolly Demo membawa empat aturan organisasi yang disetujui. Judul utama tidak pernah ditulis seluruhnya dengan huruf kapital: aturan itu wajib, sehingga `lolly check` melaporkan judul utama dengan huruf kapital sebagai kesalahan. Tiga aturan lainnya bersifat saran. Teks isi rata kiri. Logo primer ditempatkan pada permukaan terang dan logo versi terbalik pada permukaan gelap. Garis putus-putus berarti jatuhkan di sini.

**Try your design system in use** merender empat contoh dari revisi saat ini dengan **Render & check examples**. Pilih **Mode** dan **Try your own text** untuk judul, teks pendukung dan teks slide. Setiap contoh melaporkan apa yang diukur, dengan **See checks & sources** dan **Download check report**. **Make reusable poster** mengunduh `.lolly` dengan tata letak tetap dan pilihan input yang disetujui. Contoh bersifat lokal: menjalankan pemeriksaan tidak menerbitkan atau menyetujui apa pun.

Build yang disertai merek tetap menampilkan aturan dan contoh yang sama dalam mode hanya-baca, di bawah *This brand is set*.

<!--i:eti-graduation-cap-->
## Skill

**Skills** mencantumkan [skill merek](/info/brand-skills.html) dari design system aktif: standar tertulis merek, satu per disiplin, untuk manusia dan agen AI. Setiap baris menampilkan disiplin, status yang ditetapkan merek (**Draft** atau **Approved**), apakah skill bersifat publik atau internal dan revisinya. Pilih baris untuk membaca skill beserta cakupannya, yang membandingkan baris-baris skill dengan token Anda: apa yang diperiksa Lolly, apa yang bertentangan, apa yang sesuai dan apa yang hanya berupa panduan.

**Download skill (.zip)** menulis skill sebagai folder Agent Skills untuk alat agen, dengan tautan katalog yang mengarah ke Lolly ini. **Copy as one file** menaruh teks yang sama di clipboard untuk jendela chat. Design system tanpa skill sendiri mencantumkan acuan dasar yang ditulis Lolly dari token dan aturan organisasinya setiap kali acuan dasar dibaca. Ruang ini membaca skill dan tidak pernah mengeditnya.

<!--i:eti-upload-->
## Masukkan merek

**Add from…** di bilah membuka pemilih yang menanyakan apa yang Anda miliki, bukan formatnya:

- **Design tokens or a design file**: JSON DTCG atau Tokens Studio, proyek Penpot, zip berisi kumpulan token, paket design system Lolly, SVG, `DESIGN.md` atau folder halaman merek.
- **PDF**: deck atau file panduan, dibaca di perangkat ini untuk mengambil warna, logo dan font tersematnya.
- **Logo or screenshot**: gambar menjadi palet yang disarankan, dibaca di perangkat ini. Yang dibaca adalah warna, bukan font atau tata letak.
- **Saved web page**: satu file HTML dan file CSS-nya, atau HTML atau CSS yang ditempel, hingga 20 file dan 2 MB. Hanya teks yang Anda berikan yang dibaca: sumber daya tertaut tidak diambil dan skrip tidak dijalankan.
- **Font file**: TTF, OTF atau WOFF. Membuka ruang Type, tempat font dipasang.
- **Website**: satu halaman, dibaca warna dan tipografinya. Ubin ini hanya muncul di perangkat yang dapat membaca halaman, dan menyebut pembaca yang dipakainya: aplikasi di perangkat ini, atau ekstensi browser di tab latar belakang, dengan Anda sebagai pengguna yang masuk. Mengetik URL hanya mengisi field; menekan tombol ambil berarti memberi persetujuan.

Pilih sumber file desain dan kartu berikutnya mencantumkan format yang diterima sebagai ubin ikon. Seluruh kartu menjadi satu area jatuh. Anda juga dapat menjatuhkan file ke studio.

![Kartu impor - format yang diterima tampil lebih dulu sebagai ubin ikon, dan seluruh kartu menjadi satu area jatuh](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

- **Paket design system Lolly** (`.lolly`, atau `.zip` lama) dipasang dalam satu langkah.
- Ekspor **Penpot** (`.penpot`) membawa design tokens-nya.
- File **Design Tokens** (W3C DTCG) atau **Tokens Studio** (`.json`) membawa tokennya. Deskripsi yang meminta pembaca mengabaikan instruksi, mengklaim izin atau meminta kode dijalankan tidak disertakan, dan proses impor menyebutkan letaknya.
- **SVG biasa** dipindai untuk menemukan warna yang dapat Anda pilih, dengan warna pertama menjadi warna primer Anda.
- **`DESIGN.md`** (`.md`) menuju **Try these colours** dengan token sebagaimana tertulis. Prosanya dapat disimpan sebagai draf skill merek, dan kartu menandai baris yang meminta pembaca mengabaikan instruksi, mengklaim izin atau menjalankan kode. Agen dan halaman merek tidak melihat draf sampai Anda menekan **Keep this skill** di ruang Skills, dan skill yang disimpan tetap bersifat internal.
- **Folder halaman merek**, dipilih sebagai folder, dijatuhkan atau dikompresi sebagai zip, menuju peninjauan yang sama. Setiap file diperiksa terhadap `brand.json` folder tersebut; satu file yang tidak cocok menyebabkan seluruh folder ditolak. Impor menambahkan token. Logo dan font tetap berada di folder.

::: warning Pemeriksaan instruksi membaca baris demi baris
Pemeriksaan yang menyisihkan instruksi dalam deskripsi file token membaca baris demi baris dan melewatkan redaksi lain. Baca file dari orang yang tidak Anda kenal sebelum menerapkan tokennya.
:::

Lolly membaca halaman merek dari file yang Anda berikan. Lolly tidak mengambil konten dari alamat situs lain.

### File dengan kata-kata warna sendiri

File token atau `DESIGN.md` dapat memakai kata-katanya sendiri untuk warna, misalnya utama, aksen, pendukung dan tersier. Saat Lolly menemukan kata-kata tersebut, peninjauan mencantumkan setiap kata sebelum apa pun diterapkan: kata, warnanya di setiap tampilan, token asalnya dan pemaknaan yang disarankan Lolly. Lolly menyarankan pemaknaan hanya dari kata-katanya, berdasarkan daftar singkat, tanpa model. Kata di luar daftar diterima sebagai kata milik merek sendiri, **By name only**. Anda dapat mengganti nama kata apa pun, menjelaskan tujuannya, memberinya pemaknaan lain atau menghapus centangnya agar tetap menjadi warna bernama.

**Install with these roles** menulis peran; **Install without roles** memasang file sebagaimana diterima. File tanpa kata-kata tersebut melewati langkah ini. File yang menyatakan perannya sendiri, seperti file yang ditulis Lolly, menampilkannya sebagaimana tertulis dan memasangnya tanpa perubahan; Anda dapat mengeditnya nanti di ruang Colours. Terminal tidak memiliki peninjauan: `lolly system import` mempertahankan rekaman yang dinyatakan dan membiarkan kata-kata dalam file lain sebagai warna bernama.

### Tinjau referensi

Logo, tangkapan layar, situs web atau halaman tersimpan membuka **Try these colours**: contoh dengan warna yang diusulkan, **Main colour** yang dapat Anda ubah dan nama untuk sistem baru. Sebuah kotak menjelaskan akibat penerapan: **mengganti** pengaturan token aktif dengan palet yang dihasilkan dan gaya default, **mempertahankan** font serta file pustaka Anda dan sistem sebelumnya dapat **dipulihkan**. **Apply suggested settings** mengambil checkpoint, lalu menerapkan palet terang dan gelap. **Restore brand settings** dapat mengembalikan pengaturan lama. **Change reference** memilih sumber lain.

::: details Apa yang dibaca dari referensi, dan laporan konteks desain
**Palette, source details and individual choices** menampilkan apa yang dibaca, nama font yang ditemukan dan kontras pratinjau. Nama font hanya saran; Anda memasang font di Type. Detail sumber dapat mencakup tipografi, jarak, padding dan nilai sudut jika teramati, atau berlabel **Not observed** jika tidak. Pembacaan halaman tersimpan atau situs web secara native melaporkan gaya yang dideklarasikan, yang mungkin tidak dipakai halaman. Ekstensi browser dapat melaporkan gaya yang diukur dari sampel elemen terlihat. Ini adalah hasil pengamatan: tidak ada yang dipasang, dan jarak dari sumber tidak pernah mengganti jarak Anda sendiri. **Choose individual items in the tray** menyimpan item satu per satu. **Download design context** menyimpan laporan JSON berisi hasil pengamatan, token yang diusulkan dan informasi sumber (dengan SHA-256 dari HTML atau CSS yang diberikan). Laporan tidak memuat teks mentah halaman dan bukan Content Credential yang ditandatangani.
:::

Impor PDF dan file desain tetap memiliki kontrol peninjauan masing-masing. Item di **Tray** tidak mengubah apa pun sampai Anda menambahkannya di ruang yang menangani jenis materi tersebut. `#/start?source=<kind>` membuka pemilih pada suatu sumber (`file`, `pdf`, `image`, `font`, `url`, `page`), dan `?import` membuka daftar biasa.

### Temukan dan bandingkan tampilan

Buka **Find a look** dari Board atau dari daftar design system di Settings. Jelajahi sistem yang tersimpan di perangkat ini dan beberapa contoh Lolly yang dapat digunakan ulang, lalu cari berdasarkan nama, tag warna atau font yang dideklarasikan. **Closest to my current palette** mengurutkan berdasarkan kemiripan warna yang diukur, dengan font yang cocok sebagai penentu jika hasilnya sama; ini bukan skor kualitas.

Klik tampilan untuk melihat pratinjaunya dalam konteks; pratinjau tidak mengubah apa pun. **Use this look** pada kartu menerapkan tampilan tersebut. Sistem tersimpan menjadi sistem aktif, tanpa mengedit apa pun. Warna contoh masuk ke design system yang terbuka setelah checkpoint seperti biasa. Logo, font dan hal lain dalam sistem yang tidak ditentukan contoh tetap seperti semula. **Compare looks** menambahkan kotak centang ke setiap kartu: pilih dua untuk dibandingkan berdampingan. **Restore brand settings** memulihkan tampilan sebelumnya. Sistem tersimpan memiliki **Search tags** yang dapat diedit di bawah **Details and design context**. Contoh-contohnya adalah racikan warna asli Lolly, tanpa koleksi hasil scraping dan tanpa akun.

![Lolly membandingkan Sunroom dan Orchard berdampingan sebelum menerapkan salah satu sistem warna.](/t/url-shot?url=%2F%23%2Fstart&width=1280&height=900&dpi=96&waitMs=3000&format=svg&filename=brand-compare-looks&try=1&drive=click%3A%5Bdata-ds-door%3D%22looks%22%5D%3Bwait%3A500%3Bclick%3A%5Bdata-looks-compare-toggle%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Asunroom%22%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Aorchard%22%5D%3Bclick%3A%5Bdata-looks-review%5D%3Bwait%3A500&cropSelector=.ds-looks-comparison&waitSelector=%5Bdata-ds-door%3D%22looks%22%5D&walker=1&rasterDpi=96)

<!--i:eti-package-->
## Simpan dan pindahkan design system Anda

### Pindahkan merek antarperangkat

**Export** menulis satu file **`LollyBrand-….lolly`**: token, font, logo dan preferensi tema Anda, dengan manifes integritas yang diperiksa saat impor. Rilis web sebelum 1.0.7 menamai file dengan `.zip`, dan Lolly masih menerima penamaan itu. **Tokens (.json)** menulis dokumen design tokens biasa, tanpa font atau logo, untuk repositori, langkah build atau alat token lain.

Untuk memasukkannya kembali, gunakan **Add from… → Design tokens or a design file**, atau jatuhkan file ke studio. Beginilah rekan menyerahkan merek kepada Anda atau Anda membawanya ke instalasi kedua, tanpa akun dan tanpa cloud. [Bekerja dengan mitra](/info/partners.html) membahas apa lagi yang perlu dikirim saat penerima merek Anda bekerja untuk organisasi lain. Untuk memasukkan merek dari baris perintah, lihat [`ingest:brand`](/info/configuration.html#brand-packs).

**Fonts for Linux (.rpm)** mengemas font yang Anda tambahkan menjadi RPM yang dapat dipasang. Jika Anda mengunggah sendiri salah satunya, Lolly terlebih dahulu meminta Anda mengonfirmasi bahwa Anda boleh mendistribusikannya kembali.

### Pulihkan pengaturan sebelumnya

Buka **More** di bilah, pilih **Restore brand settings**, pilih checkpoint bertanggal dan tekan **Restore**. Ini memulihkan warna, pengaturan tipografi dan token lain untuk merek aktif; file font dan gambar tetap seperti semula. Lolly terlebih dahulu menyimpan pengaturan saat ini sebagai **Before restore**, sehingga Anda dapat membalikkan pemulihan bahkan setelah menutup browser. 20 checkpoint terbaru disimpan di perangkat ini. Suntingan yang dibuat saat studio menampilkan **Saving…** tetap ada setelah pemuatan ulang, dan sebuah kartu menawarkan pemulihan perubahan yang belum selesai disimpan.

### Versi

Versi yang diterbitkan adalah **salinan permanen bernama** yang disimpan di perangkat ini. Versi itu tidak pernah berubah, sehingga alat atau tautan yang menguncinya (dengan `designv`) terus menggambar hal yang sama. Sistem yang memuat sesuatu milik Anda mencantumkan **Versions & publishing** di menu **More** pada bilah; setelah penerbitan pertama, **Versions** bergabung dengan ruang lainnya. `#/start?area=versions` membuka Versions.

::: warning Versi yang diterbitkan bersifat permanen
Belum ada penghapusan, dan panel menyatakannya. Penerbitan tidak dapat dibatalkan; pemulihan dapat dibatalkan. *Restore latest from this version* adalah suntingan biasa, dengan **Undo** langsung ditawarkan.
:::

**Penghapusan tampil paling atas di kartu kompatibilitas**, karena token yang dihapus membuat alat tidak berfungsi.

**Publish only** menyimpan versi tanpa mengubah apa yang diikuti alat; **Publish and make active** membuat alat dan aplikasi mengikuti versi itu. **Follow the latest again** langsung memberlakukan setiap suntingan.

### Terbitkan halaman merek

[Halaman merek](/info/brand-page.html) adalah satu alamat untuk manusia dan agen: halaman berisi logo, warna, tipografi dan contoh, dengan fakta yang sama dalam file pendamping. **Publish a brand page**, di bawah Versions & publishing, menampilkan halaman langsung dan, di sampingnya:

- **Goes public**: setiap file, dikelompokkan, beserta ukurannya.
- **Held back**: apa yang tidak disertakan dan alasannya. Logo tanpa lisensi tercatat tidak disertakan sampai Anda mencentang nama logo. File font memerlukan lisensi tercatat yang mengizinkan penerusan, dan halaman menampilkan contoh berupa kontur jika file tidak disertakan. Skill merek internal tidak pernah muncul.
- **What was checked**: pasangan warna per colourway dan mode, serta aturan organisasi. Ini hasil pengukuran, bukan putusan.
- **In your words**: pernyataan penggunaan dan kontak. Halaman menampilkan apa yang Anda tulis dan Lolly tidak menambahkan lisensi atau klaim hukum. Sakelar mematikan baris "Made with Lolly" di footer.
- **On exports**: sakelar yang [mencatat alamat halaman dalam ekspor design system ini](/info/brand-page.html#lead-back-from-your-files). Sakelar ini mati sampai Anda menyalakannya, memerlukan alamat `https` dan tidak ikut bersama paket atau salinan. Design system terkunci tidak menampilkan sakelar karena pengelolanya yang memutuskan.

**Download folder** menyimpan folder sebagai ZIP agar Anda dapat menghostingnya di tempat pilihan Anda. Tidak ada yang menjadi publik sampai Anda menghosting folder. Di terminal, `lolly system publish --out=<dir>` menulis folder yang sama. Instans yang menyajikan halaman merek juga menawarkan **Publish to** alamatnya: satu tekanan eksplisit, melalui rantai persetujuan instans jika ada. Design system terkelola hanya menerbitkan jika pengelolanya mengizinkan.

### Hubungkan agen

**Connect an agent**, di tempat yang sama, memberi teks untuk ditempel dan menjelaskan kemampuan setiap opsi:

- **`AGENTS.md`** dalam proyek: agen membaca nama dan aturan sistem. Ini tidak menggambar apa pun dan tidak memerlukan server.
- **Lolly's public server**: menggambar dengan Lolly Demo, apa pun sistem yang Anda buka di sini. Tidak memerlukan kunci.
- **Your instance**: menggambar dengan sistem yang disimpan instans, dan membaca token layanan dari variabel lingkungan. Lembar ini memberi nama variabel dan tidak pernah menampilkan token.

Jika tidak ada server yang dihosting yang menggambar dengan sistem Anda, lembar ini menyatakannya.

<!--i:eti-layers-->
## Kelola design system Anda

Buka **Settings → Preferences → Design systems** untuk beralih, menambah atau menghapus sistem. **Open** memilih sistem dan membukanya di sini; **Make a new one** membuat sistem lokal dan membukanya dengan field nama yang siap diisi. Satu sistem aktif pada satu waktu untuk seluruh perangkat. [Arsitektur merek](/info/brand-architectures.html) membantu menentukan kapan merek memerlukan design system sendiri.

**Asal sistem.** Sistem yang disediakan katalog suatu deployment berlabel **Came with this app**, atau **From this instance** di aplikasi yang terhubung ke instans. Bentangkan **Catalogue source** untuk melihat penyedianya, aset token dan namespace-nya serta versi atau checksum yang diketahui; jika penyegaran gagal, materi dalam cache diberi label.

**Sistem terkelola bersifat hanya-baca.** Sistem berlabel **Managed by this instance** (atau **Managed by this app** di aplikasi desktop tanpa instans) jika katalognya mengunci sistem. Anda dapat menggunakan dan mengunduh sistem terkelola. Membukanya di sini menampilkan catatan hanya-baca dengan **Make an editable copy** dan **Switch**, lalu peran warna dan tokennya tanpa kontrol penyuntingan. Sistem lokal Anda sendiri tetap dapat diedit, meskipun sistem terkelola ada lebih dulu. Build dengan satu merek tetap membuka Lolly Design System Setup pada *This brand is set*, dengan token merek dan aturan penggunaan yang dapat dibaca.

**Setiap sistem bawaan lainnya menjadi milik Anda** untuk disembunyikan, diedit dan direset, termasuk Lolly Demo dan Lolly Starter di lolly.tools. Mengeditnya mempertahankan namanya dan menandai baris **Edited here**. **Reset to original** dalam menunya membuang perubahan yang dibuat di perangkat ini. Sistem awal kosong adalah pengecualian: perubahan pertama di sana memulai design system milik Anda sendiri, dan Lolly sekali saja menanyakan namanya. [Lolly Demo saat digunakan](/info/lolly-demo-in-use.html#switch-to-your-own) menunjukkan apa yang digantikan sistem Anda sendiri.

### Menghapus design system

Pilih **Remove** dari menu sistem; konfirmasi menyatakan sistem mana yang akan aktif setelahnya. Sesi tersimpan, unggahan dan materi yang dibagikan dengan sistem lain tetap ada.

Menghapus sistem bawaan hanya menyembunyikannya: aset katalognya tetap ada, **Bring back** menampilkannya lagi dan sistem kembali sendiri jika Anda menghapus semua yang lain. Menghapus salinan yang diimpor atau diedit tidak menghapus sistem bawaan, logo atau fontnya. Jika salinan tadi aktif, sistem bawaan menjadi aktif lagi. Menghapus salinan aktif yang dihosting hanya menghapus koneksi salinan itu; instans yang dipilih secara terpisah tetap terpilih.

::: details Mengubah design system yang disediakan server
Mengubah apa yang disediakan server adalah tugas administrator: operatornya mengubah katalog sumber dan melakukan deployment ulang, atau administrator Lolly Work meninjau dan menerapkan perubahan server. Suntingan di sini tetap lokal, dengan satu pengecualian. Pada instans Lolly Work yang memberi Anda `brand.edit`, sistem terkelola juga menawarkan **Edit for** instans tersebut, yang membuka salinan untuk diedit. **Send to** instans tersebut di **Versions** mengirim kembali warna, colourway, peran warna dan alamat halaman mereknya. [Edit instans ini dari studio](/info/work-design-system-administration.html#edit-this-instance-from-the-studio) membahas apa yang dapat diubah suntingan dan cara instans menyajikan perubahan itu. Lihat [Menghapus design system katalog](/info/configuration.html#removing-a-catalogue-design-system) dan [Konfigurasi](/info/configuration.html#supplied-and-local-design-systems).
:::

<!--i:eti-code-->
## Gunakan konteks desain di luar aplikasi

**Download design context** menyimpan dokumen token, warna yang sudah diselesaikan, keluarga font yang dideklarasikan, id aset, bukti sumber jika tercatat, cakupan dan aturan eksplisit, tanpa file font dan tanpa bukti kepemilikan. Baris perintah membaca file tanpa server: `lolly system import` menjadikannya design system terminal dan `lolly system check` memeriksa input Lolly Design terhadap konteks tersimpan. [Bawa design system Anda](/info/cli.html#bring-your-design-system) membahas impor dan [Design system yang digunakan perintah](/info/cli-decks.html#which-design-system-a-command-uses) membahas pemeriksaan. Klien MCP membaca brief yang sama dari `lolly://design-context` ([Server MCP](/info/mcp.html)).

<!--i:eti-map-pin-->
## Ke mana selanjutnya

- **[Menggunakan Lolly](/info/using.html)**: alat, penyimpanan, berbagi dan Assets.
- **[Arsitektur merek](/info/brand-architectures.html)**: bagaimana divisi, produk, merek yang didukung merek induk, klien dan musim dipetakan ke design system, colourway dan identitas logo.
- **[Bekerja dengan mitra](/info/partners.html)**: membagikan merek Anda kepada mitra dan bekerja dengan merek yang diberikan kepada Anda.
- **[Halaman merek](/info/brand-page.html)**: terbitkan design system Anda di satu alamat, sebagai kit pers dan kit agen.
- **[Design Tokens](/info/design-tokens.html)**: model token yang dipakai untuk menulis merek Anda.
- **[Ekspor file](/info/exporting.html)**: satuan cetak, CMYK dan format hasil render merek Anda.
