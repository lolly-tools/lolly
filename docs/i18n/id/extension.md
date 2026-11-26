# Ekstensi browser

Halaman web tidak dapat membaca piksel situs web lain. Di browser berbasis Chromium (Chrome, Edge, Brave, Arc atau Opera, mulai dari Chrome 111), ekstensi gratis **Lolly URL Screenshot** memungkinkan aplikasi web Lolly mengambil tangkapan layar halaman dengan metode penangkapan yang sama seperti aplikasi desktop. Dengan ekstensi terinstal:

- **[Lolly URL Screenshot](/t/url-shot)** menyimpan halaman yang Anda susun sebagai file;
- alamat web yang ditempelkan ke slot gambar dapat menjadi tangkapan layar halaman tersebut, dengan **Screenshot this page**;
- sumber **Website** di [Lolly Design System Setup](/info/brand-studio.html) dapat membaca satu halaman untuk memulai design system.

Anda menyetujui setiap permintaan, dan aplikasi desktop melakukan pekerjaan yang sama tanpa ekstensi.

<!--i:eti-checklist-->
## Sebelum menginstal

Tanpa ekstensi, **Lolly URL Screenshot** tetap terbuka dan Anda dapat menyusun tangkapan layar. Catatan di bagian atas kontrol alat menyebutkan apa yang belum tersedia.

![Catatan alat URL Screenshot yang menawarkan ekstensi, ditampilkan saat penangkapan ke file tidak memiliki host untuk menjalankannya](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%23capture-hint-notice&dark=1&filename=exp-url-shot-notice)

Setiap kontrol berfungsi tanpa ekstensi: URL tujuan, kedalaman gulir, waktu tunggu hingga halaman stabil, batas pemotongan dan pewarnaan ulang. Hanya penangkapannya yang memerlukan ekstensi.

![Kontrol Lolly URL Screenshot dengan URL tujuan, kedalaman gulir, waktu tunggu hingga halaman stabil dan batas pemotongan, semuanya dapat digunakan sebelum ekstensi tersedia](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot%3Furl%3Dhttps%3A%2F%2Flolly.tools%26scrollDepth%3D0.3%26waitMs%3D1200&width=1440&height=2200&dpi=192&waitMs=2400&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&walker=1&dark=1&filename=fq-url-shot-controls)

<!--i:eti-download-->
## Instal

**Dari Chrome Web Store:** segera hadir. Setelah diterbitkan, ekstensi dapat diinstal dengan satu klik.

**Muat sendiri (pengembang).** Kode sumber ekstensi berada di repositori pada `shells/chrome-extension/`. Langkah pengemasan membuat paket produksi dari folder tersebut. Paket itu hanya berfungsi dengan Lolly di `https://lolly.tools`.

1. Jalankan `pnpm run pack:chrome-extension`. Perintah ini membuat paket di `dist/chrome-extension/`.
2. Buka `chrome://extensions`.
3. Aktifkan **Developer mode** (kanan atas).
4. Klik **Load unpacked** dan pilih folder `dist/chrome-extension/`.
5. Muat ulang tab Lolly. Lolly mendeteksi ekstensi saat halaman dimuat, dan perintah "Get the extension" menghilang. **Lolly URL Screenshot** (di Utilities) kemudian dapat menyimpan tangkapan ke file dan berfungsi dalam mode Lolly Batch.

::: details Untuk server pengembangan lokal, atau folder sumber
Untuk server pengembangan lokal, jalankan `pnpm run pack:chrome-extension:dev` dan muat `dist/chrome-extension-dev` sebagai gantinya. Paket tersebut juga menerima `http://localhost:5173` dan memiliki **Development** dalam namanya.

Memuat folder `shells/chrome-extension/` itu sendiri juga berfungsi untuk tangkapan layar PNG. Folder itu tidak memiliki penelusuran halaman, yang ditambahkan saat pengemasan. SVG dari folder tersebut berisi tangkapan layar, bukan bentuk.
:::

<!--i:eti-user-check-->
## Yang terjadi saat Lolly meminta

