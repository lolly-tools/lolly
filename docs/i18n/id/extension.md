# Ekstensi Browser

Ekstensi **Lolly URL Screenshot** memungkinkan aplikasi web mengambil tangkapan layar halaman web mana pun dari dalam browser Anda. Tanpanya, menangkap URL memerlukan aplikasi desktop - halaman browser tidak bisa membaca piksel dari situs lain dengan sendirinya. Ekstensi ini bisa, menggunakan mekanisme tangkap yang sama dengan yang dipakai aplikasi desktop.

Ia melakukan satu tugas lain dengan cara yang sama: membaca satu halaman yang Anda sebutkan sehingga Brand Studio bisa menarik sebuah brand dari sebuah website live. Keduanya dibahas di bawah.

Berjalan di browser berbasis Chromium: **Chrome, Edge, Brave, Arc, Opera** - Chrome 111 atau lebih baru.

Sampai terpasang, **URL Screenshot** tetap terbuka sehingga Anda bisa menyusun bidikan, dan catatan di bagian atas kontrol tool memberi tahu apa yang belum ada.

![Catatan tool URL Screenshot menawarkan ekstensi, ditampilkan saat capture ke berkas tidak memiliki host untuk dijalankan](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%23capture-hint-notice&dark=1&filename=exp-url-shot-notice)

Setiap kontrol tetap aktif sementara Anda menunggu: URL target, kedalaman gulir, jeda penetapan, inset crop dan pewarnaan ulang. Hanya proses capture itu sendiri yang membutuhkan host.

![Kontrol URL Screenshot dengan URL target, kedalaman gulir, jeda penetapan dan inset crop, semuanya bisa digunakan sebelum ekstensi ada](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot%3Furl%3Dhttps%3A%2F%2Flolly.tools%26scrollDepth%3D0.3%26waitMs%3D1200&width=1440&height=2200&dpi=192&waitMs=2400&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&walker=1&dark=1&filename=fq-url-shot-controls)

## Pasang

### Dari Chrome Web Store

*Segera hadir.* Setelah diterbitkan Anda akan memasangnya dengan satu klik, lalu memuat ulang Lolly.

### Muat sendiri (pengembang)

Ekstensi ini berada di repo pada `shells/chrome-extension/`.

1. Buka `chrome://extensions`.
2. Aktifkan **Developer mode** (kanan atas).
3. Klik **Load unpacked** dan pilih folder `shells/chrome-extension/`.
4. Muat ulang Lolly - **URL Screenshot** kini berfungsi di browser.

## Cara kerjanya

- Skrip kecil memberi tahu Lolly bahwa ekstensi ada, sehingga tool **URL Screenshot** aktif secara otomatis - tanpa pengaturan.
- Saat Anda merender, ekstensi membuka halaman target di tab latar belakang, menangkapnya melalui DevTools Protocol (`Page.captureScreenshot` yang sama dengan yang dipakai aplikasi desktop), lalu menutup tab dan mengembalikan gambar tersebut.
- Ekstensi berjalan sepenuhnya di browser Anda, di jaringan Anda - jadi menangkap `localhost` atau situs internal tetap berfungsi. Hasil capture itu sendiri tidak pernah diunggah ke mana pun; satu-satunya lalu lintas jaringan adalah browser Anda sendiri memuat halaman yang Anda minta untuk dibidik.

Selama capture berjalan, Anda mungkin sekilas melihat banner *"…started debugging this browser"* di tab sementara tersebut. Itu adalah DevTools Protocol yang sedang bekerja; banner itu hilang sendiri saat bidikan selesai.

## Membaca situs untuk Brand Studio

Sumber **Website** di Brand Studio memulai sebuah brand dari situs yang sudah Anda miliki. Di Chromium, ekstensilah yang membacanya; di aplikasi desktop, fetch native melakukan tugas yang sama, dan di browser biasa tanpa ekstensi, ubin ini sama sekali tidak ditawarkan.

Yang terjadi saat Anda menekannya:

- Satu alamat, satu halaman. Ekstensi membukanya di jenis tab latar belakang yang sama, membaca markup yang dirender, teks stylesheet dan beberapa gambar ikon serta logo, lalu menutup tab. Ekstensi tidak mengikuti tautan dan tidak melakukan crawling.
- Stylesheet dan font yang dihosting di tempat lain (CDN, layanan font) juga diambil, karena warna dan tipografi halaman berada di dalamnya. Permintaan lintas asal berjalan tanpa cookie Anda; permintaan asal-sama menggunakannya, persis seperti yang dilakukan halaman itu sendiri.
- Semuanya dibatasi - jumlah sheet, gambar dan byte yang terbatas - sehingga halaman yang jahat atau setengah rusak mengembalikan materi parsial alih-alih macet.
- Byte langsung dikembalikan ke tab Lolly yang memintanya. Penguraian menjadi warna, tipografi dan logo terjadi di perangkat Anda; tidak ada yang diunggah.

Tidak ada yang dibaca sampai Anda menekan tombol. Menempelkan alamat hanya mengisi kolomnya.

## Setelah memasang

Muat ulang tab Lolly. Prompt "Get the extension" akan hilang dan **URL Screenshot** menjadi tersedia di galeri dan di mode Batch.

## Izin

`manifest.json`-nya mendeklarasikan empat izin plus akses host:

- `debugger` - mengendalikan tab latar belakang melalui DevTools Protocol. Inilah yang mengambil tangkapan layar.
- `tabs` - membuka tab latar belakang sementara dan menutupnya kembali setelahnya.
- `scripting` - menjalankan pembaca satu-halaman di dalam situs yang Anda tentukan, untuk sumber Website Brand Studio.
- `storage` - mencatat id tab yang dibukanya, hanya di session storage, sehingga tab tetap ditutup jika browser menangguhkan ekstensi di tengah pembacaan. Dihapus pada permulaan berikutnya; tidak ada apa pun tentang Anda yang disimpan.
- `host_permissions: ["<all_urls>"]` - akses host ke *semua* situs, karena Anda bisa mengarahkannya ke URL apa pun yang Anda pilih. Chrome menampilkan ini saat instalasi sebagai peringatan luas "baca dan ubah semua data Anda di semua situs web".

Terlepas dari peringatan itu, ekstensi hanya membaca satu halaman yang Anda minta untuk ditangkap atau diimpor, dan tidak membaca atau mengirimkan data penjelajahan Anda - tidak ada yang diunggah ke mana pun.

Manifes juga menetapkan `minimum_chrome_version: 111`. Versi saat ini adalah 0.2.1.

## Pemecahan masalah

- **Masih melihat "Get the extension"?** Muat ulang tab Lolly - deteksi terjadi saat halaman dimuat.
- **Tidak ada yang terjadi di situs ini?** Ekstensi hanya aktif di origin Lolly sendiri. Menjalankan build kustom di domain lain? Tambahkan ke `content_scripts.matches` di `manifest.json` ekstensi.
- **Capture gagal?** Periksa apakah URL dapat dijangkau dan diawali dengan `http://` atau `https://`. Beberapa halaman secara aktif memblokir capture otomatis.
