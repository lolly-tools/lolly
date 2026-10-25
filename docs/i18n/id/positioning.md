# Bagaimana Lolly dibandingkan

Lolly adalah dua bagian dari satu proyek sumber terbuka. **Lolly** adalah engine, aplikasi, dan alat untuk membuat, menyunting, mengonversi, dan mengekspor di perangkat Anda, tanpa akun. **Lolly Work** adalah server organisasi, dijalankan di infrastruktur Anda sendiri, untuk login, proyek bersama, persetujuan, dan rendering server. Keduanya MPL-2.0. Halaman ini membandingkan pasangan itu dengan cara-cara lain orang mendesain, mengatur, dan memproduksi file.

## Alat masa kini

Setiap cincin menilai seberapa lengkap suatu kelas produk menyediakan sebuah kapabilitas, dengan setiap kelas dinilai pada wakil terbaiknya. Kolom Lolly mencakup Lolly dan Lolly Work bersama, dan setiap baris menyatakan bagian mana yang menyediakan apa. Buka nama baris untuk penalaran di balik skornya. Kolom diurutkan menurut baris Overall completeness di bagian atas: rata-rata baris yang dinilai, dengan baris pengeluaran tidak dihitung.

::: figure positioning-comparison
Perbandingan kapabilitas: riset pesaing dan skor dari Agustus 2026; cakupan Lolly + Lolly Work ditinjau 28 September 2026. Penilaian: 0 tidak ada, 25 tingkat akal-akalan, 50 nyata tetapi terbatas atau parsial, 75 kuat dengan catatan, 100 kompetensi inti.
:::

