# Lolly Batch dan Lolly Multi-edit

<a id="batch-and-multi-edit"></a>

**Lolly Batch** membuat banyak versi satu reka bentuk, seperti kad dalam sedozen bahasa atau setiap saiz sepanduk. **Lolly Multi-edit** membuat satu perubahan, seperti tarikh atau tajuk baharu, pada beberapa reka bentuk tersimpan yang berbeza.

Kedua-duanya berjalan pada peranti anda dan mengeksport melalui laluan render yang sama seperti alat.

::: cols
## Batch

- Satu templat, banyak baris. Setiap baris ialah satu set input dan menghasilkan satu fail.
- Isi baris dengan menaip, menampal daripada hamparan atau mengimport CSV.
- Tiada had baris; 50 ditunjukkan setiap halaman.
- Dibuka daripada **Lolly Batch** dalam pengepala Projects (`#/batch`).

<a id="multi-edit"></a>
## Lolly Multi-edit

- Dua hingga lapan reka bentuk tersimpan yang berbeza, bersebelahan sebagai kad langsung.
- Satu bar sisi menyunting input yang dikongsi, kemudian input setiap kad sendiri.
- Setiap reka bentuk disimpan kembali ke tempat asalnya.
- Dibuka daripada **Edit together** dalam bar pilihan Projects.
:::

<!--i:eti-table-->
## Buat banyak versi satu reka bentuk

Buka paparan **Projects** dan tekan **Batch** dalam pengepalanya. Grid bermula dengan satu baris. Pilih templat dalam baris itu, kemudian gandakan baris atau tampal data daripada hamparan. Apabila dibuka dari dalam folder, Batch mengembalikan anda ke folder itu.

![Batch pada grid baharu: nama fail dan alat baris di sepanjang bahagian atas, dan senarai templat baris pertama terbuka pada alat yang boleh anda pilih](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=use-batch-toolbar)

