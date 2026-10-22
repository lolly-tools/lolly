# Sambungan Pelayar

Sambungan **Lolly URL Screenshot** membolehkan aplikasi web mengambil tangkapan skrin mana-mana halaman web dari dalam pelayar anda. Tanpanya, menangkap URL memerlukan aplikasi desktop - halaman pelayar tidak boleh membaca piksel dari tapak lain dengan sendirinya. Sambungan ini boleh, menggunakan tangkapan yang sama seperti yang digunakan oleh aplikasi desktop.

Ia melakukan dua tugas lain dengan cara yang sama. Alamat web yang ditampal ke dalam slot imej boleh menjadi tangkapan skrin halaman itu (**Tangkap skrin halaman ini**), dan sambungan ini boleh membaca satu halaman yang anda namakan supaya Brand Studio boleh menarik sesuatu jenama daripada satu laman web langsung. Setiap permintaan menunggu kelulusan anda dalam sambungan.

Ia berjalan pada pelayar berasaskan Chromium: **Chrome, Edge, Brave, Arc, Opera** - Chrome 111 atau lebih baharu.

Sehingga ia dipasang, **URL Screenshot** masih terbuka supaya anda boleh menggubah tangkapan, dan satu nota di atas kawalan alat itu menyatakan apa yang tiada.

![Nota alat URL Screenshot menawarkan sambungan itu, dipaparkan apabila tangkapan ke fail tiada host untuk dijalankan](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%23capture-hint-notice&dark=1&filename=exp-url-shot-notice)

Setiap kawalan aktif semasa anda menunggu: URL sasaran, kedalaman skrol, kelewatan settle, inset pemotongan dan pewarnaan semula. Hanya tangkapan itu sendiri yang memerlukan host.

![Kawalan URL Screenshot dengan URL sasaran, kedalaman skrol, kelewatan settle dan inset pemotongan, semuanya boleh digunakan sebelum sambungan wujud](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot%3Furl%3Dhttps%3A%2F%2Flolly.tools%26scrollDepth%3D0.3%26waitMs%3D1200&width=1440&height=2200&dpi=192&waitMs=2400&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&walker=1&dark=1&filename=fq-url-shot-controls)

## Pasang

### Daripada Chrome Web Store

*Akan datang tidak lama lagi.* Setelah ia diterbitkan anda akan memasangnya dengan satu klik, kemudian muat semula Lolly.

### Muatkan sendiri (pembangun)

Sambungan ini berada dalam repo di `shells/chrome-extension/`. Folder itu ialah build pengeluaran, yang berfungsi dengan Lolly di `https://lolly.tools` sahaja.

1. Buka `chrome://extensions`.
2. Hidupkan **Developer mode** (kanan atas).
3. Klik **Load unpacked** dan pilih folder `shells/chrome-extension/`.
4. Muat semula Lolly - **URL Screenshot** kini berfungsi dalam pelayar.

Untuk pelayan pembangunan setempat, jalankan `pnpm run pack:chrome-extension:dev` dan muatkan `dist/chrome-extension-dev` sebaliknya. Pakej itu turut menerima `http://localhost:5173` dan mempunyai **Development** pada namanya.

## Cara ia berfungsi

- Satu skrip kecil memberitahu Lolly bahawa sambungan itu wujud, jadi **URL Screenshot** boleh menyimpan tangkapan tanpa persediaan lanjut.
- Anda meluluskan setiap permintaan. Apabila Lolly meminta, sambungan membuka tetingkapnya sendiri, **Approve page request**, yang menunjukkan laman yang membuat permintaan, sama ada ia mahu tangkapan skrin atau kandungan halaman, dan alamat halaman itu. Tiada apa yang dibaca sehingga anda menekan **Approve once**. **Cancel**, atau menutup tetingkap itu, menamatkan permintaan.
- Kali pertama anda meluluskan permintaan untuk sesebuah laman, Chrome turut bertanya sama ada sambungan boleh mengakses laman itu. Chrome mengekalkan akses itu sebaik sahaja anda membenarkannya, tetapi setiap permintaan seterusnya masih memerlukan **Approve once** tersendiri.
- Satu kelulusan meliputi satu permintaan dan luput selepas 30 saat. Hanya satu permintaan boleh menunggu atau berjalan pada satu masa, dan permintaan yang diluluskan berhenti selepas 55 saat. Jika halaman Lolly ditutup atau berubah, atau halaman sasaran berpindah ke laman lain, permintaan itu dibatalkan.
- Selepas anda meluluskan, sambungan membuka halaman sasaran dalam tab latar belakang, menangkapnya melalui DevTools Protocol (`Page.captureScreenshot` yang sama seperti yang digunakan aplikasi desktop), kemudian menutup tab itu dan menyerahkan imej kembali kepada tab Lolly yang memintanya.
- Ia berjalan sepenuhnya dalam pelayar anda, pada rangkaian anda - jadi menangkap `localhost` atau tapak dalaman berfungsi. Halaman itu dimuatkan dengan sesi pelayar anda, jadi halaman yang anda telah log masuk boleh memaparkan maklumat peribadi dalam hasilnya. Tangkapan itu sendiri tidak sekali-kali dimuat naik ke mana-mana; satu-satunya trafik rangkaian ialah pelayar anda sendiri memuatkan halaman yang anda minta untuk ditangkap.

