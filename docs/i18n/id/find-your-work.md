# Temukan dan pulihkan karya Anda

Semua yang Anda buat di Lolly tetap berada di browser atau aplikasi tempat Anda membuatnya, di perangkat itu, kecuali Anda mengaktifkan [Sync](/info/sync.html). Karya tersimpan ada di **Proyek**. Berkas yang diunduh berada di mana pun browser atau sistem Anda menaruhnya, dan sebuah salinan biasanya menunggu di **Aset**. Di sembilan tool, karya yang belum pernah Anda simpan juga dipertahankan. Halaman ini membahas masing-masing hal ini, ditambah tab yang tertutup, data browser yang terhapus, versi sebelumnya, item yang dihapus dan berpindah ke perangkat lain.

| Apa yang Anda lakukan | Tempat mencarinya |
|---|---|
| Menekan **Simpan sebagai** atau **Simpan** | **Proyek** |
| Menekan **Unduh** | Unduhan browser Anda, dan sebuah salinan di **Aset** |
| Tidak keduanya, di salah satu [sembilan tool yang menyimpan sambil Anda bekerja](#the-nine-tools-that-save-as-you-work) | **Proyek** dan **History** |
| Tidak keduanya, di tool lain mana pun | Hanya tab tempat Anda bekerja, sampai Anda menutup tab itu |
| Memindahkannya ke Sampah | Ubin **Sampah** di **Proyek**, selama 30 hari |

## Temukan sesuatu yang Anda simpan

1. Tekan **Beranda** di kiri atas tool.
2. Buka tab **Proyek** di bagian atas layar utama (ikon folder di ponsel).
3. Lihat di layar pertama. Karya yang tersimpan ke **Pustaka saya** ada di sana, dan setiap proyek adalah sebuah folder. Untuk mencari di semua folder sekaligus, ketik di **Cari semua proyek…** di bagian bawah layar.

Sebuah item diberi nama sesuai nama file yang Anda ketik di panel ekspor, atau sesuai tool-nya, seperti **QR Code**, jika Anda tidak mengetik apa pun. Buka item itu dan semua pengaturan kembali, siap diubah dan diekspor lagi. Untuk menyimpan karya baru dengan cara ini, lihat [Menyimpan dan melanjutkan](/info/using.html#saving-continuing).

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

- <!--i:folder--> **Folder yang bersarang.** Kelompokkan sesi tersimpan ke dalam folder, dan folder di dalam folder, sedalam yang Anda mau. Buat folder, ganti namanya atau seret sebuah ubin ke folder lain untuk memindahkannya; sebuah breadcrumb membawa Anda kembali ke atas. Sesi yang tersimpan tanpa folder muncul langsung di root **Proyek**.
- <!--i:clock--> **Urutkan dengan cara Anda sendiri.** **Opsi tampilan**, tombol slider di kanan atas, menawarkan **Grid** atau **Daftar** dan mengurutkan berdasarkan **Nama**, **Tanggal ditambahkan**, **Terakhir diubah** (bawaan), **Ukuran** dan, di dalam sebuah folder, **Berdasarkan alat**. Folder selalu muncul lebih dulu apa pun urutan yang aktif - urutan hanya mengatur sesi dan folder di dalam kelompoknya masing-masing.
- <!--i:document--> **Ajukan karya baru langsung ke sini.** **Aset baru** membuka picker bersama. Pilih **Templat** untuk mulai dari sebuah template tersimpan: buka untuk mengedit, atau gunakan **+ Tambah** untuk langsung menyimpan sebuah kreasi baru.
- <!--i:checklist--> **Multi-select (desktop).** Centang kotak centang sebuah ubin, seret kotak seleksi melintasi ruang kosong atau **Shift/Cmd-click**; **klik kanan** sebuah ubin untuk menu konteksnya. Bilah seleksi kemudian menawarkan **Render selection**, **Move to…**, **Folder baru**, **Delete** (yang memindahkan ke Sampah), **Edit together** untuk dua sampai delapan sesi satu-tool, berdampingan di bawah satu sidebar, dan **Edit as sheet**, yang membuka sebuah seleksi berapa pun ukuran atau campurannya sebagai baris di kisi batch.
- <!--i:download--> **Render seluruh folder atau seleksi.** **Render folder** mengekspor setiap sesi tersimpan dalam sebuah folder - termasuk sub-foldernya - sebagai satu `.zip` bersusun. **Render selection** melakukan hal yang sama untuk seleksi ganda mana pun, dan satu sesi tunggal dirender langsung menjadi berkasnya sendiri. Tidak perlu Batch/Pro.
- <!--i:link--> **Langsung menuju karya tersimpan sebuah tool.** Centang satu tool atau lebih di galeri Tools lalu pilih **View sessions** dari bilah seleksi - Proyek terbuka dan hanya menampilkan sesi yang dibuat dengan tool tersebut, dengan **Clear** untuk kembali ke tampilan penuh.
- <!--i:link--> **Bagikan sebuah sesi tersimpan.** Klik kanan sebuah sesi (di ponsel, tekan **•••** pada ubinnya) → **Share link** untuk menyalin sebuah tautan yang membukanya kembali dengan pengaturan yang sama; gambar dari perangkat Anda tidak ikut dengan tautan (dialog Share lengkap: lihat [Berbagi karya Anda](/info/using.html#sharing-your-work)).
- <!--i:pentool--> **Ganti nama atau salin satu.** Klik kanan sebuah sesi (di ponsel, tekan **•••** pada ubinnya) untuk **Rename**, **Duplicate** (sebuah salinan di folder yang sama) dan **Move to…**.

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

- **Anda menutup tab, atau kembali di lain waktu.** Karya yang belum disimpan hilang, kecuali di [sembilan tool](#the-nine-tools-that-save-as-you-work), yang menyimpan editan Anda sambil Anda bekerja: buka dari **Proyek**.
- **Anda memuat ulang halaman di tab yang sama.** Pengaturan Anda kembali dari alamat halaman. Di tool selain sembilan itu, gambar dan berkas yang Anda tambahkan dari perangkat Anda, serta teks satu baris yang lebih panjang dari 150 karakter, tidak kembali, karena alamat itu tidak menyimpannya.
- **Anda menekan Beranda, atau tombol kembali di kiri atas.** Jika Anda mengubah sesuatu sejak terakhir menyimpan, mengunduh atau menyalin, sebuah dialog **Unsaved changes** menanyakan apakah akan menyimpan dulu. **Save & leave** menyimpan karya dan membawa Anda ke **Proyek**, atau kembali ke folder proyek tempat Anda membuka karya itu. **Leave without saving** keluar; di sembilan tool tersebut editan Anda sudah tersimpan dan tetap ada di Proyek. **Cancel** mempertahankan Anda di tool itu.

Lolly hanya bertanya ketika Anda menekan **Beranda** atau tombol kembali di dalam sebuah tool. Menutup tab, memuat ulang dan tombol Back milik browser Anda sendiri tidak pernah bertanya. Untuk memastikan, tekan **Simpan sebagai**, atau **Simpan** di panel ekspor, sebelum Anda meninggalkan sebuah tool.

::: note Tidak sengaja keluar tanpa menyimpan?
Di tool selain sembilan itu, segera tekan tombol Back browser Anda. Pengaturan dari alamat halaman akan kembali, meski gambar yang Anda tambahkan dari perangkat Anda tidak. Lalu tekan **Simpan sebagai** dan **Simpan** sebelum Anda melakukan hal lain: kali ini Lolly tidak bertanya sebelum Anda keluar.
:::

::: details Sembilan tool yang menyimpan sambil Anda bekerja
[Design](/#/tool/design), [Chart](/#/tool/chart), [QR Code](/#/tool/qr-code), [Gradient](/#/tool/gradient), [Snippet](/#/tool/snippet), [Flow Chart](/#/tool/org-chart), [Pricing](/#/tool/pricing-table), [Wordmark](/#/tool/wordmark) dan [Text](/#/tool/text-helper). Daftar ini bertambah seiring makin banyak tool yang mendapatkan penyimpanan otomatis.

Di tool-tool ini, perubahan pertama Anda mengajukan karya itu ke **Proyek** seolah-olah Anda sudah menyimpannya, dan perubahan berikutnya dipertahankan dalam hitungan detik. Jadi sebuah kreasi yang belum disimpan tetap ada di Proyek setelah Anda menutup tab, dan **Leave without saving** tidak membuang editan Anda. Membuka tool itu lagi dari layar utama memulai sebuah kreasi baru; buka yang sebelumnya dari Proyek.

Ini hanya berfungsi di aplikasi web, tidak di aplikasi desktop atau mobile, dan tidak saat Anda bekerja live bersama orang lain.
:::

## Temukan berkas yang Anda unduh

Di sebuah browser, **Unduh** menyerahkan berkas ke browser Anda, yang menyimpannya di folder unduhannya (biasanya **Downloads**) atau menanyakan di mana. Lolly tidak diberi tahu ke mana berkas itu pergi, jadi lihat di daftar unduhan browser Anda.

Jika tidak ada berkas yang muncul, lihat di panel ekspor selagi Anda masih di tool itu. Di bawah **Unduh**, sebuah baris memberikan nama berkas dan waktunya, dengan **Retry download**, dan di Chrome, Edge dan browser Chromium lainnya **Save file…** untuk memilih folder sendiri. Baris itu dan berkasnya bertahan sampai Anda meninggalkan tool, memuat ulang atau mengekspor lagi.

Lolly juga menyimpan dua hal setelah setiap unduhan:

- **Sebuah salinan berkas**, di **Aset** di bawah **Unggahan Anda**, selama **Simpan render saya ke pustaka saya** aktif di bawah **Pengaturan → Render Anda** (**Pengaturan** ada di bagian bawah layar utama). Pengaturan ini mulai dalam keadaan aktif. Sebuah video, atau berkas di atas 50 MB, bertanya dulu, dan sebuah zip tidak disalin.
- **Pengaturan yang Anda gunakan**, untuk 24 unduhan terakhir Anda. **Ekspor terbaru**, di bawah karya tersimpan Anda di **Proyek**, membuka lagi tool itu dengan pengaturan tersebut sehingga Anda bisa membuat berkasnya lagi, meski gambar dan berkas yang Anda tambahkan dari perangkat Anda tidak disertakan. Daftar yang sama ada di bawah **Pengaturan → Aktivitas & statistik → Ekspor terbaru** dan di tab **Changes** pada **History**. Daftar ini menyimpan pengaturan, bukan berkasnya.

::: details Di aplikasi desktop dan mobile
- **Aplikasi desktop:** **Unduh** langsung menyimpan ke sebuah folder **Lolly** di dalam folder **Downloads** Anda, tanpa dialog. Sebuah pesan mengonfirmasi penyimpanan dan menawarkan **Reveal** untuk menampilkan berkasnya. **Open Exports Folder**, di menu **Window** atau **Exports**, membuka folder itu kapan saja. Sebuah berkas dengan nama sama seperti yang sebelumnya disimpan sebagai "name (1)".
- **iPhone dan iPad:** berkasnya disimpan di aplikasi **Files**, di bawah **Lolly**, dan share sheet terbuka sehingga Anda bisa meneruskannya.
- **Android:** menu share terbuka sehingga Anda bisa memilih ke mana berkas itu pergi.

Di iPhone, iPad dan Android, berkas baru menggantikan yang sebelumnya dengan nama yang sama.
:::

## Kembali ke versi sebelumnya

- **Selama kunjungan ini:** **Undo** mundur melalui 100 perubahan terakhir Anda, sampai Anda meninggalkan tool atau memuat ulang. Lihat [Undo dan redo](/info/using.html#undo-and-redo).
- **Di sembilan tool yang menyimpan sambil Anda bekerja:** versi sebelumnya dari setiap kreasi dipertahankan. Ikuti langkah-langkah di bawah.
- **Semua yang ada di perangkat:** dengan [Sync](/info/sync.html) aktif, **Restore an earlier copy**, di bawah **Pengaturan → Layanan terhubung**, mengembalikan salah satu dari tujuh salinan harian terakhir, atau salinan dari sebelum penerapan terakhir Anda. Semua yang ada di perangkat ini kemudian cocok dengan salinan itu, bukan hanya satu desain.

Untuk membuka versi sebelumnya di salah satu dari sembilan tool:

1. Tekan **History**, tombol jam di samping **Undo** dan **Redo**. Di Design, **History** ada di bilah atas; di ponsel, tekan **•••** lalu **History**.
2. Temukan versi itu berdasarkan tanggal dan waktunya. Baris **Automatic checkpoint** diambil sambil Anda bekerja; baris **Saved version** adalah waktu-waktu Anda menyimpan.
3. Tekan **Open as a copy**. Versi itu terbuka sebagai sebuah kreasi baru, dan yang tadinya Anda buka tetap seperti semula. Salinannya ada di **Proyek**, dengan "(copy)" setelah namanya.

Untuk mempertahankan sebuah versi dengan nama, tekan **Name version**, ketik sebuah nama dan tekan **Keep milestone**. Versi yang diberi nama terdaftar di halaman **History**, di bawah **Milestones**.

::: details Panel History dan halaman History
Panel **History** juga mencantumkan baris **Recovered work**, dan **Protected drafts** menyimpan editan terbaru Anda di antara checkpoint, dengan **Open draft as a copy**. **Compare** dan **Check assets** membantu Anda memilih sebelum membuka sebuah salinan. Alihkan **This creation** ke **All history on this device** untuk melihat setiap kreasi.

Automatic checkpoint makin jarang seiring waktu: satu per menit untuk satu jam terakhir, satu per jam untuk satu hari terakhir, satu per hari selama 30 hari, lalu satu per minggu. Saved version semuanya dipertahankan. Menghapus sebuah kreasi dari **Pengaturan → Penyimpanan** juga menghapus versinya.

Halaman **History** (`#/history`, atau **Open app history** di panel) mencakup setiap kreasi di browser ini. Di komputer, buka halaman itu dari tombol jam di kanan atas layar utama atau **Proyek**. Di ponsel, buka galeri tools di layar utama, tekan tombol logo bundar di kanan atas dan pilih **Sesi tersimpan**, yang membuka History. Dari **Proyek** item itu belum melakukan apa-apa.

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

::: warning Mengimpor menggantikan folder Anda
Jika perangkat lain sudah memiliki karya, baca ini dulu. Import menambahkan apa yang dimuat berkas itu, memperbarui item yang cocok dan tidak menghapus item tersimpan apa pun. Namun profil Anda adalah satu rekaman, jadi folder, favorit, template dan detail di perangkat itu digantikan oleh yang ada di berkas. Sebuah item tersimpan yang hanya ada di perangkat itu tetap ada, di level teratas **Proyek**. **Bring it to this device**, di Sync, melakukan hal yang sama.
:::

Untuk memindahkan semuanya sekaligus:

1. Di perangkat lama, buka **Pengaturan → Penyimpanan** dan, di bawah **Pindah ke perangkat lain**, tekan **Export my data**. Lolly mengunduh satu berkas `.zip` yang namanya dimulai dengan `LollyTools-`.
2. Bawa berkas itu lewat USB, email ke diri sendiri, AirDrop atau folder bersama.
3. Di perangkat baru, buka **Pengaturan → Penyimpanan**, tekan **Import data…**, pilih berkasnya dan tekan **Impor**.

::: note Apa yang tertinggal
Sign-in, kunci dan passphrase sync tetap ada di setiap perangkat. Daftar unduhan terbaru, unduhan offline dan model AI tidak berpindah lewat rute mana pun. Riwayat versi hanya berpindah di dalam sebuah berkas **Export my data**, bukan lewat Sync atau sebuah `.lolly`. Salinan yang disimpan Sync di penyimpanan Anda hanya terbuka lewat Sync, bukan dengan **Import data…** atau **Buka**.
:::

::: details Apa yang dimuat berkas backup
Berkas itu dinamai `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` (bagian namanya berasal dari profil Anda dan dihilangkan jika tidak diatur; `<n>` adalah penghitung per hari sehingga ekspor di hari yang sama tidak bertabrakan). Berkas itu berisi profil Anda, beserta folder, Sampah, template dan favorit Anda; setiap sesi tersimpan beserta thumbnail-nya; gambar, font, logo yang Anda unggah dan salinan unduhan Anda; design system Anda; preferensi Anda (tema, lebar sidebar, statistik aktivitas lokal); versi tersimpan dan hasil dari Convert; dan, dari aplikasi web, riwayat versi kreasi Anda.

Cache katalog tidak disertakan - cache itu mengunduh ulang sendiri di perangkat baru. Setiap bagian diberi checksum, sehingga sebuah berkas yang rusak dalam perjalanan tertangkap saat impor, bukan dipulihkan dalam keadaan setengah rusak. Sesi tersimpan menautkan ulang ke gambar yang Anda impor secara otomatis. Aplikasi web, desktop dan mobile membaca berkas yang sama; aplikasi terminal menulis backup miliknya sendiri yang lebih sederhana, yang tidak dibaca oleh format ini. **📦 Export my data & render everything** membuat berkas yang sama ditambah sebuah zip kedua dengan setiap sesi tersimpan dirender ke hasil keluarannya. (Spesifikasi format lengkap: [Transfer Data](/info/data-transfer.html).)
:::

## Jika Anda menghapus data browser Anda

Di aplikasi web, Lolly menyimpan semuanya di penyimpanan browser Anda untuk situs ini: karya tersimpan, gambar, font, design system, riwayat versi dan unduhan offline. Menghapus data situs ini di browser Anda menghapus semua itu, dan Lolly tidak bisa mengembalikan satu pun darinya. Yang tersisa adalah yang sudah keluar dari browser: berkas yang Anda unduh, sebuah berkas **Export my data**, sebuah salinan [Sync](/info/sync.html) dan tautan yang Anda bagikan.

::: warning Sebelum Anda menghapus data browser
Tekan **Export my data** di bawah **Pengaturan → Penyimpanan**, dan simpan berkasnya di tempat lain.
:::

Ketika aplikasi dimulai, Lolly meminta browser untuk tidak menghapus penyimpanannya ketika perangkat kehabisan ruang. Browser yang memutuskan. Di bawah **Pengaturan → Tersedia offline**, sebuah baris yang dimulai dengan **Protected** berarti browser menyetujuinya; "The browser may clear downloads if the device runs low on space" berarti tidak, dan **Lindungi unduhan** bertanya lagi. Jika browser tidak menyetujuinya, browser bisa menghapus karya tersimpan selain unduhan ketika ruang menipis, jadi simpan sebuah berkas **Export my data** terbaru.

**Pengaturan → Penyimpanan** menampilkan berapa banyak ruang yang digunakan tiap jenis data. **Clear cache** membuang berkas katalog yang diunduh, yang akan diunduh lagi saat dibutuhkan. **Clear all my data** meminta Anda mengetik sebuah kata, lalu menghapus profil, sesi tersimpan, gambar yang diunggah dan cache aset Anda. Data lain tetap ada, termasuk riwayat versi, daftar unduhan terbaru, hasil Convert, design system dan model AI yang diunduh. Untuk menghapus semuanya, hapus data situs ini di browser Anda.

![Kartu penyimpanan pada layar selebar ponsel: setiap kategori data di perangkat disebutkan, dengan tombol Clear all my data di bagian bawah](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-manages%2C.storage-subsection%2C.store-selbar%2C.store-chip-val%2C%23store-hero-num%2C%23store-headroom%2C%23store-quota%2C%23store-reclaim%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

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

Di **Proyek**, **Pindahkan ke Sampah** mempertahankan sebuah item selama 30 hari. Sebuah folder pergi ke Sampah beserta semua isinya, sebagai satu entri. Segera setelahnya, sebuah pesan menawarkan **Undo** selama sekitar sepuluh detik. Setelahnya:

1. Buka **Proyek** dan tekan ubin **Sampah**. Ubin ini hanya muncul selama Sampah menyimpan sesuatu.
2. Tekan **Pulihkan** di samping item itu.

**Hapus permanen** dan **Kosongkan Sampah** menghapus item seketika, tanpa bertanya. Item yang lebih tua dari 30 hari dihapus untuk selamanya pada saat berikutnya Anda membuka Proyek.

::: warning Penghapusan lainnya bersifat permanen
Menghapus sebuah sesi tersimpan di bawah **Pengaturan → Penyimpanan**, atau dari daftar sesi tersimpan sebuah tool di galeri (klik kanan kartu tool itu, lalu **N saved sessions**), menghapus sesi itu untuk selamanya, beserta riwayat versinya. Sebuah gambar yang Anda hapus dari **Gambar saya** dihapus seketika, tanpa bertanya.
:::

Dengan [Sync](/info/sync.html) aktif, **Restore an earlier copy** dapat mengembalikan state perangkat secara keseluruhan dari hari sebelumnya, dan sebuah berkas **Export my data** mengembalikan apa yang dimuat berkas itu.
