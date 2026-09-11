# Bagaimana Lolly dibandingkan

Apa yang dilakukan Lolly yang tidak dilakukan alat kreatif masa kini, dan apa yang sengaja diserahkannya kepada mereka.

Untuk versi per alat, satu halaman masing-masing untuk Canva, Adobe, Figma, API rendering dan konverter online, lihat [Lolly dibandingkan, alat demi alat](/info/compare.html). Setiap halaman menyatakan apa yang dilakukan alat lain dengan lebih baik dan apa yang dilakukan Lolly sebagai gantinya.

> **Status pilot:** Lolly adalah prototipe pilot tertutup, bukan produk jadi, dan keamanannya saat ini sedang menjalani pengerasan infrastruktur ketat SUSE, mempersiapkan skala enterprise. Halaman [Adoption & Governance](/info/adoption-governance.html#status) membahas kondisi saat ini.

## Alat masa kini

Setiap cincin di bawah ini menilai seberapa lengkap sebuah kelas produk memberikan sebuah kapabilitas **sebagaimana dirilis hari ini** - bukan sebagaimana dipasarkan - dengan setiap kelas dinilai berdasarkan perwakilan terbaiknya. Lolly dinilai dengan pisau yang sama: ia mendapat satu-satunya cincin merah di papan ini, untuk kematangan. Buka nama baris untuk melihat alasan di balik skornya. Kolom diurutkan berdasarkan baris Overall completeness di atas - rata-rata dari baris yang dinilai, dengan baris biaya dikecualikan.

::: figure positioning-comparison
Kelengkapan kapabilitas di antara alat kreatif hari ini, diteliti Agustus 2026. Penilaian: 0 tidak ada, 25 tingkat akal-akalan, 50 nyata tetapi terbatas atau parsial, 75 kuat dengan catatan, 100 kompetensi inti.
:::

**Catatan penilaian.** Skor Lolly mengasumsikan klaim yang dipublikasikannya berlaku, itulah sebabnya kematangan adalah satu-satunya cincin merahnya: pilot tertutup, pengerasan keamanan sedang berlangsung, belum ada yang diaudit. Riset menggeser beberapa sel.

Canva dinilai berdasarkan anggota keluarga terbaiknya per baris, karena ia memiliki Affinity dan Cavalry (keduanya digratiskan Oktober 2025). Rendering offline dan on-device mendapat skor 75 melalui Affinity - suite desktop yang masih memerlukan akun terverifikasi dan membawa telemetri, pengurangan yang juga diambil Adobe - sementara mode offline Canva sendiri hanya mengedit desain yang sudah disinkronkan sebelumnya, satu perangkat, jendela terbatas. Autofill mendapat skor 50: nyata tetapi dibatasi Enterprise, asinkron, hanya teks dan gambar. Mass generation Figma naik dari 25 ke 50 saat Buzz merilis pengisian spreadsheet (beta gratis, Agustus 2026).

Satu aturan mengatur papan ini: skor Penuh (100), pada baris yang menyentuh konten atau identitas Anda, memerlukan kapabilitas yang bisa Anda gunakan tanpa akun dan tanpa prasyarat cloud; baris yang menggambarkan produk itu sendiri (kematangan, kemudahan pakai) dikecualikan. Ini membebani Adobe pada provenans: C2PA paling luas yang dirilis (Photoshop, Lightroom, Premiere, Firefly) menandatangani secara lokal maupun di cloud, tetapi tidak pernah tanpa akun dan identitas Adobe, sehingga 75. Aturan ini juga membatasi API rendering pada mass generation dan otomasi dengan alasan yang sama.

Skor provenans 75 Lolly mencerminkan penandatanganan offline on-device: secara arsitektural lebih kuat tetapi belum diaudit, dan kunci perangkat terbaca sebagai tidak terverifikasi di validator standar sampai sebuah identitas atau CA milik organisasi memvalidasinya. Skor 50 Penpot diperoleh lewat plugin resmi Lolly Export: engine penandatanganan yang sama, opt-in, diungkapkan sebagai milik Lolly sendiri. Penpot juga mendapat satu-satunya cincin di luar skala pada papan ini, 90 pada rendering on-device - kanvas browser, simpan ke cloud sovereign Anda sendiri (bahkan laptop), ekspor privat; hanya lompatan ke server yang memisahkannya dari Lolly. Cloudinary mendapat kolomnya sendiri: sebuah pipeline media (DAM, API transformasi, CDN), dan satu-satunya kolom cloud yang merilis C2PA (50, karena fl_c2pa menandatangani saat pengiriman, mengesahkan delivered-by-Cloudinary, bukan made-by-you).

Kolaborasi langsung berjalan sebaliknya: Figma menetapkan tolok ukur skala (200 editor) dan P2P berpasangan air-gapped milik Lolly mendapat skor Parsial. Harga adalah perkiraan, dilabeli demikian: aritmetika harga daftar pada campuran seat yang realistis, sengaja dibuat lebar, untuk skala bukan pengadaan. API rendering mendapat 75 pada constraints: template terkunci, tanpa lapisan tata kelola brand.

Celahnya: tidak ada yang dirilis hari ini yang mengutamakan constraints dan bekerja offline tanpa akun dan tanpa server di jalur render, dan belum ada yang meniru klausul akun ini. Lolly kini merilis kanvas terbukanya sendiri - **Design**, sebuah kanvas bebas dengan manipulasi langsung - tetapi warna, tipe dan aset di dalamnya tetap tunduk pada global brand, sehingga bahkan penataan bebas tetap mengutamakan constraints.

Apa yang **belum** menjadi Lolly adalah suite desain tanpa batasan; para desainer akan terus menggunakan Illustrator dan Figma untuk karya bespoke - dan ketika karya itu perlu menjadi aset yang diatur dan dapat direproduksi, [Import a design](/info/design-import.html) milik alat Design membawa berkas Figma, Penpot, Illustrator, InDesign atau PDF yang sudah jadi ke atas kanvas sebagai kotak yang dapat diedit dan sesuai brand.

![Kanvas bebas Design, tempat warna, huruf dan aset yang ditawarkan adalah milik brand itu sendiri](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3D__blank__&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&dark=1&filename=aud-open-canvas)

## Gunakan untuk

- Pembuatan cepat aset kreatif yang dioperasionalkan (tile acara, lencana, tanda tangan, peringatan)
- Penataan bebas di kanvas terbuka (Design) ketika elemen-elemennya - warna, tipe, ikon, gambar - harus tetap sesuai dengan global brand
- Mendaratkan desain Figma, Penpot, Illustrator, InDesign atau PDF yang sudah jadi (Import a design milik alat Design) sehingga dapat diedit, diatur dan di-render ulang secara deterministik dalam setiap format Lolly
- Alur "isi tiga kolom, dapatkan aset jadi" satu-ke-banyak - termasuk proses massal dari spreadsheet/CSV di grid batch `/pro` (tempel atau impor baris, satu aset jadi per baris, unduh sebagai zip)
- Output bermerek yang selalu aktif dan berulang
- Hal-hal di mana kontrol terpusat atas ekspresi brand lebih penting daripada fleksibilitas ekspresif

Deck Studio adalah tolok ukur yang baik untuk batas atas di sini: satu set slide deck utuh dideklarasikan sebagai data, ditata langsung di kanvas dan diekspor sebagai PowerPoint asli yang dapat diedit.

![Deck Studio dalam tampilan terpisah - slide deck terdaftar sebagai blok di sebelah kiri, deck yang sudah ditata dirender di sebelah kanan](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&dark=1&filename=ov2-deck-studio-output)

## Jangan gunakan untuk

- Konten hero bespoke atau unggulan (billboard, video besar)
- Karya kampanye unik yang sungguh membutuhkan seorang desainer
- Ideasi yang perlu lepas sepenuhnya dari sistem brand - kanvas terbuka Lolly tetap menyesuaikan warna, tipe dan aset dengan global brand, dan itulah intinya

## Berinovasi secara probabilistik, berskala secara deterministik

Sebagian besar pitch "AI kreatif" menempatkan model di sisi yang salah dari sebuah garis lama. Para penyalin naskah dan pelukis iluminasi sudah lebih dulu menetapkan di mana garis itu jatuh: Anda bekerja bebas di atas sketsa, tempat apa pun bisa dicoba dan tidak ada yang terikat, lalu Anda pergi ke mesin cetak, yang terasa menakutkan justru karena ia mengikat. Sketsa adalah tempat seninya berada. Mesin cetak adalah caranya bepergian. Dua instrumen, dua tugas, masing-masing inventif dengan caranya sendiri, dan karya cetak bisa dipercaya karena mesin cetak menepati janjinya pada setiap kali cetak.

Lolly adalah mesin cetak, bukan sketsa. Bawa apa pun yang Anda suka ke tahap ideasi - sebuah model, seorang desainer, secarik kertas - tetapi begitu sebuah ide harus menjadi sepuluh ribu aset, ide itu melewati sesuatu yang me-render dengan cara yang sama setiap kali, dari input yang bisa dibaca ulang oleh siapa pun. Itulah inti sebenarnya dari perbandingan di atas: bukan siapa yang punya generator lebih baik, tetapi siapa yang membuat langkah yang terikat itu dapat direproduksi.

> Percayai proses kreatif, berskala dengan kedisiplinan.

## Setujui alat, bukan filenya

Setiap alat lain di papan menghasilkan *file* yang kemudian harus diperiksa - manajer merek dalam thread Slack, tim legal untuk disclaimer, satu putaran perubahan, satu tinjauan lagi. Lolly memindahkan persetujuan **satu langkah ke hulu**. Aturan merek - kode hex yang tepat, file font berlisensi, margin bleed, spasi - dikodekan langsung ke dalam HTML dan CSS alat tersebut, sehingga template *tidak dapat* menghasilkan aset yang menyimpang dari merek. Tata letak itu sendiri yang menegakkannya.

Jadi Anda berhenti menyetujui output dan mulai menyetujui **alat** yang membuatnya. Setujui sekali, dan setiap aset yang pernah dihasilkannya sudah disetujui sejak dari konstruksinya - tanpa manusia dalam alur, tanpa siklus tinjauan, pada volume berapa pun.

Inilah perubahan yang sebenarnya dihadirkan oleh mesin deterministik: ini bukan versi yang lebih cepat dari proses persetujuan lama, ini menghilangkan prosesnya. Bagi tim kreatif ini adalah pagar pengaman, bukan pengganti - Anda tetap yang melempar bola (data, teks, gambar) dan kode adalah jalur bumper yang menjaga setiap lemparan tidak keluar dari jalur.

![Seluruh pekerjaan produser: ketik kata-katanya. Jenis huruf, warna, dan spasi sudah ditetapkan saat alat disetujui](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DApproved&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-approve-the-tool)

| Menyetujui aset dengan cara lama | Menyetujui alat, cara Lolly |
|---|---|
| Setiap file jadi diperiksa, satu per satu | Alat diperiksa sekali |
| Permintaan → desainer membuat → tinjauan merek → pemeriksaan legal → perubahan → tinjauan ulang | Satu perubahan parameter → aset jadi |
| Desainer, manajer merek, legal, dan pemohon semuanya dalam alur | Produser, sendirian |
| Berhari-hari per aset | Beberapa detik per aset |
| 10.000 aset = 10.000 siklus tinjauan | 10.000 aset = nol (template sudah disetujui) |

## Apa yang secara unik disediakan ini

- **Potensi desain liar yang dihadirkan secara aman dalam konteks.** Alat dapat mengekspresikan ide desain yang berani di dalam pagar pengaman yang telah dikodekan langsung.

- **Otomasi konten yang ditentukan perangkat lunak dan mengembalikan aset akhir.** Input → file akhir. Tidak ada "sekarang simpan dari alat desain Anda dan olah lebih lanjut."
- **Alat menyusun alat lain.** Satu alat dapat menyematkan hasil render alat lain dan mengembalikannya sebagai bagian dari satu aset jadi, tanpa keterikatan kode antar-alat - sebuah primitif yang tidak ditawarkan oleh produk open-canvas atau DAM-templating mana pun di papan.
- **Netralitas vendor.** Kontrol penuh atas fitur dan biaya. Mesin open-source. Alat dan aset adalah konten yang dilacak git, bukan terkunci dalam basis data SaaS.

Yang pertama dari semua itu adalah yang paling diremehkan orang. Peta kota bermutu poster, digambar sebagai jalur jalan dan air vektor sejati, dari satu dropdown dan dua bidang warna yang tidak bisa diarahkan keluar dari merek:

![Cincin kanal dan jaringan jalan Amsterdam digambar dari tepi ke tepi dengan tinta merek itu sendiri, setiap goresan ditempatkan oleh template, bukan oleh tangan](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam%26theme%3Dlight%26full&width=1440&height=900&dpi=96&waitMs=3200&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-street-map-poster)

## Kedaulatan konten

Ada nama untuk apa yang dijumlahkan oleh bagian sebelumnya: kedaulatan. Alur media Anda berjalan di perangkat keras milik Anda sendiri. Merek Anda - token, font, logo, alat yang menegakkannya - tersimpan dalam file yang Anda pegang, dalam kontrol versi yang Anda kendalikan, bukan dalam basis data vendor dengan tombol ekspor. Rendering terjadi di perangkat yang ada di depan Anda, sehingga sebuah aset tidak pernah harus melewati pihak ketiga untuk ada, dan seluruh jalur dari input hingga file jadi bersifat open source dan dapat diperiksa. Jika setiap vendor desain SaaS lenyap besok, deployment Lolly tidak akan terpengaruh.

Ini penting bagi siapa pun yang pekerjaannya harus bertahan lebih lama dari sebuah langganan: orang tua yang buku fotonya hidup di laptop itu, sama seperti badan publik yang pustaka mereknya tunduk pada aturan pengadaan. Bagi organisasi - badan publik, industri yang diatur, siapa pun yang mereknya adalah aset strategis, bukan sekadar hiasan - "di mana konten kami berada dan siapa yang bisa mematikannya" adalah pertanyaan tata kelola, bukan preferensi. Kedaulatan di sini adalah sifat dari arsitekturnya, bukan fitur hosting yang ditambahkan demi kepatuhan, dan halaman [Kebijakan Privasi](/info/privacy.html) dan [Verifikasi Sendiri](/info/verify-yourself.html) ada agar Anda bisa memeriksa klaim itu, bukan sekadar mempercayainya.

Di balik semuanya ada satu janji, dinyatakan sebagai komitmen, bukan fitur: **jika itu dirender di perangkat Anda, itu gratis selamanya.** Mesin, shell, alat, format - seluruh jalur kreatif di perangkat bersifat open source dan akan tetap begitu. Janji itu punya mekanisme: versi yang telah dirilis diberi lisensi sedemikian rupa sehingga tidak bisa ditarik kembali, dan tidak ada perjanjian kontributor yang bisa melisensikan ulang karya itu di kemudian hari. Seluruh batasannya muat dalam satu kalimat: segala sesuatu yang dirender di perangkat Anda gratis dan open source, selamanya; mengoordinasikan orang dan mesin lintas jaringan adalah tugas bidang kontrol terpisah, [lolly.work](https://lolly.work).
