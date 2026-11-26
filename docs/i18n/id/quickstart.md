# Mulai

Atur alat dengan warna dan font Anda sendiri, dan gunakan kembali pekerjaan yang sudah Anda miliki. Anda tidak memerlukan akun, dan pembuatan serta ekspor berjalan di perangkat Anda.

::: steps
- <!--i:eti-sparkles--> **[Buat satu file](/info/make-something.html)** Kode QR dalam beberapa menit, dengan setiap langkah ditampilkan.
- <!--i:eti-palette--> **[Masukkan merek Anda](#put-your-brand-in)** Mulai dari satu warna, file token atau desain jadi.
- <!--i:eti-folder-move--> **[Bawa pekerjaan Anda](#bring-in-what-you-already-have)** Desain, deck dan data yang sudah Anda miliki, dibaca di perangkat Anda.
- <!--i:eti-repeat--> **[Buat lebih banyak yang serupa](#make-many-share-and-automate)** Bagikan tautan, isi spreadsheet atau jalankan alat dari skrip.
:::

[Apa itu Lolly?](/info/what-is-lolly.html) adalah pengantar lima menit. [Cara kerja Lolly](/info/how-lolly-works.html) menunjukkan siapa melakukan apa.

<!--i:eti-palette-->
## Masukkan merek Anda

lolly.tools terbuka dengan **Lolly Demo**, contoh design system milik Lolly sendiri ([Mengenal Lolly Demo](/info/lolly-demo.html)). Design system Anda menggantikan Lolly Demo. Ini adalah sekumpulan kecil token desain (warna, font dan beberapa aturan) yang digunakan setiap alat untuk menggambar. Atur sekali, dan semua yang Anda buat sejak awal sesuai merek.

Pilih jalur yang sesuai dengan apa yang Anda miliki:

- <!--i:palette--> **Satu warna.** Buka tampilan **Design System Setup** (`#/start`), beri nama design system Anda dan pilih warna utama. Lolly menghasilkan palet yang aksesibel dari warna itu, dengan permukaan, teks dan aksen terang dan gelap. Pilih font dan merek Anda siap digunakan.
- <!--i:upload--> **File token.** **Add from…**, di bagian atas Lolly Design System Setup, menerima file token DTCG, Tokens Studio atau Penpot, SVG atau paket `LollyBrand`. Palet terisi dari file. Saat design system masih kosong, **Start from a reference** di Board membuka pemilih yang sama.
- <!--i:pentool--> **Desain jadi.** Di Lolly Design, pilih **Import a design** dan letakkan file Figma, Penpot, Illustrator, InDesign, Affinity, Photoshop, PowerPoint atau SVG ([setiap format](/info/design-import.html#what-comes-in-from-each-app)). Lihat [Bawa apa yang sudah Anda miliki](#bring-in-what-you-already-have) di bawah.

Saat pertama kali Anda membuka galeri, sapaan di bagian atas menawarkan satu langkah berikutnya. Di lolly.tools, **Start making** membuka Lolly Design pada poster Launch. Pada instalasi baru, **Make it yours** membuka Lolly Design System Setup. Di bawah tombol itu, **Bring a file** membuka pemilih file desain, dan pilihan lain dari kedua pilihan tersebut muncul sebagai tautan. Memilih salah satunya, atau tombol tutup, menutup sapaan untuk selamanya.

![Ruang Colours di Lolly Design System Setup pada design system baru: satu chip langsung, satu field dan seluruh keputusan pertama](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&system=new-design-system&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-colours-new-system)

Delapan ruang, yang dapat digunakan dalam urutan apa pun, mengembangkan design system lebih lanjut: **Board**, **Colours**, **Type**, **Logos**, **Tokens**, **Files**, **Rules** dan **Skills**. Setiap pratinjau di aplikasi diperbarui saat Anda mengetik. [Lolly Design System Setup](/info/brand-studio.html) membahas setiap ruang.

Font disimpan di perangkat Anda. Google Font yang Anda pilih disimpan sebagai aset merek, sehingga tipografi Anda berfungsi offline dan tidak ada yang diambil saat alat menggambar.

### Melihat, beralih dan berbagi design system

- **Lihat yang aktif.** **Settings → Design system** menampilkan design system aktif sebagai sampul dan halaman, hanya baca.
- **Beralih di antaranya.** **Settings → Preferences → Design systems** mencantumkan setiap design system di perangkat ini. Satu organisasi dapat menjalankan beberapa design system, atau satu dengan beberapa colourway. [Arsitektur merek](/info/brand-architectures.html) memetakan susunannya.
- **Bagikan satu.** Ekspor design system sebagai paket `LollyBrand`: satu file yang diimpor rekan untuk mendapatkan palet, font dan aturan yang sama.

Design system yang disediakan build atau organisasi Anda **dikelola**: ditandai dengan ikon gembok dan tetap hanya-baca. Untuk mengubahnya, buat salinan yang dapat disunting dari **Settings → Preferences → Design systems**.

![Tab Design system di Settings: design system aktif berupa sampul dan halaman](/t/url-shot?url=%2F%23%2Fd%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=dashboard-brand&waitSelector=%5Bdata-issue-ready%5D)

Design system Anda berupa token DTCG, format yang dibaca dan ditulis Penpot serta dibawa Tokens Studio ke Figma. Palet yang Anda gunakan saat mendesain dan palet yang diterapkan Lolly adalah satu dokumen. [Token Desain](/info/design-tokens.html) menjelaskan detailnya.

::: details Untuk pengembang: buat paket brand dari baris perintah
`ingest:brand` membuat paket brand yang dapat digunakan kembali dalam checkout. Perintah ini menerima tiga wadah yang diekspor Penpot dan Tokens Studio: satu `tokens.json`, direktori berisi file per set dengan `$metadata.json` atau arsip `project.penpot`.

```bash
pnpm run ingest:brand ./my-tokens.json --name acme --label "Acme" --activate
```

`--activate` mendaftarkan brand sebagai profil serta membangun dan memvalidasi katalognya. Perintah ini tidak pernah mengubah profil default: jalankan dengan `LOLLY_PROFILE=acme` untuk menggunakan paket baru. [Konfigurasi](/info/configuration.html) menjelaskan hubungan paket brand dan profil.
:::

<!--i:eti-folder-move-->
## Masukkan yang sudah Anda miliki

**File Lolly Design.** Karya jadi dari Figma, Penpot, Illustrator, InDesign atau aplikasi SVG apa pun terbuka di Lolly Design sebagai tata letak yang dapat disunting. Teks tetap dapat diketik ulang, bentuk tetap berupa bentuk dan gambar masuk ke pustaka Anda. File dibaca di browser Anda dan tidak ada yang diunggah. [Impor desain](/info/design-import.html) mencantumkan setiap format dan apa yang dipertahankan.

**Deck.** Jatuhkan PowerPoint `.pptx` ke Lolly untuk menyimpan slide-nya sebagai aset. Tulis deck baru dari Markdown di **Lolly Markdown Slides**. [Terapkan brand baru pada deck](/info/rebrand.html) memindahkan deck ke design system Anda.

**Data.** Tempel atau jatuhkan tabel CSV atau JSON untuk mengisi field berulang pada alat. [Lolly Batch](/info/batch.html#make-many-versions-of-one-design) membuat satu file jadi per baris.

### Dari karya sekali pakai menjadi templat

Tata letak yang diimpor adalah sesi Lolly Design biasa. **Share with rules** mengubah sesi itu menjadi alat. Anda memilih bagian yang boleh diubah orang lain dan mereka hanya mengisi bagian tersebut.

![Simpan master Lolly Design, pilih input dan batasan dalam salinan untuk pembuatan alat lalu bagikan alat .lolly yang dapat digunakan kembali untuk diisi penerima](/info/diagrams/concepts/share-with-rules.svg)

[Bagikan desain dengan aturan](/info/create-a-tool.html) memandu Anda melalui setiap langkah.

<!--i:eti-repeat-->
## Buat banyak, bagikan dan otomatisasikan

- <!--i:download--> **Ekspor.** Alat membuat SVG, PDF, PNG, JPG, WebP, video dan lainnya, dengan ukuran cetak sebenarnya bila diperlukan. Setiap alat menawarkan formatnya sendiri. Lihat [Ekspor file](/info/exporting.html).
- <!--i:link--> **Bagikan tautan.** Pengaturan alat ikut dalam tautannya, jadi tautan itu membuka kembali file yang sama di mana pun.
- <!--i:layers--> **Buat satu per baris.** Jalankan alat dari spreadsheet di [Lolly Batch](/info/batch.html#make-many-versions-of-one-design).
- <!--i:cpu--> **Otomatisasikan.** Render yang sama berjalan dari [CLI](/info/cli.html) dan dari [agen AI](/info/ai-agents.html).

Tautan adalah permintaan lengkap. Jenis, judul dan tabel data grafik di bawah ini diketik ke bilah alamat.

![Grafik batang pendaftaran bulanan menurut kanal dalam warna design system, dengan setiap nilai berasal dari parameter kueri alih-alih klik](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26sty%3Dposter%26pl%3Droles%26transparentBg%3Dfalse%26d%3DMonth%2CWeb%2CApp%2CPartners%250AJan%2C120%2C60%2C25%250AFeb%2C180%2C95%2C40%250AMar%2C265%2C150%2C70%250AApr%2C340%2C210%2C110%250AMay%2C455%2C290%2C160%250AJun%2C560%2C380%2C230%26t%3DSignups%2520this%2520year%26st%3DBy%2520channel%252C%2520January%2520to%2520June%26full&width=1440&height=900&dpi=192&waitMs=4000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-d3-url-chart)

<!--i:eti-map-pin-->
## Ke mana selanjutnya

- <!--i:people--> **[Buat](/info/creators.html)**: membuat, menganimasikan, merekam, berbagi dan mengekspor.
- <!--i:code--> **[Otomatisasikan](/info/builders.html)**: design system, pembuatan alat, baris perintah, tautan dan agen.
- <!--i:usercheck--> **[Kelola](/info/operators.html)**: menjalankan Lolly untuk tim dengan Lolly Work.
- <!--i:server--> **[Deploy](/info/operate.html)**: menghosting Lolly dan Lolly Work.
- <!--i:shieldcheck--> **[Kepercayaan](/info/trust.html)**: privasi, keamanan dan memeriksa file sendiri.
