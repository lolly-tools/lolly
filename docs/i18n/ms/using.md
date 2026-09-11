# Menggunakan Lolly

Panduan praktikal untuk benar-benar *menggunakan* aplikasi ini - membuka alat, bekerja pada kanvas, mengeksport, menyimpan dan berkongsi. Semua yang ada di sini berjalan **pada peranti anda**: tiada akaun, tiada muat naik, tiada internet diperlukan selepas muatan pertama.

> Baru di sini? [Mula Pantas](/info/quickstart.html) membolehkan anda mula menghasilkan sesuatu dalam beberapa minit, dan [Lolly untuk Operator](/info/operators.html) merangkumi pemasangan/penggunaan aplikasi; halaman ini pula tentang memandunya setelah ia terbuka.

## Membuka alat

Skrin utama ialah **galeri** - setiap alat, dikumpulkan mengikut kategori. Klik sesuatu kad untuk membuka alat itu; jika anda pernah menggunakannya sebelum ini, butang **Continue** menyambung semula sesi terkini anda. Gunakan kotak carian untuk menapis mengikut nama - atau [Cari](/info/search.html) dari bar di bahagian bawah enam skrin senarai (galeri, Utilities, Projects, Katalog, Dashboard dan Profile), yang turut mencapai kerja tersimpan anda, katalog dan tetapan anda selain daripada alat. Di dalam sesuatu alat, bar itu berundur untuk memberi ruang kepada antara muka alat itu sendiri.

![Galeri alat - setiap alat sebagai satu kad, dikumpulkan mengikut kategori](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&localize=1&dark=1&filename=gallery&try=1)

Setiap alat ialah paparan terbahagi: **kawalan** di satu sisi, **pratonton** langsung (kanvas) di sisi yang lain. Ubah mana-mana kawalan dan pratonton dikemas kini serta-merta.

![Paparan pisah sesuatu alat - tindanan kawalan di sebelah kiri, dan carta bar berkumpulan langsung yang dilukiskannya di sebelah kanan](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26t%3DExample%2520data%26st%3DSample%2520values%252C%2520not%2520a%2520real%2520dataset%26d%3DMonth%252CSeries%2520A%252CSeries%2520B%252CSeries%2520C%250AJan%252C12%252C9%252C5%250AFeb%252C18%252C14%252C7%250AMar%252C24%252C17%252C11%250AApr%252C29%252C23%252C15%26lg%3D1&width=1440&height=900&dpi=192&waitMs=2500&walker=1&format=svg&dark=1&filename=vt-tool-split-view)

