# Bagaimana Lolly dibandingkan

Lolly ialah dua bahagian satu projek sumber terbuka. **Lolly** ialah enjin, apl dan alat untuk membuat, menyunting, menukar dan mengeksport pada peranti anda, tanpa akaun. **Lolly Work** ialah pelayan organisasi, dijalankan pada infrastruktur anda sendiri, untuk log masuk, projek dikongsi, kelulusan dan perenderan pelayan. Kedua-duanya MPL-2.0. Halaman ini membandingkan pasangan itu dengan cara lain orang mereka bentuk, mentadbir dan menghasilkan fail.

## Alat hari ini

Setiap cincin menskor betapa lengkap kelas produk menyampaikan keupayaan, dengan setiap kelas diskor pada wakilnya yang terbaik. Lajur Lolly meliputi Lolly dan Lolly Work bersama, dan setiap baris menyatakan bahagian mana menyediakan apa. Buka nama baris untuk alasan di sebalik skornya. Lajur disusun mengikut baris Overall completeness di bahagian atas: purata baris yang diskor, dengan baris perbelanjaan dikecualikan.

::: figure positioning-comparison
Perbandingan keupayaan: kajian pesaing dan skor Ogos 2026; liputan Lolly + Lolly Work disemak 28 September 2026. Pemarkahan: 0 tiada, 25 tahap penyelesaian sementara, 50 sebenar tetapi berpagar atau separa, 75 kuat dengan kaveat, 100 kecekapan teras.
:::

