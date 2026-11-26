# Font cadangan

Bila font design system tidak dapat menggambar sebuah huruf, Lolly menggambarnya dengan font Noto terbuka, sehingga ekspor mempertahankan huruf sebagai path kontur vektor alih-alih gambar. Font Lolly Demo, Outfit untuk judul dan SUSE untuk teks, tidak memiliki huruf Kiril, Yunani, Arab, Ibrani, Dewanagari, Bengali, Thai, Tionghoa, Jepang atau Korea.

Font design system selalu didahulukan, sesuai urutannya dalam daftar. Outfit tidak memiliki huruf Vietnam, sehingga judul berbahasa Vietnam mengambilnya dari SUSE, font berikutnya dalam daftar Lolly Demo. Font cadangan hanya menggambar karakter yang tidak dapat digambar oleh satu pun font tersebut. Font merek mempertahankan setiap huruf, digit dan tanda yang dimilikinya, termasuk karakter Tionghoa, bahkan di dalam kata dalam aksara lain.

<!--i:eti-package-->
## Yang disertakan

Lima belas font, semuanya dari Google Fonts pada commit yang ditetapkan. Setiap file ditampilkan dengan ukuran unduhannya.

| Aksara | Font | Versi | Unduhan |
|---|---|---|---|
| Arab, termasuk huruf Urdu dan Persia | Noto Sans Arabic | 2.012 | 211 KB |
| Ibrani | Noto Sans Hebrew | 3.001 | 37 KB |
| Dewanagari (Hindi, Marathi, Nepali) | Noto Sans Devanagari | 2.007 | 151 KB |
| Bengali | Noto Sans Bengali | 3.011 | 139 KB |
| Thai | Noto Sans Thai | 2.002 | 62 KB |
| Kiril | Noto Sans, huruf Kiril | 2.015 | 115 KB, miring 132 KB |
| Yunani | Noto Sans, huruf Yunani | 2.015 | 77 KB, miring 83 KB |
| Latin, termasuk huruf Vietnam dan huruf beraksen lainnya | Noto Sans, huruf Latin | 2.015 | 316 KB, miring 350 KB |
| Tionghoa Sederhana, karakter GB 2312 | Noto Sans SC | 2.004 | 2,0 MB |
| Tionghoa Tradisional, karakter Big5 | Noto Sans TC | 2.004 | 3,8 MB |
| Jepang, karakter Shift_JIS | Noto Sans JP | 2.004 | 2,2 MB |
| Korea, setiap suku kata Hangul dan karakter KS X 1001 | Noto Sans KR | 2.004 | 2,5 MB |

Setiap font mempertahankan semua ketebalan pada sumbu ketebalannya, sehingga judul Tionghoa, Jepang atau Korea yang tebal tetap tebal. Sumbu lebar font Noto Sans ditetapkan pada normal, sehingga ukuran setiap file menjadi separuhnya. Font Tionghoa, Jepang dan Korea tidak memiliki sumbu lebar. Noto Sans dibagi menurut aksara, sehingga kata Kiril hanya mengunduh huruf Kiril. Path kontur tidak berubah dari sumber upstream.

::: details Tempat font disimpan dan cara pembuatannya
Font disimpan dalam satu folder bersama, `community/fallback-fonts`, disajikan ke setiap design system dari `/catalog/packs/fallback-fonts/`, seperti set emoji. `scripts/import-fallback-fonts.ts` membuat file dari font upstream yang ditetapkan di `scripts/data/fallback-fonts.json`, memeriksa setiap file upstream terhadap SHA-256 yang dicatat dan menulis teks lisensi di samping font.
:::

<!--i:eti-globe-->
## Tionghoa, Jepang dan Korea

Font Tionghoa, Jepang atau Korea yang belum dipangkas berukuran 9,6 MB hingga 17,8 MB. Masing-masing dipangkas menjadi set karakter nasionalnya, ditambah tanda baca, kana, bentuk lebar penuh dan simbol dalam teks:

- Tionghoa Sederhana: GB 2312, 6.763 hanzi umum beserta simbolnya, total 7.522 karakter.
- Tionghoa Tradisional: Big5, 13.053 hanzi beserta simbolnya, total 13.629 karakter. Hong Kong Supplementary Character Set tidak disertakan.
- Jepang: Shift_JIS sebagaimana dibaca Windows dan web, yaitu JIS X 0208 dengan tambahan NEC dan IBM yang diperlukan nama seperti 髙 dan 﨑, semua kana serta katakana setengah lebar, total 7.432 karakter.
- Korea: seluruh 11.172 suku kata Hangul dan KS X 1001, dengan 4.888 hanja, total 17.082 karakter.

