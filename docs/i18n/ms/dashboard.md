# Tetapan

Settings mengandungi butiran anda, sistem reka bentuk anda, kebolehcapaian, storan pada peranti ini dan muat turun luar talian. Buka **Settings** daripada bar di bahagian bawah skrin utama atau daripada menu avatar anda, dan ia dibuka pada **Preferences**.

| Tab | Alamat | Kandungannya |
|---|---|---|
| **Preferences** | `#/settings` | Butiran anda, sistem reka bentuk, rupa, emoji, kebolehcapaian, sambungan, storan dan muat turun luar talian |
| **This device** | `#/settings?tab=device` | Bacaan langsung pelayar dan mesin ini, serta bunyi dan paparan storan baca sahaja |
| **Design system** | `#/settings?tab=brand` | Sistem reka bentuk aktif sebagai kulit dan halaman, dengan jalur kulit untuk menukar sistem |
| **Capabilities** | `#/settings?tab=caps` | Semua yang boleh dilakukan Lolly, sebagai kad yang boleh dicari |
| **Activity & stats** | `#/settings?tab=activity` | Katalog, pembilang setempat anda dan kerja terkini |

Pautan lama `#/profile` dan `#/d` masih membuka tempat yang betul, termasuk tetapan individu.

<!--i:eti-sliders-->
## Keutamaan

Preferences ialah satu halaman panjang dengan **rel tetapan** di sepanjang sisi. Medan **Search settings** di atas rel menapis rel semasa anda menaip. Setiap bahagian mempunyai pautan berbentuk `#/settings?focus=<section-id>`, seperti `#/settings?focus=storage-section`.

