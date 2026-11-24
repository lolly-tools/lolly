# Ask Lolly

Ask Lolly menjawab soalan dengan bahagian panduan ini yang sepadan, dipetik kata demi kata, dengan rujukan halaman dan pautan **Open in docs** ke bahagian itu. Tiada apa yang dijana: jawapan ditemui dan dipetik pada peranti anda.

Di bawah bahagian yang dipetik terdapat tempat dalam apl yang sepadan dengan soalan: alat, utiliti, projek tersimpan, aset katalog, tetapan atau halaman apl. Setiap baris hanya menavigasi. Tiada apa dalam jawapan mengubah tetapan, membuka fail atau bertindak bagi pihak anda, peraturan yang sama seperti [Lolly Search](/info/search.html).

<!--i:eti-chat-->
## Bertanya soalan

Taip dalam medan soalan di bahagian bawah paparan dan tekan Enter. Apa-apa yang lebih pendek daripada dua aksara diabaikan. Jawapan disusun di atas medan, yang terbaharu di penghujung.

![Ask Lolly, terbuka dan kosong: medan soalan di bahagian bawah paparan, dengan nota bahawa jawapan datang daripada dokumentasi](/t/url-shot?url=%2F%23%2Fask&width=1200&height=820&waitMs=2200&format=svg&walker=1&filename=ask-view)

::: note Setiap soalan berdiri sendiri
Soalan terdahulu tidak membawa konteks ke hadapan, jadi "bagaimana pula dengan PDF?" selepas soalan tentang eksport dibaca sebagai soalan tentang PDF sahaja. Tanya soalan penuh setiap kali.
:::

Perkataan pertama soalan anda menentukan apa yang mendahului jawapan:

| Anda bermula dengan | Apa yang mendahului |
|---|---|
| *where*, *find*, *open*, *show*, *go to*, *goto*, *take*, *jump*, *navigate*, *switch* | tempat dalam apl yang sepadan |
| *make*, *create*, *generate*, *build*, *design*, *convert*, *resize*, *compress*, *remove*, *strip*, *export*, *render*, *add* | alat yang sepadan |
| apa-apa yang lain - termasuk *how do I* dan *what is* | bahagian dokumentasi, yang merupakan lalai |

Kedua-dua bahagian sentiasa diambil, jadi soalan yang tersalah tafsir hanya menyusun semula jawapan.

Pemadanan menggugurkan perkataan soalan lazim (*how*, *do*, *I*, *the*, *my*). Ia menyusun kedudukan bahagian mengikut berapa banyak perkataan anda yang lain diliputinya, kemudian mengikut tempat perkataan itu sepadan: tajuk diberi lebih berat berbanding teks isi. Pemadanan menggunakan subrentetan, mengabaikan huruf besar atau kecil dan aksen, jadi kesilapan taip tidak dibetulkan. Apabila tiada padanan, Ask menyatakannya dan mengarahkan anda ke indeks dokumentasi.

