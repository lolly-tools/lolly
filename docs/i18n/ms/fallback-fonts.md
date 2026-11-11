# Fon sandaran

Fon sesebuah sistem reka bentuk selalunya hanya meliputi sebahagian daripada skrip dunia. Lolly Demo menetapkan tajuk dalam Outfit dan teks dalam SUSE, dan kedua-duanya tidak mempunyai huruf Cyrillic, Yunani, Arab, Ibrani, Devanagari, Bengali, Thai, Cina, Jepun atau Korea. Apabila dokumen mengandungi huruf yang tidak boleh dilukis oleh fon sistem reka bentuknya, Lolly melukis huruf itu dengan fon Noto terbuka, supaya eksport mengekalkannya sebagai kontur vektor dan tidak menukar perkataan itu menjadi gambar.

Fon sistem reka bentuk sentiasa diutamakan, mengikut susunan yang disenaraikan oleh sistem reka bentuk itu. Outfit tidak mempunyai huruf Vietnam, jadi tajuk dalam bahasa Vietnam mengambilnya daripada SUSE, fon seterusnya dalam senarai Lolly Demo. Fon sandaran hanya melukis aksara yang tidak boleh dilukis oleh mana-mana fon tersebut, jadi fon jenama mengekalkan setiap huruf, digit dan tanda yang dimilikinya, malah di dalam perkataan dalam skrip lain. Fon jenama yang mempunyai aksara Cina juga mengekalkan aksara itu.

## Apa yang disertakan

Lima belas fon, semuanya daripada Google Fonts pada komit yang dipinkan dan semuanya di bawah SIL Open Font License 1.1. Setiap fail ditunjukkan dengan saiz muat turunnya.

| Skrip | Fon | Versi | Muat turun |
|---|---|---|---|
| Arab, termasuk huruf Urdu dan Parsi | Noto Sans Arabic | 2.012 | 211 KB |
| Ibrani | Noto Sans Hebrew | 3.001 | 37 KB |
| Devanagari (Hindi, Marathi, Nepal) | Noto Sans Devanagari | 2.007 | 151 KB |
| Bengali | Noto Sans Bengali | 3.011 | 139 KB |
| Thai | Noto Sans Thai | 2.002 | 62 KB |
| Cyrillic | Noto Sans, huruf Cyrillic | 2.015 | 115 KB, condong 132 KB |
| Yunani | Noto Sans, huruf Yunani | 2.015 | 77 KB, condong 83 KB |
| Latin, termasuk huruf Vietnam dan huruf beraksen yang lain | Noto Sans, huruf Latin | 2.015 | 316 KB, condong 350 KB |
| Cina Ringkas, aksara GB 2312 | Noto Sans SC | 2.004 | 2.0 MB |
| Cina Tradisional, aksara Big5 | Noto Sans TC | 2.004 | 3.8 MB |
| Jepun, aksara Shift_JIS | Noto Sans JP | 2.004 | 2.2 MB |
| Korea, setiap suku kata Hangul dan aksara KS X 1001 | Noto Sans KR | 2.004 | 2.5 MB |

Paksi ketebalan setiap fon dikekalkan sepenuhnya, jadi setiap ketebalan yang diminta reka bentuk masih dilukis, dan tajuk Cina, Jepun atau Korea yang tebal kekal tebal. Paksi lebar fon Noto Sans ditetapkan pada normal, yang mengurangkan separuh saiz setiap fail; fon Cina, Jepun dan Korea tidak mempunyai paksi lebar. Noto Sans dipecahkan mengikut skrip, jadi perkataan Cyrillic hanya memuat turun huruf Cyrillic. Kontur ialah kontur asal hulu, tanpa perubahan.

Fon disimpan dalam satu folder dikongsi, `community/fallback-fonts`, dihidangkan kepada setiap sistem reka bentuk daripada `/catalog/packs/fallback-fonts/`, sama seperti set emoji dikongsi. `scripts/import-fallback-fonts.ts` membina fail daripada fon hulu yang dipinkan dalam `scripts/data/fallback-fonts.json`, menyemak setiap fail hulu berbanding SHA-256 yang direkodkan dan menulis teks lesen di sebelah fon.

## Cina, Jepun dan Korea

Satu fon Cina, Jepun atau Korea yang lengkap berukuran 9.6 MB hingga 17.8 MB, jadi setiap fon ini dipotong kepada set aksara kebangsaan yang digunakan pembacanya setiap hari, ditambah tanda baca, kana, bentuk lebar penuh dan simbol teks biasa:

