# Menggunakan Lolly

Anda telah membuka Lolly dan mahu membuat sesuatu, menyimpannya dan menghantarnya. Halaman ini menelusuri gelung itu: buka alat, ubah apa yang dibenarkan, simpan hasilnya dan kongsi sebagai pautan atau fail.

Semua di sini berjalan pada peranti anda, tanpa akaun, dan terus berfungsi luar talian setelah alat dan aset yang anda perlukan dimuat turun. Apl memerlukan pelayar atau apl dengan WebGPU untuk bermula; [Supported environments](/info/supported-environments.html) menyenaraikan yang telah diuji.

## Kenali persekitaran anda

::: figure using-app-map
Skrin utama: empat tab di bahagian atas dan bar di bahagian bawah. Alat, apabila dibuka, menunjukkan kawalannya di sebelah pratonton langsung.
:::

Empat tab terletak di sepanjang bahagian atas skrin utama: **Tools**, **Utilities**, **Assets** dan **Projects**. Tools ialah apa yang anda gunakan untuk membuat, Utilities ialah meja kerja untuk tugas seperti menukar, menyemak atau membersihkan fail, Assets ialah pustaka anda dan Projects menyimpan apa yang anda simpan.

Bar di bahagian bawah mengandungi **Open**, **Settings**, medan carian, **Verify** dan **What?**. Ia muncul pada Tools, Utilities, Assets, Projects, Settings dan panduan yang anda baca dalam apl, dan beralih ke tepi apabila alat dibuka. [Search](/info/search.html) mencapai alat, kerja tersimpan, aset dan tetapan anda daripada medan itu. [Ask Lolly](/info/ask.html) menjawab soalan yang ditaip dengan bahagian panduan ini yang sepadan.

Klik kad untuk memulakan sesuatu yang baharu dalam alat itu. Kerja tersimpan dibuka semula daripada **Projects**.

![Kad galeri dengan navigasi contoh dan satu tindakan + Baharu](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&localize=1&dark=1&cropSelector=.gtile%5Bdata-tool-id%3D%22design%22%5D&filename=gallery&try=1)

Setiap alat ialah paparan terbahagi: **kawalan** di satu sisi dan **pratonton** langsung di sisi yang lain. Ubah kawalan dan pratonton mengikut serta-merta, dan apa yang anda lihat ialah apa yang dieksport.

![Paparan pisah sesuatu alat - tindanan kawalan di sebelah kiri, dan carta bar berkumpulan langsung yang dilukiskannya di sebelah kanan](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26t%3DExample%2520data%26st%3DSample%2520values%252C%2520not%2520a%2520real%2520dataset%26d%3DMonth%252CSeries%2520A%252CSeries%2520B%252CSeries%2520C%250AJan%252C12%252C9%252C5%250AFeb%252C18%252C14%252C7%250AMar%252C24%252C17%252C11%250AApr%252C29%252C23%252C15%26lg%3D1&width=1440&height=900&dpi=192&waitMs=2500&walker=1&format=svg&dark=1&filename=vt-tool-split-view)

**Design** ialah pengecualian. Ia dibuka sebagai kanvas bebas berisi kotak yang anda seret, ubah saiz dan taip ke dalamnya, dengan bar atas, garis masa dan kawalan dek sendiri. [Design: the free canvas](/info/design.html) ialah panduannya.

## Ubah apa yang dibenarkan alat

Alat hanya menunjukkan input yang bertujuan untuk berubah. Pengarangnya telah menetapkan warna, reka letak, tipografi dan logik, jadi apa sahaja yang anda buat mematuhi peraturan mereka. Input termasuk teks, gelangsar, pemilih warna, senarai juntai bawah, tarikh, pemilih imej dan kumpulan baris berulang, dan sesetengahnya berada dalam bahagian boleh lipat.

![Susunan kawalan sesuatu alat - medan teks, pencetus warna dan gelangsar, dan tiada apa lagi kerana selebihnya dikunci oleh penulis](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=%23tool-inputs&walker=1&format=svg&dark=1&filename=use-tool-inputs)

**Klik reka bentuk untuk mencari kawalannya.** Klik mana-mana elemen dalam pratonton dan kawalan yang sepadan mendapat fokus dan bergulir ke paparan. Dalam kumpulan baris berulang, baris tepat yang anda klik terbuka.

**Clear changes**, di atas kawalan, mengembalikan setiap input kepada lalainya.

**Pilihan sistem reka bentuk.** Apabila sistem reka bentuk anda menawarkan lebih daripada satu colourway, rupa cerah dan gelap atau pilihan tema lain, bahagian **Design system** di bawah kawalan menyimpannya. Pilihan hanya muncul apabila ia mengubah alat ini, jadi utiliti fail tidak menunjukkan bahagian langsung. Setiap colourway ialah titik dalam warnanya sendiri, cerah dan gelap ialah dua butang dan sebarang pilihan lain ialah senarai.

