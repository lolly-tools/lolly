# Pengaturan

Settings memuat detail Anda, design system Anda, aksesibilitas, penyimpanan di perangkat ini dan unduhan offline. Buka **Settings** dari bilah di bagian bawah layar beranda atau dari menu avatar Anda, dan halaman akan terbuka pada **Preferences**.

| Tab | Alamat | Isinya |
|---|---|---|
| **Preferences** | `#/settings` | Detail Anda, design system, tampilan, emoji, aksesibilitas, koneksi, penyimpanan dan unduhan offline |
| **This device** | `#/settings?tab=device` | Informasi terkini browser dan mesin ini, beserta suara dan tampilan penyimpanan hanya baca |
| **Design system** | `#/settings?tab=brand` | Design system aktif dalam bentuk sampul dan halaman, dengan deretan sampul untuk beralih sistem |
| **Capabilities** | `#/settings?tab=caps` | Semua yang dapat dilakukan Lolly, berupa kartu yang dapat dicari |
| **Activity & stats** | `#/settings?tab=activity` | Katalog, penghitung lokal Anda dan pekerjaan terbaru |

Tautan lama `#/profile` dan `#/d` tetap membuka tempat yang tepat, hingga ke pengaturan tertentu.

<!--i:eti-sliders-->
## Preferensi

Preferences adalah satu halaman panjang dengan **rel pengaturan** di sisinya. Field **Search settings** di atas rel memfilter rel saat Anda mengetik. Setiap bagian memiliki tautan berbentuk `#/settings?focus=<section-id>`, seperti `#/settings?focus=storage-section`.

