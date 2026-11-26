# Fon sandaran

Apabila fon sistem reka bentuk tidak boleh melukis sesuatu huruf, Lolly melukis huruf itu dengan fon Noto terbuka, jadi eksport mengekalkan huruf sebagai garis luar vektor dan bukannya gambar. Fon Lolly Demo, Outfit untuk tajuk dan SUSE untuk teks, tiada huruf Cyrillic, Yunani, Arab, Ibrani, Devanagari, Bengali, Thai, Cina, Jepun atau Korea.

Fon sistem reka bentuk sentiasa didahulukan, mengikut susunan senarainya. Outfit tiada huruf Vietnam, jadi tajuk bahasa Vietnam mengambilnya daripada SUSE, fon seterusnya dalam senarai Lolly Demo. Fon sandaran hanya melukis aksara yang tidak boleh dilukis oleh mana-mana fon itu. Fon jenama mengekalkan setiap huruf, digit dan tanda yang dimilikinya, termasuk aksara Cina, walaupun dalam perkataan dalam skrip lain.

<!--i:eti-package-->
## Apa yang disertakan

Lima belas fon, semuanya daripada Google Fonts pada komit yang ditetapkan. Setiap fail ditunjukkan bersama saiz muat turunnya.

| Skrip | Fon | Versi | Muat turun |
|---|---|---|---|
| Arab, termasuk huruf Urdu dan Parsi | Noto Sans Arabic | 2.012 | 211 KB |
| Ibrani | Noto Sans Hebrew | 3.001 | 37 KB |
| Devanagari (Hindi, Marathi, Nepal) | Noto Sans Devanagari | 2.007 | 151 KB |
| Bengali | Noto Sans Bengali | 3.011 | 139 KB |
| Thai | Noto Sans Thai | 2.002 | 62 KB |
| Cyrillic | Noto Sans, huruf Cyrillic | 2.015 | 115 KB, italik 132 KB |
| Yunani | Noto Sans, huruf Yunani | 2.015 | 77 KB, italik 83 KB |
| Latin, termasuk huruf Vietnam dan huruf beraksen lain | Noto Sans, huruf Latin | 2.015 | 316 KB, italik 350 KB |
| Cina Ringkas, aksara GB 2312 | Noto Sans SC | 2.004 | 2.0 MB |
| Cina Tradisional, aksara Big5 | Noto Sans TC | 2.004 | 3.8 MB |
| Jepun, aksara Shift_JIS | Noto Sans JP | 2.004 | 2.2 MB |
| Korea, setiap suku kata Hangul dan aksara KS X 1001 | Noto Sans KR | 2.004 | 2.5 MB |

Setiap fon mengekalkan setiap berat pada paksi beratnya, jadi tajuk Cina, Jepun atau Korea yang tebal kekal tebal. Fon Noto Sans mempunyai paksi lebar yang ditetapkan pada normal, menjadikan setiap fail separuh saiznya. Fon Cina, Jepun dan Korea tiada paksi lebar. Noto Sans dipecahkan mengikut skrip, jadi perkataan Cyrillic hanya memuat turun huruf Cyrillic. Garis luar tidak berubah daripada sumber huluan.

::: details Tempat fon disimpan dan cara fon dibina
Fon disimpan dalam satu folder kongsi, `community/fallback-fonts`, disajikan kepada setiap sistem reka bentuk daripada `/catalog/packs/fallback-fonts/`, seperti set emoji. `scripts/import-fallback-fonts.ts` membina fail daripada fon huluan yang ditetapkan dalam `scripts/data/fallback-fonts.json`, menyemak setiap fail huluan terhadap SHA-256 yang direkodkan dan menulis teks lesen di sebelah fon.
:::

<!--i:eti-globe-->
## Cina, Jepun dan Korea

Fon Cina, Jepun atau Korea yang belum dipotong bersaiz 9.6 MB hingga 17.8 MB. Setiap satu dipotong kepada set aksara kebangsaannya, serta tanda baca, kana, bentuk lebar penuh dan simbol dalam teks biasa:

- Cina Ringkas: GB 2312, 6,763 hanzi lazim dan simbolnya, sejumlah 7,522 aksara.
- Cina Tradisional: Big5, 13,053 hanzi dan simbolnya, sejumlah 13,629 aksara. Hong Kong Supplementary Character Set tidak disertakan.
- Jepun: Shift_JIS seperti yang dibaca oleh Windows dan web, iaitu JIS X 0208 dengan tambahan NEC dan IBM yang diperlukan oleh nama seperti 髙 dan 﨑, setiap kana dan katakana separuh lebar, sejumlah 7,432 aksara.
- Korea: kesemua 11,172 suku kata Hangul dan KS X 1001, dengan 4,888 hanja, sejumlah 17,082 aksara.