::: details Catatan penilaian
Fitur yang tersedia dan kematangan produksi adalah dua hal terpisah. Lolly sudah dirilis: versi 1.0 dikirim sebagai sumber terbuka pada 30 Agustus 2026, keamanannya belum diaudit secara independen, dan bukti adopsinya baru beberapa bulan ([Adoption & Governance](/info/adoption-governance.html#status) memuat keadaan terkini). Memiliki single sign-on, persetujuan, atau rendering server tidak menetapkan rekam jejak produksi, jadi skor kematangan mencerminkan itu. Skor pesaing mempertahankan tinjauan Agustus yang bertanggal.

Satu aturan mengatur papan ini. Nilai penuh (100), pada baris yang menyentuh konten atau identitas Anda, memerlukan kapabilitas yang dapat dipakai tanpa akun dan tanpa prasyarat cloud; baris tentang produk itu sendiri, seperti kematangan dan kemudahan penggunaan, dikecualikan. Aturan itu merugikan Adobe pada Content Credentials: implementasi terluas yang dikirim (Photoshop, Lightroom, Premiere, Firefly) menandatangani secara lokal dan di cloud, tetapi tidak pernah tanpa akun dan identitas Adobe, jadi 75. Aturan itu membatasi API rendering pada generasi massal dan otomatisasi karena alasan yang sama.

Canva dinilai pada anggota keluarganya yang terbaik per baris, karena ia memiliki Affinity dan Cavalry (keduanya dibagikan gratis pada Oktober 2025). Rendering offline dan di perangkat mendapat 75 melalui Affinity, suite desktop yang masih memerlukan akun terverifikasi dan membawa telemetri, pengurangan yang juga dikenakan pada Adobe; mode offline Canva sendiri hanya menyunting desain yang sudah disinkronkan sebelumnya, di satu perangkat, untuk jendela terbatas. Autofill mendapat 50: nyata tetapi terbatas Enterprise dan asinkron, dan hanya mengisi teks dan gambar. Generasi massal Figma naik dari 25 ke 50 ketika Buzz mengirim pengisian spreadsheet (beta gratis, Agustus 2026).

Skor Content Credentials Lolly 75 mencakup penandatanganan di perangkat dan penandatanganan server Lolly Work dengan identitas organisasi yang dikonfigurasi; verifier masih harus memercayai penandatangan ([Content Credentials Identity](/info/content-credentials-identity.html)). Skor 50 Penpot datang melalui plugin ekspor Lolly sendiri untuk Penpot: penandatanganan engine yang sama, ikut serta dan diungkapkan sebagai milik Lolly. Penpot mendapat 90 pada rendering di perangkat: kanvas browser dengan target simpan di servernya, yang dapat di-host sendiri. Cloudinary mendapat kolomnya sendiri untuk pustaka aset, API transformasi, dan CDN-nya; tinjauan Agustus menilai penandatanganan pengirimannya 50.

Kolaborasi langsung Lolly mencakup collab privat langsung dua perangkat dan work collab terautentikasi melalui Lolly Work, dengan suntingan bersama, kursor, dan sesi tim tersimpan. Skor Partial mencerminkan deployment kerja node tunggal saat ini dan riwayat operasi yang singkat, bukan ketiadaan penyuntingan tim. Perkiraan harga adalah aritmetika harga daftar bertanggal untuk skala, bukan pengadaan.
:::

## Kapan memilih Lolly

::: cols
## Pilih Lolly bila

- Jenis file yang sama dibutuhkan berulang kali: ubin acara, tanda pengenal, sertifikat, peringatan, kartu sosial
- Banyak file berasal dari satu templat dan tabel nilai, di [Batch](/info/batch.html#make-many-versions-of-one-design) atau CLI
- Warna, huruf, dan aset harus tetap di dalam design system, bahkan di kanvas terbuka
- Desain Figma, Penpot, Illustrator, InDesign, atau PDF yang sudah jadi harus menjadi dapat disunting dan dapat diulang ([Import a design](/info/design-import.html))
- File harus dibuat di perangkat atau server Anda sendiri

## Pilih yang lain bila

- Pekerjaannya retouching foto atau ilustrasi yang detail
- Anda merancang dan membuat prototipe antarmuka aplikasi
- Anda memerlukan pustaka stok dan templat besar yang siap sejak hari pertama
- Anda memerlukan layanan terkelola dengan rekam jejak panjang pada skala besar
:::

Desain yang diimpor dan token desain bersama memungkinkan tim menggabungkan Lolly dengan aplikasi spesialis, sementara Lolly Work mengatur aset bersama, tinjauan, dan pengiriman.

Seluruh deck slide menunjukkan langit-langitnya: di **Markdown Slides** deck dideklarasikan sebagai data, ditata secara langsung, dan diekspor sebagai file PowerPoint native yang dapat disunting.

![Markdown Slides dalam tampilan terbagi: slide deck terdaftar sebagai blok di kiri, deck yang sudah ditata dirender di kanan](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&dark=1&filename=ov2-deck-studio-output)

## Aturan hidup di dalam alat

Lolly menaruh aturan brand yang dapat dipakai ulang di dalam alat: warna, font, margin bleed, jarak, dan input yang diizinkan. Templat menetapkan bagian yang tidak boleh diubah penerima. Lolly Work menambahkan akses grup dan kebijakan input di sekitar templat itu, dengan rantai persetujuan untuk pengajuan katalog dan pengiriman.

Memeriksa alat sekali membuat produksi berulang lebih mudah, karena setiap keluaran mewarisi aturan tata letaknya. Teks, citra yang diunggah, dan hak penggunaan masih mungkin perlu diperiksa, dan Lolly Work menyediakan katalog bersama dan langkah persetujuan untuk itu. Bagi tim kreatif alat adalah pagar pengaman: Anda tetap membawa data, teks, dan gambar, dan alat menjaga setiap hasil tetap sesuai brand.

![Seluruh tugas produsen: mengetik kata-katanya. Huruf, warna, dan jarak sudah ditetapkan saat alat dibuat](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DHello&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&filename=aud-rules-in-the-tool)

Tiga hal lagi yang membedakan pendekatan ini:

- **File akhir, dari input.** Input masuk, file jadi keluar, tanpa "sekarang simpan dari alat desain Anda dan rapikan".
- **Alat menyusun alat.** Satu alat dapat menyematkan render alat lain dalam satu file jadi, tanpa kopling kode antar keduanya.
- **Terbuka sampai ke dasar.** Engine adalah sumber terbuka, dan alat, aset, serta token desain adalah file yang dapat Anda simpan dalam kendali versi atau kelola di Lolly Work, bukan baris di database orang lain.

Desain yang berani tetap bertahan di balik pagar pengaman. Peta kota kelas poster ini adalah path jalan dan air vektor sejati, dari satu dropdown dan dua field warna yang tidak dapat diarahkan ke luar design system:

![Cincin kanal dan jaringan jalan Amsterdam digambar dari tepi ke tepi dengan tinta design system sendiri, setiap goresan ditempatkan oleh templat, bukan dengan tangan](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam%26theme%3Dlight%26full&width=1440&height=900&dpi=96&waitMs=3200&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-street-map-poster)

## Berinovasi secara probabilistik, berskala secara deterministik

Kebanyakan penawaran "kreatif AI" menaruh model di sisi yang salah dari garis lama. Para penyalin naskah dan pengiluminasi sudah menetapkan di mana garis itu jatuh. Anda bekerja longgar pada sketsa, tempat apa pun boleh dicoba dan tidak ada yang mengikat. Lalu Anda menuju mesin cetak, yang mengikat. Sketsa adalah tempat seninya, dan mesin cetak adalah cara seni itu beredar, dan karya cetak dapat dipercaya karena mesin cetak menepati janjinya pada setiap cetakan.

Lolly adalah mesin cetak itu. Bawa apa pun yang Anda suka untuk ide, model, desainer, atau gambar kasar, tetapi saat ide harus menjadi banyak file, ia melewati sesuatu yang merender dengan cara yang sama setiap kali, dari input yang dapat dibaca kembali siapa pun. Perbandingan di atas sebenarnya tentang siapa yang membuat langkah yang mengikat itu dapat diulang.

> Percayai proses kreatif, berskala dengan kedisiplinan.

## Gratis selamanya

**Jika dirender di perangkat Anda, ia gratis selamanya.** Engine, shell, alat, dan format adalah sumber terbuka, dan versi yang dirilis tidak dapat ditarik kembali. Lolly Work juga sumber terbuka. Organisasi membayar infrastruktur dan operasi yang dipilihnya, tanpa biaya lisensi perangkat lunak per kursi atau per render untuk hosting sendiri. [Questions & answers](/info/faq.html) menceritakan kisah di balik janji itu.

## Di mana konten Anda berada

Karya kreatif Lolly dapat berjalan di perangkat keras milik Anda, dan token desain, font, logo, serta alatnya adalah file yang dapat Anda simpan. Dengan Lolly Work, proyek bersama, aset, kebijakan, dan catatan audit berada di penyimpanan yang dikonfigurasi organisasi Anda. [Trust](/info/trust.html) menjelaskan mengapa itu penting, dan [Privacy Policy](/info/privacy.html) serta [Verify It Yourself](/info/verify-yourself.html) memungkinkan Anda memeriksa klaimnya alih-alih percaya begitu saja pada kami.

## Alat demi alat

[Lolly compared, tool by tool](/info/compare.html) membandingkan Lolly dengan Canva, Adobe, Figma, Penpot, portal brand, API rendering, dan konverter online, satu halaman masing-masing, dan memaparkan [what runs where](/info/compare.html#what-runs-where).
