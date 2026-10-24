# Design: kanvas bebas

Design adalah alat untuk tata letak yang tidak tercakup templat mana pun: poster dari nol, deck slide, karya gerak dengan soundtrack. Alih-alih formulir kontrol, Anda mendapatkan kanvas berisi kotak yang dapat Anda seret, ubah ukurannya, putar, dan ketik di dalamnya. Ia mengekspor melalui jalur render yang sama seperti alat lain, jadi apa yang Anda lihat di kanvas adalah file yang Anda dapatkan.

Halaman ini menelusuri kanvas dari kotak pertama hingga deck selesai: jendela, membentuk kotak, menggambar bentuk sendiri, menempatkan adegan 3D dan alat lain, menambahkan waktu, memeriksa hasil, dan mempresentasikan deck jadi. [Using Lolly](/info/using.html) membahas apa yang dibagikan Design dengan setiap alat, seperti menyimpan dan berbagi.

![Kanvas bebas Design - artboard beserta meja kerja di sekitarnya](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZTfS8MwEMf_mryO5NZ288GHrdqJv1CUvWdtOgppMtJMNv96yaV1iRNEQRBZoblwab53l0-uq915bXgrCOSDpf3LzgANnQ4eI0rrPJn7Gh9cd0sE8lIryxtFIFfatFx6L4F0Mi-11GbUiZYr25QjK3bW-S8I5MnUbRXKCkMgb5uqki6JFFU7rjoXYsSgT8GaLebKZSeGAPkUYypMHp80DeugYYR4J_U7X4XRkY8dFHuTYEJ-jDWM3qoqsEHo4Y20-xJi-SPVaOfRUuAL1hiZXNrG4gH6M85Z5lTAk8x8DdlnPL8gecVfBIEU6F5v0bbCor3VUu4JpOPCKTCWsPI9rBS107d6QyCfRET_Ac6wX36X6UpX-49Ip1mAlMEPkM6QX20aoSpECLTmpadcazPQ9hPlWxboRndWmFEIG1s4Yp3E3Ts-0f4GbcruWHLzlC0frmfpfbGk82LxmD0vUndSTcvXAoknWBKCz5LDSIdiRHV0D2Tfq1BIvdY42Zim5WZ_-n3_mRvwBg&width=1360&height=850&dpi=192&waitMs=3000&format=svg&walker=1&chrome=1&localize=1&dark=1&filename=design)

## Jendela Design

**Bilah atas** dimulai dengan **Home**, **File menu**, dan nama dokumen (klik nama untuk mengganti nama dokumen). Bagian tengah memuat **Undo**, **Redo**, **History**, kontrol zoom (dengan **Fit all** dan **Fit artboard**), dan sakelar untuk **Timeline**, **Navigator**, dan **Inspector**. Di kanan ada **Share**, **Present**, dan **Export**. Di ponsel, tombol yang lebih jarang dipakai pindah ke **More actions**.

**Rel alat** di sisi memuat menu Lolly dan alat untuk menggambar: **Pointer**, **Add a box**, **Pen**, **Edit points**, **Line**, lalu tombol Timeline, Artboards, dan Auto-arrange.

![Rel tool kanvas bebas: pegangan seret, menu Lolly, lalu Pointer, Add a box, Pen, Edit points, Line, Timeline, Artboards dan Auto-arrange](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3D__blank__&width=1440&height=900&dpi=192&waitMs=2600&css=.fc-toolbar%7Bopacity%3A1!important%7D&cropSelector=.fc-toolbar&walker=1&format=svg&dark=1&filename=pen-editor-rail)

Kanvas bekerja seperti pasteboard desainer di sekitar artboard:

- **Parkir kotak di luar artboard.** Seret kotak melewati tepi bingkai dan ia tetap terlihat serta dapat dipilih. Semua di luar bingkai dipudarkan, dan bingkai mempertahankan bayangannya untuk menandai tempat file dimulai.
- **Hanya artboard yang diekspor.** Apa pun di luar bingkai, atau bagian kotak yang menggantung melewati tepi, dipotong dari keluaran pada format raster maupun vektor.
- **Zoom out melewati Fit** untuk melihat semua yang Anda parkir.
- **Ubah ukuran artboard** dengan mengubah ukuran ekspor. Kotak mempertahankan posisinya, jadi Anda dapat membingkai ulang tata letak di sekitar konten yang ada.

![Panggung penyuntingan: artboard di depan dan tengah, rel alat di kiri, dan zoom HUD di sudut](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.fc-toolbar%7Bopacity%3A1!important%7D&format=svg&walker=1&chrome=1&dark=1&filename=seq-studio-stage)

### Navigator dan Inspector

