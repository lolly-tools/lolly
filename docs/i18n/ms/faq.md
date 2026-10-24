# Soalan & jawapan

Soalan lazim, dirender sebagai akordion pada `/info/start/faq.html`.

**Cara menyelenggara:** setiap tajuk `##` di bawah ialah satu soalan; segala yang berada
di bawahnya (sehingga `##` berikutnya) ialah jawapannya. Jawapan menggunakan markdown
ringan yang sama seperti bahagian lain laman ini - pisahkan perenggan dengan satu baris
kosong. Tambah, buang atau susun semula soalan di sini dan jalankan semula `pnpm run build:info` (atau `pnpm run dev:web`).
Segala yang di atas `##` pertama (tajuk ini dan nota ini) diabaikan oleh binaan.

Susunannya ialah susunan orang baru: perangkap dahulu, kemudian fail anda, kemudian mendapatkan
dan menjalankan Lolly, kemudian organisasi, kemudian bagaimana ia dibuat. Sauh setiap soalan
dibina daripada soalan Inggeris pada kedudukan yang sama, jadi terjemahan mengekalkan
susunan Inggeris.

## Kenapa ia percuma? Apa muslihatnya?

**Kami membina Lolly untuk diri kami sendiri.** SUSE memerlukan beribu-ribu fail selari jenama, dibuat tanpa menyerahkan apa-apa kepada perkhidmatan luar. Jadi kami membina alat yang melakukan semuanya pada peranti, dan melepaskannya sebagai sumber terbuka, seperti semua yang kami buat. Kami terus menyelenggaranya kerana kami menggunakannya setiap hari. **Tiada kewajipan:** segala-galanya di sini berfungsi dengan atau tanpa kami.

Garis itu dilukis dalam lesen, bukan dalam janji: apa-apa yang berjalan secara setempat adalah percuma, selama-lamanya. Versi yang dikeluarkan dilesenkan supaya tidak boleh ditarik balik, dan tiada perjanjian penyumbang yang boleh melesenkan semula kerja sesiapa.

## Berapa banyak yang SUSE simpan secara peribadi? (iaitu bila tikar akan ditarik dari bawah kaki)

