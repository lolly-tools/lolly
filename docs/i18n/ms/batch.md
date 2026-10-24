# Batch dan Multi-edit

Dua tugas timbul sebaik sahaja anda kerap membuat jenis fail yang sama. Kadangkala anda memerlukan banyak versi satu reka bentuk: kad dalam sedozen bahasa, atau setiap saiz sepanduk. Kadangkala anda mempunyai beberapa reka bentuk tersimpan yang berbeza dan mahu satu perubahan sampai kepada semuanya, seperti tarikh baharu atau tajuk baharu.

**Batch** melakukan tugas pertama dan **Multi-edit** melakukan yang kedua. Kedua-duanya berjalan pada peranti anda dan mengeksport melalui laluan render yang sama seperti alat itu sendiri.

::: cols
## Batch

- Satu templat, banyak baris. Setiap baris ialah satu set input dan menghasilkan satu fail.
- Isi baris dengan menaip, menampal daripada hamparan atau mengimport CSV.
- Tiada had baris; 50 ditunjukkan bagi setiap halaman.
- Dibuka daripada **Batch** dalam pengepala Projects (`#/batch`).

## Multi-edit

- Dua hingga lapan reka bentuk tersimpan berbeza, bersebelahan sebagai kad langsung.
- Satu bar sisi menyunting input yang dikongsi, kemudian input setiap kad sendiri.
- Setiap reka bentuk disimpan semula ke tempat asalnya.
- Dibuka daripada **Edit together** dalam bar pilihan Projects.
:::

## Buat banyak versi satu reka bentuk

Buka **Projects** dan tekan **Batch** dalam pengepalanya. Grid bermula dengan satu baris: pilih templat di dalamnya, kemudian gandakan baris atau tampal data daripada hamparan anda. Dibuka dari dalam folder, Batch mengembalikan anda ke folder itu.

![Batch pada grid baharu: nama fail dan alat baris di bahagian atas, dan senarai templat baris pertama dibuka pada alat yang boleh anda pilih](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=use-batch-toolbar)

**Isi baris.** Taip ke dalam sel atau tampal blok terus daripada Excel, Google Sheets atau hamparan lain. **Import CSV** menambah baris atau menggantikan kelompok. Apabila anda menampal ke dalam sel yang memegang tetapan eksport, Lolly bertanya input mana yang diisi setiap lajur yang ditampal. **Export CSV** menulis semula grid. Buka **Columns** di bawah grid untuk menunjukkan lebih banyak input, atau lebar, tinggi, unit dan DPI bagi setiap baris.

**Tetapkan output.** Bar alat menetapkan nama fail zip, **Default format**, unit dan DPI untuk setiap baris. Menu format ialah senarai berkumpulan panel eksport, menunjukkan format yang ditawarkan katalog dan disokong pelayar anda. Baris dengan format, saiz atau nama failnya sendiri mengekalkan tetapannya sendiri.

**Render.** **Render all** mengeksport setiap baris ke dalam satu `.zip`. Pilih baris dahulu dan **Render selected**, **Export selected CSV** dan **Print selected rows** bertindak pada baris itu sahaja; kosongkan pilihan untuk bekerja pada keseluruhan kelompok semula. **Print sheet** menyusun baris pada helaian boleh cetak. **Batch activity** melaporkan setiap import dan render, dan melipat untuk memberi jadual lebih ruang.

**Simpan kelompok.** **Sessions** menyimpan keseluruhan grid sebagai sesi kelompok bernama, yang dibuka semula kemudian daripada Projects. Sessions sentiasa menyimpan setiap baris, apa pun yang dipilih. **Folders…** dalam menu yang sama membuka seluruh folder Projects sebagai baris, satu bagi setiap sesi tersimpan, dengan setiap nama fail membawa laluan foldernya.

::: details Memilih baris dan sel
Pilih baris dengan kotak semaknya, atau Shift-klik kotak semak untuk julat. Kotak semak pengepala memilih halaman semasa, dan **Select all *N* rows** mengambil baris di halaman lain juga. Pilihan kekal semasa anda bergerak antara halaman. **Edit input**, **Duplicate** dan **Remove** bertindak pada baris terpilih, dan **Undo remove** memulihkan baris yang terakhir dibuang. Daripada sel yang difokuskan, Shift+Space memilih baris itu dan Escape mengosongkan pilihan.

Seret merentasi sel, Shift-klik sel atau gunakan kekunci Shift+Anak panah untuk memilih segi empat tepat. **Copy cells**, atau Ctrl+C / Command+C, menyalin nilai untuk hamparan. Ctrl+A / Command+A daripada sel yang difokuskan memilih setiap lajur kelihatan pada setiap halaman; daripada kotak semak baris, pintasan yang sama memilih setiap baris. Memilih sel membiarkan baris yang ditanda kekal ditanda. Klik dua kali sel atau tekan Enter untuk menyunting teksnya. Tampal segi empat tepat daripada papan keratan, atau tampal satu nilai untuk mengisi setiap sel terpilih; sel kosong dan teks berbilang baris mengekalkan kedudukannya.
:::

### Colourway dan tema bagi setiap baris