Keempat font ini tidak menyertakan huruf Latin, Yunani dan Kiril, yang digambar oleh font design system dan font di atas. Set karakter berasal dari file indeks Encoding Standard pada commit yang ditetapkan, sehingga pembuatan ulang menghasilkan file yang sama.

Tionghoa, Jepang dan Korea memiliki sebagian besar karakter yang sama tetapi menggambar banyak di antaranya secara berbeda. 直, misalnya, ditulis dengan satu cara dalam bahasa Tionghoa dan cara lain dalam bahasa Jepang. Satu rangkaian teks mengambil semua karakter bersama dari salah satu font ini, tidak pernah dua. Lolly memilih font itu dalam urutan berikut:

1. Bahasa rangkaian teks, dari `lang` elemennya atau elemen terdekat yang mengelilinginya dalam dokumen. Pengaturan bahasa alat, seperti Language pada sertifikat, menetapkannya. Bahasa antarmuka Lolly sendiri dan bahasa design system tidak diperhitungkan, sehingga dokumen diekspor dengan hasil yang sama untuk semua orang.
2. Aksara rangkaian teks: kana berarti Jepang dan Hangul berarti Korea. Jika rangkaian tidak memiliki keduanya, Lolly membaca dokumen, sehingga judul yang hanya berisi kanji dalam dokumen Jepang digambar dengan bentuk Jepang. Dokumen dengan kana sekaligus Hangul tidak menentukan pilihan pada langkah ini.
3. Karakter yang hanya digunakan Tionghoa Tradisional, seperti 體 atau 說, dalam rangkaian teks atau jika tidak ada di sana, dalam dokumen, berarti Tionghoa Tradisional, kecuali teks yang sama juga memuat karakter yang hanya digunakan Tionghoa Sederhana.
4. Jika tidak, Tionghoa Sederhana.

Karakter yang tidak dimiliki font terpilih tidak pernah diambil dari salah satu dari tiga font lainnya. Karakter itu tetap berupa gambar. Kana atau Hangul yang tidak dimiliki font terpilih, seperti kata Korea dalam baris yang ditandai sebagai bahasa Jepang, masih dapat berasal dari font Jepang atau Korea, tetapi hanya jika font itu tidak akan menggambar karakter bersama apa pun pada baris tersebut.

Pada halaman, kanvas yang memuat dua bahasa ini mencantumkan kedua font, dan browser menggambar karakter bersama dengan font pertama. Ekspor menggambar setiap rangkaian teks dengan font masing-masing.

<!--i:eti-download-->
## Kapan font diunduh

Tidak ada yang diunduh sampai dokumen memuat karakter yang tidak dapat digambar oleh satu pun font design system-nya. Simbol dalam baris berbahasa Inggris, seperti ★ atau ※, tidak pernah memicu unduhan font Tionghoa, Jepang atau Korea.

Saat dokumen pertama kali memerlukan font cadangan, Lolly mengunduh satu font itu dan menyimpannya di perangkat Anda. Dokumen Jepang hanya mengunduh font Jepang, 2,2 MB, dan dokumen Tionghoa Tradisional mengunduh font Tradisional 3,8 MB. Sejak itu aksara digambar secara offline, dan font tetap tersimpan saat katalog dirapikan. Font disimpan bersama file katalog, tidak pernah di antara font yang Anda unggah, dan tidak muncul dalam daftar font merek Anda.

Baris perintah, aplikasi terminal dan server MCP membaca file yang sama dari disk, sehingga tidak memerlukan unduhan.

<!--i:eti-eye-->
## Pada halaman dan dalam ekspor

Halaman menggunakan font cadangan yang sama dengan ekspor, sehingga baris yang memuat huruf tersebut memiliki lebar yang sama pada keduanya. Hanya pada kanvas itu, Lolly menambahkan font cadangan setelah font design system sendiri dan sebelum font sistem mana pun. Alat yang menetapkan daftar font sendiri, dalam gaya atau pada elemennya, mendapat font cadangan di posisi yang sama. Kanvas yang dicakup design system mempertahankan daftar fontnya tanpa perubahan.

Halaman tidak mengubah daftar font yang diawali font sistem, seperti `system-ui` atau Helvetica, karena ekspor menggambar teks itu dengan font design system sedangkan halaman tidak.

Dalam PDF, kata-kata menjadi path kontur dalam font cadangan pada pengaturan teks apa pun, karena teks live PDF tidak dapat memuat aksara yang tidak dimiliki font tersemat. Dalam SVG, EMF, EPS, DXF dan WMF, kata-kata menjadi path kontur setiap kali teks dikonversi menjadi path kontur. Bila teks dipertahankan sebagai teks live, font milik pembaca yang menggambarnya. Bila font cadangan menggambar sebagian ekspor, panel ekspor menampilkan catatan seperti:

