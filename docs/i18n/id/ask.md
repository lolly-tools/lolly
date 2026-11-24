# Ask Lolly

Ask Lolly menjawab pertanyaan dengan bagian yang cocok dari panduan ini, dikutip kata demi kata, dengan rujukan halaman dan tautan **Open in docs** ke bagian tersebut. Tidak ada yang dihasilkan: jawaban ditemukan dan dikutip di perangkat Anda.

Di bawah bagian yang dikutip terdapat tempat di aplikasi yang cocok dengan pertanyaan: alat, utilitas, proyek tersimpan, aset katalog, pengaturan atau halaman aplikasi. Setiap baris hanya berfungsi untuk navigasi. Tidak ada bagian jawaban yang mengubah pengaturan, membuka file atau bertindak untuk Anda, aturan yang sama seperti [Lolly Search](/info/search.html).

<!--i:eti-chat-->
## Mengajukan pertanyaan

Ketik di field pertanyaan di bagian bawah tampilan dan tekan Enter. Apa pun yang kurang dari dua karakter diabaikan. Jawaban bertumpuk di atas field, dengan yang terbaru di bagian akhir.

![Ask Lolly, terbuka dan kosong: field pertanyaan di bagian bawah tampilan, dengan catatan bahwa jawaban berasal dari dokumentasi](/t/url-shot?url=%2F%23%2Fask&width=1200&height=820&waitMs=2200&format=svg&walker=1&filename=ask-view)

::: note Setiap pertanyaan berdiri sendiri
Pertanyaan sebelumnya tidak membawa konteks ke pertanyaan berikutnya, jadi "bagaimana dengan PDF?" setelah pertanyaan tentang ekspor dibaca sebagai pertanyaan tentang PDF saja. Ajukan pertanyaan lengkap setiap kali.
:::

Kata pertama dalam pertanyaan Anda menentukan apa yang mengawali jawaban:

| Anda mulai dengan | Yang mengawali |
|---|---|
| *where*, *find*, *open*, *show*, *go to*, *goto*, *take*, *jump*, *navigate*, *switch* | tempat di aplikasi yang cocok |
| *make*, *create*, *generate*, *build*, *design*, *convert*, *resize*, *compress*, *remove*, *strip*, *export*, *render*, *add* | alat yang cocok |
| apa pun selain itu - termasuk *how do I* dan *what is* | bagian dokumentasi, yang merupakan default |

Kedua bagian selalu diambil, jadi pertanyaan yang salah dibaca hanya mengubah urutan jawaban.

Pencocokan mengabaikan kata umum dalam pertanyaan (*how*, *do*, *I*, *the*, *my*). Bagian diberi peringkat berdasarkan jumlah kata Anda lainnya yang tercakup, lalu berdasarkan tempat kecocokan ditemukan: judul memiliki bobot lebih besar daripada teks isi. Pencocokan menggunakan substring, mengabaikan huruf besar-kecil dan aksen, jadi salah ketik tidak diperbaiki. Jika tidak ada yang cocok, Ask menyatakannya dan mengarahkan Anda ke indeks dokumentasi.

