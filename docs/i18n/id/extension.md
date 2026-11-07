# Ekstensi browser

Halaman web tidak dapat membaca piksel situs lain, jadi aplikasi web Lolly membutuhkan bantuan untuk menangkap layar halaman. Di browser berbasis Chromium (Chrome, Edge, Brave, Arc, atau Opera, dari Chrome 111), ekstensi gratis **Lolly URL Screenshot** memberi bantuan itu, memakai penangkapan yang sama dengan aplikasi desktop. Dengan ekstensi terpasang:

- **[Lolly URL Screenshot](/t/url-shot)** menyimpan halaman yang Anda susun sebagai file;
- alamat web yang ditempel ke slot gambar dapat menjadi tangkapan layar halaman itu, dengan **Screenshot this page**;
- sumber **Website** di [Lolly Design System Setup](/info/brand-studio.html) dapat membaca satu halaman untuk memulai design system.

Anda menyetujui setiap permintaan, dan aplikasi desktop mengerjakan pekerjaan yang sama tanpa ekstensi.

## Sebelum Anda memasang

Sebelum ekstensi dipasang, **Lolly URL Screenshot** tetap terbuka, sehingga Anda dapat menyusun tangkapan. Catatan di atas kontrol alat menyatakan apa yang kurang.

![Catatan tool URL Screenshot menawarkan ekstensi, ditampilkan saat capture ke berkas tidak memiliki host untuk dijalankan](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%23capture-hint-notice&dark=1&filename=exp-url-shot-notice)

Setiap kontrol berfungsi selagi Anda menunggu: URL target, kedalaman gulir, jeda stabil, inset pangkas, dan pewarnaan ulang. Hanya penangkapan itu sendiri yang membutuhkan ekstensi.

![Kontrol Lolly URL Screenshot dengan URL target, kedalaman gulir, jeda penetapan dan inset crop, semuanya bisa digunakan sebelum ekstensi ada](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot%3Furl%3Dhttps%3A%2F%2Flolly.tools%26scrollDepth%3D0.3%26waitMs%3D1200&width=1440&height=2200&dpi=192&waitMs=2400&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&walker=1&dark=1&filename=fq-url-shot-controls)

## Pasang

**Dari Chrome Web Store:** segera hadir. Setelah ekstensi diterbitkan, Anda memasangnya dengan satu klik.

**Muat sendiri (pengembang).** Kode sumber ekstensi berada di repositori pada `shells/chrome-extension/`. Langkah pengemasan membangun paket produksi dari folder itu, yang hanya bekerja dengan Lolly di `https://lolly.tools`.

1. Jalankan `pnpm run pack:chrome-extension`. Perintah itu membangun paket ke `dist/chrome-extension/`.
2. Buka `chrome://extensions`.
3. Aktifkan **Developer mode** (kanan atas).
4. Klik **Load unpacked** dan pilih folder `dist/chrome-extension/`.
5. Muat ulang tab Lolly. Deteksi terjadi saat halaman dimuat, jadi permintaan "Get the extension" hilang. **Lolly URL Screenshot** (di bawah Utilities) kemudian dapat menyimpan tangkapan ke file dan tersedia dalam mode Lolly Batch.

Untuk server pengembangan lokal, jalankan `pnpm run pack:chrome-extension:dev` dan muat `dist/chrome-extension-dev` sebagai gantinya. Paket itu juga menerima `http://localhost:5173` dan memiliki **Development** pada namanya.

Memuat folder `shells/chrome-extension/` itu sendiri juga berfungsi, untuk tangkapan layar PNG. Folder itu tidak punya penelusuran halaman (langkah pengemasan yang membangunkannya), jadi SVG darinya berisi tangkapan layar, bukan bentuk.

## Apa yang terjadi saat Lolly meminta

![Tab Lolly meminta satu halaman dan Anda menekan Approve once di jendela persetujuan ekstensi. Tab latar belakang terbuka, membaca halaman, dan menutup. Lalu tab Lolly mendapat hasilnya.](/info/diagrams/concepts/extension-request.svg)

1. **Lolly meminta.** Skrip kecil memberi tahu Lolly bahwa ekstensi ada, sehingga penangkapan atau pembacaan halaman dapat dimulai tanpa penyiapan lebih lanjut.
2. **Anda menyetujui.** Ekstensi membuka jendela **Approve page request** miliknya sendiri. Jendela itu menampilkan situs peminta, apakah ia menginginkan tangkapan layar atau isi halaman, dan alamat halaman. Tidak ada yang dibaca sampai Anda menekan **Approve once**. **Cancel**, atau menutup jendela, mengakhiri permintaan.
3. **Chrome bertanya sekali per situs.** Pertama kali Anda menyetujui permintaan untuk suatu situs, Chrome juga menanyakan apakah ekstensi boleh mengakses situs itu. Chrome mempertahankan akses itu setelah Anda mengizinkan, tetapi setiap permintaan berikutnya tetap memerlukan **Approve once** sendiri.
4. **Halaman dibaca di tab latar belakang.** Ekstensi membuka halaman target di tab latar belakang, menangkapnya melalui DevTools Protocol (`Page.captureScreenshot` yang sama dengan yang dipakai aplikasi desktop), menutup tab, dan menyerahkan hasilnya ke tab Lolly yang meminta.

Untuk **SVG**, ekstensi menelusuri halaman, bukan memotret layar. Skrip yang dikemas bersama ekstensi membaca tata letak halaman di tab latar belakang itu dan mengubah halaman menjadi bentuk dan teks berkontur, sehingga file tetap tajam di ukuran apa pun dan setiap bagian tetap dapat disunting. Gambar di halaman terbawa sebagai gambar apa adanya, dan apa yang digambar halaman dengan canvas, video, atau efek yang tidak punya bentuk dalam SVG disalin dari tangkapan layar pada saat yang sama. Lolly memeriksa hasilnya terhadap tangkapan layar itu, dan bila keduanya berbeda terlalu jauh, SVG berisi tangkapan layar tersebut.