![Tab Lolly meminta satu halaman dan Anda menekan Approve once di jendela persetujuan ekstensi. Tab latar belakang terbuka, membaca halaman dan menutup. Lalu tab Lolly menerima hasilnya.](/info/diagrams/concepts/extension-request.svg)

1. **Lolly meminta.** Skrip kecil memberi tahu Lolly bahwa ekstensi tersedia, sehingga penangkapan atau pembacaan halaman dapat dimulai tanpa penyiapan lebih lanjut.
2. **Anda menyetujui.** Ekstensi membuka jendela **Approve page request** miliknya sendiri. Jendela ini menampilkan situs yang meminta, apakah yang diminta tangkapan layar atau isi halaman dan alamat halaman. Tidak ada yang dibaca sebelum Anda menekan **Approve once**. **Cancel**, atau menutup jendela, mengakhiri permintaan.
3. **Chrome meminta sekali per situs.** Saat pertama kali Anda menyetujui permintaan untuk sebuah situs, Chrome juga menanyakan apakah ekstensi boleh mengakses situs tersebut. Chrome mempertahankan akses itu setelah Anda mengizinkannya, tetapi setiap permintaan berikutnya tetap memerlukan **Approve once** tersendiri.
4. **Halaman dibaca di tab latar belakang.** Ekstensi membuka halaman tujuan di tab latar belakang, menangkapnya melalui DevTools Protocol (`Page.captureScreenshot` yang sama seperti yang digunakan aplikasi desktop), menutup tab dan menyerahkan hasilnya kembali ke tab Lolly yang meminta.

::: details Cara kerja penangkapan SVG
Untuk **SVG**, ekstensi menelusuri halaman alih-alih mengambil gambar layar. Skrip yang dikemas bersama ekstensi membaca tata letak halaman di tab latar belakang dan mengubah halaman menjadi bentuk dan teks berkontur. File tetap tajam pada ukuran berapa pun dan setiap bagian tetap dapat disunting. Gambar di halaman tetap berupa gambar. Apa pun yang digambar halaman dengan kanvas, video atau efek yang tidak dapat direpresentasikan SVG disalin dari tangkapan layar pada saat yang sama. Lolly memeriksa hasilnya terhadap tangkapan layar tersebut. Jika keduanya terlalu berbeda, SVG berisi tangkapan layar sebagai gantinya.

Untuk membuat kontur teks dengan jenis huruf halaman itu sendiri, ekstensi menyerahkan file font yang dimuat halaman kepada Lolly. Chrome tidak menyimpan byte font di tempat yang dapat dibaca ekstensi, sehingga ekstensi meminta setiap font kepada halaman sekali lagi. Browser Anda biasanya menjawab dari cache-nya, dan kebijakan keamanan halaman itu sendiri tetap berlaku untuk permintaan tersebut.
:::

Persetujuan mencakup satu permintaan dan kedaluwarsa setelah 30 detik. Hanya satu permintaan yang dapat menunggu atau berjalan pada satu waktu, dan permintaan yang disetujui berhenti setelah 55 detik. Jika halaman Lolly ditutup atau berubah, atau halaman tujuan berpindah ke situs lain, permintaan dibatalkan.

::: warning Penangkapan menggunakan sesi browser Anda
Halaman dimuat dengan sesi browser Anda, sehingga halaman yang telah Anda masuki dapat menampilkan informasi pribadi dalam hasilnya.
:::

Penangkapan berjalan di browser Anda pada jaringan Anda, sehingga `localhost` dan situs internal berfungsi. Hasil tangkapan tidak diunggah. Satu-satunya lalu lintas jaringan adalah browser Anda memuat halaman yang Anda minta dan, untuk SVG, file font halaman tersebut untuk kedua kalinya.

Saat penangkapan berjalan, Anda mungkin melihat banner *"…started debugging this browser"* sebentar di tab sementara. Banner berasal dari DevTools Protocol dan menghilang setelah tangkapan selesai.

<a id="reading-a-site-for-design-system-setup"></a>
<!--i:eti-globe-->
## Membaca situs untuk Lolly Design System Setup