**Better matching** bersifat opsional. Setelah jawaban pertama, Ask dapat menawarkan model pencocokan kecil beserta ukuran unduhannya. Model mencocokkan pertanyaan dengan panduan yang menggunakan kata berbeda untuk hal yang sama. Model hanya diunduh jika Anda setuju, berjalan di perangkat ini dan hanya mengubah bagian mana yang menempati peringkat pertama. Jawaban tetap menggunakan kata-kata dokumentasi itu sendiri. Anda juga dapat mengunduhnya sebagai **Ask matching model** di bawah **Settings → Preferences → Available offline** ([Tersedia offline](/info/dashboard.html#available-offline)).

<!--i:eti-clipboard-->
## Apa yang ditampilkan

Kartu jawaban memiliki urutan tetap:

1. **Bagian itu sendiri**, dirender dari sumber dokumentasi: paragraf, daftar, tabel, kode dan kutipan, dengan tautan dalam aplikasi dan `/info` aktif. Bagian panjang diakhiri dengan **Show more**, yang membuka sisanya di tempat. Gambar dihilangkan, dan tautan ke situs lain ditampilkan sebagai teks biasa.
2. **Rujukan** - *Halaman › Judul* - dan tautan **Open in docs** ke bagian yang tepat itu.
3. **More in the docs** - hingga empat bagian lain yang cocok, sebagai tautan.
4. **Baris dalam aplikasi**, di bawah judul grup yang sama dengan yang digunakan Search.

Teks lengkap berasal dari salinan markdown yang diterbitkan setiap halaman dokumentasi di `/info/<slug>.md`. Salinan itu hanya tersedia dalam bahasa Inggris. Dalam bahasa lain, dan pada beberapa halaman yang tidak dibuat dari markdown, jawaban menampilkan kutipan singkat dari indeks pencarian sebagai gantinya. Rujukan dan tautan **Open in docs** tetap mengarah ke halaman dalam bahasa Anda.

<!--i:eti-map-pin-->
## Lokasinya

Rutenya adalah `#/ask`. Tampilan ini tidak memiliki tab dan tidak memiliki kartu di grid Utilities. Anda mencapainya dari bilah pencarian atau melalui alamatnya.

- <!--i:search--> **Dari pencarian.** Setiap panel hasil diakhiri dengan baris **Ask Lolly: *kueri Anda***, di bawah hasil grup lainnya. Baris ini membuka `#/ask?q=…`, dan tampilan mengajukan pertanyaan sekali saat dibuka. Kata-kata tiba dalam huruf kecil tanpa tanda baca, jadi perbaiki di field pertanyaan jika perlu.
- <!--i:link--> **Dari tautan.** `#/ask?q=how%20do%20I%20export%20a%20transparent%20png` membuka tampilan dengan pertanyaan itu sudah diajukan. Hash hanya mengisi pertanyaan pertama. Pertanyaan yang Anda ketik sesudahnya dijawab di tempat dan tidak pernah mengubah alamat.

Bilah pencarian tersembunyi dalam tampilan ini karena field pertanyaan menggunakan Enter. Pil kembali membawa Anda ke tempat asal.

Jawaban bertahan selama sesi ini: jawaban masih ada jika Anda keluar lalu kembali, dan memuat ulang menghapusnya. Tidak ada yang ditulis ke penyimpanan, jadi tidak ada riwayat yang perlu dikelola.

<!--i:eti-download-->
## Offline

Jawaban berasal dari dua file statis yang diterbitkan situs dokumentasi: indeks pencarian per bahasa dan salinan markdown halaman. Keduanya diambil berdasarkan nama, jadi Ask bekerja tanpa koneksi setelah keduanya tersimpan dalam cache. Membaca panduan di aplikasi menyimpannya dalam cache. **Guides & docs** di bawah [Tersedia offline](/info/dashboard.html#available-offline) mengambil seluruh situs, termasuk tangkapan layar, dalam satu unduhan.

Tanpa file ini, bagian dokumentasi dalam jawaban tidak muncul dan tidak ada kesalahan yang ditampilkan. Baris dalam aplikasi tetap muncul, karena pencocokannya menggunakan data yang sudah ada di perangkat.

<!--i:eti-lock-->
## Privasi

Pertanyaan Anda tidak pernah meninggalkan perangkat. Pencocokan berjalan secara lokal terhadap file yang diambil berdasarkan nama, jadi apa yang Anda ketik bukan bagian dari permintaan apa pun. Tidak ada server yang melihat pertanyaan Anda, tidak ada akun yang menyimpannya dan tidak ada catatan yang tersisa setelah Anda memuat ulang. [Kebijakan Privasi](/info/privacy.html) mencantumkan semua yang diambil atau dikirim aplikasi.

---

**Terkait:** [Lolly Search](/info/search.html) untuk bilah yang meneruskan pertanyaan. [Menggunakan Lolly](/info/using.html) untuk bagian aplikasi lainnya. [Lolly Settings](/info/dashboard.html#available-offline) untuk membuat dokumentasi tersedia offline lebih dahulu.