**Navigator** mencantumkan setiap artboard (berjudul **Artboards**, atau **Slides** dalam deck) sebagai grup lipat dari **Layers**-nya. Pilih nama artboard untuk melompat ke sana, bentangkan untuk memilih atau menyusun ulang layer-nya, dan gunakan tombol panah untuk bergerak di daftar; Left kembali ke judul artboard. **Pages** mengelompokkan artboard ke halaman bernama, dan memilih halaman hanya mengubah artboard mana yang ditampilkan editor.

**Inspector** menaruh kontrol teks atau gambar objek terpilih lebih dulu. Chip opsi mencakup pilihan cepat, dan **Advanced** memuat detail gaya. Di ponsel Inspector terbuka sebagai sheet dari **More actions**; Escape atau Back menutup sheet dan mempertahankan pilihan Anda.

![Bagian Document pada Inspector: tab Selection dan Canvas, lalu Dimensions dan Style & look](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour&width=1440&height=900&dpi=192&waitMs=3500&cropSelector=.fc-insp&walker=1&format=svg&dark=1&filename=design-narration)

## Ubah ukuran, skala, dan putar

Pilih objek, lalu seret handle untuk mengubah ukurannya, atau seret handle bulat di bawah pilihan untuk memutar objek. Seretan ukuran bekerja dalam salah satu dari dua mode:

- **Resize**, yang default, hanya mengubah kotak. Teks dibungkus ulang ke ukuran baru, dan ukuran font, lebar garis, radius sudut, dan efek tetap seperti semula.
- **Scale** memperbesar atau memperkecil seluruh objek beserta isinya: ukuran font, garis, radius sudut, bayangan, blur, padding, dan jarak semuanya berubah dengan jumlah yang sama.

Tekan `K` untuk menyalakan atau mematikan Scale. Tanpa keyboard, pilih **Scale mode** di menu Lolly, atau tekan dan tahan tombol **Pointer** di rel (atau klik kanan tombol itu) dan pilih **Scale**; di layar sentuh bilah objek juga memiliki sakelar Scale. Selama Scale aktif, tombol Pointer menampilkan ikon Scale dan setiap handle memiliki titik di tengahnya. `V` atau **Escape** kembali ke Resize dan mempertahankan pilihan Anda. Setiap dokumen terbuka dengan Scale mati, sehingga tidak ada yang menskalakan garis secara tidak sengaja.

**Skala dengan angka.** Dengan Scale aktif, atau dengan beberapa objek terpilih, klik angka di bilah objek untuk membuka popover **Scale**. Ketik persentase, lebar, atau tinggi, pilih titik yang tetap diam pada grid 3 x 3, dan pilih **Apply**. Setiap skala adalah satu langkah undo.

**Beberapa objek.** Pilihan beberapa objek memiliki handle di tepinya selain di sudutnya. Selama setiap objek tegak atau diputar dalam kelipatan seperempat putaran, dan pilihan tidak memuat grup atau lingkaran, seretan sudut mengubah lebar dan tinggi dengan bebas. Jika tidak, pilihan mempertahankan proporsinya dan angka menambahkan **Proportional**. Saat Anda menyeret, label kecil menampilkan ukuran, atau persentase dalam mode Scale.

**Balik sebuah pilihan.** Klik kanan dan pilih **Flip horizontal** atau **Flip vertical**, atau tekan `Shift+H` atau `Shift+V` (Shift, karena `V` saja adalah Pointer). Cerminannya adalah transformasi sungguhan, sehingga SVG, PDF, dan PNG yang diekspor mempertahankan pembalikan.

**Tombol yang Anda tahan selama seretan** berlaku begitu Anda menekan atau melepasnya; lembar pintasan (`?`) juga mencantumkannya.

| Tahan | Mengubah ukuran atau skala | Memutar | Memindahkan |
|---|---|---|---|
| **Shift** | Mempertahankan proporsi (Scale selalu begitu) | Memutar dalam langkah 15 derajat | Tidak ada perubahan |
| **Alt** (Option) | Bekerja dari pusat | Memutar bebas | Mematikan snapping dan grid |
| **Cmd/Ctrl** | Mematikan snapping dan grid | Memutar bebas | Mematikan snapping dan grid |

Tanpa tombol yang ditahan, putaran ditarik ke 15 derajat terdekat begitu berada dalam 4 derajat darinya. Artboard tidak berputar, jadi tidak memiliki handle putar.

::: details Handle, zona genggam, dan sentuh
**Genggam di mana saja di sepanjang tepi.** Setiap sisi pilihan adalah strip ubah ukuran di sepanjang panjangnya, dan dengan mouse atau pen ada zona putar tepat di luar setiap sudut. Penunjuk menunjukkan apa yang akan dilakukan seretan. Tekanan di strip atau zona baru menjadi perubahan ukuran atau putaran begitu Anda mulai menyeret, jadi klik biasa tetap memilih seperti sebelumnya. Objek terkunci tidak memiliki handle, strip, atau zona.