**Better matching** ialah pilihan. Selepas jawapan pertama anda, Ask boleh menawarkan model pemadanan kecil, dengan saiz muat turunnya. Model itu memadankan soalan dengan panduan yang menggunakan perkataan berbeza untuk perkara yang sama. Ia dimuat turun hanya apabila anda bersetuju, berjalan pada peranti ini dan hanya mengubah bahagian yang menduduki tempat teratas. Jawapan masih menggunakan perkataan dokumentasi itu sendiri. Anda juga boleh memuat turunnya sebagai **Ask matching model** di bawah **Settings → Preferences → Available offline** ([Tersedia luar talian](/info/dashboard.html#available-offline)).

<!--i:eti-clipboard-->
## Apa yang dikembalikan

Kad jawapan mempunyai susunan tetap:

1. **Bahagian itu sendiri**, dirender daripada sumber dokumentasi: perenggan, senarai, jadual, kod dan petikan, dengan pautan dalam apl dan `/info` aktif. Bahagian yang panjang berakhir dengan **Show more**, yang membuka selebihnya di tempat yang sama. Imej digugurkan, dan pautan ke tapak lain ditunjukkan sebagai teks biasa.
2. **Rujukan** - *Halaman › Tajuk* - dan pautan **Open in docs** ke bahagian tepat itu.
3. **More in the docs** - sehingga empat bahagian lain yang sepadan, sebagai pautan.
4. **Baris dalam apl**, di bawah tajuk kumpulan yang sama yang digunakan Search.

Teks penuh datang daripada salinan markdown yang diterbitkan oleh setiap halaman dokumentasi di `/info/<slug>.md`. Salinan itu hanya dalam bahasa Inggeris. Dalam bahasa lain, dan pada beberapa halaman yang tidak dibina daripada markdown, jawapan sebaliknya menunjukkan petikan pendek daripada indeks carian. Rujukan dan pautan **Open in docs** masih menuju ke halaman dalam bahasa anda.

<!--i:eti-map-pin-->
## Tempatnya

Laluannya ialah `#/ask`. Ia tiada tab dan tiada jubin dalam grid Utilities. Anda mencapai paparan itu daripada bar carian atau melalui alamatnya.

- <!--i:search--> **Daripada carian.** Setiap panel hasil berakhir dengan baris **Ask Lolly: *pertanyaan anda***, di bawah hasil kumpulan lain. Baris itu membuka `#/ask?q=…`, dan paparan itu bertanya soalan sekali apabila dibuka. Perkataan tiba dalam huruf kecil tanpa tanda baca, jadi perhalus perkataan itu dalam medan soalan jika perlu.
- <!--i:link--> **Daripada pautan.** `#/ask?q=how%20do%20I%20export%20a%20transparent%20png` membuka paparan dengan soalan itu sudah ditanya. Fragmen hash hanya menetapkan soalan pertama. Soalan yang anda taip selepas itu dijawab di tempat yang sama dan tidak pernah mengubah alamat.

Bar carian bersembunyi dalam paparan ini kerana medan soalan menggunakan Enter. Pil kembali membawa anda ke tempat asal.

Jawapan kekal untuk sesi ini: ia masih ada jika anda keluar dan kembali, dan muat semula mengosongkannya. Tiada apa ditulis ke storan, jadi tiada sejarah untuk diurus.

<!--i:eti-download-->
## Luar talian

Jawapan datang daripada dua fail statik yang diterbitkan oleh tapak dokumentasi: indeks carian setiap bahasa dan salinan markdown halaman itu. Kedua-duanya diambil mengikut nama, jadi Ask berfungsi tanpa sambungan setelah fail itu dicache. Membaca panduan dalam apl mencache panduan itu. **Guides & docs** di bawah [Tersedia luar talian](/info/dashboard.html#available-offline) mengambil seluruh tapak, termasuk tangkapan skrin, dalam satu muat turun.

Tanpa fail ini, bahagian dokumentasi jawapan tidak muncul, dan tiada ralat ditunjukkan. Baris dalam apl masih muncul, kerana ia dipadankan dengan data yang sudah ada pada peranti.

<!--i:eti-lock-->
## Privasi

Soalan anda tidak pernah meninggalkan peranti. Pemadanan berjalan secara setempat terhadap fail yang diambil mengikut nama, jadi apa yang anda taip bukan sebahagian daripada sebarang permintaan. Tiada pelayan melihat soalan anda, tiada akaun memilikinya dan tiada rekod kekal selepas anda memuat semula. [Dasar Privasi](/info/privacy.html) menyenaraikan semua yang diambil atau dihantar oleh apl.

---

**Berkaitan:** [Lolly Search](/info/search.html) untuk bar yang menyerahkan soalan. [Menggunakan Lolly](/info/using.html) untuk bahagian apl yang lain. [Tetapan Lolly](/info/dashboard.html#available-offline) untuk memuat turun dokumentasi bagi kegunaan luar talian terlebih dahulu.
