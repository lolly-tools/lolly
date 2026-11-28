# Lolly Batch dan Lolly Multi-edit

<a id="batch-and-multi-edit"></a>

**Lolly Batch** membuat banyak versi dari satu desain, seperti kartu dalam belasan bahasa atau setiap ukuran spanduk. **Lolly Multi-edit** membuat satu perubahan, seperti tanggal atau judul baru, pada beberapa desain tersimpan yang berbeda.

Keduanya berjalan di perangkat Anda dan mengekspor melalui jalur render yang sama dengan alat lainnya.

::: cols
## Batch

- Satu templat, banyak baris. Setiap baris adalah satu kumpulan input dan menghasilkan satu file.
- Isi baris dengan mengetik, menempel dari spreadsheet atau mengimpor CSV.
- Tidak ada batas jumlah baris; 50 ditampilkan per halaman.
- Dibuka dari **Lolly Batch** di header Projects (`#/batch`).

<a id="multi-edit"></a>
## Lolly Multi-edit

- Dua hingga delapan desain tersimpan yang berbeda, berdampingan sebagai kartu langsung.
- Satu bilah sisi menyunting input bersama, lalu input masing-masing kartu.
- Setiap desain disimpan kembali ke tempat asalnya.
- Dibuka dari **Edit together** di bilah pilihan Projects.
:::

<!--i:eti-table-->
## Buat banyak versi dari satu desain

Buka tampilan **Projects** dan tekan **Batch** di header-nya. Grid dimulai dengan satu baris. Pilih templat di baris itu, lalu duplikasi baris atau tempel data dari spreadsheet. Jika dibuka dari dalam folder, Batch mengembalikan Anda ke folder tersebut.

![Batch pada grid baru: nama file dan alat baris di sepanjang bagian atas, serta daftar templat baris pertama yang terbuka pada alat yang dapat Anda pilih](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=use-batch-toolbar)

