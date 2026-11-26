# Sambungan pelayar

Halaman web tidak boleh membaca piksel laman web lain. Dalam pelayar berasaskan Chromium (Chrome, Edge, Brave, Arc atau Opera, bermula Chrome 111), sambungan percuma **Lolly URL Screenshot** membolehkan apl web Lolly menangkap skrin halaman dengan kaedah tangkapan yang sama seperti apl desktop. Dengan sambungan dipasang:

- **[Lolly URL Screenshot](/t/url-shot)** menyimpan halaman yang anda gubah sebagai fail;
- alamat web yang ditampal ke dalam slot imej boleh menjadi tangkapan skrin halaman itu, dengan **Screenshot this page**;
- sumber **Website** dalam [Lolly Design System Setup](/info/brand-studio.html) boleh membaca satu halaman untuk memulakan sistem reka bentuk.

Anda meluluskan setiap permintaan, dan apl desktop melakukan tugas yang sama tanpa sambungan.

<!--i:eti-checklist-->
## Sebelum anda memasang

Tanpa sambungan, **Lolly URL Screenshot** masih boleh dibuka dan anda boleh menggubah tangkapan. Nota di bahagian atas kawalan alat menyatakan apa yang tiada.

![Nota alat URL Screenshot yang menawarkan sambungan, ditunjukkan apabila tangkapan ke fail tiada hos untuk dijalankan](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%23capture-hint-notice&dark=1&filename=exp-url-shot-notice)

Setiap kawalan berfungsi tanpa sambungan: URL sasaran, kedalaman tatal, kelewatan penstabilan, jarak pemangkasan dari tepi dan pewarnaan semula. Hanya tangkapan memerlukan sambungan.

![Kawalan Lolly URL Screenshot dengan URL sasaran, kedalaman tatal, kelewatan penstabilan dan jarak pemangkasan dari tepi, semuanya boleh digunakan sebelum sambungan tersedia](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot%3Furl%3Dhttps%3A%2F%2Flolly.tools%26scrollDepth%3D0.3%26waitMs%3D1200&width=1440&height=2200&dpi=192&waitMs=2400&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&walker=1&dark=1&filename=fq-url-shot-controls)

<!--i:eti-download-->
## Pasang

**Daripada Chrome Web Store:** akan datang. Setelah diterbitkan, sambungan boleh dipasang dengan satu klik.

**Muatkan sendiri (pembangun).** Sumber sambungan berada dalam repositori di `shells/chrome-extension/`. Langkah pembungkusan membina pakej pengeluaran daripada folder itu. Pakej itu hanya berfungsi dengan Lolly di `https://lolly.tools`.

1. Jalankan `pnpm run pack:chrome-extension`. Ia membina pakej ke dalam `dist/chrome-extension/`.
2. Buka `chrome://extensions`.
3. Hidupkan **Developer mode** (kanan atas).
4. Klik **Load unpacked** dan pilih folder `dist/chrome-extension/`.
5. Muat semula tab Lolly. Lolly mengesan sambungan apabila halaman dimuatkan, dan gesaan "Get the extension" hilang. **Lolly URL Screenshot** (di bawah Utilities) kemudian boleh menyimpan tangkapan ke fail dan berfungsi dalam mod Lolly Batch.

::: details Untuk pelayan pembangunan setempat, atau folder sumber
Untuk pelayan pembangunan setempat, jalankan `pnpm run pack:chrome-extension:dev` dan muatkan `dist/chrome-extension-dev` sebagai ganti. Pakej itu juga menerima `http://localhost:5173` dan mempunyai **Development** dalam namanya.

Memuatkan folder `shells/chrome-extension/` itu sendiri juga berfungsi untuk tangkapan skrin PNG. Folder itu tiada penelusuran halaman, yang dibina dalam langkah pembungkusan. SVG daripada folder itu mengandungi tangkapan skrin, bukan bentuk.
:::

<!--i:eti-user-check-->
## Apa yang berlaku apabila Lolly meminta

