# Tanya & jawab

Pertanyaan yang sering diajukan, dirender sebagai akordeon di `/info/start/faq.html`.

**Cara memelihara:** setiap judul `##` di bawah adalah pertanyaan. Semua yang ada di bawah judul,
sampai `##` berikutnya, adalah jawabannya. Jawaban menggunakan markdown ringan situs ini:
pisahkan paragraf dengan baris kosong. Tambahkan, hapus atau susun ulang pertanyaan di sini dan
jalankan ulang `pnpm run build:info` (atau `pnpm run dev:web`).
Build mengabaikan semua yang ada di atas `##` pertama (judul ini dan catatan ini).

Urutannya mengikuti kebutuhan pengguna baru: konsekuensinya lebih dulu, lalu file Anda, lalu mendapatkan
dan menjalankan Lolly, lalu organisasi, lalu cara pembuatannya. Anchor setiap pertanyaan
dibuat dari pertanyaan bahasa Inggris pada posisi yang sama, jadi terjemahan mempertahankan
urutan bahasa Inggris.

## Mengapa gratis? Apa konsekuensinya?

**Kami membuat Lolly untuk kami sendiri.** SUSE memerlukan ribuan file yang sesuai merek, dibuat tanpa menyerahkan apa pun ke layanan luar. Jadi kami membuat alat yang melakukan semuanya di perangkat, lalu merilisnya sebagai open source, seperti semua hal lain yang kami buat. Kami terus memeliharanya karena kami menggunakannya setiap hari. **Tidak ada kewajiban:** semua yang ada di sini berfungsi dengan atau tanpa kami.

Batas itu ditetapkan dalam lisensi, bukan janji: apa pun yang berjalan secara lokal gratis, selamanya. Versi yang telah dirilis memiliki lisensi sehingga tidak dapat ditarik kembali. Tidak ada perjanjian kontributor yang dapat melisensikan ulang karya siapa pun.

## Seberapa banyak yang tetap ditutup SUSE? (alias kapan aksesnya akan ditarik sepihak)