**Objek kecil tetap dapat dipindahkan.** Pada objek selebar 25 piksel layar atau kurang, handle tengah disembunyikan dan yang lain bergeser sedikit ke luar dari garis tepi, sehingga menekan objek memindahkan objek. Pada 10 piksel atau kurang handle sudut juga hilang, dan garis tipis mempertahankan handle di setiap ujung. Tekanan tepat di samping garis tipis atau objek mungil, di luar handle-nya, memindahkan objek.

**Area genggam besar.** Di layar sentuh setiap zona sudut berukuran seperempat lebar dan tinggi pilihan di layar, antara 24 dan 44 piksel, dan setiap zona sisi mencakup bentangan antara dua sudut. Bila pilihan terlalu kecil untuk itu, zona pindah ke luar garis tepinya. Zona di bawah penunjuk atau jari Anda diarsir. Untuk mendapatkan zona yang sama dengan mouse atau pen, aktifkan **Large grab areas** di menu Lolly; pengaturan tetap di perangkat ini.

**Dua jari pada pilihan.** Di layar sentuh, letakkan dua jari pada objek terpilih: cubit untuk menskalakan, putar untuk memutar, atau gerakkan kedua jari untuk membawa pilihan, semuanya sebagai satu langkah undo. Dengan Scale aktif, cubitan juga menskalakan isinya; dengan Scale mati, ia mengubah ukuran secara proporsional. Putaran menjepret ke 15 derajat terdekat bila dekat, dan gerakan dua jari tidak pernah menjepret. Jari pertama harus mendarat di pilihan dan yang kedua harus menyusul dengan cepat, di pilihan atau tepat di luar tepinya. Dua jari di tempat lain memperbesar dan menggeser tampilan, begitu pula dua jari pada pilihan yang memuat artboard atau objek terkunci, menutupi sebagian besar tampilan, atau melewati tepinya.
:::

## Gambar bentuk Anda sendiri

Kotak, lingkaran, dan bingkai bulat mencakup sebagian besar tata letak. Untuk bentuk lain, gambarlah: tombol **Pen** di rel (atau `P`) membawa Anda ke mode menggambar. Tiga tombol tunggal berpindah antar mode: `V` untuk Pointer, `P` untuk Pen, dan `N` untuk **Edit points**. Pointer selalu menjadi jalan keluar.

- **Klik** untuk menempatkan titik. Pada tipe kurva default, **klik dan seret** menarik handle titik untuk membuat kurva; tahan **Alt** saat mengeklik untuk sudut keras. (Pada tipe kurva lain setiap titik adalah sudut dan seretan tidak berefek.)
- Titik menjepret ke artboard dan kotak lain saat Anda menempatkannya. Alt menekan grid saat Anda menggambar, dan grid serta tepi sekaligus saat Anda menyeret titik sesudahnya.
- **Klik titik pertama Anda** untuk menutup bentuk. Jika tidak, tekan **Enter**, klik dua kali, atau ganti alat, dan gambar dipertahankan.
- **Escape** bekerja satu langkah demi satu: tekanan pertama membatalkan gambar, yang kedua meninggalkan pen.
- **Delete** saat menggambar menghapus titik terakhir.

Hasilnya adalah kotak biasa. Pindahkan, ubah ukuran, putar, kelompokkan, ratakan, susun ulang, isi, beri bayangan, atau pudarkan path seperti kotak lain. Path pertama mengambil isian dan garis yang diberikan brand Anda untuk path, dan setiap path baru sesudahnya mengambil apa pun yang terakhir Anda pakai. Pada alat yang brand-nya tidak menetapkan apa pun untuk path, path baru digaris dengan warna yang Anda pakai untuk menggambar, sehingga bentuk tidak pernah tak terlihat.

**Sunting titiknya lagi.** Klik dua kali bentuk, atau gunakan **Edit points** di bilah objek. Seret titik untuk memindahkannya, seret handle untuk mengarahkan ulang kurva, klik pada kurva untuk menyisipkan titik, atau seret kotak mengelilingi beberapa titik dan tekan Delete. Path selalu mempertahankan setidaknya dua titik.

**Tipe spline** menentukan jenis kurva yang melewati titik Anda:

| Tipe | Fungsinya |
|---|---|
| **Smooth (auto)** | Default. Menghitung sendiri panjang handle, sehingga klik biasa menghasilkan kurva halus. Handle yang Anda atur mengunci arah, dan kurva tetap menentukan panjangnya. |
| **Bezier handles** | Pen klasik: Anda mengendalikan setiap handle, dan menyisipkan titik tidak pernah menggeser kurva. |
| **Through the points** | Melewati setiap titik dengan tepat, tanpa handle. |
| **B-spline** | Mengalir di dekat titik, bukan melaluinya, untuk garis yang lebih lembut. |
| **Straight lines** | Polyline. |

