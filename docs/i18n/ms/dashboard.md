# Settings

Settings ialah tempat anda mengubah cara Lolly berfungsi untuk anda: butiran anda, sistem reka bentuk yang anda gunakan, kebolehcapaian, apa yang disimpan pada peranti ini dan apa yang sedia luar talian. Bukanya dengan **Settings** dalam bar di kaki skrin utama, atau daripada menu avatar anda. Ia dibuka pada **Preferences**, dengan empat tab lagi di sebelahnya.

| Tab | Alamat | Apa yang dipegangnya |
|---|---|---|
| **Preferences** | `#/settings` | Butiran anda, sistem reka bentuk, penampilan, emoji, kebolehcapaian, sambungan, storan dan muat turun luar talian |
| **This device** | `#/settings?tab=device` | Bacaan langsung pelayar dan mesin ini, serta bunyi dan paparan storan baca sahaja |
| **Design system** | `#/settings?tab=brand` | Sistem reka bentuk aktif sebagai kulit dan halaman, dengan jalur kulit untuk menukar sistem |
| **Capabilities** | `#/settings?tab=caps` | Segala yang boleh dilakukan Lolly, sebagai kad yang boleh dicari |
| **Activity & stats** | `#/settings?tab=activity` | Katalog, pembilang setempat anda dan kerja terkini |

Setiap tab mempunyai alamatnya sendiri, dan pautan lama `#/profile` dan `#/d` masih membuka tempat yang betul, hingga ke tetapan individu.

## Preferences

Preferences ialah satu halaman panjang dengan **rel tetapan** di sisi dan medan **Search settings** di atas rel yang menapisnya semasa anda menaip. Setiap bahagian dibuka terus daripada pautan berbentuk `#/settings?focus=<section-id>`, contohnya `#/settings?focus=storage-section`.

