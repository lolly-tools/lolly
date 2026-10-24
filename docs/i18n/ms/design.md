# Design: kanvas bebas

Design ialah alat untuk reka letak yang tidak diliputi templat: poster dari awal, dek slaid, karya gerakan dengan runut bunyi. Daripada borang kawalan, anda mendapat kanvas kotak yang anda seret, ubah saiz, putar dan taip ke dalamnya. Ia mengeksport melalui laluan render yang sama seperti setiap alat lain, jadi apa yang anda lihat pada kanvas ialah fail yang anda dapat.

Halaman ini menelusuri kanvas daripada kotak pertama hingga dek siap: tetingkap, membentuk kotak, melukis bentuk anda sendiri, meletakkan adegan 3D dan alat lain, menambah masa, menyemak hasil dan membentang dek yang siap. [Using Lolly](/info/using.html) meliputi apa yang dikongsi Design dengan setiap alat, seperti menyimpan dan berkongsi.

![Kanvas bebas Design - papan seni beserta meja kerja di sekelilingnya](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZTfS8MwEMf_mryO5NZ288GHrdqJv1CUvWdtOgppMtJMNv96yaV1iRNEQRBZoblwab53l0-uq915bXgrCOSDpf3LzgANnQ4eI0rrPJn7Gh9cd0sE8lIryxtFIFfatFx6L4F0Mi-11GbUiZYr25QjK3bW-S8I5MnUbRXKCkMgb5uqki6JFFU7rjoXYsSgT8GaLebKZSeGAPkUYypMHp80DeugYYR4J_U7X4XRkY8dFHuTYEJ-jDWM3qoqsEHo4Y20-xJi-SPVaOfRUuAL1hiZXNrG4gH6M85Z5lTAk8x8DdlnPL8gecVfBIEU6F5v0bbCor3VUu4JpOPCKTCWsPI9rBS107d6QyCfRET_Ac6wX36X6UpX-49Ip1mAlMEPkM6QX20aoSpECLTmpadcazPQ9hPlWxboRndWmFEIG1s4Yp3E3Ts-0f4GbcruWHLzlC0frmfpfbGk82LxmD0vUndSTcvXAoknWBKCz5LDSIdiRHV0D2Tfq1BIvdY42Zim5WZ_-n3_mRvwBg&width=1360&height=850&dpi=192&waitMs=3000&format=svg&walker=1&chrome=1&localize=1&dark=1&filename=design)

## Tetingkap Design

**Bar atas** bermula dengan **Home**, **File menu** dan nama dokumen (klik nama untuk menamakan semula dokumen). Bahagian tengah mengandungi **Undo**, **Redo**, **History**, kawalan zum (dengan **Fit all** dan **Fit artboard**) dan togol untuk **Timeline**, **Navigator** dan **Inspector**. Di kanan terdapat **Share**, **Present** dan **Export**. Pada telefon, butang yang kurang digunakan berpindah ke **More actions**.

**Rel alat** di sisi menyimpan menu Lolly dan alat yang anda gunakan untuk melukis: **Pointer**, **Add a box**, **Pen**, **Edit points**, **Line**, kemudian butang Timeline, Artboards dan Auto-arrange.

![Rel alat kanvas bebas: pemegang seret, menu Lolly, kemudian Pointer, Add a box, Pen, Edit points, Line, Timeline, Artboards dan Auto-arrange](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3D__blank__&width=1440&height=900&dpi=192&waitMs=2600&css=.fc-toolbar%7Bopacity%3A1!important%7D&cropSelector=.fc-toolbar&walker=1&format=svg&dark=1&filename=pen-editor-rail)

Kanvas berfungsi seperti papan tampal pereka di sekeliling artboard:

- **Letakkan kotak di luar artboard.** Seret kotak melepasi tepi bingkai dan ia kekal kelihatan dan boleh dipilih. Segala yang di luar bingkai dipudarkan, dan bingkai mengekalkan bayangnya untuk menandakan di mana fail bermula.
- **Hanya artboard dieksport.** Apa-apa di luar bingkai, atau bahagian kotak yang menjulur melepasi tepi, dipotong daripada output dalam format raster dan vektor.
- **Zum keluar melepasi Fit** untuk melihat segala yang anda letakkan.
- **Ubah saiz artboard** dengan mengubah saiz eksport. Kotak mengekalkan kedudukannya, jadi anda boleh membingkai semula reka letak di sekeliling kandungan sedia ada.

![Pentas penyuntingan: artboard di hadapan dan tengah, rel alat di kiri dan HUD zum di sudut](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.fc-toolbar%7Bopacity%3A1!important%7D&format=svg&walker=1&chrome=1&dark=1&filename=seq-studio-stage)

### Navigator dan Inspector

