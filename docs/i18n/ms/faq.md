# Soalan & jawapan

Soalan lazim, dirender sebagai akordion di `/info/start/faq.html`.

**Cara menyelenggara:** setiap tajuk `##` di bawah ialah soalan. Segala-galanya di bawah tajuk itu,
sehingga `##` seterusnya, ialah jawapan. Jawapan menggunakan markdown ringan tapak:
pisahkan perenggan dengan baris kosong. Tambah, alih keluar atau susun semula soalan di sini dan
jalankan semula `pnpm run build:info` (atau `pnpm run dev:web`).
Binaan mengabaikan segala-galanya di atas `##` pertama (tajuk ini dan nota ini).

Susunannya mengikut keperluan pengguna baharu: syarat tersembunyi dahulu, kemudian fail anda, kemudian mendapatkan
dan menjalankan Lolly, kemudian organisasi, kemudian cara ia dibuat. Sauh setiap soalan
dibina daripada soalan bahasa Inggeris pada kedudukan yang sama, jadi terjemahan mengekalkan
susunan bahasa Inggeris.

## Mengapa ia percuma? Apa syarat tersembunyinya?

**Kami membina Lolly untuk diri sendiri.** SUSE memerlukan beribu-ribu fail yang mematuhi jenama, dibuat tanpa menyerahkan apa-apa kepada perkhidmatan luar. Jadi kami membina alat yang melakukan semuanya pada peranti, dan mengeluarkannya sebagai sumber terbuka, seperti segala-galanya yang kami buat. Kami terus menyelenggaranya kerana kami menggunakannya setiap hari. **Tiada kewajipan:** semua di sini berfungsi dengan atau tanpa kami.

Batas itu ditetapkan dalam lesen, bukan janji: apa-apa yang berjalan secara setempat adalah percuma, selama-lamanya. Versi yang telah dikeluarkan dilesenkan supaya ia tidak boleh ditarik balik. Tiada perjanjian penyumbang boleh melesenkan semula kerja sesiapa.

## Berapa banyak yang SUSE rahsiakan? (atau bila ia akan ditarik balik)

