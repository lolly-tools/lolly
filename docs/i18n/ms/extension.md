# Sambungan pelayar

Halaman web tidak boleh membaca piksel laman web lain, jadi apl web Lolly memerlukan bantuan untuk menangkap skrin halaman. Dalam pelayar berasaskan Chromium (Chrome, Edge, Brave, Arc atau Opera, dari Chrome 111), sambungan percuma **Lolly URL Screenshot** memberikan bantuan itu, menggunakan tangkapan yang sama dengan yang digunakan apl desktop. Dengannya dipasang:

- **[URL Screenshot](/t/url-shot)** menyimpan halaman yang anda gubah sebagai fail;
- alamat web yang ditampal ke dalam slot imej boleh menjadi tangkapan skrin halaman itu, dengan **Screenshot this page**;
- sumber **Website** dalam [Design System Setup](/info/brand-studio.html) boleh membaca satu halaman untuk memulakan sistem reka bentuk.

Anda meluluskan setiap permintaan, dan apl desktop melakukan tugas yang sama tanpa sambungan.

## Sebelum anda memasang

Sehingga sambungan dipasang, **URL Screenshot** masih dibuka, jadi anda boleh menggubah tangkapan. Nota di bahagian atas kawalan alat menyatakan apa yang hilang.

![Nota alat URL Screenshot menawarkan sambungan itu, dipaparkan apabila tangkapan ke fail tiada host untuk dijalankan](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%23capture-hint-notice&dark=1&filename=exp-url-shot-notice)

Setiap kawalan berfungsi semasa anda menunggu: URL sasaran, kedalaman skrol, kelewatan menetap, inset pangkas dan pewarnaan semula. Hanya tangkapan itu sendiri memerlukan sambungan.

![Kawalan URL Screenshot dengan URL sasaran, kedalaman skrol, kelewatan settle dan inset pemotongan, semuanya boleh digunakan sebelum sambungan wujud](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot%3Furl%3Dhttps%3A%2F%2Flolly.tools%26scrollDepth%3D0.3%26waitMs%3D1200&width=1440&height=2200&dpi=192&waitMs=2400&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&walker=1&dark=1&filename=fq-url-shot-controls)

## Pasang

**Daripada Chrome Web Store:** akan datang. Setelah sambungan diterbitkan, anda memasangnya dengan satu klik.

**Muatkan sendiri (pembangun).** Sambungan berada dalam repositori di `shells/chrome-extension/`. Folder itu ialah binaan pengeluaran, yang berfungsi dengan Lolly di `https://lolly.tools` sahaja.

1. Buka `chrome://extensions`.
2. Hidupkan **Developer mode** (kanan atas).
3. Klik **Load unpacked** dan pilih folder `shells/chrome-extension/`.
4. Muat semula tab Lolly. Pengesanan berlaku apabila halaman dimuatkan, jadi gesaan "Get the extension" hilang. **URL Screenshot** (di bawah Utilities) kemudian boleh menyimpan tangkapan ke fail dan tersedia dalam mod Batch.

Untuk pelayan pembangunan setempat, jalankan `pnpm run pack:chrome-extension:dev` dan muatkan `dist/chrome-extension-dev` sebaliknya. Pakej itu turut menerima `http://localhost:5173` dan mempunyai **Development** pada namanya.

## Apa yang berlaku apabila Lolly meminta

![Tab Lolly meminta satu halaman dan anda menekan Approve once dalam tetingkap kelulusan sambungan. Tab latar belakang dibuka, membaca halaman dan ditutup. Kemudian tab Lolly mendapat hasil.](/info/diagrams/concepts/extension-request.svg)

1. **Lolly meminta.** Skrip kecil memberitahu Lolly sambungan ada, jadi tangkapan atau pembacaan halaman boleh bermula tanpa persediaan lanjut.
2. **Anda meluluskan.** Sambungan membuka tetingkap **Approve page request** sendiri. Ia menunjukkan tapak yang meminta, sama ada ia mahukan tangkapan skrin atau kandungan halaman, dan alamat halaman. Tiada apa-apa dibaca sehingga anda menekan **Approve once**. **Cancel**, atau menutup tetingkap, menamatkan permintaan.
3. **Chrome bertanya sekali bagi setiap tapak.** Kali pertama anda meluluskan permintaan untuk tapak, Chrome juga bertanya sama ada sambungan boleh mengakses tapak itu. Chrome mengekalkan akses itu setelah anda membenarkan, tetapi setiap permintaan kemudian masih memerlukan **Approve once** sendiri.
4. **Halaman dibaca dalam tab latar belakang.** Sambungan membuka halaman sasaran dalam tab latar belakang, menangkapnya melalui DevTools Protocol (`Page.captureScreenshot` yang sama yang digunakan apl desktop), menutup tab dan menyerahkan hasil kembali kepada tab Lolly yang meminta.