Enjin, shell, skema dan alat tanpa jenama ialah sumber terbuka. Cap dagangan dan alat berjenama SUSE ialah bahagian yang kekal persendirian, dan ia sudah diasingkan. Instans awam di [lolly.tools](https://lolly.tools) menjalankan [Lolly Demo](/info/lolly-demo.html), sistem reka bentuk Lolly sendiri.

Tiada apa-apa di sini bergantung pada janji: setiap versi yang dikeluarkan kekal sumber terbuka, dan satu-satunya yang ditahan ialah cap dagangan. Apabila syarikat lain menutup sumber Linux perusahaannya pada 2023, SUSE turut mengasaskan [OpenELA](https://openela.org) untuk memastikan kod itu terbuka, pendirian yang sama diwarisi projek ini.

Pendedahan penuh: SUSE *sedang* membina perkakasan dalaman untuk menyambungkan Lolly kepada sistem IT-nya sendiri. Itu persediaan dalaman SUSE, bukan pemisahan antara pembangunan awam dan persendirian. Lolly juga bertujuan untuk dibina melalui [Open Build Service](https://openbuildservice.org/), dengan artifak rantaian bekalan selamat yang dihantar oleh [SUSE Application Collection](https://apps.rancher.io/applications).

## Kenapa nama "Lolly Tools"?

**Lolly** kerana kebebasan itu manis, dan kerana di Australia, New Zealand dan Britain, lolly bermaksud gula-gula.

**Tools** kerana sesuatu alat hanya terletak diam sehingga anda mengambilnya. Ia tidak berjalan ketika anda tidak menggunakannya, dan ia tidak memerhati anda ketika anda menggunakannya.

## Mengapa semuanya hijau?

lolly.tools dibuka dalam [Lolly Demo](/info/lolly-demo.html), sistem reka bentuk contoh Lolly sendiri, dan warna utamanya ialah hijau. Ia contoh, bukan peraturan. Tukar kepada **Lolly Starter**, sistem reka bentuk kosong, atau kepada milik anda dalam [Settings → Design systems](/#/settings?focus=design-systems-section).

## Bolehkah saya menggunakan jenama saya sendiri?

Ya. **Design System Setup** (`#/start`) membina sistem reka bentuk daripada satu warna, fail token reka bentuk atau reka bentuk yang siap, dan setiap alat kemudian melukis dengan sistem reka bentuk anda. [Start](/info/quickstart.html#put-your-brand-in) menelusuri tiga laluan itu.

Sistem reka bentuk yang dibekalkan organisasi atau binaan anda adalah terurus: ia menunjukkan kunci dan kekal baca sahaja, dan anda boleh membuat salinan boleh sunting untuk mengubahnya.

## Di mana perkara yang saya buat semalam?

Jika anda menekan **Save as** atau **Save**, ia ada dalam **Projects**, pada skrin utama, dalam pelayar atau apl tempat anda menyimpan. Jika anda hanya menekan **Download**, fail berada di tempat pelayar atau sistem anda menyimpan muat turun, dan biasanya salinan ada dalam **Assets**. Alat yang [menyimpan semasa anda bekerja](/info/find-your-work.html#which-tools-save-as-you-work) juga menyimpan kerja yang belum disimpan dalam **Projects**. [Find and recover your work](/info/find-your-work.html) meliputi setiap kes.

## Saya menutup tab. Adakah kerja saya hilang?

Kerja yang disimpan masih ada dalam **Projek**. Kerja yang belum disimpan hilang, kecuali pada alat yang menyimpan semasa anda bekerja, yang turut menyimpannya dalam **Projek**. Lain kali, tekan **Simpan sebagai** sebelum anda keluar. Lihat [Jika anda menutup tab atau meninggalkan alat](/info/find-your-work.html#if-you-closed-the-tab-or-left-the-tool).

## Bolehkah saya berkongsi hasil kerja saya sebagai fail dan bukan pautan?

Ya. Apabila pautan tidak dapat membawa segala-galanya, seperti foto anda sendiri atau teks panjang, dialog Share menyatakan apa yang akan hilang dan menawarkan fail **.lolly** sebagai gantinya: satu fail yang memegang reka bentuk, imej yang digunakannya dan, jika anda pilih, alat itu sendiri.

Anda memutuskan berapa banyak yang dibawa. Nama dan butiran anda masuk hanya jika profil anda ikut serta, dan seni berlesen ditahan melainkan anda memilih untuk menyertakan seni itu. Sesiapa yang membuka fail yang membawa alat ditanya sama ada mereka mempercayai alat itu sebelum ia boleh dijalankan. Lihat [Sharing your work](/info/using.html#sharing-your-work).

## Apa yang dilakukan butiran profil saya?

Butiran anda dalam **Settings** mengisi awal alat yang memintanya, seperti nama pada lencana. Ia kekal pada peranti ini. Jika anda juga menghidupkan pilihan ikut serta, butiran yang anda pilih dimeteraikan ke dalam apa yang anda buat, menamakan anda sebagai sumber. Tiada apa-apa disertakan melainkan anda memilih untuk menyertakan butiran anda.

Perkongsian dan Sync hanya menghantar kandungan yang anda pilih. Pada instans Lolly Work organisasi, sesi dikongsi dan kerja yang ditadbir juga pergi ke pelayan itu. Lihat [Privacy](/info/privacy.html).

## Bagaimana saya mendapatkan apl mudah alih atau desktop?

Muat turun daripada [Install Lolly](/info/install.html). Halaman menyenaraikan setiap binaan untuk macOS, Windows, Linux dan Android, dan menunjukkan cara menyemak fail yang anda muat turun. iPhone dan iPad mendapat **Lolly Tools** daripada App Store; [bahagian iPhone dan iPad](/info/install.html#iphone-and-ipad) mempunyai pautan.

Sesiapa juga boleh membina dan mengedarkan salinan apl mereka sendiri, dengan alat dan tetapan yang diperlukan khalayak mereka. [Build Guide](/info/build-guide.html) menunjukkan caranya.

## Lolly menyatakan ia memerlukan WebGPU. Apa yang boleh saya buat?

Apl web melukis dengan WebGPU, ciri grafik pelayar semasa, dan ia menyemaknya sebelum membuka alat. Cuba ini mengikut susunan:

1. Kemas kini pelayar anda kepada versi semasa.
2. Hidupkan pecutan grafik atau perkakasan dalam tetapan pelayar, kemudian mulakan semula pelayar.
3. Cuba pelayar yang telah diuji: [Supported environments](/info/supported-environments.html) menyenaraikannya.
4. Pada Mac, iPhone atau iPad, [pasang apl](/info/install.html) sebagai gantinya.

## Bolehkah Lolly menyunting dan merender fail Figma, Penpot, Illustrator atau InDesign saya?

Ya. Buka **Design** dan klik **Import a design**: ia menerima **.fig** Figma asli (Save local copy), eksport **.penpot** Penpot, **.ai** atau **.pdf** Illustrator, **.idml** InDesign (File → Export → InDesign Markup) atau **mana-mana SVG**. Anda tidak memerlukan akaun, pemalam atau lesen apl reka bentuk.

![Kanvas terbuka Design - Import reka bentuk berada dalam menu Lolly pada rel alat](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZTfS8MwEMf_mryO5NZ288GHrdqJv1CUvWdtOgppMtJMNv96yaV1iRNEQRBZoblwab53l0-uq915bXgrCOSDpf3LzgANnQ4eI0rrPJn7Gh9cd0sE8lIryxtFIFfatFx6L4F0Mi-11GbUiZYr25QjK3bW-S8I5MnUbRXKCkMgb5uqki6JFFU7rjoXYsSgT8GaLebKZSeGAPkUYypMHp80DeugYYR4J_U7X4XRkY8dFHuTYEJ-jDWM3qoqsEHo4Y20-xJi-SPVaOfRUuAL1hiZXNrG4gH6M85Z5lTAk8x8DdlnPL8gecVfBIEU6F5v0bbCor3VUu4JpOPCKTCWsPI9rBS107d6QyCfRET_Ac6wX36X6UpX-49Ip1mAlMEPkM6QX20aoSpECLTmpadcazPQ9hPlWxboRndWmFEIG1s4Yp3E3Ts-0f4GbcruWHLzlC0frmfpfbGk82LxmD0vUndSTcvXAoknWBKCz5LDSIdiRHV0D2Tfq1BIvdY42Zim5WZ_-n3_mRvwBg&width=1360&height=850&dpi=192&waitMs=3000&format=svg&walker=1&chrome=1&localize=1&dark=1&filename=design)

Lapisan tiba sebagai kotak boleh sunting: teks kekal boleh ditaip semula, bentuk kekal bentuk dan imej menyertai pustaka anda sendiri. Simpannya, dan **Share with rules** boleh menukar reka letak menjadi alat yang boleh diisi semula oleh sesiapa yang mempunyai Lolly. Lihat [Import a design](/info/design-import.html).

## Bolehkah dua orang bekerja pada reka bentuk yang sama tanpa internet?

Ya. Seorang berkongsi jemputan, sebagai pautan, kod QR atau kod pendek, dan yang lain menerima. Kedua-dua peranti kemudian memegang sesi yang sama secara langsung, termasuk kehadiran dan gelang fokus. Ia berfungsi pada mana-mana rangkaian dikongsi, termasuk hotspot telefon di ruang bawah tanah, kerana tiada pelayan di tengah. Lihat [Working together](/info/collaborate.html). Bagi rakan sekerja pada rangkaian berbeza, instans Lolly Work organisasi menyediakan collab kerja yang disahkan.

## Apakah itu feature flags?

Bendera ciri menghidupkan atau mematikan bahagian Lolly. Dalam penggunaan kendiri, anda memilih tetapan peribadi anda. Organisasi yang menggunakan Lolly Work boleh menetapkan lalai atau menyembunyikan suis terpilih di bawah dasarnya, dan kawalan terurus dilabelkan. Lihat [Use Lolly at your organisation](/info/organisation.html).

![Bendera ciri peribadi dalam apl kendiri; dasar organisasi boleh mentadbir suis terpilih](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dfeature-flags&width=1440&height=1800&dpi=192&waitMs=2000&format=svg&cropSelector=%23feature-flags-section&walker=1&dark=1&filename=pd-feature-flags)

## Apa yang membezakan utiliti daripada alat?

Utiliti melakukan satu tugas pantas pada fail yang sudah anda ada, seperti memampatkan PDF, menukar foto atau membuang data tersembunyi, dan banyak daripadanya berjalan pada peranti anda tanpa apa-apa dimuat naik. Ia wujud supaya tugas yang biasanya diserahkan orang kepada laman web rawak kekal di dalam Lolly. Memampatkan kontrak, menukar foto percutian dengan lokasinya masih di dalam atau menampal token ke dalam pemformat dalam talian tidak sepatutnya bermakna memberikan fail kepada tapak dengan pengekalan, bidang kuasa dan model perniagaan yang tidak diketahui. [Utilities](/info/utilities.html) menyenaraikannya, dan [The trade we never agreed to](/info/status-quo.html) menceritakan kisah di sebaliknya.

![Paparan Utilities: Strip Hidden Data, Compress PDF, Convert Image dan tugas pada peranti yang lain, semuanya di satu tempat](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## Bolehkah organisasi kami menggunakan SSO, projek dikongsi dan kelulusan?

Ya, dengan **Lolly Work**, pelayan organisasi projek sumber terbuka yang sama. Ia berjalan secara berasingan dan menambah log masuk tunggal melalui penyedia identiti anda, penyediaan SCIM, kebenaran kumpulan, projek dan aset dikongsi, collab kerja langsung, kelulusan dan rekod audit. Apl harian masih berfungsi sendiri.

[Use Lolly at your organisation](/info/organisation.html) meliputi log masuk dan mencari kerja dikongsi, dan [Deployment](/info/deployment.html#organisation-services-with-lolly-work) meliputi penyediaannya. Kandungan dikongsi dan rekod organisasi mengikut dasar privasi dan pengekalan instans itu.

## Apakah halangan yang mungkin saya hadapi apabila menerima pakai Lolly?

Kebanyakannya berubah pada sisi pengeluaran dan bukan teknologi. Pasukan yang mahukan set alat yang ditadbir memerlukan seseorang untuk mengarang sistem reka bentuknya dan templat pertama, walaupun sesiapa boleh mula membuat alat mereka sendiri dalam Design pada hari pertama, tanpa git. Dan proses sedia ada terus berfungsi walaupun outputnya tersasar daripada jenama, jadi menukar satu output yang kelihatan dengan baik, sebelum dan selepas bersebelahan, membuat kes lebih cepat daripada pelan.

[Adoption & Governance](/info/adoption-governance.html) meliputi orientasi mengikut peranan, cara mengukur perintis dan rupa proses tadbir urus.

## Adakah Lolly "vibe coded"?

Lolly dibangunkan dengan pengekodan dibantu AI, penemuan dibantu AI dan, di banyak tempat, kandungan dibantu AI, menggunakan campuran model dan vendor, termasuk daripada syarikat sempadan awan awam. Seorang manusia mencipta seni bina, menyusun kod dengan sengaja dan mengarahkan seni pengalaman.

Nasihat keselamatan tinggi atau kritikal dalam kebergantungan Lolly menyekat CI. Nasihat yang belum dapat dibaiki ditahan hanya sebagai pengecualian yang diluluskan dengan sebab bertulis. [SECURITY.md](https://github.com/lolly-tools/lolly/blob/main/SECURITY.md#dependency-audit-exceptions) menyenaraikan setiap pengecualian yang dipegang hari ini, dan [nota keluaran](https://github.com/lolly-tools/lolly/releases) menyenaraikan yang dibawa setiap keluaran. SECURITY.md juga menyatakan cara melaporkan kerentanan.

Semakan dalam binaan juga menolak perkataan yang kedengaran seperti buatan mesin dalam komen kod, apl dan dokumen ini, untuk memastikan teks mudah bagi setiap pembaca. Kesan sampingan ialah pengesan mungkin lebih sukar mengetahui teks mana yang ditulis model. Kami tidak berniat menyebabkannya.

Yang paling penting, Lolly berdiri di atas bahu kerja sumber terbuka berdekad-dekad oleh pakar di seluruh dunia.

**Pendedahan AI generatif:**

- **Kod ditulis LLM:** Opus 4.8, Gemini 3.1, Qwen3-Coder-Next, Codex Sol (senarai ini mungkin bertambah)
- **Penemuan LLM:** Gemini 3.1, Fable, Codex Astra
- **Dokumentasi:** Sonnet 5
- **Pustaka sumber terbuka:** Pengarang masing-masing, dinyatakan dalam SBOM, komen dan pengepala fail

Senarai ini tidak termasuk model yang divendorkan ke dalam Lolly.

**Tuntutan manusia:**
- **Pengideaan, semakan dan maklum balas:** Ravan Naidoo, Matthias Eckermann, Kelly Andrews, Ryan Kleeman, Peter Chamalian, Penpot Community, Tim Hildred (senarai tidak lengkap)
- **Seni bina, arahan seni & slop janitor:** Andy Fitzsimon

## Ke mana perginya alat berjenama SUSE?

Ia berada dalam repositori persendirian yang berasingan. Klon awam tidak mengambil pek jenama SUSE langsung, jadi binaan daripadanya menggunakan profil neutral `lolly-start` melainkan anda memilih yang lain: alat komuniti tanpa jenama ditambah jenama kosong yang anda isi dengan milik anda sendiri. [lolly.tools](https://lolly.tools) dibina dengan profil `lolly-demo` dan dibuka dalam [Lolly Demo](/info/lolly-demo.html), sistem reka bentuk Lolly sendiri. SUSE mengendalikan instansnya sendiri untuk melindungi cap dagangannya.

## Logo Lolly itu perisa apa?

Ada yang kata Limau Nipis, ada yang kata Pudina dan kadangkala Epal, Lolly membawa manisnya, anda yang mewujudkan perisanya!
