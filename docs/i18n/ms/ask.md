# Ask Lolly

Taip soalan dan Ask Lolly menjawab dengan bahagian panduan ini yang meliputinya, perkataan demi perkataan, dengan halaman asalnya dipetik dan pautan **Open in docs** terus ke bahagian itu. Tiada apa-apa dijana: jawapan diambil, dipetik dan diatribusikan, pada peranti anda.

Di bawah bahagian yang dipetik terdapat tempat dalam apl yang sepadan dengan soalan yang sama: alat, utiliti, projek tersimpan, aset katalog, tetapan atau halaman apl. Setiap baris hanya menavigasi. Tiada apa-apa dalam jawapan mengubah tetapan, membuka fail atau bertindak untuk anda, peraturan yang sama yang diikuti [Search](/info/search.html).

## Mengemukakan soalan

Taip dalam medan soalan di kaki paparan dan tekan Enter. Apa-apa yang lebih pendek daripada dua aksara diabaikan. Jawapan bertindan di atas medan, yang terbaharu terakhir, dan anda boleh terus bertanya.

![Ask Lolly, terbuka dan kosong: medan soalan di kaki paparan, dengan nota bahawa jawapan datang daripada dokumen](/t/url-shot?url=%2F%23%2Fask&width=1200&height=820&waitMs=2200&format=svg&walker=1&filename=ask-view)

Setiap soalan dijawab sendiri: soalan terdahulu tidak membawa konteks ke hadapan, jadi "what about PDF?" selepas soalan tentang eksport dibaca sebagai soalan tentang PDF dan tiada yang lain. Tanyakan keseluruhan soalan setiap kali.

Perkataan pertama soalan anda menentukan apa yang mendahului jawapan:

| Anda bermula dengan | Apa yang mendahului |
|---|---|
| *where*, *find*, *open*, *show*, *go to*, *goto*, *take*, *jump*, *navigate*, *switch* | tempat dalam apl yang sepadan |
| *make*, *create*, *generate*, *build*, *design*, *convert*, *resize*, *compress*, *remove*, *strip*, *export*, *render*, *add* | alat yang sepadan |
| apa-apa lagi - termasuk *how do I* dan *what is* | bahagian dokumentasi, iaitu lalai |

Kedua-dua bahagian sentiasa diambil, jadi soalan yang tersalah baca menyusun semula jawapan dan bukan kehilangan separuh daripada jawapan.

Pemadanan menggugurkan perkataan soalan biasa (*how*, *do*, *I*, *the*, *my*) dan menyusun bahagian mengikut berapa banyak perkataan anda yang tinggal diliputinya, kemudian mengikut di mana ia sepadan: tajuk lebih bernilai daripada teks badan. Pemadanan adalah mengikut subrentetan, dilipat untuk huruf besar dan aksen, jadi salah taip tidak dibetulkan. Apabila tiada yang sepadan, Ask menyatakannya dan menunjuk ke indeks dokumentasi dan bukan mereka jawapan.

