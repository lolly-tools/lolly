# Temukan dan pulihkan karya Anda

Ada yang hilang: desain yang tidak pernah Anda simpan, file yang Anda unduh, versi minggu lalu, atau semuanya setelah browser dibersihkan. Mulai dengan tabel, lalu ikuti bagian yang ditunjuknya.

Pekerjaan pribadi tetap di browser atau aplikasi tempat Anda membuatnya, di perangkat itu, kecuali Anda mengaktifkan [Sync](/info/sync.html). Organisasi yang memakai Lolly Work opsional juga menyimpan **Team projects** di servernya, dibahas di bawah.

| Apa yang Anda lakukan | Di mana harus mencari |
|---|---|
| Menekan **Simpan sebagai** atau **Simpan** | **Proyek** |
| Menekan **Unduh** | Unduhan browser Anda, dan sebuah salinan di **Aset** |
| Tidak keduanya, di satu [tool yang menyimpan sambil Anda bekerja](#which-tools-save-as-you-work) | **Proyek** dan **History** |
| Tidak keduanya, di tool yang tidak begitu | Hanya tab tempat Anda bekerja, sampai Anda menutup tab itu |
| Menghapusnya di aplikasi | **Sampah**, di **Proyek**, **Aset** atau **Pengaturan → Penyimpanan**, selama 30 hari |

::: figure find-your-work-places
Di mana pekerjaan Anda berada: penyimpanan browser sendiri menyimpan Projects, History, dan Trash; unduhan masuk ke folder perangkat Anda; Sync dan file cadangan adalah salinan di luar browser.
:::

::: details Temukan pekerjaan bersama di Lolly Work (opsional)
Buka Lolly organisasi Anda dan login, lalu lihat di **Projects → Team projects**. Sesi bersama disimpan oleh instans itu dan muncul sesuai akses Anda. Login dapat memulihkan akses ke sesi tersebut di perangkat lain; ia tidak memulihkan pustaka pribadi atau cadangan perangkat Anda.

Dalam [work collab](/info/collaborate.html#work-collabs-with-lolly-work-optional), tunggu **Saved to work** sebelum pergi. Jika proyek bersama hilang, periksa bahwa Anda terhubung ke instans yang benar dan tanyakan kepada operatornya tentang akses atau retensi. Membersihkan data browser menghapus salinan lokal, bukan salinan server organisasi. Lihat [Use Lolly at your organisation](/info/organisation.html).
:::

## Temukan sesuatu yang Anda simpan

1. Tekan **Beranda** di kiri atas tool.
2. Buka tab **Proyek** di bagian atas layar utama (ikon folder di ponsel).
3. Lihat di layar pertama. Karya yang tersimpan ke **Pustaka saya** ada di sana, dan setiap proyek adalah sebuah folder. Untuk mencari di semua folder sekaligus, ketik di **Cari semua proyek…** di bagian bawah layar.

Item dinamai sesuai nama file yang Anda ketik di panel ekspor, atau sesuai alatnya, seperti **QR Code**, bila Anda tidak mengetik apa pun. Buka item dan setiap pengaturan kembali, siap diubah dan diekspor lagi. Untuk menyimpan pekerjaan baru dengan cara ini, lihat [Saving & continuing](/info/using.html#saving-continuing).

::: note Tidak ada di Proyek?
- Mungkin ada di **Sampah**: lihat [Dapatkan kembali sesuatu yang Anda hapus](#get-back-something-you-deleted).
- Browser lain, jendela privat atau perangkat lain mulai kosong, kecuali Anda menggunakan [Sync](/info/sync.html) atau [memindahkan karya Anda](#move-your-work-to-another-device).
- Jika Anda hanya menekan **Unduh**, lihat [Temukan berkas yang Anda unduh](#find-a-file-you-downloaded).
:::

::: details Bekerja dengan Proyek
Anda juga bisa membuka **Proyek** dari **Pengaturan → Penyimpanan → Sesi tersimpan → Atur dalam Proyek**. Ini bekerja seperti pengelola file:

![Proyek sebelum ada apa pun yang disimpan: ubin Folder baru, Aset baru dan Templat, jam History di kanan atas dan bilah Cari semua proyek… di bagian bawah](/t/url-shot?url=%2F%23%2Fp&width=1440&height=900&dpi=192&waitMs=1200&walker=1&format=svg&localize=1&dark=1&filename=projects)
<!--
SHOT NOTE (projects): build-docs-shots.ts gives every shot a fresh browser
context with no storage seeding, so this frame is always the empty Projects
root. The alt says so. Revisit (and re-caption) if the pipeline gains a
storage-seeding hook.
-->

- <!--i:folder--> **Folder yang bersarang.** Kelompokkan sesi tersimpan ke folder, dan folder di dalam folder, sedalam yang Anda mau. Buat folder, ganti namanya, atau seret ubin ke folder lain untuk memindahkannya; breadcrumb membawa Anda naik kembali. Sesi yang disimpan tanpa folder muncul langsung di akar **Projects**.
- <!--i:clock--> **Urutkan sesuka Anda.** **View options**, tombol penggeser di kanan atas, menawarkan **Grid** atau **List** dan mengurutkan menurut **Name**, **Date added**, **Last modified** (default), **Size**, dan, di dalam folder, **By tool**. Folder selalu didahulukan apa pun urutan yang aktif - urutan hanya menyusun sesi dan folder di dalam kelompoknya sendiri.
- <!--i:document--> **Simpan pekerjaan baru langsung.** **New asset** membuka pemilih bersama. Pilih **Templates** untuk memulai dari templat tersimpan: buka untuk menyunting, atau gunakan **+ Add** untuk langsung menyimpan karya baru.
- <!--i:checklist--> **Multi-pilih (desktop).** Centang kotak ubin, seret kotak pilihan melintasi ruang kosong, atau **Shift/Cmd-klik**; **klik kanan** ubin untuk menu konteksnya. Bilah pilihan kemudian menawarkan **Render selection**, **Move to…**, **New folder**, **Delete** (yang memindahkan ke Trash), **Edit together** untuk dua hingga delapan sesi satu alat, berdampingan di bawah satu sidebar, dan **Edit as sheet**, yang membuka pilihan dengan ukuran atau campuran apa pun sebagai baris di grid batch.
- <!--i:download--> **Render seluruh folder atau pilihan.** **Render folder** mengekspor setiap sesi tersimpan di folder - termasuk sub-foldernya - sebagai satu `.zip` bersarang. **Render selection** melakukan hal yang sama untuk multi-pilihan mana pun, dan satu sesi dirender langsung ke file-nya sendiri.
- <!--i:link--> **Lompat langsung ke pekerjaan tersimpan sebuah alat.** Centang satu alat atau lebih di galeri Tools dan pilih **View sessions** dari bilah pilihan - Projects terbuka hanya menampilkan sesi yang dibuat dengan alat-alat itu, dengan **Clear** untuk kembali ke tampilan penuh.
- <!--i:link--> **Bagikan sesi tersimpan.** Klik kanan sesi (di ponsel, tekan **•••** pada ubinnya) → **Share link** untuk menyalin tautan yang membuka kembali dengan pengaturan yang sama; gambar dari perangkat Anda tidak ikut dalam tautan (dialog Share lengkap: lihat [Sharing your work](/info/using.html#sharing-your-work)).
- <!--i:pentool--> **Ganti nama atau salin.** Klik kanan sesi (di ponsel, tekan **•••** pada ubinnya) untuk **Rename**, **Duplicate** (salinan di folder yang sama), dan **Move to…**.

![Popover View options di Proyek: Layout dengan Grid dan List, dan Sort by diatur ke Last modified, di samping sebuah tombol yang membalik urutannya](/t/url-shot?url=%2F%23%2Fp&width=900&height=700&dpi=192&waitMs=1400&drive=click%3A.projects-viewopts&cropSelector=.projects-viewmenu&walker=1&format=svg&dark=1&filename=misc-projects-sort)
<!--
SHOT NOTE (misc-projects-sort): trigger button confirmed as
`.filter-fab.projects-viewopts` in views/projects.ts (openViewOpts() is bound
to `.projects-viewopts` specifically) - `.projects-viewopts` alone is the
more specific hook, so that's what drives the click. The popover it opens
(`.projects-viewmenu`, also confirmed directly in openViewOpts()) is body-
appended, not nested under the Projects root, so cropSelector finds it
regardless. "By tool" only appears inside a folder - this recipe captures at
the Projects ROOT (`url=/#/p`), so if the capture pass wants "By tool"
visible too, point url= at a real folder instead: the route is a path
segment, `/#/p/<folderId>` (confirmed in main.ts's hash router - `parts[0]
=== 'p'` reads `folderId` from `parts[1]`), not a query param. Caveat: a
folder has to already EXIST in the capture profile, which a per-shot fresh
context has none of.
The popover (views/projects-view-options.ts, checked 2026-09-26) holds a
Layout pair (Grid / List) and a Sort by menu with a reverse button; the
options inside the menu (Name, Date added, Last modified, Size, By tool) are
not visible in the closed menu, so the alt does not list them.
-->

:::

## Jika Anda menutup tab atau meninggalkan tool

Apa yang kembali bergantung pada bagaimana Anda meninggalkannya dan tool mana yang Anda gunakan:

- **Anda menutup tab, atau kembali di lain waktu.** Pekerjaan yang belum disimpan hilang, kecuali di [alat yang menyimpan saat Anda bekerja](#which-tools-save-as-you-work): buka pekerjaan itu dari **Projects**.
- **Anda memuat ulang halaman di tab yang sama.** Pengaturan Anda kembali dari alamat halaman. Pada alat yang tidak menyimpan saat Anda bekerja, gambar dan file yang Anda tambahkan dari perangkat, dan teks satu baris yang lebih panjang dari 150 karakter, tidak kembali, karena alamat tidak memuatnya.
- **Anda menekan Home, atau tombol kembali di kiri atas.** Bila Anda mengubah sesuatu sejak terakhir menyimpan, mengunduh, atau menyalin, dialog **Unsaved edits** menanyakan apakah akan menyimpan dulu. **Save & leave** menyimpan pekerjaan dan membawa Anda ke **Projects**, atau kembali ke folder proyek tempat Anda membuka pekerjaan itu. **Leave anyway** membuang perubahan Anda: item tersimpan kembali ke keadaan terakhir disimpan, dan karya yang tidak pernah disimpan meninggalkan **Projects**. **Cancel** menahan Anda di alat.

Lolly hanya bertanya ketika Anda menekan **Beranda** atau tombol kembali di dalam sebuah tool. Menutup tab, memuat ulang dan tombol Back milik browser Anda sendiri tidak pernah bertanya. Untuk memastikan, tekan **Simpan sebagai**, atau **Simpan** di panel ekspor, sebelum Anda meninggalkan sebuah tool.

Bila pemulihan otomatis tidak tersedia, catatan di samping kontrol penyuntingan menyatakan apa yang perlu disimpan:

- Pada alat yang bekerja dengan file yang Anda bawa, simpan pengaturan Anda dan simpan juga file aslinya.
- Pada alat perekam, atau utilitas tanpa aksi Save, simpan atau unduh hasilnya sebelum pergi.
- Aplikasi desktop dan seluler menyatakan saat Anda perlu menyimpan secara manual.
- Dalam kolaborasi privat, orang yang mengundang menyimpan dokumen dan riwayatnya, termasuk perubahan orang lain. Orang yang bergabung bekerja pada salinan sementara dan sebaiknya menyimpan salinan terpisah sebelum sesi berakhir.

::: note Tidak sengaja keluar tanpa menyimpan?
Di tool yang menyimpan sambil Anda bekerja, History menyimpan sebuah salinan editan yang dibuang. Buka halaman **History**, temukan di bawah **Changes** dan tekan **Open as a copy**. Di tool lain, perubahannya hilang.
:::

::: details Tool mana yang menyimpan sambil Anda bekerja
Di aplikasi web, setiap tool yang menghasilkan sebuah dokumen menyimpan sambil Anda bekerja: Design, Chart, QR Code, Text, Sandbox dan yang lainnya. Tool berikut tidak:

- alat yang bekerja dengan file yang Anda bawa, seperti Redact, Sign, atau Convert Image, karena Lolly tidak pernah menyimpan salinan file itu;
- alat yang merekam dari kamera, mikrofon, atau layar Anda, seperti Record, Screen Capture, dan Voice Recorder;
- alat tanpa yang bisa diubah, seperti Countdown.

Pada alat lain, perubahan pertama Anda menyimpan pekerjaan di **Projects** seolah Anda menyimpannya, dan perubahan berikutnya disimpan seiring Anda bekerja setelah alat selesai menggambar. Karya yang belum disimpan tetap ada di Projects setelah Anda menutup tab, dan terbuka kembali dengan perubahannya ditandai belum disimpan.

**Leave anyway** tetap membuang perubahan itu, dan History menyimpan salinan suntingan yang dibuang selama 30 hari. Membuka alat lagi dari layar beranda memulai karya baru; buka yang sebelumnya dari Projects.

3D dan Darkroom menyimpan saat Anda bekerja, tetapi tidak menyimpan file yang Anda muat ke dalamnya, seperti model 3D atau LUT. History dan **Save** menyimpan nama, tipe, dan ukuran file, bukan file-nya. Saat Anda membuka pekerjaan lagi, catatan menyatakan file mana itu, dan alat bekerja tanpanya sampai Anda memuatnya lagi. Simpan file asli Anda.

Dengan [Sync](/info/sync.html) aktif, sebuah kreasi yang diajukan dengan cara ini ikut ke perangkat lain Anda seperti hal lain di Proyek. Versinya tetap berada di perangkat tempat ia dibuat.

Jika sebuah kreasi terbuka di dua tab dan Anda menyimpan di keduanya, simpanan terakhir yang dipertahankan. Karya yang digantikannya tidak hilang: karya itu ada di bawah **Protected drafts** dalam History kreasi itu, dengan **Open draft as a copy**.

Ini hanya berfungsi di aplikasi web, tidak di aplikasi desktop atau mobile, dan tidak saat Anda bekerja live bersama orang lain.
:::

## Temukan berkas yang Anda unduh

Di sebuah browser, **Unduh** menyerahkan berkas ke browser Anda, yang menyimpannya di folder unduhannya (biasanya **Downloads**) atau menanyakan di mana. Lolly tidak diberi tahu ke mana berkas itu pergi, jadi lihat di daftar unduhan browser Anda.

Jika tidak ada berkas yang muncul, lihat di panel ekspor selagi Anda masih di tool itu. Di bawah **Unduh**, sebuah baris memberikan nama berkas dan waktunya, dengan **Retry download**, dan di Chrome, Edge dan browser Chromium lainnya **Save file…** untuk memilih folder sendiri. Baris itu dan berkasnya bertahan sampai Anda meninggalkan tool, memuat ulang atau mengekspor lagi.

Lolly juga menyimpan dua hal setelah setiap unduhan:

- **Sebuah salinan berkas**, di **Aset** di bawah **Unggahan Anda**, selama **Simpan render saya ke pustaka saya** aktif di bawah **Pengaturan → Render Anda** (**Pengaturan** ada di bagian bawah layar utama). Pengaturan ini mulai dalam keadaan aktif. Sebuah video, atau berkas di atas 50 MB, bertanya dulu, dan sebuah zip tidak disalin.
- **Pengaturan yang Anda gunakan**, untuk 24 unduhan terakhir Anda. **Ekspor terbaru**, di bawah karya tersimpan Anda di **Proyek**, membuka lagi tool itu dengan pengaturan tersebut sehingga Anda bisa membuat berkasnya lagi, meski gambar dan berkas yang Anda tambahkan dari perangkat Anda tidak disertakan. Daftar yang sama ada di bawah **Pengaturan → Aktivitas & statistik → Ekspor terbaru** dan di tab **Changes** pada **History**. Daftar ini menyimpan pengaturan, bukan berkasnya.

::: details Di aplikasi desktop dan mobile
- **Aplikasi desktop:** **Unduh** langsung menyimpan ke sebuah folder **Lolly** di dalam folder **Downloads** Anda, tanpa dialog. Baris di bawah **Unduh** menyatakan ke mana berkas itu pergi, seperti "Saved to Downloads/Lolly", disertai **Show in folder**. **Open Exports Folder**, di menu **Window** atau **Exports**, membuka folder itu kapan saja. Sebuah berkas dengan nama sama seperti yang sebelumnya disimpan sebagai "name (1)".
- **iPhone dan iPad:** berkas itu disimpan di aplikasi **Files**, di bawah **Lolly**, dan share sheet terbuka sehingga Anda bisa mengirimkannya. Baris di bawah **Unduh** berbunyi "Saved to Files → Lolly".
- **Android:** menu berbagi terbuka sehingga Anda bisa memilih ke mana berkas itu pergi.

Di iPhone, iPad dan Android, berkas baru menggantikan yang sebelumnya dengan nama yang sama.
:::

## Kembali ke versi sebelumnya

- **Selama kunjungan ini:** **Undo** mundur melalui 100 perubahan terakhir Anda, sampai Anda meninggalkan tool atau memuat ulang. Lihat [Undo dan redo](/info/using.html#undo-and-redo).
- **Di [tool yang menyimpan sambil Anda bekerja](#which-tools-save-as-you-work):** versi sebelumnya dari setiap kreasi dipertahankan. Ikuti langkah-langkah di bawah.
- **Semua yang ada di perangkat:** dengan [Sync](/info/sync.html) aktif, **Restore an earlier copy**, di bawah **Pengaturan → Layanan terhubung**, mengembalikan salah satu dari tujuh salinan harian terakhir, atau salinan dari sebelum penerapan terakhir Anda. Semua yang ada di perangkat ini kemudian cocok dengan salinan itu, bukan hanya satu desain.

Untuk membuka versi sebelumnya:

1. Tekan **History**, tombol jam di samping **Undo** dan **Redo**. Di Design, **History** ada di bilah atas; di ponsel, tekan **•••** lalu **History**. Di tool tanpa **Undo**, seperti Text dan Sandbox, **History** ada di samping **Beranda** di kiri atas.
2. Temukan versi itu berdasarkan tanggal dan waktunya. Baris **Automatic checkpoint** diambil sambil Anda bekerja; baris **Saved version** adalah waktu-waktu Anda menyimpan.
3. Tekan **Open as a copy**. Versi itu terbuka sebagai sebuah kreasi baru, dan yang tadinya Anda buka tetap seperti semula. Salinannya ada di **Proyek**, dengan "(copy)" setelah namanya.

Untuk mempertahankan sebuah versi dengan nama, tekan **Name version**, ketik sebuah nama dan tekan **Keep milestone**. Versi yang diberi nama terdaftar di halaman **History**, di bawah **Milestones**.

::: details Panel History dan halaman History
Panel **History** juga mencantumkan baris **Recovered work**, dan **Protected drafts** menyimpan editan terbaru Anda di antara checkpoint, dengan **Open draft as a copy**. **Compare** dan **Check assets** membantu Anda memilih sebelum membuka sebuah salinan. Alihkan **This creation** ke **All history on this device** untuk melihat setiap kreasi.

Automatic checkpoint makin jarang seiring waktu: satu per menit untuk satu jam terakhir, satu per jam untuk satu hari terakhir, satu per hari selama 30 hari, lalu satu per minggu. Saved version dan versi bernama semuanya dipertahankan. Menghapus sebuah kreasi juga memindahkan versinya ke **Sampah**, dan **Hapus permanen** menghapusnya.

Ketika penyimpanan History penuh, automatic checkpoint tertua dari kreasi yang belum Anda buka selama 30 hari dihapus lebih dulu. Sebuah simpanan selalu dipertahankan, bahkan saat itu: simpanan itu ditulis sebagai karya saat ini, dan History menyatakan bahwa simpanan ini tidak dipertahankan sebagai sebuah versi. **Pengaturan → Penyimpanan** menampilkan berapa banyak yang digunakan History.

Halaman **History** (`#/history`) mencakup setiap karya di browser ini. Untuk membukanya, tekan tombol jam di kanan atas layar beranda atau **Projects**, pilih **Saved sessions** di menu profil (di ponsel, tombol logo bulat di kanan atas), atau tekan **Open app history** di panel History alat. Aplikasi desktop dan seluler tidak memiliki halaman History, jadi di sana tombol jam layar beranda dan **Saved sessions** membuka **Your recent work**: sesi tersimpan dan ekspor terbaru Anda, dengan tautan ke Projects.

- **Terbaru** mendaftar kreasi Anda, yang terbaru lebih dulu, dengan **Lanjutkan**.
- **Changes** menempatkan checkpoint, unduhan dan hasil Convert pada satu garis waktu. Sebuah unduhan memiliki **Reopen settings**.
- **Milestones** mendaftar versi yang diberi nama.

Filter berdasarkan proyek, tool dan tanggal (di balik **Filters** di ponsel). Halaman History tidak memiliki tombol hapus; untuk menghapus sebuah item, gunakan Proyek.
:::

## Pindahkan karya Anda ke perangkat lain

| Untuk | Gunakan |
|---|---|
| Menjaga perangkat Anda tetap selaras | **Sync across devices**, di bawah **Pengaturan → Layanan terhubung**: lihat [Sinkronkan perangkat Anda](/info/sync.html) |
| Memindahkan semuanya sekaligus | **Export my data** dan **Import data…**, di bawah |
| Menyerahkan satu desain atau satu proyek | Sebuah berkas `.lolly`: **Ekspor**, lalu **Bagikan**, lalu **Download .lolly**; untuk seluruh proyek, **Download project (.lolly)** di menu folder tersebut. Tekan **Buka** di perangkat lain. Lihat [Berkas .lolly](/info/using.html#the-lolly-file) |

Sebuah share link membawa pengaturan Anda, tetapi tidak gambar atau berkas yang Anda tambahkan dari perangkat Anda.

::: note Mengimpor tidak menambah atau menghapus apa pun
Folder, favorit dan template dalam berkas itu ditambahkan di samping yang sudah ada di perangkat lain. Ketika sebuah item tersimpan ada di keduanya, salinan yang disimpan lebih baru dipertahankan. Detail dan pengaturan Anda di perangkat itu tetap seperti apa adanya; yang kosong diisi dari berkas itu. **Bring it to this device**, di Sync, bekerja dengan cara yang sama.
:::

Untuk memindahkan semuanya sekaligus:

1. Di perangkat lama, buka **Pengaturan → Penyimpanan** dan, di bawah **Pindah ke perangkat lain**, tekan **Export my data**. Lolly mengunduh satu berkas `.zip` yang namanya dimulai dengan `LollyTools-`.
2. Bawa berkas itu lewat USB, email ke diri sendiri, AirDrop atau folder bersama.
3. Di perangkat baru, buka **Pengaturan → Penyimpanan**, tekan **Import data…**, pilih berkasnya dan tekan **Impor**.

::: note Apa yang tertinggal
Login, kunci dan passphrase sync tetap di setiap perangkat. Daftar unduhan terbaru, unduhan offline dan model AI tidak ikut lewat jalur mana pun. Riwayat versi hanya berpindah dalam sebuah berkas **Export my data**, bukan lewat Sync atau sebuah `.lolly`. Ketika riwayatnya terlalu besar untuk satu berkas, automatic checkpoint tertua ditinggalkan dan baris ekspor menyatakan berapa banyak. Sebuah salinan yang disimpan Sync di penyimpanan Anda dapat diunduh dan dibuka, atau dipilih di **Import data…**, seperti sebuah berkas cadangan; sebuah salinan terenkripsi meminta passphrase Anda.
:::

::: details Apa yang dimuat berkas backup
Berkas itu dinamai `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` (bagian namanya berasal dari profil Anda dan dihilangkan jika tidak diatur; `<n>` adalah penghitung per hari sehingga ekspor di hari yang sama tidak bertabrakan). Berkas itu berisi profil Anda, beserta folder, Sampah, template dan favorit Anda; setiap sesi tersimpan beserta thumbnail-nya; gambar, font, logo yang Anda unggah dan salinan unduhan Anda; design system Anda; preferensi Anda (tema, lebar sidebar, statistik aktivitas lokal); versi tersimpan dan hasil dari Convert; dan, dari aplikasi web, riwayat versi kreasi Anda.

Cache katalog tidak disertakan - ia mengunduh ulang sendiri di perangkat baru. Setiap bagian diberi checksum, jadi file yang rusak dalam perjalanan tertangkap saat impor, bukan dipulihkan setengah rusak. Sesi tersimpan terhubung kembali ke gambar yang Anda impor secara otomatis. Aplikasi web, desktop, dan seluler membaca file yang sama; aplikasi terminal menulis cadangan yang lebih sederhana miliknya sendiri, yang tidak dibaca format ini. **Export my data & render everything** membuat file yang sama ditambah zip kedua dengan setiap sesi tersimpan dirender ke keluarannya. (Spesifikasi format lengkap: [Data transfer](/info/data-transfer.html).)
:::

## Jika Anda menghapus data browser Anda

Di aplikasi web, Lolly menyimpan semuanya di penyimpanan browser Anda untuk situs ini: karya tersimpan, gambar, font, design system, riwayat versi dan unduhan offline. Menghapus data situs ini di browser Anda menghapus semua itu, dan Lolly tidak bisa mengembalikan satu pun darinya. Yang tersisa adalah yang sudah keluar dari browser: berkas yang Anda unduh, sebuah berkas **Export my data**, sebuah salinan [Sync](/info/sync.html) dan tautan yang Anda bagikan.

::: warning Sebelum Anda menghapus data browser
Tekan **Export my data** di bawah **Pengaturan → Penyimpanan**, dan simpan berkasnya di tempat lain.
:::

Saat aplikasi dimulai, Lolly meminta browser agar tidak menghapus penyimpanannya ketika perangkat kehabisan ruang, dan browser yang memutuskan. Di bawah **Settings → Available offline**, baris yang diawali **Protected** berarti browser setuju. "The browser may clear downloads if the device runs low on space" berarti tidak, dan **Protect downloads** meminta lagi.

Jika browser tidak setuju, ia mungkin menghapus pekerjaan tersimpan serta unduhan saat ruang menipis, jadi simpan file **Export my data** yang terbaru.

**Pengaturan → Penyimpanan** menampilkan berapa banyak ruang yang digunakan tiap jenis data. Baris **History**-nya menghitung automatic checkpoint, pratinjaunya, dan draf pemulihan; **Remove automatic checkpoints older than 30 days** membebaskan ruang itu dan mempertahankan saved version serta versi bernama. **Hapus cache** membuang berkas katalog yang diunduh, yang akan diunduh lagi saat dibutuhkan. **Hapus semua data saya** meminta Anda mengetik sebuah kata, mematikan Sync, lalu menghapus semua yang disimpan Lolly di browser ini: profil dan pengaturan Anda, sesi tersimpan beserta riwayat dan Sampahnya, unggahan, font dan design system, log unduhan, hasil Convert, model AI yang diunduh dan salinan offline. Berkas yang Anda unduh tetap ada di tempat Anda menyimpannya. Aplikasi kemudian mulai seperti pada kunjungan pertama.

![Kartu penyimpanan pada layar selebar ponsel: setiap kategori data di perangkat disebutkan, dengan tombol Clear all my data di bagian bawah](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-selbar%2C.profile-row-value%2C.profile-group-value%2C%23store-hero-num%2C%23store-headroom%7Bdisplay%3Anone%7D&format=svg&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

Di aplikasi desktop dan mobile, sesi tersimpan adalah berkas-berkas di folder data milik aplikasi itu sendiri dan sisanya ada di penyimpanan milik aplikasi itu sendiri, sehingga menghapus sebuah browser web tidak menyentuhnya.

::: details Tempat aplikasi desktop dan mobile menyimpan sesi tersimpan
Satu berkas per sesi tersimpan, di dalam sebuah folder `saved-state`:

- macOS: `~/Library/Application Support/tools.lolly.Desktop/saved-state/`
- Windows: `%APPDATA%\tools.lolly.Desktop\saved-state\`
- Linux: `~/.local/share/tools.lolly.Desktop/saved-state/`, atau path yang sama di bawah `$XDG_DATA_HOME`
- iPhone, iPad dan Android: di dalam penyimpanan milik aplikasi itu sendiri, yang tidak ditampilkan oleh aplikasi Files

Gambar, design system dan daftar unduhan terbaru tetap ada di penyimpanan internal aplikasi, bukan di folder-folder ini. Aplikasi terminal dan command line membaca folder `saved-state` yang sama: lihat [Tempat sesi tersimpan berada](/info/cli-reference.html#where-saved-sessions-live).
:::

## Dapatkan kembali sesuatu yang Anda hapus

Menghapus sebuah sesi tersimpan, sebuah folder, salah satu unggahan Anda atau salah satu font Anda di aplikasi memindahkannya ke **Sampah** selama 30 hari, di mana pun Anda menghapusnya: **Proyek**, **Aset**, **Pengaturan → Penyimpanan** atau daftar sesi tersimpan sebuah tool. Sebuah folder pergi beserta semua isinya, sebagai satu entri, dan sebuah sesi mempertahankan riwayat versinya selama berada di sana. Segera setelahnya, sebuah pesan menawarkan **Undo**. Setelahnya:

1. Buka **Sampah**: ubin **Sampah** di **Proyek**, tombol **Sampah** di **Aset → Unggahan Anda**, atau baris **Sampah** di **Pengaturan → Penyimpanan**. Ketiganya membuka daftar yang sama.
2. Tekan **Pulihkan** di samping item itu. Item itu kembali ke foldernya, dan sebuah font mendapatkan kembali peran yang dimilikinya di design system-nya.

**Hapus permanen** menghapus satu item untuk selamanya. **Kosongkan Sampah** bertanya dulu, lalu menghapus setiap item di Sampah. Item yang lebih tua dari 30 hari dihapus untuk selamanya.

::: warning Sebagian penghapusan bersifat seketika
Menghapus sebuah design system, sebuah logo atau foto profil Anda tidak masuk ke Sampah. Command line dan aplikasi terminal juga menghapus seketika.
:::

Dengan [Sync](/info/sync.html) aktif, **Restore an earlier copy** dapat mengembalikan state perangkat secara keseluruhan dari hari sebelumnya, dan sebuah berkas **Export my data** mengembalikan apa yang dimuat berkas itu.
