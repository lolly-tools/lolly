# Profil - siapa Anda saat berkarya

**Profil** adalah identitas kerja yang digunakan Lolly untuk membuat. Ini adalah sekumpulan kecil detail yang dapat diambil oleh sebuah alat sehingga Anda tidak perlu mengetiknya ulang setiap kali - nama Anda, detail kontak, foto profil opsional, beberapa preferensi - ditambah semua yang Anda kumpulkan selama bekerja: sesi yang disimpan, gambar yang diunggah, dan tally aktivitas lokal.

Semua isi profil tersimpan **di perangkat**, dalam basis data lokal browser (IndexedDB pada PWA web, sistem berkas pada aplikasi Tauri). Tidak ada akun dan tidak ada yang diunggah. Anda mengelolanya di **Profil** (kanan atas galeri); tool hanya *membaca*-nya, dan hanya field tertentu yang memang dirancang untuk diisi otomatis.

> Profil adalah tentang *Anda* (atau siapa pun yang berkarya di sini). Ini berbeda dari **Platform** - warna, font, dan pengaturan global milik brand - dan dari **Capabilities**, katalog tentang apa yang dapat dilakukan aplikasi. Lihat [Profile vs Platform vs Capabilities](#profile-vs-platform-vs-capabilities) di bagian akhir.

## Apa yang ada dalam profil

| Bagian | Apa isinya |
|---|---|
| **Name** | Nama depan dan belakang. |
| **Contact** | Email dan telepon. |
| **Location** | Kota dan negara. |
| **Headshot** | Foto opsional, dipotong menjadi persegi dan disimpan sebagai gambar lokal. Digunakan oleh alat seperti tanda tangan email, kartu kutipan, bagan organisasi, dan tata letak dinamis. |
| **Use my details to create** | Sakelar opt-in tunggal (berbunyi **Using my details** setelah aktif). Mengontrol apakah detail pribadi Anda turut disertakan sebagai **provenance** - baris penulis/kredit yang tertanam dalam file yang diekspor - dan sebagai penulis pada proses batch **/pro**. (Ini tidak mengontrol pre-fill: lihat [How tools use your profile](#how-tools-use-your-profile).) |
| **Preferences** | Tema Anda (Light, Dark, atau Brand - tema brand mewarnai aplikasi dengan palet Anda sendiri) dan bagian aplikasi mana yang Anda aktifkan lewat **Feature flags**. |
| **Accessibility** | Empat sakelar kenyamanan - *Reduce motion*, *Hide colourful previews*, *High contrast*, *Large text* - disimpan pada catatan profil, sehingga ikut terbawa dalam ekspor profil. Lihat [Accessibility](#accessibility). |
| **Your work** | Sesi tersimpan (dengan thumbnail) - diatur ke dalam folder bersarang di **[Projects](/info/using.html)** - pustaka **My images** Anda, dan statistik aktivitas lokal, semuanya terkait dengan profil ini. |

![Three theme cards, each previewing its own type and colour, with the active one flagged](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

![Layar Profile - nama, kontak, foto profil opsional, dan preferensi Anda](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&walker=1&localize=1&dark=1&filename=profile-details)

Tidak ada satu pun dari ini yang wajib. Profil kosong adalah profil yang sangat baik; Anda hanya mengisi apa yang menghemat waktu pengetikan.

Halaman ini panjang, sehingga memiliki **settings rail**-nya sendiri di sisi samping - Your details, Appearance, Accessibility, Lolly instance, Your activity, Storage, Available offline, Feature flags, Content Credentials - dengan bidang **Search settings** di atasnya yang menyaring daftar saat Anda mengetik. Setiap bagian dapat ditautkan langsung sebagai `#/profile?focus=<section-id>`, yang membukanya dan menggulirkannya agar terlihat (`#/profile?focus=storage-section`, `?focus=feature-flags-section`, dan seterusnya), sehingga sebuah tautan dapat menunjuk ke satu pengaturan, bukan ke bagian atas halaman.

![Tiga kartu tema, masing-masing menampilkan pratinjau tipe dan warnanya sendiri, dengan kartu yang aktif ditandai](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

## Profil adalah sebuah konteks, bukan sekadar seseorang

Kata "profil" mengesankan satu orang yang tetap, tapi di Lolly ini sebenarnya sebuah **konteks berkarya** - *siapa Anda saat membuat sesuatu*. Konteks itu bisa berbentuk tiga hal berbeda, dan Lolly menangani semuanya dengan cara yang sama.

### Sebagai individu

![The headshot control, empty until you upload a photo that then stays on this device](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-side&walker=1&dark=1&filename=pd-profile-headshot)

![Kontrol headshot, kosong hingga Anda mengunggah foto yang kemudian tetap tersimpan di perangkat ini](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-side&walker=1&dark=1&filename=pd-profile-headshot)

### Sebagai tim

Sebuah profil tidak harus mewakili satu orang. Profil dapat mewakili **tim atau fungsi dalam sebuah organisasi**: nama bersama tim, alamat inbox grup (`events@…`), sebuah departemen, headshot tim, atau tanda unit. Satu orang mengaturnya, mengekspornya (lihat di bawah), dan sisa anggota tim memuat profil yang sama - sehingga semua yang dihasilkan tim membawa detail yang konsisten tanpa ada yang perlu memasukkannya ulang. Kios bersama atau laptop demo yang dipinjam dapat menjalankan satu profil tim yang digunakan oleh semua orang yang menggunakannya untuk berkarya.

### Sebagai fungsi - peran yang sesekali Anda kenakan

Inilah kasus yang terlewat oleh model kaku "satu orang, satu profil". Anda mungkin seorang **manajer acara tiga hari dalam setahun** dan menjadi sesuatu yang sama sekali berbeda di sisa waktunya. Pada tiga hari itu Anda ingin detail acara, kotak masuk acara, mungkin sub-brand acara untuk mengisi badge dan papan penanda Anda; pada 362 hari lainnya Anda ingin identitas normal Anda kembali.

Di Lolly, peran itu hanyalah **profil lain yang Anda simpan siap pakai** - sebuah bundel tersimpan (bagian berikutnya) yang Anda muat untuk acara itu lalu Anda simpan kembali sesudahnya. Peran adalah sebuah topi, bukan akun baru. Kenakan saat Anda membutuhkannya, lepaskan saat Anda selesai.

## Satu instalasi, satu profil aktif - banyak yang bisa Anda simpan

Pada suatu saat, satu instalasi memiliki **satu profil aktif** - detail yang dilihat oleh sebuah alat saat ini. Tidak ada pengalih profil di dalam aplikasi; sebagai gantinya, setiap profil adalah **bundle portabel** (satu file `.zip`, lihat [di bawah](#moving-a-profile-to-a-new-device)). Ini sengaja dibuat sebagai mekanisme yang sama dengan memindahkan ke perangkat baru - sebuah profil adalah file yang dapat Anda simpan, salin, dan muat.

![The storage meter, breaking down saved sessions, images and cache against what the browser actually reports](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%2C.storage-subsection%2C.storage-actions%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

- <!--i:trash--> **Peralihan paling bersih:** **Profile → Storage → Clear all my data**, lalu **Import** bundle untuk konteks yang akan Anda masuki. Anda sekarang berkarya murni sebagai profil tersebut.
- <!--i:layers--> **Layering:** mengimpor *tanpa* menghapus terlebih dahulu akan **menggabungkan** - profil, sesi, dan gambar yang diimpor mendarat di atas apa yang sudah ada, menggantikan apa pun dengan nama yang sama dan menyisakan yang lain. Berguna untuk menarik sesi tersimpan satu tim ke dalam setup Anda sendiri; bukan yang Anda inginkan jika Anda memerlukan batas peran yang bersih.
- <!--i:monitor--> **Berdampingan:** karena semuanya bersifat device-scoped, profil peramban terpisah, akun pengguna terpisah, atau PWA terpasang kedua masing-masing membawa profil Lolly-nya sendiri secara independen. Jalankan instalasi pribadi Anda dan instalasi kios acara sekaligus, tanpa perlu berpindah.

Jadi jika Anda benar-benar menjalankan beberapa konteks sekaligus (Anda, tim Anda, topi manajer acara), Anda menyimpan beberapa bundel dan memuat yang Anda butuhkan:

![Meter penyimpanan, merinci sesi tersimpan, gambar, dan cache dibandingkan dengan yang sebenarnya dilaporkan peramban](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%2C.storage-subsection%2C.storage-actions%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

> Simpan satu bundel per konteks dan ganti nama berkasnya sesuai isinya (`LollyTools-events-2026.zip`, `LollyTools-me.zip`). Berkas itu *adalah* profilnya.

## Accessibility

**Profile → Accessibility** menyimpan empat pengaturan kenyamanan untuk aplikasi *di sekitar* pekerjaan Anda. Masing-masing nonaktif hingga Anda mengaktifkannya, dan tidak satu pun menjangkau ke dalam kanvas alat atau ekspor - aplikasi yang lebih tenang tidak boleh menggeser satu piksel pun dari file yang Anda kirim.

- <!--i:film--> **Reduce motion** - menonaktifkan transisi, slide, dan hiasan animasi di aplikasi. Kanvas alat Anda dan ekspor animasi apa pun tetap bergerak persis seperti yang dirancang.
- <!--i:image--> **Hide colourful previews** - mengganti artwork pratinjau galeri dengan kartu ikon-dan-teks yang tenang, dan menurunkan warna serta kontras thumbnail proyek Anda sehingga tetap dapat dikenali tanpa mencolok. Di dalam sebuah alat, semuanya tetap tampil dalam warna penuh.
- <!--i:sliders--> **High contrast** - memperkuat border, teks, dan cincin fokus aplikasi. Warna brand Anda dan segala sesuatu di kanvas tetap seperti yang Anda atur.
- <!--i:font--> **Large text** - memperbesar tipografi aplikasi: label, menu, dan teks tombol. Kontrol tetap pada ukurannya, sehingga hanya kata-kata di dalamnya yang membesar, dan tipografi di dalam desain Anda tidak tersentuh, sehingga tidak ada tata letak yang berubah pada hasil ekspor Anda.

Pengaturan ini tersimpan pada catatan profil itu sendiri, itulah sebabnya ikut terbawa dalam ekspor profil dan sampai di instalasi berikutnya bersama nama dan sesi Anda. (Perangkat juga menyimpan salinan lokal kecil sehingga pengaturan berlaku sebelum tampilan pertama; salinan tersebut hanya ada di perangkat dan tidak ikut terbawa.)

## Instance Lolly Anda

**Profile → Lolly instance** menunjukkan dari mana instalasi ini mendapatkan alat dan katalognya - alamat instance, atau *Bundled with this app* saat semuanya sudah tersedia di dalam build. Jika sebuah deployment menyediakannya, tautan **Instance console** membuka permukaan adminnya, dan **Change** / **Disconnect** mengarahkan ulang instalasi atau melepaskannya.

Mengarahkan ulang ke instance lain memerlukan **aplikasi desktop**: peramban memblokir halaman untuk memuat alat dan aset lintas origin, sehingga di web bagian ini hanya melaporkan di mana Anda berada dan berhenti sampai di situ.

## Available offline

Lolly melakukan cache seiring Anda menjelajah, tetapi cache-seiring-jalan ini hanya mencakup tempat yang sudah pernah Anda kunjungi. **Profile → Available offline** ditujukan untuk perjalanan yang sudah bisa Anda perkirakan: satu jam di wifi bandara sebelum penerbangan tanpa koneksi sama sekali. Unduh bagian-bagian yang Anda perlukan, pantau satu progress bar, dan semua yang Anda unduh tetap berfungsi walau koneksi hilang.

Tujuh bagian, masing-masing dengan ukurannya dinyatakan sebelum Anda melanjutkan:

- <!--i:layout--> **The app** - setiap tampilan, editor, dan font, termasuk yang belum pernah Anda buka. Tanpa ini, layar yang belum pernah Anda kunjungi secara online tidak dapat dimuat secara offline.
- <!--i:image--> **Catalogue** - aset brand di luar yang esensial. Ambil semuanya, atau buka *Choose by tag* dan ambil hanya tag yang Anda gunakan.
- <!--i:book--> **Guides & docs** - situs dokumentasi ini, dalam bahasa Anda, termasuk tangkapan layar.
- <!--i:cpu--> **Speech voices** - model suara di balik audio dan narasi Script. Diunduh sekali, lalu berjalan di perangkat.
- <!--i:zap--> **Upscaling models** - upscaler gambar AI: foto, ilustrasi/anime, dan wajah.
- <!--i:layers--> **Background removal** - model cut-out di perangkat di balik *Remove background*.
- <!--i:shield--> **Verify deep scan** - pemindai watermark di perangkat, untuk memeriksa Content Credentials tanpa koneksi.

Empat terakhir ditandai **unduhan besar**, dan sengaja dibuat sebagai opt-in individual: **Download everything** di bagian atas mengambil aplikasi, cakupan katalog yang Anda pilih, dokumentasi dan semua tool dalam satu proses dan tidak ada yang lain. Suara ucapan, upscaler, penghapus latar belakang dan pemindaian mendalam masing-masing hanya diunduh saat Anda memintanya per baris - beberapa ratus megabyte yang bersembunyi di dalam satu tombol akan tidak jujur.

Di bawah bagian-bagian tersebut ada daftar per tool: setiap tool diunduh satu per satu (tanda centang berarti siap offline), atau **Download all** menyapu semuanya. Unduhan dapat dilanjutkan - batalkan atau kehilangan koneksi dan proses berikutnya melanjutkan dari titik terhenti, hanya mengambil yang hilang - dan akan menyegarkan dirinya sendiri saat Anda kembali online, hanya menarik apa yang berubah di rilis baru.

Jika browser belum memberikan penyimpanan persisten, bagian ini akan menyatakannya dan menawarkan **Protect downloads**, yang memintanya - perbedaan antara "terunduh" dan "terunduh sampai browser ingin mengambil kembali ruangnya".

## Memindahkan profil ke perangkat baru

![The two buttons that move a whole install: Export my data writes one zip, Import data reads it back](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.storage-subsection&dark=1&filename=pd-transfer-controls)

Karena sebuah profil sepenuhnya lokal, satu-satunya cara memindahkannya ke instalasi kosong - laptop baru, browser yang baru direset, mesin rekan kerja, kotak offline - adalah dengan **membawa berkasnya**. Tidak ada login yang memulihkannya untuk Anda, dan itulah intinya: tidak ada apa pun yang pernah meninggalkan perangkat Anda sejak awal.

- <!--i:download--> **Export my data** mengunduh satu `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` - dinamai sesuai profil pemiliknya, dengan nomor urut per hari agar ekspor berulang tidak bentrok (bagian nama dihilangkan saat profil tidak memilikinya). File ini berisi profil Anda, setiap sesi tersimpan (dengan thumbnail-nya), gambar yang Anda unggah - token brand dan font terpasang Anda ikut serta sebagai aset pengguna - dan preferensi Anda (tema, tata letak, statistik aktivitas lokal).
- <!--i:upload--> **Import data…** pada instalasi lain membaca kembali file itu dan Anda melanjutkan persis dari tempat Anda berhenti.
- <!--i:box--> **Export my data & render everything** menulis backup yang sama *ditambah* zip kedua yang me-render setiap sesi tersimpan menjadi file hasil akhirnya, dalam folder yang mencerminkan Projects Anda. Arsip offline lengkap dari sumber maupun hasil - dan bisa berukuran besar serta lambat jika sesinya banyak.

![Dua tombol yang memindahkan seluruh instalasi: Export my data menulis satu zip, Import data membacanya kembali](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.storage-subsection&dark=1&filename=pd-transfer-controls)

Bundel ini adalah zip biasa yang mandiri, jadi ia bisa dipindahkan lewat cara **apa pun** - USB, AirDrop, berbagi jaringan, email-ke-diri-sendiri - dan targetnya bisa sepenuhnya offline. Setiap bagian diberi checksum, jadi berkas yang rusak dalam perjalanan tertangkap saat impor alih-alih dipulihkan dalam keadaan setengah rusak. Impor **menggabungkan** (profil/sesi/gambar dengan nama yang sama ditimpa; semua lainnya dipertahankan), jadi ia tidak pernah menghapus target yang sudah digunakan.

Yang tidak ikut berpindah: cache katalog (ia mengunduh ulang dirinya di perangkat baru) dan tool itu sendiri (diasumsikan sudah ada). 

Untuk tata letak bundel yang tepat, kebijakan versi dan aturan integritas, lihat **[Data Transfer](/info/data-transfer.html)**; untuk panduan lengkap dari awal sampai akhir, **[Using Lolly → Moving to another device](/info/using.html#moving-to-another-device)**.

## Cara tool menggunakan profil Anda

![The single Use my details switch, sitting beside Save Profile and off until you turn it on](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-check&walker=1&dark=1&filename=pd-use-my-details)

Sebuah tool hanya *mengisi otomatis* field profil yang memang secara eksplisit dirancang untuk diikat:

**Opsi opt-in (provenans).** Saat Anda mengekspor aset, detail Anda secara opsional ikut serta sebagai **provenans** - baris penulis/kredit yang disematkan dalam metadata file (PNG, PDF, SVG, …) - sehingga aset jadi dapat menyatakan siapa yang membuatnya. *Inilah* yang diatur oleh **Use my details to create**: biarkan mati dan ekspor tetap membawa atribusi tool/platform "Made with Lolly", tetapi tidak ada baris penulis/kontak pribadi yang disematkan. (Opt-in yang sama menetapkan penulis pada run batch **/pro**.) (Penulis tool: lihat [Authoring Tools → `bindToProfile`](/info/authoring-tools.html#bindtoprofile) dan [Host API → `host.profile`](/info/host-api.html#host-profile).)

![Satu-satunya sakelar Use my details to create, terletak di samping Save Profile dan mati sampai Anda menyalakannya](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-check&walker=1&dark=1&filename=pd-use-my-details)

## Profil vs Platform vs Kapabilitas

Tiga hal berada berdekatan di antarmuka dan mudah tertukar:

- <!--i:people--> **Profile** - *Anda* (atau tim Anda, atau peran yang Anda jalani): nama, kontak, foto profil, karya tersimpan Anda. Personal, lokal-perangkat, portabel sebagai bundel.
- <!--i:palette--> **Platform** - *brand*-nya: warna, font dan pengaturan global tempat setiap tool merender. Digunakan bersama dan konsisten, bukan personal.
- <!--i:sliders--> **Capabilities** - *apa yang bisa dilakukan aplikasi*: keseluruhan fitur dan tool yang tersedia untuk Anda.

Profil mengubah aset itu berasal *dari siapa*; platform mengubah *tampilannya*; kapabilitas adalah *apa yang bisa Anda buat*.

### "Profil" berarti dua hal lain di tempat lain - bukan ini

Istilah ini dipakai berlebihan di seluruh proyek. Tidak satu pun dari keduanya adalah profil pribadi yang dibahas di halaman ini:

- <!--i:box--> **Content profile** - konfigurasi waktu-build di `profiles.json` yang mengikat sekumpulan paket tool ke katalog brand (misalnya `suse`, `lolly-start`). Ini yang dipilih operator saat deploy, dan ini juga yang dipilih **parameter URL/CLI** `profile` sebagai varian *warna* saat ekspor (kondisi cetak ICC/CMYK - lihat [URL Mode](/info/url-mode.html)). Keduanya berkaitan dengan *build/output*, bukan dengan *Anda*. Lihat [Configuration](/info/configuration.html).
- <!--i:seal--> **Identity profile** - **identitas Content Credentials terverifikasi** opsional yang dapat Anda daftarkan (sertifikat berumur pendek yang mengikat email Anda ke ekspor bertanda tangan Anda). Itu adalah identitas penandatanganan, terpisah dari kolom nama/kontak profil pribadi, meski **Use my details to create** mengatur apakah salah satunya disematkan. Lihat [Content Credentials Identity](/info/content-credentials-identity.html).

![Kartu Verified identity, lebar-ponsel: pemilih masa berlaku sertifikat dan langkah pendaftaran di bawahnya - identity profile, terpisah dari detail pribadi Anda](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

## Privasi

Di luar pendaftaran identitas opsional di atas (yang mengirim email yang Anda daftarkan ke layanan sertifikat - lihat [Server Surface](/info/server-surface.html)), profil tidak pernah dikirimkan, diunggah atau digunakan untuk mengidentifikasi atau melacak Anda - tidak ada yang perlu disetujui, hanya pemberitahuan ini agar Anda tahu apa yang disimpan. Hapus semuanya kapan saja dengan **Profile → Clear all my data**. Lihat [Privacy Policy](/info/privacy.html).
