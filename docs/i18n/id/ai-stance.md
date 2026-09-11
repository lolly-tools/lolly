# Sikap kami terhadap AI

Lolly dibangun di tengah perubahan terbesar dalam cara media dibuat sejak mesin cetak, oleh orang-orang yang tidak panik terhadap AI dan juga tidak terlalu bersemangat karenanya. Halaman ini menyatakan posisi proyek secara terus terang dan memasangkan setiap klaim dengan mekanisme yang menegakkannya, sehingga Anda bisa memverifikasi, bukan sekadar mempercayai.

> "Kita minum seolah keran akan kering sebentar lagi. Itu tidak akan terjadi - AI hari ini adalah yang terburuk yang akan pernah ada. Jika kita selamat dari banjir ini, itu bukan karena menimbun apa yang ada di tangki air berkarat di kaki bukit, penuh endapan. Itu akan terjadi karena kita mengairi dan merebut kembali tanah ***kita*** untuk masa depan yang makmur."
>
> - Andy Fitzsimon, Lolly Contributor

![Badai supersel pecah di atas sebuah rumah peternakan di pedalaman - tangki dan gudang di bawahnya, air banjir sudah memotong saluran melalui padang rumput kering](/info/the-flood.webp)

%file{Gemini_Generated_Image_vmy7thvmy7thvmy7.png} %entity{Gemini} membuat gambar %sig{ditandatangani oleh %entity{Google LLC}} %entity{Lolly} %act{opened}, %act{resized} dan %act{mengekspor ke WebP} sebagai %file{the-flood.webp} %detail{10.6 MB turun menjadi 0.8 MB} %sig{ditandatangani oleh %entity{Lolly}} [Verifikasi sekarang](/#/verify?src=%2Finfo%2Fthe-flood.webp)

Agar tepat, karena halaman ini berargumen bahwa presisi itu penting: gambar di atas dihasilkan, bukan difoto. Tidak ada kamera yang diarahkan ke rumah peternakan itu, karena rumah peternakan itu tidak ada. Gambar ini menggambarkan wilayah Queensland, Australia, diminta dari Britania Raya, dihasilkan di sebuah pusat data di Amerika Serikat. Ia berusaha setia pada sebuah tempat tanpa menjadi catatan tempat itu, dan perbedaan itulah seluruh alasan mengapa Content Credentials-nya menyatakan demikian.

Inilah tampilannya saat Anda memeriksanya. Sembilan langkah tersimpan dalam file: lima dicatat oleh Google saat menghasilkan dan memberi watermark pada gambar, lalu empat dicatat oleh Lolly saat membuka, membuat, menandai, dan mengonversi versi di halaman ini. Lolly tidak menghasilkan apa pun, dan entrinya menyatakan demikian.

![Riwayat perubahan yang dibaca kembali oleh Lolly dari file jadi - lima langkah dicatat oleh Google, lalu empat oleh Lolly, berakhir pada WebP di halaman ini](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

Metafora Andy tentang banjir adalah ini: sikap kelangkaan terhadap AI - menaruh segalanya pada segelintir pihak, mengecilkan diri sendiri hari ini dan mengkhawatirkannya nanti - sama seperti minum air tangki yang sudah busuk sementara hujan mulai turun dan air banjir berlari melintasi dataran menuju Anda. Konten yang dihasilkan hampir menjadi tak terbatas secara efektif. Ketika sesuatu menjadi tak terbatas, nilainya berpindah ke apa pun yang tetap langka di sekitarnya: kepercayaan, provenans, koherensi merek, dan penilaian manusia. Lolly bukan ember yang lebih besar untuk menampung banjir. Ia adalah irigasi - saluran yang mengarahkan air, dan tanah tempat sesuatu benar-benar tumbuh.

## Sikap ini, dalam lima komitmen

- <!--i:layers--> **AI diterima sebagai input, tidak pernah sebagai penyamaran.** Agent adalah pengguna kelas satu Lolly: mereka menjalankan alat yang sama seperti yang dijalankan manusia, melalui [MCP server](/info/mcp.html) dan [URL mode](/info/url-mode.html), di dalam batasan yang persis sama. Sebuah alat yang tidak bisa menghasilkan aset off-brand untuk seseorang juga tidak bisa menghasilkannya untuk sebuah agent - guard-rail tidak peduli siapa yang melempar bolanya. Yang tidak boleh dilakukan agent mana pun adalah menyamarkan outputnya sebagai sesuatu yang bukan dirinya.
- <!--i:shieldcheck--> **AI mendeklarasikan dirinya sendiri.** Ketika AI menghasilkan piksel-pikselnya, hasil ekspor menyatakannya: sebuah pernyataan yang dapat dibaca mesin dalam Content Credentials milik file dan sebuah badge GEN AI yang terlihat saat siapa pun memverifikasinya. Lolly juga membaca dan menampilkan deklarasi AI dari file yang dibuat di tempat lain, dan menandai kapan sebuah watermark SynthID kemungkinan besar ada - membaca deklarasinya, bukan watermark-nya sendiri. Aturan yang sama mengikat rewriter on-device milik Lolly sendiri: tiap kalimat yang ditulisnya membawa watermark statistik publik dalam pilihan katanya, diungkapkan di sini dan di alatnya, sehingga teks yang ditulis sebuah model tetap mendeklarasikan dirinya sendiri bahkan sebagai salinan plain-text - dan siapa pun bisa memeriksanya di halaman [Verify](/info/verify-yourself.html). Skema ini publik sejak dari desain: verifikasi untuk semua orang, rahasia untuk tidak seorang pun. Audiens berhak tahu bagaimana media dibuat - kalimat itu muncul di halaman [Inclusive Design](/info/inclusive-design.html) kami sebagai sebuah komitmen etis, dan inilah yang membuatnya nyata. Dan ketika media yang telah Anda deklarasikan sebagai buatan AI ditempatkan ke dalam sebuah desain, kredensial hasil ekspornya sendiri juga menyatakannya: sebuah tanda origin komposit dan sebuah disclosure AI yang ditandatangani serta dapat dibaca mesin.
- <!--i:check--> **Provenance aktif secara default.** Hasil ekspor membawa [Content Credentials](/info/content-credentials-identity.html) secara default, bukan sebagai pengaturan tersembunyi. Rantainya mencakup edit dan bahan, jadi riwayat sebuah karya ikut berjalan bersamanya. Anda dapat [memverifikasi ini sendiri](/info/verify-yourself.html) pada file mana pun yang dihasilkan Lolly.
- <!--i:people--> **Manusia tetap menjadi penulisnya.** Setiap input pada akhirnya adalah sebuah keputusan, dipicu di suatu tempat oleh seseorang, tidak peduli berapa banyak sistem atau belokan yang dilaluinya untuk sampai ke sini. Sebuah agent bisa membawa sebuah keputusan jauh sekali. Ia tidak bisa memulainya. Kata-kata, gambar, palet, keputusan yang memerlukan penilaian: alat memperbesar skala penilaian itu, bukan menggantikannya. Bagian yang membosankanlah yang diotomatisasi: pemeriksaan brand, pengeksporan ulang di tiap ukuran, lokalisasi manual. Yang tersisa adalah kepenulisan.
- <!--i:globe--> **Saluran, bukan ember.** Model hari ini adalah lantai, bukan langit-langit, jadi kami menolak membangun apa pun yang nilainya bergantung pada menimbun akses ke model-model itu. Engine ini open source, merender di perangkat Anda sendiri dan bekerja secara offline. Tidak ada model moat, tidak ada meteran penggunaan, tidak ada bisnis kelangkaan yang melekat pada banjir itu sendiri. Investasi yang tahan lama adalah infrastruktur di sekitar air itu - dan infrastruktur itulah yang kami berikan secara cuma-cuma.

## Keputusan manusia adalah intinya

Mari kita perjelas sepenuhnya apa yang mendasari setiap komitmen di atas.

Individu membentuk bumi dan sejarah kita. Pilihan mereka, dibuat satu per satu, menjadi dunia tempat kita semua hidup. Tindakan merekalah yang mewujudkannya. Itu bukan sentimen, itu hanyalah bagaimana segala sesuatu selama ini terjadi.

Karena itu kami memberdayakan keputusan manusia dan tidak mengorbankannya. Hak untuk memilih. Agensi. Otonomi. Kemampuan untuk memutuskan dan bertindak, dan agar tindakan itu menjadi milik Anda.

Alat di sini memperbesar skala apa yang diputuskan seseorang. Alat tidak memutuskan menggantikan mereka, dan tidak pernah diam-diam menggantikan posisi mereka. Ketika sebuah keputusan dibawa oleh otomasi, catatannya tetap mengarah kembali ke orang yang memicunya, seberapa banyak pun sistem dan belokan yang dilaluinya di sepanjang jalan.

Kami menghormati hal itu dari ujung ke ujung, dan kami mencatatnya: untuk sejarah, untuk akuntabilitas, untuk kepercayaan, dan untuk masa depan.

## AI, sesuai ketentuan Anda

Anda tidak pernah wajib menggunakan AI di sini. Jika Anda memilihnya, tiga hal ini berlaku:

- <!--i:people--> **Anda yang mengendalikan.** AI membantu hanya saat Anda memintanya, dan hanya pada bagian yang Anda tunjuk. Tidak ada yang diputuskan untuk Anda.
- <!--i:check--> **Biayanya berhenti.** Jika AI membantu membuat sesuatu sekali, hasilnya milik Anda. Menggunakannya lagi gratis, berapa kali pun Anda membutuhkannya.
- <!--i:shieldcheck--> **Tetap jujur.** Sebuah bagian yang dibuat oleh AI menyatakan demikian, dan apa yang Anda buat membawa nama Anda, bukan berpura-pura menjadi orang lain. Bahkan bantuan bawaan bekerja dengan cara ini: [Tanya Lolly](/info/ask.html) menjawab dengan kalimat asli dari manual dan sebuah tautan, tidak pernah jawaban karangan.

## Apa yang bukan ini

- <!--i:check--> **Bukan larangan.** Alat boleh menggunakan AI di mana itu bermanfaat bagi pekerjaan, dan agen adalah audiens yang didukung - lihat [Agen AI](/info/ai-agents.html).
- <!--i:seal--> **Bukan klaim kemurnian.** Lolly membaca provenans secara luas dan menuliskannya dengan jujur; ia tidak berpura-pura dapat mendeteksi setiap piksel yang dihasilkan di internet.
- <!--i:sunburst--> **Bukan kepanikan moral.** Banjir bukanlah musuhnya. Air yang tidak diketahui asalnya, itulah musuhnya.

## Cara memastikan kami menepatinya

Setiap komitmen di atas ditegakkan dalam basis kode terbuka, bukan dalam PDF kebijakan: jalur provenans, pelabelan GEN AI, dan jaminan bebas pelacak semuanya dirilis lengkap dengan pengujian, dan halaman [Verifikasi Sendiri](/info/verify-yourself.html) memandu Anda memeriksa klaim tersebut terhadap ekspor sungguhan. Jika Anda menemukan tempat di mana kode dan halaman ini tidak sesuai, maka kodenyalah yang bug.