::: details Nota pemarkahan
Ciri yang tersedia dan kematangan pengeluaran adalah berasingan. Lolly telah dikeluarkan: versi 1.0 dihantar sebagai sumber terbuka pada 30 Ogos 2026, keselamatannya belum menjalani audit bebas dan bukti penerimaannya berusia beberapa bulan ([Adoption & Governance](/info/adoption-governance.html#status) mempunyai keadaan semasa). Mempunyai log masuk tunggal, kelulusan atau perenderan pelayan tidak mewujudkan rekod prestasi pengeluaran, jadi skor kematangan mencerminkannya. Skor pesaing mengekalkan semakan Ogos bertarikh mereka.

Satu peraturan mengawal papan. Markah penuh (100), pada baris yang menyentuh kandungan atau identiti anda, memerlukan keupayaan yang boleh anda gunakan tanpa akaun dan tanpa prasyarat awan; baris tentang produk itu sendiri, seperti kematangan dan kemudahan penggunaan, dikecualikan. Peraturan itu merugikan Adobe pada Content Credentials: pelaksanaan paling luas yang dihantar (Photoshop, Lightroom, Premiere, Firefly) menandatangani secara setempat dan dalam awan, tetapi tidak pernah tanpa akaun dan identiti Adobe, jadi 75. Ia menghadkan API perenderan pada penjanaan besar-besaran dan automasi atas sebab yang sama.

Canva diskor pada ahli keluarganya yang terbaik bagi setiap baris, kerana ia memiliki Affinity dan Cavalry (kedua-duanya diberikan percuma pada Oktober 2025). Perenderan luar talian dan pada peranti mendapat 75 melalui Affinity, suite desktop yang masih memerlukan akaun disahkan dan membawa telemetri, potongan yang turut diambil Adobe; mod luar talian Canva sendiri hanya menyunting reka bentuk yang disegerakkan lebih awal, pada satu peranti, untuk tetingkap terhad. Autofill mendapat 50: ia sebenar tetapi berpagar Enterprise dan tak segerak, dan ia hanya mengisi teks dan imej. Penjanaan besar-besaran Figma naik daripada 25 kepada 50 apabila Buzz menghantar isian hamparan (beta percuma, Ogos 2026).

Skor 75 Content Credentials Lolly meliputi penandatanganan pada peranti dan penandatanganan pelayan Lolly Work dengan identiti organisasi yang dikonfigurasi; pengesah masih mesti mempercayai penandatangan ([Content Credentials Identity](/info/content-credentials-identity.html)). 50 Penpot datang melalui pemalam eksport Lolly sendiri untuk Penpot: penandatanganan enjin yang sama, ikut serta dan didedahkan sebagai milik Lolly. Penpot mendapat 90 pada perenderan pada peranti: kanvas pelayar dengan sasaran simpan pada pelayannya, yang boleh dihos sendiri. Cloudinary mendapat lajurnya sendiri untuk pustaka aset, API transformasi dan CDN; semakan Ogos menskor penandatanganan penghantarannya pada 50.

Kolaborasi langsung Lolly termasuk collab peribadi dua peranti terus dan collab kerja disahkan melalui Lolly Work, dengan suntingan dikongsi, kursor dan sesi pasukan tersimpan. Skor Partial mencerminkan penempatan kerja nod tunggal semasa dan sejarah operasi yang pendek, bukan ketiadaan penyuntingan pasukan. Anggaran harga ialah aritmetik harga senarai bertarikh untuk skala, bukan perolehan.
:::

## Bila memilih Lolly

::: cols
## Pilih Lolly apabila

- Jenis fail yang sama diperlukan berulang kali: jubin acara, lencana, sijil, amaran, kad sosial
- Banyak fail datang daripada satu templat dan jadual nilai, dalam [Batch](/info/batch.html#make-many-versions-of-one-design) atau CLI
- Warna, tipografi dan aset mesti kekal dalam sistem reka bentuk, walaupun pada kanvas terbuka
- Reka bentuk Figma, Penpot, Illustrator, InDesign atau PDF yang siap harus menjadi boleh sunting dan boleh diulang ([Import a design](/info/design-import.html))
- Fail mesti dibuat pada peranti atau pelayan anda sendiri

## Pilih yang lain apabila

- Kerja itu ialah retouch foto atau ilustrasi terperinci
- Anda mereka bentuk dan membuat prototaip antara muka aplikasi
- Anda memerlukan stok besar dan pustaka templat sedia pada hari pertama
- Anda memerlukan perkhidmatan terurus dengan rekod prestasi panjang pada skala besar
:::

Reka bentuk yang diimport dan token reka bentuk dikongsi membolehkan pasukan menggabungkan Lolly dengan aplikasi pakar, manakala Lolly Work mentadbir aset dikongsi, semakan dan penghantaran.

Satu dek slaid penuh menunjukkan siling: dalam **Markdown Slides** dek diisytiharkan sebagai data, disusun secara langsung dan dieksport sebagai fail PowerPoint asli yang boleh disunting.

![Markdown Slides dalam paparan terbahagi: slaid dek disenaraikan sebagai blok di kiri, dek yang disusun dirender di kanan](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&dark=1&filename=ov2-deck-studio-output)

## Peraturan berada dalam alat

Lolly meletakkan peraturan jenama boleh guna semula dalam alat: warna, fon, jidar bleed, jarak dan input yang dibenarkan. Templat menetapkan bahagian yang tidak boleh diubah penerima. Lolly Work menambah akses kumpulan dan dasar input di sekeliling templat itu, dengan rantaian kelulusan untuk penyerahan katalog dan penghantaran.

Menyemak alat sekali memudahkan pengeluaran berulang, kerana setiap output mewarisi peraturan reka letaknya. Salinan, imej yang dimuat naik dan hak penggunaan masih mungkin perlu disemak, dan Lolly Work membekalkan katalog dikongsi dan langkah kelulusan untuk itu. Bagi pasukan kreatif alat ialah pagar pelindung: anda masih membawa data, salinan dan imej, dan alat memastikan setiap hasil selari dengan jenama.

![Seluruh tugas pengeluar: taip perkataan. Tipografi, warna dan jarak telah ditetapkan semasa alat dibuat](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DHello&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&filename=aud-rules-in-the-tool)

Tiga lagi perkara membezakan pendekatan ini:

- **Fail akhir, daripada input.** Input masuk, fail siap keluar, tanpa "sekarang simpan daripada alat reka bentuk anda dan baiki".
- **Alat menggubah alat.** Satu alat boleh membenamkan render alat lain dalam satu fail siap, tanpa gandingan kod antara keduanya.
- **Terbuka hingga ke dasar.** Enjin ialah sumber terbuka, dan alat, aset serta token reka bentuk ialah fail yang boleh anda simpan dalam kawalan versi atau urus dalam Lolly Work, bukan baris dalam pangkalan data orang lain.

Reka bentuk yang berani bertahan di dalam pagar pelindung. Peta bandar bertaraf poster ini ialah laluan jalan dan air vektor sebenar, daripada satu senarai juntai bawah dan dua medan warna yang tidak boleh ditunjuk ke luar sistem reka bentuk:

![Cincin terusan dan rangkaian jalan Amsterdam dilukis hujung ke hujung dalam dakwat sistem reka bentuk sendiri, setiap lejang diletakkan oleh templat dan bukan dengan tangan](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam%26theme%3Dlight%26full&width=1440&height=900&dpi=96&waitMs=3200&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-street-map-poster)

## Berinovasi secara kebarangkalian, berskala secara deterministik

Kebanyakan penyampaian "kreatif AI" meletakkan model di sebelah yang salah pada garis lama. Jurutulis dan pengiluminasi telah menentukan di mana ia jatuh. Anda bekerja bebas pada lakaran, di mana apa-apa boleh dicuba dan tiada apa-apa dikomit. Kemudian anda pergi ke mesin cetak, yang mengomit. Lakaran ialah tempat seni berada, dan mesin cetak ialah cara ia berpindah, dan karya cetak boleh dipercayai kerana mesin cetak memegang janjinya pada setiap tarikan.

Lolly ialah mesin cetak. Bawa apa sahaja yang anda suka kepada idea, model, pereka atau lukisan kasar, tetapi sebaik sahaja idea perlu menjadi banyak fail ia melalui sesuatu yang merender dengan cara sama setiap kali, daripada input yang boleh dibaca semula oleh sesiapa. Perbandingan di atas sebenarnya tentang siapa yang menjadikan langkah komit itu boleh diulang.

> Percayai proses kreatif, skala dengan ketelitian.

## Percuma selama-lamanya

**Jika ia dirender pada peranti anda, ia percuma selama-lamanya.** Enjin, shell, alat dan format ialah sumber terbuka, dan versi yang dikeluarkan tidak boleh ditarik balik. Lolly Work juga sumber terbuka. Organisasi membayar untuk infrastruktur dan operasi yang dipilihnya, tanpa caj lesen perisian bagi setiap tempat duduk atau setiap render untuk hos sendiri. [Questions & answers](/info/faq.html) menceritakan kisah di sebalik janji itu.

## Di mana kandungan anda berada

Kerja kreatif Lolly boleh berjalan pada perkakasan yang anda miliki, dan token reka bentuk, fon, logo dan alatnya ialah fail yang boleh anda simpan. Dengan Lolly Work, projek dikongsi, aset, dasar dan rekod audit berada dalam storan yang dikonfigurasi organisasi anda. [Trust](/info/trust.html) menerangkan mengapa itu penting, dan [Privacy Policy](/info/privacy.html) serta [Verify It Yourself](/info/verify-yourself.html) membolehkan anda menyemak dakwaan dan bukan mempercayai kata kami.

## Alat demi alat

[Lolly compared, tool by tool](/info/compare.html) membandingkan Lolly dengan Canva, Adobe, Figma, Penpot, portal jenama, API perenderan dan penukar dalam talian, satu halaman setiap satu, dan menyatakan [what runs where](/info/compare.html#what-runs-where).
