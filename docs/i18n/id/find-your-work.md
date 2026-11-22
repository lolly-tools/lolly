# Menemukan dan memulihkan pekerjaan Anda

Temukan desain yang belum pernah Anda simpan, file yang Anda unduh, versi minggu lalu atau pekerjaan Anda setelah browser dibersihkan. Mulai dari tabel.

Pekerjaan pribadi tetap di browser atau aplikasi tempat Anda membuatnya, pada perangkat itu, kecuali Anda mengaktifkan [Sync](/info/sync.html). Organisasi yang menggunakan Lolly Work opsional juga menyimpan **Team projects** di servernya.

| Yang Anda lakukan | Tempat mencari |
|---|---|
| Menekan **Save as** atau **Save** | **Projects** |
| Menekan **Download** | Unduhan browser Anda, dan salinannya di **Assets** |
| Tidak keduanya, di [alat yang menyimpan saat Anda bekerja](#which-tools-save-as-you-work) | **Projects** dan **History** |
| Tidak keduanya, di alat yang tidak menyimpan saat Anda bekerja | Hanya tab tempat Anda bekerja, sampai Anda menutup tab |
| Menghapusnya di aplikasi | **Trash**, di **Projects**, **Assets** atau **Settings → Storage**, selama 30 hari |

::: figure find-your-work-places
Tempat pekerjaan Anda tersimpan: penyimpanan browser sendiri menampung Projects, History dan Trash; unduhan masuk ke folder perangkat Anda; Sync dan file cadangan adalah salinan di luar browser.
:::

::: details Menemukan pekerjaan bersama di Lolly Work (opsional)
Buka Lolly organisasi Anda, masuk dan lihat di **Projects → Team projects**. Instans tersebut memiliki sesi bersama dan menampilkan sesi yang dapat Anda akses. Masuk di perangkat lain dapat memulihkan akses ke sesi tersebut. Masuk tidak memulihkan pustaka pribadi atau cadangan perangkat Anda.

Dalam [kolaborasi work](/info/collaborate.html#collabs-through-lolly-work-optional), tunggu **Saved to work** sebelum keluar. Jika proyek bersama tidak ada, periksa apakah Anda terhubung ke instans yang benar dan tanyakan kepada operatornya tentang akses atau retensi. Menghapus data browser menghapus salinan lokal, bukan salinan di server organisasi. Lihat [Menggunakan Lolly di organisasi Anda](/info/organisation.html).
:::

<!--i:eti-search-->
## Menemukan sesuatu yang Anda simpan

1. Tekan **Home** di kiri atas alat.
2. Buka tab **Projects** di bagian atas layar beranda (ikon folder di ponsel).
3. Semua yang Anda simpan ke **My library** ada di layar pertama. Setiap proyek adalah folder. Untuk mencari di semua folder, ketik di **Search all projects…** di bagian bawah layar.

Item menggunakan nama file yang Anda ketik di panel ekspor. Tanpa nama file, item menggunakan nama alatnya, seperti **QR Code**. Membuka item memulihkan setiap pengaturan. Untuk menyimpan pekerjaan baru, lihat [Menyimpan & melanjutkan](/info/using.html#saving-continuing).

::: note Tidak ada di Projects?
- Mungkin ada di **Trash**: lihat [Mengembalikan sesuatu yang Anda hapus](#get-back-something-you-deleted).
- Browser lain, jendela privat atau perangkat lain dimulai dalam keadaan kosong, kecuali Anda menggunakan [Sync](/info/sync.html) atau [memindahkan pekerjaan Anda](#move-your-work-to-another-device).
- Jika Anda hanya menekan **Download**, lihat [Menemukan file yang Anda unduh](#find-a-file-you-downloaded).
:::

::: details Bekerja dengan Projects
Anda juga dapat membuka tampilan **Projects** dari **Settings → Storage → Saved sessions → Organise in Projects**. Cara kerjanya seperti pengelola file:

![Projects sebelum ada yang disimpan: ubin New folder, New asset dan Templates, jam History di kanan atas dan bilah Search all projects di bagian bawah](/t/url-shot?url=%2F%23%2Fp&width=1440&height=900&dpi=192&waitMs=1200&walker=1&format=svg&localize=1&dark=1&filename=projects)
<!--
SHOT NOTE (projects): build-docs-shots.ts gives every shot a fresh browser
context with no storage seeding, so this frame is always the empty Projects
root. The alt says so. Revisit (and re-caption) if the pipeline gains a
storage-seeding hook.
-->

- <!--i:folder--> **Folder bersarang.** Letakkan sesi tersimpan di dalam folder, dan folder di dalam folder, hingga kedalaman berapa pun. Buat atau ganti nama folder, atau seret ubin ke folder untuk memindahkannya. Breadcrumb membawa Anda kembali ke atas. Sesi yang disimpan tanpa folder berada di akar **Projects**.
- <!--i:clock--> **Urutkan sesuai keinginan Anda.** **View options**, tombol penggeser di kanan atas, menawarkan **Grid** atau **List** dan mengurutkan berdasarkan **Name**, **Date added**, **Last modified** (default), **Size** dan, di dalam folder, **By tool**. Folder selalu di urutan pertama. Sesi dan folder diurutkan dalam grupnya masing-masing.
- <!--i:document--> **Langsung masukkan pekerjaan baru.** **New asset** membuka pemilih bersama. Pilih **Templates** untuk memulai dari templat tersimpan. Buka templat untuk menyuntingnya, atau tekan **+ Add** untuk langsung menyimpan karya baru.
- <!--i:checklist--> **Pilih beberapa (desktop).** Centang kotak centang ubin, seret kotak pilihan melintasi ruang kosong atau **Shift/Cmd-klik**. Untuk menu konteks ubin, **klik kanan** ubin. Bilah pilihan menawarkan **Render selection**, **Move to…**, **New folder** dan **Delete** (ke Trash). **Edit together** membuka dua hingga delapan sesi alat tunggal berdampingan di bawah satu bilah sisi. **Edit as sheet** membuka pilihan dengan jumlah atau campuran apa pun sebagai baris dalam grid batch.
- <!--i:download--> **Render seluruh folder atau pilihan.** **Render folder** mengekspor setiap sesi tersimpan dalam folder dan subfoldernya sebagai satu `.zip` bersarang. **Render selection** melakukan hal yang sama untuk pilihan beberapa item. Satu sesi dirender ke filenya sendiri.
- <!--i:link--> **Langsung ke pekerjaan tersimpan milik alat.** Centang satu atau beberapa alat di galeri Tools dan pilih **View sessions** dari bilah pilihan. Projects lalu hanya menampilkan sesi yang dibuat dengan alat tersebut. **Clear** mengembalikan tampilan lengkap.
- <!--i:link--> **Bagikan sesi tersimpan.** Klik kanan sesi (di ponsel, tekan **•••** pada ubinnya) dan pilih **Share link**. Tautan membuka kembali sesi dengan pengaturan yang sama. Gambar dari perangkat Anda tidak ikut dalam tautan. Untuk dialog Share lengkap, lihat [Berbagi pekerjaan Anda](/info/using.html#sharing-your-work).
- <!--i:pentool--> **Ganti nama atau salin satu item.** Menu yang sama memiliki **Rename**, **Duplicate** (salinan di folder yang sama) dan **Move to…**.

![Popover View options di Projects: Layout dengan Grid dan List, serta Sort by yang diatur ke Last modified, di samping tombol yang membalik urutan](/t/url-shot?url=%2F%23%2Fp&width=900&height=700&dpi=192&waitMs=1400&drive=click%3A.projects-viewopts&cropSelector=.projects-viewmenu&walker=1&format=svg&dark=1&filename=misc-projects-sort)
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

<!--i:eti-refresh-->
## Jika Anda menutup tab atau meninggalkan alat

Apa yang kembali bergantung pada cara Anda keluar dan alatnya:

- **Anda menutup tab, atau kembali di lain waktu.** Pekerjaan yang belum disimpan hilang, kecuali di [alat yang menyimpan saat Anda bekerja](#which-tools-save-as-you-work). Buka pekerjaan itu dari **Projects**.
- **Anda memuat ulang halaman di tab yang sama.** Pengaturan Anda kembali dari alamat halaman. Di alat yang tidak menyimpan saat Anda bekerja, alamat tidak memuat gambar dan file dari perangkat Anda atau teks satu baris yang lebih dari 150 karakter, jadi semua ini tidak kembali.
- **Anda menekan Home, atau tombol kembali di kiri atas.** Jika Anda mengubah sesuatu sejak terakhir menyimpan, mengunduh atau menyalin, dialog **Unsaved edits** menanyakan apakah ingin menyimpan lebih dulu. **Save & leave** menyimpan pekerjaan dan membawa Anda ke **Projects**, atau kembali ke folder proyek tempat Anda membuka pekerjaan. **Leave anyway** membuang perubahan Anda. Item tersimpan kembali ke penyimpanan terakhirnya, dan karya yang belum pernah Anda simpan keluar dari **Projects**. **Cancel** membuat Anda tetap di alat.

::: warning Menutup tab tidak bertanya lebih dulu
Menutup tab, memuat ulang dan tombol Back milik browser tidak pernah bertanya. Agar pasti, tekan **Save as**, atau **Save** di panel ekspor, sebelum Anda meninggalkan alat.
:::

Jika pemulihan otomatis tidak tersedia, catatan di samping kontrol penyuntingan menyatakan apa yang perlu disimpan:

- Di alat yang bekerja pada file yang Anda bawa, simpan pengaturan Anda dan simpan juga file aslinya.
- Di alat perekaman, atau utilitas tanpa aksi Save, simpan atau unduh hasilnya sebelum keluar.
- Aplikasi desktop dan seluler memberi tahu kapan Anda perlu menyimpan secara manual.
- Dalam kolaborasi privat, orang yang mengundang menyimpan dokumen dan riwayatnya, termasuk perubahan dari orang lain. Orang yang bergabung bekerja pada salinan sementara dan sebaiknya menyimpan salinan terpisah sebelum sesi berakhir.

::: note Tidak sengaja keluar tanpa menyimpan?
Di alat yang menyimpan saat Anda bekerja, History menyimpan salinan suntingan yang dibuang selama 30 hari. Buka halaman **History**, temukan di bawah **Changes** dan tekan **Open as a copy**. Di alat lain, perubahan tersebut hilang.
:::

::: details Alat mana yang menyimpan saat Anda bekerja
Di aplikasi web, setiap alat yang membuat dokumen menyimpan saat Anda bekerja, seperti Lolly Design, Lolly Chart, QR Code, Text dan Lolly Sandbox. Alat berikut tidak:

- alat yang bekerja pada file yang Anda bawa, seperti Redact, Sign atau Convert Image, karena Lolly tidak pernah menyimpan salinan file tersebut;
- alat yang merekam dari kamera, mikrofon atau layar Anda, seperti Record, Lolly Screen Capture dan Lolly Voice Recorder;
- alat tanpa sesuatu yang dapat diubah, seperti Countdown.

Di alat lainnya, perubahan pertama Anda memasukkan pekerjaan ke **Projects** seolah Anda telah menyimpannya. Perubahan berikutnya disimpan setelah alat selesai menggambar. Karya yang belum disimpan tetap ada di Projects setelah Anda menutup tab dan terbuka kembali dengan perubahannya ditandai belum disimpan.

**Leave anyway** tetap membuang perubahan tersebut. Membuka alat lagi dari layar beranda memulai karya baru; buka karya sebelumnya dari Projects.

3D dan Lolly Darkroom menyimpan saat Anda bekerja, tetapi tidak menyimpan file yang Anda muat ke dalamnya, seperti model 3D atau LUT. History dan **Save** menyimpan nama, jenis dan ukuran file, bukan filenya. Saat Anda membuka pekerjaan lagi, catatan menyebutkan file yang dimaksud, dan alat bekerja tanpa file itu hingga Anda memuatnya lagi. Simpan file asli Anda.

Dengan [Sync](/info/sync.html) aktif, karya yang disimpan dengan cara ini dikirim ke perangkat Anda yang lain. Versinya tetap di perangkat tempat versi itu dibuat.

Jika karya terbuka di dua tab dan Anda menyimpan di keduanya, penyimpanan terakhir yang dipertahankan. Pekerjaan yang digantikan ada di bawah **Protected drafts** dalam History karya itu, dengan **Open draft as a copy**.

Ini hanya berfungsi di aplikasi web, bukan di aplikasi desktop atau seluler, dan tidak saat Anda bekerja langsung dengan orang lain.
:::

<!--i:eti-download-->
## Menemukan file yang Anda unduh

Di browser, **Download** menyerahkan file ke browser Anda. Browser menyimpan file di folder unduhannya (biasanya **Downloads**) atau menanyakan lokasinya. Lolly tidak diberi tahu ke mana file disimpan, jadi lihat daftar unduhan browser Anda.

Jika tidak ada file yang muncul, lihat panel ekspor selagi Anda masih di alat. Di bawah **Download**, satu baris menampilkan nama file dan waktu, dengan **Retry download**. Di Chrome, Edge dan browser Chromium lainnya, baris itu juga menawarkan **Save file…** untuk memilih folder. Baris dan filenya bertahan sampai Anda meninggalkan alat, memuat ulang atau mengekspor lagi.

Lolly juga menyimpan dua hal setelah setiap unduhan:

- **Salinan file**, di **Assets** di bawah **Your uploads**, selama **Save my renders to my library** aktif di bawah **Settings → Your renders** (**Settings** ada di bagian bawah layar beranda). Pengaturan ini aktif sejak awal. Video, atau file di atas 50 MB, meminta persetujuan lebih dulu, dan zip tidak disalin.
- **Pengaturan yang Anda gunakan**, untuk 24 unduhan terakhir Anda. **Recent exports**, di bawah pekerjaan tersimpan Anda di **Projects**, membuka kembali alat dengan pengaturan tersebut. Gambar dan file yang Anda tambahkan dari perangkat tidak disertakan. Daftar yang sama ada di bawah **Settings → Activity & stats → Latest exports** dan pada tab **Changes** di **History**.

::: details Di aplikasi desktop dan seluler
- **Aplikasi desktop:** **Download** menyimpan ke folder **Lolly** di dalam folder **Downloads** Anda, tanpa dialog. Baris di bawah **Download** menyatakan tempat file disimpan, seperti "Saved to Downloads/Lolly", dengan **Show in folder**. **Open Exports Folder**, di menu **Window** atau **Exports**, membuka folder kapan saja. File dengan nama yang sama seperti file sebelumnya disimpan sebagai "name (1)".
- **iPhone dan iPad:** file disimpan di aplikasi **Files**, di bawah **Lolly**, dan lembar berbagi terbuka. Baris di bawah **Download** bertuliskan "Saved to Files → Lolly".
- **Android:** menu berbagi terbuka. Pilih tempat file disimpan.

Di iPhone, iPad dan Android, file baru menggantikan file sebelumnya yang bernama sama.
:::

<!--i:eti-history-->
## Kembali ke versi sebelumnya

- **Selama kunjungan ini:** **Undo** mundur melalui 100 perubahan terakhir Anda, sampai Anda meninggalkan alat atau memuat ulang. Lihat [Undo dan redo](/info/using.html#undo-and-redo).
- **Di [alat yang menyimpan saat Anda bekerja](#which-tools-save-as-you-work):** versi sebelumnya dari setiap karya disimpan.
- **Semua yang ada di perangkat:** dengan [Sync](/info/sync.html) aktif, **Restore an earlier copy**, di bawah **Settings → Connected services**, mengembalikan salah satu dari tujuh salinan harian terakhir atau salinan sebelum penerapan terakhir Anda. Semua yang ada di perangkat ini lalu sesuai dengan salinan tersebut.

Untuk membuka versi sebelumnya:

1. Tekan **History**, tombol jam di samping **Undo** dan **Redo**. Di Lolly Design, **History** ada di bilah atas. Di ponsel, tekan **•••** lalu **History**. Di alat tanpa **Undo**, seperti Text dan Lolly Sandbox, **History** ada di samping **Home** di kiri atas.
2. Temukan versi berdasarkan tanggal dan waktunya. Baris **Automatic checkpoint** diambil saat Anda bekerja; baris **Saved version** adalah waktu Anda menyimpan.
3. Tekan **Open as a copy**. Versi terbuka sebagai karya baru, dan karya yang sebelumnya Anda buka tetap seperti semula. Salinan ada di **Projects**, dengan "(copy)" setelah namanya.

Untuk menyimpan versi dengan nama, tekan **Name version**, ketik nama dan tekan **Keep milestone**. Versi bernama dicantumkan di halaman **History**, di bawah **Milestones**.

::: details Panel History dan halaman History
Panel **History** juga mencantumkan baris **Recovered work**, dan **Protected drafts** menyimpan suntingan terbaru Anda di antara checkpoint, dengan **Open draft as a copy**. **Lolly Compare** dan **Check assets** membantu Anda memilih sebelum membuka salinan. Ganti **This creation** ke **All history on this device** untuk melihat setiap karya.

Checkpoint otomatis makin jarang seiring bertambahnya usia: satu per menit untuk satu jam terakhir, satu per jam untuk satu hari terakhir, satu per hari selama 30 hari, lalu satu per minggu. Semua versi tersimpan dan bernama tetap disimpan. Menghapus karya juga memindahkan versinya ke **Trash**, dan **Delete forever** menghapusnya.

Saat penyimpanan History penuh, checkpoint otomatis tertua dari karya yang belum Anda buka selama 30 hari dihapus lebih dulu. Meski demikian, hasil penyimpanan selalu dipertahankan. Hasilnya ditulis sebagai pekerjaan saat ini, dan History menyatakan bahwa penyimpanan ini tidak disimpan sebagai versi. **Settings → Storage** menunjukkan berapa banyak ruang yang digunakan History.

Halaman **History** (`#/history`) mencakup setiap karya di browser ini. Untuk membuka halaman, tekan tombol jam di kanan atas layar beranda atau **Projects**, pilih **Saved sessions** di menu profil (di ponsel, tombol logo bulat di kanan atas) atau tekan **Open app history** di panel History alat. Aplikasi desktop dan seluler tidak memiliki halaman History. Di sana, tombol jam layar beranda dan **Saved sessions** membuka **Your recent work**: sesi tersimpan dan ekspor terbaru Anda, dengan tautan ke Projects.

- **Recent** mencantumkan karya Anda, yang terbaru lebih dulu, dengan **Resume**.
- **Changes** menempatkan checkpoint, unduhan dan hasil Convert pada satu garis waktu. Unduhan memiliki **Reopen settings**.
- **Milestones** mencantumkan versi bernama.

Setiap karya berupa ubin dengan gambarnya. **Grid** atau **List** mengganti tata letak. Saring berdasarkan proyek, alat dan tanggal (di balik **Filters** di ponsel). Menu ubin (klik kanan atau tekan lama) menawarkan **Resume**, **Versions**, **Show in Projects** dan **Move to Trash**. Untuk menghapus beberapa, pilih itemnya lalu pilih **Move to Trash**, yang menawarkan Undo.
:::

<!--i:eti-folder-move-->
## Memindahkan pekerjaan Anda ke perangkat lain

| Untuk | Gunakan |
|---|---|
| Menjaga perangkat Anda tetap sinkron | **Sync across devices**, di bawah **Settings → Connected services**: lihat [Menyinkronkan perangkat Anda](/info/sync.html) |
| Memindahkan semuanya sekali | **Export my data** dan **Import data…**, di bawah |
| Menyerahkan satu desain atau satu proyek | File `.lolly`: **Export**, lalu **Share**, lalu **Download .lolly**; untuk seluruh proyek, **Download project (.lolly)** di menu folder. Tekan **Open** di perangkat lain. Lihat [File .lolly](/info/using.html#the-lolly-file) |

Tautan berbagi membawa pengaturan Anda, tetapi tidak membawa gambar atau file yang Anda tambahkan dari perangkat.

::: note Mengimpor menambahkan dan tidak menghapus apa pun
Folder, favorit dan templat dalam file ditambahkan ke yang sudah ada di perangkat lain. Jika item tersimpan ada di keduanya, salinan yang disimpan lebih baru dipertahankan. Detail dan pengaturan Anda di perangkat itu tetap seperti semula. Yang kosong diisi dari file. **Bring it to this device**, di Sync, bekerja dengan cara yang sama.
:::

Untuk memindahkan semuanya sekali:

1. Di perangkat lama, buka **Settings → Storage** dan, di bawah **Move to another device**, tekan **Export my data**. Lolly mengunduh satu file `.zip` yang namanya diawali `LollyTools-`.
2. Pindahkan file melalui USB, email ke diri sendiri, AirDrop atau folder bersama.
3. Di perangkat baru, buka **Settings → Storage**, tekan **Import data…**, pilih file dan tekan **Import**.

::: note Yang tetap tertinggal
Status masuk, kunci dan frasa sandi sinkronisasi tetap di setiap perangkat. Daftar unduhan terbaru, unduhan offline dan model AI tidak ikut dipindahkan melalui jalur apa pun. Riwayat versi hanya ikut dalam file **Export my data**, bukan melalui Sync atau `.lolly`. Jika riwayat terlalu besar untuk satu file, checkpoint otomatis tertua tidak disertakan dan baris ekspor menyatakan jumlahnya. Anda dapat mengunduh dan membuka salinan yang disimpan Sync di penyimpanan Anda, atau memilih salinan itu di **Import data…**, seperti file cadangan. Salinan terenkripsi meminta frasa sandi Anda.
:::

::: details Isi file cadangan
File bernama `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip`. Bagian nama berasal dari profil Anda dan dihilangkan jika belum diatur. `<n>` menghitung ekspor yang dibuat pada hari yang sama. Isinya meliputi profil Anda, beserta folder, Trash, templat dan favorit; setiap sesi tersimpan beserta thumbnail-nya; gambar, font, logo yang Anda unggah dan salinan unduhan Anda; design system Anda; preferensi Anda (tema, lebar bilah sisi, statistik aktivitas lokal); versi tersimpan dan hasil Convert; serta, dari aplikasi web, riwayat versi karya Anda.

Cache katalog tidak disertakan. Perangkat baru mengunduh cache lagi. Setiap bagian memiliki checksum, sehingga impor mendeteksi file yang rusak dalam perjalanan. Sesi tersimpan ditautkan kembali ke gambar yang Anda impor. Aplikasi web, desktop dan seluler membaca file yang sama. Aplikasi terminal menulis cadangannya sendiri yang lebih sederhana, yang tidak dapat dibaca oleh format ini. **Export my data & render everything** membuat file yang sama ditambah zip kedua dengan setiap sesi tersimpan dirender menjadi keluarannya. Format lengkap ada di [Transfer data](/info/data-transfer.html).
:::

<!--i:eti-globe-->
## Jika Anda menghapus data browser

Di aplikasi web, Lolly menyimpan semuanya dalam penyimpanan browser Anda untuk situs ini: pekerjaan tersimpan, gambar, font, design system, riwayat versi dan unduhan offline. Menghapus data situs ini di browser menghapus semuanya, dan Lolly tidak dapat mengembalikan apa pun darinya. Yang tersisa adalah yang sudah keluar dari browser: file yang Anda unduh, file **Export my data**, salinan [Sync](/info/sync.html) dan tautan yang Anda bagikan.

::: warning Sebelum Anda menghapus data browser
Tekan **Export my data** di bawah **Settings → Storage**, dan simpan file di tempat lain.
:::

Saat aplikasi dimulai, Lolly meminta browser agar tidak menghapus penyimpanannya saat ruang perangkat hampir habis, dan browser yang memutuskan. Di bawah **Settings → Available offline**, baris yang diawali **Protected** berarti browser menyetujui. "The browser may clear downloads if the device runs low on space" berarti browser tidak menyetujui, dan **Protect downloads** meminta lagi.

Jika browser tidak menyetujui, browser dapat menghapus pekerjaan tersimpan serta unduhan saat ruang hampir habis, jadi simpan file **Export my data** yang baru.

**Settings → Storage** menunjukkan ruang yang digunakan setiap jenis data. Baris **History** menghitung checkpoint otomatis, pratinjaunya dan draf pemulihan. **Remove automatic checkpoints older than 30 days** mengosongkan ruang tersebut dan mempertahankan versi tersimpan dan bernama. **Clear cache** menghapus file katalog yang diunduh, yang akan diunduh lagi saat diperlukan. **Clear all my data** meminta Anda mengetik sebuah kata, menonaktifkan Sync, lalu menghapus semua yang disimpan Lolly di browser ini: profil dan pengaturan Anda, sesi tersimpan beserta riwayatnya dan Trash, unggahan, font dan design system, log unduhan, hasil Convert, model AI yang diunduh dan salinan offline. File yang Anda unduh tetap di tempat Anda menyimpannya. Aplikasi lalu dimulai seperti pada kunjungan pertama.

![Kartu penyimpanan pada layar selebar ponsel: setiap kategori data di perangkat diberi nama, dengan tombol Clear all my data di bagian bawah](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-selbar%2C.profile-row-value%2C.profile-group-value%2C%23store-hero-num%2C%23store-headroom%7Bdisplay%3Anone%7D&format=svg&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

Di aplikasi desktop dan seluler, sesi tersimpan berupa file di folder data milik aplikasi, dan semua yang lain berada di penyimpanan milik aplikasi. Membersihkan browser web tidak menyentuhnya.

::: details Tempat aplikasi desktop dan seluler menyimpan sesi tersimpan
Satu file per sesi tersimpan, di folder `saved-state`:

- macOS: `~/Library/Application Support/tools.lolly.Desktop/saved-state/`
- Windows: `%APPDATA%\tools.lolly.Desktop\saved-state\`
- Linux: `~/.local/share/tools.lolly.Desktop/saved-state/`, atau path yang sama di bawah `$XDG_DATA_HOME`
- iPhone, iPad dan Android: di dalam penyimpanan milik aplikasi, yang tidak ditampilkan aplikasi Files

Gambar, design system dan daftar unduhan terbaru tetap di penyimpanan internal aplikasi, bukan di folder ini. Aplikasi terminal dan baris perintah membaca folder `saved-state` yang sama: lihat [Tempat sesi tersimpan berada](/info/cli-reference.html#where-saved-sessions-live).
:::

<!--i:eti-trash-->
## Mengembalikan sesuatu yang Anda hapus

Menghapus sesi tersimpan, folder, salah satu unggahan atau salah satu font Anda di aplikasi memindahkannya ke **Trash** selama 30 hari, dari mana pun Anda menghapusnya: **Projects**, **Assets**, **Settings → Storage** atau daftar sesi tersimpan milik alat. Folder beserta seluruh isinya masuk ke Trash sebagai satu entri. Sesi mempertahankan riwayat versinya di Trash. Tepat setelah Anda menghapus, sebuah pesan menawarkan **Undo**. Setelah itu:

1. Buka **Trash**: ubin **Trash** di **Projects**, tombol **Trash** di **Assets → Your uploads** atau baris **Trash** di **Settings → Storage**. Ketiganya membuka daftar yang sama.
2. Tekan **Restore** di samping item. Item kembali ke foldernya, dan font mendapatkan kembali peran yang dimilikinya dalam design system.

**Delete forever** menghapus satu item secara permanen. **Empty Trash** meminta persetujuan lebih dulu, lalu menghapus setiap item di Trash. Item yang lebih lama dari 30 hari dihapus secara permanen.

::: warning Sebagian penghapusan langsung berlaku
Menghapus design system, logo atau foto profil Anda tidak memindahkannya ke Trash. Baris perintah dan aplikasi terminal juga langsung menghapus.
:::

Dengan [Sync](/info/sync.html) aktif, **Restore an earlier copy** dapat mengembalikan keadaan seluruh perangkat pada hari sebelumnya, dan file **Export my data** mengembalikan apa yang tersimpan dalam file tersebut.