Mengganti path yang ada ke tipe yang menghitung sendiri handle-nya akan bertanya dulu, karena panjang handle yang Anda atur tidak dapat dipulihkan; beralih ke **Bezier handles** selalu tanpa kehilangan. Di tengah menggambar, pergantian berlaku langsung, dan handle yang sudah Anda tarik dibuang.

Setiap titik juga membawa aturan kontinuitas, ditunjukkan oleh bentuknya: persegi untuk **Corner** (handle bergerak bebas), bulat untuk **Smooth** (handle tetap segaris), dan bulat dengan cincin untuk **Symmetric** (segaris dan sama panjang). Atur aturan untuk titik terpilih dan kurva langsung mengikuti.

![Dua path pena yang dirender langsung dari sebuah tautan: kurva S bergaris dan gumpalan tertutup berisi warna](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22curve%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A140%2C%22y%22%3A180%2C%22w%22%3A800%2C%22h%22%3A420%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A14%2C%22path%22%3A%221!cubic!0_.02!.85!!!.25!-.45!s_.5!.5!-.22!.32!.22!-.32!y_.98!.12!-.25!.45!!!s%22%7D%2C%7B%22id%22%3A%22blob%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A340%2C%22y%22%3A620%2C%22w%22%3A400%2C%22h%22%3A320%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23d1e7ff%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A6%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!catmull-rom!1_.5!0_1!.42_.78!1_.22!1_0!.42%22%7D%5D&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=pen-path-geometry)

Path yang digambar ikut dalam tautan berbagi seperti kotak lain dan dirender sama dari baris perintah.

## Gabungkan bentuk

Pilih dua atau lebih bentuk, klik kanan kanvas (ketuk dua jari pada sentuh) dan pilih:

- **Union** menggabungkannya menjadi satu bentuk dengan cat milik yang teratas.
- **Subtract** memotong semua di atasnya dari bentuk terbawah.
- **Intersect** hanya menyisakan bagian yang tumpang tindih.
- **Exclude** menyisakan semuanya kecuali bagian yang tumpang tindih.

Tiga lagi bekerja pada satu bentuk. **Outline stroke…** mengubah garis menjadi kontur terisi dengan ketebalan sama. **Offset path…** memperluas kontur ke luar atau, dengan angka negatif, menyusutkannya ke dalam. **Simplify** membangun ulang path dengan segmen lebih sedikit pada kontur yang sama.

![Bulan sabit dan cincin dengan lubang sungguhan, keduanya dihasilkan oleh Subtract](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22crescent%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A120%2C%22y%22%3A330%2C%22w%22%3A374%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22path%22%3A%221!cubic!1_.750491!.957645!-.128211!-.062578!-.065985!.027232!c_.534759!1!.076762!!-.295339!!c_0!.5!!.276142!!-.276142!c_.534759!0!-.295339!!.200102!!c_1.000984!.254923!-.09169!-.152161!-.021205!-.003239!c_.935829!.25!.022185!!-.221505!!c_.534759!.625!!-.207107!!.14459!c%22%7D%2C%7B%22id%22%3A%22ring%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A580%2C%22y%22%3A330%2C%22w%22%3A400%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!cubic!1_1!.5!!-.276142!!.276142!c_.5!1!.276142!!-.276142!!c_0!.5!!.276142!!-.276142!c_.5!0!-.276142!!.276142!!c*1!cubic!1_.5!.7!-.110457!!.110457!!c_.7!.5!!.110457!!-.110457!c_.5!.3!.110457!!-.110457!!c_.3!.5!!-.110457!!.110457!c%22%7D%5D%26w%3D1080%26h%3D1080&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&filename=path-ops-boolean-result)

Hasilnya adalah path baru yang dapat terus Anda sunting dengan pen, disimpan sebagai kurva Bezier biasa, sehingga tipe spline aslinya tidak terbawa. Lubang adalah lubang sungguhan: kontrol **Fill rule** pada panel garis menentukan apakah kontur yang tumpang tindih terisi (*non-zero*) atau berlubang (*even-odd*). Operasi menolak daripada merusak: minta memotong irisan dua bentuk yang tidak tumpang tindih dan tidak ada yang berubah. Kotak teks dan gambar tidak memiliki kontur, jadi dibiarkan.

## Adegan 3D dan alat di dalam desain

Kotak dapat memuat lebih dari sekadar gambar. Kedua jenis di bawah menyimpan resep, bukan gambar yang sudah dirender, sehingga digambar ulang pada ukuran dan saat yang diminta dokumen, dan pembaruan pada sumber mencapai setiap desain yang memakai sumber itu.

