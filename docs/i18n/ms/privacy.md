# Dasar Privasi

*Terakhir dikemas kini: 11 Ogos 2026*

> **Versi ringkasnya.** Dokumen, imej, video dan fail yang anda hasilkan dalam Lolly kekal
> pada peranti anda. Tiada akaun untuk penggunaan biasa, tiada kuki daripada
> aplikasi itu sendiri dan tiada analitik atau penjejak di mana-mana dalam kod sumber - ini
> bukan "kami tidak menggunakan data," tetapi memang benar-benar tiada dalam source.
> Terdapat senarai ringkas dan lengkap tentang pengecualian di mana perisian ini
> berkomunikasi dengan rangkaian sama sekali, dan setiap satu daripadanya diterangkan
> secara terperinci di bawah: apa yang keluar, kepada siapa dan bila. Satu-satunya
> pengecualian yang melibatkan sesuatu yang bersifat peribadi ialah log masuk yang
> perlu anda mulakan secara jelas. Jika ia tiada dalam dokumen ini, ia tidak berlaku.

## Apa yang diliputi dasar ini

Lolly ialah perisian sumber terbuka - sebuah enjin, beberapa shell aplikasi (web, desktop,
mudah alih, CLI) dan sambungan pelayar - yang boleh dijalankan oleh sesiapa sahaja. Dasar ini mempunyai dua
bahagian:

- <!--i:code--> **Perisian itu sendiri**: apa yang ia lakukan dan tidak lakukan dengan data anda, di mana sahaja ia
  berjalan. Ini adalah sifat kod itu sendiri, jadi ia benar untuk setiap penggunaan Lolly,
  milik kami atau sesiapa sahaja.
- <!--i:server--> **lolly.tools**, penggunaan rujukan yang dikendalikan oleh SUSE: pilihan khusus
  yang dibuat semasa menjalankan bahagian pelayan pilihannya (apa yang dilog, untuk berapa lama, oleh
  siapa).

Jika anda menggunakan instans Lolly yang dihoskan sendiri atau instans perusahaan, tingkah laku perisian
di bawah masih terpakai, tetapi *pengendali* instans itu - bukan SUSE - yang
bertanggungjawab untuk apa-apa di pihak pelayan: titik akhir render mereka, pelayan MCP mereka,
pihak berkuasa sijil Content Credentials mereka, jika mereka menjalankan satu. Tanya mereka untuk
dasar mereka sendiri. Lihat [Penerimaan & Tadbir Urus](/info/adoption-governance.html) untuk
apa yang terlibat dalam mengendalikan Lolly.

## Aplikasi: apa yang kekal pada peranti anda

Shell web, desktop dan mudah alih Lolly menjalankan keseluruhan enjin render di sisi klien.
Membuka alat, mengisi input, pratonton dan eksport semuanya berlaku pada
peranti anda - tiada pelayan yang terlibat, dan aplikasi berfungsi luar talian sebaik sahaja dimuatkan.

**Aplikasi ini tidak menetapkan sebarang kuki.** Untuk berfungsi, ia menyimpan sejumlah kecil data **pada
peranti anda sahaja**, tidak pernah dihantar:

- <!--i:sliders--> **Keutamaan antara muka** - tema, bahasa, tetapan bunyi, saiz
  bar sisi/zum, pilihan susunan dan paparan, petua pengenalan yang telah anda lihat - dalam
  `localStorage`, supaya ia tersedia sebelum aplikasi selesai dimulakan.
- <!--i:download--> **Cache luar talian bagi katalog alat dan pratonton aset**, supaya galeri
  berfungsi tanpa sambungan.
- <!--i:hash--> **Kaunter penggunaan tempatan** untuk statistik kad profil anda (berapa banyak eksport, alat
  yang mana) - satu blob kecil terhad dalam `localStorage`, tidak pernah dibaca oleh kami, tidak pernah dihantar
  ke mana-mana.
- <!--i:folder--> **Dokumen, sesi tersimpan, aset dan fon yang anda muat naik sendiri** - disimpan dalam
  IndexedDB pada peranti anda, tidak pernah dimuat naik, tidak pernah dibaca oleh sesiapa selain anda.

Tiada satu pun daripada ini dikongsi, dijual atau digunakan untuk mengenal pasti atau menjejaki anda. Tiada apa-apa
untuk dipersetujui, kerana tiada pengumpulan berlaku - hanya notis ini, supaya anda
tahu apa yang disimpan dan di mana. Padamkan semuanya pada bila-bila masa dengan **Profile → Clear all
my data**, atau dengan mengosongkan storan tapak dalam pelayar anda. (Di bawah
ePrivacy Directive Art. 5(3), storan yang perlu secara mutlak untuk perkhidmatan yang anda minta
tidak memerlukan persetujuan - hanya ketelusan, iaitu apa yang menjadi tujuan dokumen ini dan
notis dalam aplikasi ini.)

