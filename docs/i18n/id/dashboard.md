# Settings

Settings adalah tempat Anda mengubah cara Lolly bekerja untuk Anda: detail Anda, design system yang Anda pakai, aksesibilitas, apa yang disimpan di perangkat ini, dan apa yang siap offline. Buka dengan **Settings** di bilah dasar layar beranda, atau dari menu avatar Anda. Ia terbuka di **Preferences**, dengan empat tab lain di sampingnya.

| Tab | Alamat | Isinya |
|---|---|---|
| **Preferences** | `#/settings` | Detail Anda, design system, tampilan, emoji, aksesibilitas, koneksi, penyimpanan, dan unduhan offline |
| **This device** | `#/settings?tab=device` | Pembacaan langsung browser dan mesin ini, ditambah suara dan tampilan penyimpanan hanya-baca |
| **Design system** | `#/settings?tab=brand` | Design system aktif sebagai sampul dan halaman, dengan strip sampul untuk berpindah sistem |
| **Capabilities** | `#/settings?tab=caps` | Semua yang dapat dilakukan Lolly, sebagai kartu yang dapat dicari |
| **Activity & stats** | `#/settings?tab=activity` | Katalog, penghitung lokal Anda, dan pekerjaan terbaru |

Setiap tab memiliki alamat sendiri, dan tautan lama `#/profile` dan `#/d` tetap membuka tempat yang benar, hingga pengaturan individual.

## Preferences

Preferences adalah satu halaman panjang dengan **rel pengaturan** di sisi dan field **Search settings** di atas rel yang menyaringnya saat Anda mengetik. Setiap bagian terbuka langsung dari tautan berbentuk `#/settings?focus=<section-id>`, misalnya `#/settings?focus=storage-section`.

