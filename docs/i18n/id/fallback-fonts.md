# Font cadangan

Font sebuah design system sering hanya mencakup sebagian aksara dunia. Lolly Demo memakai Outfit untuk judul dan SUSE untuk teks, dan tidak satu pun dari kedua font itu punya huruf Sirilik, Yunani, Arab, Ibrani, Devanagari, Bengali, Thai, Tionghoa, Jepang, atau Korea. Ketika dokumen berisi huruf yang tidak dapat digambar oleh font design system-nya, Lolly menggambar huruf itu dengan font Noto terbuka, sehingga ekspor mempertahankannya sebagai kontur vektor, bukan mengubah kata-katanya menjadi gambar.

Font design system selalu didahulukan, sesuai urutan yang dicantumkan design system. Outfit tidak punya huruf Vietnam, jadi judul berbahasa Vietnam mengambilnya dari SUSE, font berikutnya dalam daftar Lolly Demo. Font cadangan hanya menggambar karakter yang tidak dapat digambar oleh satu pun font itu, sehingga font brand mempertahankan setiap huruf, angka, dan tanda yang dimilikinya, bahkan di dalam kata beraksara lain. Font brand yang punya sebuah karakter Tionghoa juga mempertahankan karakter itu.

## Yang disertakan

Lima belas font, semuanya dari Google Fonts pada commit yang dipatok dan semuanya berlisensi SIL Open Font License 1.1. Setiap file ditampilkan dengan ukuran unduhannya.

| Aksara | Font | Versi | Unduhan |
|---|---|---|---|
| Arab, termasuk huruf Urdu dan Persia | Noto Sans Arabic | 2.012 | 206 KB |
| Ibrani | Noto Sans Hebrew | 3.001 | 37 KB |
| Devanagari (Hindi, Marathi, Nepal) | Noto Sans Devanagari | 2.007 | 147 KB |
| Bengali | Noto Sans Bengali | 3.011 | 136 KB |
| Thai | Noto Sans Thai | 2.002 | 61 KB |
| Sirilik | Noto Sans, huruf Sirilik | 2.015 | 112 KB, miring 129 KB |
| Yunani | Noto Sans, huruf Yunani | 2.015 | 75 KB, miring 81 KB |
| Latin, termasuk huruf Vietnam dan huruf beraksen lainnya | Noto Sans, huruf Latin | 2.015 | 309 KB, miring 342 KB |
| Tionghoa Sederhana, karakter GB 2312 | Noto Sans SC | 2.004 | 1,9 MB |
| Tionghoa Tradisional, karakter Big5 | Noto Sans TC | 2.004 | 3,6 MB |
| Jepang, karakter Shift_JIS | Noto Sans JP | 2.004 | 2,1 MB |
| Korea, setiap suku kata Hangul dan karakter KS X 1001 | Noto Sans KR | 2.004 | 2,4 MB |

Sumbu bobot setiap font dipertahankan utuh, sehingga setiap bobot yang diminta desain tetap tergambar, dan judul Tionghoa, Jepang, atau Korea yang tebal memang tebal. Sumbu lebar font Noto Sans dikunci pada normal, yang memangkas setiap file separuhnya; font Tionghoa, Jepang, dan Korea tidak punya sumbu lebar. Noto Sans dipecah menurut aksara, jadi kata Sirilik hanya mengunduh huruf Sirilik. Kontur yang dipakai adalah kontur asli dari hulu, tanpa perubahan.

Font disimpan di satu folder bersama, `community/fallback-fonts`, yang disajikan ke setiap design system dari `/catalog/packs/fallback-fonts/`, dengan cara yang sama seperti set emoji dibagikan. `scripts/import-fallback-fonts.ts` membangun file dari font hulu yang dipatok di `scripts/data/fallback-fonts.json`, memeriksa setiap file hulu terhadap SHA-256 yang tercatat, dan menulis teks lisensi di samping font.

## Tionghoa, Jepang, dan Korea

Satu font Tionghoa, Jepang, atau Korea utuh berukuran 9,6 MB hingga 17,8 MB, jadi setiap font ini dipotong menjadi set karakter nasional yang dipakai pembacanya sehari-hari, ditambah tanda baca, kana, bentuk lebar penuh, dan simbol dari teks bersambung:

- Tionghoa Sederhana: GB 2312, 6.763 hanzi umum beserta simbolnya, 7.522 karakter seluruhnya.
- Tionghoa Tradisional: Big5, 13.053 hanzi beserta simbolnya, 13.629 karakter seluruhnya. Hong Kong Supplementary Character Set tidak disertakan.
- Jepang: Shift_JIS sebagaimana dibaca Windows dan web, yaitu JIS X 0208 dengan tambahan NEC dan IBM yang dibutuhkan nama seperti 髙 dan 﨑, setiap kana dan katakana lebar setengah, 7.432 karakter seluruhnya.
- Korea: seluruh 11.172 suku kata Hangul dan KS X 1001, dengan 4.888 hanja-nya, 17.082 karakter seluruhnya.

Huruf Latin, Yunani, dan Sirilik tidak dimasukkan ke keempat font ini, karena font design system dan font di atas sudah menggambarnya. Set karakter dibaca dari file indeks Encoding Standard pada commit yang dipatok, jadi pembangunan ulang menghasilkan file yang sama.

Tionghoa, Jepang, dan Korea berbagi sebagian besar karakternya, tetapi masing-masing menggambar banyak di antaranya secara berbeda. Karakter 直 yang sama ditulis dengan satu cara dalam bahasa Tionghoa dan cara lain dalam bahasa Jepang. Karena itu satu run teks mengambil semua karakter bersamanya dari satu font ini, tidak pernah dua, dan Lolly memilih font itu dengan urutan berikut:

1. Bahasa run itu, dari `lang` elemennya atau elemen terdekat di sekitarnya dalam dokumen. Pengaturan bahasa sebuah alat, seperti Language pada sertifikat, menetapkannya. Bahasa antarmuka Lolly sendiri dan bahasa design system tidak dihitung, sehingga dokumen diekspor sama untuk semua orang.
2. Aksara run itu: kana berarti Jepang dan Hangul berarti Korea. Bila run itu sendiri tidak punya keduanya, seluruh dokumen dibaca, sehingga judul yang hanya berisi kanji dalam dokumen Jepang digambar dalam bahasa Jepang. Dokumen yang berisi kana sekaligus Hangul tidak menentukan apa pun di sini.
3. Karakter yang hanya dipakai Tionghoa Tradisional, seperti 體 atau 說, di dalam run atau, bila tidak ada, di dalam dokumen, berarti Tionghoa Tradisional, kecuali teks yang sama juga memuat karakter yang hanya dipakai Tionghoa Sederhana.
4. Selain itu, Tionghoa Sederhana.

Karakter yang tidak dimiliki font terpilih tidak pernah diambil dari tiga font lainnya. Karakter itu tetap menjadi gambar, seperti dijelaskan di bawah. Kana atau Hangul yang tidak dimiliki font terpilih, seperti kata Korea dalam baris yang ditandai sebagai Jepang, masih dapat berasal dari font Jepang atau Korea, tetapi hanya bila font itu tidak akan menggambar karakter bersama mana pun dalam baris tersebut.

Di halaman, kanvas yang berisi dua bahasa ini mencantumkan kedua font, dan browser menggambar karakter bersama dengan font yang pertama. Ekspor menggambar setiap run dengan font miliknya sendiri.

## Kapan font diunduh

Tidak ada yang diunduh sampai dokumen berisi karakter yang tidak dapat digambar oleh font design system-nya. Dokumen berbahasa Inggris, atau bahasa apa pun yang dicakup design system-nya, tidak pernah mengunduh font cadangan. Simbol dalam baris berbahasa Inggris, seperti ★ atau ※, tidak pernah mengunduh font Tionghoa, Jepang, atau Korea.

Saat pertama kali dokumen membutuhkannya, Lolly mengunduh satu font itu, untuk satu aksara itu, dan menyimpannya di perangkat Anda. Dokumen Jepang hanya mengunduh font Jepang, 2,1 MB, dan dokumen Tionghoa Tradisional mengunduh font Tradisional 3,6 MB. Sejak itu aksara tersebut tergambar secara offline, dan font tetap ada ketika katalog dirapikan. Font disimpan bersama file katalog sendiri, tidak pernah di antara font yang Anda unggah, sehingga tidak muncul di daftar font brand Anda.