**Navigator** menyenaraikan setiap artboard (bertajuk **Artboards**, atau **Slides** dalam dek) sebagai kumpulan lipat **Layers**nya. Pilih nama artboard untuk melompat ke sana, kembangkannya untuk memilih atau menyusun semula lapisannya dan gunakan kekunci anak panah untuk bergerak melalui senarai; Kiri kembali ke tajuk artboard. **Pages** mengumpulkan artboard ke dalam halaman bernama, dan memilih halaman hanya mengubah artboard yang ditunjukkan penyunting.

**Inspector** meletakkan kawalan teks atau imej objek yang dipilih dahulu. Cip pilihan meliputi pilihan pantas, dan **Advanced** menyimpan butiran penggayaan. Pada telefon, Inspector dibuka sebagai helaian daripada **More actions**; Escape atau Back menutup helaian dan mengekalkan pilihan anda.

![Bahagian Document dalam Inspector: tab Selection dan Canvas, kemudian Dimensions dan Style & look](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour&width=1440&height=900&dpi=192&waitMs=3500&cropSelector=.fc-insp&walker=1&format=svg&dark=1&filename=design-narration)

## Ubah saiz, skala dan putar

Pilih objek, kemudian seret pemegang untuk mengubah saiznya, atau seret pemegang bulat di bawah pilihan untuk memutar objek. Seretan saiz berfungsi dalam salah satu daripada dua mod:

- **Resize**, lalai, hanya mengubah kotak. Teks membungkus semula kepada saiz baharu, dan saiz fon, lebar lejang, jejari sudut dan kesan kekal seperti sedia ada.
- **Scale** membesar atau mengecilkan keseluruhan objek dengan kandungannya: saiz fon, lejang, jejari sudut, bayang, kabur, pelapik dan jarak semuanya berubah dengan jumlah yang sama.

Tekan `K` untuk menghidupkan atau mematikan Scale. Tanpa papan kekunci, pilih **Scale mode** dalam menu Lolly, atau tekan dan tahan butang **Pointer** pada rel (atau klik kanan butang) dan pilih **Scale**; pada skrin sentuh bar objek juga mempunyai togol Scale. Semasa Scale hidup, butang Pointer menunjukkan ikon Scale dan setiap pemegang mempunyai titik di tengahnya. `V` atau **Escape** kembali ke Resize dan mengekalkan pilihan anda. Setiap dokumen dibuka dengan Scale mati, jadi tiada siapa menskala lejang secara tidak sengaja.

**Skala dengan nombor.** Dengan Scale hidup, atau dengan beberapa objek dipilih, klik bacaan pada bar objek untuk membuka popover **Scale**. Taip peratusan, lebar atau tinggi, pilih titik yang kekal pada grid 3 x 3, dan pilih **Apply**. Setiap skala ialah satu langkah undur.

**Beberapa objek.** Pilihan beberapa objek mempunyai pemegang pada tepinya serta sudutnya. Selagi setiap objek tegak atau diputar dengan kuarter putaran penuh, dan pilihan tidak mengandungi kumpulan atau bulatan, seretan sudut mengubah lebar dan tinggi dengan bebas. Jika tidak, pilihan mengekalkan nisbahnya dan bacaan menambah **Proportional**. Semasa anda menyeret, label kecil menunjukkan saiz, atau peratusan dalam mod Scale.

**Balikkan pilihan.** Klik kanan dan pilih **Flip horizontal** atau **Flip vertical**, atau tekan `Shift+H` atau `Shift+V` (Shift, kerana `V` kosong ialah Pointer). Cerminan ialah transformasi sebenar, jadi SVG, PDF dan PNG yang dieksport mengekalkan pembalikan.

**Kekunci yang anda tahan semasa seretan** berkesan sebaik sahaja anda menekan atau melepaskannya; helaian pintasan (`?`) turut menyenaraikannya.

| Tahan | Mengubah saiz atau menskala | Memutar | Menggerakkan |
|---|---|---|---|
| **Shift** | Mengekalkan nisbah (Scale sentiasa berbuat demikian) | Memutar dalam langkah 15 darjah | Tiada perubahan |
| **Alt** (Option) | Berfungsi dari pusat | Memutar dengan bebas | Mematikan pelekapan dan grid |
| **Cmd/Ctrl** | Mematikan pelekapan dan grid | Memutar dengan bebas | Mematikan pelekapan dan grid |

Tanpa kekunci ditahan, putaran ditarik ke 15 darjah terdekat apabila ia berada dalam 4 darjah daripadanya. Artboard tidak berputar, jadi ia tiada pemegang putar.

::: details Pemegang, zon cengkam dan sentuhan
**Cengkam di mana-mana sepanjang tepi.** Setiap sisi pilihan ialah jalur ubah saiz sepanjang keseluruhan panjangnya, dan dengan tetikus atau pen terdapat zon putar tepat di luar setiap sudut. Penuding menunjukkan apa yang akan dilakukan seretan. Tekanan dalam jalur atau zon menjadi ubah saiz atau putaran hanya apabila anda mula menyeret, jadi klik biasa masih memilih seperti sebelumnya. Objek terkunci tidak mempunyai pemegang, jalur atau zon.