Sumber **Website** di Lolly Design System Setup memulai design system dari situs yang sudah Anda miliki. Di browser Chromium, ekstensi membaca halaman. Di aplikasi desktop, aplikasi mengambil halaman itu sendiri. Di browser tanpa ekstensi, kartu Website tidak ditawarkan.

- **Satu alamat, satu halaman.** Setelah Anda menyetujui, ekstensi membuka halaman di tab latar belakang yang sama jenisnya, membaca markup yang dirender, teks stylesheet dan beberapa gambar ikon dan logo, lalu menutup tab. Ekstensi tidak mengikuti tautan atau merayapi situs.
- **Stylesheet yang dihosting di tempat lain** (CDN atau layanan font) juga diambil, karena berisi warna dan jenis huruf halaman. Permintaan lintas origin dikirim tanpa cookie Anda. Permintaan dari origin yang sama menggunakan cookie Anda, seperti yang dilakukan halaman.
- **Semuanya dibatasi**, dengan batas jumlah stylesheet dan gambar serta byte, sehingga halaman berbahaya atau yang sebagian rusak mengembalikan materi parsial alih-alih macet.
- **Penguraian dilakukan di perangkat Anda.** Byte langsung dikembalikan ke tab Lolly yang meminta, yang mengubahnya menjadi warna, jenis huruf dan logo.

Menempelkan alamat hanya mengisi field. Tidak ada yang dibaca sebelum Anda memulai pembacaan dan menekan **Approve once**.

<!--i:eti-lock-->
## Izin

`manifest.json` ekstensi menyatakan empat izin, ditambah akses situs yang diminta satu situs pada satu waktu. File ini menetapkan `minimum_chrome_version: 111`, dan versi saat ini adalah 0.5.0.

| Izin | Kegunaannya | Kapan diberikan |
|---|---|---|
| `debugger` | Mengendalikan tab latar belakang melalui DevTools Protocol, yang mengambil tangkapan layar dan, untuk SVG, menjalankan penelusuran halaman. | Saat instalasi |
| `tabs` | Membuka tab latar belakang sementara lalu menutupnya, dan memeriksa bahwa halaman Lolly maupun halaman tujuan belum berpindah sejak Anda menyetujui. | Saat instalasi |
| `scripting` | Menjalankan pembaca satu halaman di dalam situs yang Anda tentukan, untuk sumber Website. | Saat instalasi |
| `storage` | Mencatat id tab yang dibukanya, hanya di penyimpanan sesi, sehingga tab tetap ditutup jika browser menangguhkan ekstensi di tengah pembacaan. Dihapus pada saat mulai berikutnya; tidak ada informasi tentang Anda yang disimpan. | Saat instalasi |
| `optional_host_permissions: ["http://*/*", "https://*/*"]` | Akses situs, tidak diberikan saat instalasi. Saat Anda menekan **Approve once**, ekstensi meminta akses kepada Chrome untuk satu situs dalam permintaan tersebut. | Saat pertama kali Anda menyetujui permintaan untuk situs tersebut, setelah Chrome bertanya kepada Anda |

Ekstensi hanya membaca halaman yang Anda setujui. Ekstensi tidak membaca atau mengirim data penjelajahan Anda.

<!--i:eti-help-->
## Pemecahan masalah

- **Masih melihat "Get the extension"?** Muat ulang tab Lolly.
- **Tidak terjadi apa-apa di situs ini?** Ekstensi hanya berfungsi di `https://lolly.tools`, ditambah `http://localhost:5173` dalam paket pengembangan. Origin lain, seperti salinan Lolly yang dihosting sendiri, memerlukan build ekstensi sendiri yang mencantumkan origin tersebut di `manifest.json` dan `policy.js`. Menyunting manifes saja tidak cukup.
- **Penangkapan gagal?** Periksa bahwa URL dapat dijangkau dan dimulai dengan `http://` atau `https://`. Beberapa halaman memblokir penangkapan otomatis. Jika Anda menekan **Cancel**, menutup jendela persetujuan atau menunggu lebih dari 30 detik, mulai penangkapan lagi.