Baris perintah, aplikasi terminal, dan server MCP membaca file yang sama dari disk, jadi tidak perlu unduhan.

## Di halaman dan di ekspor

Halaman memakai font cadangan yang sama dengan ekspor. Tanpa ini, browser menggambar huruf semacam itu dengan font sistem sementara ekspor memakai Noto, dan baris yang memuatnya berubah lebar antara keduanya. Lolly menambahkan font cadangan di akhir daftar font design system pada kanvas itu saja, setelah font design system sendiri dan sebelum font sistem mana pun. Alat yang menetapkan daftar fontnya sendiri, di gayanya atau pada elemennya, mendapat font cadangan di tempat yang sama: setelah font yang diberikan daftar itu dan sebelum font sistem mana pun. Kanvas yang dicakup design system mempertahankan daftar fontnya persis seperti sebelumnya.

Halaman membiarkan daftar font apa adanya bila diawali font sistem, seperti `system-ui` atau Helvetica, karena ekspor menggambar teks itu dengan font design system sedangkan halaman tidak.

Di PDF, kata-kata menjadi kontur yang digambar dengan font cadangan, apa pun pengaturan teks yang Anda pilih, karena teks PDF hidup tidak dapat membawa aksara yang tidak dimiliki font tersemat. Di SVG, EMF, EPS, DXF, dan WMF, kata-kata menjadi kontur setiap kali teks diubah menjadi kontur; dengan teks tetap hidup, font milik pembaca yang menggambarnya, seperti sebelumnya. Ketika font cadangan menggambar sebagian ekspor, panel ekspor menampilkan catatan seperti:

> Teks Jepang digambar dengan Noto Sans JP, karena font design system ini tidak memiliki huruf-huruf tersebut.

Baris perintah mencetak kalimat yang sama sebagai catatan.

## Yang tetap menjadi gambar

Karakter di luar keempat set nasional tidak punya font cadangan. Karakter langka seperti 𠮷, karakter yang ditambahkan untuk Hong Kong oleh set tambahannya, dan aksara tanpa font cadangan, seperti Tamil, Etiopia, atau Suryani, semuanya diperlakukan dengan cara yang sama. Di PDF, baris yang memuatnya masuk sebagai gambar 300 dpi, dan panel ekspor mencantumkan aksaranya. Di SVG, run tetap menjadi teks hidup, yang digambar oleh font milik pembaca.

## Pemeriksaan sebelum ekspor

Kartu **Before you export** milik Lolly Design, dan pemeriksaan `render` pada `lolly check`, melaporkan teks yang tidak dapat digambar font mana pun. Keduanya menghitung font cadangan seperti yang dilakukan ekspor, dari daftar karakter yang sama yang dimiliki setiap font, sehingga teks yang digambar font cadangan tidak dilaporkan. Aksara tanpa font cadangan, seperti Tamil, dan karakter Tionghoa, Jepang, atau Korea di luar set nasional tetap dilaporkan, karena ekspor menggambarnya sebagai gambar atau sebagai teks hidup. Pemeriksaan ini membaca daftar itu dari katalog dan tidak mengunduh font apa pun.

## Lisensi dan kredit

Setiap font cadangan berlisensi SIL Open Font License 1.1, dan setiap entri katalog mencatat lisensi itu dengan hash teks lisensinya, sehingga aturan hak dalam [Creative rights and credits](/info/creative-rights.html) membaca lisensinya seperti font lain mana pun. Teks lisensi berada di samping font. File Noto Sans tidak menyatakan Reserved Font Name. Font Tionghoa, Jepang, dan Korea adalah milik Adobe, dan mencadangkan nama Source; file hasil potongan mempertahankan nama Noto-nya, yang tidak memakai nama itu.

Lisensi menyatakan bahwa ketentuannya tidak berlaku untuk dokumen yang dibuat dengan font tersebut. Ekspor hanya memuat kontur gambar huruf yang dipakainya, seperti pada font design system sendiri, dan Lolly tidak menambahkan program font, baris kredit, maupun entri content credential baru untuk font cadangan.
