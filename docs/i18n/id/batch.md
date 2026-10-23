# Batch dan Multi-edit

Dua pekerjaan muncul begitu Anda sering membuat jenis file yang sama. Kadang Anda memerlukan banyak versi dari satu desain: kartu dalam belasan bahasa, atau setiap ukuran banner. Kadang Anda memiliki beberapa desain tersimpan yang berbeda dan menginginkan satu perubahan menjangkau semuanya, seperti tanggal atau judul baru.

**Batch** menangani pekerjaan pertama dan **Multi-edit** menangani yang kedua. Keduanya berjalan di perangkat Anda dan mengekspor melalui jalur render yang sama seperti alat itu sendiri.

::: cols
## Batch

- Satu templat, banyak baris. Setiap baris adalah satu set input dan menghasilkan satu file.
- Isi baris dengan mengetik, menempel dari spreadsheet, atau mengimpor CSV.
- Tidak ada batas baris; 50 tampil per halaman.
- Dibuka dari **Batch** di header Projects (`#/batch`).

## Multi-edit

- Dua hingga delapan desain tersimpan yang berbeda, berdampingan sebagai kartu langsung.
- Satu sidebar menyunting input yang mereka bagi, lalu input milik tiap kartu.
- Setiap desain disimpan kembali ke tempat asalnya.
- Dibuka dari **Edit together** di bilah pilihan Projects.
:::

## Buat banyak versi dari satu desain

Buka **Projects** dan tekan **Batch** di headernya. Grid dimulai dengan satu baris: pilih templat di dalamnya, lalu gandakan baris atau tempel data dari spreadsheet Anda. Bila dibuka dari dalam folder, Batch mengembalikan Anda ke folder itu.

![Batch pada grid baru: nama file dan alat baris di bagian atas, dan daftar templat baris pertama terbuka pada alat yang dapat Anda pilih](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=use-batch-toolbar)

**Isi baris.** Ketik ke dalam sel atau tempel blok langsung dari Excel, Google Sheets, atau spreadsheet lain. **Import CSV** menambahkan baris atau menggantikan batch. Saat Anda menempel ke sel yang memuat pengaturan ekspor, Lolly menanyakan input mana yang diisi setiap kolom yang ditempel. **Export CSV** menulis grid kembali keluar. Buka **Columns** di bawah grid untuk menampilkan lebih banyak input, atau lebar, tinggi, satuan, dan DPI per baris.

**Tetapkan keluaran.** Bilah alat menetapkan nama file zip, **Default format**, satuan, dan DPI untuk setiap baris. Menu format adalah daftar terkelompok milik panel ekspor, menampilkan format yang ditawarkan katalog dan didukung browser Anda. Baris dengan format, ukuran, atau nama file sendiri mempertahankan pengaturannya sendiri.

**Render.** **Render all** mengekspor setiap baris ke satu `.zip`. Pilih baris lebih dulu dan **Render selected**, **Export selected CSV**, dan **Print selected rows** bekerja hanya pada baris itu; kosongkan pilihan untuk kembali mengerjakan seluruh batch. **Print sheet** menata baris pada lembar yang dapat dicetak. **Batch activity** melaporkan setiap impor dan render, dan melipat agar tabel mendapat lebih banyak ruang.

**Simpan batch.** **Sessions** menyimpan seluruh grid sebagai sesi batch bernama, yang dibuka kembali nanti dari Projects. Sessions selalu menyimpan setiap baris, apa pun yang dipilih. **Folders…** di menu yang sama membuka seluruh folder Projects sebagai baris, satu per sesi tersimpan, dengan setiap nama file membawa path foldernya.

::: details Memilih baris dan sel
Pilih baris dengan kotak centangnya, atau Shift-klik kotak centang untuk rentang. Kotak centang header memilih halaman saat ini, dan **Select all *N* rows** juga mengambil baris di halaman lain. Pilihan tetap saat Anda berpindah halaman. **Edit input**, **Duplicate**, dan **Remove** bekerja pada baris terpilih, dan **Undo remove** memulihkan baris yang terakhir dihapus. Dari sel yang terfokus, Shift+Space memilih baris itu dan Escape mengosongkan pilihan.

Seret melintasi sel, Shift-klik sel, atau gunakan tombol Shift+Panah untuk memilih persegi panjang. **Copy cells**, atau Ctrl+C / Command+C, menyalin nilai untuk spreadsheet. Ctrl+A / Command+A dari sel yang terfokus memilih setiap kolom yang terlihat di setiap halaman; dari kotak centang baris, pintasan yang sama memilih setiap baris. Memilih sel membiarkan baris yang tercentang tetap tercentang. Klik dua kali sel atau tekan Enter untuk menyunting teksnya. Tempel persegi panjang dari clipboard, atau tempel satu nilai untuk mengisi setiap sel terpilih; sel kosong dan teks multibaris mempertahankan posisinya.
:::

### Colourway dan tema per baris

