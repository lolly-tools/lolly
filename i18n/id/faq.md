# FAQ

Pertanyaan yang sering diajukan, ditampilkan dalam akordeon di halaman utama `/info`.

**Cara merawat:** setiap judul `##` di bawah ini adalah sebuah pertanyaan; semua yang ada di bawahnya
(sampai `##` berikutnya) adalah jawabannya. Jawaban memakai markdown ringan yang sama dengan
bagian lain situs ini - pisahkan paragraf dengan satu baris kosong. Tambah, hapus atau
susun ulang pertanyaan di sini lalu jalankan ulang `npm run build:info` (atau `npm run dev:web`).
Semua yang berada di atas `##` pertama (judul ini dan catatan ini) diabaikan oleh proses build.

## Apa yang terjadi ketika saya memilih opt-in di halaman /profile?

Saat pertama kali memakai Lolly, semua yang Anda ketik di mana pun bersifat sepenuhnya privat sampai Anda sengaja ingin informasi itu keluar lewat media atau tautan berbagi (jika daring).

Bila opt-in dipilih, detail profil yang Anda pilih disegel ke dalam karya yang Anda buat, menyebut Anda sebagai sumbernya. Tidak ada yang disertakan tanpa Anda pilih sendiri.

Lolly menghasilkan konten dalam jumlah besar. Kami menerapkan pendekatan minimalisasi data yang ketat untuk mencegah risiko.

## Apakah Lolly "vibe coded"?

Lolly dikembangkan dengan coding berbantuan AI, penemuan berbantuan AI dan, di banyak bagian, konten berbantuan AI, menggunakan berbagai model dan vendor, termasuk dari perusahaan cloud publik terdepan.

Hingga tulisan ini dibuat, Lolly tidak memiliki kerentanan keamanan yang diketahui dalam rantai pasokannya, dan berkomitmen pada praktik respons keamanan yang cepat saat CVE muncul.

Seorang manusia menciptakan arsitekturnya, mengkurasi kodenya dengan sengaja dan mengarahkan seni pengalamannya.

Yang terpenting, Lolly berdiri di atas bahu puluhan tahun inovasi open source dari para pakar sejati di seluruh dunia.

Ada build-gate deterministik dalam basis kode Lolly untuk menjaga kode dan dokumentasi tetap koheren bagi pembaca rata-rata dan "membersihkan slop" dari pengalamannya. Ini mungkin mempersulit enumerasi sintetis proprietary atas asal-usulnya. Itu tidak disengaja.

**Pengungkapan AI generatif:**

- **Kode yang ditulis LLM:** Opus 4.8, Gemini 3.1, Qwen3-Coder-Next (daftar ini dapat bertambah)
- **Penemuan LLM:** Gemini 3.1, Fable
- **Dokumentasi:** Sonnet 5
- **Pustaka open source:** penulis masing-masing, dinyatakan dalam SBOM, komentar dan header file

Daftar ini tidak mencakup model yang di-vendor-kan ke dalam Lolly.

**Kontribusi manusia:**

- **Arsitektur:** Andy Fitzsimon
- **Arahan seni:** Andy Fitzsimon
- **Kode yang ditulis manusia:** Andy Fitzsimon
- **Ideasi, ulasan dan umpan balik:** Ravan Naidoo, Matthias Eckermann, Kelly Andrews, Ryan Kleeman, Peter Chamalian, Komunitas Penpot (daftar ini tidak lengkap)

## Apa itu feature flag?

Feature flag menyalakan atau mematikan bagian-bagian Lolly. Biasanya administrator yang mengendalikannya - di Lolly, Anda yang memegang kendali.

![Setiap feature flag adalah sakelar milik Anda sendiri, berada di profil Anda alih-alih di konsol administrator](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dfeature-flags&width=1440&height=1800&dpi=192&waitMs=2000&format=svg&cropSelector=%23feature-flags-section&walker=1&dark=1&filename=pd-feature-flags)

## Bagaimana cara mendapatkan aplikasi seluler atau desktopnya?

