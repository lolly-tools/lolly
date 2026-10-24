# Dasar Privasi

*Dikemas kini kali terakhir: 23 Oktober 2026*

**Membuat sesuatu dalam Lolly berlaku pada peranti anda.** Membuka alat, menaip, pratonton, eksport dan menyemak fail semuanya dijalankan dalam apl pada telefon, komputer atau pelayar anda. Anda tidak memerlukan akaun, dan apl tidak menetapkan sebarang kuki untuk semua itu.

**Apa yang anda hasilkan hanya meninggalkan peranti anda apabila anda memintanya.** Menambah Google Font, menghantar fail ke Drive atau Dropbox, menghidupkan Sync, memainkan radio atau memuat turun model AI pada peranti masing-masing membuat permintaan yang anda mulakan. Apl juga mengambil alat dan kemas kini daripada alamatnya sendiri, dan permintaan itu tidak membawa apa-apa yang anda hasilkan. [Setiap permintaan rangkaian yang boleh dibuat oleh apl](#every-network-request-the-app-can-make) menyenaraikannya, hos demi hos.

**Beberapa perkhidmatan Lolly berjalan pada pelayan.** Pautan render, pengambil imej, titik akhir ejen AI dan perkhidmatan identiti disahkan hanya menerima apa yang anda hantar kepadanya, dan menyimpannya tidak lebih lama daripada yang dinyatakan dalam halaman ini.

**Instans Lolly Work organisasi anda adalah berbeza.** Ia menyimpan kerja bersama yang anda letakkan di situ, dan dasar pengendalinya terpakai pada data tersebut, bukan dasar ini.

::: figure privacy-where-data-goes
Ke mana data anda pergi: ia kekal pada peranti anda melainkan anda memulakan permintaan, dan setiap jenis permintaan mempunyai destinasinya sendiri.
:::

## Apa yang diliputi dasar ini

Lolly ialah perisian sumber terbuka yang boleh dijalankan oleh sesiapa sahaja: satu enjin, shell apl untuk web, desktop, mudah alih dan terminal, serta sambungan pelayar. Dasar ini mempunyai dua bahagian:

- <!--i:code--> **Perisian itu sendiri**: apa yang dilakukan dan tidak dilakukannya dengan data anda, di mana sahaja ia dijalankan. Ini sifat kod tersebut, jadi ia benar bagi setiap penempatan Lolly, milik kami atau milik orang lain.
- <!--i:server--> **lolly.tools**, penempatan rujukan yang dikendalikan SUSE: pilihan yang dibuat dalam menjalankan bahagian pelayannya yang pilihan, seperti apa yang dilog, untuk berapa lama dan oleh siapa.

Pada instans Lolly yang dihoskan sendiri atau perusahaan, kelakuan perisian di bawah masih terpakai, tetapi *pengendali* instans itu, bukan SUSE, bertanggungjawab ke atas apa-apa pada pelayan mereka: titik akhir render, pelayan MCP, perkhidmatan sijil dan instans Lolly Work mereka. Mintalah dasar mereka sendiri. [Adoption & Governance](/info/adoption-governance.html) menerangkan apa yang terlibat dalam mengendalikan Lolly.

## Apa yang kekal pada peranti anda

Apl web, desktop dan mudah alih Lolly menjalankan keseluruhan enjin render pada peranti. Setelah alat, aset dan pengekod yang anda gunakan berada pada peranti, render dan muat turun tidak memerlukan pelayan.

**Penggunaan apl kendiri tidak menetapkan kuki.** Log masuk organisasi dan pendaftaran identiti disahkan pilihan mempunyai kuki masing-masing, yang diterangkan dalam bahagiannya. Apl menyimpan rekod ini pada peranti:

- <!--i:sliders--> **Pilihan antara muka**: tema, bahasa, tetapan bunyi, saiz bar sisi dan zum, pilihan isihan dan paparan serta petua yang telah anda lihat, dalam `localStorage`, supaya ia sedia sebelum apl selesai bermula.
- <!--i:download--> **Cache luar talian bagi katalog alat dan pratonton aset**, supaya galeri berfungsi tanpa sambungan.
- <!--i:hash--> **Pembilang penggunaan setempat** untuk statistik kad profil anda, seperti bilangan eksport dan alat yang mana: rekod kecil yang terhad dalam `localStorage`, tidak pernah dibaca oleh kami dan tidak pernah dihantar ke mana-mana.
- <!--i:folder--> **Kerja anda sendiri**: dokumen, sesi tersimpan dan sejarahnya, imej dan fon yang dimuat naik, hasil fail dan versi terdahulu, serta Trash, yang menyimpan item yang dipadam selama 30 hari. Ini berada dalam IndexedDB pada peranti dan kekal di situ melainkan anda memilih Sync atau perkongsian.
- <!--i:globe--> **Carian bandar Meeting Planner**, dalam `localStorage`, supaya setiap bandar dicari sekali sahaja.
- <!--i:cpu--> **Model yang dimuat turun dan alat yang disemat**: model AI pada peranti yang anda setuju untuk dimuat turun dan alat yang anda semat untuk kegunaan luar talian.

**Settings → Storage** menunjukkan berapa banyak ruang yang digunakan Lolly pada peranti, dengan kerja anda, Trash, model yang dimuat turun, salinan luar talian dan cache disenaraikan satu persatu. **Clear all my data** di situ membuang salinan setempat, dan mematikan Sync dahulu; mengosongkan storan tapak dalam pelayar anda melakukan perkara yang sama. Storan yang benar-benar perlu untuk perkhidmatan yang anda minta tidak memerlukan persetujuan di bawah Arahan ePrivacy (Art. 5(3)), hanya ketelusan, iaitu apa yang disediakan oleh dokumen ini dan notis dalam apl.

![Bahagian storan dalam Settings pada skrin selebar telefon: setiap kategori data pada peranti dinamakan, dengan butang Clear all my data di sebelah senarai](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-selbar%2C.profile-row-value%2C.profile-group-value%2C%23store-hero-num%2C%23store-headroom%7Bdisplay%3Anone%7D&format=svg&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

**Export my data** menghasilkan fail `lolly-backup` yang anda simpan dan kawal. Ia tidak pernah menyentuh pelayan kami melainkan anda sendiri menghantarnya ke tempat lain. Lihat [Data transfer](/info/data-transfer.html).

### Utiliti yang berjalan pada peranti anda

Sesetengah alat, seperti **Strip Hidden Data**, **Compress** dan lain-lain yang mempunyai lencana **Runs on your device**, berfungsi pada fail yang anda sediakan. Fail dibaca ke dalam memori, diubah pada peranti dan ditawarkan semula sebagai muat turun. Ia tidak pernah dimuat naik, kerana tiada pelayan dalam laluannya. Utiliti ini berfungsi luar talian, dan outputnya tidak membawa tera air atau metadata daripada kami.

**Rondocode** ialah satu-satunya pengecualian, kerana ia menghasilkan audio baharu daripada lagu anda dan bukan mengubah fail milik anda. Setiap fail audio yang ditulisnya membawa Content Credentials yang merekodkan lagu itu dan mengisytiharkan sebarang nyanyian yang dijana AI. Panel Export menyatakannya sebelum anda mengeksport, dan [Rondocode songs](/info/rondocode.html#files-from-the-rondocode-utility) menyenaraikan dengan tepat apa yang direkodkan.

![Lencana yang dibawa oleh alat ini: Runs on your device - tiada apa-apa dimuat naik](/t/url-shot?url=%2F%23%2Ftool%2Ftext-helper&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%5Bdata-privacy%5D&dark=1&filename=pv-ondevice-badge)

**Prepare for sharing** dan **Compare** berfungsi dalam memori pada peranti dan tidak menghantar apa-apa ke pelayan, dan Prepare tidak menambah apa-apa pada sejarah, pautan, sandaran atau Sync sehingga anda menyimpan hasil.

::: details Cara Prepare for sharing dan Compare mengendalikan fail anda
**Prepare for sharing** menyimpan input kerja, penemuan peribadi dan peta penggantian dalam memori, tanpa menambahnya pada sejarah, pautan, sandaran atau Sync. Pemeriksaan dan penggantian tidak menghantar kandungan fail ke pelayan dan tidak menyemak sebarang bukti kelayakan dalam talian. Anda memilih sama ada untuk menyalin, memuat turun, menghantar atau menyimpan hasil ke pustaka anda; hasil yang disimpan kemudian mengikut tetapan sandaran dan Sync pustaka anda. Fail resipi tidak menyertakan kandungan terdahulu dan pemetaan literal, dan laporan ringkasan mengandungi kiraan, ID skop dan cincangan fail. CLI menyimpan fail semakan peribadi dengan nilai asal hanya apabila diminta dengan `--review-file`. Meninggalkan paparan penyediaan akan melepaskan keadaan kerjanya, yang bukan janji pemadaman forensik daripada memori pelayar atau sistem pengendalian.

Salinan yang disediakan dan operasi fail yang selesai berkongsi kawalan Compare. Nilai yang dibuang bermula dalam keadaan runtuh, dan laporan perbandingan tidak menyertakan nama sumber, laluan dan nilai melainkan anda memilih untuk menyertakannya. Sejarah fail menyimpan salinan itu, jadi membandingkan selepas muat semula bermakna memilih semula fail asal, dipadankan mengikut SHA-256 yang direkodkan. Memilihnya tidak menyimpan atau memuat naik fail itu.
:::

Strip Hidden Data dan Prepare for sharing juga memeriksa fail DOCX, PPTX dan XLSX pada peranti. Fail DOCX yang disokong boleh dibuang sifat tertentu dalam salinan baharu; kandungan Office lain hanya untuk diperiksa, dan pratonton peribadi kekal di sebalik kawalan dedah.

::: details Apa yang dibaca dan dibuang oleh pemeriksaan Office
| Format Office | Kandungan pakej yang diperiksa | Pembuangan disokong |
|---|---|---|
| DOCX | Sifat teras, aplikasi dan tersuai; komen dan pengarang; penanda dan pratonton perubahan yang dijejak; larian teks tersembunyi; perhubungan luaran; objek terbenam | Pengarang terpilih, disimpan terakhir oleh, tarikh dicipta/diubah suai/dicetak terakhir, tajuk, subjek, penerangan, kata kunci, sifat tersuai, Company, Manager, Template, asas hiperpautan, nama dan versi aplikasi, serta statistik (jumlah masa menyunting dan kiraan halaman, perkataan, aksara, baris dan perenggan) |
| PPTX | Sifat; komen dan rekod pengarang; nota penutur; penanda slaid tersembunyi; perhubungan luaran; objek terbenam dan buku kerja bersarang yang disokong | Tiada |
| XLSX | Sifat; komen dan nota; penanda helaian, baris dan lajur tersembunyi; nama ditakrifkan; perhubungan dan sambungan luaran; permukaan pautan luaran dan cache pivot; objek terbenam | Tiada |

**Had.** Banci tidak memeriksa sepenuhnya teks yang kelihatan, formula, kebergantungan, rupa yang dirender atau bahagian binari sewenang-wenangnya. Ia menyokong sehingga 300 bahagian pakej, 64 MiB jumlah pengembangan yang diisytiharkan, 2 MiB bagi setiap bahagian XML dan dua peringkat bersarang pakej terbenam; Prepare berkongsi belanjawan bahagian dan pengembangan merentas keseluruhan tugasan. Kandungan yang dipotong, cacat, disulitkan dan tidak disokong dilaporkan dan dikekalkan. Kandungan makro dikenal pasti dan tidak pernah dijalankan, format binari Office lama dan XLSB tidak diperiksa, dan rujukan luaran tidak pernah diambil.

**Apa yang dikekalkan oleh pembersihan DOCX.** Pembersihan menyokong format pakej DOCX transitional dengan bahagian sifat teras, tersuai dan lanjutan yang kanonik. Daripada sifat lanjutan, Company, Manager, Template, HyperlinkBase, Application, AppVersion dan statistik TotalTime, Pages, Words, Characters, CharactersWithSpaces, Lines dan Paragraphs boleh dibuang. DocSecurity, tajuk pengepala dan bahagian, bendera pautan dan sifat aplikasi lain dikekalkan. Membuang Template meninggalkan sebarang pautan templat yang dilampirkan dalam tetapan dokumen, di mana banci melaporkannya sebagai perhubungan luaran.

Sesetengah pembaca memilih cara melukis carta dan lukisan berdasarkan nama dan versi aplikasi; LibreOffice, sebagai contoh, memaparkan carta daripada fail Word 2007 secara berbeza tanpanya. Kedua-duanya dikekalkan apabila fail mengandungi carta, gambar, bentuk atau objek terbenam, dan pemeriksaan menyenaraikannya sebagai dikekalkan. Sifat yang ditunjukkan oleh medan Word (TEMPLATE, EDITTIME, NUMPAGES, NUMWORDS atau NUMCHARS) dikekalkan, dan medan pautan serta pautan luaran relatif mengekalkan HyperlinkBase, kerana sasarannya diselesaikan terhadap alamat asas tersebut.

**Apa yang kekal untuk diperiksa sahaja.** Data tandatangan digital lanjutan menghalang pembersihan. Pakej Office yang ditandatangani, dibenarkan makro, disulitkan, cacat, dinamakan semula atau bersarang kekal untuk diperiksa sahaja. Begitu juga fail dengan medan Word lain yang bergantung pada sifat, seperti DOCPROPERTY atau AUTHOR, atau dengan kawalan kandungan terikat XML, kerana membuang sifat boleh mengubah dokumen apabila Word mengemas kini ikatan tersebut, dan teks medan yang dicache tidak dapat menunjukkan bahawa perenderan seterusnya akan kelihatan sama. Bahagian XML dengan sambungan nama fail luar biasa, sasaran perhubungan XML Word yang tidak dapat diperiksa dengan selamat, bahagian pengepala atau pengaki yang diisytiharkan secara salah dan bahagian SVG yang diisytiharkan sebagai XML dengan sambungan `.svg` juga kekal untuk diperiksa sahaja dalam keluaran pembersihan pertama ini.

**Cara pembersihan menyemak kerjanya.** Bahagian sifat, pengisytiharannya, ahli pakej yang tidak berkaitan, komen XML dan komen ZIP dikekalkan. Pembersihan menggunakan had banci dan menyemak integriti setiap ahli sebelum menulis, kemudian memeriksa semula sifat yang terhasil. Compare menunjukkan perbezaan sifat yang disokong dengan nilai diruntuhkan; ia tidak membandingkan teks yang kelihatan atau rupa yang dirender. Nilai menggunakan pratonton sehingga 2048 aksara, jadi perbezaan di luar pratonton mungkin tidak ditunjukkan, dan semakan separa tidak dapat menentukan bahawa dua fail adalah sama. `prepare --strip-hidden-data` CLI membuang sifat DOCX yang disokong, dan sampul semakan peribadi boleh memilih sifat secara individu. Pengawal pembersihan yang gagal mengekalkan fail dan melaporkan operasi yang gagal.
:::

## Setiap permintaan rangkaian yang boleh dibuat oleh aplikasi

Kebanyakan permintaan membawa alat, fon atau model ke peranti anda. Tindakan Send menghantar fail yang anda pilih, Sync menghantar sandaran ke storan yang anda pilih, dan perkhidmatan organisasi menghantar kandungan atau butiran yang diperlukan untuk kerja bersama. Setiap kumpulan di bawah menyenaraikan apa yang meninggalkan peranti anda, bila, dan apa yang berlaku jika pengendali menyekat permintaan itu. Penyedia identiti dan aset yang dikonfigurasikan oleh pengendali boleh menambah destinasi pada penempatan tersebut. [Every fixed host, in one table](#every-fixed-host-in-one-table) menyenaraikan hos yang boleh dihubungi oleh apl web.

::: details Perkara yang diambil ke peranti anda
- <!--i:download--> **Katalog alat.** Tiada apa-apa yang peribadi: permintaan untuk indeks alat dan aset awam Lolly sendiri, ke alamat apl itu sendiri, semasa permulaan dan kemudian dicache untuk luar talian. Jika disekat, apl berjalan menggunakan alat yang dicache dan berhenti menemui yang baharu.
- <!--i:sparkle--> **Set emoji.** Set yang anda pilih dimuat turun daripada alamat apl itu sendiri kali pertama anda menggunakan set itu. Tiada apa-apa yang peribadi dihantar. Animasi Lottie dibaca pada peranti dan tidak menghubungi sesiapa.
- <!--i:document--> **Google Fonts.** Nama keluarga yang dipilih dan alamat IP anda dihantar ke pelayan fon Google (`fonts.googleapis.com` untuk helaian gaya, `fonts.gstatic.com` untuk fail fon). Ini berlaku hanya apabila anda menambah Google Font dalam Design System Setup, dan hanya selepas anda bersetuju dalam dialog yang menyatakan perkara ini dengan tepat. Setiap keluarga diambil sekali, kemudian disimpan pada peranti dan digunakan luar talian. Jika disekat, pemilih gagal tertutup; muat naik fail fon sebagai gantinya.
- <!--i:cpu--> **Model AI pada peranti.** Tiada apa-apa yang peribadi: muat turun fail model, kemudian disimpan pada peranti. Binaan web menggunakan alamat apl itu sendiri secara lalai; sesuatu binaan boleh menamakan hos model lain, seperti hos keluaran Lolly `lolli.li` untuk apl berpakej. Hos menerima permintaan dan alamat IP anda, tanpa akaun dan tanpa input model. Ini berlaku hanya apabila anda menggunakan ciri yang memerlukan model (imbasan mendalam Verify, penskalaan imej, pertuturan dan seumpamanya) atau memilih untuk memuat turun model untuk kegunaan luar talian. Jika disekat, ciri itu menunggu dan semua yang lain berfungsi.
- <!--i:sliders--> **Profil cetak ICC.** Tiada apa-apa yang peribadi: permintaan untuk profil keadaan percetakan standard ke daftar awam ICC (`registry.color.org`, `www.color.org`), hanya apabila anda mengklik pratetap ICC dalam pengurus profil cetak, sekali bagi setiap profil. Jika disekat, pratetap gagal; sediakan profil `.icc` anda sendiri.
- <!--i:globe--> **Radio internet.** Tiada apa-apa yang peribadi: permintaan senarai main dan strim audio daripada stesen (`api.somafm.com` dan pelayan strim yang ditunjukkannya, `*.somafm.com`), hanya semasa anda memainkan radio pilihan dalam pemain bunyi. Jika disekat, radio gagal dan setiap ciri bunyi lain berfungsi.
:::

::: details Alat yang memerlukan data langsung
- <!--i:globe--> **Carian bandar Meeting Planner.** Setakat ini ini satu-satunya alat yang mengambil data langsung. Ia meminta `geocoding-api.open-meteo.com` menukar setiap nama bandar (bandar hos dan bandar setiap ahli pasukan) kepada koordinat dan zon waktu, tanpa akaun, tanpa kunci dan tanpa pengecam selain permintaan itu sendiri. Input Host city menerangkan perkara ini, dan setiap jawapan disimpan pada peranti supaya sesebuah bandar dicari sekali sahaja. Ia berjalan hanya semasa alat dibuka. Jika disekat, carian gagal dan tiada perkara lain terjejas.
:::

::: details Fail yang anda hantar
Setiap satu ini hanya menghantar satu fail yang anda pilih, apabila anda menekan butang Send-nya, selepas log masuk yang anda selesaikan dalam tetingkap perkhidmatan itu sendiri. Kata laluan apl Bluesky, alamat webhook Discord, kata laluan apl Nextcloud dan kunci S3 disimpan pada peranti ini sahaja, tidak pernah dalam sandaran, dan **Disconnect** memadamkannya.

- <!--i:upload--> **Google Drive.** Fail, dalam apa-apa format, dihantar ke API Drive Google (`www.googleapis.com`). Akses Lolly terhad kepada fail yang dicipta olehnya (skop `drive.file`), jadi ia tidak boleh membaca bahagian lain Drive anda. Dalam apl web, token log masuk disimpan dalam memori untuk sesi dan tidak pernah disimpan; dalam apl lain, token muat semula disimpan pada peranti ini hanya jika anda menanda **Stay connected**. Butang itu wujud hanya pada binaan di mana pengendali mengkonfigurasi id klien Google. Jika disekat, butang tidak pernah muncul; muat turun fail dan muat naik sendiri.
- <!--i:upload--> **Dropbox.** Fail dihantar ke API Dropbox (`api.dropboxapi.com` untuk log masuk dan metadata, `content.dropboxapi.com` untuk fail). Akses hanya untuk folder apl, jadi Lolly melihat `Apps/` dan folder miliknya di situ dan tiada yang lain. Pautan **Open** yang ditunjukkannya ialah pautan peribadi jangka pendek, dan tiada perkongsian awam dicipta. Token muat semula disimpan hanya jika anda menanda **Stay connected**. Butang itu wujud hanya dengan id klien Dropbox yang dikonfigurasi pengendali.
- <!--i:upload--> **OneDrive.** Fail dihantar ke perkhidmatan identiti dan Graph Microsoft (`login.microsoftonline.com` untuk log masuk, `graph.microsoft.com` untuk muat naik); fail besar dimuat naik secara berketul ke `api.onedrive.com` atau asal storan yang dikonfigurasi pengendali. Akses terhad kepada folder Lolly sendiri di bawah `Apps/`, serta nama paparan anda untuk label akaun. Token muat semula disimpan hanya jika anda menanda **Stay connected**. Butang itu wujud hanya dengan id klien Microsoft yang dikonfigurasi pengendali.
- <!--i:upload--> **LinkedIn**, dalam **apl desktop sahaja**. Fail, dengan namanya sebagai teks siaran, dihantar ke LinkedIn (`www.linkedin.com` untuk log masuk dalam pelayar anda sendiri, `api.linkedin.com` untuk muat naik dan siaran) sebagai siaran awam pada suapan anda sendiri. Lolly boleh menyiarkan sebagai anda dan membaca nama anda untuk label akaun, tiada yang lain. Log masuk disimpan hanya jika anda menanda **Stay connected**, dan token LinkedIn bertahan 60 hari serta tidak boleh diperbaharui secara senyap, jadi ia luput dengan sendirinya. Hos tersebut tiada dalam dasar sambungan apl web. Butang itu wujud hanya pada binaan dengan apl LinkedIn dikonfigurasi.
- <!--i:upload--> **Penpot.** Token akses peribadi Penpot anda, yang anda tampal ke dalam apl, dan arkib `.penpot` bagi reka bentuk dihantar ke API Penpot (`design.penpot.app`) melalui laluan lalu kecil pada alamat apl itu sendiri (`/api/penpot`), kerana API Penpot tidak akan menjawab pelayar secara terus. Laluan lalu itu memajukan dan melupakan; apl desktop bercakap dengan Penpot secara terus. Ini berlaku hanya apabila anda menekan **Send to Penpot** dalam alat Design dan mengesahkan projek. Jika disekat, penghantaran gagal tertutup; eksport fail `.penpot` dan import sendiri.
- <!--i:upload--> **Bluesky.** Imej, namanya sebagai teks siaran dan teks alt, serta pengendali dan kata laluan apl anda (dibuat di bawah Bluesky → Settings → App passwords, tidak pernah kata laluan akaun anda) dihantar ke pelayan Bluesky yang anda namakan, `bsky.social` melainkan anda memilih yang lain. Anda menyambungkan akaun dahulu dalam **Settings → Connected services**.
- <!--i:upload--> **Discord.** Fail dihantar sebagai lampiran ke alamat webhook saluran yang anda tampal, pada discord.com. Sesiapa yang memegang alamat webhook boleh menyiar ke saluran itu, itulah sebabnya ia kekal pada peranti.
- <!--i:upload--> **Mastodon.** Fail, dengan namanya sebagai teks siaran, dihantar ke pelayan Mastodon atau yang serasi yang anda namakan, selepas log masuk dalam tetingkap pelayan itu sendiri. Menyambung mendaftarkan apl kecil untuk peranti ini pada pelayan itu, dan log masuk disimpan hanya jika anda menanda **Stay connected**.
- <!--i:upload--> **Nextcloud atau WebDAV.** Fail dihantar ke pelayan anda sendiri dalam satu muat naik disahkan, dengan alamat pelayan, nama pengguna dan kata laluan apl yang anda masukkan (Nextcloud → Settings → Security → Devices & sessions; tidak pernah kata laluan akaun anda).
- <!--i:upload--> **Storan serasi S3.** Fail dihantar ke baldi anda sendiri (AWS S3, MinIO, R2, B2, Garage atau mana-mana titik akhir SigV4), ditandatangani pada peranti dengan pasangan kunci yang anda masukkan.

**Hos yang anda pilih memerlukan kelulusan pengendali.** Hos Bluesky, Discord, Mastodon, Nextcloud dan S3 tiada dalam senarai tetap Lolly, kerana anda memilihnya. Apl tidak menghantar apa-apa kepada mana-mana sehingga pengendali telah meluluskan hos HTTPS yang tepat itu: pada web, dalam Content Security Policy penempatan; dalam apl desktop, semasa apl dibina. Perkara yang sama terpakai pada hos storan tersuai dan muat naik SharePoint. Pada web, pelayan juga mesti membenarkan panggilan pelayar daripada apl (CORS), dan ubah hala gagal tertutup, jadi gunakan alamat yang tidak mengubah hala. Apl desktop menyemak setiap ubah hala terhadap senarai yang diluluskan.

Senarai ini mengehadkan hos yang boleh dicapai oleh apl. Ia tidak membezakan akaun atau penyewa pada Google atau Microsoft, dan kebenaran penyedia itu sendiri menentukan akaun dan tindakan yang dibenarkan. Ia juga tidak meliputi tetingkap log masuk, jenis sumber lain atau ciri natif, yang mempunyai peraturan tersendiri. Perubahan memerlukan binaan desktop baharu atau pengepala respons web baharu; simpan kerja anda sebelum membuka semula apl untuk menerimanya. [Connector origins](/info/connector-origins.html) menerangkan konfigurasi.
:::

::: details Sync merentas peranti anda
- <!--i:folder--> **Apa yang keluar.** Salinan apa yang anda hasilkan pada peranti ini (sesi dan projek tersimpan, sistem reka bentuk anda dengan fon dan logonya, imej yang dimuat naik, profil dan pilihan anda) sebagai satu fail, ke satu storan yang anda pilih: folder apl Lolly dalam Dropbox anda (`api.dropboxapi.com`, `content.dropboxapi.com`), fail yang dicipta Lolly dalam Google Drive anda (`www.googleapis.com`), folder apl Lolly dalam OneDrive anda (`graph.microsoft.com`, dengan fail lebih besar dimuat naik ke `api.onedrive.com` atau asal storan yang dikonfigurasi pengendali, dan muat turun daripada asal storan tepat yang dikonfigurasi pengendali), atau Nextcloud, pelayan WebDAV atau baldi S3 anda sendiri. Storan yang sama menyimpan sehingga tujuh salinan harian dan satu salinan daripada sebelum penggunaan terakhir anda.
- <!--i:shieldcheck--> **Tiada apa-apa dihantar ke Lolly.** Tiada pelayan Lolly, geganti atau pelayan Lolly Work dalam laluan, dan apl tidak memerlukan laman web Lolly untuknya, malah tidak untuk log masuk. Salinan disulitkan pada peranti terlebih dahulu hanya jika anda menetapkan frasa laluan. Log masuk, kunci, kata laluan apl, frasa laluan dan tetapan Sync kekal pada peranti dan tidak pernah ada dalam salinan. Pada web, sambungan Google Drive yang diingat hanya menyimpan nama akaun anda (dan id klien anda sendiri, jika anda memberikannya), dan log masuk Google bertahan satu lawatan. Dalam apl Android, log masuk Google Drive melalui Google Play services pada telefon, yang dijalankan oleh Google.
- <!--i:sliders--> **Bila.** Hanya selepas anda menghidupkan **Sync across my devices** atau menekan **Sync now**: muat naik sejurus selepas setiap perubahan dan apabila anda meninggalkan apl, serta semakan untuk salinan lebih baharu apabila apl bermula. Jika disekat, Sync gagal dan memberitahu sebabnya, dan kerja anda kekal pada peranti. Anda boleh mengeksport data anda ke fail dan memindahkannya sendiri sebagai gantinya. [Sync your devices](/info/sync.html) meliputi ciri ini.
:::

::: details Halaman web, tangkapan dan gambar daripada tapak lain
- <!--i:monitor--> **URL yang anda minta alat tangkap.** Alat tangkapan skrin URL meminta alamat tepat yang anda taip, hanya apabila anda memulakan tangkapan. Oleh kerana anda memilih alamat pada ketika itu, ia tiada dalam dasar sambungan, dan pengendali tidak boleh membenarkan atau menyekatnya mengikut hos; untuk membuangnya, buang alat itu.
- <!--i:globe--> **Halaman web dalam kotak Design.** Halaman diminta, dengan alamat IP anda, daripada tapak asalnya, bersama apa sahaja yang diminta oleh halaman itu sendiri. Di mana pelayar menyokongnya, bingkai dihantar tanpa kuki dan tanpa alamat selain asal apl itu sendiri, jadi dokumen anda dan pautannya tidak pernah bergerak bersama permintaan. Pada apl web hanya pemain ini yang boleh dibingkaikan: `www.youtube-nocookie.com`, `player.vimeo.com`, `www.loom.com`, `www.google.com` (peta) dan `www.figma.com`, serta halaman rujukan di `wikipedia.org` dan `*.wikipedia.org`, `commons.wikimedia.org`, `upload.wikimedia.org`, `www.wikidata.org`, `www.mediawiki.org` dan `www.openstreetmap.org`. **Allow pages from any site**, di bawah **Settings → Trusted sites**, memuatkan semula Lolly pada peranti anda di bawah dasar yang boleh membingkaikan mana-mana halaman `https:`, dan peraturan yang sama tentang kepercayaan dan bertanya masih terpakai. Halaman dimuatkan hanya untuk tapak dalam Trusted sites anda, termasuk lalai rujukan yang boleh dibuang, atau selepas anda meluluskan kotak itu dalam inspektornya; dek yang dihantar seseorang kepada anda menunjukkan gambar setiap halaman sehingga itu. Sebelum anda membentang, senarai menawarkan **Just this time** dan **Always trust** untuk setiap tapak, dan tiada apa-apa ditanya semasa anda membentang. Jika disekat, kotak menunjukkan gambarnya dengan pautan untuk membuka halaman dalam tab baharu. Alat Lolly dan demo Sandbox dalam kotak berjalan pada alamat apl itu sendiri dan tidak menghubungi sesiapa.
- <!--i:sliders--> **Mengubah halaman yang anda tunjukkan.** Tindakan **Use page** pada kotak halaman web membolehkan anda menolak kuki atau menutup sepanduk dalam halaman. Untuk halaman Lolly yang boleh diakses, **Hide cookie banners** menyembunyikan tindihan yang diketahui, termasuk OneTrust, tanpa menerima kuki atau mengubah pilihan persetujuan tapak. **Page CSS** mengubah halaman langsung dan persembahan kotak itu; eksport masih menggunakan poster yang dipilih. Peraturan tidak boleh mengimport sumber atau fon, dan pelayar menghalang Lolly daripada mengubah CSS tapak lain. Pratonton Sandbox mempunyai penyunting CSS sendiri di bawah **Edit in Sandbox**.
- <!--i:code--> **Sumber web demo Sandbox.** Setiap helaian gaya, skrip, fon atau imej yang dipautkan oleh kod demo diminta, dengan alamat IP anda dan tanpa kuki, daripada tapak yang menghoskannya; fail yang dinamakan oleh helaian gaya yang diambil, seperti fail fon Google Fonts, dikira sebagai tapak berasingan. Ini berlaku hanya selepas anda mengklik **Fetch & inline**, atau untuk tapak dalam Trusted sites anda; **Always trust** di sebelah fail menambah tapaknya pada senarai itu. Jika disekat, demo berjalan tanpa fail tersebut, dan Sandbox menyenaraikan setiap fail yang tidak dapat diambil beserta sebabnya.
- <!--i:download--> **Menambah imej daripada URL.** **Add from URL** dalam pemilih aset atau Assets meminta alamat imej tepat yang anda tampal. Dasar apl web sendiri menghalang pelayar daripada mengambil tapak lain secara terus, jadi laluan lalu kecil pada alamat apl itu sendiri (`/api/fetch-image`) mengambil imej dan menyerahkan semula hanya bait; ia tidak menyimpan apa-apa, melupakan alamat dan menolak apa-apa yang bukan alamat imej awam. Apl desktop mengambil alamat secara terus. Pautan Lolly yang anda tampal tidak diambil langsung: ia dirender pada peranti. Jika pengendali mematikan laluan lalu (`LOLLY_DISABLE_IMAGE_PROXY=1`), hanya pautan Lolly, imej `data:` dan imej asal sama boleh ditambah dalam apl web, dan apl desktop tidak terjejas.
- <!--i:palette--> **Sistem reka bentuk daripada laman web.** Design System Setup boleh membaca satu halaman tapak yang anda namakan, melalui [sambungan pelayar](#the-browser-extension) atau pengambilan apl desktop sendiri, tidak pernah melalui pelayan Lolly. Tiada apa-apa diambil sebelum anda menekan, dan pautan pada halaman tidak diikuti.
:::

::: details Bekerja bersama orang lain dan ejen
- <!--i:link--> **Collab peribadi.** Dua peranti bersambung secara terus, tanpa pelayan di tengah. Jemputan dan balasan membawa alamat yang boleh dilihat oleh setiap peranti pada rangkaiannya sendiri, dan binaan ini tidak mengkonfigurasi pelayan penemuan alamat luar, jadi berikannya hanya kepada orang yang anda bekerja bersama. Lihat [Working together](/info/collaborate.html).
- <!--i:monitor--> **Nearby**, dalam apl desktop. Semasa anda kelihatan, iaitu sepuluh minit apabila anda memulakan jemputan collab atau, jika anda menghidupkannya, setiap kali apl berjalan, apl mengumumkan nama rawak, nama paparan yang anda pilih dan jenis peranti pada rangkaian setempat. Ia tidak mengumumkan alamat e-mel, akaun atau pengecam kekal.
- <!--i:link--> **Jemput ejen.** Keadaan dokumen yang dijemput, pratonton yang diminta ejen, identiti ejen dan suntingannya melalui geganti langsung yang dikonfigurasi (`lolly.ing` pada lolly.tools) kepada ejen yang anda jemput. Pemalam terhos yang dipasang juga memajukan panggilan melalui penyambung lolly.tools ke geganti yang dipilih oleh jemputan; penyambung tidak menyimpan jemputan atau dokumen antara panggilan. Geganti menyimpan jemputan dan permintaan tertunggak dalam memori sehingga anda memutuskan sambungan atau ia tamat tempoh: sepuluh minit bagi jemputan yang tidak digunakan dan tiga puluh minit tanpa aktiviti bagi jemputan yang telah disertai. Penyedia ejen anda mengendalikan data yang diterimanya di bawah dasarnya sendiri. Ini berlaku hanya selepas anda mencipta jemputan dalam Share dan memberikan arahannya kepada ejen anda; akses baca membenarkan pemeriksaan dan akses sunting juga membenarkan perubahan. Pause menghentikan perubahan, dan Disconnect atau membatalkan jemputan menamatkan akses. Jika disekat, ejen tidak boleh menyertai atau meneruskan, dan anda terus menyunting.
- <!--i:cpu--> **Allow AI control**, dalam apl desktop. Ejen yang berjalan pada komputer ini boleh membaca dan menyunting dokumen Design yang terbuka melalui sambungan yang kekal pada komputer. Ia mati sehingga anda menghidupkannya. Lolly tidak menghantar apa-apa ke pelayan untuknya; penyedia ejen mengendalikan apa yang dibaca ejen di bawah dasarnya sendiri. [Threat Model & Trust Boundaries](/info/threat-model.html) menyenaraikan apa yang boleh dan tidak boleh dilakukan oleh ejen sedemikian.
- <!--i:server--> **Instans jauh.** Apabila anda mengarahkan apl ke penempatan Lolly lain, ia menerima apa sahaja yang dihidangkan semula oleh instans itu, melalui penyegerakan katalog yang sama, serta teg versi pada permintaan kepadanya (jenis apl dan versi enjin, maklumat yang sama dibawa oleh ejen pengguna), supaya pengendalinya dapat melihat versi Lolly yang digunakan. Pada instans terurus, semasa anda log masuk, teg itu juga membawa id pemasangan untuk peranti ini, supaya senarai peranti pengendali dapat membezakan pemasangan; keluar memadamkan id itu, dan peranti yang menyambung semula kemudian membentangkan id baharu. Anda memilih hos, jadi ia tiada dalam dasar sambungan. Jika disekat, penukaran gagal dan instans setempat anda tidak terjejas.
- <!--i:people--> **Instans Lolly Work organisasi anda.** Identiti log masuk dan maklumat peranti, permintaan dasar, sesi dikongsi, suntingan kolaborasi, muat naik, penyerahan kelulusan dan fail penghantaran yang anda gunakan, serta label peristiwa penggunaan yang dibenarkan jika dikonfigurasi, dihantar ke instans organisasi anda, dengan log masuk melalui penyedia identitinya. Penyegaran dasar dan telemetri yang diaktifkan boleh berjalan semasa penggunaan; kerja dikongsi, collab, semakan dan penghantaran menghantar kandungan sebagai sebahagian daripada aliran kerja itu. Jika disekat, ciri organisasi tersebut tidak dapat diselesaikan, dan kerja peribadi anda kekal berasingan. Lihat [Organisation services with Lolly Work](#organisation-services-with-lolly-work).
:::

### Setiap hos tetap, dalam satu jadual

Content Security Policy apl web ialah apa yang menghalang skrip daripada mencapai mana-mana hos yang tidak disenaraikannya. Selain alamat apl itu sendiri, jadual ini memberikan setiap hos yang disenaraikan oleh dasar itu, serta dua hos LinkedIn yang ditambah oleh apl desktop, ditandakan sebagai desktop sahaja. Ujian CI menyemak jadual ini terhadap dasar yang ditempatkan, jadi hos tidak boleh ditambah pada satu tanpa yang lain.

| Apa | Apa yang sebenarnya meninggalkan peranti anda | Hos |
|---|---|---|
| Model pada peranti dalam apl berpakej, dan fail keluaran | Permintaan untuk fail awam, dengan alamat IP anda | `lolli.li` |
| Google Fonts | Nama keluarga fon dan alamat IP anda | `fonts.googleapis.com`, `fonts.gstatic.com` |
| Send to dan Sync dengan Google Drive | Fail atau sandaran yang anda pilih | `www.googleapis.com` |
| Send to dan Sync dengan Dropbox | Fail atau sandaran yang anda pilih | `api.dropboxapi.com`, `content.dropboxapi.com` |
| Send to dan Sync dengan OneDrive | Fail atau sandaran yang anda pilih, dan nama paparan anda untuk label akaun | `login.microsoftonline.com`, `graph.microsoft.com`, `api.onedrive.com` |
| Carian bandar Meeting Planner | Setiap nama bandar | `geocoding-api.open-meteo.com` |
| Profil cetak ICC | Permintaan untuk profil awam | `registry.color.org`, `www.color.org` |
| Radio internet | Permintaan senarai main dan strim audio | `api.somafm.com`, `*.somafm.com` |
| Jemput ejen, dan ruang kerja lolly.ing | Keadaan, pratonton dan suntingan dokumen yang dijemput, dan permintaan ruang kerja yang anda buat | `lolly.ing` |
| Pemain dalam kotak web Design | Permintaan untuk halaman, dengan alamat IP anda | `www.youtube-nocookie.com`, `player.vimeo.com`, `www.loom.com`, `www.google.com`, `www.figma.com` |
| Halaman rujukan dalam kotak web Design | Permintaan untuk halaman, dengan alamat IP anda | `wikipedia.org`, `*.wikipedia.org`, `commons.wikimedia.org`, `upload.wikimedia.org`, `www.wikidata.org`, `www.mediawiki.org`, `www.openstreetmap.org` |
| Send to LinkedIn, dalam apl desktop sahaja | Fail, dengan namanya sebagai siaran awam | `www.linkedin.com`, `api.linkedin.com` |

Senarai apl desktop sendiri juga termasuk titik akhir token Google untuk log masuk Drive. Mana-mana hos lain, seperti pelayan Mastodon atau Nextcloud yang anda namakan, memerlukan kelulusan pengendali, seperti yang diterangkan di bawah Fail yang anda hantar. Hos yang anda pilih pada saat penggunaan, seperti URL yang anda tangkap atau instans jauh yang anda namakan, tidak muncul dalam mana-mana senarai.


**Tandatangan SEAL tidak membuat sebarang permintaan.** Verify boleh menyemak tandatangan SEAL, satu skim yang kunci penandatangannya boleh diterbitkan dalam DNS. Pelayar tidak boleh membuat pertanyaan DNS, jadi carian web perlu melalui penyelesai DNS-over-HTTPS pihak ketiga, yang akan melihat domain yang disemak dan alamat IP anda. Lolly dahulu menggunakan penyelesai Cloudflare; ia tidak lagi berbuat demikian, dan tiada apa-apa menggantikan Cloudflare. Tiada apl Lolly mencari kunci SEAL pada masa ini: apl desktop dan mudah alih menjalankan paparan Verify yang sama, dan `lolly validate` baris perintah tidak menyemak SEAL. Fail yang rekod SEAL-nya membawa kuncinya secara sebaris disemak luar talian, dan Verify menyatakan tandatangan itu konsisten secara dalaman tanpa mengesahkan domain. Fail yang kuncinya hanya wujud dalam DNS menunjukkan **SEAL signature did not verify**, dengan sebab "no key resolver and no inline key".

![Skrin Verify: sasaran seret lepas dan tiada yang lain - fail disemak di tempatnya berada, tanpa muat naik dan tanpa akaun](/t/url-shot?url=%2F%23%2Fverify&width=1440&height=900&dpi=192&waitMs=1400&walker=1&format=svg&cropSelector=.valid-layout&dark=1&filename=cc-verify-drop)

Anda boleh menyemak ini dan setiap dakwaan lain pada halaman ini sendiri: [Verify It Yourself](/info/verify-yourself.html) memberikan perintah dan output yang dijangka.

## Perkhidmatan yang dijalankan lolly.tools

Ini berjalan pada lolly.tools untuk semua orang. Setiap satu hanya menerima apa yang anda hantar. [Server Surface](/info/server-surface.html) menerangkan komponen yang sama seperti ia berfungsi pada mana-mana penempatan.

### Pautan render

Setiap URL `https://lolly.tools/tool/<tool-id>.<ext>?<inputs>` dirender sebenarnya, dan inputnya dibawa dalam URL, jadi pautan Lolly yang dikongsi boleh muncul sebagai imej langsung dalam README, wiki atau papan pemuka. Mengambil satu meminta pelayan merender **data alat dan katalog awam** dengan input yang ditulis ke dalam alamat.

- <!--i:usercheck--> **Tiada akaun, tiada kuki, tiada keadaan.** Laluan ini tidak meminta log masuk, dan tiada apa-apa pada peranti anda dibaca. Dokumen, sesi dan muat naik anda tidak pernah meninggalkan pelayar anda dan tidak boleh muncul dalam pautan ini.
- <!--i:document--> **URL itu sendiri direkodkan.** Rentetan pertanyaan URL ialah sebahagian daripada permintaan, jadi ia muncul dalam log akses biasa platform pengehosan seperti mana-mana laluan yang diminta. Jika input pautan mengandungi nama atau alamat e-mel seseorang, seperti lencana nama atau tandatangan e-mel, **teks itu terdapat dalam log tersebut**. Berikan pautan render hanya apa yang anda sanggup letakkan pada halaman awam.
- <!--i:globe--> **Input itu awam pun.** Ia ialah apa sahaja yang ditaip pengarang pautan ke dalam URL, boleh dibaca oleh sesiapa yang dicapai pautan itu. Jangan letakkan rahsia dalam pautan yang dikongsi; Lolly menawarkan penyulitan pautan untuk kandungan sensitif.
- <!--i:eyeoff--> **Dicache, dihadkan dan tidak diindeks.** Respons dicache dan dihadkan kadarnya seperti mana-mana imej awam, dan ditandakan `noindex` supaya enjin carian tidak menyertakan render anda.

Penempatan dihos sendiri yang tidak mahukan laluan render awam menetapkan `LOLLY_DISABLE_RENDER_GET=1`, dan setiap satu URL ini memulangkan 404.

### Pengambil imej dan laluan lalu Penpot

**Add from URL** dalam apl web dan **Send to Penpot** menggunakan dua laluan lalu kecil pada lolly.tools, diterangkan di bawah [Every network request the app can make](#every-network-request-the-app-can-make). Pengambil imej tidak menyimpan apa-apa dan melupakan alamat. Laluan lalu Penpot memajukan token dan arkib anda kepada Penpot dan tidak menyimpan kedua-duanya; ia melog nama perintah dan status respons Penpot.

### Pelayan MCP, untuk ejen AI

Ejen AI boleh mencapai Lolly melalui Model Context Protocol, melalui titik akhir yang dijalankan oleh pengendali. lolly.tools menjalankan satu, dan sesiapa sahaja boleh menjalankan sendiri, termasuk sepenuhnya luar talian.

- <!--i:cpu--> **Fail yang dihantar ejen.** Alat yang mengambil fail (`lolly_transform`, `lolly_verify`, `lolly_redact`, `lolly_read`, `lolly_check`, `lolly_package`, `lolly_compose`, `lolly_rebrand` dan alat imej `lolly_look`, `lolly_sample_color` dan `lolly_trace_edges`) memprosesnya dalam memori dan memulangkan hasil dalam panggilan yang sama. Fail tidak pernah ditulis ke cakera dan tidak disimpan setelah permintaan selesai. `lolly_inspect` juga mengambil fail, dan semakan video dan pengeluaran cetakannya menulis salinan kerja sementara yang dipadam apabila panggilan kembali. Setiap alat lain berfungsi daripada parameter dalam panggilan: teks, nombor, warna, URL, id aset katalog atau dokumen yang dibekalkan pemanggil.
- <!--i:cpu--> **Rebrand menyatakan ke mana dek pergi.** Peringkat pertama `lolly_rebrand`, `capabilities`, menyatakan dengan kata-kata ke mana bait anda akan pergi sebelum anda menghantar apa-apa: pada pelayan setempat yang dihos sendiri dek tidak pernah meninggalkan mesin itu, dan pada pelayan terhos, memanggil `lolly_rebrand` menghantar dek ke sana, sehingga had saiz dan slaid yang diberikan peringkat itu.
- <!--i:lock--> **Titik akhir terbuka.** Pada lolly.tools, `lolly.tools/api/mcp` terbuka kepada sesiapa tanpa token. Panggilan dihadkan mengikut alamat dan mengikut belanjawan harian. Alamat menjadi digest samaran dalam stor kawalan penyalahgunaan, seperti pada titik akhir log masuk di bawah, dan belanjawan hanya mengira masa CPU dan bait yang dihantar, tanpa alamat. Token pembawa bagi titik akhir terhad tidak pernah ditulis ke log atau URL render.
- <!--i:link--> **Pautan muat turun untuk hasil besar.** lolly.tools memulangkan hasil secara sebaris dan tidak pernah mengeluarkan pautan ini. Pengendali boleh menghidupkannya untuk gerbang disahkan mereka sendiri, di mana hasil disimpan selama paling lama lima minit dan hanya token pembawa pemanggil sendiri yang boleh mengambilnya; lihat [MCP Server](/info/mcp.html#private-download-links-for-large-results). Titik akhir terhad yang dirancang di `mcp.lolly.tools` akan menerima token pembawa yang dikeluarkan pengendali kepada klien dipercayai, atau OAuth 2.1 dengan token bertandatangan jangka pendek yang disemak terhadap rahsia dikongsi; pengaktifannya belum selesai, dan ia disenaraikan di bawah [Delivery hosts and processors](#delivery-hosts-and-processors).

### Identiti disahkan: log masuk yang anda mulakan sendiri

Lolly boleh memeteraikan **Content Credential** ke dalam eksport anda, supaya sesiapa boleh menyemak secara luar talian bahawa fail tidak berubah sejak ia meninggalkan Lolly. Itu **dihidupkan secara lalai dan sepenuhnya setempat**: kunci penandatanganan dibuat pada peranti anda dan penandatanganan berlaku luar talian. Tanpa pendaftaran, kunci itu sekali pakai, pasangan kunci baharu yang dijana untuk setiap eksport dan dibuang selepas itu. Setelah anda mendaftar, kunci itu kekal dan dijana **tidak boleh diekstrak**, jadi malah kod Lolly sendiri tidak boleh membacanya, hanya meminta ia menandatangani. Dalam kedua-dua keadaan ia tidak pernah meninggalkan peranti anda.

[Exporting](/info/exporting.html#content-credentials-c2pa) menyenaraikan apa yang direkodkan oleh kredensial: alat, masa, permukaan eksport kasar, nama anda hanya apabila anda menghidupkan *Use my details*, karya yang dikreditkan yang diletakkan oleh eksport, dan setiap lagu Rondocode yang dimainkan oleh eksport video atau audio (namanya, cincangan sumbernya dan cara kotak pasir Lolly merender lagu itu). Panel eksport menyenaraikan lagu tersebut sebelum anda mengeksport.

Kredensial dan metadata fail juga merekodkan [design system and colourway](/info/exporting.html#the-design-system-record) yang melukis eksport: id dan nama sistem reka bentuk, versi yang diterbitkan dan colourway. Nama sistem reka bentuk ialah teks yang ditaip pemiliknya dan boleh menjadi nama pelanggan, jadi kad **Design system** pada panel eksport menunjukkan perkataan yang tepat sebelum anda mengeksport. Nyahtanda kad itu, atau lepaskan `_madewith=0` atau `--no-madewith`, untuk tidak menyertakannya.

Satu langkah *pilihan* di atas itu ialah mendaftar identiti disahkan, supaya eksport anda menyatakan "Verified - signed by \<your email\>" dan bukannya menamakan kunci tanpa nama. **Jika anda melangkau pendaftaran, perkhidmatan sijil tidak menerima data pendaftaran daripada anda.**

![Kad Verified identity dalam Settings, selebar telefon: pemilih hayat sijil dan langkah pendaftaran di bawahnya, tidak aktif sehingga anda memulakannya sendiri](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

Jika anda mendaftar, inilah yang berlaku dengan tepat:

::: timeline
- <!--i:usercheck--> **Anda memilih kaedah log masuk**: GitHub, Google, SUSE (id.suse.com) atau pautan yang dihantar melalui e-mel. Bagi tiga penyedia OIDC, anda pergi ke halaman log masuk penyedia itu sendiri, di bawah dasar privasinya, bukan kami, dan perkhidmatan sijil hanya menerima semula alamat e-mel yang disahkan dan nama penyedia. Bagi pautan e-mel, alamat yang anda taip dihantar kepada **Resend**, perkhidmatan e-mel transaksi, hanya untuk menghantar satu pautan itu.
- <!--i:lock--> **Kuki jangka pendek melindungi ubah hala.** Perkhidmatan sijil menetapkan `lolly_ca_state`, `HttpOnly`, terskop kepada `/api/ca` dan tamat dalam tempoh sepuluh minit. Ia membawa nilai rawak dan bukan pengecam penjejakan, wujud hanya untuk menghalang ubah hala log masuk daripada dipalsukan dan dikosongkan sebaik sahaja log masuk selesai.
- <!--i:eyeoff--> **Alamat IP anda digunakan seketika untuk mencegah penyalahgunaan** titik akhir log masuk, supaya satu skrip tidak boleh membanjiri peti masuk atau menghabiskan kuota e-mel. Lolly menukarnya kepada digest SHA-256 sebelum ia sampai ke stor kawalan penyalahgunaan jangka pendek, jadi alamat mentah tidak dihantar ke situ. Digest itu bersamaran dan bukan tanpa nama: seseorang yang memegang stor boleh memulihkan alamat IPv4 dengan mencuba setiap satu yang mungkin. Baldi tamat selepas kira-kira seminit dan tidak digunakan untuk apa-apa lagi. Log akses pengehosan biasa adalah berasingan dan diterangkan di bawah.
- <!--i:seal--> **Perkhidmatan mengeluarkan sijil** yang mengikat alamat e-mel anda yang disahkan kepada kunci awam peranti anda. Kunci persendirian kekal pada peranti: klien menghantar permintaan sijil dengan bukti pemilikan terikat, dan tiada kunci persendirian peranti pergi ke mana-mana mod pengeluar.
- <!--i:check--> **Penandatanganan kekal setempat.** Dengan pengeluar legasi, eksport tidak memerlukan permintaan kepada perkhidmatan sijil. Identiti terurus juga memerlukan senarai pembatalan baharu yang ditandatangani daripada pengeluarnya; klien boleh menggunakan senarai dicache dalam tetingkap kesegaran yang dikonfigurasi, dan menyegarkannya boleh menghubungi perkhidmatan sijil semasa eksport. Status yang hilang, tamat atau tidak sah menghalang identiti terurus daripada digunakan.
:::

::: details Pengekalan dan penarikan balik dalam setiap mod pengeluar
**Pengeluaran legasi terhos** menawarkan 7, 30, 90 atau 365 hari, dihadkan oleh pengendali. Ia tidak menyimpan inventori identiti dan tiada log pengeluaran, jadi ia tidak boleh mencari siapa yang memperoleh sijil atau membatalkan sijil orang itu; hayatnya ialah penarikan balik.

**Pengeluaran organisasi terurus** menggunakan hayat lalai paling lama 24 jam dan maksimum tujuh hari, dengan akar dan dasar kepercayaan pengeluar sendiri, dan penandatanganan pergi ke pengeluar Vault yang dikonfigurasi pengendalinya. Aplikasi pendaftarannya menggunakan stor kemasukan sekali guna dikongsi yang hanya menyimpan pengecam pengesahan berkunci dan digest permintaan, selama paling lama sepuluh minit, dan tidak menyimpan inventori identiti atau cache respons sijil. Penyedia PKI, peranti audit, gerbang dan sandarannya mempunyai aliran data sendiri. Walaupun storan pengeluaran biasa dimatikan, pembatalan berasaskan sijil boleh menyimpan sijil, termasuk identiti e-melnya, dan nombor siri pembatalan serta pengecam audit boleh kekal boleh dipautkan; dasar pengendali anda menentukan inventori itu, siapa yang boleh mengaksesnya dan berapa lama ia disimpan.

Peranti terurus boleh meminta membatalkan sijilnya sendiri, dengan bukti peranti yang disahkan, dan tiada API meminta kunci persendirian peranti. Pengendali boleh menarik balik pengeluar melalui dasar kepercayaannya. Lolly tidak menyimpan pemetaan daripada orang kepada sijil, jadi membatalkan sijil seseorang apabila mereka berhenti bergantung pada rekod yang disimpan pengendali, dan rekod PKI, rekod audit, penerima dan sandaran mengikut dasar pengendali. [Reka bentuk perkhidmatan sijil](https://github.com/lolly-tools/lolly/blob/main/services/ca/README.md) meliputi penjagaan pengeluar, pengekalan penyedia dan kelayakan.
:::

## Perkhidmatan organisasi dengan Lolly Work

**Lolly Work** ialah perkhidmatan organisasi pilihan projek Lolly, ditempatkan secara berasingan oleh setiap organisasi yang menjalankan instans. Menyambung ke instans menambah data yang disimpan pada pelayan itu di samping penyuntingan setempat anda. Pengendalinya bertanggungjawab ke atas dasar privasi, kawalan akses, penerima, pengekalan dan sandaran penempatan itu.

| Aliran kerja | Data yang dikendalikan oleh perkhidmatan organisasi |
|---|---|
| Log masuk dan penyediaan | Tuntutan penyedia identiti, keahlian akaun dan kumpulan, sesi log masuk dan maklumat peranti. OIDC mengendalikan log masuk; pentadbir boleh menyediakan dan menyahaktifkan akaun melalui SCIM |
| Katalog dan projek dikongsi | Aset yang dimuat naik, metadata dan versi; projek dan sesi dikongsi; kandungan yang diambil daripada penyedia pustaka yang dikonfigurasi |
| Collab kerja | Keadaan sesi dikongsi, suntingan langsung dan kehadiran peserta yang dihantar melalui instans; keadaan tersimpan kekal di bawah dasar storannya |
| Pautan kongsi terurus | Sasaran pautan dan tetapan akses, seperti tamat tempoh dan perlindungan kata laluan pilihan; permintaan diselesaikan melalui instans dan boleh dibatalkan |
| Semakan dan penghantaran | Kandungan yang diserahkan, keputusan kelulusan, destinasi terpilih, fail berperingkat dan resit penghantaran |
| Render dan kelompok pelayan | Input alat yang diserahkan, permintaan render, status dan fail output yang disimpan. Tugasan ini berjalan pada pelayan dan bukan pada peranti anda |
| Pelaporan penggunaan | Label peristiwa tersenarai putih seperti id alat, format dan id aset, mengikut dasar telemetri di bawah |
| Audit | Rekod pelaku dan tindakan untuk operasi yang ditadbir, disimpan secara berasingan daripada telemetri penggunaan |

Perkhidmatan menggunakan kuki pengesahan, termasuk `lw_session` untuk ahli yang log masuk dan `lw_guest` untuk akses tetamu jika diaktifkan, berasingan daripada kuki perkhidmatan sijil. Penyegaran dasar dan pelaporan penggunaan yang diaktifkan boleh membuat permintaan semasa apl digunakan, tanpa klik berasingan untuk setiap satu. Ini ialah trafik ke instans yang dikonfigurasi, bukan laporan kepada projek Lolly tentang penempatan yang tidak dijalankannya.

**Telemetri penggunaan mempunyai tiga tahap.** `off` tidak menyimpan peristiwa penggunaan, `aggregate` membuang id pengguna dan `standard` boleh mengaitkan peristiwa. Tahap lalai ialah `standard`, jadi instans menyimpan peristiwa penggunaan yang diterimanya melainkan pengendalinya memilih `off`. Dasar atribusi lalai ialah `opt-in`, yang memerlukan persetujuan anda sebelum id pengguna disimpan; pengendali sebaliknya boleh mengkonfigurasi pelaporan beratribusi dengan `telemetryAttribution: default`. Atribut yang dibenarkan ialah label, tidak pernah nilai input alat. Lihat [Work telemetry](/info/work-telemetry.html).

**Audit adalah berasingan.** Tindakan yang ditadbir boleh menyimpan rekod audit yang dikenal pasti walau apa pun persetujuan telemetri anda. Mematikan telemetri tidak mematikan storan sesi dikongsi, rekod kelulusan, storan tugasan render atau audit. Pengendali mengawal pengekalan dan pemadaman, termasuk sebarang pseudonim log audit; lihat [Work storage and data lifecycle](/info/work-data-lifecycle.html).

| | Peranti anda | Instans organisasi anda |
|---|---|---|
| Apa yang disimpannya | Kerja peribadi, pilihan dan cache anda | Kerja dikongsi, akaun, muat naik, kelulusan, render, audit dan telemetri yang dikonfigurasi |
| Siapa yang memadamkannya | Anda, dengan **Clear all my data** atau data tapak pelayar anda | Pengendali, melalui kawalan instans sendiri |
| Siapa untuk ditanya | Tiada: rekod ada pada peranti anda | Pengendali instans, untuk akses, eksport atau pemadaman |

**Pemadaman setempat bukan pemadaman pelayan.** Meninggalkan instans atau mengosongkan pelayar anda membuang keadaan setempat, bukan rekod atau sandaran yang disimpan organisasi. [Sync](/info/sync.html) peribadi dan **Export my data** menyandarkan peranti anda, bukan perkhidmatan organisasi. Demo awam [lolly.work](https://lolly.work) menyimpan keadaannya dalam memori sahaja dan bukan storan tahan lama untuk kerja anda.

## Sambungan pelayar

Sambungan pelayar **Lolly URL Screenshot** tidak mengumpul data peribadi untuk kami. Ia tidak mempunyai analitik, tiada penjejakan dan tiada pelayan sendiri. Halaman [Browser extension](/info/extension.html) menerangkan cara ia berfungsi.

**Apa yang dilakukannya.** Apl web Lolly boleh memintanya untuk tangkapan skrin halaman web, atau kandungan halaman untuk memulakan sistem reka bentuk daripada laman web. Setiap permintaan membuka tetingkap kelulusan dalam sambungan yang menunjukkan tapak yang meminta, sama ada ia mahukan tangkapan skrin atau kandungan halaman, dan alamat halaman. Hanya selepas anda menekan **Approve once** sambungan membuka halaman itu dalam tab latar belakang sementara, mengambil tangkapan skrin atau membaca halaman, menyerahkan hasil kepada tab Lolly yang meminta dan menutup tab. Setiap permintaan memerlukan kelulusannya sendiri.

**Data.**

- <!--i:shieldcheck--> **Kami tidak mengumpul apa-apa.** Hasil hanya pergi kepada halaman Lolly yang meminta, dalam pelayar yang sama. Sambungan tidak menyimpan kandungan halaman dan tidak menambah penerima lain.
- <!--i:globe--> **Permintaan rangkaian.** Halaman yang anda luluskan dimuatkan seperti dalam mana-mana tab, bersama apa sahaja yang diminta oleh halaman itu sendiri. Membaca kandungan halaman juga mengambil helaian gaya halaman itu dan beberapa imej ikon dan logonya, dari dalam halaman, dan pengambilan itu tidak menghantar kuki ke tapak lain. Sambungan tidak membuat permintaan lain, dan tiada yang pergi ke pelayan Lolly.
- <!--i:lock--> **Sesi pelayar anda.** Halaman dimuatkan dengan sesi pelayar anda, seperti jika anda membukanya sendiri, jadi halaman yang anda log masuk boleh meletakkan maklumat peribadi dalam hasil.
- <!--i:link--> **Alamat yang anda luluskan** digunakan hanya untuk memuatkan satu halaman itu bagi satu permintaan itu. Ia tidak dilog atau dikongsi.

**Kebenaran.**

- <!--i:wrench--> **`debugger`**: untuk mengambil tangkapan skrin melalui DevTools Protocol, mekanisme sama yang digunakan apl desktop Lolly.
- <!--i:monitor--> **`tabs`**: untuk membuka dan menutup tab sementara, dan menyemak bahawa sama ada halaman Lolly mahupun halaman sasaran tidak berpindah sejak anda meluluskan.
- <!--i:code--> **`scripting`**: untuk membaca kandungan halaman dalam tab sementara, selepas anda meluluskan permintaan itu.
- <!--i:database--> **`storage`**: untuk mencatat id tab sementaranya dalam storan sesi, supaya ia masih ditutup jika pelayar menghentikan sambungan semasa permintaan. Tiada kandungan halaman disimpan.
- <!--i:check--> **Akses tapak pilihan (`http://*/*`, `https://*/*`)**: tidak diberikan semasa pemasangan. Apabila anda menekan **Approve once**, sambungan meminta Chrome untuk akses kepada satu tapak dalam permintaan itu, dan Chrome bertanya anda kali pertama bagi setiap tapak. Tapak yang anda benarkan sebelum ini masih memerlukan kelulusan baharu bagi setiap permintaan.

Tiada satu pun daripada ini digunakan untuk membaca, memantau atau menghantar pelayaran anda di luar satu permintaan yang anda luluskan.

## Hos penghantaran dan pemproses

Fail katalog awam, alat dan rendisi paparan datang daripada alamat apl itu sendiri secara lalai. Nama beralamat kandungan mengubah tempat fail diambil, bukan siapa yang menerima permintaan. Tiada CDN pihak ketiga diaktifkan oleh ciri penghantaran ini. CDN yang menamatkan TLS akan menerima butiran permintaan, termasuk alamat IP dan sebarang kuki atau bukti kelayakan pembawa yang dimajukan kepadanya, walaupun di bawah nama hos pelayar yang sama, jadi pengendali yang menambah satu menanggung pemproses baharu.

**Sebelum menambah sebarang CDN atau hos model luaran**, pentadbir mesti menerbitkan nama pemproses, nama hos, bidang kuasa, metadata yang diterima, pengekalan dan susunan pemindahan. [Delivery deployment](/info/deploy-delivery.html) menyenaraikan apa yang perlu didedahkan. Respons ruang kerja persendirian memintas cache dikongsi: hasil peribadi, penolakan akses dan ralat menggunakan `private, no-store`, dan respons persendirian yang dibenarkan boleh disahkan semula dalam pelayar anda tanpa menjadi awam.

Perkhidmatan rujukan menggunakan pengehosan di bawah. Ini ialah senarai nama hos, bukan dakwaan bahawa instans organisasi lain menggunakan rantau yang sama.

| Nama hos atau perkhidmatan | Fungsi dan penerima | Rantau dan pengendalian data |
|---|---|---|
| lolly.tools | Apl awam, katalog, perkhidmatan render dan sijil; pengehosan UpCloud | Frankfurt, Jerman. Butiran permintaan boleh muncul dalam log infrastruktur; penyuntingan setempat biasa kekal pada peranti |
| lolly.ing | Perkhidmatan ruang kerja terurus dan ejen dokumen; pengehosan UpCloud | Frankfurt, Jerman. Pangkalan data persendirian dan storan fail berada pada hos yang sama. Akaun, kandungan dikongsi dan rekod perkhidmatan mengikut dasar pentadbir instans |
| mcp.lolly.tools | Gerbang MCP disahkan pilihan yang dirancang dan muat turun hasil persendirian; pengehosan UpCloud | Frankfurt, Jerman, dengan pemproses pengehosan yang sama. Pengaktifan belum selesai. Gerbang akan menerima butiran permintaan dan parameter atau fail yang dihantar pemanggilnya |
| lolli.li | Fail keluaran dan model awam; UpCloud Managed Object Storage, berasingan daripada kluster aplikasi | Frankfurt, Jerman, dalam rantau storan objek europe-2 UpCloud. Muat turun menghantar butiran permintaan, bukan input yang kemudian diproses model |
| Penyedia identiti yang dikonfigurasi | Google, GitHub atau penyedia OIDC pengendali | Log masuk mengikut dasar penyedia itu. Tanya pengendali instans untuk nama hos, rantau dan susunan pemindahan |
| Penyedia aset yang dikonfigurasi | Brandfolder atau pustaka lain yang dipilih pengendali | Penyedia menerima permintaan pustaka yang dibenarkan. Kebenaran sumbernya dan dasar instans mengawal akses; tanya pengendali untuk nama hos dan rantaunya |
| Pendaftaran e-mel, apabila dikonfigurasi | Resend menghantar pautan log masuk yang diminta | Menerima alamat e-mel destinasi bagi mesej itu; terma pemprosesan sendiri terpakai |

Aplikasi rujukan tidak menggunakan pengehosan, pangkalan data atau penyedia kawalan penyalahgunaan lain. Pengendali boleh memilih penyedia lain untuk instans yang berbeza, dan penyedia pengehosan, identiti, aset dan e-mel masing-masing memerlukan pendedahan sendiri. [Rantau storan objek](https://upcloud.com/docs/products/managed-object-storage/availability/) hos model disahkan secara berasingan daripada rantau aplikasi.

**Pautan muat turun MCP terikat prinsipal (pilihan).** Pengendali boleh menghidupkan pautan muat turun untuk hasil besar pada gerbang disahkan satu replika. Ia dimatikan secara lalai. Gerbang tanpa nama di `lolly.tools/api/mcp` memulangkan hasil secara sebaris dan tidak pernah mengeluarkan pautan ini. Nama hos terhad yang dirancang ialah `mcp.lolly.tools`, pada pemproses UpCloud yang sama di Frankfurt; pengaktifan belum selesai, dan halaman ini tidak mendakwa perkhidmatan pautan muat turun yang aktif. Pautan tidak menambah CDN pihak ketiga.

Hanya pemanggil disahkan dengan skop fail boleh menerima pautan, dan pembawa pemanggil yang sama diperlukan untuk mengambilnya: gunakan pembawa yang disahkan daripada panggilan render, bukan token lain bagi akaun yang sama. Pemberian tamat dalam 300 saat. Pemilikan dan carian hasil kekal dalam memori gerbang, dan bait output pergi ke fail sementara persendirian, dibuang selepas tamat atau dipadam semasa penutupan bersih. Gerbang yang dimulakan semula membatalkan pautan sedia ada. Hasil yang disimpan dihadkan kepada 64 MiB bagi setiap pembawa, 256 MiB merentas gerbang dan 200 fail tertunggak atau disimpan. Belanjawan CPU harian dan bait yang dinyahkod mengira hasil apabila disimpan dan apabila dimuat turun. Respons menggunakan `private, no-store` dan `Referrer-Policy: no-referrer`. Token pautan sahaja tidak membenarkan orang atau ejen lain membaca hasil.

## Log infrastruktur

Bahagian ini menerangkan penempatan awam lolly.tools. Platform pengehostannya merekodkan butiran permintaan biasa: alamat IP, laluan yang diminta, cap masa dan ejen pengguna. Suntingan setempat tidak sampai ke hos itu. Rentetan pertanyaan pautan render boleh mengandungi teks yang dibekalkan pemanggilnya, seperti yang dijelaskan di atas. Alat fail MCP memproses bait yang diberikan dalam memori. Instans Lolly Work juga menyimpan rekod yang diterangkan di atas, di bawah dasar pengelogan pengendalinya.

**Perkhidmatan awam menyimpan pengelogan aplikasi pada tahap minimum.** Pelayan MCP melog permulaan, konfigurasi dan amaran perenderan; ia tidak menyimpan log permintaan sendiri dan tidak melog token atau alamat pemanggil. Laluan lalu Penpot melog setiap nama perintah dan status respons Penpot, tidak pernah pengepala, token atau fail. Perkhidmatan sijil melog tetapan permulaan dan amaran konfigurasinya, serta dua baris yang dilucutkan semasa kegagalan: kod status kegagalan penghantaran tanpa alamat penerima, dan baris kegagalan tetap tanpa teks ralat, jejak tindanan atau URL, kerana ralat penyedia boleh membawa nilai identiti atau bukti kelayakan. Selebihnya dalam log datang daripada platform pengehosan.

Bagi lolly.tools, pentadbir instans mengawal pengelogan permintaan, putaran dan pengekalan pada UpCloud. Halaman ini tidak menyatakan tempoh pengekalan log maksimum yang belum disahkan. Hubungi pengawal di bawah untuk jadual semasa dan untuk sebarang permintaan tentang log yang disimpan pelayan. Bagi instans lain, tetapan pengendalinya terpakai, termasuk sebarang eksport log atau pemproses lain.

## Asas undang-undang, tempoh simpanan dan penerima

Jadual ini meliputi penempatan rujukan **lolly.tools**. Ia tidak menyatakan asas undang-undang atau tempoh pengekalan instans Lolly Work organisasi anda; pengendalinya menyediakan perkara itu dalam dasarnya sendiri.

| Pemprosesan | Asas undang-undang (GDPR Art. 6) | Disimpan selama |
|---|---|---|
| Segala-galanya pada peranti anda (dokumen, pilihan, cache, pembilang) | **Bukan pemprosesan kami langsung**: ia tidak pernah sampai kepada kami. Storan pada peranti anda benar-benar perlu untuk perkhidmatan yang anda minta (ePrivacy Art. 5(3)), jadi ia tidak memerlukan persetujuan | Sehingga anda memadamkannya |
| Alamat e-mel anda semasa pendaftaran Content Credentials terhos legasi | **Art. 6(1)(b)**, pelaksanaan perkhidmatan yang anda minta dengan jelas | Tiada inventori identiti atau log pengeluaran dalam perkhidmatan legasi; e-mel digunakan semasa permintaan dan disertakan dalam sijil anda. PKI organisasi terurus, audit dan pengekalan pembatalan mengikut dasar pengendalinya |
| Digest SHA-256 bersamaran yang dibuat daripada alamat IP anda, untuk menghadkan kadar titik akhir log masuk dan titik akhir render, imej dan MCP awam | **Art. 6(1)(f)**, kepentingan sah kami dalam mencegah penyalahgunaan perkhidmatan percuma dan kuota e-mel pihak ketiga. Kami menganggap ini lulus ujian pengimbangan kerana alamat mentah tidak dihantar kepada pengehad, digest hanya digunakan untuk kawalan penyalahgunaan dan ia tamat dengan sendirinya | Kira-kira seminit dalam stor kawalan penyalahgunaan; tidak disimpan selepas itu |
| Log akses pengehosan (IP, laluan, cap masa, ejen pengguna) | **Art. 6(1)(f)**, kepentingan sah kami dalam keselamatan perkhidmatan, pencegahan penyalahgunaan dan mendiagnosis kerosakan | Putaran dan pengekalan yang dikonfigurasi pentadbir; hubungi pengawal untuk jadual semasa |

**Penerima.** Kategori penerima ialah penyedia pengehosan kami (UpCloud), yang menghoskan pangkalan data aplikasi dan stor kawalan penyalahgunaan, dan, hanya jika anda menggunakan pilihan log masuk e-mel, penyedia e-mel transaksi (Resend). Stor kawalan penyalahgunaan hanya menerima digest jangka pendek, tidak pernah alamat IP mentah. Jika anda log masuk dengan GitHub, Google atau SUSE (id.suse.com), anda berurusan dengan penyedia itu secara terus di bawah dasar privasinya sendiri, dan mereka memberitahu kami alamat e-mel yang disahkan dan tiada yang lain. Kami tidak berkongsi data peribadi dengan sesiapa lagi, dan kami tidak menjual data, menjalankan pengiklanan atau memprofilkan pengguna.

**Pemindahan di luar EEA.** Pengehosan, pangkalan data dan storan fail aplikasi rujukan berada di Frankfurt. Penyedia identiti, e-mel dan aset pilihan mempunyai lokasi dan terma pemprosesan sendiri, yang boleh merangkumi akses di luar EEA, dan rantau pelayan semata-mata tidak menentukan bidang kuasa setiap penerima. Hubungi pengawal untuk perjanjian penyedia dan susunan pemindahan yang terpakai; bagi instans lain, tanya pengendalinya. [Standard Contractual Clauses](https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/standard-contractual-clauses-scc_en) Suruhanjaya Eropah ialah satu perlindungan yang tersedia untuk pemindahan sedemikian; halaman ini tidak mendakwa bahawa perjanjian penyedia yang tidak disahkan menggunakannya.

**Membuat keputusan secara automatik.** Tiada. Tiada pemprofilan dan tiada keputusan automatik dengan kesan undang-undang atau kesan penting yang serupa (Art. 22).

## Privasi kanak-kanak

Penggunaan apl setempat biasa tidak menghantar kandungan peribadi ke lolly.tools. Pendaftaran Content Credentials pilihannya menerima alamat e-mel dan tidak ditujukan atau dimaksudkan untuk kanak-kanak. Perkhidmatan organisasi mempunyai akaun dan pengendalian data sendiri, di bawah dasar pengendalinya.

## Hak anda

Bagi rekod yang disimpan pada peranti anda sahaja, anda boleh mengakses, membetulkan, memadam dan memindahkan data itu sendiri. Ia berada dalam storan pelayar atau apl anda, dalam bentuk yang boleh anda periksa, eksport (**Export my data**, di atas) atau padam (**Clear all my data**, atau data tapak pelayar anda).

Secara rasmi, di bawah Perkara 15-22 GDPR anda berhak untuk **mengakses** data peribadi anda, **membetulkannya**, **memadamnya**, **menyekat** atau **membantah** pemprosesannya (termasuk apa-apa yang kami asaskan pada kepentingan sah), kepada **kebolehpindahan data** dan, apabila pemprosesan bergantung pada persetujuan, untuk **menarik balik persetujuan itu pada bila-bila masa**, tanpa menjejaskan kesahihan apa yang berlaku sebelum anda menarik balik persetujuan.

Perkhidmatan sijil awam tidak menyimpan log pengeluaran. Log infrastruktur boleh mengandungi butiran permintaan, jadi dasar ini tidak menjanjikan bahawa persekitaran pengehosan tidak menyimpan data peribadi. Hubungi pengawal untuk akses, pemadaman atau permintaan lain tentang rekod tersebut; kami akan menerangkan rekod apa yang wujud dan apa yang boleh dilakukan. Bagi kerja, identiti, telemetri dan rekod audit yang disimpan oleh organisasi, hubungi pengendali Lolly Work anda, kerana kawalan eksport dan pemadaman setempat tidak sampai kepada salinan tersebut.

**Anda berhak membuat aduan.** Jika anda fikir kami telah mengendalikan data anda dengan tidak wajar, anda boleh memfailkan aduan kepada pihak berkuasa penyeliaan perlindungan data: di EU, pihak berkuasa di negara kediaman anda, tempat kerja anda atau tempat anda percaya pelanggaran berlaku (Art. 77). Pihak berkuasa penyeliaan utama kami ialah *Bayerisches Landesamt für Datenschutzaufsicht* (BayLDA) di Ansbach, Jerman. Anda tidak perlu menghubungi kami dahulu, walaupun kami ingin diberi peluang membetulkan masalah itu.

## Perubahan pada dasar ini

Tarikh di bahagian atas berubah setiap kali dokumen ini berubah. Perubahan yang mengubah apa yang meninggalkan peranti anda atau apa yang disimpan mendapat barisnya sendiri di sini dan bukan suntingan senyap. Untuk melihat apa yang berubah, tanya (di bawah) atau bandingkan dengan [sumber awam](https://github.com/lolly-tools/lolly/commits/main/docs/privacy.md).

**29 September 2026:** menjelaskan perkhidmatan lolly.work pilihan, kandungannya yang dipegang organisasi, kuki pengesahan, telemetri penggunaan dan rekod audit, serta pengasingan antara pemadaman setempat dan pengekalan pelayan. Ini ialah aliran kerja pilihan yang sedia ada, bukan keperluan muat naik baharu untuk penyuntingan setempat.

**11 Oktober 2026:** menggantikan penerangan pengehosan Vercel yang telah dihentikan dengan inventori nama hos aplikasi UpCloud, membezakan penyedia identiti dan aset pilihan, dan menerangkan penghantaran beralamat kandungan serta mod muat turun MCP yang disimpan. Tiada CDN pihak ketiga diaktifkan oleh perubahan ini. Pengekalan log dikawal oleh pentadbir dan bukan lalai pelan Vercel yang dinyatakan.

**22 Oktober 2026:** membetulkan penerangan tentang kelakuan sedia ada. Bahagian sambungan pelayar kini meliputi tetingkap kelulusan bagi setiap permintaan, akses tapak yang diminta satu tapak pada satu masa dan pengambilan helaian gaya dan ikon bagi pembacaan laman web. Turut dibetulkan: baris Send to Google Drive dan Meeting Planner, nota SEAL (tiada apl Lolly mencari kunci SEAL dalam DNS), tahap telemetri penggunaan lalai bagi perkhidmatan organisasi, alat imej MCP dan pengelogan aplikasi bagi perkhidmatan awam. Perisian itu sendiri tidak berubah.

**23 Oktober 2026:** menyusun semula dasar mengikut apa yang memulakan setiap permintaan, dan menerangkan kelakuan sedia ada yang tidak diliputi sebelum ini: jemputan collab peribadi yang membawa alamat rangkaian setempat, Nearby dalam apl desktop, Allow AI control, membaca sistem reka bentuk daripada laman web, set emoji, cache pada peranti bagi carian bandar Meeting Planner, Trash dan rekod lain yang disenaraikan oleh Settings → Storage. Membetulkan dua pernyataan: Bluesky dan Discord bukan untuk desktop sahaja, dan setiap hos yang dipilih seseorang untuk penghantaran memerlukan kelulusan pengendali dalam kedua-dua apl web dan desktop; digest pengehadan kadar bagi alamat IP adalah bersamaran dan bukan tanpa nama. Perisian itu sendiri tidak berubah.

## Siapa yang bertanggungjawab, dan cara menghubungi kami

**Pengawal data** untuk lolly.tools ialah:

> SUSE Software Solutions Germany GmbH
> Frankenstraße 146
> 90461 Nürnberg
> Germany

SUSE telah melantik **Pegawai Perlindungan Data**, boleh dihubungi di [privacy@suse.com](mailto:privacy@suse.com). Gunakan alamat itu untuk sebarang permintaan rasmi di bawah "Hak anda" di atas.

Untuk apa-apa tentang Lolly sendiri, seperti cara ia berfungsi, mengapa sesuatu sedemikian atau pembetulan kepada dokumen ini, hubungi **Andy Fitzsimon**, [fitzy@suse.com](mailto:fitzy@suse.com).

Bagi instans Lolly yang dihos sendiri atau perusahaan, hubungi sesiapa yang mengendalikannya sebaliknya: pengendali ialah pengawal bagi penempatannya sendiri. SUSE dan projek sumber terbuka Lolly tidak menyimpan data bagi penempatan yang tidak dijalankannya.