**Isi baris.** Taip dalam sel atau tampal blok daripada Excel, Google Sheets atau hamparan lain. **Import CSV** menambah baris atau menggantikan kelompok. Apabila anda menampal ke dalam sel yang mengandungi tetapan eksport, Lolly bertanya input mana yang diisi oleh setiap lajur yang ditampal. **Export CSV** menulis keluar grid. Buka **Columns** di bawah grid untuk menunjukkan lebih banyak input, atau lebar, tinggi, unit dan DPI bagi setiap baris. Popover **Fill** lajur nombor, teks atau pilihan juga mempunyai bahagian **Design token** yang memautkan satu token merentas baris lajur itu ([Pautkan banyak dokumen serentak](/info/token-workflows.html#link-many-documents-at-once)).

**Tetapkan output.** Bar alat menetapkan nama fail zip, **Default format**, unit dan DPI bagi setiap baris. Menu format ialah senarai berkumpulan panel eksport bagi format yang ditawarkan katalog dan disokong pelayar anda. Baris dengan format, saiz atau nama failnya sendiri mengekalkan tetapannya sendiri.

**Render.** **Render all** mengeksport setiap baris ke dalam satu `.zip`. Apabila baris dipilih, **Render selected**, **Export selected CSV** dan **Print selected rows** bertindak pada baris itu sahaja. Kosongkan pilihan untuk bekerja pada seluruh kelompok semula. **Print sheet** menyusun baris pada helaian boleh cetak. **Batch activity** melaporkan setiap import dan render, dan boleh dilipat.

**Simpan kelompok.** **Sessions** menyimpan setiap baris grid sebagai sesi kelompok bernama, tanpa mengira apa yang dipilih. Sesi dibuka semula daripada Projects. **Folders…** dalam menu yang sama membuka folder Projects sebagai baris, satu bagi setiap sesi tersimpan; setiap nama fail membawa laluan foldernya.

::: details Memilih baris dan sel
Pilih baris dengan kotak semaknya, atau Shift-klik kotak semak untuk memilih julat. Kotak semak pengepala memilih halaman semasa, dan **Select all *N* rows** turut mengambil baris pada halaman lain. Pilihan kekal apabila anda bergerak antara halaman. **Edit input**, **Duplicate** dan **Remove** bertindak pada baris terpilih, dan **Undo remove** memulihkan baris yang terakhir dialih keluar. Dari sel yang difokuskan, Shift+Space memilih baris itu dan Escape mengosongkan pilihan.

Seret merentasi sel, Shift-klik sel atau gunakan kekunci Shift+Anak panah untuk memilih segi empat. **Copy cells**, atau Ctrl+C / Command+C, menyalin nilai untuk hamparan. Ctrl+A / Command+A dari sel yang difokuskan memilih setiap lajur yang kelihatan pada setiap halaman; dari kotak semak baris, pintasan yang sama memilih setiap baris. Memilih sel mengekalkan tanda semak pada baris yang ditandai. Klik dua kali sel atau tekan Enter untuk menyunting teksnya. Tampal segi empat daripada papan keratan, atau tampal satu nilai untuk mengisi setiap sel terpilih; sel kosong dan teks berbilang baris mengekalkan kedudukannya.
:::

### Colourway dan tema bagi setiap baris

Setiap baris mengekalkan pilihan temanya sendiri: cerah atau gelap, dan colourway apabila sistem reka bentuk mempunyainya. Baris yang dibuka daripada Projects, folder atau kelompok tersimpan dirender dan dipratonton dengan pilihan semasa sesinya disimpan. Helaian cetakan, baris yang digandakan dan baris yang diisi mengekalkannya.

CSV membawa pilihan dalam lajur `_themes` selepas lajur saiz. Lajur itu mempunyai JSON yang sama seperti parameter pautan `_themes`, contohnya `{"":"dark","colourway":"beach"}`. Sel kosong, atau `{}`, bermaksud lalai sistem reka bentuk. Lajur itu ditulis hanya apabila ada baris yang mempunyai pilihan. Semasa import, sel yang bukan pilihan tema yang sah disenaraikan sebagai isu dan barisnya dirender dengan lalai.

::: note Tetapkan pilihan baris dalam CSV
Grid belum mempunyai kawalan untuk mengubah pilihan baris, jadi tetapkan pilihan itu dalam CSV atau dalam sesi tersimpan.
:::

### Bahasa untuk setiap baris

Alat yang mencetak perkataannya sendiri, seperti Certificate, boleh menerima lajur `language` dengan kod bahasa pendek seperti `de`, `ja` atau `ar`. Setiap baris kemudian mencetak perkataan dan tarikhnya dalam bahasa itu. Baris bahasa Arab dan Urdu disusun dari kanan ke kiri. Sel kosong mengikut bahasa apl. Bahasa yang belum mempunyai terjemahan dalam Lolly dicetak dalam bahasa Inggeris, termasuk tarikh, jadi sijil tidak pernah separuh diterjemahkan.

### Batch, atau Render folder

Untuk merender semula sesi yang telah anda simpan, pilih sesi itu dalam Projects dan gunakan **Render selection**, atau **Render folder** untuk seluruh folder. [Cari dan pulihkan kerja anda](/info/find-your-work.html#find-something-you-saved) meliputi kedua-duanya.

<!--i:eti-layers-->
## Sunting beberapa reka bentuk tersimpan bersama

Tandai antara dua hingga lapan sesi tersimpan dalam **Projects** dan pilih **Edit together** daripada bar pilihan. Sesi itu dibuka bersebelahan sebagai kad langsung di `#/multi?s=<slot>,<slot>…`. Setiap kad ialah render sebenar sesinya dan menunjukkan apa yang akan dieksport.

Satu bar sisi mengawal semuanya:

- <!--i:sliders--> **Shared** muncul dahulu: setiap input yang diisytiharkan dengan cara yang sama oleh dua atau lebih sesi (id, jenis dan kekangan yang sama, peraturan yang digunakan grid kelompok untuk lajurnya). Perubahan pada kawalan bersama mencapai setiap sesi yang mengisytiharkan input itu, secara langsung pada setiap kad. Dua sesi alat yang sama berkongsi semuanya; dua alat berbeza hanya berkongsi input sepunya. Menu **Input actions** pada kad Shared memautkan token reka bentuk dalam setiap sesi yang mengisytiharkan input itu.
- <!--i:document--> Di bawah kad Shared, **satu kad terlipat bagi setiap sesi** mengandungi semua input sesi itu sendiri, seperti dalam bar sisi alat itu sendiri, dengan blok eksport padat: **Format**, **W** / **H**, **Unit**, **DPI** dan **Download**. Download itu menyimpan sesi dahulu, kemudian merender fail dengan nama fail, format dan Content Credentials yang sama seperti yang dihasilkan oleh alat.
- <!--i:search--> **Filter inputs…** di bahagian atas mengehadkan kawalan pada setiap kad serentak.

Klik mana-mana kad (atau tekan Enter pada kad) untuk membuka kad bar sisi sesi itu. **Save all** menulis setiap sesi kembali ke slotnya sendiri. **Download all** menyimpan dahulu, kemudian merender set itu ke dalam satu zip, seperti **Render selection** dalam Projects, dan menawarkan kunci kata laluan pilihan.

Setiap kad dilukis dengan pilihan tema sesinya sendiri, termasuk alat yang diletakkan dalam reka bentuk. Apl di sekeliling kad mengekalkan warnanya sendiri. **Save all**, muat turun, **Batch grid** dan **Send to Print Sheet** mengekalkan pilihan setiap sesi.

### Had

- **Lapan paling banyak.** Setiap kad memuatkan persekitaran masa jalannya sendiri secara langsung, dan lapan kad kekal responsif. Pautan yang meminta lebih banyak, atau sesi yang tidak lagi wujud, menyatakannya dan tidak memuatkan sebahagian sahaja.
- **Pautan itu setempat.** Ia menamakan slot tersimpan anda sendiri dan membuka semula set itu pada peranti ini. Ia bukan pautan kongsi.
- **Untuk jumlah yang lebih besar,** pilih **Edit as sheet** dalam bar pilihan yang sama. Ia membuka pilihan sebagai baris dalam grid kelompok (`#/batch?s=…`), tanpa had saiz dan tanpa peraturan alat yang sama. Folder dikecualikan daripada kedua-duanya: buka folder dalam grid dengan **Sessions → Folders…**, atau render folder dengan **Render folder** dalam Projects.
- **Search tidak mencapai Lolly Multi-edit.** Ia satu-satunya paparan yang tidak diliputi bar carian.

<!--i:eti-map-pin-->
## Ke mana selepas ini

- **[Eksport fail](/info/exporting.html)**: format, saiz dan tetapan cetakan yang boleh digunakan setiap baris.
- **[Templat](/info/templates.html)**: titik mula yang menghasilkan baris pertama yang baik.
- **[Cari dan pulihkan kerja anda](/info/find-your-work.html)**: Projects, folder dan merender apa yang anda simpan.