Siapa pun bisa mendistribusikan aplikasinya sendiri, dan alat serta konfigurasi aplikasi itu semestinya sangat beragam tergantung audiens yang dituju. Jadi tidak ada satu aplikasi tunggal kecuali Anda yang membuatnya atau seseorang yang relevan memberikannya kepada Anda.

## Mengapa namanya "Lolly Tools"?

**Lolly** karena kebebasan itu manis, dan karena di Australia, Selandia Baru dan Inggris, lolly berarti permen.

**Tools** karena sebuah alat diam saja sampai Anda mengambilnya. Alat tidak berjalan saat tidak Anda pakai, dan tidak mengawasi Anda saat Anda memakainya.

## Hambatan apa yang mungkin muncul saat mengadopsi Lolly?

Lolly menyatu di mana pun Anda sudah membuat file - CLI memakai engine yang sama
dengan aplikasinya, sehingga pipeline yang berjalan pukul 2 dini hari tidak bisa melenceng dari yang dilihat orang di
peramban. Hambatan adopsi jarang bersifat teknis; hambatannya organisasional. Bersiaplah untuk hal-hal ini:

**Katalog merek yang terkurasi harus disusun.** Lolly adalah platform, bukan
paket template Anda yang sudah jadi. Untuk *peluncuran yang terkelola*, seseorang mendefinisikan katalog
aset bersama (logo, palet, font sebagai ID permanen) dan menulis manifest +
template untuk setiap jenis keluaran. Namun perorangan tidak perlu menunggu itu - di
aplikasi terbuka, siapa pun bisa memasukkan file miliknya sendiri ke katalog dan membangun alat di
Design sejak hari pertama.

**Tidak perlu git untuk berkontribusi.** Desainer membuat alat dan template mereka sendiri
di dalam aplikasi, lalu membagikannya ke rekan kerja atau mengirimkannya kepada pemilik
deployment agar disertakan secara bawaan.

**Cakupannya memang sengaja sempit - posisikan seperti itu.** Lolly bukan untuk konten
khusus atau konten hero. Lolly *adalah* DAM pribadi Anda - dihidupkan dan diperkuat oleh design
system, alat dan katalog Anda - dan Lolly *memang* punya kanvas terbuka (Design), tetapi
di sana pun warna, tipografi dan aset tetap mengikuti design global yang aktif, sehingga penyusunan
bebas tetap berada di dalam sistem. Diukur dengan Figma atau Canva, Lolly akan
terlihat terbatas. Diukur sebagai dirinya sendiri - pembuatan aset yang dioperasionalkan, berulang dan
berskala besar - tidak ada tandingannya. Pembingkaian yang keliru adalah hambatan yang paling sering terjadi.

**Manajemen perubahan di sisi produksi.** Proses yang ada sekarang tetap berjalan, sekalipun
hasilnya tidak sesuai merek. Mengarahkannya ulang ke engine berarti pengujian ulang dan pembelajaran ulang,
dan "kami sudah bisa membuat file" menjadi alasan untuk tidak bermigrasi. Mulailah dengan mengonversi
satu keluaran berkualitas produksi yang paling terlihat lalu tunjukkan sebelum/sesudahnya berdampingan.

Lolly mengangkat semuanya.


## Apa yang membedakan utilitas dari alat?

**Jawaban Singkat →** Utilitas tidak selalu perlu merender sehingga bisa mendapat UX yang berbeda. 

**Jawaban Sebenarnya →** Alasan utilitas bisa di-host di dalam Lolly Tools adalah untuk menambah satu lagi 'lapisan kenyamanan' sebagai pertahanan agar orang tidak terdorong mengirim data ke luar. 

Mengapa? Karena sudah diketahui bahwa setiap hari orang mengambil **konten rahasia yang sudah mereka miliki** lalu menyerahkannya ke
situs web sembarangan hanya untuk satu operasi mekanis kecil:

- "**Kompres PDF ini**" → mengunggah kontrak / slip gaji / materi rapat direksi ke pihak yang tidak dikenal.
- "**ubah HEIC ke JPG**" → mengunggah foto pribadi (lengkap dengan GPS EXIF) ke host yang dibiayai iklan
- "**potong / ubah ukuran gambar ini**" → mengunggah tangkapan layar produk atau aset yang belum dirilis
- "**rapikan JSON ini**" / "decode JWT ini" → menempelkan respons API, token, rahasia ke sebuah formatter
- "**gabungkan PDF ini**" → mengunggah **dua dokumen yang seharusnya tidak pernah berada di server yang sama**