> Teks Jepang digambar dengan Noto Sans JP, karena font design system ini tidak memiliki huruf tersebut.

Baris perintah mencetak kalimat yang sama sebagai catatan.

<!--i:eti-image-->
## Yang tetap berupa gambar

Karakter di luar empat set nasional, seperti 𠮷 atau karakter tambahan Hong Kong, tidak memiliki font cadangan. Karakter langka seperti 𠮷, karakter yang ditambahkan untuk Hong Kong melalui set tambahannya dan aksara tanpa font cadangan, seperti Tamil, Etiopia atau Suryani, semuanya diperlakukan dengan cara yang sama. Aksara seperti Tamil, Etiopia atau Suryani juga tidak memilikinya. Dalam PDF, baris yang memuat teks tersebut dimasukkan sebagai gambar 300 dpi, dan panel ekspor mencantumkan aksaranya. Dalam SVG, rangkaian tetap berupa teks live, yang digambar oleh font milik pembaca.

::: details Dalam ekspor EPS, WMF dan EMF
EPS, WMF atau EMF dengan **Outline fonts** aktif tidak memiliki teks live sebagai cadangan, sehingga rangkaian teks juga dimasukkan sebagai gambar 300 dpi. Gambar hanya menerapkan warna teks di tempat huruf berada, sehingga latar belakang tetap terlihat. Panel ekspor mencantumkan aksaranya. Gambar hanya digambar tegak, sehingga rangkaian teks yang diputar atau dimiringkan menghentikan ekspor dengan pesan yang mengutip rangkaian itu. Dalam WMF atau EMF, gambar berupa sepasang operasi bitmap, mask dan pewarnaan. Microsoft Office dan LibreOffice menggambarnya sebagaimana dimaksud. Aplikasi yang mengabaikannya, seperti Inkscape, menampilkan kata-kata di atas kotak putih.

EMF dengan **Outline fonts** mati mempertahankan rangkaian tersebut sebagai teks live, yang digambar oleh font milik pembaca. Pengecualiannya adalah rangkaian yang tidak dapat dimuat teks live EMF, seperti teks dengan jarak huruf. Lolly mengubah rangkaian itu menjadi path kontur, sehingga rangkaian yang tidak dapat digambar oleh font mana pun juga dimasukkan sebagai gambar di sana.
:::

::: warning Ekspor DXF berhenti pada teks yang tidak dapat digambar font mana pun
DXF digunakan oleh mesin potong dan perangkat lunak CAD, yang memerlukan path kontur, sehingga rangkaian teks yang tidak dapat digambar font mana pun menghentikan ekspor DXF. Pesan mengutip rangkaian teks dan menyebutkan aksaranya. Tambahkan font dengan huruf itu, atau ekspor SVG atau PDF.
:::

<!--i:eti-checklist-->
## Pemeriksaan sebelum Anda mengekspor

Kartu **Before you export** di Lolly Design dan pemeriksaan `render` dari `lolly check` melaporkan teks yang tidak dapat digambar font mana pun. Keduanya memperhitungkan font cadangan seperti ekspor, dari daftar karakter per font yang sama, sehingga teks yang digambar font cadangan tidak dilaporkan. Aksara tanpa font cadangan, seperti Tamil, dan karakter Tionghoa, Jepang atau Korea di luar set nasional tetap dilaporkan, karena ekspor menggambarnya sebagai gambar atau teks live, dan ekspor DXF berhenti saat menemuinya. Pemeriksaan membaca daftar itu dari katalog dan tidak mengunduh font.

<!--i:eti-stamp-->
## Lisensi dan kredit

Setiap font cadangan menggunakan SIL Open Font License 1.1. Setiap entri katalog mencatat lisensi itu dengan hash teks lisensi, sehingga aturan hak dalam [Hak kreatif dan kredit](/info/creative-rights.html) membaca lisensi seperti lisensi font lainnya. Teks lisensi berada di samping font. File Noto Sans tidak menyatakan Reserved Font Name. Font Tionghoa, Jepang dan Korea milik Adobe dan mencadangkan nama Source. File yang dipangkas mempertahankan nama Noto, yang tidak menggunakan nama itu.

Lisensi menyatakan ketentuannya tidak berlaku untuk dokumen yang dibuat dengan font tersebut. Ekspor hanya memuat path kontur huruf yang digunakannya, seperti halnya font design system sendiri. Lolly tidak menambahkan program font, baris kredit atau entri kredensial konten baru untuk font cadangan.