Semasa tangkapan berjalan anda mungkin melihat sekejap sepanduk *"…started debugging this browser"* pada tab sementara itu. Itu ialah DevTools Protocol sedang bertindak; ia hilang sendiri apabila tangkapan selesai.

## Membaca laman untuk Brand Studio

Sumber **Website** dalam Brand Studio memulakan jenama daripada laman yang anda sudah ada. Pada Chromium, sambungan itulah yang membacanya; pada aplikasi desktop, fetch natif melakukan tugas yang sama dan pada pelayar biasa tanpa sambungan, jubin itu langsung tidak ditawarkan.

Apa yang berlaku apabila anda menekannya:

- Satu alamat, satu halaman. Selepas anda meluluskan, sambungan membukanya dalam jenis tab latar belakang yang sama, membaca markup yang dirender, teks helaian gaya dan beberapa imej ikon dan logo, kemudian menutup tab itu. Ia tidak mengikuti pautan dan tidak merangkak.
- Helaian gaya yang dihoskan di tempat lain (CDN, perkhidmatan fon) turut diambil, kerana warna dan taip halaman itu terletak padanya. Permintaan cross-origin dihantar tanpa kuki anda; permintaan same-origin menggunakannya, sama seperti yang dilakukan halaman itu sendiri.
- Segalanya dihadkan - bilangan helaian, imej dan bait yang terbatas - supaya halaman yang berniat jahat atau separuh rosak memulangkan bahan separa dan bukannya tergantung.
- Bait itu terus kembali ke tab Lolly yang memintanya. Penghuraian menjadi warna, taip dan logo berlaku pada peranti anda; tiada apa yang dimuat naik.

Menampal alamat hanya mengisi medan itu. Tiada apa yang dibaca sehingga anda memulakan pembacaan dan menekan **Approve once**.

## Selepas memasang

Muat semula tab Lolly. Gesaan "Get the extension" hilang, **URL Screenshot** (di bawah Utiliti) boleh menyimpan tangkapan ke fail, dan alat itu tersedia dalam mod Batch.

## Kebenaran

`manifest.json`-nya mengisytiharkan empat kebenaran, ditambah akses laman yang dimintanya satu laman pada satu masa:

- `debugger` - memacu tab latar belakang melalui DevTools Protocol. Inilah yang mengambil tangkapan skrin.
- `tabs` - membuka tab latar belakang sementara dan menutupnya semula selepas itu, serta menyemak bahawa halaman Lolly mahupun halaman sasaran tidak berpindah sejak anda meluluskan permintaan itu.
- `scripting` - menjalankan pembaca satu-halaman di dalam laman yang anda namakan, untuk sumber Website Brand Studio.
- `storage` - mencatat id tab yang dibukanya, hanya dalam storan sesi, supaya tab itu tetap ditutup jika pelayar menggantung sambungan di tengah pembacaan. Dikosongkan pada permulaan seterusnya; tiada apa mengenai anda disimpan.
- `optional_host_permissions: ["http://*/*", "https://*/*"]` - akses laman, yang tidak diberikan semasa pemasangan. Apabila anda menekan **Approve once**, sambungan meminta akses Chrome untuk satu laman dalam permintaan itu, dan Chrome bertanya anda kali pertama bagi setiap laman.

Ia hanya membaca satu halaman yang anda luluskan, dan ia tidak membaca atau menghantar data pelayaran anda - tiada apa yang dimuat naik ke mana-mana.

Manifes itu juga menetapkan `minimum_chrome_version: 111`. Versi semasa ialah 0.4.0.

## Penyelesaian masalah

- **Masih melihat "Get the extension"?** Muat semula tab Lolly - pengesanan berlaku semasa halaman dimuatkan.
- **Tiada apa berlaku pada laman ini?** Sambungan hanya berfungsi pada `https://lolly.tools`, ditambah `http://localhost:5173` dalam pakej pembangunan. Origin lain, seperti salinan Lolly yang dihoskan sendiri, memerlukan build sambungan yang berasingan yang menyenaraikan origin itu dalam kedua-dua `manifest.json` dan `policy.js`. Menyunting manifes sahaja tidak lagi berfungsi.
- **Tangkapan gagal?** Semak URL boleh dicapai dan bermula dengan `http://` atau `https://`. Sesetengah halaman menyekat tangkapan automatik secara aktif. Jika anda menekan **Cancel**, menutup tetingkap kelulusan atau menunggu lebih daripada 30 saat, mulakan tangkapan itu semula.
