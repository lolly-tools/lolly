# Menggunakan Lolly

Panduan praktis untuk benar-benar *menggunakan* aplikasinya - membuka tool, mengolah kanvas, mengekspor, menyimpan dan membagikan. Semua yang ada di sini berjalan **di perangkat Anda**: tanpa akun, tanpa unggahan, tanpa internet setelah pemuatan pertama.

> Baru di sini? [Mulai Cepat](/info/quickstart.html) membuat Anda berkarya dalam hitungan menit, dan [Lolly untuk Operator](/info/operators.html) membahas pemasangan/penerapan aplikasi; halaman ini tentang mengoperasikannya setelah terbuka.

## Membuka tool

Layar utama adalah **galeri** - semua tool, dikelompokkan menurut kategori. Klik sebuah kartu untuk membuka tool-nya; jika Anda pernah mengerjakannya, tombol **Continue** melanjutkan sesi terakhir Anda. Gunakan kotak pencarian untuk menyaring berdasarkan nama - atau [Cari](/info/search.html) dari bilah di kaki enam layar daftar (galeri, Utilities, Projects, Catalogue, Dashboard dan Profile), yang menjangkau karya tersimpan, katalog dan pengaturan Anda selain tool. Di dalam sebuah tool, bilah itu menyingkir untuk memberi tempat pada antarmuka tool tersebut.

![Galeri tool - setiap tool sebagai kartu, dikelompokkan menurut kategori](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&localize=1&dark=1&filename=gallery&try=1)

Setiap tool berupa tampilan terbagi: **kontrol** di satu sisi, **pratinjau** langsung (kanvas) di sisi lain. Ubah kontrol mana pun dan pratinjaunya langsung diperbarui.

![Split view sebuah alat - tumpukan kontrol di kiri, dan bar chart live berkelompok yang digambarnya di kanan](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26t%3DExample%2520data%26st%3DSample%2520values%252C%2520not%2520a%2520real%2520dataset%26d%3DMonth%252CSeries%2520A%252CSeries%2520B%252CSeries%2520C%250AJan%252C12%252C9%252C5%250AFeb%252C18%252C14%252C7%250AMar%252C24%252C17%252C11%250AApr%252C29%252C23%252C15%26lg%3D1&width=1440&height=900&dpi=192&waitMs=2500&walker=1&format=svg&dark=1&filename=vt-tool-split-view)