Setiap baris mempertahankan pilihan temanya sendiri: terang atau gelap, dan colourway bila design system memilikinya. Baris yang dibuka dari Projects, folder, atau batch tersimpan dirender dalam pilihan yang dipakai saat sesinya disimpan, dan pratinjaunya terbuka dalam pilihan itu. Lembar cetak, baris yang digandakan, dan baris yang diisi semuanya mempertahankannya.

CSV membawa pilihan dalam kolom `_themes` setelah kolom ukuran, berisi JSON yang sama dengan parameter tautan `_themes`, misalnya `{"":"dark","colourway":"beach"}`. Sel kosong, atau `{}`, berarti default design system. Kolom hanya ditulis bila ada baris yang memiliki pilihan, jadi batch tanpa pilihan mengekspor CSV yang sama seperti sebelumnya. Saat impor, sel yang bukan pilihan tema yang valid dicantumkan sebagai masalah dan barisnya dirender dengan default. Grid belum memiliki kontrol untuk mengubah pilihan sebuah baris, jadi atur di CSV atau di sesi tersimpan.

### Batch, atau Render folder

Batch membuat banyak varian dari satu templat. Untuk merender ulang sesi yang sudah Anda simpan, pilih di Projects dan gunakan **Render selection**, atau **Render folder** untuk seluruh folder; [Find and recover your work](/info/find-your-work.html#find-something-you-saved) membahas keduanya.

## Sunting beberapa desain tersimpan bersama

Centang dua hingga delapan sesi tersimpan di **Projects** dan pilih **Edit together** dari bilah pilihan. Sesi terbuka berdampingan sebagai kartu langsung di `#/multi?s=<slot>,<slot>…`. Setiap kartu adalah render sungguhan dari sesinya, jadi apa yang Anda lihat adalah apa yang akan diekspor.

Satu sidebar menggerakkan semuanya:

- <!--i:sliders--> **Shared** muncul pertama: setiap input yang dideklarasikan dengan cara yang sama oleh dua sesi atau lebih (id sama, tipe sama, batasan sama, aturan yang dipakai grid batch untuk kolomnya). Sunting kontrol bersama sekali dan nilainya mencapai setiap sesi yang mendeklarasikan input itu, langsung di setiap kartu. Dua sesi dari alat yang sama berbagi semuanya; dua alat berbeda hanya berbagi input yang sama-sama mereka miliki.
- <!--i:document--> Di bawahnya, **satu kartu terlipat per sesi** memuat semua input milik sesi itu, selengkap sidebar alat itu sendiri, dengan blok ekspor ringkas: **Format**, **W** / **H**, **Unit**, **DPI**, dan **Download**. Download itu menyimpan sesi lebih dulu, lalu merender file dengan nama file, format, dan Content Credentials yang sama seperti dari alat.
- <!--i:search--> **Filter inputs…** di bagian atas mempersempit kontrol di setiap kartu sekaligus, sehingga Anda dapat menjangkau "judul" di delapan sesi tanpa menggulir.

Klik kartu mana pun (atau tekan Enter padanya) untuk membuka kartu sidebar sesi itu. **Save all** menulis setiap sesi kembali ke slotnya sendiri. **Download all** menyimpan lebih dulu, lalu merender seluruh set ke satu zip, dengan cara yang sama seperti **Render selection** di Projects, dengan kunci kata sandi opsional yang ditawarkan di tengah jalan.

Setiap kartu digambar dalam pilihan tema sesinya sendiri, termasuk alat yang ditempatkan di dalam desain. Kartu dengan tampilan berbeda berdampingan sementara aplikasi di sekitarnya mempertahankan warnanya sendiri, dan **Save all**, unduhan, **Batch grid**, dan **Send to Print Sheet** mempertahankan pilihan setiap sesi.

### Batasan

- **Paling banyak delapan.** Setiap kartu memasang runtime langsungnya sendiri, dan delapan adalah jumlah yang tetap responsif. Tautan yang meminta lebih, atau sesi yang tidak ada lagi, menyatakannya alih-alih memuat setengah-setengah.
- **Tautannya lokal.** Tautan menyebut slot tersimpan milik Anda sendiri, jadi membuka kembali set itu di perangkat ini. Ini bukan tautan berbagi.
- **Untuk yang lebih besar,** pilih **Edit as sheet** di bilah pilihan yang sama. Ia membuka seluruh pilihan sebagai baris di grid batch (`#/batch?s=…`), tanpa batas ukuran dan tanpa aturan alat yang sama. Folder tidak ikut di keduanya: buka folder di grid dengan **Sessions → Folders…**, atau render dengan **Render folder** di Projects.
- **Pencarian tidak menjangkau Multi-edit.** Ini satu-satunya tampilan yang tidak dikenal bilah pencarian.

## Ke mana selanjutnya

- **[Export a file](/info/exporting.html)**: format, ukuran, dan pengaturan cetak yang dapat dipakai setiap baris.
- **[Templates](/info/templates.html)**: titik awal yang menjadi baris pertama yang baik.
- **[Find and recover your work](/info/find-your-work.html)**: Projects, folder, dan merender apa yang Anda simpan.
