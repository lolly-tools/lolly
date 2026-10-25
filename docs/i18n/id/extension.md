# Ekstensi browser

Halaman web tidak dapat membaca piksel situs lain, jadi aplikasi web Lolly membutuhkan bantuan untuk menangkap layar halaman. Di browser berbasis Chromium (Chrome, Edge, Brave, Arc, atau Opera, dari Chrome 111), ekstensi gratis **Lolly URL Screenshot** memberi bantuan itu, memakai penangkapan yang sama dengan aplikasi desktop. Dengan ekstensi terpasang:

- **[URL Screenshot](/t/url-shot)** menyimpan halaman yang Anda susun sebagai file;
- alamat web yang ditempel ke slot gambar dapat menjadi tangkapan layar halaman itu, dengan **Screenshot this page**;
- sumber **Website** di [Design System Setup](/info/brand-studio.html) dapat membaca satu halaman untuk memulai design system.

Anda menyetujui setiap permintaan, dan aplikasi desktop mengerjakan pekerjaan yang sama tanpa ekstensi.

## Sebelum Anda memasang

Sebelum ekstensi dipasang, **URL Screenshot** tetap terbuka, sehingga Anda dapat menyusun tangkapan. Catatan di atas kontrol alat menyatakan apa yang kurang.

![Catatan tool URL Screenshot menawarkan ekstensi, ditampilkan saat capture ke berkas tidak memiliki host untuk dijalankan](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%23capture-hint-notice&dark=1&filename=exp-url-shot-notice)

Setiap kontrol berfungsi selagi Anda menunggu: URL target, kedalaman gulir, jeda stabil, inset pangkas, dan pewarnaan ulang. Hanya penangkapan itu sendiri yang membutuhkan ekstensi.

![Kontrol URL Screenshot dengan URL target, kedalaman gulir, jeda penetapan dan inset crop, semuanya bisa digunakan sebelum ekstensi ada](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot%3Furl%3Dhttps%3A%2F%2Flolly.tools%26scrollDepth%3D0.3%26waitMs%3D1200&width=1440&height=2200&dpi=192&waitMs=2400&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&walker=1&dark=1&filename=fq-url-shot-controls)

## Pasang

**Dari Chrome Web Store:** segera hadir. Setelah ekstensi diterbitkan, Anda memasangnya dengan satu klik.

**Muat sendiri (pengembang).** Ekstensi berada di repositori pada `shells/chrome-extension/`. Folder itu adalah build produksi, yang hanya bekerja dengan Lolly di `https://lolly.tools`.

1. Buka `chrome://extensions`.
2. Aktifkan **Developer mode** (kanan atas).
3. Klik **Load unpacked** dan pilih folder `shells/chrome-extension/`.
4. Muat ulang tab Lolly. Deteksi terjadi saat halaman dimuat, jadi permintaan "Get the extension" hilang. **URL Screenshot** (di bawah Utilities) kemudian dapat menyimpan tangkapan ke file dan tersedia dalam mode Batch.

Untuk server pengembangan lokal, jalankan `pnpm run pack:chrome-extension:dev` dan muat `dist/chrome-extension-dev` sebagai gantinya. Paket itu juga menerima `http://localhost:5173` dan memiliki **Development** pada namanya.

## Apa yang terjadi saat Lolly meminta

![Tab Lolly meminta satu halaman dan Anda menekan Approve once di jendela persetujuan ekstensi. Tab latar belakang terbuka, membaca halaman, dan menutup. Lalu tab Lolly mendapat hasilnya.](/info/diagrams/concepts/extension-request.svg)

1. **Lolly meminta.** Skrip kecil memberi tahu Lolly bahwa ekstensi ada, sehingga penangkapan atau pembacaan halaman dapat dimulai tanpa penyiapan lebih lanjut.
2. **Anda menyetujui.** Ekstensi membuka jendela **Approve page request** miliknya sendiri. Jendela itu menampilkan situs peminta, apakah ia menginginkan tangkapan layar atau isi halaman, dan alamat halaman. Tidak ada yang dibaca sampai Anda menekan **Approve once**. **Cancel**, atau menutup jendela, mengakhiri permintaan.
3. **Chrome bertanya sekali per situs.** Pertama kali Anda menyetujui permintaan untuk suatu situs, Chrome juga menanyakan apakah ekstensi boleh mengakses situs itu. Chrome mempertahankan akses itu setelah Anda mengizinkan, tetapi setiap permintaan berikutnya tetap memerlukan **Approve once** sendiri.
4. **Halaman dibaca di tab latar belakang.** Ekstensi membuka halaman target di tab latar belakang, menangkapnya melalui DevTools Protocol (`Page.captureScreenshot` yang sama dengan yang dipakai aplikasi desktop), menutup tab, dan menyerahkan hasilnya ke tab Lolly yang meminta.