Untuk mengonturkan teks dalam jenis huruf milik halaman itu sendiri, ekstensi menyerahkan ke Lolly file font yang dimuat halaman. Chrome tidak menyimpan byte font di tempat yang dapat dibaca ekstensi, jadi ekstensi meminta setiap font lagi dari halaman. Browser Anda biasanya menjawab dari cache-nya, dan kebijakan keamanan halaman itu sendiri tetap berlaku untuk permintaan tersebut.

Persetujuan mencakup satu permintaan dan kedaluwarsa setelah 30 detik. Hanya satu permintaan yang dapat menunggu atau berjalan pada satu waktu, dan permintaan yang disetujui berhenti setelah 55 detik. Bila halaman Lolly tertutup atau berubah, atau halaman target berpindah ke situs lain, permintaan dibatalkan.

Penangkapan berjalan di browser Anda, di jaringan Anda, sehingga `localhost` dan situs internal berfungsi. Halaman dimuat dengan sesi browser Anda, jadi halaman tempat Anda login dapat menampilkan informasi pribadi di hasilnya. Penangkapan tidak diunggah: satu-satunya lalu lintas jaringan adalah browser Anda sendiri memuat halaman yang Anda minta, ditambah, untuk SVG, file font halaman itu untuk kedua kalinya.

Selama penangkapan berjalan Anda mungkin sebentar melihat banner *"…started debugging this browser"* pada tab sementara. Itu DevTools Protocol yang bekerja, dan banner hilang saat tangkapan selesai.

<a id="reading-a-site-for-design-system-setup"></a>
## Membaca situs untuk Lolly Design System Setup

Sumber **Website** di Lolly Design System Setup memulai design system dari situs yang sudah Anda miliki. Di browser Chromium ekstensi membaca halaman. Di aplikasi desktop, aplikasi mengambil halaman sendiri. Di browser tanpa ekstensi, ubin Website tidak ditawarkan.

- **Satu alamat, satu halaman.** Setelah Anda menyetujui, ekstensi membuka halaman di tab latar belakang yang sama, membaca markup yang dirender, teks stylesheet, dan segelintir gambar ikon dan logo, lalu menutup tab. Ia tidak mengikuti tautan atau merayap.
- **Stylesheet yang dihosting di tempat lain** (CDN atau layanan font) juga diambil, karena warna dan huruf halaman berada di dalamnya. Permintaan lintas origin berjalan tanpa cookie Anda; permintaan same-origin memakainya, seperti halaman itu sendiri.
- **Semuanya dibatasi**, dengan batas jumlah stylesheet dan gambar serta byte, sehingga halaman yang memusuhi atau setengah rusak mengembalikan materi parsial alih-alih menggantung.
- **Penguraian terjadi di perangkat Anda.** Byte langsung kembali ke tab Lolly yang meminta, yang mengubahnya menjadi warna, huruf, dan logo.

Menempel alamat hanya mengisi field. Tidak ada yang dibaca sampai Anda memulai pembacaan dan menekan **Approve once**.

## Izin

`manifest.json` ekstensi mendeklarasikan empat izin, ditambah akses situs yang diminta satu situs per satu waktu. Ia menetapkan `minimum_chrome_version: 111`, dan versi saat ini adalah 0.5.0.

| Izin | Fungsinya | Kapan diberikan |
|---|---|---|
| `debugger` | Menggerakkan tab latar belakang melalui DevTools Protocol, yang mengambil tangkapan layar dan, untuk SVG, menjalankan penelusuran halaman. | Saat pemasangan |
| `tabs` | Membuka tab latar belakang sementara dan menutupnya sesudahnya, dan memeriksa bahwa baik halaman Lolly maupun halaman target belum berpindah sejak Anda menyetujui. | Saat pemasangan |
| `scripting` | Menjalankan pembaca satu halaman di dalam situs yang Anda sebut, untuk sumber Website. | Saat pemasangan |
| `storage` | Mencatat id tab yang dibukanya, hanya di session storage, agar tab tetap tertutup bila browser menangguhkan ekstensi di tengah pembacaan. Dibersihkan pada awal berikutnya; tidak ada tentang Anda yang disimpan. | Saat pemasangan |
| `optional_host_permissions: ["http://*/*", "https://*/*"]` | Akses situs, tidak diberikan saat pemasangan. Saat Anda menekan **Approve once**, ekstensi meminta Chrome akses ke satu situs dalam permintaan itu. | Pertama kali Anda menyetujui permintaan untuk situs itu, setelah Chrome menanyakan Anda |

Ekstensi hanya membaca satu halaman yang Anda setujui. Ia tidak membaca atau mengirim data penjelajahan Anda, dan tidak ada yang diunggah.

## Pemecahan masalah

- **Masih melihat "Get the extension"?** Muat ulang tab Lolly.
- **Tidak ada yang terjadi di situs ini?** Ekstensi hanya bekerja di `https://lolly.tools`, ditambah `http://localhost:5173` dalam paket pengembangan. Origin lain, seperti salinan Lolly yang di-host sendiri, memerlukan build ekstensi sendiri yang mencantumkan origin itu di `manifest.json` dan `policy.js`. Menyunting manifes saja tidak berhasil.
- **Penangkapan gagal?** Periksa bahwa URL dapat dijangkau dan diawali `http://` atau `https://`. Beberapa halaman memblokir penangkapan otomatis. Bila Anda menekan **Cancel**, menutup jendela persetujuan, atau menunggu lebih dari 30 detik, mulai penangkapan lagi.