**Better matching** adalah pilihan. Selepas jawapan pertama anda, Ask boleh menawarkan model pemadanan kecil, dengan saiz muat turunnya, yang membantu memadankan soalan dengan panduan yang menggunakan perkataan berbeza untuk perkara yang sama. Ia dimuat turun hanya apabila anda bersetuju, berjalan pada peranti ini dan hanya mengubah bahagian mana yang disusun dahulu: jawapan masih perkataan dokumentasi sendiri. Anda juga boleh memuat turunnya daripada **Settings → Preferences → Available offline**, di mana ia disenaraikan sebagai **Ask matching model** ([Available offline](/info/dashboard.html#available-offline)).

## Apa yang dikembalikan

Kad jawapan dihimpunkan mengikut susunan tetap:

1. **Bahagian itu sendiri**, dirender daripada sumber dokumentasi - perenggan, senarai, jadual, kod dan petikan, dengan pautan dalam apl dan `/info` yang aktif. Bahagian panjang dihadkan dengan **Show more** yang membukanya di tempat. Imej digugurkan, dan pautan keluar ke tapak lain dirender sebagai teks biasa dan bukan sauh.
2. **Petikan** - *Halaman › Tajuk* - dan pautan **Open in docs** ke bahagian tepat itu.
3. **More in the docs** - sehingga empat bahagian lain yang sepadan, sebagai pautan.
4. **Baris dalam apl**, di bawah tajuk kumpulan yang sama seperti yang digunakan Search.

Teks penuh datang daripada kembar markdown biasa yang diterbitkan setiap halaman dokumentasi di `/info/<slug>.md`, dan kembar itu hanya dalam bahasa Inggeris. Dalam bahasa lain - dan pada beberapa halaman yang tidak dibina daripada markdown - jawapan kembali kepada petikan ringkas yang dipegang dalam indeks carian dan bukan keseluruhan bahagian. Petikan dan pautan **Open in docs** ada dalam kedua-dua keadaan, menunjuk ke halaman dalam bahasa anda sendiri.

## Di mana ia berada

Laluannya ialah `#/ask`. Ia tiada tab dan tiada jubin dalam grid Utilities; jalan masuknya ialah bar carian dan alamat itu sendiri.

- <!--i:search--> **Daripada carian.** Setiap panel hasil membawa baris **Ask Lolly: *your query*** di bahagian paling bawah, di bawah apa sahaja hasil konkrit yang ditemui kumpulan lain. Ia menyerahkan soalan sebagai `#/ask?q=…`, dan paparan bertanya soalan sekali semasa tiba. Perkataan yang diserahkan tiba dalam huruf kecil dengan tanda baca digugurkan, jadi haluskannya dalam medan soalan jika perlu.
- <!--i:link--> **Daripada pautan.** `#/ask?q=how%20do%20I%20export%20a%20transparent%20png` membuka paparan dengan soalan itu sudah ditanya. Hash hanyalah benih kemasukan: soalan yang anda taip selepas itu dijawab di tempat dan tidak pernah menulis semula alamat.

Bar carian beralih ke tepi dalam paparan ini, kerana medan soalan mengambil Enter, dan pil kembali membawa anda ke mana sahaja anda datang.

Jawapan pada skrin bertahan untuk sesi ini: ia masih ada jika anda menavigasi pergi dan kembali, dan muat semula mengosongkannya. Tiada apa-apa ditulis ke storan, jadi tiada sejarah untuk diurus.

## Luar talian

Jawapan dihimpunkan daripada dua fail statik yang sudah diterbitkan tapak dokumentasi: indeks carian bagi setiap bahasa dan kembar markdown halaman. Kedua-duanya diambil mengikut nama, jadi Ask terus berfungsi tanpa sambungan setelah ia dicache. Membaca panduan dalam apl mencache ia semasa anda pergi, dan **Guides & docs** di bawah [Available offline](/info/dashboard.html#available-offline) mengambil seluruh tapak, termasuk tangkapan skrin, dalam satu muat turun.

Tanpanya, separuh dokumentasi jawapan tidak muncul, tanpa ralat. Baris dalam apl masih muncul, kerana ia dipadankan dengan data yang sudah ada pada peranti.

## Privasi

Soalan anda tidak pernah meninggalkan peranti. Pemadanan berjalan secara setempat terhadap fail yang diambil mengikut nama, jadi apa yang anda taip bukan sebahagian daripada sebarang permintaan; tiada pelayan yang melihatnya, tiada akaun yang dikaitkan dengannya dan tiada rekod selepas anda memuat semula. Lihat [Privacy Policy](/info/privacy.html) untuk senarai lengkap apa yang pernah diambil atau dihantar oleh apl.

---

**Berkaitan:** [Search](/info/search.html) untuk bar yang menyerahkan soalan. [Using Lolly](/info/using.html) untuk selebihnya apl. [Settings](/info/dashboard.html#available-offline) untuk membawa dokumentasi luar talian dahulu.