![Tab Lolly meminta satu halaman dan anda menekan Approve once dalam tetingkap kelulusan sambungan. Tab latar belakang dibuka, membaca halaman dan ditutup. Kemudian tab Lolly mendapat hasilnya.](/info/diagrams/concepts/extension-request.svg)

1. **Lolly meminta.** Skrip kecil memberitahu Lolly bahawa sambungan tersedia, jadi tangkapan atau pembacaan halaman boleh bermula tanpa persediaan lanjut.
2. **Anda meluluskan.** Sambungan membuka tetingkap **Approve page request** sendiri. Ia menunjukkan laman yang meminta, sama ada ia mahukan tangkapan skrin atau kandungan halaman dan alamat halaman. Tiada apa-apa dibaca sehingga anda menekan **Approve once**. **Cancel**, atau menutup tetingkap, menamatkan permintaan.
3. **Chrome meminta sekali bagi setiap laman.** Kali pertama anda meluluskan permintaan untuk sesuatu laman, Chrome turut bertanya sama ada sambungan boleh mengakses laman itu. Chrome mengekalkan akses itu setelah anda membenarkannya, tetapi setiap permintaan kemudian masih memerlukan **Approve once** sendiri.
4. **Halaman dibaca dalam tab latar belakang.** Sambungan membuka halaman sasaran dalam tab latar belakang, menangkapnya melalui DevTools Protocol (`Page.captureScreenshot` yang sama seperti yang digunakan apl desktop), menutup tab dan menyerahkan hasil kembali kepada tab Lolly yang meminta.

::: details Cara tangkapan SVG berfungsi
Untuk **SVG**, sambungan menelusuri halaman dan bukannya mengambil gambar skrin. Skrip yang dibungkus bersama sambungan membaca reka letak halaman dalam tab latar belakang dan menukar halaman kepada bentuk dan teks bergaris luar. Fail kekal tajam pada sebarang saiz dan setiap bahagian kekal boleh disunting. Gambar pada halaman kekal sebagai gambar. Apa-apa yang dilukis halaman menggunakan kanvas, video atau kesan yang tidak dapat diwakili SVG disalin daripada tangkapan skrin pada saat yang sama. Lolly menyemak hasilnya dengan tangkapan skrin itu. Apabila kedua-duanya terlalu berbeza, SVG mengandungi tangkapan skrin sebagai ganti.

Untuk menukar teks kepada garis luar dalam muka taip halaman itu sendiri, sambungan menyerahkan fail fon yang dimuatkan halaman kepada Lolly. Chrome tidak menyimpan bait fon di tempat yang boleh dibaca sambungan, jadi sambungan meminta setiap fon daripada halaman sekali lagi. Pelayar anda biasanya menjawab daripada cachenya, dan dasar keselamatan halaman itu sendiri masih terpakai pada permintaan itu.
:::

Kelulusan meliputi satu permintaan dan tamat tempoh selepas 30 saat. Hanya satu permintaan boleh menunggu atau berjalan pada satu-satu masa, dan permintaan yang diluluskan berhenti selepas 55 saat. Jika halaman Lolly ditutup atau berubah, atau halaman sasaran berpindah ke laman lain, permintaan dibatalkan.

::: warning Tangkapan menggunakan sesi pelayar anda
Halaman dimuatkan dengan sesi pelayar anda, jadi halaman yang anda telah daftar masuk boleh menunjukkan maklumat peribadi dalam hasilnya.
:::

Tangkapan berjalan dalam pelayar anda pada rangkaian anda, jadi `localhost` dan laman dalaman berfungsi. Tangkapan tidak dimuat naik. Satu-satunya trafik rangkaian ialah pelayar anda memuatkan halaman yang anda minta dan, untuk SVG, fail fon halaman itu buat kali kedua.

Semasa tangkapan berjalan, anda mungkin melihat sepanduk *"…started debugging this browser"* seketika pada tab sementara. Sepanduk itu datang daripada DevTools Protocol dan hilang apabila tangkapan selesai.

<a id="reading-a-site-for-design-system-setup"></a>
<!--i:eti-globe-->
## Membaca laman untuk Lolly Design System Setup

