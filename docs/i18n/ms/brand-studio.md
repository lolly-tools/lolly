# Lolly Design System Setup

<a id="design-system-setup"></a>

**Lolly Design System Setup**, di `#/start`, mengandungi logo, warna dan muka taip anda. Setiap alat, halaman dan eksport melukis dengannya.

Lepaskan logo dan Lolly membaca warnanya. Pilih muka taip, atau lepaskan fail fon yang dilesenkan oleh syarikat anda. Setiap perubahan ditunjukkan di seluruh apl serta-merta. Logo, fon dan token anda kekal pada peranti ini. Hanya pemilihan Google Font membuat sambungan luar: Lolly bertanya dahulu, kemudian mengambil keluarga fon itu sekali.

Namakan sistem reka bentuk dan tekan **Export** untuk mendapatkan satu fail `.lolly`. Simpan fail, buka pada peranti lain atau serahkan kepada rakan sekerja. [Tetapan Lolly](/info/dashboard.html#design-system) menunjukkan sistem aktif sebagai baca sahaja; muka depannya memaut kembali ke sini untuk penyuntingan.

<!--i:eti-clock-->
## Jadikannya milik anda dalam lima minit

::: timeline
- <!--i:upload--> **Lepaskan logo anda** pada zon lepas dalam **Logos**. Lolly membaca bentuk dan warnanya.
- <!--i:palette--> **Gunakan warna ini.** Warna utama logo menjadi warna utama anda, dan warna neutral gelap daripada logo menjadi warna teks anda.
- <!--i:font--> **Pilih muka fon** dalam **Type**: Google Font, atau fail fon milik anda.
- <!--i:pentool--> **Namakan sistem.** Suntingan pertama anda menghasilkan sistem reka bentuk milik anda sendiri, dan Lolly meminta namanya sekali.
- <!--i:download--> **Export** menulis seluruh sistem sebagai satu fail `LollyBrand-….lolly`.
:::

Bar di bahagian atas studio menunjukkan nama sistem reka bentuk sebagai medan boleh sunting. **Enter** mengekalkan nama baharu dan **Escape** mengembalikan nama lama. Apabila suntingan pertama anda bertanya **What is this design system called?**, Lolly mengisi perkataan daripada logo anda, jika logo itu memaparkannya. **Save name** mengekalkan nama; **Not now** mengekalkan teks pemegang tempat sehingga anda menaip nama dalam bar. Nama itu melabelkan sistem dalam Settings dan semasa anda bertukar, dan menjadi nama fail yang ditulis oleh **Export**.

<!--i:eti-grid-->
## Ruang

Studio ialah sekumpulan ruang tanpa susunan tetap. Tiada ruang yang bergantung pada ruang lain. Pada desktop, ruang disusun dalam satu jalur di bawah bar. Pada telefon, ruang berpindah ke bar di sepanjang tepi bawah, dengan ruang yang terbuka ditatal ke paparan. Helaian palet dan dulang muncul di atas bar itu, dan bar beralih ke tepi semasa anda menaip. Dengan papan kekunci, Tab mencapai jalur itu sekali, dan kekunci anak panah, Home dan End bergerak antara ruang.

![Bar studio dan ruangnya: Board, Colours, Type, Logos, Tokens, Files, Sound, Rules dan Skills](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-top&waitSelector=.ds-room-nav&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

| Ruang | Apa yang anda lakukan di situ | Kunci pautan |
|---|---|---|
| **Board** | Lihat kandungan sistem, dengan laluan masuk ke setiap ruang | `overview` |
| **Colours** | Tambah warna, berikan peranan kepadanya, bina rona dan palet | `color` |
| **Type** | Pilih empat muka fon yang dibaca oleh apl, alat dan setiap eksport | `type` |
| **Logos** | Letakkan tanda jenama anda dalam setiap orientasi dan olahan | `logos` |
| **Tokens** | Sudut, jarak, bayang dan setiap nilai bernama yang lain | `tokens` |
| **Files** | Fail imej, audio dan gerakan yang disimpan oleh jenama anda | `catalogue` |
| **Sound** | Bentuk identiti bunyi, muzik untuk kegunaan berbeza dan hubungannya dengan suara | `sound` |
| **Rules** | Peraturan yang diterapkan oleh jenama anda, disemak pada contoh sebenar | `usage` |
| **Skills** | Piawaian bertulis jenama untuk manusia dan ejen, untuk dibaca dan dimuat turun | `skills` |

Pautkan ke ruang dengan `#/start?area=<key>`. Kunci ruang adalah kekal, jadi Files mengekalkan `catalogue`, Board mengekalkan `overview` dan Rules mengekalkan `usage`. `?tab=` masih berfungsi sebagai alias lama. Kunci yang tidak dikenali membuka Board.

**Bar** mengandungi tindakan untuk seluruh sistem. **Add from…** membawa masuk jenama ([Bawa masuk jenama](#bring-a-brand-in)). **Tray** menyimpan apa yang ditemui imbasan yang belum anda tambah. **Export** menulis sistem sebagai satu fail. **More** mengandungi **Tokens (.json)**, **Fonts for Linux (.rpm)**, **Versions & publishing**, **Restore brand settings** dan **Design systems**, yang membuka senarai dalam Settings tempat anda bertukar sistem ([Simpan dan pindahkan sistem reka bentuk anda](#keep-and-move-your-design-system)). Setiap tindakan muncul setelah ada sesuatu untuk ditindaklanjuti. Pada telefon, **Add from…** berpindah ke **More** dan **Export** ditunjukkan sebagai ikonnya.

Selagi sistem reka bentuk ialah sistem yang disertakan dengan apl, bar bermula dengan **Make it yours**, menu yang mengandungi **Find a look**, **Add from…** dan **Pick a colour**. Setelah sistem menjadi milik anda, **Export** mengambil tempat itu semula.

<!--i:eti-clipboard-->
## Papan

Apabila belum ada apa-apa dipilih, Board menawarkan empat cara untuk bermula. **Start from a reference** membuka pemilih sumber untuk logo, tangkapan skrin, halaman web atau fail reka bentuk. **Pick a colour**, **Choose a face** dan **Add a logo** membuka kawalan tersebut. Membuka salah satunya tidak menulis apa-apa. Di bawahnya, **Find a look** menawarkan warna dan muka taip siap sedia untuk dicuba, dan **Explore the tools** tersedia dari awal.

Setelah apa-apa menjadi milik anda, Board menunjukkan apa yang anda ada, dengan kiraan milik anda didahulukan. Colours memberikan bilangan warna, dengan `· N starter` yang dipudarkan untuk warna yang diwarisi. Jalurnya menunjukkan warna anda, kemudian garis halus, kemudian warna asas yang dipudarkan. Colourways menunjukkan setiap colourway sebagai jubin kecil dalam warna utamanya. Type menyenaraikan setiap peranan dan memaparkan setiap keluarga fon dalam muka fonnya sendiri (*Inter untuk tajuk*, dengan *Starter untuk yang selebihnya* pada baris di bawah). Logos menyatakan bilangan slot yang diisi (atau **Not set**), Tokens menunjukkan jejari sudut dan Files menyatakan **Nothing yet** selagi pustaka kosong. Setiap blok membuka ruangnya.

Sistem reka bentuk boleh sunting yang disertakan dengan apl, seperti Lolly Demo, menunjukkan warna, colourway, muka fon dan tanda jenamanya pada Board dari awal, dengan tag **Came with this app** di sebelah tajuk. Di atasnya, **Start here** menawarkan **Find a look**, **Add from…** dan **Pick a colour**.

### Asas dan milik anda

Dalam setiap ruang, **Starter** menandakan apa-apa yang disertakan dengan apl dan belum dipilih oleh sesiapa. Pemasangan baharu tidak membawa warna, hanya satu jujukan neutral daripada dakwat ke kertas, supaya permukaan, teks dan garis halus boleh dirender sebelum sesiapa memilih.

::: cols
## Asas

- Disertakan dengan apl: warna neutral daripada dakwat ke kertas, muka fon asas, jejari sudut lalai.
- Dipudarkan, dengan tag **Starter** dan tanpa tint.
- Tidak dikira sebagai warna anda. Warna neutral berada dalam **Tokens** sebagai **Neutrals · starter · 9**, dan **Open** menunjukkannya dalam Colours sebagai satu kumpulan berlipat (`#/start?area=color&group=neutral`).
- Peranan yang menggunakan warna asas memaparkan *"Starter Paper digunakan sebagai ganti"*, dengan **Choose…** pada pemilihnya.

## Milik anda

- Dipilih atau dipasang oleh anda.
- Keamatan penuh, dan kad bertint di tempat anda memasang muka fon.
- Dikira pada Board dan dalam Tokens.
- Peranan yang mengikut peranan lain memaparkan **↳ follows Primary**.
:::

Bahan yang diwarisi tidak pernah mempunyai sempadan bergaris putus-putus. Sempadan bergaris putus-putus menandakan sasaran lepas.

<!--i:eti-shapes-->
## Logo

Zon lepas di bahagian atas, **"Drop marks here, or choose several at once"**, menerima seberapa banyak fail yang anda ada. Lolly membaca setiap fail untuk bentuk dan dakwatnya. Fail kemudian menunggu di bawah **Waiting for a slot** sebagai cip yang menyatakan rupanya, seperti *"Kelihatan seperti Horizontal primary"*, dengan ukuran yang digunakannya dan butang **Place** (**Replace** jika slot sudah diisi). Apabila Lolly tidak pasti, cip menyatakannya dan menawarkan **Change slot**, dengan menyenaraikan kesemua lapan slot. Tiada apa-apa diletakkan sehingga anda menekan butang.

Tanda jenama dengan ruang kosong berlebihan di sekelilingnya mendapat tawaran pemangkasan dahulu. Jawab tawaran itu, atau tekan Escape untuk meletakkan yang asal tanpa perubahan. Apabila tanda jenama boleh mengisi slot berkaitan yang kosong, ruang menawarkan versi **mono** atau **reverse** yang terhasil sebagai cip bertanda *Generated*.

Setiap tanda jenama diletakkan dalam grid lapan slot pilihan, satu bagi setiap **orientasi** dan **olahan**:

- **Orientasi:** Horizontal (logotaip dan simbol dalam sebaris) dan Vertical (bertindan, untuk ruang segi empat sama dan tinggi).
- **Olahan:** Primary, Primary reverse (untuk latar belakang gelap), Mono (satu warna) dan Mono reverse.

Kumpulan tanpa tanda jenama dilipat menjadi satu baris; buka kumpulan untuk melihat slotnya. Klik slot untuk menambah PNG, SVG, JPEG atau WebP, atau klik slot yang diisi untuk menggantikan tanda jenama. Slot kosong juga menerima fail yang dilepaskan. Tanda jenama mendatar berada dalam jubin lebar dan yang menegak dalam segi empat sama, setiap satu pada permukaan yang dikhususkan untuknya, dengan ruang kosong sebesar suku daripada tingginya. Segala-galanya kekal pada peranti ini.

![Slot logo dengan Horizontal dan Vertical dibuka: setiap olahan mempunyai slot sendiri, dan setiap slot adalah pilihan](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&system=new-design-system&width=1440&height=1600&dpi=192&waitMs=1600&drive=click%3A.be-logo-identity%3Edetails.be-logo-group--fold%3Anot%28.be-logo-group--custom%29%3Esummary%3Bwait%3A600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Custom marks** ialah tanda jenama yang dipanggil dengan nama tersendiri oleh jenama anda, seperti ikon, lambang atau favicon.
- **Lebih banyak identiti.** Subjenama, produk atau acara boleh mempunyai set lengkapnya sendiri: tekan **+ Add another logo** dan namakan set itu. Set utama anda ialah "Your logo". [Seni bina jenama](/info/brand-architectures.html) menunjukkan bila perlu menggunakan identiti logo.
- **Lolly membaca warna logo.** Kad di bawah zon lepas, dan di bahagian atas Colours, menyenaraikan warna logo dan bertanya **Which is the main colour?**. Warna paling dominan dipilih, bukan warna putih latar semasa logo dieksport. **Use these colours** menambahkannya ke palet anda dan menjadikan warna utama logo sebagai warna utama anda. Apabila logo mempunyai warna neutral gelap yang jelas pada kertas, warna neutral itu menjadi warna teks. **Not now** membiarkannya dalam Tray. Pada pemasangan baharu, Lolly terus menerapkan jawapan yang paling berkemungkinan, dan kad menawarkan **Undo** atau warna utama lain. SVG memberikan warna tepat; PNG, JPEG atau WebP memberikan warna yang meliputi bahagian ketara tanda jenama.

<!--i:eti-palette-->
## Warna

Ruang berkembang bersama sistem reka bentuk. Lawatan pertama meminta satu keputusan; lebih banyak kawalan muncul apabila palet berkembang.

### Warna pertama

Sistem tanpa warna sendiri menunjukkan warna neutral asas dalam kumpulannya sendiri yang terbuka. Di bahagian atas ruang terdapat medan tampal dan lepas bergaris putus-putus: satu cip besar dan satu medan. Lepaskan imej atau senarai warna di mana-mana pada medan, dan Lolly membaca warnanya.

- **Cip itu ialah pemilih.** **Pick a colour** membuka kad OKLCH studio, dengan kandungan medan sebagai nilai awal. Kad menunjukkan nama warna dan heksnya dahulu. Ruang warna, roda, empat dail dan alfa berada di bawah **Fine-tune**, dan **Cancel** serta **Add colour** berada di bahagian bawah. Tiada apa-apa masuk ke sistem sehingga anda menekan **Add colour**.
- **Medan menerima apa-apa notasi**: `#e0452b`, `rgb(224 69 43)`, `oklch(58% .19 32)` atau nama warna. Senarai yang ditampal menjadi sebaris cip untuk ditambah satu demi satu atau dengan **Add all**.
- **Dua lagi cara.** **Pick a colour from the screen** menggunakan penitis jika pelayar menyediakannya, dan **Take colours from an image** membaca tangkapan skrin atau foto pada peranti ini.
- **Add tidak pernah dinyahdayakan.** Apabila medan kosong, ia membuka pemilih; teks yang tidak dapat dibacanya mendapat sebaris mesej di bawah medan yang menyatakan hal itu.

Warna pertama anda menjadi warna **utama**. Cip mengesahkan perubahan, seperti *"Primary kini Vivid Violet"*, dengan **Fine-tune** untuk melaraskan warna.


### Apabila palet berkembang

Warna anda berada di sebelah pratonton **In context** pada skrin lebar, dan di atas pratonton pada skrin lebih kecil. Pratonton menunjukkan poster, carta atau kad antara muka dalam palet anda. Warna asas mempunyai kumpulannya sendiri, yang dilipat setelah sistem mempunyai warna sendiri. Medan tampal dan lepas menjadi satu baris padat. Bahagian atas ruang tiada eksport; gunakan **Export** pada bar atau ruang Tokens.

![Ruang Colours pada Lolly Demo: cip peranan dan medan tampal dan lepas di bahagian atas, kemudian palet dalam kumpulan boleh lipat, setiap warna dengan nama dan heksnya](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-roles-fold%5D%3Esummary%3Bwait%3A500&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

![Ruang Colours pada Lolly Demo selepas menambah satu warna: jadual Colour roles, kemudian cip warna baharu yang menawarkan Use as Lead? dan Fine-tune, di sebelah pratonton komposisi langsung](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

### Peranan warna: nama yang diberikan kepada warna

Sistem reka bentuk menamakan warnanya dan menyatakan kegunaan setiap satu, dan Lolly membaca kedua-duanya. **Colour roles** berada di bahagian atas ruang Colours. **In context** menunjukkan setiap perubahan serta-merta.

![Jadual Colour roles pada Wefthouse, jenama tekstil rekaan, dalam perkataannya sendiri: cip colourway Indigo, Madder dan Weld, kemudian Main, Accent, Supporting dan Tertiary, setiap satu dengan warna cerah dan gelapnya, dibaca sebagai warna utama, warna pasangan dan mengikut nama sahaja, serta Background, Text, Quiet text dan Hairlines disenaraikan di bawah jadual sebagai tafsiran yang tidak dipenuhi oleh mana-mana peranan](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&system=wefthouse&width=2720&height=2000&dpi=192&waitMs=1800&cropSelector=%5Bdata-be-roles-fold%5D&format=svg&walker=1&dark=1&filename=bs-colour-roles)

Jadual mempunyai empat lajur. Pada telefon, setiap baris menjadi kad dengan cerah dan gelap bersebelahan:

| Lajur | Kandungannya |
|---|---|
| **Role** | Perkataan sistem reka bentuk sendiri, yang boleh anda sunting di tempatnya, dan sebaris teks yang menyatakan kegunaan warna |
| **Light** dan **Dark** | Warna dalam rupa itu untuk colourway yang dipilih, dengan nama atau nilainya, serta kontrasnya |
| **Lolly reads this as** | Apa yang dilakukan alat dengan peranan itu, dalam perkataan Lolly sendiri |

**Cara Lolly mentafsir peranan.** Setiap tafsiran menerima satu peranan. Memilih tafsiran yang dipegang oleh peranan lain memindahkan tafsiran itu kepada peranan ini. Lolly tidak pernah menyimpulkan makna daripada sesuatu perkataan.

| Tafsiran | Kesan tafsiran itu |
|---|---|
| **Lead colour** | Bentuk besar, butang, warna utama yang digunakan alat |
| **Partner colour** | Warna kedua yang digunakan alat |
| **Background** | Berada di belakang segala yang lain |
| **Text** | Tajuk dan teks isi |
| **Quiet text** | Kapsyen dan teks kecil |
| **Hairlines** | Garis, sempadan dan pemisah |
| **By name only** | Tiada alat memilih peranan itu sendiri. Ia ditawarkan dalam setiap medan warna dan dalam Design, dengan pilihan kekal dipautkan supaya mengikut colourway |

Tafsiran yang tidak diisi mana-mana peranan mengekalkan takrif sistem reka bentuk, dan ruang itu menyenaraikan tafsiran tersebut di bawah jadual. Peranan yang berkongsi id tafsiran itu sendiri, seperti peranan bernama Primary, ialah tafsiran itu dan tidak boleh dipindahkan.

**Dalam carta.** Palet **Design system - colour roles first** Lolly Chart memberikan peranan warna sistem reka bentuk kepada siri mengikut susunan sistem itu sendiri, kemudian warna lain dalam paletnya. Peranan yang ditafsir sebagai latar belakang, teks, teks sekunder atau garis halus diketepikan, kerana carta melukis latar dan perkataannya dengan warna tersebut. Tiada apa-apa berubah sehingga anda memilih palet itu. Sistem reka bentuk tanpa peranan warna memaparkan palet sebagai **Design system - ordered**.

**Nilai.** Tekan nilai untuk memilih warna peranan itu bagi rupa tersebut dan colourway yang dipilih. **Same as light** membuat nilai gelap mengikut nilai cerah sehingga anda memilih warna gelap. Cip **Aa** menunjukkan teks yang dipilih Lolly untuk diletakkan di atas warna itu. Baris di bawah nilai menyatakan kebolehbacaan teks itu dalam setiap rupa: **Text reads well**, **Large text only** atau **Hard to read as text**. Penilaian itu hanya tentang teks di atas warna; warna itu masih boleh sesuai untuk bentuk dan kawasan besar. Peranan yang ditafsir mengikut nama sahaja menunjukkan perkataan yang sama tanpa warna amaran, kerana tiada alat meletakkan teks pada peranan itu sendiri. Petua alat dan pemilih menunjukkan angka, APCA dahulu dan WCAG kemudian. **Own text colour** menandakan nilai yang failnya menyatakan warna teks; warna teks itu dikekalkan. **Copied** menandakan nilai daripada colourway lain atau daripada warna pasangan yang belum dipilih oleh sesiapa; **Keep this colour** dalam pemilih menetapkan nilai itu.

**Titik permulaan.** Sistem reka bentuk tanpa peranannya sendiri menunjukkan perkataan semasa: Primary, Secondary, Surface dan Text. Tiada apa-apa ditulis sehingga anda mengubah salah satunya. **+ Add a role** mencadangkan **Primary, Secondary** atau **Main, Accent, Supporting, Tertiary**, atau menerima apa-apa perkataan yang anda taip, dan menunjukkan tafsiran yang akan diberikan kepada setiap satu. Dua perkataan pertama menjadi warna utama dan warna pasangan. Alat terus melukis warna yang sama. Pada sistem dengan satu warna utama, colourway pertama mengambil nama warna itu.

**Menamakan semula, menyusun semula, membuang.** Penamaan semula hanya mengubah perkataan; segala yang menggunakan peranan itu terus berfungsi. Seret peranan dengan pemegangnya, atau tekan Space pada pemegang, gunakan kekunci anak panah dan tekan Space untuk melepaskan. **Remove** menyatakan apa yang masih menggunakan peranan itu. Apabila alat membaca peranan itu, **Remove and keep those colours** membiarkan setiap tafsiran dengan warna semasanya. Peraturan organisasi, kumpulan panduan, medan alat atau token lain yang menggunakan peranan itu mengekalkan peranan tersebut sehingga penggunaan itu berubah. Dokumen Design tersimpan juga boleh menggunakan peranan mengikut nama, dan Lolly tidak dapat melihatnya daripada fail token. Dokumen sedemikian melaporkan warna itu sebagai tidak dapat ditentukan.

::: details Peranan dalam fail token yang ditulis secara manual
**Fail yang ditulis secara manual.** Warna dalam fail token yang tidak diisytiharkan oleh mana-mana peranan disenaraikan di bawah **In this file, with no role yet**, setiap satu dengan medan untuk perkataan dan **Make a role**. Warna itu terus berfungsi mengikut nama dalam kedua-dua keadaan. Token dengan digit dalam namanya tidak boleh menjadi peranan; ia kekal dalam fail dan terus berfungsi melalui laluannya. Jika rekod dalam fail tidak lulus pengesahan, jadual dipaparkan tanpa kawalan dan menyatakan sebabnya.
:::

**Bahagian lain dalam ruang itu menggunakan perkataan yang sama.** Cip, baris **Use as** sampel warna dan kumpulan **Colour roles** palet semuanya menggunakan perkataan sistem reka bentuk. Jubin peranan warna membuka nilainya. Fail yang dieksport tidak merekodkan apa-apa yang baharu tentang peranan; warna render berubah kerana token berubah.

**Ke mana perkataan dibawa.** Perkataan dan huraian dibawa bersama sistem reka bentuk. Ejen membacanya dalam ringkasan reka bentuk, `lolly://tokens` dan `AGENTS.md` halaman jenama. Terminal menunjukkannya dalam `lolly system status`. Halaman jenama menyenaraikannya dalam `brand.json` dan mengukur pasangan kontras bagi setiap peranan. Fail DTCG dan Tokens Studio mengekalkan semuanya, `DESIGN.md` mengekalkan perkataan dan tafsiran, dan tema PowerPoint hanya mengekalkan susunan jenama. [Peranan warna dalam format lain](/info/design-tokens.html#colour-roles-in-other-formats) mempunyai senarai penuh. Perkataan sentiasa dipetik sebagai data sistem reka bentuk, tidak pernah dibaca sebagai arahan.

**Tempat warna dipilih.** Setiap medan warna dalam alat dan dalam Lolly Design menyenaraikan peranan sistem reka bentuk dahulu, mengikut susunannya sendiri, dengan setiap perkataan dan tujuannya. **Aa** di sebelah peranan memilih warna yang terletak di atas peranan itu. Warna lain menyusul di bawah **Other colours**, tanpa salinan colourway sendiri, warna di atas warna lain dan sebarang tafsiran yang sudah diisi oleh peranan. Pilihan kekal dipautkan kepada peranan dan mengikut colourway. Medan menunjukkan perkataan itu dalam setiap colourway, dan Settings serta Tokens turut menggunakan perkataan itu. Sistem reka bentuk tanpa peranan mengekalkan grid sampel warnanya.

### Setiap warna yang dibaca alat

Apabila **Colour roles** ditutup, ruang itu bermula dengan cip untuk keputusan awal. Setiap cip menunjukkan warna peranan dan namanya. Pada sistem tanpa perkataannya sendiri, ini ialah **Primary**, **Secondary**, **Surface** dan **Text**. Tekan cip untuk memilih warnanya daripada sampel warna palet. **Every colour a tool reads**, di bahagian bawah **Colour roles**, mempunyai jalur penuh.

Jalur itu menunjukkan tujuh warna yang boleh dibaca alat: Primary, Secondary, Surface, Text, Muted, Edge dan On primary, menggunakan perkataan sistem reka bentuk sendiri jika ada. Setiap satu memainkan peranan yang sama dalam setiap alat dan eksport. Tiada satu pun perlu ditetapkan, dan apa-apa warna boleh mengisi salah satunya. Tiga warna bebas sudah menghasilkan sistem yang baik. Bacaan menyatakan kebolehbacaan teks pada permukaan, APCA dahulu. Setiap baris menunjukkan warna anda sendiri pada keamatan penuh, warna permulaan sebagai pengganti, atau **↳ follows Primary**.

On primary diterbitkan daripada primary, berlabel **Derived** dan tiada pemilih. Suis **Light** dan **Dark** di sebelah On primary, serta suis di sebelah **In context**, memilih rupa yang ditunjukkan oleh jalur, palet dan pratonton.

Warna aksen apl sendiri mengikut sistem reka bentuk secara lalai, melalui tetapan **Interface follows the design system** dalam **Settings → Appearance**. Apabila tetapan itu dimatikan, bingkai antara muka apl kekal neutral. Alat, kanvas dan eksport mengikut sistem reka bentuk dalam kedua-dua keadaan.

**Colourway.** Sistem reka bentuk boleh menyimpan beberapa warna utama, dipilih bagi setiap karya. Baris **Colourways** di bahagian atas **Colour roles** menunjukkan satu cip bagi setiap colourway, dengan **Default** pada colourway kanonik. **+ Add** memulakan colourway baharu daripada warna palet. Pilih cip, dan jadual, jalur, palet serta pratonton menunjukkan colourway itu. Anda boleh menamakan semula, menduplikasi, membuang atau menjadikan colourway yang dipilih sebagai lalai. Pada sistem dengan colourway, setiap colourway memerlukan primary dan secondary sendiri, serta surface sendiri apabila colourway mewarnakan latar belakang. Peranan itu kekal ditetapkan dalam penyunting sampel warna. [Tambah colourway pada sistem reka bentuk](/info/colourways.html#add-colourways-to-a-design-system) mempunyai langkah dan format token, dan [Lolly Demo digunakan](/info/lolly-demo-in-use.html#colourways-on-real-work) menunjukkan colourway pada kerja sebenar. Setiap orang boleh memilih colourway sendiri dalam **Settings → Appearance** ([Jadikan colourway milik anda](/info/colourways.html#make-a-colourway-your-own)).

### Cari lebih banyak warna

Tiga alat berasaskan warna utama anda. Dua yang pertama hanya mencadangkan; yang ketiga menggantikan palet.

::: cols
## Teroka tona & harmoni

Pilih **Starting colour**, **Scheme** (Mono, Complement, Analogous atau Triad) dan bilangan **Shades** (3 hingga 20, lalai 5). **Fine-tune** menetapkan keamatan UI, kontras dan teks pada warna jenama. Klik tona untuk menambahkannya, atau **Add 5 shades** untuk satu kumpulan. Warna dan peranan anda kekal.

## Cari warna yang sepadan

Pilih **Harmony**: Complementary, Adjacent, Triad, Tetrad atau Analogous (dengan **Accents** dari 2 hingga 5 dan **Angle** dari 10° hingga 45°). Setiap calon mempunyai nama yang dijana dan **+ Add**, satu tekanan bagi setiap warna.

## Bina semula seluruh palet

Menggantikan palet daripada satu warna permulaan, selepas semakan tentang apa yang berubah dan apa yang kekal.
:::

Ketiga-tiganya menggunakan matematik warna persepsi (OKLCH) yang sama seperti enjin. Dalam **Explore shades & harmonies**, baris **Primary**, **Neutral** dan **Secondary** menunjukkan tona yang dicadangkan, dan **Theme preview** menunjukkan contoh cerah dan gelap dengan bacaan kontrasnya.

![Tiga kumpulan tona yang dicadangkan, dengan kawalan tambah individu dan Theme preview yang berasingan](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

![Aksen yang dijana, setiap satu dengan sampel warna, nama yang dijana secara automatik, nilai hex dan butang Add](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&drive=click%3A.be-generate-detail%3Anot%28%5Bdata-be-rebuild%5D%29%20%3E%20summary%3Bwait%3A500&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### Menerapkan palet yang dijana

Buka **Rebuild the whole palette…** dan tekan **Preview full rebuild**. Semakan mengira bilangan peranan yang kekal seperti yang anda tetapkan, bilangan warna anda sendiri yang dikekalkan dan bilangan lengkung tona, kunci cetakan, tona tersembunyi serta hentian kecerunan yang ditambat semula atau dikekalkan. **Apply rebuilt palette** menerapkannya; **Cancel** tidak mengubah apa-apa. Selepas itu kad menawarkan **Undo**, yang sudah difokuskan, dan titik semak yang diambil sebelum pertukaran memulihkan seluruh sistem.

Sistem dengan colourway mengekalkan setiap colourway semasa pembinaan semula. Colourway kanonik mengikut warna permulaan baharu, dan setiap colourway lain mengekalkan warna, nama, susunan dan tetapannya sendiri. Semakan menyenaraikan colourway yang mengikut warna baharu dan yang mengekalkan warnanya. Lolly tidak membina semula sistem yang mengekodkan colourway dengan cara yang tidak boleh disuntingnya; kad menyatakan sebabnya, dan tiada apa-apa berubah.

### Bahagian pakar

Empat bahagian berlipat terletak di bawah pratonton dan peranan. Setiap satu dibuka dengan `#/start?area=color&focus=<name>`:

- **Explore shades & harmonies** (`focus=generate`).
- **Shade curves** (`focus=curves`) membentuk semula julat tona titik demi titik, dengan lengkung kecerahan, kroma dan rona yang berasingan (L / C / H) dan tona dilukis semula semasa anda menyeret.
- **Contrast** (`focus=contrast`): **Contrast-lock** melaras tona julat untuk mencapai sasaran APCA pada latar belakang yang anda pilih, dan **Rotate hue** memutarkan seluruh julat mengelilingi roda.
- **Print** (`focus=print`) menetapkan hasil warna utama pada mesin cetak: nilai automatiknya, campuran CMYK yang ditetapkan atau dakwat spot bernama.

### Palet dan setiap sampel warna

Palet menyenaraikan warna anda dalam kumpulan boleh lipat, setiap satu dengan **+ Add** sendiri. Anda boleh membuat dan menamakan semula kumpulan. Peranan tidak pernah membuat jubin kedua; jubin yang dirujuk oleh peranan menunjukkan nama peranan itu, seperti **Primary**. **Colour chart** di bawah jubin menunjukkan warna yang sama pada **Wheel** OKLCH (seret titik untuk mewarnakan semula, klik ruang kosong untuk menambah sampel warna) dan carta **Gamut**, yang menunjukkan had julat warna yang boleh dipaparkan. `#/start?area=color&focus=chart` membuka carta.

![Anak tetingkap palet, setiap kumpulan boleh dilipat](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-roles-fold%5D%3Esummary%3Bwait%3A500%3Bclick%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![Roda OKLCH - sudut ialah rona, jarak ke luar ialah kroma dan warna kelabu terletak pada rel kecerahan di sisi](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

Klik sampel warna untuk membuka penyuntingnya:

- **Rename** menamakan semula sampel warna.
- **Set the colour** pada gelangsar OKLCH, atau dalam **Hex**, **HSL**, **RGB** atau **CMYK**. Medan nilai membaca dan menulis dalam ruang aktif. CMYK di sini menetapkan warna skrin melalui penukaran; untuk menetapkan dakwat tepat, gunakan **Print substitutes**.
- **Stored as** memilih cara sampel warna disimpan: **LCH** (lalai, berasaskan persepsi dan gamut luas), Hex, RGB atau HSL.
- **Use as** memberikan peranan kepada sampel warna, menggunakan perkataan sistem reka bentuk sendiri jika ada. Tekan peranan yang diserlahkan sekali lagi untuk mengosongkan peranan itu.
- **Print substitutes** (berlipat): kunci **CMYK** daripada **Auto** kepada nilai dakwat tepat, atau tetapkan **Spot colour** dengan **Name** (seperti `PANTONE 186 C`), **Book** pilihan dan **Finish** untuk kerajang, timbul, benam, varnis spot, sentuhan lembut atau potongan acuan, garis lipatan atau perforasi. Mesin cetak menggunakan kunci ini apabila anda mengeksport PDF atau TIFF CMYK; lihat [Profil warna](/info/exporting.html#colour-profiles). Dakwat spot dicetak pada platnya sendiri dalam Print PDF; untuk mencetak setiap dakwat spot sebagai warna proses bagi satu eksport, lihat [Dakwat spot sebagai warna proses](/info/exporting.html#spot-inks-as-process).
- **In other spaces** (berlipat): satu nilai bagi setiap ruang warna, diterbitkan atau ditulis oleh anda, dan nilai yang ditulis sendiri diberi keutamaan semasa eksport.

**Memadam sampel warna** adalah selamat. Tona terbitan dan peranan tema disembunyikan, supaya segala yang membacanya terus berfungsi. Warna yang anda tambah dibuang.

::: details Bekerja dengan banyak sampel warna
Dalam keadaan biasa, sampel warna menunjukkan warna, nama dan nilai hexnya. Select menunjukkan kotak semak dan pemegang seret setiap sampel warna pada mana-mana skrin, dan jubin dengan fokus papan kekunci turut menunjukkan pemegangnya. Seret pemegang untuk menyusun semula dalam kumpulan, atau fokuskan pemegang, tekan Space, gunakan kekunci anak panah dan tekan Space sekali lagi untuk melepaskan; Escape membatalkan. Pada telefon, palet menunjukkan empat warna sebaris. Untuk memindahkan warna antara kumpulan, gunakan kawalan **Group** penyunting atau pilih beberapa warna dan gunakan **Move to**.

Pemilihan tidak memerlukan suis berasingan: bar dan kotak semak muncul dengan jubin pertama yang dipilih dan hilang apabila jubin terakhir dinyahpilih.

- **Seret pada ruang kosong** untuk melukis segi empat; setiap jubin yang disentuhnya menyertai pilihan, merentas kumpulan. Bahagian yang berlipat tidak menambah apa-apa.
- **Shift-klik** memilih julat mengikut susunan bacaan, **Cmd/Ctrl-klik** menogol satu jubin, dan klik biasa membuka penyunting.
- Setiap pengepala kumpulan mempunyai **Select all**, dan **Cmd-A** dengan jubin difokuskan memilih setiap warna milik anda, tidak pernah warna permulaan.
- Grid mempunyai satu hentian tab: anak panah bergerak, Shift-anak panah meluaskan pilihan, Space menogol, Delete membuang dan Escape mengosongkan pilihan. Untuk melaras sedikit saluran, tekan `l`, `c` atau `h` dahulu.
- Pada skrin sentuh, tekan dan tahan jubin untuk memulakan pilihan, kemudian ketik untuk menambah.

Bar menunjukkan **{n} selected**, kemudian **Move to**, **Give a role** (setiap warna mengambil peranan seterusnya mengikut giliran), **Download** (pilihan dalam mana-mana daripada enam format palet), **Duplicate** (salinan setiap satu, diletakkan selepas yang asal), **Copy values** dan **Delete**. Satu salinan dibuka dalam penyunting; beberapa salinan kekal dipilih. Satu Cmd/Ctrl-Z membuat asal tindakan pukal.
:::

### Kecerunan

Panel **Gradients** pilihan membina token campuran daripada palet. Setiap kecerunan mempunyai pratonton, 2 hingga 8 hentian bernama dan sudut. Hentian merujuk kepada sampel warna, jadi warnakan semula sampel itu dan kecerunan mengikutnya. Campuran menggunakan OKLCH.

Muat turun palet (token reka bentuk, CSS, SCSS, GIMP dan Adobe Swatch Exchange) terletak di bahagian atas palet. [Bawa palet dan fon anda ke mana-mana](/info/using.html#take-your-palette-and-fonts-anywhere) menerangkan setiap format.

<!--i:eti-type-->
## Tipografi

Tanpa muka taip sendiri, ruang itu menunjukkan satu kad: **Primary**, pada saiz bacaan dalam muka taip semasanya, dengan tag **Starter**, butang **Choose for Primary** dan baris *"Tiada apa-apa dipasang sehingga anda memilihnya."* Tajuk, kod dan italik mengikut primary sehingga anda memilihnya; **Choose them separately** menunjukkan kadnya.

![Ruang Type sebelum muka taip dipilih - satu kad pada saiz bacaan, tag Starter padanya dan satu butang Choose for Primary berisi](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&system=new-design-system&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

Pilih satu muka taip dan ruang itu berkembang menjadi empat kad peranan, senarai Fonts dan spesimen langsung:

- **Primary**: teks isi, butang dan setiap alat.
- **Headings**: muka taip paparan untuk `h1` dan `h2`.
- **Code**: muka taip monospace untuk kod dan data.
- **Italic**: italik sebenar untuk penegasan, petikan dan catatan sampingan.

Kad hanya diwarnakan apabila anda memasang muka taip itu. Butangnya menunjukkan peranan: **Change Headings** pada muka taip anda sendiri dan **Choose for Headings** di tempat lain. Baris sampel membungkus. Tiada apa-apa pada kad menerapkan perubahan; butang membuka pentas perbandingan untuk peranan itu.

![Empat kad peranan dipaparkan - setiap satu menggunakan muka taip yang mengisinya, dengan tag Starter jika belum dipilih oleh sesiapa dan Italic mengikut primary](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&system=new-design-system&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

### Pentas perbandingan

Pentas dibuka di bawah kad yang anda tekan. Kad dilipat menjadi jalur satu baris supaya pentas muncul pada skrin pertama telefon. Escape membatalkan dan mengembalikan fokus kepada kad.

1. Tekan **Choose for** dan peranan pada kad.
2. Taip nama keluarga fon dan tekan **Preview**, atau tekan salah satu daripada enam keluarga **Pinned** di bawah medan.
3. Tekan **Use this face**.

![Pentas perbandingan dibuka di bawah kadnya, dengan baris carian, keluarga fon yang dipinkan dan kad dilipat menjadi jalur satu baris](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

**Persetujuan diminta sekali.** Kali pertama pratonton menghubungi Google Fonts, dialog menerangkan: *Google mengetahui nama keluarga fon dan alamat IP anda. Fail itu kemudian disimpan pada peranti ini dan digunakan luar talian. Ini satu-satunya langkah dalam studio yang menghubungi pihak ketiga.* **Fetch from Google** meneruskan dan diingati. **Cancel** membiarkan kad memaparkan *"Belum diambil. Tiada apa-apa dihantar kepada Google."*, dengan **Fetch from Google** sendiri.

**Lepaskan fail fon pada pentas** (TTF, OTF atau WOFF) untuk melihat pratonton muka taip berlesen milik anda. Dalam kedua-dua keadaan, muka taip kekal pada peranti ini, dirender luar talian dalam apl, alat dan setiap eksport, serta dibawa dalam fail sistem reka bentuk. Semua yang ada di Google Fonts diedarkan di bawah lesen terbuka (OFL, Apache atau UFL).

### Fon pada peranti ini

Panel **Fonts** menyenaraikan setiap muka taip pada peranti ini dan peranan yang diisinya. Muka taip yang anda tambah muncul dahulu, di bawah **In the design system**, setiap satu dengan peranannya dan kawalan padam. Muka taip permulaan menyusul dalam satu baris berlipat yang dipudarkan. **Add a face** membuka pentas perbandingan untuk mana-mana peranan. Panel **Type roles** menunjukkan spesimen langsung setiap peranan dengan keluarga dan keadaannya, seperti *Inter* atau *Inter · follows Primary*.

<!--i:eti-tag-->
## Token

Token ialah nilai bernama yang mendasari sistem reka bentuk: warna, muka taip, logo, sudut dan jarak. Alat membacanya mengikut nama, jadi perubahan di sini sampai kepada setiap alat serentak.

![Ruang Tokens: bahagian atas dengan contoh daripada sistem dan tindakan fail, jubin yang mengira setiap jenis token, kemudian pasangan warna dengan bacaan kontrasnya](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **Bahagian atas** memberikan contoh daripada sistem anda sendiri (*Primary ialah Spearmint, #033633*) dan tindakan fail: **Download** (sistem sebagai token reka bentuk, atau palet dalam lima format lain), **Copy CSS** dan **Add from…** untuk membaca semula fail JSON.
- **Jubin** mengira setiap jenis token dan melompat ke bahagiannya: Colours, Type, Logos, Shape and spacing, More dan All tokens. Bahagian yang hanya mengandungi apa yang disertakan dengan sistem permulaan kosong mempunyai tag **Starter**; sistem yang disertakan dengan apl mengira bahannya sendiri tanpa tag. Pada telefon, jubin disusun menjadi dua baris dengan tiga jubin setiap baris.
- **Colours** bermula dengan pasangan yang digunakan bersama oleh alat (text pada surface, on primary, muted pada surface) dengan bacaan APCA dalam rupa cerah dan gelap, dan menandakan **Weak contrast** apabila pasangan tidak mencapai sasaran. Kemudian setiap kumpulan warna: julat tona sebagai satu baris cip, warna lain dengan nilainya dan rujukan yang digunakan alat, seperti `{color.brand.spearmint}`. Tekan rujukan untuk menyalinnya. **Edit in Colours** membuka kumpulan dalam ruang Colours. Pada sistem reka bentuk dengan [peranan warna](#colour-roles-what-the-colours-are-called), **Colour roles** muncul dahulu, dengan setiap peranan sekali dalam perkataan dan susunan sistem itu sendiri. Peranan menyimpan warna bagi setiap colourway dan rupa. Warna itu disenaraikan bersama peranan, bukan sebagai warna berasingan; ubahnya dalam jadual Colour roles.
- **Type** dan **Logos** menyenaraikan muka taip bagi setiap peranan dan setiap slot logo, dengan **Edit in Type** dan **Edit in Logos** setelah anda mempunyai yang sendiri.
- **Shape and spacing** menyimpan **Rounded corners** (`shape.radius`) dan **Spacing rhythm** (`space.base`). Setiap satu berlabel *Lolly default* sehingga anda menggerakkan gelangsar dan *Yours* selepas itu, disimpan serta-merta dan boleh dibuat asal.
- **More tokens** menambah jarak, saiz, lebar lejang, kelegapan, putaran, nombor biasa dan bayang, disimpan sebagai [token reka bentuk](/info/design-tokens.html) standard.
- **App appearance (advanced)** menyenaraikan warna, saiz dan bayang yang digunakan skrin Lolly sendiri, dan **Inspect every token (advanced)** mencari serta menyunting apa-apa nilai tersimpan dan menunjukkan setiap perubahan untuk semakan dahulu. Di situ, nilai peranan warna dalam setiap colourway disenaraikan bersama peranan: pilih token peranan untuk melihat satu baris bagi setiap colourway, cerah dan gelap bersebelahan. Baris kiraan menyatakan bilangan nilai yang disimpan oleh peranan. Sistem reka bentuk baca sahaja menunjukkan senarai yang sama.

Bahagian kosong menawarkan **Pick a colour**, **Choose a face** atau **Add a logo**.

<!--i:eti-images-->
## Fail

Lepaskan fail yang disimpan oleh jenama anda, selain logo: fail **vektor**, **imej**, **audio** dan **gerakan** (video, Lottie dan animasi). Fail itu muncul dalam [Assets](/info/using.html#assets-your-library), disusun mengikut bahagian, dan dalam pemilih aset setiap alat. Fail itu kekal pada peranti ini.

## Bunyi

**Sound** dipilih dengan mendengar. Ruang itu dibuka dengan tiga bunyi permulaan, **Calm**, **Steady** dan **Bright**, setiap satu sebagai kad dalam warna genrenya dengan butang main. Mainkan satu untuk mendengar petikan pendek; memulakan yang lain menghentikan yang pertama. **Choose** menjadikan bunyi itu bunyi bagi setiap kegunaan. Kad keempat, **Mixed**, memberikan bunyi sendiri kepada setiap kegunaan: Calm untuk Explain, Steady untuk Demonstrate dan Bright untuk Play. Butang mainnya memainkan ketiga-tiganya mengikut giliran. Tiada apa-apa disimpan sehingga anda memilih **Save sound**. Bunyi itu kemudian menjadi sebahagian daripada sistem reka bentuk ini, dengan titik semak dalam sejarah yang sama seperti ruang lain. Sistem reka bentuk tanpa bunyi terus berfungsi seperti sebelumnya.

Kegunaan ialah keadaan ketika bunyi dimainkan: **Explain**, **Demonstrate** dan **Play** sebagai permulaan. Setiap kegunaan ialah cip dengan butang mainnya sendiri. **Music** atau **With narration** di atas cip menetapkan sama ada cip memainkan muzik sahaja atau sebagai latar suara. Kegunaan yang anda pilih menunjukkan tujuan dan muziknya dalam perkataan biasa, contohnya "Hangat · 84 bpm · Rhodes, bes beralun, set dram bertekstur kusam". Setiap kegunaan mengambil genre, tempo dan alat muzik bunyi yang dipilih (atau, dengan Mixed, bunyinya sendiri). Setiap kegunaan mengekalkan lagu dan imbangannya sendiri: Explain memastikan melodi tidak mengganggu suara, dan Play membiarkan melodi mendahului. Beralih antara Mixed dan satu bunyi mengekalkan kedua-duanya. Kegunaan yang anda tambah sendiri mengekalkan bunyinya di bawah Mixed. Sistem reka bentuk merekodkan pilihan anda. **Add a use** menambah kegunaan dan membolehkan anda menaip namanya terus di situ. **Make main** memilih kegunaan yang dimainkan apabila tiada yang lain diminta. **Another tune** memainkan gubahan baharu dengan tetapan yang sama.

**Edit in the music generator** membuka [penjana muzik](/info/generated-music.html#the-music-generator) dengan tetapan kegunaan itu, serta baris di bahagian atas yang menyatakan bunyi siapa yang anda sunting. **Save to this use** membawa tetapan kembali ke ruang itu; **Cancel** kembali tanpa mengubah apa-apa. Pilihan yang belum disimpan dalam ruang itu menunggu semasa anda berada di tempat lain. Jika seseorang menyimpan bunyi dalam tab lain sementara itu, simpanan yang lebih baharu dikekalkan dan suntingan anda diketepikan.

**Voice** memilih suara untuk kegunaan itu, kelajuan pertuturan dan kelantangan muzik di bawah suara; **Hear the voice with the music** memainkan kedua-duanya. Di bawah **More** terdapat pengurangan kelantangan semasa suara bercakap, perkataan untuk dicuba (kekal dalam ruang itu), nota sebutan (satu setiap baris, dalam bentuk tulisan = sebutan) dan nota tentang suara. Pratonton menggunakan model pertuturan setempat dan campuran yang sama seperti eksport jujukan. Pratonton beransur senyap; pengakhirannya bukan digubah.

**Notes and signature** menyimpan perkara yang perlu didengar dalam sesuatu kegunaan dan identiti bunyi: pembukaan atau pengakhiran tetap yang disimpan sebagai fail audionya sendiri. Letakkan identiti bunyi itu dalam jujukan anda; muzik yang dijana tidak pernah menyertakannya. Keperluan yang tidak dapat disemak oleh versi Lolly ini menghentikan muzik baharu untuk kegunaan itu.

**Details** menyimpan watak jenama (rasa yang patut disampaikan oleh bunyi, apa yang kekal sama dan apa yang perlu dielakkan) dan semakan pendengaran. **Record a listening review** menyimpan nama penyemak, tarikh dan nota mereka bersama versi bunyi yang disimpan. Sebarang perubahan menjadikan bunyi itu draf semula. Semakan meliputi versi itu, bukan setiap lagu yang dihasilkan daripada bunyi itu kemudian: dengar setiap karya baharu sebelum ia diedarkan.

**Make a music project** membuka kegunaan itu dalam penjana muzik sebagai projek yang menyimpan kegunaan, versi bunyi dan tetapan tepat. **New tune** di situ menghasilkan gubahan baharu dan mengekalkan bunyi. Jika anda mengubah tetapan, **Put the sound back** kembali kepada bunyi itu, dan **Keep as my own** meneruskan dengan lagu bebas. Sehingga anda memilih, projek tidak boleh disimpan atau dimuat turun sebagai hasil daripada bunyi itu. Pautan kongsi hanya membawa tetapan muzik. Projek dan lagu tersimpan turut menyimpan nota bunyi itu, yang tidak dimasukkan dalam pautan kongsi dan kelayakan awam fail audio. Simpan rakaman yang dirender apabila audio tepat perlu kekal merentas versi penjana pada masa hadapan.

<!--i:eti-checklist-->
## Peraturan

**Rules** menetapkan apa yang boleh diubah oleh orang, apa yang kekal tetap dan apa yang boleh disemak oleh Lolly.

![Rules pada Lolly Demo: empat peraturan organisasi, setiap satu ditandakan Checked in Design dan Required atau Advisory, kemudian Try your design system in use dengan contoh yang sedia dirender](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dusage&width=1440&height=1200&dpi=192&waitMs=2400&cropSelector=%23start-panel-usage&format=svg&walker=1&dark=1&filename=bs-usage-rules)

**Brand rules** menyenaraikan peraturan anda. **Add rule** (atau **Add your first rule**) membuka borang ringkas:

- **Rule name** dalam perkataan anda sendiri, seperti *Aksen Beacon*;
- **Check**: **Colour choices**, **Font choices**, **Fixed artwork** atau **Text length**, dengan peranan jenama yang digunakannya, di bawah nama anda sendiri untuk peranan itu;
- **Example** yang tertakluk kepadanya (Poster, Title slide, Content slide atau Lolly Chart), **Mode** dan sama ada ia **Required** atau **Advisory**;
- **Reviewed by**, kemudian **Save draft** atau **Approve & save**.

Kelulusan merekodkan keputusan anda sendiri pada peranti ini. Peraturan wajib yang diluluskan mengehadkan poster boleh guna semula, dan semakan hanya meliputi PNG contoh; ia tidak mengubah alat lain.

Peraturan dalam fail token sistem reka bentuk, seperti pasangan warna yang diluluskan, ketebalan dan penjajaran teks atau logo bagi setiap permukaan, disenaraikan di sini sebagai **Checked in Design**. Lolly Design menyemaknya lapisan demi lapisan dalam kad **Before you export** pada panel eksport, dan `lolly check` melakukan perkara yang sama untuk dokumen Lolly Design tersimpan ([Sebelum anda mengeksport](/info/design.html#before-you-export)). Peraturan yang tiada penyemak dalam binaan ini dikekalkan seperti yang dibekalkan dan ditandakan **Unchecked**.

Lolly Demo menyertakan empat peraturan organisasi yang diluluskan. Tajuk utama tidak pernah ditetapkan dalam huruf besar: peraturan itu wajib, jadi `lolly check` melaporkan tajuk utama dalam huruf besar sebagai ralat. Tiga yang lain ialah nasihat. Teks isi dijajarkan ke kiri. Tanda utama diletakkan pada permukaan cerah dan tanda songsang pada permukaan gelap. Garis putus-putus bermaksud lepaskan di sini.

**Try your design system in use** merender empat contoh daripada semakan semasa dengan **Render & check examples**. Pilih **Mode** dan **Try your own text** untuk tajuk, teks sokongan dan teks slaid. Setiap contoh melaporkan apa yang diukur, dengan **See checks & sources** dan **Download check report**. **Make reusable poster** memuat turun `.lolly` yang mempunyai reka letak tetap dan pilihan input yang diluluskan. Contoh adalah setempat: menjalankan semakan tidak menerbitkan atau meluluskan apa-apa.

Binaan yang disertakan dengan jenama tetap menunjukkan peraturan dan contoh yang sama sebagai baca sahaja, di bawah *This brand is set*.

<!--i:eti-graduation-cap-->
## Kemahiran

**Skills** menyenaraikan [kemahiran jenama](/info/brand-skills.html) sistem reka bentuk aktif: standard bertulis jenama, satu bagi setiap disiplin, untuk manusia dan ejen AI. Setiap baris memberikan disiplin, status jenama sendiri (**Draft** atau **Approved**), sama ada kemahiran itu awam atau dalaman serta semakannya. Pilih baris untuk membaca kemahiran bersama liputannya, yang membandingkan baris kemahiran dengan token anda: apa yang disemak oleh Lolly, apa yang bercanggah, apa yang sepadan dan apa yang sekadar panduan.

**Download skill (.zip)** menulis kemahiran sebagai folder Agent Skills untuk alat ejen, dengan pautan katalog yang merujuk kepada Lolly ini. **Copy as one file** meletakkan teks yang sama pada papan keratan untuk tetingkap sembang. Sistem reka bentuk tanpa kemahirannya sendiri menyenaraikan garis dasar yang ditulis Lolly daripada token dan peraturan organisasinya setiap kali garis dasar itu dibaca. Ruang itu membaca kemahiran dan tidak pernah menyuntingnya.

<!--i:eti-upload-->
## Bawa masuk jenama

**Add from…** dalam bar membuka pemilih yang bertanya apa yang anda ada, bukan formatnya:

- **Design tokens or a design file**: JSON DTCG atau Tokens Studio, projek Penpot, zip set token, pek sistem reka bentuk Lolly, SVG, `DESIGN.md` atau folder halaman jenama.
- **PDF**: dek atau fail garis panduan, dibaca pada peranti ini untuk warna, tanda dan muka taip terbenamnya.
- **Logo or screenshot**: imej menjadi palet yang dicadangkan, dibaca pada peranti ini. Ia membaca warna, bukan muka taip atau reka letak.
- **Saved web page**: satu fail HTML dan fail CSSnya, atau HTML atau CSS yang ditampal, sehingga 20 fail dan 2 MB. Hanya teks yang anda bekalkan dibaca: sumber berpaut tidak diambil dan skrip tidak dijalankan.
- **Font file**: TTF, OTF atau WOFF. Membuka ruang Type, tempat muka taip dipasang.
- **Website**: satu halaman, dibaca untuk warna dan tipografinya. Jubin ini hanya muncul pada peranti yang boleh membaca halaman, dan menyatakan pembaca yang digunakannya: apl pada peranti ini, atau sambungan pelayar dalam tab latar belakang, dilog masuk sebagai anda. Menaip URL hanya mengisi medan; menekan ambil ialah persetujuan.

Pilih sumber fail reka bentuk dan kad seterusnya menyenaraikan format yang diterima sebagai jubin ikon. Kad itu ialah satu sasaran lepas. Anda juga boleh melepaskan fail ke studio.

![Kad import - format yang diterima ditunjukkan dahulu sebagai jubin ikon, dan seluruh kad ialah satu sasaran lepas](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

- **Pek sistem reka bentuk Lolly** (`.lolly`, atau `.zip` lama) dipasang dalam satu langkah.
- Eksport **Penpot** (`.penpot`) membawa token reka bentuknya.
- Fail **Design Tokens** (W3C DTCG) atau **Tokens Studio** (`.json`) membawa tokennya. Huraian yang meminta pembaca mengabaikan arahan, mendakwa mempunyai kebenaran atau meminta kod dijalankan diketepikan, dan import menyatakan lokasinya.
- **SVG biasa** diimbas untuk warna yang boleh anda pilih, dengan yang pertama menjadi warna utama anda.
- **`DESIGN.md`** (`.md`) dibawa ke **Try these colours** dengan tokennya seperti yang ditulis. Prosanya boleh disimpan sebagai draf kemahiran jenama, dan kad menandakan baris yang meminta pembaca mengabaikan arahan, mendakwa mempunyai kebenaran atau menjalankan kod. Ejen dan halaman jenama tidak melihat draf sehingga anda menekan **Keep this skill** dalam ruang Skills, dan kemahiran yang disimpan kekal dalaman.
- **Folder halaman jenama**, dipilih sebagai folder, dilepaskan atau dizipkan, dibawa ke semakan yang sama. Setiap fail disemak dengan `brand.json` folder; satu fail yang tidak sepadan menyebabkan seluruh folder ditolak. Import menambah token. Logo dan fon kekal dalam folder.

::: warning Semakan arahan membaca baris demi baris
Semakan yang mengetepikan arahan dalam huraian fail token membaca baris demi baris dan terlepas ungkapan lain. Baca fail daripada orang yang anda tidak kenali sebelum anda menerapkan token.
:::

Lolly membaca halaman jenama daripada fail yang anda bekalkan. Ia tidak mengambil alamat laman lain.

### Fail dengan perkataan warnanya sendiri

Fail token atau `DESIGN.md` boleh menggunakan perkataannya sendiri untuk warna, seperti main, accent, supporting dan tertiary. Apabila Lolly menemui perkataan sedemikian, semakan menyenaraikan setiap perkataan sebelum apa-apa diterapkan: perkataan, warnanya dalam setiap rupa, token asalnya dan tafsiran yang dicadangkan Lolly. Lolly mencadangkan tafsiran daripada perkataan sahaja, berdasarkan senarai pendek, tanpa model. Perkataan yang tiada dalam senarai diterima sebagai perkataan jenama sendiri, **By name only**. Anda boleh menamakan semula apa-apa perkataan, menyatakan tujuannya, memberikan tafsiran lain atau menyahtandakannya untuk mengekalkannya sebagai warna bernama.

**Install with these roles** menulis peranan; **Install without roles** memasang fail seperti yang diterima. Fail tanpa perkataan sedemikian melangkau langkah ini. Fail yang menyatakan peranannya sendiri, seperti fail yang ditulis oleh Lolly, menunjukkannya seperti yang ditulis dan memasangnya tanpa perubahan; anda boleh menyuntingnya kemudian dalam ruang Colours. Terminal tiada semakan: `lolly system import` mengekalkan rekod yang dinyatakan dan membiarkan perkataan fail lain sebagai warna bernama.

### Semak rujukan

Logo, tangkap layar, laman web atau halaman tersimpan membuka **Try these colours**: contoh dalam warna yang dicadangkan, **Main colour** yang boleh anda ubah dan nama untuk sistem baharu. Kotak menyatakan kesan penerapan: ia **menggantikan** tetapan token aktif dengan palet yang dijana dan gaya lalai, **mengekalkan** fon dan fail pustaka anda dan sistem sebelumnya boleh **dipulihkan**. **Apply suggested settings** mengambil titik semak, kemudian menerapkan palet cerah dan gelap. **Restore brand settings** boleh mengembalikan tetapan lama. **Change reference** memilih sumber lain.

::: details Apa yang dibaca daripada rujukan, dan laporan konteks reka bentuk
**Palette, source details and individual choices** menunjukkan apa yang dibaca, nama fon yang ditemui dan kontras pratonton. Nama fon hanyalah cadangan; anda memasang muka taip dalam Type. Butiran sumber boleh merangkumi tipografi, sela, pelapik dan nilai sudut jika diperhatikan, dan dilabel **Not observed** jika tidak. Pembacaan halaman tersimpan atau laman web secara asli melaporkan gaya yang diisytiharkan, yang mungkin tidak digunakan oleh halaman itu. Sambungan pelayar boleh melaporkan gaya yang diukur daripada sampel elemen yang kelihatan. Ini ialah pemerhatian: tiada apa-apa dipasang, dan jarak sumber tidak pernah menggantikan jarak anda sendiri. **Choose individual items in the tray** menyimpan item individu. **Download design context** menyimpan laporan JSON tentang pemerhatian, token yang dicadangkan dan maklumat sumber (dengan SHA-256 bagi mana-mana HTML atau CSS yang dibekalkan). Laporan itu tidak mengandungi teks mentah halaman dan bukan Content Credential yang ditandatangani.
:::

Import PDF dan fail reka bentuk mengekalkan kawalan semakannya sendiri. Item dalam **Tray** tidak mengubah apa-apa sehingga anda menambahkannya dalam ruang yang mengendalikan jenis bahan itu. `#/start?source=<kind>` membuka pemilih pada sumber (`file`, `pdf`, `image`, `font`, `url`, `page`), dan `?import` membuka senarai biasa.

### Cari dan bandingkan rupa

Buka **Find a look** daripada Board atau daripada senarai sistem reka bentuk dalam Settings. Semak imbas sistem yang disimpan pada peranti ini dan beberapa contoh Lolly boleh guna semula, dan cari mengikut nama, tag warna atau fon yang diisytiharkan. **Closest to my current palette** menyusun mengikut persamaan warna yang diukur, dengan fon sepadan menentukan susunan apabila seri; ia bukan skor kualiti.

Klik rupa untuk melihat pratontonnya dalam konteks; pratonton tidak mengubah apa-apa. **Use this look** pada kad menerapkan rupa itu. Sistem tersimpan menjadi sistem aktif, yang tidak menyunting apa-apa. Warna contoh dimasukkan ke dalam sistem reka bentuk yang terbuka selepas titik semak biasa. Logo, fon dan apa-apa lagi dalam sistem yang tidak ditakrifkan oleh contoh kekal seperti sedia ada. **Compare looks** menambah kotak semak pada setiap kad: pilih dua untuk dibandingkan sebelah menyebelah. **Restore brand settings** memulihkan rupa sebelumnya. Sistem tersimpan mempunyai **Search tags** yang boleh disunting di bawah **Details and design context**. Contoh itu ialah resipi warna asli Lolly, tanpa koleksi hasil pengikisan web dan tanpa akaun.

![Lolly membandingkan Sunroom dan Orchard sebelah menyebelah sebelum menerapkan mana-mana sistem warna.](/t/url-shot?url=%2F%23%2Fstart&width=1280&height=900&dpi=96&waitMs=3000&format=svg&filename=brand-compare-looks&try=1&drive=click%3A%5Bdata-ds-door%3D%22looks%22%5D%3Bwait%3A500%3Bclick%3A%5Bdata-looks-compare-toggle%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Asunroom%22%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Aorchard%22%5D%3Bclick%3A%5Bdata-looks-review%5D%3Bwait%3A500&cropSelector=.ds-looks-comparison&waitSelector=%5Bdata-ds-door%3D%22looks%22%5D&walker=1&rasterDpi=96)

<!--i:eti-package-->
## Simpan dan pindahkan sistem reka bentuk anda

### Pindahkan jenama antara peranti

**Export** menulis satu fail **`LollyBrand-….lolly`**: token, fon, logo dan pilihan tema anda, dengan manifes integriti yang disemak semasa import. Keluaran web sebelum 1.0.7 menamakan fail itu `.zip`, dan Lolly masih menerima ejaan itu. **Tokens (.json)** menulis dokumen token reka bentuk biasa, tanpa fon atau logo, untuk repositori, langkah binaan atau alat token lain.

Untuk membawa masuk semula, gunakan **Add from… → Design tokens or a design file**, atau lepaskan fail pada studio. Inilah cara rakan sekerja menyerahkan jenama kepada anda atau anda membawanya ke pemasangan kedua, tanpa akaun dan tanpa awan. [Bekerja dengan rakan kongsi](/info/partners.html) meliputi apa lagi yang perlu dihantar apabila penerima jenama anda bekerja untuk organisasi lain. Untuk membawa masuk jenama daripada baris perintah, lihat [`ingest:brand`](/info/configuration.html#brand-packs).

**Fonts for Linux (.rpm)** membungkus fon yang anda tambah menjadi RPM yang boleh dipasang. Jika anda memuat naik mana-mana fon itu sendiri, Lolly meminta anda mengesahkan dahulu bahawa anda dibenarkan mengedarkannya semula.

### Pulihkan tetapan terdahulu

Buka **More** dalam bar, pilih **Restore brand settings**, pilih titik semak bertarikh dan tekan **Restore**. Ini memulihkan warna, tetapan tipografi dan token lain untuk jenama aktif; fail fon dan imej kekal seperti sedia ada. Lolly menyimpan tetapan semasa anda sebagai **Before restore** dahulu, supaya anda boleh membalikkan pemulihan walaupun selepas menutup pelayar. 20 titik semak terkini disimpan pada peranti ini. Suntingan yang dibuat semasa studio memaparkan **Saving…** kekal selepas muat semula, dan kad menawarkan untuk memulihkan perubahan yang belum selesai disimpan.

### Versi

Versi yang diterbitkan ialah **salinan kekal yang bernama** dan disimpan pada peranti ini. Ia tidak pernah berubah, jadi alat atau pautan yang menetapkannya (dengan `designv`) terus melukis perkara yang sama. Sistem yang mempunyai sesuatu milik anda sendiri menyenaraikan **Versions & publishing** dalam menu **More** pada bar; selepas penerbitan pertama anda, **Versions** muncul bersama ruang lain. `#/start?area=versions` membuka Versions.

::: warning Versi yang diterbitkan adalah kekal
Belum ada fungsi padam, dan panel menyatakannya. Penerbitan tidak boleh dibuat asal; pemulihan boleh. *Restore latest from this version* ialah suntingan biasa, dengan **Undo** ditawarkan serta-merta.
:::

**Pembuangan muncul dahulu pada kad keserasian**, kerana token yang dibuang menyebabkan alat gagal berfungsi.

**Publish only** menyimpan versi tanpa mengubah apa yang diikuti alat; **Publish and make active** membuat alat dan apl mengikut versi itu. **Follow the latest again** menjadikan setiap suntingan berkuat kuasa serta-merta.

### Terbitkan halaman jenama

[Halaman jenama](/info/brand-page.html) ialah satu alamat untuk manusia dan ejen: halaman logo, warna, tipografi dan contoh, dengan fakta yang sama dalam fail bersebelahan. **Publish a brand page**, di bawah Versions & publishing, menunjukkan halaman langsung dan, di sebelah halaman:

- **Goes public**: setiap fail, dikumpulkan, dengan saiznya.
- **Held back**: apa yang diketepikan, dan sebabnya. Logo tanpa lesen yang direkodkan diketepikan sehingga anda menandakan nama logo itu. Fail fon memerlukan lesen yang direkodkan dan membenarkan pengedarannya, dan halaman menunjukkan spesimen dalam bentuk garis luar apabila fail diketepikan. Kemahiran jenama dalaman tidak pernah muncul.
- **What was checked**: pasangan warna bagi setiap colourway dan mod, serta peraturan organisasi. Ini ialah ukuran, bukan keputusan penilaian.
- **In your words**: pernyataan penggunaan dan maklumat hubungan. Halaman memaparkan apa yang anda tulis dan Lolly tidak menambah lesen atau tuntutan undang-undang. Suis mematikan baris "Made with Lolly" dalam pengaki.
- **On exports**: suis yang [merekodkan alamat halaman dalam eksport sistem reka bentuk ini](/info/brand-page.html#lead-back-from-your-files). Suis dimatikan sehingga anda menghidupkannya, memerlukan alamat `https` dan tidak dibawa bersama pek atau salinan. Sistem reka bentuk yang dikunci tidak menunjukkan suis itu, kerana pengurusnya yang menentukan.

**Download folder** menyimpan folder sebagai ZIP untuk anda hoskan di tempat pilihan anda. Tiada apa-apa menjadi awam sehingga anda mengehoskan folder itu. Dalam terminal, `lolly system publish --out=<dir>` menulis folder yang sama. Instans yang menyediakan halaman jenama turut menawarkan **Publish to** alamatnya: satu tekanan yang disengajakan, melalui rantaian kelulusan instans jika ada. Sistem reka bentuk terurus hanya menerbitkan apabila pengurusnya membenarkan.

### Sambungkan ejen

**Connect an agent**, di tempat yang sama, memberi anda teks untuk ditampal dan menyatakan apa yang boleh dilakukan oleh setiap pilihan:

- **`AGENTS.md`** dalam projek: ejen membaca nama dan peraturan sistem. Ia tidak melukis apa-apa dan tidak memerlukan pelayan.
- **Lolly's public server**: melukis dengan Lolly Demo, tanpa mengira sistem yang anda buka di sini. Ia tidak memerlukan kunci.
- **Your instance**: melukis dengan sistem yang disimpan oleh instans, dan membaca token perkhidmatan daripada pemboleh ubah persekitaran. Helaian memberikan nama pemboleh ubah itu dan tidak pernah menunjukkan token.

Apabila tiada pelayan yang dihoskan melukis dengan sistem anda, helaian menyatakannya.

<!--i:eti-layers-->
## Urus sistem reka bentuk anda

Buka **Settings → Preferences → Design systems** untuk beralih, menambah atau membuang sistem. **Open** memilih sistem dan membukanya di sini; **Make a new one** membuat sistem setempat dan membukanya dengan medan nama sedia diisi. Satu sistem aktif pada satu-satu masa, untuk seluruh peranti. [Seni bina jenama](/info/brand-architectures.html) membantu menentukan bila jenama memerlukan sistem reka bentuknya sendiri.

**Asal sistem.** Sistem yang dibekalkan oleh katalog sesuatu pemasangan berlabel **Came with this app**, atau **From this instance** dalam apl yang disambungkan kepada instans. Kembangkan **Catalogue source** untuk melihat pembekalnya, aset token dan ruang namanya serta versi atau hasil tambah semak yang diketahui; jika penyegaran gagal, bahan yang dicache dilabel.

**Sistem terurus ialah baca sahaja.** Sistem berlabel **Managed by this instance** (atau **Managed by this app** dalam apl desktop tanpa instans) apabila katalognya mengunci sistem itu. Anda boleh menggunakan dan memuat turun sistem terurus. Membukanya di sini menunjukkan nota baca sahaja dengan **Make an editable copy** dan **Switch**, kemudian peranan warna dan tokennya tanpa kawalan penyuntingan. Sistem setempat anda sendiri kekal boleh disunting, walaupun sistem terurus itu datang dahulu. Binaan dengan satu jenama tetap membuka Lolly Design System Setup pada *This brand is set*, dengan token dan peraturan penggunaan jenama untuk dibaca.

**Setiap sistem lain yang dibekalkan ialah milik anda** untuk disembunyikan, disunting dan ditetapkan semula, termasuk Lolly Demo dan Lolly Starter di lolly.tools. Menyuntingnya mengekalkan namanya dan menandakan baris **Edited here**. **Reset to original** dalam menunya membuang perubahan yang dibuat pada peranti ini. Sistem permulaan kosong ialah pengecualian: perubahan pertama di situ memulakan sistem reka bentuk anda sendiri, dan Lolly bertanya sekali untuk namanya. [Lolly Demo digunakan](/info/lolly-demo-in-use.html#switch-to-your-own) menunjukkan apa yang digantikan oleh sistem anda sendiri.

### Membuang sistem reka bentuk

Pilih **Remove** daripada menu sistem; pengesahan menyatakan sistem yang akan aktif selepas itu. Sesi tersimpan, muat naik dan bahan yang dikongsi dengan sistem lain kekal.

Membuang sistem yang dibekalkan hanya menyembunyikan sistem itu: aset katalognya kekal, **Bring back** menunjukkannya semula dan ia kembali sendiri jika anda membuang semua yang lain. Membuang salinan yang diimport atau disunting tidak membuang sistem yang dibekalkan, logo atau fonnya. Jika salinan itu aktif, sistem yang dibekalkan menjadi aktif semula. Membuang salinan dihoskan yang aktif hanya mengosongkan sambungan salinan itu; instans yang dipilih secara berasingan kekal dipilih.

::: details Mengubah sistem reka bentuk yang dibekalkan pelayan
Mengubah apa yang dibekalkan pelayan ialah tugas pentadbir: pengendalinya mengubah katalog sumber dan melancarkan semula sistem, atau pentadbir Lolly Work menyemak dan menerapkan perubahan pelayan. Suntingan di sini kekal setempat, dengan satu pengecualian. Pada instans Lolly Work yang memberikan anda `brand.edit`, sistem terurus turut menawarkan **Edit for** instans itu, yang membuka salinan penyuntingan. **Send to** instans itu dalam **Versions** menghantar warna, colourway, peranan warna dan alamat halaman jenamanya kembali. [Sunting instans ini daripada studio](/info/work-design-system-administration.html#edit-this-instance-from-the-studio) meliputi apa yang boleh diubah oleh suntingan dan cara instans menyediakan perubahan itu. Lihat [Membuang sistem reka bentuk katalog](/info/configuration.html#removing-a-catalogue-design-system) dan [Konfigurasi](/info/configuration.html#supplied-and-local-design-systems).
:::

<!--i:eti-code-->
## Gunakan konteks reka bentuk di luar apl

**Download design context** menyimpan dokumen token, warna yang telah ditentukan, keluarga fon yang diisytiharkan, id aset, bukti sumber jika direkodkan, liputan dan peraturan nyata, tanpa fail fon dan tanpa bukti pemilikan. Baris perintah membaca fail tanpa pelayan: `lolly system import` menjadikannya sistem reka bentuk terminal dan `lolly system check` menyemak input Lolly Design berdasarkan konteks tersimpan. [Bawa sistem reka bentuk anda](/info/cli.html#bring-your-design-system) meliputi import dan [Sistem reka bentuk yang digunakan oleh perintah](/info/cli-decks.html#which-design-system-a-command-uses) meliputi semakan. Klien MCP membaca ringkasan yang sama daripada `lolly://design-context` ([Pelayan MCP](/info/mcp.html)).

<!--i:eti-map-pin-->
## Ke mana selepas ini

- **[Menggunakan Lolly](/info/using.html)**: alat, menyimpan, berkongsi dan Assets.
- **[Seni bina jenama](/info/brand-architectures.html)**: cara bahagian, produk, jenama yang disokong, klien dan musim dipadankan dengan sistem reka bentuk, colourway dan identiti logo.
- **[Bekerja dengan rakan kongsi](/info/partners.html)**: berkongsi jenama anda dengan rakan kongsi, dan bekerja dalam jenama yang diberikan kepada anda.
- **[Halaman jenama](/info/brand-page.html)**: terbitkan sistem reka bentuk anda pada satu alamat, sebagai kit media dan kit ejen.
- **[Design Tokens](/info/design-tokens.html)**: model token yang digunakan untuk menulis jenama anda.
- **[Eksport fail](/info/exporting.html)**: unit cetakan, CMYK dan format yang digunakan untuk merender jenama anda.