Setiap baris mengekalkan pilihan temanya sendiri: cerah atau gelap, dan colourway apabila sistem reka bentuk mempunyainya. Baris yang dibuka daripada Projects, folder atau kelompok tersimpan dirender dalam pilihan yang menyimpan sesinya, dan pratontonnya dibuka dalam pilihan itu. Helaian cetakan, baris yang digandakan dan baris yang diisi semuanya mengekalkannya.

CSV membawa pilihan dalam lajur `_themes` selepas lajur saiz, memegang JSON yang sama seperti parameter pautan `_themes`, contohnya `{"":"dark","colourway":"beach"}`. Sel kosong, atau `{}`, bermakna lalai sistem reka bentuk. Lajur ditulis hanya apabila sesetengah baris mempunyai pilihan, jadi kelompok tanpa mana-mana mengeksport CSV yang sama seperti sebelum ini. Semasa import, sel yang bukan pilihan tema yang sah disenaraikan sebagai isu dan barisnya dirender dalam lalai. Grid belum mempunyai kawalan untuk mengubah pilihan baris, jadi tetapkannya dalam CSV atau sesi tersimpan.

### Batch, atau Render folder

Batch membuat banyak varian satu templat. Untuk merender semula sesi yang sudah anda simpan, pilihnya dalam Projects dan gunakan **Render selection**, atau **Render folder** untuk seluruh folder; [Find and recover your work](/info/find-your-work.html#find-something-you-saved) meliputi kedua-duanya.

## Sunting beberapa reka bentuk tersimpan bersama

Tanda antara dua dan lapan sesi tersimpan dalam **Projects** dan pilih **Edit together** daripada bar pilihan. Ia dibuka bersebelahan sebagai kad langsung di `#/multi?s=<slot>,<slot>…`. Setiap kad ialah render sebenar sesinya, jadi apa yang anda lihat ialah apa yang akan dieksport.

Satu bar sisi memandu kesemuanya:

- <!--i:sliders--> **Shared** dahulu: setiap input yang diisytiharkan dengan cara yang sama oleh dua atau lebih sesi (id sama, jenis sama, kekangan sama, peraturan yang digunakan grid kelompok untuk lajurnya). Sunting kawalan dikongsi sekali dan nilai sampai kepada setiap sesi yang mengisytiharkan input itu, secara langsung pada setiap kad. Dua sesi alat yang sama berkongsi segala-galanya; dua alat berbeza hanya berkongsi input yang sama.
- <!--i:document--> Di bawahnya, **satu kad terlipat bagi setiap sesi** memegang semua input sesi itu sendiri, selengkap bar sisi alat itu sendiri, dengan blok eksport padat: **Format**, **W** / **H**, **Unit**, **DPI** dan **Download**. Download itu menyimpan sesi dahulu, kemudian merender fail dengan nama fail, format dan Content Credentials yang sama seperti daripada alat.
- <!--i:search--> **Filter inputs…** di bahagian atas mengecilkan kawalan pada setiap kad sekali gus, supaya anda boleh mencapai "tajuk" dalam lapan sesi tanpa menatal.

Klik mana-mana kad (atau tekan Enter padanya) untuk membuka kad bar sisi sesi itu. **Save all** menulis setiap sesi semula ke slotnya sendiri. **Download all** menyimpan dahulu, kemudian merender keseluruhan set ke dalam satu zip, dengan cara yang sama seperti **Render selection** dalam Projects, dengan kunci kata laluan pilihan ditawarkan semasa itu.

Setiap kad dilukis dalam pilihan tema sesinya sendiri, termasuk alat yang diletakkan di dalam reka bentuk. Kad dalam rupa berbeza duduk bersebelahan manakala apl di sekelilingnya mengekalkan warnanya sendiri, dan **Save all**, muat turun, **Batch grid** dan **Send to Print Sheet** mengekalkan pilihan setiap sesi.

### Had

- **Lapan paling banyak.** Setiap kad memasang masa jalan langsungnya sendiri, dan lapan ialah nombor yang kekal responsif. Pautan yang meminta lebih, atau sesi yang tidak lagi wujud, menyatakannya dan bukan dimuatkan separuh.
- **Pautan itu setempat.** Ia menamakan slot tersimpan anda sendiri, jadi ia membuka semula set itu pada peranti ini. Ia bukan pautan kongsi.
- **Untuk yang lebih besar,** pilih **Edit as sheet** dalam bar pilihan yang sama. Ia membuka keseluruhan pilihan sebagai baris dalam grid kelompok (`#/batch?s=…`), tanpa had saiz dan tanpa peraturan alat sama. Folder kekal di luar kedua-duanya: buka folder dalam grid dengan **Sessions → Folders…**, atau render satu dengan **Render folder** dalam Projects.
- **Carian tidak sampai ke Multi-edit.** Ia satu-satunya paparan yang tidak diketahui bar carian.

## Ke mana seterusnya

- **[Export a file](/info/exporting.html)**: format, saiz dan tetapan cetakan yang boleh digunakan setiap baris.
- **[Templates](/info/templates.html)**: titik mula yang menjadikan baris pertama yang baik.
- **[Find and recover your work](/info/find-your-work.html)**: Projects, folder dan merender apa yang anda simpan.