Empat fon ini mengecualikan huruf Latin, Yunani dan Cyrillic, yang dilukis oleh fon sistem reka bentuk dan fon di atas. Set itu datang daripada fail indeks Encoding Standard pada komit yang ditetapkan, jadi pembinaan semula menghasilkan fail yang sama.

Cina, Jepun dan Korea berkongsi kebanyakan aksaranya tetapi melukis banyak aksara itu secara berbeza. 直, sebagai contoh, ditulis dengan satu cara dalam bahasa Cina dan cara lain dalam bahasa Jepun. Satu segmen teks mengambil semua aksara kongsinya daripada satu fon ini, tidak pernah dua. Lolly memilih fon itu dalam susunan ini:

1. Bahasa segmen, daripada `lang` elemennya atau elemen terdekat yang melingkunginya dalam dokumen. Tetapan bahasa alat, seperti Language pada sijil, menetapkannya. Bahasa antara muka Lolly sendiri dan bahasa sistem reka bentuk tidak diambil kira, jadi dokumen dieksport dengan cara yang sama untuk semua orang.
2. Skrip segmen: kana bermakna Jepun dan Hangul bermakna Korea. Apabila segmen tiada kedua-duanya, Lolly membaca dokumen, jadi tajuk yang hanya mengandungi kanji dalam dokumen Jepun dilukis dalam bahasa Jepun. Dokumen dengan kedua-dua kana dan Hangul tidak menentukan apa-apa pada langkah ini.
3. Aksara yang hanya digunakan dalam Cina Tradisional, seperti 體 atau 說, dalam segmen atau jika tiada, dalam dokumen, bermakna Cina Tradisional, melainkan teks yang sama juga menyimpan aksara yang hanya digunakan dalam Cina Ringkas.
4. Jika tidak, Cina Ringkas.

Aksara yang tiada dalam fon pilihan tidak pernah diambil daripada salah satu daripada tiga fon lain. Ia kekal sebagai gambar. Kana atau Hangul yang tiada dalam fon pilihan, seperti perkataan Korea dalam baris yang ditandakan sebagai Jepun, masih boleh datang daripada fon Jepun atau Korea, tetapi hanya apabila fon itu tidak akan melukis sebarang aksara kongsi baris tersebut.

Pada halaman, kanvas yang mengandungi dua bahasa ini menyenaraikan kedua-dua fon, dan pelayar melukis aksara kongsi dengan fon pertama. Eksport melukis setiap segmen dengan fonnya sendiri.

<!--i:eti-download-->
## Bila fon dimuat turun

Tiada apa-apa dimuat turun sehingga dokumen mengandungi aksara yang tidak boleh dilukis oleh mana-mana fon sistem reka bentuknya. Simbol dalam baris bahasa Inggeris, seperti ★ atau ※, tidak pernah memuat turun fon Cina, Jepun atau Korea.

Kali pertama dokumen memerlukan fon sandaran, Lolly memuat turun satu fon itu dan menyimpannya pada peranti anda. Dokumen Jepun hanya memuat turun fon Jepun, 2.2 MB, dan dokumen Cina Tradisional memuat turun fon Tradisional 3.8 MB. Mulai saat itu, skrip dilukis secara luar talian, dan fon kekal apabila katalog dikemaskan. Fon disimpan bersama fail katalog, tidak pernah bersama fon yang anda muat naik, dan tidak muncul dalam senarai fon jenama anda.

Baris perintah, apl terminal dan pelayan MCP membaca fail yang sama daripada cakera, jadi tiada muat turun diperlukan.

<!--i:eti-eye-->
## Pada halaman dan dalam eksport

Halaman menggunakan fon sandaran yang sama seperti eksport, jadi baris yang mengandungi huruf sedemikian mempunyai lebar yang sama dalam kedua-duanya. Pada kanvas itu sahaja, Lolly menambah fon sandaran selepas fon sistem reka bentuk sendiri dan sebelum sebarang fon sistem. Alat yang menetapkan senarai fonnya sendiri, dalam gayanya atau pada elemennya, mendapat fon sandaran di tempat yang sama. Kanvas yang diliputi oleh sistem reka bentuk mengekalkan senarai fonnya tanpa perubahan.

Halaman membiarkan senarai fon seperti sedia ada apabila senarai itu bermula dengan fon sistem, seperti `system-ui` atau Helvetica, kerana eksport melukis teks itu dengan fon sistem reka bentuk manakala halaman tidak.

Dalam PDF, perkataan menjadi garis luar dalam fon sandaran dengan sebarang tetapan teks, kerana teks PDF langsung tidak boleh membawa skrip yang tiada dalam fon terbenam. Dalam SVG, EMF, EPS, DXF dan WMF, perkataan menjadi garis luar apabila teks ditukar kepada garis luar. Dengan teks dikekalkan secara langsung, fon pembaca sendiri melukisnya. Apabila fon sandaran melukis sebahagian daripada eksport, panel eksport menunjukkan nota seperti:

> Teks Jepun dilukis dengan Noto Sans JP, kerana fon sistem reka bentuk ini tidak mempunyai huruf tersebut.

Baris perintah mencetak ayat yang sama sebagai nota.

<!--i:eti-image-->
## Apa yang kekal sebagai gambar

Aksara di luar empat set kebangsaan, seperti 𠮷 atau aksara tambahan Hong Kong, tiada fon sandaran. Aksara jarang seperti 𠮷, aksara yang ditambah untuk Hong Kong oleh set tambahannya dan skrip tanpa fon sandaran, seperti Tamil, Ethiopic atau Syriac, semuanya dikendalikan dengan cara yang sama. Begitu juga skrip seperti Tamil, Ethiopic atau Syriac. Dalam PDF, baris yang mengandungi teks sedemikian dimasukkan sebagai gambar 300 dpi, dan panel eksport menyenaraikan skripnya. Dalam SVG, segmen kekal sebagai teks langsung, yang dilukis oleh fon pembaca sendiri.

::: details Dalam eksport EPS, WMF dan EMF
EPS, WMF atau EMF dengan **Outline fonts** dihidupkan tiada teks langsung sebagai sandaran, jadi segmen turut dimasukkan sebagai gambar 300 dpi. Gambar melukis warna teks hanya pada tempat huruf berada, jadi latar belakang kelihatan melaluinya. Panel eksport menyenaraikan skrip. Gambar dilukis tegak sahaja, jadi segmen yang diputar atau dicondongkan menghentikan eksport dengan mesej yang memetik segmen itu. Dalam WMF atau EMF, gambar ialah sepasang operasi peta bit, topeng dan sapuan warna. Microsoft Office dan LibreOffice melukisnya seperti yang dimaksudkan. Apl yang mengabaikannya, seperti Inkscape, menunjukkan perkataan pada kotak putih.

EMF dengan **Outline fonts** dimatikan mengekalkan segmen sedemikian sebagai teks langsung, yang dilukis oleh fon pembaca sendiri. Pengecualiannya ialah segmen yang tidak boleh dibawa oleh teks EMF langsung, seperti teks dengan jarak huruf. Lolly menjadikan segmen itu garis luar, jadi segmen yang tidak boleh dilukis oleh mana-mana fon turut dimasukkan sebagai gambar di situ.
:::

::: warning Eksport DXF berhenti pada teks yang tidak boleh dilukis oleh mana-mana fon
DXF dihantar ke mesin pemotong dan perisian CAD, yang memerlukan garis luar, jadi segmen yang tidak boleh dilukis oleh mana-mana fon menghentikan eksport DXF. Mesej memetik segmen dan menyatakan skripnya. Tambah fon dengan huruf tersebut, atau eksport SVG atau PDF.
:::

<!--i:eti-checklist-->
## Semakan sebelum anda mengeksport

Kad **Before you export** Lolly Design dan semakan `render` pada `lolly check` melaporkan teks yang tidak boleh dilukis oleh mana-mana fon. Kedua-duanya mengambil kira fon sandaran seperti eksport, daripada senarai aksara setiap fon yang sama, jadi teks yang dilukis oleh fon sandaran tidak dilaporkan. Skrip tanpa fon sandaran, seperti Tamil, dan aksara Cina, Jepun atau Korea di luar set kebangsaan masih dilaporkan, kerana eksport melukisnya sebagai gambar atau teks langsung, dan eksport DXF berhenti padanya. Semakan membaca senarai itu daripada katalog dan tidak memuat turun fon.

<!--i:eti-stamp-->
## Lesen dan kredit

Setiap fon sandaran berada di bawah SIL Open Font License 1.1. Setiap entri katalog merekodkan lesen itu dengan cincangan teks lesen, jadi peraturan hak dalam [Hak kreatif dan kredit](/info/creative-rights.html) membaca lesen seperti lesen fon lain. Teks lesen berada di sebelah fon. Fail Noto Sans tidak mengisytiharkan Reserved Font Name. Fon Cina, Jepun dan Korea ialah milik Adobe dan merizabkan nama Source. Fail yang dipotong mengekalkan nama Noto masing-masing, yang tidak menggunakan nama itu.

Lesen menyatakan bahawa syaratnya tidak terpakai pada dokumen yang dibuat dengan fon tersebut. Eksport hanya menyimpan garis luar huruf yang digunakannya, seperti fon sistem reka bentuk sendiri. Lolly tidak menambah program fon, baris kredit atau entri kelayakan kandungan baharu untuk fon sandaran.
