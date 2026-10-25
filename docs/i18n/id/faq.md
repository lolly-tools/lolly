# Tanya jawab

Pertanyaan yang sering diajukan, ditampilkan sebagai akordeon di `/info/start/faq.html`.

**Cara merawat:** setiap judul `##` di bawah ini adalah sebuah pertanyaan; semua yang ada di bawahnya
(sampai `##` berikutnya) adalah jawabannya. Jawaban memakai markdown ringan yang sama dengan
bagian lain situs ini - pisahkan paragraf dengan satu baris kosong. Tambah, hapus atau
susun ulang pertanyaan di sini lalu jalankan ulang `pnpm run build:info` (atau `pnpm run dev:web`).
Semua yang berada di atas `##` pertama (judul ini dan catatan ini) diabaikan oleh proses build.

Urutannya adalah urutan pengguna baru: jebakannya dulu, lalu file Anda, lalu mendapatkan
dan menjalankan Lolly, lalu organisasi, lalu bagaimana ia dibuat. Anchor setiap pertanyaan
dibangun dari pertanyaan bahasa Inggris pada posisi yang sama, jadi terjemahan mempertahankan
urutan bahasa Inggris.

## Mengapa gratis? Apa jebakannya?

**Kami membuat Lolly untuk diri kami sendiri.** SUSE membutuhkan ribuan file sesuai brand, dibuat tanpa menyerahkan apa pun ke layanan luar. Jadi kami membangun alat yang mengerjakan semuanya di perangkat, dan merilisnya sebagai sumber terbuka, seperti semua yang kami buat. Kami terus memeliharanya karena kami memakainya setiap hari. **Tidak ada kewajiban:** semua yang ada di sini berfungsi dengan atau tanpa kami.

Garis itu ditarik dalam lisensi, bukan dalam janji: apa pun yang berjalan secara lokal gratis, selamanya. Versi yang dirilis dilisensikan sehingga tidak dapat ditarik kembali, dan tidak ada perjanjian kontributor yang dapat melisensikan ulang karya siapa pun.

## Seberapa banyak yang disimpan SUSE secara privat? (alias kapan kami ditinggal di tengah jalan)