![Bahagian storan halaman profil pada skrin lebar telefon: setiap kategori data pada peranti dinamakan, dengan butang Clear all my data betul-betul di sebelahnya](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-manages%2C.storage-subsection%2C.store-selbar%2C.store-chip-val%2C%23store-hero-num%2C%23store-headroom%2C%23store-quota%2C%23store-reclaim%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

Sandaran data ini milik anda sendiri - bungkusan `lolly-backup` yang dihasilkan oleh **Export my
data & render everything** - ialah fail yang anda simpan dan kawal sendiri. Ia tidak pernah menyentuh pelayan
kami melainkan anda memilih untuk menghantarnya ke suatu tempat sendiri. Lihat [Pemindahan
Data](/info/data-transfer.html).

## Utiliti pada peranti

Sebahagian alat - **Strip Hidden Data**, **Compress PDF** dan lain-lain yang membawa
lencana **"Runs on your device"** - beroperasi pada fail yang anda sediakan. Fail itu dibaca
ke dalam memori pelayar anda, diubah secara tempatan dan ditawarkan semula sebagai muat turun.
Ia tidak pernah dimuat naik, kerana tiada pelayan dalam laluan untuk memuat naiknya.
Utiliti ini berfungsi luar talian, dan outputnya tidak membawa sebarang tera air atau metadata
kami - tujuan kebanyakan alat ini adalah untuk membuang & melindungi data, bukan menambah risiko.

![Lencana yang dibawa oleh alat-alat ini: Runs on your device - tiada apa-apa dimuat naik](/t/url-shot?url=%2F%23%2Ftool%2Fstrip-data&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=.on-device-badge&dark=1&filename=pv-ondevice-badge)

## Apabila aplikasi berhubung dengan rangkaian, secara lengkap

Jadual di bawah ialah senarai lengkap segala yang diambil atau dihantar oleh aplikasi melalui
rangkaian. Jika ia tiada di sini, aplikasi tidak melakukannya.

| Apa | Apa yang sebenarnya meninggalkan peranti anda | Bila (tindakan yang mencetuskannya) | Jika pengendali menyekatnya |
|---|---|---|---|
| Penyegerakan katalog alat | Tiada apa-apa yang peribadi - permintaan untuk indeks alat dan aset awam Lolly sendiri, ke origin aplikasi itu sendiri | Semasa permulaan, kemudian dicache secara luar talian | Aplikasi berjalan dengan set alat yang dicache. Ia hanya berhenti menemui alat baharu |
| Alat yang memerlukan data langsung | Apa sahaja yang diminta oleh alat tertentu itu, ke hos yang dinamakan dalam penerangannya sendiri. Pada masa ini itu hanyalah carian bandar dalam alat Meeting Planner, yang meminta `geocoding-api.open-meteo.com` untuk menukar nama bandar kepada koordinat dan zon waktu - tiada akaun, tiada kunci dan tiada pengenal selain permintaan itu sendiri. Medan input menyatakannya tepat di tempat anda menaip, dan setiap jawapan disimpan pada peranti anda supaya satu bandar hanya dicari sekali | Hanya semasa menggunakan alat itu, dan hanya sebaik sahaja anda memasukkan lokasi | Carian itu sahaja yang gagal. Anda masih boleh menaip koordinat secara manual, dan tiada apa-apa lagi terjejas |
| Google Fonts | Nama keluarga fon yang dipilih dan alamat IP anda, ke pelayan fon Google (`fonts.googleapis.com` untuk helaian gaya, `fonts.gstatic.com` untuk fail fon) | Hanya jika anda menambah Google Font dalam editor jenama, **dan hanya selepas anda bersetuju dalam dialog yang menyatakan perkara ini dengan tepat** - satu capaian sekali sahaja bagi setiap keluarga, kemudian ia disimpan pada peranti anda dan digunakan secara luar talian | Pemilih Google Fonts gagal secara tertutup. Muat naik fail fon sebagai gantinya |
| Hantar ke Google Drive | Satu fail yang anda pilih untuk dihantar, ke API Drive Google (`www.googleapis.com`), selepas anda log masuk Google yang anda lengkapkan dalam tetingkap pop timbul Google sendiri. Akses Lolly terhad kepada fail yang dicipta olehnya (skop `drive.file` - ia tidak akan sekali-kali dapat membaca selebihnya Drive anda), dan token log masuk disimpan dalam memori untuk sesi itu sahaja, tidak pernah disimpan kekal | Hanya apabila anda menekan "Send to Google Drive" pada eksport EMF, dan hanya pada binaan di mana pengendali telah mengkonfigurasikan id klien Google - tanpanya butang itu tidak wujud | Butang itu tidak pernah muncul. Muat turun fail itu dan muat naiknya sendiri ke Drive |
| Hantar ke Dropbox | Satu fail yang anda pilih untuk dihantar, ke API Dropbox (`api.dropboxapi.com` untuk log masuk dan metadata, `content.dropboxapi.com` untuk fail itu sendiri), selepas anda log masuk Dropbox yang anda lengkapkan dalam tetingkap Dropbox sendiri. Akses Lolly terhad kepada folder aplikasi sahaja (ia hanya dapat melihat `Apps/` dan folder miliknya sendiri di situ - tidak pernah selebihnya Dropbox anda), pautan "Open" yang dipaparkan kepada anda ialah pautan peribadi berjangka pendek (tiada perkongsian awam dicipta), dan token muat semula hanya disimpan jika anda menandakan "stay connected" | Hanya apabila anda menekan "Send to Dropbox" pada satu fail, dan hanya pada binaan di mana pengendali telah mengkonfigurasikan id klien Dropbox - tanpanya butang itu tidak wujud | Butang itu tidak pernah muncul. Muat turun fail itu dan muat naiknya sendiri ke Dropbox |
| Hantar ke OneDrive | Satu fail yang anda pilih untuk dihantar, ke perkhidmatan identiti dan Graph Microsoft (`login.microsoftonline.com` untuk log masuk, `graph.microsoft.com` untuk muat naik; fail besar dimuat naik secara berkelompok ke alamat muat naik milik Microsoft di `api.onedrive.com`, `*.up.1drv.com` atau `*.sharepoint.com`), selepas anda log masuk Microsoft yang anda lengkapkan dalam tetingkap Microsoft sendiri. Akses Lolly terhad kepada folder miliknya sendiri di bawah `Apps/` (ia tidak akan sekali-kali dapat membaca selebihnya OneDrive anda) ditambah nama paparan anda untuk label akaun, dan token muat semula hanya disimpan jika anda menandakan "stay connected" | Hanya apabila anda menekan "Send to OneDrive" pada satu fail, dan hanya pada binaan di mana pengendali telah mengkonfigurasikan id klien Microsoft - tanpanya butang itu tidak wujud | Butang itu tidak pernah muncul. Muat turun fail itu dan muat naiknya sendiri ke OneDrive |
| Hantar ke LinkedIn | Satu fail yang anda pilih untuk dihantar, berserta namanya sebagai teks hantaran, ke LinkedIn (`www.linkedin.com` untuk log masuk, `api.linkedin.com` untuk muat naik dan hantaran), selepas anda log masuk LinkedIn yang anda lengkapkan dalam pelayar anda sendiri. Hantaran itu pergi ke suapan anda sendiri sebagai hantaran awam di bawah nama anda. Lolly boleh menghantar bagi pihak anda dan membaca nama anda untuk label akaun, tiada apa-apa lagi pada LinkedIn anda, dan log masuk itu disimpan pada peranti ini hanya jika anda menandakan "stay connected" - token LinkedIn bertahan 60 hari dan tidak boleh diperbaharui secara senyap, jadi ia luput dengan sendirinya | Hanya apabila anda menekan "Send to LinkedIn" pada satu fail, dalam aplikasi desktop sahaja, dan hanya pada binaan di mana aplikasi LinkedIn telah dikonfigurasikan - tanpanya butang itu tidak wujud | Tiada apa untuk disekat dalam aplikasi web: ini wujud dalam **aplikasi desktop sahaja**, jadi kedua-dua hos itu sengaja TIDAK berada dalam Content-Security-Policy aplikasi web di bawah. Dalam aplikasi desktop, buang aplikasi LinkedIn yang dikonfigurasikan dan butang itu tidak akan muncul |
| Profil cetakan ICC | Tiada apa-apa yang peribadi - permintaan untuk profil syarat cetakan piawai, ke registri awam ICC (`registry.color.org`, `www.color.org`) | Hanya jika anda mengklik satu praset ICC dalam pengurus profil cetakan - satu capaian sekali sahaja bagi setiap profil, kemudian ia disimpan pada peranti anda | Praset ICC gagal. Sediakan profil `.icc` anda sendiri sebagai gantinya |
| Radio internet | Tiada apa-apa yang peribadi - permintaan senarai main dan strim audio, ke stesen (`api.somafm.com` dan pelayan icecast yang dinamakannya, `*.somafm.com`) | Hanya semasa anda memainkan radio terbina dalam yang bersifat pilihan dalam pemain bunyi | Radio itu gagal. Setiap ciri bunyi lain masih berfungsi |
| URL yang anda minta satu alat tangkap | Permintaan ke alamat web tepat yang anda taip, daripada alat tangkapan skrin URL. Apa sahaja alamat itu. Hos ini tiada dalam polisi di bawah, kerana anda memilihnya pada saat penggunaan | Hanya apabila anda memasukkan URL dalam alat itu dan memulakan tangkapan | Pengendali tidak boleh membenarkan ini mengikut hos. Untuk membuangnya, buang alat itu |
| Semakan tandatangan SEAL | **Tiada apa-apa.** Aplikasi web langsung tiada resolver DNS - lihat di bawah | Tidak pernah | Tiada apa untuk disekat |
| Model AI atas peranti | Tiada apa-apa yang peribadi - satu muat turun fail model sekali sahaja daripada hos model Lolly (`lolli.li`), kemudian dicache pada peranti anda; tiada akaun, tiada pengenal, hanya permintaan itu dan IP anda | Hanya apabila anda menggunakan ciri yang memerlukan model (imbasan mendalam Verify, penaiktarafan imej, pertuturan, dan seumpamanya) | Ciri itu menunggu muat turun selesai; segala-galanya yang lain masih berfungsi |
| Instans jauh | Apa sahaja yang dikembalikan oleh instans yang anda namakan, melalui penyegerakan katalog yang sama seperti diterangkan di atas - ditambah tag versi pada permintaan kepadanya (jenis shell dan versi enjin, maklumat yang sama seperti yang dibawa oleh user agent), supaya pengendalinya dapat melihat versi Lolly mana yang sedang digunakan. Pada instans terurus, semasa anda log masuk, tag itu turut membawa id pemasangan bagi setiap peranti supaya senarai peranti pengendali dapat membezakan pemasangan ini. Ia hanya menumpang pada permintaan yang sudah dibuat oleh penggunaan anda sendiri - tiada pemasa dan tiada apa-apa yang menghubungi pelayan secara senyap - dan meninggalkan instans itu memadamkan id tersebut, jadi peranti yang bersambung semula kelak akan membentangkan id yang baharu. Anda memilih hos itu pada saat penggunaan, jadi ia tiada dalam polisi di bawah | Hanya jika anda secara nyata mengarahkan shell ke penggunaan Lolly yang lain | Pertukaran instans gagal. Instans tempatan anda tidak terjejas |

Setiap hos tetap dalam jadual itu turut menjadi senarai benar lengkap dalam
Content-Security-Policy aplikasi, yang dikuatkuasakan oleh pelayar. Jadi senarai itu bukan sekadar
penerangan tentang apa yang dilakukan oleh kod hari ini, ia adalah sempadan yang dipertahankan oleh pelayar terhadap
aplikasi: sebarang perubahan pada masa hadapan yang cuba menghubungi mana-mana hos lain akan disekat,
bukan dibenarkan secara senyap. Satu baris merupakan pengecualian yang disengajakan, dan selnya sendiri menyatakan
begitu: Send to LinkedIn wujud dalam aplikasi desktop sahaja, jadi polisi aplikasi web tidak menamakan
mana-mana satu pun daripada dua hosnya - aplikasi web tidak akan dapat menghubunginya walaupun kodnya cuba berbuat demikian.
Dua lagi baris tiada hos tetap, kerana anda memilih
alamat itu pada saat penggunaan: URL yang anda minta satu alat tangkap, dan instans jauh yang
anda arahkan shell kepadanya. Kedua-duanya tiada dalam polisi, dan masing-masing hanya berlaku
apabila anda menaip satu alamat dan bertindak ke atasnya. Penggunaan yang tidak mahukan mana-mana satu pun daripada
yang bersifat pilihan (contohnya, instans perusahaan dengan fon miliknya sendiri) membuang
hos tersebut daripada polisinya dan ciri itu gagal secara tertutup dan bukannya menghubungi ke luar.

Tiada satu pun daripada ini menghantar dokumen, projek, sesi atau fail yang dimuat naik anda ke mana-mana.
Ia wujud untuk membawa perkara *kepada* peranti anda (alat, fon, model), bukan untuk menghantar
perkara *daripadanya*, kecuali pengecualian yang dinamakan secara jelas dalam bahagian di bawah.

**Nota tentang apa yang kami buang.** Verify boleh menyemak tandatangan SEAL, satu skema di mana
kunci penandatanganan fail diterbitkan dalam DNS. Pelayar tidak boleh membuat pertanyaan DNS, jadi mana-mana
pelaksanaan web perlu menghalakan carian itu melalui penyelesai DNS-over-HTTPS pihak ketiga
- yang akan menunjukkan kepada pengendali itu domain yang sedang disemak berserta alamat IP
anda. Dahulu kami menggunakan milik Cloudflare. **Kami tidak lagi berbuat demikian, dan tiada
penggantinya**: aplikasi web kini tidak menghantar sebarang penyelesai langsung, jadi pengesahan SEAL
di sini tidak membuat sebarang permintaan rangkaian. Fail yang rekod SEAL-nya membawa kuncinya secara terus (inline)
masih boleh disahkan sepenuhnya secara luar talian. Fail yang kuncinya berada dalam DNS akan melaporkan "tiada penyelesai
kunci" sebagai gantinya, dan anda boleh menyemaknya dalam aplikasi desktop atau baris arahan,
yang menyelesaikan DNS secara asli melalui mesin anda sendiri tanpa melibatkan pihak ketiga.

![Skrin Verify: sasaran jatuh (drop target) dan tiada apa-apa lagi - fail disemak di tempat ia sudah berada, tanpa muat naik dan tanpa akaun](/t/url-shot?url=%2F%23%2Fverify&width=1440&height=900&dpi=192&waitMs=1400&walker=1&format=svg&cropSelector=.valid-layout&dark=1&filename=cc-verify-drop) Anda boleh sahkan ini sendiri: semakan boleh-grep untuk dakwaan ini dan setiap
lain dakwaan lain pada halaman ini, berserta arahan tepat dan output yang dijangka, terletak di
[Verify It Yourself](/info/verify-yourself.html).

## URL render pautan-terus (hot-linked)

> **Kini aktif pada lolly.tools.** Setiap
> URL `https://lolly.tools/tool/<tool-id>.<ext>?<inputs>` benar-benar dirender,
> dan input-input itu turut serta dalam URL tersebut. Bahagian di bawah
> menerangkan apa maknanya ini kepada anda, dan pengendali boleh mematikan
> ciri ini pada instans mereka sendiri.

Aplikasi itu sendiri kekal sepenuhnya pada peranti anda. Secara berasingan, pengendali boleh mengaktifkan
**URL render pautan-terus** - `/tool/<tool-id>.<ext>?<inputs>` - supaya pautan Lolly
yang dikongsi boleh muncul sebagai imej langsung dalam README, wiki atau papan pemuka.
Mengambil satu daripadanya meminta pelayan untuk merender **data alat dan katalog awam**
dengan input yang ditulis ke dalam URL.

- <!--i:usercheck--> **Tiada akaun, tiada kuki, tiada state.** Titik akhir ini tanpa nama, dan tiada
  apa-apa dibaca pada peranti anda. Dokumen, sesi dan muat naik anda tidak pernah
  keluar daripada pelayar anda - semua itu langsung tidak boleh muncul dalam pautan ini.
- <!--i:document--> **Tetapi URL itu sendiri direkodkan.** Rentetan pertanyaan sesuatu URL ialah sebahagian
  daripada baris permintaan, jadi ia muncul dalam log akses biasa milik platform hosting sama
  seperti setiap laluan yang diminta. Jika input sesuatu pautan mengandungi nama atau e-mel
  seseorang - lencana nama, tandatangan e-mel - maka **teks itu kekal dalam log
  tersebut**, dan tiada susunan kata dasar yang mengubahnya. Jadi URL pautan-terus adalah
  tempat yang salah untuk butiran peribadi: berikan hanya apa yang anda akan letakkan pada halaman awam.
- <!--i:globe--> **Input-input itu memang bersifat awam secara struktur** - apa sahaja kandungannya, penulis
  pautan itulah yang menaipnya ke dalam URL, dan sesiapa sahaja yang mencapai pautan itu
  boleh membacanya. Jangan letakkan rahsia dalam pautan yang dikongsi. Lolly menawarkan
  penyulitan pautan untuk kandungan sensitif.
- <!--i:eyeoff--> Respons **dicache dan dihadkan kadarnya** seperti mana-mana imej awam, dan
  ditandakan `noindex` supaya enjin carian tidak mengindeks render anda.

Menghoskan Lolly sendiri dan tidak mahu permukaan render awam? Tetapkan
`LOLLY_DISABLE_RENDER_GET=1` dan setiap
satu daripada URL ini akan memulangkan 404.

## Pelayan MCP (pilihan, untuk ejen AI)

Lolly juga boleh dicapai oleh ejen AI melalui Model Context Protocol - satu
titik akhir yang dikendalikan pengendali (lolly.tools menjalankan satu; sesiapa sahaja boleh hoskan sendiri,
termasuk yang sepenuhnya terpisah rangkaian/air-gapped). Ia berkongsi pendirian tanpa-akaun laluan render,
ditambah tiga alat yang semestinya mengendalikan bait fail:

- <!--i:cpu--> **`lolly_transform`** (menjalankan utiliti pada peranti di pihak pelayan, bagi
  pihak ejen yang memanggilnya), **`lolly_verify`** (menyemak Content Credentials) dan **`lolly_redact`**
  (menggelapkan kawasan imej atau PDF) semuanya menerima
  bait fail daripada pemanggil. Ia diproses **dalam proses itu sendiri, dalam memori**,
  dan hasilnya dipulangkan dalam panggilan yang sama - fail itu tidak pernah ditulis ke
  cakera dan tidak pernah disimpan sebaik sahaja permintaan itu selesai.
- <!--i:checklist--> Setiap alat lain - `lolly_render`, `lolly_build_url`, `lolly_list_tools`,
  `lolly_describe_tool` - berfungsi berdasarkan parameter sahaja (teks, nombor, warna,
  URL, id aset katalog), input yang sama seperti yang diambil oleh URL render pautan-terus.
- <!--i:lock--> Akses sama ada token dikongsi yang dikeluarkan oleh pengendali kepada klien yang dipercayainya, atau
  OAuth 2.1 tanpa keadaan (stateless): token bertandatangan berjangka pendek yang disahkan terhadap rahsia
  yang dikongsi, tiada apa-apa disimpan di pihak pelayan dan token itu sendiri tidak pernah ditulis ke
  log atau URL render.

## Identiti Content Credentials (log masuk yang perlu anda mulakan sendiri)

Lolly boleh memeteraikan **Content Credential** kriptografi ke dalam eksport anda supaya sesiapa sahaja
boleh mengesahkan, secara luar talian, bahawa fail tidak diubah sejak ia meninggalkan Lolly. Itu sahaja
sudah **dihidupkan secara lalai dan sepenuhnya setempat** - kunci tandatangan dijana pada peranti anda
dan penandatanganan itu sendiri berlaku secara luar talian. Tanpa pendaftaran, kunci itu adalah sekali guna:
sepasang kunci baharu dicetak untuk setiap eksport dan dibuang bersamanya. Sebaik sahaja anda mendaftar,
kunci itu menjadi kekal dan dijana sebagai **tidak boleh diekstrak** - malah kod Lolly
sendiri tidak boleh membacanya, hanya boleh memintanya menandatangani. Walau apa pun, ia tidak pernah meninggalkan
peranti anda. Bahagian ini merangkumi satu langkah *pilihan* di atas itu:
mendaftarkan identiti yang disahkan, supaya eksport anda memaparkan "Verified - signed by
\<your email\>" dan bukannya kunci tanpa nama. **Jika anda melangkau pendaftaran, tiada apa dalam
bahagian ini terpakai kepada anda, dan tiada data peribadi akan meninggalkan peranti anda.**

![Kad identiti Verified pada halaman profil, lebar telefon: pemilih jangka hayat sijil dan langkah pendaftaran di bawahnya, tidak aktif sehingga anda memulakannya sendiri](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

Jika anda mendaftar, inilah dengan tepat apa yang berlaku:

1. **Anda memilih kaedah log masuk** - GitHub, Google, SUSE (id.suse.com) atau pautan
   yang dihantar melalui e-mel. Untuk ketiga-tiga penyedia OIDC, anda dihalakan semula ke halaman
   log masuk penyedia itu sendiri, ditadbir oleh dasar privasi mereka, bukan kami.
   Perkhidmatan sijil Lolly hanya menerima balik alamat e-mel yang disahkan dan
   nama penyedia itu. Untuk pautan e-mel, alamat yang anda taip dihantar kepada
   **Resend**, satu API e-mel transaksi, semata-mata untuk menghantar pautan tunggal itu.
2. **Kuki berjangka pendek melindungi pengalihan (redirect).** Ini ialah satu-satunya kuki yang ditetapkan oleh
   keseluruhan sistem Lolly: `lolly_ca_state`, `HttpOnly`, terhad kepada `/api/ca`,
   tamat tempoh dalam masa sepuluh minit. Ia membawa nilai rawak, bukan pengenal pasti
   penjejakan, dan wujud hanya untuk menghalang pengalihan OAuth daripada dipalsukan. Ia
   dikosongkan sebaik sahaja log masuk selesai.
3. **Alamat IP anda digunakan, secara singkat, untuk mencegah penyalahgunaan** titik akhir
   log masuk (supaya satu skrip tidak boleh menyepam peti masuk atau menghabiskan kuota e-mel) - disimpan
   dalam memori pelayan sahaja, untuk tetingkap gelongsor (sliding window) selama kira-kira seminit, tidak pernah ditulis
   ke log atau disimpan kekal di mana-mana.
4. **Perkhidmatan sijil mengeluarkan sijil berjangka pendek** (7, 30, 90 atau 365
   hari, mengikut pilihan anda, dihadkan oleh dasar pengendali) yang mengikat e-mel yang disahkan
   anda kepada separuh awam pasangan kunci yang dijana pada peranti anda. Separuh
   peribadi tidak pernah meninggalkan pelayar anda.
5. **Tiada apa-apa tentang pengeluaran itu direkodkan.** Perkhidmatan sijil tidak menyimpan
   log pengeluaran: bukan e-mel anda, bukan penyedia, bukan nombor siri, bukan
   cap masa. Tiada pangkalan data, tiada baris log, tiada webhook. Alamat e-mel anda wujud dalam
   permintaan itu hanya cukup lama untuk ditulis ke dalam sijil yang diterima oleh peranti anda
   sendiri, dan selepas itu ia hilang sepenuhnya daripada pihak kami.
6. **Selepas itu, penandatanganan kembali luar talian** untuk sepanjang jangka hayat sijil itu.
   Mengeksport fail tidak pernah menghubungi perkhidmatan sijil - hanya pendaftaran yang berbuat demikian.

**Pertukaran (tradeoff), dinyatakan dengan jelas.** Versi terdahulu perkhidmatan ini memang melog setiap
pengeluaran, supaya sijil yang dikeluarkan secara silap atau terjejas dapat dijejaki. Kami
membuangnya, kerana log itu adalah satu-satunya tempat dalam keseluruhan Lolly di mana data
peribadi berehat pada pelayan, dan kami lebih rela tidak menyimpannya daripada menyimpannya
dengan berhati-hati. Apa yang kami korbankan ialah kebolehjejakan di pihak pelayan: jika sesuatu sijil
disalahgunakan, kami tidak dapat mencari siapa yang memperolehnya. Sijil-sijil bersifat berjangka pendek mengikut
reka bentuk - 7 hingga 365 hari, mengikut pilihan anda, dihadkan oleh pengendali - dan tamat tempoh dengan
sendirinya, iaitu langkah pengurangan risiko yang kami bergantung kepadanya sebagai gantinya. Pengendali yang menghoskan sendiri yang kewajipan
mereka sendiri memerlukan log audit boleh menambah satu, dan dengan berbuat demikian menjadi pengawal
data itu.

## Sambungan pelayar

Sambungan pelayar **Lolly URL Screenshot** tidak mengumpul, menyimpan atau
menghantar sebarang data peribadi. Tiada analitik, tiada penjejakan, tiada pelayan jauh.

**Apa yang ia lakukan.** Apabila anda meminta aplikasi web Lolly untuk menangkap skrin sesuatu URL,
sambungan itu membuka halaman tersebut dalam tab latar belakang sementara, menangkapnya dalam
pelayar anda menggunakan DevTools Protocol, menyerahkan imej itu kembali kepada aplikasi dan menutup
tab itu. Segala-galanya berlaku secara tempatan, pada peranti dan rangkaian anda sendiri.

**Data.**

- <!--i:shieldcheck--> **Kami tidak mengumpul apa-apa.** Sambungan ini tiada pelayan dan tidak membuat sebarang
  permintaan rangkaian sendiri.
- <!--i:photos--> **Imej yang ditangkap** terus pergi ke aplikasi Lolly dalam pelayar yang sama - tidak pernah
  dimuat naik oleh sambungan itu.
- <!--i:link--> **URL yang anda tangkap** digunakan hanya untuk memuatkan halaman tunggal itu bagi tangkapan skrin
  tunggal itu. Ia tidak dilog atau dikongsi.

**Kebenaran.**

- <!--i:wrench--> **`debugger`** - untuk menangkap halaman yang dirender melalui DevTools Protocol (mekanisme
  yang sama digunakan oleh aplikasi desktop Lolly).
- <!--i:monitor--> **`tabs`** - untuk membuka dan menutup tab sementara tempat halaman itu dimuatkan.
- <!--i:globe--> **Akses hos (`<all_urls>`)** - kerana halaman yang anda pilih untuk ditangkap boleh berada
  pada mana-mana laman. Chrome memaparkan ini pada waktu pemasangan sebagai amaran
  kebenaran yang luas. Sambungan ini hanya sekali-kala melawat URL yang anda berikan kepadanya.

Tiada satu pun daripada ini digunakan untuk membaca, memantau atau menghantar penyemakan imbas anda melebihi
tangkapan tunggal yang diminta itu.

## Log infrastruktur

Seperti mana-mana laman web, pelayan di sebalik lolly.tools - dan di sebalik mana-mana
penggunaan Lolly - menjana log capaian pelayan web piawai setiap kali sesuatu permintaan sampai
kepadanya: alamat IP, laluan yang diminta, cap masa, ejen pengguna (user agent). Itu ialah tingkah laku pengehosan
asas, bukan sesuatu yang ditambah oleh Lolly di atasnya, dan ia tidak pernah mengandungi kandungan
dokumen anda, kerana dokumen itu tidak pernah sampai ke pelayan sejak awal lagi. Satu-satunya
pengecualian yang disengajakan ialah fail yang anda serahkan secara jelas kepada panggilan MCP
`lolly_transform`, `lolly_verify` atau `lolly_redact`, yang diproses dalam memori dan tidak pernah
ditulis ke cakera atau log, seperti diterangkan di atas.

**Kod Lolly sendiri tidak menulis apa-apa ke log tersebut.** Pelayan MCP langsung tiada
penyataan pengelogan. Perkhidmatan sijil menghasilkan tepat dua baris sahaja, kedua-duanya
apabila gagal dan kedua-duanya sengaja dilucutkan: kod status kegagalan hantar tanpa
alamat penerima, dan mesej ralat tanpa jejak tindanan (stack trace) atau URL (jejak tindanan boleh
membawa token pendaftaran). Segala-galanya yang lain dalam log itu adalah milik platform pengehosan,
bukan milik kami.

Untuk lolly.tools, pengehosan ialah Vercel dan tempoh simpanan log capaian mengikut
tetapan lalai platform Vercel sendiri untuk pelan kami. Kami tidak mengkonfigurasikan sebarang saliran log,
sebarang eksport log jangka panjang dan sebarang produk analitik atau pemantauan tambahan. Kami tidak menyimpan sebarang salinan
log ini sendiri, yang juga bermakna kami tiada cara untuk mencarinya bagi pihak anda - lihat
[Your rights](#your-rights).

## Asas undang-undang, tempoh simpanan dan penerima

Hampir tiada apa-apa di sini yang memerlukan asas undang-undang, kerana hampir tiada apa-apa yang diproses. Untuk
kelengkapan, senarai penuhnya:

| Pemprosesan | Asas undang-undang (GDPR Art. 6) | Disimpan untuk |
|---|---|---|
| Segala sesuatu pada peranti anda (dokumen, keutamaan, cache, kaunter) | **Bukan pemprosesan kami langsung** - ia tidak pernah sampai kepada kami. Penyimpanan pada peranti anda adalah perlu secara ketat untuk perkhidmatan yang anda minta (ePrivacy Art. 5(3)), jadi ia tidak memerlukan persetujuan | Sehingga anda memadamkannya |
| Alamat e-mel anda semasa pendaftaran Content Credentials | **Art. 6(1)(b)**, pelaksanaan perkhidmatan yang anda minta secara jelas | Tidak disimpan. Wujud dalam memori hanya sepanjang tempoh permintaan |
| Alamat IP anda pada titik akhir log masuk, untuk had kadar | **Art. 6(1)(f)**, kepentingan sah kami dalam mencegah penyalahgunaan perkhidmatan percuma dan kuota e-mel pihak ketiga. Kami menganggap ini melepasi ujian pengimbangan kerana ia hanya dalam memori, tidak pernah ditulis dan dibuang dalam masa kira-kira seminit | ~1 minit, dalam memori pelayan, tidak pernah dikekalkan |
| Log akses pengehosan (IP, laluan, cap masa, agen pengguna) | **Art. 6(1)(f)**, kepentingan sah kami dalam keselamatan perkhidmatan, pencegahan penyalahgunaan dan diagnosis kerosakan | Lalai platform Vercel untuk pelan kami. Kami tidak menambah sebarang saliran atau eksport |

**Penerima.** Kategori penerima adalah: penyedia pengehosan kami (Vercel
Inc.), dan - hanya jika anda menggunakan pilihan log masuk e-mel - penyedia
e-mel transaksi (Resend). Jika anda log masuk dengan GitHub, Google atau SUSE (id.suse.com), anda
berinteraksi dengan penyedia itu secara terus di bawah dasar privasi mereka sendiri. Mereka memberitahu
kami alamat e-mel yang disahkan dan tiada apa-apa lagi. Kami tidak berkongsi data peribadi dengan sesiapa
yang lain, dan kami tidak menjual data, menjalankan pengiklanan atau memprofil pengguna.

**Pemindahan di luar EEA.** Vercel dan Resend adalah syarikat AS. Pengkomputeran fungsi
untuk lolly.tools ditetapkan pada rantau Frankfurt (`fra1`) Vercel supaya
pemprosesan berlaku di EU, tetapi sebagai penyedia berpangkalan AS mereka masih boleh
mengakses data sebagai pemproses dari AS. Pemindahan tersebut bergantung pada Klausa Kontrak
Standard Suruhanjaya Eropah dan/atau Rangka Kerja Privasi Data EU-AS, seperti
yang dinyatakan dalam perjanjian pemprosesan data setiap penyedia. Oleh kerana
data peribadi yang sampai kepada mana-mana penyedia amat terhad - alamat e-mel yang diteruskan
untuk menghantar satu mesej, dan log akses biasa - pendedahannya
adalah kecil setimpal.

**Membuat keputusan automatik.** Tiada. Tiada pemprofilan dan tiada keputusan automatik
yang menghasilkan kesan undang-undang atau kesan besar yang serupa (Art. 22).

## Privasi kanak-kanak

Lolly tidak mengumpul maklumat peribadi secara sedar daripada sesiapa, pada mana-mana umur, dalam
perjalanan biasa penggunaan aplikasi - tiada apa-apa untuk dikumpul. Satu-satunya tempat
maklumat peribadi (alamat e-mel) pernah dikumpul ialah pendaftaran Content Credentials,
yang diterangkan di atas, yang tidak ditujukan atau dimaksudkan untuk kanak-kanak.

## Hak anda

Oleh kerana hampir semua yang disentuh Lolly hanya disimpan pada peranti anda sendiri, kebanyakan
apa yang undang-undang perlindungan data panggil "hak anda" - akses, pembetulan, pemadaman,
kemudahalihan - adalah perkara yang anda sudah boleh lakukan sendiri, serta-merta, tanpa bertanya
sesiapa: data anda tinggal dalam storan pelayar anda, dalam bentuk yang boleh anda periksa,
eksport (**Export my data & render everything**, di atas) atau padam (**Profile → Clear all
my data**).

Secara rasmi, di bawah Artikel 15-22 GDPR anda mempunyai hak untuk **mengakses** data
peribadi anda, untuk **membetulkannya**, untuk **memadamkannya**, untuk **menyekat** atau **membantah
terhadap** pemprosesannya (termasuk membantah apa-apa yang kami asaskan pada kepentingan sah), untuk
**kemudahalihan data** dan - jika pemprosesan bergantung pada persetujuan - untuk
**menarik balik persetujuan itu pada bila-bila masa**, tanpa menjejaskan kesahan apa yang
berlaku sebelum anda menariknya balik.

Berikut ialah kedudukan sebenar mengenai melaksanakan hak tersebut terhadap kami. Oleh kerana kami tidak lagi
menyimpan log pengeluaran, **kami tidak menyimpan sebarang data peribadi tentang anda yang boleh kami cari,
betulkan, eksport atau padam.** Jika anda menulis dan bertanya apa yang kami ada tentang anda, jawapan
yang benar ialah tiada apa-apa, dan kami akan berkata demikian. Satu-satunya kategori yang wujud langsung
ialah log akses pengehosan yang dikaitkan dengan alamat IP, disimpan oleh penyedia pengehosan kami
mengikut lalai tempoh simpanan mereka. Kami tidak mempunyai kemudahan untuk mencari atau memadam secara terpilih
log tersebut, dan kami akan memberitahu anda demikian dan bukannya berpura-pura sebaliknya. Segala sesuatu
yang benar-benar *milik anda* berada pada peranti anda, di mana anda sudah boleh membaca, mengeksport
dan memusnahkannya tanpa meminta kebenaran sesiapa.

**Anda mempunyai hak untuk membuat aduan.** Jika anda rasa kami telah mengendalikan data anda
dengan tidak wajar, anda boleh memfailkan aduan kepada pihak berkuasa penyeliaan perlindungan
data - di EU, pihak berkuasa di negara kediaman anda, tempat kerja anda atau tempat anda percaya
pelanggaran itu berlaku (Art. 77). Pihak berkuasa penyeliaan utama kami ialah *Bayerisches
Landesamt für Datenschutzaufsicht* (BayLDA) di Ansbach, Jerman. Anda tidak perlu menghubungi kami
dahulu, walaupun kami ingin diberi peluang untuk membetulkannya.

Kami tidak menjual data. Kami tiada apa-apa untuk dijual.

## Perubahan pada dasar ini

Tarikh di bahagian atas berubah setiap kali dokumen ini berubah. Perubahan yang mengubah
apa yang meninggalkan peranti anda atau apa yang disimpan mendapat barisnya sendiri di sini, bukan suntingan
senyap - jika anda ingin melihat apa yang berubah, tanya (di bawah) atau bandingkan dengan
[sumber awam](https://github.com/lolly-tools/lolly/commits/main/docs/privacy.md).

## Siapa yang bertanggungjawab, dan cara menghubungi kami

**Pengawal data** untuk lolly.tools ialah:

> SUSE Software Solutions Germany GmbH
> Frankenstraße 146
> 90461 Nürnberg
> Germany

SUSE telah melantik **Pegawai Perlindungan Data**, boleh dihubungi di
[privacy@suse.com](mailto:privacy@suse.com). Gunakan alamat itu untuk sebarang permintaan
rasmi di bawah "Hak anda" di atas.

Untuk apa-apa berkaitan Lolly itu sendiri - cara ia berfungsi, sebab sesuatu dibuat sedemikian atau
pembetulan pada dokumen ini - hubungi **Andy Fitzsimon**,
[fitzy@suse.com](mailto:fitzy@suse.com).

Untuk contoh Lolly yang dihoskan sendiri atau perusahaan, hubungi sesiapa yang mengendalikannya
sebaliknya: pengendali ialah pengawal untuk penggunaan mereka sendiri. SUSE dan projek
sumber terbuka Lolly tidak menyimpan sebarang data untuk penggunaan yang tidak mereka jalankan.