**Objek kecil kekal boleh digerakkan.** Pada objek selebar 25 piksel skrin atau kurang, pemegang tengah bersembunyi dan yang lain bergerak sedikit keluar daripada garis luar, jadi tekanan pada objek menggerakkan objek. Pada 10 piksel atau kurang pemegang sudut juga hilang, dan garis nipis mengekalkan pemegang di setiap hujung. Tekanan tepat di sebelah garis nipis atau objek kecil, jauh daripada pemegangnya, menggerakkan objek.

**Kawasan cengkam besar.** Pada skrin sentuh setiap zon sudut ialah suku lebar dan tinggi pilihan pada skrin, antara 24 dan 44 piksel, dan setiap zon sisi meliputi bentangan antara dua sudut. Apabila pilihan terlalu kecil untuk itu, zon berpindah ke luar garis luarnya. Zon di bawah penuding atau jari anda dibayangi. Untuk mendapat zon yang sama dengan tetikus atau pen, hidupkan **Large grab areas** dalam menu Lolly; tetapan kekal pada peranti ini.

**Dua jari pada pilihan.** Pada skrin sentuh, letakkan dua jari pada objek yang dipilih: cubit untuk menskala, pusing untuk memutar atau gerakkan kedua-dua jari untuk membawa pilihan, semuanya sebagai satu langkah undur. Dengan Scale hidup, cubitan juga menskala kandungan; dengan Scale mati, ia mengubah saiz secara berkadar. Pusingan melekap ke 15 darjah terdekat apabila hampir, dan gerakan dua jari tidak pernah melekap. Jari pertama mesti mendarat pada pilihan dan yang kedua mesti mengikut dengan cepat, pada pilihan atau tepat di luar tepinya. Dua jari di tempat lain menzum dan menggerakkan paparan, begitu juga dua jari pada pilihan yang mengandungi artboard atau objek terkunci, meliputi sebahagian besar paparan atau melepasi tepinya.
:::

## Lukis bentuk anda sendiri

Kotak, bulatan dan bingkai bulat meliputi kebanyakan reka letak. Untuk sebarang bentuk lain, lukis satu: butang **Pen** pada rel (atau `P`) meletakkan anda dalam mod lukisan. Tiga kekunci tunggal bergerak antara mod: `V` untuk Pointer, `P` untuk Pen dan `N` untuk **Edit points**. Pointer sentiasa menjadi jalan keluar.

- **Klik** untuk meletakkan titik. Pada jenis lengkung lalai, **klik dan seret** menarik pemegang titik keluar untuk membuat lengkung; tahan **Alt** semasa anda klik untuk sudut keras. (Pada jenis lengkung lain setiap titik ialah sudut dan seretan tidak melakukan apa-apa.)
- Titik melekap pada artboard dan kotak lain anda semasa anda meletakkannya. Alt menindas grid semasa anda melukis, dan kedua-dua grid dan tepi semasa anda menyeret titik selepas itu.
- **Klik titik pertama anda** untuk menutup bentuk. Jika tidak, tekan **Enter**, klik dua kali atau tukar alat, dan lukisan disimpan.
- **Escape** berfungsi satu langkah pada satu masa: tekanan pertama meninggalkan lukisan, yang kedua meninggalkan pen.
- **Delete** semasa melukis menggugurkan titik terakhir.

Hasilnya ialah kotak biasa. Gerak, ubah saiz, putar, kumpul, jajar, susun semula, isi, teduh atau pudarkan laluan seperti kotak lain. Laluan pertama mengambil isian dan lejang yang diberikan jenama anda kepada laluan, dan setiap laluan baharu selepas itu mengambil apa sahaja yang anda guna terakhir. Dalam alat yang jenamanya tidak menetapkan apa-apa untuk laluan, laluan baharu dilejang dalam warna yang anda lukis, jadi bentuk tidak pernah tidak kelihatan.

**Sunting titik sekali lagi.** Klik dua kali bentuk, atau gunakan **Edit points** pada bar objek. Seret titik untuk menggerakkannya, seret pemegang untuk mengarah semula lengkung, klik pada lengkung untuk menyisipkan titik atau seret kotak mengelilingi beberapa titik dan tekan Delete. Laluan sentiasa mengekalkan sekurang-kurangnya dua titik.

**Spline type** menentukan jenis lengkung yang melalui titik anda:

| Jenis | Apa yang dilakukannya |
|---|---|
| **Smooth (auto)** | Lalai. Mengira panjang pemegangnya sendiri, jadi klik biasa memberi lengkung licin. Pemegang yang anda tetapkan mengunci arah, dan lengkung masih memiliki panjang. |
| **Bezier handles** | Pen klasik: anda mengawal setiap pemegang, dan menyisipkan titik tidak pernah menggerakkan lengkung. |
| **Through the points** | Melalui setiap titik dengan tepat, tanpa pemegang. |
| **B-spline** | Mengalir berhampiran titik dan bukan melaluinya, untuk garisan yang lebih lembut. |
| **Straight lines** | Poligaris. |