**Isi baris.** Ketik di sel atau tempel blok dari Excel, Google Sheets atau spreadsheet lain. **Import CSV** menambah baris atau mengganti batch. Saat Anda menempel ke sel yang memuat pengaturan ekspor, Lolly menanyakan input mana yang diisi oleh setiap kolom yang ditempel. **Export CSV** menulis grid ke file. Buka **Columns** di bawah grid untuk menampilkan lebih banyak input, atau lebar, tinggi, satuan dan DPI per baris. Popover **Fill** pada kolom angka, teks atau pilihan juga memiliki bagian **Design token** yang menautkan satu token di seluruh baris kolom tersebut ([Tautkan banyak dokumen sekaligus](/info/token-workflows.html#link-many-documents-at-once)).

**Atur keluaran.** Bilah alat mengatur nama file zip, **Default format**, satuan dan DPI untuk setiap baris. Menu format adalah daftar berkelompok dari panel ekspor yang memuat format yang ditawarkan katalog dan didukung browser Anda. Baris dengan format, ukuran atau nama file sendiri mempertahankan pengaturannya sendiri.

**Render.** **Render all** mengekspor setiap baris ke dalam satu `.zip`. Saat ada baris terpilih, **Render selected**, **Export selected CSV** dan **Print selected rows** hanya bekerja pada baris tersebut. Kosongkan pilihan untuk kembali bekerja pada seluruh batch. **Print sheet** menata baris pada lembar yang dapat dicetak. **Batch activity** melaporkan setiap impor dan render, serta dapat dilipat.

**Simpan batch.** **Sessions** menyimpan setiap baris grid sebagai sesi batch bernama, apa pun yang dipilih. Sesi dapat dibuka kembali dari Projects. **Folders…** di menu yang sama membuka folder Projects sebagai baris, satu per sesi tersimpan; setiap nama file menyertakan path foldernya.

::: details Memilih baris dan sel
Pilih baris dengan kotak centangnya, atau Shift-klik kotak centang untuk memilih rentang. Kotak centang di header memilih halaman saat ini, dan **Select all *N* rows** juga mengambil baris di halaman lain. Pilihan tetap ada saat Anda berpindah halaman. **Edit input**, **Duplicate** dan **Remove** bekerja pada baris terpilih, dan **Undo remove** memulihkan baris yang terakhir dihapus. Dari sel yang mendapat fokus, Shift+Space memilih baris itu dan Escape mengosongkan pilihan.

Seret melintasi sel, Shift-klik sel atau gunakan Shift+tombol panah untuk memilih area persegi panjang. **Copy cells**, atau Ctrl+C / Command+C, menyalin nilainya untuk spreadsheet. Ctrl+A / Command+A dari sel yang mendapat fokus memilih setiap kolom yang terlihat di setiap halaman; dari kotak centang baris, pintasan yang sama memilih setiap baris. Memilih sel membiarkan baris yang dicentang tetap dicentang. Klik dua kali sel atau tekan Enter untuk menyunting teksnya. Tempel area persegi panjang dari clipboard, atau tempel satu nilai untuk mengisi setiap sel terpilih; sel kosong dan teks multibaris mempertahankan posisinya.
:::

### Colourway dan tema per baris

Setiap baris mempertahankan pilihan temanya sendiri: terang atau gelap, serta colourway jika design system memilikinya. Baris yang dibuka dari Projects, folder atau batch tersimpan dirender dan dipratinjau dengan pilihan yang digunakan saat sesinya disimpan. Lembar cetak, baris yang diduplikasi dan baris yang diisi mempertahankannya.

CSV menyertakan pilihan dalam kolom `_themes` setelah kolom ukuran. Kolom ini memiliki JSON yang sama dengan parameter tautan `_themes`, misalnya `{"":"dark","colourway":"beach"}`. Sel kosong, atau `{}`, berarti default design system. Kolom hanya ditulis jika ada baris yang memiliki pilihan. Saat impor, sel yang bukan pilihan tema yang valid dicantumkan sebagai masalah dan barisnya dirender dengan default.

::: note Atur pilihan baris dalam CSV
Grid belum memiliki kontrol untuk mengubah pilihan baris, jadi atur dalam CSV atau dalam sesi tersimpan.
:::

### Bahasa untuk setiap baris

Alat yang mencetak kata-katanya sendiri, seperti Certificate, dapat menerima kolom `language` dengan kode bahasa singkat seperti `de`, `ja` atau `ar`. Setiap baris lalu mencetak kata-kata dan tanggalnya dalam bahasa tersebut. Baris bahasa Arab dan Urdu ditata dari kanan ke kiri. Sel kosong mengikuti bahasa aplikasi. Bahasa yang belum memiliki terjemahan di Lolly dicetak dalam bahasa Inggris, termasuk tanggalnya, sehingga sertifikat tidak pernah diterjemahkan setengah-setengah.

### Batch, atau Render folder

Untuk merender ulang sesi yang sudah Anda simpan, pilih sesi di Projects dan gunakan **Render selection**, atau **Render folder** untuk seluruh folder. [Temukan dan pulihkan pekerjaan Anda](/info/find-your-work.html#find-something-you-saved) membahas keduanya.

<!--i:eti-layers-->
## Sunting beberapa desain tersimpan bersama

Centang dua hingga delapan sesi tersimpan di **Projects** dan pilih **Edit together** dari bilah pilihan. Sesi terbuka berdampingan sebagai kartu langsung di `#/multi?s=<slot>,<slot>…`. Setiap kartu adalah render nyata dari sesinya dan menampilkan apa yang akan diekspor.

Satu bilah sisi mengontrol semuanya:

- <!--i:sliders--> **Shared** berada di urutan pertama: setiap input yang dideklarasikan dengan cara yang sama oleh dua sesi atau lebih (id, tipe dan batasan yang sama, aturan yang digunakan grid batch untuk kolomnya). Perubahan pada kontrol bersama menjangkau setiap sesi yang mendeklarasikan input itu, secara langsung di setiap kartu. Dua sesi dari alat yang sama berbagi semua input; dua alat berbeda hanya berbagi input yang sama-sama dimilikinya. Menu **Input actions** pada kartu Shared menautkan token desain di setiap sesi yang mendeklarasikan input tersebut.
- <!--i:document--> Di bawah kartu Shared, **satu kartu terlipat per sesi** memuat semua input milik sesi itu, seperti di bilah sisi alatnya sendiri, dengan blok ekspor ringkas: **Format**, **W** / **H**, **Unit**, **DPI** dan **Download**. Download tersebut menyimpan sesi lebih dahulu, lalu merender file dengan nama file, format dan Content Credentials yang sama seperti jika dibuat dari alatnya.
- <!--i:search--> **Filter inputs…** di bagian atas menyaring kontrol pada setiap kartu sekaligus.

Klik kartu mana pun (atau tekan Enter pada kartu) untuk membuka kartu bilah sisi sesi tersebut. **Save all** menulis setiap sesi kembali ke slotnya sendiri. **Download all** menyimpan lebih dahulu, lalu merender kumpulan itu ke dalam satu zip, seperti **Render selection** di Projects, dan menawarkan kunci kata sandi opsional.

Setiap kartu digambar dengan pilihan tema sesinya sendiri, termasuk alat yang ditempatkan di dalam desain. Aplikasi di sekitar kartu mempertahankan warnanya sendiri. **Save all**, unduhan, **Batch grid** dan **Send to Print Sheet** mempertahankan pilihan setiap sesi.

### Batasan

- **Maksimal delapan.** Setiap kartu menjalankan runtime langsungnya sendiri, dan delapan kartu tetap responsif. Tautan yang meminta lebih banyak, atau sesi yang sudah tidak ada, memberi tahu hal itu dan tidak memuat sebagian saja.
- **Tautan bersifat lokal.** Tautan menyebut slot tersimpan milik Anda sendiri dan membuka kembali kumpulan itu di perangkat ini. Tautan ini bukan tautan berbagi.
- **Untuk jumlah yang lebih besar,** pilih **Edit as sheet** di bilah pilihan yang sama. Pilihan dibuka sebagai baris di grid batch (`#/batch?s=…`), tanpa batas ukuran dan tanpa aturan harus memakai alat yang sama. Folder tidak disertakan dalam keduanya: buka folder di grid dengan **Sessions → Folders…**, atau render folder dengan **Render folder** di Projects.
- **Pencarian tidak menjangkau Lolly Multi-edit.** Ini satu-satunya tampilan yang tidak dicakup bilah pencarian.

<!--i:eti-map-pin-->
## Ke mana selanjutnya

- **[Ekspor file](/info/exporting.html)**: format, ukuran dan pengaturan cetak yang dapat digunakan setiap baris.
- **[Templat](/info/templates.html)**: titik awal yang cocok untuk baris pertama.
- **[Temukan dan pulihkan pekerjaan Anda](/info/find-your-work.html)**: Projects, folder dan merender apa yang Anda simpan.