- Cina Ringkas: GB 2312, 6,763 hanzi lazim dan simbolnya, 7,522 aksara kesemuanya.
- Cina Tradisional: Big5, 13,053 hanzinya dan simbolnya, 13,629 aksara kesemuanya. Hong Kong Supplementary Character Set tidak disertakan.
- Jepun: Shift_JIS seperti yang dibaca Windows dan web, iaitu JIS X 0208 dengan tambahan NEC dan IBM yang diperlukan oleh nama seperti 髙 dan 﨑, setiap kana dan katakana separuh lebar, 7,432 aksara kesemuanya.
- Korea: kesemua 11,172 suku kata Hangul dan KS X 1001, dengan 4,888 hanjanya, 17,082 aksara kesemuanya.

Huruf Latin, Yunani dan Cyrillic ditinggalkan daripada keempat-empat fon ini, kerana fon sistem reka bentuk dan fon di atas melukisnya. Set ini dibaca daripada fail indeks Encoding Standard pada komit yang dipinkan, jadi pembinaan semula memberikan fail yang sama.

Cina, Jepun dan Korea berkongsi kebanyakan aksara, tetapi setiap satu melukis banyak daripadanya dengan cara berbeza. Aksara 直 yang sama ditulis dengan satu cara dalam bahasa Cina dan cara lain dalam bahasa Jepun. Oleh itu satu larian teks mengambil semua aksara kongsiannya daripada satu fon ini sahaja, tidak pernah dua, dan Lolly memilih fon itu mengikut susunan ini:

1. Bahasa larian itu, daripada `lang` elemennya atau elemen terdekat di sekelilingnya dalam dokumen. Tetapan bahasa alat, seperti Language pada sijil, menetapkannya. Bahasa antara muka Lolly sendiri dan bahasa sistem reka bentuk tidak diambil kira, jadi dokumen dieksport sama untuk semua orang.
2. Skrip larian itu: kana bermaksud Jepun dan Hangul bermaksud Korea. Apabila larian itu sendiri tidak mempunyai kedua-duanya, seluruh dokumen dibaca, jadi tajuk kanji sahaja dalam dokumen Jepun dilukis dalam gaya Jepun. Dokumen yang mengandungi kedua-dua kana dan Hangul tidak menyelesaikan apa-apa di sini.
3. Aksara yang hanya digunakan oleh Cina Tradisional, seperti 體 atau 說, dalam larian itu atau jika tiada, dalam dokumen, bermaksud Cina Tradisional, kecuali teks yang sama turut mengandungi aksara yang hanya digunakan oleh Cina Ringkas.
4. Jika tidak, Cina Ringkas.

Aksara yang tiada pada fon terpilih tidak pernah diambil daripada tiga fon yang lain. Ia kekal sebagai gambar, seperti yang diterangkan di bawah. Kana atau Hangul yang tiada pada fon terpilih, seperti perkataan Korea dalam baris yang ditandakan sebagai Jepun, masih boleh datang daripada fon Jepun atau Korea, tetapi hanya apabila fon itu tidak akan melukis sebarang aksara kongsian baris itu.

Pada halaman, kanvas yang mengandungi dua bahasa ini menyenaraikan kedua-dua fon, dan pelayar melukis aksara kongsian dengan fon pertama. Eksport melukis setiap larian dengan fonnya sendiri.

## Bila fon dimuat turun

Tiada apa-apa dimuat turun sehingga dokumen mengandungi aksara yang tidak boleh dilukis oleh mana-mana fon sistem reka bentuknya. Dokumen dalam bahasa Inggeris, atau dalam mana-mana bahasa yang diliputi sistem reka bentuknya, tidak pernah memuat turun fon sandaran. Simbol dalam baris bahasa Inggeris, seperti ★ atau ※, tidak pernah memuat turun fon Cina, Jepun atau Korea.

Kali pertama dokumen memerlukannya, Lolly memuat turun satu fon itu, untuk satu skrip itu, dan menyimpannya pada peranti anda. Dokumen Jepun memuat turun fon Jepun sahaja, 2.2 MB, dan dokumen Cina Tradisional memuat turun fon Tradisional 3.8 MB. Selepas itu skrip itu dilukis tanpa talian, dan fon kekal apabila katalog dikemas. Fon disimpan bersama fail katalog sendiri, tidak pernah dalam fon yang anda muat naik, jadi ia tidak muncul dalam senarai fon jenama anda.