> Beberapa tool (seperti **Design**) justru terbuka sebagai **kanvas bebas** - permukaan tanpa panel yang dimanipulasi langsung tempat Anda menyeret, mengubah ukuran, memutar dan mengaitkan kotak teks, bentuk dan gambar, serta klik ganda untuk menyunting teks di tempat. Ekspornya melewati jalur render yang sama dengan tool lain, jadi kanvas itu *adalah* berkasnya. Lihat [Kanvas bebas](#the-free-canvas-design) di bawah.

Dua cara membentuk kisi itu sendiri menjadi kisi yang Anda inginkan:

- <!--i:star--> **Bintangi yang Anda pakai.** Beri ★ pada sebuah kartu dan kartu itu mendapat ubin besar tersendiri di strip atas kisi - lihat [Favorit Anda](/info/favourites.html).
- <!--i:eyeoff--> **Sembunyikan tool yang tak pernah Anda pakai.** Klik kanan sebuah kartu (atau pilih beberapa lalu gunakan bilah seleksi) → **Hide tool**. Kartu itu keluar dari kisi, dan dari hasil pengetikan di kisi; ubin abu-abu **Show hidden tools (N)** di ujung paling akhir menampilkannya kembali dalam keadaan redup, masing-masing dengan **Unhide tool** di menunya sendiri. Menyembunyikan hanya soal kisi Anda - tool-nya tetap terbuka dari tautan tersimpan atau bookmark, dan tetap berada di tempatnya bagi orang lain.

![Ujung kisi Tools dengan tool tersembunyi ditampilkan: kartu QR Code Generator yang redup, dan di sebelahnya ubin abu-abu yang mengembalikannya ke tampilan, kini bertuliskan Hide hidden tools](/t/url-shot?url=%2F%23%2F&width=1440&height=680&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-bulk%3D%22hide%22%5D%3Bwait%3A300%3Bclick%3A.gtile--hiddenbox%3Bpress%3AEnd%3Bwait%3A800&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&rasterDpi=96&dark=1&filename=misc-hidden-tools)
<!--
SHOT NOTE (misc-hidden-tools): the trailing `press:End` is required. The
hidden box and the revealed cards live at the very END of the grid, and
clicking the box runs applyView(), which re-lays the grid out and drops the
scroll back to the top - so without it the frame published the TOP of the
gallery under a caption about its bottom. `press:` with no `on=` goes to the
keyboard, and the End key with focus on the just-clicked box scrolls the
document; the walker then anchors the body walk to that band.
The tile reads "HIDE hidden tools" in the shot, not "Show" - it is a toggle and
the recipe has just pressed it. The alt says so rather than quoting the resting
label the prose above already gives.
There is no standalone per-card "hide" button
(unlike the always-visible fav/pin corner icons) - Hide only exists inside a
tile's right-click menu or the bulk bar, both confirmed in views/gallery.ts.
The recipe goes the bulk-bar route since it needs no `|right` context-menu
step: tick the card (`[data-select="qr-code"]`, the same checkbox hook the
selection bullet under Projects uses), click the bar's Hide button
(`[data-bulk="hide"]` - the literal `data-bulk` value bulkBarHtml() writes,
confirmed in lib/bulk-bar.ts), then click the grey reveal tile
(`.gtile--hiddenbox`, confirmed in gallery.ts).
-->

### Ask Lolly

Ketika Anda lebih suka bertanya daripada mencari, **Ask Lolly** (`#/ask`) menerima pertanyaan yang Anda ketik dan mengembalikan bagian dokumentasi ini yang cocok secara **verbatim** - kata-kata panduannya sendiri, bukan ringkasan dan bukan hasil generasi - lengkap dengan sebutan halaman asalnya dan tautan **Open in docs** di sebelahnya. Di bawah jawaban itu ada tempat-tempat di aplikasi yang cocok dengan pertanyaan yang sama: sebuah tool, sebuah pengaturan, sebuah proyek tersimpan, masing-masing sebagai tombol yang langsung membawa Anda ke sana.

Transkripnya adalah memori sesi: ajukan pertanyaan lanjutan dan utasnya bertambah seiring jalan, lalu muat ulang dan semuanya dimulai dari awal. Hasil pencarian memuat baris **Ask Lolly: *kueri Anda*** di bagian bawah - di bawah hasil konkret apa pun yang ditemukan kelompok lain - yang meneruskan pertanyaan itu langsung, sehingga Anda bisa mulai di bilah pencarian dan menyelesaikannya di sini.

## Kanvas (pratinjau)

Pratinjau selalu menampilkan persis apa yang akan diekspor.

**Desktop**

- **Zoom:** Cmd/Ctrl-gulir, atau cubit di trackpad - zoom berpusat pada penunjuk Anda.
- **Geser:** tahan **Space** lalu seret, atau seret dengan **tombol tengah mouse**. (Klik biasa tetap bebas untuk mengeklik bagian desain.)
- **Papan ketik:** `0` = paskan ke jendela · `1` = 100% · `+` / `−` = zoom.
- **HUD zoom:** kontrol kecil `−  NN%  +  Fit` di sudut. Klik persentasenya untuk beralih Fit ↔ 100%.

![HUD zoom di sudut kanvas - minus, persentase langsung, plus, Fit, lalu sakelar tema dan suara](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=.stage-nav%7Bopacity%3A1!important%7D&cropSelector=.stage-nav&walker=1&format=svg&dark=1&filename=use-zoom-hud)

**Sentuh**

- **Cubit** untuk zoom, **seret** untuk menggeser, **ketuk dua kali** untuk kembali ke ukuran pas.

**Klik untuk melompat ke sebuah kontrol:** klik elemen mana pun di desain dan input sidebar yang sesuai akan mendapat fokus lalu tergulir ke tampilan - untuk grup baris berulang, baris yang tepat Anda klik akan terbuka, jadi menyunting apa yang Anda lihat hanya sejauh satu ketukan.

Perubahan dimensi selalu mengembalikan tampilan ke ukuran pas yang rapi.

### Kanvas bebas (Design)

Tool kanvas bebas menambahkan area kerja *di sekeliling* artboard, seperti meja kerja seorang desainer:

- **Penampungan di luar kanvas.** Seret sebuah kotak melewati tepi bingkai dan kotak itu tetap sepenuhnya **terlihat dan bisa dipilih** - parkir elemen di samping sementara Anda menata komposisi, lalu seret kembali ke dalam. Semua yang di luar bingkai **diredupkan perlahan** sehingga area ekspor selalu terbaca sekilas, dan bingkai mempertahankan bayangannya untuk menandai persis di mana berkas dimulai.
- **Hanya bingkai yang diekspor.** Berkas hasil ekspor dibatasi oleh artboard - apa pun yang tertinggal di luar (atau bagian kotak yang menjulur melewati tepi) langsung dipangkas dari keluaran, baik pada format raster maupun vektor.
- **Perkecil melampaui Fit** (hingga 20%) untuk melihat seluruh meja kerja ketika Anda menampung banyak hal jauh di luar bingkai.
- **Artboard yang bisa diubah ukurannya.** Mengubah dimensi ekspor mengubah ukuran bingkai di tempat; kotak-kotak mempertahankan posisinya, jadi Anda bisa membingkai ulang tata letak di sekitar konten yang sudah ada.

![Design's free canvas - the artboard with its surrounding pasteboard](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17VVRa9swEP41ekyQLrbjPOyhVeeOrSsbG3lXbLkYZCnISmn264tO9irFhdJCoZQIpBNn9N2dvu_k3cOX1opeEuCTpeNkG0BDy8ljZe28pyDA74UlUC4WOyt0sxgOthW1JJAD9wv1y6rFQWCDMB6BAK-NdqLTBLg2thcqeAnk68vaKGOXg-yFdl29dPLBef8VAZ6V_qjUTloCvO-aRvlcc0QdhB58iCWDMVNnD1iSUIOcAvASY2qsEUeex-XSOEJ6koaT_6Q1iY89IY4mw4TCmmJYc9BNZKPQ00ywxxJS-BlqcnL2KfJF3xhZf3WdwwsMd8xZ4VEgEF6EGornaH-ByW_iHkVAj-aAtpcO7Y1R6kggX1Uz7ext1wt7PNEOk7BZ7UbtYCpKtj4NZ_YE-Doh_hOwHnff-1K_M83xlPmyiJhn8AbmL5C61nZSN8g00OlFoK2xkyjCRofOBro3g5N2OdPE2PqxIGjL1iCCIPA1SPSQpQ_B6qyIVyiCsp8s-_Gn2P76fpHfVlt6WV3_Lv5e5_6mul7cSVRFhiWhOIrsaaVTMbKZaUWNbQ-VMncGN__b_fwn-CAKeAQ&width=1360&height=850&dpi=192&waitMs=3000&format=png&localize=1&dark=1&filename=design)

**Balik sebuah seleksi.** Klik kanan kotak mana pun dan pilih **Flip horizontal** atau **Flip vertical** untuk mencerminkannya di tempat, atau tekan `Shift+H` / `Shift+V` dari keyboard - Shift, karena `V` saja adalah alat Pointer. Setiap kotak terpilih mencerminkan pada porosnya sendiri dalam satu langkah undo, dan pencerminan tersebut adalah transformasi sungguhan, sehingga bertahan pada SVG, PDF dan PNG yang diekspor, bukan hanya di kanvas.

### Menggambar bentuk Anda sendiri (pena)

Kotak, lingkaran dan bingkai bersudut membulat mencakup sebagian besar tata letak. Ketika Anda butuh bentuk yang tidak ada dalam daftar itu, gambarlah: tombol **Pen** di rel (atau tombol `P`) membawa Anda ke mode menggambar. Tiga tombol tunggal berpindah antar-mode - **`V`** kembali ke Pointer, **`P`** untuk Pen, **`N`** untuk tool node (**Edit points**) - dan Pointer selalu menjadi jalan keluar dari mode mana pun.

![Rel tool kanvas bebas: pegangan seret, menu Lolly, lalu Pointer, Add a box, Pen, Edit points, Line, Timeline, Artboards dan Auto-arrange](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3D__blank__&width=1440&height=900&dpi=192&waitMs=2600&css=.fc-toolbar%7Bopacity%3A1!important%7D&cropSelector=.fc-toolbar&walker=1&format=svg&dark=1&filename=pen-editor-rail)

- **Klik** untuk menempatkan sebuah titik. Pada jenis kurva bawaan, **klik lalu seret** menarik keluar handle titik itu, dan begitulah cara Anda menggambar kurva alih-alih sudut - tahan **Alt** saat mengeklik jika ingin sudut tajam. (Pada jenis kurva lain, setiap titik yang ditempatkan adalah sudut dan seretan tidak berpengaruh; lihat **Spline type** di bawah.)
- Titik mengait ke artboard dan ke kotak Anda yang lain saat ditempatkan, memunculkan panduan yang sama seperti seretan biasa. Alt menonaktifkan kisi selagi Anda menggambar, dan menonaktifkan kisi sekaligus tepi saat Anda menyeret sebuah titik sesudahnya.
- **Klik titik pertama Anda** untuk menutup lengkung dan menyelesaikannya dalam satu gerakan. Kalau tidak, tekan **Enter**, klik ganda atau cukup ganti tool - gambarnya disimpan, bukan dibuang.
- **Escape** bekerja satu tingkat demi satu tingkat: tekanan pertama membatalkan gambar dan tidak menulis apa pun, tekanan kedua keluar dari pena.
- **Delete** selagi menggambar menghapus titik terakhir yang Anda tempatkan.

Hasilnya adalah kotak biasa di kanvas. Pindahkan, ubah ukurannya, putar, kelompokkan, ratakan, susun ulang urutannya, beri isian, gradien, bayangan atau opasitas - sebuah path berperilaku seperti kotak lain, dan tak satu pun kontrol itu memperlakukannya berbeda.

Bentuk itu juga langsung berwarna. Path pertama yang Anda gambar mengambil isian dan garis yang ditetapkan brand Anda untuk sebuah path, dan setelah itu setiap path baru mengambil **apa pun yang terakhir Anda pakai** - atur isiannya sekali lalu terus menggambar, alih-alih mewarnai ulang setiap bentuk. (Pada tool yang brand-nya tidak mengatur path, path yang digambar diberi garis dengan warna yang Anda lihat saat menggambarnya, jadi tidak pernah tak kelihatan.)

**Menyunting titiknya lagi.** Klik ganda bentuknya (atau gunakan **Edit points** di bilah objek) dan titik-titiknya muncul kembali. Seret sebuah titik untuk memindahkannya, seret handle untuk mengarahkannya ulang, klik di mana saja pada kurva untuk menyisipkan titik, tarik kotak seleksi pada sekelompok titik lalu tekan Delete untuk menghapus yang terpilih. Sebuah path selalu menyisakan setidaknya dua titik, jadi Anda tidak bisa tak sengaja menghapusnya sampai lenyap.

**Spline type** menentukan jenis kurva yang melewati titik-titik Anda, dan inilah pilihan yang layak dipahami:

| Jenis | Fungsinya |
|---|---|
| **Smooth (auto)** | Bawaan. Menghitung sendiri panjang handle-nya, jadi klik-klik-klik biasa sudah menghasilkan kurva yang benar-benar mulus tanpa perlu mengutak-atik handle. Kalau Anda memang mengatur sebuah handle, handle itu mengunci *arahnya* dan panjangnya tetap dipegang kurva. |
| **Bezier handles** | Pena klasik. Handle adalah titik kendalinya, dan menyisipkan titik tidak pernah menggeser kurva. |
| **Through the points** | Melewati persis setiap titik yang Anda tempatkan, tanpa handle. |
| **B-spline** | Mengalir di dekat titik alih-alih melewatinya, untuk bentuk yang lebih lembut. |
| **Straight lines** | Garis patah. |

Mengalihkan path yang sudah ada ke jenis yang menghitung handle-nya sendiri akan dikonfirmasi lebih dulu, karena panjang handle yang Anda atur tidak bisa dipulihkan - beralih ke **Bezier handles** selalu tanpa kehilangan apa pun. Di tengah proses menggambar tidak ada konfirmasi: peralihannya langsung diterapkan pada draf, dan handle apa pun yang sudah Anda tarik ikut hilang. Pada jenis yang memegang handle-nya sendiri, menyisipkan titik sedikit mengubah bentuk kurva; pada **Bezier handles** tidak.

Setiap titik juga membawa aturan kontinuitas, ditunjukkan oleh bentuknya di kanvas - persegi untuk **Corner** (handle bergerak sendiri-sendiri), bulat untuk **Smooth** (handle tetap segaris), bulat bercincin untuk **Symmetric** (segaris dan sama panjang). Terapkan pada titik mana pun yang terpilih dan kurvanya langsung menyesuaikan diri.

![Dua path pena yang dirender langsung dari sebuah tautan: kurva S bergaris dan gumpalan tertutup berisi warna](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22curve%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A140%2C%22y%22%3A180%2C%22w%22%3A800%2C%22h%22%3A420%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A14%2C%22path%22%3A%221!cubic!0_.02!.85!!!.25!-.45!s_.5!.5!-.22!.32!.22!-.32!y_.98!.12!-.25!.45!!!s%22%7D%2C%7B%22id%22%3A%22blob%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A340%2C%22y%22%3A620%2C%22w%22%3A400%2C%22h%22%3A320%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23d1e7ff%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A6%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!catmull-rom!1_.5!0_1!.42_.78!1_.22!1_0!.42%22%7D%5D&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=pen-path-geometry)

Path yang digambar ikut dibawa di dalam tautan seperti segala hal lain, jadi bentuk yang Anda gambar terbuka kembali dari tautan berbagi dan dirender sama persis dari CLI. Tidak ada bagiannya yang bergantung pada editor.

### Menggabungkan bentuk (operasi path)

Pilih dua bentuk atau lebih, **klik kanan** kanvas (ketuk dua jari pada layar sentuh) dan menunya menawarkan operasi yang Anda harapkan dari aplikasi menggambar:

- **Union** menyatukannya menjadi satu bentuk, dengan mempertahankan warna bentuk paling atas.
- **Subtract** memotong semua yang di atas dari bentuk paling bawah.
- **Intersect** hanya menyisakan bagian yang bertumpang tindih.
- **Exclude** menyisakan semuanya kecuali bagian yang bertumpang tindih.

Tiga lainnya bekerja pada satu bentuk: **Outline stroke…** mengubah garis menjadi bentuk berisi dengan kontur yang sama (berguna bila Anda ingin mempertahankan ketebalan persis seperti digambar), **Offset path…** melebarkan siluetnya ke luar atau, dengan angka negatif, menyusutkannya ke dalam dan **Simplify** menyusun ulang sebuah path dengan lebih sedikit segmen pada bentuk yang sama.

![Bulan sabit dan cincin dengan lubang sungguhan, keduanya dihasilkan oleh Subtract](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22crescent%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A120%2C%22y%22%3A330%2C%22w%22%3A374%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22path%22%3A%221!cubic!1_.750491!.957645!-.128211!-.062578!-.065985!.027232!c_.534759!1!.076762!!-.295339!!c_0!.5!!.276142!!-.276142!c_.534759!0!-.295339!!.200102!!c_1.000984!.254923!-.09169!-.152161!-.021205!-.003239!c_.935829!.25!.022185!!-.221505!!c_.534759!.625!!-.207107!!.14459!c%22%7D%2C%7B%22id%22%3A%22ring%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A580%2C%22y%22%3A330%2C%22w%22%3A400%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!cubic!1_1!.5!!-.276142!!.276142!c_.5!1!.276142!!-.276142!!c_0!.5!!.276142!!-.276142!c_.5!0!-.276142!!.276142!!c*1!cubic!1_.5!.7!-.110457!!.110457!!c_.7!.5!!.110457!!-.110457!c_.5!.3!.110457!!-.110457!!c_.3!.5!!-.110457!!.110457!c%22%7D%5D&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=path-ops-boolean-result)

Hasilnya adalah path baru yang bisa terus Anda sunting dengan pena. Lubangnya adalah lubang sungguhan - kontrol **Fill rule** di panel garis menentukan apakah kontur yang bertumpang tindih terisi (*non-zero*) atau menembus (*even-odd*).

Dua hal yang sengaja tidak dilakukan operasi ini. Operasi ini **menolak alih-alih merusak**: minta perpotongan dua bentuk yang tidak bertumpang tindih dan Anda akan diberi tahu bahwa tidak ada yang bisa disisakan, lalu tidak ada yang berubah. Dan kotak teks serta kotak gambar tidak punya kontur untuk diolah, jadi keduanya dibiarkan apa adanya alih-alih didekati lewat bingkainya. Hasil gabungan disimpan sebagai kurva Bezier biasa, sama seperti yang dilakukan aplikasi menggambar - jenis spline aslinya tidak bertahan setelah operasi itu.

## Timeline (Sequence Studio)

![The timeline with the music clip selected: its strip runs along the bottom with Speed, Fades, Volume, Pan, EQ, Pitch, Normalize volume and the Effect slot](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dvideo%26_sel%3Dbed&width=1440&height=900&dpi=192&waitMs=5000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A300px!important%7D&cropSelector=.tl-panel&walker=1&format=svg&dark=1&filename=tl-audio-strip)

**Sequence Studio** menambahkan *waktu* ke kanvas bebas. Setiap kotak bisa mulai pada suatu momen, berjalan selama durasi tertentu dan beranimasi masuk serta keluar, dan timeline yang menempel di bawah artboard adalah tempat Anda menatanya. Buka tool-nya dan sudah ada rangkaian yang berjalan - kartu judul, sebuah klip, kartu penutup, lower-third dan latar musik - sehingga modelnya terlihat sebelum Anda mengubah apa pun.

![Timeline Sequence Studio: transport, penggaris, jalur overlay, baris sequence magnetis dengan klip dan chip seam-nya serta strip Always on](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A252px!important%7D&cropSelector=.tl-panel&format=svg&walker=1&tolerance=0.03&dark=1&filename=seq-studio-timeline)

Ada dua jenis baris, dan perbedaannya adalah inti dari seluruh gagasannya:

- **Baris rangkaian** bersifat *magnetis*. Klip duduk rapat tanpa celah, satu demi satu, dan menyeret satu klip mengurutkan ulang rangkaiannya alih-alih meninggalkan lubang. Hapus sebuah klip dan sisanya merapat. Inilah tulang punggung Anda.
- **Jalur overlay** bebas. Lower-third, logo, keterangan - apa pun yang mengambang di atas tulang punggung pada waktunya sendiri - mendapat jalur dan titik mulainya sendiri.
- Di bawahnya, **Always on** mengumpulkan kotak yang sama sekali tidak punya pewaktuan: latar yang sekadar hadir sepanjang durasi. Tanda `+` pada sebuah chip menaikkannya ke sebuah jalur; **Make always on** mengembalikannya.

![Panggung edit: artboard di depan dan tengah, rel alat di sebelah kiri dan HUD zoom di sudut](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.fc-toolbar%7Bopacity%3A1!important%7D&format=svg&walker=1&tolerance=0.03&dark=1&filename=seq-studio-stage)

Membuka timeline menyerahkan papan ketik kepadanya, jadi Space dan tombol panah menggerakkan playhead alih-alih halaman - dan karena timeline terbuka sendiri pada komposisi yang sudah punya pewaktuan, hal itu berlaku sejak Sequence Studio dimuat.

> **[Editor rangkaian](/info/sequence-editor.html)** membahas lebih dalam empat hal yang menentukan apakah menyunting dalam waktu terasa bisa ditebak: klip mana yang disunting oleh klik di kanvas, bayangan onion-skin dari klip tetangga, cakupan pemisahan dan Join yang membatalkan sebuah potongan serta pemangkasan (termasuk perangkat papan ketiknya). Tekan `?` dengan timeline dalam fokus untuk melihat lembar pintasannya.

**Menyunting.** Seret bagian tengah klip untuk memindahkan atau mengurutkannya ulang, seret dalam jarak beberapa piksel dari salah satu ujungnya untuk memangkasnya dan tekan **Split at playhead** (atau `S`) untuk memotong satu klip menjadi dua. Split memerlukan klip dengan **Length** yang nyata dan playhead sedikit masuk ke dalamnya, jadi klip tanpa ujung (latar musik, misalnya) tidak bisa dipisah. **Snap to edges** aktif secara bawaan dan mengait ke tepi klip, playhead dan detik bulat, dengan Alt untuk mengabaikannya. Setiap seretan adalah satu langkah undo, dan pratinjau seretannya menjalankan perhitungan yang sama dengan hasil akhirnya, jadi apa yang Anda lihat saat menyeret itulah yang Anda dapat.

Pilih sebuah klip dan inspektur memberikan suntingan yang sama dalam bentuk angka: **Length**, **Trim in** (seberapa jauh ke dalam sumber klip itu dimulai), **Speed** berupa sekumpulan pengali tetap dari ×0.25 sampai ×4, **Animate in** / **Animate out** beserta durasinya dan **Mute clip**. Klip di baris magnetis sengaja tidak punya kolom **Start** - barisnya yang memegang urutan, jadi Anda menyeret untuk memindahkannya.

**Transisi** adalah preset, bukan keyframe: Fade, Pop, Grow, Rise, Drop, empat varian Slide, Zoom in dan out, Tilt, Swoop, Spin, Drift atau **Cut (no animation)**. Jaraknya menskala mengikuti objek, jadi preset yang sama terbaca dengan benar pada kartu satu bingkai penuh maupun pada lencana kecil. Di antara dua klip bersebelahan pada baris rangkaian ada **chip sambungan**: klik chip itu lalu pilih **Cut** atau **Crossfade**, yang langsung diterapkan lalu menutup. Buka chip yang sama sekali lagi untuk mengubah **Length (ms)** lalu tekan **Done**. Crossfade disimpan sebagai fade keluar dari satu klip dan fade masuk ke klip berikutnya, dan proses ekspor menurunkan dissolve yang sesungguhnya dari pasangan itu - itulah sebabnya crossfade tampak seperti dua fade di pratinjau dan sebagai peralihan sejati di dalam berkasnya.

**Suara.** Tambahkan klip **Audio** dan klip itu hidup di timeline seperti klip lain: gelombang suara, pemangkasan, bisu. (Latar musik hasil generasi yang disertakan sesi bawaan adalah satu-satunya pengecualian - latar itu disintesis saat ekspor, jadi barnya tetap polos dan senyap sampai Anda merender.) Tekan ikon mikrofon untuk **merekam sulih suara** langsung ke timeline, lengkap dengan hitungan mundur dan meter level, dan hasil rekamannya disimpan sebagai aset Anda sendiri pada titik Anda mulai. Tekan ikon kamera di sebelahnya untuk **merekam video** dengan cara yang sama: hasil rekamannya dipangkas ke ukuran ekspor artboard selagi merekam, sehingga tampilan diri yang kecil itu menunjukkan persis apa yang masuk ke rangkaian pada playhead, bingkai penuh - cara untuk mengumpulkan klip rekan kerja dari tautan yang dibagikan. Musik, dialog dan trek suara milik klip semuanya masuk ke campuran hasil ekspor. (**Audio track** di panel ekspor adalah hal yang berbeda: satu latar yang dipasang di bawah seluruh klip, dengan fade dan ducking. Keduanya bisa berdampingan.)

**Merendernya.** Ekspor gerak adalah **komposit deterministik**, bukan rekaman layar - setiap frame didekode, digambar dan dikodekan pada waktu yang persis, jadi berkasnya tidak bergantung pada kemampuan mesin Anda mengimbangi, dan praktis tidak ada batas jumlah frame pada MP4 atau WebM. Panjang timeline itu sendiri menentukan durasinya kecuali Anda mengetiknya. Content Credentials dibubuhkan seperti pada ekspor lain. Ekspor gambar diam memberi Anda frame pada posisi playhead, atau satu lembar kontak penuh dari kolom **Frames** di samping ukuran keluaran - lihat [Ekspor](/info/exporting.html#stills-from-a-timed-composition).

Beberapa batasan yang perlu diingat: satu rangkaian dibatasi satu jam, GIF dan PNG beranimasi menyangga frame-nya sehingga harus tetap pendek, audio senyap pada klip yang kecepatannya bukan ×1 (belum ada peregangan waktu) dan **Record live** disembunyikan di sini karena kompositor adalah jalur yang lebih baik.

**Melampaui preset: keyframe, depth dan sebuah kamera.** Sebuah transisi menganimasikan sebuah klip saat ia masuk dan keluar. Untuk memberi pose pada sebuah kotak *di dalam* sebuah klip - menghanyutkannya, memudarkannya, mengaburkannya, mengangkatnya dari halaman lalu meletakkannya kembali - tambahkan keyframe: pilih klipnya, tekan **+Keyframe** (belah ketupat di kluster alat timeline, belah ketupat di object bar kanvas atau `K`) dan posisi playhead menentukan pose mana yang ditulis oleh edit Anda berikutnya. Sistem keyframe yang sama memberi tiap komposisi berwaktu sebuah **kamera** yang mendorong masuk, panning menyamping dan menarik fokus, dan mengubah satu SVG datar menjadi tumpukan layer yang bisa Anda terbangi. **[Animating](/info/animating.html)** adalah panduan lengkapnya.

Tool Design punya timeline yang sama, jadi Anda bisa mengatur waktu sebuah tata letak tanpa berpindah ke tool lain, dan tool itu juga mengekspor gerak.

## Presentasi

![The inspector's Document section: Voice, Blend with, Speed, Lead-in, Tail and Show captions when presenting](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour&width=1440&height=900&dpi=192&waitMs=3500&cropSelector=.fc-insp&walker=1&format=svg&dark=1&filename=design-narration)

Dokumen Design yang tersusun dari **artboard** sudah merupakan sebuah dek. Buka **Lolly menu** di rel tool lalu pilih **Present** - baris terakhir - dan setiap artboard menjadi slide layar penuh, dalam urutan letak artboard di kanvas. Dek berjalan di atas salinan artboard yang sudah dirender, jadi editor di baliknya tidak pernah tersentuh dan keluar dari dek mengembalikan Anda persis ke tempat semula.

- **Maju** dengan **Space**, `→`, **Page Down**, atau klik pada strip di tepi kanan layar; mundur dengan `←`, **Page Up**, atau strip di tepi kiri. **Home** dan **End** melompat ke slide pertama dan terakhir. Sebuah bilah kontrol kecil memudar masuk setiap kali Anda menggerakkan pointer dan menyembunyikan diri lagi setelah Anda berhenti.
- **Overview** (`O` atau tombol grid) menyusun semua artboard sekaligus dalam susunan yang Anda berikan pada kanvas; klik salah satu untuk membukanya.
- **Reveal steps.** Klik kanan sebuah kotak dan pilih **Reveal at step 1**, **2**, atau **3** alih-alih default **Always visible**. Kotak tersebut kemudian menunggu sampai Anda maju ke langkahnya, sehingga sebuah slide bisa muncul secara bertahap; kotak-kotak dengan nomor yang sama muncul bersamaan.
- **Speaker view** (`S`) membuka jendela kedua berisi slide saat ini, slide berikutnya, catatan Anda untuk slide tersebut, dan sebuah jam yang berjalan. Jika browser memblokir pop-up, tampilan ini beralih ke sebuah panel di atas deck. Catatan diatur per artboard dan tidak pernah muncul pada slide itu sendiri.
- `B` menahan sebuah layar hitam (tombol apa pun mengembalikan slide), `F` kembali ke fullscreen, dan **Escape** mengupas satu lapisan pada satu waktu: overview kembali ke deck, deck kembali ke editor.
- **Kiosk.** Beri sebuah artboard sebuah **Length** dan deck akan bertahan di sana selama itu, lalu maju sendiri di balik progress bar tipis; `K` (atau tombol pause, yang hanya muncul setelah sesuatu memiliki length) menghentikan dan memulai ulang itu. Tambahkan `kiosk` ke tautan dan deck akan berputar kembali (wrap) di akhir, itulah yang menjadikannya signage.

Dek juga berupa tautan. `?present` langsung membukanya, `s=` menyebutkan slide-nya - sebuah posisi, id artboard atau `id.step` untuk satu tahap kemunculan - dan alamatnya diperbarui saat Anda berpindah, jadi yang Anda kirim adalah slide tempat Anda berada. Untuk penulis tool: parameter itu didokumentasikan di halaman [URL Mode](/info/url-mode.html#reserved-parameters).

## Di ponsel

Pada layar sempit, tata letaknya mengalir menjadi satu kolom:

- **Kontrol berubah menjadi lembar** di bagian atas dengan **pegangan seret** di tepi bawahnya. Seret pegangannya untuk mengubah ukuran - lembar itu mengait ke **peek / half / full** - atau **ketuk** pegangannya untuk beralih antara terlipat ↔ terbuka. Pratinjau mengisi ruang di bawahnya dan tetap terlihat selagi Anda menyunting.
- Tombol **Export** yang mengambang membuka lembar ekspor - semua kontrol format, ukuran, salin, simpan dan unduh dalam satu tempat. Tutup dengan mengetuk latar belakangnya.

![Sebuah tool pada layar selebar ponsel - kontrol sebagai lembar di atas, palet hasil generasi mengisi pratinjau di bawah dan pil render mengambang di tengah bawah](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3Df97316%26harmony%3Dadjacent-3%26steps%3D9&width=430&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=vt-phone-palette)

## Kontrol (input)

Tool hanya menampilkan input yang memang boleh berubah - selebihnya (warna, tata letak, tipografi, logika) dikunci oleh penulis tool, sehingga apa pun yang Anda buat memenuhi aturan yang ditetapkan penulisnya. Input mencakup teks, penggeser, pemilih warna, menu tarik-turun, tanggal, pemilih gambar dan grup baris berulang. Sebagian dikelompokkan di bawah bagian yang bisa dilipat.

![Tumpukan kontrol sebuah tool - satu kolom teks, pemicu warna dan satu penggeser, tanpa apa pun lagi yang dipilih penulisnya untuk dikunci](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=%23tool-inputs&walker=1&format=svg&dark=1&filename=use-tool-inputs)

**Reset:** *Clear changes* mengembalikan setiap input ke nilai bawaannya.

### Undo dan redo

**Cmd/Ctrl-Z** mundur satu langkah dan **Cmd/Ctrl-Shift-Z** (atau **Cmd/Ctrl-Y**) maju lagi. Pasangan yang sama tersedia sebagai tombol **Undo** dan **Redo** di baris atas kontrol - pada kanvas bebas keduanya ada di rel tool - dan masing-masing meredup selama tidak ada lagi yang bisa dibatalkan. Setiap langkah menyebutkan dirinya: batalkan sebuah warna dan pesan kecil menyebut input yang baru saja dipulihkan, dengan tombol **Redo** di dalamnya untuk jalan kembali.

- **Satu seretan adalah satu langkah.** Perubahan berulang pada kontrol yang sama dalam setengah detik digabungkan, jadi menarik penggeser sepanjang rentangnya adalah satu undo, bukan dua ratus.
- **100 langkah terakhir disimpan** - yang lebih lama terlepas dari ujungnya. Menyunting hal baru setelah membatalkan akan menghapus tumpukan maju, sama seperti di tempat lain.
- **Selagi kursor Anda berada di kotak teks**, Cmd/Ctrl-Z menjadi milik kolom itu sendiri, karakter demi karakter. Lolly mengambil alih untuk kontrol yang tidak punya undo sendiri yang berguna: penggeser, menu tarik-turun, warna dan sakelar.
- **Memilih berkas** pada input **file** bukanlah sebuah langkah - byte itu hanya disimpan untuk sesi berjalan, jadi tidak akan ada yang bisa dikembalikan.

Dalam sebuah [kolaborasi](/info/collaborate.html) live, riwayat tetap hanya milik Anda. Perubahan yang datang dari perangkat lain tidak pernah masuk ke stack Anda, jadi undo hanya bisa membatalkan sesuatu yang Anda lakukan sendiri.

## Data diri & foto Anda

**Profile** (kanan atas galeri) menyimpan nama, detail kontak dan **foto diri** opsional Anda. Tool yang meminta kolom-kolom itu mengisinya otomatis - atur sekali dan tanda tangan email, lockup serta lencana Anda akan terisi sendiri. Anda tetap bisa menimpa kolom mana pun per sesi. Aktifkan **Use my details to create** agar detail Anda ikut tercantum sebagai penulis pada apa yang Anda ekspor.

Foto dan detail Anda ada **hanya di perangkat ini**. Sebuah profil bisa lebih dari sekadar diri Anda - sebuah tim atau peran yang sesekali Anda jalani. Lihat **[Profil](/info/profile.html)** untuk gambaran lengkapnya, termasuk menyimpan lebih dari satu.

## Menyimpan & melanjutkan

Klik **Save** untuk menyimpan input saat ini sebagai satu sesi untuk tool tersebut. Anda bisa menyimpan beberapa sesi bernama per tool; tombol **Continue** tiap tool membuka kembali sesi terakhir Anda, dan **tombol riwayat** (kanan atas, di samping profil Anda) mencantumkan setiap sesi tersimpan dari semua tool. Sesi bersifat lokal di perangkat. Untuk menatanya, buka **Projects** (di bawah).

![Pil render berbagi dua - panah ke atas yang membuka panel ekspor, dan tanda centang yang menyimpan sesi di tempat](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=%23tool-inputs%7Bdisplay%3Anone%7D&cropSelector=.render-pill&walker=1&format=svg&dark=1&filename=use-render-pill)

## Projects

**Projects** - buka dari tab **Projects** di samping **Tools**, atau dari **Profile → Storage → Organise in Projects** - adalah rumah bagi semua yang Anda simpan, dan bekerja seperti pengelola berkas:

![Projects - sesi tersimpan yang ditata dalam folder bersusun](/t/url-shot?url=%2F%23%2Fp&width=1440&height=900&dpi=192&waitMs=1200&walker=1&format=svg&localize=1&dark=1&filename=projects)

- <!--i:folder--> **Folder bersusun.** Kelompokkan sesi tersimpan ke dalam folder, dan folder di dalam folder, sedalam yang Anda mau. Buat folder, ganti namanya atau seret sebuah ubin ke folder lain untuk memindahkannya; remah roti membawa Anda kembali ke atas. Folder **Uncategorised** yang selalu ada menampung apa pun yang belum diarsipkan.
- <!--i:clock--> **Urutkan sesuai cara Anda.** **View & sort** menawarkan **Name**, **Date added**, **Last modified** (bawaan) dan, di dalam folder, **By tool**. Folder selalu tampil lebih dulu terlepas dari urutan mana yang aktif - pengurutan hanya menata sesi dan folder di dalam kelompoknya masing-masing.
- <!--i:document--> **Arsipkan karya baru langsung di dalamnya.** **New asset** ("Start a fresh creation" di akar, "Add to *folder*" di dalam sebuah folder) membuka sebuah tool dan otomatis mengarsipkan penyimpanan pertamanya ke folder itu.
- <!--i:checklist--> **Pilih banyak (desktop).** Centang kotak pada sebuah ubin, tarik kotak seleksi di ruang kosong atau **Shift/Cmd-klik**; **klik kanan** sebuah ubin untuk menu konteksnya. Lalu kerjakan seluruh seleksi sekaligus - gestur yang sama dan bilah aksi mengambang yang sama berlaku di galeri Tools, Utilities, Catalogue dan Projects, bukan hanya di sini.
- <!--i:download--> **Render satu folder atau seleksi utuh.** **Render folder** mengekspor setiap sesi tersimpan dalam sebuah folder - termasuk subfoldernya - sebagai satu `.zip` bersusun. **Render selection** melakukan hal yang sama untuk seleksi ganda mana pun, dan satu sesi tunggal dirender langsung menjadi berkasnya sendiri. Tanpa perlu Batch/Pro.
- <!--i:link--> **Langsung menuju karya tersimpan sebuah tool.** Centang satu tool atau lebih di galeri Tools lalu pilih **View sessions** dari bilah seleksi - Projects terbuka dan hanya menampilkan sesi yang dibuat dengan tool tersebut, dengan **Clear** untuk kembali ke tampilan penuh.
- <!--i:link--> **Bagikan sesi tersimpan.** Klik kanan sebuah sesi → **Share link** untuk menyalin tautan yang membukanya kembali dengan input yang persis sama (dialog Share lengkap - lihat di bawah).

![Popover View and sort di Projects dalam keadaan terbuka, dengan baris tema, pilihan View berupa Preview atau List serta Name, Date added dan Last modified di bawah Sort](/t/url-shot?url=%2F%23%2Fp&width=900&height=700&dpi=192&waitMs=1400&drive=click%3A.projects-viewopts&cropSelector=.projects-viewmenu&walker=1&format=svg&dark=1&filename=misc-projects-sort)
<!--
SHOT NOTE (misc-projects-sort): trigger button confirmed as
`.filter-fab.projects-viewopts` in views/projects.ts (openViewOpts() is bound
to `.projects-viewopts` specifically) - `.projects-viewopts` alone is the
more specific hook, so that's what drives the click. The popover it opens
(`.projects-viewmenu`, also confirmed directly in openViewOpts()) is body-
appended, not nested under the Projects root, so cropSelector finds it
regardless. "By tool" only appears inside a folder - this recipe captures at
the Projects ROOT (`url=/#/p`), so if the capture pass wants "By tool"
visible too, point url= at a real folder instead: the route is a path
segment, `/#/p/<folderId>` (confirmed in main.ts's hash router - `parts[0]
=== 'p'` reads `folderId` from `parts[1]`), not a query param. Caveat: a
folder has to already EXIST in the capture profile, which a per-shot fresh
context has none of.
Also: the popover is not sort-only. openViewOpts() writes a theme segment, a
"View" pair (Preview / List) and a sound segment around the Sort rows, so the
alt text names them - do not re-caption this as "the sort menu".
-->

**Apa yang ditawarkan bilah seleksi** sedikit berbeda menurut tampilannya, karena tidak setiap tindakan masuk akal di mana-mana:

- **Tools / Utilities:** Favourite (atau Unfavourite), Hide (atau Unhide), Available offline (atau Remove from offline), **View sessions** (lompatan yang dijelaskan di atas) dan Copy link ketika tepat satu kartu terpilih.
- **Catalogue:** Favourite dan Hide berlaku untuk seleksi apa pun; Duplicate, Download dan Delete baru muncul setelah setiap item yang terpilih adalah unggahan Anda sendiri - aset design system bersama adalah kontrak permanen, jadi ketiga tindakan itu tetap tidak berlaku padanya sekalipun secara massal.
- **Projects:** **Render selection**, **Move to…**, **New folder**, **Delete**, **Edit together** ketika seleksinya antara dua dan delapan sesi dari satu tool (membukanya berdampingan di bawah satu sidebar gabungan) dan **Edit as sheet**, yang justru membuka seluruh seleksi sebagai baris di kisi batch. Yang terakhir ini **tanpa batas jumlah** dan tidak peduli apakah sesinya berasal dari tool yang sama, jadi inilah jalan keluar ketika seleksi lebih besar atau lebih beragam daripada dua-sampai-delapan milik Edit together.

> Satu jebakan label: **View sessions** hanya ada setelah ada sesuatu yang *terpilih*. Mengeklik kanan satu kartu yang belum terpilih justru menawarkan **N saved sessions**, yang membuka dialog riwayat tool itu sendiri alih-alih membawa Anda ke Projects.

![Dua kartu alat dicentang di galeri Tools, dengan bar seleksi mengambang bertuliskan "2 selected" dan menawarkan Available offline, View sessions, Favourite dan Hide](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-select%3D%22gradient%22%5D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=misc-bulkbar-gallery)
<!--
SHOT NOTE (misc-bulkbar-gallery): drive targets `[data-select="qr-code"]` /
`[data-select="gradient"]` - the `.tile-check[data-select="<ref>"]` checkbox button
confirmed directly in views/gallery.ts's card markup (the same attribute
cardMarkup gives every tile), so these two clicks tick both cards without
opening either tool.

SHOT NOTE (misc-sessions-by-tool, NOT PUBLISHED): the "View sessions" result
had a recipe of its own (`/#/p?tools=qr-code,d3`, views/projects.ts's
toolsBodyHtml()), dropped here because it has no `drive=` that can
manufacture its own content - a saved session isn't a click away, it has to
already exist, and build-docs-shots.ts gives every shot a fresh
`browser.newContext()`. It would publish an empty list. Same dependency the
`projects` shot above already carries; revisit if the pipeline gains a
storage-seeding hook.
-->


## Membagikan karya Anda

Sebuah desain keluar lewat salah satu dari dua cara: sebagai tautan atau sebagai berkas. Dialog Share menawarkan keduanya. Buka dengan **Share** di kontrol ekspor; **Share link** pada sesi tersimpan di Projects membuka dialog yang sama untuk sesi itu.

### Tautannya

Setiap input tertangkap di URL halaman, jadi sebuah tautan *adalah* desainnya. Di bagian atas dialog terdapat tautan yang siap disalin, dengan dua bagian terlipat di bawahnya.

- **Link options** memuat **Shortest link** (desain besar menghasilkan URL panjang, jadi opsi ini memampatkan seluruh keadaan ke dalam token ringkas dan menunjukkan penghematannya dalam jumlah karakter; bentuk yang terbaca selalu tersedia juga), **Password-protect this link** (AES-256 atas seluruh tautan, kata sandinya tidak pernah ada di dalamnya) dan **Pin this tool version** - flag `_v`, yang memaku tautan ke versi tool yang sedang Anda lihat sehingga pembaruan berikutnya tidak bisa mengubah hasil rendernya.
- **Link behaviour** adalah apa yang terjadi ketika penerimanya membuka tautan itu: layar penuh, panel ekspor yang sudah terbuka, unduh-saat-dibuka dengan `&export` atau salin-ke-papan-klip dengan `&copy`.

Tempelkan tautannya untuk rekan kerja, jadikan bookmark atau commit ke repositori. (Detail lengkap: [URL Mode](/info/url-mode.html).)

**Bagi beberapa alat, link adalah keseluruhan produknya.** Jump Page mengumpulkan link Anda ke dalam satu halaman untuk dibagikan - sebuah bio link, sebuah talk konferensi, sebuah shop front. Tidak ada yang perlu di-hosting dan tidak ada akun di baliknya: halamannya adalah linknya, jadi ia terbuka secepat URL itu sampai. Di editor Anda melihat halaman jadi di samping field-fieldnya; pengunjung yang membuka link mendapatkannya dalam lebar penuh, satu link per scene saat mereka scroll.

![Jump Page di editor - heading, tiga scene link masing-masing dengan wash-nya sendiri dan sebuah footer Made with Lolly, ditata sebagai satu halaman di kanvas](/t/url-shot?url=%2F%23%2Ftool%2Fjump%3Ffull&width=900&height=1300&dpi=96&waitMs=2000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=use-jump-page)

**Dialognya menyebutkan apa yang tidak bisa dibawa sebuah tautan.** Tiga hal tidak muat di dalam URL: gambar atau berkas yang Anda tambahkan dari perangkat ini, nilai teks yang sangat panjang atau daftar yang sangat besar. Masing-masing dihitung saat tautannya dibangun. Jika ada yang terpaksa ditinggalkan, dialog menyebutkannya dan mengarahkan Anda ke berkas di bawah, alih-alih menyerahkan tautan yang terbuka tanpa gambarnya. Tautan yang sekadar *panjang* mendapat catatan yang lebih ringan beserta jumlah karakternya, karena pemampatan masih bisa menyelamatkan panjangnya.

### Berkas .lolly

**Download .lolly**, di dialog Share pada tool yang sedang Anda gunakan, menuliskan desain yang sama sebagai sebuah berkas. Berkas itu membawa sesi tersimpan beserta gambar dan berkas yang Anda tambahkan dari perangkat Anda. Karya katalog yang dipakai desain itu juga ikut di dalamnya, sehingga berkasnya terbuka utuh di mesin yang belum pernah melihat brand Anda. Bila perangkat Anda punya lembar berbagi, **Send to…** menyerahkan berkas itu langsung ke sana (AirDrop, berbagi di Android) alih-alih menyimpannya ke disk.

Berkas `.lolly` adalah zip biasa. Ganti namanya menjadi `.zip` lalu buka: gambar Anda sendiri ada di `assets/uploads/` dan karya katalog di `assets/catalog/`, masing-masing dengan nama dan ekstensi aslinya, `manifest.json` mencantumkan semuanya dan sebuah README di bagian atas menjelaskan berkas apa ini.

Tiga hal yang Anda tentukan sendiri sebelum berkasnya dikirim:

- **Apakah nama Anda ikut masuk.** Nama, email dan organisasi Anda ditulis ke dalam file hanya saat **Use my details to create** aktif di profil Anda. Dengan itu nonaktif, file mencatat bahwa file itu dibuat dengan Lolly dan kapan - tanpa apa pun tentang Anda.
- **Apakah karya berlisensi ikut masuk.** Aset berlisensi dan brand-locked ditahan secara default. Jika desain menggunakan salah satunya, dialog menyebutkan jumlahnya dan menawarkan dua tombol - *Download without them* atau *Include and download* - karena menyertakannya menyerahkan file sebenarnya kepada siapa pun yang membuka `.lolly` tersebut.
- **Apakah alatnya ikut masuk.** **Include the tool** mengemas file alat itu sendiri bersama desain, sehingga terbuka di perangkat yang tidak memiliki alat tersebut. Ini datang tercentang untuk alat kustom - sebuah fork atau alat brand privat yang kemungkinan besar tidak dimiliki penerima Anda - dan tidak tercentang untuk alat yang tercantum di katalog bertanda tangan, karena salinan mereka berasal dari sumber yang sama. (Pada build tanpa katalog bertanda tangan, setiap alat dihitung sebagai kustom dan kotaknya dimulai tercentang.)

**Membuka salah satu.** Jatuhkan sebuah file `.lolly` ke aplikasi: aset-asetnya masuk ke pustaka Anda, sesinya masuk ke Projects dan alatnya terbuka di atasnya. Tidak ada milik Anda yang ditimpa: sesi itu datang sebagai slot tersimpan baru, sementara aset yang sudah ada di perangkat ini dicocokkan lewat checksum dan digunakan kembali, bukan diduplikasi. Setiap bagian diperiksa terhadap checksum milik file itu sendiri saat masuk, jadi salinan yang rusak dalam transit ditolak, bukan setengah-diimpor.

Jika berkas itu membawa tool yang tidak Anda miliki, Lolly bertanya sebelum tool tersebut boleh berjalan: **Trust this tool?** menyebutkan nama tool dan penulisnya serta menyatakan dengan jelas bahwa membukanya berarti menjalankan kode milik tool itu di perangkat Anda, dengan **Trust & install** sebagai jalan untuk melanjutkan. Menolak pun, karya yang dibagikan tetap tersimpan di projects Anda, menunggu sampai hari Anda menambahkan tool-nya. (Satu jenis tool belum bisa dipasang dari luar - yaitu yang kodenya dikirim sebagai modul - dan tool semacam itu ditolak dengan cara yang sama.)

Tautan maupun berkas sama-sama menyerahkan satu potret keadaan. Untuk mengerjakan sesi yang sama *pada waktu yang sama* dengan orang lain - dua perangkat, tanpa server, tanpa perlu internet jika Anda berada di satu jaringan - lihat [Bekerja bersama](/info/collaborate.html).

## Kamera langsung (tool yang bereaksi pada gerakan)

Setiap **Filter** foto - Halftone, Scanline, Posterize, Voronoi cells, Colour treatment, Pixel stretch dan Imperfections - menampilkan tombol **Go live** bila ada kamera yang tersedia. Nyalakan dan efeknya mengikuti webcam Anda frame demi frame, sehingga bereaksi terhadap gerakan; hasilnya bisa Anda rekam ke GIF, WebM atau MP4. Frame dibaca dan diproses **di perangkat Anda** dan tidak pernah keluar darinya, dan kamera dilepaskan begitu Anda berhenti atau meninggalkan tool-nya. (Setiap pemilih gambar juga punya **Take a photo** untuk mengambil satu frame sebagai gambar di perangkat.)

## My images

Ketika sebuah tool memungkinkan Anda menambahkan gambar dari perangkat, gambar itu disimpan persis seperti saat datang - sehingga Content Credential padanya tetap terverifikasi - dan masuk ke pustaka **My images** pribadi Anda (di bawah **Profile → Storage**). Hanya berkas yang benar-benar besar yang menanyakan apakah akan disimpan apa adanya atau diubah ukurannya. Pakai ulang di tool mana pun. Untuk membersihkan EXIF/GPS saat gambar masuk, nyalakan **Strip metadata from uploads** di profil Anda. Tidak ada batas: pustakanya sepenuhnya lokal dan hanya dibatasi oleh penyimpanan perangkat Anda - kelola atau hapus gambar di sana.

## Catalogue - pustaka aset Anda

**Catalogue** (`#/c`, atau segmen **Catalog** pada sakelar Projects · Tools · Utilities · Catalog di bagian atas setiap tampilan daftar) mengumpulkan semua yang bisa dipakai tool Anda - logo brand, gambar, audio dan gerak, dikelompokkan menurut jenisnya - dan di sinilah **berkas kreatif Anda sendiri** juga tinggal. Tanpa server, tanpa konsol admin, tanpa pull request: semuanya ada di perangkat Anda.

![Catalogue - aset brand, swatch dan font, ditambah unggahan Anda sendiri](/t/url-shot?url=%2F%23%2Fc%3Fsection%3Dswatches%2Cfonts&width=1440&height=900&dpi=96&waitMs=2400&css=.plat-swatch-grid~%2A%7Bdisplay%3Anone%7D&walker=1&format=svg&localize=1&dark=1&filename=catalogue)

- <!--i:upload--> **Bawa masuk file Anda.** Seret gambar, SVG, klip audio, video, Lottie, PDF atau deck PowerPoint apa pun ke area unggah - atau klik untuk memilih - dan file itu langsung masuk ke katalog Anda, siap di asset picker tiap alat. PDF multi-halaman atau sebuah `.pptx` akan menanyakan halaman atau slide mana yang ingin disimpan - masing-masing menjadi aset SVG. Ingest sebanyak yang Anda mau; ia tidak pernah keluar dari perangkat Anda.
- <!--i:star--> **Jadikan favorit apa yang sering Anda gunakan.** Beri ★ pada sebuah aset (atau swatch brand) dan ia akan disematkan ke atas tiap picker, sehingga logo atau warna andalan Anda hanya sejauh satu klik.
- <!--i:folder--> **Rapikan.** Kategorikan ulang sebuah aset ke grup lain, sembunyikan aset brand bersama yang tidak Anda gunakan (dengan **Show hidden** untuk memunculkannya kembali) atau hapus unggahan Anda sendiri sepenuhnya. Gesture multi-select dan action bar mengambang yang sama seperti di Projects juga berfungsi di sini, jadi semua itu bisa dilakukan pada seluruh pilihan sekaligus.
- <!--i:layers--> **Pisahkan video dari latar belakangnya.** Buka detail sebuah video atau klik kanan kartunya di asset picker mana pun dan pilih **Remove background…** untuk menyimpan alternatif transparan - sebuah WebP atau PNG beranimasi dengan alpha sungguhan. Pilih sebuah **Method**: sebuah **On-device model** memotong subjek keluar dari adegan yang ramai, atau sebuah **Colour key** mengunci keluar latar belakang datar yang diterangi merata seperti green screen atau dinding polos, dengan **Tolerance**, **Softness** dan **Spill removal** untuk menyetel tepiannya. Colour key tidak perlu unduhan model atau jaringan, jadi **Remove background** ditawarkan pada video apa pun dan sering lebih bersih pada footage yang rapi. Sebuah kontrol **Resolution** (360, 480, 720 atau 1080p, tidak pernah melebihi sumber) menukar detail dengan file yang lebih kecil dan lebih cepat. Ini berjalan sebagai background job di perangkat Anda. Cut-out yang jadi disimpan di samping yang asli sebagai aset sendiri dan Content Credential video sumbernya ikut serta sebagai bahan. (Lihat [Generated once, rendered the same](/info/ai-features.html) untuk alasan mengapa menghapus latar belakang tetap dianggap sebagai edit biasa.)

### Bawa palet dan font Anda ke mana saja

Panel **Swatches** di Catalogue tidak sekadar menampilkan - klik sebuah warna untuk menyalinnya, atau **unduh seluruh palet brand** dalam format yang dipahami tool Anda yang lain:

- <!--i:code--> **Design tokens (JSON)**, **CSS variables** atau **CSS classes** - masukkan brand langsung ke sebuah stylesheet atau proses build;
- <!--i:palette--> **Adobe Swatch Exchange (.ase)** - muat ke Illustrator atau Photoshop;
- <!--i:pentool--> **GIMP palette (.gpl)** - untuk GIMP atau Inkscape.

![Panel Swatches - lima tombol unduh palet di bagian atas, lalu setiap warna brand sebagai chip yang bisa disalin](/t/url-shot?url=%2F%23%2Fc%3Fsection%3Dswatches&width=1440&height=900&dpi=96&waitMs=1800&css=.cat-group%3Anot%28%5Bdata-group%3Dswatches%5D%29%7Bdisplay%3Anone%7D&cropSelector=%5Bdata-group%3Dswatches%5D&walker=1&format=svg&dark=1&filename=use-swatch-downloads)

Panel **Fonts** mencantumkan huruf brand Anda dengan tombol **download** di samping masing-masing, untuk dipasang secara lokal atau diserahkan ke percetakan. (Ruang Colours di [Brand Studio](/info/brand-studio.html) menawarkan unduhan palet yang sama.)

Aset adalah separuh dari jalur terbuka yang bisa Anda kerjakan sendiri; separuh lainnya adalah **membuat tool Anda sendiri** - kanvas bebas (Design, yang dijelaskan di atas) memungkinkan Anda membangunnya secara visual, tanpa perlu kode.

## Suara & aksesibilitas

Lolly berupaya nyaman digunakan oleh semua orang. Antarmukanya bisa dinavigasi dengan papan ketik, kontrol khususnya membawa label yang benar untuk pembaca layar dan pratinjau langsung setiap tool disajikan sebagai satu gambar berlabel yang menjelaskan apa yang sedang dibuatnya.

Lapisan lembut **suara bantuan** menegaskan apa yang Anda lakukan - tiba di galeri, hasil pemeriksaan Content Credentials yang sah vs. tidak sah, menutup panel, mengganti filter. Fitur ini **mati secara bawaan**: nyalakan **Sound** di mana pun sakelarnya muncul (popover opsi tiap tampilan, atau **Profile**), dan pilihan itu diingat.

Empat pengaturan kenyamanan opsional ada di **Profile → Accessibility**: **Reduce motion** (menghilangkan transisi dan hiasan gerak aplikasi), **Hide colourful previews** (kartu galeri yang tenang berupa ikon dan teks, serta gambar mini proyek yang lebih kalem), **High contrast** (garis tepi, teks dan cincin fokus yang lebih tegas) dan **Large text** (huruf aplikasi lebih besar - label, menu, teks tombol). Keempatnya menenangkan aplikasi *di sekeliling* karya Anda: semuanya tidak pernah menjangkau ke dalam kanvas tool atau mengubah satu piksel pun dari yang Anda ekspor, dan masing-masing mati sampai Anda menyalakannya. Detail lengkap di [Profil Anda → Accessibility](/info/profile.html#accessibility).

Di samping sakelar Sound ada **Neurospicy Mode** - trek fokus latar yang menenangkan dan opsional, yang berputar pelan selagi Anda bekerja. Menyalakannya membuka **dok pemutar** kecil di sudut bawah yang mengikuti Anda ke seluruh aplikasi; dari sana Anda bisa mencari dan memilih trek, melompat maju dan mundur, mengatur volume serta mengecilkan atau menutupnya. Daftar treknya mencakup beberapa kategori - lagu prosedural *Lolly Sings*, ambient loop dan beat, audio unggahan Anda sendiri dan sejumlah stasiun **radio** internet langsung (yang ini butuh koneksi; selebihnya berputar secara luring). Fitur ini **mati secara bawaan** dan, seperti Sound, diingat lintas sesi dan perangkat. Mematikan Sound juga membisukan trek fokusnya.

## Penyimpanan & privasi

Semuanya disimpan di basis data lokal peramban Anda (IndexedDB): profil Anda, sesi tersimpan, gambar unggahan dan cache konten katalog yang sudah diunduh. **Profile → Storage** menampilkan pemakaiannya dan memungkinkan Anda:

- <!--i:box--> **Clear cache** - membuang konten katalog yang sudah diunduh (tersinkron ulang pada pemuatan berikutnya).
- <!--i:trash--> **Clear all my data** - menghapus profil, sesi dan gambar. *Tidak bisa dibatalkan.*

![Kartu penyimpanan pada layar selebar ponsel: setiap kategori data di perangkat disebutkan, dengan tombol Clear all my data di bagian bawah](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-manages%2C.storage-subsection%2C.store-selbar%2C.store-chip-val%2C%23store-hero-num%2C%23store-headroom%2C%23store-quota%2C%23store-reclaim%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

Tidak ada satu pun data lokal ini yang dikirim ke mana pun - tanpa telemetri, tanpa render di awan. Daftar lengkap apa saja yang pernah diambil atau dikirim aplikasi ada di [Kebijakan Privasi](/info/privacy.html), dan [Server Surface](/info/server-surface.html) menginventarisasi komponen server opsionalnya.

## Pindah ke perangkat lain

Karena semuanya ada di perangkat Anda, **Profile → Storage → Move to another device** memungkinkan Anda membawa semuanya ke pemasangan kedua - tanpa akun, tanpa awan:

- <!--i:download--> **Export my data** mengunduh satu `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` (bagian namanya diambil dari profil Anda dan dihilangkan jika kosong; `<n>` adalah penghitung harian agar ekspor pada hari yang sama tidak bertabrakan) yang berisi profil Anda, setiap sesi tersimpan (beserta gambar mininya), gambar unggahan Anda dan preferensi Anda (tema, lebar sidebar, statistik aktivitas lokal).
- <!--i:upload--> **Import data…** di pemasangan yang lain membaca kembali berkas itu. Prosesnya **menggabungkan**: apa pun yang bernama sama (profil Anda, sebuah slot sesi, sebuah gambar) diganti oleh salinan yang diimpor; selebihnya di perangkat itu dipertahankan. Sesi tersimpan otomatis terhubung kembali ke gambar yang Anda impor.

Cache katalog tidak disertakan - katalog mengunduh dirinya lagi di perangkat baru. Bundelnya adalah zip biasa (`manifest.json` + `profile.json` + `sessions.json` + `assets.json` + `assets/blobs/…` + `prefs.json`, id format `lolly-backup`), jadi ia selamat utuh lewat email, USB atau AirDrop dan formatnya sama untuk semua shell. Setiap bagian diberi checksum, sehingga berkas yang rusak dalam perjalanan ketahuan saat impor alih-alih dipulihkan setengah rusak. (Spesifikasi format lengkap: [Data Transfer](/info/data-transfer.html).)

## Mengimpor desain (Figma, Penpot, Illustrator, InDesign)

Anda bisa membawa desain yang sudah ada ke Lolly dan terus mengerjakannya: buka **Design**, klik **Import a design** di bilah alat kanvas, lalu pilih **.fig** atau SVG dari Figma, **.penpot** dari Penpot, **.ai** / **.pdf** dari Illustrator atau **.idml** dari InDesign. Lapisan menjadi kotak yang bisa disunting di kanvas bebas - teks tetap bisa diketik ulang, gambar masuk ke **My images** dan huruf serta warna menyesuaikan dengan global brand - lalu hasilnya bisa disimpan, dibagikan dan dirender seperti sesi lain. Penguraiannya terjadi sepenuhnya di perangkat Anda. Detail lengkap: **[Impor desain](/info/design-import.html)**.

## Mengekspor

Lihat **[Ekspor & Format](/info/exporting.html)** untuk cerita lengkapnya - memilih format, ukuran keluaran dan satuan cetak, transparansi, video serta salin/bagikan. Singkatnya: pilih format, atur ukurannya bila perlu lalu **Download** (atau **Copy** ke papan klip).

## Mode Batch (Pro)

Untuk pengguna tingkat lanjut, **Batch** (tertaut dari galeri, dibatasi oleh flag fitur Pro yang aktif secara bawaan) merender banyak variasi sekaligus - sebuah kisi yang setiap barisnya adalah satu set input, diekspor bersamaan. Ideal untuk melokalkan sebuah kartu ke belasan bahasa atau menghasilkan setiap varian ukuran dalam satu jalan. Isi barisnya dengan mengetik, menempel langsung dari spreadsheet atau mengimpor CSV (Anda juga bisa mengekspornya kembali), dan atur format, ukuran serta nama berkas keluaran per baris. Simpan satu kisi utuh sebagai **sesi batch** bernama yang bisa dibuka lagi dari galeri, dan unduh setiap barisnya sebagai satu `.zip`.

![Toolbar batch - nama zip, unit, DPI dan format yang diwarisi tiap baris, dengan Sessions dan Render di kanan](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&cropSelector=.pro-toolbar&walker=1&format=svg&dark=1&filename=use-batch-toolbar)

Batch untuk menghasilkan **banyak varian dari satu templat** sekaligus. Untuk merender ulang sesi yang **sudah Anda simpan**, gunakan **Projects → Render folder / Render selection** (di atas) - tanpa perlu Pro.

## Menyunting berdampingan (Multi-edit)

Batch adalah banyak varian dari *satu* desain. **Multi-edit** adalah setengah pekerjaan lainnya: beberapa desain tersimpan yang **berbeda** dibuka sekaligus, sehingga satu perubahan berlaku untuk semuanya. Centang **dua hingga delapan** sesi tersimpan di **Projects** dan pilih **Edit together** dari selection bar; mereka terbuka sebagai kartu live berdampingan di `#/multi?s=<slot>,<slot>…`. Tiap kartu adalah render sungguhan dari sesi itu, bukan thumbnail tersimpan, jadi apa yang Anda lihat adalah apa yang akan diekspor.

Satu sidebar mengendalikan semuanya:

- <!--i:sliders--> **Shared** memimpin - berisi setiap input yang dideklarasikan dua sesi terpilih atau lebih dengan *cara yang sama* (id sama, tipe sama, batasan sama - aturan penggabungan yang sama seperti yang dipakai kisi batch pada kolomnya). Sunting satu kontrol bersama sekali dan nilainya menyebar ke setiap sesi yang mendeklarasikannya, langsung di setiap kartu. Dua sesi dari tool yang sama berbagi segalanya; dua tool berbeda berbagi apa pun yang kebetulan sama, dan tidak lebih.
- <!--i:document--> Di bawahnya, **satu kartu terlipat per sesi** berisi seluruh input milik sesi itu, dengan kesetiaan yang sama seperti sidebar tool-nya sendiri - pemilih aset, grup baris berulang, kolom warna - ditambah blok ekspor ringkas: **Format**, **W** / **H**, **Unit**, **DPI** dan **Download** miliknya sendiri. Download itu menyimpan sesinya lebih dulu lalu merendernya lewat jalur ekspor sesi yang biasa, sehingga berkasnya membawa nama berkas, format dan Content Credentials yang sama seperti bila diekspor langsung dari tool-nya.
- <!--i:search--> **Filter inputs…** di bagian atas mempersempit kontrol di *seluruh* kartu sekaligus - begitulah cara Anda mencapai "judul utama" pada delapan sesi tanpa harus menggulir mencarinya.

Klik kanvas mana pun (atau tekan Enter padanya) dan kartu sidebar sesi itu terbuka lalu tergulir ke tampilan. **Save all** menuliskan setiap sesi kembali ke slotnya masing-masing. **Download all** menyimpan lebih dulu, lalu merender seluruh set lewat alur yang sama dengan **Render selection** di Projects - satu zip, dengan kunci kata sandi opsional yang ditawarkan di tengah jalan.

Dua batasan yang jujur. Batas dua sampai delapan itu nyata: setiap kartu memasang runtime langsungnya sendiri, dan itulah jumlah yang tetap responsif - tautan yang meminta lebih banyak (atau meminta sesi yang sudah tidak ada) akan mengatakannya alih-alih memuat separuh. Dan tautannya menyebut slot simpanan *Anda*, jadi ia membuka kembali set itu di perangkat ini; ini bukan tautan berbagi.

Ketika seleksinya lebih dari delapan, mencampur beberapa tool atau memuat gambar selain sesi, jalan keluarnya adalah **Edit as sheet** di bilah seleksi yang sama: ia membuka seluruh seleksi sebagai **baris di kisi batch** (`#/pro?s=…`), tanpa batas jumlah dan tanpa aturan harus satu tool. Folder tidak termasuk pada keduanya - folder punya jalur buka-di-kisi sendiri. ([Cari](/info/search.html) adalah satu-satunya hal yang belum menjangkau ke sini: Multi-edit adalah satu-satunya tampilan yang tidak dikenali bilah pencarian.)

## Luring & pemasangan

Lolly adalah PWA. Setelah pemuatan pertama, Lolly bekerja **luring** - pasang dari bilah alamat peramban Anda (atau *Add to Home Screen* di ponsel) untuk pengalaman layar penuh seperti aplikasi. Lolly memperbarui dirinya sendiri ketika Anda kembali daring.

Tentang update: jika sebuah view gagal dimuat tepat setelah update (panel kosong, sebuah "failed to fetch" di sudut), muat ulang halamannya sekali - aplikasi akan mengambil versi baru secara bersih dan pekerjaan, sesi serta brand Anda tidak tersentuh. Ia menyimpan semuanya di perangkat Anda, bukan di halaman.
