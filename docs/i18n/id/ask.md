# Ask Lolly

Ketik pertanyaan dan Ask Lolly menjawab dengan bagian panduan ini yang membahasnya, kata demi kata, dengan halaman asalnya dikutip dan tautan **Open in docs** langsung ke bagian itu. Tidak ada yang dihasilkan: jawaban diambil, dikutip, dan diatribusikan, di perangkat Anda.

Di bawah bagian yang dikutip terdapat tempat-tempat di aplikasi yang cocok dengan pertanyaan yang sama: alat, utilitas, proyek tersimpan, aset katalog, pengaturan, atau halaman aplikasi. Setiap baris hanya bernavigasi. Tidak ada dalam jawaban yang mengubah pengaturan, membuka file, atau bertindak untuk Anda, aturan yang sama dengan yang diikuti [Search](/info/search.html).

## Mengajukan pertanyaan

Ketik di field pertanyaan di dasar tampilan dan tekan Enter. Apa pun yang lebih pendek dari dua karakter diabaikan. Jawaban bertumpuk di atas field, yang terbaru paling akhir, dan Anda dapat terus bertanya.

![Ask Lolly, terbuka dan kosong: field pertanyaan di dasar tampilan, dengan catatan bahwa jawaban berasal dari dokumentasi](/t/url-shot?url=%2F%23%2Fask&width=1200&height=820&waitMs=2200&format=svg&walker=1&filename=ask-view)

Setiap pertanyaan dijawab sendiri-sendiri: pertanyaan sebelumnya tidak membawa konteks, jadi "what about PDF?" setelah pertanyaan tentang mengekspor dibaca sebagai pertanyaan tentang PDF saja. Ajukan seluruh pertanyaan setiap kali.

Kata pertama pertanyaan Anda menentukan apa yang memimpin jawaban:

| Anda mulai dengan | Yang memimpin |
|---|---|
| *where*, *find*, *open*, *show*, *go to*, *goto*, *take*, *jump*, *navigate*, *switch* | tempat di aplikasi yang cocok |
| *make*, *create*, *generate*, *build*, *design*, *convert*, *resize*, *compress*, *remove*, *strip*, *export*, *render*, *add* | alat yang cocok |
| yang lain - termasuk *how do I* dan *what is* | bagian dokumentasi, yang merupakan default |

Kedua bagian selalu diambil, jadi pertanyaan yang salah dibaca hanya mengurutkan ulang jawaban dan tidak kehilangan separuhnya.

Pencocokan membuang kata tanya umum (*how*, *do*, *I*, *the*, *my*) dan memeringkat bagian berdasarkan berapa banyak kata Anda yang tersisa yang dicakupnya, lalu berdasarkan di mana kata itu cocok: judul bernilai lebih daripada teks isi. Pencocokan dilakukan dengan substring, diseragamkan untuk huruf besar-kecil dan aksen, jadi salah ketik tidak dikoreksi. Bila tidak ada yang cocok, Ask menyatakannya dan menunjuk ke indeks dokumentasi alih-alih mengarang jawaban.