- <!--i:usercheck--> **Your details** - nama, detail kontak dan foto wajah Anda, serta sakelar **Use my details to create**. [Profil](/info/profile.html) menjelaskan cara alat menggunakannya.
- <!--i:seal--> **Content Credentials** - identitas terverifikasi opsional yang menandatangani ekspor Anda. Lihat [Content Credentials](/info/content-credentials-identity.html).
- <!--i:palette--> **Design systems** - beralih, menambahkan, menyembunyikan atau menghapus design system. [Lolly Design System Setup](/info/brand-studio.html#manage-your-design-systems) membahas setiap tindakan.
- <!--i:moon--> **Appearance** - tema (Light, Dark atau Brand, yang mewarnai aplikasi dengan palet Anda), **Your colourway** saat design system menawarkan lebih dari satu ([Jadikan colourway milik Anda](/info/colourways.html#make-a-colourway-your-own)) dan **Interface follows the design system**.
- <!--i:sparkle--> **Emoji** - set emoji untuk pekerjaan baru, beserta lisensi karya seninya, dan seberapa kuat palet Anda mewarnai ulang emoji (**Off**, **Subtle**, **Strong**, **Full**, **Mono** atau **Duotone**). **Keep skin tones and flags** mempertahankan warna kulit dan bendera seperti aslinya. Pekerjaan yang sudah Anda buat tetap menggunakan setnya.
- <!--i:eyeoff--> **Accessibility** - empat sakelar kenyamanan, beserta Sound dan Neurospicy Mode. Lihat [Aksesibilitas](#accessibility).
- <!--i:link--> **Connected services** - penyimpanan yang Anda hubungkan, seperti Dropbox, Google Drive, OneDrive, Nextcloud atau S3, serta **Sync across devices**. Lihat [Sinkronkan perangkat Anda](/info/sync.html).
- <!--i:globe--> **Trusted sites** - situs yang boleh dihubungi kotak halaman web Lolly Design atau demo Lolly Sandbox tanpa bertanya, serta **Allow pages from any site** jika server menyediakannya. [Kebijakan Privasi](/info/privacy.html) mencantumkan apa yang dikirim setiap permintaan.
- <!--i:download--> **Your renders** - **Save my renders to my library** menyimpan salinan setiap gambar, klip audio dan video yang Anda unduh di Assets, dengan tag Renders.
- <!--i:database--> **Storage** - apa yang disimpan Lolly di perangkat ini, serta tombol untuk menghapus atau membawa data Anda. Lihat [Penyimpanan](#storage).
- <!--i:cpu--> **Available offline** - unduh apa yang Anda perlukan sebelum koneksi terputus. Lihat [Tersedia offline](#available-offline).
- <!--i:folder--> **Hot folder** - di aplikasi desktop, Lolly memantau satu folder dan memasukkan apa pun yang diletakkan di sana, melalui pemilih yang sama seperti seret dan lepas.
- <!--i:clock--> **Your activity** - apa yang telah Anda buat di perangkat ini, dihitung secara lokal.
- <!--i:sliders--> **Feature flags** - mengaktifkan atau menonaktifkan bagian aplikasi, seperti **Print preflight** atau **Strip metadata from uploads**. **Performance UI** memberikan tampilan aplikasi yang lebih sederhana dan lebih ringan untuk digambar. Lolly dapat mengaktifkan Performance UI sendiri pada perangkat yang lambat. Baris di bawah sakelar lalu menyatakan kapan dan mengapa, dengan **Allow again** ([cara keputusannya dibuat](/info/configuration.html#curating-what-people-see)).
- <!--i:server--> **Lolly instance** - tempat instalasi ini mendapatkan alat dan katalognya. Lihat [Instans Lolly](#lolly-instance).

Kartu tema adalah pratinjau langsung. Tema diterapkan begitu Anda memilihnya, hanya di perangkat ini.

![Tiga kartu tema, masing-masing menampilkan pratinjau tipografi dan warnanya sendiri, dengan tema aktif ditandai](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dappearance-section&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

### Aksesibilitas

**Settings → Preferences → Accessibility** memuat empat pengaturan kenyamanan untuk aplikasi. Masing-masing mati sampai Anda mengaktifkannya, dan tidak ada yang memengaruhi isi kanvas alat atau ekspor, sehingga aplikasi yang lebih tenang tidak pernah menggeser satu piksel pun pada file yang Anda kirim. Masing-masing mati secara default. Tidak ada yang mengubah kanvas alat atau ekspor.

- <!--i:pause--> **Reduce motion** menonaktifkan transisi, animasi geser dan hiasan gerak aplikasi.
- <!--i:photos--> **Hide colourful previews** mengganti karya pratinjau galeri dengan kartu berisi ikon dan teks serta meredupkan thumbnail proyek, yang tetap dapat dikenali.
- <!--i:sliders--> **High contrast** mempertegas garis batas, teks dan cincin fokus aplikasi. Warna merek dan kanvas Anda tetap seperti yang Anda atur.
- <!--i:font--> **Large text** memperbesar label, menu dan teks tombol aplikasi.

**Dominant hand** (Right atau Left) menentukan sisi tempat kontrol berada saat Lolly menampilkan dua panel, pada perangkat lipat atau tablet yang hampir persegi. **Swap sides** di header panel juga mengubahnya.

Pengaturan ini disimpan di profil Anda, jadi ikut dalam ekspor profil bersama nama dan sesi Anda. Salinan khusus perangkat menerapkannya sebelum tampilan pertama digambar.

Kartu yang sama memiliki **Sound**, suara lembut yang membantu untuk tindakan seperti tiba di galeri, hasil Content Credentials atau menutup panel. Kartu ini juga memiliki **Neurospicy Mode**, trek tenang untuk fokus. Mengaktifkan Neurospicy membuka pemutar kecil di sudut yang tetap tersedia di seluruh aplikasi. Di pemutar, Anda memilih trek, melewati trek, mengatur volume dan meminimalkan atau menutup pemutar. Trek mencakup stasiun generatif Lolly, loop dan ketukan ambient, audio Anda sendiri dan stasiun radio internet, yang memerlukan koneksi. Keduanya mati secara default dan pilihannya diingat. Menonaktifkan Sound juga membisukan trek fokus. Menu profil dan **This device** memiliki sakelar yang sama.

Penggeser di bawah sakelar Sound mengatur karakter suara. Ke arah gumpalan bulat **Bouba**, suara menjadi tetesan lembut, gelembung dan sedikit bas. Ke arah bintang runcing **Kiki**, suara menjadi ketukan kering, gesekan dan bunyi logam. Bagian tengah mempertahankan denting dan nada Lolly. Jika suara di salah satu ujung sulit Anda toleransi, geser ke arah ujung lainnya. Penggeser berfungsi saat Sound mati, dan melepas penggeser memutar sampel singkat.

::: details Stasiun generatif
Stasiun generatif menyusun musiknya sambil diputar, tanpa sampel dan tanpa rekaman suara manusia. Setiap lagu memiliki instrumen, groove dan urutan pemutarannya sendiri.

- **Lolly Sings** adalah keluarga stasiun. Lolly Sings asli terdengar cerah dan melodis: nada dasar mayor, melodi utama di setiap lagu serta nuansa bossa, shuffle dan chiptune. Setiap genre juga memiliki stasiunnya sendiri, dari Sugar dan K-pop hingga Country, Jazz, Metal dan D&B.
- **Stasiun Lofi** (Warm, Late night dan Rainy) berisi ketukan lo-fi tanpa akhir.

Pada stasiun generatif, tombol berikutnya dan sebelumnya berpindah antarlagu. Setiap lagu berasal dari seed, sehingga lagu diputar dengan cara yang sama di mana pun Anda membagikan atau menyimpannya (lihat [Musik generatif](/info/generated-music.html)). Di bawah kontrol pemutaran, **Mood** beralih antarstasiun Lofi, **Drums** meniadakan perangkat drum dan **Texture** bergerak dari suara bersih hingga suara piringan hitam berdebu. Deretan tombol ikon ada setelahnya. Arahkan penunjuk ke tombol atau tekan lama untuk melihat namanya:

- Not musik, **Open in the music generator**, membuka lagu di `#/music`, tempat Anda dapat mengubah instrumennya bagian demi bagian.
- Tautan, **Share this tune or moment**, menawarkan tautan yang memutar lagu yang sama, atau tautan yang juga dimulai dari posisi Anda dan menampilkan visualiser dengan preset dan warna Anda saat ini.
- Folder, **Save to library**, menyimpan lagu di aset Anda.
- Petir, **Light visualiser**, adalah sakelar yang dijelaskan di bawah.

Lagu tersimpan dicantumkan di bawah grup stasiunnya, berdasarkan nada dasar dan tempo. Memilih lagu tersimpan memutar lagu yang sama lagi, berulang seperti trek lain atau berlanjut dalam mode maju. Hanya stasiun dan nomor lagu yang disimpan, beberapa byte, dan musik disusun kembali saat diputar. Anda dapat mengganti nama atau menghapus lagu tersimpan di aset Anda, serta menggunakannya sebagai musik latar video. Lolly Demo dan Lolly Start masing-masing menyertakan enam lagu tersimpan.

Visualiser menerima setiap trek pada tingkat suara yang stabil, sehingga trek pelan menggerakkan gambar sama besarnya dengan trek keras, pada volume berapa pun. Setiap genre Lolly Sings, serta lagu yang disimpan dari salah satunya, menawarkan **Light visualiser**: bilah tingkat suara sederhana yang menyisakan waktu pemrosesan yang diperlukan musik. Light visualiser aktif sejak awal untuk layar sentuh dan perangkat dengan empat inti atau kurang atau memori 4 GB atau kurang.
:::

Anda dapat menggunakan antarmuka dengan keyboard. Kontrol khusus memiliki label untuk pembaca layar. Pratinjau langsung setiap alat berupa satu gambar berlabel yang menjelaskan apa yang ditampilkannya.

### Penyimpanan

Meter penyimpanan menunjukkan setiap byte yang disimpan instalasi ini, menurut kategori, dibandingkan dengan yang dilaporkan browser.

![Meter penyimpanan, merinci sesi tersimpan, gambar dan cache dibandingkan dengan yang sebenarnya dilaporkan browser](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

Di bawah meter:

- **Move to another device** memiliki **Export my data**, **Import data…** dan **Export my data & render everything**. [Pindahkan pekerjaan Anda ke perangkat lain](/info/find-your-work.html#move-your-work-to-another-device) menjelaskan langkah-langkahnya.
- **Clear cache** menghapus file katalog yang telah diunduh, yang akan diunduh lagi saat diperlukan.
- **Remove automatic checkpoints older than 30 days** membebaskan ruang History dan mempertahankan versi yang disimpan dan diberi nama.
- **Clear all my data** menghapus semua yang disimpan Lolly di browser ini, setelah Anda mengetik satu kata untuk mengonfirmasi. [Jika Anda menghapus data browser](/info/find-your-work.html#if-you-clear-your-browser-data) mencantumkan apa yang dihapus.

### Tersedia offline

Lolly hanya menyimpan layar yang telah Anda kunjungi dalam cache. **Available offline** mengunduh bagian yang akan Anda perlukan, dengan satu bilah progres, dan bagian itu tetap berfungsi tanpa koneksi.

- <!--i:monitor--> **App, catalogue and guides** - **Aplikasi** (setiap tampilan, editor dan font, termasuk layar yang belum pernah Anda buka), **Catalogue** (seluruhnya, atau **Choose by tag**) dan **Guides & docs** (dokumentasi ini dalam bahasa Anda, termasuk tangkapan layar).
- <!--i:cpu--> **AI models** - setiap model di perangkat pada barisnya sendiri beserta ukurannya: Speech voices, Upscaling models, Background removal, Text recognition, Lolly Verify deep scan, Durable credential, Rewriter model, Ask matching model, AI text detector dan Singing voices. Model di atas 50 MB ditandai **large download**.
- <!--i:wrench--> **Tools** - setiap alat diunduh sendiri-sendiri, atau **Download all** mengunduh semua alat. Tanda centang berarti siap digunakan offline.

**Download everything** di bagian atas mengunduh aplikasi, cakupan katalog yang Anda pilih, panduan dan semua alat. Centang **Include all the AI models** untuk menambahkan model, atau unduh model dari barisnya sendiri. Suara nyanyian hanya diunduh dari barisnya sendiri. Kebijakan organisasi dapat menonaktifkan unduhan AI, dan baris-baris tersebut akan menunjukkannya.

Unduhan dilanjutkan dari titik terakhir jika Anda membatalkannya atau koneksi terputus. Saat kembali online, unduhan diperbarui dan hanya mengambil yang berubah dalam sebuah rilis. Jika browser belum mengizinkan penyimpanan persisten, **Protect downloads** meminta izin tersebut. Tanpa izin itu, browser dapat menghapus unduhan saat membutuhkan ruangnya kembali.

### Instans Lolly

**Lolly instance** menyatakan dari mana instalasi ini mendapatkan alat dan katalognya: alamat instans, atau *Bundled with this app* jika semuanya disertakan dalam build.

- **Design-system source** menunjukkan asal design system yang disediakan.
- **Instance console** membuka halaman admin deployment, jika tersedia.
- **Change** mengarahkan aplikasi desktop ke instans lain. Browser tidak dapat memuat alat dan aset lintas origin, jadi di web bagian ini menawarkan **Open a workspace** sebagai gantinya.
- **Leave** menghapus design system, alat dan katalog instans. Pekerjaan Anda sendiri tetap ada. Lihat [Menggunakan Lolly di organisasi Anda](/info/organisation.html#leaving).
- Saat Anda masuk ke organisasi, **Sign out** mengakhiri sesi ini dan **Sign out everywhere** mengakhiri sesi Anda di setiap perangkat, termasuk perangkat ini.

<!--i:eti-monitor-->
## Perangkat ini

- <!--i:monitor--> **This Machine** - layar, input, grafis, memori, codec, backend penyimpanan dan lainnya, dibaca langsung dari sesi ini. Tidak ada yang disimpan atau dikirim. Pada layar lebar, panel ini terbuka sendiri dan tab menggunakan dua kolom.
- <!--i:neurobeat--> **Sound** - suara antarmuka dan loop fokus Neurospicy. Sound adalah satu-satunya sakelar di tab ini yang menulis sesuatu.
- <!--i:database--> **Storage** - tampilan meter yang hanya bisa dibaca. Hapus atau bawa data Anda di [Preferensi](#storage).

<!--i:eti-palette-->
## Design system

Design system yang aktif, ditata untuk dibaca. Jika browser ini menyimpan dua design system atau lebih, deretan sampul di bagian atas mencantumkannya. Pilih satu untuk mengaktifkannya. **Undo** pada pemberitahuan yang muncul setelahnya mengembalikan design system sebelumnya.

![Tab Design system pada Lolly Demo: deretan sampul untuk beralih design system, lalu sampul dengan logo, nama, catatan dan jumlah yang membuka setiap halaman](/t/url-shot?url=%2F%23%2Fsettings%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=2400&format=svg&walker=1&dark=1&filename=settings-design-system)

Tab terbuka pada sampul dengan warna design system itu sendiri, beserta logo, nama dalam font tampilannya dan catatan yang ditulis pembuatnya. Deretan jumlah pada sampul menautkan ke setiap halaman:

- <!--i:palette--> **Colour** - permukaan, teks, warna primer dan sekunder pada tampilan terang dan gelap, setiap warna bernama sebagai chip dengan nama dan kode heksanya, pita untuk setiap rentang tint dan spektrum bagan serta peran warna dalam bagian yang dapat dilipat. Pilih nilai untuk menyalin kode heksa.
- <!--i:font--> **Type** - Headings, Text, Emphasis dan Code, masing-masing ditampilkan dengan jenis hurufnya sendiri.
- <!--i:photos--> **Logos** - setiap file logo pada latar yang menjadi tujuannya.
- <!--i:layers--> **Colourways** - pasangan terang dan gelap setiap colourway, jika design system memiliki lebih dari satu.
- <!--i:sliders--> **Tokens** - radius, jarak, efek dan gradien.
- <!--i:document--> **Print & CMYK** - warna yang dikunci ke tinta tertentu, serta kondisi mesin cetak yang dapat dinyatakan oleh PDF CMYK.

Beralih design system adalah satu-satunya perubahan yang dibuat tab ini. Sunting design system di [Lolly Design System Setup](/info/brand-studio.html) pada `#/start`, yang ditautkan sampul. Design system yang hanya bisa dibaca menyatakannya pada sampul. Design system lokal yang Anda buat tetap dapat disunting. `/b` dan `/brand` adalah tautan singkat ke tab ini.

<!--i:eti-grid-->
## Kemampuan

Setiap bagian platform memiliki kartu, dalam dua belas grup: Pengalaman, Platform & runtime, Aksesibilitas & bahasa, Format ekspor, Format impor, Produksi cetak, Otomatisasi & AI, Determinisme & reproduksibilitas, Merek & design system, Privasi & kepemilikan data, Keamanan & kontrol akses dan Arsitektur (untuk pengembang). Setiap grup dapat dilipat dan menampilkan jumlah kartunya. Kartu membuka dialog berisi fitur kemampuan tersebut dan, untuk sekitar separuh kartu, tangkapan layar yang digunakan dokumentasi ini.

Field pencarian di atas grup menyaring kartu saat Anda mengetik dan membuka grup yang berisi hasil cocok. Field tersebut menampilkan jumlah kemampuan yang dicari. Kueri tanpa hasil cocok menyatakannya dalam teks.

Tab ini mendokumentasikan kemampuan Lolly, selaras dengan panduan ini. Tab ini tidak memeriksa mesin yang Anda gunakan; **This device** yang melakukannya.

<!--i:eti-gauge-->
## Aktivitas & statistik

Pertama, build: jumlah alat yang dimuat, format ekspor, lingkungan tempat platform berjalan dan aset merek dalam katalog. Panel **Catalogue** merinci apa saja yang disertakan dalam build ini.

Lalu pekerjaan Anda sendiri: **Your activity** menghitung apa yang telah Anda buat di perangkat ini. **Recent creations** dan **Latest exports** adalah tumpukan yang dapat Anda geser, ditampilkan setelah ada isinya. Keduanya membuka item sebagaimana sebelumnya. Penghitung ini tetap di perangkat. Instans Lolly Work opsional menyimpan [catatan telemetri dan audit organisasi](/info/privacy.html#organisation-services-with-lolly-work) sendiri.

<!--i:eti-link-->
## Tautan langsung

Setiap tab dan bagian Settings memiliki tautannya sendiri untuk di-bookmark atau ditempel. [Lolly Search](/info/search.html) membangun hasil **Settings** dari registri yang sama dengan Settings, jadi perubahan nama bagian tidak pernah merusak hasil pencarian.

::: details Setiap bentuk tautan

- **Tab:** `#/settings?tab=brand`, `#/settings?tab=caps`, `#/settings?tab=device`, `#/settings?tab=activity`.
- **Bagian Preferences:** `#/settings?focus=<section-id>`, seperti `#/settings?focus=offline-section`.
- **Bagian secara tepat:** id-nya sebagai flag tanpa nilai, seperti `#/settings?dash-storage`, `#/settings?dash-logos`, `#/settings?dash-colourways` atau `#/settings?cap-formats`. Tautan lama `#/settings?dash-lock` dan `#/settings?dash-palette-wheel` membuka sampul dan halaman Colour.
- **Bagian berdasarkan kata kunci:** `#/settings?print`, `#/settings?formats`, `#/settings?palette` (halaman Colour) atau `#/settings?tokens`. Dua bagian dapat berbagi kata kunci: `print` dimiliki oleh referensi cetak pada tab merek dan grup Print production, dan bagian yang lebih dulu dalam urutan halaman dipilih. Gunakan id untuk memilih salah satunya.

Tautan langsung beralih ke tab yang memuat target dan membuka grup mana pun yang melipat target di dalamnya. Lalu halaman bergulir ke target setelah bagian-bagian di atasnya selesai ditata. Alamat `#/platform` dan `#/capabilities` yang sudah tidak digunakan terbuka di Settings dengan flag tautan langsung tetap utuh.
:::

---

**Terkait:** [Profil](/info/profile.html) untuk detail Anda dan konteks tempat Anda berkarya. [Lolly Design System Setup](/info/brand-studio.html) untuk menyunting apa yang ditampilkan tab Design system. [Menemukan dan memulihkan pekerjaan Anda](/info/find-your-work.html) untuk penyimpanan, cadangan dan pindah perangkat.