Baris perintah, apl terminal dan pelayan MCP membaca fail yang sama daripada cakera, jadi tiada muat turun diperlukan.

## Pada halaman dan dalam eksport

Halaman menggunakan fon sandaran yang sama dengan eksport. Tanpa ini, pelayar melukis huruf sedemikian dalam fon sistem manakala eksport menggunakan Noto, dan baris yang mengandunginya berubah lebar antara kedua-duanya. Lolly menambah fon sandaran pada hujung senarai fon sistem reka bentuk pada kanvas itu sahaja, selepas fon sistem reka bentuk sendiri dan sebelum sebarang fon sistem. Alat yang menetapkan senarai fonnya sendiri, dalam gayanya atau pada elemennya, mendapat fon sandaran di tempat yang sama: selepas fon yang diberikan senarai itu dan sebelum sebarang fon sistem. Kanvas yang diliputi sistem reka bentuk mengekalkan senarai fonnya seperti sebelum ini.

Halaman membiarkan senarai fon begitu sahaja apabila ia bermula dengan fon sistem, seperti `system-ui` atau Helvetica, kerana eksport melukis teks itu dengan fon sistem reka bentuk dan halaman tidak.

Dalam PDF perkataan menjadi kontur yang dilukis dengan fon sandaran, apa pun tetapan teks yang anda pilih, kerana teks PDF langsung tidak boleh membawa skrip yang tiada pada fon terbenam. Dalam SVG, EMF, EPS, DXF dan WMF ia menjadi kontur apabila teks ditukar kepada kontur; dengan teks dikekalkan langsung, fon pembaca sendiri melukisnya, seperti sebelum ini. Apabila fon sandaran melukis sebahagian eksport, panel eksport menunjukkan nota seperti:

> Teks Jepun dilukis dengan Noto Sans JP, kerana fon sistem reka bentuk ini tidak mempunyai huruf tersebut.

Baris perintah mencetak ayat yang sama sebagai nota.

## Apa yang kekal sebagai gambar

Aksara di luar keempat-empat set kebangsaan tidak mempunyai fon sandaran. Aksara jarang seperti 𠮷, aksara yang ditambah untuk Hong Kong oleh set tambahannya, dan skrip tanpa fon sandaran, seperti Tamil, Ethiopia atau Syriac, semuanya dilayan dengan cara yang sama. Dalam PDF baris yang mengandungi salah satunya dimasukkan sebagai gambar 300 dpi, dan panel eksport menyenaraikan skrip itu. Dalam SVG larian itu kekal sebagai teks langsung, yang dilukis oleh fon pembaca sendiri.

## Semakan sebelum anda mengeksport

Kad **Before you export** Lolly Design, dan semakan `render` bagi `lolly check`, melaporkan teks yang tiada fon boleh melukisnya. Ia mengira fon sandaran seperti yang dilakukan eksport, daripada senarai aksara yang sama bagi setiap fon, jadi teks yang dilukis oleh fon sandaran tidak dilaporkan. Skrip tanpa fon sandaran, seperti Tamil, dan aksara Cina, Jepun atau Korea di luar set kebangsaan tetap dilaporkan, kerana eksport melukisnya sebagai gambar atau sebagai teks langsung. Semakan membaca senarai itu daripada katalog dan tidak memuat turun sebarang fon.

## Lesen dan kredit

Setiap fon sandaran berada di bawah SIL Open Font License 1.1, dan setiap entri katalog merekodkan lesen itu dengan cincang teks lesen, jadi peraturan hak dalam [Creative rights and credits](/info/creative-rights.html) membaca lesen itu seperti lesen fon lain. Teks lesen berada di sebelah fon. Fail Noto Sans tidak mengisytiharkan Reserved Font Name. Fon Cina, Jepun dan Korea ialah milik Adobe, dan memelihara nama Source; fail yang dipotong mengekalkan nama Noto mereka, yang tidak menggunakan nama itu.

Lesen menyatakan bahawa syaratnya tidak terpakai pada dokumen yang dibuat dengan fon. Eksport hanya mengandungi kontur huruf yang digunakannya, seperti fon sistem reka bentuk sendiri, dan Lolly tidak menambah atur cara fon, baris kredit atau entri Content Credentials baharu untuk fon sandaran.