**Better matching** bersifat opsional. Setelah jawaban pertama Anda, Ask dapat menawarkan model pencocokan kecil, beserta ukuran unduhannya, yang membantu mencocokkan pertanyaan dengan panduan yang memakai kata berbeda untuk hal yang sama. Model diunduh hanya bila Anda setuju, berjalan di perangkat ini, dan hanya mengubah bagian mana yang berperingkat pertama: jawabannya tetap kata-kata dokumentasi itu sendiri. Anda juga dapat mengunduhnya dari **Settings → Preferences → Available offline**, tempat ia tercantum sebagai **Ask matching model** ([Available offline](/info/dashboard.html#available-offline)).

## Apa yang kembali

Kartu jawaban disusun dalam urutan tetap:

1. **Bagian itu sendiri**, dirender dari sumber dokumentasi - paragraf, daftar, tabel, kode, dan kutipan, dengan tautan dalam aplikasi dan `/info` yang aktif. Bagian yang panjang dibatasi dengan **Show more** yang membukanya di tempat. Gambar dibuang, dan tautan keluar ke situs lain dirender sebagai teks biasa, bukan jangkar.
2. **Kutipan** - *Halaman › Judul* - dan tautan **Open in docs** ke bagian persisnya.
3. **More in the docs** - hingga empat bagian lain yang cocok, sebagai tautan.
4. **Baris dalam aplikasi**, di bawah judul grup yang sama seperti yang dipakai Search.

Teks lengkap berasal dari kembaran markdown polos yang diterbitkan setiap halaman dokumentasi di `/info/<slug>.md`, dan kembaran itu hanya dalam bahasa Inggris. Dalam bahasa lain - dan pada beberapa halaman yang tidak dibangun dari markdown - jawaban beralih ke ekstrak singkat yang disimpan di indeks pencarian alih-alih seluruh bagian. Kutipan dan tautan **Open in docs** tetap ada, menunjuk ke halaman dalam bahasa Anda sendiri.

## Di mana ia berada

Rutenya adalah `#/ask`. Ia tidak memiliki tab dan tidak ada ubin di grid Utilities; jalan masuknya adalah bilah pencarian dan alamat itu sendiri.

- <!--i:search--> **Dari pencarian.** Setiap panel hasil membawa baris **Ask Lolly: *your query*** di paling bawah, di bawah hasil konkret apa pun yang ditemukan grup lain. Ia menyerahkan pertanyaan sebagai `#/ask?q=…`, dan tampilan mengajukan pertanyaan itu sekali saat tiba. Kata yang diserahkan tiba dalam huruf kecil tanpa tanda baca, jadi perbaiki di field pertanyaan bila perlu.
- <!--i:link--> **Dari tautan.** `#/ask?q=how%20do%20I%20export%20a%20transparent%20png` membuka tampilan dengan pertanyaan itu sudah diajukan. Hash hanyalah benih masuk: pertanyaan yang Anda ketik sesudahnya dijawab di tempat dan tidak pernah menulis ulang alamat.

Bilah pencarian menyingkir di dalam tampilan ini, karena field pertanyaan menerima Enter, dan pil kembali mengembalikan Anda ke mana pun asal Anda.

Jawaban di layar bertahan selama sesi ini: masih ada bila Anda bernavigasi pergi dan kembali, dan muat ulang menghapusnya. Tidak ada yang ditulis ke penyimpanan, jadi tidak ada riwayat untuk dikelola.

## Offline

Jawaban disusun dari dua file statis yang sudah diterbitkan situs dokumentasi: indeks pencarian per bahasa dan kembaran markdown halaman. Keduanya diambil menurut nama, jadi Ask tetap berfungsi tanpa koneksi setelah di-cache. Membaca panduan di aplikasi men-cache-nya seiring jalan, dan **Guides & docs** di bawah [Available offline](/info/dashboard.html#available-offline) mengambil seluruh situs, termasuk tangkapan layar, dalam satu unduhan.

Tanpa keduanya, bagian dokumentasi dari jawaban tidak muncul, tanpa kesalahan. Baris dalam aplikasi tetap muncul, karena dicocokkan dengan data yang sudah ada di perangkat.

## Privasi

Pertanyaan Anda tidak pernah meninggalkan perangkat. Pencocokan berjalan secara lokal terhadap file yang diambil menurut nama, jadi apa yang Anda ketik bukan bagian dari permintaan apa pun; tidak ada server yang melihatnya, tidak ada akun yang menautkannya, dan tidak ada catatannya setelah Anda memuat ulang. Lihat [Privacy Policy](/info/privacy.html) untuk daftar lengkap apa yang pernah diambil atau dikirim aplikasi.

---

**Terkait:** [Search](/info/search.html) untuk bilah yang menyerahkan pertanyaan. [Using Lolly](/info/using.html) untuk sisa aplikasi. [Settings](/info/dashboard.html#available-offline) untuk membawa dokumentasi offline lebih dulu.