Persetujuan mencakup satu permintaan dan kedaluwarsa setelah 30 detik. Hanya satu permintaan yang dapat menunggu atau berjalan pada satu waktu, dan permintaan yang disetujui berhenti setelah 55 detik. Bila halaman Lolly tertutup atau berubah, atau halaman target berpindah ke situs lain, permintaan dibatalkan.

Penangkapan berjalan di browser Anda, di jaringan Anda, sehingga `localhost` dan situs internal berfungsi. Halaman dimuat dengan sesi browser Anda, jadi halaman tempat Anda login dapat menampilkan informasi pribadi di hasilnya. Penangkapan tidak diunggah: satu-satunya lalu lintas jaringan adalah browser Anda sendiri memuat halaman yang Anda minta.

Selama penangkapan berjalan Anda mungkin sebentar melihat banner *"…started debugging this browser"* pada tab sementara. Itu DevTools Protocol yang bekerja, dan banner hilang saat tangkapan selesai.

## Membaca situs untuk Design System Setup

Sumber **Website** di Design System Setup memulai design system dari situs yang sudah Anda miliki. Di browser Chromium ekstensi membaca halaman. Di aplikasi desktop, aplikasi mengambil halaman sendiri. Di browser tanpa ekstensi, ubin Website tidak ditawarkan.

- **Satu alamat, satu halaman.** Setelah Anda menyetujui, ekstensi membuka halaman di tab latar belakang yang sama, membaca markup yang dirender, teks stylesheet, dan segelintir gambar ikon dan logo, lalu menutup tab. Ia tidak mengikuti tautan atau merayap.
- **Stylesheet yang dihosting di tempat lain** (CDN atau layanan font) juga diambil, karena warna dan huruf halaman berada di dalamnya. Permintaan lintas origin berjalan tanpa cookie Anda; permintaan same-origin memakainya, seperti halaman itu sendiri.
- **Semuanya dibatasi**, dengan batas jumlah stylesheet dan gambar serta byte, sehingga halaman yang memusuhi atau setengah rusak mengembalikan materi parsial alih-alih menggantung.
- **Penguraian terjadi di perangkat Anda.** Byte langsung kembali ke tab Lolly yang meminta, yang mengubahnya menjadi warna, huruf, dan logo.

Menempel alamat hanya mengisi field. Tidak ada yang dibaca sampai Anda memulai pembacaan dan menekan **Approve once**.

## Izin

`manifest.json` ekstensi mendeklarasikan empat izin, ditambah akses situs yang diminta satu situs per satu waktu. Ia menetapkan `minimum_chrome_version: 111`, dan versi saat ini adalah 0.4.0.

| Izin | Fungsinya | Kapan diberikan |
|---|---|---|
| `debugger` | Menggerakkan tab latar belakang melalui DevTools Protocol, yang mengambil tangkapan layar. | Saat pemasangan |
| `tabs` | Membuka tab latar belakang sementara dan menutupnya sesudahnya, dan memeriksa bahwa baik halaman Lolly maupun halaman target belum berpindah sejak Anda menyetujui. | Saat pemasangan |
| `scripting` | Menjalankan pembaca satu halaman di dalam situs yang Anda sebut, untuk sumber Website. | Saat pemasangan |
| `storage` | Mencatat id tab yang dibukanya, hanya di session storage, agar tab tetap tertutup bila browser menangguhkan ekstensi di tengah pembacaan. Dibersihkan pada awal berikutnya; tidak ada tentang Anda yang disimpan. | Saat pemasangan |
| `optional_host_permissions: ["http://*/*", "https://*/*"]` | Akses situs, tidak diberikan saat pemasangan. Saat Anda menekan **Approve once**, ekstensi meminta Chrome akses ke satu situs dalam permintaan itu. | Pertama kali Anda menyetujui permintaan untuk situs itu, setelah Chrome menanyakan Anda |

Ekstensi hanya membaca satu halaman yang Anda setujui. Ia tidak membaca atau mengirim data penjelajahan Anda, dan tidak ada yang diunggah.

## Pemecahan masalah

- **Masih melihat "Get the extension"?** Muat ulang tab Lolly.
- **Tidak ada yang terjadi di situs ini?** Ekstensi hanya bekerja di `https://lolly.tools`, ditambah `http://localhost:5173` dalam paket pengembangan. Origin lain, seperti salinan Lolly yang di-host sendiri, memerlukan build ekstensi sendiri yang mencantumkan origin itu di `manifest.json` dan `policy.js`. Menyunting manifes saja tidak berhasil.
- **Penangkapan gagal?** Periksa bahwa URL dapat dijangkau dan diawali `http://` atau `https://`. Beberapa halaman memblokir penangkapan otomatis. Bila Anda menekan **Cancel**, menutup jendela persetujuan, atau menunggu lebih dari 30 detik, mulai penangkapan lagi.