- <!--i:usercheck--> **Your details** - nama, detail kontak, dan foto profil Anda, serta sakelar **Use my details to create**. [Profiles](/info/profile.html) menjelaskan bagaimana alat memakainya.
- <!--i:seal--> **Content Credentials** - identitas terverifikasi opsional yang menandatangani ekspor Anda. Lihat [Content Credentials](/info/content-credentials-identity.html).
- <!--i:palette--> **Design systems** - beralih, tambah, sembunyikan, atau hapus design system. [Design System Setup](/info/brand-studio.html#manage-your-design-systems) membahas setiap aksi.
- <!--i:moon--> **Appearance** - tema (Light, Dark, atau Brand, yang mewarnai aplikasi dengan palet Anda) dan **Interface follows the design system**.
- <!--i:sparkle--> **Emoji** - set tempat emoji Anda digambar saat memulai sesuatu yang baru, beserta lisensi karyanya, dan seberapa kuat palet Anda mewarnai ulang emoji (**Off**, **Subtle**, **Strong**, **Full**, **Mono**, atau **Duotone**). **Keep skin tones and flags** membiarkan keduanya dalam warna aslinya. Pekerjaan yang sudah Anda buat mempertahankan set yang dipakai saat dibuat.
- <!--i:eyeoff--> **Accessibility** - empat sakelar kenyamanan, ditambah Sound dan Neurospicy Mode. Lihat [Accessibility](#accessibility).
- <!--i:link--> **Connected services** - penyimpanan yang Anda hubungkan, seperti Dropbox, Google Drive, OneDrive, Nextcloud, atau S3, dan **Sync across devices**. Lihat [Sync your devices](/info/sync.html).
- <!--i:globe--> **Trusted sites** - situs yang boleh dihubungi kotak halaman web Design atau demo Sandbox tanpa bertanya, dan, bila server menawarkannya, **Allow pages from any site**. [Privacy Policy](/info/privacy.html) mencantumkan apa yang dikirim setiap permintaan.
- <!--i:download--> **Your renders** - **Save my renders to my library** menyimpan salinan setiap gambar, klip audio, dan video yang Anda unduh di Assets, dengan tag Renders.
- <!--i:database--> **Storage** - apa yang disimpan Lolly di perangkat ini, dan tombol untuk membersihkan atau membawa data Anda. Lihat [Storage](#storage).
- <!--i:cpu--> **Available offline** - unduh apa yang Anda perlukan sebelum koneksi hilang. Lihat [Available offline](#available-offline).
- <!--i:folder--> **Hot folder** - di aplikasi desktop, awasi satu folder dan tarik apa pun yang dijatuhkan ke dalamnya ke Lolly, melalui pemilih yang sama seperti seret-dan-lepas.
- <!--i:clock--> **Your activity** - apa yang telah Anda buat di perangkat ini, dihitung secara lokal.
- <!--i:sliders--> **Feature flags** - nyalakan atau matikan bagian aplikasi, seperti **Print preflight** atau **Strip metadata from uploads**.
- <!--i:server--> **Lolly instance** - dari mana instalasi ini mendapatkan alat dan katalognya. Lihat [Lolly instance](#lolly-instance).

Kartu tema adalah pratinjau langsung dan berlaku begitu Anda memilih satu, hanya di perangkat ini.

![Three theme cards, each previewing its own type and colour, with the active one flagged](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dappearance-section&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

### Accessibility

**Settings → Preferences → Accessibility** memuat empat pengaturan kenyamanan untuk aplikasi di sekitar pekerjaan Anda. Masing-masing mati sampai Anda menyalakannya, dan tidak satu pun menjangkau ke dalam kanvas alat atau ekspor, sehingga aplikasi yang lebih tenang tidak pernah menggeser satu piksel pun dari file yang Anda kirim.

- <!--i:pause--> **Reduce motion** mematikan transisi, slide, dan hiasan aplikasi. Kanvas dan ekspor animasi Anda tetap bergerak sesuai desain.
- <!--i:photos--> **Hide colourful previews** mengganti karya pratinjau galeri dengan kartu ikon-dan-teks yang tenang, dan menenangkan thumbnail proyek agar tetap dikenali tanpa menyolok.
- <!--i:sliders--> **High contrast** memperkuat batas, teks, dan cincin fokus aplikasi. Warna brand dan kanvas Anda tetap seperti yang Anda atur.
- <!--i:font--> **Large text** memperbesar label, menu, dan teks tombol aplikasi. Tipografi di dalam desain Anda tidak tersentuh, jadi tidak ada yang Anda ekspor berubah tata letaknya.

Pengaturan ini berada di profil Anda, jadi ikut dalam ekspor profil dan tiba di instalasi berikutnya bersama nama dan sesi Anda. Salinan kecil khusus perangkat menerapkannya sebelum penggambaran pertama.

Kartu yang sama memuat **Sound**, lapisan lembut suara bantu untuk apa yang Anda lakukan (tiba di galeri, hasil Content Credentials, menutup panel), dan **Neurospicy Mode**, trek fokus yang tenang. Menyalakan Neurospicy membuka pemutar kecil di sudut yang mengikuti Anda di seluruh aplikasi. Di sana Anda memilih trek, melewati, mengatur volume, dan meminimalkan atau menutup pemutar. Trek mencakup lagu prosedural *Lolly Sings*, loop ambient dan beat, audio Anda sendiri, dan stasiun radio internet, yang memerlukan koneksi. Keduanya mati secara default dan diingat, dan mematikan Sound membisukan trek fokus juga. Menu profil dan **This device** memiliki sakelar yang sama.

Antarmuka dapat dinavigasi dengan keyboard, kontrol kustom membawa label untuk pembaca layar, dan pratinjau langsung setiap alat diekspos sebagai satu gambar berlabel yang menjelaskan apa yang ditampilkannya.

### Storage

Pengukur penyimpanan memperhitungkan setiap byte yang disimpan instalasi ini, kategori demi kategori, terhadap apa yang dilaporkan browser.

![Pengukur penyimpanan, merinci sesi tersimpan, gambar, dan cache terhadap apa yang sebenarnya dilaporkan browser](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

Di bawah pengukur:

- **Move to another device** memiliki **Export my data**, **Import data…**, dan **Export my data & render everything**. [Move your work to another device](/info/find-your-work.html#move-your-work-to-another-device) menelusurinya.
- **Clear cache** membuang file katalog yang diunduh, yang diunduh lagi bila diperlukan.
- **Remove automatic checkpoints older than 30 days** membebaskan ruang History dan mempertahankan versi tersimpan dan bernama.
- **Clear all my data** menghapus semua yang disimpan Lolly di browser ini, setelah Anda mengetik sebuah kata untuk konfirmasi. [If you clear your browser data](/info/find-your-work.html#if-you-clear-your-browser-data) mencantumkan apa yang hilang.

### Available offline

Lolly men-cache layar saat Anda mengunjunginya, yang hanya mencakup tempat yang sudah Anda datangi. **Available offline** untuk perjalanan yang sudah Anda lihat akan datang: unduh bagian yang akan Anda perlukan dan perhatikan satu bilah kemajuan, dan semua yang Anda ambil tetap berfungsi tanpa koneksi.

- <!--i:monitor--> **App, catalogue and guides** - **The app** (setiap tampilan, editor, dan font, termasuk layar yang belum pernah Anda buka), **Catalogue** (seluruhnya, atau **Choose by tag**), dan **Guides & docs** (dokumentasi ini dalam bahasa Anda, termasuk tangkapan layar).
- <!--i:cpu--> **AI models** - setiap model di perangkat pada barisnya sendiri dengan ukurannya: Speech voices, Upscaling models, Background removal, Text recognition, Verify deep scan, Durable credential, Rewriter model, Ask matching model, AI text detector, dan Singing voices. Model di atas 50 MB ditandai **large download**.
- <!--i:wrench--> **Tools** - setiap alat diunduh sendiri, atau **Download all** mengambil semua alat. Tanda centang berarti siap offline.

**Download everything** di bagian atas mengambil aplikasi, cakupan katalog yang Anda pilih, panduan, dan semua alat. Centang **Include all the AI models** untuk menambahkan model, atau unduh model lewat barisnya sendiri; suara bernyanyi hanya pernah diunduh dari barisnya sendiri. Kebijakan organisasi dapat mematikan unduhan AI, dan baris-barisnya kemudian memberi tahu Anda.

Unduhan dilanjutkan dari tempat berhenti jika Anda membatalkan atau kehilangan koneksi, dan menyegarkan diri saat Anda kembali online, hanya mengambil apa yang diubah rilis. Jika browser belum memberikan penyimpanan persisten, **Protect downloads** memintanya: perbedaan antara "terunduh" dan "terunduh sampai browser menginginkan ruangnya kembali".

### Lolly instance

**Lolly instance** menyatakan dari mana instalasi ini mendapatkan alat dan katalognya: alamat instans, atau *Bundled with this app* bila semuanya dikirim di dalam build.

- **Design-system source** menunjukkan dari mana design system yang disediakan berasal.
- **Instance console** membuka halaman admin deployment, bila ditawarkan.
- **Change** mengarahkan aplikasi desktop ke instans lain. Browser tidak dapat memuat alat dan aset lintas origin, jadi di web bagian ini menawarkan **Open a workspace** sebagai gantinya.
- **Leave** menghapus design system, alat, dan katalog instans, dan pekerjaan Anda sendiri tetap ada. Lihat [Use Lolly at your organisation](/info/organisation.html#leaving).
- Saat Anda login ke sebuah organisasi, **Sign out** mengakhiri sesi ini dan **Sign out everywhere** mengakhiri sesi Anda di setiap perangkat, termasuk yang ini.

## This device

- <!--i:monitor--> **This Machine** - layar, input, grafis, memori, codec, backend penyimpanan, dan lainnya, dibaca langsung dari sesi ini. Tidak ada yang disimpan dan tidak ada yang dikirim. Terbuka sendiri pada layar lebar, tempat tab ditata dalam dua kolom.
- <!--i:neurobeat--> **Sound** - suara antarmuka dan loop fokus Neurospicy, satu-satunya sakelar di tab ini yang menulis sesuatu.
- <!--i:database--> **Storage** - tampilan hanya-baca dari pengukur di [Preferences](#storage), tempat Anda membersihkan atau membawa data.

## Design system

Design system aktif, ditata untuk dibaca. Bila browser ini memiliki dua design system atau lebih, strip sampul kecil di bagian atas mencantumkannya: pilih satu untuk menjadikannya aktif, dan **Undo** pada pemberitahuan berikutnya mengembalikan yang sebelumnya.

![Tab Design system pada Lolly Demo: strip sampul untuk berpindah sistem, lalu sampul dengan logo, nama, catatan, dan jumlah yang membuka tiap halaman](/t/url-shot?url=%2F%23%2Fsettings%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=2400&format=svg&walker=1&dark=1&filename=settings-design-system)

Tab terbuka pada sampul yang dicat dengan warna sistem itu sendiri, dengan logo, nama dalam huruf tampilannya, dan catatan yang ditulis pembuatnya. Baris jumlah di sampul menaut ke tiap halaman:

- <!--i:palette--> **Colour** - surface, teks, primer, dan sekunder dari tampilan terang dan gelap, setiap warna bernama sebagai chip dengan nama dan hex-nya, pita untuk setiap ramp tint dan spektrum bagan, dan peran warna dalam lipatan. Pilih nilai untuk menyalin hex.
- <!--i:font--> **Type** - Headings, Text, Emphasis, dan Code, masing-masing diset dalam hurufnya sendiri.
- <!--i:photos--> **Logos** - setiap file logo pada latar tempat ia dibuat.
- <!--i:layers--> **Colourways** - pasangan terang dan gelap setiap colourway, bila sistem memiliki lebih dari satu.
- <!--i:sliders--> **Tokens** - radius, jarak, efek, dan gradien.
- <!--i:document--> **Print & CMYK** - warna yang dikunci pada tinta persis, dan kondisi cetak yang dapat dideklarasikan PDF CMYK.

Berpindah adalah satu-satunya perubahan yang dibuat tab ini. Anda menyunting design system di [Design System Setup](/info/brand-studio.html) di `#/start`, yang ditautkan dari sampul. Sistem hanya-baca menyatakannya di sampulnya; sistem lokal yang Anda buat tetap dapat disunting. `/b` dan `/brand` adalah tautan pintas langsung ke tab ini.

## Capabilities

Setiap bagian platform ditulis sebagai kartu, dalam dua belas grup: Experiences, Platforms & runtimes, Accessibility & languages, Export formats, Import formats, Print production, Automation & AI, Determinism & reproducibility, Brand & design system, Privacy & data ownership, Security & access control, dan Architecture (for builders). Setiap grup dapat dilipat dan menampilkan jumlah kartunya. Kartu terbuka menjadi dialog dengan fitur kapabilitas itu dan, untuk sekitar separuhnya, tangkapan layar yang dipakai dokumentasi ini.

Field pencarian di atas grup menyaring kartu saat Anda mengetik dan membuka grup mana pun yang masih memiliki kecocokan. Ia menyebut berapa banyak kapabilitas yang dicarinya, dan kueri tanpa kecocokan menyatakannya dengan kata-kata.

Tab ini adalah dokumentasi tertulis tentang apa yang dapat dilakukan Lolly, dijaga selaras dengan panduan ini. Ia tidak menyelidiki mesin yang sedang Anda pakai; **This device** yang melakukannya.

## Activity & stats

Build lebih dulu: berapa banyak alat yang dimuat, berapa banyak format ekspor yang ada, berapa banyak permukaan tempat platform berjalan, dan berapa banyak aset brand yang dibawa katalog, dengan panel **Catalogue** yang merinci apa yang dikirim dalam build ini.

Lalu sisi Anda sendiri: **Your activity** menghitung apa yang telah Anda buat di perangkat ini, dan **Recent creations** serta **Latest exports** adalah tumpukan yang dapat Anda geser, masing-masing muncul begitu ada yang bisa ditampilkan. Keduanya membuka item sebagaimana adanya. Penghitung ini tetap di perangkat; instans Lolly Work opsional menyimpan [telemetri dan catatan audit organisasi](/info/privacy.html#organisation-services-with-lolly-work) sendiri.

## Deep links

Setiap tab dan bagian Settings memiliki tautannya sendiri, yang dapat Anda tandai atau tempel. [Search](/info/search.html) mengarahkan hasil **Settings**-nya ke registri yang sama dengan yang dirender Settings, sehingga bagian tidak dapat diganti namanya dari bawah hasil pencarian.

::: details Setiap bentuk tautan

- **Tab:** `#/settings?tab=brand`, `#/settings?tab=caps`, `#/settings?tab=device`, `#/settings?tab=activity`.
- **Bagian Preferences:** `#/settings?focus=<section-id>`, seperti `#/settings?focus=offline-section`.
- **Bagian, tepatnya:** id-nya sebagai flag polos, seperti `#/settings?dash-storage`, `#/settings?dash-logos`, `#/settings?dash-colourways`, atau `#/settings?cap-formats`. Tautan lama `#/settings?dash-lock` dan `#/settings?dash-palette-wheel` membuka sampul dan halaman Colour.
- **Bagian menurut kata kunci:** `#/settings?print`, `#/settings?formats`, `#/settings?palette` (halaman Colour), atau `#/settings?tokens`. Kata kunci dapat dibagikan: `print` dimiliki baik oleh referensi cetak tab brand maupun grup Print production, dan yang pertama menurut urutan halaman yang menang. Gunakan id bila penting mana yang dimaksud.

Tautan dalam berpindah ke tab yang memiliki targetnya, membuka grup apa pun tempat ia terlipat, lalu menggulir ke sana, menunggu sesaat sementara bagian di atasnya selesai ditata. Alamat `#/platform` dan `#/capabilities` yang telah dihentikan dilebur ke Settings dengan flag tautan dalamnya tetap utuh.
:::

---

**Terkait:** [Profiles](/info/profile.html) untuk detail Anda dan konteks tempat Anda membuat. [Design System Setup](/info/brand-studio.html) untuk menyunting apa yang ditampilkan tab Design system. [Find and recover your work](/info/find-your-work.html) untuk penyimpanan, cadangan, dan berpindah perangkat.