Menukar laluan sedia ada kepada jenis yang mengira pemegangnya sendiri bertanya dahulu, kerana panjang pemegang yang anda tetapkan tidak dapat dipulihkan; menukar kepada **Bezier handles** sentiasa tanpa kehilangan. Pertengahan melukis, pertukaran digunakan serta-merta, dan sebarang pemegang yang anda tarik digugurkan.

Setiap titik juga membawa peraturan kesinambungan, ditunjukkan oleh bentuknya: segi empat untuk **Corner** (pemegang bergerak secara bebas), bulat untuk **Smooth** (pemegang kekal selari) dan bulat dengan gelang untuk **Symmetric** (selari dan sama panjang). Tetapkan peraturan untuk titik terpilih dan lengkung mengikut serta-merta.

![Dua laluan pen yang dirender terus daripada satu pautan: lengkung S bergaris dan satu bentuk tertutup berisi](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22curve%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A140%2C%22y%22%3A180%2C%22w%22%3A800%2C%22h%22%3A420%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A14%2C%22path%22%3A%221!cubic!0_.02!.85!!!.25!-.45!s_.5!.5!-.22!.32!.22!-.32!y_.98!.12!-.25!.45!!!s%22%7D%2C%7B%22id%22%3A%22blob%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A340%2C%22y%22%3A620%2C%22w%22%3A400%2C%22h%22%3A320%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23d1e7ff%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A6%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!catmull-rom!1_.5!0_1!.42_.78!1_.22!1_0!.42%22%7D%5D&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=pen-path-geometry)

Laluan yang dilukis dibawa dalam pautan kongsi seperti kotak lain dan dirender sama daripada baris perintah.

## Gabungkan bentuk

Pilih dua atau lebih bentuk, klik kanan kanvas (ketik dua jari pada sentuhan) dan pilih:

- **Union** menggabungkannya menjadi satu bentuk dengan cat bentuk paling atas.
- **Subtract** memotong segala yang di atas daripada bentuk bawah.
- **Intersect** menyimpan hanya pertindihan.
- **Exclude** menyimpan segala-galanya kecuali pertindihan.

Tiga lagi berfungsi pada satu bentuk. **Outline stroke…** menukar lejang menjadi garis luar terisi dengan berat yang sama. **Offset path…** membesarkan garis luar ke luar atau, dengan nombor negatif, mengecilkannya ke dalam. **Simplify** membina semula laluan dengan lebih sedikit segmen pada garis luar yang sama.

![Bulan sabit dan gelang dengan lubang sebenar, kedua-duanya dihasilkan oleh Subtract](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22crescent%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A120%2C%22y%22%3A330%2C%22w%22%3A374%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22path%22%3A%221!cubic!1_.750491!.957645!-.128211!-.062578!-.065985!.027232!c_.534759!1!.076762!!-.295339!!c_0!.5!!.276142!!-.276142!c_.534759!0!-.295339!!.200102!!c_1.000984!.254923!-.09169!-.152161!-.021205!-.003239!c_.935829!.25!.022185!!-.221505!!c_.534759!.625!!-.207107!!.14459!c%22%7D%2C%7B%22id%22%3A%22ring%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A580%2C%22y%22%3A330%2C%22w%22%3A400%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!cubic!1_1!.5!!-.276142!!.276142!c_.5!1!.276142!!-.276142!!c_0!.5!!.276142!!-.276142!c_.5!0!-.276142!!.276142!!c*1!cubic!1_.5!.7!-.110457!!.110457!!c_.7!.5!!.110457!!-.110457!c_.5!.3!.110457!!-.110457!!c_.3!.5!!-.110457!!.110457!c%22%7D%5D%26w%3D1080%26h%3D1080&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&filename=path-ops-boolean-result)

Hasilnya ialah laluan baharu yang boleh anda terus sunting dengan pen, disimpan sebagai lengkung Bezier biasa, jadi jenis spline asal tidak dibawa. Lubang ialah lubang sebenar: kawalan **Fill rule** pada panel lejang menentukan sama ada kontur bertindih mengisi (*non-zero*) atau menebuk (*even-odd*). Operasi menolak dan bukan memusnahkan: minta persilangan dua bentuk yang tidak bertindih dan tiada apa-apa berubah. Kotak teks dan imej tidak mempunyai garis luar, jadi ia dibiarkan.

## Adegan 3D dan alat dalam reka bentuk

Kotak boleh memegang lebih daripada gambar. Kedua-dua jenis di bawah menyimpan resipi dan bukan imej yang dirender, jadi ia dilukis semula pada saiz dan saat apa pun yang diminta dokumen, dan kemas kini kepada sumber sampai kepada setiap reka bentuk yang menggunakan sumber itu.