Pilihan itu milik karya ini. Ia dibawa dalam pautan dan sesi tersimpan, setiap warna yang dipautkan kepada sistem reka bentuk mengikutinya dan warna apl sendiri kekal seperti sedia ada. Design menunjukkan pilihan yang sama dalam tab **Canvas** Inspector. Alat yang warnanya ialah kandungannya boleh kekal pada colourway kanonik, dan kemudian tidak menawarkan titik colourway. [Lolly Demo in use](/info/lolly-demo-in-use.html#colourways-on-real-work) menunjukkan colourway pada kerja sebenar.

### Zum dan alih pratonton

Pratonton sentiasa menunjukkan tepat apa yang akan dieksport.

- **Zum:** Cmd/Ctrl-skrol atau cubit pada pad jejak, berpusat pada penuding anda. Pada papan kekunci, `0` atau `Shift+1` memuatkan semua kandungan, `1` atau `Shift+0` menetapkan 100% dan `Shift+2` memuatkan pilihan. `+` / `−` mengezum berpusat pada penuding apabila berada di atas pentas, atau pada pusat paparan jika tidak.
- **Alih:** tahan **Space** dan seret, atau seret dengan butang tengah tetikus. Klik biasa kekal bebas untuk mengklik bahagian reka bentuk.
- **Sentuh:** cubit untuk zum, seret untuk alih dan ketik dua kali untuk muat.
- **HUD zum:** tekan dan tahan pusaran Lolly di sudut untuk membuka `−`, **Fit** dan `+`. Ketikan pendek pada pusaran masih membuka menu profil anda.

Dalam Design, **Fit all** merangkumi artboard dan lapisan bebas. Zum keluar secara manual boleh turun di bawah 20% sehingga seluruh halaman memenuhi separuh paparan. Had bawah mutlak ialah nilai yang lebih rendah antara 5% skala Fit biasa dan zum mutlak 2%.

Perubahan saiz output sentiasa mengembalikan paparan kepada muat yang bersih.

![HUD zum dibuka daripada pusaran di sudut kanvas - tolak, Fit, tambah, kemudian togol tema dan bunyi serta pemegang yang menggerakkannya](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=.stage-nav%7Bopacity%3A1!important%7D&drive=drag%3A.stage-nav-profile%7Cdx%3D1%7Chold%3Bwait%3A700&cropSelector=.stage-nav&walker=1&format=svg&dark=1&filename=use-zoom-hud)

### Buat asal dan buat semula

**Cmd/Ctrl-Z** berundur dan **Cmd/Ctrl-Shift-Z** (atau **Cmd/Ctrl-Y**) maju semula. Pasangan yang sama terdapat sebagai butang **Undo** dan **Redo** di atas kawalan (dalam Design ia berada dalam bar atas), dan setiap satu menjadi kelabu apabila tiada apa-apa lagi untuk diundur. Mesej menyatakan input mana yang dipulihkan oleh setiap undur, dengan butang **Redo** dalam mesej.

- **Satu seretan ialah satu langkah.** Perubahan berulang pada satu kawalan dalam setengah saat digabungkan, jadi menarik gelangsar merentasi julatnya ialah satu undur.
- **100 langkah terakhir disimpan.** Suntingan baharu selepas undur mengosongkan tindanan ke hadapan.
- **Dalam kotak teks**, Cmd/Ctrl-Z milik medan itu, aksara demi aksara. Lolly mengambil alih untuk gelangsar, senarai juntai bawah, warna dan suis.
- **Memilih fail** dalam input fail bukan satu langkah, kerana bait itu hanya dipegang untuk sesi ini.

Dalam [kolaborasi](/info/collaborate.html) langsung, sejarah anda kekal milik anda: perubahan daripada peranti lain tidak pernah masuk ke tindanan anda. Undur bertahan sehingga anda meninggalkan alat atau memuat semula. Untuk apa-apa yang lebih lama, alat yang menyimpan semasa anda bekerja menyimpan versi terdahulu di bawah **History**; lihat [Go back to an earlier version](/info/find-your-work.html#go-back-to-an-earlier-version).

### Kamera langsung

Kesan alat **Filter** (Halftone, Scanline, Posterize, Voronoi, Duotone, Stretch, Misprint, Dither, ASCII art dan Glitch) menunjukkan butang **Go live** apabila kamera tersedia. Hidupkannya dan kesan mengikuti webcam anda bingkai demi bingkai, dan eksport gerakan merakam hasilnya sebagai GIF, WebM atau MP4. Bingkai diproses pada peranti anda, dan kamera dilepaskan sebaik sahaja anda berhenti atau meninggalkan alat. Mana-mana pemilih imej juga mempunyai **Take a photo** untuk satu bingkai.

## Menyimpan & menyambung

Untuk menyimpan kerja anda, tekan **Save**, tanda semak di sebelah **Export** pada pil render. Kerja baharu pergi ke **My library**, kerja yang anda simpan sebelum ini dikemas kini di tempatnya dan tiada apa-apa dimuat turun. Panel eksport mempunyai butang **Save** yang sama.

Untuk memilih ke mana ia pergi, tekan **Save as**, di sebelah **Download** dalam panel eksport. Di bawah **Save to a project**, biarkan **My library** dipilih atau pilih projek (**＋ New project…** membuat satu), kemudian tekan **Save**; **Save as a template** menyimpan reka bentuk sebagai [templat](/info/templates.html), titik mula untuk dokumen baharu. Dalam Design, **Save as** ada dalam menu Lolly; pada telefon, tekan **•••**, kemudian **File menu**, kemudian **Save as**.

![Pil render dua separuh: Export, dengan anak panah ke atas yang membuka panel eksport, dan Save, dengan tanda semak yang menyimpan di tempat](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=%23tool-inputs%7Bdisplay%3Anone%7D&cropSelector=.render-pill&walker=1&format=svg&dark=1&filename=use-render-pill)

::: timeline
- <!--i:check--> Tekan **Save** pada pil render, atau **Save as** untuk memilih projek.
- <!--i:folder--> Item pergi ke **My library**, atau projek yang anda pilih.
- <!--i:home--> Kemudian, tekan **Home** di kiri atas dan buka tab **Projects**.
- <!--i:document--> Buka item itu. Setiap tetapan kembali, sedia untuk diubah dan dieksport semula.
:::

Item dinamakan mengikut nama fail yang anda taip dalam panel eksport, atau mengikut alatnya, seperti **QR Code**. Fail yang anda dapat dengan **Download** ialah salinan siap; untuk mengubahnya kemudian, buka item tersimpan dalam Projects.

Simpanan peribadi kekal pada peranti ini, dalam pelayar atau apl tempat anda menyimpan, melainkan anda menghidupkan [Sync](/info/sync.html). Jika sesuatu tidak berada di tempat yang dijangka, [Find and recover your work](/info/find-your-work.html) meliputi setiap kes, daripada tab yang ditutup hingga data pelayar yang dikosongkan.

::: details Projek pasukan dengan Lolly Work (pilihan)
Jika [organisasi anda menggunakan Lolly Work](/info/organisation.html), log masuk ke instansnya dan buka **Projects → Team projects** untuk sesi yang dikongsi dengan anda. Organisasi menetapkan akses dan pengekalan, dan perkhidmatan Lolly Work-nya menyimpan sesi tersebut. Sesi dikongsi menyertai collab langsungnya semasa dibuka apabila organisasi anda membenarkan penyuntingan langsung; [Working together](/info/collaborate.html#work-collabs-with-lolly-work-optional) menerangkan langkahnya.

Pustaka peribadi anda kekal berasingan. Log masuk pada peranti lain memberi anda kerja pasukan, manakala simpanan peribadi masih memerlukan Sync atau sandaran untuk berpindah.
:::

## Berkongsi kerja anda

Reka bentuk keluar sebagai pautan atau sebagai fail. **Share** dalam kawalan eksport membuka dialog yang menawarkan kedua-duanya, dan **Share link** pada sesi tersimpan dalam Projects membuka dialog yang sama untuk sesi itu.

::: cols
## Pautan

- Membawa setiap input dalam alamat, jadi pautan menghasilkan semula reka bentuk.
- Meninggalkan imej dan fail yang anda tambah daripada peranti ini, teks yang sangat panjang dan senarai yang sangat besar.
- Dibuka dalam mana-mana pelayar, jadi anda boleh menanda buku, menampal atau melakukan commit pautan itu.

## Fail .lolly

- Membawa sesi tersimpan dengan imej dan fail pada peranti ini, dan boleh membawa alat serta sistem reka bentuk juga.
- Menahan seni katalog berlesen melainkan anda memilih untuk menyertakan fail.
- Dibuka dalam Lolly: klik dua kali, gunakan **Open** atau letakkan pada apl.
:::

### Pautan

Pautan sedia salin berada di bahagian atas dialog, dengan **Copy** dan butang **QR** yang membuka alat QR Code pada pautan. Di bawah pautan, **Link options** mengandungi:

- **Open in the installed app** menukar pautan kepada alamat `lolly://` untuk Shortcuts, pelancar dan automasi, dengan setiap parameter tidak berubah.
- **Shortest link** memadatkan reka bentuk panjang ke dalam token padat dan menunjukkan penjimatan dalam aksara. Bentuk boleh baca sentiasa ada juga.
- **Password-protect this link** menyulitkan pautan pada peranti anda dengan AES-256. Kata laluan tidak pernah menjadi sebahagian daripada pautan.
- **Pin this tool version** menambah bendera `_v`, supaya kemas kini alat kemudian tidak boleh mengubah apa yang dirender pautan.
- **When the recipient opens the link…** memilih skrin penuh, panel eksport yang sudah dikembangkan, muat turun semasa dibuka (`&export`) atau salinan ke papan keratan (`&copy`).
- **Copy credit** menyalin kapsyen "Made with Lolly" bersama pautan, untuk siaran atau slaid.

Apabila alat memegang medan peribadi, seperti nama anda, **Review personal fields** mengekalkan setiap satu di luar pautan sehingga anda menanda medan itu. [URL mode](/info/url-mode.html) meliputi segala yang boleh dibawa pautan.

**Dialog menyatakan apa yang tidak dapat dibawa pautan.** Imej atau fail yang anda tambah daripada peranti ini, nilai teks yang sangat panjang dan senarai yang sangat besar tidak muat dalam alamat. Setiap satu dikira semasa pautan dibina. Jika sesuatu terpaksa digugurkan, dialog menyenaraikannya dan menunjuk anda kepada pilihan fail, dan bukan menyerahkan pautan yang dibuka dengan gambar yang hilang. Pautan yang hanya panjang mendapat nota yang lebih lembut dengan kiraan aksaranya.

**Sesetengah alat menjadikan pautan keseluruhan produk.** Jump Page menghimpunkan pautan anda ke dalam satu halaman untuk diedarkan: pautan bio, ceramah, depan kedai. Tiada apa-apa dihoskan dan tiada akaun di sebalik halaman, kerana halaman itu ialah pautan. Pelawat mendapatnya selebar penuh, satu pautan bagi setiap adegan semasa mereka menatal.

![Jump Page dalam penyunting: scene tajuk di bahagian atas halaman, dengan scene pautan di bawahnya](/t/url-shot?url=%2F%23%2Ftool%2Fjump%3Ffull%26heading%3DFind%2520us%2520everywhere%26subheading%3DOne%2520link%2520for%2520everything.%26links%3DURL%252CName%252CEmoji%257Ehttps%25253A%25252F%25252Fexample.com%252CWebsite%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fnews%252CNewsletter%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fhello%252CSay%252520hello%252C&width=900&height=1300&dpi=96&waitMs=2000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=use-jump-page)

::: details Pautan terurus organisasi dengan Lolly Work
Untuk perkongsian yang memerlukan tamat tempoh, pembatalan atau kata laluan, Lolly Work menawarkan pautan terurus kepada sesi dikongsi, alat dan aset katalog. Ia diselesaikan melalui perkhidmatan organisasi dan mengikut peraturan aksesnya. Ia berasingan daripada pautan serba lengkap di atas, dan membatalkan satu tidak dapat menarik balik fail yang sudah dimuat turun seseorang. [Rendering and sharing](/info/manage/sharing.html) menyenaraikan jenis pautan dan kebenaran.
:::

### Fail .lolly

**Download .lolly**, dalam bahagian **Editable file** dialog Share, menulis reka bentuk semasa sebagai satu fail. Ia membawa sesi tersimpan dengan imej dan fail pada peranti ini, dan seni katalog biasa turut dibawa. Fail yang lapuk atau tidak tersedia kekal sebagai rujukan luaran dan bukan hilang. Sebelum menyimpan, dialog menunjukkan saiz fail, berapa banyak fail yang disematkan, berapa banyak yang dirujuk dan sama ada alat disertakan. Di mana peranti anda mempunyai helaian kongsi, **Send to…** menyerahkan fail terus kepadanya (AirDrop, kongsi Android).

**Download project (.lolly)**, dalam menu folder dalam **Projects**, menulis seluruh folder, supaya orang lain boleh meneruskan dengan setiap sesi dalam folder. Sesi kelompok ditinggalkan, dan notis menyatakan berapa banyak. **Download originals**, dalam menu yang sama, menulis zip biasa bagi setiap item sebagai failnya sendiri.

Tiga perkara untuk anda putuskan sebelum fail dihantar:

- **Sama ada nama anda dimasukkan.** Nama, e-mel dan organisasi anda ditulis hanya apabila **Use my details to create** dihidupkan dalam [profil anda](/info/profile.html). Apabila dimatikan, fail hanya merekodkan bahawa ia dibuat dengan Lolly, dan bila.
- **Sama ada seni yang ditahan dimasukkan.** Seni berlesen, seni terkunci jenama dan karya katalog yang lesennya tidak pernah direkodkan kekal di luar secara lalai. Jika reka bentuk menggunakan mana-mana, dialog menyatakan berapa banyak dan menawarkan *Download without them* atau *Include and download*, kerana menyertakannya menyerahkan fail kepada sesiapa yang membuka `.lolly`. `CREDITS.txt` fail menyenaraikan apa yang dibawa dan apa yang tidak, dengan sebabnya; [Creative rights and credits](/info/creative-rights.html) menerangkan peraturan.
- **Sama ada alat dimasukkan.** **Include the tool** membungkus fail alat itu sendiri, supaya reka bentuk dibuka pada peranti tanpa alat tersebut. Ia bermula bertanda untuk alat tersuai, seperti fork, dan tidak bertanda untuk alat yang disenaraikan katalog bertandatangan. Pada binaan tanpa katalog bertandatangan, setiap alat dikira tersuai.

**Membukanya.** Dalam apl desktop dan mudah alih, klik dua kali atau ketik `.lolly`, pilih **Open with Lolly** atau hantar ke Lolly daripada helaian kongsi. Dalam apl web, tekan **Open** atau letakkan fail pada Lolly. Setiap laluan membaca manifes fail dahulu dan menunjukkan saiz, kandungan dan apa yang akan berlaku, sebelum apa-apa ditulis.

Jika fail membawa alat yang anda tidak ada, **Trust this tool?** menunjukkan alat dan pengarangnya, dan menyatakan bahawa membukanya menjalankan kod alat itu sendiri pada peranti anda. **Trust & install** meneruskan. Tolak dan kerja masih disimpan ke Projects, menunggu hari anda menambah alat itu. Alat yang kodnya dihantar sebagai modul belum boleh dipasang dengan cara ini, dan ditolak dengan cara yang sama.

::: details Apa yang dipegang .lolly, dan cara membukanya berfungsi
`.lolly` ialah sambungan bundle Lolly, dan `format` dalam `manifest.json`-nya menyatakan apa yang ada di dalam:

- **Reka bentuk dikongsi** (`lolly-share`) memegang satu sesi tersimpan, fail terbenamnya dan resit untuk apa-apa yang masih diselesaikan melalui rujukan. Ia juga boleh membawa alat dan sistem reka bentuk. Membukanya menambah Project baharu dan tidak pernah menulis ganti sesi.
- **Projek dikongsi** (`lolly-share`, jenis `project`) memegang folder daripada Projects: sub-foldernya, setiap sesi di dalamnya dengan jubinnya dan gambar yang difailkan di situ. Membukanya menambah salinan keseluruhan folder. Setiap sesi dibawa sebagai `sessions/<key>.json` dengan jubinnya di bawah `thumbs/`. Lolly sebelum fail projek wujud meminta anda mengemas kini.
- **Pek sistem reka bentuk** (`lolly-brand`) memegang token dan mungkin fon, logo, versi diterbitkan dan sumber yang dikekalkan. Membuka pek menambah sistem reka bentuk bernama berasingan dan menjadikan sistem itu aktif.
- **Pek ruang kerja atau instans** ialah `lolly-brand` dengan alat yang diisytiharkan, aset katalog dan, pilihan, alamat instans. Memuatkannya menggantikan satu tindihan ruang kerja yang dimuatkan sebelum ini, dan pratonton menyenaraikan kesan seluruh peranti itu.

Sandaran peranti penuh bukan `.lolly`. Ia kekal `LollyTools-….zip` (format `lolly-backup`) dan dipulihkan melalui **Settings → Storage → Import data…**. Folder alat yang dizip juga kekal `.zip`. [Data transfer](/info/data-transfer.html) ialah rujukan format.

`.lolly` ialah zip biasa. Namakan semula `.zip` untuk melihat ke dalam: imej anda sendiri berada di bawah `assets/uploads/`, seni katalog di bawah `assets/catalog/`, `manifest.json` menyenaraikan setiap fail, dan README menyatakan apa fail itu.

macOS, Windows, Linux, iOS dan Android semuanya mendaftarkan format ini, pengurus fail desktop menunjukkannya sebagai dokumen Lolly dan GNOME Files boleh menunjukkan lakaran kecil sesi tersimpan itu sendiri. Membuka daripada Design System Setup mencadangkan tindakan sistem reka bentuk apabila reka bentuk dikongsi membawa satu, tetapi tidak pernah menyembunyikan **Open shared design**.

Dokumen yang diserahkan daripada apl lain pada iOS atau Android dihadkan kepada 48 MB, kerana penyerahan menyalin baitnya merentasi sempadan apl, dan apl menyatakannya. **Open** dalam Lolly tidak mempunyai had sedemikian, jadi gunakannya untuk bundle yang lebih besar.

Selepas anda mengesahkan, Lolly mengembangkan dan mengesahkan bundle sekali. Aset pergi ke pustaka anda, dipadankan mengikut checksum supaya fail yang sudah ada pada peranti digunakan semula. Sesi pergi ke Projects dengan id baharu, jadi fail yang sama boleh dibuka dua kali; sesi yang alatnya tiada menunggu di situ. Fail melebihi 100 MB ditandakan sebagai besar, dan pratonton memberi amaran apabila storan pelayar melaporkan ruang kosong kurang daripada yang diperlukan fail. Setiap bahagian dilindungi integriti disemak sebelum apa-apa dikomit, dan salinan rosak ditolak tanpa meninggalkan apa-apa.
:::

Pautan dan fail kedua-duanya menyerahkan syot kilat. Untuk penyuntingan langsung, [Working together](/info/collaborate.html) meliputi collab peribadi antara dua peranti dan collab kerja pilihan melalui Lolly Work.

## Aset - pustaka anda

**Assets** (`#/a`) menghimpunkan segala yang boleh digunakan alat anda: logo jenama, imej, audio dan gerakan, dikumpulkan mengikut jenis, bersama fail anda sendiri. Muat naik anda disimpan pada peranti anda. Organisasi yang menggunakan Lolly Work juga boleh membekalkan katalog dikongsi di bawah peraturan aksesnya sendiri; lihat [Use Lolly at your organisation](/info/organisation.html).

![Aset - aset jenama, swatch dan fon, serta muat naik anda sendiri](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches%2Cfonts&width=1440&height=900&dpi=96&waitMs=2400&css=.plat-swatch-grid~%2A%7Bdisplay%3Anone%7D&walker=1&format=svg&localize=1&dark=1&filename=assets)

- <!--i:upload--> **Bawa masuk fail anda.** Letakkan imej, SVG, klip audio, video, Lottie, PDF atau dek PowerPoint pada kawasan muat naik, atau klik untuk memilih. Ia tiba dalam Assets serta-merta dan dalam pemilih aset setiap alat. PDF berbilang halaman atau `.pptx` bertanya halaman atau slaid mana yang hendak disimpan, dan setiap satu menjadi aset SVG. Imej yang anda tambah dalam alat disimpan seperti ia tiba dalam **My images**, jadi Content Credential padanya masih disahkan, dan hanya fail yang sangat besar bertanya sama ada hendak diubah saiz. **Settings → Storage** menunjukkan berapa banyak yang dipegang oleh **My images**. Tiada had selain storan peranti anda. Untuk memadam data EXIF dan GPS semasa imej masuk, hidupkan **Strip metadata from uploads** di bawah **Settings → Feature flags**; Content Credentials dikekalkan dalam kedua-dua keadaan.
- <!--i:star--> **Jadikan kegemaran apa yang anda capai.** Bintangkan aset atau swatch jenama dan ia disemat di bahagian atas setiap pemilih.
- <!--i:folder--> **Kemas.** Alihkan aset ke kumpulan lain, sembunyikan aset jenama dikongsi yang tidak anda gunakan (**Show hidden** mengembalikannya) atau padam muat naik anda sendiri. Bar pilihan yang sama seperti Projects bertindak ke atas keseluruhan pilihan.
- <!--i:layers--> **Angkat video daripada latar belakangnya.** Buka butiran video, atau klik kanan kadnya dalam pemilih aset, dan pilih **Remove background…**. **On-device model** memotong subjek daripada adegan yang sibuk; **Colour key** membuang latar yang disinari sekata seperti skrin hijau, dengan **Tolerance**, **Softness** dan **Spill removal** untuk tepi, dan tidak memerlukan muat turun. **Resolution** (360, 480, 720 atau 1080p, tidak pernah melebihi sumber) menukar butiran dengan kelajuan. Potongan itu, WebP atau PNG beranimasi dengan ketelusan sebenar, disimpan di sebelah asal, dan Content Credential sumber dibawa sebagai ramuan. [Generated once, rendered the same](/info/ai-features.html) menerangkan mengapa ini kekal sebagai suntingan biasa.

### Bawa palet dan fon anda ke mana-mana

Panel **Swatches** dalam Assets menunjukkan warna yang membentuk jenama anda: warna jenamanya, warna yang anda tambah, ramp dan spektrumnya. Warna peranan yang disimpan Lolly untuk antara muka (teks, permukaan, tepi, ketua colourway dan salinan warna jenama di bawah nama lain) menunggu di sebalik kad kelabu **Show colour roles** di kaki panel.

Setiap warna ialah kad seperti aset lain. Klik satu untuk membuka butirannya, pilih beberapa untuk memuat turun hanya itu atau muat turun keseluruhan palet dalam format yang dibaca alat anda yang lain:

- <!--i:code--> **Design tokens (JSON)**, **CSS variables** atau **CSS classes**, untuk helaian gaya atau binaan. Warna yang lebih luas daripada sRGB mengekalkan nilai luasnya: CSS menetapkannya selepas hex, dan JSON mengekalkan hex bersama warna luas, binaan CMYK dan dakwat spot.
- <!--i:palette--> **Adobe Swatch Exchange (.ase)**, untuk Illustrator atau Photoshop. Warna yang dikunci kepada binaan CMYK tiba sebagai swatch CMYK itu, dakwat spot sebagai swatch spot bernama dan warna yang lebih luas daripada sRGB sebagai Lab.
- <!--i:pentool--> **GIMP palette (.gpl)**, untuk GIMP atau Inkscape, dan **SCSS variables**, kedua-duanya dalam sRGB.

![Panel Swatches - lima butang muat turun palet di bahagian atas, kemudian setiap warna jenama sebagai cip yang membuka butirannya](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches&width=1440&height=900&dpi=96&waitMs=1800&css=.cat-group%3Anot%28%5Bdata-group%3Dswatches%5D%29%7Bdisplay%3Anone%7D&cropSelector=%5Bdata-group%3Dswatches%5D&walker=1&format=svg&dark=1&filename=use-swatch-downloads)

Pilih warna dengan titik pada setiap kad: Shift-klik titik kedua untuk semua di antaranya, seret kotak melalui ruang kosong atau tekan Cmd/Ctrl+A dengan kad difokuskan. Bar menawarkan **Download as…** dalam enam format yang sama, **Copy hex** dan **Favourite**. Sebelum anda memilih format, menu menyenaraikan mana-mana warna yang tiada format boleh pegang (Transparent tiada warna langsung), format mana yang menyimpan warna luas sebagai sandaran sRGB-nya (SCSS dan GIMP) dan yang membawa nilai CMYK dan spot (JSON dan .ase). Klik kanan kad untuk tindakan yang sama pada satu warna.

Butiran warna memenuhi pratonton dengan warna itu dan membuka **Linked values** (binaan CMYK atau dakwat spotnya, sebarang nilai yang dikarang untuk ruang atau mesin cetak tertentu dan token reka bentuknya), **Every notation** (hex, OKLCH, Display-P3 dan selebihnya, masing-masing dengan butang salin), **Plotted on a colour space**, **Tones** dan **Readability**. Kekunci anak panah melangkah melalui palet, **Copy link** berkongsi warna itu sendiri dan **Open in Colour Lab** membawanya lebih jauh.

Panel **Fonts** menyenaraikan muka taip jenama anda dengan **download** bagi setiap satu, untuk dipasang secara setempat atau diserahkan kepada kedai cetak.

## Jadikan grid milik anda

- <!--i:star--> **Jadikan kegemaran apa yang anda guna.** Klik kanan kad dan pilih **Add to favourites**, dan ia mendapat jubin besar dalam jalur di atas grid. [Your favourites](/info/favourites.html) meliputi jalur itu.
- <!--i:eyeoff--> **Sembunyikan alat yang tidak pernah anda guna.** Klik kanan kad, atau pilih beberapa, dan pilih **Hide tool**. Ia gugur daripada grid dan daripada apa yang ditemui oleh menaip dalam grid. Jubin kelabu **Show hidden tools (N)** di hujung mendedahkannya semula, malap, masing-masing dengan **Unhide tool** dalam menunya. Menyembunyikan hanya mengubah grid anda: alat masih dibuka daripada pautan atau penanda buku.
- <!--i:clock--> **Alat anda, dahulu.** Setelah anda menyimpan kerja dalam tiga alat berbeza, barisan cip **Yours** di atas grid memulakan dengan kegemaran dan alat terkini anda.
- <!--i:sliders--> **Susun mengikut cara anda.** **View options** menetapkan reka letak (**Grid**, **Card** atau **List**), saiz dan ketumpatan kad, susunan isihan dan penapis kategori.

![Hujung grid Tools dengan alat tersembunyi didedahkan: kad Wordmark yang malap, dan di sebelahnya jubin kelabu yang menogolnya kembali ke paparan, kini berbunyi Hide hidden tools](/t/url-shot?url=%2F%23%2F&width=1440&height=680&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A.gtile--hiddenbox%3Bpress%3AEnd%3Bwait%3A800%3Bhover%3A.gtile--hiddenbox%3Bwait%3A300&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&rasterDpi=96&dark=1&filename=misc-hidden-tools)
<!--
SHOT NOTE (misc-hidden-tools): the trailing `press:End` is required. The
hidden box and the revealed cards live at the very END of the grid, and
clicking the box runs applyView(), which re-lays the grid out and drops the
scroll back to the top - so without it the frame published the TOP of the
gallery under a caption about its bottom. `press:` with no `on=` goes to the
keyboard, and the End key with focus on the just-clicked box scrolls the
document; the walker then anchors the body walk to that band.
The tile reads "HIDE hidden tools" in the shot, not "Show" - it is a toggle and
the recipe has just pressed the tile. The alt says so rather than quoting the resting
label the prose above already gives.
The recipe hides nothing itself. The lolly-demo catalog the captures pin
ships Wordmark hidden (`defaultHiddenTools` in its assets index.json), so a
fresh profile already has one hidden tool and the recipe only clicks the grey
reveal tile (`.gtile--hiddenbox`, confirmed in gallery.ts). It used to tick
the QR Code card and press the bulk bar's Hide button first; under lolly-demo
that published Wordmark dimmed and QR Code not, under a caption naming QR
Code, so the steps were dropped rather than relied on. QR Code was hidden
in that run too: the End scroll had left the pointer over its card, and a
hovered hidden card lifts its dimming (gallery.css), so it read as a normal
tool. The closing `hover:` puts the pointer back on the reveal tile, which
keeps every revealed card dimmed.
-->

**Bertindak pada beberapa kad sekali gus.** Tanda kotak semak setiap kad, seret kotak pilihan merentasi ruang kosong atau Shift/Cmd-klik, dan bar muncul dengan apa yang dibenarkan paparan itu:

- **Tools dan Utilities:** Favourite, Hide, Available offline, **View sessions** (Projects, hanya menunjukkan sesi yang dibuat dengan alat tersebut) dan Copy link untuk satu kad.
- **Assets:** Favourite dan Hide untuk sebarang pilihan. Duplicate, Download dan Delete muncul hanya apabila setiap item yang dipilih ialah muat naik anda sendiri, kerana aset sistem reka bentuk dikongsi ialah kontrak kekal.
- **Projects:** lihat [Find and recover your work](/info/find-your-work.html#find-something-you-saved).

![Bar pemilihan galeri untuk dua alat, menawarkan Available offline, View sessions, Favourite dan Hide](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%21important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-select%3D%22gradient%22%5D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=misc-bulkbar-gallery&cropSelector=.gallery-bulkbar)
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
`projects` shot (now on find-your-work.md) carries; revisit if the pipeline gains a
storage-seeding hook.
-->

**View sessions** muncul hanya apabila sesuatu dipilih. Klik kanan satu kad yang tidak dipilih sebaliknya dan ia menawarkan **N saved sessions**, senarai sesi tersimpan alat itu di mana pemadaman memindahkan sesi ke Trash.

## Pada telefon

Pada skrin sempit, reka letak menjadi satu lajur:

- **Kawalan menjadi helaian** di bahagian atas dengan pemegang seret pada tepi bawahnya. Seret pemegang untuk melekap pada **peek**, **half** atau **full**, atau ketik untuk runtuh dan kembang. Pratonton memenuhi ruang di bawah dan kekal kelihatan semasa anda menyunting.
- Butang **Export** terapung membuka helaian eksport: format, saiz, salin, simpan dan muat turun di satu tempat. Ketik latar belakang untuk menutup helaian.

![Sesuatu alat pada skrin selebar telefon - kawalan sebagai helaian di atas, palet terjana mengisi pratonton di bawah dan pil render terapung di tengah bawah](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3Df97316%26harmony%3Dadjacent-3%26steps%3D9&width=430&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=vt-phone-palette)

## Settings, bunyi dan keselesaan

**Settings**, di kaki skrin utama, menyimpan butiran anda, sistem reka bentuk anda, kebolehcapaian, storan dan muat turun luar talian. [Settings](/info/dashboard.html) memetakan setiap tab.

- **Butiran dan gambar kepala anda** mengisi mana-mana alat yang dibina untuk menggunakannya, seperti tandatangan e-mel atau lencana. [Profiles](/info/profile.html) meliputinya.
- **Kebolehcapaian** mempunyai empat suis keselesaan: **Reduce motion**, **Hide colourful previews**, **High contrast** dan **Large text**. Ia mengubah apl di sekeliling kerja anda, tidak pernah kanvas alat atau eksport.
- **Sound** memainkan bunyi bantuan lembut untuk apa yang anda lakukan, dan **Neurospicy Mode** memainkan trek fokus yang tenang. Kedua-duanya mati sehingga anda menghidupkannya, dalam **Settings → Accessibility** atau menu profil.
- **Available offline** memuat turun selebihnya apl, alat anda, katalog dan panduan sebelum anda kehilangan sambungan. Lolly ialah apl web yang boleh anda pasang: gunakan butang pasang pelayar anda, atau *Add to Home Screen* pada telefon, untuk apl skrin penuh yang mengemas kini sendiri apabila anda kembali dalam talian.
- **Storage** menunjukkan apa yang disimpan Lolly pada peranti ini. [If you clear your browser data](/info/find-your-work.html#if-you-clear-your-browser-data) menerangkan apa yang dibuang oleh pengosongan, dan [Privacy Policy](/info/privacy.html) menyenaraikan segala yang diambil atau dihantar oleh apl.

::: note Jika paparan gagal dimuatkan selepas kemas kini
Panel kosong atau mesej "failed to fetch" sejurus selepas kemas kini biasanya hilang dengan satu muat semula. Kerja, sesi dan sistem reka bentuk tersimpan anda tidak disentuh, kerana ia disimpan pada peranti anda. Hanya gambar yang anda tambah dan tidak pernah disimpan mungkin perlu ditambah semula.
:::

## Ke mana seterusnya

- **[Design: the free canvas](/info/design.html)**: kanvas, bentuk, garis masa dan membentang dek.
- **[Batch and Multi-edit](/info/batch.html)**: banyak versi satu reka bentuk, atau beberapa reka bentuk tersimpan disunting bersama.
- **[Export a file](/info/exporting.html)**: memilih format, saiz, unit cetakan, ketelusan dan video.
- **[Import a design](/info/design-import.html)**: bawa fail Figma, Penpot, Illustrator atau InDesign ke dalam Design dan teruskan menyunting.
- **[Templates](/info/templates.html)**: titik mula tersimpan untuk alat.
- **[Wide Colour and HDR](/info/hdr-editing.html)**: kekalkan ketepatan imej asal dalam Design dan Darkroom.
- **[Find and recover your work](/info/find-your-work.html)**: di mana segala-galanya berada, dan cara memindahkannya ke peranti lain.