Engine, shell, skema, dan alat yang tidak terikat brand adalah sumber terbuka. Merek dagang SUSE dan alat bermerek adalah bagian yang tetap privat, dan sudah dipisahkan. Instans publik di [lolly.tools](https://lolly.tools) menjalankan [Lolly Demo](/info/lolly-demo.html), design system milik Lolly sendiri.

Tidak ada yang bersandar pada janji di sini: setiap versi yang dirilis tetap sumber terbuka, dan satu-satunya yang ditahan adalah merek dagang. Ketika perusahaan lain menutup sumber Linux enterprise-nya pada 2023, SUSE ikut mendirikan [OpenELA](https://openela.org) untuk menjaga kode itu tetap terbuka, sikap yang sama yang diwarisi proyek ini.

Keterbukaan penuh: SUSE *memang* membangun perkakas internal untuk menghubungkan Lolly dengan sistem TI-nya sendiri. Itu adalah pengaturan internal SUSE, bukan pemisahan antara pengembangan publik dan privat. Lolly juga bertujuan dibangun melalui [Open Build Service](https://openbuildservice.org/), dengan artefak rantai pasok yang aman disediakan oleh [SUSE Application Collection](https://apps.rancher.io/applications).

## Mengapa namanya "Lolly Tools"?

**Lolly** karena kebebasan itu manis, dan karena di Australia, Selandia Baru dan Inggris, lolly berarti permen.

**Tools** karena sebuah alat diam saja sampai Anda mengambilnya. Alat tidak berjalan saat tidak Anda pakai, dan tidak mengawasi Anda saat Anda memakainya.

## Mengapa semuanya hijau?

lolly.tools terbuka di [Lolly Demo](/info/lolly-demo.html), design system contoh milik Lolly sendiri, dan warna utamanya hijau. Itu contoh, bukan aturan. Beralihlah ke **Lolly Starter**, design system kosong, atau ke milik Anda sendiri di [Settings → Design systems](/#/settings?focus=design-systems-section).

## Bisakah saya memakai brand saya sendiri?

Bisa. **Design System Setup** (`#/start`) membangun design system dari satu warna, file token desain, atau desain jadi, dan setiap alat kemudian menggambar dengan design system Anda. [Start](/info/quickstart.html#put-your-brand-in) menelusuri ketiga jalurnya.

Design system yang disediakan organisasi atau build Anda bersifat managed: menampilkan kunci dan tetap hanya-baca, dan Anda dapat membuat salinan yang dapat disunting untuk mengubahnya.

## Di mana yang saya buat kemarin?

Jika Anda menekan **Save as** atau **Save**, file ada di **Projects**, di layar beranda, di browser atau aplikasi tempat Anda menyimpan. Jika Anda hanya menekan **Download**, file ada di tempat browser atau sistem Anda menyimpan unduhan, dan biasanya salinannya ada di **Assets**. Alat yang [menyimpan saat Anda bekerja](/info/find-your-work.html#which-tools-save-as-you-work) juga menyimpan pekerjaan yang belum disimpan di **Projects**. [Find and recover your work](/info/find-your-work.html) membahas setiap kasus.

## Saya menutup tab. Apakah karya saya hilang?

Karya tersimpan masih ada di **Proyek**. Karya yang belum disimpan hilang, kecuali pada tool yang menyimpan sambil Anda bekerja, yang juga menyimpannya di **Proyek**. Lain kali, tekan **Simpan sebagai** sebelum Anda keluar. Lihat [Jika Anda menutup tab atau meninggalkan tool](/info/find-your-work.html#if-you-closed-the-tab-or-left-the-tool).

## Bisakah saya membagikan karya sebagai file, bukan tautan?

Bisa. Bila tautan tidak dapat membawa semuanya, seperti foto atau teks panjang Anda sendiri, dialog Share menyebut apa yang akan hilang dan menawarkan file **.lolly** sebagai gantinya: satu file yang memuat desain, gambar yang dipakainya, dan, bila Anda memilih, alatnya sendiri.

Anda yang memutuskan seberapa banyak yang ikut. Nama dan detail Anda masuk hanya bila profil Anda memilih ikut, dan karya berlisensi ditahan kecuali Anda memilih menyertakannya. Siapa pun yang membuka file yang membawa alat ditanya apakah mereka memercayai alat itu sebelum dapat berjalan. Lihat [Sharing your work](/info/using.html#sharing-your-work).

## Apa fungsi detail profil saya?

Detail Anda di **Settings** mengisi otomatis alat yang memintanya, seperti nama pada tanda pengenal. Detail itu tetap di perangkat ini. Jika Anda juga mengaktifkan opsi ikut serta, detail yang Anda pilih disegel ke dalam apa yang Anda buat, menyebut Anda sebagai sumbernya. Tidak ada yang disertakan kecuali Anda memilih menyertakan detail Anda.

Berbagi dan Sync hanya mengirim konten yang Anda pilih. Pada instans Lolly Work organisasi, sesi bersama dan pekerjaan yang diatur juga masuk ke server itu. Lihat [Privacy](/info/privacy.html).

## Bagaimana cara mendapatkan aplikasi seluler atau desktopnya?

Unduh dari [Install Lolly](/info/install.html). Halaman itu mencantumkan setiap build untuk macOS, Windows, Linux, dan Android, dan menunjukkan cara memeriksa file yang Anda unduh. iPhone dan iPad mendapatkan **Lolly Tools** dari App Store; [bagian iPhone dan iPad](/info/install.html#iphone-and-ipad) memiliki tautannya.

Siapa pun juga dapat membangun dan membagikan salinan aplikasi miliknya sendiri, dengan alat dan pengaturan yang dibutuhkan audiensnya. [Build Guide](/info/build-guide.html) menunjukkan caranya.

## Lolly mengatakan memerlukan WebGPU. Apa yang bisa saya lakukan?

Aplikasi web menggambar dengan WebGPU, fitur grafis browser terkini, dan memeriksanya sebelum membuka alat. Coba berurutan:

1. Perbarui browser Anda ke versi terbaru.
2. Aktifkan akselerasi grafis atau perangkat keras di pengaturan browser, lalu mulai ulang browser.
3. Coba browser yang sudah diuji: [Supported environments](/info/supported-environments.html) mencantumkannya.
4. Di Mac, iPhone, atau iPad, [pasang aplikasinya](/info/install.html) saja.

## Bisakah Lolly mengedit dan merender file Figma, Penpot, Illustrator atau InDesign saya?

Bisa. Buka **Design** dan klik **Import a design**: ia menerima **.fig** Figma asli (Save local copy), ekspor **.penpot** Penpot, **.ai** atau **.pdf** Illustrator, **.idml** InDesign (File → Export → InDesign Markup), atau **SVG apa pun**. Anda tidak memerlukan akun, plugin, atau lisensi aplikasi desain.

![Kanvas terbuka Design - Impor desain berada di menu Lolly pada rel](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZTfS8MwEMf_mryO5NZ288GHrdqJv1CUvWdtOgppMtJMNv96yaV1iRNEQRBZoblwab53l0-uq915bXgrCOSDpf3LzgANnQ4eI0rrPJn7Gh9cd0sE8lIryxtFIFfatFx6L4F0Mi-11GbUiZYr25QjK3bW-S8I5MnUbRXKCkMgb5uqki6JFFU7rjoXYsSgT8GaLebKZSeGAPkUYypMHp80DeugYYR4J_U7X4XRkY8dFHuTYEJ-jDWM3qoqsEHo4Y20-xJi-SPVaOfRUuAL1hiZXNrG4gH6M85Z5lTAk8x8DdlnPL8gecVfBIEU6F5v0bbCor3VUu4JpOPCKTCWsPI9rBS107d6QyCfRET_Ac6wX36X6UpX-49Ip1mAlMEPkM6QX20aoSpECLTmpadcazPQ9hPlWxboRndWmFEIG1s4Yp3E3Ts-0f4GbcruWHLzlC0frmfpfbGk82LxmD0vUndSTcvXAoknWBKCz5LDSIdiRHV0D2Tfq1BIvdY42Zim5WZ_-n3_mRvwBg&width=1360&height=850&dpi=192&waitMs=3000&format=svg&walker=1&chrome=1&localize=1&dark=1&filename=design)

Layer tiba sebagai kotak yang dapat disunting: teks tetap dapat diketik ulang, bentuk tetap bentuk, dan gambar bergabung ke pustaka Anda sendiri. Simpan, dan **Share with rules** dapat mengubah tata letak menjadi alat yang dapat diisi ulang siapa pun yang memiliki Lolly. Lihat [Import a design](/info/design-import.html).

## Bisakah dua orang mengerjakan desain yang sama tanpa internet?

Bisa. Satu orang membagikan undangan, sebagai tautan, kode QR, atau kode singkat, dan yang lain menerima. Kedua perangkat kemudian memegang sesi yang sama secara langsung, termasuk kehadiran dan cincin fokus. Ini berfungsi di jaringan bersama mana pun, termasuk hotspot ponsel di ruang bawah tanah, karena tidak ada server di tengah. Lihat [Working together](/info/collaborate.html). Untuk rekan di jaringan berbeda, instans Lolly Work organisasi menyediakan work collab terautentikasi.

## Apa itu feature flag?

Feature flag menyalakan atau mematikan bagian Lolly. Pada penggunaan mandiri, Anda memilih pengaturan pribadi Anda. Organisasi yang memakai Lolly Work dapat menetapkan default atau menyembunyikan sakelar tertentu sesuai kebijakannya, dan kontrol terkelola diberi label. Lihat [Use Lolly at your organisation](/info/organisation.html).

![Feature flag pribadi di aplikasi mandiri; kebijakan organisasi dapat mengatur sakelar tertentu](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dfeature-flags&width=1440&height=1800&dpi=192&waitMs=2000&format=svg&cropSelector=%23feature-flags-section&walker=1&dark=1&filename=pd-feature-flags)

## Apa yang membedakan utilitas dari alat?

Utilitas mengerjakan satu tugas cepat pada file yang sudah Anda miliki, seperti mengompres PDF, mengonversi foto, atau menghapus data tersembunyi, dan banyak di antaranya berjalan di perangkat Anda tanpa unggahan. Utilitas ada agar pekerjaan yang biasanya diserahkan orang ke situs acak tetap berada di dalam Lolly. Mengompres kontrak, mengonversi foto liburan yang masih menyimpan lokasinya, atau menempel token ke formatter online seharusnya tidak berarti menyerahkan file ke situs dengan retensi, yurisdiksi, dan model bisnis yang tidak diketahui. [Utilities](/info/utilities.html) mencantumkannya, dan [The trade we never agreed to](/info/status-quo.html) menceritakan kisah di baliknya.

![Tampilan Utilities: Strip Hidden Data, Compress PDF, Convert Image, dan pekerjaan di perangkat lainnya, semuanya di satu tempat](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## Bisakah organisasi kami memakai SSO, proyek bersama, dan persetujuan?

Bisa, dengan **Lolly Work**, server organisasi dari proyek sumber terbuka yang sama. Ia berjalan terpisah dan menambahkan single sign-on melalui penyedia identitas Anda, penyediaan SCIM, izin grup, proyek dan aset bersama, work collab langsung, persetujuan, dan catatan audit. Aplikasi sehari-hari tetap berfungsi sendiri.

[Use Lolly at your organisation](/info/organisation.html) membahas login dan menemukan pekerjaan bersama, dan [Deployment](/info/deployment.html#organisation-services-with-lolly-work) membahas penyiapannya. Konten bersama dan catatan organisasi mengikuti kebijakan privasi dan retensi instans itu.

## Hambatan apa yang mungkin muncul saat mengadopsi Lolly?

Sebagian besar perubahan ada di sisi produksi, bukan teknologi. Tim yang menginginkan seperangkat alat yang diatur membutuhkan seseorang untuk menyusun design system dan templat pertamanya, meskipun siapa pun dapat mulai membuat alatnya sendiri di Design sejak hari pertama, tanpa git. Dan proses yang ada tetap berjalan meskipun keluarannya menyimpang dari brand, jadi mengonversi satu keluaran yang terlihat dengan baik, sebelum dan sesudah berdampingan, membuktikan lebih cepat daripada rencana.

[Adoption & Governance](/info/adoption-governance.html) membahas orientasi menurut peran, cara mengukur pilot, dan seperti apa proses tata kelola.

## Apakah Lolly "vibe coded"?

Lolly dikembangkan dengan pengodean berbantuan AI, penemuan berbantuan AI, dan, di banyak tempat, konten berbantuan AI, memakai campuran model dan vendor, termasuk dari perusahaan frontier cloud publik. Manusia menciptakan arsitekturnya, menyeleksi kode dengan sengaja, dan mengarahkan seni pengalamannya.

Advisori tinggi atau kritis pada dependensi Lolly memblokir CI. Advisori yang belum dapat diperbaiki ditahan hanya sebagai pengecualian yang disetujui dengan alasan tertulis. [SECURITY.md](https://github.com/lolly-tools/lolly/blob/main/SECURITY.md#dependency-audit-exceptions) mencantumkan setiap pengecualian yang berlaku saat ini, dan [release notes](https://github.com/lolly-tools/lolly/releases) mencantumkan yang dibawa tiap rilis. SECURITY.md juga menjelaskan cara melaporkan kerentanan.

Pemeriksaan di build juga menolak kata-kata yang terbaca seperti buatan mesin di komentar kode, aplikasi, dan dokumen ini, agar teks tetap lugas bagi setiap pembaca. Efek sampingnya, detektor mungkin lebih sulit membedakan teks mana yang ditulis model. Kami tidak bermaksud menimbulkannya.

Yang terpenting, Lolly berdiri di atas bahu karya sumber terbuka selama puluhan tahun oleh para ahli di seluruh dunia.

**Pengungkapan AI generatif:**

- **Kode yang ditulis LLM:** Opus 4.8, Gemini 3.1, Qwen3-Coder-Next, Codex Sol (daftar ini dapat bertambah)
- **Penemuan oleh LLM:** Gemini 3.1, Fable, Codex Astra
- **Dokumentasi:** Sonnet 5
- **Pustaka sumber terbuka:** Para penulisnya masing-masing, dinyatakan dalam SBOM, komentar, dan header file

Daftar ini tidak mencakup model yang di-vendor-kan ke dalam Lolly.

**Klaim manusia:**
- **Ide, tinjauan, dan masukan:** Ravan Naidoo, Matthias Eckermann, Kelly Andrews, Ryan Kleeman, Peter Chamalian, Komunitas Penpot, Tim Hildred (daftar tidak lengkap)
- **Arsitektur, pengarahan seni & pembersih slop:** Andy Fitzsimon

## Ke mana perginya alat-alat bermerek SUSE?

Semuanya berada di repositori terpisah yang privat. Klon publik tidak mengambil paket brand SUSE sama sekali, jadi build darinya memakai profil netral `lolly-start` kecuali Anda memilih yang lain: alat komunitas yang tidak terikat brand ditambah brand kosong yang Anda isi sendiri. [lolly.tools](https://lolly.tools) dibangun dengan profil `lolly-demo` dan terbuka di [Lolly Demo](/info/lolly-demo.html), design system milik Lolly sendiri. SUSE mengoperasikan instansnya sendiri untuk melindungi merek dagangnya.

## Rasa apa logo Lolly itu?

Ada yang bilang Jeruk Nipis, ada yang bilang Mint dan kadang Apel, Lolly membawa manisnya, Anda yang mewujudkan rasanya!