- <!--i:usercheck--> **Your details** - nama, butiran hubungan dan gambar kepala anda, dan suis **Use my details to create**. [Profiles](/info/profile.html) menerangkan cara alat menggunakannya.
- <!--i:seal--> **Content Credentials** - identiti disahkan pilihan yang menandatangani eksport anda. Lihat [Content Credentials](/info/content-credentials-identity.html).
- <!--i:palette--> **Design systems** - tukar, tambah, sembunyi atau buang sistem reka bentuk. [Design System Setup](/info/brand-studio.html#manage-your-design-systems) meliputi setiap tindakan.
- <!--i:moon--> **Appearance** - tema (Light, Dark atau Brand, yang mengecat apl dalam palet anda) dan **Interface follows the design system**.
- <!--i:sparkle--> **Emoji** - set tempat emoji anda dilukis apabila anda memulakan sesuatu yang baharu, dengan lesen karyanya, dan sekuat mana palet anda mewarnakannya semula (**Off**, **Subtle**, **Strong**, **Full**, **Mono** atau **Duotone**). **Keep skin tones and flags** membiarkan itu dalam warnanya sendiri. Kerja yang sudah anda buat mengekalkan set yang digunakan untuk membuatnya.
- <!--i:eyeoff--> **Accessibility** - empat suis keselesaan, serta Sound dan Neurospicy Mode. Lihat [Accessibility](#accessibility).
- <!--i:link--> **Connected services** - storan yang anda sambungkan, seperti Dropbox, Google Drive, OneDrive, Nextcloud atau S3, dan **Sync across devices**. Lihat [Sync your devices](/info/sync.html).
- <!--i:globe--> **Trusted sites** - tapak yang boleh dihubungi kotak halaman web Design atau demo Sandbox tanpa bertanya, dan, di mana pelayan menawarkannya, **Allow pages from any site**. [Privacy Policy](/info/privacy.html) menyenaraikan apa yang dihantar setiap permintaan.
- <!--i:download--> **Your renders** - **Save my renders to my library** menyimpan salinan setiap imej, klip audio dan video yang anda muat turun dalam Assets, di bawah teg Renders.
- <!--i:database--> **Storage** - apa yang disimpan Lolly pada peranti ini, dan butang yang mengosongkan atau membawa data anda. Lihat [Storage](#storage).
- <!--i:cpu--> **Available offline** - muat turun apa yang anda perlukan sebelum kehilangan sambungan. Lihat [Available offline](#available-offline).
- <!--i:folder--> **Hot folder** - dalam apl desktop, pantau satu folder dan tarik apa-apa yang diletakkan di dalamnya ke dalam Lolly, melalui pemilih yang sama seperti seret dan lepas.
- <!--i:clock--> **Your activity** - apa yang telah anda buat pada peranti ini, dikira secara setempat.
- <!--i:sliders--> **Feature flags** - hidupkan atau matikan bahagian apl, seperti **Print preflight** atau **Strip metadata from uploads**.
- <!--i:server--> **Lolly instance** - dari mana pemasangan ini mendapat alat dan katalognya. Lihat [Lolly instance](#lolly-instance).

Kad tema ialah pratonton langsung dan digunakan sebaik sahaja anda memilih satu, pada peranti ini sahaja.

![Three theme cards, each previewing its own type and colour, with the active one flagged](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dappearance-section&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

### Accessibility

**Settings → Preferences → Accessibility** memegang empat tetapan keselesaan untuk apl di sekeliling kerja anda. Setiap satu mati sehingga anda menghidupkannya, dan tiada satu pun sampai ke dalam kanvas alat atau eksport, jadi apl yang lebih tenang tidak pernah menggerakkan satu piksel fail yang anda hantar.

- <!--i:pause--> **Reduce motion** mematikan peralihan, luncuran dan hiasan apl. Kanvas anda dan sebarang eksport beranimasi terus bergerak seperti yang direka.
- <!--i:photos--> **Hide colourful previews** menukar karya pratonton galeri dengan kad ikon-dan-teks yang tenang, dan menenangkan lakaran kecil projek supaya ia kekal dikenali tanpa menjerit.
- <!--i:sliders--> **High contrast** menguatkan sempadan, teks dan gelang fokus apl. Warna jenama anda dan kanvas kekal seperti yang anda tetapkan.
- <!--i:font--> **Large text** membesarkan label, menu dan teks butang apl. Tipografi dalam reka bentuk anda tidak disentuh, jadi tiada apa-apa yang anda eksport mengalir semula.

Tetapan ini berada pada profil anda, jadi ia dibawa dalam eksport profil dan tiba pada pemasangan seterusnya bersama nama dan sesi anda. Salinan kecil khusus peranti menggunakannya sebelum lukisan pertama.

Kad yang sama memegang **Sound**, lapisan lembut bunyi bantuan untuk apa yang anda lakukan (tiba dalam galeri, hasil Content Credentials, menutup panel), dan **Neurospicy Mode**, trek fokus yang tenang. Menghidupkan Neurospicy membuka pemain kecil di sudut yang mengikut anda merentasi apl. Di situ anda memilih trek, langkau, tetapkan kelantangan dan minimumkan atau tutup pemain. Trek termasuk lagu prosedur *Lolly Sings*, gelung ambien dan rentak, audio anda sendiri dan stesen radio internet, yang memerlukan sambungan. Kedua-duanya mati secara lalai dan diingati, dan mematikan Sound turut membisukan trek fokus. Menu profil dan **This device** membawa suis yang sama.

Antara muka boleh dilayari dengan papan kekunci, kawalan tersuai membawa label untuk pembaca skrin dan pratonton langsung setiap alat didedahkan sebagai satu imej berlabel yang menerangkan apa yang ditunjukkannya.

### Storage

Meter storan mengambil kira setiap bait yang dipegang pemasangan ini, kategori demi kategori, berbanding apa yang dilaporkan pelayar.

![Meter storan, memecahkan sesi tersimpan, imej dan cache berbanding apa yang sebenarnya dilaporkan pelayar](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

Di bawah meter:

- **Move to another device** mempunyai **Export my data**, **Import data…** dan **Export my data & render everything**. [Move your work to another device](/info/find-your-work.html#move-your-work-to-another-device) menelusurinya.
- **Clear cache** menggugurkan fail katalog yang dimuat turun, yang dimuat turun semula apabila perlu.
- **Remove automatic checkpoints older than 30 days** membebaskan ruang History dan mengekalkan versi tersimpan dan bernama.
- **Clear all my data** membuang segala yang disimpan Lolly dalam pelayar ini, selepas anda menaip perkataan untuk mengesahkan. [If you clear your browser data](/info/find-your-work.html#if-you-clear-your-browser-data) menyenaraikan apa yang hilang.

### Available offline

Lolly mencache skrin semasa anda melawatinya, yang hanya meliputi tempat yang sudah anda pergi. **Available offline** adalah untuk perjalanan yang anda nampak akan datang: muat turun bahagian yang anda perlukan dan perhatikan satu bar kemajuan, dan segala yang anda ambil terus berfungsi tanpa sambungan.

- <!--i:monitor--> **App, catalogue and guides** - **The app** (setiap paparan, penyunting dan fon, termasuk skrin yang tidak pernah anda buka), **Catalogue** (semuanya, atau **Choose by tag**) dan **Guides & docs** (dokumentasi ini dalam bahasa anda, termasuk tangkapan skrin).
- <!--i:cpu--> **AI models** - setiap model pada peranti pada barisnya sendiri dengan saiznya: Speech voices, Upscaling models, Background removal, Text recognition, Verify deep scan, Durable credential, Rewriter model, Ask matching model, AI text detector dan Singing voices. Model melebihi 50 MB ditandakan **large download**.
- <!--i:wrench--> **Tools** - setiap alat dimuat turun sendiri, atau **Download all** mengambil setiap alat. Tanda semak bermakna sedia luar talian.

**Download everything** di bahagian atas mengambil apl, skop katalog yang anda pilih, panduan dan semua alat. Tanda **Include all the AI models** untuk menambah model, atau muat turun model pada barisnya sendiri; suara nyanyian hanya dimuat turun daripada barisnya sendiri. Dasar organisasi boleh mematikan muat turun AI, dan baris kemudian memberitahu anda.

Muat turun disambung semula di mana ia berhenti jika anda membatalkan atau kehilangan sambungan, dan menyegarkan diri apabila anda kembali dalam talian, hanya mengambil apa yang diubah keluaran. Jika pelayar belum memberikan storan berterusan, **Protect downloads** memintanya: perbezaan antara "dimuat turun" dan "dimuat turun sehingga pelayar mahu ruang itu semula".

### Lolly instance

**Lolly instance** menyatakan dari mana pemasangan ini mendapat alat dan katalognya: alamat instans, atau *Bundled with this app* apabila segala-galanya dihantar di dalam binaan.

- **Design-system source** menunjukkan dari mana sistem reka bentuk yang dibekalkan datang.
- **Instance console** membuka halaman pentadbir penempatan, di mana ia menawarkannya.
- **Change** mengarahkan apl desktop ke instans lain. Pelayar tidak boleh memuatkan alat dan aset merentasi asal, jadi pada web bahagian itu menawarkan **Open a workspace** sebaliknya.
- **Leave** membuang sistem reka bentuk, alat dan katalog instans, dan kerja anda sendiri kekal. Lihat [Use Lolly at your organisation](/info/organisation.html#leaving).
- Apabila anda log masuk ke organisasi, **Sign out** menamatkan sesi ini dan **Sign out everywhere** menamatkan sesi anda pada setiap peranti, termasuk yang ini.

## This device

- <!--i:monitor--> **This Machine** - skrin, input, grafik, memori, kodek, bahagian belakang storan dan lain-lain, dibaca secara langsung daripada sesi ini. Tiada apa-apa disimpan dan tiada apa-apa dihantar. Ia dibuka sendiri pada skrin lebar, di mana tab disusun dalam dua lajur.
- <!--i:neurobeat--> **Sound** - bunyi antara muka dan gelung fokus Neurospicy, satu-satunya suis pada tab ini yang menulis apa-apa.
- <!--i:database--> **Storage** - paparan baca sahaja meter dalam [Preferences](#storage), iaitu tempat anda mengosongkan atau membawa data anda.

## Design system

Sistem reka bentuk aktif, disusun untuk dibaca. Apabila pelayar ini memegang dua atau lebih sistem reka bentuk, jalur kulit kecil di bahagian atas menyenaraikannya: pilih satu untuk menjadikannya aktif, dan **Undo** dalam notis yang mengikuti mengembalikan yang sebelumnya.

![Tab Design system pada Lolly Demo: jalur kulit untuk menukar sistem, kemudian kulit dengan logo, nama, nota dan kiraan yang membuka setiap halaman](/t/url-shot?url=%2F%23%2Fsettings%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=2400&format=svg&walker=1&dark=1&filename=settings-design-system)

Tab dibuka pada kulit yang dicat dalam warna sistem itu sendiri, dengan logonya, namanya dalam muka paparannya dan nota yang ditulis pengarangnya. Baris kiraan pada kulit memaut ke setiap halaman:

- <!--i:palette--> **Colour** - permukaan, teks, utama dan sekunder rupa cerah dan gelap, setiap warna bernama sebagai cip dengan nama dan hex, jalur untuk setiap ramp warna dan spektrum carta, serta peranan warna dalam lipatan. Pilih nilai untuk menyalin hex.
- <!--i:font--> **Type** - Headings, Text, Emphasis dan Code, masing-masing ditetapkan dalam mukanya sendiri.
- <!--i:photos--> **Logos** - setiap fail logo pada latar tempat ia dibuat.
- <!--i:layers--> **Colourways** - pasangan cerah dan gelap setiap colourway, apabila sistem mempunyai lebih daripada satu.
- <!--i:sliders--> **Tokens** - jejari, jarak, kesan dan kecerunan.
- <!--i:document--> **Print & CMYK** - warna yang dikunci kepada dakwat tepat, dan keadaan mesin cetak yang boleh diisytiharkan PDF CMYK.

Menukar ialah satu-satunya perubahan yang dibuat tab ini. Anda menyunting sistem reka bentuk dalam [Design System Setup](/info/brand-studio.html) di `#/start`, yang dipaut oleh kulit. Sistem baca sahaja menyatakannya pada kulit; sistem setempat yang anda cipta kekal boleh sunting. `/b` dan `/brand` ialah pautan pintas terus ke tab ini.

## Capabilities

Setiap bahagian platform ditulis sebagai kad, dalam dua belas kumpulan: Experiences, Platforms & runtimes, Accessibility & languages, Export formats, Import formats, Print production, Automation & AI, Determinism & reproducibility, Brand & design system, Privacy & data ownership, Security & access control dan Architecture (for builders). Setiap kumpulan terlipat dan menunjukkan kiraan kadnya. Kad dibuka menjadi dialog dengan ciri keupayaan itu dan, bagi kira-kira separuh daripadanya, tangkapan skrin yang digunakan dokumentasi ini.

Medan carian di atas kumpulan menapis kad semasa anda menaip dan membuka mana-mana kumpulan yang masih memegang padanan. Ia menyatakan berapa banyak keupayaan yang dicarinya, dan pertanyaan tanpa padanan menyatakannya dengan perkataan.

Tab ini ialah dokumentasi bertulis tentang apa yang boleh dilakukan Lolly, dikekalkan seiring dengan panduan ini. Ia tidak menyiasat mesin yang anda gunakan; **This device** melakukannya.

## Activity & stats

Binaan dahulu: berapa banyak alat dimuatkan, berapa banyak format eksport wujud, berapa banyak permukaan yang dijalankan platform dan berapa banyak aset jenama yang dibawa katalog, dengan panel **Catalogue** yang memecahkan apa yang dihantar dalam binaan ini.

Kemudian sisi anda sendiri: **Your activity** mengira apa yang telah anda buat pada peranti ini, dan **Recent creations** serta **Latest exports** ialah timbunan yang boleh anda leret, masing-masing muncul sebaik ada sesuatu untuk ditunjukkan. Kedua-duanya membuka item seperti asalnya. Pembilang ini kekal pada peranti; instans Lolly Work pilihan menyimpan [telemetri organisasi dan rekod audit](/info/privacy.html#organisation-services-with-lolly-work) sendiri.

## Pautan dalam

Setiap tab dan bahagian Settings mempunyai pautannya sendiri, yang boleh anda tanda buku atau tampal. [Search](/info/search.html) menunjuk hasil **Settings**-nya kepada daftar yang sama yang dirender Settings, supaya bahagian tidak boleh dinamakan semula tanpa diketahui hasil carian.

::: details Setiap bentuk pautan

- **Tab:** `#/settings?tab=brand`, `#/settings?tab=caps`, `#/settings?tab=device`, `#/settings?tab=activity`.
- **Bahagian Preferences:** `#/settings?focus=<section-id>`, seperti `#/settings?focus=offline-section`.
- **Bahagian, tepat:** id-nya sebagai bendera kosong, seperti `#/settings?dash-storage`, `#/settings?dash-logos`, `#/settings?dash-colourways` atau `#/settings?cap-formats`. Pautan lama `#/settings?dash-lock` dan `#/settings?dash-palette-wheel` membuka kulit dan halaman Colour.
- **Bahagian mengikut kata kunci:** `#/settings?print`, `#/settings?formats`, `#/settings?palette` (halaman Colour) atau `#/settings?tokens`. Kata kunci boleh dikongsi: `print` milik kedua-dua rujukan cetakan tab jenama dan kumpulan Print production, dan yang pertama dalam susunan halaman menang. Gunakan id apabila penting yang mana satu.

Pautan dalam bertukar ke tab yang memiliki sasaran, membuka mana-mana kumpulan tempat ia terlipat, kemudian menatal ke sana, berehat seketika semasa bahagian di atasnya selesai disusun. Alamat `#/platform` dan `#/capabilities` yang telah dihentikan dilipat ke dalam Settings dengan bendera pautan dalamnya utuh.
:::

---

**Berkaitan:** [Profiles](/info/profile.html) untuk butiran anda dan konteks tempat anda mencipta. [Design System Setup](/info/brand-studio.html) untuk menyunting apa yang ditunjukkan tab Design system. [Find and recover your work](/info/find-your-work.html) untuk storan, sandaran dan berpindah peranti.
