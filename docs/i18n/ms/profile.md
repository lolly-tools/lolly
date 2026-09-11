# Profil - siapa anda apabila anda mencipta

**Profil** ialah identiti kerja yang digunakan Lolly untuk mencipta *sebagai*. Ia adalah set kecil butiran yang boleh diambil oleh sesuatu alat supaya anda tidak perlu menaipnya semula setiap kali - nama anda, butiran hubungan, gambar kepala pilihan, beberapa keutamaan - ditambah segala yang anda kumpulkan semasa bekerja: sesi yang disimpan, imej yang dimuat naik dan jumlah aktiviti tempatan.

Semua yang ada dalam profil disimpan **pada peranti**, dalam pangkalan data tempatan pelayar (IndexedDB pada PWA web, sistem fail pada aplikasi Tauri). Tiada akaun dan tiada apa-apa dimuat naik. Anda menguruskannya di bawah **Profil** (di penjuru kanan atas galeri); alat hanya *membaca* profil, dan hanya medan khusus yang direka untuk pra-isi.

> Profil adalah tentang *anda* (atau sesiapa sahaja yang mencipta di sini). Ia berbeza daripada **Platform** - warna, fon dan tetapan global jenama - dan daripada **Capabilities**, katalog perkara yang boleh dilakukan oleh aplikasi. Lihat [Profile vs Platform vs Capabilities](#profile-vs-platform-vs-capabilities) di penghujung.

## Apa yang ada dalam profil

| Bahagian | Apakah ia |
|---|---|
| **Nama** | Nama pertama dan nama akhir. |
| **Hubungan** | E-mel dan telefon. |
| **Lokasi** | Bandar dan negara. |
| **Gambar kepala** | Foto pilihan, dipotong kepada segi empat sama dan disimpan sebagai imej tempatan. Digunakan oleh alat seperti tandatangan e-mel, kad petikan, carta organisasi dan susun atur dinamik. |
| **Use my details to create** | Suis opt-in tunggal (ia berbunyi **Using my details** apabila diaktifkan). Ia mengawal sama ada butiran peribadi anda turut serta sebagai **asal-usul (provenance)** - baris pengarang/kredit yang terbenam dalam fail yang dieksport - dan sebagai pengarang pada larian kelompok **/pro**. (Ia tidak mengawal pra-isi: lihat [Bagaimana alat menggunakan profil anda](#how-tools-use-your-profile).) |
| **Keutamaan** | Tema anda (Light, Dark atau Brand - tema jenama mewarnakan aplikasi dengan palet anda sendiri) dan bahagian aplikasi mana yang telah anda aktifkan melalui **Feature flags**. |
| **Kebolehcapaian** | Empat suis keselesaan - *Reduce motion*, *Hide colourful previews*, *High contrast*, *Large text* - disimpan pada rekod profil, jadi ia turut serta dalam eksport profil. Lihat [Kebolehcapaian](#accessibility). |
| **Kerja anda** | Sesi yang disimpan (dengan lakaran kecil) - disusun ke dalam folder bersarang dalam **[Projects](/info/using.html)** - pustaka **My images** anda dan statistik aktiviti tempatan, semuanya dikaitkan dengan profil ini. |

![Three theme cards, each previewing its own type and colour, with the active one flagged](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

![Skrin Profile - nama, hubungan, gambar kepala pilihan dan keutamaan anda](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&walker=1&localize=1&dark=1&filename=profile-details)

Tiada satu pun daripada ini diwajibkan. Profil kosong adalah profil yang baik sepenuhnya; anda hanya mengisi apa yang menjimatkan masa menaip anda.

Halaman ini panjang, jadi ia membawa **rel tetapan** sendiri di sisi - Your details, Appearance, Accessibility, Lolly instance, Your activity, Storage, Available offline, Feature flags, Content Credentials - dengan medan **Search settings** di atasnya yang menapis senarai semasa anda menaip. Setiap bahagian boleh dipaut-dalam sebagai `#/profile?focus=<section-id>`, yang membukanya dan menatal ke paparannya (`#/profile?focus=storage-section`, `?focus=feature-flags-section`, dan seterusnya), supaya sesuatu pautan boleh menuju kepada satu tetapan sahaja dan bukannya ke bahagian atas halaman.

![Tiga kad tema, masing-masing mempratonton jenis dan warnanya sendiri, dengan yang aktif ditandakan](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

## Profil adalah konteks, bukan sekadar seorang individu

Perkataan "profil" memberi kesan seolah-olah ia satu individu yang tetap, tetapi dalam Lolly ia sebenarnya **konteks penciptaan** - *siapa anda semasa anda membuat sesuatu ini*. Konteks itu boleh mengambil tiga bentuk berbeza, dan Lolly mengendalikan ketiga-tiganya dengan cara yang sama.

### Sebagai individu

![The headshot control, empty until you upload a photo that then stays on this device](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-side&walker=1&dark=1&filename=pd-profile-headshot)

![Kawalan gambar kepala, kosong sehingga anda memuat naik foto yang kemudiannya kekal pada peranti ini](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-side&walker=1&dark=1&filename=pd-profile-headshot)

### Sebagai pasukan

Profil tidak semestinya mewakili seorang manusia sahaja. Ia boleh mewakili **pasukan atau fungsi dalam sesebuah organisasi**: nama kongsi pasukan, alamat peti masuk kumpulan (`events@…`), sesebuah jabatan, gambar kepala pasukan atau lambang unit. Seorang sahaja menyediakannya, mengeksportnya (lihat di bawah) dan selebihnya pasukan memuatkan profil yang sama - supaya segala yang dihasilkan oleh pasukan itu membawa butiran yang konsisten tanpa sesiapa perlu memasukkannya semula. Kiosk kongsi atau komputer riba demo yang dipinjam boleh menjalankan satu profil pasukan sahaja yang digunakan oleh semua orang di sebaliknya untuk mencipta.

### Sebagai fungsi - peranan yang anda pakai sekali-sekala

Inilah kes yang terlepas pandang oleh model tegar "satu individu, satu profil". Anda mungkin seorang **pengurus acara selama tiga hari setahun** dan sesuatu yang lain sepenuhnya pada baki masa yang ada. Pada tiga hari itu anda mahukan butiran acara, peti masuk acara, mungkin sub-jenama acara untuk mengisi lencana dan papan tanda anda; pada baki 362 hari itu anda mahukan identiti biasa anda kembali.

Dalam Lolly, peranan itu hanyalah **satu lagi profil yang anda simpan berdekatan** - satu bungkusan tersimpan (bahagian seterusnya) yang anda muatkan untuk acara tersebut dan ketepikan selepas itu. Peranan itu adalah sebuah topi, bukan akaun baharu. Pakainya apabila anda memerlukannya, tanggalkannya apabila anda selesai.

## Satu pemasangan, satu profil aktif - banyak yang boleh anda simpan

Pada bila-bila masa, satu pemasangan mempunyai **satu profil aktif** - butiran yang dilihat oleh sesuatu alat pada masa itu. Tiada penukar profil dalam aplikasi; sebaliknya, setiap profil ialah **bungkusan mudah alih** (satu `.zip` sahaja, lihat [di bawah](#moving-a-profile-to-a-new-device)). Ini sengaja menggunakan mekanisme yang sama seperti berpindah ke peranti baharu - profil ialah fail yang boleh anda simpan, salin dan muatkan.

![The storage meter, breaking down saved sessions, images and cache against what the browser actually reports](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%2C.storage-subsection%2C.storage-actions%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

- <!--i:trash--> **Penukaran paling bersih:** **Profile → Storage → Clear all my data**, kemudian **Import** bungkusan untuk konteks yang anda masuki. Anda kini mencipta semata-mata sebagai profil itu.
- <!--i:layers--> **Berlapis:** mengimport *tanpa* mengosongkan dahulu akan **bercantum** - profil, sesi dan imej yang diimport mendarat di atas apa yang sudah ada, menggantikan mana-mana yang mempunyai nama sama dan membiarkan selebihnya. Berguna untuk menarik sesi tersimpan sesuatu pasukan ke dalam persediaan anda sendiri; bukan pilihan yang sesuai jika anda memerlukan sempadan peranan yang bersih.
- <!--i:monitor--> **Bersebelahan:** kerana semuanya bersifat khusus-peranti, profil pelayar berasingan, akaun pengguna berasingan atau PWA kedua yang dipasang masing-masing membawa profil Lolly sendiri yang bebas. Jalankan pemasangan peribadi anda dan pemasangan kiosk acara serentak, tanpa perlu bertukar.

Jadi jika anda benar-benar mengendalikan beberapa konteks serentak (anda, pasukan anda, topi pengurus acara), anda simpan beberapa bungkusan dan muatkan yang mana satu anda perlukan:

![Meter storan, memecahkan sesi tersimpan, imej dan cache berbanding apa yang sebenarnya dilaporkan oleh pelayar](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%2C.storage-subsection%2C.storage-actions%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

> Simpan satu bungkusan bagi setiap konteks dan namakan semula fail-fail tersebut mengikut apa yang diwakilinya (`LollyTools-events-2026.zip`, `LollyTools-me.zip`). Fail itu *ialah* profil tersebut.

## Kebolehcapaian

**Profile → Accessibility** memegang empat tetapan keselesaan untuk aplikasi *di sekeliling* kerja anda. Setiap satu tidak aktif sehingga anda mengaktifkannya, dan tiada satu pun daripadanya mencapai ke dalam kanvas alat atau eksport - aplikasi yang lebih tenang tidak boleh menggerakkan walau satu piksel pun fail yang anda hantar.

- <!--i:film--> **Reduce motion** - mematikan peralihan, slaid dan hiasan animasi dalam aplikasi. Kanvas alat anda dan sebarang eksport animasi terus bergerak tepat seperti direka.
- <!--i:image--> **Hide colourful previews** - menggantikan seni pratonton galeri dengan kad ikon-dan-teks yang lebih tenang, dan merendahkan warna serta kontras lakaran kecil projek anda supaya ia kekal dikenali tanpa "menjerit". Di dalam sesuatu alat, semuanya masih dipaparkan dalam warna penuh.
- <!--i:sliders--> **High contrast** - mengukuhkan sempadan, teks dan cincin fokus aplikasi. Warna jenama anda dan segala-galanya pada kanvas kekal tepat seperti yang anda tetapkan.
- <!--i:font--> **Large text** - membesarkan jenis huruf aplikasi: label, menu dan teks butang. Kawalan itu mengekalkan saiznya, jadi hanya perkataan di dalamnya yang membesar, dan jenis huruf di dalam reka bentuk anda tidak disentuh, jadi tiada apa yang anda eksport akan mengalir semula (reflow).

Ini disimpan pada rekod profil itu sendiri, itulah sebabnya ia turut serta dalam eksport profil dan mendarat pada pemasangan seterusnya bersama nama dan sesi anda. (Peranti juga menyimpan cerminan tempatan kecil supaya tetapan itu terpakai sebelum lukisan pertama; cerminan itu khusus-peranti sahaja dan tidak turut berpindah.)

## Instans Lolly anda

**Profile → Lolly instance** menunjukkan dari mana pemasangan ini mendapatkan alat dan katalognya - alamat instans itu, atau *Bundled with this app* apabila segala-galanya dihantar di dalam binaan itu sendiri. Apabila sesuatu penggunaan (deployment) menawarkannya, pautan **Instance console** membuka permukaan pentadbirannya, dan **Change** / **Disconnect** menukar arah pemasangan itu atau memutuskannya.

Menukar arah kepada instans lain memerlukan **aplikasi desktop**: pelayar menyekat sesuatu halaman daripada memuatkan alat dan aset merentasi asal (origin), jadi di web bahagian ini hanya melaporkan di mana anda berada dan berhenti setakat itu.

## Tersedia luar talian

Lolly melakukan caching semasa anda menggunakannya, tetapi caching-semasa-guna hanya meliputi tempat yang telah anda lawati. **Profile → Available offline** adalah untuk perjalanan yang sudah anda jangkakan: sejam di wifi lapangan terbang sebelum penerbangan yang tiada sambungan langsung. Muat turun bahagian yang anda perlukan, perhatikan satu bar kemajuan, dan segala yang anda ambil terus berfungsi walaupun sambungan hilang.

Tujuh bahagian, masing-masing dengan saiznya dinyatakan sebelum anda komit:

- <!--i:layout--> **Aplikasi** - setiap paparan, editor dan fon, termasuk yang belum anda buka lagi. Tanpa ini, skrin yang tidak pernah anda lawati dalam talian tidak dapat dimuatkan luar talian.
- <!--i:image--> **Katalog** - aset jenama melebihi yang penting sahaja. Ambil semuanya, atau buka *Choose by tag* dan ambil hanya tag yang anda gunakan.
- <!--i:book--> **Panduan & dokumentasi** - laman dokumentasi ini, dalam bahasa anda, termasuk tangkapan skrin.
- <!--i:cpu--> **Suara pertuturan** - model suara di sebalik audio Script dan naratif. Dimuat turun sekali sahaja, kemudian ia berjalan di peranti.
- <!--i:zap--> **Model upscaling** - penambah resolusi imej AI: foto, ilustrasi/anime dan wajah.
- <!--i:layers--> **Penyingkiran latar belakang** - model potong-keluar di peranti di sebalik *Remove background*.
- <!--i:shield--> **Imbasan mendalam Verify** - pengimbas tera air di peranti, untuk menyemak Content Credentials tanpa sambungan.

Empat yang terakhir ditandakan **muat turun besar**, dan ia sengaja dijadikan opt-in individu: **Download everything** di bahagian atas mengambil aplikasi, skop katalog yang anda pilih, dokumen dan semua alat dalam satu langkah dan tiada apa-apa lagi. Suara pertuturan, penambah skala (upscaler), penyingkiran latar belakang dan imbasan mendalam masing-masing hanya dimuat turun apabila anda meminta baris itu mengikut nama - beberapa ratus megabait tersembunyi di dalam satu butang adalah tidak jujur.

Di bawah bahagian-bahagian itu terletak senarai setiap alat: setiap alat dimuat turun secara individu (tanda semak bermaksud sedia luar talian), atau **Download all** menyapu kesemuanya sekali. Muat turun boleh disambung semula - batalkan atau kehilangan sambungan dan larian seterusnya menyambung dari tempat ia berhenti, hanya mengambil apa yang tiada - dan ia menyegar semula sendiri apabila anda kembali dalam talian, hanya menarik apa yang berubah dalam keluaran baharu.

Jika pelayar belum memberikan storan berterusan, bahagian ini menyatakannya dan menawarkan **Protect downloads**, yang memintanya - perbezaan antara "dimuat turun" dan "dimuat turun sehingga pelayar mahukan semula ruang itu".

## Memindahkan profil ke peranti baharu

![The two buttons that move a whole install: Export my data writes one zip, Import data reads it back](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.storage-subsection&dark=1&filename=pd-transfer-controls)

Oleh sebab profil adalah sepenuhnya tempatan, satu-satunya cara untuk memasukkannya ke dalam pemasangan kosong - komputer riba baharu, pelayar yang baru sahaja ditetapkan semula, komputer rakan sekerja, atau kotak luar talian - adalah dengan **membawa fail itu sendiri**. Tiada log masuk yang memulihkannya untuk anda, dan itulah intinya: tiada apa-apa pun yang pernah meninggalkan peranti anda pada mulanya.

- <!--i:download--> **Export my data** memuat turun satu `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` - dinamakan mengikut profil yang memilikinya, dengan nombor jujukan harian supaya eksport berulang tidak berlanggar (bahagian nama digugurkan apabila profil tidak mempunyainya). Ia mengandungi profil anda, setiap sesi yang disimpan (berserta lakarannya), imej yang anda muat naik - token jenama dan fon yang dipasang turut serta sebagai aset pengguna - dan keutamaan anda (tema, susun atur, statistik aktiviti tempatan).
- <!--i:upload--> **Import data…** pada pemasangan lain membaca semula fail itu dan anda menyambung tepat di tempat anda berhenti.
- <!--i:box--> **Export my data & render everything** menulis sandaran yang sama itu *ditambah* satu zip kedua yang merender setiap sesi tersimpan kepada fail hasil siapnya, dalam folder yang mencerminkan Projek anda. Satu arkib luar talian yang lengkap bagi kedua-dua sumber dan hasil - dan ia boleh menjadi besar dan perlahan jika sesinya banyak.

![Dua butang yang memindahkan keseluruhan pemasangan: Export my data menulis satu zip, Import data membacanya semula](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.storage-subsection&dark=1&filename=pd-transfer-controls)

Bungkusan itu ialah fail zip yang ringkas dan berdikari sepenuhnya, jadi ia boleh dipindahkan dengan **apa-apa sahaja** cara - USB, AirDrop, perkongsian rangkaian, e-mel kepada diri sendiri - dan sasarannya boleh sepenuhnya luar talian. Setiap bahagian mempunyai checksum, jadi fail yang rosak semasa pemindahan akan dikesan semasa import dan bukannya dipulihkan dalam keadaan separa rosak. Import akan **menggabungkan** (profil/sesi/imej yang mempunyai nama sama akan ditulis ganti; selebihnya dikekalkan), jadi ia tidak akan sekali-kali memadamkan sasaran yang sudah digunakan.

Apa yang tidak turut dipindahkan: cache katalog (ia memuat turun semula sendiri pada peranti baharu) dan alat-alat itu sendiri (dianggap sudah tersedia).

Untuk susun atur bandel yang tepat, dasar versi dan peraturan integriti, lihat **[Data Transfer](/info/data-transfer.html)**; untuk panduan hujung ke hujung, **[Using Lolly → Moving to another device](/info/using.html#moving-to-another-device)**.

## Bagaimana alat menggunakan profil anda

![The single Use my details switch, sitting beside Save Profile and off until you turn it on](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-check&walker=1&dark=1&filename=pd-use-my-details)

Sesuatu alat hanya sekali-kali *pra-isi* medan profil yang direka khusus untuknya:

**Opt-in (asal-usul).** Apabila anda mengeksport aset, butiran anda secara pilihan turut disertakan sebagai **asal-usul (provenance)** - satu baris pengarang/kredit yang dibenamkan dalam metadata fail (PNG, PDF, SVG, …) - supaya aset siap boleh menyatakan siapa yang mencipta ia. *Inilah* yang dikawal oleh **Use my details to create**: biarkan ia dimatikan dan eksport masih membawa atribusi alat/platform "Made with Lolly", tetapi tiada baris pengarang/hubungan peribadi dibenamkan. (Opt-in yang sama menetapkan pengarang pada larian kelompok **/pro**.) (Pengarang alat: lihat [Authoring Tools → `bindToProfile`](/info/authoring-tools.html#bindtoprofile) dan [Host API → `host.profile`](/info/host-api.html#host-profile).)

![Suis tunggal Use my details to create, terletak di sebelah Save Profile dan mati sehingga anda menghidupkannya](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-check&walker=1&dark=1&filename=pd-use-my-details)

## Profil berbanding Platform berbanding Keupayaan

Tiga perkara ini terletak berdekatan antara satu sama lain dalam UI dan mudah dikelirukan:

- <!--i:people--> **Profil** - *anda* (atau pasukan anda, atau peranan yang anda pegang): nama, hubungan, gambar kepala, kerja anda yang disimpan. Peribadi, tempatan pada peranti, mudah alih sebagai satu bandel.
- <!--i:palette--> **Platform** - *jenama* itu: warna, fon dan tetapan global yang menjadi rujukan setiap alat semasa merender. Dikongsi dan konsisten, bukan peribadi.
- <!--i:sliders--> **Keupayaan** - *apa yang aplikasi boleh lakukan*: keseluruhan set ciri dan alat yang tersedia untuk anda.

Profil menentukan *daripada siapa* sesuatu aset itu; platform menentukan *rupa* sesuatu aset itu; keupayaan pula ialah *apa yang boleh anda hasilkan*.

### "Profil" membawa dua maksud lain di tempat lain - bukan profil ini

Perkataan ini digunakan secara bertindih di seluruh projek. Tiada satu pun daripada kedua-dua ini ialah profil peribadi yang dibincangkan dalam halaman ini:

- <!--i:box--> **Profil kandungan** - konfigurasi masa-bina dalam `profiles.json` yang mengikat satu set pek alat kepada katalog jenama (contohnya `suse`, `lolly-start`). Inilah yang dipilih oleh pengendali semasa menggunakan (deploy), dan inilah juga yang dipilih oleh **parameter URL/CLI** `profile` sebagai varian *warna* pada masa eksport (keadaan cetakan ICC/CMYK - lihat [URL Mode](/info/url-mode.html)). Kedua-duanya berkaitan *binaan/output*, bukan tentang *anda*. Lihat [Configuration](/info/configuration.html).
- <!--i:seal--> **Profil identiti** - **identiti Content Credentials yang disahkan** pilihan yang boleh anda daftarkan (sijil berjangka pendek yang mengikat e-mel anda kepada eksport bertandatangan anda). Itu adalah identiti penandatanganan, berasingan daripada medan nama/hubungan profil peribadi, walaupun **Use my details to create** mengawal sama ada mana-mana satu dibenamkan. Lihat [Content Credentials Identity](/info/content-credentials-identity.html).

![Kad identiti Verified, lebar telefon: pemilih tempoh sijil dan langkah pendaftaran di bawahnya - profil identiti, berasingan daripada butiran peribadi anda](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

## Privasi

Selain pendaftaran identiti pilihan di atas (yang menghantar e-mel yang anda daftarkan kepada perkhidmatan sijil - lihat [Server Surface](/info/server-surface.html)), profil tidak pernah dihantar, dimuat naik atau digunakan untuk mengenal pasti atau menjejaki anda - tiada apa-apa untuk dipersetujui, hanya notis ini supaya anda tahu apa yang disimpan. Padamkan semuanya pada bila-bila masa dengan **Profile → Clear all my data**. Lihat [Privacy Policy](/info/privacy.html).
