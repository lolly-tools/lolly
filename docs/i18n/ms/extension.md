# Sambungan Pelayar

Sambungan **Lolly URL Screenshot** membolehkan aplikasi web mengambil tangkapan skrin mana-mana halaman web dari dalam pelayar anda. Tanpanya, menangkap URL memerlukan aplikasi desktop - halaman pelayar tidak boleh membaca piksel dari tapak lain dengan sendirinya. Sambungan ini boleh, menggunakan tangkapan yang sama seperti yang digunakan oleh aplikasi desktop.

Ia melakukan satu lagi tugas dengan cara yang sama: membaca satu halaman yang anda namakan supaya Brand Studio boleh menarik sesuatu jenama daripada satu laman web langsung. Kedua-duanya dibincangkan di bawah.

Ia berjalan pada pelayar berasaskan Chromium: **Chrome, Edge, Brave, Arc, Opera** - Chrome 111 atau lebih baharu.

Sehingga ia dipasang, **URL Screenshot** masih terbuka supaya anda boleh menggubah tangkapan, dan satu nota di atas kawalan alat itu menyatakan apa yang tiada.

![Nota alat URL Screenshot menawarkan sambungan itu, dipaparkan apabila tangkapan ke fail tiada host untuk dijalankan](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%23capture-hint-notice&dark=1&filename=exp-url-shot-notice)

Setiap kawalan aktif semasa anda menunggu: URL sasaran, kedalaman skrol, kelewatan settle, inset pemotongan dan pewarnaan semula. Hanya tangkapan itu sendiri yang memerlukan host.

![Kawalan URL Screenshot dengan URL sasaran, kedalaman skrol, kelewatan settle dan inset pemotongan, semuanya boleh digunakan sebelum sambungan wujud](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot%3Furl%3Dhttps%3A%2F%2Flolly.tools%26scrollDepth%3D0.3%26waitMs%3D1200&width=1440&height=2200&dpi=192&waitMs=2400&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&walker=1&dark=1&filename=fq-url-shot-controls)

## Pasang

### Daripada Chrome Web Store

*Akan datang tidak lama lagi.* Setelah ia diterbitkan anda akan memasangnya dengan satu klik, kemudian muat semula Lolly.

### Muatkan sendiri (pembangun)

Sambungan ini berada dalam repo di `shells/chrome-extension/`.

1. Buka `chrome://extensions`.
2. Hidupkan **Developer mode** (kanan atas).
3. Klik **Load unpacked** dan pilih folder `shells/chrome-extension/`.
4. Muat semula Lolly - **URL Screenshot** kini berfungsi dalam pelayar.

## Cara ia berfungsi

- Satu skrip kecil memberitahu Lolly bahawa sambungan itu wujud, jadi alat **URL Screenshot** aktif secara automatik - tanpa persediaan.
- Apabila anda merender, sambungan membuka halaman sasaran dalam tab latar belakang, menangkapnya melalui DevTools Protocol (`Page.captureScreenshot` yang sama seperti yang digunakan aplikasi desktop), kemudian menutup tab itu dan menyerahkan imej kembali.
- Ia berjalan sepenuhnya dalam pelayar anda, pada rangkaian anda - jadi menangkap `localhost` atau tapak dalaman berfungsi. Tangkapan itu sendiri tidak sekali-kali dimuat naik ke mana-mana; satu-satunya trafik rangkaian ialah pelayar anda sendiri memuatkan halaman yang anda minta untuk ditangkap.

Semasa tangkapan berjalan anda mungkin melihat sekejap sepanduk *"…started debugging this browser"* pada tab sementara itu. Itu ialah DevTools Protocol sedang bertindak; ia hilang sendiri apabila tangkapan selesai.

## Membaca laman untuk Brand Studio

Sumber **Website** dalam Brand Studio memulakan jenama daripada laman yang anda sudah ada. Pada Chromium, sambungan itulah yang membacanya; pada aplikasi desktop, fetch natif melakukan tugas yang sama dan pada pelayar biasa tanpa sambungan, jubin itu langsung tidak ditawarkan.

Apa yang berlaku apabila anda menekannya:

- Satu alamat, satu halaman. Sambungan membukanya dalam jenis tab latar belakang yang sama, membaca markup yang dirender, teks helaian gaya dan beberapa imej ikon dan logo, kemudian menutup tab itu. Ia tidak mengikuti pautan dan tidak merangkak.
- Helaian gaya dan fon yang dihoskan di tempat lain (CDN, perkhidmatan fon) turut diambil, kerana warna dan taip halaman itu terletak padanya. Permintaan cross-origin dihantar tanpa kuki anda; permintaan same-origin menggunakannya, sama seperti yang dilakukan halaman itu sendiri.
- Segalanya dihadkan - bilangan helaian, imej dan bait yang terbatas - supaya halaman yang berniat jahat atau separuh rosak memulangkan bahan separa dan bukannya tergantung.
- Bait itu terus kembali ke tab Lolly yang memintanya. Penghuraian menjadi warna, taip dan logo berlaku pada peranti anda; tiada apa yang dimuat naik.

Tiada apa yang dibaca sehingga anda menekan. Menampal alamat hanya mengisi medan itu.

## Selepas memasang

Muat semula tab Lolly. Gesaan "Get the extension" hilang dan **URL Screenshot** tersedia dalam galeri dan dalam mod Batch.

## Kebenaran

`manifest.json`-nya mengisytiharkan empat kebenaran ditambah akses host:

- `debugger` - memacu tab latar belakang melalui DevTools Protocol. Inilah yang mengambil tangkapan skrin.
- `tabs` - membuka tab latar belakang sementara dan menutupnya semula selepas itu.
- `scripting` - menjalankan pembaca satu-halaman di dalam laman yang anda namakan, untuk sumber Website Brand Studio.
- `storage` - mencatat id tab yang dibukanya, hanya dalam storan sesi, supaya tab itu tetap ditutup jika pelayar menggantung sambungan di tengah pembacaan. Dikosongkan pada permulaan seterusnya; tiada apa mengenai anda disimpan.
- `host_permissions: ["<all_urls>"]` - akses host kepada *semua* laman, kerana anda boleh menunjukkannya ke mana-mana URL yang anda pilih. Chrome memaparkan ini pada masa pemasangan sebagai amaran luas "read and change all your data on all websites".

Walaupun ada amaran itu, ia hanya membaca satu-satunya halaman yang anda minta untuk ditangkap atau diimport, dan ia tidak membaca atau menghantar data pelayaran anda - tiada apa yang dimuat naik ke mana-mana.

Manifes itu juga menetapkan `minimum_chrome_version: 111`. Versi semasa ialah 0.2.1.

## Penyelesaian masalah

- **Masih melihat "Get the extension"?** Muat semula tab Lolly - pengesanan berlaku semasa halaman dimuatkan.
- **Tiada apa berlaku pada laman ini?** Sambungan hanya diaktifkan pada origin Lolly sendiri. Menjalankan build tersendiri pada domain lain? Tambahkannya ke `content_scripts.matches` dalam `manifest.json` sambungan itu.
- **Tangkapan gagal?** Semak URL boleh dicapai dan bermula dengan `http://` atau `https://`. Sesetengah halaman menyekat tangkapan automatik secara aktif.