- <!--i:usercheck--> **Your details** - nama, butiran hubungan dan foto wajah anda, serta suis **Use my details to create**. [Profil](/info/profile.html) menerangkan cara alat menggunakannya.
- <!--i:seal--> **Content Credentials** - identiti disahkan pilihan yang menandatangani eksport anda. Lihat [Content Credentials](/info/content-credentials-identity.html).
- <!--i:palette--> **Design systems** - tukar, tambah, sembunyikan atau buang sistem reka bentuk. [Persediaan Sistem Reka Bentuk Lolly](/info/brand-studio.html#manage-your-design-systems) meliputi setiap tindakan.
- <!--i:moon--> **Appearance** - tema (Light, Dark atau Brand, yang mewarnakan apl dengan palet anda), **Your colourway** apabila sistem reka bentuk menawarkan lebih daripada satu ([Jadikan colourway milik anda](/info/colourways.html#make-a-colourway-your-own)) dan **Interface follows the design system**.
- <!--i:sparkle--> **Emoji** - set emoji untuk kerja baharu, dengan lesen karya seninya, dan sekuat mana palet anda mewarnakan semula emoji (**Off**, **Subtle**, **Strong**, **Full**, **Mono** atau **Duotone**). **Keep skin tones and flags** mengekalkan warna asalnya. Kerja yang telah anda buat mengekalkan setnya.
- <!--i:eyeoff--> **Accessibility** - empat suis keselesaan, serta Sound dan Neurospicy Mode. Lihat [Kebolehcapaian](#accessibility).
- <!--i:link--> **Connected services** - storan yang anda hubungkan, seperti Dropbox, Google Drive, OneDrive, Nextcloud atau S3, serta **Sync across devices**. Lihat [Segerakkan peranti anda](/info/sync.html).
- <!--i:globe--> **Trusted sites** - laman yang boleh dihubungi oleh kotak halaman web Lolly Design atau demo Lolly Sandbox tanpa bertanya, dan, jika pelayan menawarkannya, **Allow pages from any site**. [Dasar Privasi](/info/privacy.html) menyenaraikan apa yang dihantar oleh setiap permintaan.
- <!--i:download--> **Your renders** - **Save my renders to my library** menyimpan salinan setiap imej, klip audio dan video yang anda muat turun dalam Assets, di bawah tag Renders.
- <!--i:database--> **Storage** - apa yang Lolly simpan pada peranti ini, dan butang yang mengosongkan atau membawa data anda. Lihat [Storan](#storage).
- <!--i:cpu--> **Available offline** - muat turun apa yang anda perlukan sebelum sambungan terputus. Lihat [Tersedia luar talian](#available-offline).
- <!--i:folder--> **Hot folder** - dalam apl desktop, Lolly memantau satu folder dan membawa masuk apa-apa yang diletakkan di situ, melalui pemilih yang sama seperti seret dan lepas.
- <!--i:clock--> **Your activity** - apa yang anda buat pada peranti ini, dikira secara setempat.
- <!--i:sliders--> **Feature flags** - hidupkan atau matikan bahagian apl, seperti **Print preflight** atau **Strip metadata from uploads**. **Performance UI** memberikan rupa yang lebih ringkas kepada apl yang memerlukan kurang sumber untuk dilukis. Lolly boleh menghidupkan Performance UI sendiri pada peranti perlahan. Baris di bawah suis kemudian menyatakan bila dan sebabnya, dengan **Allow again** ([cara keputusan dibuat](/info/configuration.html#curating-what-people-see)).
- <!--i:server--> **Lolly instance** - tempat pemasangan ini mendapatkan alat dan katalognya. Lihat [Instans Lolly](#lolly-instance).

Kad tema ialah pratonton langsung. Tema digunakan sebaik sahaja anda memilihnya, pada peranti ini sahaja.

![Tiga kad tema, setiap satu memaparkan pratonton tipografi dan warnanya sendiri, dengan tema aktif ditandakan](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dappearance-section&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

### Kebolehcapaian

**Settings → Preferences → Accessibility** mengandungi empat tetapan keselesaan untuk apl. Setiap satunya dimatikan sehingga anda menghidupkannya, dan tiada satu pun mempengaruhi bahagian dalam kanvas alat atau eksport, jadi apl yang lebih tenang tidak pernah mengalihkan satu piksel pun dalam fail yang anda hantar. Setiap satunya dimatikan secara lalai. Tiada satu pun mengubah kanvas alat atau eksport.

- <!--i:pause--> **Reduce motion** mematikan peralihan, gelongsoran dan hiasan gerakan apl.
- <!--i:photos--> **Hide colourful previews** menggantikan karya seni pratonton galeri dengan kad ikon dan teks serta meredamkan lakaran kecil projek, yang masih boleh dikenali.
- <!--i:sliders--> **High contrast** menegaskan sempadan, teks dan gelang fokus apl. Warna jenama dan kanvas anda kekal seperti yang anda tetapkan.
- <!--i:font--> **Large text** membesarkan label, menu dan teks butang apl.

**Dominant hand** (Right atau Left) menetapkan sisi yang menempatkan kawalan apabila Lolly menunjukkan dua anak tetingkap, pada peranti boleh lipat atau tablet yang hampir segi empat sama. **Swap sides** pada pengepala anak tetingkap turut mengubahnya.

Tetapan ini disimpan dalam profil anda, jadi ia dibawa dalam eksport profil bersama nama dan sesi anda. Salinan khusus peranti menggunakannya sebelum paparan pertama dilukis.

Kad yang sama mempunyai **Sound**, bunyi bantuan lembut untuk tindakan seperti tiba di galeri, hasil Content Credentials atau menutup panel. Ia juga mempunyai **Neurospicy Mode**, trek tenang untuk fokus. Menghidupkan Neurospicy membuka pemain kecil di sudut yang kekal bersama anda di seluruh apl. Dalam pemain, anda memilih trek, melangkau, menetapkan kelantangan dan meminimumkan atau menutup pemain. Trek termasuk stesen janaan Lolly, gelung dan rentak ambien, audio anda sendiri dan stesen radio internet, yang memerlukan sambungan. Kedua-duanya dimatikan secara lalai dan tetapannya diingati. Mematikan Sound turut membisukan trek fokus. Menu profil dan **This device** mempunyai suis yang sama.

Gelangsar di bawah suis Sound menetapkan unsur bunyi. Ke arah bentuk bulat **Bouba**, bunyi menjadi titisan lembut, gelembung dan sedikit bes. Ke arah bintang tajam **Kiki**, bunyi menjadi detikan kering, geseran dan logam. Bahagian tengah mengekalkan denting dan not Lolly. Jika bunyi di satu hujung sukar anda tahan, gerakkan ke arah hujung yang lain. Gelangsar berfungsi semasa Sound dimatikan, dan melepaskan gelangsar memainkan sampel pendek.

::: details Stesen janaan
Stesen janaan menggubah muzik semasa dimainkan, tanpa sampel dan tanpa suara rakaman. Setiap lagu mempunyai alat muzik, rentak dan urutan sendiri.

- **Lolly Sings** ialah keluarga stesen. Lolly Sings asal ceria dan bermelodi: nada major, melodi utama dalam setiap lagu, serta nuansa bossa, shuffle dan chiptune. Setiap genre juga mempunyai stesennya sendiri, daripada Sugar dan K-pop hingga Country, Jazz, Metal dan D&B.
- **Stesen Lofi** (Warm, Late night dan Rainy) memainkan rentak lo-fi tanpa henti.

Pada stesen janaan, kawalan seterusnya dan sebelumnya beralih antara lagu. Setiap lagu berasal daripada nilai benih, jadi lagu itu dimainkan dengan cara yang sama di mana-mana anda berkongsi atau menyimpannya (lihat [Muzik janaan](/info/generated-music.html)). Di bawah kawalan main balik, **Mood** menukar antara stesen Lofi, **Drums** mengeluarkan set dram dan **Texture** berubah daripada bersih kepada bunyi rekod berhabuk. Satu baris butang ikon menyusul. Halakan penuding atau tekan lama pada butang untuk melihat namanya:

- Not muzik, **Open in the music generator**, membuka lagu di `#/music`, tempat anda boleh mengubah alat muziknya mengikut bahagian.
- Pautan, **Share this tune or moment**, menawarkan pautan yang memainkan lagu yang sama, atau pautan yang turut bermula pada kedudukan semasa anda dan menunjukkan pemvisual dengan pratetap dan warna semasa anda.
- Folder, **Save to library**, menyimpan lagu dalam aset anda.
- Kilat, **Light visualiser**, ialah suis yang diterangkan di bawah.

Lagu tersimpan disenaraikan di bawah kumpulan stesennya, mengikut nada dan tempo. Memilih lagu tersimpan memainkan semula lagu yang sama, berulang seperti mana-mana trek atau beralih ke lagu seterusnya dalam mod maju. Ia hanya menyimpan stesen dan nombor lagu, beberapa bait sahaja, dan muzik digubah semula semasa dimainkan. Anda boleh menamakan semula atau memadamkan lagu tersimpan dalam aset anda, dan menggunakannya sebagai muzik latar video. Lolly Demo dan Lolly Start masing-masing disertakan dengan enam lagu tersimpan.

Pemvisual menerima setiap trek pada aras yang stabil, jadi trek perlahan menggerakkan gambar sama banyak dengan trek kuat, pada sebarang kelantangan. Setiap genre Lolly Sings, serta lagu tersimpan daripadanya, menawarkan **Light visualiser**: bar aras ringkas yang memberikan muzik masa pemprosesan yang diperlukan. Light visualiser dihidupkan pada mulanya untuk skrin sentuh dan peranti dengan empat teras atau kurang atau memori 4 GB atau kurang.
:::

Anda boleh menggunakan antara muka dengan papan kekunci. Kawalan tersuai mempunyai label untuk pembaca skrin. Pratonton langsung setiap alat ialah satu imej berlabel yang menerangkan apa yang ditunjukkannya.

### Storan

Meter storan menunjukkan setiap bait yang disimpan oleh pemasangan ini, mengikut kategori, berbanding apa yang dilaporkan pelayar.

![Meter storan, memperincikan sesi tersimpan, imej dan cache berbanding apa yang sebenarnya dilaporkan pelayar](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

Di bawah meter:

- **Move to another device** mempunyai **Export my data**, **Import data…** dan **Export my data & render everything**. [Pindahkan kerja anda ke peranti lain](/info/find-your-work.html#move-your-work-to-another-device) menerangkan setiap satunya.
- **Clear cache** membuang fail katalog yang dimuat turun, yang akan dimuat turun semula apabila diperlukan.
- **Remove automatic checkpoints older than 30 days** mengosongkan ruang History dan mengekalkan versi tersimpan dan bernama.
- **Clear all my data** membuang semua yang Lolly simpan dalam pelayar ini, selepas anda menaip perkataan untuk mengesahkan. [Jika anda mengosongkan data pelayar](/info/find-your-work.html#if-you-clear-your-browser-data) menyenaraikan apa yang dibuang.

### Tersedia luar talian

Lolly hanya menyimpan skrin yang telah anda lawati dalam cache. **Available offline** memuat turun bahagian yang anda perlukan, dengan satu bar kemajuan, dan bahagian itu terus berfungsi tanpa sambungan.

- <!--i:monitor--> **App, catalogue and guides** - **The app** (setiap paparan, penyunting dan fon, termasuk skrin yang belum pernah anda buka), **Catalogue** (semuanya, atau **Choose by tag**) dan **Guides & docs** (dokumentasi ini dalam bahasa anda, termasuk tangkapan skrin).
- <!--i:cpu--> **AI models** - setiap model pada peranti disenaraikan pada baris sendiri bersama saiznya: suara pertuturan, model peningkatan resolusi, pembuangan latar belakang, pengecaman teks, imbasan mendalam Lolly Verify, kelayakan tahan lama, model Rewriter, model pemadanan Ask, pengesan teks AI dan suara nyanyian. Model melebihi 50 MB ditandai **large download**.
- <!--i:wrench--> **Tools** - setiap alat dimuat turun secara berasingan, atau **Download all** memuat turun semua alat. Tanda semak bermaksud sedia untuk digunakan luar talian.

**Download everything** di bahagian atas memuat turun apl, skop katalog yang anda pilih, panduan dan semua alat. Tandakan **Include all the AI models** untuk menambah model, atau muat turun model daripada barisnya sendiri. Suara nyanyian hanya dimuat turun daripada barisnya sendiri. Dasar organisasi boleh mematikan muat turun AI, dan baris tersebut akan menunjukkan keadaan itu.

Muat turun disambung dari tempat ia terhenti jika anda membatalkan atau kehilangan sambungan. Apabila kembali dalam talian, muat turun disegarkan dan hanya mengambil apa yang diubah dalam keluaran. Jika pelayar belum memberikan kebenaran storan kekal, **Protect downloads** meminta kebenaran itu. Tanpa kebenaran itu, pelayar mungkin memadam muat turun apabila ia memerlukan semula ruang tersebut.

### Instans Lolly

**Lolly instance** menyatakan dari mana pemasangan ini mendapatkan alat dan katalognya: alamat instans, atau *Bundled with this app* apabila semuanya disertakan dalam binaan.

- **Design-system source** menunjukkan dari mana sistem reka bentuk yang dibekalkan berasal.
- **Instance console** membuka halaman pentadbir pengerahan, jika disediakan.
- **Change** menghalakan apl desktop ke instans lain. Pelayar tidak boleh memuatkan alat dan aset merentas asal, jadi di web bahagian ini menawarkan **Open a workspace**.
- **Leave** membuang sistem reka bentuk, alat dan katalog instans. Kerja anda sendiri kekal. Lihat [Gunakan Lolly di organisasi anda](/info/organisation.html#leaving).
- Apabila anda mendaftar masuk ke organisasi, **Sign out** menamatkan sesi ini dan **Sign out everywhere** menamatkan sesi anda pada setiap peranti, termasuk peranti ini.

<!--i:eti-monitor-->
## Peranti ini

- <!--i:monitor--> **This Machine** - skrin, input, grafik, memori, codec, backend storan dan banyak lagi, dibaca secara langsung daripada sesi ini. Tiada apa-apa disimpan atau dihantar. Pada skrin lebar, panel ini terbuka sendiri dan tab menggunakan dua lajur.
- <!--i:neurobeat--> **Sound** - bunyi antara muka dan gelung fokus Neurospicy. Sound ialah satu-satunya suis pada tab ini yang menulis apa-apa.
- <!--i:database--> **Storage** - paparan baca sahaja bagi meter. Kosongkan atau pindahkan data anda dalam [Keutamaan](#storage).

<!--i:eti-palette-->
## Sistem reka bentuk

Sistem reka bentuk aktif, disusun untuk dibaca. Apabila pelayar ini menyimpan dua atau lebih sistem reka bentuk, jalur muka depan di bahagian atas menyenaraikannya. Pilih satu untuk menjadikannya aktif. **Undo** dalam notis yang menyusul mengembalikan sistem sebelumnya.

![Tab Design system pada Lolly Demo: jalur muka depan untuk bertukar sistem, kemudian muka depan dengan logo, nama, nota dan kiraan yang membuka setiap halaman](/t/url-shot?url=%2F%23%2Fsettings%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=2400&format=svg&walker=1&dark=1&filename=settings-design-system)

Tab dibuka pada muka depan dalam warna sistem itu sendiri, dengan logonya, namanya dalam muka fon paparannya dan nota yang ditulis pengarangnya. Sebaris kiraan pada muka depan memaut ke setiap halaman:

- <!--i:palette--> **Colour** - permukaan, teks, warna utama dan sekunder untuk rupa cerah dan gelap, setiap warna bernama sebagai cip dengan nama dan heksnya, jalur untuk setiap jujukan tint dan spektrum carta, serta peranan warna dalam bahagian boleh lipat. Pilih nilai untuk menyalin heks.
- <!--i:font--> **Type** - Headings, Text, Emphasis dan Code, setiap satu dalam muka fonnya sendiri.
- <!--i:photos--> **Logos** - setiap fail logo pada latar yang dikhususkan untuknya.
- <!--i:layers--> **Colourways** - pasangan cerah dan gelap bagi setiap colourway, apabila sistem mempunyai lebih daripada satu.
- <!--i:sliders--> **Tokens** - jejari, jarak, kesan dan kecerunan.
- <!--i:document--> **Print & CMYK** - warna yang dikunci kepada dakwat tertentu, dan keadaan mesin cetak yang boleh diisytiharkan oleh PDF CMYK.

Bertukar sistem ialah satu-satunya perubahan yang dibuat oleh tab ini. Sunting sistem reka bentuk dalam [Lolly Design System Setup](/info/brand-studio.html) di `#/start`, yang dipautkan oleh muka depan. Sistem baca sahaja menyatakan hal itu pada muka depannya. Sistem setempat yang anda cipta kekal boleh disunting. `/b` dan `/brand` ialah pautan pendek ke tab ini.

<!--i:eti-grid-->
## Keupayaan

Setiap bahagian platform mempunyai kad, dalam dua belas kumpulan: Pengalaman, Platform & masa jalan, Kebolehcapaian & bahasa, Format eksport, Format import, Pengeluaran cetakan, Automasi & AI, Determinisme & kebolehulangan, Jenama & sistem reka bentuk, Privasi & pemilikan data, Keselamatan & kawalan akses dan Seni bina (untuk pembangun). Setiap kumpulan boleh dilipat dan menunjukkan bilangan kadnya. Kad membuka dialog dengan ciri keupayaan itu dan, untuk kira-kira separuh daripada kad, tangkapan skrin yang digunakan dalam dokumentasi ini.

Medan carian di atas kumpulan menapis kad semasa anda menaip dan membuka kumpulan yang mengandungi padanan. Medan itu menunjukkan berapa banyak keupayaan yang dicarinya. Pertanyaan tanpa padanan menyatakan hal itu dengan perkataan.

Tab ini mendokumenkan apa yang boleh dilakukan oleh Lolly, selaras dengan panduan ini. Ia tidak memeriksa mesin yang anda gunakan; **This device** melakukannya.

<!--i:eti-gauge-->
## Aktiviti & statistik

Mula-mula, binaan: bilangan alat yang dimuatkan, format eksport, persekitaran yang menjalankan platform dan aset jenama dalam katalog. Panel **Catalogue** memperincikan apa yang disertakan dalam binaan ini.

Kemudian kerja anda sendiri: **Your activity** mengira apa yang telah anda buat pada peranti ini. **Recent creations** dan **Latest exports** ialah tindanan yang boleh anda leret, ditunjukkan setelah ada kandungannya. Kedua-duanya membuka item dalam keadaan asalnya. Kiraan ini kekal pada peranti. Instans Lolly Work pilihan menyimpan [telemetri dan rekod audit organisasi](/info/privacy.html#organisation-services-with-lolly-work) sendiri.

<!--i:eti-link-->
## Pautan terus

Setiap tab dan bahagian Settings mempunyai pautan sendiri untuk ditandabuku atau ditampal. [Lolly Search](/info/search.html) membina hasil **Settings** daripada daftar yang sama dengan Settings, jadi penamaan semula bahagian tidak pernah merosakkan hasil carian.

::: details Setiap bentuk pautan

- **Tab:** `#/settings?tab=brand`, `#/settings?tab=caps`, `#/settings?tab=device`, `#/settings?tab=activity`.
- **Bahagian Preferences:** `#/settings?focus=<section-id>`, seperti `#/settings?focus=offline-section`.
- **Bahagian yang tepat:** idnya sebagai bendera tanpa nilai, seperti `#/settings?dash-storage`, `#/settings?dash-logos`, `#/settings?dash-colourways` atau `#/settings?cap-formats`. Pautan lama `#/settings?dash-lock` dan `#/settings?dash-palette-wheel` membuka muka depan dan halaman Colour.
- **Bahagian mengikut kata kunci:** `#/settings?print`, `#/settings?formats`, `#/settings?palette` (halaman Colour) atau `#/settings?tokens`. Dua bahagian boleh berkongsi kata kunci: `print` milik kedua-dua rujukan cetakan tab jenama dan kumpulan Pengeluaran cetakan, dan yang terdahulu dalam susunan halaman dipilih. Gunakan id untuk memilih satu.

Pautan terus beralih ke tab yang mengandungi sasaran dan membuka mana-mana kumpulan yang menyembunyikan sasaran dalam lipatannya. Kemudian ia menatal ke sasaran setelah bahagian di atas selesai disusun. Alamat `#/platform` dan `#/capabilities` yang telah dihentikan dibuka dalam Settings dengan bendera pautan terusnya kekal.
:::

---

**Berkaitan:** [Profil](/info/profile.html) untuk butiran anda dan konteks tempat anda berkarya. [Lolly Design System Setup](/info/brand-studio.html) untuk menyunting apa yang ditunjukkan tab Design system. [Cari dan pulihkan kerja anda](/info/find-your-work.html) untuk storan, sandaran dan pemindahan peranti.