### Scene 3D

Pilih **3D scene** dari menu tambah di rel dan seret keluar sebuah bingkai: 3D Studio terbuka pada kotak baru, dan apa yang Anda atur di sana kembali ke kanvas. Sesudahnya, **Edit in 3D Studio** di bagian **3D scene** pada Inspector membuka kembali studio. [Place a scene in Design](/info/3d-studio.html#place-a-scene-in-design) membahas poster, garis waktu, ekspor, dan berbagi.

### Alat di dalam desain

Pilih **Image** dari menu tambah di rel, seret keluar sebuah bingkai, dan pilih alat di tab **Tools** pada pemilih. Alat mengisi bingkai dengan defaultnya, dan Inspector terbuka pada bagian **Tool** yang memuat kontrol alat itu sendiri. Ubah field dan kotak diperbarui sesaat kemudian, sebagai satu langkah undo. **Image fit** dan **Image position** bekerja seperti pada gambar mana pun, dan **Replace with another tool or image** menukar isi kotak.

**Alat yang bergerak** diputar di dalam kotak: ilustrasi yang berulang tetap berulang di kanvas, mengikuti playhead begitu garis waktu terbuka, dan diekspor bingkai demi bingkai ke GIF, MP4, atau WebM. Bila alat menyebut berapa lama satu putaran berlangsung, kotak mendapatkan klip sepanjang itu persis, sehingga video memuat putaran utuh. Klip yang Anda atur ulang waktunya mempertahankan pengaturan Anda, dan mematikan gerak alat membuat kotak kembali menjadi gambar diam.

## Timeline (Sequence)

**Sequence** adalah garis waktu Design: ia menambahkan waktu ke kanvas. Setiap kotak dapat mulai pada suatu saat, berjalan selama durasi tertentu, dan beranimasi masuk dan keluar, dan garis waktu yang ditambatkan di bawah artboard adalah tempat Anda menatanya. Mulai dari templat **Video** Design dan urutan singkat sudah tersedia: dua kartu teks bertempo di baris urutan dan latar musik prosedural di bawahnya, sehingga Anda dapat melihat cara kerja garis waktu sebelum mengubah apa pun.

![Timeline Sequence: transport, penggaris, sebuah jalur overlay, baris sequence magnetis dengan klip dan chip sambungannya serta strip Always on](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A252px!important%7D&cropSelector=.tl-panel&format=svg&walker=1&tolerance=0.03&dark=1&filename=seq-studio-timeline)

Ada dua jenis baris:

- **Baris urutan** bersifat magnetik. Klip berurutan ujung ke ujung, menyeret satu menyusun ulang rangkaian, dan menghapus satu menutup celah. Ini adalah tulang punggungnya.
- **Jalur overlay** bebas. Lower-third, logo, atau teks keterangan melayang di atas tulang punggung pada waktunya sendiri, masing-masing di jalurnya.
- Di bawahnya, **Always on** memuat kotak tanpa pengaturan waktu, hadir sepanjang waktu. Tanda `+` pada chip memindahkannya ke jalur; **Make always on** mengembalikannya.

Membuka garis waktu memberinya keyboard, sehingga Space dan tombol panah menggerakkan playhead. Komposisi yang sudah memiliki pengaturan waktu membuka garis waktu dengan sendirinya.

**Menyunting.** Seret bagian tengah klip untuk memindahkannya, seret dekat salah satu ujung untuk memotongnya, dan tekan **Split at playhead** (atau `S`) untuk membaginya menjadi dua. Split memerlukan klip dengan **Length** nyata dan playhead agak ke dalam klip, jadi klip tanpa batas seperti latar musik tidak dapat dibagi. **Snap to edges** aktif secara default, menjepret ke tepi klip, playhead, dan detik utuh; tahan Alt untuk menyeret tanpa menjepret. Setiap seretan adalah satu langkah undo, dan pratinjau saat Anda menyeret memakai aritmetika yang sama dengan hasilnya.

Pilih klip dan inspector memberikan penyuntingan yang sama sebagai angka: **Length**, **Trim in** (seberapa jauh ke dalam sumber klip dimulai), **Speed** dari ×0.25 hingga ×4, **Animate in** dan **Animate out** beserta durasinya, dan **Mute clip**. Klip di baris magnetik tidak memiliki field **Start**, karena baris itu yang memegang urutan.

**Transisi** adalah preset: Fade, Pop, Grow, Rise, Drop, empat Slide, Zoom in dan out, Tilt, Swoop, Spin, Drift, atau **Cut (no animation)**. Jarak diskalakan dengan objek, jadi satu preset terbaca pas pada kartu layar penuh maupun lencana kecil. Di antara dua klip pada baris urutan, **seam chip** memilih **Cut** atau **Crossfade**; buka lagi untuk mengatur **Length (ms)** dan tekan **Done**. Pada crossfade, klip pertama terus diputar melewati potongan dan memudar sementara yang berikutnya muncul, sama di pratinjau dan file.

**Suara.** Klip **Audio** berada di garis waktu seperti klip lain, dengan bentuk gelombang, trim, dan bisu. Latar musik buatan templat Video disintesis saat ekspor, jadi barnya tetap polos dan senyap sampai Anda merender. Tekan mikrofon untuk **merekam voiceover** langsung ke garis waktu, dengan hitung mundur dan pengukur level; rekaman disimpan sebagai aset Anda sendiri pada playhead. Tombol kamera di samping mikrofon **merekam video** dengan cara yang sama, dipotong ke artboard saat merekam, sehingga rekan dapat menambahkan klip dari tautan bersama. Pilih klip bersuara mana pun dan stripnya terbuka di bawah garis waktu untuk volume, pan, EQ, pitch, normalisasi, dan efek seperti **Voice cleanup**; [Sound](/info/sequence-editor.html#sound) dalam panduan editor sekuens membahas strip itu. **Audio track** di panel ekspor terpisah: satu latar di bawah seluruh klip, dengan fade dan ducking.

![Timeline dengan klip musik terpilih: stripnya membentang di sepanjang bagian bawah dengan Speed, Fades, Volume, Pan, EQ, Pitch, Normalize volume dan slot Effect](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fbx%3Dt1%252Ctext%252C200%252C140%252C1500%252C220%252C0%252Crect%252C16%252C%252C100%252C%252Ccontain%252Cnormal%252CVoiceover%252520session%252C%25257Bcolor.semantic.text%25257D%252C48%252Ccenter%252Cmiddle%252C500%252Csans%252C1.12%252C0%252Ctrue%252Cfalse%252C%252C%252C8%252Cnone%252C00000055%252C0%252C0%252C10%252Ccenter%252Cfalse%252C%252C%252C0%252Cnonzero%252C0%252C3.3%252C0%252C1%252Cnone%252Cnone%252C400%252C400%252Cfalse%252Cseq%252C%252Cround%252Cround%252C%252C0%252C0%252C0%252C0%252C%252C%252C%252C0%252Ctrue%252Cnone%252Cnone%252C%252Cfalse%252C%252C%252C%252C0%252C%252C%252Cfalse%252C%252C%252C%252C%252Cfalse%252Cfalse%252C%252C1%252C%252Cfalse%252C%252C60%252C%252C%252C1%257Ea1%252Caudio%252C200%252C500%252C400%252C80%252C0%252Crect%252C16%252C%252C100%252Clolly%25252Floops%25252F3-am-echoes%252Ccontain%252Cnormal%252C%252C%25257Bcolor.semantic.text%25257D%252C48%252Ccenter%252Cmiddle%252C500%252Csans%252C1.12%252C0%252Ctrue%252Cfalse%252C%252C%252C8%252Cnone%252C00000055%252C0%252C0%252C10%252Ccenter%252Cfalse%252C%252C%252C0%252Cnonzero%252C0%252C3.3%252C0%252C1%252Cnone%252Cnone%252C400%252C400%252Cfalse%252C%252C%252Cround%252Cround%252C%252C0%252C0%252C0%252C0%252C%252C%252C%252C0%252Ctrue%252Cnone%252Cnone%252C%252Cfalse%252C%252C%252C%252C0%252C%252C%252Cfalse%252C%252C%252C%252C%252Cfalse%252Cfalse%252C%252C1.3%252C%252Cfalse%252C%252C60%252C%252C%252C1%26_sel%3Da1&width=1440&height=900&dpi=192&waitMs=5000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A300px%21important%7D&cropSelector=.tl-panel&walker=1&format=svg&dark=1&filename=tl-audio-strip&drive=click%3Abutton%3Ahas-text%28%22Inspector%22%29)

**Rendering.** Ekspor gerak menggambar, mendekode, dan mengenkode setiap bingkai pada waktu yang tepat, sehingga file tidak bergantung pada mesin Anda yang mampu mengimbangi, dan MP4 serta WebM tidak memiliki batas bingkai praktis. Panjang garis waktu menetapkan durasi kecuali Anda mengetik satu, dan Content Credentials distempel seperti pada ekspor lain. Ekspor diam memberikan bingkai pada playhead, atau contact sheet dari field **Frames**; lihat [Stills from a timed composition](/info/exporting.html#stills-from-a-timed-composition). Sekuens dibatasi satu jam. GIF dan PNG animasi menyimpan setiap bingkai di memori, sehingga cocok untuk klip pendek. **Record live** disembunyikan di sini karena render bingkai demi bingkai adalah jalur yang lebih baik.

**Keyframe, kedalaman, dan kamera.** Transisi menganimasikan klip saat datang dan pergi. Untuk memberi pose pada kotak di dalam klip (melayang, memudar, blur, mengangkatnya dari halaman dan mengembalikannya), pilih klip dan tekan **+Keyframe**: berlian di alat garis waktu, berlian di bilah objek kanvas, atau **Shift+K** dengan garis waktu terfokus. Posisi playhead menentukan pose mana yang ditulis suntingan berikutnya. Keyframe yang sama memberi komposisi bertempo sebuah kamera yang mendorong masuk, menggeser, dan menarik fokus. [Animating](/info/animating.html) adalah panduan lengkapnya, dan [The sequence editor](/info/sequence-editor.html) membahas pemilihan, onion skin, pemisahan, pemotongan, dan penanda.

## Sebelum Anda mengekspor

Design memeriksa dokumen Anda sebelum Anda mengirim file. Kartu **Before you export**, di bagian **Document** pada Inspector dan lagi di panel ekspor, membaca struktur layer yang tersimpan, lalu memeriksa kanvas yang sudah stabil untuk teks terpotong dan kontras warna datar. Ia menanyakan registri font yang sama yang dipakai pengubahan SVG dan PDF menjadi kontur apakah setiap run teks memiliki byte font yang dapat disematkan. Latar gambar dan gradien dicantumkan sebagai pemeriksaan visual, bukan diberi skor kontras karangan.

### Periksa komposisi terhadap design system

Kartu di panel ekspor juga membandingkan komposisi dengan design system Anda, pada versi design system yang sama dengan yang dipakai render. Ia memeriksa warna yang dibuat sendiri, alias token, pilihan font, dan id aset gambar. Nilai kustom mungkin disengaja, dan gambar di luar aset brand yang dideklarasikan adalah item untuk ditinjau, bukan gambar terlarang.

Bila ada saran warna atau font yang konkret, tombolnya mengubah satu layer itu, dan **Undo** memulihkan aslinya. Layer yang terkunci atau sudah berubah tidak pernah ditimpa oleh saran lama. Gradien, efek, konten alat bersarang, hak cipta, dan kualitas subjektif berada di luar perbandingan ini, dan tidak ada pemeriksaan yang memblokir Download.

### Aturan baku dan sinyal tulisan

Kartu di panel ekspor juga memeriksa aturan baku yang dibawa design system Anda, seperti bobot dan perataan teks, pasangan warna yang disetujui, atau logo per permukaan, layer demi layer. Setiap temuan adalah peringatan dengan nama layer di atas aturannya. Aturan yang tidak memiliki pemeriksa di build ini dicantumkan sebagai tidak diperiksa, tidak pernah sebagai dipenuhi. [Usage & rules](/info/brand-studio.html#usage-rules) mencantumkan aturannya, dan `lolly check` menerapkan aturan yang sama pada dokumen tersimpan.

Kartu yang sama menampilkan sinyal tulisan untuk teks yang digambar dokumen: bandnya (none, weak, notable, atau strong), lalu kalimat Verify sendiri dengan skor dari 100 dan hingga tiga frasa yang ditandai, masing-masing dengan layer yang memuatnya. **Open the text in Verify** membawa teks itu ke [Verify](/#/verify) untuk pembacaan penuh; [AI evidence in Verify](/info/verify-ai-evidence.html) menjelaskan apa yang ditimbang skor. Skor adalah sinyal, bukan vonis: ia menghitung pola yang umum dalam tulisan buatan mesin dan tidak dapat mengetahui siapa yang menulis kata-kata itu. Layer tersembunyi tidak disertakan dalam kedua pemeriksaan, dan kartu menyebut jumlahnya.

Temuan aturan baku dan sinyal tulisan yang kuat dihitung dalam total "to fix" kartu agar mudah ditemukan. Keduanya menginformasikan dan tidak pernah memblokir: Download tetap tersedia, dan tidak ada yang perlu diabaikan atau dicatat sebagai pengecualian. Agen yang bekerja di dokumen terbuka mendapatkan laporan yang sama melalui alat situsnya ([Agents in an open document](/info/open-document-agents.html)).

Pemeriksaan cetak (bleed, resolusi, cakupan tinta, dan jumlah plat) bergabung ke kartu yang sama bila Anda mengaktifkan **Settings → Feature flags → Print preflight**. Pada alat lain, flag itulah yang menampilkan kartu sama sekali; [Export a file](/info/exporting.html) menjelaskan pemeriksaan cetak.

## Presentasi

Dokumen Design yang terdiri dari artboard sudah merupakan deck. Tekan **Present** di bilah atas dan setiap artboard menjadi slide layar penuh, dalam urutan artboard di kanvas. Tombol berbunyi **Preview** sampai **Design outcome** dokumen adalah **Slides**. Deck berjalan pada salinan artboard yang dirender, jadi keluar mengembalikan Anda persis ke tempat semula.

Panah di samping **Present** membuka **Present from this slide**, **Speaker view**, **Present with camera**, **Narrate**, **Auto-advance slides**, **Loop the deck (kiosk)**, dan **Export slides as video**.

| Tombol | Fungsinya |
|---|---|
| **Space**, `→`, **Page Down** | Langkah atau slide berikutnya (atau klik strip di tepi kanan) |
| `←`, **Page Up** | Kembali (atau klik strip di tepi kiri) |
| **Home**, **End** | Slide pertama atau terakhir |
| `O` | Overview: setiap artboard dalam susunan kanvas Anda; klik satu untuk membukanya |
| `S` | Speaker view: slide saat ini, slide berikutnya, catatan, dan jam di jendela kedua |
| `B` | Layar hitam; tombol apa pun mengembalikan slide |
| `F` | Kembali ke layar penuh |
| `K` | Jeda atau mulai ulang deck kiosk |
| **Escape** | Mengupas satu lapisan: overview ke deck, deck ke editor |

Bilah kontrol kecil muncul perlahan saat Anda menggerakkan penunjuk dan bersembunyi lagi saat Anda berhenti. Jika browser memblokir pop-up speaker, speaker view terbuka sebagai panel di atas deck. Catatan milik setiap artboard dan tidak pernah muncul di slide.

- **Langkah munculnya.** Klik kanan kotak dan pilih **Reveal at step 1**, **2**, atau **3** sebagai ganti **Always visible**, dan kotak menunggu sampai Anda maju ke langkahnya. Kotak yang berbagi nomor tiba bersamaan.
- **Kiosk.** Beri artboard **Length** dan deck bertahan di sana selama itu, lalu maju di balik bilah kemajuan tipis. Tambahkan `kiosk` ke tautan dan deck berputar kembali di akhir, untuk papan reklame digital.
- **Tumpukan sub-slide.** Klik kanan artboard dan pilih **Stack under the previous slide** untuk menjadikannya langkah dari slide itu. Overview menampilkan satu kartu, dan baris **Stack** di inspector menyatakan slide mana yang menjadi milik artboard.
- **Morph.** Bila slide berurutan sama-sama memuat kotak dengan nama **Morph match** yang sama (misalnya `hero`), transisi memindahkan, mengubah ukuran, dan mewarnai ulang kotak itu alih-alih memotong. Transisi **Morph** seluruh deck melakukan hal yang sama untuk setiap pasangan yang cocok.
- **Narasi.** **Speaker notes** setiap artboard dapat dibacakan. Di bagian **Document** pada Inspector pilih **Voice**, opsional suara kedua untuk **Blend with**, **Speed**, serta **Lead-in** dan **Tail** dalam milidetik; **Show captions when presenting** menampilkan kata-kata saat diucapkan. Suara berjalan di perangkat Anda, dan catatan yang sama menjadi soundtrack ekspor video, audio slide dalam ekspor PowerPoint, dan film bernarasi dalam [paket SCORM](/info/create/exporting.html#scorm-course-packages).

Deck juga merupakan tautan. `?present` membuka langsung ke dalamnya dan `s=` memilih slide (posisi, id artboard, atau `id.step` untuk langkah build), dan alamat mengikuti Anda, jadi apa yang Anda kirim adalah slide yang sedang Anda tampilkan. [Reserved URL parameters](/info/url-parameters.html#what-happens-on-open) mendokumentasikannya.

**Present with camera** menempatkan kamera, logo, dan keterangan nama Anda di atas slide, dengan kontrol privat dan adegan tersimpan; lihat [Presenting with camera](/info/presenting.html). Kotak **Web page** dapat mengambil clicker selama presentasi bila Anda mengaktifkan **Make interactive** di inspector-nya: pada langkah **Focus on click**, Up dan Down mengendalikan halaman sementara Next melanjutkan deck. [Live pages that take the clicker](/info/interactive-pages.html) membahas gaya fokus, perhentian gulir, dan persetujuan situs.

## Ke mana selanjutnya

- **[Text in Design](/info/text-composition.html)**: menyunting teks di kanvas, mengalirkan artikel melalui bingkai, dan tipografi.
- **[Animating](/info/animating.html)**: keyframe, kedalaman, kamera adegan, dan layer Lift.
- **[Import a design](/info/design-import.html)**: buka file Figma, Penpot, Illustrator, atau InDesign sebagai kotak yang dapat disunting.
- **[Share a design with rules](/info/create-a-tool.html)**: ubah dokumen Design menjadi alat dengan hanya input yang Anda pilih.
- **[Export a file](/info/exporting.html)**: format, ukuran, satuan cetak, dan video.