### Adegan 3D

Pilih **3D scene** daripada menu tambah pada rel dan seret keluar bingkai: 3D Studio dibuka pada kotak baharu, dan apa yang anda tetapkan di situ kembali ke kanvas. Selepas itu, **Edit in 3D Studio** dalam bahagian **3D scene** Inspector membuka semula studio. [Place a scene in Design](/info/3d-studio.html#place-a-scene-in-design) meliputi poster, garis masa, eksport dan perkongsian.

### Alat dalam reka bentuk

Pilih **Image** daripada menu tambah pada rel, seret keluar bingkai dan pilih alat pada tab **Tools** pemilih. Alat memenuhi bingkai dengan lalainya, dan Inspector dibuka pada bahagian **Tool** yang memegang kawalan alat itu sendiri. Ubah medan dan kotak dikemas kini seketika kemudian, sebagai satu langkah undur. **Image fit** dan **Image position** berfungsi seperti untuk mana-mana gambar, dan **Replace with another tool or image** menukar kandungan kotak.

**Alat yang bergerak** dimainkan dalam kotak: ilustrasi berulang terus berulang pada kanvas, mengikuti kepala main apabila garis masa dibuka dan mengeksport bingkai demi bingkai ke GIF, MP4 atau WebM. Apabila alat menyatakan berapa lama satu gelung, kotak mendapat klip sepanjang itu tepat, jadi video memegang gelung penuh. Klip yang anda ubah masanya mengekalkan masa anda, dan mematikan gerakan alat menjadikan kotak gambar pegun semula.

## Garis masa (Sequence)

**Sequence** ialah garis masa Design: ia menambah masa pada kanvas. Setiap kotak boleh bermula pada satu saat, berjalan selama satu tempoh dan beranimasi masuk dan keluar, dan garis masa yang dilabuhkan di bawah artboard ialah tempat anda menyusunnya. Mulakan daripada templat **Video** Design dan jujukan pendek sudah ada: dua kad teks bermasa pada baris jujukan dan lapik muzik prosedur di bawahnya, supaya anda dapat melihat cara garis masa berfungsi sebelum mengubah apa-apa.

![Garis masa Sequence: transport, pembaris, satu laluan overlay, baris jujukan magnetik dengan klip dan cip sambungannya serta jalur Always on](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A252px!important%7D&cropSelector=.tl-panel&format=svg&walker=1&tolerance=0.03&dark=1&filename=seq-studio-timeline)

Terdapat dua jenis baris:

- **Baris jujukan** bersifat magnet. Klip duduk hujung ke hujung, menyeret satu menyusun semula larian dan memadam satu menutup jurang. Ini ialah tulang belakang.
- **Lorong tindihan** bebas. Tajuk bawah, logo atau kapsyen terapung di atas tulang belakang pada masanya sendiri, masing-masing dalam lorongnya sendiri.
- Di bawahnya, **Always on** memegang kotak tanpa masa, hadir sepanjang masa. `+` pada cip memindahkan satu ke lorong; **Make always on** menghantarnya kembali.

Membuka garis masa memberinya papan kekunci, jadi Space dan kekunci anak panah menggerakkan kepala main. Gubahan yang sudah mempunyai masa membuka garis masa dengan sendirinya.

**Menyunting.** Seret bahagian tengah klip untuk menggerakkannya, seret berhampiran mana-mana hujung untuk memangkasnya dan tekan **Split at playhead** (atau `S`) untuk memotongnya kepada dua. Split memerlukan klip dengan **Length** sebenar dan kepala main agak jauh di dalamnya, jadi klip terbuka seperti lapik muzik tidak boleh dipisahkan. **Snap to edges** hidup secara lalai, melekap pada tepi klip, kepala main dan saat penuh; tahan Alt untuk menyeret tanpa melekap. Setiap seretan ialah satu langkah undur, dan pratonton semasa anda menyeret menggunakan aritmetik yang sama seperti hasilnya.

Pilih klip dan inspector memberikan suntingan yang sama sebagai nombor: **Length**, **Trim in** (sejauh mana ke dalam sumber klip bermula), **Speed** daripada ×0.25 hingga ×4, **Animate in** dan **Animate out** dengan panjangnya dan **Mute clip**. Klip pada baris magnet tidak mempunyai medan **Start**, kerana baris memiliki susunan.

**Peralihan** ialah pratetap: Fade, Pop, Grow, Rise, Drop, empat Slide, Zoom in dan out, Tilt, Swoop, Spin, Drift atau **Cut (no animation)**. Jarak diskalakan dengan objek, jadi satu pratetap kelihatan betul pada kad bingkai penuh dan lencana kecil. Antara dua klip pada baris jujukan, **cip jahitan** memilih **Cut** atau **Crossfade**; buka sekali lagi untuk menetapkan **Length (ms)** dan tekan **Done**. Dalam crossfade, klip pertama terus dimainkan melepasi potongan dan pudar keluar semasa yang seterusnya pudar masuk, sama dalam pratonton dan fail.

**Bunyi.** Klip **Audio** hidup pada garis masa seperti klip lain, dengan bentuk gelombang, pangkas dan bisu. Lapik muzik janaan templat Video disintesis semasa eksport, jadi barnya kekal biasa dan senyap sehingga anda merender. Tekan mikrofon untuk **merakam suara latar** terus ke garis masa, dengan kiraan masuk dan meter paras; rakaman disimpan sebagai aset anda sendiri pada kepala main. Butang kamera di sebelah mikrofon **merakam video** dengan cara yang sama, dipotong kepada artboard semasa merakam, supaya rakan sekerja boleh menambah klip daripada pautan dikongsi. Pilih mana-mana klip dengan bunyi dan jalurnya terbuka di bawah garis masa untuk kelantangan, pan, EQ, pic, normalisasi dan kesan seperti **Voice cleanup**; [Sound](/info/sequence-editor.html#sound) dalam panduan penyunting jujukan meliputi jalur itu. **Audio track** panel eksport adalah berasingan: satu lapik di bawah keseluruhan klip, dengan pudar dan ducking.

![Garis masa dengan klip muzik dipilih: jalurnya berjalan di sepanjang bahagian bawah dengan Speed, Fades, Volume, Pan, EQ, Pitch, Normalize volume dan slot Effect](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fbx%3Dt1%252Ctext%252C200%252C140%252C1500%252C220%252C0%252Crect%252C16%252C%252C100%252C%252Ccontain%252Cnormal%252CVoiceover%252520session%252C%25257Bcolor.semantic.text%25257D%252C48%252Ccenter%252Cmiddle%252C500%252Csans%252C1.12%252C0%252Ctrue%252Cfalse%252C%252C%252C8%252Cnone%252C00000055%252C0%252C0%252C10%252Ccenter%252Cfalse%252C%252C%252C0%252Cnonzero%252C0%252C3.3%252C0%252C1%252Cnone%252Cnone%252C400%252C400%252Cfalse%252Cseq%252C%252Cround%252Cround%252C%252C0%252C0%252C0%252C0%252C%252C%252C%252C0%252Ctrue%252Cnone%252Cnone%252C%252Cfalse%252C%252C%252C%252C0%252C%252C%252Cfalse%252C%252C%252C%252C%252Cfalse%252Cfalse%252C%252C1%252C%252Cfalse%252C%252C60%252C%252C%252C1%257Ea1%252Caudio%252C200%252C500%252C400%252C80%252C0%252Crect%252C16%252C%252C100%252Clolly%25252Floops%25252F3-am-echoes%252Ccontain%252Cnormal%252C%252C%25257Bcolor.semantic.text%25257D%252C48%252Ccenter%252Cmiddle%252C500%252Csans%252C1.12%252C0%252Ctrue%252Cfalse%252C%252C%252C8%252Cnone%252C00000055%252C0%252C0%252C10%252Ccenter%252Cfalse%252C%252C%252C0%252Cnonzero%252C0%252C3.3%252C0%252C1%252Cnone%252Cnone%252C400%252C400%252Cfalse%252C%252C%252Cround%252Cround%252C%252C0%252C0%252C0%252C0%252C%252C%252C%252C0%252Ctrue%252Cnone%252Cnone%252C%252Cfalse%252C%252C%252C%252C0%252C%252C%252Cfalse%252C%252C%252C%252C%252Cfalse%252Cfalse%252C%252C1.3%252C%252Cfalse%252C%252C60%252C%252C%252C1%26_sel%3Da1&width=1440&height=900&dpi=192&waitMs=5000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A300px%21important%7D&cropSelector=.tl-panel&walker=1&format=svg&dark=1&filename=tl-audio-strip&drive=click%3Abutton%3Ahas-text%28%22Inspector%22%29)

**Perenderan.** Eksport gerakan melukis, menyahkod dan mengekod setiap bingkai pada masa tepat, jadi fail tidak bergantung pada mesin anda mengikut rentak, dan MP4 serta WebM tidak mempunyai siling bingkai yang praktikal. Panjang garis masa menetapkan tempoh melainkan anda menaip satu, dan Content Credentials dicap seperti pada mana-mana eksport lain. Eksport pegun memberikan bingkai pada kepala main, atau helaian sentuh daripada medan **Frames**; lihat [Stills from a timed composition](/info/exporting.html#stills-from-a-timed-composition). Jujukan dihadkan kepada satu jam. GIF dan PNG beranimasi memegang setiap bingkai dalam memori, jadi ia sesuai untuk klip pendek. **Record live** disembunyikan di sini kerana perenderan bingkai demi bingkai ialah laluan yang lebih baik.

**Bingkai kunci, kedalaman dan kamera.** Peralihan menganimasikan klip semasa ia tiba dan pergi. Untuk menggayakan kotak dalam klip (hanyut, pudar, kabur, angkat dari halaman dan letakkan semula), pilih klip dan tekan **+Keyframe**: berlian dalam alat garis masa, berlian pada bar objek kanvas atau **Shift+K** dengan garis masa difokuskan. Kedudukan kepala main menentukan gaya mana yang ditulis suntingan anda seterusnya. Bingkai kunci yang sama memberi gubahan bermasa kamera yang menolak masuk, menggerakkan sisi dan menarik fokus. [Animating](/info/animating.html) ialah panduan penuh, dan [The sequence editor](/info/sequence-editor.html) meliputi pemilihan, kulit bawang, pemisahan, pemangkasan dan penanda.

## Sebelum anda mengeksport

Design menyemak dokumen anda sebelum anda menghantar fail. Kad **Before you export**, dalam bahagian **Document** Inspector dan sekali lagi dalam panel eksport, membaca struktur lapisan tersimpan, kemudian melihat kanvas yang mantap untuk teks yang terpotong dan kontras warna rata. Ia bertanya pendaftar fon yang sama yang digunakan oleh garis luar SVG dan PDF sama ada setiap larian teks mempunyai bait fon yang boleh dibenamkan. Latar imej dan kecerunan disenaraikan sebagai semakan visual dan bukan diberi skor kontras rekaan.

### Semak gubahan terhadap sistem reka bentuk

Kad panel eksport juga membandingkan gubahan dengan sistem reka bentuk anda, pada versi sistem reka bentuk yang sama yang digunakan render. Ia melihat warna yang dikarang, alias token, pilihan fon dan id aset imej. Nilai tersuai mungkin disengajakan, dan imej di luar aset jenama yang diisytiharkan ialah item semakan, bukan imej yang diharamkan.

Di mana cadangan warna atau fon konkrit wujud, butangnya mengubah satu lapisan itu, dan **Undo** memulihkan yang asal. Lapisan yang dikunci atau telah berubah tidak pernah ditulis ganti oleh cadangan lama. Kecerunan, kesan, kandungan alat bersarang, hak dan kualiti subjektif berada di luar perbandingan ini, dan tiada semakan menyekat Download.

### Peraturan dalaman dan isyarat penulisan

Kad panel eksport juga menyemak peraturan dalaman yang dibawa sistem reka bentuk anda, seperti berat dan penjajaran teks, pasangan warna yang diluluskan atau logo bagi setiap permukaan, lapisan demi lapisan. Setiap dapatan ialah amaran dengan nama lapisan di atas peraturan. Peraturan yang tiada penyemaknya dalam binaan ini disenaraikan sebagai tidak disemak, tidak pernah sebagai dipatuhi. [Usage & rules](/info/brand-studio.html#usage-rules) menyenaraikan peraturan, dan `lolly check` menggunakan yang sama pada dokumen tersimpan.

Kad yang sama menunjukkan isyarat penulisan bagi teks yang dilukis dokumen: jalurnya (tiada, lemah, ketara atau kuat), kemudian ayat Verify sendiri dengan skor daripada 100 dan sehingga tiga frasa yang ditandakan, masing-masing dengan lapisan yang memegangnya. **Open the text in Verify** membawa teks itu ke [Verify](/#/verify) untuk bacaan penuh; [AI evidence in Verify](/info/verify-ai-evidence.html) menerangkan apa yang ditimbang oleh skor. Skor ialah isyarat, bukan keputusan: ia mengira corak yang biasa dalam tulisan janaan dan tidak dapat mengetahui siapa yang menulis perkataan itu. Lapisan tersembunyi ditinggalkan daripada kedua-dua semakan, dan kad menyatakan berapa banyak.

Dapatan peraturan dalaman dan isyarat penulisan yang kuat dikira dalam jumlah "to fix" kad supaya mudah dijumpai. Ia memaklumkan dan tidak pernah menyekat: Download kekal tersedia, dan tiada apa-apa untuk ditolak atau direkodkan sebagai pengecualian. Ejen yang bekerja dalam dokumen terbuka mendapat laporan yang sama melalui alat tapaknya ([Agents in an open document](/info/open-document-agents.html)).

Semakan cetakan (bleed, resolusi, litupan dakwat dan bilangan plat) menyertai kad yang sama apabila anda menghidupkan **Settings → Feature flags → Print preflight**. Dalam alat lain bendera itu ialah apa yang menunjukkan kad sama sekali; [Export a file](/info/exporting.html) menerangkan semakan cetakan.

## Membentangkan

Dokumen Design yang terdiri daripada artboard sudah pun dek. Tekan **Present** dalam bar atas dan setiap artboard menjadi slaid skrin penuh, mengikut susunan artboard pada kanvas. Butang itu berbunyi **Preview** sehingga **Design outcome** dokumen ialah **Slides**. Dek berjalan pada salinan artboard yang dirender, jadi meninggalkannya meletakkan anda tepat di tempat anda berada.

Anak panah di sebelah **Present** membuka **Present from this slide**, **Speaker view**, **Present with camera**, **Narrate**, **Auto-advance slides**, **Loop the deck (kiosk)** dan **Export slides as video**.

| Kekunci | Apa yang dilakukannya |
|---|---|
| **Space**, `→`, **Page Down** | Langkah atau slaid seterusnya (atau klik jalur di tepi kanan) |
| `←`, **Page Up** | Kembali (atau klik jalur di tepi kiri) |
| **Home**, **End** | Slaid pertama atau terakhir |
| `O` | Gambaran keseluruhan: setiap artboard dalam susunan kanvas anda; klik satu untuk membukanya |
| `S` | Paparan penutur: slaid semasa, slaid seterusnya, nota dan jam dalam tetingkap kedua |
| `B` | Skrin hitam; sebarang kekunci mengembalikan slaid |
| `F` | Kembali ke skrin penuh |
| `K` | Jeda atau mulakan semula dek kiosk |
| **Escape** | Kupas satu lapisan: gambaran keseluruhan ke dek, dek ke penyunting |

Bar kawalan kecil muncul perlahan apabila anda menggerakkan penuding dan bersembunyi semula apabila anda berhenti. Jika pelayar menyekat pop timbul penutur, paparan penutur dibuka sebagai panel di atas dek. Nota milik setiap artboard dan tidak pernah muncul pada slaid.

- **Langkah dedah.** Klik kanan kotak dan pilih **Reveal at step 1**, **2** atau **3** dan bukan **Always visible**, dan kotak menunggu sehingga anda maju ke langkahnya. Kotak yang berkongsi nombor tiba bersama.
- **Kiosk.** Beri artboard **Length** dan dek berhenti di situ selama itu, kemudian maju di sebalik bar kemajuan nipis. Tambah `kiosk` pada pautan dan dek berulang di hujung, untuk papan tanda.
- **Timbunan sub-slaid.** Klik kanan artboard dan pilih **Stack under the previous slide** untuk menjadikannya langkah slaid itu. Gambaran keseluruhan menunjukkan satu kad, dan baris **Stack** inspector menyatakan slaid mana yang dimiliki artboard.
- **Morph.** Apabila slaid berturut-turut kedua-duanya memegang kotak dengan nama **Morph match** yang sama (`hero`, katakan), peralihan menggerakkan, mengubah saiz dan mewarnakan semula kotak itu dan bukan memotong. Peralihan **Morph** seluruh dek melakukan perkara yang sama untuk setiap pasangan yang sepadan.
- **Narasi.** **Speaker notes** setiap artboard boleh dibacakan. Dalam bahagian **Document** Inspector pilih **Voice**, pilihan suara kedua untuk **Blend with**, **Speed** dan **Lead-in** serta **Tail** dalam milisaat; **Show captions when presenting** menunjukkan perkataan semasa dituturkan. Suara berjalan pada peranti anda, dan nota yang sama menjadi runut bunyi eksport video, audio slaid dalam eksport PowerPoint dan filem bernarasi dalam [pakej SCORM](/info/create/exporting.html#scorm-course-packages).

Dek juga ialah pautan. `?present` terus membuka ke dalamnya dan `s=` memilih slaid (kedudukan, id artboard atau `id.step` untuk langkah binaan), dan alamat mengikuti anda, jadi apa yang anda hantar ialah slaid yang anda berada. [Reserved URL parameters](/info/url-parameters.html#what-happens-on-open) mendokumenkannya.

**Present with camera** meletakkan kamera, logo dan kapsyen nama anda di atas slaid, dengan kawalan peribadi dan adegan tersimpan; lihat [Presenting with camera](/info/presenting.html). Kotak **Web page** boleh mengambil klik penggerak semasa ceramah apabila anda menghidupkan **Make interactive** dalam inspektornya: pada langkah **Focus on click**, Up dan Down mengawal halaman manakala Next meneruskan dek. [Live pages that take the clicker](/info/interactive-pages.html) meliputi gaya fokus, perhentian skrol dan kelulusan tapak.

## Ke mana seterusnya

- **[Text in Design](/info/text-composition.html)**: menyunting teks pada kanvas, mengalirkan artikel melalui bingkai dan tipografi.
- **[Animating](/info/animating.html)**: bingkai kunci, kedalaman, kamera adegan dan lapisan Lift.
- **[Import a design](/info/design-import.html)**: buka fail Figma, Penpot, Illustrator atau InDesign sebagai kotak boleh sunting.
- **[Share a design with rules](/info/create-a-tool.html)**: tukar dokumen Design menjadi alat dengan hanya input yang anda pilih.
- **[Export a file](/info/exporting.html)**: format, saiz, unit cetakan dan video.