Mesin, shell, skema dan alat yang tidak terikat merek bersifat open source. Merek dagang dan alat bermerek milik SUSE tetap privat dan sudah dipisahkan. Instans publik di [lolly.tools](https://lolly.tools) menjalankan [Lolly Demo](/info/lolly-demo.html), design system milik Lolly sendiri.

Tidak ada yang bergantung pada janji di sini: setiap versi yang telah dirilis tetap open source. Ketika perusahaan lain menutup sumber Linux enterprise-nya pada 2023, SUSE ikut mendirikan [OpenELA](https://openela.org) untuk menjaga kode itu tetap terbuka. Proyek ini mewarisi sikap tersebut.

SUSE *memang* sedang membuat alat internal untuk menghubungkan Lolly ke sistem TI-nya sendiri. Itu adalah pengaturan internal SUSE, bukan pemisahan antara pengembangan publik dan privat. Lolly juga menargetkan build melalui [Open Build Service](https://openbuildservice.org/), dengan artefak rantai pasok yang aman disediakan oleh [SUSE Application Collection](https://apps.rancher.io/applications).

## Mengapa namanya "Lolly Tools"?

**Lolly** karena kebebasan itu manis, dan karena di Australia, Selandia Baru dan Britania, lolly adalah permen.

**Tools** karena alat tetap diam sampai Anda mengambilnya. Alat tidak berjalan saat Anda tidak menggunakannya, dan tidak mengawasi Anda saat Anda menggunakannya.

## Mengapa semuanya hijau?

lolly.tools terbuka dengan [Lolly Demo](/info/lolly-demo.html), contoh design system milik Lolly sendiri, yang warna utamanya hijau. Beralihlah ke **Lolly Starter**, design system kosong, atau ke milik Anda sendiri di [Settings → Design systems](/#/settings?focus=design-systems-section).

## Bisakah saya menggunakan merek sendiri?

Bisa. **Lolly Design System Setup** (`#/start`) membuat design system dari satu warna, file token desain atau desain jadi. Setiap alat lalu menggambar dengan design system Anda. [Mulai](/info/quickstart.html#put-your-brand-in) memandu Anda melalui ketiga jalur tersebut.

Design system yang disediakan organisasi atau build Anda bersifat terkelola. Design system itu menampilkan gembok dan tetap hanya baca. Untuk mengubahnya, buat salinan yang dapat disunting.

## Di mana karya yang saya buat kemarin?

Jika Anda menekan **Save as** atau **Save**, pekerjaan Anda ada di **Projects** pada layar beranda, di browser atau aplikasi tempat Anda menyimpannya. Jika Anda hanya menekan **Download**, file berada di unduhan browser atau sistem Anda, dan salinannya biasanya ada di **Assets**. Alat yang [menyimpan saat Anda bekerja](/info/find-your-work.html#which-tools-save-as-you-work) juga menyimpan pekerjaan yang belum disimpan di **Projects**. [Temukan dan pulihkan pekerjaan Anda](/info/find-your-work.html) membahas setiap kasus.

## Saya menutup tab. Apakah pekerjaan saya hilang?

Pekerjaan tersimpan tetap ada di **Projects**. Pekerjaan yang belum disimpan hilang, kecuali di alat yang menyimpan saat Anda bekerja, yang juga menyimpannya di **Projects**. Lain kali, tekan **Save as** sebelum Anda keluar. Lihat [Jika Anda menutup tab atau meninggalkan alat](/info/find-your-work.html#if-you-closed-the-tab-or-left-the-tool).

## Bisakah saya membagikan pekerjaan sebagai file alih-alih tautan?

Bisa. Saat tautan tidak dapat membawa semuanya, seperti foto milik Anda sendiri atau teks panjang, dialog Share menyatakan apa yang akan hilang dan menawarkan file **.lolly**. Satu file itu memuat desain, gambar yang digunakannya dan, jika Anda memilihnya, alatnya.

Anda menentukan seberapa banyak yang disertakan. Nama dan detail Anda hanya disertakan jika profil Anda mengizinkannya. Karya berlisensi tidak disertakan kecuali Anda memilih untuk menyertakannya. Siapa pun yang membuka file yang memuat alat akan ditanya apakah mereka memercayai alat itu sebelum alat dapat berjalan. Lihat [Membagikan pekerjaan Anda](/info/using.html#sharing-your-work).

## Apa fungsi detail profil saya?

Detail Anda di **Settings** mengisi lebih dahulu alat yang memintanya, seperti nama pada lencana. Detail itu tetap di perangkat ini. Tidak ada yang masuk ke karya Anda kecuali Anda mengaktifkan persetujuan penyertaan. Setelah itu, detail yang Anda pilih disegel ke dalam karya dan mencantumkan Anda sebagai sumbernya.

Sharing dan Sync hanya mengirim konten yang Anda pilih. Pada instans Lolly Work organisasi, sesi bersama dan pekerjaan yang diatur kebijakan juga dikirim ke server tersebut. Lihat [Privasi](/info/privacy.html).

## Bagaimana cara mendapatkan aplikasi seluler atau desktop?

Unduh dari [Instal Lolly](/info/install.html). Halaman itu mencantumkan setiap build untuk macOS, Windows, Linux dan Android, serta menunjukkan cara memeriksa file yang Anda unduh. iPhone dan iPad mendapatkan **Lolly Tools** dari App Store. [Bagian iPhone dan iPad](/info/install.html#iphone-and-ipad) memuat tautannya.

Siapa pun juga dapat membuat build dan membagikan salinan aplikasinya sendiri, dengan alat dan pengaturan yang diperlukan penggunanya. [Panduan Build](/info/build-guide.html) menunjukkan caranya.

## Lolly mengatakan perlu WebGPU. Apa yang bisa saya lakukan?

Aplikasi web menggambar dengan WebGPU, fitur grafis browser saat ini, dan memeriksa ketersediaan WebGPU sebelum membuka alat. Coba langkah berikut secara berurutan:

1. Perbarui browser Anda ke versi terbarunya.
2. Aktifkan akselerasi grafis atau perangkat keras di pengaturan browser, lalu mulai ulang browser.
3. Coba browser yang sudah diuji: [Lingkungan yang didukung](/info/supported-environments.html) mencantumkannya.
4. Di Mac, iPhone atau iPad, [instal aplikasinya](/info/install.html) sebagai gantinya.

## Bisakah Lolly menyunting dan merender file Figma, Penpot, Illustrator atau InDesign saya?

Bisa. Buka alat **Design** dan klik **Import a design**: alat ini menerima **.fig** native Figma (Save local copy), ekspor **.penpot** Penpot, **.ai** atau **.pdf** Illustrator, **.idml** atau **.indd** InDesign, dokumen Affinity, **.psd** Photoshop, **.pptx** PowerPoint, **.dxf** CAD atau **SVG apa pun** ([setiap format yang dapat dibaca](/info/design-import.html#what-comes-in-from-each-app)). Anda tidak memerlukan akun, plugin atau lisensi aplikasi desain.

![Kanvas terbuka Lolly Design - Import a design ada di menu Lolly pada bilah alat](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZTfS8MwEMf_mryO5NZ288GHrdqJv1CUvWdtOgppMtJMNv96yaV1iRNEQRBZoblwab53l0-uq915bXgrCOSDpf3LzgANnQ4eI0rrPJn7Gh9cd0sE8lIryxtFIFfatFx6L4F0Mi-11GbUiZYr25QjK3bW-S8I5MnUbRXKCkMgb5uqki6JFFU7rjoXYsSgT8GaLebKZSeGAPkUYypMHp80DeugYYR4J_U7X4XRkY8dFHuTYEJ-jDWM3qoqsEHo4Y20-xJi-SPVaOfRUuAL1hiZXNrG4gH6M85Z5lTAk8x8DdlnPL8gecVfBIEU6F5v0bbCor3VUu4JpOPCKTCWsPI9rBS107d6QyCfRET_Ac6wX36X6UpX-49Ip1mAlMEPkM6QX20aoSpECLTmpadcazPQ9hPlWxboRndWmFEIG1s4Yp3E3Ts-0f4GbcruWHLzlC0frmfpfbGk82LxmD0vUndSTcvXAoknWBKCz5LDSIdiRHV0D2Tfq1BIvdY42Zim5WZ_-n3_mRvwBg&width=1360&height=850&dpi=192&waitMs=3000&format=svg&walker=1&chrome=1&localize=1&dark=1&filename=design)

Lapisan masuk sebagai kotak yang dapat disunting. Teks tetap dapat diketik ulang, bentuk tetap berupa bentuk dan gambar masuk ke pustaka Anda. Setelah tata letak disimpan, **Share with rules** dapat mengubahnya menjadi alat yang dapat diisi ulang siapa pun yang memiliki Lolly. Lihat [Impor desain](/info/design-import.html).

## Bisakah dua orang mengerjakan desain yang sama tanpa internet?

Bisa. Satu orang membagikan undangan (tautan, kode QR atau kode singkat) dan yang lain menerimanya. Kedua perangkat lalu memuat sesi yang sama secara langsung, dengan indikator kehadiran dan cincin fokus. Ini bekerja pada jaringan bersama apa pun, termasuk hotspot ponsel, karena tidak ada server di tengah. Lihat [Bekerja bersama](/info/collaborate.html). Untuk rekan di jaringan berbeda, instans Lolly Work organisasi menyediakan kolaborasi kerja yang diautentikasi.

## Apa itu feature flag?

Feature flag mengaktifkan atau menonaktifkan bagian Lolly. Dalam penggunaan mandiri, Anda memilih pengaturan pribadi Anda. Organisasi yang menggunakan Lolly Work dapat menetapkan default atau menyembunyikan sakelar tertentu sesuai kebijakannya, dan kontrol terkelola diberi label. Lihat [Gunakan Lolly di organisasi Anda](/info/organisation.html).

![Feature flag pribadi di aplikasi mandiri; kebijakan organisasi dapat mengatur sakelar tertentu](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dfeature-flags&width=1440&height=1800&dpi=192&waitMs=2000&format=svg&cropSelector=%23feature-flags-section&walker=1&dark=1&filename=pd-feature-flags)

## Apa perbedaan utilitas dan alat?

Utilitas melakukan satu pekerjaan cepat pada file yang sudah Anda miliki, seperti mengompresi PDF, mengonversi foto atau menghapus data tersembunyi. Banyak yang berjalan di perangkat Anda tanpa mengunggah apa pun. Utilitas menjaga pekerjaan yang biasanya diserahkan orang ke sembarang situs web tetap di dalam Lolly. Mengompresi kontrak, mengonversi foto liburan yang masih menyimpan lokasi atau menempelkan token ke pemformat online seharusnya tidak berarti memberikan file ke situs dengan retensi, yurisdiksi dan model bisnis yang tidak diketahui. [Lolly Utilities](/info/utilities.html) mencantumkan utilitas tersebut, dan [Pertukaran yang tidak pernah kita sepakati](/info/status-quo.html) menceritakan latar belakangnya.

![Tampilan Utilities: Lolly Strip Hidden Data, Compress PDF, Convert Image dan pekerjaan lain di perangkat, semuanya di satu tempat](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## Bisakah organisasi kami menggunakan SSO, proyek bersama dan persetujuan?

Bisa, dengan **Lolly Work**, server organisasi dari proyek open source yang sama. Server ini berjalan terpisah dan menambahkan single sign-on melalui penyedia identitas Anda, provisioning SCIM, izin grup, proyek dan aset bersama, kolaborasi kerja langsung, persetujuan dan catatan audit. Aplikasi sehari-hari tetap bekerja secara mandiri.

[Gunakan Lolly di organisasi Anda](/info/organisation.html) membahas masuk dan menemukan pekerjaan bersama. [Deployment](/info/deployment.html#organisation-services-with-lolly-work) membahas penyiapan Lolly Work. Konten bersama dan catatan organisasi mengikuti kebijakan privasi dan retensi instans tersebut.

## Hambatan apa yang bisa saya hadapi saat mengadopsi Lolly?

Terutama perubahan cara tim menghasilkan pekerjaan, bukan teknologi. Tim yang menginginkan kumpulan alat yang diatur kebijakan memerlukan seseorang untuk membuat design system dan templat pertamanya. Siapa pun tetap dapat membuat alat sendiri di Lolly Design pada hari pertama, tanpa memerlukan git. Proses yang ada tetap berjalan meski keluarannya tidak sesuai merek. Mengonversi satu keluaran yang terlihat dengan baik, dengan hasil sebelum dan sesudah berdampingan, lebih cepat menunjukkan manfaatnya daripada sebuah rencana.

[Adopsi & Tata Kelola](/info/adoption-governance.html) membahas orientasi berdasarkan peran, cara mengukur uji coba dan seperti apa proses tata kelola dapat berjalan.

## Apakah Lolly dibuat dengan "vibe coding"?

Lolly dikembangkan dengan pengodean berbantuan AI, penelusuran berbantuan AI dan, di banyak bagian, konten berbantuan AI, menggunakan campuran model dan vendor, termasuk dari perusahaan model mutakhir berbasis cloud publik. Manusia membuat arsitekturnya, mengurasi kode dengan tujuan yang jelas dan mengarahkan aspek artistik pengalamannya.

Pemberitahuan keamanan tingkat tinggi atau kritis pada dependensi Lolly memblokir CI. Pemberitahuan yang belum dapat diperbaiki hanya dikecualikan jika pengecualiannya disetujui dengan alasan tertulis. [SECURITY.md](https://github.com/lolly-tools/lolly/blob/main/SECURITY.md#dependency-audit-exceptions) mencantumkan setiap pengecualian yang berlaku saat ini, dan [catatan rilis](https://github.com/lolly-tools/lolly/releases) mencantumkan pengecualian yang disertakan setiap rilis. SECURITY.md juga menjelaskan cara melaporkan kerentanan.

Pemeriksaan dalam build juga menolak ungkapan yang terbaca seperti buatan mesin dalam komentar kode, aplikasi dan dokumentasi ini, agar teks tetap sederhana bagi setiap pembaca. Efek sampingnya, detektor mungkin lebih sulit membedakan teks mana yang ditulis model. Itu bukan tujuan kami.

Yang paling penting, Lolly dibangun di atas puluhan tahun karya open source para ahli di seluruh dunia.

**Pengungkapan AI generatif:**

- **Kode yang ditulis LLM:** Opus 4.8, Gemini 3.1, Qwen3-Coder-Next, Codex Sol (daftar ini dapat bertambah)
- **Penelusuran dengan LLM:** Gemini 3.1, Fable, Codex Astra
- **Dokumentasi:** Sonnet 5
- **Pustaka open source:** Penulis masing-masing, dicantumkan dalam SBOM, komentar dan header file

Daftar ini tidak mencakup model yang disertakan langsung dalam Lolly.

**Klaim manusia:**
- **Pengembangan ide, peninjauan dan umpan balik:** Ravan Naidoo, Matthias Eckermann, Kelly Andrews, Ryan Kleeman, Peter Chamalian, Penpot Community, Tim Hildred (daftar tidak lengkap)
- **Arsitektur, arahan artistik & pembersih konten asal-asalan:** Andy Fitzsimon

## Ke mana perginya alat bermerek SUSE?

Alat tersebut berada di repositori privat yang terpisah. Klona publik tidak mengambil paket merek SUSE, jadi build darinya menggunakan profil netral `lolly-start` kecuali Anda memilih profil lain. Profil itu berisi alat komunitas yang tidak terikat merek dan merek kosong yang Anda isi dengan merek sendiri. [lolly.tools](https://lolly.tools) dibangun dengan profil `lolly-demo` dan terbuka dalam [Lolly Demo](/info/lolly-demo.html), design system milik Lolly sendiri. SUSE mengoperasikan instansnya sendiri untuk melindungi merek dagangnya.

## Apa rasa logo Lolly itu?

Ada yang bilang jeruk nipis, ada yang bilang mint dan terkadang apel. Lolly memberi rasa manisnya, dan Anda menentukan rasanya.

## Apa yang dimaksud Lolly dengan kedaulatan konten?

Kendali atas cara konten Anda dibuat, dikelola, disimpan dan dipindahkan di antara sistem yang Anda pilih. Lolly mendukung produksi lokal, pekerjaan yang dapat disunting dan alat yang portabel. Lolly Work menambahkan layanan bersama yang dikendalikan organisasi. Lisensi sumber, dependensi yang tersedia dan aliran data dalam alur kerja tetap penting. [Apa itu kedaulatan konten?](/info/content-sovereignty.html) menjelaskan setiap kendali dan batasannya.

## Bisakah kami tetap menggunakan DAM yang ada?

Ya. DAM yang didukung dapat tetap menjadi sumber data acuan sementara Lolly Work menghubungkan aset terpilih ke alat Lolly. Akses sumber, suntingan yang diizinkan, hak penggunaan dan persetujuan keluaran jadi merupakan keputusan yang terpisah. [Gunakan Lolly dengan DAM Anda yang ada](/info/use-with-dam.html) menjelaskan pengaturannya, dan [pengalaman SUSE dengan Brandfolder](/info/suse-brandfolder.html) mencatat keberhasilan penggunaan selama adopsi.