> Beberapa alat (seperti **Design**) sebaliknya dibuka sebagai **kanvas bebas** - permukaan manipulasi terus tanpa bingkai antara muka, tempat anda menyeret, mengubah saiz, memutar dan melekapkan kotak teks, bentuk dan imej serta klik dua kali untuk menyunting teks di tempatnya. Ia dieksport melalui laluan render yang sama seperti setiap alat lain, jadi kanvas itu *ialah* fail itu sendiri. Lihat [Kanvas bebas](#the-free-canvas-design) di bawah.

Dua cara untuk membentuk grid itu sendiri menjadi grid yang anda mahukan:

- <!--i:star--> **Bintangkan apa yang anda guna.** ★ sesuatu kad dan ia mendapat jubin besarnya sendiri dalam jalur di atas grid - lihat [Kegemaran anda](/info/favourites.html).
- <!--i:eyeoff--> **Sembunyikan alat yang tidak pernah anda guna.** Klik kanan pada kad (atau pilih beberapa dan gunakan bar pemilihan) → **Hide tool**. Ia terkeluar daripada grid, dan daripada apa yang ditemui semasa anda menaip dalam grid; satu jubin kelabu **Show hidden tools (N)** di penghujung sekali memaparkannya semula dalam keadaan malap, masing-masing dengan **Unhide tool** dalam menunya sendiri. Penyembunyian hanya melibatkan grid anda - alat itu masih boleh dibuka daripada pautan tersimpan atau penanda buku, dan ia kekal di tempat asalnya bagi orang lain.

![Penghujung grid Tools dengan alat tersembunyi dipaparkan: kad QR Code Generator yang malap, dan di sebelahnya jubin kelabu yang menogolkannya kembali ke paparan, kini tertera Hide hidden tools](/t/url-shot?url=%2F%23%2F&width=1440&height=680&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-bulk%3D%22hide%22%5D%3Bwait%3A300%3Bclick%3A.gtile--hiddenbox%3Bpress%3AEnd%3Bwait%3A800&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&rasterDpi=96&dark=1&filename=misc-hidden-tools)
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

Apabila anda lebih suka bertanya daripada mencari, **Ask Lolly** (`#/ask`) menerima soalan yang ditaip dan mengembalikan bahagian dokumentasi ini yang sepadan **kata demi kata** - ayat panduan itu sendiri, bukan ringkasan dan bukan janaan - dengan halaman sumbernya disebut dan pautan **Open in docs** di sebelahnya. Di bawah jawapan itu terletak tempat-tempat dalam aplikasi yang turut sepadan dengan soalan sama: sesuatu alat, sesuatu tetapan, sesuatu projek tersimpan, masing-masing sebagai butang yang terus membawa anda ke sana.

Transkrip itu ialah ingatan sesi: tanya soalan susulan dan bebenang itu terbina sambil anda pergi, kemudian muat semula dan ia bermula dari awal. Hasil carian membawa baris **Ask Lolly: *pertanyaan anda*** di bahagian bawah - di bawah apa jua padanan konkrit yang ditemui kumpulan lain - yang terus menyerahkan soalan itu, jadi anda boleh bermula di bar dan menamatkannya di sini.

## Kanvas (pratonton)

Pratonton sentiasa menunjukkan tepat apa yang akan dieksport.

**Desktop**

- **Zum:** Cmd/Ctrl-tatal, atau cubit pada trackpad - zum berpusat pada penuding anda.
- **Alih pandangan:** tahan **Space** dan seret, atau seret dengan **butang tengah tetikus**. (Klik biasa kekal bebas untuk mengklik bahagian reka bentuk.)
- **Papan kekunci:** `0` = muat ke tetingkap · `1` = 100% · `+` / `−` = zum.
- **HUD zum:** kawalan kecil `−  NN%  +  Fit` di penjuru. Klik peratusan untuk menogol Fit ↔ 100%.

![HUD zum di penjuru kanvas - tolak, peratusan langsung, tambah, Fit, kemudian togol tema dan bunyi](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=.stage-nav%7Bopacity%3A1!important%7D&cropSelector=.stage-nav&walker=1&format=svg&dark=1&filename=use-zoom-hud)

**Sentuh**

- **Cubit** untuk zum, **seret** untuk mengalih pandangan, **ketik dua kali** untuk kembali kepada muat.

**Klik untuk melompat ke sesuatu kawalan:** klik mana-mana elemen dalam reka bentuk dan input bar sisi yang sepadan mendapat fokus serta ditatal ke paparan - bagi kumpulan baris berulang, ia membuka baris tepat yang anda klik, jadi menyunting apa yang anda lihat hanya satu ketikan jauhnya.

Perubahan dimensi sentiasa mengembalikan paparan kepada muat yang kemas.

### Kanvas bebas (Design)

Alat kanvas bebas menambah permukaan kerja *di sekeliling* papan seni, seperti meja kerja pereka:

- **Pementasan luar kanvas.** Seret sesuatu kotak melepasi tepi bingkai dan ia kekal **kelihatan dan boleh dipilih** sepenuhnya - letakkan elemen di tepi sementara anda menyusun komposisi, kemudian seret ia masuk semula. Segala yang berada di luar bingkai **dilembutkan sedikit** supaya kawasan eksport sentiasa jelas dengan satu pandangan, dan bingkai itu mengekalkan bayangnya untuk menandakan tepat di mana fail bermula.
- **Hanya bingkai yang dieksport.** Fail yang dieksport dibataskan oleh papan seni - apa jua yang tertinggal di luar (atau bahagian kotak yang terjuntai melepasi tepi) hanya dipangkas daripada output, dalam format raster mahupun vektor.
- **Zum keluar melepasi Fit** (sehingga 20%) untuk melihat keseluruhan meja kerja apabila anda meletakkan sesuatu jauh di luar bingkai.
- **Papan seni boleh ubah saiz.** Menukar dimensi eksport mengubah saiz bingkai di tempatnya; kotak mengekalkan kedudukannya, jadi anda boleh membingkai semula susun atur di sekeliling kandungan sedia ada.

![Design's free canvas - the artboard with its surrounding pasteboard](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17VVRa9swEP41ekyQLrbjPOyhVeeOrSsbG3lXbLkYZCnISmn264tO9irFhdJCoZQIpBNn9N2dvu_k3cOX1opeEuCTpeNkG0BDy8ljZe28pyDA74UlUC4WOyt0sxgOthW1JJAD9wv1y6rFQWCDMB6BAK-NdqLTBLg2thcqeAnk68vaKGOXg-yFdl29dPLBef8VAZ6V_qjUTloCvO-aRvlcc0QdhB58iCWDMVNnD1iSUIOcAvASY2qsEUeex-XSOEJ6koaT_6Q1iY89IY4mw4TCmmJYc9BNZKPQ00ywxxJS-BlqcnL2KfJF3xhZf3WdwwsMd8xZ4VEgEF6EGornaH-ByW_iHkVAj-aAtpcO7Y1R6kggX1Uz7ext1wt7PNEOk7BZ7UbtYCpKtj4NZ_YE-Doh_hOwHnff-1K_M83xlPmyiJhn8AbmL5C61nZSN8g00OlFoK2xkyjCRofOBro3g5N2OdPE2PqxIGjL1iCCIPA1SPSQpQ_B6qyIVyiCsp8s-_Gn2P76fpHfVlt6WV3_Lv5e5_6mul7cSVRFhiWhOIrsaaVTMbKZaUWNbQ-VMncGN__b_fwn-CAKeAQ&width=1360&height=850&dpi=192&waitMs=3000&format=png&localize=1&dark=1&filename=design)

**Balikkan pilihan.** Klik kanan mana-mana kotak dan pilih **Flip horizontal** atau **Flip vertical** untuk mencerminkannya di tempatnya, atau tekan `Shift+H` / `Shift+V` pada papan kekunci - Shift, kerana `V` sahaja ialah alat Pointer. Setiap kotak yang dipilih mencerminkan pada paksinya sendiri dalam satu langkah undo, dan cerminan itu adalah transform sebenar, jadi ia kekal dalam SVG, PDF dan PNG yang dieksport dan bukan hanya pada kanvas.

### Melukis bentuk anda sendiri (pen)

Kotak, bulatan dan bingkai bulat memenuhi kebanyakan susun atur. Apabila anda perlukan bentuk yang tiada dalam senarai itu, lukis sendiri: butang **Pen** pada rel (atau kekunci `P`) meletakkan anda dalam mod melukis. Tiga kekunci tunggal bergerak antara mod - **`V`** kembali ke Pointer, **`P`** untuk Pen, **`N`** untuk alat nod (**Edit points**) - dan Pointer sentiasa jalan keluar daripada apa jua mod yang anda berada.

![Rel alat kanvas bebas: pemegang seret, menu Lolly, kemudian Pointer, Add a box, Pen, Edit points, Line, Timeline, Artboards dan Auto-arrange](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3D__blank__&width=1440&height=900&dpi=192&waitMs=2600&css=.fc-toolbar%7Bopacity%3A1!important%7D&cropSelector=.fc-toolbar&walker=1&format=svg&dark=1&filename=pen-editor-rail)

- **Klik** untuk meletakkan titik. Pada jenis lengkung lalai, **klik dan seret** menarik keluar pemegang titik itu, dan itulah caranya anda melukis lengkung dan bukan sudut - tahan **Alt** semasa mengklik untuk mendapatkan sudut tajam. (Pada jenis lengkung yang lain, setiap titik yang diletakkan ialah sudut dan seretan itu tidak melakukan apa-apa; lihat **Spline type** di bawah.)
- Titik melekap pada papan seni dan pada kotak anda yang lain semasa diletakkan, melukis panduan yang sama seperti seretan biasa. Alt menyekat grid semasa anda melukis, dan menyekat kedua-dua grid serta tepi semasa anda menyeret titik selepas itu.
- **Klik titik pertama anda** untuk menutup gelung dan selesai dalam satu gerakan. Jika tidak, tekan **Enter**, klik dua kali atau tukar alat sahaja - lukisan itu disimpan, bukan dibuang.
- **Escape** berfungsi satu anak tangga pada satu masa: tekanan pertama meninggalkan lukisan tanpa menulis apa-apa, dan yang kedua keluar daripada pen.
- **Delete** semasa melukis menggugurkan titik terakhir yang anda letakkan.

Hasilnya ialah kotak biasa pada kanvas. Alihkannya, ubah saiznya, putarkannya, kumpulkannya, jajarkannya, susun semula tindanannya, berikannya isian, kecerunan, bayang atau kelegapan - laluan berkelakuan seperti setiap kotak lain, dan tiada satu pun kawalan itu melayannya secara berbeza.

Ia juga hadir sudah bercat. Laluan pertama yang anda lukis mengambil isian dan stroke yang diberikan jenama anda kepada laluan, dan selepas itu setiap laluan baharu mengambil **apa jua yang terakhir anda guna** - tetapkan isian sekali dan teruskan melukis, bukannya mewarnakan semula setiap bentuk. (Dalam alat yang jenamanya tidak menyatakan apa-apa tentang laluan, laluan yang dilukis diberi stroke dalam warna yang anda lihat semasa ia dilukis, jadi ia tidak pernah menjadi tidak kelihatan.)

**Menyunting titik semula.** Klik dua kali pada bentuk itu (atau gunakan **Edit points** pada bar objek) dan titik-titik itu muncul semula. Seret titik untuk mengalihkannya, seret pemegang untuk mengubah arahnya, klik di mana-mana pada lengkung untuk menyisipkan titik, buat pemilihan getah pada sekumpulan titik dan tekan Delete untuk membuang titik terpilih. Laluan sentiasa mengekalkan sekurang-kurangnya dua titik, jadi anda tidak boleh terpadam ia sehingga hilang terus.

**Spline type** menentukan jenis lengkung yang merentasi titik anda, dan inilah pilihan yang berbaloi difahami:

| Jenis | Apa yang dilakukannya |
|---|---|
| **Smooth (auto)** | Lalai. Ia mengira sendiri panjang pemegangnya, jadi klik-klik-klik biasa memberikan lengkung yang benar-benar licin tanpa perlu bergelut dengan pemegang. Jika anda menetapkan pemegang, ia mengunci *arah* dan lengkung itu kekal memiliki panjangnya. |
| **Bezier handles** | Pen klasik. Pemegang ialah titik kawalan, dan menyisipkan titik tidak pernah menggerakkan lengkung. |
| **Through the points** | Melalui tepat setiap titik yang anda letakkan, tanpa pemegang. |
| **B-spline** | Mengalir berhampiran titik dan bukan melaluinya, untuk bentuk yang lebih lembut. |
| **Straight lines** | Satu polyline. |

Menukar laluan sedia ada kepada jenis yang mengira sendiri pemegangnya akan bertanya dahulu, kerana panjang pemegang yang anda tetapkan tidak boleh dipulihkan - bertukar kepada **Bezier handles** sentiasa tanpa kehilangan. Di tengah-tengah lukisan tiada gesaan: pertukaran itu terus dikenakan pada draf, dan mana-mana pemegang yang sudah anda tarik turut terkesan. Pada jenis yang memiliki pemegangnya sendiri, menyisipkan titik mengubah bentuk lengkung sedikit; pada **Bezier handles** tidak.

Setiap titik turut membawa peraturan kesinambungan, ditunjukkan oleh bentuknya pada kanvas - segi empat sama untuk **Corner** (pemegang bergerak secara bebas), bulat untuk **Smooth** (pemegang kekal sebaris), bulat bercincin untuk **Symmetric** (sebaris dan sama panjang). Tetapkannya untuk mana-mana titik terpilih dan lengkung itu akan mematuhinya serta-merta.

![Dua laluan pen yang dirender terus daripada satu pautan: lengkung S bergaris dan satu bentuk tertutup berisi](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22curve%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A140%2C%22y%22%3A180%2C%22w%22%3A800%2C%22h%22%3A420%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A14%2C%22path%22%3A%221!cubic!0_.02!.85!!!.25!-.45!s_.5!.5!-.22!.32!.22!-.32!y_.98!.12!-.25!.45!!!s%22%7D%2C%7B%22id%22%3A%22blob%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A340%2C%22y%22%3A620%2C%22w%22%3A400%2C%22h%22%3A320%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23d1e7ff%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A6%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!catmull-rom!1_.5!0_1!.42_.78!1_.22!1_0!.42%22%7D%5D&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=pen-path-geometry)

Laluan yang dilukis turut dibawa dalam pautan seperti segala yang lain, jadi bentuk yang anda lukis boleh dibuka semula daripada pautan kongsi dan dirender sama tepat daripada CLI. Tiada apa-apa padanya yang bergantung pada editor.

### Menggabungkan bentuk (operasi laluan)

Pilih dua atau lebih bentuk, **klik kanan** pada kanvas (ketik dua jari pada skrin sentuh) dan menu itu menawarkan operasi yang anda jangkakan daripada sebuah aplikasi lukisan:

- **Union** menggabungkannya menjadi satu bentuk, mengekalkan cat bentuk paling atas.
- **Subtract** memotong segala yang di atas daripada bentuk paling bawah.
- **Intersect** hanya mengekalkan kawasan bertindih.
- **Exclude** mengekalkan segalanya kecuali kawasan bertindih.

Tiga lagi berfungsi pada satu bentuk tunggal: **Outline stroke…** menukar stroke menjadi bentuk berisi dengan garis luar yang sama (berguna apabila anda mahu mengekalkan ketebalan tepat seperti dilukis), **Offset path…** membesarkan siluet ke luar atau, dengan nombor negatif, mengecilkannya ke dalam dan **Simplify** membina semula laluan dengan segmen yang lebih sedikit pada bentuk yang sama.

![Sabit dan cincin dengan lubang sebenar, kedua-duanya dihasilkan oleh Subtract](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22crescent%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A120%2C%22y%22%3A330%2C%22w%22%3A374%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22path%22%3A%221!cubic!1_.750491!.957645!-.128211!-.062578!-.065985!.027232!c_.534759!1!.076762!!-.295339!!c_0!.5!!.276142!!-.276142!c_.534759!0!-.295339!!.200102!!c_1.000984!.254923!-.09169!-.152161!-.021205!-.003239!c_.935829!.25!.022185!!-.221505!!c_.534759!.625!!-.207107!!.14459!c%22%7D%2C%7B%22id%22%3A%22ring%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A580%2C%22y%22%3A330%2C%22w%22%3A400%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!cubic!1_1!.5!!-.276142!!.276142!c_.5!1!.276142!!-.276142!!c_0!.5!!.276142!!-.276142!c_.5!0!-.276142!!.276142!!c*1!cubic!1_.5!.7!-.110457!!.110457!!c_.7!.5!!.110457!!-.110457!c_.5!.3!.110457!!-.110457!!c_.3!.5!!-.110457!!.110457!c%22%7D%5D&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=path-ops-boolean-result)

Hasilnya ialah laluan baharu yang boleh anda terus sunting dengan pen. Lubang ialah lubang sebenar - kawalan **Fill rule** pada panel stroke menentukan sama ada kontur bertindih itu terisi (*non-zero*) atau menembusi (*even-odd*).

Dua perkara yang sengaja tidak dilakukan oleh operasi ini. Ia **menolak dan bukan memusnahkan**: minta untuk menyilangkan dua bentuk yang tidak bertindih dan anda diberitahu tiada apa-apa untuk dikekalkan, dan tiada apa-apa berubah. Dan kotak teks serta imej tiada garis luar untuk digunakan, jadi ia dibiarkan sahaja dan bukan dianggarkan melalui bingkainya. Hasil gabungan disimpan sebagai lengkung Bezier biasa, sama seperti yang dilakukan aplikasi lukisan - jenis spline asal tidak kekal selepas operasi itu.

## Garis masa (Sequence Studio)

![The timeline with the music clip selected: its strip runs along the bottom with Speed, Fades, Volume, Pan, EQ, Pitch, Normalize volume and the Effect slot](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dvideo%26_sel%3Dbed&width=1440&height=900&dpi=192&waitMs=5000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A300px!important%7D&cropSelector=.tl-panel&walker=1&format=svg&dark=1&filename=tl-audio-strip)

**Sequence Studio** menambah *masa* kepada kanvas bebas. Setiap kotak boleh bermula pada satu saat, berjalan untuk satu tempoh dan beranimasi masuk dan keluar, dan garis masa yang berlabuh di bawah papan seni ialah tempat anda menyusunnya. Bukanya dan sudah ada satu jujukan sedang dimainkan - kad tajuk, satu klip, kad penutup, satu lower-third dan lapisan muzik - jadi modelnya kelihatan sebelum anda mengubah apa-apa.

![Garis masa Sequence Studio: transport, pembaris, laluan overlay, baris jujukan magnetik dengan klip dan cip sisinya dan jalur Always on](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A252px!important%7D&cropSelector=.tl-panel&format=svg&walker=1&tolerance=0.03&dark=1&filename=seq-studio-timeline)

Terdapat dua jenis baris, dan perbezaannya itulah keseluruhan ideanya:

- **Baris jujukan** bersifat *magnetik*. Klip duduk tanpa jurang, satu demi satu, dan menyeret satu klip menyusun semula urutan itu dan bukannya meninggalkan lubang. Padam satu klip dan yang lain merapat. Inilah tulang belakang anda.
- **Lorong tindanan** pula bebas. Satu lower-third, satu logo, satu kapsyen - apa jua yang terapung di atas tulang belakang pada masanya sendiri - mendapat lorongnya sendiri dan permulaannya sendiri.
- Di bawahnya, **Always on** mengumpulkan kotak yang langsung tiada pemasaan: latar yang memang hadir sepanjang masa. Butang `+` pada sesuatu cip menaikkannya ke sesuatu lorong; **Make always on** menghantarnya kembali.

![Pentas penyuntingan: artboard di tengah hadapan, rel alat di sebelah kiri dan HUD zum di penjuru](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.fc-toolbar%7Bopacity%3A1!important%7D&format=svg&walker=1&tolerance=0.03&dark=1&filename=seq-studio-stage)

Membuka garis masa menyerahkan papan kekunci kepadanya, jadi Space dan kekunci anak panah memandu kepala main dan bukannya halaman - dan kerana ia terbuka sendiri pada komposisi yang sudah mempunyai pemasaan, keadaan itu berlaku sebaik sahaja Sequence Studio dimuatkan.

> **[Editor jujukan](/info/sequence-editor.html)** membincangkan dengan lebih mendalam empat perkara yang menentukan sama ada penyuntingan dalam masa terasa boleh dijangka: klip mana yang disunting oleh klik pada kanvas, bayang onion-skin klip bersebelahan, skop pemisahan dan Join yang membatalkan potongan serta pemangkasan (termasuk set papan kekunci). Tekan `?` dengan garis masa difokuskan untuk mendapatkan helaian pintasan.

**Menyunting.** Seret bahagian tengah klip untuk mengalih atau menyusunnya semula, seret dalam beberapa piksel daripada mana-mana hujung untuk memangkasnya dan tekan **Split at playhead** (atau `S`) untuk memotong satu klip menjadi dua. Split memerlukan klip dengan **Length** sebenar dan kepala main berada sedikit di dalamnya, jadi klip terbuka hujung (lapisan muzik, contohnya) tidak boleh dipisahkan. **Snap to edges** dihidupkan secara lalai dan melekap pada tepi klip, kepala main dan saat penuh, dengan Alt untuk mengatasinya. Setiap seretan ialah satu langkah buat asal, dan pratonton seretan menjalankan aritmetik yang sama seperti komitnya, jadi apa yang anda lihat semasa menyeret itulah yang anda dapat.

Pilih satu klip dan pemeriksa memberikan suntingan yang sama dalam bentuk nombor: **Length**, **Trim in** (sejauh mana ke dalam sumber ia bermula), **Speed** sebagai satu set pendarab tetap daripada ×0.25 hingga ×4, **Animate in** / **Animate out** dengan panjangnya dan **Mute clip**. Klip pada baris magnetik sengaja tidak mempunyai medan **Start** - baris itu memiliki susunannya, jadi anda menyeret untuk mengalihkannya.

**Peralihan** ialah pratetap, bukan keyframe: Fade, Pop, Grow, Rise, Drop, empat Slides, Zoom in dan out, Tilt, Swoop, Spin, Drift atau **Cut (no animation)**. Jarak berskala mengikut objek, jadi pratetap yang sama terbaca dengan betul pada kad penuh bingkai mahupun lencana kecil. Antara dua klip bersebelahan pada baris jujukan terdapat **cip sambungan**: klik padanya dan pilih **Cut** atau **Crossfade**, yang dikenakan serta-merta dan menutup. Buka cip yang sama semula untuk menukar **Length (ms)** dan tekan **Done**. Crossfade disimpan sebagai satu pudar keluar daripada klip pertama dan satu pudar masuk ke klip berikutnya, dan eksport menerbitkan larutan sebenar daripada pasangan itu - itulah sebabnya crossfade kelihatan seperti dua pudaran dalam pratonton dan penyerahan sebenar dalam fail.

**Bunyi.** Tambah klip **Audio** dan ia berada pada garis masa seperti klip lain: bentuk gelombang, pangkas, redam. (Lapisan muzik terjana yang disertakan sesi lalai ialah satu-satunya pengecualian - ia disintesis pada waktu eksport, jadi barnya kekal kosong dan senyap sehingga anda merender.) Tekan mikrofon untuk **merakam suara latar** terus ke garis masa, dengan kiraan masuk dan meter aras, dan rakaman itu disimpan sebagai aset anda sendiri pada titik anda mula. Tekan kamera di sebelahnya untuk **merakam video** dengan cara yang sama: rakaman itu dipangkas mengikut saiz eksport papan seni semasa ia dirakam, jadi paparan diri yang kecil menunjukkan dengan tepat apa yang masuk ke jujukan pada kepala main, bingkai penuh - cara untuk mengumpul klip rakan sekerja daripada pautan yang dikongsi. Muzik, dialog dan runut bunyi klip itu sendiri semuanya sampai ke campuran yang dieksport. (**Audio track** pada panel eksport ialah perkara yang berbeza: satu lapisan diletakkan di bawah keseluruhan klip, dengan pudar dan ducking. Kedua-duanya boleh wujud bersama.)

**Merendernya.** Eksport gerakan ialah **komposit berketentuan**, bukan rakaman skrin - setiap bingkai dinyahkod, dilukis dan dikodkan pada masa yang tepat, jadi fail itu tidak bergantung pada keupayaan mesin anda mengejar, dan tiada had bingkai yang praktikal pada MP4 atau WebM. Panjang garis masa itu sendiri menetapkan tempoh melainkan anda menaip satu. Content Credentials dicap sama seperti pada mana-mana eksport lain. Eksport pegun memberikan anda bingkai pada kepala main, atau keseluruhan helaian hubungan daripada medan **Frames** di sebelah saiz output - lihat [Mengeksport](/info/exporting.html#stills-from-a-timed-composition).

Beberapa had untuk diingat: satu jujukan dihadkan kepada satu jam, GIF dan PNG beranimasi menimbal bingkainya jadi ia kekal pendek, audio senyap pada klip yang kelajuannya bukan ×1 (belum ada regangan masa) dan **Record live** disembunyikan di sini kerana pengkomposit ialah laluan yang lebih baik.

**Melangkaui prapenetapan: keyframe, depth dan satu kamera.** Satu peralihan menganimasikan sesuatu klip semasa ia tiba dan pergi. Untuk memberi pose kepada sesuatu kotak *di dalam* sesuatu klip - menghanyutkannya, memudarkannya, mengaburkannya, mengangkatnya daripada halaman lalu meletakkannya semula - tambahkan keyframe: pilih klip itu, tekan **+Keyframe** (bentuk berlian pada kluster alat garis masa, bentuk berlian pada bar objek kanvas atau `K`) dan kedudukan playhead menentukan pose mana yang ditulis oleh suntingan seterusnya anda. Sistem keyframe yang sama memberikan setiap komposisi berjangka masa satu **kamera** yang menolak masuk, panning merentas dan menarik fokus, serta mengubah satu SVG rata menjadi tindanan lapisan yang boleh anda terbang di antaranya. **[Animating](/info/animating.html)** ialah panduan lengkapnya.

Alat Design mempunyai garis masa yang sama, jadi anda boleh memasa sesuatu susun atur tanpa berpindah ke alat lain, dan ia turut mengeksport gerakan.

## Membentangkan

![The inspector's Document section: Voice, Blend with, Speed, Lead-in, Tail and Show captions when presenting](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour&width=1440&height=900&dpi=192&waitMs=3500&cropSelector=.fc-insp&walker=1&format=svg&dark=1&filename=design-narration)

Dokumen Design yang terdiri daripada **papan seni** sudah pun menjadi dek slaid. Buka **menu Lolly** pada rel alat dan pilih **Present** - baris terakhir - dan setiap papan seni menjadi slaid skrin penuh, mengikut susunan papan seni itu pada kanvas. Dek itu berjalan pada salinan papan seni yang dirender, jadi editor di bawahnya tidak pernah disentuh dan meninggalkannya mengembalikan anda tepat ke tempat anda tadi.

- **Maju** dengan **Space**, `→`, **Page Down** atau klik pada jalur di tepi kanan skrin; kembali dengan `←`, **Page Up** atau jalur di tepi kiri. **Home** dan **End** melompat ke slaid pertama dan terakhir. Satu bar kawalan kecil pudar masuk apabila anda menggerakkan penunjuk dan tersembunyi semula sebaik sahaja anda berhenti.
- **Gambaran Keseluruhan** (`O` atau butang grid) menyusun setiap artboard sekali gus dalam susunan yang anda berikan pada kanvas; klik satu untuk membukanya.
- **Dedah langkah.** Klik kanan satu kotak dan pilih **Reveal at step 1**, **2** atau **3** dan bukannya lalai **Always visible**. Kotak itu kemudian menunggu sehingga anda maju ke langkahnya, jadi satu slaid boleh tiba secara berperingkat; kotak yang berkongsi nombor yang sama tiba bersama.
- **Paparan Penceramah** (`S`) membuka tetingkap kedua dengan slaid semasa, slaid seterusnya, nota anda untuk slaid itu dan jam yang berjalan. Jika pelayar menyekat tetingkap pop timbul, ia beralih kepada panel di atas dek. Nota ditetapkan bagi setiap artboard dan tidak pernah muncul pada slaid itu sendiri.
- `B` menahan skrin hitam (sebarang kekunci mengembalikan slaid), `F` kembali ke skrin penuh dan **Escape** mengupas satu lapisan pada satu masa: gambaran keseluruhan kembali ke dek, dek kembali ke editor.
- **Kiosk.** Berikan satu artboard **Length** dan dek itu akan bertahan di situ untuk tempoh itu, kemudian maju dengan sendirinya di sebalik bar kemajuan yang nipis; `K` (atau butang jeda, yang hanya muncul sebaik sahaja sesuatu mempunyai Length) menghentikan dan memulakan semula itu. Tambah `kiosk` pada pautan dan dek itu akan berpusing semula pada penghujungnya, dan itulah yang menjadikannya papan tanda.

Dek itu juga sebuah pautan. `?present` terus membukanya, `s=` menamakan slaid - satu kedudukan, satu id papan seni atau `id.step` untuk langkah binaan - dan alamat itu dikemas kini sambil anda bergerak, jadi apa yang anda hantar ialah slaid yang sedang anda buka. Penulis alat: parameter itu didokumenkan pada halaman [URL Mode](/info/url-mode.html#reserved-parameters).

## Pada telefon

Pada skrin sempit, susun atur mengalir semula kepada satu lajur:

- **Kawalan menjadi helaian** di bahagian atas dengan **pemegang seret** pada tepi bawahnya. Seret pemegang itu untuk mengubah saiznya - ia melekap pada **peek / half / full** - atau **ketik** pemegang itu untuk menogol antara terkuncup ↔ terkembang. Pratonton mengisi ruang di bawah dan kekal kelihatan semasa anda menyunting.
- Butang **Export** terapung membuka helaian eksport - semua kawalan format, saiz, salin, simpan dan muat turun di satu tempat. Tutupnya dengan mengetik latar belakang.

![Sesuatu alat pada skrin selebar telefon - kawalan sebagai helaian di atas, palet terjana mengisi pratonton di bawah dan pil render terapung di tengah bawah](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3Df97316%26harmony%3Dadjacent-3%26steps%3D9&width=430&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=vt-phone-palette)

## Kawalan (input)

Alat hanya mendedahkan input yang memang boleh berubah - segala yang lain (warna, susun atur, tipografi, logik) dikunci oleh penulis alat, jadi apa jua yang anda hasilkan menepati peraturan yang ditetapkan penulis. Input termasuk teks, gelangsar, pemilih warna, senarai juntai bawah, tarikh, pemilih imej dan kumpulan baris berulang. Sebahagiannya dikumpulkan di bawah bahagian yang boleh dikuncupkan.

![Susunan kawalan sesuatu alat - medan teks, pencetus warna dan gelangsar, dan tiada apa lagi kerana selebihnya dikunci oleh penulis](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=%23tool-inputs&walker=1&format=svg&dark=1&filename=use-tool-inputs)

**Set semula:** *Clear changes* mengembalikan setiap input kepada nilai lalainya.

### Buat asal dan buat semula

**Cmd/Ctrl-Z** melangkah ke belakang dan **Cmd/Ctrl-Shift-Z** (atau **Cmd/Ctrl-Y**) melangkah ke hadapan semula. Pasangan yang sama hadir sebagai butang **Undo** dan **Redo** dalam baris di atas kawalan - pada kanvas bebas ia berada pada rel alat - dan setiap satunya menjadi kelabu apabila tiada apa lagi untuk ditarik balik. Setiap langkah menyatakan apa yang berlaku: buat asal sesuatu warna dan mesej kecil menamakan input yang baru dipulihkannya, dengan butang **Redo** di dalamnya untuk jalan kembali.

- **Satu seretan ialah satu langkah.** Perubahan berulang pada kawalan yang sama dalam masa setengah saat digabungkan, jadi menarik gelangsar merentas julatnya ialah satu buat asal dan bukan dua ratus.
- **100 langkah terakhir disimpan** - yang lebih lama gugur di hujung. Membuat suntingan baharu selepas buat asal mengosongkan tindanan ke hadapan, sama seperti di tempat lain.
- **Semasa kursor anda berada dalam kotak teks**, Cmd/Ctrl-Z menjadi milik medan itu sendiri, aksara demi aksara. Lolly mengambil alih bagi kawalan yang tiada buat asal berguna tersendiri: gelangsar, senarai juntai bawah, warna dan suis.
- **Memilih fail** dalam input **file** bukan satu langkah - bait itu dipegang untuk sesi itu sahaja, jadi tiada apa-apa untuk dikembalikan.

Dalam satu [kerjasama](/info/collaborate.html) langsung, sejarah kekal milik anda sahaja. Perubahan yang tiba daripada peranti lain tidak pernah masuk ke dalam tindanan anda, jadi buat asal hanya boleh mengembalikan sesuatu yang anda lakukan sendiri.

## Butiran & foto potret anda

**Profile** (kanan atas galeri) menyimpan nama, butiran hubungan dan **foto potret** pilihan anda. Alat yang meminta medan tersebut mengisinya secara automatik - tetapkan sekali dan tandatangan e-mel, lockup dan lencana anda mengisi dirinya sendiri. Anda masih boleh mengatasi mana-mana medan bagi setiap sesi. Sertai dengan **Use my details to create** supaya butiran anda turut dibawa sebagai penulis pada apa yang anda eksport.

Foto potret dan butiran anda berada **hanya pada peranti ini**. Satu profil boleh mewakili lebih daripada diri anda - sesebuah pasukan atau peranan yang anda pikul dari semasa ke semasa. Lihat **[Profil](/info/profile.html)** untuk gambaran penuh, termasuk menyimpan lebih daripada satu.

## Menyimpan & menyambung

Klik **Save** untuk menyimpan input semasa sebagai satu sesi bagi alat tersebut. Anda boleh menyimpan beberapa sesi bernama bagi setiap alat; butang **Continue** setiap alat membuka semula sesi terkini anda, dan **butang sejarah** (kanan atas, di sebelah profil anda) menyenaraikan setiap sesi tersimpan merentas semua alat. Sesi bersifat setempat pada peranti. Untuk menyusunnya, buka **Projects** (di bawah).

![Pil render dua bahagian - anak panah ke atas yang membuka panel eksport, dan tanda betul yang menyimpan sesi di tempatnya](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=%23tool-inputs%7Bdisplay%3Anone%7D&cropSelector=.render-pill&walker=1&format=svg&dark=1&filename=use-render-pill)

## Projects

**Projects** - bukanya daripada tab **Projects** di sebelah **Tools**, atau daripada **Profile → Storage → Organise in Projects** - ialah rumah bagi segala yang anda simpan, dan ia berfungsi seperti pengurus fail:

![Projects - sesi tersimpan disusun ke dalam folder bersarang](/t/url-shot?url=%2F%23%2Fp&width=1440&height=900&dpi=192&waitMs=1200&walker=1&format=svg&localize=1&dark=1&filename=projects)

- <!--i:folder--> **Folder bersarang.** Kumpulkan sesi tersimpan ke dalam folder, dan folder di dalam folder, sedalam yang anda mahu. Cipta folder, namakan semula atau seret jubin ke atas folder lain untuk mengalihkannya; jejak roti membawa anda kembali ke atas. Folder **Uncategorised** yang sentiasa ada menyimpan apa jua yang belum difailkan.
- <!--i:clock--> **Susun ikut cara anda.** **View & sort** menawarkan **Name**, **Date added**, **Last modified** (yang lalai) dan, di dalam folder, **By tool**. Folder sentiasa didahulukan tidak kira susunan mana yang aktif - susunan itu hanya mengatur sesi dan folder dalam kumpulannya sendiri.
- <!--i:document--> **Failkan kerja baharu terus ke dalamnya.** **New asset** ("Start a fresh creation" di akar, "Add to *folder*" di dalam folder) membuka sesuatu alat dan memfailkan simpanan pertamanya ke dalam folder itu secara automatik.
- <!--i:checklist--> **Pilih berbilang (desktop).** Tandakan kotak semak jubin, seret kotak pemilihan merentas ruang kosong atau **Shift/Cmd-klik**; **klik kanan** pada jubin untuk menu konteksnya. Kemudian bertindak ke atas keseluruhan pemilihan sekali gus - gerak isyarat yang sama dan bar tindakan terapung yang sama berfungsi pada galeri Tools, Utilities, Katalog dan Projects, bukan di sini sahaja.
- <!--i:download--> **Render satu folder atau pemilihan penuh.** **Render folder** mengeksport setiap sesi tersimpan dalam sesuatu folder - termasuk sub-foldernya - sebagai satu `.zip` bersarang. **Render selection** melakukan perkara sama bagi mana-mana pemilihan berbilang, dan sesi tunggal dirender terus ke failnya sendiri. Tidak perlu Batch/Pro.
- <!--i:link--> **Terus ke kerja tersimpan sesuatu alat.** Tandakan satu atau lebih alat pada galeri Tools dan pilih **View sessions** daripada bar pemilihan - Projects terbuka menunjukkan hanya sesi yang dibuat dengan alat tersebut, dengan **Clear** untuk kembali ke paparan penuh.
- <!--i:link--> **Kongsi sesi tersimpan.** Klik kanan pada sesi → **Share link** untuk menyalin pautan yang membukanya semula dengan input yang sama tepat (dialog Share penuh - lihat di bawah).

![Popover View and sort dalam Projects terbuka, dengan baris tema, pilihan View iaitu Preview atau List dan Name, Date added serta Last modified di bawah Sort](/t/url-shot?url=%2F%23%2Fp&width=900&height=700&dpi=192&waitMs=1400&drive=click%3A.projects-viewopts&cropSelector=.projects-viewmenu&walker=1&format=svg&dark=1&filename=misc-projects-sort)
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

**Apa yang ditawarkan bar pemilihan** berbeza sedikit mengikut paparan, kerana bukan setiap tindakan sesuai di mana-mana:

- **Tools / Utilities:** Favourite (atau Unfavourite), Hide (atau Unhide), Available offline (atau Remove from offline), **View sessions** (lompatan yang diterangkan di atas) dan Copy link apabila tepat satu kad dipilih.
- **Katalog:** Favourite dan Hide dikenakan pada mana-mana pemilihan; Duplicate, Download dan Delete hanya muncul apabila setiap item yang dipilih ialah muat naik anda sendiri - aset sistem reka bentuk yang dikongsi ialah kontrak kekal, jadi ketiga-tiganya kekal tidak tersedia untuknya walaupun secara pukal.
- **Projects:** **Render selection**, **Move to…**, **New folder**, **Delete**, **Edit together** apabila pemilihan itu antara dua hingga lapan sesi daripada satu alat (ia membukanya bersebelahan di bawah satu bar sisi bergabung) dan **Edit as sheet**, yang sebaliknya membuka keseluruhan pemilihan sebagai baris dalam grid kelompok. Yang itu **tiada had saiz** dan tidak kisah sama ada sesi itu datang daripada alat yang sama, jadi itulah jalan keluar apabila sesuatu pemilihan lebih besar atau lebih bercampur daripada had dua-hingga-lapan Edit together.

> Satu perangkap label: **View sessions** hanya wujud setelah sesuatu *dipilih*. Klik kanan pada satu kad yang tidak dipilih sebaliknya menawarkan **N saved sessions**, yang membuka dialog sejarah alat itu sendiri dan bukannya membawa anda ke Projects.

![Dua kad alat ditandakan dalam galeri Tools, dengan bar pemilihan terapung bertulis "2 selected" dan menawarkan Available offline, View sessions, Favourite dan Hide](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-select%3D%22gradient%22%5D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=misc-bulkbar-gallery)
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


## Berkongsi kerja anda

Sesuatu reka bentuk keluar melalui salah satu daripada dua cara: sebagai pautan atau sebagai fail. Dialog Share menawarkan kedua-duanya. Bukanya dengan **Share** dalam kawalan eksport; **Share link** pada sesi tersimpan dalam Projects membuka dialog yang sama bagi sesi tersebut.

### Pautan

Setiap input dirakam dalam URL halaman, jadi sesuatu pautan itu *ialah* reka bentuk itu sendiri. Di bahagian atas dialog terletak pautan yang sedia untuk disalin, dengan dua bahagian terkuncup di bawahnya.

- **Link options** mengandungi **Shortest link** (reka bentuk yang besar menghasilkan URL yang panjang, jadi ini memadatkan keseluruhan keadaan ke dalam token ringkas dan menunjukkan penjimatan dalam bilangan aksara; bentuk yang boleh dibaca sentiasa ada juga), **Password-protect this link** (AES-256 ke atas keseluruhan pautan, kata laluan tidak pernah berada di dalamnya) dan **Pin this tool version** - bendera `_v`, yang mengunci pautan itu pada versi alat yang sedang anda lihat supaya kemas kini kemudian tidak boleh mengubah apa yang direndernya.
- **Link behaviour** ialah apa yang berlaku apabila penerima membukanya: skrin penuh, panel eksport yang sudah terkembang, muat turun sebaik dibuka dengan `&export` atau salin ke papan keratan dengan `&copy`.

Tampalkan pautan itu kepada rakan sekerja, tandabukukannya atau komitkannya. (Butiran penuh: [URL Mode](/info/url-mode.html).)

**Bagi sesetengah alat, pautan itulah keseluruhan produknya.** Jump Page mengumpulkan pautan anda ke dalam satu halaman untuk diedarkan - satu bio link, satu ucapan persidangan, satu shop front. Tiada apa-apa untuk dihosting dan tiada akaun di sebaliknya: halaman itu ialah pautannya, jadi ia terbuka secepat URL itu sampai. Dalam penyunting anda melihat halaman siap di sebelah medan-medannya; pelawat yang membuka pautan itu mendapatnya dalam lebar penuh, satu pautan bagi setiap scene semasa mereka scroll.

![Jump Page dalam penyunting - tajuk, tiga scene pautan masing-masing dengan wash-nya sendiri dan satu footer Made with Lolly, disusun sebagai satu halaman dalam kanvas](/t/url-shot?url=%2F%23%2Ftool%2Fjump%3Ffull&width=900&height=1300&dpi=96&waitMs=2000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=use-jump-page)

**Dialog itu menyatakan apa yang tidak boleh dibawa oleh pautan.** Tiga perkara tidak muat dalam URL: imej atau fail yang anda tambah daripada peranti ini, nilai teks yang sangat panjang atau senarai yang sangat besar. Setiap satunya dikira semasa pautan dibina. Jika ada yang terpaksa digugurkan, dialog itu menamakannya dan menunjukkan anda kepada fail di bawah, dan bukannya menyerahkan pautan yang terbuka tanpa gambarnya. Pautan yang sekadar *panjang* mendapat nota yang lebih ringan bersama kiraan aksaranya, kerana pemadatan masih boleh menyelamatkan panjang itu.

### Fail .lolly

**Download .lolly**, dalam dialog Share alat yang sedang anda guna, menulis reka bentuk yang sama sebagai fail. Ia membawa sesi tersimpan bersama imej dan fail yang anda tambah daripada peranti anda. Seni katalog yang digunakan reka bentuk itu turut dibawa di dalamnya, jadi fail itu terbuka lengkap pada mesin yang tidak pernah melihat jenama anda. Jika peranti anda mempunyai helaian perkongsian, **Send to…** menyerahkan fail itu terus kepadanya (AirDrop, perkongsian Android) dan bukannya menyimpannya ke cakera.

Fail `.lolly` ialah zip biasa. Namakan semula sebagai `.zip` dan bukanya: imej anda sendiri berada di bawah `assets/uploads/` dan seni katalog di bawah `assets/catalog/`, masing-masing dengan nama dan sambungan sebenarnya, `manifest.json` menyenaraikan setiap satunya dan satu README di bahagian atas menyatakan apa itu fail tersebut.

Tiga perkara terpulang kepada anda untuk diputuskan sebelum ia dihantar:

- **Sama ada nama anda disertakan.** Nama, e-mel dan organisasi anda ditulis ke dalam fail hanya apabila **Use my details to create** dihidupkan dalam profil anda. Dengan ia dimatikan, fail hanya merekodkan bahawa ia dibuat dengan Lolly dan bila - tiada apa-apa tentang anda.
- **Sama ada karya berlesen disertakan.** Aset berlesen dan berkunci jenama ditahan secara lalai. Jika reka bentuk menggunakan mana-mana, dialog menyatakan berapa banyak dan menawarkan dua butang - *Download without them* atau *Include and download* - kerana menyertakannya menyerahkan fail sebenar kepada sesiapa yang membuka `.lolly` itu.
- **Sama ada alat disertakan.** **Include the tool** membungkus fail alat itu sendiri bersama reka bentuk, supaya ia boleh dibuka pada peranti yang tiada alat tersebut. Ia tiba ditanda untuk alat tersuai - fork atau alat jenama peribadi yang penerima anda tidak mungkin ada - dan tidak ditanda untuk alat yang disenaraikan dalam katalog bertandatangan, kerana salinan mereka datang daripada sumber yang sama. (Pada binaan tanpa katalog bertandatangan, setiap alat dikira sebagai tersuai dan kotak bermula ditanda.)

**Membuka satu.** Lepaskan satu fail `.lolly` ke atas aplikasi: aset-asetnya masuk ke pustaka anda, sesi itu masuk ke Projects dan alat itu terbuka padanya. Tiada apa-apa milik anda ditulis ganti: sesi itu tiba sebagai slot tersimpan baharu, manakala aset yang sudah ada pada peranti ini dipadankan melalui checksum dan digunakan semula dan bukannya diduplikasi. Setiap bahagian disemak berbanding checksum milik fail itu sendiri semasa masuk, jadi salinan yang rosak semasa transit ditolak dan bukannya diimport separuh.

Jika fail itu membawa alat yang anda tidak miliki, Lolly bertanya sebelum alat itu boleh berjalan: **Trust this tool?** menamakan alat dan penulisnya serta menyatakan dengan jelas bahawa membukanya akan menjalankan kod alat itu sendiri pada peranti anda, dengan **Trust & install** sebagai jalan untuk meneruskan. Tolak dan kerja yang dikongsi itu tetap disimpan ke dalam projek anda, menunggu di situ untuk hari anda menambah alat tersebut. (Satu jenis alat belum boleh dimuatkan sampingan lagi - alat yang kodnya dihantar sebagai modul - dan ia ditolak dengan cara yang sama.)

Pautan dan fail kedua-duanya menyerahkan syot kilat. Untuk bekerja pada sesi yang sama *pada masa yang sama* dengan orang lain - dua peranti, tiada pelayan, tiada internet diperlukan jika anda berada pada satu rangkaian - lihat [Bekerja bersama](/info/collaborate.html).

## Kamera langsung (alat bertindak balas kepada gerakan)

Setiap **Filter** foto - Halftone, Scanline, Posterize, Voronoi cells, Colour treatment, Pixel stretch dan Imperfections - menunjukkan butang **Go live** apabila kamera tersedia. Hidupkannya dan kesan itu menjejak kamera web anda bingkai demi bingkai, jadi ia bertindak balas kepada pergerakan; anda boleh merakam hasilnya ke GIF, WebM atau MP4. Bingkai dibaca dan diproses **pada peranti anda** dan tidak pernah meninggalkannya, dan kamera dilepaskan sebaik anda berhenti atau meninggalkan alat itu. (Mana-mana pemilih imej juga mempunyai **Take a photo** untuk menangkap satu bingkai sebagai imej pada peranti.)

## My images

Apabila sesuatu alat membenarkan anda menambah imej daripada peranti anda, ia disimpan tepat seperti ia tiba - jadi Content Credential padanya masih boleh disahkan - dan disimpan ke dalam pustaka peribadi **My images** anda (di bawah **Profile → Storage**). Hanya fail yang benar-benar besar akan bertanya sama ada hendak mengekalkan atau mengubah saiznya. Guna semula ia dalam mana-mana alat. Untuk membersihkan EXIF/GPS semasa imej masuk, hidupkan **Strip metadata from uploads** dalam profil anda. Tiada had: pustaka itu sepenuhnya setempat dan hanya dibataskan oleh storan peranti anda - urus atau padam imej di situ.

## Katalog - pustaka aset anda

**Katalog** (`#/c`, atau segmen **Catalog** pada suis Projects · Tools · Utilities · Catalog di bahagian atas setiap paparan senarai) mengumpulkan segala yang boleh digunakan alat anda - logo jenama, imej, audio dan gerakan, dikumpulkan mengikut jenis - dan di situ juga **fail kreatif anda sendiri** berada. Tiada pelayan, tiada konsol pentadbir, tiada pull request: semuanya pada peranti anda.

![Katalog - aset jenama, swatch dan fon, serta muat naik anda sendiri](/t/url-shot?url=%2F%23%2Fc%3Fsection%3Dswatches%2Cfonts&width=1440&height=900&dpi=96&waitMs=2400&css=.plat-swatch-grid~%2A%7Bdisplay%3Anone%7D&walker=1&format=svg&localize=1&dark=1&filename=catalogue)

- <!--i:upload--> **Bawa masuk fail anda.** Seret mana-mana imej, SVG, klip audio, video, Lottie, PDF atau dek PowerPoint ke atas kawasan muat naik - atau klik untuk memilih - dan ia terus masuk ke dalam katalog anda, sedia dalam pemilih aset setiap alat. PDF berbilang halaman atau sesuatu `.pptx` akan bertanya halaman atau slaid mana yang hendak disimpan - setiap satu menjadi aset SVG. Ingest sebanyak yang anda mahu; ia tidak pernah keluar daripada peranti anda.
- <!--i:star--> **Jadikan kegemaran apa yang sering anda gunakan.** Berikan ★ kepada sesuatu aset (atau swatch jenama) dan ia akan disemat ke bahagian atas setiap pemilih, supaya logo atau warna pilihan anda hanya sejauh satu klik.
- <!--i:folder--> **Kemas kini susunan.** Kategorikan semula sesuatu aset ke dalam kumpulan lain, sembunyikan aset jenama kongsi yang tidak anda gunakan (dengan **Show hidden** untuk memaparkannya semula) atau padamkan muat naik anda sendiri terus. Gerak isyarat multi-select dan bar tindakan terapung yang sama seperti dalam Projects turut berfungsi di sini, jadi semua itu boleh dilakukan ke atas keseluruhan pilihan sekali gus.
- <!--i:layers--> **Asingkan video daripada latar belakangnya.** Buka butiran sesuatu video atau klik kanan kad videonya dalam mana-mana pemilih aset dan pilih **Remove background…** untuk menyimpan alternatif lutsinar - satu WebP atau PNG beranimasi dengan alfa sebenar. Pilih satu **Method**: satu **On-device model** memotong subjek keluar daripada adegan yang sibuk, atau satu **Colour key** mengunci keluar latar belakang rata yang diterangi secara sekata seperti green screen atau dinding kosong, dengan **Tolerance**, **Softness** dan **Spill removal** untuk menala tepinya. Colour key tidak memerlukan muat turun model atau rangkaian, jadi **Remove background** ditawarkan pada mana-mana video dan selalunya lebih bersih pada rakaman yang kemas. Satu kawalan **Resolution** (360, 480, 720 atau 1080p, tidak pernah melebihi sumber) menukar butiran dengan fail yang lebih kecil dan lebih pantas. Ini berjalan sebagai kerja latar belakang pada peranti anda. Potongan siap itu disimpan di sebelah yang asal sebagai aset tersendiri dan Content Credential video sumbernya turut serta sebagai bahan. (Lihat [Generated once, rendered the same](/info/ai-features.html) untuk sebab mengapa mengalih keluar latar belakang kekal sebagai suntingan biasa.)

### Bawa palet dan fon anda ke mana-mana

Panel **Swatches** dalam Katalog bukan sekadar memaparkan - klik sesuatu warna untuk menyalinnya, atau **muat turun keseluruhan palet jenama** dalam format yang difahami alat anda yang lain:

- <!--i:code--> **Design tokens (JSON)**, **CSS variables** atau **CSS classes** - masukkan jenama itu terus ke dalam helaian gaya atau binaan;
- <!--i:palette--> **Adobe Swatch Exchange (.ase)** - muatkannya ke dalam Illustrator atau Photoshop;
- <!--i:pentool--> **GIMP palette (.gpl)** - untuk GIMP atau Inkscape.

![Panel Swatches - lima butang muat turun palet di bahagian atas, kemudian setiap warna jenama sebagai cip yang boleh disalin](/t/url-shot?url=%2F%23%2Fc%3Fsection%3Dswatches&width=1440&height=900&dpi=96&waitMs=1800&css=.cat-group%3Anot%28%5Bdata-group%3Dswatches%5D%29%7Bdisplay%3Anone%7D&cropSelector=%5Bdata-group%3Dswatches%5D&walker=1&format=svg&dark=1&filename=use-swatch-downloads)

Panel **Fonts** menyenaraikan muka taip jenama anda dengan **muat turun** di sebelah setiap satu, untuk dipasang secara setempat atau diserahkan kepada kedai cetak. (Bilik Colours dalam [Brand Studio](/info/brand-studio.html) menawarkan muat turun palet yang sama.)

Aset ialah separuh daripada laluan terbuka buat-sendiri; separuh lagi ialah **membuat alat anda sendiri** - kanvas bebas (Design, diterangkan di atas) membolehkan anda membinanya secara visual, tanpa perlu kod.

## Bunyi & kebolehcapaian

Lolly bertujuan selesa digunakan oleh semua orang. Antara mukanya boleh dilayari dengan papan kekunci, kawalan tersuai membawa label yang betul untuk pembaca skrin dan pratonton langsung setiap alat didedahkan sebagai satu imej berlabel yang menerangkan apa yang sedang dihasilkannya.

Satu lapisan lembut **bunyi bantuan** mengesahkan apa yang anda lakukan - tiba di galeri, semakan Content Credentials yang sah berbanding tidak sah, menutup panel, menukar penapis. Ia **dimatikan secara lalai**: hidupkan **Sound** di mana-mana suisnya muncul (popover pilihan setiap paparan, atau **Profile**), dan pilihan itu diingati.

Empat tetapan keselesaan pilihan berada di bawah **Profile → Accessibility**: **Reduce motion** (menghilangkan peralihan dan hiasan aplikasi), **Hide colourful previews** (kad galeri ikon-dan-teks yang tenang, dan lakaran kecil projek yang lebih perlahan warnanya), **High contrast** (sempadan, teks dan cincin fokus yang lebih kuat) dan **Large text** (taip aplikasi yang lebih besar - label, menu, teks butang). Keempat-empatnya menenangkan aplikasi *di sekeliling* kerja anda: ia tidak pernah masuk ke dalam kanvas alat atau mengubah satu piksel pun apa yang anda eksport, dan setiap satunya dimatikan sehingga anda menghidupkannya. Butiran penuh dalam [Profil anda → Accessibility](/info/profile.html#accessibility).

Di sebelah suis Sound terdapat **Neurospicy Mode** - runut fokus latar yang menenangkan dan bersifat pilihan, yang dimainkan perlahan sambil anda bekerja. Menghidupkannya membuka **dok pemain** kecil di penjuru bawah yang mengikut anda merentas aplikasi; daripadanya anda boleh mencari dan memilih runut, langkau ke depan dan ke belakang, menetapkan kelantangan serta mengecilkan atau menutupnya. Senarai runut merangkumi beberapa kategori - lagu *Lolly Sings* prosedural, gelung ambien dan rentak, audio muat naik anda sendiri dan beberapa stesen **radio** internet langsung (ini memerlukan sambungan; segala yang lain dimainkan luar talian). Ia **dimatikan secara lalai** dan, seperti Sound, diingati merentas sesi dan peranti. Mematikan Sound turut meredamkan runut fokus itu.

## Storan & privasi

Segalanya disimpan dalam pangkalan data setempat pelayar anda (IndexedDB): profil anda, sesi tersimpan, imej yang dimuat naik dan cache kandungan katalog yang dimuat turun. **Profile → Storage** menunjukkan penggunaan dan membolehkan anda:

- <!--i:box--> **Clear cache** - membuang kandungan katalog yang dimuat turun (disegerakkan semula pada muatan berikutnya).
- <!--i:trash--> **Clear all my data** - memadam profil, sesi dan imej. *Tidak boleh dibatalkan.*

![Kad storan pada skrin selebar telefon: setiap kategori data pada peranti dinamakan, dengan butang Clear all my data di bahagian bawah](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-manages%2C.storage-subsection%2C.store-selbar%2C.store-chip-val%2C%23store-hero-num%2C%23store-headroom%2C%23store-quota%2C%23store-reclaim%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

Tiada satu pun data setempat ini dihantar ke mana-mana - tiada telemetri, tiada rendering awan. Senarai lengkap apa yang pernah diambil atau dihantar oleh aplikasi ini ada dalam [Dasar Privasi](/info/privacy.html), dan [Server Surface](/info/server-surface.html) menyenaraikan komponen pelayan pilihan.

## Berpindah ke peranti lain

Kerana segalanya berada pada peranti anda, **Profile → Storage → Move to another device** membolehkan anda membawa semuanya ke pemasangan kedua - tiada akaun, tiada awan:

- <!--i:download--> **Export my data** memuat turun satu `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` (bahagian namanya datang daripada profil anda dan digugurkan jika tidak ditetapkan; `<n>` ialah pengira harian supaya eksport pada hari yang sama tidak berlanggar) yang mengandungi profil anda, setiap sesi tersimpan (dengan lakaran kecilnya), imej muat naik anda dan keutamaan anda (tema, lebar bar sisi, statistik aktiviti setempat).
- <!--i:upload--> **Import data…** pada pemasangan yang satu lagi membaca fail itu kembali. Ia **menggabungkan**: apa jua yang mempunyai nama sama (profil anda, slot sesi, imej) digantikan dengan salinan yang diimport; segala yang lain pada peranti itu dikekalkan. Sesi tersimpan memaut semula kepada imej yang anda import secara automatik.

Cache katalog tidak disertakan - ia memuat turun dirinya semula pada peranti baharu. Berkas itu ialah zip biasa (`manifest.json` + `profile.json` + `sessions.json` + `assets.json` + `assets/blobs/…` + `prefs.json`, id format `lolly-backup`), jadi ia kekal utuh melalui e-mel, USB atau AirDrop dan merupakan format yang sama yang dibaca setiap shell. Setiap bahagian mempunyai checksum, jadi fail yang rosak dalam perjalanan ditangkap semasa import dan bukannya dipulihkan separuh rosak. (Spesifikasi format penuh: [Data Transfer](/info/data-transfer.html).)

## Mengimport reka bentuk (Figma, Penpot, Illustrator, InDesign)

Anda boleh membawa reka bentuk sedia ada ke dalam Lolly dan terus mengerjakannya: buka **Design**, klik **Import a design** pada bar alat kanvas, dan pilih fail Figma **.fig** atau SVG, Penpot **.penpot**, Illustrator **.ai** / **.pdf** atau InDesign **.idml**. Lapisan menjadi kotak boleh sunting pada kanvas bebas - teks kekal boleh ditaip semula, imej mendarat dalam **My images** dan taip serta warna mematuhi global jenama - kemudian hasilnya boleh disimpan, dikongsi dan dirender seperti mana-mana sesi lain. Penghuraian berlaku sepenuhnya pada peranti anda. Butiran penuh: **[Import a design](/info/design-import.html)**.

## Mengeksport

Lihat **[Mengeksport & Format](/info/exporting.html)** untuk cerita penuhnya - memilih format, saiz output dan unit cetak, ketelusan, video dan salin/kongsi. Ringkasnya: pilih format, tetapkan saiz jika perlu dan **Download** (atau **Copy** ke papan keratan).

## Mod Batch (Pro)

Untuk pengguna mahir, **Batch** (dipautkan daripada galeri, di sebalik bendera ciri Pro yang lalainya dihidupkan) merender banyak variasi sekali gus - satu grid dengan setiap baris ialah satu set input, dieksport bersama-sama. Sesuai untuk menyetempatkan sesuatu kad ke dalam belasan bahasa atau menjana setiap varian saiz dalam satu pusingan. Isi baris dengan menaip, menampal terus daripada hamparan atau mengimport CSV (anda juga boleh mengeksport satu semula), dan tetapkan format, saiz dan nama fail output bagi setiap baris. Simpan keseluruhan grid sebagai **sesi kelompok** bernama yang boleh dibuka semula daripada galeri, dan muat turun setiap baris sebagai satu `.zip`.

![Bar alat batch - nama zip, unit, DPI dan format yang diwarisi setiap baris, dengan Sessions dan Render di sebelah kanan](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&cropSelector=.pro-toolbar&walker=1&format=svg&dark=1&filename=use-batch-toolbar)

Batch adalah untuk menjana **banyak varian daripada satu templat** sekali gus. Untuk merender semula sesi yang **sudah anda simpan**, gunakan **Projects → Render folder / Render selection** (di atas) - tidak memerlukan Pro.

## Menyunting bersebelahan (Multi-edit)

Batch ialah pelbagai varian bagi *satu* reka bentuk. **Multi-edit** ialah separuh lagi tugas itu: beberapa reka bentuk tersimpan yang **berbeza** dibuka serentak, supaya satu perubahan terpakai kepada kesemuanya. Tandakan antara **dua hingga lapan** sesi tersimpan dalam **Projects** dan pilih **Edit together** daripada bar pemilihan; kesemuanya terbuka sebagai kad langsung berdampingan di `#/multi?s=<slot>,<slot>…`. Setiap kad ialah render sebenar sesi itu, bukan lakaran kecil tersimpan, jadi apa yang anda lihat itulah yang akan dieksport.

Satu bar sisi memandu kesemuanya:

- <!--i:sliders--> **Shared** mendahuluinya - setiap input yang diisytiharkan dengan cara yang *sama* oleh dua atau lebih sesi terpilih (id sama, jenis sama, kekangan sama - peraturan gabungan yang sama seperti yang digunakan grid kelompok pada lajurnya). Sunting kawalan dikongsi sekali dan nilainya tersebar ke setiap sesi yang mengisytiharkannya, secara langsung pada setiap kad. Dua sesi daripada alat yang sama berkongsi segalanya; dua alat berbeza berkongsi apa jua yang kebetulan sama, dan tiada apa-apa lagi.
- <!--i:document--> Di bawahnya, **satu kad terkuncup bagi setiap sesi** dengan semua input sesi itu sendiri, pada kejituan yang sama seperti bar sisi alat itu - pemilih aset, kumpulan baris berulang, medan warna - serta blok eksport ringkas: **Format**, **W** / **H**, **Unit**, **DPI** dan **Download** tersendiri. Download itu menyimpan sesi dahulu kemudian merendernya melalui laluan eksport sesi biasa, jadi fail itu membawa nama fail, format dan Content Credentials yang sama seperti kalau terus daripada alat itu.
- <!--i:search--> **Filter inputs…** di bahagian atas menyempitkan kawalan merentas *setiap* kad sekali gus - itulah caranya anda sampai kepada "tajuk utama" dalam lapan sesi tanpa perlu menatal mencarinya.

Klik mana-mana kanvas (atau tekan Enter padanya) dan kad bar sisi sesi itu terbuka serta ditatal ke paparan. **Save all** menulis setiap sesi kembali ke slotnya sendiri. **Download all** menyimpan dahulu, kemudian merender keseluruhan set melalui saluran yang sama seperti **Render selection** dalam Projects - satu zip, dengan kunci kata laluan pilihan ditawarkan sepanjang jalan.

Dua had yang jujur. Had dua hingga lapan itu nyata: setiap kad melekapkan masa jalannya sendiri, dan itulah bilangan yang kekal responsif - pautan yang meminta lebih banyak (atau meminta sesi yang sudah tidak wujud) akan menyatakannya dan bukan memuat separuh jalan. Dan pautan itu menamakan slot tersimpan *anda*, jadi ia membuka semula set itu pada peranti ini; ia bukan pautan kongsi.

Apabila pemilihan itu lebih daripada lapan, mencampurkan alat atau merangkumi imej selain sesi, jalan keluarnya ialah **Edit as sheet** dalam bar pemilihan yang sama: ia membuka keseluruhan pemilihan sebagai **baris dalam grid kelompok** (`#/pro?s=…`), tanpa had saiz dan tanpa peraturan alat sama. Folder kekal di luar kedua-duanya - ia mempunyai laluan buka-dalam-grid tersendiri. ([Cari](/info/search.html) ialah satu-satunya perkara yang belum menjangkau ke sini: Multi-edit ialah satu-satunya paparan yang tidak diketahui oleh bar carian.)

## Luar talian & pemasangan

Lolly ialah PWA. Selepas muatan pertama ia berfungsi **luar talian** - pasangnya daripada bar alamat pelayar anda (atau *Add to Home Screen* pada mudah alih) untuk pengalaman skrin penuh seperti aplikasi. Ia mengemas kini dirinya sendiri apabila anda kembali dalam talian.

Berkenaan kemas kini: jika sesuatu paparan gagal dimuatkan sejurus selepas satu kemas kini (panel kosong, satu "failed to fetch" di penjuru), muat semula halaman itu sekali - aplikasi akan mengambil versi baharu dengan bersih dan kerja, sesi serta jenama anda tidak tersentuh. Ia menyimpan segala-galanya pada peranti anda, bukan dalam halaman itu.