Situs-situs ini beserta kloningannya yang tak terhitung banyaknya **tidak layak dipercaya secara bawaan**, dengan
masa penyimpanan yang tidak jelas, yurisdiksi yang tidak jelas, subprosesor yang tidak jelas dan model bisnis iklan/afiliasi
yang punya segala insentif untuk menyimpan apa yang Anda berikan. Operasinya
sepele; **kontennyalah harganya.** 

Kami memenangkan pertarungan tata kelola dengan kenyamanan dan layanan yang unggul. 

![Tampilan Utilitas mengumpulkan pekerjaan mekanis yang biasanya diserahkan orang ke situs web sembarangan, semuanya kini berjalan di dalam Lolly](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## Bisakah Lolly mengedit dan merender file Figma, Penpot, Illustrator atau InDesign saya?

Ya. Buka **Design** lalu klik **Import a design**: ia menerima **.fig** asli dari Figma (Save local copy), ekspor **.penpot** dari Penpot, **.ai** atau **.pdf** dari Illustrator, **.idml** dari InDesign (File → Export → InDesign Markup) atau **SVG apa pun** (pintu terlebarnya - hampir semua aplikasi desain bisa mengekspornya). Tidak perlu akun, tidak perlu plugin dan tidak perlu lisensi aplikasi desain.

![Design's open canvas - Import a design sits in the toolbar's Lolly menu](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17VVRa9swEP41ekyQLrbjPOyhVeeOrSsbG3lXbLkYZCnISmn264tO9irFhdJCoZQIpBNn9N2dvu_k3cOX1opeEuCTpeNkG0BDy8ljZe28pyDA74UlUC4WOyt0sxgOthW1JJAD9wv1y6rFQWCDMB6BAK-NdqLTBLg2thcqeAnk68vaKGOXg-yFdl29dPLBef8VAZ6V_qjUTloCvO-aRvlcc0QdhB58iCWDMVNnD1iSUIOcAvASY2qsEUeex-XSOEJ6koaT_6Q1iY89IY4mw4TCmmJYc9BNZKPQ00ywxxJS-BlqcnL2KfJF3xhZf3WdwwsMd8xZ4VEgEF6EGornaH-ByW_iHkVAj-aAtpcO7Y1R6kggX1Uz7ext1wt7PNEOk7BZ7UbtYCpKtj4NZ_YE-Doh_hOwHnff-1K_M83xlPmyiJhn8AbmL5C61nZSN8g00OlFoK2xkyjCRofOBro3g5N2OdPE2PqxIGjL1iCCIPA1SPSQpQ_B6qyIVyiCsp8s-_Gn2P76fpHfVlt6WV3_Lv5e5_6mul7cSVRFhiWhOIrsaaVTMbKZaUWNbQ-VMncGN__b_fwn-CAKeAQ&width=1360&height=850&dpi=192&waitMs=3000&format=png&localize=1&dark=1&filename=design)

Layer masuk sebagai kotak yang bisa diedit di kanvas terbuka: teks tetap bisa diketik ulang, bentuk tetap menjadi bentuk, gambar bergabung ke pustaka gambar Anda sendiri, serta tipografi dan warna mengikuti brand global. Simpan, dan tata letaknya menjadi template yang bisa dipakai ulang, dialamatkan lewat URL dan diisi ulang oleh siapa pun yang punya Lolly - dan Anda bisa menyisipkan alat langsung (kode QR, bagan) yang dirender ulang saat dimuat. Setelah itu ia dirender seperti apa pun di Lolly - SVG, PDF, PNG dan lainnya, bisa direproduksi dari URL-nya. Lihat [Import a design](/info/design-import.html).

## Bisakah saya membagikan karya sebagai file, bukan tautan?

Ya. Ketika sebuah tautan tidak bisa membawa semuanya (foto milik Anda, teks panjang), dialog Share menyebutkan persis apa yang akan hilang dan menawarkan file **.lolly** sebagai gantinya: satu file yang memuat desainnya, gambar yang dipakainya dan, jika Anda mau, alatnya sekaligus. Anda yang menentukan seberapa banyak yang ikut terbawa - nama dan detail Anda hanya masuk jika profil Anda mengaktifkan opt-in, karya berlisensi ditahan kecuali Anda menyertakannya, dan siapa pun yang membuka file berisi alat akan ditanya apakah ia memercayai alat itu sebelum alat itu bisa berjalan. Lihat [Berbagi karya Anda](/info/using.html#sharing-your-work).

## Bisakah dua orang mengerjakan desain yang sama tanpa internet?

Ya. Satu orang membagikan undangan (tautan, kode QR atau kode pendek), yang lain menerimanya, dan kedua perangkat memegang sesi yang sama secara langsung - lengkap dengan tanda kehadiran, cincin fokus dan sebagainya. Ini berjalan di jaringan bersama mana pun, termasuk hotspot ponsel di ruang bawah tanah, karena tidak ada server di tengahnya. Lihat [Bekerja bersama](/info/collaborate.html).

## Ke mana perginya alat-alat bermerek SUSE?

Semuanya sudah berada di repositori privat yang terpisah. Klon publik sama sekali tidak mengambil brand pack SUSE, sehingga build publik menjalankan profil netral `lolly-start` - alat komunitas yang tidak terikat merek ditambah merek kosong yang Anda isi dengan merek Anda sendiri. SUSE menjalankan instansnya sendiri untuk melindungi merek dagangnya.

## Mengapa gratis? Apa jebakannya?

**Kami membuat Lolly untuk diri kami sendiri.** SUSE butuh ribuan file yang sesuai merek, masing-masing dengan namanya tersegel di dalamnya, dibuat tanpa menyerahkan apa pun ke layanan luar. Jadi kami membuat alat yang mengerjakan semuanya di perangkat, dan merilisnya sebagai open source, seperti semua hal lain yang kami buat. Kami terus merawatnya karena kami memakainya setiap hari. **Tidak ada kewajiban apa pun:** semua yang ada di sini berjalan dengan atau tanpa kami.

Batas itu ditarik di dalam lisensinya, bukan di dalam sebuah janji: apa pun yang berjalan secara lokal gratis, selamanya. Versi yang sudah dirilis dilisensikan sedemikian rupa sehingga tidak bisa ditarik kembali, dan tidak ada perjanjian kontributor yang bisa melisensikan ulang karya siapa pun. Lihat [pemosisian](/info/positioning.html) untuk pernyataan lengkapnya.

## Seberapa banyak yang disimpan SUSE secara privat? (alias kapan kami ditinggal di tengah jalan)

Engine, shell, skema dan alat yang tidak terikat merek bersifat open source; merek dagang SUSE dan alat bermereknya adalah bagian yang tetap privat, dan keduanya sudah dipisahkan. Instans publik di [lolly.tools](https://lolly.tools) berjalan pada merek kosong.

Batasnya bersifat struktural, bukan sekadar dijanjikan. Setiap versi yang dirilis bersifat open source dan tidak bisa ditarik dari peredaran, tidak ada perjanjian kontributor yang bisa melisensikan ulang karya siapa pun, dan satu-satunya yang ditahan adalah merek dagangnya. Ketika perusahaan lain menutup sumber Linux enterprise-nya pada 2023, SUSE ikut mendirikan [OpenELA](https://openela.org) agar kode itu tetap terbuka - sikap yang sama yang diwarisi proyek ini.

Keterbukaan penuh: SUSE *memang* sedang membangun perkakas internal untuk mengintegrasikan Lolly ke dalam sistem TI-nya - itu soal penyiapan internal SUSE, bukan soal pengembangan publik vs. privat. Lolly juga ditargetkan dibangun melalui [Open Build Service](https://openbuildservice.org/), dengan artefak rantai pasok yang aman dikirimkan oleh [SUSE Application Collection](https://apps.rancher.io/applications).

## Rasa apa logo Lolly itu?

Ada yang bilang Jeruk Nipis, ada yang bilang Mint dan kadang Apel, Lolly membawa manisnya, Anda yang mewujudkan rasanya!
