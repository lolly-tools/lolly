# Bekerja dengan mitra

Banyak karya membawa dua merek, seperti logo sponsor pada poster acara, penawaran reseller dengan nama produsen, pengumuman bersama atau studi kasus yang ditulis bersama pemasok. Halaman ini ditujukan untuk kedua pihak.

Di halaman ini, **merek utama** adalah merek yang design system-nya dipakai untuk membuat karya, dan **mitra** adalah merek lain pada karya tersebut. Salah satu pihak dapat membuat karya itu. [Arsitektur merek](/info/brand-architectures.html#co-branding) membandingkan penggunaan merek bersama dengan pengaturan merek lainnya.

<!--i:eti-info-->
## Cara Lolly menangani dua merek saat ini

- **Satu design system menggambar setiap karya.** Warna, tipografi dan aturan organisasi merek utama berlaku. Logo mitra dimasukkan sebagai karya grafis: gambar dari Assets, atau logo kustom yang disimpan dalam design system.
- **Merek dibawa sebagai file.** File design system (`.lolly`) membawa token, font dan logo. Alat yang dapat digunakan ulang yang dibuat dengan **Share with rules** membawa satu tata letak jadi dengan input yang Anda izinkan. Skill merek dibawa sebagai file tersendiri.
- **Merek juga dapat memiliki alamat.** [Halaman merek](/info/brand-page.html) menerbitkan logo, warna, tipografi dan aturan untuk dibaca mitra, beserta token dan skill untuk alat mereka.
- **Lolly hanya memeriksa aturan merek utama.** Lolly tidak mengetahui aturan mitra, seperti ruang bebas atau ukuran minimum, jadi periksa hal-hal itu terhadap panduan mitra. Dalam program mitra Lolly Work, kit mitra suatu perusahaan memuat aturannya, dan Lolly Design memeriksa logo perusahaan terhadap kit tersebut.
- **Seluruh program mitra berjalan di Lolly Work.** Saat reseller, distributor atau mitra lain membuat karya dengan merek Anda di Lolly Work Anda, program mitra memberi setiap perusahaan mitra hanya alat, file dan templat yang Anda pilih. Program menyimpan logo dan detail perusahaan, mengisikannya ke templat Anda dan mencatat perusahaan dalam setiap file. [Jalankan program mitra](/info/manage/run-a-partner-programme.html) adalah panduan bagi tim yang menjalankannya.

<!--i:eti-folder-shared-->
## Bagikan merek Anda kepada mitra

### Pilih apa yang akan dikirim

| Kirim | Cara | Yang didapat mitra | Cocok untuk |
| --- | --- | --- | --- |
| File design system | **Export** di bilah atas [Lolly Design System Setup](/info/brand-studio.html#move-a-brand-between-devices) | Token, font, logo dan preferensi tema Anda, sebagai design system yang dapat mereka gunakan | Mitra yang membuat banyak karya dengan merek Anda |
| Alat yang dapat digunakan ulang | Di Lolly Design, **Share with rules** ([Bagikan desain dengan aturan](/info/create-a-tool.html)) | Satu tata letak jadi dengan input yang Anda izinkan, seperti nama dan logo mereka. File membawa warna yang sudah diselesaikan, font dan gambar, sehingga design system mereka sendiri tidak dapat mengubah gaya karya grafis yang tetap | Selebaran, lencana atau spanduk dengan merek bersama yang diisi setiap mitra |
| Skill merek | Ruang **Skills**: **Download skill (.zip)** atau **Copy as one file** | Standar tertulis Anda, untuk orang dan agen mereka | Salah satu dari dua pilihan di atas, saat agen mengerjakan sebagian pekerjaan |
| Halaman merek | **Publish a brand page** di Lolly Design System Setup, atau `lolly system publish`, menulis folder yang Anda hosting ([Halaman merek](/info/brand-page.html)) | Logo, warna, tipografi dan aturan terkini Anda di satu alamat, beserta token dan skill untuk alat mereka. Logo dan file font muncul jika haknya mengizinkan, dan halaman mencantumkan apa yang tidak disertakan | Berbagi dengan orang yang tidak Anda kirimi file |
| Token | **Tokens (.json)** di menu **More** studio | Dokumen design tokens biasa, tanpa font atau logo | Alat desain atau build milik mitra sendiri |

![Lolly Design System Setup pada Lolly Demo, terbuka di ruang Skills: Export di bilah, menu More terbuka pada Tokens (.json) serta Download skill (.zip) dan Copy as one file di samping skill yang dipilih](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dskills&width=1200&height=900&dpi=192&waitMs=1800&waitSelector=.skills-reader-actions&drive=click%3A%5Bdata-ds-more%5D%3Bwait%3A500&format=svg&walker=1&dark=1&filename=partners-send)

::: warning Font Anda ikut dalam file
Font yang Anda tambahkan ikut di dalam file design system, jadi periksa apakah lisensinya mengizinkan Anda meneruskan file tersebut.
:::

Alat yang dapat digunakan kembali meminta konfirmasi sebelum menyertakan gambar yang dibatasi lisensinya ([Pratinjau dan bagikan](/info/create-a-tool.html#preview-and-share)).

### Buat templat dengan merek bersama

Alat yang dapat digunakan kembali menjaga elemen setiap mitra dalam tata letak Anda. Mitra hanya mengubah apa yang Anda izinkan.

1. Di Lolly Design, buat karya dalam design system Anda. Gambar kotak gambar untuk logo mitra dan sisakan ruang di sekeliling kotak sesuai kebutuhan tata letak.
2. Pilih **Share with rules** dari menu File. Pilih kotak gambar dan pilih **Make editable**. Di **Rules**, izinkan unggahan pengganti, tetapkan ukuran piksel minimum dan format unggahan yang Anda terima (SVG jika memungkinkan). Atur **Image fit** kotak ke **Contain (fit inside)** agar logo yang lebar atau tinggi tetap di dalam kotak.
3. Buat nama atau penawaran mitra juga dapat disunting, dengan batas karakter.
4. Tekan **Preview** dan coba logo yang sangat lebar, logo yang sangat tinggi dan nama yang panjang.
5. Pilih **Share .lolly** dan tulis petunjuk untuk mitra: versi logo mana yang harus diunggah, misalnya logo horizontal berwarna penuh untuk latar belakang terang.

![Share with rules pada kartu acara dengan merek bersama: kotak logo mitra dipilih dan dapat disunting, dan Rules-nya mengizinkan unggahan gambar berukuran setidaknya 480 kali 110 piksel, dalam PNG atau SVG](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%255B%257B%2522id%2522%253A%2522board%2522%252C%2522name%2522%253A%2522Build%2520day%2520card%2522%252C%2522kind%2522%253A%2522frame%2522%252C%2522x%2522%253A0%252C%2522y%2522%253A0%252C%2522w%2522%253A1600%252C%2522h%2522%253A900%252C%2522shape%2522%253A%2522rect%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.sugar%257D%2522%252C%2522clipChildren%2522%253Atrue%257D%252C%257B%2522id%2522%253A%2522dot-large%2522%252C%2522name%2522%253A%2522Large%2520circle%2522%252C%2522kind%2522%253A%2522box%2522%252C%2522x%2522%253A1040%252C%2522y%2522%253A70%252C%2522w%2522%253A480%252C%2522h%2522%253A480%252C%2522shape%2522%253A%2522circle%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.pandanus%257D%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522dot-small%2522%252C%2522name%2522%253A%2522Small%2520circle%2522%252C%2522kind%2522%253A%2522box%2522%252C%2522x%2522%253A1330%252C%2522y%2522%253A380%252C%2522w%2522%253A240%252C%2522h%2522%253A240%252C%2522shape%2522%253A%2522circle%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.green-apple%257D%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522band%2522%252C%2522name%2522%253A%2522Partner%2520band%2522%252C%2522kind%2522%253A%2522box%2522%252C%2522x%2522%253A0%252C%2522y%2522%253A680%252C%2522w%2522%253A1600%252C%2522h%2522%253A220%252C%2522shape%2522%253A%2522rect%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.avocado%257D%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522lolly%2522%252C%2522name%2522%253A%2522Lolly%2520logo%2522%252C%2522kind%2522%253A%2522image%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A96%252C%2522w%2522%253A260%252C%2522h%2522%253A90%252C%2522image%2522%253A%2522lolly%2Flogo%2Fhorizontal%2522%252C%2522fit%2522%253A%2522contain%2522%252C%2522imgpos%2522%253A%2522left%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522headline%2522%252C%2522name%2522%253A%2522Headline%2522%252C%2522kind%2522%253A%2522text%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A260%252C%2522w%2522%253A880%252C%2522h%2522%253A180%252C%2522text%2522%253A%2522Build%2520day%25202026%2522%252C%2522fg%2522%253A%2522%257Bcolor.brand.liquorice%257D%2522%252C%2522fontSize%2522%253A120%252C%2522weight%2522%253A%2522700%2522%252C%2522font%2522%253A%2522display%2522%252C%2522align%2522%253A%2522left%2522%252C%2522valign%2522%253A%2522middle%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522sub%2522%252C%2522name%2522%253A%2522Subtitle%2522%252C%2522kind%2522%253A%2522text%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A450%252C%2522w%2522%253A880%252C%2522h%2522%253A90%252C%2522text%2522%253A%2522Twelve%2520hours%2520of%2520making%252C%2520with%2520friends%2522%252C%2522fg%2522%253A%2522%257Bcolor.brand.basalt%257D%2522%252C%2522fontSize%2522%253A48%252C%2522align%2522%253A%2522left%2522%252C%2522valign%2522%253A%2522middle%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522with%2522%252C%2522name%2522%253A%2522In%2520partnership%2520with%2522%252C%2522kind%2522%253A%2522text%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A750%252C%2522w%2522%253A400%252C%2522h%2522%253A80%252C%2522text%2522%253A%2522In%2520partnership%2520with%2522%252C%2522fg%2522%253A%2522%257Bcolor.brand.basalt%257D%2522%252C%2522fontSize%2522%253A34%252C%2522align%2522%253A%2522left%2522%252C%2522valign%2522%253A%2522middle%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522partner%2522%252C%2522name%2522%253A%2522Partner%2520logo%2522%252C%2522kind%2522%253A%2522image%2522%252C%2522x%2522%253A500%252C%2522y%2522%253A735%252C%2522w%2522%253A480%252C%2522h%2522%253A110%252C%2522image%2522%253A%2522%2Ftools%2Flogo-wall%2Fassets%2Fpartner-name.svg%2522%252C%2522fit%2522%253A%2522contain%2522%252C%2522frame%2522%253A%2522board%2522%257D%255D%26w%3D1600%26h%3D900&width=1280&height=1000&dpi=192&waitMs=3000&drive=click%3Abutton%5Baria-label%3D%22File%20menu%22%5D%3Bwait%3A500%3Bclick%3Atext%3DShare%20with%20rules%3Bwait%3A2500%3Bclick%3A%23tool-canvas%20%5Bdata-box-id%3D%22partner%22%5D%3Bclick%3Abutton%3Ahas-text%28%22Make%20editable%22%29%3Bwait%3A1200%3Bclick%3A.dr-input%20.dr-advanced%20%3E%20summary%3Bpress%3AControlOrMeta%2BA%7Con%3D%5Bdata-rule%3D%22image%3AminWidth%22%5D%3Bpress%3A4%3Bpress%3A8%3Bpress%3A0%3Bpress%3AControlOrMeta%2BA%7Con%3D%5Bdata-rule%3D%22image%3AminHeight%22%5D%3Bpress%3A1%3Bpress%3A1%3Bpress%3A0%3Bclick%3A%5Bdata-rule%3D%22image-format%3Ajpeg%22%5D%3Bclick%3A%5Bdata-rule%3D%22image-format%3Awebp%22%5D%3Bclick%3A%5Bdata-rule%3D%22image-format%3Aavif%22%5D&format=svg&walker=1&dark=1&filename=partners-template-rules)

Mitra menyeret file ke Lolly, meninjau permintaan kepercayaan, mengisi input dan mengunduh format yang Anda izinkan ([Gunakan alat yang sudah jadi](/info/create-a-tool.html#use-the-finished-tool)). Lolly menjaga logo di dalam kotak yang Anda gambar. Lolly tidak membaca aturan ruang kosong mitra, jadi logo hanya mendapat ruang yang Anda sisakan di sekeliling kotak.

### Berikan skill merek Anda kepada agen

Skill memandu orang dan agen. Lolly memeriksa aturan organisasi.

- Di Lolly Design System Setup, buka ruang **Skills** (`#/start?area=skills`), pilih skill dan tekan **Download skill (.zip)**. Tautan katalog folder mengarah ke Lolly Anda, dan `lolly.json`-nya mencatat asal salinan tersebut. **Copy as one file** menaruh teks yang sama di clipboard untuk jendela chat.
- Dari terminal, `lolly system skill <name> --into=<dir>` menulis folder yang sama ([Dalam folder untuk alat agen lokal](/info/brand-skills.html#in-a-folder-for-a-local-agent-tool)).
- Komputer Anda sendiri mencantumkan skill bertanda `internal` maupun `public`, jadi pilih mana yang akan dikirim ([Skill publik dan internal](/info/brand-skills.html#public-and-internal-skills)).
- Untuk design system yang tidak memiliki skill sendiri, Lolly menulis panduan dasar dari token dan aturan organisasinya, dan ruang itu mencantumkan panduan dasar tersebut.
- Salinan tidak memperbarui dirinya sendiri. Saat Anda menerbitkan revisi baru suatu skill, kirim foldernya lagi.

<!--i:eti-download-->
## Bekerja dengan merek yang diberikan kepada Anda

Untuk mitra yang menerima file design system. Bila merek utama menjalankan program mitra di Lolly Work miliknya sendiri, Anda masuk di sana: beranda Anda terbuka pada kartu perusahaan Anda dan templat yang diterbitkan untuk Anda ([Yang dilihat mitra](/info/manage/run-a-partner-programme.html#what-partners-see)).

1. **Buka file.** Seret file ke Lolly atau tekan **Open**; **Add from…** di Lolly Design System Setup juga menerima file tersebut. Pratinjau mencantumkan isi file sebelum apa pun ditulis. File design system menambahkan design system terpisah dengan nama merek utama dan mengaktifkannya. Design system Anda sendiri tetap di perangkat. File yang menghubungkan aplikasi ke Lolly milik merek utama terlebih dahulu mencantumkan dampaknya pada seluruh perangkat Anda; [Gunakan Lolly di organisasi Anda](/info/organisation.html) membahas jenis file tersebut.
2. **Kenali mereknya.** Di Lolly Design System Setup, **Board** menampilkan isi design system, **Logos** memuat logonya dan **Rules** mencantumkan aturan organisasi yang diperiksa Lolly. **Skills** menampilkan panduan dasar yang ditulis Lolly dari token dan aturan; skill milik merek utama datang sebagai file terpisah, jika mereka mengirimkannya.
3. **Beralih antar merek.** **Settings → Preferences → Design systems** mengganti design system untuk seluruh perangkat, dan **Settings → Design system** memiliki deretan sampul untuk beralih. Selesaikan karya untuk satu merek sebelum beralih.
4. **Tempatkan logo Anda sendiri.** Unggah logo Anda ke **Assets**, tempat logo tersedia di setiap design system, atau tambahkan sebagai **logo kustom** dalam design system merek utama (ruang **Logos**, **Custom marks**), tempat logo ikut dalam file design system tersebut. Design system yang menampilkan gembok bersifat hanya baca, jadi gunakan Assets di sana. [Tempatkan logo mitra](#place-a-partner-s-mark) memuat pemeriksaannya.
5. **Periksa sebelum mengekspor.** Di Lolly Design, kartu **Before you export** pada panel ekspor mencantumkan temuan terhadap aturan organisasi merek utama, lapisan demi lapisan ([Sebelum mengekspor](/info/design.html#before-you-export)). Kartu **Design system** menampilkan design system yang dicatat file.
6. **Kirim kembali hasilnya.** Kirim file hasil ekspor atau desain yang dapat disunting sebagai `.lolly` ([Berbagi pekerjaan Anda](/info/using.html#sharing-your-work)). Desain terbuka dalam design system mana pun yang aktif, jadi merek utama membuka desain Anda dengan design system mereka sendiri yang aktif.

::: note File design system tidak diperbarui
File design system adalah salinan merek pada hari ekspor. Tidak ada yang memperbarui salinan tersebut.
:::

Saat merek utama mengirim file yang lebih baru, buka file dengan cara yang sama. Lalu periksa design system mana yang aktif di **Settings → Preferences → Design systems** dan hapus salinan lama di sana saat Anda tidak lagi membutuhkannya.

![Design systems di Settings: Lolly Demo aktif, Lolly Starter memiliki tombol Use yang mengganti design system untuk seluruh perangkat, dan Open or import a file menerima file design system](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddesign-systems-section&width=1440&height=1200&dpi=192&waitMs=2400&cropSelector=%23design-systems-section&format=svg&walker=1&dark=1&filename=partners-design-systems)

<!--i:eti-image-->
## Tempatkan logo mitra

| Cara | Langkah | Cocok untuk |
| --- | --- | --- |
| Gambar di Assets | Seret file ke area unggahan di **Assets**, lalu pilih di field gambar alat, atau di Lolly Design dengan **Image** dari menu tambah pada rel | Karya sekali pakai. Unggahan milik perangkat, jadi tersedia dalam design system mana pun yang aktif |
| Logo kustom | Ruang **Logos**, **Custom marks**: ketik nama logo, lalu **Choose file…** | Mitra yang sering bekerja sama dengan Anda. Logo milik design system dan ikut dalam filenya |
| Susunan logo jadi | Buat susunan dari kedua logo di alat gambar Anda, lalu tambahkan sebagai logo kustom | Susunan logo "bersama" atau "bermitra dengan" yang digunakan berulang kali |

::: check Sebelum mengekspor, periksa logo
- **File yang tepat.** Gunakan file yang diberikan mitra, SVG jika tersedia. Logo yang disalin dari halaman web atau slide menjadi buram saat dicetak.
- **Versi yang tepat untuk latar belakang.** Gunakan versi negatif atau satu warna pada latar belakang gelap atau ramai, jika panduan mitra menyediakannya.
- **Proporsi.** Atur **Image fit** kotak gambar ke **Contain (fit inside)**, dan logo tidak akan meregang.
- **Ruang kosong dan ukuran.** Sisakan ruang di sekeliling logo sesuai panduan mitra dan jaga agar logo di atas ukuran minimum mereka. Lolly tidak mengukur keduanya.
- **Merek mana yang utama.** Atur ukuran kedua logo sesuai panduan kedua merek tentang merek mana yang utama.
- **Hak.** Lolly menampilkan lisensi yang tercatat untuk aset katalog. File yang Anda unggah sendiri tidak memiliki catatan lisensi, dan detailnya berbunyi *Licence not recorded*, jadi simpan izin mitra untuk menggunakan logo mereka bersama catatan Anda sendiri ([Hak dan kredit kreatif](/info/creative-rights.html)).
:::

![Before you export pada kartu dengan merek bersama: design system-nya adalah Lolly Demo, logo mitra tercatat sebagai gambar di luar aset design system, dan keempat aturan organisasi tidak memiliki catatan](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%255B%257B%2522id%2522%253A%2522board%2522%252C%2522name%2522%253A%2522Build%2520day%2520card%2522%252C%2522kind%2522%253A%2522frame%2522%252C%2522x%2522%253A0%252C%2522y%2522%253A0%252C%2522w%2522%253A1600%252C%2522h%2522%253A900%252C%2522shape%2522%253A%2522rect%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.sugar%257D%2522%252C%2522clipChildren%2522%253Atrue%257D%252C%257B%2522id%2522%253A%2522dot-large%2522%252C%2522name%2522%253A%2522Large%2520circle%2522%252C%2522kind%2522%253A%2522box%2522%252C%2522x%2522%253A1040%252C%2522y%2522%253A70%252C%2522w%2522%253A480%252C%2522h%2522%253A480%252C%2522shape%2522%253A%2522circle%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.pandanus%257D%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522dot-small%2522%252C%2522name%2522%253A%2522Small%2520circle%2522%252C%2522kind%2522%253A%2522box%2522%252C%2522x%2522%253A1330%252C%2522y%2522%253A380%252C%2522w%2522%253A240%252C%2522h%2522%253A240%252C%2522shape%2522%253A%2522circle%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.green-apple%257D%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522band%2522%252C%2522name%2522%253A%2522Partner%2520band%2522%252C%2522kind%2522%253A%2522box%2522%252C%2522x%2522%253A0%252C%2522y%2522%253A680%252C%2522w%2522%253A1600%252C%2522h%2522%253A220%252C%2522shape%2522%253A%2522rect%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.avocado%257D%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522lolly%2522%252C%2522name%2522%253A%2522Lolly%2520logo%2522%252C%2522kind%2522%253A%2522image%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A96%252C%2522w%2522%253A260%252C%2522h%2522%253A90%252C%2522image%2522%253A%2522lolly%2Flogo%2Fhorizontal%2522%252C%2522fit%2522%253A%2522contain%2522%252C%2522imgpos%2522%253A%2522left%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522headline%2522%252C%2522name%2522%253A%2522Headline%2522%252C%2522kind%2522%253A%2522text%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A260%252C%2522w%2522%253A880%252C%2522h%2522%253A180%252C%2522text%2522%253A%2522Build%2520day%25202026%2522%252C%2522fg%2522%253A%2522%257Bcolor.brand.liquorice%257D%2522%252C%2522fontSize%2522%253A120%252C%2522weight%2522%253A%2522700%2522%252C%2522font%2522%253A%2522display%2522%252C%2522align%2522%253A%2522left%2522%252C%2522valign%2522%253A%2522middle%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522sub%2522%252C%2522name%2522%253A%2522Subtitle%2522%252C%2522kind%2522%253A%2522text%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A450%252C%2522w%2522%253A880%252C%2522h%2522%253A90%252C%2522text%2522%253A%2522Twelve%2520hours%2520of%2520making%252C%2520with%2520friends%2522%252C%2522fg%2522%253A%2522%257Bcolor.brand.basalt%257D%2522%252C%2522fontSize%2522%253A48%252C%2522align%2522%253A%2522left%2522%252C%2522valign%2522%253A%2522middle%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522with%2522%252C%2522name%2522%253A%2522In%2520partnership%2520with%2522%252C%2522kind%2522%253A%2522text%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A750%252C%2522w%2522%253A400%252C%2522h%2522%253A80%252C%2522text%2522%253A%2522In%2520partnership%2520with%2522%252C%2522fg%2522%253A%2522%257Bcolor.brand.basalt%257D%2522%252C%2522fontSize%2522%253A34%252C%2522align%2522%253A%2522left%2522%252C%2522valign%2522%253A%2522middle%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522partner%2522%252C%2522name%2522%253A%2522Partner%2520logo%2522%252C%2522kind%2522%253A%2522image%2522%252C%2522x%2522%253A500%252C%2522y%2522%253A735%252C%2522w%2522%253A480%252C%2522h%2522%253A110%252C%2522image%2522%253A%2522%2Ftools%2Flogo-wall%2Fassets%2Fpartner-name.svg%2522%252C%2522fit%2522%253A%2522contain%2522%252C%2522frame%2522%253A%2522board%2522%257D%255D%26w%3D1600%26h%3D900&width=1440&height=1000&dpi=192&waitMs=3000&drive=click%3A.edge-dock-tab%3Ahas-text%28%22Export%22%29%3Bwait%3A2500%3Bclick%3A%5Bdata-action%3D%22preflight-open%22%5D%3Bwait%3A1200&cropSelector=.preflight-modal&format=svg&walker=1&dark=1&filename=partners-before-export)

Pada hasil ekspor, [catatan design system](/info/exporting.html#the-design-system-record) memuat design system dan colourway merek utama. Catatan itu tidak mencatat merek mitra, kecuali dalam program mitra Lolly Work, yang juga memuat perusahaan mitra dan program yang menjadi tujuan karya tersebut.

### Berikan skill setiap merek kepada agen

Saat agen mengerjakan tugasnya, berikan skill kedua merek apa adanya dan beri tahu agen merek mana yang utama. Skill setiap merek mempertahankan nama dan id-nya sendiri. Lolly tidak menggabungkan skill dua merek atau memutuskan merek mana yang menang.

<!--i:eti-grid-->
## Dinding logo sponsor dan acara

Alat [Lolly Logo Wall](/#/tool/logo-wall) menyusun logo ke dalam grid yang merata untuk papan sponsor, slide mitra atau latar pers. Pada acara, penyelenggara biasanya menjadi merek utama: dinding dibuat dalam design system penyelenggara, dan logo setiap sponsor ditempatkan di dinding sebagai karya seni.

![Dinding sponsor dalam tiga tingkat pada latar hijau gelap, setiap logo digambar putih: dua mitra Gold, tiga mitra Silver dan lima mitra Community, setiap tingkat di bawah judulnya sendiri dan setiap tingkat di bawahnya berukuran lebih kecil](/t/url-shot?url=%2F%23%2Ftool%2Flogo-wall%3Flogos%3D%255B%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fyour-logo.svg%2522%252C%2522tier%2522%253A%2522Gold%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Flogo-here.svg%2522%252C%2522tier%2522%253A%2522Gold%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fcompany.svg%2522%252C%2522tier%2522%253A%2522Silver%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fsponsor.svg%2522%252C%2522tier%2522%253A%2522Silver%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fbrand-name.svg%2522%252C%2522tier%2522%253A%2522Silver%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fsample-co.svg%2522%252C%2522tier%2522%253A%2522Community%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fexample.svg%2522%252C%2522tier%2522%253A%2522Community%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Florem-ipsum.svg%2522%252C%2522tier%2522%253A%2522Community%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fplaceholder.svg%2522%252C%2522tier%2522%253A%2522Community%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fpartner-name.svg%2522%252C%2522tier%2522%253A%2522Community%2520partners%2522%257D%255D%26columns%3D3%26gap%3D64%26padding%3D96%26background%3D033633%26headingColor%3Dffffff%26vectorizeAll%3Dtrue%26inkColor%3Dffffff%26transparentBg%3Dfalse&width=1440&height=900&dpi=192&waitMs=4000&cropSelector=%23tool-canvas&format=svg&walker=1&filename=partners-logo-wall&try=1)

1. Buka Lolly Logo Wall dan seret logo ke **Logos**. Setiap logo mendapat kontrolnya sendiri.
2. Beri setiap logo **Tier**, misalnya "Mitra Gold". Setiap tingkat mendapat barisnya sendiri, sesuai urutan kemunculan pertama tingkat tersebut, di bawah judulnya sendiri; **Tier headings** menonaktifkan judul. Dengan **Tier sizes** pada **Step down**, setiap tingkat di bawahnya memuat satu logo lagi per baris, sehingga tingkat yang lebih tinggi tampak lebih besar. **Presence** dan **Size %** menyesuaikan satu logo di dalam tingkatnya.
3. Biarkan **Balance sizes** aktif. Lolly Logo Wall mengatur ukuran setiap logo berdasarkan bobot visualnya, sehingga logo yang berat mengecil dan logo yang ringan membesar dan setiap tingkat tampak seimbang.
4. **Trim margins** memangkas setiap logo hingga batas karya seninya. Nonaktifkan opsi ini jika file logo sudah menyertakan ruang kosong yang diminta pemiliknya.
5. **Remove white backgrounds** menghapus kotak putih yang sering menyertai logo yang disalin dari slide.
6. Atur **Columns**, jarak dan padding di bawah **Layout**. **Background** dimulai dengan warna permukaan design system Anda.
7. Untuk dinding satu warna, aktifkan **Render all as vector** dan pilih **Ink colour**, atau atur **Filter** satu logo ke **Greyscale**. Gunakan versi satu warna hanya jika panduan setiap sponsor mengizinkannya.
8. Untuk latar pers, pilih **Grid**, **Brick** atau **Checker** di bawah **Step & repeat** dan atur jumlah **Rows**.

Ekspor dinding sebagai PNG, SVG, PDF atau PDF CMYK untuk cetak. Atur ukuran dan bentuk lain di panel ekspor, seperti story vertikal 1080 x 1920 atau halaman A4, dan kanvas menata ulang dinding untuk mengisi bentuk tersebut, dengan lebih sedikit atau lebih banyak logo di setiap baris. Ekspor sesuai dengan kanvas. Untuk menempatkan dinding di poster, pilih **Image** dari menu tambah pada rel di Lolly Design, gambar bingkai dan pilih Lolly Logo Wall pada tab **Tools** di pemilih ([Alat di dalam desain](/info/design.html#tools-inside-a-design)). Untuk keterangan di antara logo, **Dynamic layout** yang diatur ke **grid** di Lolly Design memuat satu kotak gambar per logo ([Tata letak di Lolly Design](/info/design-layout.html#dynamic-layouts)).

Di terminal, `lolly run logo-wall logos/*.png --output=wall.svg` membuat dinding dari folder gambar, dan CSV dengan kolom `logo` dan `tier` membuat dinding bertingkat. SVG dan PNG tidak memerlukan browser ([Dinding sponsor bertingkat](/info/cli-rendering.html#a-sponsor-wall-with-tiers)).

Saat sponsor menerbitkan [halaman merek](/info/brand-page.html), `lolly run logo-wall --logos-from=<address or folder>` mengambil logo terbaru mereka untuk permukaan tersebut dan mencetak keterangan penggunaannya dari halaman mereka. Ulangi flag untuk setiap sponsor.

Lolly Logo Wall tidak mengetahui aturan sponsor mana pun. Tiers dan Presence mengatur ukuran relatif satu sama lain, bukan ukuran minimum sponsor, dan tidak ada yang memeriksa ruang kosong di antara logo yang bersebelahan. Periksa dinding yang sudah jadi terhadap panduan setiap sponsor pada ukuran cetak atau tampilannya.

<!--i:eti-hammer-->
## Yang belum dilakukan Lolly

- Karya digambar dalam satu design system. Warna, tipografi dan aturan mitra bukan design system di dalam karya, dan logo mitra adalah gambar.
- Di luar program mitra Lolly Work, aturan mitra tidak disimpan atau diperiksa di aplikasi: ruang kosong, ukuran minimum dan perlakuan yang diizinkan seperti satu warna atau negatif.
- Kit mitra, paket ringan yang memuat logo, warna dan aturan mitra untuk digunakan dalam karya merek lain, hanya masuk ke aplikasi melalui program mitra Lolly Work. Di tempat lain, pemeriksaan kit dijalankan dari terminal: `lolly check --kit=<file>` mengukur logo mitra dalam dokumen Lolly Design ([Periksa hasil pembuatan ulang](/info/cli-decks.html#check-the-recreation)).
- Lolly tidak menghasilkan susunan dari dua logo untuk pengaturan "bersama", "bermitra dengan" atau "oleh". Tambahkan susunan logo jadi sebagai logo kustom.
- Satu design system aktif untuk seluruh perangkat, jadi dua merek tidak dapat dibuka berdampingan.
- File design system yang diekspor dari aplikasi tidak membawa skill merek, jadi kirim skill sebagai file tersendiri.
- Logo yang diambil dari halaman merek adalah gambar di barisnya, dan baris itu tidak mengingat halamannya. Tidak ada yang menunjukkan siapa penerbit halaman, jadi periksa sendiri alamatnya.
- Aplikasi web yang dihosting tidak dapat mengambil halaman merek lain, karena Content Security Policy-nya hanya mengizinkan host yang disebutkan. Ambil logo di terminal, atau simpan file dan tambahkan di **Assets**.

<!--i:eti-map-pin-->
## Ke mana selanjutnya

- **[Arsitektur merek](/info/brand-architectures.html)**: penggunaan merek bersama, white label dan pengaturan lainnya, beserta cara melakukannya di Lolly.
- **[Jalankan program mitra](/info/manage/run-a-partner-programme.html)**: apa yang didapat mitra di Lolly Work Anda dan cara menyiapkan serta menjalankan program.
- **[Bagikan desain dengan aturan](/info/create-a-tool.html)**: alat yang dapat digunakan kembali dengan tata letak tetap dan input yang Anda pilih.
- **[Skill merek](/info/brand-skills.html)**: cara menulis, membaca dan menyerahkan skill kepada agen.
- **[Lolly Design System Setup](/info/brand-studio.html)**: logo, logo kustom dan memindahkan design system antar perangkat.
- **[Halaman merek](/info/brand-page.html)**: terbitkan merek Anda di satu alamat dan ambil logo mitra dari halaman mereka.
- **[Hak dan kredit kreatif](/info/creative-rights.html)**: apa yang dicatat Lolly tentang karya yang digambarnya.