Sumber **Website** dalam Lolly Design System Setup memulakan sistem reka bentuk daripada laman yang anda sudah ada. Dalam pelayar Chromium, sambungan membaca halaman. Dalam apl desktop, apl mengambil halaman itu sendiri. Dalam pelayar tanpa sambungan, jubin Website tidak ditawarkan.

- **Satu alamat, satu halaman.** Selepas anda meluluskan, sambungan membuka halaman dalam tab latar belakang yang sama jenisnya, membaca penandaan yang dirender, teks helaian gaya dan beberapa imej ikon dan logo, kemudian menutup tab. Sambungan tidak mengikuti pautan atau merangkak laman.
- **Helaian gaya yang dihoskan di tempat lain** (CDN atau perkhidmatan fon) turut diambil, kerana ia mempunyai warna dan tipografi halaman. Permintaan rentas asal dihantar tanpa kuki anda. Permintaan asal yang sama menggunakan kuki anda, seperti yang dilakukan halaman.
- **Semuanya dihadkan**, dengan had bilangan helaian gaya dan imej serta bait, jadi halaman berniat jahat atau separa rosak memulangkan bahan separa dan bukannya tergantung.
- **Penghuraian berlaku pada peranti anda.** Bait terus kembali kepada tab Lolly yang meminta, yang menukarkannya kepada warna, tipografi dan logo.

Menampal alamat hanya mengisi medan. Tiada apa-apa dibaca sehingga anda memulakan pembacaan dan menekan **Approve once**.

<!--i:eti-lock-->
## Kebenaran

`manifest.json` sambungan mengisytiharkan empat kebenaran, serta akses laman yang dimintanya satu laman pada satu masa. Ia menetapkan `minimum_chrome_version: 111`, dan versi semasa ialah 0.5.0.

| Kebenaran | Kegunaannya | Bila ia diberikan |
|---|---|---|
| `debugger` | Mengawal tab latar belakang melalui DevTools Protocol, yang mengambil tangkapan skrin dan, untuk SVG, menjalankan penelusuran halaman. | Semasa pemasangan |
| `tabs` | Membuka tab latar belakang sementara dan menutupnya selepas itu, serta menyemak bahawa halaman Lolly dan halaman sasaran tidak berpindah sejak anda meluluskan. | Semasa pemasangan |
| `scripting` | Menjalankan pembaca satu halaman dalam laman yang anda namakan, untuk sumber Website. | Semasa pemasangan |
| `storage` | Mencatat id tab yang dibukanya, dalam storan sesi sahaja, supaya tab masih ditutup jika pelayar menggantung sambungan ketika pembacaan sedang berjalan. Dikosongkan pada permulaan seterusnya; tiada apa-apa tentang anda disimpan. | Semasa pemasangan |
| `optional_host_permissions: ["http://*/*", "https://*/*"]` | Akses laman, tidak diberikan semasa pemasangan. Apabila anda menekan **Approve once**, sambungan meminta akses daripada Chrome kepada satu laman dalam permintaan itu. | Kali pertama anda meluluskan permintaan untuk laman itu, selepas Chrome bertanya kepada anda |

Sambungan hanya membaca halaman yang anda luluskan. Ia tidak membaca atau menghantar data pelayaran anda.

<!--i:eti-help-->
## Penyelesaian masalah

- **Masih melihat "Get the extension"?** Muat semula tab Lolly.
- **Tiada apa-apa berlaku di laman ini?** Sambungan hanya berfungsi di `https://lolly.tools`, serta `http://localhost:5173` dalam pakej pembangunan. Asal lain, seperti salinan Lolly yang dihoskan sendiri, memerlukan binaan sambungannya sendiri yang menyenaraikan asal itu dalam kedua-dua `manifest.json` dan `policy.js`. Menyunting manifes sahaja tidak berfungsi.
- **Tangkapan gagal?** Semak bahawa URL boleh dicapai dan bermula dengan `http://` atau `https://`. Sesetengah halaman menyekat tangkapan automatik. Jika anda menekan **Cancel**, menutup tetingkap kelulusan atau menunggu lebih daripada 30 saat, mulakan tangkapan sekali lagi.