Kelulusan meliputi satu permintaan dan tamat dalam 30 saat. Hanya satu permintaan boleh menunggu atau berjalan pada satu masa, dan permintaan yang diluluskan berhenti selepas 55 saat. Jika halaman Lolly ditutup atau berubah, atau halaman sasaran berpindah ke tapak lain, permintaan dibatalkan.

Tangkapan berjalan dalam pelayar anda, pada rangkaian anda, jadi `localhost` dan tapak dalaman berfungsi. Halaman dimuatkan dengan sesi pelayar anda, jadi halaman yang anda log masuk boleh menunjukkan maklumat peribadi dalam hasil. Tangkapan tidak dimuat naik: satu-satunya trafik rangkaian ialah pelayar anda sendiri memuatkan halaman yang anda minta.

Semasa tangkapan berjalan anda mungkin seketika melihat sepanduk *"…started debugging this browser"* pada tab sementara. Itu DevTools Protocol sedang bekerja, dan sepanduk hilang apabila tangkapan selesai.

## Membaca tapak untuk Design System Setup

Sumber **Website** dalam Design System Setup memulakan sistem reka bentuk daripada tapak yang sudah anda ada. Dalam pelayar Chromium sambungan membaca halaman. Dalam apl desktop, apl mengambil halaman itu sendiri. Dalam pelayar tanpa sambungan, jubin Website tidak ditawarkan.

- **Satu alamat, satu halaman.** Selepas anda meluluskan, sambungan membuka halaman dalam jenis tab latar belakang yang sama, membaca markup yang dirender, teks helaian gaya dan beberapa imej ikon dan logo, kemudian menutup tab. Ia tidak mengikut pautan atau merangkak.
- **Helaian gaya yang dihoskan di tempat lain** (CDN atau perkhidmatan fon) turut diambil, kerana warna dan tipografi halaman terdapat di dalamnya. Permintaan silang asal pergi tanpa kuki anda; permintaan asal sama menggunakannya, seperti yang dilakukan halaman itu sendiri.
- **Segala-galanya dihadkan**, dengan had bilangan helaian gaya dan imej serta bait, jadi halaman bermusuhan atau separuh rosak memulangkan bahan separa dan bukan tergantung.
- **Penghuraian berlaku pada peranti anda.** Bait terus kembali kepada tab Lolly yang meminta, yang menukarnya kepada warna, tipografi dan logo.

Menampal alamat hanya mengisi medan. Tiada apa-apa dibaca sehingga anda memulakan bacaan dan menekan **Approve once**.

## Kebenaran

`manifest.json` sambungan mengisytiharkan empat kebenaran, serta akses tapak yang diminta satu tapak pada satu masa. Ia menetapkan `minimum_chrome_version: 111`, dan versi semasa ialah 0.4.0.

| Kebenaran | Untuk apa | Bila diberikan |
|---|---|---|
| `debugger` | Memacu tab latar belakang melalui DevTools Protocol, yang mengambil tangkapan skrin. | Semasa pemasangan |
| `tabs` | Membuka tab latar belakang sementara dan menutupnya selepas itu, dan menyemak bahawa sama ada halaman Lolly mahupun halaman sasaran tidak berpindah sejak anda meluluskan. | Semasa pemasangan |
| `scripting` | Menjalankan pembaca satu halaman di dalam tapak yang anda namakan, untuk sumber Website. | Semasa pemasangan |
| `storage` | Mencatat id tab yang dibukanya, dalam storan sesi sahaja, supaya tab masih ditutup jika pelayar menggantung sambungan semasa membaca. Dikosongkan pada permulaan seterusnya; tiada apa-apa tentang anda disimpan. | Semasa pemasangan |
| `optional_host_permissions: ["http://*/*", "https://*/*"]` | Akses tapak, tidak diberikan semasa pemasangan. Apabila anda menekan **Approve once**, sambungan meminta Chrome untuk akses kepada satu tapak dalam permintaan itu. | Kali pertama anda meluluskan permintaan untuk tapak itu, selepas Chrome bertanya anda |

Sambungan hanya membaca satu halaman yang anda luluskan. Ia tidak membaca atau menghantar data pelayaran anda, dan tiada apa-apa dimuat naik.

## Penyelesaian masalah

- **Masih melihat "Get the extension"?** Muat semula tab Lolly.
- **Tiada apa-apa berlaku pada tapak ini?** Sambungan hanya berfungsi pada `https://lolly.tools`, serta `http://localhost:5173` dalam pakej pembangunan. Asal lain, seperti salinan Lolly yang dihos sendiri, memerlukan binaan sambungan sendiri yang menyenaraikan asal itu dalam kedua-dua `manifest.json` dan `policy.js`. Menyunting manifes sahaja tidak berfungsi.
- **Tangkapan gagal?** Semak bahawa URL boleh dicapai dan bermula dengan `http://` atau `https://`. Sesetengah halaman menyekat tangkapan automatik. Jika anda menekan **Cancel**, menutup tetingkap kelulusan atau menunggu lebih daripada 30 saat, mulakan tangkapan sekali lagi.