Enjin, kerangka aplikasi, skema dan alat yang tidak terikat pada jenama ialah sumber terbuka. Tanda dagangan dan alat berjenama SUSE kekal peribadi dan sudah diasingkan. Instans awam di [lolly.tools](https://lolly.tools) menjalankan [Lolly Demo](/info/lolly-demo.html), sistem reka bentuk Lolly sendiri.

Tiada apa di sini bergantung pada janji: setiap versi yang dikeluarkan kekal sumber terbuka. Apabila syarikat lain menutup sumber Linux perusahaan mereka pada 2023, SUSE mengasaskan bersama [OpenELA](https://openela.org) untuk mengekalkan kod itu terbuka. Projek ini mewarisi pendirian itu.

SUSE *memang* sedang membina alat dalaman untuk menghubungkan Lolly dengan sistem ITnya sendiri. Itu ialah persediaan dalaman SUSE, bukan pemisahan antara pembangunan awam dan peribadi. Lolly juga menyasarkan pembinaan melalui [Open Build Service](https://openbuildservice.org/), dengan artifak rantaian bekalan yang selamat dihantar oleh [SUSE Application Collection](https://apps.rancher.io/applications).

## Mengapa namanya "Lolly Tools"?

**Lolly** kerana kebebasan itu manis, dan kerana di Australia, New Zealand dan Britain, lolly ialah gula-gula.

**Tools** kerana alat tidak bergerak sehingga anda menggunakannya. Ia tidak berjalan apabila anda tidak menggunakannya, dan ia tidak memerhatikan anda semasa anda menggunakannya.

## Mengapa semuanya hijau?

lolly.tools dibuka dalam [Lolly Demo](/info/lolly-demo.html), sistem reka bentuk contoh Lolly sendiri, yang warna utamanya hijau. Tukar kepada **Lolly Starter**, sistem reka bentuk kosong, atau sistem anda sendiri dalam [Settings → Design systems](/#/settings?focus=design-systems-section).

## Bolehkah saya menggunakan jenama sendiri?

Ya. **Lolly Design System Setup** (`#/start`) membina sistem reka bentuk daripada satu warna, fail token reka bentuk atau reka bentuk siap. Setiap alat kemudian melukis dengan sistem reka bentuk anda. [Mula](/info/quickstart.html#put-your-brand-in) menelusuri ketiga-tiga laluan.

Sistem reka bentuk yang dibekalkan oleh organisasi atau binaan anda ialah sistem terurus. Ia menunjukkan kunci dan kekal baca sahaja. Untuk mengubahnya, buat salinan boleh sunting.

## Di manakah hasil yang saya buat semalam?

Jika anda menekan **Save as** atau **Save**, kerja anda berada dalam **Projects** pada skrin utama, dalam pelayar atau apl yang anda gunakan untuk menyimpannya. Jika anda hanya menekan **Download**, fail itu berada dalam muat turun pelayar atau sistem anda, dan salinan biasanya berada dalam **Assets**. Alat yang [menyimpan semasa anda bekerja](/info/find-your-work.html#which-tools-save-as-you-work) juga menyimpan kerja yang belum disimpan dalam **Projects**. [Cari dan pulihkan kerja anda](/info/find-your-work.html) meliputi setiap keadaan.

## Saya menutup tab. Adakah kerja saya hilang?

Kerja tersimpan masih berada dalam **Projects**. Kerja yang belum disimpan hilang, kecuali dalam alat yang menyimpan semasa anda bekerja, yang turut menyimpannya dalam **Projects**. Lain kali, tekan **Save as** sebelum anda keluar. Lihat [Jika anda menutup tab atau meninggalkan alat](/info/find-your-work.html#if-you-closed-the-tab-or-left-the-tool).

## Bolehkah saya berkongsi kerja sebagai fail dan bukannya pautan?

Ya. Apabila pautan tidak boleh membawa semuanya, seperti foto anda sendiri atau teks panjang, dialog Share menyatakan apa yang akan tertinggal dan menawarkan fail **.lolly**. Satu fail itu mengandungi reka bentuk, imej yang digunakannya dan, jika anda pilih, alat itu.

Anda menentukan berapa banyak yang dibawa. Nama dan butiran anda hanya disertakan jika profil anda mengaktifkan penyertaan. Karya seni berlesen tidak disertakan melainkan anda memilih untuk menyertakannya. Sesiapa yang membuka fail yang membawa alat ditanya sama ada mereka mempercayai alat itu sebelum ia boleh berjalan. Lihat [Berkongsi kerja anda](/info/using.html#sharing-your-work).

## Apakah fungsi butiran profil saya?

Butiran anda dalam **Settings** mengisi awal alat yang memintanya, seperti nama pada lencana. Butiran itu kekal pada peranti ini. Tiada apa dimasukkan ke dalam hasil anda melainkan anda menghidupkan pilihan penyertaan. Kemudian butiran yang anda pilih dimeterai di dalamnya dan menamakan anda sebagai sumber.

Perkongsian dan Sync hanya menghantar kandungan yang anda pilih. Pada instans Lolly Work organisasi, sesi bersama dan kerja yang ditadbir turut dihantar ke pelayan itu. Lihat [Privasi](/info/privacy.html).

## Bagaimana saya mendapatkan apl mudah alih atau desktop?

Muat turun daripada [Pasang Lolly](/info/install.html). Halaman itu menyenaraikan setiap binaan untuk macOS, Windows, Linux dan Android, dan menunjukkan cara menyemak fail yang anda muat turun. iPhone dan iPad mendapatkan **Lolly Tools** daripada App Store. [Bahagian iPhone dan iPad](/info/install.html#iphone-and-ipad) mempunyai pautannya.

Sesiapa sahaja juga boleh membina dan mengedarkan salinan apl sendiri, dengan alat dan tetapan yang diperlukan khalayak mereka. [Panduan Binaan](/info/build-guide.html) menunjukkan caranya.

## Lolly menyatakan ia memerlukan WebGPU. Apa yang boleh saya lakukan?

Apl web melukis dengan WebGPU, ciri grafik pelayar semasa, dan menyemak WebGPU sebelum membuka alat. Cuba langkah ini mengikut susunan:

1. Kemas kini pelayar anda kepada versi semasa.
2. Hidupkan pecutan grafik atau perkakasan dalam tetapan pelayar, kemudian mulakan semula pelayar.
3. Cuba pelayar yang telah diuji: [Persekitaran yang disokong](/info/supported-environments.html) menyenaraikannya.
4. Pada Mac, iPhone atau iPad, [pasang apl](/info/install.html) sebagai gantinya.

## Bolehkah Lolly menyunting dan merender fail Figma, Penpot, Illustrator atau InDesign saya?

Ya. Buka alat **Design** dan klik **Import a design**: ia menerima fail asli Figma **.fig** (Save local copy), eksport Penpot **.penpot**, Illustrator **.ai** atau **.pdf**, InDesign **.idml** atau **.indd**, dokumen Affinity, Photoshop **.psd**, PowerPoint **.pptx**, CAD **.dxf** atau **mana-mana SVG** ([setiap format yang dibacanya](/info/design-import.html#what-comes-in-from-each-app)). Anda tidak memerlukan akaun, pemalam atau lesen apl reka bentuk.

![Kanvas terbuka Lolly Design - Import a design berada dalam menu Lolly pada bar alat](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZTfS8MwEMf_mryO5NZ288GHrdqJv1CUvWdtOgppMtJMNv96yaV1iRNEQRBZoblwab53l0-uq915bXgrCOSDpf3LzgANnQ4eI0rrPJn7Gh9cd0sE8lIryxtFIFfatFx6L4F0Mi-11GbUiZYr25QjK3bW-S8I5MnUbRXKCkMgb5uqki6JFFU7rjoXYsSgT8GaLebKZSeGAPkUYypMHp80DeugYYR4J_U7X4XRkY8dFHuTYEJ-jDWM3qoqsEHo4Y20-xJi-SPVaOfRUuAL1hiZXNrG4gH6M85Z5lTAk8x8DdlnPL8gecVfBIEU6F5v0bbCor3VUu4JpOPCKTCWsPI9rBS107d6QyCfRET_Ac6wX36X6UpX-49Ip1mAlMEPkM6QX20aoSpECLTmpadcazPQ9hPlWxboRndWmFEIG1s4Yp3E3Ts-0f4GbcruWHLzlC0frmfpfbGk82LxmD0vUndSTcvXAoknWBKCz5LDSIdiRHV0D2Tfq1BIvdY42Zim5WZ_-n3_mRvwBg&width=1360&height=850&dpi=192&waitMs=3000&format=svg&walker=1&chrome=1&localize=1&dark=1&filename=design)

Lapisan tiba sebagai kotak boleh sunting. Teks kekal boleh ditaip semula, bentuk kekal sebagai bentuk dan imej menyertai pustaka anda. Setelah reka letak disimpan, **Share with rules** boleh menjadikannya alat yang boleh diisi semula oleh sesiapa yang mempunyai Lolly. Lihat [Import reka bentuk](/info/design-import.html).

## Bolehkah dua orang bekerja pada reka bentuk yang sama tanpa internet?

Ya. Seorang berkongsi jemputan (pautan, kod QR atau kod pendek) dan seorang lagi menerimanya. Kedua-dua peranti kemudian memegang sesi yang sama secara langsung, dengan kehadiran dan gelang fokus. Ini berfungsi pada mana-mana rangkaian bersama, termasuk hotspot telefon, kerana tiada pelayan di tengah. Lihat [Bekerja bersama](/info/collaborate.html). Untuk rakan sekerja pada rangkaian berbeza, instans Lolly Work organisasi menyediakan kolaborasi kerja yang disahkan identitinya.

## Apakah bendera ciri?

Bendera ciri menghidupkan atau mematikan bahagian Lolly. Dalam penggunaan kendiri, anda memilih tetapan peribadi anda. Organisasi yang menggunakan Lolly Work boleh menetapkan lalai atau menyembunyikan suis terpilih mengikut dasarnya, dan kawalan terurus dilabelkan. Lihat [Gunakan Lolly di organisasi anda](/info/organisation.html).

![Bendera ciri peribadi dalam apl kendiri; dasar organisasi boleh mentadbir suis terpilih](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dfeature-flags&width=1440&height=1800&dpi=192&waitMs=2000&format=svg&cropSelector=%23feature-flags-section&walker=1&dark=1&filename=pd-feature-flags)

## Apa yang membezakan utiliti daripada alat?

Utiliti melakukan satu tugas pantas pada fail yang sudah anda miliki, seperti memampatkan PDF, menukar foto atau membuang data tersembunyi. Banyak utiliti berjalan pada peranti anda tanpa memuat naik apa-apa. Utiliti mengekalkan dalam Lolly tugas yang biasanya diserahkan kepada laman web sebarangan. Memampatkan kontrak, menukar foto percutian yang masih menyimpan lokasi atau menampal token ke dalam pemformat dalam talian tidak sepatutnya bermakna menyerahkan fail kepada tapak dengan pengekalan, bidang kuasa dan model perniagaan yang tidak diketahui. [Lolly Utilities](/info/utilities.html) menyenaraikannya, dan [Pertukaran yang tidak pernah kita persetujui](/info/status-quo.html) menceritakan kisah di sebaliknya.

![Paparan Utilities: Lolly Strip Hidden Data, Compress PDF, Convert Image dan tugas lain pada peranti, semuanya di satu tempat](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## Bolehkah organisasi kami menggunakan SSO, projek bersama dan kelulusan?

Ya, dengan **Lolly Work**, pelayan organisasi bagi projek sumber terbuka yang sama. Ia berjalan secara berasingan dan menambah log masuk tunggal melalui penyedia identiti anda, penyediaan SCIM, kebenaran kumpulan, projek dan aset bersama, kolaborasi kerja langsung, kelulusan dan rekod audit. Apl harian masih berfungsi sendiri.

[Gunakan Lolly di organisasi anda](/info/organisation.html) meliputi log masuk dan mencari kerja bersama. [Pelaksanaan](/info/deployment.html#organisation-services-with-lolly-work) meliputi persediaan Lolly Work. Kandungan bersama dan rekod organisasi mengikut dasar privasi dan pengekalan instans itu.

## Apakah halangan yang boleh dijangka apabila mula menggunakan Lolly?

Kebanyakannya perubahan cara pasukan menghasilkan kerja, bukan teknologi. Pasukan yang mahukan set alat yang ditadbir memerlukan seseorang untuk mengarang sistem reka bentuk dan templat pertamanya. Sesiapa sahaja masih boleh membuat alat sendiri dalam Lolly Design pada hari pertama, tanpa memerlukan git. Proses sedia ada terus berfungsi walaupun outputnya tidak mematuhi jenama. Menukar satu output yang mudah dilihat dengan hasil yang baik, dengan hasil sebelum dan selepas bersebelahan, lebih cepat meyakinkan berbanding rancangan.

[Penerimagunaan & Tadbir Urus](/info/adoption-governance.html) meliputi orientasi mengikut peranan, cara mengukur projek rintis dan bentuk proses tadbir urus yang boleh digunakan.

## Adakah Lolly dibina melalui "vibe coding"?

Lolly dibangunkan dengan pengekodan dibantu AI, penemuan dibantu AI dan, di banyak tempat, kandungan dibantu AI, menggunakan gabungan model dan vendor, termasuk daripada syarikat awan awam dengan model termaju. Manusia mencipta seni binanya, memilih dan menyusun kod dengan tujuan yang jelas serta menentukan arah seni pengalaman itu.

Advisori bertaraf tinggi atau kritikal dalam kebergantungan Lolly menyekat CI. Advisori yang belum boleh diperbaiki hanya ditangguhkan sebagai pengecualian yang diluluskan dengan alasan bertulis. [SECURITY.md](https://github.com/lolly-tools/lolly/blob/main/SECURITY.md#dependency-audit-exceptions) menyenaraikan setiap pengecualian semasa, dan [nota keluaran](https://github.com/lolly-tools/lolly/releases) menyenaraikan pengecualian yang dibawa oleh setiap keluaran. SECURITY.md juga menyatakan cara melaporkan kerentanan.

Semakan dalam binaan turut menolak ungkapan yang kedengaran seperti dihasilkan mesin dalam komen kod, apl dan dokumentasi ini, untuk mengekalkan teks yang jelas bagi setiap pembaca. Kesan sampingannya ialah pengesan mungkin lebih sukar menentukan teks yang ditulis oleh model. Itu bukan tujuan kami.

Yang paling utama, Lolly dibina berasaskan hasil kerja sumber terbuka selama berdekad-dekad oleh pakar di seluruh dunia.

**Pendedahan AI generatif:**

- **Kod ditulis LLM:** Opus 4.8, Gemini 3.1, Qwen3-Coder-Next, Codex Sol (senarai ini mungkin bertambah)
- **Penemuan LLM:** Gemini 3.1, Fable, Codex Astra
- **Dokumentasi:** Sonnet 5
- **Pustaka sumber terbuka:** Pengarang masing-masing, dinyatakan dalam SBOM, komen dan pengepala fail

Senarai ini tidak termasuk model yang disertakan terus dalam Lolly.

**Sumbangan manusia:**
- **Penjanaan idea, semakan dan maklum balas:** Ravan Naidoo, Matthias Eckermann, Kelly Andrews, Ryan Kleeman, Peter Chamalian, Penpot Community, Tim Hildred (senarai tidak menyeluruh)
- **Seni bina, arahan seni & pembersih kandungan bermutu rendah:** Andy Fitzsimon

## Ke mana perginya alat berjenama SUSE?

Alat itu berada dalam repositori peribadi yang berasingan. Klon awam tidak mengambil pek jenama SUSE, jadi binaan daripadanya menggunakan profil neutral `lolly-start` melainkan anda memilih yang lain. Profil itu mempunyai alat komuniti yang bebas jenama dan jenama kosong untuk anda isi dengan jenama sendiri. [lolly.tools](https://lolly.tools) dibina dengan profil `lolly-demo` dan dibuka dalam [Lolly Demo](/info/lolly-demo.html), sistem reka bentuk Lolly sendiri. SUSE mengendalikan instansnya sendiri untuk melindungi tanda dagangannya.

## Apakah perisa logo Lolly itu?

Ada yang kata Limau, ada yang kata Pudina dan kadangkala Epal. Lolly membawa kemanisan, dan anda mencipta perisanya.

## Apakah yang Lolly maksudkan dengan kedaulatan kandungan?

Kawalan terhadap cara kandungan anda dicipta, ditadbir, disimpan dan dipindahkan merentas sistem yang anda pilih. Lolly menyokong penghasilan setempat, kerja boleh sunting dan alat mudah alih. Lolly Work menambah perkhidmatan bersama yang dikawal organisasi. Lesen sumber, kebergantungan yang tersedia dan aliran data dalam aliran kerja masih penting. [Apakah kedaulatan kandungan?](/info/content-sovereignty.html) menerangkan setiap kawalan dan hadnya.

## Bolehkah kami mengekalkan DAM sedia ada?

Ya. DAM yang disokong boleh kekal sebagai sumber rekod rasmi sementara Lolly Work menghubungkan aset terpilih kepada alat Lolly. Akses sumber, suntingan yang dibenarkan, hak penggunaan dan kelulusan output siap ialah keputusan yang berasingan. [Gunakan Lolly dengan DAM sedia ada anda](/info/use-with-dam.html) menerangkan aturan ini, dan [Pengalaman SUSE dengan Brandfolder](/info/suse-brandfolder.html) merekodkan penggunaan yang berjaya semasa penerimagunaan.
